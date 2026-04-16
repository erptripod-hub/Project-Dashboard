import frappe
from frappe.utils import date_diff, today

@frappe.whitelist()
def get_dashboard_data(project):
	data = {}

	# --- Project basic info ---
	proj = frappe.get_doc("Project", project)
	data["project_info"] = {
		"project_name": proj.project_name,
		"status": proj.status,
		"customer": proj.customer or "",
		"percent_complete": proj.percent_complete or 0
	}

	# --- Project Plan ---
	pp = frappe.db.get_value("Project Plan", {"project": project}, "name")
	data["has_plan"] = bool(pp)
	data["plan"] = {}

	if pp:
		plan = frappe.get_doc("Project Plan", pp)
		data["plan"] = {
			"start_date": str(plan.start_date) if plan.start_date else "",
			"end_date": str(plan.end_date) if plan.end_date else "",
			"project_duration": plan.project_duration or 0,
			"days_passed": plan.days_passed or 0,
			"days_remaining": plan.days_remaining or 0,
			"timeline_status": plan.timeline_status or "On Track",
			"boq_grand_total": plan.boq_grand_total or 0,
			"boq_base_total": plan.boq_base_total or 0,
			"total_adjusted_cost": plan.total_adjusted_cost or 0,
			"total_subcontractor_cost": plan.total_subcontractor_cost or 0,
			"total_overhead": plan.total_overhead or 0,
			"total_project_cost": plan.total_project_cost or 0,
			"total_variance": plan.total_variance or 0,
			"phases": [{"phase_name": r.phase_name, "start_date": str(r.start_date) if r.start_date else "", "end_date": str(r.end_date) if r.end_date else "", "progress": r.progress or 0, "status": r.status} for r in plan.phase_plan],
			"department_budgets": [{"department_name": r.department_name, "allocation_percent": r.allocation_percent or 0, "budget_amount": r.budget_amount or 0, "spent_amount": r.spent_amount or 0, "remaining": r.remaining or 0, "status": r.status} for r in plan.department_budgets],
			"subcontractors": [{"supplier_name": r.supplier_name or r.supplier, "scope_of_work": r.scope_of_work or "", "contract_value": r.contract_value or 0, "status": r.status} for r in plan.subcontractor_allocations],
			"labour_plan": [{"trade_role": r.trade_role, "headcount": r.headcount or 0, "estimated_days": r.estimated_days or 0, "estimated_working_hours": r.estimated_working_hours or 0, "estimated_ot_hours": r.estimated_ot_hours or 0, "estimated_total_hours": r.estimated_total_hours or 0} for r in plan.labour_plan],
		}

	# --- Manpower from Project Timesheet ---
	manpower = frappe.db.sql("""
		SELECT
			COUNT(DISTINCT pte.employee) as total_employees,
			SUM(pte.working_hours) as total_working_hours,
			SUM(pte.overtime_hours) as total_overtime_hours,
			SUM(pte.total_hours) as total_manhours
		FROM `tabProject Timesheet Employee` pte
		INNER JOIN `tabProject Timesheet` pt ON pt.name = pte.parent
		WHERE pte.project = %s AND pt.docstatus = 1
	""", project, as_dict=1)
	data["manpower"] = manpower[0] if manpower else {"total_employees": 0, "total_working_hours": 0, "total_overtime_hours": 0, "total_manhours": 0}

	# --- Purchase Orders (submitted only, not cancelled) ---
	po = frappe.db.sql("""
		SELECT
			COUNT(DISTINCT name) as total_pos,
			COUNT(DISTINCT supplier) as total_suppliers,
			SUM(grand_total) as total_value,
			SUM(grand_total * per_billed / 100) as total_received,
			SUM(grand_total * (1 - per_billed / 100)) as total_pending
		FROM `tabPurchase Order`
		WHERE project = %s AND docstatus = 1
	""", project, as_dict=1)
	data["purchase_orders"] = po[0] if po else {"total_pos": 0, "total_suppliers": 0, "total_value": 0, "total_received": 0, "total_pending": 0}

	# --- Expense Claims (submitted only) ---
	expenses = frappe.db.sql("""
		SELECT SUM(grand_total) as total_expenses
		FROM `tabExpense Claim`
		WHERE project = %s AND docstatus = 1
	""", project, as_dict=1)
	data["total_expenses"] = (expenses[0].total_expenses or 0) if expenses else 0

	# --- Total Spent = PO + Expenses ---
	data["total_spent"] = (data["purchase_orders"]["total_value"] or 0) + data["total_expenses"]

	# --- Sales Invoices ---
	sales = frappe.db.sql("""
		SELECT COUNT(name) as total, SUM(grand_total) as total_invoiced, SUM(outstanding_amount) as outstanding
		FROM `tabSales Invoice`
		WHERE project = %s AND docstatus = 1
	""", project, as_dict=1)
	data["sales"] = sales[0] if sales else {"total": 0, "total_invoiced": 0, "outstanding": 0}

	# --- Weekly Reports ---
	data["weekly_reports"] = []
	if hasattr(proj, "project_weekly_reports"):
		for r in sorted(proj.project_weekly_reports, key=lambda x: x.week_number, reverse=True):
			data["weekly_reports"].append({
				"week_number": r.week_number,
				"report_date": str(r.report_date) if r.report_date else "",
				"report_file": r.report_file or "",
				"sent_to_client": r.sent_to_client,
			})

	return data
