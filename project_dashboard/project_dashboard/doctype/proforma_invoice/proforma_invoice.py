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
		"""Create Sales Invoice from Proforma"""
		if self.billing_status == "Invoiced":
			frappe.throw(_("Sales Invoice already created: {0}").format(self.sales_invoice))
		
		if self.billing_status == "Cancelled":
			frappe.throw(_("Cannot create invoice from cancelled Proforma"))
		
		si = frappe.new_doc("Sales Invoice")
		si.customer = self.customer
		si.project = self.project
		si.company = self.company
		si.currency = self.currency
		si.custom_proforma_invoice = self.name
		
		# Copy items
		for item in self.items:
			si.append("items", {
				"item_code": item.item_code,
				"item_name": item.item_name,
				"description": item.description,
				"qty": item.qty,
				"uom": item.uom,
				"rate": item.rate,
				"amount": item.amount,
				"sales_order": self.sales_order,
				"so_detail": item.so_detail
			})
		
		# Copy taxes
		if self.taxes_and_charges:
			si.taxes_and_charges = self.taxes_and_charges
		
		for tax in self.taxes:
			si.append("taxes", {
				"charge_type": tax.charge_type,
				"account_head": tax.account_head,
				"description": tax.description,
				"rate": tax.rate
			})
		
		si.flags.ignore_permissions = True
		si.save()
		
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
def update_proforma_on_cn(cn_name):
	"""Update Proforma status when Credit Note is created against linked SI"""
	cn = frappe.get_doc("Sales Invoice", cn_name)
	
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
