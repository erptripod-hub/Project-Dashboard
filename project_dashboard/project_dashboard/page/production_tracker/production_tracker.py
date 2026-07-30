import frappe
from frappe.utils import today, add_days, flt, getdate


# Statuses that count as "active" production (updated for new statuses)
ACTIVE_STATUSES = {
    "Drawing Pending",
    "Awaiting Kickoff",
    "MR Raised",
    "Awaiting Material",
    "In Production",
    "In QC",
    "Ready to Dispatch",
}

CLOSED_STATUSES = {
    "Dispatched",
    "Installed",
    "Closed",
}


@frappe.whitelist()
def get_dashboard_data(project=None):
    """
    Main endpoint for the Production Tracker page.
    - project = "__ALL__" or empty → aggregate view across all Production Plans
    - project = "<Project ID>" → drill-in view for that specific project's plan
    """
    project = (project or "").strip()
    is_all = project == "__ALL__" or project == ""

    if is_all:
        return _get_all_projects_view()
    else:
        return _get_project_drill_in(project)


# ---------------------------------------------------------------------------
# Aggregate view - all open Production Plans
# ---------------------------------------------------------------------------
def _get_all_projects_view():
    plans = frappe.get_all(
        "Project Production Plan",
        fields=[
            "name", "project", "company", "overall_status",
            "overall_joinery_completion_pct",
            "material_available_pct", "material_po_pct", "material_mr_pct",
            "production_manager", "project_manager",
            "kickoff_date", "target_dispatch_date", "revised_dispatch_date",
            "actual_dispatch_date", "actual_completion_date",
            "production_start_date", "production_end_date",
            "installation_start_date", "installation_end_date",
            "days_elapsed", "days_remaining", "total_duration_days",
            "modified",
        ],
        order_by="modified desc",
        limit_page_length=2000,
    )

    by_status = {}
    active_plans = []
    closed_plans = []
    total_pct = 0
    pct_count = 0
    total_material_pct = 0
    material_count = 0
    below_60_material = 0

    for p in plans:
        s = p.get("overall_status") or "Drawing Pending"
        by_status[s] = by_status.get(s, 0) + 1

        if s in CLOSED_STATUSES:
            closed_plans.append(p)
        else:
            active_plans.append(p)
            pct = flt(p.get("overall_joinery_completion_pct") or 0)
            total_pct += pct
            pct_count += 1

            mat_pct = flt(p.get("material_available_pct") or 0)
            total_material_pct += mat_pct
            material_count += 1
            if mat_pct < 60:
                below_60_material += 1

    avg_pct = round(total_pct / pct_count, 1) if pct_count else 0
    avg_material = round(total_material_pct / material_count, 1) if material_count else 0

    # Cross-project alerts
    plan_names = [p["name"] for p in plans if p["overall_status"] not in CLOSED_STATUSES]

    drawing_changes_recent = []
    recent_updates = []

    if plan_names:
        names_tuple = tuple(plan_names) if len(plan_names) > 1 else (plan_names[0], plan_names[0])
        plan_to_project = {p["name"]: p["project"] for p in plans}

        # Recent drawing changes (last 14 days)
        cutoff_14 = add_days(today(), -14)
        dchg_rows = frappe.db.sql(
            """
            SELECT parent, change_date, item_changed, what_changed,
                   revised_completion_date, pm_notified
            FROM `tabProject Production Plan Drawing Change`
            WHERE parent IN %(names)s
              AND change_date >= %(cutoff)s
            ORDER BY change_date DESC
            LIMIT 20
            """,
            {"names": names_tuple, "cutoff": cutoff_14},
            as_dict=True,
        )
        for dr in dchg_rows:
            dr["project"] = plan_to_project.get(dr["parent"], "")
            drawing_changes_recent.append(dr)

        # Recent daily updates (last 7 days)
        cutoff_7 = add_days(today(), -7)
        upd_rows = frappe.db.sql(
            """
            SELECT parent, update_date, update_type, update_text, updated_by
            FROM `tabProject Production Plan Daily Update`
            WHERE parent IN %(names)s
              AND update_date >= %(cutoff)s
            ORDER BY update_date DESC, creation DESC
            LIMIT 25
            """,
            {"names": names_tuple, "cutoff": cutoff_7},
            as_dict=True,
        )
        for ur in upd_rows:
            ur["project"] = plan_to_project.get(ur["parent"], "")
            recent_updates.append(ur)

    # Sort active plans by completion % (highest first)
    active_plans.sort(
        key=lambda p: flt(p.get("overall_joinery_completion_pct") or 0), reverse=True
    )

    return {
        "scope": "all",
        "kpis": {
            "open_plans": len(active_plans),
            "drawing_pending": by_status.get("Drawing Pending", 0),
            "awaiting_material": by_status.get("Awaiting Material", 0),
            "in_production": by_status.get("In Production", 0),
            "in_qc": by_status.get("In QC", 0),
            "ready_dispatch": by_status.get("Ready to Dispatch", 0),
            "material_below_60": below_60_material,
            "avg_completion": avg_pct,
            "avg_material": avg_material,
            "closed_count": len(closed_plans),
        },
        "by_status": [{"label": k, "value": v} for k, v in sorted(by_status.items(), key=lambda x: -x[1])],
        "active_plans": active_plans[:50],
        "drawing_changes_recent": drawing_changes_recent,
        "recent_updates": recent_updates,
    }


