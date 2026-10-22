# Copyright (c) 2026, Tripod and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, nowdate


class ProformaInvoice(Document):
	def validate(self):
		self.set_title()
		self.calculate_totals()
		self.calculate_taxes()
		
	def set_title(self):
		self.title = f"{self.customer_name or self.customer} - {self.name or 'New'}"
	
	def calculate_totals(self):
		self.total_qty = 0
		self.total_amount = 0
		
		for item in self.items:
			item.amount = flt(item.qty) * flt(item.rate)
			self.total_qty += flt(item.qty)
			self.total_amount += flt(item.amount)
		
		self.net_total = self.total_amount
	
	def calculate_taxes(self):
		self.total_taxes = 0
		
		if self.taxes_and_charges and not self.taxes:
			# Fetch taxes from template
			tax_template = frappe.get_doc("Sales Taxes and Charges Template", self.taxes_and_charges)
			for tax in tax_template.taxes:
				self.append("taxes", {
					"charge_type": tax.charge_type,
					"account_head": tax.account_head,
					"description": tax.description,
					"rate": tax.rate
				})
		
		for tax in self.taxes:
			if tax.charge_type == "On Net Total":
				tax.tax_amount = flt(self.net_total) * flt(tax.rate) / 100
			self.total_taxes += flt(tax.tax_amount)
		
		self.grand_total = flt(self.net_total) + flt(self.total_taxes)
	
	def on_submit(self):
		self.billing_status = "Unpaid"
	
	def on_cancel(self):
		self.billing_status = "Cancelled"
	
	@frappe.whitelist()
	def create_sales_invoice(self):
		"""Create Sales Invoice from Proforma using standard SO mapper"""
		if self.billing_status == "Invoiced":
			frappe.throw(_("Sales Invoice already created: {0}").format(self.sales_invoice))

		if self.billing_status == "Cancelled":
			frappe.throw(_("Cannot create invoice from cancelled Proforma"))

		from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

		# Standard mapper copies all matching header fields from SO
		# (custom fields, address, payment terms, sales team, PO no, etc.)
		si = make_sales_invoice(self.sales_order, ignore_permissions=True)

		# Keep only SO rows that are on the Proforma, with Proforma qty/rate
		pf_rows = {d.so_detail: d for d in self.items if d.so_detail}
		new_items = []
		for row in si.items:
			pf = pf_rows.get(row.so_detail)
			if pf and flt(pf.qty):
				row.qty = flt(pf.qty)
				row.rate = flt(pf.rate)
				new_items.append(row)

		if not new_items:
			frappe.throw(_("No billable items found on Sales Order {0}").format(self.sales_order))

		si.set("items", new_items)
		si.custom_proforma_invoice = self.name

		# Accounts Manager (mandatory custom field on Sales Invoice)
		si_meta = frappe.get_meta("Sales Invoice")
		if si_meta.has_field("custom_accounts_manager") and not si.get("custom_accounts_manager"):
			if frappe.get_meta("Sales Order").has_field("custom_accounts_manager"):
				si.custom_accounts_manager = frappe.db.get_value(
					"Sales Order", self.sales_order, "custom_accounts_manager"
				)
			if not si.get("custom_accounts_manager") and si.get("sales_team"):
				si.custom_accounts_manager = si.sales_team[0].sales_person
			if not si.get("custom_accounts_manager"):
				frappe.throw(_("Accounts Manager is not set on Sales Order {0}. Set it and try again.").format(self.sales_order))

		si.run_method("set_missing_values")
		si.run_method("calculate_taxes_and_totals")

		si.flags.ignore_permissions = True
		si.insert()

		# Update proforma status
		self.db_set("sales_invoice", si.name)
		self.db_set("billing_status", "Invoiced")

		frappe.msgprint(_("Sales Invoice {0} created").format(
			frappe.utils.get_link_to_form("Sales Invoice", si.name)
		))

		return si.name

	@frappe.whitelist()
	def cancel_proforma(self):
		"""Cancel proforma without creating CN"""
		if self.billing_status == "Invoiced":
			frappe.throw(_("Cannot cancel - Sales Invoice already created. Create Credit Note against the invoice instead."))
		
		if self.docstatus == 1:
			self.db_set("billing_status", "Cancelled")
			frappe.msgprint(_("Proforma Invoice cancelled"))
		else:
			frappe.throw(_("Only submitted Proforma can be cancelled"))


@frappe.whitelist()
def make_proforma_from_so(source_name, billing_percentage=None):
	"""Create Proforma Invoice from Sales Order"""
	so = frappe.get_doc("Sales Order", source_name)
	
	if so.docstatus != 1:
		frappe.throw(_("Sales Order must be submitted"))
	
	proforma = frappe.new_doc("Proforma Invoice")
	proforma.sales_order = so.name
	proforma.customer = so.customer
	proforma.customer_name = so.customer_name
	proforma.project = so.project
	proforma.company = so.company
	proforma.currency = so.currency
	proforma.posting_date = nowdate()
	
	# Set billing percentage
	billing_pct = flt(billing_percentage) if billing_percentage else 100
	proforma.billing_percentage = billing_pct
	
	# Copy items with percentage
	for item in so.items:
		proforma.append("items", {
			"item_code": item.item_code,
			"item_name": item.item_name,
			"description": item.description,
			"qty": flt(item.qty) * billing_pct / 100,
			"uom": item.uom,
			"rate": item.rate,
			"so_detail": item.name
		})
	
	# Copy taxes template
	if so.taxes_and_charges:
		proforma.taxes_and_charges = so.taxes_and_charges
	
	return proforma


@frappe.whitelist()
def update_proforma_on_cn(doc, method=None):
	"""Update Proforma status when Credit Note is created against linked SI"""
	cn = doc
	
	if not cn.is_return:
		return
	
	# Find the original SI
	if cn.return_against:
		original_si = cn.return_against
		# Check if SI has linked Proforma
		proforma = frappe.db.get_value("Proforma Invoice", 
			{"sales_invoice": original_si, "docstatus": 1}, 
			"name")
		
		if proforma:
			frappe.db.set_value("Proforma Invoice", proforma, "billing_status", "Cancelled")
			frappe.msgprint(_("Linked Proforma Invoice {0} marked as Cancelled").format(proforma))
