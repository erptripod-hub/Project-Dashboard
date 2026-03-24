from . import __version__ as app_version

app_name = "project_dashboard"
app_title = "Project Dashboard"
app_publisher = "ERP Tripod"
app_description = "Project Dashboard for ERPNext v14"
app_email = "erp@tripodmena.com"
app_license = "MIT"

override_doctype_dashboards = {
	"Project": "project_dashboard.project_dashboard.doctype.technical_drawing_request.technical_drawing_request.get_project_dashboard_data"
}
