import frappe
from frappe.utils import today, add_days, flt, getdate, date_diff


# Statuses that count as "active" production
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

# Fixed anchor sections shown in every pipeline (in order)
# key = internal id, label = display, tag = short badge
FIXED_HEAD = [
    {"key": "samples", "label": "Samples", "tag": "SMPL"},
    {"key": "design", "label": "Design", "tag": "DSG"},
]
FIXED_TAIL = [
    {"key": "packing", "label": "Packing", "tag": "PACK"},
    {"key": "dispatch", "label": "Dispatch", "tag": "DSP"},
    {"key": "install", "label": "Install", "tag": "INST"},
]


@frappe.whitelist()
def get_dashboard_data(project=None, company=None):
    """
    Main endpoint.
    - project = "__ALL__"/empty → aggregate view (all plans)
    - project = "<Project ID>"  → drill-in for that plan
    - company = optional filter for aggregate view
    """
    project = (project or "").strip()
    company = (company or "").strip()
    is_all = project == "__ALL__" or project == ""

    if is_all:
        return _get_all_projects_view(company=company)
    else:
        return _get_project_drill_in(project)


# ---------------------------------------------------------------------------
# Aggregate view - all open Production Plans, each with full pipeline
# ---------------------------------------------------------------------------
def _get_all_projects_view(company=None):
    filters = {}
    if company:
        filters["company"] = company

    plans = frappe.get_all(
        "Project Production Plan",
        filters=filters,
        fields=[
            "name", "project", "company", "overall_status",
            "overall_joinery_completion_pct",
            "material_available_pct", "material_po_pct", "material_mr_pct",
            "material_summary_text",
            "production_manager", "project_manager",
            "kickoff_date", "target_dispatch_date", "revised_dispatch_date",
            "actual_dispatch_date", "actual_completion_date",
            "production_start_date", "production_end_date",
            "installation_start_date", "installation_end_date",
            "days_elapsed", "days_remaining", "total_duration_days",
            "material_delay_flag",
            "modified",
        ],
        order_by="modified desc",
        limit_page_length=2000,
    )

    # Company list for the filter tabs
    companies = frappe.get_all("Company", fields=["name", "abbr"], order_by="name")

    by_status = {}
    active_plans = []
    closed_count = 0
    overdue_count = 0
    material_below_60 = 0

    # Pre-load all stages, samples, drawings for the active plans in bulk
    active_names = []
    for p in plans:
        s = p.get("overall_status") or "Drawing Pending"
        by_status[s] = by_status.get(s, 0) + 1
        if s in CLOSED_STATUSES:
            closed_count += 1
        else:
            active_names.append(p["name"])

    stages_by_plan = _bulk_stages(active_names)
    samples_by_plan = _bulk_samples(active_names)
    drawings_by_plan = _bulk_drawings(active_names)

    for p in plans:
        s = p.get("overall_status") or "Drawing Pending"
        if s in CLOSED_STATUSES:
            continue

        # Build pipeline + flags
        pipeline = _build_pipeline(p, stages_by_plan.get(p["name"], []),
                                   samples_by_plan.get(p["name"], []),
                                   drawings_by_plan.get(p["name"], []))
        flags = _build_flags(p, drawings_by_plan.get(p["name"], []),
                             samples_by_plan.get(p["name"], []))

        mat_pct = flt(p.get("material_available_pct") or 0)
        if mat_pct < 60:
            material_below_60 += 1

        # Overdue check
        is_overdue = False
        end_date = p.get("revised_dispatch_date") or p.get("target_dispatch_date")
        if end_date and s not in CLOSED_STATUSES:
            try:
                if date_diff(today(), end_date) > 0:
                    is_overdue = True
                    overdue_count += 1
            except Exception:
                pass

        # Days-left display
        days_left = None
        days_left_label = ""
        if end_date:
            try:
                dl = date_diff(end_date, today())
                days_left = dl
                if dl < 0:
                    days_left_label = "overdue"
                elif p.get("total_duration_days"):
                    days_left_label = f"of {p['total_duration_days']} days"
                else:
                    days_left_label = "left"
            except Exception:
                pass

        # Health level for row border
        health = _row_health(p, flags, is_overdue, mat_pct, s)

        active_plans.append({
            "name": p["name"],
            "project": p["project"],
            "company": p["company"],
            "status": s,
            "joinery_pct": flt(p.get("overall_joinery_completion_pct") or 0),
            "material_available_pct": mat_pct,
            "material_po_pct": flt(p.get("material_po_pct") or 0),
            "material_mr_pct": flt(p.get("material_mr_pct") or 0),
            "production_manager": p.get("production_manager") or "",
            "kickoff_date": p.get("kickoff_date"),
            "target_dispatch_date": p.get("target_dispatch_date"),
            "revised_dispatch_date": p.get("revised_dispatch_date"),
            "days_left": days_left,
            "days_left_label": days_left_label,
            "is_overdue": is_overdue,
            "health": health,
            "pipeline": pipeline,
            "flags": flags,
        })

    # Sort: issues first (critical → warn → healthy → not-started), then by days_left asc
    health_rank = {"critical": 0, "warn": 1, "healthy": 2, "idle": 3}
    active_plans.sort(key=lambda x: (
        health_rank.get(x["health"], 9),
        x["days_left"] if x["days_left"] is not None else 9999,
    ))

    return {
        "scope": "all",
        "company_filter": company or "",
        "companies": companies,
        "kpis": {
            "open_plans": len(active_plans),
            "drawing_pending": by_status.get("Drawing Pending", 0),
            "awaiting_material": by_status.get("Awaiting Material", 0),
            "in_production": by_status.get("In Production", 0),
            "in_qc": by_status.get("In QC", 0),
            "dispatched": by_status.get("Dispatched", 0),
            "overdue": overdue_count,
            "material_below_60": material_below_60,
            "closed_count": closed_count,
        },
        "active_plans": active_plans,
    }


