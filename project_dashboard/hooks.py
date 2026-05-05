from . import __version__ as app_version

app_name = "project_dashboard"
app_title = "Project Dashboard"
app_publisher = "ERP Tripod"
app_description = "Project Dashboard for ERPNext v14"
app_email = "erp@tripodmena.com"
app_license = "MIT"

# Run logistics data migrations AFTER schema sync, every migrate.
# Idempotent — checks state before doing work.
after_migrate = [
    "project_dashboard.project_dashboard.patches.v1_3.v6_setup.backfill_logistics_request_defaults",
]
