frappe.ui.form.on("Logistics Request", {
    refresh(frm) {
        render_banner(frm);
        relabel_section7(frm);
        sync_currency_from_selected_quote(frm);

        const roles = new Set(frappe.user_roles || []);
        const is_gm = roles.has("Logistics GM") || roles.has("System Manager") || roles.has("Administrator");

        if (!frm.is_new()) {
            // ===== GM buttons (Approve / Reject) — only Company Shipment =====
            if (frm.doc.shipment_type === "Company Shipment") {
                const can_act = is_gm && (frm.doc.status === "Awaiting GM Approval" || frm.doc.status === "Quotes Received");
                if (can_act) {
                    frm.add_custom_button(__("✓ Approve Rates"), () => {
                        frappe.confirm(__("Approve the ticked quote?"), () => {
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
                        });
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
                                        frappe.show_alert({message: __("Rejected"), indicator: "orange"});
                                        frm.reload_doc();
                                    }
                                },
                            });
                        }, __("Reject Rates"), __("Reject"));
                    }).removeClass("btn-default").addClass("btn-danger");
                }

                // ===== Financial flow buttons =====
                add_finance_buttons(frm);
            }

            // Status indicator
            frm.dashboard.add_indicator(__("Status: {0}", [frm.doc.status]), status_color(frm.doc.status));

            if (frm.doc.shipment_type) {
                const t_color = frm.doc.shipment_type === "Company Shipment" ? "violet" : "yellow";
                frm.dashboard.add_indicator(frm.doc.shipment_type, t_color);
            }
            if (frm.doc.direction) {
                frm.dashboard.add_indicator(frm.doc.direction, frm.doc.direction === "Import" ? "green" : "orange");
            }

            // Quick links
            frm.add_custom_button(__("Daily Status Board"), () => {
                frappe.set_route("logistics-daily-board");
            });
            frm.add_custom_button(__("Dashboard"), () => {
                frappe.set_route("logistics-dashboard");
            });
        }
    },

    direction(frm) {
        relabel_section7(frm);
    },

    shipment_type(frm) {
        // Force a refresh so depends_on logic re-evaluates and indicators update
        frm.refresh();
    },
});

// ===== Sync parent currency from the selected quote =====
// Fixes existing records where parent.currency = AED but selected quote is USD/CNY/etc.
// Runs on every form refresh; if mismatch found, updates parent fields silently.
function sync_currency_from_selected_quote(frm) {
    if (frm.is_new()) return;
    const quotes = frm.doc.rate_quotes || [];
    const selected = quotes.find((q) => q.is_selected);
    if (!selected) return;

    let changed = false;
    if (selected.currency && frm.doc.currency !== selected.currency) {
        frm.set_value("currency", selected.currency);
        changed = true;
    }
    if (selected.amount && parseFloat(frm.doc.approved_amount) !== parseFloat(selected.amount)) {
        frm.set_value("approved_amount", selected.amount);
        changed = true;
    }
    if (selected.supplier_name && frm.doc.selected_supplier !== selected.supplier_name) {
        frm.set_value("selected_supplier", selected.supplier_name);
        changed = true;
    }
    // If we corrected something, dirty the form so user can save the fix
    if (changed) {
        frm.dirty();
    }
}

// ===== Single-tick exclusivity on quote rows =====
frappe.ui.form.on("Logistics Rate Quote", {
    is_selected(frm, cdt, cdn) {
        const just_ticked = locals[cdt][cdn];
        if (!just_ticked.is_selected) return;
        // Untick all other rows (only one quote can be selected)
        (frm.doc.rate_quotes || []).forEach((row) => {
            if (row.name !== just_ticked.name && row.is_selected) {
                frappe.model.set_value(row.doctype, row.name, "is_selected", 0);
            }
        });
        // Immediately copy ticked row's currency + amount to parent
        // This way the form shows the correct currency BEFORE save
        if (just_ticked.currency) {
            frm.set_value("currency", just_ticked.currency);
        }
        if (just_ticked.amount) {
            frm.set_value("approved_amount", just_ticked.amount);
        }
        if (just_ticked.supplier_name) {
            frm.set_value("selected_supplier", just_ticked.supplier_name);
        }
    },
    currency(frm, cdt, cdn) {
        // If user changes currency on the already-selected row, sync to parent
        const row = locals[cdt][cdn];
        if (row.is_selected && row.currency) {
            frm.set_value("currency", row.currency);
        }
    },
    amount(frm, cdt, cdn) {
        // If user changes amount on the already-selected row, sync to parent
        const row = locals[cdt][cdn];
        if (row.is_selected && row.amount) {
            frm.set_value("approved_amount", row.amount);
        }
    },
});

