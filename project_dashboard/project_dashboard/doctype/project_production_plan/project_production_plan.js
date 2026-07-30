// Copyright (c) 2026, Tripod Mena and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Production Plan', {
	refresh: function(frm) {
		// Apply Employee dropdown filters based on the linked Project's company
		apply_company_filters(frm);

		// Add drill-in buttons for MR / PO / GRN / Stock Entry
		add_material_drill_buttons(frm);
	},

	project: function(frm) {
		// When project changes, refresh employee filters
		apply_company_filters(frm);
	},

	overall_status: function(frm) {
		// Show a prompt if changing to Installed and images might be missing
		if (frm.doc.overall_status === 'Installed') {
			let filled = 0;
			for (let i = 1; i <= 5; i++) {
				if (frm.doc['final_image_' + i]) filled++;
			}
			if (filled < 5) {
				frappe.msgprint({
					title: __('Final Images Required'),
					message: __(
						"You've marked this project as Installed but only {0} of 5 " +
						"required final images are attached. Save will fail until 5 images are uploaded.",
						[filled]
					),
					indicator: 'orange',
				});
			}
		}
	},
});

function apply_company_filters(frm) {
	// Filter all Employee Link fields by the project's company.
	// If no company is set yet, show all employees.
	const company = frm.doc.company;
	const employee_filter = company
		? { company: company, status: 'Active' }
		: { status: 'Active' };

	const employee_fields = [
		'project_manager',
		'production_manager',
		'designer',
		'qc_lead',
		'site_supervisor',
		'installation_team_lead',
	];

	employee_fields.forEach(fieldname => {
		frm.set_query(fieldname, () => ({ filters: employee_filter }));
	});

	// Child table fields
	frm.set_query('signed_by_pm', 'sample_log', () => ({ filters: employee_filter }));
	frm.set_query('verified_by', 'drawing_checklist', () => ({ filters: employee_filter }));
	frm.set_query('updated_by', 'daily_updates', () => ({ filters: employee_filter }));

	// QC Inspection and Logistics Request also filtered by project
	if (frm.doc.project) {
		frm.set_query('linked_qc_inspection', () => ({
			filters: { project: frm.doc.project }
		}));
		frm.set_query('linked_logistics_request', () => ({
			filters: { project: frm.doc.project }
		}));
		frm.set_query('approved_mr_link', () => ({
			filters: { project: frm.doc.project }
		}));
	}
}

function add_material_drill_buttons(frm) {
	if (!frm.doc.project || frm.doc.__islocal) return;

	// Add drill-in buttons under the Material Procurement section
	frm.add_custom_button(__('View MRs'), () => {
		frappe.set_route('List', 'Material Request', { project: frm.doc.project });
	}, __('Material'));

	frm.add_custom_button(__('View POs'), () => {
		frappe.set_route('List', 'Purchase Order', { project: frm.doc.project });
	}, __('Material'));

	frm.add_custom_button(__('View GRNs'), () => {
		frappe.set_route('List', 'Purchase Receipt', { project: frm.doc.project });
	}, __('Material'));

	frm.add_custom_button(__('View Stock Entries'), () => {
		frappe.set_route('List', 'Stock Entry', { project: frm.doc.project });
	}, __('Material'));
}
