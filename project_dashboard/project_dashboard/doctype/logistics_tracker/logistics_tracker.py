import frappe
from frappe import _
from frappe.model.document import Document


class LogisticsTracker(Document):
    def validate(self):
        if self.eta and self.log_date and str(self.eta) < str(self.log_date):
            frappe.msgprint(
                _("Note: ETA is earlier than the log date."),
                alert=True,
                indicator="orange",
            )

    def on_submit(self):
        # End-of-day lock. Dashboard reads submitted (docstatus=1) entries,
        # so it picks up new logs automatically on each submit.
        pass
