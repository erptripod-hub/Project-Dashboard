import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime


class LogisticsRequest(Document):
    def before_save(self):
        # Stamp stage_started_on whenever workflow_state changes
        if self.has_value_changed("workflow_state"):
            self.stage_started_on = now_datetime()

        # Sync selected_supplier + approved_amount from the ticked quote row
        if self.rate_quotes:
            selected = [q for q in self.rate_quotes if q.is_selected]
            if len(selected) > 1:
                frappe.throw(_("Only one Rate Quote row can be marked Selected. Untick the others."))
            if len(selected) == 1:
                self.selected_supplier = selected[0].supplier_name
                self.approved_amount = selected[0].amount

    def validate(self):
        # Stage-gated requirements (validated when entering each state)
        state = self.workflow_state or "Draft"

        if state == "Rates Submitted":
            if not self.rate_quotes:
                frappe.throw(_("At least one rate quote is required before submitting for approval."))
            for i, q in enumerate(self.rate_quotes, start=1):
                if not q.quote_attachment:
                    frappe.throw(_("Quote row {0} ({1}): supplier quote attachment is required.").format(i, q.supplier_name or "?"))

        if state in ("Rates Approved", "PO Issued", "Dispatched", "Delivered"):
            selected = [q for q in (self.rate_quotes or []) if q.is_selected]
            if not selected:
                frappe.throw(_("Tick the 'Selected' checkbox on the approved quote row before approving rates."))
            if not self.rate_approval_email:
                frappe.throw(_("Approval Email Proof is required to move past Rate Approval."))

        if state in ("PO Issued", "Dispatched", "Delivered"):
            if not self.po_number:
                frappe.throw(_("PO Number is required at PO stage."))
            if not self.po_attachment:
                frappe.throw(_("PO document attachment is required at PO stage."))
            if not self.po_approved_by:
                frappe.throw(_("PO Approved By is required."))

        if state in ("Dispatched", "Delivered"):
            if not self.tracking_number:
                frappe.throw(_("Tracking Number is required to mark as Dispatched."))
            if not self.dispatch_date:
                frappe.throw(_("Dispatch Date is required to mark as Dispatched."))

        if state == "Delivered":
            if not self.delivered_on:
                frappe.throw(_("Delivered On date is required to close the request."))
            if not self.signed_do_attachment:
                frappe.throw(_("Signed DO copy is required to mark as Delivered."))


def stamp_rate_approval(doc, method=None):
    """Hook fired by Workflow when transitioning into 'Rates Approved'."""
    if not doc.rate_approved_by:
        doc.rate_approved_by = frappe.session.user
    if not doc.rate_approved_on:
        doc.rate_approved_on = now_datetime()
