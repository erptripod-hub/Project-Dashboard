frappe.ui.form.on("Logistics Daily Log", {
    refresh(frm) {
        // Carry-forward shortcut — pulls yesterday's rows in one click
        if (!frm.is_new() && frm.doc.docstatus === 0) {
            frm.add_custom_button(__("Carry Forward From Previous Day"), () => {
                frappe.confirm(
                    __("Append open shipment rows from the most recent submitted Daily Log? Delivered shipments are skipped, and Today's Update / Next Action stay blank for you to fill in."),
                    () => {
                        frappe.call({
                            method: "project_dashboard.project_dashboard.doctype.logistics_daily_log.logistics_daily_log.carry_forward_from_previous",
                            args: {target_name: frm.doc.name},
                            freeze: true,
                            freeze_message: __("Copying rows..."),
                            callback: (r) => {
                                if (!r.message) return;
                                if (r.message.copied) {
                                    frappe.show_alert({
                                        message: __("Added {0} rows from {1}", [r.message.copied, r.message.from_log]),
                                        indicator: "green",
                                    });
                                    frm.reload_doc();
                                } else {
                                    frappe.msgprint(r.message.message || __("Nothing to carry forward."));
                                }
                            },
                        });
                    }
                );
            }, __("Actions"));

            // Quick link to the dashboard
            frm.add_custom_button(__("Open Dashboard"), () => {
                frappe.set_route("logistics-dashboard");
            });
        }

        // Visual hint when locked
        if (frm.doc.docstatus === 1) {
            frm.dashboard.add_indicator(__("End-of-day lock — Submitted"), "green");
        }
    },

    log_date(frm) {
        // The doc name is derived from log_date (LDL-YYYY-MM-DD) — warn if a record already exists
        if (!frm.doc.log_date || !frm.is_new()) return;
        frappe.db.exists("Logistics Daily Log", "LDL-" + frm.doc.log_date).then((exists) => {
            if (exists) {
                frappe.msgprint({
                    title: __("Daily Log already exists"),
                    message: __("A Daily Log for {0} already exists. Open <b>LDL-{0}</b> instead of creating a new one.", [frm.doc.log_date]),
                    indicator: "orange",
                });
            }
        });
    },
});
