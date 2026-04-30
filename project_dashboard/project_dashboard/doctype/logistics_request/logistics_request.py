import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class LogisticsRequest(Document):
    def validate(self):
        # ---- Auto-fill selected supplier + amount from ticked quote ----
        selected = [q for q in (self.rate_quotes or []) if q.is_selected]
        if len(selected) > 1:
            frappe.throw(_("Only one Rate Quote row can be marked Selected. Untick the others."))
        if len(selected) == 1:
            self.selected_supplier = selected[0].supplier_name
            self.approved_amount = selected[0].amount
        else:
            # No selection — clear these (don't carry stale values)
            if not self.rate_approved_by:
                self.selected_supplier = None
                self.approved_amount = 0

        # ---- Status-driven side effects ----
        # Auto-promote to "Quotes Received" when first quote is added
        if self.status == "Planned" and self.rate_quotes:
            self.status = "Quotes Received"

        # ---- Permission gate: only GM (or System Manager) can edit approval audit fields ----
        # Detect if a non-GM user is trying to set rate_approved_by/on directly via API
        if not self.is_new():
            old = self.get_doc_before_save()
            if old:
                for fld in ("rate_approved_by", "rate_approved_on"):
                    if (old.get(fld) or None) != (self.get(fld) or None):
                        if not _is_gm_or_admin():
                            frappe.throw(_(
                                "Only Logistics GM can change '{0}'. Use the Approve/Reject buttons."
                            ).format(self.meta.get_label(fld)))


def _is_gm_or_admin():
    roles = set(frappe.get_roles(frappe.session.user))
    return bool(roles & {"Logistics GM", "System Manager", "Administrator"})


@frappe.whitelist()
def approve_rates(name, email_attachment=None):
    """Called by the Approve button. Restricted to Logistics GM."""
    if not _is_gm_or_admin():
        frappe.throw(_("Only Logistics GM can approve rates."), frappe.PermissionError)

    doc = frappe.get_doc("Logistics Request", name)

    selected = [q for q in (doc.rate_quotes or []) if q.is_selected]
    if not selected:
        frappe.throw(_("Tick the chosen quote row before approving."))
    if not selected[0].quote_attachment:
        frappe.throw(_("The selected quote row has no attachment. Cannot approve without supplier quote on file."))

    doc.rate_approved_by = frappe.session.user
    doc.rate_approved_on = now_datetime()
    doc.status = "Rate Approved"
    if email_attachment:
        doc.rate_approval_email = email_attachment
    doc.rejection_reason = None
    doc.save()
    return {"ok": True, "status": doc.status, "approved_by": doc.rate_approved_by}


@frappe.whitelist()
def reject_rates(name, reason):
    """Called by the Reject button. Restricted to Logistics GM."""
    if not _is_gm_or_admin():
        frappe.throw(_("Only Logistics GM can reject rates."), frappe.PermissionError)

    if not (reason or "").strip():
        frappe.throw(_("Rejection reason is required."))

    doc = frappe.get_doc("Logistics Request", name)
    doc.status = "Rate Rejected"
    doc.rejection_reason = reason
    # Leave rate_approved_by/on cleared
    doc.rate_approved_by = None
    doc.rate_approved_on = None
    doc.save()
    return {"ok": True, "status": doc.status}


@frappe.whitelist()
def add_daily_update(name, status, update_text):
    """Called by the Daily Board to add a running-log row."""
    if not (update_text or "").strip():
        return {"ok": False, "message": "Update text is required."}
    doc = frappe.get_doc("Logistics Request", name)
    doc.append("daily_updates", {
        "update_date": frappe.utils.today(),
        "status_at_time": status or doc.status,
        "update_text": update_text.strip(),
        "logged_by": frappe.session.user,
    })
    doc.save()
    return {"ok": True}


@frappe.whitelist()
def daily_board_save(changes):
    """Bulk-save inline edits from the Daily Status Board.

    `changes` is a JSON string: list of {name, status, update_text, status_changed}
    Each entry creates a Daily Update row when update_text is non-empty,
    and updates the parent's status when changed.
    """
    import json as _json
    if isinstance(changes, str):
        changes = _json.loads(changes)

    saved = 0
    for c in changes or []:
        name = c.get("name")
        if not name:
            continue
        try:
            doc = frappe.get_doc("Logistics Request", name)
            dirty = False
            new_status = (c.get("status") or "").strip()
            new_text = (c.get("update_text") or "").strip()

            if new_status and new_status != doc.status:
                doc.status = new_status
                dirty = True

            if new_text:
                doc.append("daily_updates", {
                    "update_date": frappe.utils.today(),
                    "status_at_time": doc.status,
                    "update_text": new_text,
                    "logged_by": frappe.session.user,
                })
                dirty = True

            if dirty:
                doc.save()
                saved += 1
        except Exception as e:
            frappe.log_error(f"daily_board_save failed for {name}: {e}", "Logistics Daily Board")

    return {"ok": True, "saved": saved}
