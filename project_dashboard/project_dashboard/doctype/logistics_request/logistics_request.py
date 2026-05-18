import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import now_datetime, flt


class LogisticsRequest(Document):
    def validate(self):
        # ---- Auto-fill selected supplier + amount + currency from ticked quote ----
        selected = [q for q in (self.rate_quotes or []) if q.is_selected]
        if len(selected) > 1:
            frappe.throw(_("Only one Rate Quote row can be marked Selected. Untick the others."))
        if len(selected) == 1:
            self.selected_supplier = selected[0].supplier_name
            self.approved_amount = selected[0].amount
            self.currency = selected[0].currency or "AED"
        else:
            if not self.rate_approved_by:
                self.selected_supplier = None
                self.approved_amount = 0
                # Don't clear currency — keep AED default for client shipments etc.
                if not self.currency:
                    self.currency = "AED"

        # ---- Auto-promote status ----
        if self.status == "Planned" and self.rate_quotes and self.shipment_type == "Company Shipment":
            self.status = "Quotes Received"

        # ---- Refresh payment status from linked PI ----
        self._refresh_payment_status()

        # ---- Permission gate: only GM can edit approval audit fields ----
        if not self.is_new():
            old = self.get_doc_before_save()
            if old:
                for fld in ("rate_approved_by", "rate_approved_on"):
                    if (old.get(fld) or None) != (self.get(fld) or None):
                        if not _is_gm_or_admin():
                            frappe.throw(_(
                                "Only Logistics GM can change '{0}'. Use the Approve/Reject buttons."
                            ).format(self.meta.get_label(fld)))

    def _refresh_payment_status(self):
        """Compute total_paid_amount + payment_status from linked Purchase Invoice."""
        if not self.purchase_invoice:
            self.total_paid_amount = 0
            self.payment_status = "Not Paid"
            return

        try:
            pi = frappe.get_doc("Purchase Invoice", self.purchase_invoice)
            grand_total = flt(pi.grand_total)
            outstanding = flt(pi.outstanding_amount)
            paid = grand_total - outstanding
            self.total_paid_amount = paid
            self.invoice_outstanding = outstanding
            if paid <= 0:
                self.payment_status = "Not Paid"
            elif outstanding <= 0:
                self.payment_status = "Fully Paid"
            else:
                self.payment_status = "Partially Paid"
        except frappe.DoesNotExistError:
            # PI was deleted — clear our links
            self.purchase_invoice = None
            self.invoice_outstanding = 0
            self.total_paid_amount = 0
            self.payment_status = "Not Paid"


def _is_gm_or_admin():
    roles = set(frappe.get_roles(frappe.session.user))
    return bool(roles & {"Logistics GM", "System Manager", "Administrator"})


# ============================================================
# Approval methods (unchanged from previous version)
# ============================================================
@frappe.whitelist()
def approve_rates(name, email_attachment=None):
    if not _is_gm_or_admin():
        frappe.throw(_("Only Logistics GM can approve rates."), frappe.PermissionError)

    doc = frappe.get_doc("Logistics Request", name)

    if doc.shipment_type != "Company Shipment":
        frappe.throw(_("Rate approval only applies to Company Shipments."))

    selected = [q for q in (doc.rate_quotes or []) if q.is_selected]
    if not selected:
        frappe.throw(_("Tick the chosen quote row before approving."))
    if not selected[0].quote_attachment:
        frappe.throw(_("The selected quote row has no attachment. Cannot approve."))

    doc.rate_approved_by = frappe.session.user
    doc.rate_approved_on = now_datetime()
    doc.status = "Rate Approved"
    if email_attachment:
        doc.rate_approval_email = email_attachment
    doc.rejection_reason = None
    doc.save()
    return {"ok": True, "status": doc.status, "approved_by": doc.rate_approved_by}


@frappe.whitelist()
def reject_rates(name, reason):
    if not _is_gm_or_admin():
        frappe.throw(_("Only Logistics GM can reject rates."), frappe.PermissionError)
    if not (reason or "").strip():
        frappe.throw(_("Rejection reason is required."))

    doc = frappe.get_doc("Logistics Request", name)
    doc.status = "Rate Rejected"
    doc.rejection_reason = reason
    doc.rate_approved_by = None
    doc.rate_approved_on = None
    doc.save()
    return {"ok": True, "status": doc.status}


# ============================================================
# Daily-board bulk save (unchanged from previous version)
# ============================================================
@frappe.whitelist()
def daily_board_save(changes):
    import json as _json
    if isinstance(changes, str):
        changes = _json.loads(changes)

    saved = 0
    for c in changes or []:
        name = c.get("name")
        if not name:
            continue
        try:
            doc = frappe.get_doc("Logistics Request", name)
            dirty = False
            new_status = (c.get("status") or "").strip()
            new_text = (c.get("update_text") or "").strip()

            if new_status and new_status != doc.status:
                doc.status = new_status
                dirty = True

            if new_text:
                doc.append("daily_updates", {
                    "update_date": frappe.utils.today(),
                    "status_at_time": doc.status,
                    "update_text": new_text,
                    "logged_by": frappe.session.user,
                })
                dirty = True

            if dirty:
                doc.save()
                saved += 1
        except Exception as e:
            frappe.log_error(f"daily_board_save failed for {name}: {e}", "Logistics Daily Board")

    return {"ok": True, "saved": saved}


