import frappe


@frappe.whitelist()
def get_status_data(filters=None):
	if not filters:
		filters = {}

	status_filter = filters.get("status", "Open")
	company_filter = filters.get("company")
	type_filter = filters.get("project_type")

	conditions = "WHERE 1=1"
	values = {}

	if status_filter and status_filter != "All":
		conditions += " AND p.status = %(status)s"
		values["status"] = status_filter

	if company_filter:
		conditions += " AND p.company = %(company)s"
		values["company"] = company_filter

	projects = frappe.db.sql(f"""
		SELECT
			p.name as project,
			p.project_name,
			p.customer,
			p.status,
			p.expected_start_date as start_date,
			p.expected_end_date as end_date,
			p.company
		FROM `tabProject` p
		{conditions}
		ORDER BY
			CASE p.status WHEN 'On Hold' THEN 0 ELSE 1 END,
			p.expected_end_date ASC
	""", values, as_dict=1)

	data = []
	for proj in projects:
		custom = {}
		for field in ["project_type", "dispatch_date", "dispatch_status", "hold_reason"]:
			try:
				custom[field] = frappe.db.get_value("Project", proj.project, field) or ""
			except Exception:
				custom[field] = ""

		if type_filter and custom.get("project_type") != type_filter:
			continue

		pp = frappe.db.get_value("Project Plan", {"project": proj.project},
			["name", "boq_grand_total", "boq"], as_dict=1)

		total_value = 0
		fitout_value = 0
		joinery_value = 0

		if pp:
			total_value = float(pp.boq_grand_total or 0)
			fitout_value = frappe.db.sql("""
				SELECT COALESCE(SUM(psa.contract_value), 0)
				FROM `tabProject Subcontractor Allocation` psa
				INNER JOIN `tabProject Plan` pp ON pp.name = psa.parent
				WHERE pp.project = %s
			""", proj.project)[0][0] or 0
			if pp.boq:
				joinery_value = frappe.db.get_value("BOQ", pp.boq, "base_total_joinery_works") or 0

		data.append({
			"project": proj.project,
			"project_name": proj.project_name or "",
			"customer": proj.customer or "",
			"project_type": custom.get("project_type") or "",
			"status": proj.status or "",
			"start_date": str(proj.start_date) if proj.start_date else "",
			"end_date": str(proj.end_date) if proj.end_date else "",
			"total_value": float(total_value),
			"fitout_value": float(fitout_value),
			"joinery_value": float(joinery_value),
			"dispatch_date": str(custom.get("dispatch_date")) if custom.get("dispatch_date") else "",
			"dispatch_status": custom.get("dispatch_status") or "",
			"hold_reason": custom.get("hold_reason") or "",
		})

	total_fitout = sum(r["fitout_value"] for r in data)
	total_joinery = sum(r["joinery_value"] for r in data)
	on_hold = sum(1 for r in data if r["status"] == "On Hold")

	return {
		"projects": data,
		"summary": {
			"total": len(data),
			"fitout_value": round(total_fitout, 2),
			"joinery_value": round(total_joinery, 2),
			"on_hold": on_hold,
		}
	}
