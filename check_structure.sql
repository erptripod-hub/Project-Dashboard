-- Check Stock Entry structure
SELECT 
    'Stock Entry Header' as location,
    COUNT(*) as total,
    SUM(CASE WHEN project IS NOT NULL AND project != '' THEN 1 ELSE 0 END) as with_project
FROM `tabStock Entry`
WHERE docstatus = 1 AND stock_entry_type = 'Material Issue';

SELECT 
    'Stock Entry Detail' as location,
    COUNT(*) as total,
    SUM(CASE WHEN project IS NOT NULL AND project != '' THEN 1 ELSE 0 END) as with_project
FROM `tabStock Entry Detail` sed
JOIN `tabStock Entry` se ON se.name = sed.parent
WHERE se.docstatus = 1 AND se.stock_entry_type = 'Material Issue';

-- Check PO structure
SELECT 
    'PO Header' as location,
    COUNT(*) as total,
    SUM(CASE WHEN project IS NOT NULL AND project != '' THEN 1 ELSE 0 END) as with_project
FROM `tabPurchase Order`
WHERE docstatus = 1;

SELECT 
    'PO Item' as location,
    COUNT(*) as total,
    SUM(CASE WHEN project IS NOT NULL AND project != '' THEN 1 ELSE 0 END) as with_project
FROM `tabPurchase Order Item`;
