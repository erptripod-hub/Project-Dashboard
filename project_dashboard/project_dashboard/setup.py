import frappe


def remove_stale_project_links():
	"""Remove invalid DocType links from Project doctype"""
	try:
		stale = ["Drawing Request Form"]
		for dt in stale:
			frappe.db.sql("""
				DELETE FROM `tabDocType Link`
				WHERE parent = 'Project'
				AND link_doctype = %s
			""", dt)
		frappe.db.commit()
	except Exception as e:
		frappe.log_error(str(e), "Remove Stale Project Links")


def after_install():
	remove_stale_project_links()
	create_custom_fields()
	create_project_custom_fields()
	unhide_project_fields()


def after_migrate():
	remove_stale_project_links()
	create_custom_fields()
	create_project_custom_fields()
	unhide_project_fields()


def create_custom_fields():
	fields = [
		{
			"dt": "Attendance",
			"fieldname": "overtime_hours",
			"label": "Overtime Hours",
			"fieldtype": "Float",
			"insert_after": "working_hours",
			"default": "0",
			"read_only": 0,
		},
		{
			"dt": "Attendance",
			"fieldname": "project_timesheet_ref",
			"label": "Project Timesheet Reference",
			"fieldtype": "Link",
			"options": "Project Timesheet",
			"insert_after": "overtime_hours",
			"read_only": 1,
		},
		{
			"dt": "Attendance",
			"fieldname": "project_ref",
			"label": "Project",
			"fieldtype": "Link",
			"options": "Project",
			"insert_after": "project_timesheet_ref",
			"read_only": 1,
		},
		{
			"dt": "Salary Slip",
			"fieldname": "custom_section_project_timesheet_ot",
			"label": "From Project Timesheet",
			"fieldtype": "Section Break",
			"insert_after": "manual_hot",
		},
		{
			"dt": "Salary Slip",
			"fieldname": "custom_project_timesheet_ot_hours",
			"label": "Overtime Hours",
			"fieldtype": "Float",
			"insert_after": "custom_section_project_timesheet_ot",
			"default": "0",
			"read_only": 1,
			"description": "Total overtime hours from Project Timesheet for this payroll period",
		},
	]

	for field in fields:
		dt = field.get("dt")
		fieldname = field.get("fieldname")
		existing = frappe.db.exists("Custom Field", {"dt": dt, "fieldname": fieldname})
		if existing:
			doc = frappe.get_doc("Custom Field", existing)
			for key, val in field.items():
				if key not in ("doctype", "name", "dt"):
					setattr(doc, key, val)
			doc.flags.ignore_permissions = True
			doc.save()
		else:
			doc = frappe.new_doc("Custom Field")
			doc.update(field)
			doc.flags.ignore_permissions = True
			doc.insert()

	frappe.db.commit()


def create_project_custom_fields():
	project_fields = [
		{
			"dt": "Project",
			"fieldname": "project_plan_tab",
			"label": "Project Plan",
			"fieldtype": "Tab Break",
			"insert_after": "expected_end_date",
		},
		{
			"dt": "Project",
			"fieldname": "project_plan",
			"label": "Project Plan",
			"fieldtype": "Table",
			"options": "Project Plan",
			"insert_after": "project_plan_tab",
		},
		{
			"dt": "Project",
			"fieldname": "project_subcontractors_tab",
			"label": "Subcontractors",
			"fieldtype": "Tab Break",
			"insert_after": "project_plan",
		},
		{
			"dt": "Project",
			"fieldname": "project_subcontractors",
			"label": "Subcontractors",
			"fieldtype": "Table",
			"options": "Project Subcontractor",
			"insert_after": "project_subcontractors_tab",
		},
		{
			"dt": "Project",
			"fieldname": "project_weekly_reports_tab",
			"label": "Weekly Reports",
			"fieldtype": "Tab Break",
			"insert_after": "project_subcontractors",
		},
		{
			"dt": "Project",
			"fieldname": "project_weekly_reports",
			"label": "Weekly Reports",
			"fieldtype": "Table",
			"options": "Project Weekly Report",
			"insert_after": "project_weekly_reports_tab",
		},
	]

	for field in project_fields:
		dt = field.get("dt")
		fieldname = field.get("fieldname")
		existing = frappe.db.exists("Custom Field", {"dt": dt, "fieldname": fieldname})
		if existing:
			doc = frappe.get_doc("Custom Field", existing)
			for key, val in field.items():
				if key not in ("doctype", "name", "dt"):
					setattr(doc, key, val)
			doc.flags.ignore_permissions = True
			doc.save()
		else:
			doc = frappe.new_doc("Custom Field")
			doc.update(field)
			doc.flags.ignore_permissions = True
			doc.insert()

	frappe.db.commit()


def unhide_project_fields():
	"""Make all hidden Project fields visible and set perm level to 0"""

	# Fields to unhide
	hidden_fields = [
		"percent_complete_method", "priority", "department",
		"actual_start_date", "actual_end_date", "actual_time",
		"estimated_cost", "total_costing_amount", "total_expense_claim",
		"total_purchase_cost", "total_sales_amount", "total_billable_amount",
		"total_billed_amount", "total_consumed_material_cost", "cost_center",
		"gross_margin", "per_gross_margin", "collect_progress", "holiday_list",
		"frequency", "from_time", "to_time", "first_email", "second_email",
		"daily_time_to_send", "day_to_send", "is_active", "copied_from", "from_template", "percent_complete",
	]

	# Sections to unhide
	hidden_sections = [
		"project_details", "margin", "monitor_progress",
	]

	for fieldname in hidden_fields + hidden_sections:
		existing = frappe.db.exists("Property Setter", {
			"doc_type": "Project",
			"field_name": fieldname,
			"property": "hidden"
		})
		if existing:
			frappe.db.set_value("Property Setter", existing, "value", "0")
		else:
			try:
				ps = frappe.new_doc("Property Setter")
				ps.doctype_or_field = "DocField"
				ps.doc_type = "Project"
				ps.field_name = fieldname
				ps.property = "hidden"
				ps.property_type = "Check"
				ps.value = "0"
				ps.flags.ignore_permissions = True
				ps.insert()
			except Exception:
				pass

	# Set perm level 0 for costing fields
	costing_fields = [
		"project_details", "estimated_cost", "total_costing_amount",
		"total_expense_claim", "total_purchase_cost", "total_sales_amount",
		"total_billable_amount", "total_billed_amount",
		"total_consumed_material_cost", "gross_margin", "per_gross_margin",
	]

	for fieldname in costing_fields:
		existing = frappe.db.exists("Property Setter", {
			"doc_type": "Project",
			"field_name": fieldname,
			"property": "permlevel"
		})
		if existing:
			frappe.db.set_value("Property Setter", existing, "value", "0")
		else:
			try:
				ps = frappe.new_doc("Property Setter")
				ps.doctype_or_field = "DocField"
				ps.doc_type = "Project"
				ps.field_name = fieldname
				ps.property = "permlevel"
				ps.property_type = "Int"
				ps.value = "0"
				ps.flags.ignore_permissions = True
				ps.insert()
			except Exception:
				pass

	frappe.db.commit()
