import frappe
from frappe.utils import today, add_days


@frappe.whitelist()
def get_dashboard_data(project=None):
    project = (project or "").strip()
    is_all = project == "__ALL__" or project == ""

    filters = {}
    if not is_all:
        filters["project"] = project

    rows = frappe.get_all(
        "Logistics Request",
        filters=filters,
        fields=[
            "name", "shipment_reference", "project", "project_manager",
            "status", "urgency", "shipping_mode", "request_date",
            "loading_place", "delivery_place",
            "tracking_number", "tracking_type", "agent",
            "driver_name", "driver_phone",
            "dispatch_date", "expected_delivery_date", "delivered_on",
            "selected_supplier", "approved_amount",
            "po_number", "rate_approved_by", "rate_approved_on",
            "signed_do_attachment",
        ],
        order_by="modified desc",
        limit_page_length=2000,
    )

    seven_days_ago = add_days(today(), -7)

    by_status = {}
    by_project = {}
    by_mode = {}
    awaiting_gm = []
    in_transit = []
    on_hold = []
    delivered_week = []

    active_statuses = {"Planned", "Quotes Received", "Awaiting GM Approval", "Rate Approved",
                       "PO Issued", "Dispatched", "In Transit", "Customs Clearance",
                       "Pending Documents", "On Hold"}

    for r in rows:
        s = r.get("status") or "Planned"
        by_status[s] = by_status.get(s, 0) + 1

        if s in active_statuses:
            p = r.get("project") or "(no project)"
            by_project[p] = by_project.get(p, 0) + 1
            m = r.get("shipping_mode") or "(none)"
            by_mode[m] = by_mode.get(m, 0) + 1

        if s == "Awaiting GM Approval":
            awaiting_gm.append(r)
        if s in ("In Transit", "Dispatched", "Customs Clearance"):
            in_transit.append(r)
        if s == "On Hold":
            on_hold.append(r)
        if s == "Delivered" and r.get("delivered_on") and str(r["delivered_on"]) >= str(seven_days_ago):
            delivered_week.append(r)

    def to_list(d):
        return [{"label": k, "value": v} for k, v in sorted(d.items(), key=lambda x: -x[1])]

    project_meta = {}
    if not is_all and project:
        try:
            p = frappe.get_doc("Project", project)
            project_meta = {
                "name": p.name,
                "project_name": p.project_name or "",
                "status": p.status or "",
            }
        except Exception:
            project_meta = {"name": project}

    active_count = sum(by_status.get(s, 0) for s in active_statuses)

    return {
        "scope": "all" if is_all else "project",
        "project_meta": project_meta,
        "kpis": {
            "active": active_count,
            "awaiting_gm": len(awaiting_gm),
            "in_transit": len(in_transit),
            "on_hold": len(on_hold),
            "delivered_week": len(delivered_week),
        },
        "by_status": to_list(by_status),
        "by_project": to_list(by_project),
        "by_mode": to_list(by_mode),
        "awaiting_gm": awaiting_gm[:20],
        "in_transit": in_transit[:50],
        "on_hold": on_hold[:20],
        "delivered_week": delivered_week[:30],
    }
