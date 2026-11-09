// Add Proforma Invoice button to Sales Order
frappe.ui.form.on('Sales Order', {
	refresh: function(frm) {
		if (frm.doc.docstatus === 1 && frm.doc.status !== 'Closed') {
			frm.add_custom_button(__('Proforma Invoice'), function() {
				// Prompt for billing percentage
				frappe.prompt([
					{
						fieldname: 'billing_percentage',
						fieldtype: 'Percent',
						label: 'Billing Percentage',
						reqd: 1,
						default: 100,
						description: 'Percentage of SO value to bill'
					}
				], function(values) {
					frappe.call({
						method: "project_dashboard.project_dashboard.doctype.proforma_invoice.proforma_invoice.make_proforma_from_so",
						args: {
							source_name: frm.doc.name,
							billing_percentage: values.billing_percentage
						},
						callback: function(r) {
							if (r.message) {
								var doc = frappe.model.sync(r.message)[0];
								frappe.set_route("Form", "Proforma Invoice", doc.name);
							}
						}
					});
				}, __('Create Proforma Invoice'), __('Create'));
			}, __('Create'));
		}
	}
});
