import frappe


def execute():
	"""Remove the report's earlier name; it was renamed to
	'Accounts Payable Summary by Supplier Invoice Date'."""
	name = "Payables Aging by Bill Date"
	if frappe.db.exists("Report", name):
		frappe.delete_doc("Report", name, force=True, ignore_permissions=True)
