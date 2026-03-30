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
			frappe.db.get_value("BOQ", frm.doc.boq, "grand_total", function(r) {
				if (r) frm.set_value("boq_grand_total", r.grand_total);
			});
		}
	}
});

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

frappe.ui.form.on("Project Overhead", {
	amount: function(frm) { update_summary(frm); },
	project_overhead_remove: function(frm) { update_summary(frm); }
});

function update_summary(frm) {
	var total_adjusted = 0, total_overhead = 0;
	(frm.doc.section_costs || []).forEach(function(r) { total_adjusted += r.adjusted_cost || 0; });
	(frm.doc.overhead_costs || []).forEach(function(r) { total_overhead += r.amount || 0; });
	var total_cost = total_adjusted + total_overhead;
	frm.set_value("total_adjusted_cost", total_adjusted);
	frm.set_value("total_overhead", total_overhead);
	frm.set_value("total_project_cost", total_cost);
	frm.set_value("total_variance", (frm.doc.boq_grand_total || 0) - total_cost);
}
