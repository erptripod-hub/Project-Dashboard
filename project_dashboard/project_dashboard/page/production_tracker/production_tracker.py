import frappe
from frappe.utils import today, add_days, flt, getdate


# Statuses that count as "active" production
ACTIVE_STATUSES = {
    "Drawing Pending",
    "Awaiting Kickoff",
    "In Production",
    "In QC",
    "Ready to Dispatch",
}

# Statuses that count as "closed" - don't show in active counts
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
    """Returns KPIs + active project list + cross-project alerts."""

    # Fetch all Production Plans with their headline fields
    plans = frappe.get_all(
        "Project Production Plan",
        fields=[
            "name", "project", "overall_status",
            "overall_joinery_completion_pct",
            "production_manager", "project_manager",
            "kickoff_date", "target_dispatch_date", "revised_dispatch_date",
            "actual_dispatch_date", "actual_completion_date",
            "modified",
        ],
        order_by="modified desc",
        limit_page_length=2000,
    )

    # Count by status
    by_status = {}
    active_plans = []
    closed_plans = []
    total_pct = 0
    pct_count = 0

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

    avg_pct = round(total_pct / pct_count, 1) if pct_count else 0

    # Cross-project alerts - need to scan child tables
    plan_names = [p["name"] for p in plans if p["overall_status"] not in CLOSED_STATUSES]

    blockers_count = 0
    rework_count = 0
    inspections_due_count = 0
    inspections_due_list = []
    drawing_changes_recent = []
    recent_updates = []

    if plan_names:
        names_tuple = tuple(plan_names) if len(plan_names) > 1 else (plan_names[0], plan_names[0])

        # Material blockers + rework flags from fixtures
        blocker_rows = frappe.db.sql(
            """
            SELECT parent, fixture_name, material_status, rework_required
            FROM `tabProject Production Plan Fixture`
            WHERE parent IN %(names)s
              AND (material_status = 'Blocked' OR rework_required = 1)
            """,
            {"names": names_tuple},
            as_dict=True,
        )
        for row in blocker_rows:
            if row.material_status == "Blocked":
                blockers_count += 1
            if row.rework_required:
                rework_count += 1

        # Inspections due - pending/scheduled with date <= today + 7
        next_week = add_days(today(), 7)
        insp_rows = frappe.db.sql(
            """
            SELECT parent, inspection_type, scheduled_date, result, inspector
            FROM `tabProject Production Plan Inspection`
            WHERE parent IN %(names)s
              AND (result IS NULL OR result IN ('Pending', 'Scheduled'))
              AND scheduled_date IS NOT NULL
              AND scheduled_date <= %(cutoff)s
            ORDER BY scheduled_date ASC
            """,
            {"names": names_tuple, "cutoff": next_week},
            as_dict=True,
        )
        inspections_due_count = len(insp_rows)
        # Map parent → project for display
        plan_to_project = {p["name"]: p["project"] for p in plans}
        for ir in insp_rows[:20]:
            ir["project"] = plan_to_project.get(ir["parent"], "")
            inspections_due_list.append(ir)

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
            SELECT parent, update_date, update_type, update_text,
                   affected_fixtures, updated_by
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

    # Sort active plans by overall % (highest first - closest to completion)
    active_plans.sort(
        key=lambda p: flt(p.get("overall_joinery_completion_pct") or 0), reverse=True
    )

    return {
        "scope": "all",
        "kpis": {
            "open_plans": len(active_plans),
            "drawing_pending": by_status.get("Drawing Pending", 0),
            "in_production": by_status.get("In Production", 0),
            "in_qc": by_status.get("In QC", 0),
            "ready_dispatch": by_status.get("Ready to Dispatch", 0),
            "blocked": blockers_count,
            "rework": rework_count,
            "inspections_due": inspections_due_count,
            "avg_completion": avg_pct,
            "closed_count": len(closed_plans),
        },
        "by_status": [{"label": k, "value": v} for k, v in sorted(by_status.items(), key=lambda x: -x[1])],
        "active_plans": active_plans[:50],
        "inspections_due": inspections_due_list,
        "drawing_changes_recent": drawing_changes_recent,
        "recent_updates": recent_updates,
    }


# ---------------------------------------------------------------------------
# Per-project drill-in
# ---------------------------------------------------------------------------
def _get_project_drill_in(project):
    """Return everything for a single project's Production Plan."""

    # Find the plan linked to this project
    plan_name = frappe.db.get_value(
        "Project Production Plan", {"project": project}, "name"
    )

    if not plan_name:
        # Project exists but no plan - return minimal payload so UI shows the message
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

    # Project meta
    project_meta = {"name": project, "project_name": "", "status": ""}
    try:
        p = frappe.get_doc("Project", project)
        project_meta["project_name"] = p.project_name or ""
        project_meta["status"] = p.status or ""
    except Exception:
        pass

    # Header data
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
    }

    # Stages with %s
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

    # Fixtures
    fixtures = []
    for f in (plan.fixtures or []):
        fixtures.append({
            "fixture_name": f.fixture_name,
            "quantity_required": f.quantity_required,
            "quantity_completed": f.quantity_completed,
            "current_stage": f.current_stage,
            "material_status": f.material_status,
            "drawing_revision": f.drawing_revision,
            "rework_required": f.rework_required,
            "notes": f.notes,
        })

    # Inspections - all 4 (or however many exist)
    inspections = []
    for i in (plan.inspections or []):
        inspections.append({
            "inspection_type": i.inspection_type,
            "scheduled_date": i.scheduled_date,
            "actual_date": i.actual_date,
            "inspector": i.inspector,
            "pm_signoff": i.pm_signoff,
            "qc_signoff": i.qc_signoff,
            "client_signoff": i.client_signoff,
            "result": i.result,
            "notes": i.notes,
        })

    # Recent daily updates (last 30 days, max 30)
    cutoff = add_days(today(), -30)
    daily_updates = []
    for u in (plan.daily_updates or []):
        if u.update_date and str(u.update_date) >= str(cutoff):
            daily_updates.append({
                "update_date": u.update_date,
                "update_type": u.update_type,
                "update_text": u.update_text,
                "affected_fixtures": u.affected_fixtures,
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

    # Alerts derived from data
    alerts = []
    for f in fixtures:
        if f["material_status"] == "Blocked":
            alerts.append({
                "type": "material",
                "title": "Material blocked: " + (f["fixture_name"] or ""),
                "sub": "Status: " + str(f["material_status"]),
            })
        if f["rework_required"]:
            alerts.append({
                "type": "rework",
                "title": "Rework required: " + (f["fixture_name"] or ""),
                "sub": f["notes"] or "Check drawing revision",
            })
    for i in inspections:
        if i["result"] in (None, "", "Pending", "Scheduled") and i["scheduled_date"]:
            sd = getdate(i["scheduled_date"])
            if sd < getdate(today()):
                alerts.append({
                    "type": "inspection_overdue",
                    "title": "Inspection overdue: " + (i["inspection_type"] or ""),
                    "sub": "Was scheduled for " + str(sd),
                })

    return {
        "scope": "project",
        "project_meta": project_meta,
        "plan_exists": True,
        "header": header,
        "stages": stages,
        "fixtures": fixtures,
        "inspections": inspections,
        "daily_updates": daily_updates,
        "drawing_changes": drawing_changes,
        "alerts": alerts,
    }
