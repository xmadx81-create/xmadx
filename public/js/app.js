let currentUser = null;
let currentPage = 'home';
let editingReportId = null;
const PAGE_SIZE = 15;

// ─── 페이지네이션 유틸 ───
function paginate(items, page) {
  const total = items.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p - 1) * PAGE_SIZE;
  return { data: items.slice(start, start + PAGE_SIZE), page: p, totalPages, total };
}

function renderPagination(page, totalPages, onClickFn) {
  if (totalPages <= 1) return '';
  let btns = '';
  if (page > 1) btns += `<button class="pg-btn" onclick="${onClickFn}(${page - 1})">&lsaquo;</button>`;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  if (start > 1) btns += `<button class="pg-btn" onclick="${onClickFn}(1)">1</button><span class="pg-dots">&hellip;</span>`;
  for (let i = start; i <= end; i++) {
    btns += `<button class="pg-btn${i === page ? ' pg-active' : ''}" onclick="${onClickFn}(${i})">${i}</button>`;
  }
  if (end < totalPages) btns += `<span class="pg-dots">&hellip;</span><button class="pg-btn" onclick="${onClickFn}(${totalPages})">${totalPages}</button>`;
  if (page < totalPages) btns += `<button class="pg-btn" onclick="${onClickFn}(${page + 1})">&rsaquo;</button>`;
  return `<div class="pagination"><span class="pg-info">${page}/${totalPages}</span>${btns}</div>`;
}

// ─── API 헬퍼 ───
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (res.status === 401) { showLogin(); return null; }
    const data = await res.json();
    if (!res.ok) { toast(data.error || '요청 실패'); return null; }
    return data;
  } catch (e) {
    console.error('API error:', e);
    toast('서버 연결 실패. 잠시 후 다시 시도해주세요.');
    return null;
  }
}

// ─── 인증 ───
async function login() {
  toast('로그인 중...');
  const phoneRest = document.getElementById('loginPhone').value.trim().replace(/[^0-9]/g, '');
  const phone = '010' + phoneRest;
  const password = document.getElementById('loginPassword').value;
  if (!phoneRest || !password) { toast('연락처와 비밀번호를 입력해주세요'); return; }
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || '로그인 실패'); return; }
    currentUser = data;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    navigate('home');
  } catch (e) {
    toast('서버 연결 실패. 잠시 후 다시 시도해주세요.');
  }
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

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  reportViewMode = 'mine';
  showLogin();
}

// ─── 네비게이션 ───
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const fab = document.getElementById('fabBtn');
  fab.style.display = ['home', 'reports'].includes(page) ? 'flex' : 'none';

  const titles = { home: '석유사업본부', reports: '업무일지', weekly: '주간계획', franchise: '가맹관리', more: '더보기' };
  document.getElementById('pageTitle').textContent = titles[page] || '석유사업본부';

  const renderers = { home: renderHome, reports: renderReports, weekly: renderWeekly, franchise: renderFranchiseMain, more: renderMore };
  if (renderers[page]) renderers[page]();
}

// ─── 홈 화면 ───
function isManager() {
  if (!currentUser) return false;
  if (currentUser.isAdmin) return true;
  return ['본부장','이사','부장'].includes(currentUser.position);
}

