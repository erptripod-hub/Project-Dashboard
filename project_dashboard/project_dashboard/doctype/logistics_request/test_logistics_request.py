import frappe
import unittest


class TestLogisticsRequest(unittest.TestCase):
    def test_create_and_status(self):
        doc = frappe.get_doc({
            "doctype": "Logistics Request",
            "shipment_reference": "TEST-LR-V5-001",
            "status": "Planned",
            "request_date": frappe.utils.today(),
            "requested_by": "Administrator",
            "shipping_mode": "Air",
        })
        doc.insert(ignore_permissions=True)
        assert doc.name.startswith("LR-")
        assert doc.status == "Planned"
        doc.delete()
