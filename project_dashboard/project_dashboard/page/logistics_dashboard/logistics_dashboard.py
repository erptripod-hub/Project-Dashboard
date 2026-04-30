"""Server-side data loader for the Logistics Tracker Dashboard.

Reads child rows from submitted Logistics Daily Log parents.
"""
import frappe
from frappe.utils import today, add_days


SENTINEL_ALL = "__ALL__"


@frappe.whitelist()
def get_dashboard_data(project=None):
    project = (project or "").strip()
    is_all = project == SENTINEL_ALL or project == ""

    # Pull all child rows from submitted parents in one query
    where = "p.docstatus = 1"
    params = {}
    if not is_all:
        where += " AND r.project = %(project)s"
        params["project"] = project

    rows = frappe.db.sql(
        f"""
        SELECT
            r.name AS row_name,
            r.parent AS daily_log,
            p.log_date AS log_date,
            p.logged_by AS logged_by,
            r.shipment_reference,
            r.project, r.project_manager,
            r.loading_place, r.delivery_place,
            r.shipping_mode, r.agent,
            r.current_status, r.eta,
            r.status_update, r.next_action
        FROM `tabLogistics Shipment Row` r
        INNER JOIN `tabLogistics Daily Log` p ON p.name = r.parent
        WHERE {where}
        ORDER BY p.log_date DESC, r.idx ASC
        """,
        params,
        as_dict=True,
    )

    # Latest row per shipment_reference (by log_date)
    seen = set()
    latest = []
    for row in rows:
        key = (row.get("shipment_reference") or "").strip().lower() or row.get("row_name")
        if key in seen:
            continue
        seen.add(key)
        latest.append(row)

    # ---------- KPIs ----------
    active = [r for r in latest if (r.get("current_status") or "") != "Delivered"]
    in_transit = [r for r in latest if (r.get("current_status") or "") == "In Transit"]
    pending = [r for r in latest if (r.get("current_status") or "") in ("On Hold", "Pending Documents")]
    delivered = [r for r in latest if (r.get("current_status") or "") == "Delivered"]

    seven_days_ago = add_days(today(), -7)
    rows_week = [r for r in rows if r.get("log_date") and str(r["log_date"]) >= str(seven_days_ago)]

    def group_count(items, key):
        out = {}
        for r in items:
            v = (r.get(key) or "").strip() or "(blank)"
            out[v] = out.get(v, 0) + 1
        return [{"label": k, "value": v} for k, v in sorted(out.items(), key=lambda x: -x[1])]

    by_status = group_count(latest, "current_status")
    by_mode = group_count(latest, "shipping_mode")
    by_pm = group_count(latest, "project_manager")

    # 14-day activity (rows logged per day)
    daily = {}
    cutoff = str(add_days(today(), -13))
    for r in rows:
        d = str(r.get("log_date") or "")
        if not d or d < cutoff:
            continue
        daily[d] = daily.get(d, 0) + 1
    daily_series = [{"label": k, "value": v} for k, v in sorted(daily.items())]

    project_meta = {}
    if not is_all and project:
        try:
            p = frappe.get_doc("Project", project)
            project_meta = {
                "name": p.name,
                "project_name": p.project_name or "",
                "status": p.status or "",
                "expected_start_date": str(p.expected_start_date or ""),
                "expected_end_date": str(p.expected_end_date or ""),
                "company": p.company or "",
            }
        except Exception:
            project_meta = {"name": project, "project_name": "", "status": "", "company": ""}

    return {
        "scope": "all" if is_all else "project",
        "project_meta": project_meta,
        "kpis": {
            "active": len(active),
            "in_transit": len(in_transit),
            "pending": len(pending),
            "delivered": len(delivered),
            "shipments_total": len(latest),
            "rows_week": len(rows_week),
            "rows_total": len(rows),
        },
        "by_status": by_status,
        "by_mode": by_mode,
        "by_pm": by_pm,
        "daily_series": daily_series,
        "latest_per_shipment": latest,
        "recent": rows[:15],
    }