// ===== Finance flow buttons =====
function add_finance_buttons(frm) {
    if (frm.doc.shipment_type !== "Company Shipment") return;

    const has_po = !!frm.doc.purchase_order;
    const has_pi = !!frm.doc.purchase_invoice;

    // 1. Create Purchase Order (only when rates approved + no PO yet)
    if (frm.doc.status === "Rate Approved" && !has_po) {
        frm.add_custom_button(__("+ Create Purchase Order"), () => {
            frappe.confirm(
                __("Create a Purchase Order from the selected quote? Supplier link must be set on the chosen quote row."),
                () => {
                    frappe.call({
                        method: "project_dashboard.project_dashboard.doctype.logistics_request.logistics_request.create_purchase_order",
                        args: {name: frm.doc.name},
                        freeze: true, freeze_message: __("Creating PO..."),
                        callback: (r) => {
                            if (r.message && r.message.ok) {
                                frappe.show_alert({message: __("PO created: {0}", [r.message.po_name]), indicator: "green"});
                                frm.reload_doc();
                                frappe.set_route("Form", "Purchase Order", r.message.po_name);
                            }
                        },
                    });
                }
            );
        }, __("Finance"));
    }

    // 2. Create Purchase Invoice (when PO exists, no PI yet)
    if (has_po && !has_pi) {
        frm.add_custom_button(__("+ Create Purchase Invoice"), () => {
            frappe.call({
                method: "project_dashboard.project_dashboard.doctype.logistics_request.logistics_request.create_purchase_invoice",
                args: {name: frm.doc.name},
                freeze: true, freeze_message: __("Creating Invoice..."),
                callback: (r) => {
                    if (r.message && r.message.ok) {
                        frappe.show_alert({message: __("Invoice created: {0}", [r.message.pi_name]), indicator: "green"});
                        frm.reload_doc();
                        frappe.set_route("Form", "Purchase Invoice", r.message.pi_name);
                    }
                },
            });
        }, __("Finance"));
    }

    // 3. Make Payment (when PI exists)
    if (has_pi && frm.doc.payment_status !== "Fully Paid") {
        frm.add_custom_button(__("+ Make Payment"), () => {
            frappe.call({
                method: "project_dashboard.project_dashboard.doctype.logistics_request.logistics_request.make_payment_entry",
                args: {name: frm.doc.name},
                freeze: true, freeze_message: __("Creating Payment..."),
                callback: (r) => {
                    if (r.message && r.message.ok) {
                        frappe.show_alert({message: __("Payment Entry: {0}", [r.message.pe_name]), indicator: "green"});
                        frappe.set_route("Form", "Payment Entry", r.message.pe_name);
                    }
                },
            });
        }, __("Finance"));
    }

    // Quick-open buttons for existing linked docs
    if (has_po) {
        frm.add_custom_button(__("View Purchase Order"), () => {
            frappe.set_route("Form", "Purchase Order", frm.doc.purchase_order);
        }, __("Finance"));
    }
    if (has_pi) {
        frm.add_custom_button(__("View Purchase Invoice"), () => {
            frappe.set_route("Form", "Purchase Invoice", frm.doc.purchase_invoice);
        }, __("Finance"));
    }
}

