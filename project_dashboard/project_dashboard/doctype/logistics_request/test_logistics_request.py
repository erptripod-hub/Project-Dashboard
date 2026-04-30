import frappe
import unittest


class TestLogisticsRequest(unittest.TestCase):
    def test_create_draft(self):
        doc = frappe.get_doc({
            "doctype": "Logistics Request",
            "request_date": frappe.utils.today(),
            "requested_by": "Administrator",
            "shipment_reference": "TEST-LR-001",
            "shipping_mode": "Air",
        })
        doc.insert(ignore_permissions=True)
        assert doc.name.startswith("LR-")
        doc.delete()
