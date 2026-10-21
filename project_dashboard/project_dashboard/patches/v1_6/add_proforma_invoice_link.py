# Copyright (c) 2026, Tripod and contributors
# For license information, please see license.txt

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
    """Add custom_proforma_invoice field to Sales Invoice"""
    
    custom_fields = {
        "Sales Invoice": [
            {
                "fieldname": "custom_proforma_invoice",
                "fieldtype": "Link",
                "label": "Proforma Invoice",
                "options": "Proforma Invoice",
                "insert_after": "project",
                "read_only": 1,
                "no_copy": 1
            }
        ]
    }
    
    create_custom_fields(custom_fields, update=True)
    frappe.db.commit()
