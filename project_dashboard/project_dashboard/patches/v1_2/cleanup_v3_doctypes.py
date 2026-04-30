"""Remove v3 workflow + workflow state + workflow action doctypes if they exist
from a previous deploy. v5 uses a free Status field instead.

Idempotent: if v3 was never deployed, this is a no-op.
"""
import frappe


def execute():
    # Remove the workflow definition first (depends on states/actions)
    if frappe.db.exists("Workflow", "Logistics Request Workflow"):
        try:
            frappe.delete_doc("Workflow", "Logistics Request Workflow",
                              force=1, ignore_missing=True)
        except Exception as e:
            frappe.log_error(f"Could not delete v3 workflow: {e}")

    # v3 had a `workflow_state` field on the doctype — handled by migrate
    # because we now have a `status` field instead

    # Drop orphan v2 tables if still around (defensive, in case patch v1_1 didn't run)
    for old_dt in ("Logistics Daily Log", "Logistics Shipment Row"):
        if frappe.db.exists("DocType", old_dt):
            try:
                frappe.delete_doc("DocType", old_dt, force=1, ignore_missing=True)
            except Exception:
                pass
        try:
            frappe.db.sql(f"DROP TABLE IF EXISTS `tab{old_dt}`")
        except Exception:
            pass

    frappe.db.commit()
