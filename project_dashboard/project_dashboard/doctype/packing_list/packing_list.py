import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc


class PackingList(Document):
    def validate(self):
        self.validate_qc_passed()
        self.compute_totals()

    def validate_qc_passed(self):
        """A Packing List requires a submitted + Passed QC Inspection for the
        same project. This is what transitively guarantees the export gate."""
        if not self.qc_inspection:
            return

        qc = frappe.db.get_value(
            "QC Inspection",
            self.qc_inspection,
            ["docstatus", "inspection_status", "project"],
            as_dict=True,
        )
        if not qc:
            frappe.throw(_("QC Inspection {0} not found.").format(self.qc_inspection))

        if qc.docstatus != 1 or qc.inspection_status != "Passed":
            frappe.throw(_(
                "Packing List needs a submitted, Passed QC Inspection. "
                "{0} is not passed / submitted yet."
            ).format(self.qc_inspection))

        if qc.project and self.project and qc.project != self.project:
            frappe.throw(_(
                "QC Inspection {0} belongs to project {1}, not {2}."
            ).format(self.qc_inspection, qc.project, self.project))

    def compute_totals(self):
        crate_nos = {c.crate_no for c in (self.crates or []) if c.crate_no}
        self.total_crates = len(crate_nos)
        self.total_weight = sum((c.weight or 0) for c in (self.crates or []))


@frappe.whitelist()
def make_logistics_request(source_name, target_doc=None):
    """Create an Export (Finished Goods) Logistics Request from a Packing List.
    The export gate is satisfied automatically because packing_list is set."""

    def set_missing(source, target, source_parent=None):
        target.direction = "Export"
        target.export_type = "Finished Goods"
        target.shipment_type = "Company Shipment"
        target.packing_list = source.name

    doc = get_mapped_doc(
        "Packing List",
        source_name,
        {
            "Packing List": {
                "doctype": "Logistics Request",
                "field_map": {
                    "project": "project",
                    "company": "company",
                },
            }
        },
        target_doc,
        set_missing,
    )
    return doc
