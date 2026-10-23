# Copyright (c) 2026, Tripod and contributors
# Accounts Payable Summary aged by Supplier Invoice Date (Purchase Invoice.bill_date).
#
# Balances come from the Payment Ledger (same source as the standard
# Accounts Payable Summary), as on the selected date, in company currency.
# Invoices without a Supplier Invoice Date are aged from their posting date.

import frappe
from frappe import _
from frappe.utils import cint, date_diff, flt, getdate, nowdate

BUCKETS = ["range1", "range2", "range3", "range4", "range5"]


def execute(filters=None):
	filters = frappe._dict(filters or {})
	if not filters.company:
		return [], [], None, None, []

	as_on = getdate(filters.as_on_date or nowdate())
	ranges = [cint(filters.get(f"range{i}")) or d for i, d in enumerate((30, 60, 90, 120), 1)]
	labels = _range_labels(ranges)
	currency = frappe.get_cached_value("Company", filters.company, "default_currency")

	balances = _get_balances(filters, as_on)
	pi_dates = _get_invoice_dates([b.against_voucher_no for b in balances if b.against_voucher_type == "Purchase Invoice"])
	names = _get_supplier_names({b.party for b in balances})

	suppliers = {}
	for b in balances:
		amt = flt(b.amount)
		s = suppliers.setdefault(b.party, {
			"supplier": b.party,
			"supplier_name": names.get(b.party) or b.party,
			"currency": currency,
			"invoice_count": 0,
			"oldest_bill_date": None,
			"outstanding": 0.0,
			"advance": 0.0,
			"net_payable": 0.0,
			"no_bill_date": 0,
			**{k: 0.0 for k in BUCKETS},
		})
		s["net_payable"] += amt

		if b.against_voucher_type == "Purchase Invoice":
			d = pi_dates.get(b.against_voucher_no) or {}
			bill_date = d.get("bill_date")
			age_date = bill_date or d.get("posting_date") or b.first_date
			s["invoice_count"] += 1
			if not bill_date:
				s["no_bill_date"] += 1
			elif not s["oldest_bill_date"] or bill_date < s["oldest_bill_date"]:
				s["oldest_bill_date"] = bill_date
		elif amt < 0:
			# Unallocated payment / advance to supplier
			s["advance"] += amt
			continue
		else:
			# Opening balances / journal credits to supplier
			age_date = b.first_date

		s["outstanding"] += amt
		age = max(date_diff(as_on, age_date), 0) if age_date else 0
		s[_bucket_for(age, ranges)] += amt

	data = sorted(
		[s for s in suppliers.values() if abs(s["net_payable"]) >= 0.01 or abs(s["outstanding"]) >= 0.01],
		key=lambda x: x["net_payable"],
		reverse=True,
	)

	totals = {k: sum(d[k] for d in data) for k in BUCKETS + ["outstanding", "advance", "net_payable", "no_bill_date"]}

	chart = {
		"data": {
			"labels": labels,
			"datasets": [{"name": _("Outstanding"), "values": [round(totals[k], 2) for k in BUCKETS]}],
		},
		"type": "bar",
		"colors": ["#2563eb"],
		"fieldtype": "Currency",
		"options": currency,
		"barOptions": {"spaceRatio": 0.5},
	}

	summary = [
		{"label": _("Net Payable"), "value": totals["net_payable"], "datatype": "Currency", "currency": currency, "indicator": "Blue"},
		{"label": _("Advance Paid"), "value": totals["advance"], "datatype": "Currency", "currency": currency, "indicator": "Green"},
	]
	for key, label, ind in zip(BUCKETS, labels, ["Green", "Blue", "Orange", "Red", "Red"]):
		summary.append({"label": label + " " + _("Days"), "value": totals[key], "datatype": "Currency", "currency": currency, "indicator": ind})
	summary.append({
		"label": _("Invoices Without Supplier Invoice Date"), "value": totals["no_bill_date"],
		"datatype": "Int", "indicator": "Orange" if totals["no_bill_date"] else "Green",
	})

	return _columns(labels), data, None, chart, summary


def _get_balances(filters, as_on):
	conditions = [
		"ple.company = %(company)s",
		"ple.party_type = 'Supplier'",
		"ple.delinked = 0",
		"ple.posting_date <= %(as_on)s",
	]
	params = {"company": filters.company, "as_on": as_on}
	if filters.supplier:
		conditions.append("ple.party = %(supplier)s")
		params["supplier"] = filters.supplier
	if filters.supplier_group:
		conditions.append("sup.supplier_group = %(supplier_group)s")
		params["supplier_group"] = filters.supplier_group

	return frappe.db.sql(
		f"""
		SELECT ple.party, ple.against_voucher_type, ple.against_voucher_no,
			SUM(ple.amount) AS amount, MIN(ple.posting_date) AS first_date
		FROM `tabPayment Ledger Entry` ple
		LEFT JOIN `tabSupplier` sup ON sup.name = ple.party
		WHERE {" AND ".join(conditions)}
		GROUP BY ple.party, ple.against_voucher_type, ple.against_voucher_no
		HAVING ABS(SUM(ple.amount)) >= 0.01
		""",
		params,
		as_dict=1,
	)


def _get_invoice_dates(invoices):
	if not invoices:
		return {}
	return {
		r.name: r
		for r in frappe.db.sql(
			"""SELECT name, bill_date, posting_date FROM `tabPurchase Invoice` WHERE name IN %(pis)s""",
			{"pis": invoices},
			as_dict=1,
		)
	}


def _get_supplier_names(suppliers):
	if not suppliers:
		return {}
	return {
		r.name: r.supplier_name
		for r in frappe.db.sql(
			"""SELECT name, supplier_name FROM `tabSupplier` WHERE name IN %(s)s""",
			{"s": list(suppliers)},
			as_dict=1,
		)
	}


def _range_labels(ranges):
	r1, r2, r3, r4 = ranges
	return [f"0-{r1}", f"{r1 + 1}-{r2}", f"{r2 + 1}-{r3}", f"{r3 + 1}-{r4}", f"{r4 + 1}+"]


def _bucket_for(age, ranges):
	for i, limit in enumerate(ranges, 1):
		if age <= limit:
			return f"range{i}"
	return "range5"


def _columns(labels):
	cols = [
		{"label": _("Supplier"), "fieldname": "supplier", "fieldtype": "Link", "options": "Supplier", "width": 160},
		{"label": _("Supplier Name"), "fieldname": "supplier_name", "fieldtype": "Data", "width": 220},
		{"label": _("Currency"), "fieldname": "currency", "fieldtype": "Link", "options": "Currency", "width": 80},
		{"label": _("Invoices"), "fieldname": "invoice_count", "fieldtype": "Int", "width": 80},
		{"label": _("Oldest Supplier Invoice Date"), "fieldname": "oldest_bill_date", "fieldtype": "Date", "width": 170},
		{"label": _("Invoice Outstanding"), "fieldname": "outstanding", "fieldtype": "Currency", "options": "currency", "width": 140},
		{"label": _("Advance Paid"), "fieldname": "advance", "fieldtype": "Currency", "options": "currency", "width": 120},
		{"label": _("Net Payable"), "fieldname": "net_payable", "fieldtype": "Currency", "options": "currency", "width": 130},
	]
	for key, label in zip(BUCKETS, labels):
		cols.append({"label": label, "fieldname": key, "fieldtype": "Currency", "options": "currency", "width": 120})
	cols.append({"label": _("No Supplier Invoice Date"), "fieldname": "no_bill_date", "fieldtype": "Int", "width": 170})
	return cols
