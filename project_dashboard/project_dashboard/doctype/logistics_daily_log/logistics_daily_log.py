import frappe
from frappe import _
from frappe.model.document import Document


class LogisticsDailyLog(Document):
    def validate(self):
        # Keep the row counter accurate
        self.row_count = len(self.shipments or [])

        # Each row must have shipment_reference, current_status, status_update
        seen_refs = set()
        for i, row in enumerate(self.shipments or [], start=1):
            ref = (row.shipment_reference or "").strip()
            if not ref:
                frappe.throw(_("Row {0}: Shipment Ref is required").format(i))
            if not row.current_status:
                frappe.throw(_("Row {0} ({1}): Current Status is required").format(i, ref))
            if not (row.status_update or "").strip():
                frappe.throw(_("Row {0} ({1}): Today's Update is required").format(i, ref))
            if ref.lower() in seen_refs:
                frappe.throw(_("Row {0}: Duplicate Shipment Ref '{1}' in same day").format(i, ref))
            seen_refs.add(ref.lower())

    def on_submit(self):
        # End-of-day lock — dashboard reads docstatus=1 rows.
        pass


@frappe.whitelist()
def carry_forward_from_previous(target_name):
    """Pull yesterday's (or most recent submitted day's) shipment rows
    into this draft Daily Log so the team doesn't retype context.

    Carries: shipment_reference, project, project_manager, loading_place,
    delivery_place, shipping_mode, agent, current_status (as starting
    point), eta. Clears: status_update, next_action (must be re-entered
    fresh for today).
    """
    target = frappe.get_doc("Logistics Daily Log", target_name)
    if target.docstatus != 0:
        frappe.throw(_("Carry Forward only works on draft Daily Logs"))

    # Find latest submitted Daily Log strictly before this one's date
    previous = frappe.db.sql(
        """
        SELECT name FROM `tabLogistics Daily Log`
        WHERE docstatus = 1
          AND log_date < %s
          AND name != %s
        ORDER BY log_date DESC
        LIMIT 1
        """,
        (target.log_date, target.name),
        as_dict=True,
    )
    if not previous:
        return {"copied": 0, "message": _("No previous submitted Daily Log found.")}

    prev = frappe.get_doc("Logistics Daily Log", previous[0]["name"])

    # Existing refs in the target — don't double-add
    existing_refs = {(r.shipment_reference or "").strip().lower()
                     for r in (target.shipments or [])}

    copied = 0
    for src_row in prev.shipments or []:
        ref = (src_row.shipment_reference or "").strip()
        if not ref or ref.lower() in existing_refs:
            continue
        # Skip rows that were Delivered yesterday — they don't need carrying forward
        if (src_row.current_status or "") == "Delivered":
            continue
        target.append("shipments", {
            "shipment_reference": src_row.shipment_reference,
            "project": src_row.project,
            "project_manager": src_row.project_manager,
            "loading_place": src_row.loading_place,
            "delivery_place": src_row.delivery_place,
            "shipping_mode": src_row.shipping_mode,
            "agent": src_row.agent,
            "current_status": src_row.current_status,  # starting point
            "eta": src_row.eta,
            # status_update + next_action intentionally left blank — must be filled fresh today
        })
        copied += 1

    target.save()
    return {"copied": copied, "from_log": previous[0]["name"]}
