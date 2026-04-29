frappe.ui.form.on("Logistics Tracker", {
    refresh(frm) {
        if (frm.is_new() && frm.doc.shipment_reference) {
            frm.add_custom_button(__("Copy From Latest Submitted"), () => {
                frappe.call({
                    method: "frappe.client.get_list",
                    args: {
                        doctype: "Logistics Tracker",
                        filters: {
                            shipment_reference: frm.doc.shipment_reference,
                            docstatus: 1,
                        },
                        fields: ["name"],
                        order_by: "log_date desc",
                        limit_page_length: 1,
                    },
                    callback: (r) => {
                        if (!r.message || !r.message.length) {
                            frappe.msgprint(__("No previous submitted log for this shipment."));
                            return;
                        }
                        frappe.db.get_doc("Logistics Tracker", r.message[0].name).then((src) => {
                            const carry = [
                                "project", "proj_no", "project_manager",
                                "loading_place", "delivery_place",
                                "shipping_mode", "agent",
                                "current_status", "eta",
                            ];
                            carry.forEach((f) => frm.set_value(f, src[f]));
                        });
                    },
                });
            });
        }

        if (frm.doc.docstatus === 1) {
            frm.dashboard.add_indicator(__("Locked — end-of-day log"), "green");
        }
    },
});
