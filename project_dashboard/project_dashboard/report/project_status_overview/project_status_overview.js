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
			value = "<span style='color:#b91c1c'>" + value + "</span>";
		}
		return value;
	}
};
