"""v6 setup patch:

1. Add custom field 'custom_logistics_request' to Purchase Order, Purchase Invoice,
   Payment Entry — links those docs back to the originating Logistics Request.
2. Migrate existing Logistics Request records:
   - Set shipment_type = "Company Shipment" if unset (safe default, since
     pre-v6 the only flow was company-style)
   - Leave direction empty so user must consciously set Import or Export
   - Old po_number text fields are kept (already hidden in new schema)

Idempotent.
"""
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
    _ensure_custom_fields()
    _migrate_existing_records()


def _ensure_custom_fields():
    fields = {
        "Purchase Order": [
            {
                "fieldname": "custom_logistics_request",
                "label": "Logistics Request",
                "fieldtype": "Link",
                "options": "Logistics Request",
                "insert_after": "project",
                "read_only": 0,
                "no_copy": 1,
                "description": "Link back to the originating Logistics Request",
            },
        ],
        "Purchase Invoice": [
            {
                "fieldname": "custom_logistics_request",
                "label": "Logistics Request",
                "fieldtype": "Link",
                "options": "Logistics Request",
                "insert_after": "project",
                "read_only": 0,
                "no_copy": 1,
            },
        ],
        "Payment Entry": [
            {
                "fieldname": "custom_logistics_request",
                "label": "Logistics Request",
                "fieldtype": "Link",
                "options": "Logistics Request",
                "insert_after": "project",
                "read_only": 0,
                "no_copy": 1,
            },
        ],
    }
    create_custom_fields(fields, ignore_validate=True)


def _migrate_existing_records():
    if not frappe.db.table_exists("Logistics Request"):
        return  # fresh install

    # Defensive: if the schema sync hasn't created shipment_type yet
    # (shouldn't happen now that this is a post_model_sync patch, but
    # safe to check in case patches.txt header gets dropped)
    if not frappe.db.has_column("Logistics Request", "shipment_type"):
        print("v6 migration: shipment_type column not yet created; skipping data migration. "
              "Re-run `bench migrate` after deploy completes.")
        return

    # Default any unset shipment_type to Company (matches pre-v6 behaviour)
    rows = frappe.db.sql(
        """SELECT name FROM `tabLogistics Request`
           WHERE shipment_type IS NULL OR shipment_type = '' """,
        as_dict=True,
    )
    if rows:
        for r in rows:
            try:
                frappe.db.set_value("Logistics Request", r.name, "shipment_type",
                                    "Company Shipment", update_modified=False)
            except Exception as e:
                frappe.log_error(f"v6 migrate: could not default shipment_type for {r.name}: {e}")
        frappe.db.commit()
        print(f"v6 migration: defaulted shipment_type=Company Shipment on {len(rows)} request(s)")
