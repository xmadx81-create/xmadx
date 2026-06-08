let currentUser = null;
let currentPage = 'home';
let editingReportId = null;

// ─── API 헬퍼 ───
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 401) { showLogin(); return null; }
  return res.json();
}

// ─── 인증 ───
async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const user = await api('/api/login', { method: 'POST', body: { email, password } });
  if (user && !user.error) {
    currentUser = user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    navigate('home');
  } else {
    toast('로그인 실패: 이메일/비밀번호를 확인하세요');
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  showLogin();
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appContainer').classList.remove('active');
}

async function checkAuth() {
  const user = await api('/api/me');
  if (user && !user.error) {
    currentUser = user;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    navigate('home');
  }
}

// ─── 네비게이션 ───
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const fab = document.getElementById('fabBtn');
  fab.style.display = ['home', 'reports'].includes(page) ? 'flex' : 'none';

  const titles = { home: '석유사업본부', reports: '업무일지', weekly: '주간계획', franchise: '가맹관리', more: '더보기' };
  document.getElementById('pageTitle').textContent = titles[page] || '석유사업본부';

  const renderers = { home: renderHome, reports: renderReports, weekly: renderWeekly, franchise: renderFranchise, more: renderMore };
  if (renderers[page]) renderers[page]();
}

// ─── 홈 화면 ───
async function renderHome() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const reports = await api(`/api/reports?from=${weekAgo}&to=${today}`) || [];

  const myReports = reports.filter(r => r.author_id === currentUser.id);
  const todayReports = myReports.filter(r => r.report_date === today);

  document.getElementById('mainContent').innerHTML = `
    <div style="margin-bottom:20px;">
      <p style="font-size:14px; color:var(--gray-500);">안녕하세요,</p>
      <p style="font-size:20px; font-weight:600;">${currentUser.name} ${currentUser.position}님</p>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">${todayReports.length}</div>
        <div class="stat-label">오늘 작성</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${myReports.length}</div>
        <div class="stat-label">이번 주</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${myReports.filter(r => r.status === 'approved').length}</div>
        <div class="stat-label">결재완료</div>
      </div>
    </div>

    <p class="section-title">&#9889; 빠른 작성</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="openNewReport('내근')">
        <span class="qa-icon">&#128187;</span>
        <span class="qa-label">내근 업무</span>
      </button>
      <button class="quick-action-btn" onclick="openNewReport('외근')">
        <span class="qa-icon">&#128694;</span>
        <span class="qa-label">외근 업무</span>
      </button>
      <button class="quick-action-btn" onclick="openNewReport('출장')">
        <span class="qa-icon">&#9992;</span>
        <span class="qa-label">출장 보고</span>
      </button>
      <button class="quick-action-btn" onclick="openWeeklyPlan()">
        <span class="qa-icon">&#128197;</span>
        <span class="qa-label">주간계획</span>
      </button>
    </div>

    <p class="section-title">&#128203; 최근 업무일지</p>
    ${reports.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">&#128221;</div>
        <div class="empty-text">작성된 업무일지가 없습니다<br>새 업무일지를 작성해보세요</div>
      </div>
    ` : reports.slice(0, 5).map(r => `
      <div class="list-item" onclick="viewReport('${r.id}')">
        <div class="list-item-content">
          <div class="list-item-title">${escHtml(r.what_task || r.content || '(내용 없음)')}</div>
          <div class="list-item-sub">${r.author_name} &middot; ${r.report_date} &middot; ${r.where_place || ''}</div>
        </div>
        <span class="list-item-badge">
          <span class="badge badge-${r.work_category}">${r.work_category}</span>
        </span>
      </div>
    `).join('')}
  `;
}

// ─── 업무일지 목록 ───
async function renderReports() {
  const reports = await api('/api/reports') || [];
  document.getElementById('mainContent').innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="filterReports(this, '')">전체</button>
      <button class="tab" onclick="filterReports(this, '내근')">내근</button>
      <button class="tab" onclick="filterReports(this, '외근')">외근</button>
      <button class="tab" onclick="filterReports(this, '출장')">출장</button>
    </div>
    <div id="reportsList">
      ${renderReportList(reports)}
    </div>
  `;
}