def _bulk_stages(plan_names):
    """Return {plan_name: [stage dicts sorted by order]}"""
    result = {}
    if not plan_names:
        return result
    names_tuple = tuple(plan_names) if len(plan_names) > 1 else (plan_names[0], plan_names[0])
    rows = frappe.db.sql(
        """
        SELECT parent, stage_order, stage_name, department, completion_percentage
        FROM `tabProject Production Plan Stage`
        WHERE parent IN %(names)s
        ORDER BY stage_order ASC, idx ASC
        """,
        {"names": names_tuple},
        as_dict=True,
    )
    for r in rows:
        result.setdefault(r["parent"], []).append(r)
    return result


def _bulk_samples(plan_names):
    result = {}
    if not plan_names:
        return result
    names_tuple = tuple(plan_names) if len(plan_names) > 1 else (plan_names[0], plan_names[0])
    rows = frappe.db.sql(
        """
        SELECT parent, approval_status
        FROM `tabProject Production Plan Sample`
        WHERE parent IN %(names)s
        """,
        {"names": names_tuple},
        as_dict=True,
    )
    for r in rows:
        result.setdefault(r["parent"], []).append(r)
    return result


def _bulk_drawings(plan_names):
    result = {}
    if not plan_names:
        return result
    names_tuple = tuple(plan_names) if len(plan_names) > 1 else (plan_names[0], plan_names[0])
    rows = frappe.db.sql(
        """
        SELECT parent, drawing_code, status
        FROM `tabProject Production Plan Drawing`
        WHERE parent IN %(names)s
        """,
        {"names": names_tuple},
        as_dict=True,
    )
    for r in rows:
        result.setdefault(r["parent"], []).append(r)
    return result


def _build_pipeline(plan, stages, samples, drawings):
    """
    Build the ordered pipeline of tiles:
    Samples → Design → [custom stages] → Packing → Dispatch → Install
    Each tile: {key, label, tag, pct, state, meta, is_fixed}
    state: done | progress | warn | blocked | idle
    """
    tiles = []

    # Samples tile
    if samples:
        approved = sum(1 for s in samples if (s.get("approval_status") or "").lower() == "approved")
        total = len(samples)
        pct = round((approved / total) * 100) if total else 0
        tiles.append(_tile("samples", "Samples", "SMPL", pct,
                           meta=f"{approved} of {total} approved", is_fixed=True))
    else:
        tiles.append(_tile("samples", "Samples", "SMPL", 0, meta="none", is_fixed=True))

    # Design tile
    if drawings:
        approved = sum(1 for d in drawings if (d.get("status") or "").lower() == "approved")
        total = len(drawings)
        pct = round((approved / total) * 100) if total else 0
        pending = total - approved
        meta = f"{approved} of {total}" if pending == 0 else f"{pending} pending"
        tiles.append(_tile("design", "Design", "DSG", pct, meta=meta, is_fixed=True))
    else:
        tiles.append(_tile("design", "Design", "DSG", 0, meta="none", is_fixed=True))

    # Custom production stages
    for st in stages:
        pct = flt(st.get("completion_percentage") or 0)
        dept = st.get("department") or ""
        tiles.append(_tile(
            "stage_" + str(st.get("stage_order") or 0),
            st.get("stage_name") or "Stage",
            None,
            pct,
            meta=dept,
            is_fixed=False,
        ))

    # Packing tile
    packing_shared = plan.get("packing_list_shared_date") if isinstance(plan, dict) else None
    # We didn't fetch packing_list_shared_date in bulk; infer from status
    status = plan.get("overall_status") or ""
    packing_pct = 100 if status in ("Ready to Dispatch", "Dispatched", "Installed", "Closed") else 0
    tiles.append(_tile("packing", "Packing", "PACK", packing_pct,
                       meta="shared" if packing_pct else "—", is_fixed=True))

    # Dispatch tile (shows date, not %)
    dispatch_date = plan.get("actual_dispatch_date") or plan.get("revised_dispatch_date") or plan.get("target_dispatch_date")
    dispatch_done = bool(plan.get("actual_dispatch_date"))
    dispatch_meta = "dispatched" if dispatch_done else "target"
    is_overdue = False
    if not dispatch_done and dispatch_date:
        try:
            if date_diff(today(), dispatch_date) > 0:
                is_overdue = True
                dispatch_meta = "overdue"
        except Exception:
            pass
    tiles.append(_tile("dispatch", "Dispatch", "DSP",
                       100 if dispatch_done else None,
                       meta=dispatch_meta,
                       is_fixed=True,
                       date_display=_fmt_date(dispatch_date),
                       force_state="done" if dispatch_done else ("blocked" if is_overdue else "idle")))

    # Install tile (shows date range)
    inst_start = plan.get("installation_start_date")
    inst_end = plan.get("installation_end_date")
    inst_done = status == "Installed"
    if inst_start or inst_end:
        date_disp = f"{_fmt_date(inst_start, short=True)}–{_fmt_date(inst_end, short=True)}"
        inst_meta = "scheduled"
    else:
        date_disp = "— / —"
        inst_meta = "not set"
    tiles.append(_tile("install", "Install", "INST",
                       100 if inst_done else None,
                       meta=inst_meta,
                       is_fixed=True,
                       date_display=date_disp,
                       force_state="done" if inst_done else "idle"))

    return tiles


