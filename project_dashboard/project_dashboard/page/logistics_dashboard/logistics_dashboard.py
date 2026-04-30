"""Server-side data loader for the Logistics Tracker Dashboard.

Reads Logistics Request docs and aggregates by workflow stage.
"""
import frappe
from frappe.utils import today, add_days, getdate, time_diff_in_hours


SENTINEL_ALL = "__ALL__"

STAGES = [
    "Draft", "Rates Submitted", "Rates Approved",
    "PO Issued", "Dispatched", "Delivered",
]
ACTIVE_STAGES = ["Draft", "Rates Submitted", "Rates Approved", "PO Issued", "Dispatched"]


@frappe.whitelist()
def get_dashboard_data(project=None):
    project = (project or "").strip()
    is_all = project == SENTINEL_ALL or project == ""

    filters = {}
    if not is_all:
        filters["project"] = project

    requests = frappe.get_all(
        "Logistics Request",
        filters=filters,
        fields=[
            "name", "shipment_reference", "project", "requested_by",
            "request_date", "urgency", "shipping_mode",
            "loading_place", "delivery_place",
            "workflow_state", "stage_started_on",
            "selected_supplier", "approved_amount",
            "po_number", "po_date",
            "tracking_type", "tracking_number", "agent",
            "driver_name", "driver_phone",
            "dispatch_date", "expected_delivery_date",
            "delivered_on", "signed_do_attachment",
            "rate_approved_by", "rate_approved_on",
        ],
        order_by="modified desc",
        limit_page_length=2000,
    )

    # ---------- Stage funnel + aging ----------
    by_stage = {s: 0 for s in STAGES}
    by_stage["Rejected"] = 0
    aging_alerts = []
    pending_rate_approval = []
    pending_po_approval = []
    active_tracking = []

    for r in requests:
        state = r.get("workflow_state") or "Draft"
        by_stage[state] = by_stage.get(state, 0) + 1

        # Aging: stuck >3 days at current stage (active only)
        if state in ACTIVE_STAGES and r.get("stage_started_on"):
            try:
                hours = time_diff_in_hours(frappe.utils.now_datetime(), r["stage_started_on"])
                days_at_stage = hours / 24.0
                if days_at_stage > 3:
                    aging_alerts.append({
                        "name": r["name"],
                        "shipment_reference": r.get("shipment_reference"),
                        "stage": state,
                        "days_at_stage": round(days_at_stage, 1),
                        "project": r.get("project"),
                        "urgency": r.get("urgency"),
                    })
            except Exception:
                pass

        # Pending approvals lists
        if state == "Rates Submitted":
            pending_rate_approval.append(r)
        if state == "Rates Approved" and not r.get("po_number"):
            pending_po_approval.append(r)

        # Active tracking (Dispatched + In Transit)
        if state in ("PO Issued", "Dispatched") and r.get("tracking_number"):
            active_tracking.append(r)

    aging_alerts.sort(key=lambda x: -x["days_at_stage"])

    # ---------- Group counts ----------
    def group_count(items, key):
        out = {}
        for r in items:
            v = (r.get(key) or "").strip() or "(blank)"
            out[v] = out.get(v, 0) + 1
        return [{"label": k, "value": v} for k, v in sorted(out.items(), key=lambda x: -x[1])]

    by_mode = group_count([r for r in requests if (r.get("workflow_state") or "") in ACTIVE_STAGES], "shipping_mode")
    by_urgency = group_count([r for r in requests if (r.get("workflow_state") or "") in ACTIVE_STAGES], "urgency")

    # ---------- Delivered this week ----------
    seven_days_ago = add_days(today(), -7)
    delivered_week = [
        r for r in requests
        if r.get("workflow_state") == "Delivered"
        and r.get("delivered_on")
        and str(r["delivered_on"]) >= str(seven_days_ago)
    ]

    # ---------- 14-day activity ----------
    cutoff = str(add_days(today(), -13))
    daily = {}
    for r in requests:
        d = str(r.get("request_date") or "")
        if not d or d < cutoff:
            continue
        daily[d] = daily.get(d, 0) + 1
    daily_series = [{"label": k, "value": v} for k, v in sorted(daily.items())]

    # ---------- Project meta ----------
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
            }
        except Exception:
            project_meta = {"name": project}

    active_total = sum(by_stage.get(s, 0) for s in ACTIVE_STAGES)

    return {
        "scope": "all" if is_all else "project",
        "project_meta": project_meta,
        "kpis": {
            "active_total": active_total,
            "delivered_week": len(delivered_week),
            "pending_rate_approval": len(pending_rate_approval),
            "pending_po_approval": len(pending_po_approval),
            "aging_count": len(aging_alerts),
        },
        "stage_funnel": [{"label": s, "value": by_stage.get(s, 0)} for s in STAGES],
        "by_mode": by_mode,
        "by_urgency": by_urgency,
        "aging_alerts": aging_alerts[:20],
        "pending_rate_approval": pending_rate_approval[:20],
        "pending_po_approval": pending_po_approval[:20],
        "active_tracking": active_tracking[:50],
        "delivered_week": delivered_week[:30],
        "daily_series": daily_series,
        "all_requests": requests[:100],
    }
