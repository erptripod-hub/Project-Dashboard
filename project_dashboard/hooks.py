from . import __version__ as app_version

app_name = "project_dashboard"
app_title = "Project Dashboard"
app_publisher = "ERP Tripod"
app_description = "Project Dashboard for ERPNext v14"
app_email = "erp@tripodmena.com"
app_license = "MIT"

# Add Technical Drawing Request to Project dashboard connections
dashboards = {
	"Project": {
		"heatmap": 0,
		"heatmap_message": "",
		"fieldname": "project",
		"transactions": [
			{
				"label": "Technical",
				"items": ["Technical Drawing Request"]
			}
		]
	}
}
