from . import __version__ as app_version

app_name = "project_dashboard"
app_title = "Project Dashboard"
app_publisher = "ERP Tripod"
app_description = "Project Dashboard for ERPNext v14"
app_email = "erp@tripodmena.com"
app_license = "MIT"

# Show Technical Drawing Request in Project form connections
override_doctype_dashboards = {
	"Project": "project_dashboard.project_dashboard.page.project_dashboard.project_dashboard.get_project_dashboard"
}

dashboards = {
	"Project": {
		"transactions": [
			{
				"label": "Technical Drawing",
				"items": ["Technical Drawing Request"]
			}
		]
	}
}