# ---------------------------------------------------------------------------
# Per-project drill-in
# ---------------------------------------------------------------------------
def _get_project_drill_in(project):
    plan_name = frappe.db.get_value(
        "Project Production Plan", {"project": project}, "name"
    )

    if not plan_name:
        project_meta = {}
        try:
            p = frappe.get_doc("Project", project)
            project_meta = {
                "name": p.name,
                "project_name": p.project_name or "",
                "status": p.status or "",
            }
        except Exception:
            project_meta = {"name": project}
        return {
            "scope": "project",
            "project_meta": project_meta,
            "plan_exists": False,
        }

    plan = frappe.get_doc("Project Production Plan", plan_name)

    project_meta = {"name": project, "project_name": "", "status": "", "company": ""}
    try:
        p = frappe.get_doc("Project", project)
        project_meta["project_name"] = p.project_name or ""
        project_meta["status"] = p.status or ""
        project_meta["company"] = p.company or ""
    except Exception:
        pass

    # Header
    header = {
        "plan_name": plan.name,
        "overall_status": plan.overall_status,
        "overall_joinery_completion_pct": flt(plan.overall_joinery_completion_pct or 0),
        "production_manager": plan.production_manager,
        "project_manager": plan.project_manager,
        "designer": plan.designer,
        "qc_lead": plan.qc_lead,
        "kickoff_date": plan.kickoff_date,
        "target_dispatch_date": plan.target_dispatch_date,
        "revised_dispatch_date": plan.revised_dispatch_date,
        "actual_dispatch_date": plan.actual_dispatch_date,
        "actual_completion_date": plan.actual_completion_date,
        "production_start_date": plan.production_start_date,
        "production_end_date": plan.production_end_date,
        "installation_start_date": plan.installation_start_date,
        "installation_end_date": plan.installation_end_date,
        "days_elapsed": plan.days_elapsed,
        "days_remaining": plan.days_remaining,
        "total_duration_days": plan.total_duration_days,
    }

    # Material bar
    material = {
        "available_pct": flt(plan.material_available_pct or 0),
        "po_pct": flt(plan.material_po_pct or 0),
        "mr_pct": flt(plan.material_mr_pct or 0),
        "summary_text": plan.material_summary_text or "",
    }

    # Stages
    stages = []
    for s in (plan.production_stages or []):
        stages.append({
            "stage_order": s.stage_order,
            "stage_name": s.stage_name,
            "department": s.department,
            "completion_percentage": flt(s.completion_percentage or 0),
            "notes": s.notes,
        })
    stages.sort(key=lambda x: (x.get("stage_order") or 999))

    # Recent daily updates (last 30 days)
    cutoff = add_days(today(), -30)
    daily_updates = []
    for u in (plan.daily_updates or []):
        if u.update_date and str(u.update_date) >= str(cutoff):
            daily_updates.append({
                "update_date": u.update_date,
                "update_type": u.update_type,
                "update_text": u.update_text,
                "updated_by": u.updated_by,
            })
    daily_updates.sort(key=lambda x: str(x["update_date"] or ""), reverse=True)
    daily_updates = daily_updates[:30]

    # Drawing change log
    drawing_changes = []
    for d in (plan.drawing_change_log or []):
        drawing_changes.append({
            "change_date": d.change_date,
            "item_changed": d.item_changed,
            "what_changed": d.what_changed,
            "revised_completion_date": d.revised_completion_date,
            "pm_notified": d.pm_notified,
        })
    drawing_changes.sort(key=lambda x: str(x["change_date"] or ""), reverse=True)

    # Linked docs
    linked = {
        "qc_inspection": plan.linked_qc_inspection or "",
        "logistics_request": plan.linked_logistics_request or "",
    }

    # Alerts derived from data
    alerts = []
    if plan.material_delay_flag:
        alerts.append({
            "type": "material",
            "title": "Material delay flag",
            "sub": plan.material_delay_flag,
        })

    pending_drawings = [
        d for d in (plan.drawing_log or [])
        if (d.get("status") or "").lower() == "pending"
    ]
    if pending_drawings:
        alerts.append({
            "type": "drawing",
            "title": f"{len(pending_drawings)} drawings pending approval",
            "sub": ", ".join([d.get("drawing_code") or "?" for d in pending_drawings[:5]]),
        })

    if flt(plan.material_available_pct or 0) < 60:
        alerts.append({
            "type": "material",
            "title": f"Only {plan.material_available_pct}% material available",
            "sub": plan.material_summary_text or "",
        })

    return {
        "scope": "project",
        "project_meta": project_meta,
        "plan_exists": True,
        "header": header,
        "material": material,
        "linked": linked,
        "stages": stages,
        "daily_updates": daily_updates,
        "drawing_changes": drawing_changes,
        "alerts": alerts,
    }