def _tile(key, label, tag, pct, meta="", is_fixed=False, date_display=None, force_state=None):
    """Build a single pipeline tile with computed state."""
    if force_state:
        state = force_state
    elif pct is None:
        state = "idle"
    elif pct >= 100:
        state = "done"
    elif pct <= 0:
        state = "idle"
    elif pct < 20:
        state = "warn"
    else:
        state = "progress"

    return {
        "key": key,
        "label": label,
        "tag": tag,
        "pct": pct,
        "state": state,
        "meta": meta,
        "is_fixed": is_fixed,
        "date_display": date_display,
    }


def _build_flags(plan, drawings, samples):
    """Build list of flag issues for this plan. Each: {level, text, section}"""
    flags = []
    status = plan.get("overall_status") or ""
    mat_pct = flt(plan.get("material_available_pct") or 0)

    # Material availability
    if mat_pct < 60:
        flags.append({
            "level": "critical",
            "text": f"Only {mat_pct:.0f}% material available",
            "section": "material_section",
        })

    # Pending drawings
    pending = [d for d in drawings if (d.get("status") or "").lower() == "pending"]
    if pending:
        flags.append({
            "level": "critical" if len(pending) > 2 else "warn",
            "text": f"{len(pending)} drawing(s) pending approval",
            "section": "design_section",
        })

    # Dispatch slippage
    rev = plan.get("revised_dispatch_date")
    tgt = plan.get("target_dispatch_date")
    if rev and tgt:
        try:
            slip = date_diff(rev, tgt)
            if slip > 0:
                flags.append({
                    "level": "critical",
                    "text": f"Dispatch slipped {slip} days from target",
                    "section": "dates_section",
                })
        except Exception:
            pass

    # Overdue
    end_date = rev or tgt
    if end_date and status not in CLOSED_STATUSES:
        try:
            overdue_days = date_diff(today(), end_date)
            if overdue_days > 0:
                flags.append({
                    "level": "critical",
                    "text": f"Dispatch overdue by {overdue_days} days",
                    "section": "dates_section",
                })
        except Exception:
            pass

    # Awaiting material status
    if status == "Awaiting Material":
        flags.append({
            "level": "warn",
            "text": "Waiting for material to arrive",
            "section": "material_section",
        })

    # Unsigned samples
    unsigned = [s for s in samples if (s.get("approval_status") or "").lower() != "approved"]
    if unsigned and plan.get("installation_start_date"):
        flags.append({
            "level": "warn",
            "text": f"{len(unsigned)} sample(s) not approved",
            "section": "samples_section",
        })

    return flags


def _row_health(plan, flags, is_overdue, mat_pct, status):
    """Determine row border color."""
    if status in ("Drawing Pending", "Awaiting Kickoff"):
        return "idle"
    has_critical = any(f["level"] == "critical" for f in flags)
    has_warn = any(f["level"] == "warn" for f in flags)
    if has_critical or is_overdue or mat_pct < 60:
        return "critical"
    if has_warn:
        return "warn"
    return "healthy"


def _fmt_date(d, short=False):
    """Format a date to '06 Aug 26' or short '06 Aug'."""
    if not d:
        return ""
    try:
        dt = getdate(d)
        if short:
            return dt.strftime("%d %b")
        return dt.strftime("%d %b %y")
    except Exception:
        return str(d)


# ---------------------------------------------------------------------------
# Per-project drill-in (unchanged from v2 - reads full plan)
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

    material = {
        "available_pct": flt(plan.material_available_pct or 0),
        "po_pct": flt(plan.material_po_pct or 0),
        "mr_pct": flt(plan.material_mr_pct or 0),
        "summary_text": plan.material_summary_text or "",
    }

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

    linked = {
        "qc_inspection": plan.linked_qc_inspection or "",
        "logistics_request": plan.linked_logistics_request or "",
    }

    alerts = []
    if plan.material_delay_flag:
        alerts.append({"type": "material", "title": "Material delay flag", "sub": plan.material_delay_flag})

    pending_drawings = [d for d in (plan.drawing_log or []) if (d.get("status") or "").lower() == "pending"]
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
