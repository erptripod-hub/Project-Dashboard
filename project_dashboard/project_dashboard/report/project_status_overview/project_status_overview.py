import frappe
from frappe import _


def execute(filters=None):
	if not filters:
		filters = {}

	columns = get_columns()
	data = get_data(filters)
	report_summary = get_report_summary(data)
	chart = get_chart(data)

	return columns, data, None, chart, report_summary


def get_columns():
	return [
		{"label": _("Project"), "fieldname": "project", "fieldtype": "Link", "options": "Project", "width": 140},
		{"label": _("Project Name"), "fieldname": "project_name", "fieldtype": "Data", "width": 200},
		{"label": _("Customer"), "fieldname": "customer", "fieldtype": "Data", "width": 160},
		{"label": _("Type"), "fieldname": "project_type", "fieldtype": "Data", "width": 80},
		{"label": _("Status"), "fieldname": "status", "fieldtype": "Data", "width": 90},
		{"label": _("Start Date"), "fieldname": "start_date", "fieldtype": "Date", "width": 100},
		{"label": _("End Date"), "fieldname": "end_date", "fieldtype": "Date", "width": 100},
		{"label": _("Total Value"), "fieldname": "total_value", "fieldtype": "Currency", "width": 130},
		{"label": _("Fitout Value"), "fieldname": "fitout_value", "fieldtype": "Currency", "width": 120},
		{"label": _("Joinery Value"), "fieldname": "joinery_value", "fieldtype": "Currency", "width": 120},
		{"label": _("Dispatch Date"), "fieldname": "dispatch_date", "fieldtype": "Date", "width": 110},
		{"label": _("Dispatch Status"), "fieldname": "dispatch_status", "fieldtype": "Data", "width": 120},
		{"label": _("Hold Reason"), "fieldname": "hold_reason", "fieldtype": "Data", "width": 180},
	]


def get_data(filters):
	conditions = "WHERE 1=1"
	values = {}

	status = filters.get("status", "Open")
	if status and status != "All":
		conditions += " AND p.status = %(status)s"
		values["status"] = status

	if filters.get("company"):
		conditions += " AND p.company = %(company)s"
		values["company"] = filters["company"]

	# project_type is a custom field - filtered in Python after fetching

	if filters.get("from_date"):
		conditions += " AND p.expected_start_date >= %(from_date)s"
		values["from_date"] = filters["from_date"]

	if filters.get("to_date"):
		conditions += " AND p.expected_start_date <= %(to_date)s"
		values["to_date"] = filters["to_date"]

	projects = frappe.db.sql(f"""
		SELECT
			p.name as project,
			p.project_name,
			p.customer,
			p.status,
			p.expected_start_date as start_date,
			p.expected_end_date as end_date
		FROM `tabProject` p
		{conditions}
		ORDER BY
			CASE p.status WHEN 'On Hold' THEN 0 ELSE 1 END,
			p.expected_end_date ASC
	""", values, as_dict=1)

	# Fetch custom fields separately - safe even if fields don't exist yet
	custom_fields = ["project_type", "dispatch_date", "dispatch_status", "hold_reason"]
	custom_data = {}
	for proj in projects:
		row = {}
		for field in custom_fields:
			try:
				val = frappe.db.get_value("Project", proj.project, field)
				row[field] = val or ""
			except Exception:
				row[field] = ""
		custom_data[proj.project] = row

	# Apply project_type filter in Python (custom field - safe)
	project_type_filter = filters.get("project_type")

	data = []
	for proj in projects:
		cf = custom_data.get(proj.project, {})

		# Filter by project type if set
		if project_type_filter and cf.get("project_type") != project_type_filter:
			continue

		# Get Project Plan data
		pp = frappe.db.get_value("Project Plan", {"project": proj.project},
			["boq_grand_total", "boq", "total_subcontractor_cost"], as_dict=1)

		total_value = 0
		fitout_value = 0
		joinery_value = 0

		if pp:
			total_value = pp.boq_grand_total or 0

			# Fitout value = total of ALL subcontractor allocations in Project Plan
			fitout_value = frappe.db.sql("""
				SELECT COALESCE(SUM(psa.contract_value), 0)
				FROM `tabProject Subcontractor Allocation` psa
				INNER JOIN `tabProject Plan` pp ON pp.name = psa.parent
				WHERE pp.project = %s
			""", proj.project)[0][0] or 0

			# Joinery value from BOQ
			if pp.boq:
				joinery_value = frappe.db.get_value("BOQ", pp.boq, "base_total_joinery_works") or 0

		row = {
			"project": proj.project,
			"project_name": proj.project_name,
			"customer": proj.customer or "",
			"project_type": cf.get("project_type") or "",
			"status": proj.status,
			"start_date": proj.start_date,
			"end_date": proj.end_date,
			"total_value": float(total_value),
			"fitout_value": float(fitout_value),
			"joinery_value": float(joinery_value),
			"dispatch_date": cf.get("dispatch_date") or "",
			"dispatch_status": cf.get("dispatch_status") or "",
			"hold_reason": cf.get("hold_reason") or "",
		}
		data.append(row)

	return data


def get_report_summary(data):
	total_projects = len(data)
	on_hold = sum(1 for r in data if r["status"] == "On Hold")
	total_fitout = sum(r["fitout_value"] for r in data)
	total_joinery = sum(r["joinery_value"] for r in data)

	return [
		{
			"value": total_projects,
			"label": "Total Projects",
			"datatype": "Int",
			"indicator": "blue",
		},
		{
			"value": total_fitout,
			"label": "Fitout Value",
			"datatype": "Currency",
			"indicator": "green",
		},
		{
			"value": total_joinery,
			"label": "Joinery Value",
			"datatype": "Currency",
			"indicator": "blue",
		},
		{
			"value": on_hold,
			"label": "On Hold",
			"datatype": "Int",
			"indicator": "red" if on_hold > 0 else "green",
		},
	]


def get_chart(data):
	total_fitout = sum(r["fitout_value"] for r in data)
	total_joinery = sum(r["joinery_value"] for r in data)

	return {
		"data": {
			"labels": ["Fitout", "Joinery"],
			"datasets": [
				{
					"name": "Project Value (AED)",
					"values": [total_fitout, total_joinery]
				}
			]
		},
		"type": "bar",
		"colors": ["#2563eb", "#0d9488"],
		"height": 200,
		"barOptions": {"stacked": False},
	}
