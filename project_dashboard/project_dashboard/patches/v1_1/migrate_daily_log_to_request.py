"""Migrate v2 (Logistics Daily Log + Logistics Shipment Row) to v3 (Logistics Request).

Strategy:
  - Group all Logistics Shipment Row entries by shipment_reference
  - Create one Logistics Request per unique shipment_reference
  - Fold each row into a Logistics Daily Update child entry (the running log)
  - Map current_status onto the new workflow_state where it makes sense

Idempotent. Safe on fresh installs.
"""
import frappe


STATUS_MAP = {
    "Planned": "Draft",
    "Booked": "PO Issued",
    "In Transit": "Dispatched",
    "Customs Clearance": "Dispatched",
    "Pending Documents": "PO Issued",
    "On Hold": "PO Issued",
    "Delivered": "Delivered",
}


def execute():
    if not frappe.db.table_exists("Logistics Daily Log") or not frappe.db.table_exists("Logistics Shipment Row"):
        return  # fresh install or already migrated

    rows = frappe.db.sql(
        """
        SELECT
            r.name AS row_name, r.parent AS daily_log_name,
            p.log_date AS log_date, p.logged_by AS logged_by,
            r.shipment_reference, r.project, r.project_manager,
            r.loading_place, r.delivery_place,
            r.shipping_mode, r.agent,
            r.current_status, r.eta,
            r.status_update, r.next_action, r.idx
        FROM `tabLogistics Shipment Row` r
        INNER JOIN `tabLogistics Daily Log` p ON p.name = r.parent
        WHERE p.docstatus IN (0, 1)
        ORDER BY r.shipment_reference, p.log_date ASC, r.idx ASC
        """,
        as_dict=True,
    )

    if not rows:
        _drop_v2()
        return

    # Group by shipment_reference (case-insensitive)
    groups = {}
    for r in rows:
        key = (r.get("shipment_reference") or "").strip()
        if not key:
            continue
        groups.setdefault(key.lower(), []).append(r)

    created = 0
    for key, group in groups.items():
        # Skip if a request already exists with the same shipment_reference
        ref = group[0]["shipment_reference"]
        existing = frappe.db.get_value("Logistics Request", {"shipment_reference": ref}, "name")
        if existing:
            continue

        first = group[0]
        last = group[-1]
        last_status = last.get("current_status") or "Planned"
        mapped_state = STATUS_MAP.get(last_status, "Draft")

        doc = frappe.new_doc("Logistics Request")
        doc.shipment_reference = ref
        doc.request_date = first.get("log_date") or frappe.utils.today()
        doc.requested_by = first.get("logged_by") or "Administrator"
        doc.project = first.get("project")
        doc.urgency = "Normal"
        doc.shipping_mode = first.get("shipping_mode")
        doc.loading_place = first.get("loading_place")
        doc.delivery_place = first.get("delivery_place")
        doc.agent = first.get("agent")
        doc.expected_delivery_date = last.get("eta")
        doc.workflow_state = mapped_state

        # Add daily updates from each historical row
        for r in group:
            doc.append("daily_updates", {
                "update_date": r.get("log_date"),
                "update_status": r.get("current_status"),
                "update_text": (r.get("status_update") or "(migrated row)") + (
                    "\n\nNext: " + r["next_action"] if r.get("next_action") else ""
                ),
                "logged_by": r.get("logged_by") or first.get("logged_by"),
            })

        if mapped_state == "Delivered":
            doc.delivered_on = last.get("log_date")

        doc.flags.ignore_permissions = True
        doc.flags.ignore_validate = True  # bypass stage requirements during bulk migration
        doc.insert()
        created += 1

    if created:
        print(f"Logistics v3 migration: created {created} Logistics Request docs from v2 daily logs")
        frappe.db.commit()

    _drop_v2()


def _drop_v2():
    """Remove v2 DocTypes + tables cleanly."""
    for dt in ("Logistics Daily Log", "Logistics Shipment Row"):
        try:
            frappe.delete_doc("DocType", dt, force=1, ignore_missing=True)
        except Exception as e:
            frappe.log_error(f"Could not delete v2 DocType {dt}: {e}")
        try:
            frappe.db.sql(f"DROP TABLE IF EXISTS `tab{dt}`")
        except Exception:
            pass
    frappe.db.commit()
