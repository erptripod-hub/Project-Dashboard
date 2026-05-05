import frappe
import unittest


class TestLogisticsRequest(unittest.TestCase):
    def test_create_company_shipment(self):
        doc = frappe.get_doc({
            "doctype": "Logistics Request",
            "shipment_reference": "TEST-V6-001",
            "shipment_type": "Company Shipment",
            "direction": "Import",
            "status": "Planned",
            "request_date": frappe.utils.today(),
            "requested_by": "Administrator",
            "shipping_mode": "Air",
        })
        doc.insert(ignore_permissions=True)
        assert doc.name.startswith("LR-")
        doc.delete()

    def test_create_client_shipment(self):
        doc = frappe.get_doc({
            "doctype": "Logistics Request",
            "shipment_reference": "TEST-V6-CLIENT-001",
            "shipment_type": "Client Shipment",
            "direction": "Export",
            "status": "Planned",
            "request_date": frappe.utils.today(),
            "requested_by": "Administrator",
        })
        doc.insert(ignore_permissions=True)
        assert doc.name.startswith("LR-")
        doc.delete()
