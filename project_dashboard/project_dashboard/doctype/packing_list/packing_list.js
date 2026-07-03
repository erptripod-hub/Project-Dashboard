frappe.ui.form.on("Packing List", {
    refresh(frm) {
        // Pull units from the linked QC Inspection into the crates table
        if (frm.doc.qc_inspection && (frm.is_new() || !frm.doc.crates || !frm.doc.crates.length)) {
            frm.add_custom_button(__("Pull Items from QC Inspection"), () => {
                frappe.db.get_doc("QC Inspection", frm.doc.qc_inspection).then((qc) => {
                    if (qc.docstatus !== 1 || qc.inspection_status !== "Passed") {
                        frappe.msgprint(__("Linked QC Inspection must be submitted and Passed first."));
                        return;
                    }
                    if (!frm.doc.project && qc.project) frm.set_value("project", qc.project);
                    if (!frm.doc.company && qc.company) frm.set_value("company", qc.company);
                    if (!frm.doc.location && qc.location) frm.set_value("location", qc.location);
                    (qc.units || []).forEach((u) => {
                        const row = frm.add_child("crates");
                        row.item_name = u.unit_name;
                        row.qty = 1;
                    });
                    frm.refresh_field("crates");
                    frappe.show_alert(__("Pulled {0} unit(s).", [(qc.units || []).length]));
                });
            });
        }

        // Create the Export logistics request once submitted
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__("Logistics Request"), () => {
                frappe.model.open_mapped_doc({
                    method: "project_dashboard.project_dashboard.doctype.packing_list.packing_list.make_logistics_request",
                    frm: frm,
                });
            }, __("Create"));
        }
    },
});
