import frappe

@frappe.whitelist()
def get_dashboard_data(project):
	return {}
