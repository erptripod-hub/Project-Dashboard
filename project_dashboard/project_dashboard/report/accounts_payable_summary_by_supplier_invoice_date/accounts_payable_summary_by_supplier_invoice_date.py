# Copyright (c) 2026, Tripod and contributors
# Accounts Payable Summary aged by Supplier Invoice Date (Purchase Invoice.bill_date),
# one row per supplier, with Post-Dated Cheques (PDC) shown by month.
#
# Balances come from the Payment Ledger (same source as the standard
# Accounts Payable Summary), as on the selected date, in company currency.
# PDC = submitted supplier Payment Entry with a future Posting Date (after the
# As On Date) AND Mode of Payment = Cheque. PDCs are kept out of the
# outstanding/aging and shown separately, so aging reflects unpaid invoices.

import datetime

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

	pdcs = _get_pdcs(filters, as_on)
	pdc_months = sorted({p.month_key for p in pdcs})
	balances = _get_balances(filters, as_on, [p.name for p in pdcs])
	pi_dates = _get_invoice_dates(
		[b.against_voucher_no for b in balances if b.against_voucher_type == "Purchase Invoice"]
	)
	names = _get_supplier_names({b.party for b in balances} | {p.party for p in pdcs})

	suppliers = {}
	for b in balances:
		amt = flt(b.amount)
		s = _supplier_row(suppliers, b.party, names, currency, pdc_months)
		s["net_payable"] += amt

		if b.against_voucher_type == "Purchase Invoice":
			d = pi_dates.get(b.against_voucher_no) or {}
			bill_date = d.get("bill_date")
			age_date = bill_date or d.get("posting_date") or b.first_date
			s["invoice_count"] += 1
			if not bill_date:
				s["no_bill_date"] += 1
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

	for p in pdcs:
		s = _supplier_row(suppliers, p.party, names, currency, pdc_months)
		amt = flt(p.amount)
		s["pdc_" + p.month_key] += amt
		s["pdc_total"] += amt

	for s in suppliers.values():
		s["balance_after_pdc"] = s["net_payable"] - s["pdc_total"]

	data = sorted(
		[
			s for s in suppliers.values()
			if abs(s["net_payable"]) >= 0.01 or abs(s["outstanding"]) >= 0.01 or abs(s["pdc_total"]) >= 0.01
		],
		key=lambda x: x["net_payable"],
		reverse=True,
	)

	keys = BUCKETS + ["outstanding", "advance", "net_payable", "pdc_total", "balance_after_pdc", "no_bill_date"]
	totals = {k: sum(d[k] for d in data) for k in keys}

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

	def card(label, key, ind):
		return {"label": label, "value": totals[key], "datatype": "Currency", "currency": currency, "indicator": ind}

	summary = [card(_("Net Payable"), "net_payable", "Blue")]
	for key, label, ind in zip(BUCKETS, labels, ["Green", "Blue", "Orange", "Red", "Red"]):
		summary.append(card(label + " " + _("Days"), key, ind))
	summary += [
		card(_("Advance Paid"), "advance", "Green"),
		card(_("PDC Issued"), "pdc_total", "Purple"),
		card(_("Balance After PDC"), "balance_after_pdc", "Blue"),
		{
			"label": _("Invoices Without Supplier Invoice Date"), "value": totals["no_bill_date"],
			"datatype": "Int", "indicator": "Orange" if totals["no_bill_date"] else "Green",
		},
	]

	return _columns(labels, pdc_months), data, None, chart, summary


def _supplier_row(suppliers, party, names, currency, pdc_months):
	return suppliers.setdefault(party, {
		"supplier": party,
		"supplier_name": names.get(party) or party,
		"currency": currency,
		"invoice_count": 0,
		"outstanding": 0.0,
		"advance": 0.0,
		"net_payable": 0.0,
		"pdc_total": 0.0,
		"balance_after_pdc": 0.0,
		"no_bill_date": 0,
		**{k: 0.0 for k in BUCKETS},
		**{"pdc_" + m: 0.0 for m in pdc_months},
	})


def _party_conditions(filters, alias, conditions, params):
	if filters.supplier:
		conditions.append(f"{alias}.party = %(supplier)s")
		params["supplier"] = filters.supplier
	if filters.supplier_group:
		conditions.append("sup.supplier_group = %(supplier_group)s")
		params["supplier_group"] = filters.supplier_group


def _get_pdcs(filters, as_on):
	conditions = [
		"pe.docstatus = 1",
		"pe.company = %(company)s",
		"pe.payment_type = 'Pay'",
		"pe.party_type = 'Supplier'",
		"pe.posting_date > %(as_on)s",
		"pe.mode_of_payment = 'Cheque'",
	]
	params = {"company": filters.company, "as_on": as_on}
	_party_conditions(filters, "pe", conditions, params)

	rows = frappe.db.sql(
		f"""
		SELECT pe.name, pe.party, pe.base_paid_amount AS amount,
			pe.posting_date AS cheque_date
		FROM `tabPayment Entry` pe
		LEFT JOIN `tabSupplier` sup ON sup.name = pe.party
		WHERE {" AND ".join(conditions)}
		""",
		params,
		as_dict=1,
	)
	for r in rows:
		r.month_key = getdate(r.cheque_date).strftime("%Y_%m")
	return rows


def _get_balances(filters, as_on, exclude_vouchers=None):
	conditions = [
		"ple.company = %(company)s",
		"ple.party_type = 'Supplier'",
		"ple.delinked = 0",
		"ple.posting_date <= %(as_on)s",
	]
	params = {"company": filters.company, "as_on": as_on}
	if exclude_vouchers:
		conditions.append("NOT (ple.voucher_type = 'Payment Entry' AND ple.voucher_no IN %(pdc)s)")
		params["pdc"] = exclude_vouchers
	_party_conditions(filters, "ple", conditions, params)

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


def _columns(labels, pdc_months):
	def money(label, fieldname, width=120):
		return {"label": label, "fieldname": fieldname, "fieldtype": "Currency", "options": "currency", "width": width}

	cols = [
		{"label": _("Supplier"), "fieldname": "supplier", "fieldtype": "Link", "options": "Supplier", "width": 160},
		{"label": _("Supplier Name"), "fieldname": "supplier_name", "fieldtype": "Data", "width": 220},
		{"label": _("Currency"), "fieldname": "currency", "fieldtype": "Link", "options": "Currency", "width": 80},
		{"label": _("Invoices"), "fieldname": "invoice_count", "fieldtype": "Int", "width": 80},
		money(_("Invoice Outstanding"), "outstanding", 140),
	]
	cols += [money(label, key) for key, label in zip(BUCKETS, labels)]
	cols += [money(_("Advance Paid"), "advance"), money(_("Net Payable"), "net_payable", 130)]
	for m in pdc_months:
		y, mo = m.split("_")
		cols.append(money(_("PDC") + " " + datetime.date(int(y), int(mo), 1).strftime("%b-%Y"), "pdc_" + m))
	cols += [
		money(_("Total PDC"), "pdc_total"),
		money(_("Balance After PDC"), "balance_after_pdc", 140),
		{"label": _("No Supplier Invoice Date"), "fieldname": "no_bill_date", "fieldtype": "Int", "width": 170},
	]
	return cols
