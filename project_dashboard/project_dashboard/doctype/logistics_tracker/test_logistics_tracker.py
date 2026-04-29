import frappe
import unittest


class TestLogisticsTracker(unittest.TestCase):
    def test_create(self):
        doc = frappe.get_doc({
            "doctype": "Logistics Tracker",
            "log_date": frappe.utils.today(),
            "shipment_reference": "TEST-SHIP-001",
            "project_manager": "Administrator",
            "shipping_mode": "Air",
            "current_status": "Planned",
            "status_update": "Test entry",
        })
        doc.insert(ignore_permissions=True)
        assert doc.name
        doc.delete()
