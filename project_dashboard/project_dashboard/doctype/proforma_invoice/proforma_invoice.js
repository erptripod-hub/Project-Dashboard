// Copyright (c) 2026, Tripod and contributors
// For license information, please see license.txt

frappe.ui.form.on('Proforma Invoice', {
	refresh: function(frm) {
		// Add buttons based on status
		if (frm.doc.docstatus === 1) {
			if (frm.doc.billing_status === "Unpaid") {
				// Create Tax Invoice button
				frm.add_custom_button(__('Create Tax Invoice'), function() {
					frappe.call({
						method: "create_sales_invoice",
						doc: frm.doc,
						callback: function(r) {
							if (r.message) {
								frm.reload_doc();
								frappe.set_route("Form", "Sales Invoice", r.message);
							}
						}
					});
				}, __('Actions'));
				
				// Cancel Proforma button
				frm.add_custom_button(__('Cancel Proforma'), function() {
					frappe.confirm(
						__('Are you sure you want to cancel this Proforma Invoice?'),
						function() {
							frappe.call({
								method: "cancel_proforma",
								doc: frm.doc,
								callback: function(r) {
									frm.reload_doc();
								}
							});
						}
					);
				}, __('Actions'));
			}
			
			if (frm.doc.billing_status === "Invoiced" && frm.doc.sales_invoice) {
				// Link to Sales Invoice
				frm.add_custom_button(__('View Tax Invoice'), function() {
					frappe.set_route("Form", "Sales Invoice", frm.doc.sales_invoice);
				});
			}
		}
		
		// Set indicator color
		if (frm.doc.billing_status === "Unpaid") {
			frm.page.set_indicator(__('Unpaid'), 'orange');
		} else if (frm.doc.billing_status === "Invoiced") {
			frm.page.set_indicator(__('Invoiced'), 'green');
		} else if (frm.doc.billing_status === "Cancelled") {
			frm.page.set_indicator(__('Cancelled'), 'red');
		}
	},
	
	sales_order: function(frm) {
		if (frm.doc.sales_order) {
			// Fetch SO details
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Sales Order",
					name: frm.doc.sales_order
				},
				callback: function(r) {
					if (r.message) {
						var so = r.message;
						frm.set_value("customer", so.customer);
						frm.set_value("customer_name", so.customer_name);
						frm.set_value("project", so.project);
						frm.set_value("company", so.company);
						frm.set_value("currency", so.currency);
						
						if (so.taxes_and_charges) {
							frm.set_value("taxes_and_charges", so.taxes_and_charges);
						}
					}
				}
			});
		}
	},
	
	billing_percentage: function(frm) {
		if (frm.doc.sales_order && frm.doc.billing_percentage) {
			// Recalculate items based on percentage
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Sales Order",
					name: frm.doc.sales_order
				},
				callback: function(r) {
					if (r.message) {
						var so = r.message;
						var pct = flt(frm.doc.billing_percentage) / 100;
						
						frm.clear_table("items");
						
						$.each(so.items, function(i, item) {
							var row = frm.add_child("items");
							row.item_code = item.item_code;
							row.item_name = item.item_name;
							row.description = item.description;
							row.qty = flt(item.qty) * pct;
							row.uom = item.uom;
							row.rate = item.rate;
							row.amount = flt(row.qty) * flt(row.rate);
							row.so_detail = item.name;
						});
						
						frm.refresh_field("items");
						frm.trigger("calculate_totals");
					}
				}
			});
		}
	},
	
	taxes_and_charges: function(frm) {
		if (frm.doc.taxes_and_charges) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Sales Taxes and Charges Template",
					name: frm.doc.taxes_and_charges
				},
				callback: function(r) {
					if (r.message) {
						frm.clear_table("taxes");
						$.each(r.message.taxes, function(i, tax) {
							var row = frm.add_child("taxes");
							row.charge_type = tax.charge_type;
							row.account_head = tax.account_head;
							row.description = tax.description;
							row.rate = tax.rate;
						});
						frm.refresh_field("taxes");
						frm.trigger("calculate_taxes");
					}
				}
			});
		}
	},
	
	calculate_totals: function(frm) {
		var total_qty = 0;
		var total_amount = 0;
		
		$.each(frm.doc.items || [], function(i, item) {
			item.amount = flt(item.qty) * flt(item.rate);
			total_qty += flt(item.qty);
			total_amount += flt(item.amount);
		});
		
		frm.set_value("total_qty", total_qty);
		frm.set_value("total_amount", total_amount);
		frm.set_value("net_total", total_amount);
		frm.refresh_field("items");
		
		frm.trigger("calculate_taxes");
	},
	
	calculate_taxes: function(frm) {
		var total_taxes = 0;
		
		$.each(frm.doc.taxes || [], function(i, tax) {
			if (tax.charge_type === "On Net Total") {
				tax.tax_amount = flt(frm.doc.net_total) * flt(tax.rate) / 100;
			}
			total_taxes += flt(tax.tax_amount);
		});
		
		frm.set_value("total_taxes", total_taxes);
		frm.set_value("grand_total", flt(frm.doc.net_total) + total_taxes);
		frm.refresh_field("taxes");
	}
});

frappe.ui.form.on('Proforma Invoice Item', {
	qty: function(frm, cdt, cdn) {
		frm.trigger("calculate_totals");
	},
	rate: function(frm, cdt, cdn) {
		frm.trigger("calculate_totals");
	},
	items_remove: function(frm) {
		frm.trigger("calculate_totals");
	}
});
