frappe.ui.form.on("Project Plan", {

	refresh: function(frm) {
		// Timeline status color
		var status_colors = {
			"On Track": "green", "Attention": "yellow",
			"Warning": "orange", "Critical": "red", "Overdue": "darkgrey"
		};
		if (frm.doc.timeline_status) {
			frm.page.set_indicator(
				frm.doc.timeline_status,
				status_colors[frm.doc.timeline_status] || "blue"
			);
		}

		// Load from BOQ button
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
								frappe.msgprint(r.message.length + " sections loaded.", "green");
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
			frappe.db.get_value("BOQ", frm.doc.boq, ["grand_total"], function(r) {
				if (r) frm.set_value("boq_grand_total", r.grand_total);
			});
		}
	},

	start_date: function(frm) { update_timeline(frm); },
	end_date: function(frm) { update_timeline(frm); }
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

// Department Budget - validate 100%
frappe.ui.form.on("Project Department Budget", {
	allocation_percent: function(frm, cdt, cdn) {
		var total = (frm.doc.department_budgets || []).reduce(function(s, r) {
			return s + (r.allocation_percent || 0);
		}, 0);
		if (total > 100) {
			frappe.model.set_value(cdt, cdn, "allocation_percent", 0);
			frappe.msgprint("Total allocation cannot exceed 100%. Current total: " + (total - locals[cdt][cdn].allocation_percent) + "%", "red");
			return;
		}
		calc_dept_budget(frm, cdt, cdn);
	},
	project_department_budget_remove: function(frm) { update_summary(frm); }
});

// Labour Plan
frappe.ui.form.on("Project Labour Plan", {
	headcount: function(frm, cdt, cdn) { calc_labour(frm, cdt, cdn); },
	estimated_days: function(frm, cdt, cdn) { calc_labour(frm, cdt, cdn); },
	estimated_ot_hours: function(frm, cdt, cdn) { calc_labour(frm, cdt, cdn); },
	project_labour_plan_remove: function(frm) { update_summary(frm); }
});

// Subcontractor
frappe.ui.form.on("Project Subcontractor Allocation", {
	contract_value: function(frm) { update_summary(frm); },
	project_subcontractor_allocation_remove: function(frm) { update_summary(frm); }
});

// Overhead
frappe.ui.form.on("Project Overhead", {
	amount: function(frm) { update_summary(frm); },
	project_overhead_remove: function(frm) { update_summary(frm); }
});

function update_timeline(frm) {
	if (!frm.doc.start_date || !frm.doc.end_date) return;
	var start = frappe.datetime.str_to_obj(frm.doc.start_date);
	var end = frappe.datetime.str_to_obj(frm.doc.end_date);
	var today = new Date();
	var duration = Math.round((end - start) / (1000 * 60 * 60 * 24));
	var passed = Math.max(Math.round((today - start) / (1000 * 60 * 60 * 24)), 0);
	var remaining = Math.round((end - today) / (1000 * 60 * 60 * 24));
	frm.set_value("project_duration", duration);
	frm.set_value("days_passed", passed);
	frm.set_value("days_remaining", remaining);
	var status = remaining < 0 ? "Overdue" :
		remaining < 7 ? "Critical" :
		remaining < 15 ? "Warning" :
		remaining < 30 ? "Attention" : "On Track";
	frm.set_value("timeline_status", status);
}

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
	var total_adjusted = (frm.doc.section_costs || []).reduce(function(s, r) {
		return s + (r.adjusted_cost || 0);
	}, 0);
	var budget = total_adjusted * (row.allocation_percent || 0) / 100;
	frappe.model.set_value(cdt, cdn, "budget_amount", budget);
	frappe.model.set_value(cdt, cdn, "remaining", budget - (row.spent_amount || 0));
}

function update_summary(frm) {
	var total_adjusted = (frm.doc.section_costs || []).reduce(function(s, r) { return s + (r.adjusted_cost || 0); }, 0);
	var total_sub = (frm.doc.subcontractor_allocations || []).reduce(function(s, r) { return s + (r.contract_value || 0); }, 0);
	var total_overhead = (frm.doc.overhead_costs || []).reduce(function(s, r) { return s + (r.amount || 0); }, 0);
	var total_labour = (frm.doc.labour_plan || []).reduce(function(s, r) { return s + (r.estimated_cost || 0); }, 0);
	var total_cost = total_adjusted + total_overhead + total_labour;
	frm.set_value("total_adjusted_cost", total_adjusted);
	frm.set_value("total_subcontractor_cost", total_sub);
	frm.set_value("total_overhead", total_overhead);
	frm.set_value("total_estimated_labour", total_labour);
	frm.set_value("total_project_cost", total_cost);
	frm.set_value("total_variance", (frm.doc.boq_base_total || 0) - total_cost);
}
