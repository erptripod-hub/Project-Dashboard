"""v6 setup:

Patch (execute) — runs during pre_model_sync; only touches things that
don't depend on the new Logistics Request columns existing yet:
  - Adds custom_logistics_request Link field to Purchase Order,
    Purchase Invoice, Payment Entry.

after_migrate hook (backfill_logistics_request_defaults) — runs after
schema sync on every migrate; safe to query new columns:
  - Defaults shipment_type='Company Shipment' on existing records
    that have NULL/empty shipment_type.

Both are idempotent.
"""
import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
    """Pre-sync patch — custom fields on ERPNext docs only."""
    _ensure_custom_fields()


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


def backfill_logistics_request_defaults():
    """Called via after_migrate hook — runs AFTER schema sync.
    Safe to query new shipment_type column here.
    """
    if not frappe.db.table_exists("Logistics Request"):
        return  # fresh install, nothing to backfill

    if not frappe.db.has_column("Logistics Request", "shipment_type"):
        # Schema sync hasn't created the column yet — bail safely
        return

    # Find rows that need the default
    rows = frappe.db.sql(
        """SELECT name FROM `tabLogistics Request`
           WHERE shipment_type IS NULL OR shipment_type = '' """,
        as_dict=True,
    )

    if not rows:
        return  # all rows already have a value

    for r in rows:
        try:
            frappe.db.set_value(
                "Logistics Request", r.name,
                "shipment_type", "Company Shipment",
                update_modified=False,
            )
        except Exception as e:
            frappe.log_error(
                f"v6 backfill: could not default shipment_type for {r.name}: {e}",
                "Logistics v6 Migration",
            )

    frappe.db.commit()
    print(f"v6 backfill: defaulted shipment_type=Company Shipment on {len(rows)} request(s)")

    # === Currency backfill ===
    # For each request that has a selected quote, copy that quote's currency
    # to the parent. Fixes records saved before the currency field existed.
    _backfill_currency_from_selected_quote()


def _backfill_currency_from_selected_quote():
    """For each Logistics Request, find the selected quote row (is_selected=1)
    and copy its currency to the parent's currency field.

    Only updates if the parent currency differs from the quote currency, to
    avoid no-op writes.
    """
    if not frappe.db.has_column("Logistics Request", "currency"):
        return
    if not frappe.db.table_exists("Logistics Rate Quote"):
        return

    # Find all selected quotes with their parent and currency
    selected_quotes = frappe.db.sql(
        """SELECT parent, currency
           FROM `tabLogistics Rate Quote`
           WHERE is_selected = 1 AND currency IS NOT NULL AND currency != '' """,
        as_dict=True,
    )

    fixed = 0
    for q in selected_quotes:
        try:
            current_parent_currency = frappe.db.get_value(
                "Logistics Request", q.parent, "currency"
            )
            if current_parent_currency != q.currency:
                frappe.db.set_value(
                    "Logistics Request", q.parent,
                    "currency", q.currency,
                    update_modified=False,
                )
                fixed += 1
        except Exception as e:
            frappe.log_error(
                f"v6 currency backfill failed for {q.parent}: {e}",
                "Logistics v6 Migration",
            )

    if fixed:
        frappe.db.commit()
        print(f"v6 backfill: corrected currency on {fixed} request(s) from their selected quote")
