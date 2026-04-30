import frappe
from frappe.utils import flt, today, date_diff


@frappe.whitelist()
def get_finance_data(project):
    """Get all finance data for a single project"""
    data = {}
    
    # Project info
    proj = frappe.get_doc("Project", project)
    data["project_info"] = {
        "name": proj.name,
        "project_name": proj.project_name or "",
        "status": proj.status or "",
        "customer": proj.customer or "",
        "expected_start_date": str(proj.expected_start_date) if proj.expected_start_date else "",
        "expected_end_date": str(proj.expected_end_date) if proj.expected_end_date else ""
    }
    
    # Get Project Plan for budget data
    pp_name = frappe.db.get_value("Project Plan", {"project": project}, "name")
    data["has_plan"] = bool(pp_name)
    
    if pp_name:
        plan = frappe.get_doc("Project Plan", pp_name)
        data["plan"] = {
            "start_date": str(plan.start_date) if plan.start_date else "",
            "end_date": str(plan.end_date) if plan.end_date else "",
            "timeline_status": plan.timeline_status or "On Track",
            "boq_grand_total": flt(plan.boq_grand_total),
            "total_project_cost": flt(plan.total_project_cost),
            "department_budgets": [
                {
                    "department_name": r.department_name,
                    "budget_amount": flt(r.budget_amount),
                    "spent_amount": flt(r.spent_amount),
                    "remaining": flt(r.remaining),
                    "status": r.status or "On Track"
                } for r in (plan.department_budgets or [])
            ]
        }
    else:
        data["plan"] = {}
    
    # Sales Orders linked to project
    sales_orders = frappe.db.sql("""
        SELECT
            so.name,
            so.transaction_date,
            so.grand_total,
            so.status,
            so.per_billed,
            so.customer,
            (SELECT GROUP_CONCAT(DISTINCT soi.description SEPARATOR ', ')
             FROM `tabSales Order Item` soi WHERE soi.parent = so.name LIMIT 1) as description
        FROM `tabSales Order` so
        WHERE so.project = %s
        AND so.docstatus = 1
        ORDER BY so.transaction_date
    """, project, as_dict=1)
    
    so_total = 0
    so_billed = 0
    for so in sales_orders:
        so_total += flt(so.grand_total)
        so_billed += flt(so.grand_total) * flt(so.per_billed) / 100
    
    data["sales_orders"] = {
        "list": [{
            "name": so.name,
            "date": str(so.transaction_date) if so.transaction_date else "",
            "description": (so.description or "")[:50] + "..." if so.description and len(so.description) > 50 else (so.description or ""),
            "value": flt(so.grand_total),
            "billed": flt(so.grand_total) * flt(so.per_billed) / 100,
            "pending": flt(so.grand_total) * (1 - flt(so.per_billed) / 100),
            "status": "Fully Billed" if flt(so.per_billed) >= 100 else ("Partially Billed" if flt(so.per_billed) > 0 else "Not Billed")
        } for so in sales_orders],
        "count": len(sales_orders),
        "total_value": so_total,
        "total_billed": so_billed,
        "total_pending": so_total - so_billed
    }
    
    # Sales Invoices linked to project
    sales_invoices = frappe.db.sql("""
        SELECT
            si.name,
            si.posting_date,
            si.grand_total,
            si.outstanding_amount,
            si.status,
            (SELECT GROUP_CONCAT(DISTINCT sii.sales_order SEPARATOR ', ')
             FROM `tabSales Invoice Item` sii WHERE sii.parent = si.name) as against_so
        FROM `tabSales Invoice` si
        WHERE si.project = %s
        AND si.docstatus = 1
        ORDER BY si.posting_date
    """, project, as_dict=1)
    
    si_total = 0
    si_outstanding = 0
    for si in sales_invoices:
        si_total += flt(si.grand_total)
        si_outstanding += flt(si.outstanding_amount)
    
    si_paid = si_total - si_outstanding
    
    data["sales_invoices"] = {
        "list": [{
            "name": si.name,
            "date": str(si.posting_date) if si.posting_date else "",
            "against_so": si.against_so or "",
            "value": flt(si.grand_total),
            "paid": flt(si.grand_total) - flt(si.outstanding_amount),
            "outstanding": flt(si.outstanding_amount),
            "status": "Paid" if flt(si.outstanding_amount) == 0 else ("Overdue" if si.status == "Overdue" else "Partial")
        } for si in sales_invoices],
        "count": len(sales_invoices),
        "total_value": si_total,
        "total_paid": si_paid,
        "total_outstanding": si_outstanding
    }
    
    # Total Project Outstanding (from all unpaid invoices)
    data["total_outstanding"] = si_outstanding
    
    # Costs - Purchase Orders
    po_cost = frappe.db.sql("""
        SELECT COALESCE(SUM(grand_total), 0) as total
        FROM `tabPurchase Order`
        WHERE project = %s AND docstatus = 1
    """, project, as_dict=1)
    
    # Costs - Expenses
    expense_cost = frappe.db.sql("""
        SELECT COALESCE(SUM(grand_total), 0) as total
        FROM `tabExpense Claim`
        WHERE project = %s AND docstatus = 1
    """, project, as_dict=1)
    
    # Costs - Labour (from Project Timesheet)
    labour_cost = get_labour_cost(project)
    
    po_total = flt(po_cost[0].total) if po_cost else 0
    expense_total = flt(expense_cost[0].total) if expense_cost else 0
    
    total_cost = po_total + expense_total + labour_cost
    
    data["costs"] = {
        "po_cost": po_total,
        "expense_cost": expense_total,
        "labour_cost": labour_cost,
        "total_cost": total_cost
    }
    
    # Profitability
    project_value = so_total  # Use SO total as project value
    profit = project_value - total_cost
    margin = (profit / project_value * 100) if project_value > 0 else 0
    
    data["profitability"] = {
        "project_value": project_value,
        "total_cost": total_cost,
        "profit": profit,
        "margin": round(margin, 1),
        "is_profit": profit >= 0
    }
    
    # Budget vs Actual
    if pp_name:
        budget_total = sum(flt(r.budget_amount) for r in (plan.department_budgets or []))
        spent_total = sum(flt(r.spent_amount) for r in (plan.department_budgets or []))
        variance = budget_total - spent_total
        
        data["budget_summary"] = {
            "total_budget": budget_total,
            "total_spent": spent_total,
            "variance": variance,
            "variance_percent": round((variance / budget_total * 100) if budget_total > 0 else 0, 1),
            "is_under_budget": variance >= 0
        }
    else:
        data["budget_summary"] = {
            "total_budget": 0,
            "total_spent": 0,
            "variance": 0,
            "variance_percent": 0,
            "is_under_budget": True
        }
    
    return data


