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
    "project_dashboard.project_dashboard.patches.v1_4.setup_production_plan_connection.reapply_project_customizations",
]

# Auto-create a Project Production Plan when a Project is inserted.
# The handler is idempotent (no-op if a plan already exists) and
# error-tolerant (logs failure but never blocks Project creation).
doc_events = {
    "Project": {
        "after_insert": "project_dashboard.project_dashboard.doctype.project_production_plan.project_production_plan.create_production_plan_for_project"
    }
}
