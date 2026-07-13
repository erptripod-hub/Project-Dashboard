frappe.ui.form.on("QC Inspection", {
    refresh(frm) {
        // Pre-load the 9 industry checklist rows on a fresh form (fully editable)
        if (frm.is_new() && (!frm.doc.checklist || !frm.doc.checklist.length)) {
            const items = [
                "Dimensions vs approved drawings",
                "Substrate & material (no warp / twist / crack / checking)",
                "Finish (sheen consistent, colour & grain match approved sample)",
                "Joinery (joints tight & square, edge-banding / laminate adhered)",
                "Hardware (drawers, hinges, soft-close, locks all operate)",
                "Squareness & alignment (plumb, level, panels flush)",
                "Cleanliness (no glue squeeze-out, sanding marks, fingerprints)",
                "Protection (backs sealed, corners protected, film / foam)",
                "Labeling matches packing list / shipping marks",
            ];
            items.forEach((label) => {
                const row = frm.add_child("checklist");
                row.check_item = label;
                row.result = "OK";
            });
            frm.refresh_field("checklist");
        }

        // Status pill
        if (frm.doc.inspection_status) {
            const color = {
                "Pending": "orange",
                "Rework Required": "red",
                "Passed": "green",
            }[frm.doc.inspection_status] || "gray";
            frm.page.set_indicator(frm.doc.inspection_status, color);
        }
    },
});