// ===== Direction-driven labels for Section 7 =====
function relabel_section7(frm) {
    const dir = frm.doc.direction || "Import";

    const labels_import = {
        section_delivery: "7. Receiving Process",
        delivered_on: "Received On",
        delivered_at: "Received At (Place)",
        received_by_name: "Received By (Name)",
        signed_do_attachment: "Goods Received Note (GRN)",
        items_condition: "Goods Condition on Arrival",
        delivery_notes: "Receiving Notes",
        loading_place: "Loading Place (Origin / Supplier)",
        delivery_place: "Delivery Place (Our Destination)",
    };

    const labels_export = {
        section_delivery: "7. Delivery & Sign-off",
        delivered_on: "Delivered On",
        delivered_at: "Delivered To (Place)",
        received_by_name: "Received By (Consignee)",
        signed_do_attachment: "Signed DO Copy",
        items_condition: "Items Condition on Delivery",
        delivery_notes: "Delivery Notes",
        loading_place: "Loading Place (Origin)",
        delivery_place: "Delivery Place (Destination)",
    };

    const map = dir === "Export" ? labels_export : labels_import;

    Object.keys(map).forEach((fname) => {
        const df = frm.fields_dict[fname];
        if (df && df.df) {
            df.df.label = map[fname];
            // Re-render the field label
            if (df.refresh) df.refresh();
        }
    });

    // Re-render the form labels manually for fields where the standard refresh
    // doesn't update the visible label
    frm.refresh_fields();
}

function status_color(s) {
    const m = {
        "Planned": "gray", "Quotes Received": "yellow",
        "Awaiting GM Approval": "orange", "Rate Approved": "green",
        "Rate Rejected": "red", "PO Issued": "blue",
        "Dispatched": "purple", "In Transit": "purple",
        "Customs Clearance": "orange", "Pending Documents": "orange",
        "On Hold": "red", "Delivered": "green", "Received": "green",
        "Cancelled": "gray",
    };
    return m[s] || "gray";
}

function render_banner(frm) {
    const wrapper = frm.fields_dict.approval_indicator;
    if (!wrapper || !wrapper.$wrapper) return;
    const s = frm.doc.status;
    let html = "";

    if (frm.doc.shipment_type === "Client Shipment") {
        html = `<div style="background:#fef3c7;border:1px solid #fcd34d;color:#78350f;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>Client Shipment</b> — no rate approval / PO / payment flow. Tracking and documents only.
        </div>`;
    } else if (s === "Awaiting GM Approval") {
        html = `<div style="background:#fffbeb;border:1px solid #fde68a;color:#854d0e;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>Awaiting GM approval</b> — GM must tick the chosen quote and click "✓ Approve Rates" above.
        </div>`;
    } else if (s === "Rate Approved" && !frm.doc.purchase_order) {
        html = `<div style="background:#dcfce7;border:1px solid #86efac;color:#15803d;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>✓ Rates approved</b> — click "+ Create Purchase Order" under Finance menu to proceed.
        </div>`;
    } else if (s === "Rate Rejected") {
        const reason = frappe.utils.escape_html(frm.doc.rejection_reason || "(no reason given)");
        html = `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>✗ Rates rejected.</b> Reason: ${reason}
        </div>`;
    } else if (frm.doc.payment_status === "Fully Paid") {
        html = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>✓ Fully paid.</b> Financial flow closed.
        </div>`;
    } else if (frm.doc.purchase_invoice) {
        html = `<div style="background:#f0f9ff;border:1px solid #bae6fd;color:#075985;padding:10px 14px;border-radius:6px;font-size:12px">
            <b>Invoice:</b> ${frappe.utils.escape_html(frm.doc.purchase_invoice)} · Outstanding ${frm.doc.invoice_outstanding || 0}
        </div>`;
    } else {
        html = `<div style="font-size:11px;color:#64748b;padding:4px 0">Current status: <b>${frappe.utils.escape_html(s || "Planned")}</b></div>`;
    }
    wrapper.$wrapper.html(html);
}
