import frappe
from frappe.utils import flt, today, date_diff, nowdate


def get_exchange_rate(from_currency, to_currency, date=None):
    """Get exchange rate between two currencies"""
    if from_currency == to_currency:
        return 1.0
    
    if not date:
        date = nowdate()
    
    # Try to get from Currency Exchange
    rate = frappe.db.get_value("Currency Exchange", {
        "from_currency": from_currency,
        "to_currency": to_currency,
        "date": ["<=", date]
    }, "exchange_rate", order_by="date desc")
    
    if rate:
        return flt(rate)
    
    # Try reverse
    reverse_rate = frappe.db.get_value("Currency Exchange", {
        "from_currency": to_currency,
        "to_currency": from_currency,
        "date": ["<=", date]
    }, "exchange_rate", order_by="date desc")
    
    if reverse_rate and flt(reverse_rate) > 0:
        return 1 / flt(reverse_rate)
    
    return 1.0  # Default if no rate found


def get_linked_projects(project):
    """Get child projects linked via parent_project field"""
    children = frappe.db.sql("""
        SELECT 
            p.name,
            p.project_name,
            p.company,
            p.status,
            p.parent_project
        FROM `tabProject` p
        WHERE p.parent_project = %s
        AND p.status NOT IN ('Cancelled', 'Completed')
    """, project, as_dict=1)
    
    return children


def get_project_company_currency(project):
    """Get company and its default currency for a project"""
    company = frappe.db.get_value("Project", project, "company")
    if company:
        currency = frappe.db.get_value("Company", company, "default_currency")
        return company, currency or "AED"
    return None, "AED"


def get_project_costs_converted(project, target_currency):
    """Get project costs converted to target currency using base amounts"""
    company, source_currency = get_project_company_currency(project)
    
    # Purchase Orders - use base_grand_total (already in company currency)
    po_cost = frappe.db.sql("""
        SELECT COALESCE(SUM(base_grand_total), 0) as total
        FROM `tabPurchase Order`
        WHERE project = %s AND docstatus = 1
    """, project, as_dict=1)
    
    # Expense Claims - use total_sanctioned_amount (Expense Claim doesn't have grand_total)
    expense_cost = frappe.db.sql("""
        SELECT COALESCE(SUM(total_sanctioned_amount), 0) as total
        FROM `tabExpense Claim`
        WHERE project = %s AND docstatus = 1
    """, project, as_dict=1)
    
    # Labour cost (already calculated in company currency)
    labour_cost = get_labour_cost(project)
    
    # Manhours
    manhours = get_manhours(project)
    
    po_total = flt(po_cost[0].total) if po_cost else 0
    expense_total = flt(expense_cost[0].total) if expense_cost else 0
    
    # Convert to target currency if different
    exchange_rate = get_exchange_rate(source_currency, target_currency)
    
    return {
        "po_cost": po_total * exchange_rate,
        "expense_cost": expense_total * exchange_rate,
        "labour_cost": labour_cost * exchange_rate,
        "total_cost": (po_total + expense_total + labour_cost) * exchange_rate,
        "manhours": manhours,
        "source_currency": source_currency,
        "exchange_rate": exchange_rate
    }