async function renderHome() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const reports = await api(`/api/reports?from=${weekAgo}&to=${today}`) || [];

  const myReports = reports.filter(r => r.author_id === currentUser.id);
  const todayReports = myReports.filter(r => r.report_date === today);
  const othersReports = reports.filter(r => r.author_id !== currentUser.id);

  let teamSection = '';
  if (isManager()) {
    teamSection = `
      <p class="section-title">&#128101; 팀원 업무현황 (이번 주)</p>
      ${othersReports.length === 0 ? `
        <div class="card" style="text-align:center; color:var(--gray-500); padding:20px;">
          이번 주 팀원 업무일지가 없습니다
        </div>
      ` : `
        <div style="margin-bottom:24px;">
          ${othersReports.slice(0, 8).map(r => `
            <div class="list-item" onclick="viewReport('${r.id}')">
              <div class="list-item-content">
                <div class="list-item-title">${escHtml(r.what_task || r.content || '(내용 없음)')}</div>
                <div class="list-item-sub">${r.author_name} ${r.author_position || ''} &middot; ${r.report_date}</div>
              </div>
              <span class="badge badge-${r.work_category}">${r.work_category}</span>
            </div>
          `).join('')}
          ${othersReports.length > 8 ? `<button class="btn btn-outline btn-block btn-sm" onclick="navigate('reports')" style="margin-top:8px;">전체 보기 (${othersReports.length}건)</button>` : ''}
        </div>
      `}
    `;
  }

  document.getElementById('mainContent').innerHTML = `
    <div style="margin-bottom:20px;">
      <p style="font-size:15px; color:var(--gray-500);">안녕하세요,</p>
      <p style="font-size:22px; font-weight:600;">${currentUser.name} ${currentUser.position || ''}님</p>
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

    <p class="section-title">&#128218; 빠른 참조</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showTaskMaster()">
        <span class="qa-icon">&#128203;</span>
        <span class="qa-label">주요업무표</span>
      </button>
      <button class="quick-action-btn" onclick="showManual()">
        <span class="qa-icon">&#128214;</span>
        <span class="qa-label">업무 매뉴얼</span>
      </button>
    </div>

    ${teamSection}

    <p class="section-title">&#128203; 내 최근 업무일지</p>
    ${myReports.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">&#128221;</div>
        <div class="empty-text">작성된 업무일지가 없습니다<br>새 업무일지를 작성해보세요</div>
      </div>
    ` : myReports.slice(0, 5).map(r => `
      <div class="list-item" onclick="viewReport('${r.id}')">
        <div class="list-item-content">
          <div class="list-item-title">${escHtml(r.what_task || r.content || '(내용 없음)')}</div>
          <div class="list-item-sub">${r.report_date} &middot; ${r.where_place || ''}</div>
        </div>
        <span class="list-item-badge">
          <span class="badge badge-${r.work_category}">${r.work_category}</span>
        </span>
      </div>
    `).join('')}
  `;
}

// ─── 업무일지 목록 ───
let reportViewMode = 'mine';

async function renderReports() {
  const reports = await api('/api/reports') || [];
  window._allReports = reports;
  if (reportViewMode === 'mine') {
    window._filteredReports = reports.filter(r => r.author_id === currentUser.id);
  } else {
    window._filteredReports = reports;
  }
  renderReportsPage(1);
}

function renderReportsPage(pg) {
  const reports = window._filteredReports || [];
  const { data, page, totalPages, total } = paginate(reports, pg);
  document.getElementById('mainContent').innerHTML = `
    <div class="tabs" style="margin-bottom:8px;">
      <button class="tab ${reportViewMode === 'mine' ? 'active' : ''}" onclick="switchReportView('mine')">내 업무</button>
      <button class="tab ${reportViewMode === 'all' ? 'active' : ''}" onclick="switchReportView('all')">전체 업무</button>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="filterReports(this, '')">전체</button>
      <button class="tab" onclick="filterReports(this, '내근')">내근</button>
      <button class="tab" onclick="filterReports(this, '외근')">외근</button>
      <button class="tab" onclick="filterReports(this, '출장')">출장</button>
    </div>
    ${total > 0 ? `<p style="font-size:13px; color:var(--gray-500); margin-bottom:8px;">총 ${total}건</p>` : ''}
    <div id="reportsList">${renderReportList(data)}</div>
    ${renderPagination(page, totalPages, 'gotoReportsPage')}
  `;
}

function switchReportView(mode) {
  reportViewMode = mode;
  renderReports();
}

function gotoReportsPage(pg) {
  const reports = window._filteredReports || [];
  const { data, page, totalPages } = paginate(reports, pg);
  document.getElementById('reportsList').innerHTML = renderReportList(data);
  const el = document.querySelector('.pagination');
  if (el) el.outerHTML = renderPagination(page, totalPages, 'gotoReportsPage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  let all = window._allReports || [];
  if (reportViewMode === 'mine') all = all.filter(r => r.author_id === currentUser.id);
  window._filteredReports = category ? all.filter(r => r.work_category === category) : all;
  const { data, page, totalPages, total } = paginate(window._filteredReports, 1);
  document.getElementById('reportsList').innerHTML = renderReportList(data);
  const countEl = document.querySelector('#reportsList').previousElementSibling;
  if (countEl && countEl.tagName === 'P') countEl.textContent = `총 ${total}건`;
  const el = document.querySelector('.pagination');
  if (el) el.outerHTML = renderPagination(page, totalPages, 'gotoReportsPage');
  else document.getElementById('reportsList').insertAdjacentHTML('afterend', renderPagination(page, totalPages, 'gotoReportsPage'));
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

// ─── 가맹관리 메인 ───
let franchiseTab = 'apps';

function renderFranchiseMain() {
  const fab = document.getElementById('fabBtn');
  fab.style.display = franchiseTab === 'custom' ? 'flex' : 'none';
  fab.onclick = () => openFranchiseModal();

  if (franchiseTab === 'apps') renderFranchiseApps();
  else renderFranchise();
}

function switchFranchiseTab(tab) {
  franchiseTab = tab;
  renderFranchiseMain();
}

// ─── 기존가맹 거래처 신청서 ───
let faStatusFilter = '';

async function renderFranchiseApps() {
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  let url = '/api/franchise-apps?';
  if (faStatusFilter) url += `status=${encodeURIComponent(faStatusFilter)}&`;

  const apps = await api(url) || [];
  window._allFranchiseApps = apps;
  window._filteredFranchiseApps = apps;
  renderFranchiseAppsPage(1);
}

function renderFranchiseAppsPage(pg) {
  const apps = window._filteredFranchiseApps || [];
  const { data, page, totalPages, total } = paginate(apps, pg);

  document.getElementById('mainContent').innerHTML = `
    <div class="tabs" style="margin-bottom:8px;">
      <button class="tab ${franchiseTab === 'apps' ? 'active' : ''}" onclick="switchFranchiseTab('apps')">거래처 신청서</button>
      <button class="tab ${franchiseTab === 'custom' ? 'active' : ''}" onclick="switchFranchiseTab('custom')">가맹점 관리</button>
    </div>

    <div class="form-group" style="margin-bottom:8px;">
      <input type="text" id="faSearch" class="form-control" placeholder="상호, 대표자, 주소, 담당자 검색..." oninput="searchFranchiseApps()">
    </div>

    <div class="tabs" style="margin-bottom:8px;">
      <button class="tab ${faStatusFilter === '' ? 'active' : ''}" onclick="filterFA('')">전체</button>
      <button class="tab ${faStatusFilter === '정상' ? 'active' : ''}" onclick="filterFA('정상')">정상</button>
      <button class="tab ${faStatusFilter === '휴업' ? 'active' : ''}" onclick="filterFA('휴업')">휴업</button>
      <button class="tab ${faStatusFilter === '폐업' ? 'active' : ''}" onclick="filterFA('폐업')">폐업</button>
      <button class="tab ${faStatusFilter === '가맹취소' ? 'active' : ''}" onclick="filterFA('가맹취소')">취소</button>
    </div>

    <p style="font-size:13px; color:var(--gray-500); margin-bottom:8px;">총 ${total}건</p>
    <div id="faList">${renderFAList(data)}</div>
    ${renderPagination(page, totalPages, 'gotoFAPage')}
  `;
}

function gotoFAPage(pg) {
  const apps = window._filteredFranchiseApps || [];
  const { data, page, totalPages } = paginate(apps, pg);
  document.getElementById('faList').innerHTML = renderFAList(data);
  const el = document.querySelector('.pagination');
  if (el) el.outerHTML = renderPagination(page, totalPages, 'gotoFAPage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderFAList(apps) {
  if (apps.length === 0) return '<div class="empty-state"><div class="empty-icon">&#127970;</div><div class="empty-text">데이터가 없습니다</div></div>';
  return apps.map(a => {
    const statusClass = a.status === '정상' ? 'approved' : a.status === '휴업' ? 'submitted' : a.status === '폐업' || a.status === '가맹취소' ? 'rejected' : 'draft';
    return `
    <div class="list-item" onclick="viewFranchiseApp('${a.id}')">
      <div class="list-item-content">
        <div class="list-item-title">${escHtml(a.store_name || '(상호없음)')}</div>
        <div class="list-item-sub">${escHtml(a.owner_name || '')} &middot; ${escHtml(a.oil_company || '')} &middot; ${escHtml(a.manager || '')}</div>
        <div class="list-item-sub">${escHtml(a.address || '')}</div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
        <span class="badge badge-${statusClass}">${a.status || '정상'}</span>
        ${a.memo ? '<span style="font-size:11px; color:var(--warning);">메모</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

function searchFranchiseApps() {
  const q = (document.getElementById('faSearch').value || '').toLowerCase();
  const all = window._allFranchiseApps || [];
  window._filteredFranchiseApps = q ? all.filter(a =>
    (a.store_name || '').toLowerCase().includes(q) ||
    (a.owner_name || '').toLowerCase().includes(q) ||
    (a.address || '').toLowerCase().includes(q) ||
    (a.manager || '').toLowerCase().includes(q) ||
    (a.biz_number || '').includes(q)
  ) : all;
  gotoFAPage(1);
}

function filterFA(status) {
  faStatusFilter = status;
  renderFranchiseApps();
}

async function viewFranchiseApp(id) {
  const a = await api(`/api/franchise-apps/${id}`);
  if (!a) return;

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="renderFranchiseApps()" style="margin-bottom:12px;">&larr; 목록</button>
    <div class="card">
      <div class="card-header">
        <span class="card-title" style="font-size:18px;">${escHtml(a.store_name)}</span>
        <span class="badge badge-${a.status === '정상' ? 'approved' : a.status === '휴업' ? 'submitted' : 'rejected'}">${a.status || '정상'}</span>
      </div>
      <div style="font-size:15px; line-height:2;">
        <p><strong>대표자:</strong> ${escHtml(a.owner_name || '-')}</p>
        <p><strong>사업자번호:</strong> ${escHtml(a.biz_number || '-')}</p>
        <p><strong>주소:</strong> ${escHtml(a.address || '-')}</p>
        <p><strong>유선전화:</strong> ${escHtml(a.phone_land || '-')}</p>
        <p><strong>대표자 연락처:</strong> ${escHtml(a.owner_phone || '-')}</p>
        <p><strong>정유사:</strong> ${escHtml(a.oil_company || '-')}</p>
        <p><strong>구분:</strong> ${escHtml(a.app_type || '-')}</p>
        <p><strong>계좌정보:</strong> ${escHtml(a.bank_info || '-')}</p>
        <p><strong>담당자:</strong> ${escHtml(a.manager || '-')} (${escHtml(a.branch || '')})</p>
        <p><strong>접수일:</strong> ${escHtml(a.receipt_date || '-')}</p>
        <p><strong>가맹일:</strong> ${escHtml(a.join_date || '-')}</p>
        <p><strong>도색완료일:</strong> ${escHtml(a.paint_date || '-')}</p>
      </div>
      ${a.memo ? `<div style="margin-top:12px; padding:10px; background:#fef7e0; border-radius:8px; font-size:14px;"><strong>메모:</strong> ${escHtml(a.memo)}</div>` : ''}
    </div>

    <button class="btn btn-primary btn-block" onclick="editFranchiseApp('${a.id}')">수정</button>
  `;
}

async function editFranchiseApp(id) {
  const a = await api(`/api/franchise-apps/${id}`);
  if (!a) return;

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="viewFranchiseApp('${id}')" style="margin-bottom:12px;">&larr; 상세</button>
    <p class="section-title">거래처 정보 수정</p>
    <div class="card">
      <div class="form-group">
        <label>상호</label>
        <input type="text" id="faEditName" class="form-control" value="${escAttr(a.store_name || '')}">
      </div>
      <div class="form-group">
        <label>대표자</label>
        <input type="text" id="faEditOwner" class="form-control" value="${escAttr(a.owner_name || '')}">
      </div>
      <div class="form-group">
        <label>사업자번호</label>
        <input type="text" id="faEditBiz" class="form-control" value="${escAttr(a.biz_number || '')}">
      </div>
      <div class="form-group">
        <label>사업장주소</label>
        <input type="text" id="faEditAddr" class="form-control" value="${escAttr(a.address || '')}">
      </div>
      <div style="display:flex; gap:8px;">
        <div class="form-group" style="flex:1;">
          <label>유선전화</label>
          <input type="text" id="faEditPhoneLand" class="form-control" value="${escAttr(a.phone_land || '')}">
        </div>
        <div class="form-group" style="flex:1;">
          <label>대표자 연락처</label>
          <input type="text" id="faEditOwnerPhone" class="form-control" value="${escAttr(a.owner_phone || '')}">
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <div class="form-group" style="flex:1;">
          <label>정유사</label>
          <select id="faEditOil" class="form-control">
            <option value="">선택</option>
            ${['SK','GS','현대오일뱅크','S-OIL','알뜰','자가상표','기타'].map(o => `<option ${a.oil_company === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex:1;">
          <label>상태</label>
          <select id="faEditStatus" class="form-control">
            ${['정상','예정','휴업','폐업','가맹취소','기타'].map(s => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>계좌정보</label>
        <input type="text" id="faEditBank" class="form-control" value="${escAttr(a.bank_info || '')}">
      </div>
      <div class="form-group">
        <label>도색완료일</label>
        <input type="text" id="faEditPaint" class="form-control" value="${escAttr(a.paint_date || '')}" placeholder="예: 2025-06-01">
      </div>
      <div class="form-group">
        <label>메모 (특이사항, 변경사유 등)</label>
        <textarea id="faEditMemo" class="form-control" placeholder="상태 변경 사유, 특이사항 등을 기록하세요">${escHtml(a.memo || '')}</textarea>
      </div>
      <button class="btn btn-success btn-block" onclick="saveFranchiseApp('${id}')">저장</button>
    </div>
  `;
}

async function saveFranchiseApp(id) {
  const body = {
    store_name: document.getElementById('faEditName').value,
    owner_name: document.getElementById('faEditOwner').value,
    biz_number: document.getElementById('faEditBiz').value,
    address: document.getElementById('faEditAddr').value,
    phone_land: document.getElementById('faEditPhoneLand').value,
    owner_phone: document.getElementById('faEditOwnerPhone').value,
    oil_company: document.getElementById('faEditOil').value,
    status: document.getElementById('faEditStatus').value,
    bank_info: document.getElementById('faEditBank').value,
    paint_date: document.getElementById('faEditPaint').value,
    memo: document.getElementById('faEditMemo').value
  };
  await api(`/api/franchise-apps/${id}`, { method: 'PUT', body });
  toast('저장되었습니다');
  viewFranchiseApp(id);
}

// ─── 가맹점 직접 관리 ───
async function renderFranchise() {
  const franchises = await api('/api/franchises') || [];
  window._allFranchises = franchises;
  window._filteredFranchises = franchises;
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'flex';
  fab.onclick = () => openFranchiseModal();
  renderFranchisePage(1);
}

function renderFranchisePage(pg) {
  const franchises = window._filteredFranchises || [];
  const { data, page, totalPages, total } = paginate(franchises, pg);
  document.getElementById('mainContent').innerHTML = `
    <div class="tabs" style="margin-bottom:8px;">
      <button class="tab ${franchiseTab === 'apps' ? 'active' : ''}" onclick="switchFranchiseTab('apps')">거래처 신청서</button>
      <button class="tab ${franchiseTab === 'custom' ? 'active' : ''}" onclick="switchFranchiseTab('custom')">가맹점 관리</button>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="filterFranchises(this, '')">전체</button>
      <button class="tab" onclick="filterFranchises(this, 'existing')">기존가맹</button>
      <button class="tab" onclick="filterFranchises(this, 'new_prospect')">신규영업</button>
    </div>
    ${total > 0 ? `<p style="font-size:12px; color:var(--gray-500); margin-bottom:8px;">총 ${total}건</p>` : ''}
    <div id="franchiseList">${renderFranchiseList(data)}</div>
    ${renderPagination(page, totalPages, 'gotoFranchisePage')}
  `;
}

function gotoFranchisePage(pg) {
  const franchises = window._filteredFranchises || [];
  const { data, page, totalPages } = paginate(franchises, pg);
  document.getElementById('franchiseList').innerHTML = renderFranchiseList(data);
  const el = document.querySelector('.pagination');
  if (el) el.outerHTML = renderPagination(page, totalPages, 'gotoFranchisePage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

function filterFranchises(btn, type) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const all = window._allFranchises || [];
  window._filteredFranchises = type ? all.filter(f => f.franchise_type === type) : all;
  gotoFranchisePage(1);
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
    <p class="section-title">&#128203; 업무 참조</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showTaskMaster()">
        <span class="qa-icon">&#128203;</span>
        <span class="qa-label">주요업무표</span>
      </button>
      <button class="quick-action-btn" onclick="showPersonalTasks()">
        <span class="qa-icon">&#128221;</span>
        <span class="qa-label">개별 업무표</span>
      </button>
      <button class="quick-action-btn" onclick="showManual()">
        <span class="qa-icon">&#128214;</span>
        <span class="qa-label">업무 매뉴얼</span>
      </button>
      <button class="quick-action-btn" onclick="showBranches()">
        <span class="qa-icon">&#127970;</span>
        <span class="qa-label">전국 지국</span>
      </button>
      <button class="quick-action-btn" onclick="showMeetingNotes()">
        <span class="qa-icon">&#128466;</span>
        <span class="qa-label">회의록</span>
      </button>
    </div>

    <p class="section-title">&#9881; 도구</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showWorkTable()">
        <span class="qa-icon">&#128202;</span>
        <span class="qa-label">업무표 생성</span>
      </button>
      <button class="quick-action-btn" onclick="manageTemplates()">
        <span class="qa-icon">&#128196;</span>
        <span class="qa-label">템플릿 관리</span>
      </button>
      <button class="quick-action-btn" onclick="showUserInfo()">
        <span class="qa-icon">&#128100;</span>
        <span class="qa-label">내 정보</span>
      </button>
      ${currentUser && currentUser.isAdmin ? `
      <button class="quick-action-btn" onclick="showAdminPanel()" style="border:2px solid var(--danger);">
        <span class="qa-icon">&#128272;</span>
        <span class="qa-label" style="color:var(--danger); font-weight:700;">시스템 관리</span>
      </button>` : ''}
    </div>

    <div class="card">
      <p class="card-title" style="margin-bottom:8px;">시스템 정보</p>
      <p style="font-size:14px; color:var(--gray-500);">석유사업본부 업무공유 시스템 v2.0</p>
      <p style="font-size:14px; color:var(--gray-500);">전국 지국/주요업무표 통합 관리</p>
    </div>
  `;
}

// ─── 회의록 열람 ───
async function showMeetingNotes(pg) {
  const notes = await api('/api/meeting-notes') || [];
  window._allMeetingNotes = notes;
  window._filteredMeetingNotes = notes;
  renderMeetingNotesPage(pg || 1);
}

function renderMeetingNotesPage(pg) {
  const notes = window._filteredMeetingNotes || [];
  const { data, page, totalPages, total } = paginate(notes, pg);

  const months = [...new Set(notes.map(n => (n.meeting_date || '').substring(0, 7)))];

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title">&#128466; 회의록 (${total}건)</p>
    <div class="form-group">
      <input type="text" id="mnSearch" class="form-control" placeholder="회의 제목 검색..."
        oninput="searchMeetingNotes()">
    </div>
    <div class="tabs" style="margin-bottom:12px; flex-wrap:wrap; gap:4px;">
      <button class="tab active" onclick="filterMeetingMonth(this,'all')">전체</button>
      ${months.slice(0, 5).map(m => `<button class="tab" onclick="filterMeetingMonth(this,'${m}')">${m}</button>`).join('')}
    </div>
    <div id="mnList">${renderMeetingNotesList(data)}</div>
    ${renderPagination(page, totalPages, 'gotoMeetingNotesPage')}
  `;
}

function gotoMeetingNotesPage(pg) {
  const notes = window._filteredMeetingNotes || [];
  const { data, page, totalPages } = paginate(notes, pg);
  document.getElementById('mnList').innerHTML = renderMeetingNotesList(data);
  const paginationEl = document.querySelector('.pagination');
  if (paginationEl) paginationEl.outerHTML = renderPagination(page, totalPages, 'gotoMeetingNotesPage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMeetingNotesList(notes) {
  if (notes.length === 0) return '<div class="empty-state"><div class="empty-text">회의록이 없습니다</div></div>';
  return notes.map(n => {
    const d = n.meeting_date || '';
    const dateStr = d.substring(0, 10);
    const dayNames = ['일','월','화','수','목','금','토'];
    const dayName = d ? dayNames[new Date(d).getDay()] : '';
    return `
    <div class="card" style="padding:12px; cursor:pointer;" onclick="viewMeetingNote('${escAttr(n.id)}')">
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${escHtml(n.title)}</div>
          <div style="font-size:12px; color:var(--gray-500);">${escHtml(dateStr)} (${dayName})</div>
        </div>
        <div>
          ${n.has_summary ? '<span class="badge badge-approved">요약</span>' : '<span class="badge badge-draft">제목만</span>'}
        </div>
      </div>
    </div>`;
  }).join('');
}

function searchMeetingNotes() {
  const q = document.getElementById('mnSearch').value.toLowerCase();
  const all = window._allMeetingNotes || [];
  window._filteredMeetingNotes = q ? all.filter(n =>
    (n.title || '').toLowerCase().includes(q)
  ) : all;
  gotoMeetingNotesPage(1);
}

function filterMeetingMonth(btn, month) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const all = window._allMeetingNotes || [];
  window._filteredMeetingNotes = month === 'all' ? all : all.filter(n => (n.meeting_date || '').startsWith(month));
  gotoMeetingNotesPage(1);
}

async function viewMeetingNote(id) {
  const n = await api(`/api/meeting-notes/${id}`);
  if (!n) return;
  const d = n.meeting_date || '';
  const dateStr = d.substring(0, 10);
  const dayNames = ['일','월','화','수','목','금','토'];
  const dayName = d ? dayNames[new Date(d).getDay()] : '';

  let contentHtml = '<p style="color:var(--gray-500); font-style:italic;">요약 내용이 아직 없습니다.</p>';
  if (n.summary) {
    contentHtml = n.summary
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h4 style="color:var(--primary); margin:16px 0 8px; font-size:15px; border-bottom:1px solid var(--gray-200); padding-bottom:4px;">$1</h4>')
      .replace(/^- (.+)$/gm, '<li style="font-size:14px; line-height:1.7; margin-left:16px;">$1</li>')
      .replace(/\n/g, '');
  }

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showMeetingNotes()" style="margin-bottom:12px;">&larr; 목록</button>
    <div class="card">
      <div class="card-header">
        <span class="card-title" style="font-size:16px;">${escHtml(n.title)}</span>
      </div>
      <div style="font-size:13px; color:var(--gray-500); margin-bottom:12px;">
        ${escHtml(dateStr)} (${dayName})
        ${n.notion_url ? ` &middot; <a href="${escAttr(n.notion_url)}" target="_blank" rel="noopener" style="color:var(--primary);">Notion에서 보기</a>` : ''}
      </div>
      <div style="font-size:14px; line-height:1.8;">
        ${contentHtml}
      </div>
    </div>
  `;
}

// ─── 전국 지국 열람 ───
async function showBranches(pg) {
  const branches = await api('/api/branches') || [];
  window._allBranches = branches;
  window._filteredBranches = branches;
  renderBranchPage(pg || 1);
}

function renderBranchPage(pg) {
  const branches = window._filteredBranches || [];
  const { data, page, totalPages, total } = paginate(branches, pg);
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title">&#127970; 전국 지국 현황 (${total}개소)</p>
    <div class="form-group">
      <input type="text" id="branchSearch" class="form-control" placeholder="지국명, 주소, 담당자 검색..."
        oninput="searchBranchesPage()">
    </div>
    <div class="tabs" style="margin-bottom:12px;">
      <button class="tab active" onclick="filterBranchView(this,'all')">전체</button>
      <button class="tab" onclick="filterBranchView(this,'active')">운영중</button>
      <button class="tab" onclick="filterBranchView(this,'excluded')">봉사제외</button>
    </div>
    <div id="branchList">${renderBranchList(data)}</div>
    ${renderPagination(page, totalPages, 'gotoBranchPage')}
  `;
}

function gotoBranchPage(pg) {
  const branches = window._filteredBranches || [];
  const { data, page, totalPages } = paginate(branches, pg);
  document.getElementById('branchList').innerHTML = renderBranchList(data);
  const paginationEl = document.querySelector('.pagination');
  if (paginationEl) paginationEl.outerHTML = renderPagination(page, totalPages, 'gotoBranchPage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderBranchList(branches) {
  if (branches.length === 0) return '<div class="empty-state"><div class="empty-text">검색 결과가 없습니다</div></div>';
  return branches.map(b => `
    <div class="card" style="padding:12px; cursor:pointer;" onclick="viewBranch('${b.id}')">
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${escHtml(b.name)}</div>
          <div style="font-size:12px; color:var(--gray-500); margin-bottom:2px;">${escHtml(b.address || '')}</div>
          <div style="font-size:12px; color:var(--gray-700);">${escHtml(b.manager_name || '')} ${b.manager_phone ? '/ ' + escHtml(b.manager_phone) : ''}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
          ${b.exclude_service ? '<span class="badge badge-draft">봉사제외</span>' : '<span class="badge badge-approved">운영</span>'}
          ${b.email ? '<span style="font-size:10px; color:var(--primary);">&#9993;</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function searchBranchesPage() {
  const q = document.getElementById('branchSearch').value.toLowerCase();
  const all = window._allBranches || [];
  window._filteredBranches = q ? all.filter(b =>
    (b.name || '').toLowerCase().includes(q) ||
    (b.address || '').toLowerCase().includes(q) ||
    (b.manager_name || '').toLowerCase().includes(q)
  ) : all;
  gotoBranchPage(1);
}

function filterBranchView(btn, filter) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const all = window._allBranches || [];
  if (filter === 'active') window._filteredBranches = all.filter(b => !b.exclude_service);
  else if (filter === 'excluded') window._filteredBranches = all.filter(b => b.exclude_service);
  else window._filteredBranches = all;
  gotoBranchPage(1);
}

async function viewBranch(id) {
  const b = await api(`/api/branches/${id}`);
  if (!b) return;
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showBranches()" style="margin-bottom:12px;">&larr; 목록</button>
    <div class="card">
      <div class="card-header">
        <span class="card-title">${escHtml(b.name)}</span>
        ${b.exclude_service ? '<span class="badge badge-draft">봉사제외</span>' : '<span class="badge badge-approved">운영</span>'}
      </div>
      <div style="font-size:14px; line-height:1.8;">
        <p><strong>주소:</strong> ${escHtml(b.address || '-')}</p>
        <p><strong>담당자:</strong> ${escHtml(b.manager_name || '-')} / ${escHtml(b.manager_phone || '-')}</p>
        <p><strong>실무소통자:</strong> ${escHtml(b.field_contact_name || '-')} / ${escHtml(b.field_contact_phone || '-')}</p>
        ${b.email ? `<p><strong>이메일:</strong> <a href="mailto:${escHtml(b.email)}" style="color:var(--primary);">${escHtml(b.email)}</a></p>` : ''}
        ${b.move_status ? `<p style="margin-top:8px; padding:8px; background:#fef7e0; border-radius:8px;"><strong>이전정보:</strong> ${escHtml(b.move_status)} - ${escHtml(b.move_address || '')} ${escHtml(b.move_note || '')}</p>` : ''}
      </div>
    </div>
  `;
}

// ─── 주요업무표 열람/관리 ───
async function showTaskMaster() {
  const meta = await api('/api/tasks/categories') || { categories: [], groups: [] };
  const tasks = await api('/api/tasks') || [];
  window._allTaskItems = tasks;
  window._filteredTaskItems = tasks;
  window._taskMeta = meta;
  renderTaskPage(1);
}

function renderTaskPage(pg) {
  const meta = window._taskMeta || { categories: [] };
  const tasks = window._filteredTaskItems || [];
  const { data, page, totalPages, total } = paginate(tasks, pg);
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <p class="section-title" style="margin-bottom:0;">&#128203; 주요업무표 (${total}건)</p>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/tasks','주요업무표')">&#128229; 엑셀</button>
        <button class="btn btn-primary btn-sm" onclick="openNewTask()">+ 신규업무</button>
      </div>
    </div>
    <div class="form-group">
      <input type="text" id="taskSearch" class="form-control" placeholder="업무 검색..." oninput="searchTasksPage()">
    </div>
    <div class="tabs" style="margin-bottom:12px;" id="taskCategoryTabs">
      <button class="tab active" onclick="filterTasks(this,'')">전체</button>
      ${meta.categories.map(c => `<button class="tab" onclick="filterTasks(this,'${escAttr(c)}')">${escHtml(c)}</button>`).join('')}
    </div>
    <div id="taskList">${renderTaskList(data)}</div>
    ${renderPagination(page, totalPages, 'gotoTaskPage')}
  `;
}

function gotoTaskPage(pg) {
  const tasks = window._filteredTaskItems || [];
  const { data, page, totalPages } = paginate(tasks, pg);
  document.getElementById('taskList').innerHTML = renderTaskList(data);
  const el = document.querySelector('.pagination');
  if (el) el.outerHTML = renderPagination(page, totalPages, 'gotoTaskPage');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTaskList(tasks) {
  if (tasks.length === 0) return '<div class="empty-state"><div class="empty-text">업무가 없습니다</div></div>';
  const grouped = {};
  tasks.forEach(t => {
    const key = t.task_group || '기타';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  return Object.entries(grouped).map(([group, items]) => `
    <div class="card" style="padding:12px; margin-bottom:8px;">
      <div style="font-weight:600; font-size:14px; color:var(--primary); margin-bottom:8px; border-bottom:1px solid var(--gray-200); padding-bottom:6px;">${escHtml(group)}</div>
      ${items.map(t => `
        <div style="padding:6px 0; border-bottom:1px solid var(--gray-100); cursor:pointer;" onclick="viewTask('${t.id}')">
          <div style="font-size:13px;">${escHtml(t.task_detail || '')}</div>
          <div style="font-size:11px; color:var(--gray-500); display:flex; justify-content:space-between;">
            <span>${escHtml(t.assigned_to || '미지정')}</span>
            <span>${escHtml(t.category1 || '')} ${t.is_custom ? '(신규)' : ''}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function searchTasksPage() {
  const q = (document.getElementById('taskSearch').value || '').toLowerCase();
  const all = window._allTaskItems || [];
  window._filteredTaskItems = q ? all.filter(t =>
    (t.task_detail || '').toLowerCase().includes(q) ||
    (t.task_group || '').toLowerCase().includes(q) ||
    (t.assigned_to || '').toLowerCase().includes(q)
  ) : all;
  gotoTaskPage(1);
}

function filterTasks(btn, category) {
  document.querySelectorAll('#taskCategoryTabs .tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const all = window._allTaskItems || [];
  window._filteredTaskItems = category ? all.filter(t => t.category1 === category) : all;
  gotoTaskPage(1);
}

async function viewTask(id) {
  const tasks = await api('/api/tasks') || [];
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const notes = await api(`/api/tasks/${id}/notes`) || [];

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showTaskMaster()" style="margin-bottom:12px;">&larr; 목록</button>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-내근">${escHtml(task.category1 || '')}</span>
        ${task.is_custom ? '<span class="badge badge-submitted">신규</span>' : ''}
      </div>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:4px;">${escHtml(task.task_group || '')}</p>
      <p style="font-size:15px; font-weight:500; margin-bottom:8px;">${escHtml(task.task_detail || '')}</p>
      <p style="font-size:13px; color:var(--gray-700);">담당: ${escHtml(task.assigned_to || '미지정')}</p>
      ${task.note ? `<p style="font-size:13px; color:var(--gray-500); margin-top:4px;">비고: ${escHtml(task.note)}</p>` : ''}
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <p class="section-title" style="margin-bottom:0;">추가 내용 (${notes.length})</p>
    </div>

    <div class="form-group" style="display:flex; gap:8px;">
      <input type="text" id="taskNoteInput" class="form-control" placeholder="추가 내용 입력..." style="flex:1;">
      <button class="btn btn-primary btn-sm" onclick="addTaskNote('${id}')">추가</button>
    </div>

    ${notes.length > 0 ? notes.map(n => `
      <div class="card" style="padding:10px; margin-bottom:6px;">
        <div style="font-size:13px;">${escHtml(n.content)}</div>
        <div style="font-size:11px; color:var(--gray-500); margin-top:4px;">${n.author_name} / ${n.created_at}</div>
      </div>
    `).join('') : '<p style="font-size:13px; color:var(--gray-500);">추가된 내용이 없습니다</p>'}

    <div style="margin-top:16px;">
      <button class="btn btn-outline btn-block" onclick="createReportFromTask('${id}')">이 업무로 업무일지 작성</button>
    </div>
  `;
}

async function addTaskNote(taskId) {
  const input = document.getElementById('taskNoteInput');
  if (!input.value.trim()) return;
  await api(`/api/tasks/${taskId}/notes`, { method: 'POST', body: { content: input.value.trim() } });
  toast('추가 내용이 등록되었습니다');
  viewTask(taskId);
}

async function createReportFromTask(taskId) {
  const tasks = await api('/api/tasks') || [];
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  editingReportId = null;
  document.getElementById('reportModalTitle').textContent = '업무일지 작성';
  document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('reportPurpose').value = task.task_group || '';
  document.getElementById('reportWho').value = currentUser.name;
  document.getElementById('reportWhat').value = task.task_detail || '';
  document.getElementById('reportWhere').value = '';
  document.getElementById('reportWhen').value = '';
  document.getElementById('reportHow').value = '';
  document.getElementById('reportWhy').value = task.category1 || '';
  document.getElementById('reportContent').value = '';
  await loadApprovers();
  await loadTemplates();
  openModal('reportModal');
}

function openNewTask() {
  const html = `
    <button class="btn btn-outline btn-sm" onclick="showTaskMaster()" style="margin-bottom:12px;">&larr; 목록</button>
    <p class="section-title">+ 신규 업무 등록</p>
    <div class="card">
      <div class="form-group">
        <label>구분</label>
        <input type="text" id="newTaskCategory" class="form-control" placeholder="예: 가맹영업, 지사관리, 직영운영">
      </div>
      <div class="form-group">
        <label>업무 그룹</label>
        <input type="text" id="newTaskGroup" class="form-control" placeholder="예: 가맹주유소 관리">
      </div>
      <div class="form-group">
        <label>세부 업무 내용</label>
        <textarea id="newTaskDetail" class="form-control" placeholder="업무 세부 내용을 입력하세요"></textarea>
      </div>
      <div class="form-group">
        <label>담당자</label>
        <input type="text" id="newTaskAssigned" class="form-control" placeholder="담당자명">
      </div>
      <div class="form-group">
        <label>비고</label>
        <input type="text" id="newTaskNote" class="form-control" placeholder="비고사항">
      </div>
      <button class="btn btn-success btn-block" onclick="submitNewTask()">등록</button>
    </div>
  `;
  document.getElementById('mainContent').innerHTML = html;
}

async function submitNewTask() {
  const body = {
    department: '독도사랑 주유소',
    division: '석유사업 본부',
    category1: document.getElementById('newTaskCategory').value,
    task_group: document.getElementById('newTaskGroup').value,
    task_detail: document.getElementById('newTaskDetail').value,
    assigned_to: document.getElementById('newTaskAssigned').value,
    note: document.getElementById('newTaskNote').value
  };
  if (!body.task_detail) { toast('업무 내용을 입력해주세요'); return; }
  await api('/api/tasks', { method: 'POST', body });
  toast('신규 업무가 등록되었습니다');
  showTaskMaster();
}

// ─── 개별 담당 업무표 ───
async function showPersonalTasks() {
  const persons = await api('/api/personal-tasks/persons') || [];
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <p class="section-title" style="margin-bottom:0;">&#128221; 개별 담당 업무표</p>
      <button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/personal-tasks','개인업무표_전체')">&#128229; 전체 엑셀</button>
    </div>
    <p style="font-size:13px; color:var(--gray-500); margin-bottom:16px;">담당자를 선택하면 상세 업무를 확인할 수 있습니다</p>
    ${persons.map(p => `
      <div class="list-item" onclick="viewPersonTasks('${escAttr(p.person_name)}')">
        <div class="list-item-content">
          <div class="list-item-title">${escHtml(p.person_name)}</div>
          <div class="list-item-sub">${escHtml(p.position)}</div>
        </div>
        <span style="color:var(--gray-500); font-size:18px;">&rsaquo;</span>
      </div>
    `).join('')}
  `;
}

async function viewPersonTasks(personName) {
  const tasks = await api(`/api/personal-tasks?person=${encodeURIComponent(personName)}`) || [];
  const grouped = {};
  tasks.forEach(t => {
    const key = t.task_group || '기타';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showPersonalTasks()" style="margin-bottom:12px;">&larr; 목록</button>
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <p class="card-title">${escHtml(personName)}</p>
          <p style="font-size:13px; color:var(--gray-500);">${tasks.length > 0 ? escHtml(tasks[0].position) + ' / ' + escHtml(tasks[0].division) : ''}</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/personal-tasks?person=${encodeURIComponent(personName)}','${escAttr(personName)}_업무표')">&#128229; 엑셀</button>
      </div>
    </div>
    ${Object.entries(grouped).map(([group, items]) => `
      <div class="card" style="padding:12px; margin-bottom:8px;">
        <div style="font-weight:600; font-size:14px; color:var(--primary); margin-bottom:8px;">${escHtml(group)}</div>
        ${items.map(t => `
          <div style="padding:6px 0; border-bottom:1px solid var(--gray-100);">
            <div style="font-size:13px;">${escHtml(t.task_detail || '')}</div>
            ${t.note ? `<div style="font-size:11px; color:var(--gray-500);">${escHtml(t.note)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('')}
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

// ─── 개인업무 매뉴얼 (자동+수동) ───
let manualTab = 'org';

async function showManual() {
  let html = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title" style="margin-bottom:8px;">&#128214; 업무매뉴얼</p>
    <div class="card" style="background:#e8f0fe; border-left:4px solid var(--primary); margin-bottom:16px; padding:12px;">
      <p style="font-size:14px; line-height:1.6; color:var(--gray-700);">
        업무일지를 작성하면 <strong>육하원칙(누가/어디서/무엇을/어떻게/왜)</strong> 데이터가 자동으로 분석되어 업무매뉴얼이 만들어집니다.
        일지가 쌓일수록 매뉴얼이 풍부해집니다.
      </p>
    </div>
    <div class="tabs" style="margin-bottom:12px;">
      <button class="tab ${manualTab === 'org' ? 'active' : ''}" onclick="manualTab='org'; showManual()">전체 업무매뉴얼</button>
      <button class="tab ${manualTab === 'my' ? 'active' : ''}" onclick="manualTab='my'; showManual()">내 업무매뉴얼</button>
      <button class="tab ${manualTab === 'custom' ? 'active' : ''}" onclick="manualTab='custom'; showManual()">직접 작성</button>
    </div>
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
      ${manualTab === 'org' ? `<button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/manual-org','전체_업무매뉴얼')">&#128229; 엑셀 다운로드</button>` : ''}
      ${manualTab === 'my' ? `<button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/manual-my','내_업무매뉴얼')">&#128229; 엑셀 다운로드</button>` : ''}
    </div>
    <div id="manualContent"></div>
  `;
  document.getElementById('mainContent').innerHTML = html;

  if (manualTab === 'org') renderOrgManual();
  else if (manualTab === 'my') renderMyManual();
  else renderCustomManual();
}

async function renderOrgManual() {
  const data = await api('/api/manual/org');
  if (!data) return;
  const el = document.getElementById('manualContent');

  if (data.total_reports === 0) {
    el.innerHTML = `<div class="card" style="text-align:center; padding:30px;">
      <div style="font-size:48px; margin-bottom:12px;">&#128214;</div>
      <p style="font-size:16px; font-weight:600; margin-bottom:8px;">아직 업무매뉴얼이 없습니다</p>
      <p style="font-size:14px; color:var(--gray-500); line-height:1.6;">
        직원들이 업무일지를 작성하면<br>
        자동으로 업무매뉴얼이 생성됩니다.<br><br>
        <strong>업무일지의 "무엇을", "어떻게", "왜"</strong> 항목이<br>
        매뉴얼의 핵심 내용이 됩니다.
      </p>
    </div>`;
    return;
  }

  let html = `
    <div class="stats-row" style="margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-number">${data.total_reports}</div>
        <div class="stat-label">총 업무기록</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.total_people}</div>
        <div class="stat-label">참여 인원</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${Object.values(data.categories).reduce((s, arr) => s + arr.length, 0)}</div>
        <div class="stat-label">업무 항목</div>
      </div>
    </div>
  `;

  const catIcons = { '내근': '&#128187;', '외근': '&#128694;', '출장': '&#9992;' };

  Object.entries(data.categories).forEach(([cat, tasks]) => {
    html += `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid var(--primary-light);">
          <span style="font-size:24px;">${catIcons[cat] || '&#128203;'}</span>
          <span class="card-title">${escHtml(cat)} 업무</span>
          <span class="badge badge-${cat}">${tasks.length}건</span>
        </div>
        ${tasks.map(t => `
          <div style="padding:10px; background:var(--gray-50); border-radius:8px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:6px;">
              <div style="font-size:15px; font-weight:600; flex:1;">${escHtml(t.task)}</div>
              <span style="font-size:12px; color:var(--gray-500); white-space:nowrap;">${t.frequency}회 수행</span>
            </div>
            ${t.purpose ? `<div style="font-size:13px; margin-bottom:4px;"><span style="color:var(--primary); font-weight:500;">목적:</span> ${escHtml(t.purpose)}</div>` : ''}
            ${t.methods.length > 0 ? `<div style="font-size:13px; margin-bottom:4px;"><span style="color:var(--success); font-weight:500;">수행방법:</span> ${t.methods.map(m => escHtml(m)).join(' / ')}</div>` : ''}
            ${t.reasons.length > 0 ? `<div style="font-size:13px; margin-bottom:4px;"><span style="color:var(--warning); font-weight:500;">사유:</span> ${t.reasons.map(r => escHtml(r)).join(' / ')}</div>` : ''}
            ${t.locations.length > 0 ? `<div style="font-size:13px; margin-bottom:4px;"><span style="color:var(--gray-700); font-weight:500;">장소:</span> ${t.locations.map(l => escHtml(l)).join(', ')}</div>` : ''}
            <div style="font-size:12px; color:var(--gray-500); margin-top:4px;">
              담당: ${t.people.join(', ')} &middot; 최근: ${t.last_date || '-'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  });

  el.innerHTML = html;
}

async function renderMyManual() {
  const data = await api('/api/manual');
  if (!data) return;
  const el = document.getElementById('manualContent');
  const purposes = Object.keys(data.auto || {});

  if (data.task_count === 0) {
    el.innerHTML = `<div class="card" style="text-align:center; padding:30px;">
      <p style="font-size:16px; font-weight:600; margin-bottom:8px;">내 업무매뉴얼</p>
      <p style="font-size:14px; color:var(--gray-500); line-height:1.6;">
        업무일지를 작성하면 자동으로 생성됩니다.<br>
        홈 화면에서 업무일지를 작성해보세요!
      </p>
    </div>`;
    return;
  }

  let html = `
    <div class="card" style="padding:12px; margin-bottom:12px;">
      <p style="font-size:15px; font-weight:600;">${escHtml((data.user && data.user.name) || '')} ${escHtml((data.user && data.user.position) || '')}의 업무매뉴얼</p>
      <p style="font-size:13px; color:var(--gray-500);">총 ${data.task_count}개 업무, ${data.total_reports}건 기록 기반</p>
    </div>
  `;

  purposes.forEach(purpose => {
    const tasks = data.auto[purpose];
    html += `
      <div class="card" style="margin-bottom:10px;">
        <div style="font-weight:600; font-size:15px; color:var(--primary); margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--gray-200);">${escHtml(purpose)}</div>
        ${tasks.map(t => `
          <div style="padding:8px; background:var(--gray-50); border-radius:8px; margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-size:14px; font-weight:500;">${escHtml(t.task)}</span>
              <span class="badge badge-${t.category}">${t.category}</span>
            </div>
            ${t.method ? `<div style="font-size:13px; color:var(--gray-700);">방법: ${escHtml(t.method)}</div>` : ''}
            ${t.reason ? `<div style="font-size:13px; color:var(--gray-700);">사유: ${escHtml(t.reason)}</div>` : ''}
            ${t.location ? `<div style="font-size:13px; color:var(--gray-500);">장소: ${escHtml(t.location)}</div>` : ''}
            <div style="font-size:12px; color:var(--gray-400);">${t.frequency}회 수행 &middot; 최근 ${t.last_date || '-'}</div>
          </div>
        `).join('')}
      </div>
    `;
  });

  el.innerHTML = html;
}

async function renderCustomManual() {
  const data = await api('/api/manual');
  if (!data) return;
  const el = document.getElementById('manualContent');

  let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
      <button class="btn btn-primary btn-sm" onclick="openNewManualEntry()">+ 항목 추가</button>
    </div>
  `;

  if (data.custom && data.custom.length > 0) {
    data.custom.forEach(item => {
      html += `<div class="card" style="padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div style="flex:1;">
            ${item.task_group ? `<span class="badge badge-내근" style="margin-bottom:4px;">${escHtml(item.task_group)}</span>` : ''}
            <p style="font-size:15px; font-weight:500;">${escHtml(item.title)}</p>
            ${item.content ? `<p style="font-size:14px; margin-top:4px;">${escHtml(item.content)}</p>` : ''}
            ${item.steps ? `<p style="font-size:13px; color:var(--gray-700); margin-top:4px;"><strong>절차:</strong> ${escHtml(item.steps)}</p>` : ''}
            ${item.tips ? `<p style="font-size:13px; color:var(--success); margin-top:4px;"><strong>TIP:</strong> ${escHtml(item.tips)}</p>` : ''}
          </div>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-sm btn-outline" onclick="editManualEntry('${item.id}','${escAttr(item.title)}','${escAttr(item.content||'')}','${escAttr(item.steps||'')}','${escAttr(item.tips||'')}')">수정</button>
            <button class="btn btn-sm btn-danger" onclick="deleteManualEntry('${item.id}')">삭제</button>
          </div>
        </div>
      </div>`;
    });
  } else {
    html += `<div class="card" style="text-align:center; padding:24px;">
      <p style="font-size:14px; color:var(--gray-500);">직접 작성한 매뉴얼이 없습니다.<br>"+ 항목 추가" 버튼으로 추가하세요.</p>
    </div>`;
  }

  el.innerHTML = html;
}

function openNewManualEntry() {
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showManual()" style="margin-bottom:12px;">&larr; 매뉴얼</button>
    <p class="section-title">매뉴얼 항목 추가</p>
    <div class="card">
      <div class="form-group">
        <label>업무 그룹</label>
        <input type="text" id="manualGroup" class="form-control" placeholder="예: 가맹영업, 행정업무">
      </div>
      <div class="form-group">
        <label>제목</label>
        <input type="text" id="manualTitle" class="form-control" placeholder="업무 제목">
      </div>
      <div class="form-group">
        <label>내용</label>
        <textarea id="manualContent" class="form-control" placeholder="업무 내용 설명"></textarea>
      </div>
      <div class="form-group">
        <label>절차/단계</label>
        <textarea id="manualSteps" class="form-control" placeholder="1. 첫번째 단계&#10;2. 두번째 단계&#10;3. ..."></textarea>
      </div>
      <div class="form-group">
        <label>TIP / 참고사항</label>
        <input type="text" id="manualTips" class="form-control" placeholder="업무 시 참고할 팁">
      </div>
      <button class="btn btn-success btn-block" onclick="submitManualEntry()">저장</button>
    </div>
  `;
}

async function submitManualEntry() {
  const body = {
    task_group: document.getElementById('manualGroup').value,
    title: document.getElementById('manualTitle').value,
    content: document.getElementById('manualContent').value,
    steps: document.getElementById('manualSteps').value,
    tips: document.getElementById('manualTips').value
  };
  if (!body.title) { toast('제목을 입력해주세요'); return; }
  await api('/api/manual', { method: 'POST', body });
  toast('매뉴얼 항목이 추가되었습니다');
  showManual();
}

async function editManualEntry(id, title, content, steps, tips) {
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showManual()" style="margin-bottom:12px;">&larr; 매뉴얼</button>
    <p class="section-title">매뉴얼 항목 수정</p>
    <div class="card">
      <div class="form-group">
        <label>제목</label>
        <input type="text" id="editManualTitle" class="form-control" value="${escAttr(title)}">
      </div>
      <div class="form-group">
        <label>내용</label>
        <textarea id="editManualContent" class="form-control">${escHtml(content)}</textarea>
      </div>
      <div class="form-group">
        <label>절차/단계</label>
        <textarea id="editManualSteps" class="form-control">${escHtml(steps)}</textarea>
      </div>
      <div class="form-group">
        <label>TIP</label>
        <input type="text" id="editManualTips" class="form-control" value="${escAttr(tips)}">
      </div>
      <button class="btn btn-success btn-block" onclick="updateManualEntry('${id}')">수정 저장</button>
    </div>
  `;
}

async function updateManualEntry(id) {
  const body = {
    title: document.getElementById('editManualTitle').value,
    content: document.getElementById('editManualContent').value,
    steps: document.getElementById('editManualSteps').value,
    tips: document.getElementById('editManualTips').value
  };
  await api(`/api/manual/${id}`, { method: 'PUT', body });
  toast('매뉴얼이 수정되었습니다');
  showManual();
}

async function deleteManualEntry(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  await api(`/api/manual/${id}`, { method: 'DELETE' });
  toast('삭제되었습니다');
  showManual();
}

// ─── 템플릿 관리 ───
async function manageTemplates() {
  const templates = await api('/api/templates') || [];

  let html = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:16px;">&larr; 뒤로</button>
    <p class="section-title">&#128196; 반복업무 템플릿</p>

    <div class="card" style="background:#e8f0fe; border-left:4px solid var(--primary); margin-bottom:20px;">
      <p style="font-size:15px; font-weight:600; margin-bottom:8px; color:var(--primary);">템플릿이란?</p>
      <p style="font-size:14px; line-height:1.7; color:var(--gray-700);">
        매일 또는 매주 반복되는 업무를 미리 저장해두면,<br>
        업무일지 작성 시 한 번의 터치로 내용을 자동 채워줍니다.
      </p>
      <p style="font-size:14px; line-height:1.7; color:var(--gray-700); margin-top:8px;">
        <strong>사용 방법:</strong>
      </p>
      <ol style="font-size:14px; line-height:1.8; color:var(--gray-700); padding-left:20px; margin-top:4px;">
        <li>업무일지 작성 화면에서 내용을 입력합니다</li>
        <li>하단의 <strong>"템플릿 저장"</strong> 버튼을 눌러 저장합니다</li>
        <li>다음부터는 작성 화면의 <strong>"템플릿 선택"</strong>에서 골라 사용합니다</li>
      </ol>
    </div>
  `;

  if (templates.length === 0) {
    html += '<div class="card"><p style="text-align:center; color:var(--gray-500); font-size:15px; padding:16px;">아직 저장된 템플릿이 없습니다.<br><br>업무일지 작성 화면에서<br>"템플릿 저장" 버튼을 눌러 추가하세요.</p></div>';
  } else {
    html += `<p style="font-size:14px; color:var(--gray-500); margin-bottom:12px;">저장된 템플릿 ${templates.length}개</p>`;
    templates.forEach(t => {
      const data = JSON.parse(t.content_json);
      html += `
        <div class="card" style="padding:14px; margin-bottom:8px;">
          <div style="font-size:15px; font-weight:600; margin-bottom:6px;">${escHtml(t.title)}</div>
          <div style="font-size:13px; color:var(--gray-500); margin-bottom:4px;">${escHtml(t.category)} &middot; 사용 ${t.use_count}회</div>
          ${data.what_task ? `<div style="font-size:13px; color:var(--gray-700);">업무: ${escHtml(data.what_task)}</div>` : ''}
          ${data.where_place ? `<div style="font-size:13px; color:var(--gray-700);">장소: ${escHtml(data.where_place)}</div>` : ''}
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

async function downloadExcel(url, filename) {
  try {
    toast('엑셀 파일 생성 중...');
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (!resp.ok) throw new Error('다운로드 실패');
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast('다운로드 완료!');
  } catch (e) {
    toast('다운로드 실패: ' + e.message);
  }
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

// ─── 비밀번호 재설정 ───
let resetUserId = null;

function showResetPassword() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('resetScreen').style.display = 'flex';
  document.getElementById('resetStep1').style.display = 'block';
  document.getElementById('resetStep2').style.display = 'none';
  document.getElementById('resetName').value = '';
  document.getElementById('resetEmail').value = '';
  resetUserId = null;
}

async function verifyReset() {
  const name = document.getElementById('resetName').value.trim();
  const email = document.getElementById('resetEmail').value.trim();
  if (!name || !email) { toast('이름과 이메일을 입력해주세요'); return; }

  const res = await fetch('/api/reset-password/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email })
  });
  const data = await res.json();
  if (!res.ok) { toast(data.error || '확인 실패'); return; }

  resetUserId = data.userId;
  document.getElementById('resetStep1').style.display = 'none';
  document.getElementById('resetStep2').style.display = 'block';
  toast(`${data.name}님 확인되었습니다. 새 비밀번호를 입력하세요.`);
}

async function submitResetPassword() {
  const pw = document.getElementById('resetNewPw').value;
  const pwConfirm = document.getElementById('resetNewPwConfirm').value;
  if (!pw) { toast('새 비밀번호를 입력해주세요'); return; }
  if (pw !== pwConfirm) { toast('비밀번호가 일치하지 않습니다'); return; }

  const res = await fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: resetUserId, password: pw })
  });
  if (res.ok) {
    toast('비밀번호가 변경되었습니다. 로그인해주세요.');
    backToLogin();
  } else {
    toast('변경 실패');
  }
}

// ─── 가입신청 ───
function showRegisterForm() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('registerScreen').style.display = 'flex';
}

function backToLogin() {
  document.getElementById('registerScreen').style.display = 'none';
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminContainer').style.display = 'none';
  document.getElementById('resetScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

async function submitRegister() {
  toast('가입 처리 중...');
  try {
    const name = document.getElementById('regName').value.trim();
    const phoneRest = document.getElementById('regPhone').value.trim().replace(/[^0-9]/g, '');
    const phone = '010' + phoneRest;
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;

    if (!name || !phoneRest || !password) { toast('이름, 연락처, 비밀번호를 입력해주세요'); return; }
    if (phoneRest.length !== 8) { toast('연락처 뒷번호 8자리를 입력해주세요'); return; }
    if (password !== passwordConfirm) { toast('비밀번호가 일치하지 않습니다'); return; }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const data = await res.json();

    if (!res.ok) { toast(data.error || '가입 실패'); return; }

    currentUser = data;
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    toast(`${data.name}님 환영합니다!`);
    navigate('home');
  } catch (e) {
    toast('가입 오류: ' + e.message);
  }
}

// ─── 관리자 ───
function showAdminLogin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminLoginScreen').style.display = 'flex';
  document.getElementById('adminPassword').value = '';
}

async function adminLogin() {
  const password = document.getElementById('adminPassword').value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();

  if (!res.ok) { toast(data.error || '로그인 실패'); return; }

  currentUser = data.user;
  currentUser.isAdmin = true;
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('appContainer').classList.add('active');
  navigate('home');
}

function adminLogout() {
  document.getElementById('adminContainer').style.display = 'none';
  document.getElementById('adminContainer').classList.remove('active');
  document.getElementById('loginScreen').style.display = 'flex';
}

function showAdminPanel() {
  document.getElementById('appContainer').classList.remove('active');
  document.getElementById('adminContainer').style.display = 'flex';
  document.getElementById('adminContainer').classList.add('active');
  renderAdminPage();
}

function backToApp() {
  document.getElementById('adminContainer').style.display = 'none';
  document.getElementById('adminContainer').classList.remove('active');
  document.getElementById('appContainer').classList.add('active');
  navigate('more');
}

let adminTab = 'staff';

async function renderAdminPage() {
  const check = await fetch('/api/admin/staff', { credentials: 'same-origin' });
  if (!check.ok) {
    document.getElementById('adminContent').innerHTML = `
      <div class="card" style="text-align:center; padding:30px;">
        <p style="font-size:16px; font-weight:600; margin-bottom:12px;">세션이 만료되었습니다</p>
        <p style="font-size:14px; color:var(--gray-500); margin-bottom:16px;">관리자 비밀번호를 다시 입력해주세요</p>
        <button class="btn btn-primary btn-block" onclick="adminLogout()">다시 로그인</button>
      </div>`;
    return;
  }
  const staffList = await check.json();
  window._cachedStaffList = staffList;

  document.getElementById('adminContent').innerHTML = `
    <div class="tabs" style="margin-bottom:16px; flex-wrap:wrap; gap:4px;">
      <button class="tab ${adminTab === 'staff' ? 'active' : ''}" onclick="switchAdminTab('staff')">사전승인 인원</button>
      <button class="tab ${adminTab === 'users' ? 'active' : ''}" onclick="switchAdminTab('users')">회원관리</button>
      <button class="tab ${adminTab === 'register' ? 'active' : ''}" onclick="switchAdminTab('register')">직접가입</button>
      <button class="tab ${adminTab === 'insights' ? 'active' : ''}" onclick="switchAdminTab('insights')">인사이트</button>
    </div>
    <div id="adminTabContent"></div>
    <div style="margin-top:24px; display:flex; flex-direction:column; gap:8px;">
      ${currentUser && currentUser.isAdmin ? '<button class="btn btn-primary btn-block" onclick="backToApp()">앱으로 돌아가기</button>' : ''}
      <button class="btn btn-outline btn-block" onclick="adminLogout()">로그아웃</button>
    </div>
  `;
  if (adminTab === 'staff') renderAdminStaffTab();
  else if (adminTab === 'users') renderAdminUsersTab();
  else if (adminTab === 'register') renderAdminRegisterTab();
  else if (adminTab === 'insights') renderInsightsTab();
}

function switchAdminTab(tab) {
  adminTab = tab;
  renderAdminPage();
}

async function renderAdminStaffTab() {
  let staffList = window._cachedStaffList;
  if (!staffList) {
    const res = await fetch('/api/admin/staff', { credentials: 'same-origin' });
    if (!res.ok) { document.getElementById('adminTabContent').innerHTML = '<p style="color:red;">데이터를 불러올 수 없습니다. 다시 로그인해주세요.</p>'; return; }
    staffList = await res.json();
  }
  window._cachedStaffList = null;

  document.getElementById('adminTabContent').innerHTML = `
    <p class="section-title">사전승인 인원 관리</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">
      등록된 인원만 가입신청이 가능합니다. 현재 ${staffList.length}명 등록됨
    </p>

    <div class="card" style="padding:12px; margin-bottom:16px;">
      <p style="font-weight:600; margin-bottom:8px;">인원 추가</p>
      <div class="form-group">
        <input type="text" id="newStaffName" class="form-control" placeholder="이름">
      </div>
      <div class="form-group">
        <input type="text" id="newStaffPhone" class="form-control" placeholder="연락처 (숫자)">
      </div>
      <div style="display:flex; gap:8px;">
        <div class="form-group" style="flex:1;">
          <input type="text" id="newStaffPosition" class="form-control" placeholder="직급">
        </div>
        <div class="form-group" style="flex:1;">
          <input type="text" id="newStaffLocation" class="form-control" placeholder="근무지">
        </div>
      </div>
      <div class="form-group">
        <input type="text" id="newStaffRole" class="form-control" placeholder="겸직/역할">
      </div>
      <button class="btn btn-success btn-block" onclick="addStaff()">추가</button>
    </div>

    <p class="section-title">등록 인원 목록</p>
    ${staffList.map(s => `
      <div class="card" style="padding:10px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:14px;">
              ${escHtml(s.name)}
              <span style="font-size:12px; color:var(--gray-500); font-weight:normal;">${escHtml(s.position || '')}</span>
              ${s.registered ? '<span style="font-size:11px; color:var(--success); margin-left:4px;">가입완료</span>' : '<span style="font-size:11px; color:var(--gray-400); margin-left:4px;">미가입</span>'}
            </div>
            <div style="font-size:12px; color:var(--gray-500);">
              ${escHtml(s.phone)} ${s.location ? '/ ' + escHtml(s.location) : ''} ${s.role ? '/ ' + escHtml(s.role) : ''}
            </div>
          </div>
          <button class="btn btn-sm btn-danger" onclick="removeStaff('${s.id}')">삭제</button>
        </div>
      </div>
    `).join('')}
  `;
}

async function renderAdminUsersTab() {
  const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
  if (!res.ok) { document.getElementById('adminTabContent').innerHTML = '<p style="color:red;">데이터를 불러올 수 없습니다. 다시 로그인해주세요.</p>'; return; }
  const users = await res.json();

  document.getElementById('adminTabContent').innerHTML = `
    <p class="section-title">가입 회원 관리</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">
      현재 가입된 회원 ${users.length}명
    </p>
    ${users.length === 0 ? '<div class="card"><p style="text-align:center; color:var(--gray-500);">가입된 회원이 없습니다</p></div>' :
    users.map(u => `
      <div class="card" style="padding:10px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div style="flex:1;">
            <div style="font-weight:600; font-size:14px;">
              ${escHtml(u.name)}
              <span style="font-size:12px; color:var(--gray-500); font-weight:normal;">${escHtml(u.position || '')}</span>
            </div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">
              ${escHtml(u.department || '')}
            </div>
            <div style="font-size:12px; color:var(--gray-500);">
              ${escHtml(u.phone || '-')} / ${escHtml(u.email || '-')}
            </div>
            <div style="font-size:11px; color:var(--gray-400); margin-top:2px;">
              가입일: ${u.created_at || '-'}
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <button class="btn btn-sm btn-outline" onclick="resetUserPassword('${u.id}', '${escAttr(u.name)}')">비밀번호 초기화</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}', '${escAttr(u.name)}')">삭제</button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

async function addStaff() {
  const name = document.getElementById('newStaffName').value.trim();
  const phone = document.getElementById('newStaffPhone').value.trim();
  const position = document.getElementById('newStaffPosition').value.trim();
  const location = document.getElementById('newStaffLocation').value.trim();
  const role = document.getElementById('newStaffRole').value.trim();

  if (!name || !phone) { toast('이름과 연락처를 입력해주세요'); return; }

  const res = await fetch('/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, position, location, role })
  });

  if (res.ok) {
    toast(`${name}님이 추가되었습니다`);
    renderAdminPage();
  } else {
    const data = await res.json();
    toast(data.error || '추가 실패');
  }
}

async function removeStaff(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
  toast('삭제되었습니다');
  renderAdminPage();
}

function renderAdminRegisterTab() {
  document.getElementById('adminTabContent').innerHTML = `
    <p class="section-title">관리자 직접 회원등록</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">
      가입신청이 안 될 경우, 여기서 직접 회원을 등록할 수 있습니다.
    </p>
    <div class="card" style="padding:16px;">
      <div class="form-group">
        <label>이름</label>
        <input type="text" id="arName" class="form-control" placeholder="실명">
      </div>
      <div class="form-group">
        <label>연락처</label>
        <input type="tel" id="arPhone" class="form-control" placeholder="010-0000-0000 (전체번호)">
      </div>
      <div class="form-group">
        <label>비밀번호</label>
        <input type="text" id="arPassword" class="form-control" placeholder="초기 비밀번호 설정">
      </div>
      <div style="display:flex; gap:8px;">
        <div class="form-group" style="flex:1;">
          <label>부서</label>
          <input type="text" id="arDept" class="form-control" value="석유사업본부">
        </div>
        <div class="form-group" style="flex:1;">
          <label>직급</label>
          <input type="text" id="arPosition" class="form-control" placeholder="부장, 과장 등">
        </div>
      </div>
      <button class="btn btn-success btn-block btn-lg" onclick="adminRegisterUser()">회원 등록</button>
    </div>
  `;
}

async function adminRegisterUser() {
  const name = document.getElementById('arName').value.trim();
  const phone = document.getElementById('arPhone').value.trim();
  const password = document.getElementById('arPassword').value.trim();
  const department = document.getElementById('arDept').value.trim();
  const position = document.getElementById('arPosition').value.trim();
  if (!name || !phone || !password) { toast('이름, 연락처, 비밀번호를 입력해주세요'); return; }
  try {
    const res = await fetch('/api/admin/register-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, department, position })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || '등록 실패'); return; }
    toast(name + '님이 등록되었습니다! 이제 로그인 가능합니다.');
    switchAdminTab('users');
  } catch (e) {
    toast('등록 오류: ' + e.message);
  }
}

async function resetUserPassword(id, name) {
  if (!confirm(`${name}님의 비밀번호를 "1234"로 초기화하시겠습니까?`)) return;
  await fetch(`/api/admin/users/${id}/reset-password`, { method: 'PUT' });
  toast(`${name}님 비밀번호가 1234로 초기화되었습니다`);
}

async function deleteUser(id, name) {
  if (!confirm(`${name}님을 삭제하시겠습니까? 관련 데이터도 모두 삭제됩니다.`)) return;
  await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  toast(`${name}님이 삭제되었습니다`);
  renderAdminPage();
}

// ─── 시크릿: 인사이트 분석 ───
const _I = 'background:#fff; color:#222; border:1px solid #e0e0e0; border-radius:8px; padding:14px; margin-bottom:12px;';

async function renderInsightsTab() {
  document.getElementById('adminTabContent').innerHTML = `
    <div style="background:#fff; color:#222; padding:40px 16px; text-align:center; border-radius:8px;">
      <p style="font-size:18px; font-weight:700; margin-bottom:8px;">전략 인사이트 분석</p>
      <p style="font-size:13px; color:#555; margin-bottom:24px; line-height:1.6;">
        노션 회의록 기반<br>긍정·부정 양면 추론 분석
      </p>
      <button class="btn btn-lg btn-primary" onclick="runInsightsAnalysis()" style="padding:14px 32px; font-size:16px;">
        분석 시작
      </button>
    </div>
  `;
}

async function runInsightsAnalysis() {
  document.getElementById('adminTabContent').innerHTML = `
    <div style="background:#fff; color:#222; text-align:center; padding:60px 0; border-radius:8px;">
      <p style="font-size:15px;">회의록 분석 중...</p>
    </div>`;

  const data = await api('/api/admin/insights');
  if (!data) { document.getElementById('adminTabContent').innerHTML = '<p style="color:red; text-align:center;">분석 데이터를 불러올 수 없습니다.</p>'; return; }

  const dateFrom = (data.date_range?.from || '').substring(0, 10);
  const dateTo = (data.date_range?.to || '').substring(0, 10);
  const p = data.positive;
  const n = data.negative;
  const r = data.recommendation;

  document.getElementById('adminTabContent').innerHTML = `
    <div style="background:#fff; color:#222; border-radius:8px; padding:12px;">

    <p style="font-size:12px; color:#666; margin-bottom:16px;">기간 ${escHtml(dateFrom)} ~ ${escHtml(dateTo)} · ${data.notes_analyzed}건 분석</p>

    <div style="display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="tab active" onclick="switchInsightView(this,'positive')">긍정적 분석</button>
      <button class="tab" onclick="switchInsightView(this,'negative')">부정적 분석</button>
      <button class="tab" onclick="switchInsightView(this,'recommend')">차선의 선택</button>
      <button class="tab" onclick="switchInsightView(this,'data')">원본 데이터</button>
    </div>

    <div id="insightPositive">
      ${renderDeductiveCard('긍정적 연역 추론', p.deductive)}
      ${renderInductiveCard('긍정적 귀납 예언', p.inductive)}
    </div>

    <div id="insightNegative" style="display:none;">
      ${renderDeductiveCard('부정적 연역 추론', n.deductive)}
      ${renderInductiveCard('부정적 귀납 예언', n.inductive)}
    </div>

    <div id="insightRecommend" style="display:none;">
      <div style="${_I}">
        <p style="font-weight:700; font-size:15px; margin-bottom:14px;">양가적 분석 — 차선의 선택</p>

        <div style="padding:10px; background:#fafafa; border-radius:6px; margin-bottom:10px; border:1px solid #e0e0e0;">
          <p style="font-weight:600; margin-bottom:4px;">최악의 시나리오</p>
          <p style="font-size:13px;">${escHtml(r.worst)}</p>
        </div>
        <div style="padding:10px; background:#fafafa; border-radius:6px; margin-bottom:10px; border:1px solid #e0e0e0;">
          <p style="font-weight:600; margin-bottom:4px;">최선의 시나리오</p>
          <p style="font-size:13px;">${escHtml(r.best)}</p>
        </div>
        <div style="padding:12px; background:#f5f5f0; border-radius:6px; border:1px solid #ccc;">
          <p style="font-weight:700; font-size:14px; margin-bottom:4px;">→ 차선의 선택 (권장)</p>
          <p style="font-size:13px;">${escHtml(r.second_best)}</p>
        </div>
      </div>

      <div style="${_I}">
        <p style="font-weight:700; font-size:15px; margin-bottom:12px;">우선순위별 실행 과제</p>
        ${r.actions.map(a => `
          <div style="padding:10px; margin-bottom:8px; border-radius:6px; background:#fafafa; border:1px solid #e0e0e0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:600; font-size:14px;">${escHtml(a.task)}</span>
              <span style="font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; color:#fff; background:${a.priority === '최우선' ? '#555' : a.priority === '우선' ? '#888' : '#aaa'};">${escHtml(a.priority)}</span>
            </div>
            <p style="font-size:13px; color:#444;">${escHtml(a.reason)}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <div id="insightData" style="display:none;">
      <div style="${_I}">
        <p style="font-weight:700; font-size:15px; margin-bottom:12px;">분석 대상 회의록 (${data.notes_analyzed}건)</p>
        ${data.notes_summary.map(ns => `
          <div style="padding:6px 0; border-bottom:1px solid #eee; font-size:13px;">
            <span style="color:#666; margin-right:8px;">${escHtml((ns.date||'').substring(0,10))}</span>
            <span style="font-weight:500;">${escHtml(ns.title)}</span>
          </div>
        `).join('')}
      </div>

      <div style="${_I}">
        <p style="font-weight:700; font-size:15px; margin-bottom:12px;">주요 테마 빈도</p>
        ${data.themes.slice(0, 15).map(t => `
          <div style="display:flex; justify-content:space-between; padding:4px 0; font-size:13px; border-bottom:1px solid #eee;">
            <span>${escHtml(t.theme)}</span>
            <span style="font-weight:600;">${t.count}회</span>
          </div>
        `).join('')}
      </div>

      <div style="${_I}">
        <p style="font-weight:700; font-size:15px; margin-bottom:12px;">실행 항목 (${data.action_items.length}건)</p>
        ${data.action_items.slice(0, 20).map(a => `
          <div style="padding:6px 0; border-bottom:1px solid #eee; font-size:13px;">
            <div style="font-weight:500;">- ${escHtml(a.text)}</div>
            <div style="font-size:11px; color:#666;">${escHtml((a.date||'').substring(0,10))} — ${escHtml(a.from)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    </div>
  `;
}

function switchInsightView(btn, view) {
  document.querySelectorAll('#adminTabContent .tab').forEach(t => {
    if (t.textContent.includes('긍정') || t.textContent.includes('부정') || t.textContent.includes('차선') || t.textContent.includes('원본'))
      t.classList.remove('active');
  });
  btn.classList.add('active');
  ['insightPositive','insightNegative','insightRecommend','insightData'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const map = { positive:'insightPositive', negative:'insightNegative', recommend:'insightRecommend', data:'insightData' };
  const el = document.getElementById(map[view]);
  if (el) el.style.display = 'block';
}

function renderDeductiveCard(title, d) {
  return `
    <div style="${_I}">
      <p style="font-weight:700; font-size:15px; margin-bottom:14px;">${escHtml(title)}</p>
      <div style="font-size:14px; line-height:1.8;">
        <div style="padding:10px; background:#fafafa; border-radius:6px; margin-bottom:6px; border:1px solid #e8e8e8;">
          <p style="font-size:11px; font-weight:700; color:#888; margin-bottom:2px;">대전제</p>
          <p>${escHtml(d.major)}</p>
        </div>
        <p style="text-align:center; color:#bbb; margin:2px 0;">↓</p>
        <div style="padding:10px; background:#fafafa; border-radius:6px; margin-bottom:6px; border:1px solid #e8e8e8;">
          <p style="font-size:11px; font-weight:700; color:#888; margin-bottom:2px;">소전제</p>
          <p>${escHtml(d.minor)}</p>
        </div>
        <p style="text-align:center; color:#bbb; margin:2px 0;">↓</p>
        <div style="padding:12px; background:#f5f5f0; border-radius:6px; border:1px solid #ccc;">
          <p style="font-size:11px; font-weight:700; color:#888; margin-bottom:2px;">결론</p>
          <p style="font-weight:600;">${escHtml(d.conclusion)}</p>
        </div>
      </div>
    </div>`;
}

function renderInductiveCard(title, ind) {
  return `
    <div style="${_I}">
      <p style="font-weight:700; font-size:15px; margin-bottom:14px;">${escHtml(title)}</p>
      <div style="font-size:14px; line-height:1.7;">
        <p style="font-size:12px; font-weight:700; color:#888; margin-bottom:8px;">관찰 패턴</p>
        ${ind.observations.map((o, i) => `
          <div style="padding:8px 10px; margin-bottom:6px; background:#fafafa; border-radius:6px; border:1px solid #e8e8e8;">
            <p style="font-size:12px; font-weight:600; color:#888; margin-bottom:2px;">관찰 ${i + 1}</p>
            <p style="font-size:13px;">${escHtml(o)}</p>
          </div>
        `).join('')}
        <p style="text-align:center; color:#bbb; margin:8px 0;">↓</p>
        <div style="padding:14px; background:#f5f5f0; border-radius:6px; border:1px solid #ccc;">
          <p style="font-size:12px; font-weight:700; color:#888; margin-bottom:4px;">귀납적 예언</p>
          <p style="font-weight:500; line-height:1.8;">${escHtml(ind.prediction)}</p>
        </div>
      </div>
    </div>`;
}

// 초기화
checkAuth();
