frappe.pages['finance-dashboard'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Finance Dashboard',
		single_column: true
	});

	page.add_inner_button('Refresh', function() {
		if (cur_project) load_dashboard(cur_project);
	});

	var cur_project = null;

	// Inject styles
	if (!document.getElementById('fd-style')) {
		var s = document.createElement('style');
		s.id = 'fd-style';
		s.textContent = `
			.fd{padding:20px;background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);min-height:100vh;margin:-15px;font-family:'Segoe UI',system-ui,sans-serif}
			.fd *{box-sizing:border-box}
			.fd-header{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:14px;padding:20px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;box-shadow:0 4px 20px rgba(30,41,59,0.15)}
			.fd-header h1{font-size:20px;font-weight:800;color:#fff;margin:0}.fd-header h1 span{color:#fbbf24}
			.fd-header p{font-size:12px;color:#94a3b8;margin-top:3px}
			.fd-header-right{display:flex;align-items:center;gap:12px}
			.fd-header select{background:#475569;border:1px solid #64748b;color:#f1f5f9;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:500;min-width:260px;cursor:pointer}
			.fd-header select:focus{outline:none;border-color:#fbbf24}
			.summary-btn{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);border:none;color:#1e293b;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(251,191,36,0.3)}
			.summary-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(251,191,36,0.4)}
			.sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin:20px 0 12px 0;display:flex;align-items:center;gap:8px}
			.sec-title::before{content:'';width:4px;height:16px;background:linear-gradient(180deg,#fbbf24 0%,#f59e0b 100%);border-radius:2px}
			.project-info{background:#fff;border-radius:12px;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;box-shadow:0 2px 10px rgba(0,0,0,0.04);border-left:4px solid #fbbf24}
			.pi-item{display:flex;flex-direction:column;gap:3px}
			.pi-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:600}
			.pi-value{font-size:14px;font-weight:700;color:#1e293b}
			.pi-value.customer{color:#f59e0b}
			.status-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:16px;font-size:11px;font-weight:600}
			.status-badge.on-track{background:#ecfdf5;color:#059669}
			.status-badge.on-track::before{content:'';width:7px;height:7px;background:#10b981;border-radius:50%}
			.status-badge.attention{background:#fef3c7;color:#b45309}
			.status-badge.critical{background:#fef2f2;color:#dc2626}
			.card-grid{display:grid;gap:14px;margin-bottom:10px}
			.card-grid.g4{grid-template-columns:repeat(4,1fr)}
			.card-grid.g3{grid-template-columns:repeat(3,1fr)}
			.card-grid.g2{grid-template-columns:repeat(2,1fr)}
			.card{background:#fff;border-radius:12px;padding:18px 20px;box-shadow:0 2px 10px rgba(0,0,0,0.04);position:relative;overflow:hidden}
			.card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px}
			.card.gold::before{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
			.card.emerald::before{background:linear-gradient(90deg,#10b981,#059669)}
			.card.sky::before{background:linear-gradient(90deg,#0ea5e9,#0284c7)}
			.card.rose::before{background:linear-gradient(90deg,#f43f5e,#e11d48)}
			.card.violet::before{background:linear-gradient(90deg,#8b5cf6,#7c3aed)}
			.card.amber::before{background:linear-gradient(90deg,#f59e0b,#d97706)}
			.card.slate::before{background:linear-gradient(90deg,#64748b,#475569)}
			.card .c-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:10px}
			.card .c-value{font-size:24px;font-weight:800;color:#1e293b;line-height:1}
			.card .c-value.profit{color:#059669}
			.card .c-value.loss{color:#e11d48}
			.card .c-sub{font-size:11px;color:#94a3b8;margin-top:6px}
			.card .c-sub span.up{color:#10b981;font-weight:600}
			.card .c-sub span.down{color:#f43f5e;font-weight:600}
			.progress-wrap{margin-top:12px}
			.progress-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}
			.progress-bar .fill{height:100%;border-radius:4px;transition:width 0.5s ease}
			.progress-bar .fill.gold{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
			.progress-bar .fill.emerald{background:linear-gradient(90deg,#10b981,#059669)}
			.progress-bar .fill.rose{background:linear-gradient(90deg,#f43f5e,#e11d48)}
			.progress-info{display:flex;justify-content:space-between;margin-top:5px;font-size:10px;color:#64748b}
			.panel{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.04);margin-bottom:14px}
			.panel-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:16px;display:flex;align-items:center;gap:10px}
			.panel-title .icon{width:30px;height:30px;background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px}
			.data-table{width:100%;border-collapse:collapse;font-size:12px}
			.data-table thead th{text-align:left;padding:10px 12px;background:#f8fafc;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:2px solid #e2e8f0}
			.data-table tbody td{padding:12px;border-bottom:1px solid #f1f5f9;color:#334155}
			.data-table tbody tr:hover{background:#fefce8}
			.data-table .link{font-weight:700;color:#1e293b}
			.data-table .amt{font-weight:600;text-align:right}
			.data-table .amt.green{color:#059669}
			.data-table .amt.orange{color:#d97706}
			.data-table .amt.red{color:#dc2626}
			.data-table tfoot td{padding:12px;background:#f8fafc;border-top:2px solid #e2e8f0}
			.data-table .total-label{font-weight:700;color:#1e293b;text-align:right}
			.data-table .amt.total{font-size:13px;font-weight:800}
			.status-tag{display:inline-block;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600}
			.status-tag.completed{background:#ecfdf5;color:#059669}
			.status-tag.partial{background:#fef3c7;color:#b45309}
			.status-tag.pending{background:#f1f5f9;color:#64748b}
			.status-tag.overdue{background:#fef2f2;color:#dc2626}
			.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
			.budget-row{display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9}
			.budget-row:last-child{border-bottom:none}
			.budget-row .br-label{width:140px;font-size:12px;font-weight:600;color:#475569}
			.budget-row .br-bar{flex:1;margin:0 16px}
			.budget-row .br-values{display:flex;gap:20px;font-size:12px}
			.budget-row .br-values .bv-item{text-align:right}
			.budget-row .br-values .bv-label{font-size:9px;color:#94a3b8;text-transform:uppercase}
			.budget-row .br-values .bv-val{font-weight:700;color:#1e293b}
			.budget-row .br-values .bv-val.green{color:#059669}
			.budget-row .br-values .bv-val.red{color:#e11d48}
			.tag{display:inline-flex;align-items:center;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600}
			.tag.saved{background:#ecfdf5;color:#059669}
			.tag.exceeded{background:#fef2f2;color:#dc2626}
			.summary-row{background:linear-gradient(135deg,#1e293b 0%,#334155 100%);border-radius:12px;padding:20px 28px;display:flex;justify-content:space-around;align-items:center;margin-top:20px;flex-wrap:wrap;gap:16px}
			.summary-item{text-align:center}
			.summary-item .si-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px}
			.summary-item .si-value{font-size:22px;font-weight:800;color:#fff}
			.summary-item .si-value.gold{color:#fbbf24}
			.summary-item .si-value.green{color:#34d399}
			.summary-item .si-value.red{color:#fb7185}
			.divider-v{width:1px;height:45px;background:#475569}
			.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(4px);z-index:1000;justify-content:center;align-items:center;padding:20px}
			.modal-overlay.active{display:flex}
			.modal-box{background:#fff;border-radius:14px;width:100%;max-width:1300px;max-height:88vh;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.25);animation:modalSlide 0.3s ease}
			@keyframes modalSlide{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
			.modal-header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff}
			.modal-header h2{font-size:16px;font-weight:800;display:flex;align-items:center;gap:10px;margin:0}
			.modal-header h2 span{color:#fbbf24}
			.modal-close{background:#475569;border:none;color:#fff;width:34px;height:34px;border-radius:8px;font-size:18px;cursor:pointer;transition:background 0.2s}
			.modal-close:hover{background:#f43f5e}
			.modal-body{padding:20px 24px;overflow-y:auto;max-height:calc(88vh - 70px)}
			.summary-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:20px}
			.summary-stat{background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-radius:10px;padding:14px 16px;text-align:center;border-left:4px solid #fbbf24}
			.summary-stat .ss-label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:600;margin-bottom:5px}
			.summary-stat .ss-value{font-size:20px;font-weight:800;color:#1e293b}
			.summary-stat .ss-value.gold{color:#f59e0b}
			.summary-stat .ss-value.green{color:#059669}
			.summary-stat .ss-value.red{color:#dc2626}
			.summary-stat .ss-value.orange{color:#d97706}
			.projects-table{width:100%;border-collapse:collapse;font-size:12px}
			.projects-table thead th{text-align:left;padding:12px 10px;background:linear-gradient(135deg,#1e293b 0%,#334155 100%);color:#fff;font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700;position:sticky;top:0}
			.projects-table thead th:first-child{border-radius:8px 0 0 0}
			.projects-table thead th:last-child{border-radius:0 8px 0 0}
			.projects-table tbody td{padding:12px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
			.projects-table tbody tr:hover{background:#fefce8}
			.projects-table .proj-id{font-weight:700;color:#1e293b}
			.projects-table .proj-name{font-weight:600;color:#475569}
			.projects-table .amt{font-weight:600;text-align:right}
			.projects-table .amt.green{color:#059669}
			.projects-table .amt.red{color:#dc2626}
			.projects-table .amt.orange{color:#d97706}
			.projects-table .status-dot{display:inline-flex;align-items:center;gap:6px}
			.projects-table .status-dot::before{content:'';width:8px;height:8px;border-radius:50%}
			.projects-table .status-dot.active::before{background:#10b981}
			.projects-table .status-dot.hold::before{background:#f59e0b}
			.projects-table .status-dot.delayed::before{background:#f43f5e}
			.projects-table tfoot td{padding:12px 10px;background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0}
			.projects-table tfoot .amt{font-size:13px;font-weight:800}
			@media(max-width:1200px){.card-grid.g4{grid-template-columns:repeat(2,1fr)}.summary-stats{grid-template-columns:repeat(3,1fr)}}
			@media(max-width:768px){.card-grid.g4,.card-grid.g3,.card-grid.g2{grid-template-columns:1fr}.two-col{grid-template-columns:1fr}.summary-row{flex-direction:column}.divider-v{display:none}.summary-stats{grid-template-columns:repeat(2,1fr)}}
		`;
		document.head.appendChild(s);
	}

	$(wrapper).find('.page-content').html(`
		<div class="fd">
			<div class="fd-header">
				<div>
					<h1>📊 <span>Finance</span> Dashboard</h1>
					<p>Project Financial Overview & Profitability Analysis</p>
				</div>
				<div class="fd-header-right">
					<button class="summary-btn" onclick="openProjectSummary()">📊 Project Summary</button>
					<select id="fd-project-select">
						<option value="">Select a project...</option>
					</select>
				</div>
			</div>
			<div id="fd-body" style="text-align:center;padding:60px;color:#64748b;font-size:13px">
				Select a project above to load financial data
			</div>
		</div>
		<div class="modal-overlay" id="projectSummaryModal">
			<div class="modal-box">
				<div class="modal-header">
					<h2>📊 <span>All Open Projects</span> — Financial Summary</h2>
					<button class="modal-close" onclick="closeProjectSummary()">✕</button>
				</div>
				<div class="modal-body" id="modal-body">
					<div style="text-align:center;padding:40px;color:#64748b">Loading...</div>
				</div>
			</div>
		</div>
	`);

	// Load projects list
	frappe.db.get_list('Project', {
		fields: ['name', 'project_name'],
		limit: 500,
		filters: {status: ['!=', 'Cancelled']},
		order_by: 'modified desc'
	}).then(function(projects) {
		var sel = document.getElementById('fd-project-select');
		projects.forEach(function(p) {
			var opt = document.createElement('option');
			opt.value = p.name;
			opt.textContent = p.name + ' — ' + p.project_name;
			sel.appendChild(opt);
		});
	});

	document.getElementById('fd-project-select').addEventListener('change', function() {
		if (this.value) {
			cur_project = this.value;
			load_dashboard(cur_project);
		}
	});

	// Modal functions
	window.openProjectSummary = function() {
		document.getElementById('projectSummaryModal').classList.add('active');
		document.body.style.overflow = 'hidden';
		loadProjectSummary();
	};

	window.closeProjectSummary = function() {
		document.getElementById('projectSummaryModal').classList.remove('active');
		document.body.style.overflow = 'auto';
	};

	document.getElementById('projectSummaryModal').addEventListener('click', function(e) {
		if (e.target === this) closeProjectSummary();
	});

	document.addEventListener('keydown', function(e) {
		if (e.key === 'Escape') closeProjectSummary();
	});

	function loadProjectSummary() {
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.finance_dashboard.finance_dashboard.get_all_projects_summary',
			callback: function(r) {
				if (r.message) renderSummaryModal(r.message);
			}
		});
	}

	function renderSummaryModal(data) {
		var t = data.totals;
		var html = `
			<div class="summary-stats">
				<div class="summary-stat">
					<div class="ss-label">Total Projects</div>
					<div class="ss-value gold">${t.project_count}</div>
				</div>
				<div class="summary-stat">
					<div class="ss-label">Total Value</div>
					<div class="ss-value">${fmt(t.project_value)}</div>
				</div>
				<div class="summary-stat">
					<div class="ss-label">Total Cost</div>
					<div class="ss-value orange">${fmt(t.total_cost)}</div>
				</div>
				<div class="summary-stat">
					<div class="ss-label">Total Profit</div>
					<div class="ss-value green">${fmt(t.profit)}</div>
				</div>
				<div class="summary-stat">
					<div class="ss-label">Avg Margin</div>
					<div class="ss-value green">${t.avg_margin}%</div>
				</div>
				<div class="summary-stat">
					<div class="ss-label">Total Outstanding</div>
					<div class="ss-value red">${fmt(t.outstanding)}</div>
				</div>
			</div>
			<table class="projects-table">
				<thead>
					<tr>
						<th>Project No</th>
						<th>Project Name</th>
						<th>Customer</th>
						<th>Start Date</th>
						<th>End Date</th>
						<th>Project Value</th>
						<th>Total Cost</th>
						<th>Profit</th>
						<th>Margin %</th>
						<th>Outstanding</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
		`;

		data.projects.forEach(function(p) {
			var marginCls = p.margin >= 20 ? 'green' : (p.margin >= 10 ? 'orange' : 'red');
			var statusCls = p.status === 'On Track' ? 'active' : (p.status === 'On Hold' ? 'hold' : 'delayed');
			html += `
				<tr>
					<td class="proj-id">${p.name}</td>
					<td class="proj-name">${p.project_name}</td>
					<td>${p.customer}</td>
					<td>${p.start_date}</td>
					<td>${p.end_date}</td>
					<td class="amt">${fmt(p.project_value)}</td>
					<td class="amt orange">${fmt(p.total_cost)}</td>
					<td class="amt ${p.profit >= 0 ? 'green' : 'red'}">${fmt(p.profit)}</td>
					<td class="amt ${marginCls}">${p.margin}%</td>
					<td class="amt red">${fmt(p.outstanding)}</td>
					<td><span class="status-dot ${statusCls}">${p.status}</span></td>
				</tr>
			`;
		});

		html += `
				</tbody>
				<tfoot>
					<tr>
						<td colspan="5" style="text-align:right;font-weight:700">Grand Total</td>
						<td class="amt">${fmt(t.project_value)}</td>
						<td class="amt orange">${fmt(t.total_cost)}</td>
						<td class="amt green">${fmt(t.profit)}</td>
						<td class="amt green">${t.avg_margin}%</td>
						<td class="amt red">${fmt(t.outstanding)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		`;

		document.getElementById('modal-body').innerHTML = html;
	}

	function load_dashboard(project) {
		document.getElementById('fd-body').innerHTML = '<div style="text-align:center;padding:60px;color:#64748b">Loading...</div>';
		frappe.call({
			method: 'project_dashboard.project_dashboard.page.finance_dashboard.finance_dashboard.get_finance_data',
			args: {project: project},
			callback: function(r) {
				if (r.message) render(r.message);
				else document.getElementById('fd-body').innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626">Error loading data.</div>';
			}
		});
	}

	function fmt(v) {
		v = parseFloat(v) || 0;
		if (v >= 1000000) return 'AED ' + (v/1000000).toFixed(2) + 'M';
		if (v >= 1000) return 'AED ' + Math.round(v/1000) + 'K';
		return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:0, maximumFractionDigits:0});
	}

	function fmtFull(v) {
		v = parseFloat(v) || 0;
		return 'AED ' + v.toLocaleString('en-AE', {minimumFractionDigits:0, maximumFractionDigits:0});
	}

	function render(d) {
		var info = d.project_info || {};
		var so = d.sales_orders || {};
		var si = d.sales_invoices || {};
		var prof = d.profitability || {};
		var budget = d.budget_summary || {};
		var plan = d.plan || {};
		var hp = d.has_plan;

		var tlStatus = hp && plan.timeline_status ? plan.timeline_status : 'On Track';
		var tlClass = tlStatus === 'On Track' ? 'on-track' : (tlStatus === 'Critical' || tlStatus === 'Overdue' ? 'critical' : 'attention');

		var html = '';

		// Project Info Bar
		html += `
			<div class="project-info">
				<div class="pi-item">
					<span class="pi-label">Project</span>
					<span class="pi-value">${info.name} — ${info.project_name}</span>
				</div>
				<div class="pi-item">
					<span class="pi-label">Customer</span>
					<span class="pi-value customer">${info.customer || '—'}</span>
				</div>
				<div class="pi-item">
					<span class="pi-label">Start Date</span>
					<span class="pi-value">${hp && plan.start_date ? plan.start_date : (info.expected_start_date || '—')}</span>
				</div>
				<div class="pi-item">
					<span class="pi-label">End Date</span>
					<span class="pi-value">${hp && plan.end_date ? plan.end_date : (info.expected_end_date || '—')}</span>
				</div>
				<div class="pi-item">
					<span class="status-badge ${tlClass}">${tlStatus}</span>
				</div>
			</div>
		`;

		// Sales Orders Section
		html += '<div class="sec-title">Sales Orders</div>';
		html += `
			<div class="card-grid g4">
				<div class="card gold">
					<div class="c-label">Total Sales Orders</div>
					<div class="c-value">${so.count || 0}</div>
					<div class="c-sub">Linked to project</div>
				</div>
				<div class="card sky">
					<div class="c-label">SO Value</div>
					<div class="c-value">${fmt(so.total_value)}</div>
					<div class="c-sub">Total contract value</div>
				</div>
				<div class="card emerald">
					<div class="c-label">Billed Amount</div>
					<div class="c-value">${fmt(so.total_billed)}</div>
					<div class="c-sub"><span class="up">${so.total_value > 0 ? Math.round(so.total_billed / so.total_value * 100) : 0}%</span> of SO value</div>
				</div>
				<div class="card slate">
					<div class="c-label">Pending to Bill</div>
					<div class="c-value">${fmt(so.total_pending)}</div>
					<div class="c-sub">${so.total_value > 0 ? Math.round(so.total_pending / so.total_value * 100) : 0}% remaining</div>
				</div>
			</div>
		`;

		// SO Table
		if (so.list && so.list.length) {
			html += `
				<div class="panel">
					<div class="panel-title"><span class="icon">📋</span> Sales Order Breakdown</div>
					<table class="data-table">
						<thead>
							<tr>
								<th>SO Number</th>
								<th>Date</th>
								<th>Description</th>
								<th>SO Value</th>
								<th>Billed</th>
								<th>Pending</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
			`;
			so.list.forEach(function(s) {
				var stCls = s.status === 'Fully Billed' ? 'completed' : (s.status === 'Partially Billed' ? 'partial' : 'pending');
				html += `
					<tr>
						<td class="link">${s.name}</td>
						<td>${s.date}</td>
						<td style="color:#64748b">${s.description || '—'}</td>
						<td class="amt">${fmtFull(s.value)}</td>
						<td class="amt green">${fmtFull(s.billed)}</td>
						<td class="amt orange">${fmtFull(s.pending)}</td>
						<td><span class="status-tag ${stCls}">${s.status}</span></td>
					</tr>
				`;
			});
			html += `
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3" class="total-label">Total</td>
								<td class="amt total">${fmtFull(so.total_value)}</td>
								<td class="amt total green">${fmtFull(so.total_billed)}</td>
								<td class="amt total orange">${fmtFull(so.total_pending)}</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				</div>
			`;
		}

		// Invoices & Outstanding Section
		html += '<div class="sec-title">Invoices & Outstanding</div>';
		html += `
			<div class="card-grid g3">
				<div class="card violet">
					<div class="c-label">Total Invoiced</div>
					<div class="c-value">${fmt(si.total_value)}</div>
					<div class="c-sub">${si.count || 0} invoices raised</div>
				</div>
				<div class="card emerald">
					<div class="c-label">Amount Received</div>
					<div class="c-value">${fmt(si.total_paid)}</div>
					<div class="c-sub"><span class="up">${si.total_value > 0 ? Math.round(si.total_paid / si.total_value * 100) : 0}%</span> collected</div>
				</div>
				<div class="card rose">
					<div class="c-label">Total Outstanding</div>
					<div class="c-value">${fmt(si.total_outstanding)}</div>
					<div class="c-sub">${si.total_value > 0 ? Math.round(si.total_outstanding / si.total_value * 100) : 0}% pending collection</div>
					<div class="progress-wrap">
						<div class="progress-bar">
							<div class="fill emerald" style="width:${si.total_value > 0 ? Math.round(si.total_paid / si.total_value * 100) : 0}%"></div>
						</div>
						<div class="progress-info">
							<span>Received</span>
							<span>${si.total_value > 0 ? Math.round(si.total_paid / si.total_value * 100) : 0}%</span>
						</div>
					</div>
				</div>
			</div>
		`;

		// SI Table
		if (si.list && si.list.length) {
			html += `
				<div class="panel">
					<div class="panel-title"><span class="icon">🧾</span> Sales Invoice Breakdown</div>
					<table class="data-table">
						<thead>
							<tr>
								<th>Invoice No</th>
								<th>Date</th>
								<th>Against SO</th>
								<th>Invoice Value</th>
								<th>Paid</th>
								<th>Outstanding</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
			`;
			si.list.forEach(function(s) {
				var stCls = s.status === 'Paid' ? 'completed' : (s.status === 'Overdue' ? 'overdue' : 'partial');
				html += `
					<tr>
						<td class="link">${s.name}</td>
						<td>${s.date}</td>
						<td style="color:#64748b">${s.against_so || '—'}</td>
						<td class="amt">${fmtFull(s.value)}</td>
						<td class="amt green">${fmtFull(s.paid)}</td>
						<td class="amt red">${fmtFull(s.outstanding)}</td>
						<td><span class="status-tag ${stCls}">${s.status}</span></td>
					</tr>
				`;
			});
			html += `
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3" class="total-label">Total</td>
								<td class="amt total">${fmtFull(si.total_value)}</td>
								<td class="amt total green">${fmtFull(si.total_paid)}</td>
								<td class="amt total red">${fmtFull(si.total_outstanding)}</td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				</div>
			`;
		}

		// Profitability Section
		html += '<div class="sec-title">Profitability</div>';
		html += `
			<div class="card-grid g4">
				<div class="card gold">
					<div class="c-label">Project Value</div>
					<div class="c-value">${fmt(prof.project_value)}</div>
					<div class="c-sub">Contract amount</div>
				</div>
				<div class="card amber">
					<div class="c-label">Total Cost</div>
					<div class="c-value">${fmt(prof.total_cost)}</div>
					<div class="c-sub">PO + Expenses + Labour</div>
				</div>
				<div class="card ${prof.is_profit ? 'emerald' : 'rose'}">
					<div class="c-label">${prof.is_profit ? 'Profit' : 'Loss'}</div>
					<div class="c-value ${prof.is_profit ? 'profit' : 'loss'}">${fmt(Math.abs(prof.profit))}</div>
					<div class="c-sub"><span class="${prof.is_profit ? 'up' : 'down'}">↑ ${prof.is_profit ? 'Profitable' : 'Loss'}</span></div>
				</div>
				<div class="card ${prof.margin >= 20 ? 'emerald' : (prof.margin >= 10 ? 'amber' : 'rose')}">
					<div class="c-label">Profit Margin</div>
					<div class="c-value ${prof.margin >= 20 ? 'profit' : (prof.margin >= 0 ? '' : 'loss')}">${prof.margin}%</div>
					<div class="c-sub">${prof.margin >= 20 ? 'Healthy margin' : (prof.margin >= 10 ? 'Low margin' : 'Critical')}</div>
				</div>
			</div>
		`;

		// Budget vs Actual Section
		html += '<div class="sec-title">Budget vs Actual</div>';
		html += '<div class="two-col">';

		// Left: Department Budgets
		html += '<div class="panel">';
		html += '<div class="panel-title"><span class="icon">📈</span> Cost Tracking</div>';
		if (hp && plan.department_budgets && plan.department_budgets.length) {
			plan.department_budgets.forEach(function(db) {
				var pct = db.budget_amount > 0 ? Math.min(100, Math.round(db.spent_amount / db.budget_amount * 100)) : 0;
				var variance = db.budget_amount - db.spent_amount;
				var barColor = db.status === 'On Track' ? 'emerald' : (db.status === 'Warning' ? 'gold' : 'rose');
				html += `
					<div class="budget-row">
						<div class="br-label">${db.department_name}</div>
						<div class="br-bar">
							<div class="progress-bar">
								<div class="fill ${barColor}" style="width:${pct}%"></div>
							</div>
						</div>
						<div class="br-values">
							<div class="bv-item">
								<div class="bv-label">Budget</div>
								<div class="bv-val">${fmt(db.budget_amount)}</div>
							</div>
							<div class="bv-item">
								<div class="bv-label">Spent</div>
								<div class="bv-val">${fmt(db.spent_amount)}</div>
							</div>
							<div class="bv-item">
								<div class="bv-label">Variance</div>
								<div class="bv-val ${variance >= 0 ? 'green' : 'red'}">${variance >= 0 ? '+' : ''}${fmt(variance)} ${variance >= 0 ? '✓' : '✗'}</div>
							</div>
						</div>
					</div>
				`;
			});
		} else {
			html += '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:12px">No budgets defined in Project Plan</div>';
		}
		html += '</div>';

		// Right: Budget Summary
		html += '<div class="panel">';
		html += '<div class="panel-title"><span class="icon">💰</span> Budget Summary</div>';
		html += `
			<div class="card-grid g2" style="margin-bottom:16px">
				<div class="card gold">
					<div class="c-label">Total Budget</div>
					<div class="c-value">${fmt(budget.total_budget)}</div>
				</div>
				<div class="card amber">
					<div class="c-label">Total Spent</div>
					<div class="c-value">${fmt(budget.total_spent)}</div>
				</div>
			</div>
			<div class="card ${budget.is_under_budget ? 'emerald' : 'rose'}">
				<div class="c-label">Total Variance</div>
				<div class="c-value ${budget.is_under_budget ? 'profit' : 'loss'}">${budget.variance >= 0 ? '+' : ''}${fmt(budget.variance)}</div>
				<div class="c-sub">
					<span class="tag ${budget.is_under_budget ? 'saved' : 'exceeded'}">${budget.is_under_budget ? '✓ Under Budget by' : '✗ Over Budget by'} ${Math.abs(budget.variance_percent)}%</span>
				</div>
				<div class="progress-wrap">
					<div class="progress-bar">
						<div class="fill gold" style="width:${budget.total_budget > 0 ? Math.min(100, Math.round(budget.total_spent / budget.total_budget * 100)) : 0}%"></div>
					</div>
					<div class="progress-info">
						<span>${budget.total_budget > 0 ? Math.round(budget.total_spent / budget.total_budget * 100) : 0}% budget utilized</span>
						<span>${Math.abs(budget.variance_percent)}% ${budget.is_under_budget ? 'saved' : 'exceeded'}</span>
					</div>
				</div>
			</div>
		`;
		html += '</div>';
		html += '</div>'; // end two-col

		// Final Summary Bar
		html += `
			<div class="summary-row">
				<div class="summary-item">
					<div class="si-label">Project Value</div>
					<div class="si-value gold">${fmt(prof.project_value)}</div>
				</div>
				<div class="divider-v"></div>
				<div class="summary-item">
					<div class="si-label">Total Cost</div>
					<div class="si-value">${fmt(prof.total_cost)}</div>
				</div>
				<div class="divider-v"></div>
				<div class="summary-item">
					<div class="si-label">Net ${prof.is_profit ? 'Profit' : 'Loss'}</div>
					<div class="si-value ${prof.is_profit ? 'green' : 'red'}">${fmt(Math.abs(prof.profit))}</div>
				</div>
				<div class="divider-v"></div>
				<div class="summary-item">
					<div class="si-label">Margin</div>
					<div class="si-value ${prof.margin >= 0 ? 'green' : 'red'}">${prof.margin}%</div>
				</div>
				<div class="divider-v"></div>
				<div class="summary-item">
					<div class="si-label">Outstanding</div>
					<div class="si-value red">${fmt(d.total_outstanding)}</div>
				</div>
			</div>
		`;

		document.getElementById('fd-body').innerHTML = html;
	}
};