@frappe.whitelist()
def get_consolidated_finance_data(project):
    """Get consolidated finance data for parent + child projects"""
    data = {}
    
    # Get parent project info
    proj = frappe.get_doc("Project", project)
    parent_company, parent_currency = get_project_company_currency(project)
    
    data["parent_project"] = {
        "name": proj.name,
        "project_name": proj.project_name or "",
        "company": parent_company,
        "currency": parent_currency,
        "status": proj.status or ""
    }
    
    # Get linked child projects
    children = get_linked_projects(project)
    data["linked_projects"] = []
    
    for child in children:
        child_company, child_currency = get_project_company_currency(child.name)
        data["linked_projects"].append({
            "name": child.name,
            "project_name": child.project_name or "",
            "company": child_company,
            "currency": child_currency,
            "status": child.status or ""
        })
    
    data["has_linked"] = len(children) > 0
    data["display_currency"] = parent_currency
    
    # Sales Orders (from parent only - use base amounts)
    sales_orders = frappe.db.sql("""
        SELECT
            so.name,
            so.transaction_date,
            so.base_grand_total,
            so.status,
            so.per_billed,
            so.customer
        FROM `tabSales Order` so
        WHERE so.project = %s
        AND so.docstatus = 1
        ORDER BY so.transaction_date
    """, project, as_dict=1)
    
    so_total = sum(flt(so.base_grand_total) for so in sales_orders)
    so_billed = sum(flt(so.base_grand_total) * flt(so.per_billed) / 100 for so in sales_orders)
    
    data["sales_orders"] = {
        "list": [{
            "name": so.name,
            "date": str(so.transaction_date) if so.transaction_date else "",
            "value": flt(so.base_grand_total),
            "billed": flt(so.base_grand_total) * flt(so.per_billed) / 100,
            "pending": flt(so.base_grand_total) * (1 - flt(so.per_billed) / 100),
            "status": "Fully Billed" if flt(so.per_billed) >= 100 else ("Partially Billed" if flt(so.per_billed) > 0 else "Not Billed")
        } for so in sales_orders],
        "count": len(sales_orders),
        "total_value": so_total,
        "total_billed": so_billed,
        "total_pending": so_total - so_billed
    }
    
    # Sales Invoices (from parent only - use base amounts)
    sales_invoices = frappe.db.sql("""
        SELECT
            si.name,
            si.posting_date,
            si.base_grand_total,
            si.outstanding_amount,
            si.status
        FROM `tabSales Invoice` si
        WHERE si.project = %s
        AND si.docstatus = 1
        ORDER BY si.posting_date
    """, project, as_dict=1)
    
    si_total = sum(flt(si.base_grand_total) for si in sales_invoices)
    si_outstanding = sum(flt(si.outstanding_amount) for si in sales_invoices)
    si_paid = si_total - si_outstanding
    
    data["sales_invoices"] = {
        "list": [{
            "name": si.name,
            "date": str(si.posting_date) if si.posting_date else "",
            "value": flt(si.base_grand_total),
            "paid": flt(si.base_grand_total) - flt(si.outstanding_amount),
            "outstanding": flt(si.outstanding_amount),
            "status": "Paid" if flt(si.outstanding_amount) == 0 else ("Overdue" if si.status == "Overdue" else "Partial")
        } for si in sales_invoices],
        "count": len(sales_invoices),
        "total_value": si_total,
        "total_paid": si_paid,
        "total_outstanding": si_outstanding
    }
    
    data["total_outstanding"] = si_outstanding
    
    # Costs - Combined from parent + all children (converted to parent currency)
    all_projects = [project] + [c.name for c in children]
    
    combined_costs = {
        "po_cost": 0,
        "expense_cost": 0,
        "labour_cost": 0,
        "total_cost": 0
    }
    combined_manhours = {
        "working_hours": 0,
        "ot_hours": 0,
        "total_hours": 0
    }
    
    # Cost breakdown per project
    data["cost_breakdown"] = []
    
    for proj_name in all_projects:
        costs = get_project_costs_converted(proj_name, parent_currency)
        proj_company, proj_currency = get_project_company_currency(proj_name)
        
        combined_costs["po_cost"] += costs["po_cost"]
        combined_costs["expense_cost"] += costs["expense_cost"]
        combined_costs["labour_cost"] += costs["labour_cost"]
        combined_costs["total_cost"] += costs["total_cost"]
        
        combined_manhours["working_hours"] += costs["manhours"]["working_hours"]
        combined_manhours["ot_hours"] += costs["manhours"]["ot_hours"]
        combined_manhours["total_hours"] += costs["manhours"]["total_hours"]
        
        data["cost_breakdown"].append({
            "project": proj_name,
            "company": proj_company,
            "currency": proj_currency,
            "exchange_rate": costs["exchange_rate"],
            "po_cost": costs["po_cost"],
            "expense_cost": costs["expense_cost"],
            "labour_cost": costs["labour_cost"],
            "total_cost": costs["total_cost"]
        })
    
    data["costs"] = combined_costs
    data["manhours"] = combined_manhours
    
    # Profitability (combined)
    project_value = so_total
    total_cost = combined_costs["total_cost"]
    profit = project_value - total_cost
    margin = (profit / project_value * 100) if project_value > 0 else 0
    
    data["profitability"] = {
        "project_value": project_value,
        "total_cost": total_cost,
        "profit": profit,
        "margin": round(margin, 1),
        "is_profit": profit >= 0
    }
    
    # Budget (from parent project only)
    budget_total = get_project_budget(project)
    variance = budget_total - total_cost
    
    data["budget_summary"] = {
        "total_budget": budget_total,
        "total_spent": total_cost,
        "variance": variance,
        "variance_percent": round((variance / budget_total * 100) if budget_total > 0 else 0, 1),
        "is_under_budget": variance >= 0,
        "has_budget": budget_total > 0
    }
    
    return data


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
    
    # Manhours breakdown
    manhours = get_manhours(project)
    
    po_total = flt(po_cost[0].total) if po_cost else 0
    expense_total = flt(expense_cost[0].total) if expense_cost else 0
    
    total_cost = po_total + expense_total + labour_cost
    
    data["costs"] = {
        "po_cost": po_total,
        "expense_cost": expense_total,
        "labour_cost": labour_cost,
        "total_cost": total_cost
    }
    
    data["manhours"] = manhours
    
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
    
    # Budget vs Actual (from Budget DocType)
    budget_total = get_project_budget(project)
    spent_total = total_cost  # PO + Expenses + Labour
    variance = budget_total - spent_total
    
    data["budget_summary"] = {
        "total_budget": budget_total,
        "total_spent": spent_total,
        "variance": variance,
        "variance_percent": round((variance / budget_total * 100) if budget_total > 0 else 0, 1),
        "is_under_budget": variance >= 0,
        "has_budget": budget_total > 0
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


def get_manhours(project):
    """Get manhours breakdown from Project Timesheet"""
    result = frappe.db.sql("""
        SELECT
            COALESCE(SUM(pte.working_hours), 0) as working_hours,
            COALESCE(SUM(pte.overtime_hours), 0) as overtime_hours
        FROM `tabProject Timesheet Employee` pte
        INNER JOIN `tabProject Timesheet` pt ON pt.name = pte.parent
        WHERE pte.project = %s AND pt.docstatus = 1
    """, project, as_dict=1)
    
    working_hours = flt(result[0].working_hours) if result else 0
    ot_hours = flt(result[0].overtime_hours) if result else 0
    
    return {
        "working_hours": working_hours,
        "ot_hours": ot_hours,
        "total_hours": working_hours + ot_hours
    }


def get_project_budget(project):
    """Get budget from Budget DocType"""
    # Find submitted Budget linked to this project
    budget_name = frappe.db.get_value("Budget", 
        {"project": project, "docstatus": 1}, 
        "name")
    
    if not budget_name:
        return 0
    
    # Sum all budget amounts from Budget Account child table
    total = frappe.db.sql("""
        SELECT COALESCE(SUM(budget_amount), 0) as total
        FROM `tabBudget Account`
        WHERE parent = %s
    """, budget_name)
    
    return flt(total[0][0]) if total else 0


@frappe.whitelist()
def check_linked_projects(project):
    """Check if project has linked child projects"""
    parent_company, parent_currency = get_project_company_currency(project)
    
    children = frappe.db.sql("""
        SELECT 
            p.name,
            p.project_name,
            p.company
        FROM `tabProject` p
        WHERE p.parent_project = %s
        AND p.status NOT IN ('Cancelled', 'Completed')
    """, project, as_dict=1)
    
    result = {
        "has_linked": len(children) > 0,
        "parent": {
            "name": project,
            "company": parent_company,
            "currency": parent_currency
        },
        "children": []
    }
    
    for child in children:
        child_company, child_currency = get_project_company_currency(child.name)
        result["children"].append({
            "name": child.name,
            "project_name": child.project_name or "",
            "company": child_company,
            "currency": child_currency
        })
    
    return result


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
        AND (p.project_type IS NULL OR p.project_type NOT IN ('Operational', 'Stock'))
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
