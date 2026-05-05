import frappe
from frappe.utils import today, add_days, flt, get_first_day


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
            "shipment_type", "direction",
            "loading_place", "delivery_place",
            "tracking_number", "tracking_type", "agent",
            "shipment_qty",
            "driver_name", "driver_phone",
            "dispatch_date", "expected_delivery_date", "delivered_on",
            "selected_supplier", "approved_amount",
            "purchase_order", "purchase_invoice",
            "invoice_outstanding", "total_paid_amount", "payment_status",
            "rate_approved_by", "rate_approved_on",
            "signed_do_attachment",
        ],
        order_by="modified desc",
        limit_page_length=2000,
    )

    seven_days_ago = add_days(today(), -7)
    month_start = get_first_day(today())

    by_status = {}
    by_project = {}
    by_mode = {}
    by_type = {}
    by_direction = {}
    awaiting_gm = []
    pending_po = []
    pending_invoice = []
    outstanding_invoices = []
    in_transit = []
    on_hold = []
    delivered_week = []

    active_statuses = {"Planned", "Quotes Received", "Awaiting GM Approval", "Rate Approved",
                       "PO Issued", "Dispatched", "In Transit", "Customs Clearance",
                       "Pending Documents", "On Hold"}
    closed_statuses = {"Delivered", "Received", "Cancelled"}

    committed_value = 0.0
    paid_this_month_total = 0.0
    outstanding_total = 0.0

    for r in rows:
        s = r.get("status") or "Planned"
        by_status[s] = by_status.get(s, 0) + 1

        if s in active_statuses:
            p = r.get("project") or "(no project)"
            by_project[p] = by_project.get(p, 0) + 1
            m = r.get("shipping_mode") or "(none)"
            by_mode[m] = by_mode.get(m, 0) + 1
            t = r.get("shipment_type") or "(unset)"
            by_type[t] = by_type.get(t, 0) + 1
            d = r.get("direction") or "(unset)"
            by_direction[d] = by_direction.get(d, 0) + 1

        if s == "Awaiting GM Approval":
            awaiting_gm.append(r)
        if s == "Rate Approved" and not r.get("purchase_order") and r.get("shipment_type") == "Company Shipment":
            pending_po.append(r)
        if r.get("purchase_order") and not r.get("purchase_invoice"):
            pending_invoice.append(r)
        if r.get("purchase_invoice") and (flt(r.get("invoice_outstanding")) > 0):
            outstanding_invoices.append(r)
            outstanding_total += flt(r.get("invoice_outstanding"))

        if s in ("In Transit", "Dispatched", "Customs Clearance"):
            in_transit.append(r)
        if s == "On Hold":
            on_hold.append(r)
        if s in ("Delivered", "Received") and r.get("delivered_on") and str(r["delivered_on"]) >= str(seven_days_ago):
            delivered_week.append(r)

        if r.get("shipment_type") == "Company Shipment" and r.get("approved_amount") and s not in closed_statuses:
            committed_value += flt(r.get("approved_amount"))

    # Paid this month — sum total_paid_amount for requests whose payment was made this month
    # Approximate: requests where total_paid > 0 and rate_approved_on or modified is this month
    for r in rows:
        if flt(r.get("total_paid_amount")) > 0 and str(r.get("rate_approved_on") or "")[:10] >= str(month_start):
            paid_this_month_total += flt(r.get("total_paid_amount"))

    def to_list(d):
        return [{"label": k, "value": v} for k, v in sorted(d.items(), key=lambda x: -x[1])]

    project_meta = {}
    if not is_all and project:
        try:
            p = frappe.get_doc("Project", project)
            project_meta = {"name": p.name, "project_name": p.project_name or "", "status": p.status or ""}
        except Exception:
            project_meta = {"name": project}

    active_count = sum(by_status.get(s, 0) for s in active_statuses)

    return {
        "scope": "all" if is_all else "project",
        "project_meta": project_meta,
        "kpis": {
            "active": active_count,
            "awaiting_gm": len(awaiting_gm),
            "pending_po": len(pending_po),
            "pending_invoice": len(pending_invoice),
            "outstanding_total": outstanding_total,
            "outstanding_count": len(outstanding_invoices),
            "committed_value": committed_value,
            "paid_this_month": paid_this_month_total,
            "in_transit": len(in_transit),
            "on_hold": len(on_hold),
            "delivered_week": len(delivered_week),
        },
        "by_status": to_list(by_status),
        "by_project": to_list(by_project),
        "by_type": to_list(by_type),
        "by_direction": to_list(by_direction),
        "awaiting_gm": awaiting_gm[:20],
        "pending_po": pending_po[:20],
        "pending_invoice": pending_invoice[:20],
        "outstanding_invoices": outstanding_invoices[:30],
        "in_transit": in_transit[:50],
        "on_hold": on_hold[:20],
        "delivered_week": delivered_week[:30],
    }
