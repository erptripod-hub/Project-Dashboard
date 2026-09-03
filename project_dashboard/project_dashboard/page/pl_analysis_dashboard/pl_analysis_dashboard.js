frappe.pages['pl-analysis-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'P&L Analysis Dashboard',
		single_column: true
	});

	var state = {
		company: null,
		currency: '',
		from_date: null,
		to_date: null,
		data: null,
		expanded: {},
		all_open: false
	};

	page.add_inner_button('Refresh', function() {
		load();
	});

	inject_styles();
	render_shell();
	bind_shell();
	init_defaults();

	// ------------------------------------------------------------ styles

	function inject_styles() {
		if (document.getElementById('pla-style')) return;
		var s = document.createElement('style');
		s.id = 'pla-style';
		s.textContent = [
			'.pla{padding:18px;margin:-15px;background:#f5f7f9;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1b1c1e}',
			'.pla *{box-sizing:border-box}',
			'.pla-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}',
			'.pla-f{display:flex;flex-direction:column;gap:4px}',
			'.pla-f label{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#8c9199;font-weight:600}',
			'.pla-f select,.pla-f input{border:1px solid #ccd2d9;border-radius:6px;padding:6px 9px;font-size:12.5px;background:#fff;min-width:150px;height:32px}',
			'.pla-f select:focus,.pla-f input:focus{outline:none;border-color:#185fa5}',
			'.pla-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}',
			'.pla-kpi{background:#fff;border:1px solid #e3e6ea;border-radius:8px;padding:12px 14px}',
			'.pla-kpi .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#5c6066;font-weight:600}',
			'.pla-kpi .v{font-size:22px;font-weight:600;margin-top:4px;letter-spacing:-.02em}',
			'.pla-kpi .p{font-size:11px;color:#8c9199;margin-top:1px}',
			'.pla-kpi .v.neg{color:#a32d2d}',
			'.pla-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;margin-bottom:14px}',
			'.pla-card{background:#fff;border:1px solid #e3e6ea;border-radius:8px;padding:13px 15px}',
			'.pla-card.klik{cursor:pointer}',
			'.pla-card.klik:hover{border-color:#8c9199}',
			'.pla-ch{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
			'.pla-ct{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:8px}',
			'.pla-dot{width:3px;height:14px;border-radius:2px;display:inline-block}',
			'.pla-cl{font-size:11px;color:#185fa5}',
			'.pla-cm{font-size:11px;color:#8c9199}',
			'.pla-lg{font-size:12px}',
			'.pla-lg .row{display:flex;justify-content:space-between;gap:10px;padding:3px 0}',
			'.pla-lg .row span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.pla-sw{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:7px}',
			'.pla-panel{background:#fff;border:1px solid #e3e6ea;border-radius:8px;overflow:hidden;margin-bottom:14px}',
			'.pla-pt{display:flex;justify-content:space-between;align-items:baseline;padding:12px 15px;border-bottom:1px solid #e3e6ea}',
			'.pla-pt h2{font-size:12px;font-weight:600;margin:0;text-transform:uppercase;letter-spacing:.05em;color:#5c6066}',
			'.pla-tgl{font-size:11px;color:#185fa5;cursor:pointer}',
			'.pla-scroll{overflow-x:auto}',
			'.pla-tbl{width:100%;border-collapse:collapse;font-size:11.5px;min-width:640px}',
			'.pla-tbl th{font-size:10px;font-weight:600;color:#8c9199;text-transform:uppercase;letter-spacing:.05em;padding:8px 7px;text-align:right;background:#f5f7f9;border-bottom:1px solid #ccd2d9;white-space:nowrap}',
			'.pla-tbl th.l{text-align:left}',
			'.pla-tbl td{padding:7px;text-align:right;border-top:1px solid #e3e6ea;white-space:nowrap}',
			'.pla-tbl td.l{text-align:left;white-space:normal}',
			'.pla-tbl tr.head{cursor:pointer}',
			'.pla-tbl tr.head td{font-weight:600}',
			'.pla-tbl tr.leaf td{color:#5c6066;font-size:11px}',
			'.pla-tbl tr.leaf td.l{padding-left:26px}',
			'.pla-tbl tr.leaf.drill{cursor:pointer;background:#e6f1fb}',
			'.pla-tbl tr.leaf.drill:hover{background:#d9e9f9}',
			'.pla-tbl tr.leaf.drill td{color:#0c447c}',
			'.pla-tbl tr.leaf.gl{cursor:pointer}',
			'.pla-tbl tr.leaf.gl:hover{background:#f5f7f9}',
			'.pla-tbl tr.sum{background:#f5f7f9;font-weight:600}',
			'.pla-tbl tr.sum td{border-top:1px solid #ccd2d9}',
			'.pla-neg{color:#a32d2d}',
			'.pla-tag{display:inline-block;font-size:9.5px;padding:1px 6px;border:1px solid #85b7eb;border-radius:9px;margin-left:6px;color:#185fa5}',
			'.pla-cv{display:inline-block;width:13px;font-size:9px;color:#8c9199}',
			'.pla-foot{padding:9px 15px;font-size:11px;color:#8c9199;border-top:1px solid #e3e6ea}',
			'.pla-ob{background:#fff;border:1px solid #e3e6ea;border-radius:8px;padding:14px 15px;margin-bottom:14px}',
			'.pla-obf{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:12px}',
			'.pla-obf .l{font-size:11px;color:#5c6066}',
			'.pla-obf .v{font-size:18px;font-weight:600;margin-top:2px}',
			'.pla-obf .p{font-size:10.5px;color:#8c9199}',
			'.pla-note{background:#faeeda;color:#854f0b;border-radius:8px;padding:11px 14px;font-size:11.5px;margin-bottom:14px}',
			'.pla-empty{padding:26px;text-align:center;color:#8c9199;font-size:12.5px}',
			'.pla-prow{display:flex;padding:7px 0;border-top:1px solid #e3e6ea;font-size:12.5px;align-items:baseline}',
			'.pla-prow .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.pla-prow .c{width:56px;text-align:right;font-size:10.5px;color:#8c9199}',
			'.pla-prow .v{width:96px;text-align:right}',
			'.pla-prow .p{width:48px;text-align:right;font-size:11px;color:#8c9199}',
			'.pla-prow.warn{background:#faeeda;padding-left:8px;padding-right:8px;border-radius:4px}',
			'.pla-prow.warn .n,.pla-prow.warn .v,.pla-prow.warn .c,.pla-prow.warn .p{color:#854f0b}',
			'.pla-prow.tot{border-top:1px solid #ccd2d9;font-weight:600}',
			'.pla-pbar{height:4px;background:#f5f7f9;border-radius:2px;overflow:hidden}',
			'.pla-pbar i{display:block;height:100%;border-radius:2px}',
			'.pla-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}',
			'.pla-tab{padding:5px 11px;border-radius:16px;border:1px solid #ccd2d9;background:#fff;color:#5c6066;font-size:12px;cursor:pointer}',
			'.pla-tab.on{background:#e6f1fb;color:#0c447c;border-color:#85b7eb;font-weight:500}'
		].join('');
		document.head.appendChild(s);
	}

	// ------------------------------------------------------------ shell

	function render_shell() {
		var h = '';
		h += '<div class="pla">';
		h += '<div class="pla-bar">';
		h += '<div class="pla-f"><label>Company</label><select id="pla-company"></select></div>';
		h += '<div class="pla-f"><label>From date</label><input type="date" id="pla-from"></div>';
		h += '<div class="pla-f"><label>To date</label><input type="date" id="pla-to"></div>';
		h += '<div class="pla-f"><label>Cost center</label><select id="pla-cc"><option value="">All</option></select></div>';
		h += '<div class="pla-f"><label>&nbsp;</label><button class="btn btn-primary btn-sm" id="pla-go" style="height:32px">Show</button></div>';
		h += '</div>';
		h += '<div id="pla-body"><div class="pla-empty">Select a company and date range, then choose Show.</div></div>';
		h += '</div>';
		$(wrapper).find('.page-content').html(h);
	}

	function bind_shell() {
		$(wrapper).find('#pla-go').on('click', function() {
			load();
		});
		$(wrapper).find('#pla-company').on('change', function() {
			load_cost_centers();
		});
	}

	function init_defaults() {
		var today = frappe.datetime.get_today();
		var year_start = today.slice(0, 4) + '-01-01';
		$(wrapper).find('#pla-from').val(year_start);
		$(wrapper).find('#pla-to').val(today);

		frappe.call({
			method: 'project_dashboard.project_dashboard.page.pl_analysis_dashboard.pl_analysis_dashboard.get_companies',
			callback: function(r) {
				var list = (r && r.message) ? r.message : [];
				var opts = '';
				for (var i = 0; i < list.length; i++) {
					opts += '<option value="' + esc(list[i].name) + '">' + esc(list[i].name) + '</option>';
				}
				$(wrapper).find('#pla-company').html(opts);
				if (list.length) {
					var def = frappe.defaults.get_user_default('Company');
					if (def) {
						$(wrapper).find('#pla-company').val(def);
					}
					load_cost_centers();
				}
			}
		});
	}

	function load_cost_centers() {
		var company = $(wrapper).find('#pla-company').val();
		if (!company) return;
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Cost Center',
				filters: { company: company, is_group: 0, disabled: 0 },
				fields: ['name'],
				limit_page_length: 0,
				order_by: 'name asc'
			},
			callback: function(r) {
				var list = (r && r.message) ? r.message : [];
				var opts = '<option value="">All</option>';
				for (var i = 0; i < list.length; i++) {
					opts += '<option value="' + esc(list[i].name) + '">' + esc(list[i].name) + '</option>';
				}
				$(wrapper).find('#pla-cc').html(opts);
			}
		});
	}

	// ------------------------------------------------------------ load

	function load() {
		state.company = $(wrapper).find('#pla-company').val();
		state.from_date = $(wrapper).find('#pla-from').val();
		state.to_date = $(wrapper).find('#pla-to').val();
		var cc = $(wrapper).find('#pla-cc').val();

		if (!state.company) {
			frappe.msgprint(__('Select a company'));
			return;
		}
		if (!state.from_date || !state.to_date) {
			frappe.msgprint(__('Select a date range'));
			return;
		}
		if (state.from_date > state.to_date) {
			frappe.msgprint(__('From Date cannot be after To Date'));
			return;
		}

		$(wrapper).find('#pla-body').html('<div class="pla-empty">Loading...</div>');

		frappe.call({
			method: 'project_dashboard.project_dashboard.page.pl_analysis_dashboard.pl_analysis_dashboard.get_pl_data',
			args: {
				company: state.company,
				from_date: state.from_date,
				to_date: state.to_date,
				cost_center: cc || null
			},
			callback: function(r) {
				if (!r || !r.message) {
					$(wrapper).find('#pla-body').html('<div class="pla-empty">No data returned.</div>');
					return;
				}
				state.data = r.message;
				state.currency = r.message.currency || '';
				state.expanded = {};
				state.all_open = false;
				render_body();
				load_order_book();
			},
			error: function() {
				$(wrapper).find('#pla-body').html('<div class="pla-empty">Could not load data.</div>');
			}
		});
	}

	function load_order_book() {
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.pl_analysis_dashboard.pl_analysis_dashboard.get_order_book',
			args: {
				company: state.company,
				from_date: state.from_date,
				to_date: state.to_date
			},
			callback: function(r) {
				if (!r || !r.message) return;
				render_order_book(r.message);
			}
		});
	}

	// ------------------------------------------------------------ render

	function render_body() {
		var d = state.data;
		var t = d.totals;
		var m = d.margins;
		var h = '';

		if (!d.months.length) {
			$(wrapper).find('#pla-body').html('<div class="pla-empty">No months in the selected range.</div>');
			return;
		}

		h += '<div class="pla-kpis">';
		h += kpi('Total income', t.income.total, '', false);
		h += kpi('Gross profit', t.gross_profit.total, fmt_pct(m.gross) + ' margin', t.gross_profit.total < 0);
		h += kpi('Total expense', t.total_expense.total, fmt_pct(m.expense_ratio) + ' of income', false);
		h += kpi('Net profit', t.net_profit.total, fmt_pct(m.net) + ' margin', t.net_profit.total < 0);
		h += '</div>';

		h += '<div id="pla-obwrap"></div>';

		h += '<div class="pla-cards">';
		h += card('income', 'Income', '#0f6e56', head_by_key('income'), true);
		h += card('cogs', 'Cost of goods sold', '#534ab7', head_by_key('cogs'), true);
		h += card('direct', 'Direct expenses', '#993c1d', head_by_key('direct'), true);
		h += card('indirect', 'Indirect expenses', '#5f5e5a', head_by_key('indirect'), false);
		h += '</div>';

		h += '<div class="pla-panel">';
		h += '<div class="pla-pt"><h2>All ledgers</h2><span class="pla-tgl" id="pla-tgl">Expand all</span></div>';
		h += '<div class="pla-scroll">' + ledger_table() + '</div>';
		h += '<div class="pla-foot">Click a head to expand. Rows shaded blue open a detailed split.</div>';
		h += '</div>';

		if (!d.has_payroll_map) {
			h += '<div class="pla-note">No salary component is mapped to an expense account for this company, so the salary split is not available.</div>';
		}

		$(wrapper).find('#pla-body').html(h);
		bind_body();
	}

	function head_by_key(key) {
		var heads = state.data.heads || [];
		for (var i = 0; i < heads.length; i++) {
			if (heads[i].key === key) return heads[i];
		}
		return { key: key, label: key, months: [], total: 0, accounts: [] };
	}

	function kpi(label, value, sub, neg) {
		var h = '<div class="pla-kpi"><div class="l">' + esc(label) + '</div>';
		h += '<div class="v' + (neg ? ' neg' : '') + '">' + fmt_m(value) + '</div>';
		if (sub) h += '<div class="p">' + esc(sub) + '</div>';
		h += '</div>';
		return h;
	}

	function card(key, label, colour, head, clickable) {
		var shades = {
			income: ['#0f6e56', '#1d9e75', '#5dcaa5', '#9fe1cb'],
			cogs: ['#534ab7', '#7f77dd', '#afa9ec', '#cecbf6'],
			direct: ['#993c1d', '#d85a30', '#f0997b', '#f5c4b3'],
			indirect: ['#444441', '#5f5e5a', '#888780', '#d3d1c7']
		};
		var pal = shades[key] || shades.indirect;
		var accounts = head.accounts || [];
		var top = accounts.slice(0, 3);
		var rest = 0;
		for (var i = 3; i < accounts.length; i++) rest += flt(accounts[i].total);

		var h = '<div class="pla-card' + (clickable ? ' klik' : '') + '" data-card="' + esc(key) + '">';
		h += '<div class="pla-ch"><div class="pla-ct"><span class="pla-dot" style="background:' + colour + '"></span>' + esc(label) + '</div>';
		h += clickable ? '<span class="pla-cl">View in detail</span>' : '<span class="pla-cm">' + fmt_m(head.total) + '</span>';
		h += '</div><div class="pla-lg">';

		if (!accounts.length) {
			h += '<div class="row" style="color:#8c9199"><span>No entries in this period</span><span>0</span></div>';
		} else {
			for (var j = 0; j < top.length; j++) {
				h += '<div class="row"><span><i class="pla-sw" style="background:' + pal[j] + '"></i>' + esc(short_acc(top[j].account)) + '</span><b>' + fmt_m(top[j].total) + '</b></div>';
			}
			if (rest) {
				h += '<div class="row" style="color:#5c6066"><span><i class="pla-sw" style="background:' + pal[3] + '"></i>Other accounts</span><b>' + fmt_m(rest) + '</b></div>';
			}
		}
		h += '</div></div>';
		return h;
	}

	function ledger_table() {
		var d = state.data;
		var months = d.months || [];
		var t = d.totals;
		var order = ['income', 'cogs', 'direct', 'indirect'];
		var bg = { income: '#e1f5ee', cogs: '#eeedfe', direct: '#faece7', indirect: '#f1efe8' };
		var fg = { income: '#04342c', cogs: '#26215c', direct: '#4a1b0c', indirect: '#2c2c2a' };

		var h = '<table class="pla-tbl"><thead><tr><th class="l">Account</th>';
		for (var i = 0; i < months.length; i++) {
			h += '<th>' + esc(months[i].label) + '</th>';
		}
		h += '<th>Total</th></tr></thead><tbody>';

		for (var k = 0; k < order.length; k++) {
			var key = order[k];
			var head = head_by_key(key);
			var open = !!state.expanded[key];

			h += '<tr class="head" data-head="' + esc(key) + '" style="background:' + bg[key] + '">';
			h += '<td class="l" style="color:' + fg[key] + '"><span class="pla-cv">' + (open ? '&#9660;' : '&#9654;') + '</span>' + esc(head.label) + '</td>';
			for (var mi = 0; mi < months.length; mi++) {
				h += '<td style="color:' + fg[key] + '">' + fmt(head.months[mi]) + '</td>';
			}
			h += '<td style="color:' + fg[key] + '">' + fmt(head.total) + '</td></tr>';

			if (open) {
				var accounts = head.accounts || [];
				if (!accounts.length) {
					h += '<tr class="leaf"><td class="l" colspan="' + (months.length + 2) + '">No entries</td></tr>';
				}
				for (var a = 0; a < accounts.length; a++) {
					var acc = accounts[a];
					var drill = acc.drill;
					h += '<tr class="leaf' + (drill ? ' drill' : ' gl') + '"';
					if (drill) h += ' data-drill="' + esc(drill) + '"';
					h += ' data-account="' + esc(acc.account) + '"';
					h += '><td class="l">' + esc(short_acc(acc.account));
					if (drill) h += '<span class="pla-tag">' + esc(drill_label(drill)) + '</span>';
					h += '</td>';
					for (var mj = 0; mj < months.length; mj++) {
						h += '<td>' + fmt(acc.months[mj]) + '</td>';
					}
					h += '<td>' + fmt(acc.total) + '</td></tr>';
				}
			}

			if (key === 'direct') {
				h += sum_row('Gross profit', t.gross_profit, months.length);
			}
		}

		h += sum_row('Total expense', t.total_expense, months.length);
		h += sum_row('Net profit', t.net_profit, months.length);
		h += '</tbody></table>';
		return h;
	}

	function sum_row(label, series, n) {
		var h = '<tr class="sum"><td class="l">' + esc(label) + '</td>';
		for (var i = 0; i < n; i++) {
			h += '<td' + (series.months[i] < 0 ? ' class="pla-neg"' : '') + '>' + fmt(series.months[i]) + '</td>';
		}
		h += '<td' + (series.total < 0 ? ' class="pla-neg"' : '') + '>' + fmt(series.total) + '</td></tr>';
		return h;
	}

	function render_order_book(ob) {
		var o = ob.open || {};
		var c = ob.closed || {};
		var h = '<div class="pla-ob">';
		h += '<div class="pla-pt" style="padding:0 0 10px 0;border:none"><h2>Sales orders &mdash; order book</h2>';
		h += '<span class="pla-cm">' + o.orders + ' open orders, closed excluded</span></div>';
		h += '<div class="pla-obf">';
		h += '<div><div class="l">Order book</div><div class="v">' + fmt_m(o.value) + '</div><div class="p">' + o.orders + ' orders</div></div>';
		h += '<div><div class="l">Invoiced against orders</div><div class="v">' + fmt_m(o.billed) + '</div><div class="p">' + fmt_pct(o.pct_billed) + ' billed</div></div>';
		h += '<div><div class="l">Not yet invoiced</div><div class="v">' + fmt_m(o.unbilled) + '</div><div class="p">work sold, still to bill</div></div>';
		h += '<div><div class="l">Average order</div><div class="v">' + fmt_m(o.average) + '</div><div class="p">across open orders</div></div>';
		h += '</div>';
		if (c.orders) {
			h += '<div class="pla-foot" style="border-top:1px solid #e3e6ea;margin-top:12px;padding:9px 0 0 0">';
			h += c.orders + ' closed orders excluded, value ' + fmt(c.value) + ', of which ' + fmt(c.unbilled) + ' was never billed.';
			h += '</div>';
		}
		h += '<div class="pla-foot" style="padding:9px 0 0 0;border:none">Order value is not income. An order becomes income only when it is invoiced.</div>';
		h += '</div>';
		$(wrapper).find('#pla-obwrap').html(h);
	}

	// ------------------------------------------------------------ events

	function bind_body() {
		$(wrapper).find('#pla-tgl').on('click', function() {
			state.all_open = !state.all_open;
			var keys = ['income', 'cogs', 'direct', 'indirect'];
			for (var i = 0; i < keys.length; i++) {
				state.expanded[keys[i]] = state.all_open;
			}
			refresh_ledgers();
			$(wrapper).find('#pla-tgl').text(state.all_open ? 'Collapse all' : 'Expand all');
		});

		$(wrapper).find('tr.head').on('click', function() {
			var key = $(this).attr('data-head');
			state.expanded[key] = !state.expanded[key];
			refresh_ledgers();
		});

		$(wrapper).find('tr.leaf.drill').on('click', function(e) {
			e.stopPropagation();
			open_drill($(this).attr('data-drill'), $(this).attr('data-account'));
		});

		$(wrapper).find('tr.leaf.gl').on('click', function(e) {
			e.stopPropagation();
			open_gl($(this).attr('data-account'));
		});

		$(wrapper).find('.pla-card.klik').on('click', function() {
			var key = $(this).attr('data-card');
			if (key === 'income') open_drill('customer_group', null);
			else if (key === 'cogs') open_drill('supplier_group', null);
			else if (key === 'direct') open_drill('cost_center', null);
		});
	}

	function refresh_ledgers() {
		$(wrapper).find('.pla-panel .pla-scroll').html(ledger_table());
		$(wrapper).find('tr.head').on('click', function() {
			var key = $(this).attr('data-head');
			state.expanded[key] = !state.expanded[key];
			refresh_ledgers();
		});
		$(wrapper).find('tr.leaf.drill').on('click', function(e) {
			e.stopPropagation();
			open_drill($(this).attr('data-drill'), $(this).attr('data-account'));
		});
		$(wrapper).find('tr.leaf.gl').on('click', function(e) {
			e.stopPropagation();
			open_gl($(this).attr('data-account'));
		});
	}

	// ------------------------------------------------------------ drills

	function drill_label(kind) {
		if (kind === 'customer_group') return 'customer group';
		if (kind === 'supplier_group') return 'supplier group';
		if (kind === 'cost_center') return 'cost center';
		return kind;
	}

	function drill_config(kind) {
		if (kind === 'customer_group') {
			return {
				title: 'Income',
				method: 'get_income_split',
				colour: '#0f6e56',
				tabs: [
					{ k: 'customer_group', label: 'Customer group' },
					{ k: 'customer', label: 'Customer' },
					{ k: 'project', label: 'Project' },
					{ k: 'month', label: 'Month' }
				]
			};
		}
		if (kind === 'supplier_group') {
			return {
				title: 'Cost of goods sold',
				method: 'get_cogs_split',
				colour: '#534ab7',
				tabs: [
					{ k: 'supplier_group', label: 'Supplier group' },
					{ k: 'supplier', label: 'Supplier' },
					{ k: 'month', label: 'Month' }
				]
			};
		}
		return {
			title: 'Salary and payroll',
			method: 'get_salary_split',
			colour: '#993c1d',
			tabs: [
				{ k: 'cost_center', label: 'Cost center' },
				{ k: 'month', label: 'Month' }
			]
		};
	}

	function open_drill(kind, account) {
		var cfg = drill_config(kind);
		var d = new frappe.ui.Dialog({
			title: cfg.title,
			size: 'large'
		});
		d.show();
		d.$wrapper.find('.modal-body').html('<div class="pla"><div id="pla-drill" style="margin:0;padding:0"></div></div>');
		draw_drill(d, cfg, cfg.tabs[0].k, account);
	}

	function draw_drill(dialog, cfg, mode, account) {
		var box = dialog.$wrapper.find('#pla-drill');
		box.html('<div class="pla-empty">Loading...</div>');

		frappe.call({
			method: 'project_dashboard.project_dashboard.page.pl_analysis_dashboard.pl_analysis_dashboard.' + cfg.method,
			args: {
				company: state.company,
				from_date: state.from_date,
				to_date: state.to_date,
				mode: mode
			},
			callback: function(r) {
				var res = (r && r.message) ? r.message : { rows: [], total: 0 };
				var h = '';

				h += '<div style="font-size:11.5px;color:#5c6066;margin-bottom:10px">';
				h += esc(state.company) + ' &middot; ' + esc(state.from_date) + ' to ' + esc(state.to_date);
				if (account) h += ' &middot; ' + esc(short_acc(account));
				h += ' &middot; ' + esc(state.currency) + ' ' + fmt(res.total);
				h += '</div>';

				h += '<div class="pla-tabs">';
				for (var i = 0; i < cfg.tabs.length; i++) {
					h += '<span class="pla-tab' + (cfg.tabs[i].k === mode ? ' on' : '') + '" data-mode="' + esc(cfg.tabs[i].k) + '">' + esc(cfg.tabs[i].label) + '</span>';
				}
				h += '</div>';

				if (res.message) {
					h += '<div class="pla-note">' + esc(res.message) + '</div>';
				}

				if (!res.rows.length) {
					h += '<div class="pla-empty">No entries in this period.</div>';
				} else {
					for (var j = 0; j < res.rows.length; j++) {
						var row = res.rows[j];
						h += '<div class="pla-prow' + (row.warn ? ' warn' : '') + '">';
						h += '<span class="n">' + esc(row.label) + '</span>';
						h += '<span class="c">' + (row.count ? row.count + ' ' + esc(res.unit || '') : '') + '</span>';
						h += '<span class="v"' + (row.amount < 0 ? ' style="color:#a32d2d"' : '') + '>' + fmt(row.amount) + '</span>';
						h += '<span class="p">' + fmt_pct(row.pct) + '</span>';
						h += '</div>';
						if (!row.warn && row.pct > 0) {
							h += '<div class="pla-pbar"><i style="width:' + Math.min(100, row.pct).toFixed(1) + '%;background:' + cfg.colour + '"></i></div>';
						}
					}
					h += '<div class="pla-prow tot"><span class="n">Total</span><span class="c"></span>';
					h += '<span class="v">' + fmt(res.total) + '</span><span class="p">100%</span></div>';
				}

				box.html(h);
				box.find('.pla-tab').on('click', function() {
					draw_drill(dialog, cfg, $(this).attr('data-mode'), account);
				});
			},
			error: function() {
				box.html('<div class="pla-empty">Could not load the split.</div>');
			}
		});
	}

	function open_gl(account) {
		if (!account) return;
		var d = new frappe.ui.Dialog({
			title: short_acc(account),
			size: 'large'
		});
		d.show();
		d.$wrapper.find('.modal-body').html('<div class="pla"><div id="pla-gl" style="margin:0;padding:0"></div></div>');
		var box = d.$wrapper.find('#pla-gl');
		box.html('<div class="pla-empty">Loading...</div>');

		frappe.call({
			method: 'project_dashboard.project_dashboard.page.pl_analysis_dashboard.pl_analysis_dashboard.get_gl_entries',
			args: {
				company: state.company,
				from_date: state.from_date,
				to_date: state.to_date,
				account: account,
				limit: 200
			},
			callback: function(r) {
				var rows = (r && r.message) ? r.message : [];
				if (!rows.length) {
					box.html('<div class="pla-empty">No entries for this account in the selected period.</div>');
					return;
				}
				var h = '<div style="font-size:11.5px;color:#5c6066;margin-bottom:10px">';
				h += esc(state.company) + ' &middot; ' + esc(state.from_date) + ' to ' + esc(state.to_date);
				h += ' &middot; showing ' + rows.length + ' entries, newest first</div>';
				h += '<div class="pla-scroll"><table class="pla-tbl"><thead><tr>';
				h += '<th class="l">Date</th><th class="l">Voucher</th><th class="l">Cost center</th>';
				h += '<th class="l">Project</th><th>Debit</th><th>Credit</th></tr></thead><tbody>';
				for (var i = 0; i < rows.length; i++) {
					var e = rows[i];
					h += '<tr><td class="l">' + esc(frappe.datetime.str_to_user(e.posting_date)) + '</td>';
					h += '<td class="l">' + esc(e.voucher_no) + '</td>';
					h += '<td class="l">' + esc(short_acc(e.cost_center)) + '</td>';
					h += '<td class="l">' + esc(e.project || '') + '</td>';
					h += '<td>' + fmt(e.debit) + '</td><td>' + fmt(e.credit) + '</td></tr>';
				}
				h += '</tbody></table></div>';
				box.html(h);
			},
			error: function() {
				box.html('<div class="pla-empty">Could not load entries.</div>');
			}
		});
	}

	// ------------------------------------------------------------ utils

	function esc(v) {
		if (v === null || v === undefined) return '';
		return frappe.utils.escape_html(String(v));
	}

	function flt(v) {
		var n = parseFloat(v);
		return isNaN(n) ? 0 : n;
	}

	function fmt(v) {
		var n = flt(v);
		if (!n) return '&mdash;';
		return format_number(n, null, 0);
	}

	function fmt_m(v) {
		var n = flt(v);
		var abs = Math.abs(n);
		if (abs >= 1000000) return (n / 1000000).toFixed(2) + ' M';
		if (abs >= 1000) return (n / 1000).toFixed(1) + ' K';
		return format_number(n, null, 0);
	}

	function fmt_pct(v) {
		return flt(v).toFixed(1) + '%';
	}

	function short_acc(name) {
		if (!name) return '';
		var idx = name.lastIndexOf(' - ');
		return idx > 0 ? name.substring(0, idx) : name;
	}
};
