"""Server-side data loader for the Daily Status Board."""
import frappe
from frappe.utils import today, add_days


HIDDEN_AFTER_DELIVERED_DAYS = 7


@frappe.whitelist()
def get_board_data(show_closed=0):
    show_closed = int(show_closed or 0)
    cutoff = add_days(today(), -HIDDEN_AFTER_DELIVERED_DAYS)

    rows = frappe.get_all(
        "Logistics Request",
        fields=[
            "name", "shipment_reference", "project", "project_manager",
            "status", "urgency", "shipping_mode",
            "shipment_type", "direction",
            "loading_place", "delivery_place",
            "tracking_number", "tracking_type", "shipment_qty",
            "expected_delivery_date", "delivered_on",
            "selected_supplier", "approved_amount",
            "purchase_order", "purchase_invoice", "payment_status",
        ],
        order_by="project asc, modified desc",
        limit_page_length=2000,
    )

    visible = []
    for r in rows:
        s = r.get("status") or ""
        if s in ("Delivered", "Received") and not show_closed and r.get("delivered_on") and str(r["delivered_on"]) < cutoff:
            continue
        if s == "Cancelled" and not show_closed:
            continue
        visible.append(r)

    grouped = {}
    for r in visible:
        proj = r.get("project") or "(no project)"
        grouped.setdefault(proj, []).append(r)

    project_metas = {}
    for proj_name in grouped:
        if proj_name == "(no project)":
            project_metas[proj_name] = {"name": "(no project)", "project_name": "Shipments without a project"}
            continue
        try:
            p = frappe.get_doc("Project", proj_name)
            project_metas[proj_name] = {"name": p.name, "project_name": p.project_name or "", "status": p.status or ""}
        except Exception:
            project_metas[proj_name] = {"name": proj_name, "project_name": ""}

    STATUS_ORDER = [
        "Awaiting GM Approval", "On Hold", "Pending Documents",
        "Customs Clearance", "Quotes Received", "Planned",
        "Rate Approved", "PO Issued",
        "Dispatched", "In Transit",
        "Rate Rejected", "Delivered", "Received", "Cancelled",
    ]

    def status_rank(s):
        try:
            return STATUS_ORDER.index(s or "Planned")
        except ValueError:
            return 99

    response = []
    for proj_name in sorted(grouped.keys(), key=lambda x: (x == "(no project)", x)):
        rows_in_proj = sorted(grouped[proj_name], key=lambda r: (status_rank(r.get("status")), r.get("name")))
        status_groups = []
        last_status = None
        current = None
        for r in rows_in_proj:
            s = r.get("status") or "Planned"
            if s != last_status:
                current = {"status": s, "rows": []}
                status_groups.append(current)
                last_status = s
            current["rows"].append(r)
        response.append({
            "project": project_metas[proj_name],
            "status_groups": status_groups,
            "total_rows": len(rows_in_proj),
        })

    return {
        "projects": response,
        "status_options": [
            "Planned", "Quotes Received", "Awaiting GM Approval",
            "Rate Approved", "Rate Rejected", "PO Issued",
            "Dispatched", "In Transit", "Customs Clearance",
            "Pending Documents", "On Hold", "Delivered", "Received", "Cancelled",
        ],
        "total_visible": len(visible),
    }
