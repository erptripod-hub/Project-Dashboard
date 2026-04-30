frappe.pages['logistics-daily-board'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Logistics Daily Status Board',
        single_column: true
    });

    if (!document.getElementById('ldb-style')) {
        var s = document.createElement('style');
        s.id = 'ldb-style';
        s.textContent =
            '.ldb{padding:14px;background:#f0f4f8;min-height:100vh;margin:-15px}' +
            '.ldb .head{background:#0f1623;border-radius:10px;padding:14px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}' +
            '.ldb .head h2{font-size:15px;font-weight:600;color:#fff;margin:0}' +
            '.ldb .head p{font-size:11px;color:#94a3b8;margin:2px 0 0}' +
            '.ldb .ctrls{display:flex;gap:8px;align-items:center}' +
            '.ldb .ctrls a.btn-new{background:#2563eb;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none}' +
            '.ldb .save-bar{position:sticky;top:0;z-index:10;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#78350f}' +
            '.ldb .save-bar.clean{background:#f0fdf4;border-color:#86efac;color:#14532d}' +
            '.ldb .save-bar button{background:#16a34a;color:#fff;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:500;border:none;cursor:pointer}' +
            '.ldb .save-bar button:disabled{background:#d4d4d8;cursor:not-allowed}' +
            '.ldb .proj{background:#fff;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px;overflow:hidden}' +
            '.ldb .proj-head{background:#f8fafc;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;border-bottom:1px solid #e2e8f0}' +
            '.ldb .proj-head:hover{background:#f1f5f9}' +
            '.ldb .proj-head .name{font-size:13px;font-weight:600;color:#0f172a}' +
            '.ldb .proj-head .count{font-size:11px;color:#64748b;background:#e2e8f0;padding:2px 8px;border-radius:999px;margin-left:8px}' +
            '.ldb .proj-head .right{font-size:11px;color:#64748b}' +
            '.ldb .proj-head.collapsed .caret{transform:rotate(-90deg)}' +
            '.ldb .proj-head .caret{display:inline-block;color:#64748b;font-size:10px;transition:transform .15s;margin-right:6px}' +
            '.ldb .sg-head{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600;margin:8px 0 4px;padding:0 14px}' +
            '.ldb .sg-bar{display:inline-block;width:4px;height:12px;border-radius:2px;margin-right:6px;vertical-align:middle}' +
            '.ldb table{width:100%;border-collapse:collapse}' +
            '.ldb table th{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:600;padding:6px 8px;text-align:left}' +
            '.ldb table td{padding:6px 8px;font-size:12px;border-top:1px solid #f4f4f5;vertical-align:middle}' +
            '.ldb table tr:hover td{background:#fafaf9}' +
            '.ldb table tr.dirty td{background:#fef9c3 !important}' +
            '.ldb table tr.dirty td:first-child{border-left:3px solid #f59e0b}' +
            '.ldb .lr-link{color:#2563eb;font-weight:500;text-decoration:none}' +
            '.ldb .lr-link:hover{text-decoration:underline}' +
            '.ldb .ship-name{color:#0f172a;font-weight:500}' +
            '.ldb .meta{font-size:10px;color:#94a3b8;margin-top:1px}' +
            '.ldb select.status-sel{font-size:11px;padding:3px 6px;border:1px solid #d4d4d8;border-radius:4px;background:#fff;min-width:160px}' +
            '.ldb input.update-input{width:100%;min-width:200px;font-size:11px;padding:4px 8px;border:1px solid #d4d4d8;border-radius:4px;background:#fff}' +
            '.ldb input.update-input:focus{border-color:#93c5fd;outline:2px solid #dbeafe;outline-offset:-1px}' +
            '.ldb .urg{font-size:9px;padding:1px 6px;border-radius:999px;font-weight:600;margin-left:4px}' +
            '.ldb .urg-Urgent{background:#fff7ed;color:#c2410c}' +
            '.ldb .urg-Critical{background:#fee2e2;color:#b91c1c}' +
            '.ldb .urg-Normal{background:#f1f5f9;color:#64748b}' +
            '.ldb tr.row-delivered td{opacity:.55}' +
            '.ldb .empty{background:#f0fdf4;border:1px dashed #86efac;border-radius:8px;padding:30px;text-align:center;color:#15803d;font-size:13px}' +
            '.ldb .footnote{text-align:center;padding:14px;font-size:11px;color:#94a3b8}' +
            '.ldb .footnote a{color:#2563eb;cursor:pointer;text-decoration:underline}';
        document.head.appendChild(s);
    }

    $(wrapper).find('.page-content').html(
        '<div class="ldb">' +
        '<div class="head">' +
        '<div><h2>Daily status board</h2>' +
        '<p>All active shipments — change status & type today\'s note inline · saving creates a daily-update entry on each request</p></div>' +
        '<div class="ctrls">' +
        '<label style="font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:6px"><input type="checkbox" id="ldb-show-closed"> show closed</label>' +
        '<a class="btn-new" href="/app/logistics-request/new">+ New request</a>' +
        '</div></div>' +
        '<div class="save-bar clean" id="ldb-save-bar">' +
        '<span id="ldb-save-msg">✓ All changes saved</span>' +
        '<button id="ldb-save-btn" disabled>💾 Save all changes</button>' +
        '</div>' +
        '<div id="ldb-body"><div style="text-align:center;padding:40px;color:#94a3b8">Loading...</div></div>' +
        '</div>'
    );

    var dirty_state = {};

    function load_board() {
        var show_closed = document.getElementById('ldb-show-closed').checked ? 1 : 0;
        frappe.call({
            method: 'project_dashboard.project_dashboard.page.logistics_daily_board.logistics_daily_board.get_board_data',
            args: {show_closed: show_closed},
            callback: function(r) {
                if (r.message) render(r.message);
            }
        });
    }

    function esc(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function status_color(s) {
        var m = {
            'Planned': '#94a3b8', 'Quotes Received': '#fbbf24',
            'Awaiting GM Approval': '#f59e0b', 'Rate Approved': '#10b981',
            'Rate Rejected': '#dc2626', 'PO Issued': '#3b82f6',
            'Dispatched': '#8b5cf6', 'In Transit': '#8b5cf6',
            'Customs Clearance': '#fb923c', 'Pending Documents': '#fb923c',
            'On Hold': '#ef4444', 'Delivered': '#16a34a', 'Cancelled': '#94a3b8',
        };
        return m[s] || '#94a3b8';
    }

    function render(data) {
        var body = document.getElementById('ldb-body');
        if (!data.projects || !data.projects.length) {
            body.innerHTML = '<div class="empty">No active shipments. Click "+ New request" to raise one.</div>';
            return;
        }

        var status_opts_html = (data.status_options || []).map(function(s) {
            return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
        }).join('');

        var html = '';
        data.projects.forEach(function(grp) {
            var pm = grp.project || {};
            var pname = pm.name || '(no project)';
            var ptitle = pm.project_name ? (esc(pname) + ' — ' + esc(pm.project_name)) : esc(pname);

            html += '<div class="proj">';
            html += '<div class="proj-head" data-toggle="proj">' +
                '<div><span class="caret">▼</span><span class="name">' + ptitle + '</span>' +
                '<span class="count">' + grp.total_rows + ' shipment' + (grp.total_rows === 1 ? '' : 's') + '</span></div>' +
                '<div class="right">' + (grp.status_groups || []).map(function(sg) {
                    return esc(sg.status) + ' (' + sg.rows.length + ')';
                }).join(' · ') + '</div>' +
                '</div>';

            html += '<div class="proj-body">';
            (grp.status_groups || []).forEach(function(sg) {
                html += '<div class="sg-head"><span class="sg-bar" style="background:' + status_color(sg.status) + '"></span>' +
                    esc(sg.status) + ' (' + sg.rows.length + ')</div>';

                html += '<table>' +
                    '<thead><tr>' +
                    '<th style="width:100px">Request</th>' +
                    '<th>Shipment</th>' +
                    '<th style="width:90px">ETA</th>' +
                    '<th style="width:170px">Status</th>' +
                    '<th>Today\'s update</th>' +
                    '</tr></thead><tbody>';

                sg.rows.forEach(function(r) {
                    var name = r.name;
                    var url = '/app/logistics-request/' + encodeURIComponent(name);
                    var route_meta = [];
                    if (r.loading_place || r.delivery_place) {
                        route_meta.push(esc(r.loading_place || '?') + ' → ' + esc(r.delivery_place || '?'));
                    }
                    if (r.shipping_mode) route_meta.push(esc(r.shipping_mode));
                    if (r.tracking_number) route_meta.push(esc(r.tracking_number));
                    if (r.po_number && !r.tracking_number) route_meta.push('PO ' + esc(r.po_number));
                    var meta = route_meta.join(' · ');
                    var urgency_html = r.urgency && r.urgency !== 'Normal'
                        ? '<span class="urg urg-' + esc(r.urgency) + '">' + esc(r.urgency) + '</span>' : '';
                    var eta = r.expected_delivery_date || '';
                    if (r.status === 'Delivered' && r.delivered_on) {
                        eta = esc(r.delivered_on) + ' ✓';
                    }
                    var row_cls = r.status === 'Delivered' ? 'row-delivered' : '';

                    var sel_html = '<select class="status-sel" data-name="' + esc(name) + '">' +
                        status_opts_html.replace(
                            'value="' + esc(r.status || 'Planned') + '"',
                            'value="' + esc(r.status || 'Planned') + '" selected'
                        ) + '</select>';

                    html += '<tr class="' + row_cls + '" data-name="' + esc(name) + '">' +
                        '<td><a class="lr-link" href="' + url + '">' + esc(name) + ' ↗</a></td>' +
                        '<td><div class="ship-name">' + esc(r.shipment_reference || '—') + urgency_html + '</div>' +
                        (meta ? '<div class="meta">' + meta + '</div>' : '') + '</td>' +
                        '<td>' + esc(eta || '—') + '</td>' +
                        '<td>' + sel_html + '</td>' +
                        '<td><input class="update-input" data-name="' + esc(name) + '" placeholder="Type today\'s note..." value=""></td>' +
                        '</tr>';
                });
                html += '</tbody></table>';
            });
            html += '</div></div>';
        });

        html += '<div class="footnote">Showing ' + data.total_visible + ' shipments · ' +
            'Delivered shipments hidden after 7 days · ' +
            'Click "+ New request" to raise a new one</div>';

        body.innerHTML = html;
        wire_events();
    }

    function wire_events() {
        // Project collapse
        document.querySelectorAll('.proj-head').forEach(function(h) {
            h.addEventListener('click', function() {
                h.classList.toggle('collapsed');
                var b = h.nextElementSibling;
                if (b) b.style.display = h.classList.contains('collapsed') ? 'none' : 'block';
            });
        });

        // Track edits
        document.querySelectorAll('.status-sel, .update-input').forEach(function(el) {
            el.addEventListener('change', mark_dirty);
            el.addEventListener('input', mark_dirty);
        });
    }

    function mark_dirty(e) {
        var name = e.target.dataset.name;
        if (!name) return;
        var row = e.target.closest('tr');
        if (row) row.classList.add('dirty');
        dirty_state[name] = dirty_state[name] || {};
        if (e.target.classList.contains('status-sel')) {
            dirty_state[name].status = e.target.value;
        } else if (e.target.classList.contains('update-input')) {
            dirty_state[name].update_text = e.target.value;
        }
        dirty_state[name].name = name;
        update_save_bar();
    }

    function update_save_bar() {
        var n = Object.keys(dirty_state).length;
        var bar = document.getElementById('ldb-save-bar');
        var btn = document.getElementById('ldb-save-btn');
        var msg = document.getElementById('ldb-save-msg');
        if (n > 0) {
            bar.classList.remove('clean');
            msg.innerHTML = '<b>' + n + '</b> unsaved change' + (n === 1 ? '' : 's');
            btn.disabled = false;
        } else {
            bar.classList.add('clean');
            msg.innerHTML = '✓ All changes saved';
            btn.disabled = true;
        }
    }

    document.getElementById('ldb-save-btn').addEventListener('click', function() {
        var changes = Object.values(dirty_state);
        if (!changes.length) return;
        frappe.call({
            method: 'project_dashboard.project_dashboard.doctype.logistics_request.logistics_request.daily_board_save',
            args: {changes: JSON.stringify(changes)},
            freeze: true,
            freeze_message: __('Saving...'),
            callback: function(r) {
                if (r.message && r.message.ok) {
                    frappe.show_alert({message: __('Saved {0} change(s)', [r.message.saved]), indicator: 'green'});
                    dirty_state = {};
                    load_board();
                }
            }
        });
    });

    document.getElementById('ldb-show-closed').addEventListener('change', load_board);

    load_board();
};
