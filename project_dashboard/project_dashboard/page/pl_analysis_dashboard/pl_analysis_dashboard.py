"""P&L Analysis Dashboard — company level profit and loss with drill-downs.

All figures are read from GL Entry so the page always agrees with the
standard Profit and Loss Statement. Nothing is hardcoded per company:
the COGS account comes from Company.default_expense_account and the
payroll accounts come from Salary Component Account, so the page keeps
working when finance renames or restructures the chart of accounts.
"""

import frappe
from frappe import _
from frappe.utils import flt, getdate, add_months, get_first_day, get_last_day, formatdate


# ---------------------------------------------------------------- helpers

def _check_permission():
    """Page is System Manager only. Guard every whitelisted method."""
    if "System Manager" not in frappe.get_roles(frappe.session.user):
        frappe.throw(_("Not permitted"), frappe.PermissionError)


def _validate_company(company):
    if not company:
        frappe.throw(_("Company is required"))
    if not frappe.db.exists("Company", company):
        frappe.throw(_("Company {0} not found").format(company))
    return company


def _validate_dates(from_date, to_date):
    if not from_date or not to_date:
        frappe.throw(_("From Date and To Date are required"))
    from_date = getdate(from_date)
    to_date = getdate(to_date)
    if from_date > to_date:
        frappe.throw(_("From Date cannot be after To Date"))
    return from_date, to_date


def _month_keys(from_date, to_date):
    """List of (key, label, start, end) one per calendar month in range."""
    out = []
    cur = get_first_day(from_date)
    last = get_first_day(to_date)
    guard = 0
    while cur <= last and guard < 120:
        out.append({
            "key": cur.strftime("%Y-%m"),
            "label": formatdate(cur, "MMM yyyy"),
            "start": cur,
            "end": get_last_day(cur),
        })
        cur = get_first_day(add_months(cur, 1))
        guard += 1
    return out


def _company_meta(company):
    row = frappe.db.get_value(
        "Company",
        company,
        ["default_currency", "default_expense_account", "default_income_account",
         "cost_center", "abbr"],
        as_dict=True,
    ) or {}
    return {
        "currency": row.get("default_currency") or "",
        "cogs_account": row.get("default_expense_account") or "",
        "income_account": row.get("default_income_account") or "",
        "cost_center": row.get("cost_center") or "",
        "abbr": row.get("abbr") or "",
    }


def _payroll_accounts(company):
    """Expense accounts mapped on Salary Component for this company.

    Deduction components usually post to a liability or asset account,
    so only expense accounts are treated as payroll cost.
    """
    rows = frappe.db.sql(
        """
        SELECT DISTINCT sca.account
        FROM `tabSalary Component Account` sca
        INNER JOIN `tabAccount` a ON a.name = sca.account
        WHERE sca.company = %(company)s
          AND a.company = %(company)s
          AND a.root_type = 'Expense'
          AND a.is_group = 0
        """,
        {"company": company},
        as_dict=True,
    )
    return [r.account for r in rows if r.account]


# ---------------------------------------------------------------- main page

@frappe.whitelist()
def get_companies():
    _check_permission()
    rows = frappe.get_all(
        "Company",
        fields=["name", "default_currency", "abbr"],
        order_by="name asc",
    )
    return [{"name": r.name, "currency": r.default_currency, "abbr": r.abbr} for r in rows]