function renderReportList(reports) {
  if (reports.length === 0) return `<div class="empty-state"><div class="empty-icon">&#128221;</div><div class="empty-text">업무일지가 없습니다</div></div>`;
  return reports.map(r => `
    <div class="list-item" onclick="viewReport('${r.id}')">
      <div class="list-item-content">
        <div class="list-item-title">${escHtml(r.what_task || r.content || '(내용 없음)')}</div>
        <div class="list-item-sub">${r.author_name} ${r.author_position} &middot; ${r.report_date}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <span class="badge badge-${r.work_category}">${r.work_category}</span>
        <span class="badge badge-${r.status}">${statusLabel(r.status)}</span>
      </div>
    </div>
  `).join('');
}

async function filterReports(btn, category) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const url = category ? `/api/reports?category=${category}` : '/api/reports';
  const reports = await api(url) || [];
  document.getElementById('reportsList').innerHTML = renderReportList(reports);
}

// ─── 업무일지 상세보기 ───
async function viewReport(id) {
  const data = await api(`/api/reports/${id}`);
  if (!data) return;

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('reports')" style="margin-bottom:16px;">&larr; 목록</button>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-${data.work_category}">${data.work_category}</span>
        <span class="badge badge-${data.status}">${statusLabel(data.status)}</span>
      </div>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:12px;">
        ${data.author_name} ${data.author_position} &middot; ${data.report_date} &middot; ${data.report_type === 'daily' ? '일일보고' : '주간보고'}
      </p>

      <div class="w5h1-grid" style="margin-bottom:16px;">
        ${w5h1Field('누가', data.who)}
        ${w5h1Field('언제', data.when_time)}
        ${w5h1Field('어디서', data.where_place)}
        ${w5h1Field('무엇을', data.what_task)}
        ${w5h1Field('어떻게', data.how_method)}
        ${w5h1Field('왜', data.why_reason)}
      </div>

      ${data.purpose ? `<p style="margin-bottom:8px;"><strong>목적:</strong> ${escHtml(data.purpose)}</p>` : ''}
      ${data.content ? `<div style="background:var(--gray-50); padding:12px; border-radius:8px; font-size:14px; line-height:1.6; white-space:pre-wrap;">${escHtml(data.content)}</div>` : ''}
    </div>

    ${data.approvals && data.approvals.length > 0 ? `
      <div class="card">
        <p class="card-title" style="margin-bottom:12px;">결재현황</p>
        <div class="approval-flow">
          ${data.approvals.map((a, i) => `
            ${i > 0 ? '<span class="approval-arrow">&rarr;</span>' : ''}
            <div class="approval-step ${a.status}">
              <div class="step-icon">${a.status === 'approved' ? '&#10004;' : a.status === 'rejected' ? '&#10008;' : '&#9679;'}</div>
              <span class="step-name">${a.approver_name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${data.author_id === currentUser.id ? `
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" style="flex:1" onclick="editReport('${data.id}')">수정</button>
        <button class="btn btn-danger" style="flex:1" onclick="deleteReport('${data.id}')">삭제</button>
      </div>
    ` : ''}

    ${data.approvals && data.approvals.find(a => a.approver_id === currentUser.id && a.status === 'pending') ? `
      <div class="card" style="margin-top:12px;">
        <p class="card-title" style="margin-bottom:12px;">결재</p>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-success" style="flex:1" onclick="approveReport('${data.id}', 'approved')">승인</button>
          <button class="btn btn-danger" style="flex:1" onclick="approveReport('${data.id}', 'rejected')">반려</button>
        </div>
      </div>
    ` : ''}
  `;
}

function w5h1Field(label, value) {
  return `<div style="padding:8px; background:var(--gray-50); border-radius:8px;">
    <div style="font-size:11px; color:var(--gray-500); margin-bottom:2px;">${label}</div>
    <div style="font-size:13px;">${escHtml(value || '-')}</div>
  </div>`;
}

// ─── 업무일지 작성/수정 ───
async function openNewReport(category) {
  editingReportId = null;
  document.getElementById('reportModalTitle').textContent = '업무일지 작성';
  document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('reportPurpose').value = '';
  document.getElementById('reportWho').value = currentUser.name;
  document.getElementById('reportWhen').value = '';
  document.getElementById('reportWhere').value = '';
  document.getElementById('reportWhat').value = '';
  document.getElementById('reportHow').value = '';
  document.getElementById('reportWhy').value = '';
  document.getElementById('reportContent').value = '';

  if (category) {
    document.querySelectorAll('[data-field="work_category"]').forEach(c => {
      c.classList.toggle('selected', c.dataset.value === category);
    });
  }

  await loadApprovers();
  await loadTemplates();
  openModal('reportModal');
}

async function editReport(id) {
  const data = await api(`/api/reports/${id}`);
  if (!data) return;
  editingReportId = id;
  document.getElementById('reportModalTitle').textContent = '업무일지 수정';
  document.getElementById('reportDate').value = data.report_date;
  document.getElementById('reportPurpose').value = data.purpose || '';
  document.getElementById('reportWho').value = data.who || '';
  document.getElementById('reportWhen').value = data.when_time || '';
  document.getElementById('reportWhere').value = data.where_place || '';
  document.getElementById('reportWhat').value = data.what_task || '';
  document.getElementById('reportHow').value = data.how_method || '';
  document.getElementById('reportWhy').value = data.why_reason || '';
  document.getElementById('reportContent').value = data.content || '';

  document.querySelectorAll('[data-field="report_type"]').forEach(c => {
    c.classList.toggle('selected', c.dataset.value === data.report_type);
  });
  document.querySelectorAll('[data-field="work_category"]').forEach(c => {
    c.classList.toggle('selected', c.dataset.value === data.work_category);
  });

  await loadApprovers();
  await loadTemplates();
  openModal('reportModal');
}

async function submitReport() {
  const getChipValue = (field) => {
    const sel = document.querySelector(`[data-field="${field}"].selected`);
    return sel ? sel.dataset.value : null;
  };

  const body = {
    report_date: document.getElementById('reportDate').value,
    report_type: getChipValue('report_type'),
    work_category: getChipValue('work_category'),
    purpose: document.getElementById('reportPurpose').value,
    who: document.getElementById('reportWho').value,
    when_time: document.getElementById('reportWhen').value,
    where_place: document.getElementById('reportWhere').value,
    what_task: document.getElementById('reportWhat').value,
    how_method: document.getElementById('reportHow').value,
    why_reason: document.getElementById('reportWhy').value,
    content: document.getElementById('reportContent').value,
    status: 'submitted'
  };

  if (!body.report_date || !body.work_category) {
    toast('날짜와 근무유형을 선택해주세요');
    return;
  }

  const approvers = [];
  const a1 = document.getElementById('reportApprover1').value;
  const a2 = document.getElementById('reportApprover2').value;
  if (a1) approvers.push(a1);
  if (a2) approvers.push(a2);
  body.approvers = approvers;

  const recipients = Array.from(document.getElementById('reportRecipient').selectedOptions).map(o => o.value);
  body.recipients = recipients;

  if (editingReportId) {
    await api(`/api/reports/${editingReportId}`, { method: 'PUT', body });
    toast('업무일지가 수정되었습니다');
  } else {
    await api('/api/reports', { method: 'POST', body });
    toast('업무일지가 제출되었습니다');
  }

  closeModal('reportModal');
  navigate(currentPage);
}

async function deleteReport(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  await api(`/api/reports/${id}`, { method: 'DELETE' });
  toast('삭제되었습니다');
  navigate('reports');
}

async function approveReport(id, status) {
  const comment = prompt(status === 'rejected' ? '반려 사유를 입력하세요:' : '코멘트 (선택사항):');
  await api(`/api/reports/${id}/approve`, { method: 'POST', body: { status, comment } });
  toast(status === 'approved' ? '승인되었습니다' : '반려되었습니다');
  viewReport(id);
}

// ─── 주간계획 ───
async function renderWeekly() {
  const plans = await api('/api/weekly-plans') || [];
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'flex';
  fab.onclick = () => openWeeklyPlan();

  document.getElementById('mainContent').innerHTML = `
    <p class="section-title">&#128197; 주간계획</p>
    ${plans.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">&#128197;</div>
        <div class="empty-text">주간계획이 없습니다<br>+ 버튼으로 새 계획을 작성하세요</div>
      </div>
    ` : plans.map(p => `
      <div class="list-item" onclick="viewWeeklyPlan('${p.id}')">
        <div class="list-item-content">
          <div class="list-item-title">${p.week_start} ~ ${p.week_end}</div>
          <div class="list-item-sub">${p.author_name}</div>
        </div>
        <span class="badge badge-${p.status}">${statusLabel(p.status)}</span>
      </div>
    `).join('')}
  `;
}

function openWeeklyPlan() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  document.getElementById('weekStart').value = monday.toISOString().split('T')[0];
  document.getElementById('weekEnd').value = friday.toISOString().split('T')[0];
  document.getElementById('weeklyPlanItems').innerHTML = '';

  const days = ['월', '화', '수', '목', '금'];
  days.forEach((day, i) => addWeeklyItem(i, day));
  openModal('weeklyModal');
}

function addWeeklyItem(dayIndex, dayLabel) {
  const container = document.getElementById('weeklyPlanItems');
  const idx = dayIndex !== undefined ? dayIndex : container.children.length;
  const label = dayLabel || `${idx + 1}일차`;

  const div = document.createElement('div');
  div.className = 'card';
  div.style.padding = '12px';
  div.innerHTML = `
    <p style="font-weight:600; margin-bottom:8px;">${label}요일</p>
    <div class="chip-group" style="margin-bottom:8px;">
      <button class="chip selected" data-wfield="wcat-${idx}" data-value="내근" onclick="selectChip(this)">내근</button>
      <button class="chip" data-wfield="wcat-${idx}" data-value="외근" onclick="selectChip(this)">외근</button>
      <button class="chip" data-wfield="wcat-${idx}" data-value="출장" onclick="selectChip(this)">출장</button>
    </div>
    <input type="text" class="form-control weekly-content" data-day="${idx}" placeholder="업무 내용" style="margin-bottom:8px;">
    <input type="text" class="form-control weekly-location" data-day="${idx}" placeholder="장소/지역">
  `;
  container.appendChild(div);
}

async function submitWeeklyPlan() {
  const items = [];
  document.querySelectorAll('.weekly-content').forEach(el => {
    const day = parseInt(el.dataset.day);
    const catChip = document.querySelector(`[data-wfield="wcat-${day}"].selected`);
    items.push({
      day_of_week: day,
      work_category: catChip ? catChip.dataset.value : '내근',
      content: el.value,
      location: document.querySelector(`.weekly-location[data-day="${day}"]`)?.value || ''
    });
  });

  await api('/api/weekly-plans', {
    method: 'POST',
    body: {
      week_start: document.getElementById('weekStart').value,
      week_end: document.getElementById('weekEnd').value,
      items
    }
  });

  toast('주간계획이 저장되었습니다');
  closeModal('weeklyModal');
  navigate('weekly');
}

async function viewWeeklyPlan(id) {
  const data = await api(`/api/weekly-plans/${id}`);
  if (!data) return;
  const days = ['월', '화', '수', '목', '금', '토', '일'];

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('weekly')" style="margin-bottom:16px;">&larr; 목록</button>
    <div class="card">
      <p class="card-title">주간계획: ${data.week_start} ~ ${data.week_end}</p>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">${data.author_name}</p>
      ${(data.items || []).map(item => `
        <div style="padding:10px; background:var(--gray-50); border-radius:8px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong>${days[item.day_of_week]}요일</strong>
            <span class="badge badge-${item.work_category}">${item.work_category}</span>
          </div>
          <p style="font-size:14px;">${escHtml(item.content || '-')}</p>
          ${item.location ? `<p style="font-size:12px; color:var(--gray-500);">${escHtml(item.location)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ─── 가맹관리 ───
async function renderFranchise() {
  const franchises = await api('/api/franchises') || [];
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'flex';
  fab.onclick = () => openFranchiseModal();

  document.getElementById('mainContent').innerHTML = `
    <div class="tabs">
      <button class="tab active" onclick="filterFranchises(this, '')">전체</button>
      <button class="tab" onclick="filterFranchises(this, 'existing')">기존가맹</button>
      <button class="tab" onclick="filterFranchises(this, 'new_prospect')">신규영업</button>
    </div>
    <div id="franchiseList">
      ${renderFranchiseList(franchises)}
    </div>
  `;
}

function renderFranchiseList(franchises) {
  if (franchises.length === 0) return `<div class="empty-state"><div class="empty-icon">&#127970;</div><div class="empty-text">등록된 가맹점이 없습니다</div></div>`;
  return franchises.map(f => `
    <div class="list-item" onclick="viewFranchise('${f.id}')">
      <div class="list-item-content">
        <div class="list-item-title">${escHtml(f.name)}</div>
        <div class="list-item-sub">${f.region} &middot; ${f.owner_name || ''} &middot; ${f.owner_phone || ''}</div>
      </div>
      <span class="badge badge-${f.status === 'active' ? 'approved' : 'draft'}">${f.franchise_type === 'new_prospect' ? '신규' : '기존'}</span>
    </div>
  `).join('');
}

async function filterFranchises(btn, type) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const url = type ? `/api/franchises?type=${type}` : '/api/franchises';
  const franchises = await api(url) || [];
  document.getElementById('franchiseList').innerHTML = renderFranchiseList(franchises);
}

function openFranchiseModal() {
  document.getElementById('franchiseName').value = '';
  document.getElementById('franchiseRegion').value = '';
  document.getElementById('franchiseAddress').value = '';
  document.getElementById('franchiseOwner').value = '';
  document.getElementById('franchisePhone').value = '';
  document.getElementById('franchiseContractDate').value = '';
  document.getElementById('franchiseNotes').value = '';
  openModal('franchiseModal');
}

async function submitFranchise() {
  const getChipValue = (field) => {
    const sel = document.querySelector(`[data-field="${field}"].selected`);
    return sel ? sel.dataset.value : null;
  };

  const body = {
    name: document.getElementById('franchiseName').value,
    region: document.getElementById('franchiseRegion').value,
    address: document.getElementById('franchiseAddress').value,
    owner_name: document.getElementById('franchiseOwner').value,
    owner_phone: document.getElementById('franchisePhone').value,
    contract_date: document.getElementById('franchiseContractDate').value,
    franchise_type: getChipValue('franchise_type'),
    notes: document.getElementById('franchiseNotes').value
  };

  if (!body.name || !body.region) {
    toast('상호명과 지역을 입력해주세요');
    return;
  }

  await api('/api/franchises', { method: 'POST', body });
  toast('가맹점이 등록되었습니다');
  closeModal('franchiseModal');
  navigate('franchise');
}

async function viewFranchise(id) {
  const visits = await api(`/api/franchises/${id}/visits`) || [];
  const franchises = await api('/api/franchises') || [];
  const f = franchises.find(fr => fr.id === id);
  if (!f) return;

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('franchise')" style="margin-bottom:16px;">&larr; 목록</button>
    <div class="card">
      <div class="card-header">
        <span class="card-title">${escHtml(f.name)}</span>
        <span class="badge badge-${f.status === 'active' ? 'approved' : 'draft'}">${f.franchise_type === 'new_prospect' ? '신규영업' : '기존가맹'}</span>
      </div>
      <p style="font-size:14px; margin-bottom:4px;">${escHtml(f.region)} ${escHtml(f.address || '')}</p>
      <p style="font-size:14px; margin-bottom:4px;">대표: ${escHtml(f.owner_name || '-')} / ${escHtml(f.owner_phone || '-')}</p>
      ${f.contract_date ? `<p style="font-size:12px; color:var(--gray-500);">계약일: ${f.contract_date}</p>` : ''}
      ${f.notes ? `<p style="font-size:13px; margin-top:8px; color:var(--gray-700);">${escHtml(f.notes)}</p>` : ''}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <p class="section-title" style="margin-bottom:0;">방문기록</p>
      <button class="btn btn-primary btn-sm" onclick="addVisit('${id}')">+ 방문기록</button>
    </div>

    ${visits.length === 0 ? '<p style="color:var(--gray-500); font-size:14px;">방문기록이 없습니다</p>' :
      visits.map(v => `
        <div class="card" style="padding:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="font-size:13px;">${v.visit_date}</strong>
            <span style="font-size:12px; color:var(--gray-500);">${v.visitor_name}</span>
          </div>
          <p style="font-size:13px;">${escHtml(v.purpose || '')}: ${escHtml(v.content || '')}</p>
          ${v.result ? `<p style="font-size:12px; color:var(--success);">결과: ${escHtml(v.result)}</p>` : ''}
          ${v.next_action ? `<p style="font-size:12px; color:var(--primary);">후속: ${escHtml(v.next_action)}</p>` : ''}
        </div>
      `).join('')}
  `;
}

async function addVisit(franchiseId) {
  const purpose = prompt('방문 목적:');
  if (!purpose) return;
  const content = prompt('방문 내용:');
  const result = prompt('결과:');
  const next_action = prompt('후속 조치:');

  await api(`/api/franchises/${franchiseId}/visits`, {
    method: 'POST',
    body: {
      visit_date: new Date().toISOString().split('T')[0],
      purpose, content, result, next_action
    }
  });
  toast('방문기록이 등록되었습니다');
  viewFranchise(franchiseId);
}

// ─── 더보기 ───
async function renderMore() {
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  document.getElementById('mainContent').innerHTML = `
    <p class="section-title">&#9881; 기능 메뉴</p>

    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showWorkTable()">
        <span class="qa-icon">&#128202;</span>
        <span class="qa-label">업무표 생성</span>
      </button>
      <button class="quick-action-btn" onclick="showManual()">
        <span class="qa-icon">&#128214;</span>
        <span class="qa-label">업무 매뉴얼</span>
      </button>
      <button class="quick-action-btn" onclick="manageTemplates()">
        <span class="qa-icon">&#128196;</span>
        <span class="qa-label">템플릿 관리</span>
      </button>
      <button class="quick-action-btn" onclick="showUserInfo()">
        <span class="qa-icon">&#128100;</span>
        <span class="qa-label">내 정보</span>
      </button>
    </div>

    <div class="card">
      <p class="card-title" style="margin-bottom:8px;">시스템 정보</p>
      <p style="font-size:13px; color:var(--gray-500);">석유사업본부 업무공유 시스템 v1.0</p>
      <p style="font-size:13px; color:var(--gray-500);">스마트폰 최적화 모바일 웹앱</p>
    </div>
  `;
}

// ─── 업무표 자동생성 ───
async function showWorkTable() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const from = weekAgo.toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];

  const data = await api(`/api/work-table?from=${from}&to=${to}`);
  if (!data) return;

  let tableHtml = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:16px;">&larr; 뒤로</button>
    <p class="section-title">&#128202; 업무표 (${from} ~ ${to})</p>
    <div class="card">
      <p style="font-size:13px; color:var(--gray-500); margin-bottom:12px;">총 ${data.total_count}건의 업무 기록</p>
  `;

  const dates = Object.keys(data.daily_reports).sort();
  if (dates.length === 0) {
    tableHtml += '<p style="text-align:center; color:var(--gray-500);">해당 기간의 업무기록이 없습니다</p>';
  } else {
    dates.forEach(date => {
      const reports = data.daily_reports[date];
      tableHtml += `
        <div style="margin-bottom:12px; border-bottom:1px solid var(--gray-200); padding-bottom:12px;">
          <p style="font-weight:600; font-size:14px; margin-bottom:8px;">${date} (${getDayName(date)})</p>
          ${reports.map(r => `
            <div style="padding:6px 0; font-size:13px;">
              <span class="badge badge-${r.work_category}" style="margin-right:4px;">${r.work_category}</span>
              ${escHtml(r.what_task || r.content || '-')}
              ${r.where_place ? `<span style="color:var(--gray-500);"> @ ${escHtml(r.where_place)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    });
  }

  tableHtml += '</div>';
  document.getElementById('mainContent').innerHTML = tableHtml;
}

// ─── 개인업무 매뉴얼 자동생성 ───
async function showManual() {
  const data = await api('/api/manual');
  if (!data) return;

  let html = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:16px;">&larr; 뒤로</button>
    <p class="section-title">&#128214; 개인업무 매뉴얼</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">자동 생성일: ${new Date(data.generated_at).toLocaleDateString('ko-KR')}</p>
  `;

  const categories = Object.keys(data.manual);
  if (categories.length === 0) {
    html += '<div class="card"><p style="text-align:center; color:var(--gray-500);">업무 기록이 쌓이면 자동으로 매뉴얼이 생성됩니다</p></div>';
  } else {
    categories.forEach(cat => {
      html += `<div class="card">
        <p class="card-title"><span class="badge badge-${cat}">${cat}</span> 업무 매뉴얼</p>
        <div style="margin-top:12px;">
          ${data.manual[cat].map(item => `
            <div style="padding:8px; background:var(--gray-50); border-radius:8px; margin-bottom:8px; font-size:13px;">
              <strong>${escHtml(item.task || '-')}</strong>
              ${item.method ? `<br>방법: ${escHtml(item.method)}` : ''}
              ${item.location ? `<br>장소: ${escHtml(item.location)}` : ''}
              ${item.purpose ? `<br>목적: ${escHtml(item.purpose)}` : ''}
              <span style="color:var(--gray-500);"> (${item.frequency}회 수행)</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    });
  }

  document.getElementById('mainContent').innerHTML = html;
}

// ─── 템플릿 관리 ───
async function manageTemplates() {
  const templates = await api('/api/templates') || [];

  let html = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:16px;">&larr; 뒤로</button>
    <p class="section-title">&#128196; 반복업무 템플릿</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">자주 반복되는 업무를 템플릿으로 저장하여 빠르게 작성하세요</p>
  `;

  if (templates.length === 0) {
    html += '<div class="card"><p style="text-align:center; color:var(--gray-500);">저장된 템플릿이 없습니다<br>업무일지 작성 시 "템플릿 저장" 버튼으로 추가하세요</p></div>';
  } else {
    templates.forEach(t => {
      const data = JSON.parse(t.content_json);
      html += `
        <div class="list-item">
          <div class="list-item-content">
            <div class="list-item-title">${escHtml(t.title)}</div>
            <div class="list-item-sub">${t.category} &middot; 사용 ${t.use_count}회</div>
          </div>
        </div>
      `;
    });
  }

  document.getElementById('mainContent').innerHTML = html;
}

// ─── 자동완성 (반복기록 자동생성) ───
let currentSuggestions = [];

async function loadSuggestions(fieldName, inputEl) {
  const items = await api(`/api/frequent-items?field_name=${fieldName}`) || [];
  currentSuggestions = items;
  const list = document.getElementById(`suggest-${fieldName}`);
  if (!list) return;
  renderSuggestions(list, items, inputEl);
}

function filterSuggestions(inputEl) {
  const fieldName = inputEl.id.replace('report', '').toLowerCase();
  const fieldMap = { purpose: 'purpose', where: 'where_place', what: 'what_task', how: 'how_method', why: 'why_reason' };
  const key = fieldMap[fieldName];
  if (!key) return;
  const list = document.getElementById(`suggest-${key}`);
  if (!list) return;
  const query = inputEl.value.toLowerCase();
  const filtered = currentSuggestions.filter(i => i.field_value.toLowerCase().includes(query));
  renderSuggestions(list, filtered, inputEl);
}

function renderSuggestions(listEl, items, inputEl) {
  if (items.length === 0) { listEl.classList.remove('show'); return; }
  listEl.innerHTML = items.map(i => `
    <div class="autocomplete-item" onmousedown="selectSuggestion(this, '${escAttr(i.field_value)}')">${escHtml(i.field_value)} <span style="color:var(--gray-500); font-size:11px;">(${i.use_count}회)</span></div>
  `).join('');
  listEl.classList.add('show');

  inputEl.addEventListener('blur', () => setTimeout(() => listEl.classList.remove('show'), 200), { once: true });
}

function selectSuggestion(el, value) {
  const input = el.closest('.form-group-autocomplete').querySelector('input');
  input.value = value;
  el.closest('.autocomplete-list').classList.remove('show');
}

// ─── 결재자/수신자 로드 ───
async function loadApprovers() {
  const users = await api('/api/users') || [];
  const others = users.filter(u => u.id !== currentUser.id);

  ['reportApprover1', 'reportApprover2'].forEach(id => {
    const sel = document.getElementById(id);
    const firstOption = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(firstOption);
    others.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} ${u.position}`;
      sel.appendChild(opt);
    });
  });

  const recipientSel = document.getElementById('reportRecipient');
  recipientSel.innerHTML = '';
  others.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.name} ${u.position}`;
    recipientSel.appendChild(opt);
  });
}

// ─── 템플릿 ───
async function loadTemplates() {
  const templates = await api('/api/templates') || [];
  const sel = document.getElementById('templateSelect');
  sel.innerHTML = '<option value="">반복 업무 템플릿 선택</option>';
  templates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.title} (${t.use_count}회 사용)`;
    sel.appendChild(opt);
  });
}

async function loadTemplate() {
  const sel = document.getElementById('templateSelect');
  if (!sel.value) return;

  const template = await api(`/api/templates/${sel.value}/use`, { method: 'POST' });
  if (!template) return;

  const data = JSON.parse(template.content_json);
  if (data.purpose) document.getElementById('reportPurpose').value = data.purpose;
  if (data.where_place) document.getElementById('reportWhere').value = data.where_place;
  if (data.what_task) document.getElementById('reportWhat').value = data.what_task;
  if (data.how_method) document.getElementById('reportHow').value = data.how_method;
  if (data.why_reason) document.getElementById('reportWhy').value = data.why_reason;
  if (data.content) document.getElementById('reportContent').value = data.content;
  if (data.work_category) {
    document.querySelectorAll('[data-field="work_category"]').forEach(c => {
      c.classList.toggle('selected', c.dataset.value === data.work_category);
    });
  }
  toast('템플릿이 적용되었습니다');
}

async function saveAsTemplate() {
  const title = prompt('템플릿 이름을 입력하세요:');
  if (!title) return;

  const getChipValue = (field) => {
    const sel = document.querySelector(`[data-field="${field}"].selected`);
    return sel ? sel.dataset.value : null;
  };

  const content_json = {
    work_category: getChipValue('work_category'),
    purpose: document.getElementById('reportPurpose').value,
    where_place: document.getElementById('reportWhere').value,
    what_task: document.getElementById('reportWhat').value,
    how_method: document.getElementById('reportHow').value,
    why_reason: document.getElementById('reportWhy').value,
    content: document.getElementById('reportContent').value
  };

  await api('/api/templates', {
    method: 'POST',
    body: { category: getChipValue('work_category') || '일반', title, content_json }
  });

  toast('템플릿이 저장되었습니다');
  await loadTemplates();
}

// ─── 사용자 정보 ───
function showUserInfo() {
  document.getElementById('mainContent').innerHTML = `
    <div class="card">
      <p class="card-title" style="margin-bottom:16px;">내 정보</p>
      <div style="text-align:center; margin-bottom:16px;">
        <div style="width:64px; height:64px; border-radius:50%; background:var(--primary-light); display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 8px;">&#128100;</div>
        <p style="font-size:18px; font-weight:600;">${currentUser.name}</p>
        <p style="color:var(--gray-500);">${currentUser.department} ${currentUser.position}</p>
      </div>
      <div style="border-top:1px solid var(--gray-200); padding-top:12px;">
        <p style="font-size:14px; margin-bottom:8px;">&#128231; ${currentUser.email || '-'}</p>
        <p style="font-size:14px;">&#128222; ${currentUser.phone || '-'}</p>
      </div>
    </div>
  `;
}

// ─── 유틸리티 ───
function selectChip(el) {
  const field = el.dataset.field || el.dataset.wfield;
  document.querySelectorAll(`[data-field="${field}"], [data-wfield="${field}"]`).forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function openModal(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function statusLabel(status) {
  const map = { draft: '임시저장', submitted: '제출완료', approved: '승인', rejected: '반려', pending: '대기' };
  return map[status] || status;
}

function getDayName(dateStr) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// 모달 외부 클릭 닫기
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// 초기화
checkAuth();
