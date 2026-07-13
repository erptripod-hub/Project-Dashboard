frappe.query_reports["Project Status Overview"] = {
	filters: [
		{
			fieldname: "status",
			label: "Status",
			fieldtype: "Select",
			options: "All\nOpen\nOn Hold\nCompleted\nCancelled",
			default: "Open"
		},
		{
			fieldname: "company",
			label: "Company",
			fieldtype: "Link",
			options: "Company"
		},
		{
			fieldname: "project_type",
			label: "Project Type",
			fieldtype: "Select",
			options: "\nFitout\nJoinery\nBoth"
		},
		{
			fieldname: "from_date",
			label: "Start Date From",
			fieldtype: "Date"
		},
		{
			fieldname: "to_date",
			label: "Start Date To",
			fieldtype: "Date"
		}
	],

	formatter: function(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);

		if (data && data.status === "On Hold") {
			// Full row red background + red text
			value = "<span style='color:#b91c1c;font-weight:600'>" + (value || "") + "</span>";
		}
		return value;
	},

	after_datatable_render: function(datatable) {
		// Apply red background to entire On Hold rows
		setTimeout(function() {
			$(".dt-row").each(function() {
				var statusCell = $(this).find(".dt-cell[data-col-index]").filter(function() {
					return $(this).find(".dt-cell__content").text().trim() === "On Hold";
				});
				if (statusCell.length) {
					$(this).find(".dt-cell").css("background-color", "#fff5f5");
				}
			});
		}, 600);
	}
};