def get_employee_hourly_rate(employee):
    """Fetch latest salary structure assignment and calculate hourly rate"""
    result = frappe.db.sql("""
        SELECT custom_monthly_ctc
        FROM `tabSalary Structure Assignment`
        WHERE employee = %s
        AND docstatus = 1
        AND custom_monthly_ctc > 0
        ORDER BY from_date DESC
        LIMIT 1
    """, employee)
    if result and result[0][0]:
        monthly_salary = float(result[0][0])
        return round(monthly_salary / 30 / 8, 4)
    return 0


def get_labour_cost(project):
    """Calculate labour cost from Project Timesheet"""
    timesheet_employees = frappe.db.sql("""
        SELECT
            pte.employee,
            COALESCE(SUM(pte.working_hours), 0) as working_hours,
            COALESCE(SUM(pte.overtime_hours), 0) as overtime_hours
        FROM `tabProject Timesheet Employee` pte
        INNER JOIN `tabProject Timesheet` pt ON pt.name = pte.parent
        WHERE pte.project = %s AND pt.docstatus = 1
        GROUP BY pte.employee
    """, project, as_dict=1)
    
    total_cost = 0
    for emp in timesheet_employees:
        hourly_rate = get_employee_hourly_rate(emp.employee)
        working_cost = flt(emp.working_hours) * hourly_rate
        ot_cost = flt(emp.overtime_hours) * 5  # Fixed AED 5 per OT hour
        total_cost += working_cost + ot_cost
    
    return round(total_cost, 2)


@frappe.whitelist()
def get_all_projects_summary():
    """Get summary of all open projects for the popup"""
    projects = frappe.db.sql("""
        SELECT
            p.name,
            p.project_name,
            p.customer,
            p.status,
            p.expected_start_date,
            p.expected_end_date
        FROM `tabProject` p
        WHERE p.status NOT IN ('Cancelled', 'Completed')
        ORDER BY p.expected_start_date DESC
    """, as_dict=1)
    
    summary = []
    totals = {
        "project_value": 0,
        "total_cost": 0,
        "profit": 0,
        "outstanding": 0
    }
    
    for proj in projects:
        # Get SO value
        so_data = frappe.db.sql("""
            SELECT COALESCE(SUM(grand_total), 0) as total
            FROM `tabSales Order`
            WHERE project = %s AND docstatus = 1
        """, proj.name, as_dict=1)
        project_value = flt(so_data[0].total) if so_data else 0
        
        # Get costs
        po_cost = frappe.db.sql("""
            SELECT COALESCE(SUM(grand_total), 0) as total
            FROM `tabPurchase Order`
            WHERE project = %s AND docstatus = 1
        """, proj.name, as_dict=1)
        
        expense_cost = frappe.db.sql("""
            SELECT COALESCE(SUM(grand_total), 0) as total
            FROM `tabExpense Claim`
            WHERE project = %s AND docstatus = 1
        """, proj.name, as_dict=1)
        
        labour_cost = get_labour_cost(proj.name)
        
        total_cost = flt(po_cost[0].total if po_cost else 0) + flt(expense_cost[0].total if expense_cost else 0) + labour_cost
        
        # Profit
        profit = project_value - total_cost
        margin = (profit / project_value * 100) if project_value > 0 else 0
        
        # Outstanding
        outstanding = frappe.db.sql("""
            SELECT COALESCE(SUM(outstanding_amount), 0) as total
            FROM `tabSales Invoice`
            WHERE project = %s AND docstatus = 1
        """, proj.name, as_dict=1)
        outstanding_amt = flt(outstanding[0].total) if outstanding else 0
        
        # Determine status
        if proj.status == "On Hold":
            status = "On Hold"
        elif proj.expected_end_date and str(proj.expected_end_date) < today():
            status = "Delayed"
        else:
            status = "On Track"
        
        summary.append({
            "name": proj.name,
            "project_name": proj.project_name or "",
            "customer": proj.customer or "",
            "start_date": str(proj.expected_start_date) if proj.expected_start_date else "",
            "end_date": str(proj.expected_end_date) if proj.expected_end_date else "",
            "project_value": project_value,
            "total_cost": total_cost,
            "profit": profit,
            "margin": round(margin, 1),
            "outstanding": outstanding_amt,
            "status": status
        })
        
        # Accumulate totals
        totals["project_value"] += project_value
        totals["total_cost"] += total_cost
        totals["profit"] += profit
        totals["outstanding"] += outstanding_amt
    
    # Calculate average margin
    totals["avg_margin"] = round((totals["profit"] / totals["project_value"] * 100) if totals["project_value"] > 0 else 0, 1)
    totals["project_count"] = len(summary)
    
    return {
        "projects": summary,
        "totals": totals
    }
