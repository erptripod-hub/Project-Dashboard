frappe.pages['logistics-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Logistics Tracker Dashboard',
        single_column: true
    });

    if (!document.getElementById('lt-style')) {
        var s = document.createElement('style');
        s.id = 'lt-style';
        s.textContent =
            '.lt{padding:16px;background:#f0f4f8;min-height:100vh;margin:-15px}' +
            '.lt .head{background:#0f1623;border-radius:10px;padding:14px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}' +
            '.lt .head h2{font-size:15px;font-weight:600;color:#fff;margin:0}' +
            '.lt .head h2 .accent{color:#60a5fa}' +
            '.lt .head p{font-size:11px;color:#94a3b8;margin:2px 0 0}' +
            '.lt .ctrls input{background:#1e2a3b;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:6px;font-size:12px;min-width:240px}' +
            '.lt .ctrls a{background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500;margin-left:6px}' +
            '.lt .k7{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:10px}' +
            '.lt .kc{background:#fff;border:1px solid #e4e4e7;border-top:3px solid #2563eb;border-radius:8px;padding:10px;cursor:pointer;transition:transform .1s}' +
            '.lt .kc:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.05)}' +
            '.lt .kc .t{font-size:8px;text-transform:uppercase;color:#71717a;font-weight:600;margin-bottom:4px}' +
            '.lt .kc .v{font-size:18px;font-weight:700;color:#0f172a;line-height:1}' +
            '.lt .kc .s{font-size:9px;color:#94a3b8;margin-top:3px}' +
            '.lt .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}' +
            '.lt .card{background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:14px;margin-bottom:10px}' +
            '.lt .card .ch{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}' +
            '.lt .card .ct{font-size:13px;font-weight:600;color:#0f172a}' +
            '.lt .card .cs{font-size:11px;color:#94a3b8}' +
            '.lt .funnel-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}' +
            '.lt .funnel-row .lab{width:140px;color:#475569;font-size:11px}' +
            '.lt .funnel-row .bar{flex:1;height:18px;background:#f1f5f9;border-radius:4px;overflow:hidden}' +
            '.lt .funnel-row .bar .fill{height:100%;background:#3b82f6;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;color:#fff;font-weight:600;font-size:10px}' +
            '.lt .funnel-row .num{width:30px;text-align:right;font-weight:700;font-size:12px}' +
            '.lt .pending-row{display:flex;justify-content:space-between;padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;margin-bottom:4px;font-size:11px}' +
            '.lt .alert-row{display:flex;justify-content:space-between;padding:6px 10px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:4px;margin-bottom:4px;font-size:11px}' +
            '.lt table{width:100%;border-collapse:collapse;font-size:11px}' +
            '.lt th{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:600;padding:5px 6px;text-align:left;border-bottom:1px solid #f4f4f5}' +
            '.lt td{padding:6px;border-bottom:1px solid #fafaf9;vertical-align:top;font-size:11px}' +
            '.lt .badge{display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600}' +
            '.lt .b-transit{background:#ede9fe;color:#6d28d9}' +
            '.lt .b-po{background:#dbeafe;color:#1d4ed8}' +
            '.lt .b-hold{background:#fee2e2;color:#b91c1c}' +
            '.lt .b-deliv{background:#dcfce7;color:#15803d}' +
            '.lt .b-await{background:#fff7ed;color:#c2410c}' +
            '.lt .b-comp{background:#ede9fe;color:#6d28d9}' +
            '.lt .b-clnt{background:#fef3c7;color:#78350f}' +
            '.lt .b-imp{background:#d1fae5;color:#047857}' +
            '.lt .b-exp{background:#ffedd5;color:#c2410c}';
        document.head.appendChild(s);
    }

    $(wrapper).find('.page-content').html(
        '<div class="lt">' +
        '<div class="head">' +
        '<div><h2>TRIPOD MENA · <span class="accent">Logistics dashboard</span></h2>' +
        '<p>Operations + financial flow · share weekly</p></div>' +
        '<div class="ctrls"><input id="lt-inp" list="lt-dl" placeholder="Filter by project (or pick All)..." autocomplete="off">' +
        '<datalist id="lt-dl"></datalist>' +
        '<a href="/app/logistics-daily-board">Daily board</a>' +
        '<a href="/app/logistics-request/new">+ New</a></div>' +
        '</div>' +
        '<div id="lt-body" style="text-align:center;padding:40px;color:#94a3b8;font-size:13px">Loading...</div>' +
        '</div>'
    );

    var ALL = '★ All shipments';
    window._lt_map = {}; window._lt_map[ALL] = '__ALL__';
    var dl = document.getElementById('lt-dl');
    var allOpt = document.createElement('option'); allOpt.value = ALL; dl.appendChild(allOpt);
    frappe.db.get_list('Project', {fields: ['name', 'project_name'], limit: 500, filters: {status: ['!=', 'Cancelled']}, order_by: 'modified desc'}).then(function(ps) {
        ps.forEach(function(p) {
            var o = document.createElement('option');
            o.value = p.name + ' — ' + (p.project_name || '');
            dl.appendChild(o);
            window._lt_map[o.value] = p.name;
        });
    });
    document.getElementById('lt-inp').addEventListener('change', function() {
        var v = window._lt_map[this.value];
        if (v) load(v);
    });

    function load(project) {
        document.getElementById('lt-body').innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Loading...</div>';
        frappe.call({
            method: 'project_dashboard.project_dashboard.page.logistics_dashboard.logistics_dashboard.get_dashboard_data',
            args: {project: project},
            callback: function(r) { if (r.message) render(r.message); }
        });
    }

    function esc(v) { if (v === null || v === undefined) return ''; return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function fmt_amt(v, ccy) {
        var n = parseFloat(v) || 0;
        var c = ccy || 'AED';
        if (n >= 1000000) return c + ' ' + (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return c + ' ' + Math.round(n / 1000) + 'K';
        return c + ' ' + n.toLocaleString('en-AE', {maximumFractionDigits: 0});
    }

    // For per-currency aggregate display in KPI cards.
    // Input: dict like {AED: 312000, USD: 18000, CNY: 240000}
    // Output: either single line 'AED 312K' or stacked 'AED 312K · USD 18K · CNY 240K'
    function fmt_ccy_dict(d) {
        d = d || {};
        var keys = Object.keys(d).filter(function(k) { return parseFloat(d[k]) !== 0; });
        if (!keys.length) return 'AED 0';
        // Sort by amount descending so the biggest currency shows first
        keys.sort(function(a, b) { return parseFloat(d[b]) - parseFloat(d[a]); });
        if (keys.length === 1) {
            return fmt_amt(d[keys[0]], keys[0]);
        }
        // Multiple currencies — return HTML with line breaks for stacking
        return keys.map(function(k) { return fmt_amt(d[k], k); }).join('<br>');
    }

    function ccy_count(d) {
        d = d || {};
        return Object.keys(d).filter(function(k) { return parseFloat(d[k]) !== 0; }).length;
    }

    function status_badge(s) {
        s = s || '';
        var cls = 'b-await';
        if (s === 'Delivered' || s === 'Received') cls = 'b-deliv';
        else if (s === 'In Transit' || s === 'Dispatched') cls = 'b-transit';
        else if (s === 'PO Issued') cls = 'b-po';
        else if (s === 'On Hold' || s === 'Pending Documents') cls = 'b-hold';
        return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
    }

    function type_badges(r) {
        var html = '';
        if (r.shipment_type === 'Company Shipment') html += '<span class="badge b-comp">Company</span> ';
        else if (r.shipment_type === 'Client Shipment') html += '<span class="badge b-clnt">Client</span> ';
        if (r.direction === 'Import') html += '<span class="badge b-imp">Import</span>';
        else if (r.direction === 'Export') html += '<span class="badge b-exp">Export</span>';
        return html;
    }

    function bar_chart(items, color) {
        items = items || [];
        if (!items.length) return '<div style="color:#94a3b8;font-size:11px;padding:6px 0">No data</div>';
        var max = Math.max.apply(null, items.map(function(i) { return i.value || 0; })) || 1;
        return items.map(function(i) {
            var pct = Math.max(2, Math.round((i.value / max) * 100));
            return '<div class="funnel-row"><div class="lab">' + esc(i.label) + '</div>' +
                '<div class="bar"><div class="fill" style="width:' + pct + '%' + (color ? ';background:' + color : '') + '">' + esc(i.value) + '</div></div>' +
                '<div class="num">' + esc(i.value) + '</div></div>';
        }).join('');
    }

    function open_lr(name) { return '<a href="/app/logistics-request/' + encodeURIComponent(name) + '" target="_blank" style="color:#2563eb">' + esc(name) + '</a>'; }
    function open_doc(dt, name) {
        if (!name) return '—';
        var path = dt.toLowerCase().replace(/ /g, '-');
        return '<a href="/app/' + path + '/' + encodeURIComponent(name) + '" target="_blank" style="color:#2563eb">' + esc(name) + '</a>';
    }

    function kc(t, v, sub, color, href) {
        var click = href ? ' onclick="window.location=\'' + href + '\'"' : '';
        return '<div class="kc" style="border-top-color:' + color + '"' + click + '>' +
            '<div class="t">' + esc(t) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(sub) + '</div></div>';
    }

    // KPI card that allows HTML in the value (for stacked per-currency totals)
    function kc_html(t, v_html, sub, color, num_lines) {
        // Shrink font as we add more currency lines so the card stays compact
        var fsize = num_lines > 1 ? '12px' : '18px';
        var lh = num_lines > 1 ? '1.35' : '1';
        return '<div class="kc" style="border-top-color:' + color + '">' +
            '<div class="t">' + esc(t) + '</div>' +
            '<div class="v" style="font-size:' + fsize + ';line-height:' + lh + ';font-weight:700">' + v_html + '</div>' +
            '<div class="s">' + esc(sub) + '</div></div>';
    }

    function render(d) {
        d = d || {}; var k = d.kpis || {}; var meta = d.project_meta || {};
        var html = '';

        if (d.scope === 'project' && meta.name) {
            html += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
                '<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600">Project</div>' +
                '<div style="font-size:15px;font-weight:600;color:#0f172a">' + esc(meta.name) +
                (meta.project_name ? ' <span style="color:#64748b;font-weight:400">— ' + esc(meta.project_name) + '</span>' : '') +
                '</div></div></div></div>';
        } else {
            html += '<div class="card" style="background:#0f1623;color:#e2e8f0;border:none">' +
                '<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600">Scope</div>' +
                '<div style="font-size:15px;font-weight:600;color:#fff">All shipments — global view</div></div>';
        }

        // 7 KPIs
        html += '<div class="k7">' +
            kc('Active', k.active || 0, 'In progress', '#2563eb') +
            kc('Awaiting GM', k.awaiting_gm || 0, 'Action queue', '#f59e0b', '/app/logistics-request?status=Awaiting%20GM%20Approval') +
            kc('Pending PO', k.pending_po || 0, 'Approved, no PO', '#6366f1') +
            kc('Pending Invoice', k.pending_invoice || 0, 'PO done, no inv', '#8b5cf6') +
            kc_html('Outstanding', fmt_ccy_dict(k.outstanding_by_ccy), (k.outstanding_count || 0) + ' invoices', '#dc2626', ccy_count(k.outstanding_by_ccy)) +
            kc_html('Committed', fmt_ccy_dict(k.committed_value), 'Approved value', '#0d9488', ccy_count(k.committed_value)) +
            kc_html('Paid this month', fmt_ccy_dict(k.paid_this_month), 'Active flows', '#16a34a', ccy_count(k.paid_this_month)) +
            '</div>';

        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Shipments by status</div></div></div>' + bar_chart(d.by_status) + '</div>' +
            '<div class="card"><div class="ch"><div><div class="ct">By type & direction</div></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div>' + bar_chart(d.by_type, '#8b5cf6') + '</div><div>' + bar_chart(d.by_direction, '#10b981') + '</div></div></div>' +
            '</div>';

        // Awaiting GM + Pending PO
        html += '<div class="g2">' +
            '<div class="card"><div class="ch"><div><div class="ct">Awaiting GM approval</div><div class="cs">Action queue</div></div></div>';
        var ag = d.awaiting_gm || [];
        if (!ag.length) html += '<div style="color:#16a34a;font-size:11px;padding:6px 0;font-weight:500">✓ Nothing pending</div>';
        else ag.forEach(function(r) {
            html += '<div class="pending-row"><div><b>' + open_lr(r.name) + '</b> — ' + esc(r.shipment_reference || '—') + '</div>' +
                '<div style="font-size:10px;color:#64748b">' + esc(r.selected_supplier || '—') + '</div></div>';
        });
        html += '</div>';

        html += '<div class="card"><div class="ch"><div><div class="ct">Pending PO creation</div><div class="cs">Rates approved, click "+ Create PO" on request</div></div></div>';
        var pp = d.pending_po || [];
        if (!pp.length) html += '<div style="color:#16a34a;font-size:11px;padding:6px 0;font-weight:500">✓ All approved rates have POs</div>';
        else pp.forEach(function(r) {
            html += '<div class="pending-row"><div><b>' + open_lr(r.name) + '</b> — ' + esc(r.shipment_reference || '—') + '</div>' +
                '<div style="font-size:10px;color:#64748b">' + fmt_amt(r.approved_amount, r.currency) + '</div></div>';
        });
        html += '</div></div>';

        // Active tracking with type/direction badges + qty
        var it = d.in_transit || [];
        var it_html = '';
        if (it.length) {
            it_html = '<table><thead><tr><th>Request</th><th>Type</th><th>Shipment</th><th>Qty</th><th>Status</th><th>Tracking</th><th>PO/Inv</th><th>ETA</th></tr></thead><tbody>';
            it.forEach(function(r) {
                var trk = r.tracking_number
                    ? '<div style="font-weight:600">' + esc(r.tracking_number) + '</div><div style="font-size:9px;color:#94a3b8">' + esc(r.tracking_type || '') + '</div>'
                    : '—';
                var fin = '—';
                if (r.shipment_type === 'Company Shipment') {
                    var parts = [];
                    if (r.purchase_order) parts.push('PO ✓');
                    if (r.purchase_invoice) parts.push('Inv ✓');
                    if (r.payment_status === 'Fully Paid') parts.push('Paid ✓');
                    fin = parts.join(' · ') || '—';
                } else {
                    fin = '<span style="color:#94a3b8">— n/a —</span>';
                }
                it_html += '<tr><td>' + open_lr(r.name) + '</td>' +
                    '<td>' + type_badges(r) + '</td>' +
                    '<td>' + esc(r.shipment_reference || '—') + '</td>' +
                    '<td style="font-size:10px">' + esc(r.shipment_qty || '—') + '</td>' +
                    '<td>' + status_badge(r.status) + '</td><td>' + trk + '</td>' +
                    '<td style="font-size:10px">' + fin + '</td>' +
                    '<td>' + esc(r.expected_delivery_date || '—') + '</td></tr>';
            });
            it_html += '</tbody></table>';
        } else it_html = '<div style="color:#94a3b8;font-size:11px;padding:14px;text-align:center">No active tracking</div>';
        html += '<div class="card"><div class="ch"><div><div class="ct">Active tracking</div><div class="cs">In-flight shipments — Company + Client</div></div></div>' + it_html + '</div>';

        // Outstanding payments table
        var oi = d.outstanding_invoices || [];
        var oi_html = '';
        if (oi.length) {
            oi_html = '<table><thead><tr><th>Request</th><th>Supplier</th><th>Invoice</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>';
            oi.forEach(function(r) {
                oi_html += '<tr><td>' + open_lr(r.name) + '</td>' +
                    '<td>' + esc(r.selected_supplier || '—') + '</td>' +
                    '<td>' + open_doc('Purchase Invoice', r.purchase_invoice) + '</td>' +
                    '<td style="color:#dc2626;font-weight:600">' + fmt_amt(r.invoice_outstanding, r.currency) + '</td>' +
                    '<td>' + esc(r.payment_status || '—') + '</td></tr>';
            });
            oi_html += '</tbody></table>';
        } else oi_html = '<div style="color:#16a34a;font-size:11px;padding:14px;text-align:center;font-weight:500">✓ No outstanding payments</div>';
        html += '<div class="card"><div class="ch"><div><div class="ct">Outstanding payments</div><div class="cs">Submitted invoices with balance</div></div></div>' + oi_html + '</div>';

        // Delivered this week
        var dw = d.delivered_week || [];
        var dw_html = '';
        if (dw.length) {
            dw_html = '<table><thead><tr><th>Request</th><th>Type</th><th>Shipment</th><th>Project</th><th>Delivered</th><th>Signed DO</th></tr></thead><tbody>';
            dw.forEach(function(r) {
                var doc = r.signed_do_attachment ? '<a href="' + esc(r.signed_do_attachment) + '" target="_blank" style="color:#2563eb">View</a>' : '<span style="color:#dc2626">Missing</span>';
                dw_html += '<tr><td>' + open_lr(r.name) + '</td>' +
                    '<td>' + type_badges(r) + '</td>' +
                    '<td>' + esc(r.shipment_reference || '—') + '</td>' +
                    '<td>' + esc(r.project || '—') + '</td>' +
                    '<td>' + esc(r.delivered_on || '—') + '</td>' +
                    '<td>' + doc + '</td></tr>';
            });
            dw_html += '</tbody></table>';
        } else dw_html = '<div style="color:#94a3b8;font-size:11px;padding:14px;text-align:center">No deliveries in last 7 days</div>';
        html += '<div class="card"><div class="ch"><div><div class="ct">Delivered this week</div><div class="cs">Closed shipments</div></div></div>' + dw_html + '</div>';

        document.getElementById('lt-body').innerHTML = html;
    }

    setTimeout(function() { load('__ALL__'); }, 100);
};