# ============================================================
# v6 NEW: Financial flow — create PO / Invoice / Payment
# ============================================================
@frappe.whitelist()
def create_purchase_order(name):
    """Create an ERPNext Purchase Order from this Logistics Request.

    Pre-fills from the selected quote: supplier, amount, project.
    Returns the new PO name; caller redirects to /app/purchase-order/<name>.
    """
    doc = frappe.get_doc("Logistics Request", name)

    if doc.shipment_type != "Company Shipment":
        frappe.throw(_("Purchase Order only for Company Shipments."))
    if doc.status != "Rate Approved":
        frappe.throw(_("Rates must be approved by GM before creating a PO."))
    if doc.purchase_order:
        frappe.throw(_("A Purchase Order already exists: {0}").format(doc.purchase_order))

    selected = [q for q in (doc.rate_quotes or []) if q.is_selected]
    if not selected:
        frappe.throw(_("No selected quote — cannot determine supplier."))

    quote = selected[0]
    if not quote.supplier:
        frappe.throw(_(
            "The selected quote row needs a Supplier (ERPNext) link before creating a PO. "
            "Open the request, set the Supplier link on the chosen quote row, save, then try again."
        ))

    # Build the PO
    po = frappe.new_doc("Purchase Order")
    po.supplier = quote.supplier
    po.transaction_date = frappe.utils.today()
    po.schedule_date = doc.expected_delivery_date or frappe.utils.add_days(frappe.utils.today(), 7)
    po.currency = quote.currency or "AED"
    if doc.project:
        po.project = doc.project
    # Custom field linking back to this request
    po.custom_logistics_request = doc.name

    # Single line item: a Service item representing freight/logistics charge
    item_code = _ensure_freight_item()
    po.append("items", {
        "item_code": item_code,
        "item_name": f"Logistics: {doc.shipment_reference[:80]}",
        "description": f"Freight charge for Logistics Request {doc.name} — {doc.shipment_reference}",
        "qty": 1,
        "rate": flt(quote.amount),
        "schedule_date": po.schedule_date,
        "uom": "Nos",
    })

    po.flags.ignore_permissions = True
    po.insert()

    # Link back
    doc.purchase_order = po.name
    doc.po_status = po.status
    doc.status = "PO Issued"
    doc.save(ignore_permissions=True)

    return {"ok": True, "po_name": po.name}


@frappe.whitelist()
def create_purchase_invoice(name):
    """Create a Purchase Invoice from the linked Purchase Order."""
    doc = frappe.get_doc("Logistics Request", name)

    if not doc.purchase_order:
        frappe.throw(_("No Purchase Order linked. Create the PO first."))
    if doc.purchase_invoice:
        frappe.throw(_("A Purchase Invoice already exists: {0}").format(doc.purchase_invoice))

    from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_invoice
    pi = make_purchase_invoice(doc.purchase_order)
    pi.custom_logistics_request = doc.name
    pi.flags.ignore_permissions = True
    pi.insert()

    doc.purchase_invoice = pi.name
    doc.invoice_outstanding = pi.outstanding_amount
    doc.save(ignore_permissions=True)

    return {"ok": True, "pi_name": pi.name}


@frappe.whitelist()
def make_payment_entry(name):
    """Create a Payment Entry against the linked Purchase Invoice."""
    doc = frappe.get_doc("Logistics Request", name)

    if not doc.purchase_invoice:
        frappe.throw(_("No Purchase Invoice linked. Create the invoice first."))

    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
    pe = get_payment_entry("Purchase Invoice", doc.purchase_invoice)
    pe.custom_logistics_request = doc.name
    pe.flags.ignore_permissions = True
    pe.insert()

    return {"ok": True, "pe_name": pe.name}


def _ensure_freight_item():
    """Make sure a generic 'Freight Charges' Service item exists. Returns its name."""
    item_code = "FREIGHT-LOGISTICS"
    if frappe.db.exists("Item", item_code):
        return item_code

    # Find any Service-type Item Group, fall back to "Services" or "All Item Groups"
    item_group = (frappe.db.get_value("Item Group", {"item_group_name": "Services"})
                  or frappe.db.get_value("Item Group", {"item_group_name": "All Item Groups"})
                  or "All Item Groups")

    item = frappe.new_doc("Item")
    item.item_code = item_code
    item.item_name = "Freight & Logistics Charges"
    item.item_group = item_group
    item.is_stock_item = 0
    item.is_purchase_item = 1
    item.is_sales_item = 0
    item.stock_uom = "Nos"
    item.description = "Generic line item for logistics request POs"
    item.flags.ignore_permissions = True
    try:
        item.insert()
    except Exception as e:
        frappe.log_error(f"Could not auto-create freight item: {e}")
    return item_code