@frappe.whitelist()
def get_pl_data(company, from_date, to_date, cost_center=None):
    """Full page payload: heads, monthly columns, ledger tree, drill flags."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    meta = _company_meta(company)
    months = _month_keys(from_date, to_date)
    month_keys = [m["key"] for m in months]

    conditions = ""
    params = {"company": company, "from_date": from_date, "to_date": to_date}
    if cost_center:
        conditions += " AND gl.cost_center = %(cost_center)s"
        params["cost_center"] = cost_center

    rows = frappe.db.sql(
        """
        SELECT
            gl.account,
            a.root_type,
            a.parent_account,
            DATE_FORMAT(gl.posting_date, '%%Y-%%m') AS mkey,
            SUM(gl.debit) AS debit,
            SUM(gl.credit) AS credit
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        WHERE gl.company = %(company)s
          AND gl.is_cancelled = 0
          AND IFNULL(gl.is_opening, 'No') = 'No'
          AND gl.voucher_type != 'Period Closing Voucher'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
          AND a.root_type IN ('Income', 'Expense')
          {conditions}
        GROUP BY gl.account, a.root_type, a.parent_account, mkey
        """.format(conditions=conditions),
        params,
        as_dict=True,
    )

    # ---- classify every leaf account into one of four heads
    cogs_account = meta["cogs_account"]
    cogs_family = _account_family(company, cogs_account) if cogs_account else set()
    payroll_accounts = set(_payroll_accounts(company))

    heads = {
        "income": {"key": "income", "label": _("Income"), "accounts": {}},
        "cogs": {"key": "cogs", "label": _("Cost of goods sold"), "accounts": {}},
        "direct": {"key": "direct", "label": _("Direct expenses"), "accounts": {}},
        "indirect": {"key": "indirect", "label": _("Indirect expenses"), "accounts": {}},
    }

    direct_family = _named_family(company, "Direct Expenses")
    indirect_family = _named_family(company, "Indirect Expenses")

    for r in rows:
        if r.root_type == "Income":
            head = "income"
            amount = flt(r.credit) - flt(r.debit)
        else:
            amount = flt(r.debit) - flt(r.credit)
            if r.account in cogs_family:
                head = "cogs"
            elif r.account in indirect_family:
                head = "indirect"
            elif r.account in direct_family:
                head = "direct"
            else:
                head = "direct"

        bucket = heads[head]["accounts"].setdefault(
            r.account, {"account": r.account, "months": {}, "total": 0.0}
        )
        bucket["months"][r.mkey] = flt(bucket["months"].get(r.mkey, 0.0)) + amount
        bucket["total"] = flt(bucket["total"]) + amount

    # ---- shape for the client
    out_heads = []
    head_totals = {}
    for key in ("income", "cogs", "direct", "indirect"):
        accounts = []
        totals = {mk: 0.0 for mk in month_keys}
        grand = 0.0
        for acc in heads[key]["accounts"].values():
            months_list = [flt(acc["months"].get(mk, 0.0)) for mk in month_keys]
            for i, mk in enumerate(month_keys):
                totals[mk] = flt(totals[mk]) + months_list[i]
            grand = flt(grand) + flt(acc["total"])
            accounts.append({
                "account": acc["account"],
                "months": months_list,
                "total": flt(acc["total"]),
                "drill": _drill_for(acc["account"], key, cogs_family, payroll_accounts),
            })
        accounts.sort(key=lambda a: abs(a["total"]), reverse=True)
        head_totals[key] = {
            "months": [flt(totals[mk]) for mk in month_keys],
            "total": flt(grand),
        }
        out_heads.append({
            "key": key,
            "label": heads[key]["label"],
            "months": head_totals[key]["months"],
            "total": head_totals[key]["total"],
            "accounts": accounts,
        })

    income_m = head_totals["income"]["months"]
    cogs_m = head_totals["cogs"]["months"]
    direct_m = head_totals["direct"]["months"]
    indirect_m = head_totals["indirect"]["months"]

    gross_m = [income_m[i] - cogs_m[i] - direct_m[i] for i in range(len(month_keys))]
    totexp_m = [cogs_m[i] + direct_m[i] + indirect_m[i] for i in range(len(month_keys))]
    net_m = [gross_m[i] - indirect_m[i] for i in range(len(month_keys))]

    income_total = head_totals["income"]["total"]
    gross_total = sum(gross_m)
    totexp_total = sum(totexp_m)
    net_total = sum(net_m)

    return {
        "company": company,
        "currency": meta["currency"],
        "from_date": str(from_date),
        "to_date": str(to_date),
        "months": [{"key": m["key"], "label": m["label"]} for m in months],
        "heads": out_heads,
        "totals": {
            "income": {"months": income_m, "total": income_total},
            "gross_profit": {"months": gross_m, "total": gross_total},
            "total_expense": {"months": totexp_m, "total": totexp_total},
            "net_profit": {"months": net_m, "total": net_total},
        },
        "margins": {
            "gross": (gross_total / income_total * 100.0) if income_total else 0.0,
            "net": (net_total / income_total * 100.0) if income_total else 0.0,
            "expense_ratio": (totexp_total / income_total * 100.0) if income_total else 0.0,
        },
        "has_payroll_map": bool(payroll_accounts),
        "cogs_account": cogs_account,
    }


def _account_family(company, root_account):
    """Root account plus every descendant leaf.

    Walks parent_account rather than the lft/rgt nested set. The nested
    set can hold stale or duplicated bounds when accounts are re-parented
    without a tree rebuild, which silently files an account under the
    wrong head. parent_account is what finance actually edits, so it is
    the trustworthy source.
    """
    if not root_account:
        return set()

    rows = frappe.get_all(
        "Account",
        filters={"company": company},
        fields=["name", "parent_account", "is_group"],
    )

    children = {}
    is_group = {}
    for r in rows:
        is_group[r.name] = r.is_group
        children.setdefault(r.parent_account, []).append(r.name)

    if root_account not in is_group:
        return set()

    leaves = set()
    seen = set()
    stack = [root_account]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        kids = children.get(node, [])
        if not kids and not is_group.get(node):
            leaves.add(node)
        for k in kids:
            if not is_group.get(k):
                leaves.add(k)
            else:
                stack.append(k)
    return leaves


def _named_family(company, account_name_fragment):
    """Leaf accounts under a group whose account_name matches, if it exists."""
    group = frappe.db.get_value(
        "Account",
        {"company": company, "account_name": account_name_fragment, "is_group": 1},
        "name",
    )
    if not group:
        return set()
    return _account_family(company, group)


def _drill_for(account, head_key, cogs_family, payroll_accounts):
    if account in payroll_accounts:
        return "cost_center"
    if head_key == "cogs" and account in cogs_family:
        return "supplier_group"
    if head_key == "income":
        return "customer_group"
    return None


# ---------------------------------------------------------------- drills

@frappe.whitelist()
def get_income_split(company, from_date, to_date, mode="customer_group"):
    """Income by customer group, customer, project or month."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    if mode not in ("customer_group", "customer", "project", "month"):
        frappe.throw(_("Invalid mode"))

    if mode == "month":
        rows = frappe.db.sql(
            """
            SELECT DATE_FORMAT(gl.posting_date, '%%Y-%%m') AS label,
                   SUM(gl.credit - gl.debit) AS amount,
                   COUNT(DISTINCT gl.voucher_no) AS cnt
            FROM `tabGL Entry` gl
            INNER JOIN `tabAccount` a ON a.name = gl.account
            WHERE gl.company = %(company)s AND gl.is_cancelled = 0
              AND a.root_type = 'Income'
              AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
            GROUP BY label ORDER BY label
            """,
            {"company": company, "from_date": from_date, "to_date": to_date},
            as_dict=True,
        )
        return _finish_split(rows, unit="vch")

    group_field = {
        "customer_group": "IFNULL(NULLIF(c.customer_group, ''), 'Ungrouped')",
        "customer": "si.customer",
        "project": ("CASE WHEN IFNULL(si.project, '') = '' THEN 'No project' "
                    "ELSE CONCAT(si.project, IFNULL(CONCAT(' - ', NULLIF(pr.project_name, si.project)), '')) "
                    "END"),
    }[mode]

    rows = frappe.db.sql(
        """
        SELECT {group_field} AS label,
               SUM(gl.credit - gl.debit) AS amount,
               COUNT(DISTINCT gl.voucher_no) AS cnt
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        INNER JOIN `tabSales Invoice` si ON si.name = gl.voucher_no
        LEFT JOIN `tabCustomer` c ON c.name = si.customer
        LEFT JOIN `tabProject` pr ON pr.name = si.project
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type = 'Sales Invoice'
          AND a.root_type = 'Income'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY label
        ORDER BY amount DESC
        """.format(group_field=group_field),
        {"company": company, "from_date": from_date, "to_date": to_date},
        as_dict=True,
    )

    other = frappe.db.sql(
        """
        SELECT SUM(gl.credit - gl.debit) AS amount,
               COUNT(DISTINCT gl.voucher_no) AS cnt
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type != 'Sales Invoice'
          AND a.root_type = 'Income'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
        as_dict=True,
    )
    if other and flt(other[0].amount):
        rows.append({
            "label": _("Not from a sales invoice"),
            "amount": flt(other[0].amount),
            "cnt": other[0].cnt or 0,
            "warn": 1,
        })

    return _finish_split(rows, unit="inv")


@frappe.whitelist()
def get_cogs_split(company, from_date, to_date, mode="supplier_group"):
    """Purchase cost by supplier group, supplier or month."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    if mode not in ("supplier_group", "supplier", "month"):
        frappe.throw(_("Invalid mode"))

    meta = _company_meta(company)
    family = _account_family(company, meta["cogs_account"])
    if not family:
        return {"rows": [], "total": 0.0, "unit": "inv",
                "message": _("No default expense account is set on this company.")}

    base = {
        "company": company,
        "from_date": from_date,
        "to_date": to_date,
        "accounts": list(family),
    }

    if mode == "month":
        rows = frappe.db.sql(
            """
            SELECT DATE_FORMAT(gl.posting_date, '%%Y-%%m') AS label,
                   SUM(gl.debit - gl.credit) AS amount,
                   COUNT(DISTINCT gl.voucher_no) AS cnt
            FROM `tabGL Entry` gl
            WHERE gl.company = %(company)s AND gl.is_cancelled = 0
              AND gl.account IN %(accounts)s
              AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
            GROUP BY label ORDER BY label
            """,
            base,
            as_dict=True,
        )
        return _finish_split(rows, unit="vch")

    group_field = {
        "supplier_group": "IFNULL(NULLIF(s.supplier_group, ''), 'Ungrouped')",
        "supplier": "pi.supplier",
    }[mode]

    rows = frappe.db.sql(
        """
        SELECT {group_field} AS label,
               SUM(gl.debit - gl.credit) AS amount,
               COUNT(DISTINCT gl.voucher_no) AS cnt
        FROM `tabGL Entry` gl
        INNER JOIN `tabPurchase Invoice` pi ON pi.name = gl.voucher_no
        LEFT JOIN `tabSupplier` s ON s.name = pi.supplier
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type = 'Purchase Invoice'
          AND gl.account IN %(accounts)s
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY label
        ORDER BY amount DESC
        """.format(group_field=group_field),
        base,
        as_dict=True,
    )

    other = frappe.db.sql(
        """
        SELECT SUM(gl.debit - gl.credit) AS amount,
               COUNT(DISTINCT gl.voucher_no) AS cnt
        FROM `tabGL Entry` gl
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type != 'Purchase Invoice'
          AND gl.account IN %(accounts)s
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        """,
        base,
        as_dict=True,
    )
    if other and flt(other[0].amount):
        rows.append({
            "label": _("Not from a purchase invoice"),
            "amount": flt(other[0].amount),
            "cnt": other[0].cnt or 0,
            "warn": 1,
        })

    return _finish_split(rows, unit="inv")


@frappe.whitelist()
def get_salary_split(company, from_date, to_date, mode="cost_center", cost_center=None):
    """Payroll cost by cost centre, employment type, account or month.

    Employment type is held on the Payroll Entry, not on the ledger line,
    so it is reached through the accrual journal: the payable line of the
    journal carries reference_type 'Payroll Entry' pointing at the run.
    Anything posted to the salary accounts by a manual journal has no
    payroll entry behind it and is reported separately rather than
    silently dropped.
    """
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    if mode not in ("cost_center", "employment_type", "account", "month"):
        frappe.throw(_("Invalid mode"))

    accounts = _payroll_accounts(company)
    if not accounts:
        return {"rows": [], "total": 0.0, "unit": "",
                "message": _("No salary component is mapped to an expense account for this company.")}

    base = {
        "company": company,
        "from_date": from_date,
        "to_date": to_date,
        "accounts": accounts,
    }

    cc_filter = ""
    if cost_center:
        cc_filter = " AND gl.cost_center = %(cost_center)s"
        base["cost_center"] = cost_center

    if mode == "month":
        rows = frappe.db.sql(
            """
            SELECT DATE_FORMAT(gl.posting_date, '%%Y-%%m') AS label,
                   SUM(gl.debit - gl.credit) AS amount
            FROM `tabGL Entry` gl
            WHERE gl.company = %(company)s AND gl.is_cancelled = 0
              AND gl.account IN %(accounts)s
              AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
              {cc_filter}
            GROUP BY label ORDER BY label
            """.format(cc_filter=cc_filter),
            base,
            as_dict=True,
        )
        return _finish_split(rows, unit="")

    if mode == "account":
        rows = frappe.db.sql(
            """
            SELECT gl.account AS label,
                   SUM(gl.debit - gl.credit) AS amount
            FROM `tabGL Entry` gl
            WHERE gl.company = %(company)s AND gl.is_cancelled = 0
              AND gl.account IN %(accounts)s
              AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
              {cc_filter}
            GROUP BY label ORDER BY amount DESC
            """.format(cc_filter=cc_filter),
            base,
            as_dict=True,
        )
        return _finish_split(rows, unit="")

    if mode == "employment_type":
        rows = frappe.db.sql(
            """
            SELECT IFNULL(NULLIF(pe.employment_type, ''), 'Not from a payroll run') AS label,
                   SUM(gl.debit - gl.credit) AS amount,
                   COUNT(DISTINCT gl.voucher_no) AS cnt
            FROM `tabGL Entry` gl
            LEFT JOIN `tabJournal Entry Account` jea
                   ON jea.parent = gl.voucher_no
                  AND jea.reference_type = 'Payroll Entry'
            LEFT JOIN `tabPayroll Entry` pe
                   ON pe.name = jea.reference_name
            WHERE gl.company = %(company)s AND gl.is_cancelled = 0
              AND gl.account IN %(accounts)s
              AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
              {cc_filter}
            GROUP BY label
            ORDER BY amount DESC
            """.format(cc_filter=cc_filter),
            base,
            as_dict=True,
        )
        for r in rows:
            if r.get("label") == "Not from a payroll run":
                r["warn"] = 1
        return _finish_split(rows, unit="vch")

    rows = frappe.db.sql(
        """
        SELECT IFNULL(NULLIF(gl.cost_center, ''), 'Unallocated') AS label,
               SUM(gl.debit - gl.credit) AS amount
        FROM `tabGL Entry` gl
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.account IN %(accounts)s
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
          {cc_filter}
        GROUP BY label
        ORDER BY amount DESC
        """.format(cc_filter=cc_filter),
        base,
        as_dict=True,
    )
    for r in rows:
        if r.get("label") == "Unallocated":
            r["warn"] = 1
        else:
            r["drill"] = r.get("label")

    return _finish_split(rows, unit="")


def _finish_split(rows, unit=""):
    total = sum(flt(r.get("amount")) for r in rows)
    out = []
    for r in rows:
        amount = flt(r.get("amount"))
        out.append({
            "label": r.get("label") or _("Unnamed"),
            "amount": amount,
            "count": r.get("cnt") or 0,
            "pct": (amount / total * 100.0) if total else 0.0,
            "warn": 1 if r.get("warn") else 0,
            "drill": r.get("drill") or "",
        })
    return {"rows": out, "total": total, "unit": unit}


@frappe.whitelist()
def get_head_split(company, from_date, to_date, head="direct", mode="cost_center"):
    """Any expense head split by cost center, account or month."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    if head not in ("direct", "indirect"):
        frappe.throw(_("Invalid head"))
    if mode not in ("cost_center", "account", "month"):
        frappe.throw(_("Invalid mode"))

    meta = _company_meta(company)
    cogs_family = _account_family(company, meta["cogs_account"])
    direct_family = _named_family(company, "Direct Expenses")
    indirect_family = _named_family(company, "Indirect Expenses")

    if head == "indirect":
        accounts = sorted(indirect_family - cogs_family)
    else:
        all_expense = set(frappe.get_all(
            "Account",
            filters={"company": company, "is_group": 0, "root_type": "Expense"},
            pluck="name",
        ))
        accounts = sorted((direct_family or (all_expense - indirect_family)) - cogs_family)

    if not accounts:
        return {"rows": [], "total": 0.0, "unit": "",
                "message": _("No accounts found under this head.")}

    base = {
        "company": company,
        "from_date": from_date,
        "to_date": to_date,
        "accounts": accounts,
    }

    if mode == "month":
        rows = frappe.db.sql(
            """
            SELECT DATE_FORMAT(gl.posting_date, '%%Y-%%m') AS label,
                   SUM(gl.debit - gl.credit) AS amount
            FROM `tabGL Entry` gl
            WHERE gl.company = %(company)s AND gl.is_cancelled = 0
              AND gl.account IN %(accounts)s
              AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
            GROUP BY label ORDER BY label
            """,
            base,
            as_dict=True,
        )
        return _finish_split(rows, unit="")

    label_field = {
        "cost_center": "IFNULL(NULLIF(gl.cost_center, ''), 'Unallocated')",
        "account": "gl.account",
    }[mode]

    rows = frappe.db.sql(
        """
        SELECT {label_field} AS label,
               SUM(gl.debit - gl.credit) AS amount
        FROM `tabGL Entry` gl
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.account IN %(accounts)s
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY label
        ORDER BY amount DESC
        """.format(label_field=label_field),
        base,
        as_dict=True,
    )
    for r in rows:
        if r.get("label") == "Unallocated":
            r["warn"] = 1

    return _finish_split(rows, unit="")


# ---------------------------------------------------------------- order book

@frappe.whitelist()
def get_order_book(company, from_date, to_date):
    """Submitted sales orders in the period, closed shown separately."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    rows = frappe.db.sql(
        """
        SELECT so.status,
               COUNT(so.name) AS orders,
               SUM(so.base_grand_total) AS order_value,
               SUM(LEAST(
                   so.base_grand_total * IFNULL(so.per_billed, 0) / 100,
                   so.base_grand_total
               )) AS billed_value
        FROM `tabSales Order` so
        WHERE so.company = %(company)s
          AND so.docstatus = 1
          AND so.transaction_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY so.status
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
        as_dict=True,
    )

    open_orders = open_value = open_billed = 0.0
    closed_orders = closed_value = closed_billed = 0.0
    for r in rows:
        if r.status == "Closed":
            closed_orders += flt(r.orders)
            closed_value += flt(r.order_value)
            closed_billed += flt(r.billed_value)
        else:
            open_orders += flt(r.orders)
            open_value += flt(r.order_value)
            open_billed += flt(r.billed_value)

    monthly = frappe.db.sql(
        """
        SELECT DATE_FORMAT(so.transaction_date, '%%Y-%%m') AS mkey,
               COUNT(so.name) AS orders,
               SUM(CASE WHEN so.status = 'Closed'
                        THEN LEAST(so.base_grand_total * IFNULL(so.per_billed, 0) / 100,
                                   so.base_grand_total)
                        ELSE so.base_grand_total END) AS value
        FROM `tabSales Order` so
        WHERE so.company = %(company)s
          AND so.docstatus = 1
          AND so.transaction_date BETWEEN %(from_date)s AND %(to_date)s
        GROUP BY mkey
        ORDER BY mkey
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
        as_dict=True,
    )

    months = _month_keys(from_date, to_date)
    by_key = {}
    for m in monthly:
        by_key[m.mkey] = m

    series = []
    for m in months:
        hit = by_key.get(m["key"])
        series.append({
            "label": m["label"],
            "orders": int(hit.orders) if hit else 0,
            "value": flt(hit.value) if hit else 0.0,
        })

    # A closed order counts at what was billed, because nothing further will
    # ever be invoiced against it. Its unbilled balance is dead and is left
    # out of "not yet invoiced" on purpose.
    book_value = open_value + closed_billed
    book_billed = open_billed + closed_billed

    return {
        "currency": _company_meta(company)["currency"],
        "monthly": series,
        "book": {
            "orders": int(open_orders + closed_orders),
            "open_orders": int(open_orders),
            "closed_orders": int(closed_orders),
            "value": book_value,
            "billed": book_billed,
            "unbilled": open_value - open_billed,
            "pct_billed": (book_billed / book_value * 100.0) if book_value else 0.0,
            "average_open": (open_value / open_orders) if open_orders else 0.0,
            "closed_billed": closed_billed,
            "closed_dead": closed_value - closed_billed,
        },
        "open": {
            "orders": int(open_orders),
            "value": open_value,
            "billed": open_billed,
            "unbilled": open_value - open_billed,
            "pct_billed": (open_billed / open_value * 100.0) if open_value else 0.0,
            "average": (open_value / open_orders) if open_orders else 0.0,
        },
        "closed": {
            "orders": int(closed_orders),
            "value": closed_value,
            "billed": closed_billed,
            "unbilled": closed_value - closed_billed,
        },
    }


