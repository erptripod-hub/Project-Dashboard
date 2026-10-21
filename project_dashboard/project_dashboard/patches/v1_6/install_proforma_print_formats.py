"""
Install Proforma Invoice print formats:
  - Tripod Middle East LLC (English only)
  - ZATCA (Bilingual English/Arabic for KSA)

Run via: bench --site <site> execute project_dashboard.project_dashboard.patches.v1_6.install_proforma_print_formats.execute
"""
import frappe
import os


def execute():
    """Install or update Proforma Invoice print formats."""
    
    # Path to print format templates
    app_path = frappe.get_app_path("project_dashboard")
    templates_dir = os.path.join(app_path, "project_dashboard", "print_formats")
    
    print_formats = [
        {
            "name": "Tripod Middle East LLC",
            "doc_type": "Proforma Invoice",
            "module": "Project Dashboard",
            "template_file": "proforma_tripod_me.html",
            "standard": "Yes",
            "custom_format": 1,
            "print_format_type": "Jinja"
        },
        {
            "name": "ZATCA",
            "doc_type": "Proforma Invoice",
            "module": "Project Dashboard",
            "template_file": "proforma_zatca.html",
            "standard": "Yes",
            "custom_format": 1,
            "print_format_type": "Jinja"
        }
    ]
    
    for pf_data in print_formats:
        template_path = os.path.join(templates_dir, pf_data["template_file"])
        
        if not os.path.exists(template_path):
            print(f"Warning: Template file not found: {template_path}")
            continue
        
        with open(template_path, "r") as f:
            html_content = f.read()
        
        pf_name = pf_data["name"]
        
        if frappe.db.exists("Print Format", pf_name):
            # Update existing
            pf = frappe.get_doc("Print Format", pf_name)
            pf.html = html_content
            pf.doc_type = pf_data["doc_type"]
            pf.module = pf_data["module"]
            pf.standard = pf_data["standard"]
            pf.custom_format = pf_data["custom_format"]
            pf.print_format_type = pf_data["print_format_type"]
            pf.disabled = 0
            pf.save(ignore_permissions=True)
            print(f"Updated Print Format: {pf_name}")
        else:
            # Create new
            pf = frappe.get_doc({
                "doctype": "Print Format",
                "name": pf_name,
                "doc_type": pf_data["doc_type"],
                "module": pf_data["module"],
                "html": html_content,
                "standard": pf_data["standard"],
                "custom_format": pf_data["custom_format"],
                "print_format_type": pf_data["print_format_type"],
                "disabled": 0
            })
            pf.insert(ignore_permissions=True)
            print(f"Created Print Format: {pf_name}")
    
    frappe.db.commit()
    print("Proforma Invoice print formats installed successfully.")
