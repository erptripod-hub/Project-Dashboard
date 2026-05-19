"""Setup Production Plan connection on Project doctype + cleanup.

This patch does three things, all idempotent:

1. Removes broken Custom Fields on Project that have been causing
   "Option Project Plan for field project_plan is not a child table"
   errors during Customize Form save:
     - project_plan      (fieldtype: Table, options: Project Plan) — invalid
     - project_plan_tab  (Tab Break that goes with it)
     - subcontractors    (fieldtype: Table) — same problem
     - subcontractors_tab (Tab Break that goes with it)

   These fields tried to embed Project Plan / a subcontractor list as
   child tables directly on the Project form, but neither target doctype
   has istable=1, so the Customize Form save always rejects them.

2. Adds Project Production Plan as a Connection on the Project doctype
   (DocType.links), so opening any Project shows a "Production" tab
   listing the linked Production Plan.

3. Also adds Project Plan as a Connection (proper way), since that's
   what the broken Table field was trying to do.

Idempotent: each step checks before acting. Safe to run multiple times,
safe to run during and after schema sync.

The functions are also exposed for the after_migrate hook so any future
customization that re-introduces the bad fields gets cleaned up on the
next migrate without manual intervention.
"""

import frappe


# -----------------------------------------------------------------------------
# Patch entry point (called once via patches.txt)
# -----------------------------------------------------------------------------
def execute():
    cleanup_broken_project_custom_fields()
    ensure_project_connections()


# -----------------------------------------------------------------------------
# Step 1: Remove broken Custom Fields
# -----------------------------------------------------------------------------

# Fieldnames we KNOW are broken (Table-type pointing at non-istable targets,
# plus their accompanying Tab Breaks). These are the four rows visible in the
# Customize Form screenshot.
BROKEN_FIELDNAMES_ON_PROJECT = [
    "project_plan",          # Table -> "Project Plan" (invalid)
    "project_plan_tab",      # Tab Break that introduces the above
    "subcontractors",        # Table -> "Project Subcontractor..." (invalid)
    "subcontractors_tab",    # Tab Break that introduces the above
]


def cleanup_broken_project_custom_fields():
    """
    Delete any Custom Field on Project that matches one of the known
    broken fieldnames. Also scans more broadly for ANY Custom Field
    on Project whose fieldtype is 'Table' but whose options points to
    a doctype that is NOT a child table — these will always fail
    validation, so we remove them defensively.
    """
    # Targeted removal by fieldname
    for fieldname in BROKEN_FIELDNAMES_ON_PROJECT:
        _delete_custom_field_if_exists("Project", fieldname)

    # Broader defensive sweep: any Table custom field on Project pointing
    # at a non-table doctype
    rows = frappe.get_all(
        "Custom Field",
        filters={"dt": "Project", "fieldtype": "Table"},
        fields=["name", "fieldname", "options"],
    )
    for row in rows:
        if not row.options:
            continue
        try:
            is_child = frappe.db.get_value("DocType", row.options, "istable")
        except Exception:
            is_child = None

        if not is_child:
            frappe.delete_doc("Custom Field", row.name, ignore_permissions=True, force=True)
            frappe.logger().info(
                f"[project_dashboard] Deleted broken Custom Field "
                f"'{row.fieldname}' on Project (fieldtype=Table, options="
                f"'{row.options}' is not a child table)"
            )


def _delete_custom_field_if_exists(doctype, fieldname):
    """Delete a Custom Field by (dt, fieldname). No-op if it doesn't exist."""
    cf_name = frappe.db.get_value(
        "Custom Field", {"dt": doctype, "fieldname": fieldname}, "name"
    )
    if cf_name:
        try:
            frappe.delete_doc("Custom Field", cf_name, ignore_permissions=True, force=True)
            frappe.logger().info(
                f"[project_dashboard] Deleted Custom Field '{fieldname}' on {doctype}"
            )
        except Exception:
            frappe.log_error(
                title=f"Failed to delete Custom Field {fieldname} on {doctype}",
                message=frappe.get_traceback(),
            )


# -----------------------------------------------------------------------------
# Step 2: Ensure Connections on Project doctype
# -----------------------------------------------------------------------------

# What we want to be present in Project.links (the Connections list)
WANTED_PROJECT_LINKS = [
    {
        "link_doctype": "Project Production Plan",
        "link_fieldname": "project",
        "group": "Production",
    },
    {
        "link_doctype": "Project Plan",
        "link_fieldname": "project",
        "group": "Production",
    },
]


def ensure_project_connections():
    """
    Make sure each link in WANTED_PROJECT_LINKS exists in Project.links.
    Adds anything missing. Never removes existing links. Idempotent.
    """
    try:
        project_dt = frappe.get_doc("DocType", "Project")
    except frappe.DoesNotExistError:
        frappe.logger().warning(
            "[project_dashboard] Project DocType not found — skipping connection setup"
        )
        return
    except Exception:
        frappe.log_error(
            title="Failed to load Project DocType for connection setup",
            message=frappe.get_traceback(),
        )
        return

    existing_links = {
        (l.link_doctype, l.link_fieldname) for l in (project_dt.links or [])
    }

    changes = 0
    for wanted in WANTED_PROJECT_LINKS:
        key = (wanted["link_doctype"], wanted["link_fieldname"])

        # Only add if the TARGET doctype actually exists (avoid errors if
        # Project Plan or Project Production Plan isn't installed)
        if not frappe.db.exists("DocType", wanted["link_doctype"]):
            frappe.logger().info(
                f"[project_dashboard] Skipping connection to "
                f"{wanted['link_doctype']} — doctype does not exist"
            )
            continue

        if key in existing_links:
            continue

        project_dt.append("links", {
            "link_doctype": wanted["link_doctype"],
            "link_fieldname": wanted["link_fieldname"],
            "group": wanted.get("group", ""),
        })
        changes += 1
        frappe.logger().info(
            f"[project_dashboard] Added connection to "
            f"{wanted['link_doctype']} on Project"
        )

    if changes:
        try:
            # ignore_validate so we don't get blocked by any unrelated
            # validation on core Project doctype during migrate
            project_dt.flags.ignore_validate = True
            project_dt.save(ignore_permissions=True)
            frappe.clear_cache(doctype="Project")
        except Exception:
            frappe.log_error(
                title="Failed to save Project DocType with new connections",
                message=frappe.get_traceback(),
            )


# -----------------------------------------------------------------------------
# Reusable wrapper for after_migrate hook (self-healing)
# -----------------------------------------------------------------------------
def reapply_project_customizations(*args, **kwargs):
    """
    Called from hooks.after_migrate so customizations stay healthy on every
    migrate. If anything (e.g. an ERPNext update, a manual Customize Form
    misclick) re-introduces broken fields or removes our connections, the
    next migrate restores the desired state.

    Wrapped in try/except so a failure here never blocks the migrate.
    """
    try:
        cleanup_broken_project_custom_fields()
        ensure_project_connections()
    except Exception:
        frappe.log_error(
            title="[project_dashboard] reapply_project_customizations failed",
            message=frappe.get_traceback(),
        )
