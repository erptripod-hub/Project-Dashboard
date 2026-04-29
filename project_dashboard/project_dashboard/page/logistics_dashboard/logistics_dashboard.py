"""Server-side data loader for the Logistics Tracker Dashboard page.

Returns a dict consumed by logistics_dashboard.js. Every key has a safe
default so the JS never sees undefined.
"""
import frappe
from frappe.utils import getdate, today, add_days


SENTINEL_ALL = "__ALL__"


@frappe.whitelist()
def get_dashboard_data(project=None):
    """Build the dashboard payload.

    Args:
        project: A Project name, or "__ALL__" to view every shipment.
    """
    project = (project or "").strip()
    is_all = project == SENTINEL_ALL or project == ""

    base_filters = {"docstatus": 1}
    if not is_all:
        base_filters["project"] = project

    # ---------- All submitted logs in scope ----------
    logs = frappe.get_all(
        "Logistics Tracker",
        filters=base_filters,
        fields=[
            "name", "log_date", "shipment_reference", "project", "proj_no",
            "project_manager", "loading_place", "delivery_place",
            "shipping_mode", "agent", "current_status", "eta",
            "status_update", "next_action", "creation", "owner",
        ],
        order_by="log_date desc, creation desc",
        limit_page_length=2000,
    )

    # ---------- Latest log per shipment_reference ----------
    seen = set()
    latest_per_shipment = []
    for row in logs:
        key = row.get("shipment_reference") or row.get("name")
        if key in seen:
            continue
        seen.add(key)
        latest_per_shipment.append(row)

    # ---------- KPI counts (based on latest-per-shipment) ----------
    active = [r for r in latest_per_shipment if (r.get("current_status") or "") != "Delivered"]
    in_transit = [r for r in latest_per_shipment if (r.get("current_status") or "") == "In Transit"]
    pending = [r for r in latest_per_shipment if (r.get("current_status") or "") in ("On Hold", "Pending Documents")]
    delivered = [r for r in latest_per_shipment if (r.get("current_status") or "") == "Delivered"]

    # logs in last 7 days (activity proxy)
    seven_days_ago = add_days(today(), -7)
    logs_week = [r for r in logs if r.get("log_date") and str(r["log_date"]) >= str(seven_days_ago)]

    # ---------- Group-bys ----------
    def group_count(rows, key):
        out = {}
        for r in rows:
            v = (r.get(key) or "").strip() or "(blank)"
            out[v] = out.get(v, 0) + 1
        return [{"label": k, "value": v} for k, v in sorted(out.items(), key=lambda x: -x[1])]

    by_status = group_count(latest_per_shipment, "current_status")
    by_mode = group_count(latest_per_shipment, "shipping_mode")
    by_pm = group_count(latest_per_shipment, "project_manager")
    by_agent = group_count(latest_per_shipment, "agent")

    # ---------- Daily activity (last 14 days) ----------
    daily = {}
    for r in logs:
        d = str(r.get("log_date") or "")
        if not d:
            continue
        if d < str(add_days(today(), -13)):
            continue
        daily[d] = daily.get(d, 0) + 1
    daily_series = [{"label": k, "value": v} for k, v in sorted(daily.items())]

    # ---------- Recent logs (top 15 by log_date) ----------
    recent = logs[:15]

    # ---------- Project meta (when a single project is selected) ----------
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
            "shipments_total": len(latest_per_shipment),
            "logs_week": len(logs_week),
            "logs_total": len(logs),
        },
        "by_status": by_status,
        "by_mode": by_mode,
        "by_pm": by_pm,
        "by_agent": by_agent,
        "daily_series": daily_series,
        "latest_per_shipment": latest_per_shipment,
        "recent": recent,
    }
