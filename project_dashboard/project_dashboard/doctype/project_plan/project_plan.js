frappe.ui.form.on("Project Plan", {

	refresh: function(frm) {
		if (frm.doc.boq) {
			frm.add_custom_button(__("Load Sections from BOQ"), function() {
				frappe.confirm("This will replace existing section rows. Continue?", function() {
					frappe.call({
						method: "project_dashboard.project_dashboard.doctype.project_plan.project_plan.load_sections_from_boq",
						args: { boq_name: frm.doc.boq },
						callback: function(r) {
							if (r.message && r.message.length > 0) {
								frm.clear_table("section_costs");
								r.message.forEach(function(row) {
									var child = frm.add_child("section_costs");
									child.section_name = row.section_name;
									child.boq_total = row.boq_total;
									child.work_type = row.work_type;
									child.adjusted_cost = row.adjusted_cost;
									child.variance = row.variance;
								});
								frm.refresh_field("section_costs");
								frappe.msgprint(r.message.length + " sections loaded from BOQ.", "green");
							} else {
								frappe.msgprint("No sections with value found in BOQ.");
							}
						}
					});
				});
			}, __("Actions"));
		}
	},

	boq: function(frm) {
		if (frm.doc.boq) {
			frm.save();
		}
	}
});

// Section Costs
frappe.ui.form.on("Project Plan Section", {
	work_type: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		if (row.work_type === "Subcontract") {
			frappe.model.set_value(cdt, cdn, "adjusted_cost", row.boq_total);
		}
	},
	adjusted_cost: function(frm, cdt, cdn) {
		var row = locals[cdt][cdn];
		frappe.model.set_value(cdt, cdn, "variance", (row.boq_total || 0) - (row.adjusted_cost || 0));
		update_summary(frm);
	},
	section_costs_remove: function(frm) { update_summary(frm); }
});

// Labour Plan
frappe.ui.form.on("Project Labour Plan", {
	headcount: function(frm, cdt, cdn) { calc_labour(frm, cdt, cdn); },
	estimated_days: function(frm, cdt, cdn) { calc_labour(frm, cdt, cdn); },
	estimated_ot_hours: function(frm, cdt, cdn) { calc_labour(frm, cdt, cdn); },
	project_labour_plan_remove: function(frm) { update_summary(frm); }
});

// Department Budget
frappe.ui.form.on("Project Department Budget", {
	allocation_percent: function(frm, cdt, cdn) { calc_dept_budget(frm, cdt, cdn); },
	project_department_budget_remove: function(frm) { update_summary(frm); }
});

// Overhead
frappe.ui.form.on("Project Overhead", {
	amount: function(frm) { update_summary(frm); },
	project_overhead_remove: function(frm) { update_summary(frm); }
});

function calc_labour(frm, cdt, cdn) {
	var row = locals[cdt][cdn];
	var working_hrs = (row.headcount || 0) * (row.estimated_days || 0) * 8;
	var total_hrs = working_hrs + (row.estimated_ot_hours || 0);
	frappe.model.set_value(cdt, cdn, "estimated_working_hours", working_hrs);
	frappe.model.set_value(cdt, cdn, "estimated_total_hours", total_hrs);
	update_summary(frm);
}

function calc_dept_budget(frm, cdt, cdn) {
	var row = locals[cdt][cdn];
	var total_adjusted = (frm.doc.section_costs || []).reduce(function(s, r) { return s + (r.adjusted_cost || 0); }, 0);
	var budget = total_adjusted * (row.allocation_percent || 0) / 100;
	frappe.model.set_value(cdt, cdn, "budget_amount", budget);
	frappe.model.set_value(cdt, cdn, "remaining", budget - (row.spent_amount || 0));
}

function update_summary(frm) {
	var total_adjusted = (frm.doc.section_costs || []).reduce(function(s, r) { return s + (r.adjusted_cost || 0); }, 0);
	var total_overhead = (frm.doc.overhead_costs || []).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
	var total_labour = (frm.doc.labour_plan || []).reduce(function(s, r) { return s + (r.estimated_cost || 0); }, 0);
	var total_cost = total_adjusted + total_overhead + total_labour;
	frm.set_value("total_adjusted_cost", total_adjusted);
	frm.set_value("total_overhead", total_overhead);
	frm.set_value("total_estimated_labour", total_labour);
	frm.set_value("total_project_cost", total_cost);
	frm.set_value("total_variance", (frm.doc.boq_base_total || 0) - total_cost);
}
