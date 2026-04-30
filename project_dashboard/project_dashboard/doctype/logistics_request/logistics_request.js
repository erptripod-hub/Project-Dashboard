frappe.ui.form.on("Logistics Request", {
    refresh(frm) {
        // Quick-link to the dashboard
        frm.add_custom_button(__("Open Dashboard"), () => {
            frappe.set_route("logistics-dashboard");
        });

        // Stage progress indicator
        const stages = ["Draft", "Rates Submitted", "Rates Approved",
                        "PO Issued", "Dispatched", "Delivered"];
        const current = frm.doc.workflow_state || "Draft";
        const idx = stages.indexOf(current);
        if (idx >= 0) {
            const colors = ["red", "orange", "yellow", "blue", "purple", "green"];
            frm.dashboard.add_indicator(
                __("Stage {0} of {1}: {2}", [idx + 1, stages.length, current]),
                colors[idx]
            );
        }

        // Helper: when adding a Daily Update row, default the date to today
        if (frm.fields_dict.daily_updates) {
            frm.fields_dict.daily_updates.grid.update_docfield_property(
                "update_date", "default", frappe.datetime.get_today()
            );
        }
    },

    onload(frm) {
        // Block manual edits to derived fields
        ["selected_supplier", "approved_amount",
         "rate_approved_by", "rate_approved_on",
         "stage_started_on"].forEach((f) => {
            if (frm.fields_dict[f]) frm.set_df_property(f, "read_only", 1);
        });
    },
});

// Auto-tick exclusivity: ticking one quote row unticks the others
frappe.ui.form.on("Logistics Rate Quote", {
    is_selected(frm, cdt, cdn) {
        const just_ticked = locals[cdt][cdn];
        if (!just_ticked.is_selected) return;
        (frm.doc.rate_quotes || []).forEach((row) => {
            if (row.name !== just_ticked.name && row.is_selected) {
                frappe.model.set_value(row.doctype, row.name, "is_selected", 0);
            }
        });
    },
});
