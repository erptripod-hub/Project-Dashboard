# Copyright (c) 2026, Tripod and contributors
# Adds Proforma Invoice to the Connections section of
# Sales Order, Sales Invoice and Project (no DB change, no migrate needed).

DOCTYPE = "Proforma Invoice"


def _add(data, after, label="Billing"):
	"""Insert Proforma Invoice next to `after` in its group; else add a new group."""
	transactions = data.setdefault("transactions", [])

	for group in transactions:
		if DOCTYPE in group.get("items", []):
			return data

	for group in transactions:
		items = group.get("items", [])
		if after in items:
			items.insert(items.index(after), DOCTYPE)
			return data

	transactions.append({"label": label, "items": [DOCTYPE]})
	return data


def sales_order(data):
	# Proforma Invoice.sales_order -> Sales Order
	return _add(data, after="Sales Invoice")


def sales_invoice(data):
	# Proforma Invoice.sales_invoice -> Sales Invoice
	data.setdefault("non_standard_fieldnames", {})[DOCTYPE] = "sales_invoice"
	return _add(data, after="Sales Order", label="Proforma")


def project(data):
	# Proforma Invoice.project -> Project
	return _add(data, after="Sales Invoice")