@frappe.whitelist()
def get_income_bridge(company, from_date, to_date):
    """Reconcile order-linked billing to total income.

    Answers the obvious question: why is the order book billed figure
    lower than income? Because some invoices are raised with no sales
    order behind them, and a little income is posted by journal entry.
    The three lines always add up to the income shown on the page.
    """
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    total_income = flt(frappe.db.sql(
        """
        SELECT SUM(gl.credit - gl.debit)
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND IFNULL(gl.is_opening, 'No') = 'No'
          AND gl.voucher_type != 'Period Closing Voucher'
          AND a.root_type = 'Income'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
    )[0][0] or 0)

    non_invoice = flt(frappe.db.sql(
        """
        SELECT SUM(gl.credit - gl.debit)
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type != 'Sales Invoice'
          AND a.root_type = 'Income'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
    )[0][0] or 0)

    non_invoice_count = frappe.db.sql(
        """
        SELECT COUNT(DISTINCT gl.voucher_no)
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type != 'Sales Invoice'
          AND a.root_type = 'Income'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
    )[0][0] or 0

    no_order = frappe.db.sql(
        """
        SELECT COUNT(DISTINCT gl.voucher_no) AS cnt,
               SUM(gl.credit - gl.debit) AS amount
        FROM `tabGL Entry` gl
        INNER JOIN `tabAccount` a ON a.name = gl.account
        INNER JOIN `tabSales Invoice` si ON si.name = gl.voucher_no
        WHERE gl.company = %(company)s AND gl.is_cancelled = 0
          AND gl.voucher_type = 'Sales Invoice'
          AND a.root_type = 'Income'
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
          AND NOT EXISTS (
              SELECT 1 FROM `tabSales Invoice Item` sii
              WHERE sii.parent = si.name
                AND IFNULL(sii.sales_order, '') != ''
          )
        """,
        {"company": company, "from_date": from_date, "to_date": to_date},
        as_dict=True,
    )
    no_order_amount = flt(no_order[0].amount) if no_order else 0.0
    no_order_count = (no_order[0].cnt or 0) if no_order else 0

    with_order = total_income - non_invoice - no_order_amount

    return {
        "currency": _company_meta(company)["currency"],
        "with_order": with_order,
        "no_order": no_order_amount,
        "no_order_count": no_order_count,
        "non_invoice": non_invoice,
        "non_invoice_count": non_invoice_count,
        "total_income": total_income,
    }


@frappe.whitelist()
def get_no_order_invoices(company, from_date, to_date, limit=200):
    """Sales invoices raised without any sales order, for the drill list."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)
    limit = min(int(limit or 200), 500)

    return frappe.db.sql(
        """
        SELECT si.name AS invoice,
               si.posting_date,
               si.customer,
               IFNULL(si.project, '') AS project,
               si.base_net_total AS amount,
               si.is_return,
               si.owner
        FROM `tabSales Invoice` si
        WHERE si.company = %(company)s
          AND si.docstatus = 1
          AND si.posting_date BETWEEN %(from_date)s AND %(to_date)s
          AND NOT EXISTS (
              SELECT 1 FROM `tabSales Invoice Item` sii
              WHERE sii.parent = si.name
                AND IFNULL(sii.sales_order, '') != ''
          )
        ORDER BY si.base_net_total DESC
        LIMIT %(limit)s
        """,
        {
            "company": company,
            "from_date": from_date,
            "to_date": to_date,
            "limit": limit,
        },
        as_dict=True,
    )


@frappe.whitelist()
def get_gl_entries(company, from_date, to_date, account, limit=100):
    """Underlying GL entries for one account, for the drill-through list."""
    _check_permission()
    company = _validate_company(company)
    from_date, to_date = _validate_dates(from_date, to_date)

    if not account or not frappe.db.exists("Account", account):
        frappe.throw(_("Account not found"))

    limit = min(int(limit or 100), 500)

    return frappe.db.sql(
        """
        SELECT gl.posting_date, gl.voucher_type, gl.voucher_no,
               gl.against, gl.cost_center, gl.project,
               gl.debit, gl.credit, gl.remarks
        FROM `tabGL Entry` gl
        WHERE gl.company = %(company)s
          AND gl.is_cancelled = 0
          AND gl.account = %(account)s
          AND gl.posting_date BETWEEN %(from_date)s AND %(to_date)s
        ORDER BY gl.posting_date DESC, gl.creation DESC
        LIMIT %(limit)s
        """,
        {
            "company": company,
            "from_date": from_date,
            "to_date": to_date,
            "account": account,
            "limit": limit,
        },
        as_dict=True,
    )
