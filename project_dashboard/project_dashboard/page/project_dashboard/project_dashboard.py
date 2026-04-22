import frappe
from frappe.utils import date_diff, today


def get_employee_hourly_rate(employee):
	"""Fetch latest salary structure assignment and calculate hourly rate"""
	result = frappe.db.sql("""
		SELECT custom_total_salary
		FROM `tabSalary Structure Assignment`
		WHERE employee = %s
		AND docstatus = 1
		AND custom_total_salary > 0
		ORDER BY from_date DESC
		LIMIT 1
	""", employee)
	if result and result[0][0]:
		monthly_salary = float(result[0][0])
		return round(monthly_salary / 30 / 8, 4)
	return 0


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

		# Estimated totals from labour plan
		est_workers = sum(r.headcount or 0 for r in (plan.labour_plan or []))
		est_working_hrs = sum((r.headcount or 0) * (r.estimated_days or 0) * 8 for r in (plan.labour_plan or []))
		est_ot_hrs = sum(r.estimated_ot_hours or 0 for r in (plan.labour_plan or []))
		est_total_hrs = est_working_hrs + est_ot_hrs

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
			"est_workers": est_workers,
			"est_working_hrs": est_working_hrs,
			"est_ot_hrs": est_ot_hrs,
			"est_total_hrs": est_total_hrs,
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

	# Manpower from Project Timesheet - get per employee
	timesheet_employees = frappe.db.sql("""
		SELECT
			pte.employee,
			COALESCE(SUM(pte.working_hours), 0) as working_hours,
			COALESCE(SUM(pte.overtime_hours), 0) as overtime_hours,
			COALESCE(SUM(pte.total_hours), 0) as total_hours
		FROM `tabProject Timesheet Employee` pte
		INNER JOIN `tabProject Timesheet` pt ON pt.name = pte.parent
		WHERE pte.project = %s AND pt.docstatus = 1
		GROUP BY pte.employee
	""", project, as_dict=1)

	# Calculate manhour cost per employee
	total_working_cost = 0
	total_ot_cost = 0
	total_working_hrs = 0
	total_ot_hrs = 0
	total_manhours = 0
	actual_workers = len(timesheet_employees)

	for emp in timesheet_employees:
		hourly_rate = get_employee_hourly_rate(emp.employee)
		working_hrs = float(emp.working_hours or 0)
		ot_hrs = float(emp.overtime_hours or 0)

		working_cost = working_hrs * hourly_rate
		ot_cost = ot_hrs * 5  # Fixed AED 5 per OT hour

		total_working_cost += working_cost
		total_ot_cost += ot_cost
		total_working_hrs += working_hrs
		total_ot_hrs += ot_hrs
		total_manhours += float(emp.total_hours or 0)

	total_labour_cost = total_working_cost + total_ot_cost

	data["manpower"] = {
		"actual_workers": actual_workers,
		"actual_working_hours": round(total_working_hrs, 2),
		"actual_ot_hours": round(total_ot_hrs, 2),
		"actual_manhours": round(total_manhours, 2),
		"total_working_cost": round(total_working_cost, 2),
		"total_ot_cost": round(total_ot_cost, 2),
		"total_labour_cost": round(total_labour_cost, 2)
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
	data["po_by_type"] = {
		row.order_type: {"count": row.count, "total_value": float(row.total_value or 0)}
		for row in po_by_type
	}

	# Expense Claims
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

	# Joinery PO items vs Stock Entry (material comparison)
	joinery_po_items = frappe.db.sql("""
		SELECT
			poi.item_code,
			poi.item_name,
			poi.uom,
			COALESCE(SUM(poi.qty), 0) as ordered_qty,
			COALESCE(SUM(poi.amount), 0) as ordered_value
		FROM `tabPurchase Order Item` poi
		INNER JOIN `tabPurchase Order` po ON po.name = poi.parent
		WHERE poi.project = %s
		AND po.docstatus = 1
		AND po.custom_order_type = 'Joinery'
		GROUP BY poi.item_code, poi.item_name, poi.uom
		ORDER BY ordered_value DESC
	""", project, as_dict=1)

	stock_items = frappe.db.sql("""
		SELECT
			sed.item_code,
			COALESCE(SUM(sed.qty), 0) as issued_qty,
			COALESCE(SUM(sed.amount), 0) as issued_value
		FROM `tabStock Entry Detail` sed
		INNER JOIN `tabStock Entry` se ON se.name = sed.parent
		WHERE se.project = %s
		AND se.stock_entry_type = 'Material Issue'
		AND se.docstatus = 1
		GROUP BY sed.item_code
	""", project, as_dict=1)

	stock_map = {r.item_code: {"issued_qty": float(r.issued_qty or 0), "issued_value": float(r.issued_value or 0)} for r in stock_items}

	joinery_tracking = []
	for item in joinery_po_items:
		stock = stock_map.get(item.item_code, {"issued_qty": 0, "issued_value": 0})
		joinery_tracking.append({
			"item_code": item.item_code,
			"item_name": item.item_name or item.item_code,
			"uom": item.uom or "",
			"ordered_qty": float(item.ordered_qty or 0),
			"ordered_value": float(item.ordered_value or 0),
			"issued_qty": stock["issued_qty"],
			"issued_value": stock["issued_value"],
			"variance_qty": float(item.ordered_qty or 0) - stock["issued_qty"],
			"variance_value": float(item.ordered_value or 0) - stock["issued_value"],
		})

	data["joinery_tracking"] = joinery_tracking
	data["joinery_totals"] = {
		"total_ordered_value": sum(r["ordered_value"] for r in joinery_tracking),
		"total_issued_value": sum(r["issued_value"] for r in joinery_tracking),
		"total_variance_value": sum(r["variance_value"] for r in joinery_tracking),
	}

	# Fitout POs - reference only (supplier level)
	fitout_pos = frappe.db.sql("""
		SELECT
			po.supplier,
			po.supplier_name,
			po.name as po_name,
			po.transaction_date,
			COALESCE(po.grand_total, 0) as po_value,
			COALESCE(po.grand_total * po.per_billed / 100, 0) as received,
			COALESCE(po.grand_total * (1 - po.per_billed / 100), 0) as pending
		FROM `tabPurchase Order` po
		WHERE po.project = %s
		AND po.docstatus = 1
		AND po.custom_order_type = 'Fitout'
		ORDER BY po.grand_total DESC
	""", project, as_dict=1)

	data["fitout_pos"] = [{
		"supplier": r.supplier_name or r.supplier,
		"po_name": r.po_name,
		"transaction_date": str(r.transaction_date) if r.transaction_date else "",
		"po_value": float(r.po_value or 0),
		"received": float(r.received or 0),
		"pending": float(r.pending or 0),
	} for r in fitout_pos]
	data["fitout_totals"] = {
		"total_value": sum(float(r.po_value or 0) for r in fitout_pos),
		"total_received": sum(float(r.received or 0) for r in fitout_pos),
		"total_pending": sum(float(r.pending or 0) for r in fitout_pos),
	}

	return data
