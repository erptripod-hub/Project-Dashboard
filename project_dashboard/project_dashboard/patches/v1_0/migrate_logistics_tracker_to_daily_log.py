"""Migrate any existing Logistics Tracker records into Logistics Daily Log
parents with Logistics Shipment Row children, then drop the old DocType.

Idempotent: if the old DocType doesn't exist (fresh install), exits cleanly.
"""
import frappe


def execute():
    if not frappe.db.table_exists("Logistics Tracker"):
        # Fresh install or old DocType already removed — nothing to do
        return

    if not frappe.db.exists("DocType", "Logistics Tracker"):
        # Table exists but DocType is gone — drop the orphan table
        try:
            frappe.db.sql("DROP TABLE IF EXISTS `tabLogistics Tracker`")
        except Exception:
            pass
        return

    # Read all old records (drafts + submitted), grouped by log_date
    old_rows = frappe.db.sql(
        """
        SELECT name, docstatus, log_date, shipment_reference, project, proj_no,
               project_manager, loading_place, delivery_place, shipping_mode,
               agent, current_status, eta, status_update, next_action, owner
        FROM `tabLogistics Tracker`
        ORDER BY log_date, creation
        """,
        as_dict=True,
    )

    by_date = {}
    for r in old_rows:
        d = str(r.log_date or "")
        if not d:
            continue
        by_date.setdefault(d, []).append(r)

    migrated_parents = 0
    migrated_rows = 0

    for log_date, rows in by_date.items():
        parent_name = "LDL-" + log_date
        if frappe.db.exists("Logistics Daily Log", parent_name):
            # Already migrated this date — skip
            continue

        # All old rows submitted? Build a submitted parent. Otherwise draft.
        all_submitted = all(r.docstatus == 1 for r in rows)
        first_owner = rows[0].owner if rows else None

        parent = frappe.get_doc({
            "doctype": "Logistics Daily Log",
            "log_date": log_date,
            "logged_by": first_owner if first_owner and frappe.db.exists("User", first_owner) else None,
            "summary_note": "Migrated from legacy Logistics Tracker",
            "shipments": [
                {
                    "shipment_reference": r.shipment_reference or "MIGRATED",
                    "project": r.project,
                    "project_manager": r.project_manager if r.project_manager and frappe.db.exists("User", r.project_manager) else None,
                    "loading_place": r.loading_place,
                    "delivery_place": r.delivery_place,
                    "shipping_mode": r.shipping_mode,
                    "agent": r.agent,
                    "current_status": r.current_status or "Planned",
                    "eta": r.eta,
                    "status_update": (r.status_update or "(no update recorded)")[:1000],
                    "next_action": r.next_action,
                }
                for r in rows
            ],
        })
        parent.flags.ignore_permissions = True
        parent.insert()
        migrated_rows += len(rows)
        if all_submitted:
            try:
                parent.submit()
            except Exception as e:
                frappe.log_error(f"Could not submit migrated {parent_name}: {e}")
        migrated_parents += 1

    if migrated_parents:
        print(f"Logistics migration: created {migrated_parents} Daily Logs, {migrated_rows} shipment rows")

    # Drop the old DocType + table cleanly
    try:
        frappe.delete_doc("DocType", "Logistics Tracker", force=1, ignore_missing=True)
    except Exception as e:
        frappe.log_error(f"Could not delete old Logistics Tracker DocType: {e}")
    try:
        frappe.db.sql("DROP TABLE IF EXISTS `tabLogistics Tracker`")
    except Exception:
        pass

    frappe.db.commit()
