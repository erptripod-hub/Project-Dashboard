frappe.ui.form.on("Logistics Request", {
    refresh(frm) {
        // Show approval banner above the form body
        render_banner(frm);

        // Add Approve / Reject buttons — VISIBLE ONLY to GM (or admin)
        const roles = new Set(frappe.user_roles || []);
        const is_gm = roles.has("Logistics GM") || roles.has("System Manager") || roles.has("Administrator");

        if (!frm.is_new()) {
            // Show GM action buttons only when status is Awaiting GM Approval (or Quotes Received with a tick)
            const can_act = is_gm && (frm.doc.status === "Awaiting GM Approval" || frm.doc.status === "Quotes Received");
            if (can_act) {
                frm.add_custom_button(__("✓ Approve Rates"), () => {
                    frappe.confirm(
                        __("Approve the ticked quote? This stamps your name and time as the audit trail."),
                        () => {
                            frappe.call({
                                method: "project_dashboard.project_dashboard.doctype.logistics_request.logistics_request.approve_rates",
                                args: {name: frm.doc.name},
                                freeze: true,
                                callback: (r) => {
                                    if (r.message && r.message.ok) {
                                        frappe.show_alert({message: __("Rates approved"), indicator: "green"});
                                        frm.reload_doc();
                                    }
                                },
                            });
                        }
                    );
                }).removeClass("btn-default").addClass("btn-success");

                frm.add_custom_button(__("✗ Reject Rates"), () => {
                    frappe.prompt([
                        {fieldname: "reason", fieldtype: "Small Text", label: "Rejection Reason", reqd: 1},
                    ], (values) => {
                        frappe.call({
                            method: "project_dashboard.project_dashboard.doctype.logistics_request.logistics_request.reject_rates",
                            args: {name: frm.doc.name, reason: values.reason},
                            freeze: true,
                            callback: (r) => {
                                if (r.message && r.message.ok) {
                                    frappe.show_alert({message: __("Rates rejected"), indicator: "orange"});
                                    frm.reload_doc();
                                }
                            },
                        });
                    }, __("Reject Rates"), __("Reject"));
                }).removeClass("btn-default").addClass("btn-danger");
            }

            // Sync-with-board indicator
            frm.dashboard.add_indicator(__("Status: {0}", [frm.doc.status]), status_color(frm.doc.status));

            // Quick links
            frm.add_custom_button(__("Daily Status Board"), () => {
                frappe.set_route("logistics-daily-board");
            });
            frm.add_custom_button(__("Dashboard"), () => {
                frappe.set_route("logistics-dashboard");
            });
        }
    },
});

// Single-tick exclusivity on quote rows
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

function status_color(s) {
    const m = {
        "Planned": "gray",
        "Quotes Received": "yellow",
        "Awaiting GM Approval": "orange",
        "Rate Approved": "green",
        "Rate Rejected": "red",
        "PO Issued": "blue",
        "Dispatched": "purple",
        "In Transit": "purple",
        "Customs Clearance": "orange",
        "Pending Documents": "orange",
        "On Hold": "red",
        "Delivered": "green",
        "Cancelled": "gray",
    };
    return m[s] || "gray";
}

function render_banner(frm) {
    const wrapper = frm.fields_dict.approval_indicator;
    if (!wrapper || !wrapper.$wrapper) return;
    const s = frm.doc.status;
    let html = "";

    if (s === "Awaiting GM Approval") {
        html = `<div style="background:#fffbeb;border:1px solid #fde68a;color:#854d0e;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>Awaiting GM approval</b> — GM must tick the chosen quote and click "✓ Approve Rates" above.
        </div>`;
    } else if (s === "Rate Approved") {
        const by = frappe.utils.escape_html(frm.doc.rate_approved_by || "");
        const on = frappe.utils.escape_html(frm.doc.rate_approved_on || "");
        html = `<div style="background:#dcfce7;border:1px solid #86efac;color:#15803d;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>✓ Rates approved</b> by <b>${by}</b> on ${on}. Logistics can proceed with PO and dispatch.
        </div>`;
    } else if (s === "Rate Rejected") {
        const reason = frappe.utils.escape_html(frm.doc.rejection_reason || "(no reason given)");
        html = `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>✗ Rates rejected.</b> Reason: ${reason}
        </div>`;
    } else if (s === "Delivered") {
        html = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>✓ Delivered.</b> Request closed.
        </div>`;
    } else {
        html = `<div style="font-size:11px;color:#64748b;padding:4px 0">Current status: <b>${frappe.utils.escape_html(s || "Planned")}</b></div>`;
    }
    wrapper.$wrapper.find('.like-disabled-input, .control-input-wrapper').remove();
    wrapper.$wrapper.html(html);
}
