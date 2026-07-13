import frappe
from frappe import _
from frappe.model.document import Document


class QCInspection(Document):
    def validate(self):
        self.set_inspection_status()

    def set_inspection_status(self):
        """Auto-flip status from the snags.
        - no units yet            -> Pending
        - any snag still Open     -> Rework Required
        - units present, all snags Closed (or none) -> Passed
        Field stays editable (not read_only) per house rule.
        """
        if not self.units:
            self.inspection_status = "Pending"
            return

        open_snags = [s for s in (self.snags or []) if (s.status or "Open") != "Closed"]
        self.inspection_status = "Rework Required" if open_snags else "Passed"

    def before_submit(self):
        """QC can only pass (submit) when every snag is Closed."""
        if not self.units:
            frappe.throw(_("Add at least one Unit before passing QC."))

        open_snags = [
            (s.unit or "?") + ": " + (s.description or "")[:40]
            for s in (self.snags or []) if (s.status or "Open") != "Closed"
        ]
        if open_snags:
            frappe.throw(_(
                "Cannot pass QC \u2014 these snags are still Open:<br>{0}"
            ).format("<br>".join(open_snags)))

        self.inspection_status = "Passed"
