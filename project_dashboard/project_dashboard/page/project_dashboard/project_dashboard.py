import frappe
from frappe.utils import date_diff, today


@frappe.whitelist()
def get_dashboard_data(project):
	data = {}

	# Project info
	proj = frappe.get_doc("Project", project)
	data["project_info"] = {
		"project_name": proj.project_name or "",
		"status": proj.status or "",
		"customer": proj.customer or "",
		"percent_complete": proj.percent_complete or 0
	}

	# Project Plan
	pp_name = frappe.db.get_value("Project Plan", {"project": project}, "name")
	data["has_plan"] = bool(pp_name)
	data["plan"] = {}

	if pp_name:
		plan = frappe.get_doc("Project Plan", pp_name)
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
			"phases": [
				{
					"phase_name": r.phase_name,
					"start_date": str(r.start_date) if r.start_date else "",
					"end_date": str(r.end_date) if r.end_date else "",
					"progress": r.progress or 0,
					"status": r.status or "Not Started"
				} for r in (plan.phase_plan or [])
			],
			"department_budgets": [
				{
					"department_name": r.department_name,
					"allocation_percent": r.allocation_percent or 0,
					"po_order_type": r.po_order_type or "",
					"budget_amount": r.budget_amount or 0,
					"spent_amount": r.spent_amount or 0,
					"remaining": r.remaining or 0,
					"status": r.status or "On Track"
				} for r in (plan.department_budgets or [])
			],
			"subcontractors": [
				{
					"supplier_name": r.supplier_name or r.supplier or "",
					"scope_of_work": r.scope_of_work or "",
					"contract_value": r.contract_value or 0,
					"status": r.status or "Active"
				} for r in (plan.subcontractor_allocations or [])
			],
			"labour_plan": [
				{
					"trade_role": r.trade_role or "",
					"headcount": r.headcount or 0,
					"estimated_days": r.estimated_days or 0,
					"estimated_working_hours": r.estimated_working_hours or 0,
					"estimated_ot_hours": r.estimated_ot_hours or 0,
					"estimated_total_hours": r.estimated_total_hours or 0
				} for r in (plan.labour_plan or [])
			],
		}

	# Manpower from Project Timesheet
	manpower = frappe.db.sql("""
		SELECT
			COUNT(DISTINCT pte.employee) as total_employees,
			COALESCE(SUM(pte.working_hours), 0) as total_working_hours,
			COALESCE(SUM(pte.overtime_hours), 0) as total_overtime_hours,
			COALESCE(SUM(pte.total_hours), 0) as total_manhours
		FROM `tabProject Timesheet Employee` pte
		INNER JOIN `tabProject Timesheet` pt ON pt.name = pte.parent
		WHERE pte.project = %s AND pt.docstatus = 1
	""", project, as_dict=1)
	data["manpower"] = manpower[0] if manpower else {
		"total_employees": 0, "total_working_hours": 0,
		"total_overtime_hours": 0, "total_manhours": 0
	}

	# POs by order type (submitted only)
	po_by_type = frappe.db.sql("""
		SELECT
			COALESCE(custom_order_type, 'Other') as order_type,
			COUNT(name) as count,
			COALESCE(SUM(grand_total), 0) as total_value
		FROM `tabPurchase Order`
		WHERE project = %s AND docstatus = 1
		GROUP BY custom_order_type
	""", project, as_dict=1)

	po_totals = frappe.db.sql("""
		SELECT
			COUNT(DISTINCT name) as total_pos,
			COUNT(DISTINCT supplier) as total_suppliers,
			COALESCE(SUM(grand_total), 0) as total_value,
			COALESCE(SUM(grand_total * per_billed / 100), 0) as total_received,
			COALESCE(SUM(grand_total * (1 - per_billed / 100)), 0) as total_pending
		FROM `tabPurchase Order`
		WHERE project = %s AND docstatus = 1
	""", project, as_dict=1)

	data["purchase_orders"] = po_totals[0] if po_totals else {
		"total_pos": 0, "total_suppliers": 0,
		"total_value": 0, "total_received": 0, "total_pending": 0
	}
	data["po_by_type"] = {row.order_type: {"count": row.count, "total_value": row.total_value} for row in po_by_type}

	# Expense Claims (submitted only)
	expenses = frappe.db.sql("""
		SELECT COALESCE(SUM(grand_total), 0) as total_expenses
		FROM `tabExpense Claim`
		WHERE project = %s AND docstatus = 1
	""", project, as_dict=1)
	data["total_expenses"] = float(expenses[0].total_expenses or 0) if expenses else 0

	# Total Spent = PO + Expenses
	data["total_spent"] = float(data["purchase_orders"]["total_value"] or 0) + data["total_expenses"]

	# Weekly Reports
	data["weekly_reports"] = []
	try:
		if hasattr(proj, "project_weekly_reports") and proj.project_weekly_reports:
			for r in sorted(proj.project_weekly_reports, key=lambda x: x.week_number or 0, reverse=True):
				data["weekly_reports"].append({
					"week_number": r.week_number or 0,
					"report_date": str(r.report_date) if r.report_date else "",
					"report_file": r.report_file or "",
					"sent_to_client": r.sent_to_client or 0,
				})
	except Exception:
		pass

	return data
