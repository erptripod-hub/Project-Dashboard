import frappe
import unittest


class TestLogisticsDailyLog(unittest.TestCase):
    def test_create_with_rows(self):
        # Clean up any leftover from a previous test run
        frappe.db.delete("Logistics Daily Log", {"log_date": "2099-01-01"})

        doc = frappe.get_doc({
            "doctype": "Logistics Daily Log",
            "log_date": "2099-01-01",
            "shipments": [
                {
                    "shipment_reference": "TEST-001",
                    "current_status": "Planned",
                    "status_update": "Smoke test row",
                }
            ],
        })
        doc.insert(ignore_permissions=True)
        assert doc.row_count == 1
        doc.delete()
