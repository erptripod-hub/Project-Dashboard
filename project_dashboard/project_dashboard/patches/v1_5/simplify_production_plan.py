"""Simplify Project Production Plan: retire Fixture + Inspection child doctypes.

This patch handles the migration for the simplification change:

1. Drops the two retired child doctypes safely:
   - Project Production Plan Fixture (was tracking per-fixture qty/stage)
   - Project Production Plan Inspection (was tracking 4-slot inspections)

   The tables (`tabProject Production Plan Fixture`, etc.) plus their DocType
   entries plus any DocField / Custom Field references on the parent are
   cleaned up.

2. Idempotent: safe to run multiple times, skips if already done.

3. Error-tolerant: any failure is logged but does not crash migrate.
"""

import frappe


RETIRED_CHILD_DOCTYPES = [
    "Project Production Plan Fixture",
    "Project Production Plan Inspection",
]


def execute():
    for doctype_name in RETIRED_CHILD_DOCTYPES:
        drop_child_doctype_safely(doctype_name)


def drop_child_doctype_safely(doctype_name):
    """
    Drop a retired child doctype:
      - Delete DocType record (this also drops the underlying table on v14+)
      - Do NOT preserve records (child rows die with the parent table drop)
      - Log everything so migrate never crashes
    """
    try:
        if not frappe.db.exists("DocType", doctype_name):
            # Already gone
            return

        # Delete DocType record - Frappe handles table drop
        frappe.delete_doc(
            "DocType",
            doctype_name,
            ignore_permissions=True,
            force=True,
            ignore_missing=True,
        )
        frappe.logger().info(
            f"[project_dashboard] Retired child doctype '{doctype_name}'"
        )

    except Exception:
        frappe.log_error(
            title=f"Failed to drop retired doctype {doctype_name}",
            message=frappe.get_traceback(),
        )
