# Copyright (c) 2026, Tripod and contributors
# Accounts payable aging based on Supplier Bill Date (Purchase Invoice.bill_date).
# Falls back to Posting Date when Bill Date is empty. Ages as on today,
# using each invoice's current outstanding, in company currency.

import frappe
from frappe import _
from frappe.utils import cint, date_diff, flt, getdate, nowdate


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.company:
		return [], [], None, None, []

	ranges = [cint(filters.get(f"range{i}")) or d for i, d in enumerate((30, 60, 90, 120), 1)]
	buckets = _bucket_labels(ranges)
	currency = frappe.get_cached_value("Company", filters.company, "default_currency")

	rows = _get_invoices(filters)
	today = getdate(nowdate())

	data = []
	for r in rows:
		age_date = _age_date(r, filters.ageing_based_on)
		age = date_diff(today, age_date) if age_date else 0
		amt = flt(r.outstanding_amount) * flt(r.conversion_rate or 1)

		row = {
			"supplier": r.supplier,
			"supplier_name": r.supplier_name,
			"invoice": r.name,
			"bill_no": r.bill_no,
			"bill_date": r.bill_date,
			"posting_date": r.posting_date,
			"due_date": r.due_date,
			"age": age,
			"currency": currency,
			"outstanding": amt,
			"no_bill_date": 0 if r.bill_date else 1,
		}
		for key in buckets:
			row[key] = 0.0
		row[_bucket_for(age, ranges)] = amt
		data.append(row)

	labels = _range_labels(ranges)
	totals = {k: sum(d[k] for d in data) for k in buckets}
	total_outstanding = sum(d["outstanding"] for d in data)
	missing = sum(d["no_bill_date"] for d in data)

	if filters.view == "Supplier Summary":
		data = _summarise(data, buckets, currency)

	chart = {
		"data": {
			"labels": labels,
			"datasets": [{"name": _("Outstanding"), "values": [round(totals[k], 2) for k in buckets]}],
		},
		"type": "bar",
		"colors": ["#2563eb"],
		"fieldtype": "Currency",
		"options": currency,
		"barOptions": {"spaceRatio": 0.5},
	}

	indicators = ["Green", "Blue", "Orange", "Red", "Red"]
	summary = [
		{"label": _("Total Outstanding"), "value": total_outstanding, "datatype": "Currency",
			"currency": currency, "indicator": "Blue"},
	]
	for key, label, ind in zip(buckets, labels, indicators):
		summary.append({"label": label + " " + _("Days"), "value": totals[key], "datatype": "Currency",
			"currency": currency, "indicator": ind})
	summary.append({"label": _("Invoices Without Bill Date"), "value": missing, "datatype": "Int",
		"indicator": "Orange" if missing else "Green"})

	return _columns(filters.view, buckets, ranges), data, None, chart, summary


def _range_labels(ranges):
	r1, r2, r3, r4 = ranges
	return [f"0-{r1}", f"{r1 + 1}-{r2}", f"{r2 + 1}-{r3}", f"{r3 + 1}-{r4}", f"{r4 + 1}+"]


def _get_invoices(filters):
	conditions = ["pi.docstatus = 1", "pi.company = %(company)s", "pi.outstanding_amount != 0"]
	if filters.supplier:
		conditions.append("pi.supplier = %(supplier)s")
	if filters.supplier_group:
		conditions.append("sup.supplier_group = %(supplier_group)s")

	return frappe.db.sql(
		f"""
		SELECT pi.name, pi.supplier, pi.supplier_name, pi.bill_no, pi.bill_date,
			pi.posting_date, pi.due_date, pi.outstanding_amount, pi.conversion_rate
		FROM `tabPurchase Invoice` pi
		LEFT JOIN `tabSupplier` sup ON sup.name = pi.supplier
		WHERE {" AND ".join(conditions)}
		ORDER BY pi.supplier, COALESCE(pi.bill_date, pi.posting_date)
		""",
		filters,
		as_dict=1,
	)


def _age_date(r, based_on):
	if based_on == "Posting Date":
		return r.posting_date
	if based_on == "Due Date":
		return r.due_date or r.posting_date
	return r.bill_date or r.posting_date


def _bucket_labels(ranges):
	return ["range1", "range2", "range3", "range4", "range5"]


def _bucket_for(age, ranges):
	for i, limit in enumerate(ranges, 1):
		if age <= limit:
			return f"range{i}"
	return "range5"


def _summarise(data, buckets, currency):
	out = {}
	for d in data:
		s = out.setdefault(
			d["supplier"],
			{
				"supplier": d["supplier"],
				"supplier_name": d["supplier_name"],
				"currency": currency,
				"outstanding": 0.0,
				"invoice_count": 0,
				"no_bill_date": 0,
				**{k: 0.0 for k in buckets},
			},
		)
		s["outstanding"] += d["outstanding"]
		s["invoice_count"] += 1
		s["no_bill_date"] += d["no_bill_date"]
		for k in buckets:
			s[k] += d[k]
	return sorted(out.values(), key=lambda x: x["outstanding"], reverse=True)


def _columns(view, buckets, ranges):
	cols = [
		{"label": _("Supplier"), "fieldname": "supplier", "fieldtype": "Link", "options": "Supplier", "width": 160},
		{"label": _("Supplier Name"), "fieldname": "supplier_name", "fieldtype": "Data", "width": 200},
	]
	if view == "Invoice Detail":
		cols += [
			{"label": _("Invoice"), "fieldname": "invoice", "fieldtype": "Link", "options": "Purchase Invoice", "width": 150},
			{"label": _("Supplier Invoice No"), "fieldname": "bill_no", "fieldtype": "Data", "width": 130},
			{"label": _("Bill Date"), "fieldname": "bill_date", "fieldtype": "Date", "width": 100},
			{"label": _("Posting Date"), "fieldname": "posting_date", "fieldtype": "Date", "width": 100},
			{"label": _("Due Date"), "fieldname": "due_date", "fieldtype": "Date", "width": 100},
			{"label": _("Age (Days)"), "fieldname": "age", "fieldtype": "Int", "width": 90},
		]
	else:
		cols.append({"label": _("Invoices"), "fieldname": "invoice_count", "fieldtype": "Int", "width": 80})

	cols += [
		{"label": _("Currency"), "fieldname": "currency", "fieldtype": "Link", "options": "Currency", "width": 70, "hidden": 1},
		{"label": _("Outstanding"), "fieldname": "outstanding", "fieldtype": "Currency", "options": "currency", "width": 130},
	]

	labels = _range_labels(ranges)
	for key, label in zip(buckets, labels):
		cols.append({"label": label, "fieldname": key, "fieldtype": "Currency", "options": "currency", "width": 120})

	cols.append({"label": _("No Bill Date"), "fieldname": "no_bill_date", "fieldtype": "Int", "width": 100})
	return cols
