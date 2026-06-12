let currentUser = null;
let currentPage = 'home';
let editingReportId = null;
const PAGE_SIZE = 15;

// ─── 네비게이터 커스텀 설정 ───
const NAV_ITEMS = [
  { id: 'home', icon: '&#127968;', label: '홈' },
  { id: 'reports', icon: '&#128221;', label: '업무일지' },
  { id: 'weekly', icon: '&#128197;', label: '주간계획' },
  { id: 'notices', icon: '&#128227;', label: '공지사항', action: 'showNoticesList' },
  { id: 'board', icon: '&#128172;', label: '게시판', action: 'showBoard' },
  { id: 'todo', icon: '&#9745;', label: '할 일', action: 'showTodoPage' },
  { id: 'attendance', icon: '&#128339;', label: '출퇴근', action: 'showAttendancePage' },
  { id: 'schedule', icon: '&#128197;', label: '팀 일정', action: 'showSchedulePage' },
  { id: 'bookmarks', icon: '&#11088;', label: '즐겨찾기', action: 'showBookmarks' },
  { id: 'calendar', icon: '&#128467;', label: '캘린더', action: 'showWorkCalendar' },
  { id: 'timeline', icon: '&#128337;', label: '타임라인', action: 'showTimeline' },
  { id: 'notes', icon: '&#128221;', label: '메모', action: 'showNotes' },
  { id: 'insight', icon: '&#129504;', label: 'AI 분석', action: 'showSmartInsight' },
  { id: 'monthly', icon: '&#128202;', label: '월간요약', action: 'showMonthlySummary' },
  { id: 'handover', icon: '&#128196;', label: '인수인계', action: 'showHandover' },
];
const DEFAULT_NAV = ['home', 'reports', 'weekly'];

function getNavConfig() {
  try {
    const saved = localStorage.getItem('navConfig');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length === 3) return arr;
    }
  } catch(e) {}
  return DEFAULT_NAV.slice();
}

function saveNavConfig(config) {
  localStorage.setItem('navConfig', JSON.stringify(config));
}

function rebuildNav() {
  const config = getNavConfig();
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  let html = '';
  config.forEach(id => {
    const item = NAV_ITEMS.find(n => n.id === id);
    if (!item) return;
    const isActive = currentPage === id;
    html += `<button class="nav-item${isActive ? ' active' : ''}" data-page="${id}" onclick="navigate('${id}')" data-help="'${item.label}' 화면으로 이동합니다.">
      <span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`;
  });
  html += `<button class="nav-item${currentPage === 'more' ? ' active' : ''}" data-page="more" onclick="navigate('more')" data-help="공지·게시판·할 일·출퇴근 등 모든 기능을 모아둔 더보기 화면입니다.">
    <span class="nav-icon">&#9776;</span><span>더보기</span></button>`;
  nav.innerHTML = html;
}

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
let _loginBusy = false;
async function login() {
  if (_loginBusy) return;
  const phoneRest = document.getElementById('loginPhone').value.trim().replace(/[^0-9]/g, '');
  const phone = '010' + phoneRest;
  const password = document.getElementById('loginPassword').value;
  if (!phoneRest || !password) { showResultModal('error', '입력 오류', '연락처와 비밀번호를 입력해주세요.', '확인'); return; }
  const btn = document.querySelector('#loginScreen .btn-primary');
  _loginBusy = true;
  if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = '로그인 중...'; btn.style.opacity = '0.7'; }
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();
    if (!res.ok) { showResultModal('error', '로그인 실패', data.error || '연락처 또는 비밀번호가 올바르지 않습니다.', '확인'); return; }
    currentUser = data;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    rebuildNav();
    navigate('home');
    toast(`${data.name}님 환영합니다!`);
    restorePendingVoice();
    setTimeout(() => startVoiceGuide(), 1200);
  } catch (e) {
    showResultModal('error', '서버 연결 실패', '서버에 연결할 수 없습니다.\n잠시 후 다시 시도해주세요.', '확인');
  } finally {
    _loginBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || '로그인'; btn.style.opacity = ''; }
  }
}

function restorePendingVoice() {
  const pending = localStorage.getItem('voicePending');
  if (!pending) return;
  localStorage.removeItem('voicePending');
  toast('음성 녹음 데이터를 복원합니다');
  setTimeout(() => {
    openNewReport();
    setTimeout(() => { parseVoiceToFields(pending); }, 400);
  }, 500);
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
    rebuildNav();
    navigate('home');
    setTimeout(checkNotiCount, 2000);
    setInterval(checkNotiCount, 120000);
    setTimeout(checkAttendancePopup, 4000);
    restorePendingVoice();
    setTimeout(() => startVoiceGuide(), 1500);
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  reportViewMode = 'mine';
  editingReportId = null;
  _vgActive = false;
  _vgDidCheckin = false;
  localStorage.removeItem('voiceCache');
  localStorage.removeItem('voicePending');
  localStorage.removeItem('vgDone');
  if (window.speechSynthesis) speechSynthesis.cancel();
  document.getElementById('voiceGuideOverlay').style.display = 'none';
  showLogin();
}

// ─── 네비게이션 ───
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  const fab = document.getElementById('fabBtn');
  fab.style.display = ['home', 'reports'].includes(page) ? 'flex' : 'none';

  const coreRenderers = { home: renderHome, reports: renderReports, weekly: renderWeekly, more: renderMore };

  if (coreRenderers[page]) {
    const navItem = NAV_ITEMS.find(n => n.id === page);
    document.getElementById('pageTitle').textContent = (navItem && navItem.label) || 'WorkFlow';
    coreRenderers[page]();
  } else if (page === 'more') {
    document.getElementById('pageTitle').textContent = '더보기';
    renderMore();
  } else {
    const navItem = NAV_ITEMS.find(n => n.id === page);
    if (navItem && navItem.action && typeof window[navItem.action] === 'function') {
      document.getElementById('pageTitle').textContent = navItem.label;
      window[navItem.action]();
    }
  }

  rebuildNav();
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
  const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const [reports, dash, notices, todos, atd, events] = await Promise.all([
    api(`/api/reports?from=${weekAgo}&to=${today}`),
    api('/api/dashboard'),
    api('/api/notices'),
    api('/api/todos'),
    api('/api/attendance/today'),
    api(`/api/events?from=${today}&to=${weekLater}`)
  ]);
  const rpts = reports || [];
  const d = dash || {};

  const myReports = rpts.filter(r => r.author_id === currentUser.id);
  const todayReports = myReports.filter(r => (r.report_date || '').split('T')[0] === today);
  const othersReports = rpts.filter(r => r.author_id !== currentUser.id);

  const maxAct = Math.max(...(d.week_activity || []).map(a => a.count), 1);
  const actChart = (d.week_activity || []).map(a => {
    const h = Math.max(4, Math.round(a.count / maxAct * 60));
    const myC = (d.my_week_activity || []).find(m => m.date === a.date);
    const myH = myC ? Math.max(0, Math.round(myC.count / maxAct * 60)) : 0;
    const isToday = a.date === today;
    return `<div style="display:flex; flex-direction:column; align-items:center; flex:1;">
      <div style="font-size:10px; color:var(--gray-500); margin-bottom:2px;">${a.count > 0 ? a.count : ''}</div>
      <div style="width:100%; max-width:28px; height:64px; display:flex; flex-direction:column; justify-content:flex-end; align-items:center;">
        <div style="width:100%; height:${h}px; background:${isToday ? 'var(--primary)' : 'var(--gray-200)'}; border-radius:4px 4px 0 0; position:relative;">
          ${myH > 0 ? `<div style="position:absolute; bottom:0; left:0; right:0; height:${myH}px; background:${isToday ? '#1557b0' : 'var(--primary)'}; border-radius:0 0 0 0; opacity:0.7;"></div>` : ''}
        </div>
      </div>
      <div style="font-size:11px; ${isToday ? 'font-weight:700; color:var(--primary);' : 'color:var(--gray-500);'} margin-top:4px;">${a.day}</div>
    </div>`;
  }).join('');

  const catColors = { '내근': '#1a73e8', '외근': '#34a853', '출장': '#ea4335' };
  const myCats = d.my_categories || [];
  const totalCat = myCats.reduce((s, c) => s + c.count, 0) || 1;

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
                <div class="list-item-sub">${r.author_name} ${r.author_position || ''} &middot; ${(r.report_date||'').split('T')[0]}</div>
              </div>
              <span class="badge badge-${r.work_category}">${r.work_category}</span>
            </div>
          `).join('')}
          ${othersReports.length > 8 ? `<button class="btn btn-outline btn-block btn-sm" onclick="navigate('reports')" style="margin-top:8px;">전체 보기 (${othersReports.length}건)</button>` : ''}
        </div>
      `}
    `;
  }

  const activeNotices = (notices || []).filter(n => n.active);
  const pinnedNotices = activeNotices.filter(n => n.pinned);
  const normalNotices = activeNotices.filter(n => !n.pinned);
  const showNotices = [...pinnedNotices, ...normalNotices].slice(0, 3);

  const priorityStyle = { urgent: 'background:#fef2f2; border-left:4px solid #ef4444; color:#991b1b;', important: 'background:#fffbeb; border-left:4px solid #f59e0b; color:#92400e;', normal: 'background:#f0f9ff; border-left:4px solid #3b82f6; color:#1e40af;' };
  const priorityIcon = { urgent: '&#128680;', important: '&#9888;&#65039;', normal: '&#128227;' };

  document.getElementById('mainContent').innerHTML = `
    <div style="margin-bottom:20px;">
      <p style="font-size:15px; color:var(--gray-500);">안녕하세요,</p>
      <p style="font-size:22px; font-weight:600;">${currentUser.name} ${currentUser.position || ''}님</p>
      ${currentUser.company_name ? `<p style="font-size:13px; color:var(--primary); margin-top:2px;">${escHtml(currentUser.company_name)}${currentUser.team_name ? ' · ' + escHtml(currentUser.team_name) : ''}</p>` : ''}
    </div>

    ${showNotices.length > 0 ? `
    <div style="margin-bottom:16px;">
      ${showNotices.map(n => `
        <div onclick="showNoticeDetail('${n.id}')" style="${priorityStyle[n.priority] || priorityStyle.normal} padding:10px 12px; border-radius:8px; margin-bottom:6px; cursor:pointer;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:14px;">${priorityIcon[n.priority] || priorityIcon.normal}</span>
            ${n.pinned ? '<span style="font-size:10px; background:#ef4444; color:#fff; padding:1px 5px; border-radius:3px;">고정</span>' : ''}
            <span style="font-size:13px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(n.title)}</span>
            <span style="font-size:11px; opacity:0.6; white-space:nowrap;">${(n.created_at||'').substring(0,10)}</span>
          </div>
        </div>
      `).join('')}
      ${activeNotices.length > 3 ? `<button class="btn btn-outline btn-sm btn-block" onclick="showNoticesList()" style="margin-top:4px;">공지사항 전체보기 (${activeNotices.length}건)</button>` : ''}
    </div>` : ''}

    <!-- 출퇴근 -->
    <div class="card" style="margin-bottom:16px; padding:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="font-size:14px; font-weight:700;">&#128339; 출퇴근</span>
          ${atd ? `<span style="font-size:12px; color:var(--gray-500); margin-left:8px;">${atd.status === 'late' ? '<span style="color:#ef4444;">지각</span>' : '정상'}</span>` : ''}
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn-outline btn-sm" onclick="showTeamAttBoard()" style="padding:4px 10px; font-size:11px;">현황판</button>
          ${!atd ? `<button class="btn btn-primary btn-sm" onclick="doCheckIn()" style="padding:6px 16px;">출근</button>` :
            !atd.check_out ? `
              <span style="font-size:12px; color:var(--success); display:flex; align-items:center; gap:4px;">&#9679; ${atd.work_type === '외근' ? '🚗외근' : '🏢내근'} ${(atd.check_in||'').substring(11,16)}</span>
              <button class="btn btn-sm" onclick="doCheckOut()" style="padding:6px 16px; background:#ef4444; color:#fff; border:none;">퇴근</button>` :
            `<span style="font-size:12px; color:var(--gray-500);">${atd.work_type === '외근' ? '🚗' : '🏢'} ${(atd.check_in||'').substring(11,16)} ~ ${(atd.check_out||'').substring(11,16)} (${calcWorkHours(atd.check_in, atd.check_out)})</span>`}
        </div>
      </div>
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
        <div class="stat-number">${d.month_count || 0}</div>
        <div class="stat-label">이번 달</div>
      </div>
      ${d.pending_approvals > 0 ? `
      <div class="stat-card" style="border:2px solid var(--danger); cursor:pointer;" onclick="navigate('reports')">
        <div class="stat-number" style="color:var(--danger);">${d.pending_approvals}</div>
        <div class="stat-label">결재대기</div>
      </div>` : `
      <div class="stat-card">
        <div class="stat-number">${myReports.filter(r => r.status === 'approved').length}</div>
        <div class="stat-label">결재완료</div>
      </div>`}
    </div>

    <!-- 주간 활동 그래프 -->
    <div class="card" style="margin-bottom:16px; padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:14px; font-weight:700;">&#128202; 주간 활동</span>
        <div style="display:flex; gap:8px; font-size:11px; color:var(--gray-500);">
          <span style="display:flex; align-items:center; gap:3px;"><span style="width:8px; height:8px; background:var(--gray-200); border-radius:2px;"></span>전체</span>
          <span style="display:flex; align-items:center; gap:3px;"><span style="width:8px; height:8px; background:var(--primary); border-radius:2px;"></span>나</span>
        </div>
      </div>
      <div style="display:flex; gap:4px; align-items:flex-end;">${actChart}</div>
    </div>

    ${myCats.length > 0 ? `
    <!-- 이번 주 업무 유형 -->
    <div class="card" style="margin-bottom:16px; padding:14px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px;">&#128200; 이번 주 업무 비중</span>
      <div style="display:flex; border-radius:6px; overflow:hidden; height:24px; margin-bottom:8px;">
        ${myCats.map(c => `<div style="width:${Math.round(c.count / totalCat * 100)}%; background:${catColors[c.name] || '#999'}; min-width:20px;" title="${c.name} ${c.count}건"></div>`).join('')}
      </div>
      <div style="display:flex; gap:12px; font-size:12px;">
        ${myCats.map(c => `<span style="display:flex; align-items:center; gap:3px;"><span style="width:8px; height:8px; border-radius:2px; background:${catColors[c.name] || '#999'};"></span>${c.name} ${c.count}건</span>`).join('')}
      </div>
    </div>` : ''}

    ${(d.my_top_tasks || []).length > 0 ? `
    <!-- 자주 하는 업무 -->
    <div class="card" style="margin-bottom:16px; padding:14px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:8px;">&#128293; 자주 하는 업무</span>
      ${d.my_top_tasks.map(t => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-100);">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge badge-${t.category}" style="font-size:10px;">${t.category}</span>
            <span style="font-size:13px;">${escHtml(t.task)}</span>
          </div>
          <span style="font-size:12px; color:var(--gray-500);">${t.count}회</span>
        </div>
      `).join('')}
    </div>` : ''}

    <p class="section-title">&#9889; 빠른 작성</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="openNewReport('내근')" data-help="근무유형이 '내근'으로 미리 채워진 업무일지 작성 양식을 엽니다.">
        <span class="qa-icon">&#128187;</span>
        <span class="qa-label">내근 업무</span>
      </button>
      <button class="quick-action-btn" onclick="openNewReport('외근')" data-help="근무유형이 '외근'으로 미리 채워진 업무일지 작성 양식을 엽니다.">
        <span class="qa-icon">&#128694;</span>
        <span class="qa-label">외근 업무</span>
      </button>
      <button class="quick-action-btn" onclick="openNewReport('출장')" data-help="근무유형이 '출장'으로 미리 채워진 업무일지 작성 양식을 엽니다.">
        <span class="qa-icon">&#9992;</span>
        <span class="qa-label">출장 보고</span>
      </button>
      <button class="quick-action-btn" onclick="openWeeklyPlan()" data-help="이번 주 요일별 업무 계획을 작성하는 주간계획 화면을 엽니다.">
        <span class="qa-icon">&#128197;</span>
        <span class="qa-label">주간계획</span>
      </button>
    </div>

    <!-- 할 일 위젯 -->
    <div class="card" style="margin-bottom:16px; padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:14px; font-weight:700;">&#9745; 할 일</span>
        <button class="btn btn-outline btn-sm" onclick="showTodoPage()" style="font-size:11px; padding:3px 10px;">전체보기</button>
      </div>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <input type="text" id="homeQuickTodo" class="form-control" placeholder="할 일 빠른 추가..." style="font-size:13px; padding:8px 10px; flex:1;">
        <button class="btn btn-primary btn-sm" onclick="quickAddTodo()" style="white-space:nowrap; padding:8px 12px;">추가</button>
      </div>
      ${(todos || []).length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center; padding:8px 0;">등록된 할 일이 없습니다</p>' :
        (todos || []).slice(0, 5).map(t => {
          const overdue = t.due_date && (t.due_date.split('T')[0] < today) && !t.completed;
          const pDot = { high: '#ef4444', normal: '#3b82f6', low: '#9ca3af' };
          return `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--gray-100);">
            <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodoHome('${t.id}', this.checked)" style="width:18px; height:18px; cursor:pointer; accent-color:var(--primary);">
            <div style="flex:1; min-width:0;">
              <span style="font-size:13px; ${t.completed ? 'text-decoration:line-through; color:var(--gray-400);' : ''} ${overdue ? 'color:#ef4444;' : ''}">${escHtml(t.title)}</span>
              ${t.due_date ? `<span style="font-size:10px; color:${overdue ? '#ef4444' : 'var(--gray-500)'}; margin-left:4px;">${t.due_date.split('T')[0]}</span>` : ''}
            </div>
            <span style="width:6px; height:6px; border-radius:50%; background:${pDot[t.priority] || pDot.normal}; flex-shrink:0;"></span>
          </div>`;
        }).join('') + ((todos || []).length > 5 ? `<p style="font-size:12px; color:var(--gray-500); text-align:center; margin-top:6px;">+${(todos||[]).length - 5}개 더</p>` : '')}
    </div>

    ${(events || []).length > 0 ? `
    <!-- 다가오는 일정 -->
    <div class="card" style="margin-bottom:16px; padding:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <span style="font-size:14px; font-weight:700;">&#128197; 다가오는 일정</span>
        <button class="btn btn-outline btn-sm" onclick="showSchedulePage()" style="font-size:11px; padding:3px 10px;">전체보기</button>
      </div>
      ${(events || []).slice(0, 4).map(e => {
        const eDate = (e.event_date||'').split('T')[0];
        const isToday = eDate === today;
        return `<div style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--gray-100);">
          <div style="width:4px; height:28px; border-radius:2px; background:${e.color || '#3b82f6'}; flex-shrink:0;"></div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:500;">${escHtml(e.title)}</div>
            <div style="font-size:11px; color:var(--gray-500);">${isToday ? '<span style="color:var(--primary); font-weight:600;">오늘</span>' : eDate} ${e.event_time || ''}</div>
          </div>
          <span style="font-size:10px; padding:1px 6px; border-radius:3px; background:${e.color || '#3b82f6'}22; color:${e.color || '#3b82f6'}; font-weight:600;">${e.event_type}</span>
        </div>`;
      }).join('')}
    </div>` : ''}

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
          <div class="list-item-sub">${(r.report_date||'').split('T')[0]} &middot; ${r.where_place || ''}</div>
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
let reportDisplayMode = 'list';
let calYear, calMonth;

async function renderReports() {
  if (reportDisplayMode === 'calendar') { renderCalendarView(); return; }
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
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <div class="tabs" style="margin-bottom:0;">
        <button class="tab ${reportViewMode === 'mine' ? 'active' : ''}" onclick="switchReportView('mine')">내 업무</button>
        <button class="tab ${reportViewMode === 'all' ? 'active' : ''}" onclick="switchReportView('all')">전체 업무</button>
      </div>
      <button class="btn btn-outline btn-sm" onclick="reportDisplayMode='calendar'; renderReports();" style="white-space:nowrap;">&#128197; 캘린더</button>
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

async function renderCalendarView() {
  const now = new Date();
  if (!calYear) calYear = now.getFullYear();
  if (!calMonth) calMonth = now.getMonth() + 1;

  const data = await api(`/api/calendar?year=${calYear}&month=${calMonth}`);
  if (!data) return;

  const fab = document.getElementById('fabBtn');
  fab.style.display = 'flex';
  fab.onclick = () => openNewReport();

  const today = now.toISOString().split('T')[0];
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const lastDate = new Date(calYear, calMonth, 0).getDate();
  const catColors = { '내근': '#1a73e8', '외근': '#34a853', '출장': '#ea4335' };

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div style="min-height:48px;"></div>';
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const reports = data.days[dateStr] || [];
    const isToday = dateStr === today;
    const isSun = (firstDay + d - 1) % 7 === 0;
    const isSat = (firstDay + d - 1) % 7 === 6;

    let dots = '';
    if (reports.length > 0) {
      const cats = [...new Set(reports.map(r => r.category))];
      dots = `<div style="display:flex; gap:2px; justify-content:center; margin-top:2px;">
        ${cats.slice(0, 3).map(c => `<span style="width:6px; height:6px; border-radius:50%; background:${catColors[c] || '#999'};"></span>`).join('')}
      </div>`;
      if (reports.length > 1) dots += `<div style="font-size:9px; color:var(--gray-500);">${reports.length}</div>`;
    }

    cells += `
      <div onclick="showCalendarDay('${dateStr}')" style="min-height:48px; padding:4px 2px; text-align:center; cursor:pointer;
        border-radius:8px; ${isToday ? 'background:var(--primary-light); border:2px solid var(--primary);' : ''} ${reports.length > 0 ? 'font-weight:600;' : ''}">
        <div style="font-size:13px; ${isSun ? 'color:#ea4335;' : ''} ${isSat ? 'color:#1a73e8;' : ''}">${d}</div>
        ${dots}
      </div>`;
  }

  document.getElementById('mainContent').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <button class="btn btn-outline btn-sm" onclick="reportDisplayMode='list'; calYear=null; calMonth=null; renderReports();">&#128221; 목록</button>
      <div style="display:flex; align-items:center; gap:12px;">
        <button class="btn btn-outline btn-sm" onclick="changeCalMonth(-1)">&larr;</button>
        <span style="font-size:16px; font-weight:700;">${calYear}년 ${calMonth}월</span>
        <button class="btn btn-outline btn-sm" onclick="changeCalMonth(1)">&rarr;</button>
      </div>
      <button class="btn btn-outline btn-sm" onclick="calYear=${now.getFullYear()}; calMonth=${now.getMonth()+1}; renderCalendarView();">오늘</button>
    </div>

    <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px;">
      ${['일','월','화','수','목','금','토'].map((d,i) =>
        `<div style="text-align:center; font-size:12px; font-weight:600; padding:4px; color:${i===0?'#ea4335':i===6?'#1a73e8':'var(--gray-500)'};">${d}</div>`
      ).join('')}
    </div>

    <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:16px;">
      ${cells}
    </div>

    <div style="display:flex; gap:12px; justify-content:center; font-size:11px; color:var(--gray-500); margin-bottom:12px;">
      <span style="display:flex; align-items:center; gap:3px;"><span style="width:6px; height:6px; border-radius:50%; background:#1a73e8;"></span>내근</span>
      <span style="display:flex; align-items:center; gap:3px;"><span style="width:6px; height:6px; border-radius:50%; background:#34a853;"></span>외근</span>
      <span style="display:flex; align-items:center; gap:3px;"><span style="width:6px; height:6px; border-radius:50%; background:#ea4335;"></span>출장</span>
    </div>

    <div id="calDayDetail"></div>
  `;
}

function changeCalMonth(delta) {
  calMonth += delta;
  if (calMonth > 12) { calMonth = 1; calYear++; }
  if (calMonth < 1) { calMonth = 12; calYear--; }
  renderCalendarView();
}

function showCalendarDay(dateStr) {
  const data = window._calDayCache || {};
  const el = document.getElementById('calDayDetail');
  if (!el) return;

  const calData = window._kmData; // won't work, need to get from current calendar data
  // re-fetch from the already loaded calendar API data
  // Actually, let's fetch from the reports API
  api(`/api/reports?from=${dateStr}&to=${dateStr}`).then(reports => {
    if (!reports || reports.length === 0) {
      el.innerHTML = `<div class="card" style="text-align:center; padding:16px; color:var(--gray-500);">
        <p>${dateStr} - 업무기록 없음</p>
        <button class="btn btn-primary btn-sm" onclick="openNewReport()" style="margin-top:8px;">+ 업무일지 작성</button>
      </div>`;
      return;
    }
    el.innerHTML = `
      <p style="font-size:14px; font-weight:700; margin-bottom:8px;">${dateStr} (${reports.length}건)</p>
      ${reports.map(r => `
        <div class="list-item" onclick="viewReport('${r.id}')">
          <div class="list-item-content">
            <div class="list-item-title">${escHtml(r.what_task || r.content || '(내용 없음)')}</div>
            <div class="list-item-sub">${r.author_name} ${r.author_position || ''}</div>
          </div>
          <span class="badge badge-${r.work_category}">${r.work_category}</span>
        </div>
      `).join('')}`;
  });
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
        <div class="list-item-sub">${r.author_name} ${r.author_position} &middot; ${(r.report_date||'').split('T')[0]}${parseInt(r.comment_count) > 0 ? ` &middot; <span style="color:var(--primary);">&#128172;${r.comment_count}</span>` : ''}</div>
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
  const [data, comments] = await Promise.all([
    api(`/api/reports/${id}`),
    api(`/api/reports/${id}/comments`)
  ]);
  if (!data) return;
  const cmts = comments || [];

  const bmCheck = await api(`/api/bookmarks/check/${id}`);
  const isBm = bmCheck && bmCheck.bookmarked;

  document.getElementById('mainContent').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <button class="btn btn-outline btn-sm" onclick="navigate('reports')">&larr; 목록</button>
      <button id="bookmarkBtn" onclick="toggleBookmark(${id})" style="background:none; border:none; font-size:24px; cursor:pointer; padding:4px;" title="${isBm ? '즐겨찾기 해제' : '즐겨찾기 추가'}">${isBm ? '&#11088;' : '&#9734;'}</button>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="badge badge-${data.work_category}">${data.work_category}</span>
        <span class="badge badge-${data.status}">${statusLabel(data.status)}</span>
      </div>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:12px;">
        ${data.author_name} ${data.author_position} &middot; ${(data.report_date||'').split('T')[0]} &middot; ${data.report_type === 'daily' ? '일일보고' : '주간보고'}
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

    <!-- 댓글/피드백 -->
    <div class="card" style="margin-top:12px;">
      <p class="card-title" style="margin-bottom:12px;">&#128172; 댓글 (${cmts.length})</p>
      <div id="commentList">
        ${cmts.length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center; padding:8px 0;">아직 댓글이 없습니다</p>' :
          cmts.map(c => renderComment(c)).join('')}
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <input type="text" id="commentInput" class="form-control" placeholder="댓글을 입력하세요..." style="flex:1; font-size:13px;" onkeydown="if(event.key==='Enter')postComment('${data.id}')">
        <button class="btn btn-primary btn-sm" onclick="postComment('${data.id}')" style="white-space:nowrap;">등록</button>
      </div>
    </div>
  `;
}

function renderComment(c) {
  const isMe = currentUser && (c.author_id === currentUser.id || (currentUser.isAdmin && c.author_id === 'admin-user'));
  const timeStr = (c.created_at || '').substring(0, 16).replace('T', ' ');
  return `<div style="padding:8px 0; border-bottom:1px solid var(--gray-100);">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <span style="font-size:12px; font-weight:600;">${escHtml(c.author_name)}</span>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:11px; color:var(--gray-400);">${timeStr}</span>
        ${isMe ? `<button onclick="deleteComment('${c.id}','${c.report_id}')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:13px; padding:0;">&times;</button>` : ''}
      </div>
    </div>
    <p style="font-size:13px; line-height:1.6; white-space:pre-wrap;">${escHtml(c.content)}</p>
  </div>`;
}

async function postComment(reportId) {
  const input = document.getElementById('commentInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) { toast('댓글을 입력하세요'); return; }
  const res = await api(`/api/reports/${reportId}/comments`, { method: 'POST', body: { content } });
  if (res) {
    input.value = '';
    viewReport(reportId);
  }
}

async function deleteComment(commentId, reportId) {
  if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
  const res = await api(`/api/comments/${commentId}`, { method: 'DELETE' });
  if (res) viewReport(reportId);
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
  document.getElementById('reportDate').value = (data.report_date||'').split('T')[0];
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

let _submitting = false;
async function submitReport() {
  if (_submitting) return;
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

  _submitting = true;
  let result;
  if (editingReportId) {
    result = await api(`/api/reports/${editingReportId}`, { method: 'PUT', body });
    if (result) toast('업무일지가 수정되었습니다');
  } else {
    result = await api('/api/reports', { method: 'POST', body });
    if (result) toast('업무일지가 제출되었습니다');
  }
  _submitting = false;

  if (!result) return;
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
          <div class="list-item-title">${p.week_start.split('T')[0]} ~ ${p.week_end.split('T')[0]}</div>
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
  if (_submitting) return;
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

  _submitting = true;
  const result = await api('/api/weekly-plans', {
    method: 'POST',
    body: {
      week_start: document.getElementById('weekStart').value,
      week_end: document.getElementById('weekEnd').value,
      items
    }
  });
  _submitting = false;

  if (!result) return;
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

// ─── 더보기 ───
async function renderMore() {
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  document.getElementById('mainContent').innerHTML = `
    <p class="section-title">&#128227; 소통</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showNoticesList()" style="border:2px solid #f59e0b; background:#fffbeb;">
        <span class="qa-icon">&#128227;</span>
        <span class="qa-label" style="color:#92400e; font-weight:700;">공지사항</span>
      </button>
      <button class="quick-action-btn" onclick="showBoard()" style="border:2px solid #6366f1;">
        <span class="qa-icon">&#128172;</span>
        <span class="qa-label" style="color:#6366f1; font-weight:700;">팀 게시판</span>
      </button>
    </div>

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
      <button class="quick-action-btn" onclick="showKnowledgeMap()" style="border:2px solid var(--primary);">
        <span class="qa-icon">&#129504;</span>
        <span class="qa-label" style="color:var(--primary); font-weight:700;">업무 지식맵</span>
      </button>
      <button class="quick-action-btn" onclick="showWorkflowDiagrams()" style="border:2px solid #43a047;">
        <span class="qa-icon">&#128200;</span>
        <span class="qa-label" style="color:#43a047; font-weight:700;">업무 흐름도</span>
      </button>
      <button class="quick-action-btn" onclick="showOnboarding()" style="border:2px solid #e65100; background:#fff3e0;">
        <span class="qa-icon">&#127891;</span>
        <span class="qa-label" style="color:#e65100; font-weight:700;">신입 가이드</span>
      </button>
    </div>

    <p class="section-title">&#128161; 분석 & 인사이트</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showDirection()" style="border:2px solid #7c3aed;">
        <span class="qa-icon">&#127919;</span>
        <span class="qa-label" style="color:#7c3aed; font-weight:700;">목표 & 방향</span>
      </button>
      <button class="quick-action-btn" onclick="showPersonalInsight()" style="border:2px solid #0891b2;">
        <span class="qa-icon">&#128161;</span>
        <span class="qa-label" style="color:#0891b2; font-weight:700;">내 업무 분석</span>
      </button>
      <button class="quick-action-btn" onclick="showMonthlySummary()" style="border:2px solid #ea580c;">
        <span class="qa-icon">&#128202;</span>
        <span class="qa-label" style="color:#ea580c; font-weight:700;">월간 요약</span>
      </button>
      <button class="quick-action-btn" onclick="showHandover()" style="border:2px solid #1e3a5f;">
        <span class="qa-icon">&#128196;</span>
        <span class="qa-label" style="color:#1e3a5f; font-weight:700;">인수인계</span>
      </button>
      <button class="quick-action-btn" onclick="showWeeklyReport()" style="border:2px solid #0f766e;">
        <span class="qa-icon">&#128203;</span>
        <span class="qa-label" style="color:#0f766e; font-weight:700;">주간 보고서</span>
      </button>
      <button class="quick-action-btn" onclick="showSmartInsight()" style="border:2px solid #dc2626; background:#fef2f2;">
        <span class="qa-icon">&#129504;</span>
        <span class="qa-label" style="color:#dc2626; font-weight:700;">AI 인사이트</span>
      </button>
    </div>

    <p class="section-title">&#9881; 도구</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showTodoPage()" style="border:2px solid #10b981;">
        <span class="qa-icon">&#9745;</span>
        <span class="qa-label" style="color:#10b981; font-weight:700;">할 일 관리</span>
      </button>
      <button class="quick-action-btn" onclick="showAttendancePage()" style="border:2px solid #6366f1;">
        <span class="qa-icon">&#128339;</span>
        <span class="qa-label" style="color:#6366f1; font-weight:700;">출퇴근 기록</span>
      </button>
      <button class="quick-action-btn" onclick="showSchedulePage()" style="border:2px solid #0ea5e9;">
        <span class="qa-icon">&#128197;</span>
        <span class="qa-label" style="color:#0ea5e9; font-weight:700;">팀 일정</span>
      </button>
      <button class="quick-action-btn" onclick="showBookmarks()" style="border:2px solid #eab308;">
        <span class="qa-icon">&#11088;</span>
        <span class="qa-label" style="color:#eab308; font-weight:700;">즐겨찾기</span>
      </button>
      <button class="quick-action-btn" onclick="showWorkCalendar()" style="border:2px solid #8b5cf6;">
        <span class="qa-icon">&#128467;</span>
        <span class="qa-label" style="color:#8b5cf6; font-weight:700;">업무 캘린더</span>
      </button>
      <button class="quick-action-btn" onclick="showTimeline()" style="border:2px solid #64748b;">
        <span class="qa-icon">&#128337;</span>
        <span class="qa-label" style="color:#64748b; font-weight:700;">타임라인</span>
      </button>
      <button class="quick-action-btn" onclick="showNotes()" style="border:2px solid #d97706;">
        <span class="qa-icon">&#128221;</span>
        <span class="qa-label" style="color:#d97706; font-weight:700;">빠른 메모</span>
      </button>
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
      ${currentUser && (currentUser.position === '지역장' || currentUser.isAdmin) ? `
      <button class="quick-action-btn" onclick="showRegionMembers()" style="border:2px solid #0d9488;" data-help="관리담당자의 부서·직책·팀(소속)을 대신 수정합니다. 지역장 전용 기능입니다.">
        <span class="qa-icon">&#128100;</span>
        <span class="qa-label" style="color:#0d9488; font-weight:700;">소속 관리</span>
      </button>
      <button class="quick-action-btn" onclick="showWorkshopRoster()" style="border:2px solid #c2410c;" data-help="워크숍 참석 명단을 작성합니다. 앱의 관리담당자를 불러오고 추가 인원을 더해 엑셀 양식으로 내려받습니다.">
        <span class="qa-icon">&#128203;</span>
        <span class="qa-label" style="color:#c2410c; font-weight:700;">워크샵 명단</span>
      </button>` : ''}
      ${currentUser && currentUser.isAdmin ? `
      <button class="quick-action-btn" onclick="showTeamDashboard()" style="border:2px solid #4338ca;">
        <span class="qa-icon">&#128101;</span>
        <span class="qa-label" style="color:#4338ca; font-weight:700;">팀 실적</span>
      </button>
      <button class="quick-action-btn" onclick="showAdminPanel()" style="border:2px solid var(--danger);">
        <span class="qa-icon">&#128272;</span>
        <span class="qa-label" style="color:var(--danger); font-weight:700;">시스템 관리</span>
      </button>` : ''}
    </div>

    <p class="section-title">&#9881; 설정</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showNavSettings()" style="border:2px solid var(--primary); background:#fff7ed;">
        <span class="qa-icon">&#128295;</span>
        <span class="qa-label" style="color:var(--primary); font-weight:700;">네비 설정</span>
      </button>
    </div>

    <div class="card">
      <p class="card-title" style="margin-bottom:8px;">시스템 정보</p>
      <p style="font-size:14px; color:var(--gray-500);">WorkFlow - Smart Work Manager v3.0</p>
    </div>
  `;
}

// ─── 네비 설정 ───
function showNavSettings() {
  const config = getNavConfig();
  const selected = new Set(config);

  function renderGrid() {
    return NAV_ITEMS.map(item => {
      const isSel = selected.has(item.id);
      const idx = config.indexOf(item.id);
      return `<button class="nav-set-item${isSel ? ' nav-set-selected' : ''}" onclick="toggleNavItem('${item.id}')">
        ${isSel ? `<span class="nav-set-badge">${idx + 1}</span>` : ''}
        <span class="nav-set-icon">${item.icon}</span>
        <span class="nav-set-label">${item.label}</span>
      </button>`;
    }).join('');
  }

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <p class="section-title">&#128295; 하단 네비게이션 설정</p>
    <div class="card" style="margin-bottom:12px;">
      <p style="font-size:14px; color:var(--gray-600); margin-bottom:4px;">원하는 메뉴 <strong>3개</strong>를 선택하세요.</p>
      <p style="font-size:13px; color:var(--gray-400);">더보기는 항상 고정됩니다. 순서대로 번호가 부여됩니다.</p>
    </div>
    <div class="nav-set-grid" id="navSetGrid">
      ${renderGrid()}
    </div>
    <div style="margin-top:16px; display:flex; gap:8px;">
      <button class="btn btn-outline" style="flex:1;" onclick="resetNavConfig()">기본값</button>
      <button class="btn btn-primary" style="flex:1;" onclick="applyNavConfig()">적용</button>
    </div>

    <div class="card" style="margin-top:16px;">
      <p class="card-title" style="margin-bottom:8px;">현재 설정</p>
      <div id="navPreview" style="display:flex; gap:8px; justify-content:center;">
        ${config.map((id, i) => {
          const item = NAV_ITEMS.find(n => n.id === id);
          return item ? `<div style="text-align:center;"><span style="font-size:22px;">${item.icon}</span><div style="font-size:12px; color:var(--gray-600);">${item.label}</div></div>` : '';
        }).join('')}
        <div style="text-align:center;"><span style="font-size:22px;">&#9776;</span><div style="font-size:12px; color:var(--gray-600);">더보기</div></div>
      </div>
    </div>
  `;

  window._navTempConfig = config.slice();
  window._navTempSelected = selected;
}

function toggleNavItem(id) {
  const config = window._navTempConfig;
  const selected = window._navTempSelected;

  if (selected.has(id)) {
    selected.delete(id);
    const idx = config.indexOf(id);
    if (idx !== -1) config.splice(idx, 1);
  } else {
    if (config.length >= 3) {
      toast('최대 3개까지 선택 가능합니다. 먼저 하나를 해제하세요.');
      return;
    }
    selected.add(id);
    config.push(id);
  }

  const grid = document.getElementById('navSetGrid');
  grid.innerHTML = NAV_ITEMS.map(item => {
    const isSel = selected.has(item.id);
    const idx = config.indexOf(item.id);
    return `<button class="nav-set-item${isSel ? ' nav-set-selected' : ''}" onclick="toggleNavItem('${item.id}')">
      ${isSel ? `<span class="nav-set-badge">${idx + 1}</span>` : ''}
      <span class="nav-set-icon">${item.icon}</span>
      <span class="nav-set-label">${item.label}</span>
    </button>`;
  }).join('');

  const preview = document.getElementById('navPreview');
  preview.innerHTML = config.map(cid => {
    const item = NAV_ITEMS.find(n => n.id === cid);
    return item ? `<div style="text-align:center;"><span style="font-size:22px;">${item.icon}</span><div style="font-size:12px; color:var(--gray-600);">${item.label}</div></div>` : '';
  }).join('') + `<div style="text-align:center;"><span style="font-size:22px;">&#9776;</span><div style="font-size:12px; color:var(--gray-600);">더보기</div></div>`;
}

function applyNavConfig() {
  const config = window._navTempConfig;
  if (config.length !== 3) {
    toast('메뉴 3개를 선택해주세요.');
    return;
  }
  saveNavConfig(config);
  rebuildNav();
  toast('네비게이션이 변경되었습니다!');
  navigate('more');
}

function resetNavConfig() {
  window._navTempConfig = DEFAULT_NAV.slice();
  window._navTempSelected = new Set(DEFAULT_NAV);
  saveNavConfig(DEFAULT_NAV.slice());
  rebuildNav();
  showNavSettings();
  toast('기본값으로 복원되었습니다');
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
        <input type="text" id="newTaskCategory" class="form-control" placeholder="예: 영업, 개발, 마케팅">
      </div>
      <div class="form-group">
        <label>업무 그룹</label>
        <input type="text" id="newTaskGroup" class="form-control" placeholder="예: 고객 관리, 프로젝트 운영">
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
    department: '',
    division: '',
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
let manualTab = 'procedures';

async function showManual() {
  let html = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title" style="margin-bottom:8px;">&#128214; 업무매뉴얼</p>
    <div class="card" style="background:#e8f0fe; border-left:4px solid var(--primary); margin-bottom:16px; padding:12px;">
      <p style="font-size:14px; line-height:1.6; color:var(--gray-700);">
        업무일지의 <strong>육하원칙(누가/어디서/무엇을/어떻게/왜)</strong> 데이터가 자동 분석되어
        <strong>업무 절차서</strong>와 <strong>매뉴얼</strong>이 만들어집니다.
        반복 업무는 단계별 가이드로 자동 정리됩니다.
      </p>
    </div>
    <div class="tabs" style="margin-bottom:12px;">
      <button class="tab ${manualTab === 'procedures' ? 'active' : ''}" onclick="manualTab='procedures'; showManual()">업무 절차서</button>
      <button class="tab ${manualTab === 'org' ? 'active' : ''}" onclick="manualTab='org'; showManual()">전체 매뉴얼</button>
      <button class="tab ${manualTab === 'my' ? 'active' : ''}" onclick="manualTab='my'; showManual()">내 매뉴얼</button>
      <button class="tab ${manualTab === 'custom' ? 'active' : ''}" onclick="manualTab='custom'; showManual()">직접 작성</button>
    </div>
    <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
      ${manualTab === 'org' ? `<button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/manual-org','전체_업무매뉴얼')">&#128229; 엑셀 다운로드</button>` : ''}
      ${manualTab === 'my' ? `<button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/manual-my','내_업무매뉴얼')">&#128229; 엑셀 다운로드</button>` : ''}
    </div>
    <div id="manualContent"></div>
  `;
  document.getElementById('mainContent').innerHTML = html;

  if (manualTab === 'procedures') renderProcedures();
  else if (manualTab === 'org') renderOrgManual();
  else if (manualTab === 'my') renderMyManual();
  else renderCustomManual();
}

async function renderProcedures() {
  const data = await api('/api/manual/procedures');
  if (!data) return;
  const el = document.getElementById('manualContent');

  if (data.procedures.length === 0) {
    el.innerHTML = `<div class="card" style="text-align:center; padding:30px;">
      <div style="font-size:48px; margin-bottom:12px;">&#128220;</div>
      <p style="font-size:16px; font-weight:600; margin-bottom:8px;">아직 절차서가 없습니다</p>
      <p style="font-size:14px; color:var(--gray-500); line-height:1.6;">
        같은 업무가 <strong>2회 이상</strong> 기록되면<br>
        자동으로 절차서가 생성됩니다.<br><br>
        업무일지의 <strong>"무엇을", "어떻게", "어디서"</strong> 항목이<br>
        절차서의 단계별 가이드가 됩니다.
      </p>
    </div>`;
    return;
  }

  const s = data.stats;
  let html = `
    <div class="card" style="background:#e8f5e9; border-left:4px solid #43a047; margin-bottom:16px; padding:12px;">
      <p style="font-size:14px; line-height:1.6; color:var(--gray-700);">
        업무일지에서 <strong>${s.total_procedures}개 업무 절차서</strong>가 자동 생성되었습니다.<br>
        ${s.regular > 0 ? `<span style="color:#1565c0;">정기업무 ${s.regular}개</span> · ` : ''}
        ${s.repeated > 0 ? `<span style="color:#e65100;">반복업무 ${s.repeated}개</span> · ` : ''}
        일반 ${s.normal}개
      </p>
    </div>
    <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
      <button class="tab active" onclick="filterProcedures(this,'all')">전체 (${s.total_procedures})</button>
      ${s.regular > 0 ? `<button class="tab" onclick="filterProcedures(this,'정기')">정기 (${s.regular})</button>` : ''}
      ${s.repeated > 0 ? `<button class="tab" onclick="filterProcedures(this,'반복')">반복 (${s.repeated})</button>` : ''}
    </div>
    <div id="procedureList"></div>
  `;
  el.innerHTML = html;
  window._procedures = data.procedures;
  renderProcedureList(data.procedures);
}

function filterProcedures(btn, level) {
  btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const all = window._procedures || [];
  const filtered = level === 'all' ? all : all.filter(p => p.level === level);
  renderProcedureList(filtered);
}

function renderProcedureList(procedures) {
  const el = document.getElementById('procedureList');
  if (!el) return;

  const levelColors = { '정기': '#1565c0', '반복': '#e65100', '일반': '#666' };
  const levelBg = { '정기': '#e3f2fd', '반복': '#fff3e0', '일반': '#f5f5f5' };
  const catIcons = { '내근': '&#128187;', '외근': '&#128694;', '출장': '&#9992;' };

  el.innerHTML = procedures.map((p, idx) => `
    <div class="card" style="margin-bottom:12px; padding:0; overflow:hidden;">
      <div style="padding:14px 14px 10px; cursor:pointer;" onclick="toggleProcedure(${idx})">
        <div style="display:flex; justify-content:space-between; align-items:start;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span style="font-size:11px; font-weight:700; color:${levelColors[p.level]}; background:${levelBg[p.level]}; padding:2px 8px; border-radius:4px;">${p.level}</span>
              <span class="badge badge-${p.category}" style="font-size:11px;">${catIcons[p.category] || ''} ${p.category}</span>
            </div>
            <div style="font-size:16px; font-weight:700;">${escHtml(p.task)}</div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:4px;">
              ${p.frequency}회 수행 · 담당: ${p.people.join(', ')}
            </div>
          </div>
          <span id="procArrow${idx}" style="font-size:18px; color:var(--gray-400); transition:transform 0.2s;">&#9660;</span>
        </div>
      </div>
      <div id="procDetail${idx}" style="display:none; padding:0 14px 14px; border-top:1px solid var(--gray-100);">
        ${p.summary.purpose ? `
          <div style="padding:10px; background:var(--gray-50); border-radius:8px; margin-top:10px; margin-bottom:10px;">
            <div style="font-size:12px; font-weight:600; color:var(--primary); margin-bottom:4px;">&#127919; 업무 목적</div>
            <div style="font-size:14px;">${escHtml(p.summary.purpose)}</div>
          </div>` : ''}

        ${p.steps.length > 0 ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; font-weight:700; color:var(--gray-700); margin-bottom:8px;">&#128221; 수행 절차</div>
            ${p.steps.map((s, i) => `
              <div style="display:flex; gap:10px; margin-bottom:8px;">
                <div style="min-width:28px; height:28px; background:var(--primary); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0;">${i + 1}</div>
                <div style="flex:1; padding-top:3px;">
                  <div style="font-size:13px; font-weight:600; color:var(--gray-700);">${escHtml(s.label)}</div>
                  <div style="font-size:13px; color:var(--gray-600); margin-top:2px;">${escHtml(s.detail)}</div>
                </div>
              </div>
            `).join('')}
          </div>` : ''}

        ${p.tips.length > 0 ? `
          <div style="padding:10px; background:#fffde7; border-radius:8px; border-left:3px solid #fbc02d; margin-bottom:10px;">
            <div style="font-size:12px; font-weight:600; color:#f9a825; margin-bottom:4px;">&#128161; 참고사항</div>
            ${p.tips.map(t => `<div style="font-size:13px; color:var(--gray-700); margin-bottom:2px;">· ${escHtml(t)}</div>`).join('')}
          </div>` : ''}

        <div style="display:flex; gap:12px; font-size:12px; color:var(--gray-400); padding-top:8px; border-top:1px solid var(--gray-100);">
          <span>최초: ${p.first_date ? p.first_date.split('T')[0] : '-'}</span>
          <span>최근: ${p.last_date ? p.last_date.split('T')[0] : '-'}</span>
          ${p.summary.main_location ? `<span>장소: ${escHtml(p.summary.main_location)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleProcedure(idx) {
  const detail = document.getElementById('procDetail' + idx);
  const arrow = document.getElementById('procArrow' + idx);
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  arrow.style.transform = open ? '' : 'rotate(180deg)';
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
        <input type="text" id="manualGroup" class="form-control" placeholder="예: 영업관리, 행정업무">
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
async function showUserInfo() {
  let teamSection = '';
  if (currentUser.company_id) {
    const teams = await api('/api/companies/' + currentUser.company_id + '/teams') || [];
    teamSection = `
    <div class="card" style="margin-top:12px;">
      <p class="card-title" style="margin-bottom:12px;">&#127970; 회사 정보</p>
      <div style="padding:8px 0; border-bottom:1px solid var(--gray-200);">
        <span style="font-size:13px; color:var(--gray-500);">회사</span>
        <span style="font-size:14px; font-weight:600; float:right;">${escHtml(currentUser.company_name || '-')}</span>
      </div>
      <div style="padding:8px 0; border-bottom:1px solid var(--gray-200);">
        <span style="font-size:13px; color:var(--gray-500);">소속 팀</span>
        <span style="font-size:14px; font-weight:600; float:right;">${escHtml(currentUser.team_name || '미지정')}</span>
      </div>
      ${teams.length > 0 ? `
        <div style="margin-top:12px;">
          <span style="font-size:13px; font-weight:600;">팀 목록</span>
          ${teams.map(t => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-100);">
              <span style="font-size:14px;">${escHtml(t.name)}</span>
              <span style="font-size:11px; color:${t.share_reports ? 'var(--success)' : '#ef4444'};">${t.share_reports ? '공유 ON' : '공유 OFF'}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
    <div class="card" style="margin-top:12px; padding:12px; background:#f0f9ff; border:1px solid #bfdbfe;">
      <p style="font-size:13px; color:#1e40af; line-height:1.6;">
        &#128274; <strong>데이터 보안 안내</strong><br>
        &#8226; 시스템 관리자는 모든 기업의 기록을 열람할 수 있습니다<br>
        &#8226; 타 기업과 업무 데이터는 공유되지 않습니다<br>
        &#8226; 팀별 업무 공유는 팀 설정에 따라 제어됩니다
      </p>
    </div>`;
  }
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
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
    ${teamSection}
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

function showResultModal(type, title, message, btnText, btnCallback) {
  let overlay = document.getElementById('resultModalOverlay');
  if (overlay) overlay.remove();
  const icon = type === 'success' ? '&#9989;' : type === 'error' ? '&#10060;' : '&#9888;&#65039;';
  const btnColor = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)';
  overlay = document.createElement('div');
  overlay.id = 'resultModalOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:32px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:slideUp 0.3s ease;">
      <div style="font-size:48px;margin-bottom:16px;">${icon}</div>
      <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;color:#333;">${title}</h3>
      <p style="font-size:14px;color:#666;line-height:1.6;margin-bottom:24px;word-break:keep-all;">${message}</p>
      <button onclick="document.getElementById('resultModalOverlay').remove();${btnCallback ? btnCallback + '()' : ''}"
        style="width:100%;padding:14px;border-radius:12px;border:none;background:${btnColor};color:#fff;font-size:16px;font-weight:600;cursor:pointer;">${btnText || '확인'}</button>
    </div>`;
  document.body.appendChild(overlay);
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
  const btn = document.querySelector('#resetStep1 .btn-primary');
  if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = '확인 중...'; btn.style.opacity = '0.7'; }
  try {
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
  } catch (e) {
    toast('서버 연결 실패. 잠시 후 다시 시도해주세요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || '본인 확인'; btn.style.opacity = ''; }
  }
}

async function submitResetPassword() {
  const pw = document.getElementById('resetNewPw').value;
  const pwConfirm = document.getElementById('resetNewPwConfirm').value;
  if (!pw) { toast('새 비밀번호를 입력해주세요'); return; }
  if (pw !== pwConfirm) { toast('비밀번호가 일치하지 않습니다'); return; }
  const btn = document.querySelector('#resetStep2 .btn-success');
  if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = '변경 중...'; btn.style.opacity = '0.7'; }
  try {
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
  } catch (e) {
    toast('서버 연결 실패. 잠시 후 다시 시도해주세요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || '비밀번호 변경'; btn.style.opacity = ''; }
  }
}

// ─── 가입신청 ───
let _regMode = 'skip';

function showRegisterForm() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('registerScreen').style.display = 'flex';
  document.getElementById('regStep1').style.display = 'block';
  document.getElementById('regStep2').style.display = 'none';
  _regMode = 'skip';
}

function regNextStep() {
  const name = document.getElementById('regName').value.trim();
  const phoneRest = document.getElementById('regPhone').value.trim().replace(/[^0-9]/g, '');
  const password = document.getElementById('regPassword').value;
  const passwordConfirm = document.getElementById('regPasswordConfirm').value;
  if (!name) { toast('이름을 입력해주세요'); return; }
  if (!phoneRest || phoneRest.length !== 8) { toast('연락처 뒷번호 8자리를 입력해주세요'); return; }
  if (!password) { toast('비밀번호를 입력해주세요'); return; }
  if (password !== passwordConfirm) { toast('비밀번호가 일치하지 않습니다'); return; }
  document.getElementById('regStep1').style.display = 'none';
  document.getElementById('regStep2').style.display = 'block';
  setRegMode('skip');
}

function regPrevStep() {
  document.getElementById('regStep2').style.display = 'none';
  document.getElementById('regStep1').style.display = 'block';
}

function setRegMode(mode) {
  _regMode = mode;
  const styles = { join: ['var(--primary)', '#f0f5ff'], new: ['#333', '#fff'], skip: ['#333', '#fff'] };
  ['join', 'new', 'skip'].forEach(m => {
    const btn = document.getElementById('regOpt' + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) {
      btn.style.borderColor = m === mode ? 'var(--primary)' : '#e5e7eb';
      btn.style.background = m === mode ? '#f0f5ff' : '#fff';
    }
  });
  document.getElementById('regJoinBox').style.display = mode === 'join' ? 'block' : 'none';
  document.getElementById('regNewBox').style.display = mode === 'new' ? 'block' : 'none';
}

async function checkCompanyCode() {
  const code = document.getElementById('regCompanyCode').value.trim().toUpperCase();
  if (!code) { toast('초대 코드를 입력하세요'); return; }
  try {
    const res = await fetch('/api/companies/check/' + code);
    const data = await res.json();
    if (!res.ok) { toast(data.error); document.getElementById('regCompanyName').style.display = 'none'; return; }
    const el = document.getElementById('regCompanyName');
    el.textContent = '✅ ' + data.name;
    el.style.display = 'block';
    const teamsRes = await fetch('/api/companies/' + data.id + '/teams');
    const teams = await teamsRes.json();
    const sel = document.getElementById('regTeamSelect');
    sel.innerHTML = '<option value="">-- 팀 미지정 --</option>';
    if (teams && teams.length > 0) {
      teams.forEach(t => { sel.innerHTML += `<option value="${t.id}">${escHtml(t.name)}</option>`; });
      document.getElementById('regTeamSelectBox').style.display = 'block';
    } else {
      document.getElementById('regTeamSelectBox').style.display = 'none';
    }
  } catch (e) { toast('확인 실패'); }
}

function backToLogin() {
  document.getElementById('registerScreen').style.display = 'none';
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminContainer').style.display = 'none';
  document.getElementById('resetScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

async function submitRegister() {
  if (_submitting) return;
  const btn = document.querySelector('#regStep2 .btn-success');
  function resetBtn() {
    _submitting = false;
    if (btn) { btn.disabled = false; btn.textContent = '가입 완료'; btn.style.opacity = ''; }
  }
  try {
    const name = document.getElementById('regName').value.trim();
    const phoneRest = document.getElementById('regPhone').value.trim().replace(/[^0-9]/g, '');
    const phone = '010' + phoneRest;
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    if (!name) { showResultModal('error', '입력 오류', '이름을 입력해주세요.', '확인'); return; }
    if (phoneRest.length < 7) { showResultModal('error', '입력 오류', '연락처를 정확히 입력해주세요.', '확인'); return; }
    if (password.length < 4) { showResultModal('error', '입력 오류', '비밀번호는 4자 이상 입력해주세요.', '확인'); return; }

    _submitting = true;
    if (btn) { btn.disabled = true; btn.textContent = '가입 처리 중...'; btn.style.opacity = '0.7'; }
    const body = { name, phone, email, password };

    if (_regMode === 'join') {
      const code = document.getElementById('regCompanyCode').value.trim().toUpperCase();
      if (!code) { resetBtn(); showResultModal('error', '입력 오류', '초대 코드를 입력하세요.', '확인'); return; }
      body.company_code = code;
      body.position = (document.getElementById('regPosition') || {}).value || '';
      body.department = (document.getElementById('regDepartment') || {}).value || '';
      const teamSel = document.getElementById('regTeamSelect');
      if (teamSel && teamSel.value) body.team_id = teamSel.value;
    } else if (_regMode === 'new') {
      const compName = (document.getElementById('regNewCompany') || {}).value || '';
      if (!compName.trim()) { resetBtn(); showResultModal('error', '입력 오류', '회사명을 입력하세요.', '확인'); return; }
      body.company_name = compName.trim();
      body.position = (document.getElementById('regNewPosition') || {}).value || '';
      body.department = (document.getElementById('regNewDepartment') || {}).value || '';
    }

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    resetBtn();

    if (!res.ok) {
      showResultModal('error', '가입 실패', data.error || '가입 처리 중 오류가 발생했습니다.', '확인');
      return;
    }

    currentUser = data;
    document.getElementById('registerScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    rebuildNav();

    const codeMsg = data.company_code ? `\n\n팀원 초대 코드: ${data.company_code}\n이 코드를 팀원에게 공유하세요.` : '';
    showResultModal('success', '가입 완료!', `${data.name}님 환영합니다!${codeMsg}`, '시작하기');
    navigate('home');
  } catch (e) {
    resetBtn();
    showResultModal('error', '서버 연결 실패', '서버에 연결할 수 없습니다.\n잠시 후 다시 시도해주세요.\n\n(오류: ' + e.message + ')', '확인');
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
  if (!password) { toast('비밀번호를 입력해주세요'); return; }
  const btn = document.querySelector('#adminLoginScreen .btn-primary');
  if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = '로그인 중...'; btn.style.opacity = '0.7'; }
  try {
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
    rebuildNav();
    navigate('home');
  } catch (e) {
    toast('서버 연결 실패. 잠시 후 다시 시도해주세요.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || '로그인'; btn.style.opacity = ''; }
  }
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
      <button class="tab ${adminTab === 'notices' ? 'active' : ''}" onclick="switchAdminTab('notices')">공지사항</button>
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
  else if (adminTab === 'notices') renderAdminNoticesTab();
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
          <input type="text" id="arDept" class="form-control" value="">
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

    <p style="font-size:12px; color:#666; margin-bottom:16px;">기간 ${escHtml(dateFrom)} ~ ${escHtml(dateTo)} · 회의록 ${data.total_notes || 0}건 + 업무일지 ${data.total_reports || 0}건 분석</p>

    ${data.report_stats ? `<div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; font-size:11px;">
      ${data.report_stats.categories ? `<span style="padding:4px 8px; background:#e0f2fe; border-radius:12px; color:#0369a1;">📂 ${escHtml(data.report_stats.categories)}</span>` : ''}
      ${data.report_stats.places ? `<span style="padding:4px 8px; background:#dcfce7; border-radius:12px; color:#15803d;">📍 ${escHtml(data.report_stats.places)}</span>` : ''}
      <span style="padding:4px 8px; background:#fef3c7; border-radius:12px; color:#92400e;">✅ 완료율 ${data.report_stats.completion_rate}%</span>
    </div>` : ''}

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

// ─── 업무 지식맵 ───
let _kmTab = 'overview';

async function showKnowledgeMap() {
  const data = await api('/api/knowledge-map');
  if (!data) return;
  window._kmData = data;
  _kmTab = 'overview';
  renderKnowledgeMap();
}

function renderKnowledgeMap() {
  const data = window._kmData;
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  if (data.empty) {
    document.getElementById('mainContent').innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
      <div class="card" style="text-align:center; padding:40px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">&#129504;</div>
        <p style="font-size:18px; font-weight:700; margin-bottom:8px;">업무 지식맵</p>
        <p style="font-size:14px; color:var(--gray-500); line-height:1.7;">
          업무일지가 쌓이면 자동으로<br>
          업무 지식맵이 만들어집니다.<br><br>
          <strong>일지를 많이 쓸수록</strong><br>
          카테고리, 담당자, 업무패턴이<br>
          더 정확하게 분석됩니다.
        </p>
      </div>`;
    return;
  }

  const fromDate = data.date_range.from ? data.date_range.from.split('T')[0] : '-';
  const toDate = data.date_range.to ? data.date_range.to.split('T')[0] : '-';

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title" style="margin-bottom:4px;">&#129504; 업무 지식맵</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">${fromDate} ~ ${toDate} 기간 데이터 기반</p>

    <div class="stats-row" style="margin-bottom:16px;">
      <div class="stat-card"><div class="stat-number">${data.total_reports}</div><div class="stat-label">총 업무기록</div></div>
      <div class="stat-card"><div class="stat-number">${data.total_people}</div><div class="stat-label">참여 인원</div></div>
      <div class="stat-card"><div class="stat-number">${data.total_tasks}</div><div class="stat-label">업무 종류</div></div>
      <div class="stat-card"><div class="stat-number">${data.patterns.length}</div><div class="stat-label">확립된 패턴</div></div>
    </div>

    <div class="tabs" style="margin-bottom:16px;">
      <button class="tab ${_kmTab === 'overview' ? 'active' : ''}" onclick="_kmTab='overview'; renderKnowledgeMap()">카테고리</button>
      <button class="tab ${_kmTab === 'people' ? 'active' : ''}" onclick="_kmTab='people'; renderKnowledgeMap()">담당자별</button>
      <button class="tab ${_kmTab === 'patterns' ? 'active' : ''}" onclick="_kmTab='patterns'; renderKnowledgeMap()">업무패턴</button>
      <button class="tab ${_kmTab === 'diagram' ? 'active' : ''}" onclick="_kmTab='diagram'; renderKnowledgeMap()">다이어그램</button>
    </div>
    <div id="kmContent"></div>
  `;

  if (_kmTab === 'overview') renderKmOverview(data);
  else if (_kmTab === 'people') renderKmPeople(data);
  else if (_kmTab === 'patterns') renderKmPatterns(data);
  else renderKmDiagram(data);
}

function renderKmOverview(data) {
  const el = document.getElementById('kmContent');
  const colors = ['#1a73e8', '#34a853', '#ea4335', '#fbbc04', '#9334e6'];

  let catBar = '<div style="display:flex; border-radius:8px; overflow:hidden; height:28px; margin-bottom:16px;">';
  data.categories.forEach((c, i) => {
    catBar += `<div style="width:${c.pct}%; background:${colors[i % colors.length]}; display:flex; align-items:center; justify-content:center;" title="${c.name} ${c.pct}%">
      <span style="color:#fff; font-size:11px; font-weight:600;">${c.pct > 8 ? c.name : ''}</span>
    </div>`;
  });
  catBar += '</div>';

  let legend = '<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">';
  data.categories.forEach((c, i) => {
    legend += `<span style="font-size:12px; display:flex; align-items:center; gap:4px;">
      <span style="width:10px; height:10px; border-radius:2px; background:${colors[i % colors.length]}; display:inline-block;"></span>
      ${escHtml(c.name)} ${c.count}건 (${c.pct}%)
    </span>`;
  });
  legend += '</div>';

  let catDetail = '';
  Object.entries(data.tasks_by_category).forEach(([cat, tasks]) => {
    const sorted = tasks.sort((a, b) => b.frequency - a.frequency);
    catDetail += `
      <div class="card" style="margin-bottom:10px;">
        <div style="font-weight:700; font-size:15px; margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid var(--gray-200);">
          ${escHtml(cat)} <span style="font-size:13px; color:var(--gray-500); font-weight:400;">${tasks.length}개 업무</span>
        </div>
        ${sorted.slice(0, 10).map((t, i) => `
          <div style="padding:8px 0; ${i < sorted.length - 1 ? 'border-bottom:1px solid var(--gray-100);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:14px; font-weight:500; flex:1;">${escHtml(t.task)}</span>
              <span style="font-size:12px; color:var(--gray-500); white-space:nowrap; margin-left:8px;">${t.frequency}회</span>
            </div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">
              ${t.people.join(', ')}${t.locations.length > 0 ? ' · ' + t.locations.join(', ') : ''}
            </div>
          </div>
        `).join('')}
        ${sorted.length > 10 ? `<p style="text-align:center; font-size:12px; color:var(--gray-400); margin-top:8px;">외 ${sorted.length - 10}건</p>` : ''}
      </div>`;
  });

  el.innerHTML = catBar + legend + catDetail;
}

function renderKmPeople(data) {
  const el = document.getElementById('kmContent');
  const maxCount = Math.max(...data.people.map(p => p.count), 1);

  let html = '';
  data.people.forEach(person => {
    const pct = Math.round(person.count / maxCount * 100);
    const tasks = data.person_tasks[person.name] || [];
    const topTasks = tasks.slice(0, 5);
    const catCounts = {};
    tasks.forEach(t => { catCounts[t.category] = (catCounts[t.category] || 0) + t.count; });

    html += `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <span style="font-size:15px; font-weight:700;">${escHtml(person.name)}</span>
            <span style="font-size:12px; color:var(--gray-500); margin-left:4px;">${escHtml(person.position || '')}</span>
          </div>
          <span style="font-size:13px; font-weight:600; color:var(--primary);">${person.count}건</span>
        </div>
        <div style="background:var(--gray-100); border-radius:4px; height:8px; margin-bottom:10px;">
          <div style="width:${pct}%; background:var(--primary); border-radius:4px; height:100%;"></div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
          ${Object.entries(catCounts).map(([cat, cnt]) =>
            `<span class="badge badge-${cat}">${cat} ${cnt}건</span>`
          ).join('')}
        </div>
        ${topTasks.length > 0 ? `
          <div style="font-size:12px; color:var(--gray-500); margin-bottom:4px;">주요 업무:</div>
          ${topTasks.map(t => `
            <div style="font-size:13px; padding:3px 0; display:flex; justify-content:space-between;">
              <span>${escHtml(t.task)}</span>
              <span style="color:var(--gray-400); font-size:12px;">${t.count}회</span>
            </div>
          `).join('')}
          ${tasks.length > 5 ? `<p style="font-size:11px; color:var(--gray-400); margin-top:4px;">외 ${tasks.length - 5}개 업무</p>` : ''}
        ` : ''}
      </div>`;
  });

  el.innerHTML = html || '<p style="text-align:center; color:var(--gray-500);">데이터가 없습니다</p>';
}

function renderKmPatterns(data) {
  const el = document.getElementById('kmContent');
  const patterns = data.patterns;

  if (patterns.length === 0) {
    el.innerHTML = `
      <div class="card" style="text-align:center; padding:30px;">
        <div style="font-size:36px; margin-bottom:12px;">&#128269;</div>
        <p style="font-size:15px; font-weight:600; margin-bottom:8px;">아직 확립된 패턴이 없습니다</p>
        <p style="font-size:13px; color:var(--gray-500); line-height:1.6;">
          같은 업무가 <strong>3회 이상</strong> 반복되면<br>
          자동으로 패턴으로 감지됩니다.<br>
          업무일지를 꾸준히 작성해주세요.
        </p>
      </div>`;
    return;
  }

  let html = `
    <div class="card" style="background:var(--primary-light); border-left:4px solid var(--primary); margin-bottom:16px; padding:12px;">
      <p style="font-size:14px; line-height:1.6; color:var(--gray-700);">
        <strong>${patterns.length}개 확립된 업무 패턴</strong>이 감지되었습니다.<br>
        3회 이상 반복된 업무는 신입 인수인계 시 핵심 항목입니다.
      </p>
    </div>`;

  patterns.sort((a, b) => b.frequency - a.frequency).forEach((p, i) => {
    html += `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
          <div style="flex:1;">
            <span style="font-size:11px; color:var(--gray-400);">#${i + 1}</span>
            <div style="font-size:15px; font-weight:700; margin-top:2px;">${escHtml(p.task)}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-${p.category}">${p.category}</span>
            <div style="font-size:20px; font-weight:800; color:var(--primary); margin-top:4px;">${p.frequency}회</div>
          </div>
        </div>
        ${p.purpose ? `<div style="font-size:13px; margin-bottom:4px;"><span style="font-weight:600; color:var(--gray-600);">목적:</span> ${escHtml(p.purpose)}</div>` : ''}
        ${p.methods.length > 0 ? `<div style="font-size:13px; margin-bottom:4px;"><span style="font-weight:600; color:var(--gray-600);">수행방법:</span> ${p.methods.map(m => escHtml(m)).join(' / ')}</div>` : ''}
        ${p.locations.length > 0 ? `<div style="font-size:13px; margin-bottom:4px;"><span style="font-weight:600; color:var(--gray-600);">장소:</span> ${p.locations.join(', ')}</div>` : ''}
        <div style="font-size:12px; color:var(--gray-500); margin-top:6px; padding-top:6px; border-top:1px solid var(--gray-100);">
          담당: ${p.people.join(', ')} · 최근: ${p.last_date ? p.last_date.split('T')[0] : '-'}
        </div>
      </div>`;
  });

  el.innerHTML = html;
}

function renderKmDiagram(data) {
  const el = document.getElementById('kmContent');
  el.innerHTML = `
    <div class="card" style="padding:16px; text-align:center;">
      <p style="font-size:14px; color:var(--gray-500); margin-bottom:12px;">업무 구조 다이어그램</p>
      <div id="mermaidDiagram" style="overflow-x:auto;"></div>
    </div>`;

  if (!window._mermaidLoaded) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      window._mermaidLoaded = true;
      window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      renderMermaidChart(data.mermaid);
    };
    document.head.appendChild(script);
  } else {
    renderMermaidChart(data.mermaid);
  }
}

async function renderMermaidChart(code) {
  try {
    const { svg } = await window.mermaid.render('km-diagram', code);
    document.getElementById('mermaidDiagram').innerHTML = svg;
    const svgEl = document.querySelector('#mermaidDiagram svg');
    if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto'; }
  } catch (e) {
    document.getElementById('mermaidDiagram').innerHTML = '<p style="color:var(--gray-500); font-size:13px;">다이어그램 생성 중 오류가 발생했습니다.</p>';
  }
}

// ─── 부서 목표 & 방향성 ───
async function showDirection() {
  const data = await api('/api/direction');
  if (!data) return;
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  let goalsHtml = '';
  if (data.goals.length > 0) {
    goalsHtml = data.goals.map((g, i) => `
      <div style="padding:12px; background:#f3e8ff; border-radius:8px; margin-bottom:8px; border-left:4px solid #7c3aed;">
        <div style="font-size:14px; font-weight:600;">${escHtml(g.text)}</div>
        <div style="font-size:11px; color:var(--gray-500); margin-top:4px;">${escHtml(g.from)} · ${(g.date||'').toString().split('T')[0]}</div>
      </div>
    `).join('');
  } else {
    goalsHtml = '<p style="color:var(--gray-400); text-align:center; padding:16px;">회의록에서 추출된 목표가 없습니다</p>';
  }

  let actionsHtml = '';
  if (data.actions.length > 0) {
    actionsHtml = data.actions.map(a => `
      <div style="padding:8px 12px; border-bottom:1px solid var(--gray-100); display:flex; align-items:start; gap:8px;">
        <span style="color:#7c3aed; font-size:14px; flex-shrink:0;">&#9745;</span>
        <div>
          <div style="font-size:13px;">${escHtml(a.text)}</div>
          <div style="font-size:11px; color:var(--gray-400);">${escHtml(a.from)}</div>
        </div>
      </div>
    `).join('');
  }

  let membersHtml = data.member_directions.map(m => `
    <div class="card" style="padding:12px; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div>
          <span style="font-size:14px; font-weight:700;">${escHtml(m.name)}</span>
          <span style="font-size:12px; color:var(--gray-500); margin-left:4px;">${escHtml(m.position || '')}</span>
        </div>
        <span class="badge badge-${m.mainCategory}">${m.mainCategory} ${m.reportCount}건</span>
      </div>
      <div style="font-size:12px; font-weight:600; color:#7c3aed; margin-bottom:4px;">행동 지침:</div>
      ${m.directions.map(d => `<div style="font-size:13px; padding:3px 0; padding-left:12px; border-left:2px solid #e9d5ff;">· ${escHtml(d)}</div>`).join('')}
    </div>
  `).join('');

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:36px; margin-bottom:8px;">&#127919;</div>
      <p style="font-size:20px; font-weight:800;">부서 목표 & 방향성</p>
      <p style="font-size:13px; color:var(--gray-500);">회의록 ${data.meeting_count}건 분석 기반</p>
    </div>

    <div class="card" style="margin-bottom:16px; border-left:4px solid #7c3aed;">
      <p style="font-size:16px; font-weight:700; margin-bottom:12px;">&#127919; 부서 목표</p>
      ${goalsHtml}
    </div>

    ${data.actions.length > 0 ? `
    <div class="card" style="margin-bottom:16px; border-left:4px solid #0891b2;">
      <p style="font-size:16px; font-weight:700; margin-bottom:12px;">&#9889; 실행 과제</p>
      ${actionsHtml}
    </div>` : ''}

    ${data.recent_tasks.length > 0 ? `
    <div class="card" style="margin-bottom:16px; border-left:4px solid #43a047;">
      <p style="font-size:16px; font-weight:700; margin-bottom:8px;">&#128200; 최근 30일 주요 활동</p>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:8px;">현재 팀이 집중하고 있는 업무</p>
      ${data.recent_tasks.slice(0, 8).map(t => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-100);">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge badge-${t.category}" style="font-size:10px;">${t.category}</span>
            <span style="font-size:13px;">${escHtml(t.task)}</span>
          </div>
          <span style="font-size:12px; color:var(--gray-500);">${t.count}회</span>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="card" style="margin-bottom:16px; border-left:4px solid #e65100;">
      <p style="font-size:16px; font-weight:700; margin-bottom:12px;">&#128101; 팀원별 행동 지침</p>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:12px;">각 팀원이 집중해야 할 방향</p>
      ${membersHtml}
    </div>
  `;
}

// ─── AI 귀납적 인사이트 ───
let _insightScope = 'personal';
let _insightFrom = '';
let _insightTo = '';
let _insightCat = '';

async function showSmartInsight() {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  if (!_insightFrom) _insightFrom = weekAgo;
  if (!_insightTo) _insightTo = today;

  let teamOptions = '';
  if (currentUser.company_id) {
    const teams = await api('/api/companies/' + currentUser.company_id + '/teams') || [];
    teamOptions = teams.map(t => `<option value="${t.id}" ${_insightScope === t.id ? 'selected' : ''}>${escHtml(t.name)}</option>`).join('');
  }

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title">&#129504; AI 귀납적 인사이트</p>

    <div class="card" style="margin-bottom:16px;">
      <p style="font-size:14px; font-weight:600; margin-bottom:12px;">분석 조건 설정</p>
      <div class="form-group" style="margin-bottom:10px;">
        <label style="font-size:12px;">분석 범위</label>
        <select id="insightScope" class="form-control" onchange="onInsightScopeChange()">
          <option value="personal" ${_insightScope === 'personal' ? 'selected' : ''}>👤 내 업무 (개인)</option>
          ${currentUser.company_id ? `<option value="company" ${_insightScope === 'company' ? 'selected' : ''}>🏢 회사 전체</option>` : ''}
          ${teamOptions ? `<optgroup label="팀 단위">${teamOptions}</optgroup>` : ''}
        </select>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <label style="font-size:12px;">시작일</label>
          <input type="date" id="insightFrom" class="form-control" value="${_insightFrom}">
        </div>
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <label style="font-size:12px;">종료일</label>
          <input type="date" id="insightTo" class="form-control" value="${_insightTo}">
        </div>
      </div>
      <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="setInsightPeriod(7)">최근 1주</button>
        <button class="btn btn-outline btn-sm" onclick="setInsightPeriod(14)">최근 2주</button>
        <button class="btn btn-outline btn-sm" onclick="setInsightPeriod(30)">최근 1개월</button>
        <button class="btn btn-outline btn-sm" onclick="setInsightPeriod(90)">최근 3개월</button>
      </div>
      <button class="btn btn-primary btn-block" onclick="runSmartInsight()">&#129504; 인사이트 분석 시작</button>
    </div>

    <div id="insightResult"></div>
  `;
}

function setInsightPeriod(days) {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  document.getElementById('insightFrom').value = from;
  document.getElementById('insightTo').value = to;
}

function onInsightScopeChange() {}

async function runSmartInsight() {
  const scope = document.getElementById('insightScope').value;
  const from = document.getElementById('insightFrom').value;
  const to = document.getElementById('insightTo').value;
  _insightScope = scope;
  _insightFrom = from;
  _insightTo = to;

  let scopeParam = scope;
  let teamId = '';
  if (scope !== 'personal' && scope !== 'company') {
    scopeParam = 'team';
    teamId = scope;
  }

  document.getElementById('insightResult').innerHTML = '<div style="text-align:center; padding:40px; color:var(--gray-500);">&#129504; 분석 중...</div>';

  const url = `/api/insights/smart?scope=${scopeParam}&date_from=${from}&date_to=${to}${teamId ? '&team_id=' + teamId : ''}`;
  const data = await api(url);
  if (!data) { document.getElementById('insightResult').innerHTML = '<p style="color:#ef4444; text-align:center;">분석 실패</p>'; return; }
  if (data.total === 0) { document.getElementById('insightResult').innerHTML = '<div class="card" style="text-align:center; padding:30px; color:var(--gray-500);">해당 기간에 분석할 업무 데이터가 없습니다.</div>'; return; }

  const s = data.stats;
  const trendIcon = s.trend === 'increasing' ? '📈' : s.trend === 'decreasing' ? '📉' : '➡️';
  const trendText = s.trend === 'increasing' ? '증가 추세' : s.trend === 'decreasing' ? '감소 추세' : '안정 유지';
  const scopeLabel = scopeParam === 'personal' ? '개인' : scopeParam === 'company' ? '회사' : '팀';

  const maxChart = Math.max(...s.daily_trend.map(d => d.count), 1);
  const chartBars = s.daily_trend.slice(-14).map(d => {
    const h = Math.max(4, Math.round(d.count / maxChart * 50));
    return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;">
      <div style="font-size:9px; color:var(--gray-500);">${d.count || ''}</div>
      <div style="width:100%; max-width:20px; height:${h}px; background:var(--primary); border-radius:3px 3px 0 0;"></div>
      <div style="font-size:8px; color:var(--gray-500); margin-top:2px;">${d.date.substring(5)}</div>
    </div>`;
  }).join('');

  document.getElementById('insightResult').innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <p style="font-size:15px; font-weight:700; margin-bottom:10px;">📊 분석 요약 (${scopeLabel})</p>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:70px; background:var(--primary-light); border-radius:10px; padding:10px; text-align:center;">
          <div style="font-size:20px; font-weight:700; color:var(--primary);">${data.total}</div>
          <div style="font-size:11px; color:var(--gray-500);">총 업무</div>
        </div>
        <div style="flex:1; min-width:70px; background:#f0fdf4; border-radius:10px; padding:10px; text-align:center;">
          <div style="font-size:20px; font-weight:700; color:#059669;">${s.avg_per_day}</div>
          <div style="font-size:11px; color:var(--gray-500);">일 평균</div>
        </div>
        <div style="flex:1; min-width:70px; background:#fef3c7; border-radius:10px; padding:10px; text-align:center;">
          <div style="font-size:20px; font-weight:700; color:#d97706;">${s.busiest_day}</div>
          <div style="font-size:11px; color:var(--gray-500);">최다 요일</div>
        </div>
        <div style="flex:1; min-width:70px; background:#fef2f2; border-radius:10px; padding:10px; text-align:center;">
          <div style="font-size:16px; font-weight:700;">${trendIcon}</div>
          <div style="font-size:11px; color:var(--gray-500);">${trendText}</div>
        </div>
      </div>
      ${s.daily_trend.length > 1 ? `
        <div style="display:flex; align-items:flex-end; gap:2px; height:70px; margin-bottom:8px; padding:0 4px;">
          ${chartBars}
        </div>` : ''}
      ${s.top_categories.length > 0 ? `
        <div style="margin-top:10px;">
          <p style="font-size:12px; font-weight:600; margin-bottom:6px;">업무 유형 분포</p>
          ${s.top_categories.map(c => `
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
              <span style="font-size:13px; min-width:60px;">${escHtml(c.name)}</span>
              <div style="flex:1; background:var(--gray-200); border-radius:4px; height:12px; overflow:hidden;">
                <div style="width:${c.pct}%; height:100%; background:var(--primary); border-radius:4px;"></div>
              </div>
              <span style="font-size:11px; color:var(--gray-500); min-width:40px; text-align:right;">${c.count}건 (${c.pct}%)</span>
            </div>
          `).join('')}
        </div>` : ''}
    </div>

    <div class="card" style="margin-bottom:12px; border-left:4px solid #10b981;">
      <p style="font-size:15px; font-weight:700; color:#059669; margin-bottom:10px;">✅ 긍정적 전망 (귀납적 분석)</p>
      <div style="margin-bottom:12px;">
        <p style="font-size:13px; font-weight:600; color:var(--gray-700); margin-bottom:6px;">관찰된 패턴</p>
        ${data.positive.observations.map(o => `<p style="font-size:13px; line-height:1.6; margin-bottom:4px; padding-left:12px; border-left:2px solid #a7f3d0;">• ${o}</p>`).join('')}
      </div>
      <div style="background:#f0fdf4; border-radius:8px; padding:12px; margin-bottom:8px;">
        <p style="font-size:13px; font-weight:600; color:#065f46; margin-bottom:4px;">논리적 결론</p>
        <p style="font-size:13px; color:#065f46; line-height:1.6;">${data.positive.conclusion}</p>
      </div>
      <div style="background:#ecfdf5; border-radius:8px; padding:12px;">
        <p style="font-size:13px; font-weight:600; color:#047857; margin-bottom:4px;">향후 예측</p>
        <p style="font-size:13px; color:#047857; line-height:1.6;">${data.positive.prediction}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px; border-left:4px solid #ef4444;">
      <p style="font-size:15px; font-weight:700; color:#dc2626; margin-bottom:10px;">⚠️ 잠재적 리스크 (귀납적 분석)</p>
      <div style="margin-bottom:12px;">
        <p style="font-size:13px; font-weight:600; color:var(--gray-700); margin-bottom:6px;">관찰된 패턴</p>
        ${data.negative.observations.map(o => `<p style="font-size:13px; line-height:1.6; margin-bottom:4px; padding-left:12px; border-left:2px solid #fca5a5;">• ${o}</p>`).join('')}
      </div>
      <div style="background:#fef2f2; border-radius:8px; padding:12px; margin-bottom:8px;">
        <p style="font-size:13px; font-weight:600; color:#991b1b; margin-bottom:4px;">논리적 결론</p>
        <p style="font-size:13px; color:#991b1b; line-height:1.6;">${data.negative.conclusion}</p>
      </div>
      <div style="background:#fff5f5; border-radius:8px; padding:12px;">
        <p style="font-size:13px; font-weight:600; color:#b91c1c; margin-bottom:4px;">예상 리스크</p>
        <p style="font-size:13px; color:#b91c1c; line-height:1.6;">${data.negative.prediction}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px; border-left:4px solid #2563eb;">
      <p style="font-size:15px; font-weight:700; color:#1d4ed8; margin-bottom:10px;">💡 실행 권고사항</p>
      ${data.recommendations.map(r => {
        const pColor = r.priority === '긴급' ? '#dc2626' : r.priority === '주의' ? '#ea580c' : r.priority === '중요' ? '#2563eb' : '#6b7280';
        return `
        <div style="padding:10px; background:var(--gray-50); border-radius:8px; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="font-size:10px; background:${pColor}; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600;">${r.priority}</span>
            <span style="font-size:14px; font-weight:600;">${escHtml(r.action)}</span>
          </div>
          <p style="font-size:12px; color:var(--gray-500); padding-left:4px;">${escHtml(r.reason)}</p>
        </div>`;
      }).join('')}
    </div>

    <div class="card" style="background:#f8fafc;">
      <p style="font-size:12px; color:var(--gray-500); line-height:1.6;">
        &#128300; <strong>분석 방법론</strong>: 귀납적 추론(Inductive Reasoning) 기반<br>
        개별 업무 데이터에서 패턴을 관찰하고, 반복되는 특성으로부터 일반적인 결론과 예측을 도출합니다.
        실제 데이터 ${data.total}건, ${data.period.total_days}일간의 업무 기록을 분석하였습니다.
      </p>
    </div>
  `;
}

// ─── 개인 업무 인사이트 ───
async function showPersonalInsight() {
  const data = await api('/api/personal-insight');
  if (!data) return;
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  if (data.empty) {
    document.getElementById('mainContent').innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
      <div class="card" style="text-align:center; padding:40px;">
        <div style="font-size:48px; margin-bottom:16px;">&#128161;</div>
        <p style="font-size:18px; font-weight:700; margin-bottom:8px;">업무 분석</p>
        <p style="font-size:14px; color:var(--gray-500);">업무일지를 작성하면 분석 결과가 표시됩니다.</p>
      </div>`;
    return;
  }

  const fromDate = data.date_range.from ? data.date_range.from.toString().split('T')[0] : '-';
  const toDate = data.date_range.to ? data.date_range.to.toString().split('T')[0] : '-';

  const catColors = { '내근': '#1a73e8', '외근': '#34a853', '출장': '#ea4335' };
  const catBar = data.categories.length > 0 ? `
    <div style="display:flex; border-radius:6px; overflow:hidden; height:20px; margin:8px 0;">
      ${data.categories.map(c => `<div style="width:${c.pct}%; background:${catColors[c.name] || '#999'}; min-width:15px;" title="${c.name} ${c.pct}%"></div>`).join('')}
    </div>
    <div style="display:flex; gap:8px; font-size:11px; flex-wrap:wrap;">
      ${data.categories.map(c => `<span><span style="width:8px; height:8px; border-radius:2px; background:${catColors[c.name] || '#999'}; display:inline-block;"></span> ${c.name} ${c.pct}%</span>`).join('')}
    </div>` : '';

  const monthMax = Math.max(...data.monthly.map(m => m.cnt), 1);
  const monthChart = data.monthly.length > 1 ? `
    <div style="display:flex; gap:4px; align-items:flex-end; height:60px; margin:8px 0;">
      ${data.monthly.map(m => {
        const h = Math.max(4, Math.round(parseInt(m.cnt) / monthMax * 56));
        return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;">
          <div style="font-size:10px; color:var(--gray-500);">${m.cnt}</div>
          <div style="width:100%; max-width:30px; height:${h}px; background:var(--primary); border-radius:4px 4px 0 0;"></div>
          <div style="font-size:10px; color:var(--gray-500); margin-top:2px;">${m.month.substring(5)}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <div style="text-align:center; margin-bottom:16px;">
      <div style="font-size:36px; margin-bottom:8px;">&#128161;</div>
      <p style="font-size:20px; font-weight:800;">${escHtml(data.user.name)} ${escHtml(data.user.position || '')} 업무 분석</p>
      <p style="font-size:12px; color:var(--gray-500);">${fromDate} ~ ${toDate} · 총 ${data.total}건</p>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <p style="font-size:14px; font-weight:700; margin-bottom:8px;">&#128200; 활동 추이</p>
      ${monthChart}
      ${catBar}
    </div>

    ${data.positive.length > 0 ? `
    <div class="card" style="margin-bottom:12px; border-left:4px solid #43a047;">
      <p style="font-size:14px; font-weight:700; margin-bottom:10px; color:#2e7d32;">&#128994; 긍정적 분석</p>
      ${data.positive.map(p => `
        <div style="padding:10px; background:#e8f5e9; border-radius:8px; margin-bottom:6px;">
          <div style="font-size:14px; font-weight:600; color:#2e7d32;">${escHtml(p.title)}</div>
          <div style="font-size:13px; color:var(--gray-700); margin-top:4px;">${escHtml(p.detail)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${data.negative.length > 0 ? `
    <div class="card" style="margin-bottom:12px; border-left:4px solid #c62828;">
      <p style="font-size:14px; font-weight:700; margin-bottom:10px; color:#c62828;">&#128308; 개선 필요</p>
      ${data.negative.map(n => `
        <div style="padding:10px; background:#ffebee; border-radius:8px; margin-bottom:6px;">
          <div style="font-size:14px; font-weight:600; color:#c62828;">${escHtml(n.title)}</div>
          <div style="font-size:13px; color:var(--gray-700); margin-top:4px;">${escHtml(n.detail)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${data.predictions.length > 0 ? `
    <div class="card" style="margin-bottom:12px; border-left:4px solid #f9a825;">
      <p style="font-size:14px; font-weight:700; margin-bottom:10px; color:#f57f17;">&#128302; 예상 결과</p>
      ${data.predictions.map(p => `
        <div style="padding:10px; background:${p.type === 'positive' ? '#f1f8e9' : '#fff8e1'}; border-radius:8px; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:600; color:${p.type === 'positive' ? '#558b2f' : '#e65100'};">${p.type === 'positive' ? '&#9650; 긍정' : '&#9660; 주의'}</span>
          <div style="font-size:13px; color:var(--gray-700); margin-top:4px;">${escHtml(p.text)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${data.recommendations.length > 0 ? `
    <div class="card" style="margin-bottom:12px; border-left:4px solid #0891b2;">
      <p style="font-size:14px; font-weight:700; margin-bottom:10px; color:#0891b2;">&#128204; 방향 제안</p>
      ${data.recommendations.map(r => `
        <div style="padding:10px; background:#e0f7fa; border-radius:8px; margin-bottom:6px;">
          <div style="font-size:13px; color:var(--gray-800); line-height:1.6;">${escHtml(r)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${data.top_tasks.length > 0 ? `
    <div class="card" style="margin-bottom:12px;">
      <p style="font-size:14px; font-weight:700; margin-bottom:8px;">&#128293; 주요 수행 업무</p>
      ${data.top_tasks.map(t => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-100);">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge badge-${t.category}" style="font-size:10px;">${t.category}</span>
            <span style="font-size:13px;">${escHtml(t.task)}</span>
          </div>
          <span style="font-size:12px; color:var(--gray-500);">${t.count}회</span>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

// ─── 통합 검색 ───
let _searchTimer = null;

function showGlobalSearch() {
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  document.getElementById('mainContent').innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="position:relative;">
        <input type="text" id="globalSearchInput" class="form-control" placeholder="업무, 지국, 매뉴얼, 회의록 검색..."
          oninput="onSearchInput()" autofocus
          style="padding-left:36px; font-size:16px; height:48px; border-radius:24px;">
        <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:18px;">&#128269;</span>
      </div>
      <p style="font-size:12px; color:var(--gray-400); margin-top:6px; text-align:center;">2글자 이상 입력하면 자동 검색됩니다</p>
    </div>
    <div id="searchResults"></div>
  `;
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 100);
}

function onSearchInput() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(doGlobalSearch, 300);
}

async function doGlobalSearch() {
  const q = (document.getElementById('globalSearchInput') || {}).value || '';
  const el = document.getElementById('searchResults');
  if (!el) return;

  if (q.trim().length < 2) {
    el.innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--gray-400);">
        <div style="font-size:36px; margin-bottom:12px;">&#128269;</div>
        <p>검색어를 입력해주세요</p>
      </div>`;
    return;
  }

  el.innerHTML = '<p style="text-align:center; color:var(--gray-500); padding:20px;">검색 중...</p>';
  const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
  if (!data) return;

  if (data.results.length === 0) {
    el.innerHTML = `
      <div style="text-align:center; padding:40px 0; color:var(--gray-400);">
        <div style="font-size:36px; margin-bottom:12px;">&#128530;</div>
        <p>"${escHtml(q)}" 검색 결과가 없습니다</p>
      </div>`;
    return;
  }

  const typeLabels = { report: '업무일지', task: '업무표', branch: '지국', manual: '매뉴얼', meeting: '회의록' };
  const typeIcons = { report: '&#128221;', task: '&#128203;', branch: '&#127970;', manual: '&#128214;', meeting: '&#128466;' };

  const grouped = {};
  data.results.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });

  let html = `<p style="font-size:13px; color:var(--gray-500); margin-bottom:12px;">"${escHtml(q)}" 검색 결과 ${data.total}건</p>`;

  Object.entries(grouped).forEach(([type, items]) => {
    html += `
      <div style="margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
          <span style="font-size:16px;">${typeIcons[type] || ''}</span>
          <span style="font-size:14px; font-weight:700;">${typeLabels[type] || type}</span>
          <span style="font-size:12px; color:var(--gray-400);">${items.length}건</span>
        </div>
        ${items.map(r => `
          <div class="list-item" onclick="openSearchResult('${r.type}','${r.id}')" style="cursor:pointer;">
            <div class="list-item-content">
              <div class="list-item-title">${escHtml(r.title)}</div>
              <div class="list-item-sub">${escHtml(r.sub || '')}</div>
            </div>
            ${r.category ? `<span class="badge badge-${r.category}" style="font-size:10px;">${escHtml(r.category)}</span>` : ''}
          </div>
        `).join('')}
      </div>`;
  });

  el.innerHTML = html;
}

function openSearchResult(type, id) {
  if (type === 'report') viewReport(id);
  else if (type === 'task') viewTask(id);
  else if (type === 'branch') viewBranch(id);
  else if (type === 'manual') showManual();
  else if (type === 'meeting') viewMeetingNote(id);
}

// ─── 신입 온보딩 가이드 ───
async function showOnboarding() {
  const data = await api('/api/onboarding');
  if (!data) return;
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  if (data.total_reports === 0) {
    document.getElementById('mainContent').innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
      <div class="card" style="text-align:center; padding:40px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">&#127891;</div>
        <p style="font-size:18px; font-weight:700; margin-bottom:8px;">신입 온보딩 가이드</p>
        <p style="font-size:14px; color:var(--gray-500); line-height:1.7;">
          업무일지가 쌓이면 자동으로<br>온보딩 가이드가 만들어집니다.
        </p>
      </div>`;
    return;
  }

  const catIcons = { '내근': '&#128187;', '외근': '&#128694;', '출장': '&#9992;' };

  let peopleHtml = '';
  Object.entries(data.person_roles).forEach(([name, info]) => {
    const topTasks = info.tasks.slice(0, 3);
    peopleHtml += `
      <div style="padding:10px; background:var(--gray-50); border-radius:8px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:14px; font-weight:700;">${escHtml(name)}</span>
          <span style="font-size:12px; color:var(--gray-500);">${escHtml(info.position || '')}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${topTasks.map(t => `<span style="font-size:11px; padding:2px 8px; background:#e3f2fd; border-radius:10px; color:#1565c0;">${escHtml(t.task)} (${t.cnt})</span>`).join('')}
          ${info.tasks.length > 3 ? `<span style="font-size:11px; color:var(--gray-400);">+${info.tasks.length - 3}</span>` : ''}
        </div>
      </div>`;
  });

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>

    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:36px; margin-bottom:8px;">&#127891;</div>
      <p style="font-size:20px; font-weight:800;">WorkFlow 업무 가이드</p>
      <p style="font-size:13px; color:var(--gray-500);">이 가이드는 업무일지 ${data.total_reports}건 기반으로 자동 생성되었습니다</p>
    </div>

    <!-- 1. 조직 개요 -->
    <div class="card" style="margin-bottom:12px; border-left:4px solid var(--primary);">
      <p style="font-size:16px; font-weight:700; margin-bottom:12px;">&#127970; 조직 개요</p>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-number">${data.total_people}</div><div class="stat-label">근무 인원</div></div>
        <div class="stat-card"><div class="stat-number">${data.branch_count}</div><div class="stat-label">전국 지국</div></div>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
        ${data.categories.map(c => `
          <span style="font-size:13px; padding:4px 12px; background:var(--gray-100); border-radius:12px;">
            ${catIcons[c.name] || ''} ${c.name} ${c.count}건
          </span>
        `).join('')}
      </div>
    </div>

    <!-- 2. 핵심 업무 TOP -->
    <div class="card" style="margin-bottom:12px; border-left:4px solid #43a047;">
      <p style="font-size:16px; font-weight:700; margin-bottom:4px;">&#11088; 핵심 업무 (반드시 알아야 할 것)</p>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:12px;">3회 이상 반복된 업무 = 핵심 업무</p>
      ${data.core_tasks.length === 0 ? `
        <p style="font-size:13px; color:var(--gray-400); text-align:center; padding:12px;">아직 확립된 핵심 업무가 없습니다</p>
      ` : data.core_tasks.map((t, i) => `
        <div style="padding:10px; background:${t.frequency >= 5 ? '#e8f5e9' : '#fff8e1'}; border-radius:8px; margin-bottom:6px;">
          <div style="display:flex; justify-content:space-between; align-items:start;">
            <div style="flex:1;">
              <div style="font-size:11px; color:${t.frequency >= 5 ? '#2e7d32' : '#e65100'}; font-weight:600; margin-bottom:2px;">
                ${t.frequency >= 5 ? '&#128308; 정기 업무' : '&#128992; 반복 업무'} · ${t.frequency}회 수행
              </div>
              <div style="font-size:14px; font-weight:600;">${escHtml(t.task)}</div>
            </div>
            <span class="badge badge-${t.category}" style="flex-shrink:0;">${t.category}</span>
          </div>
          ${t.purpose ? `<div style="font-size:12px; color:var(--gray-600); margin-top:4px;">목적: ${escHtml(t.purpose)}</div>` : ''}
          ${t.methods.length > 0 ? `<div style="font-size:12px; color:var(--gray-600); margin-top:2px;">방법: ${t.methods.map(m => escHtml(m)).join(' / ')}</div>` : ''}
          <div style="font-size:11px; color:var(--gray-500); margin-top:4px;">담당: ${t.people.join(', ')}</div>
        </div>
      `).join('')}
    </div>

    <!-- 3. 담당자별 역할 -->
    <div class="card" style="margin-bottom:12px; border-left:4px solid #1565c0;">
      <p style="font-size:16px; font-weight:700; margin-bottom:4px;">&#128101; 누가 무엇을 하는가</p>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:12px;">담당자별 주요 업무</p>
      ${peopleHtml}
    </div>

    <!-- 4. 빠른 이동 -->
    <div class="card" style="margin-bottom:12px; border-left:4px solid #e65100;">
      <p style="font-size:16px; font-weight:700; margin-bottom:12px;">&#128204; 더 알아보기</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-outline btn-block" onclick="showManual()" style="text-align:left; padding:12px;">
          &#128214; <strong>업무 매뉴얼</strong> — 절차서와 수행 방법 상세
        </button>
        <button class="btn btn-outline btn-block" onclick="showKnowledgeMap()" style="text-align:left; padding:12px;">
          &#129504; <strong>업무 지식맵</strong> — 카테고리, 패턴, 통계 분석
        </button>
        <button class="btn btn-outline btn-block" onclick="showWorkflowDiagrams()" style="text-align:left; padding:12px;">
          &#128200; <strong>업무 흐름도</strong> — 구조도와 담당자 관계 다이어그램
        </button>
        <button class="btn btn-outline btn-block" onclick="showTaskMaster()" style="text-align:left; padding:12px;">
          &#128203; <strong>주요업무표</strong> — 전체 업무 목록
        </button>
        <button class="btn btn-outline btn-block" onclick="showPersonalTasks()" style="text-align:left; padding:12px;">
          &#128221; <strong>개별 업무표</strong> — 담당자별 상세 업무
        </button>
        <button class="btn btn-outline btn-block" onclick="showBranches()" style="text-align:left; padding:12px;">
          &#127970; <strong>전국 지국</strong> — 지국 현황과 연락처
        </button>
      </div>
    </div>

    <div style="text-align:center; padding:20px; color:var(--gray-400); font-size:12px;">
      업무일지를 꾸준히 작성하면 이 가이드가 더 풍부해집니다
    </div>
  `;
}

// ─── 워크플로우 다이어그램 ───
let _wfTab = 'overview';

async function showWorkflowDiagrams() {
  const data = await api('/api/workflow-diagrams');
  if (!data) return;
  window._wfData = data;
  _wfTab = 'overview';
  renderWorkflowPage();
}

function renderWorkflowPage() {
  const data = window._wfData;
  const fab = document.getElementById('fabBtn');
  fab.style.display = 'none';

  if (data.empty) {
    document.getElementById('mainContent').innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
      <div class="card" style="text-align:center; padding:40px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">&#128200;</div>
        <p style="font-size:18px; font-weight:700; margin-bottom:8px;">업무 흐름도</p>
        <p style="font-size:14px; color:var(--gray-500); line-height:1.7;">
          업무일지가 쌓이면 자동으로<br>업무 흐름도가 만들어집니다.
        </p>
      </div>`;
    return;
  }

  const cats = data.categories || [];
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title">&#128200; 업무 흐름도</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">업무일지 기반 자동 생성 다이어그램</p>

    <div class="tabs" style="margin-bottom:12px; flex-wrap:wrap;">
      <button class="tab ${_wfTab === 'overview' ? 'active' : ''}" onclick="_wfTab='overview'; renderWorkflowPage()">전체 구조</button>
      ${cats.map(c => `<button class="tab ${_wfTab === 'cat_' + c ? 'active' : ''}" onclick="_wfTab='cat_${c}'; renderWorkflowPage()">${c}</button>`).join('')}
      <button class="tab ${_wfTab === 'relation' ? 'active' : ''}" onclick="_wfTab='relation'; renderWorkflowPage()">담당자 관계</button>
    </div>

    <div class="card" style="padding:12px; margin-bottom:12px;">
      <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:12px; margin-bottom:8px;">
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:#c8e6c9; border:1px solid #2e7d32; border-radius:2px;"></span> 정기업무 (5회+)</span>
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:#fff3e0; border:1px solid #e65100; border-radius:2px;"></span> 반복업무 (3~4회)</span>
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:12px; height:12px; background:#e3f2fd; border:1px solid #1a73e8; border-radius:2px;"></span> 카테고리/담당자</span>
      </div>
      <p style="font-size:11px; color:var(--gray-400);">좌우로 스크롤하여 전체 다이어그램을 볼 수 있습니다</p>
    </div>

    <div class="card" style="padding:16px;">
      <div id="wfDiagramArea" style="overflow-x:auto; -webkit-overflow-scrolling:touch;"></div>
    </div>
  `;

  let code;
  if (_wfTab === 'overview') {
    code = data.overview;
  } else if (_wfTab === 'relation') {
    code = data.relation;
  } else if (_wfTab.startsWith('cat_')) {
    const cat = _wfTab.substring(4);
    code = data.category_diagrams[cat] || 'graph TD\n  A["데이터 없음"]';
  }

  renderWfMermaid(code);
}

async function renderWfMermaid(code) {
  const area = document.getElementById('wfDiagramArea');
  if (!area) return;

  if (!window._mermaidLoaded) {
    area.innerHTML = '<p style="text-align:center; color:var(--gray-500);">다이어그램 로딩 중...</p>';
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      window._mermaidLoaded = true;
      window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      doRenderWf(code);
    };
    document.head.appendChild(script);
  } else {
    doRenderWf(code);
  }
}

async function doRenderWf(code) {
  const area = document.getElementById('wfDiagramArea');
  if (!area) return;
  try {
    const id = 'wf-' + Date.now();
    const { svg } = await window.mermaid.render(id, code);
    area.innerHTML = svg;
    const svgEl = area.querySelector('svg');
    if (svgEl) { svgEl.style.maxWidth = 'none'; svgEl.style.height = 'auto'; svgEl.style.minWidth = '600px'; }
  } catch (e) {
    area.innerHTML = '<p style="color:var(--gray-500); font-size:13px; text-align:center;">다이어그램 생성 중 오류가 발생했습니다.</p>';
  }
}

// ─── 월간 업무 요약 ───
let summaryMonth = new Date().toISOString().substring(0, 7);

async function showMonthlySummary() {
  const data = await api(`/api/monthly-summary?month=${summaryMonth}`);
  if (!data) return;

  if (data.empty) {
    document.getElementById('mainContent').innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
      <p class="section-title">&#128202; 월간 업무 요약</p>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <button class="btn btn-outline btn-sm" onclick="summaryMonth=prevMonth(summaryMonth); showMonthlySummary();">&lsaquo;</button>
        <span style="font-size:16px; font-weight:700;">${summaryMonth}</span>
        <button class="btn btn-outline btn-sm" onclick="summaryMonth=nextMonth(summaryMonth); showMonthlySummary();">&rsaquo;</button>
      </div>
      <div class="empty-state"><div class="empty-icon">&#128202;</div><div class="empty-text">이번 달 업무일지가 없습니다</div></div>
    `;
    return;
  }

  const d = data;
  const catColors = { '내근': '#1a73e8', '외근': '#34a853', '출장': '#ea4335', '기타': '#999' };
  const fillRate = Math.round(d.unique_days / d.work_days * 100);

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <p class="section-title" style="margin:0;">&#128202; 월간 업무 요약</p>
    </div>
    <p style="font-size:13px; color:var(--gray-500); margin-bottom:12px;">${d.user.name} ${d.user.position || ''}</p>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <button class="btn btn-outline btn-sm" onclick="summaryMonth=prevMonth(summaryMonth); showMonthlySummary();">&lsaquo;</button>
      <span style="font-size:16px; font-weight:700;">${d.month}</span>
      <button class="btn btn-outline btn-sm" onclick="summaryMonth=nextMonth(summaryMonth); showMonthlySummary();">&rsaquo;</button>
    </div>

    <!-- 핵심 통계 -->
    <div class="stats-row" style="margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-number">${d.total_reports}</div>
        <div class="stat-label">총 보고</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${d.unique_days}/${d.work_days}</div>
        <div class="stat-label">작성일</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="${fillRate >= 80 ? 'color:var(--success);' : fillRate < 50 ? 'color:#ef4444;' : ''}">${fillRate}%</div>
        <div class="stat-label">작성률</div>
      </div>
    </div>

    ${d.attendance.days > 0 ? `
    <!-- 근태 요약 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px;">&#128339; 근태 요약</span>
      <div style="display:flex; gap:16px; font-size:13px;">
        <div><span style="color:var(--gray-500);">출근일</span> <strong>${d.attendance.days}일</strong></div>
        <div><span style="color:var(--gray-500);">지각</span> <strong style="${d.attendance.late > 0 ? 'color:#ef4444;' : ''}">${d.attendance.late}회</strong></div>
        ${d.attendance.avg_hours ? `<div><span style="color:var(--gray-500);">평균근무</span> <strong>${d.attendance.avg_hours}시간</strong></div>` : ''}
      </div>
    </div>` : ''}

    <!-- 업무 유형 분포 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px;">&#128200; 업무 유형 분포</span>
      <div style="display:flex; border-radius:6px; overflow:hidden; height:28px; margin-bottom:10px;">
        ${d.categories.map(c => `<div style="width:${c.pct}%; background:${catColors[c.name] || '#999'}; min-width:20px;" title="${c.name} ${c.count}건"></div>`).join('')}
      </div>
      <div style="display:flex; gap:14px; flex-wrap:wrap; font-size:13px;">
        ${d.categories.map(c => `<span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:2px; background:${catColors[c.name] || '#999'};"></span>${c.name} ${c.count}건 (${c.pct}%)</span>`).join('')}
      </div>
    </div>

    <!-- 주요 업무 TOP -->
    ${d.top_tasks.length > 0 ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px;">&#127942; 주요 업무 TOP ${d.top_tasks.length}</span>
      ${d.top_tasks.map((t, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-100);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; font-weight:700; color:${i < 3 ? 'var(--primary)' : 'var(--gray-400)'}; width:20px;">${i + 1}</span>
            <span style="font-size:13px;">${escHtml(t.task)}</span>
          </div>
          <span style="font-size:12px; color:var(--gray-500); font-weight:600;">${t.count}회</span>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 주요 활동 장소 -->
    ${d.top_places.length > 0 ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px;">&#128205; 주요 활동 장소</span>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${d.top_places.map(p => `<span style="font-size:12px; padding:4px 10px; background:var(--gray-100); border-radius:12px;">${escHtml(p.place)} <strong>${p.count}</strong></span>`).join('')}
      </div>
    </div>` : ''}

    <!-- 주차별 활동 -->
    ${d.weekly.length > 0 ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px;">&#128197; 주차별 활동</span>
      ${d.weekly.map(w => `
        <div style="margin-bottom:10px; padding:8px; background:var(--gray-50); border-radius:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:13px; font-weight:600;">${w.week}</span>
            <span style="font-size:12px; color:var(--gray-500);">${w.count}건</span>
          </div>
          <div style="font-size:12px; color:var(--gray-600); line-height:1.6;">
            ${w.tasks.map(t => `<span style="display:inline-block; margin-right:8px;">&#8226; ${escHtml(t)}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 종합 평가 -->
    <div class="card" style="padding:14px; margin-bottom:16px; background:linear-gradient(135deg, #f0f9ff, #e0f2fe);">
      <span style="font-size:14px; font-weight:700; display:block; margin-bottom:10px; color:#0369a1;">&#128161; 종합 평가</span>
      <div style="font-size:13px; line-height:1.8; color:#0c4a6e;">
        ${fillRate >= 80 ? `&#9989; 작성률 ${fillRate}%로 우수합니다. 꾸준한 기록 습관이 잘 유지되고 있습니다.` :
          fillRate >= 50 ? `&#9888;&#65039; 작성률 ${fillRate}%입니다. 좀 더 꾸준한 기록을 권장합니다.` :
          `&#10060; 작성률 ${fillRate}%로 낮습니다. 일일 업무 기록을 습관화해주세요.`}<br>
        ${d.categories.length >= 3 ? '&#9989; 다양한 유형의 업무를 수행하고 있습니다.' : d.categories.length === 1 ? `&#9888;&#65039; ${d.categories[0].name} 업무에 편중되어 있습니다.` : ''}
        ${d.top_tasks.length > 0 ? `<br>&#128293; 핵심 업무: ${d.top_tasks.slice(0, 3).map(t => t.task).join(', ')}` : ''}
        ${d.attendance.late > 2 ? `<br>&#9888;&#65039; 지각 ${d.attendance.late}회로 출근 관리가 필요합니다.` : ''}
      </div>
    </div>
  `;
}

// ─── 빠른 메모 ───
const noteColors = ['#fef3c7','#dcfce7','#dbeafe','#fce7f3','#f3e8ff','#fed7aa'];

async function showNotes() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">메모 로딩 중...</p>';

  const notes = await api('/api/notes');
  if (!notes) return;

  document.getElementById('mainContent').innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:20px;">&#128221;</span>
        <span style="font-size:18px; font-weight:800;">빠른 메모</span>
        <span style="font-size:13px; color:var(--gray-400);">${notes.length}개</span>
      </div>
      <button class="btn btn-primary btn-sm" onclick="showNoteEditor()">+ 새 메모</button>
    </div>
    <div id="notesList">
      ${notes.length === 0 ? `
        <div style="text-align:center; padding:40px 20px;">
          <div style="font-size:48px; margin-bottom:16px;">&#128221;</div>
          <p style="font-size:14px; color:var(--gray-500);">메모가 없습니다. 새 메모를 추가해보세요!</p>
        </div>` :
        `<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
          ${notes.map(n => renderNoteCard(n)).join('')}
        </div>`}
    </div>
    <div id="noteEditorModal"></div>
  `;
}

function renderNoteCard(n) {
  const preview = (n.content || '').substring(0, 80);
  const timeStr = (n.updated_at || n.created_at || '').toString().substring(0, 10);
  return `
    <div onclick="showNoteEditor('${n.id}')" style="background:${n.color || '#fef3c7'}; padding:12px; border-radius:10px; cursor:pointer; min-height:100px; position:relative; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      ${n.pinned ? '<span style="position:absolute; top:6px; right:8px; font-size:14px;">&#128204;</span>' : ''}
      <div style="font-size:13px; line-height:1.6; color:#1a1a1a; white-space:pre-wrap; word-break:break-word;">${escHtml(preview)}${(n.content || '').length > 80 ? '...' : ''}</div>
      <div style="font-size:10px; color:rgba(0,0,0,0.35); margin-top:8px;">${timeStr}</div>
    </div>`;
}

async function showNoteEditor(noteId) {
  let note = { id: '', content: '', color: '#fef3c7', pinned: false };

  if (noteId) {
    const notes = await api('/api/notes');
    if (notes) { const found = notes.find(n => n.id === noteId); if (found) note = found; }
  }

  const isNew = !noteId;

  document.getElementById('noteEditorModal').innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:2000; display:flex; align-items:flex-end; justify-content:center;" onclick="if(event.target===this)closeNoteEditor()">
      <div style="background:#fff; width:100%; max-width:500px; border-radius:16px 16px 0 0; padding:20px; max-height:80vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:16px; font-weight:700;">${isNew ? '새 메모' : '메모 편집'}</span>
          <button onclick="closeNoteEditor()" style="background:none; border:none; font-size:20px; cursor:pointer;">&times;</button>
        </div>
        <textarea id="noteContent" class="form-control" rows="8" placeholder="메모를 입력하세요..." style="font-size:14px; line-height:1.6; resize:none; background:${note.color}; border:none;">${escHtml(note.content)}</textarea>
        <div style="display:flex; gap:8px; margin:12px 0; align-items:center;">
          <span style="font-size:12px; color:var(--gray-500);">색상:</span>
          ${noteColors.map(c => `
            <div onclick="document.getElementById('noteContent').style.background='${c}'; document.getElementById('selNoteColor').value='${c}';"
              style="width:24px; height:24px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid ${c === note.color ? '#333' : 'transparent'};"></div>
          `).join('')}
          <input type="hidden" id="selNoteColor" value="${note.color}">
        </div>
        <div style="display:flex; gap:8px;">
          ${!isNew ? `
            <button class="btn btn-sm" onclick="toggleNotePin('${note.id}', ${!note.pinned})" style="background:${note.pinned ? '#fef3c7' : 'var(--gray-100)'}; border:none;">
              ${note.pinned ? '&#128204; 고정 해제' : '&#128204; 고정'}
            </button>
            <button class="btn btn-sm" onclick="deleteNote('${note.id}')" style="background:#fee2e2; color:#dc2626; border:none;">삭제</button>
          ` : ''}
          <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="saveNote('${note.id}')">${isNew ? '저장' : '수정'}</button>
        </div>
      </div>
    </div>`;
}

function closeNoteEditor() {
  const el = document.getElementById('noteEditorModal');
  if (el) el.innerHTML = '';
}

async function saveNote(noteId) {
  const content = document.getElementById('noteContent').value.trim();
  if (!content) { showToast('내용을 입력해주세요'); return; }
  const color = document.getElementById('selNoteColor').value;

  if (noteId) {
    await api(`/api/notes/${noteId}`, { method: 'PUT', body: { content, color } });
  } else {
    await api('/api/notes', { method: 'POST', body: { content, color } });
  }
  closeNoteEditor();
  showNotes();
}

async function deleteNote(noteId) {
  if (!confirm('이 메모를 삭제하시겠습니까?')) return;
  await api(`/api/notes/${noteId}`, { method: 'DELETE' });
  closeNoteEditor();
  showNotes();
}

async function toggleNotePin(noteId, pinned) {
  await api(`/api/notes/${noteId}`, { method: 'PUT', body: { pinned } });
  closeNoteEditor();
  showNotes();
}

// ─── 활동 타임라인 ───
async function showTimeline() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">타임라인 로딩 중...</p>';

  const d = await api('/api/timeline');
  if (!d) return;

  if (!d.items || d.items.length === 0) {
    document.getElementById('mainContent').innerHTML = `
      <div style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">&#128337;</div>
        <p style="font-size:16px; font-weight:600; color:var(--gray-600);">활동 내역이 없습니다</p>
        <p style="font-size:13px; color:var(--gray-400);">업무일지를 작성하면 타임라인에 표시됩니다.</p>
      </div>`;
    return;
  }

  const grouped = {};
  d.items.forEach(item => {
    const dt = (item.date || '').toString().substring(0, 10);
    if (!grouped[dt]) grouped[dt] = [];
    grouped[dt].push(item);
  });

  const dayNames = ['일','월','화','수','목','금','토'];

  let html = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
      <span style="font-size:20px;">&#128337;</span>
      <span style="font-size:18px; font-weight:800;">활동 타임라인</span>
    </div>`;

  Object.entries(grouped).forEach(([date, items]) => {
    const dow = new Date(date).getDay();
    const isToday = date === new Date().toISOString().split('T')[0];
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date === yesterday.toISOString().split('T')[0];
    const dateLabel = isToday ? '오늘' : isYesterday ? '어제' : `${date} (${dayNames[dow]})`;

    html += `
      <div style="margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <div style="width:10px; height:10px; border-radius:50%; background:${isToday ? '#2563eb' : 'var(--gray-300)'};"></div>
          <span style="font-size:14px; font-weight:700; color:${isToday ? '#2563eb' : 'var(--gray-700)'};">${dateLabel}</span>
          <span style="font-size:11px; color:var(--gray-400);">${items.length}건</span>
        </div>
        <div style="margin-left:4px; border-left:2px solid var(--gray-200); padding-left:16px;">
          ${items.map(item => {
            const time = (item.date || '').toString().substring(11, 16);
            const clickable = item.type === 'report' && item.link_id ? `onclick="viewReport(${item.link_id})" style="cursor:pointer;"` : item.type === 'comment' && item.link_id ? `onclick="viewReport(${item.link_id})" style="cursor:pointer;"` : '';
            return `
            <div class="list-item" ${clickable} style="margin-bottom:4px; padding:10px; ${clickable ? 'cursor:pointer;' : ''}">
              <div style="display:flex; align-items:flex-start; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:${item.color}15; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
                  ${item.icon}
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:13px; font-weight:600;">${item.title}</span>
                    <span style="font-size:11px; color:var(--gray-400); flex-shrink:0;">${time}</span>
                  </div>
                  <div style="font-size:12px; color:var(--gray-500); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(item.sub || '')}</div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  });

  document.getElementById('mainContent').innerHTML = html;
}

// ─── 즐겨찾기 ───
async function toggleBookmark(reportId) {
  const check = await api(`/api/bookmarks/check/${reportId}`);
  if (!check) return;

  if (check.bookmarked) {
    await api(`/api/bookmarks/${reportId}`, { method: 'DELETE' });
    showToast('즐겨찾기에서 제거했습니다');
  } else {
    await api('/api/bookmarks', { method: 'POST', body: { report_id: reportId } });
    showToast('즐겨찾기에 추가했습니다');
  }
  const starBtn = document.getElementById('bookmarkBtn');
  if (starBtn) {
    const recheck = await api(`/api/bookmarks/check/${reportId}`);
    starBtn.innerHTML = recheck && recheck.bookmarked ? '&#11088;' : '&#9734;';
    starBtn.title = recheck && recheck.bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가';
  }
}

async function showBookmarks() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">즐겨찾기 로딩 중...</p>';

  const data = await api('/api/bookmarks');
  if (!data) return;

  if (data.length === 0) {
    document.getElementById('mainContent').innerHTML = `
      <div style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">&#11088;</div>
        <p style="font-size:16px; font-weight:600; color:var(--gray-600); margin-bottom:8px;">즐겨찾기가 비어있습니다</p>
        <p style="font-size:13px; color:var(--gray-400);">업무일지 상세에서 &#9734; 버튼을 눌러 중요한 보고서를 저장하세요.</p>
      </div>`;
    return;
  }

  document.getElementById('mainContent').innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
      <span style="font-size:20px;">&#11088;</span>
      <span style="font-size:18px; font-weight:800;">즐겨찾기</span>
      <span style="font-size:13px; color:var(--gray-400);">${data.length}건</span>
    </div>
    ${data.map(b => {
      const dt = (b.report_date || '').toString().split('T')[0];
      return `
      <div class="list-item" style="cursor:pointer; position:relative;" onclick="viewReport('${b.report_id}')">
        <div class="list-item-content">
          <div class="list-item-title">&#11088; ${escHtml(b.what_task || '업무')}</div>
          <div class="list-item-sub">${dt} ${b.where_place ? '| '+escHtml(b.where_place) : ''} ${b.result_status ? '| '+escHtml(b.result_status) : ''}</div>
        </div>
        ${b.work_category ? `<span class="badge badge-${b.work_category}" style="font-size:10px;">${escHtml(b.work_category)}</span>` : ''}
      </div>`;
    }).join('')}
  `;
}

// ─── 팀 실적 대시보드 ───
let teamDashMonth = new Date().toISOString().substring(0, 7);

async function showTeamDashboard() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">팀 실적 분석 중...</p>';

  const d = await api(`/api/team-dashboard?month=${teamDashMonth}`);
  if (!d) return;

  const ts = d.team_summary;
  const [year, mon] = teamDashMonth.split('-').map(Number);

  const medalIcons = ['&#129351;', '&#129352;', '&#129353;'];

  document.getElementById('mainContent').innerHTML = `
    <!-- 헤더 -->
    <div class="card" style="padding:16px; margin-bottom:16px; background:linear-gradient(135deg, #4338ca, #6366f1); color:#fff; border-radius:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:#fff; border:none;" onclick="teamDashMonth=prevMonth(teamDashMonth); showTeamDashboard();">&lsaquo;</button>
        <div style="text-align:center;">
          <div style="font-size:18px; font-weight:800;">&#128101; 팀 실적 대시보드</div>
          <div style="font-size:13px; opacity:0.85; margin-top:2px;">${year}년 ${mon}월</div>
        </div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:#fff; border:none;" onclick="teamDashMonth=nextMonth(teamDashMonth); showTeamDashboard();">&rsaquo;</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
        <div style="padding:10px; background:rgba(255,255,255,0.15); border-radius:8px; text-align:center;">
          <div style="font-size:20px; font-weight:800;">${ts.total_reports}</div>
          <div style="font-size:11px; opacity:0.8;">총 보고서</div>
        </div>
        <div style="padding:10px; background:rgba(255,255,255,0.15); border-radius:8px; text-align:center;">
          <div style="font-size:20px; font-weight:800;">${ts.avg_fill_rate}%</div>
          <div style="font-size:11px; opacity:0.8;">평균 작성률</div>
        </div>
        <div style="padding:10px; background:rgba(255,255,255,0.15); border-radius:8px; text-align:center;">
          <div style="font-size:20px; font-weight:800;">${ts.avg_hours || '-'}h</div>
          <div style="font-size:11px; opacity:0.8;">평균 근무시간</div>
        </div>
        <div style="padding:10px; background:rgba(255,255,255,0.15); border-radius:8px; text-align:center;">
          <div style="font-size:20px; font-weight:800;">${ts.total_late}</div>
          <div style="font-size:11px; opacity:0.8;">총 지각</div>
        </div>
      </div>
    </div>

    <!-- 팀원 순위 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#127942; 업무일지 작성 순위</div>
      ${d.members.map((m, i) => {
        const barColor = m.fill_rate >= 80 ? '#16a34a' : m.fill_rate >= 50 ? '#d97706' : '#dc2626';
        return `
        <div style="padding:10px; margin-bottom:8px; background:${i < 3 ? '#fefce8' : 'var(--gray-50)'}; border-radius:10px; border-left:3px solid ${i < 3 ? '#eab308' : 'var(--gray-300)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:${i < 3 ? '18' : '14'}px;">${i < 3 ? medalIcons[i] : (i+1)+'.'}</span>
              <div>
                <span style="font-size:14px; font-weight:700;">${escHtml(m.name)}</span>
                ${m.position ? `<span style="font-size:11px; color:var(--gray-400); margin-left:4px;">${escHtml(m.position)}</span>` : ''}
              </div>
            </div>
            <span style="font-size:16px; font-weight:800; color:${barColor};">${m.fill_rate}%</span>
          </div>
          <div style="height:6px; background:var(--gray-200); border-radius:3px; overflow:hidden; margin-bottom:6px;">
            <div style="height:100%; width:${Math.min(m.fill_rate, 100)}%; background:${barColor}; border-radius:3px; transition:width 0.5s;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--gray-500);">
            <span>&#128221; ${m.reports}건</span>
            <span>&#9989; 완료 ${m.completed}</span>
            <span>&#128339; ${m.avg_hours || '-'}h</span>
            <span>${m.att_late > 0 ? '<span style="color:#dc2626;">지각 '+m.att_late+'</span>' : '정상출근'}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- 상세 비교 테이블 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#128202; 상세 비교</div>
      <div style="overflow-x:auto;">
        <table style="width:100%; font-size:12px; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--gray-300);">
              <th style="text-align:left; padding:6px 4px;">이름</th>
              <th style="text-align:center; padding:6px 4px;">보고서</th>
              <th style="text-align:center; padding:6px 4px;">출근일</th>
              <th style="text-align:center; padding:6px 4px;">할일</th>
              <th style="text-align:center; padding:6px 4px;">댓글</th>
            </tr>
          </thead>
          <tbody>
            ${d.members.map(m => `
              <tr style="border-bottom:1px solid var(--gray-100);">
                <td style="padding:6px 4px; font-weight:600;">${escHtml(m.name)}</td>
                <td style="text-align:center; padding:6px 4px;">${m.reports}/${d.work_days}</td>
                <td style="text-align:center; padding:6px 4px;">${m.att_days}일</td>
                <td style="text-align:center; padding:6px 4px;">${m.todo_done}/${m.todo_total}</td>
                <td style="text-align:center; padding:6px 4px;">${m.comments}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- 팀 종합 평가 -->
    <div class="card" style="padding:14px; margin-bottom:16px; background:linear-gradient(135deg, #f0f9ff, #e0f2fe);">
      <div style="font-size:15px; font-weight:700; margin-bottom:10px; color:#0369a1;">&#128161; 팀 종합 평가</div>
      <div style="font-size:13px; line-height:1.8; color:#0c4a6e;">
        ${ts.avg_fill_rate >= 80 ? '&#9989; 팀 전체 작성률이 우수합니다. 꾸준한 업무 기록이 잘 이루어지고 있습니다.' :
          ts.avg_fill_rate >= 50 ? '&#9888;&#65039; 팀 평균 작성률이 보통 수준입니다. 미작성 팀원에 대한 독려가 필요합니다.' :
          '&#10060; 팀 평균 작성률이 낮습니다. 업무일지 작성을 강화해주세요.'}<br>
        ${ts.total_late > 5 ? `&#9888;&#65039; 이번 달 총 지각 ${ts.total_late}회로 출근 관리가 필요합니다.` :
          ts.total_late > 0 ? `&#128161; 지각 ${ts.total_late}회로 비교적 양호합니다.` :
          '&#9989; 지각 없이 출근 관리가 잘 되고 있습니다.'}<br>
        ${d.members.filter(m => m.fill_rate === 0).length > 0 ?
          `&#10060; 미작성 팀원: ${d.members.filter(m => m.fill_rate === 0).map(m => m.name).join(', ')}` : ''}
      </div>
    </div>
  `;
}

// ─── 주간 업무 보고서 ───
let weeklyDate = new Date().toISOString().split('T')[0];

function shiftWeek(dateStr, delta) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().split('T')[0];
}

async function showWeeklyReport() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">주간 보고서 생성 중...</p>';

  const d = await api(`/api/weekly-report?date=${weeklyDate}`);
  if (!d) return;

  if (d.empty) {
    document.getElementById('mainContent').innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:24px;">
          <button class="btn btn-outline btn-sm" onclick="weeklyDate=shiftWeek(weeklyDate,-1); showWeeklyReport();">&lsaquo; 이전주</button>
          <span style="font-size:14px; font-weight:600;">${d.weekStart} ~ ${d.weekEnd}</span>
          <button class="btn btn-outline btn-sm" onclick="weeklyDate=shiftWeek(weeklyDate,1); showWeeklyReport();">다음주 &rsaquo;</button>
        </div>
        <div style="font-size:48px; margin-bottom:16px;">&#128203;</div>
        <p style="font-size:14px; color:var(--gray-500);">이 주에 작성된 업무일지가 없습니다.</p>
      </div>`;
    return;
  }

  const resultColors = { completed: '#16a34a', ongoing: '#d97706', issue: '#dc2626' };
  const resultLabels = { completed: '완료', ongoing: '진행중', issue: '미완/보류' };
  const totalResults = d.result_summary.completed + d.result_summary.ongoing + d.result_summary.issue;

  document.getElementById('mainContent').innerHTML = `
    <!-- 헤더 -->
    <div class="card" style="padding:16px; margin-bottom:16px; background:linear-gradient(135deg, #0f766e, #14b8a6); color:#fff; border-radius:12px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:#fff; border:none;" onclick="weeklyDate=shiftWeek(weeklyDate,-1); showWeeklyReport();">&lsaquo; 이전</button>
        <div style="text-align:center;">
          <div style="font-size:18px; font-weight:800;">&#128203; ${d.weekLabel} 주간 보고서</div>
          <div style="font-size:12px; opacity:0.85; margin-top:2px;">${d.weekStart} ~ ${d.weekEnd}</div>
        </div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2); color:#fff; border:none;" onclick="weeklyDate=shiftWeek(weeklyDate,1); showWeeklyReport();">다음 &rsaquo;</button>
      </div>
      <div style="display:flex; justify-content:space-around; padding:10px; background:rgba(255,255,255,0.15); border-radius:8px; text-align:center;">
        <div><div style="font-size:20px; font-weight:800;">${d.total_reports}</div><div style="font-size:11px; opacity:0.8;">총 보고서</div></div>
        <div><div style="font-size:20px; font-weight:800;">${d.work_days}</div><div style="font-size:11px; opacity:0.8;">근무일</div></div>
        <div><div style="font-size:20px; font-weight:800;">${d.categories.length}</div><div style="font-size:11px; opacity:0.8;">업무유형</div></div>
      </div>
    </div>

    <!-- 요일별 업무 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#128197; 요일별 업무 내역</div>
      ${d.daily.map(day => `
        <div style="margin-bottom:10px; padding:10px; background:var(--gray-50); border-radius:8px; border-left:3px solid #14b8a6;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:14px; font-weight:700;">${day.dayName}요일 <span style="font-size:12px; color:var(--gray-400); font-weight:400;">${day.date}</span></span>
            <span style="font-size:11px; color:var(--gray-400);">${day.reports.length}건</span>
          </div>
          ${day.reports.map(r => `
            <div style="font-size:12px; line-height:1.7; padding-left:8px; border-left:2px solid var(--gray-200); margin-bottom:4px;">
              <span style="font-weight:600;">${escHtml(r.task || '업무')}</span>
              ${r.place ? `<span style="color:var(--gray-400);"> @ ${escHtml(r.place)}</span>` : ''}
              ${r.result ? `<span style="margin-left:6px; padding:1px 6px; border-radius:4px; font-size:10px; background:${r.result.includes('완료') ? '#dcfce7;color:#16a34a' : r.result.includes('진행') ? '#fef3c7;color:#d97706' : '#f3f4f6;color:#6b7280'};">${escHtml(r.result)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <!-- 업무 유형 분포 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#128202; 업무 유형 분포</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${d.categories.map(c => `
          <div style="padding:8px 14px; background:var(--gray-50); border-radius:20px; font-size:13px;">
            ${escHtml(c.name)} <span style="font-weight:700; color:#14b8a6;">${c.count}건</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 진행 현황 -->
    ${totalResults > 0 ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#9989; 진행 현황</div>
      <div style="display:flex; gap:10px; text-align:center;">
        <div style="flex:1; padding:12px; background:#dcfce7; border-radius:10px;">
          <div style="font-size:22px; font-weight:800; color:#16a34a;">${d.result_summary.completed}</div>
          <div style="font-size:11px; color:#15803d;">완료</div>
        </div>
        <div style="flex:1; padding:12px; background:#fef3c7; border-radius:10px;">
          <div style="font-size:22px; font-weight:800; color:#d97706;">${d.result_summary.ongoing}</div>
          <div style="font-size:11px; color:#b45309;">진행중</div>
        </div>
        <div style="flex:1; padding:12px; background:#fee2e2; border-radius:10px;">
          <div style="font-size:22px; font-weight:800; color:#dc2626;">${d.result_summary.issue}</div>
          <div style="font-size:11px; color:#b91c1c;">미완/보류</div>
        </div>
      </div>
    </div>` : ''}

    <!-- 출퇴근 현황 -->
    ${d.attendance.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#128339; 출퇴근 현황</div>
      ${d.attendance.map(a => {
        const cin = a.check_in ? new Date(a.check_in).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '-';
        const cout = a.check_out ? new Date(a.check_out).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '-';
        const hrs = (a.check_in && a.check_out) ? ((new Date(a.check_out) - new Date(a.check_in)) / 3600000).toFixed(1) : '-';
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid var(--gray-100); font-size:13px;">
            <span>${a.date}</span>
            <span>출근 ${cin} | 퇴근 ${cout} | ${hrs}h ${a.status === 'late' ? '<span style="color:#dc2626;">지각</span>' : ''}</span>
          </div>`;
      }).join('')}
    </div>` : ''}

    <!-- 할 일 현황 -->
    ${d.todos.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#9745; 할 일 현황 <span style="font-size:12px; color:var(--gray-400); font-weight:400;">${d.todos.filter(t=>t.done).length}/${d.todos.length} 완료</span></div>
      ${d.todos.map(t => `
        <div style="padding:5px 0; font-size:13px; ${t.done ? 'text-decoration:line-through; color:var(--gray-400);' : ''}">
          ${t.done ? '&#9989;' : '&#11036;'} ${escHtml(t.title)} <span style="font-size:11px; color:var(--gray-400);">${t.due_date}</span>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 이슈 & 특이사항 -->
    ${d.issues.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#9888;&#65039; 이슈 & 특이사항</div>
      ${d.issues.map(i => `
        <div style="padding:8px 10px; margin-bottom:6px; background:#fef2f2; border-radius:8px; border-left:3px solid #ef4444;">
          <div style="font-size:12px; font-weight:600; color:#b91c1c;">${escHtml(i.task)} <span style="color:var(--gray-400); font-weight:400;">${i.date}</span></div>
          <div style="font-size:12px; color:#7f1d1d; margin-top:2px;">${escHtml(i.issue)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 비고 -->
    ${d.notes.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px;">&#128221; 비고</div>
      ${d.notes.map(n => `
        <div style="padding:8px 10px; margin-bottom:6px; background:#fff7ed; border-radius:8px; border-left:3px solid #f97316;">
          <div style="font-size:12px; font-weight:600; color:#c2410c;">${escHtml(n.task)} <span style="color:var(--gray-400); font-weight:400;">${n.date}</span></div>
          <div style="font-size:12px; color:#7c2d12; margin-top:2px;">${escHtml(n.note)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <div style="text-align:center; padding:16px 0; font-size:12px; color:var(--gray-400);">
      &#128203; ${d.weekLabel} 주간 보고서 | ${escHtml(d.user.name)} ${d.user.position ? '('+escHtml(d.user.position)+')' : ''}
    </div>
  `;
}

// ─── 업무 캘린더 ───
let workCalMonth = new Date().toISOString().substring(0, 7);

async function showWorkCalendar() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">캘린더 로딩 중...</p>';

  const d = await api(`/api/calendar?month=${workCalMonth}`);
  if (!d) return;

  const [year, mon] = workCalMonth.split('-').map(Number);
  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const dayNames = ['일','월','화','수','목','금','토'];
  const firstDay = new Date(year, mon - 1, 1).getDay();
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  let calCells = '';
  for (let i = 0; i < firstDay; i++) calCells += '<div class="cal-cell cal-empty"></div>';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const info = d.days[dateStr];
    const isToday = dateStr === today;
    const dow = new Date(year, mon - 1, day).getDay();
    const isSun = dow === 0;
    const isSat = dow === 6;

    let dots = '';
    if (info) {
      if (info.reports.length) dots += '<span class="cal-dot" style="background:#2563eb;"></span>';
      if (info.attendance) dots += '<span class="cal-dot" style="background:#10b981;"></span>';
      if (info.todos.length) dots += '<span class="cal-dot" style="background:#f59e0b;"></span>';
      if (info.events.length) dots += '<span class="cal-dot" style="background:#ec4899;"></span>';
    }

    calCells += `
      <div class="cal-cell ${isToday ? 'cal-today' : ''} ${info ? 'cal-has-data' : ''}"
           onclick="showCalDay('${dateStr}')" style="cursor:${info ? 'pointer' : 'default'};">
        <span class="cal-day-num ${isSun ? 'cal-sun' : ''} ${isSat ? 'cal-sat' : ''}">${day}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
  }

  document.getElementById('mainContent').innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
      <button class="btn btn-outline btn-sm" onclick="workCalMonth=prevMonth(workCalMonth); showWorkCalendar();">&lsaquo;</button>
      <span style="font-size:18px; font-weight:800;">${year}년 ${monthNames[mon-1]}</span>
      <button class="btn btn-outline btn-sm" onclick="workCalMonth=nextMonth(workCalMonth); showWorkCalendar();">&rsaquo;</button>
    </div>

    <div style="margin-bottom:10px; display:flex; justify-content:center; gap:12px; font-size:11px; color:var(--gray-500);">
      <span><span class="cal-dot-legend" style="background:#2563eb;"></span> 업무일지</span>
      <span><span class="cal-dot-legend" style="background:#10b981;"></span> 출근</span>
      <span><span class="cal-dot-legend" style="background:#f59e0b;"></span> 할 일</span>
      <span><span class="cal-dot-legend" style="background:#ec4899;"></span> 일정</span>
    </div>

    <div class="cal-grid">
      ${dayNames.map((dn, i) => `<div class="cal-header ${i===0?'cal-sun':''} ${i===6?'cal-sat':''}">${dn}</div>`).join('')}
      ${calCells}
    </div>

    <div id="calDayDetail"></div>
  `;
}

function showCalDay(dateStr) {
  api(`/api/calendar?month=${dateStr.substring(0,7)}`).then(d => {
    if (!d) return;
    const info = d.days[dateStr];
    const el = document.getElementById('calDayDetail');
    if (!el) return;

    if (!info) { el.innerHTML = ''; return; }

    const [y, m, day] = dateStr.split('-');
    let html = `
      <div class="card" style="padding:14px; margin-top:16px;">
        <div style="font-size:15px; font-weight:700; margin-bottom:12px;">
          &#128197; ${parseInt(m)}월 ${parseInt(day)}일 활동
        </div>`;

    if (info.reports.length) {
      html += `<div style="margin-bottom:12px;">
        <div style="font-size:13px; font-weight:600; color:#2563eb; margin-bottom:6px;">&#128221; 업무일지 (${info.reports.length}건)</div>
        ${info.reports.map(r => `
          <div class="list-item" onclick="viewReport(${r.id})" style="cursor:pointer; padding:8px;">
            <div class="list-item-content">
              <div class="list-item-title">${escHtml(r.task || '업무')}</div>
              <div class="list-item-sub">${escHtml(r.category || '')} ${r.result ? '| ' + escHtml(r.result) : ''}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
    }

    if (info.attendance) {
      const a = info.attendance;
      const cin = a.check_in ? new Date(a.check_in).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'}) : '-';
      const cout = a.check_out ? new Date(a.check_out).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'}) : '-';
      html += `<div style="margin-bottom:12px;">
        <div style="font-size:13px; font-weight:600; color:#10b981; margin-bottom:6px;">&#128339; 출퇴근</div>
        <div style="padding:8px; background:var(--gray-50); border-radius:8px; font-size:13px;">
          출근: ${cin} &nbsp;|&nbsp; 퇴근: ${cout}
          ${a.status === 'late' ? ' <span style="color:#dc2626; font-size:11px;">지각</span>' : ''}
        </div>
      </div>`;
    }

    if (info.todos.length) {
      html += `<div style="margin-bottom:12px;">
        <div style="font-size:13px; font-weight:600; color:#f59e0b; margin-bottom:6px;">&#9745; 할 일 (${info.todos.length}건)</div>
        ${info.todos.map(t => `
          <div style="padding:6px 8px; font-size:13px; ${t.done ? 'text-decoration:line-through; color:var(--gray-400);' : ''}">
            ${t.done ? '&#9989;' : '&#11036;'} ${escHtml(t.title)}
          </div>
        `).join('')}
      </div>`;
    }

    if (info.events.length) {
      html += `<div style="margin-bottom:12px;">
        <div style="font-size:13px; font-weight:600; color:#ec4899; margin-bottom:6px;">&#128197; 팀 일정 (${info.events.length}건)</div>
        ${info.events.map(e => `
          <div style="padding:6px 8px; font-size:13px;">
            &#128204; ${escHtml(e.title)} <span style="font-size:11px; color:var(--gray-400);">${escHtml(e.type || '')}</span>
          </div>
        `).join('')}
      </div>`;
    }

    html += '</div>';
    el.innerHTML = html;
  });
}

// ─── 업무 인수인계 ───
async function showHandover() {
  const fab = document.getElementById('fabBtn'); fab.style.display = 'none';
  document.getElementById('mainContent').innerHTML = '<p style="text-align:center; padding:60px 0; color:var(--gray-500);">인수인계 문서 생성 중...</p>';

  const d = await api('/api/handover');
  if (!d) return;

  if (d.empty) {
    document.getElementById('mainContent').innerHTML = `
      <div style="text-align:center; padding:60px 20px;">
        <div style="font-size:48px; margin-bottom:16px;">&#128196;</div>
        <p style="font-size:16px; font-weight:600; color:var(--gray-600); margin-bottom:8px;">인수인계 문서를 생성할 수 없습니다</p>
        <p style="font-size:13px; color:var(--gray-400);">작성된 업무일지가 없습니다. 업무일지를 먼저 작성해주세요.</p>
      </div>`;
    return;
  }

  const u = d.user;
  const today = new Date().toISOString().split('T')[0];

  document.getElementById('mainContent').innerHTML = `
    <!-- 문서 헤더 -->
    <div class="card" style="padding:16px; margin-bottom:16px; background:linear-gradient(135deg, #1e3a5f, #2563eb); color:#fff; border-radius:12px;">
      <div style="text-align:center;">
        <div style="font-size:22px; font-weight:800; margin-bottom:4px;">&#128196; 업무 인수인계 문서</div>
        <div style="font-size:12px; opacity:0.8;">Work Handover Document</div>
      </div>
      <div style="margin-top:14px; padding:12px; background:rgba(255,255,255,0.15); border-radius:8px; font-size:13px; line-height:1.8;">
        <div><b>&#128100; 작성자:</b> ${escHtml(u.name)} ${u.position ? '('+escHtml(u.position)+')' : ''}</div>
        <div><b>&#128197; 작성일:</b> ${today}</div>
        <div><b>&#128338; 업무기간:</b> ${d.period.from} ~ ${d.period.to}</div>
        <div><b>&#128221; 총 보고서:</b> ${d.total_reports}건</div>
      </div>
    </div>

    <!-- 1. 담당 업무 개요 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#2563eb; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">1</span>
        담당 업무 개요
      </div>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:10px;">업무 카테고리별 비중</p>
      ${d.categories.map(c => `
        <div style="margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:3px;">
            <span style="font-weight:600;">${escHtml(c.name)}</span>
            <span style="color:var(--gray-500);">${c.count}건 (${c.pct}%)</span>
          </div>
          <div style="height:6px; background:var(--gray-100); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${c.pct}%; background:#2563eb; border-radius:3px;"></div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 2. 핵심 업무 상세 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#dc2626; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">2</span>
        핵심 업무 상세
      </div>
      ${d.core_tasks.map((t, i) => `
        <div style="padding:10px; margin-bottom:8px; background:${i < 3 ? '#fef3c7' : 'var(--gray-50)'}; border-radius:8px; border-left:3px solid ${i < 3 ? '#f59e0b' : 'var(--gray-300)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:14px; font-weight:700;">${i < 3 ? '&#11088;' : '&#8226;'} ${escHtml(t.name)}</span>
            <span class="badge" style="background:var(--gray-200); font-size:10px;">${t.count}회</span>
          </div>
          <div style="font-size:12px; color:var(--gray-500); line-height:1.6;">
            ${t.category ? `<span>&#128194; ${escHtml(t.category)}</span> &nbsp;` : ''}
            ${t.places.length ? `<span>&#128205; ${t.places.map(p => escHtml(p)).join(', ')}</span> &nbsp;` : ''}
            ${t.methods.length ? `<span>&#128295; ${t.methods.map(m => escHtml(m)).join(', ')}</span>` : ''}
          </div>
          <div style="font-size:11px; color:var(--gray-400); margin-top:4px;">
            최근: ${t.latestDate} ${t.latestResult ? '| 결과: ' + escHtml(t.latestResult) : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 3. 주요 장소/거래처 -->
    ${d.places.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#059669; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">3</span>
        주요 장소 / 거래처
      </div>
      ${d.places.map(p => `
        <div style="padding:8px 10px; margin-bottom:6px; background:var(--gray-50); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span style="font-size:13px; font-weight:600;">&#128205; ${escHtml(p.name)}</span>
            ${p.tasks.length ? `<div style="font-size:11px; color:var(--gray-500); margin-top:2px;">${p.tasks.map(t => escHtml(t)).join(', ')}</div>` : ''}
          </div>
          <span style="font-size:12px; color:var(--gray-400);">${p.count}회 방문</span>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 4. 업무 수행 방법 -->
    ${d.methods.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#7c3aed; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">4</span>
        업무 수행 방법
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${d.methods.map(m => `
          <div style="padding:8px 14px; background:var(--gray-50); border-radius:20px; font-size:13px;">
            &#128295; ${escHtml(m.name)} <span style="color:var(--gray-400); font-size:11px;">(${m.count}회)</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <!-- 5. 업무 진행 현황 -->
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#0891b2; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">5</span>
        업무 진행 현황
      </div>
      <div style="display:flex; gap:10px; text-align:center;">
        <div style="flex:1; padding:12px; background:#dcfce7; border-radius:10px;">
          <div style="font-size:22px; font-weight:800; color:#16a34a;">${d.result_summary.complete}</div>
          <div style="font-size:11px; color:#15803d;">완료</div>
        </div>
        <div style="flex:1; padding:12px; background:#fef3c7; border-radius:10px;">
          <div style="font-size:22px; font-weight:800; color:#d97706;">${d.result_summary.ongoing}</div>
          <div style="font-size:11px; color:#b45309;">진행중</div>
        </div>
        <div style="flex:1; padding:12px; background:#fee2e2; border-radius:10px;">
          <div style="font-size:22px; font-weight:800; color:#dc2626;">${d.result_summary.issue}</div>
          <div style="font-size:11px; color:#b91c1c;">미완/보류</div>
        </div>
      </div>
    </div>

    <!-- 6. 주의사항 & 이슈 -->
    ${d.recent_issues.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#dc2626; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">6</span>
        &#9888;&#65039; 주의사항 & 이슈
      </div>
      <p style="font-size:11px; color:var(--gray-400); margin-bottom:8px;">후임자가 반드시 알아야 할 이슈입니다</p>
      ${d.recent_issues.map(issue => `
        <div style="padding:8px 10px; margin-bottom:6px; background:#fef2f2; border-radius:8px; border-left:3px solid #ef4444;">
          <div style="font-size:12px; font-weight:600; color:#b91c1c; margin-bottom:2px;">${escHtml(issue.task)} <span style="color:var(--gray-400); font-weight:400;">${issue.date}</span></div>
          <div style="font-size:12px; color:#7f1d1d;">${escHtml(issue.issue)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 7. 참고사항 & 메모 -->
    ${d.recent_notes.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#ea580c; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">7</span>
        &#128221; 참고사항 & 메모
      </div>
      ${d.recent_notes.map(n => `
        <div style="padding:8px 10px; margin-bottom:6px; background:#fff7ed; border-radius:8px; border-left:3px solid #f97316;">
          <div style="font-size:12px; font-weight:600; color:#c2410c; margin-bottom:2px;">${escHtml(n.task)} <span style="color:var(--gray-400); font-weight:400;">${n.date}</span></div>
          <div style="font-size:12px; color:#7c2d12;">${escHtml(n.note)}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 8. 관련 매뉴얼 -->
    ${d.manuals.length ? `
    <div class="card" style="padding:14px; margin-bottom:16px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="background:#4f46e5; color:#fff; width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:12px;">8</span>
        &#128214; 관련 매뉴얼
      </div>
      ${d.manuals.map(m => `
        <div style="padding:10px; margin-bottom:6px; background:var(--gray-50); border-radius:8px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:4px;">&#128214; ${escHtml(m.title)}</div>
          <div style="font-size:12px; color:var(--gray-600); line-height:1.5; white-space:pre-wrap;">${escHtml((m.content || '').substring(0, 200))}${(m.content || '').length > 200 ? '...' : ''}</div>
        </div>
      `).join('')}
    </div>` : ''}

    <!-- 문서 끝 -->
    <div style="text-align:center; padding:20px 0; font-size:12px; color:var(--gray-400); border-top:1px solid var(--gray-200); margin-top:16px;">
      &#128196; 본 인수인계 문서는 업무일지 ${d.total_reports}건을 기반으로 자동 생성되었습니다.<br>
      생성일: ${today}
    </div>
  `;
}

// ─── 팀 일정 ───
let scheduleMonth = new Date().toISOString().substring(0, 7);

async function showSchedulePage() {
  const events = await api(`/api/events?month=${scheduleMonth}`) || [];
  const typeColors = { '회의': '#3b82f6', '마감': '#ef4444', '행사': '#10b981', '출장': '#f59e0b', '기타': '#6366f1' };
  const today = new Date().toISOString().split('T')[0];

  const [sy, sm] = scheduleMonth.split('-').map(Number);
  const daysInMonth = new Date(sy, sm, 0).getDate();
  const firstDay = new Date(sy, sm - 1, 1).getDay();
  const dayNames = ['일','월','화','수','목','금','토'];

  let calGrid = dayNames.map(d => `<div style="text-align:center; font-size:11px; font-weight:600; color:var(--gray-500); padding:4px 0;">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) calGrid += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${scheduleMonth}-${String(d).padStart(2,'0')}`;
    const dayEvents = events.filter(e => (e.event_date||'').split('T')[0] === ds);
    const isToday = ds === today;
    calGrid += `<div style="min-height:36px; padding:2px; border-radius:6px; ${isToday ? 'background:var(--primary); color:#fff;' : ''} text-align:center; position:relative; cursor:${dayEvents.length ? 'pointer' : 'default'};" ${dayEvents.length ? `onclick="showDayEvents('${ds}')"` : ''}>
      <div style="font-size:12px; font-weight:${isToday ? '700' : '400'};">${d}</div>
      ${dayEvents.length > 0 ? `<div style="display:flex; justify-content:center; gap:2px; margin-top:1px;">${dayEvents.slice(0, 3).map(e => `<div style="width:5px; height:5px; border-radius:50%; background:${isToday ? '#fff' : (e.color || '#3b82f6')};"></div>`).join('')}</div>` : ''}
    </div>`;
  }

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <p class="section-title" style="margin:0;">&#128197; 팀 일정</p>
      <button class="btn btn-primary btn-sm" onclick="showEventForm()">일정 추가</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <button class="btn btn-outline btn-sm" onclick="scheduleMonth=prevMonth(scheduleMonth); showSchedulePage();">&lsaquo;</button>
      <span style="font-size:16px; font-weight:700;">${sy}년 ${sm}월</span>
      <button class="btn btn-outline btn-sm" onclick="scheduleMonth=nextMonth(scheduleMonth); showSchedulePage();">&rsaquo;</button>
    </div>

    <div class="card" style="padding:10px; margin-bottom:16px;">
      <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px;">
        ${calGrid}
      </div>
    </div>

    <p class="section-title">${scheduleMonth} 일정 (${events.length}건)</p>
    ${events.length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center; padding:16px;">이번 달 일정이 없습니다</p>' :
      events.map(e => {
        const eDate = (e.event_date||'').split('T')[0];
        const isAuthor = currentUser && (e.author_id === currentUser.id || currentUser.isAdmin);
        return `
        <div class="card" style="padding:10px; margin-bottom:6px; border-left:3px solid ${e.color || '#3b82f6'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <span style="font-size:10px; padding:1px 6px; border-radius:3px; background:${(e.color||'#3b82f6')}22; color:${e.color||'#3b82f6'}; font-weight:600;">${e.event_type}</span>
                <span style="font-size:12px; color:${eDate === today ? 'var(--primary)' : 'var(--gray-500)'}; font-weight:${eDate === today ? '700' : '400'};">${eDate}${e.event_time ? ' ' + e.event_time : ''}</span>
              </div>
              <div style="font-size:14px; font-weight:600;">${escHtml(e.title)}</div>
              ${e.description ? `<div style="font-size:12px; color:var(--gray-500); margin-top:2px;">${escHtml(e.description)}</div>` : ''}
              <div style="font-size:11px; color:var(--gray-400); margin-top:2px;">${escHtml(e.author_name)}</div>
            </div>
            ${isAuthor ? `<button onclick="deleteEvent('${e.id}')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px; padding:2px; flex-shrink:0;">&times;</button>` : ''}
          </div>
        </div>`;
      }).join('')}
  `;
}

function showDayEvents(date) {
  const cards = document.querySelectorAll('.card[style*="border-left"]');
  for (const card of cards) {
    if (card.textContent.includes(date)) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.boxShadow = '0 0 0 2px var(--primary)';
      setTimeout(() => card.style.boxShadow = '', 2000);
      break;
    }
  }
}

function showEventForm() {
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showSchedulePage()" style="margin-bottom:12px;">&larr; 캘린더</button>
    <p class="section-title">&#128197; 새 일정 등록</p>
    <div class="card" style="padding:14px;">
      <div class="form-group">
        <label>제목</label>
        <input type="text" id="evTitle" class="form-control" placeholder="일정 제목">
      </div>
      <div style="display:flex; gap:8px;">
        <div class="form-group" style="flex:1;">
          <label>날짜</label>
          <input type="date" id="evDate" class="form-control" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group" style="flex:1;">
          <label>시간 (선택)</label>
          <input type="time" id="evTime" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label>유형</label>
        <select id="evType" class="form-control">
          <option value="회의">회의</option>
          <option value="마감">마감</option>
          <option value="행사">행사</option>
          <option value="출장">출장</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div class="form-group">
        <label>설명 (선택)</label>
        <textarea id="evDesc" class="form-control" rows="3" placeholder="일정 설명" style="resize:vertical;"></textarea>
      </div>
      <button class="btn btn-primary btn-block" onclick="submitEvent()">등록</button>
    </div>
  `;
}

async function submitEvent() {
  const title = document.getElementById('evTitle').value.trim();
  const event_date = document.getElementById('evDate').value;
  const event_time = document.getElementById('evTime').value;
  const event_type = document.getElementById('evType').value;
  const description = document.getElementById('evDesc').value.trim();
  if (!title || !event_date) { toast('제목과 날짜를 입력하세요'); return; }
  const res = await api('/api/events', { method: 'POST', body: { title, event_date, event_time, event_type, description } });
  if (res) { toast('일정이 등록되었습니다'); showSchedulePage(); }
}

async function deleteEvent(id) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  const res = await api(`/api/events/${id}`, { method: 'DELETE' });
  if (res) { toast('삭제되었습니다'); showSchedulePage(); }
}

// ─── 팀 게시판 ───
let boardCategory = '';
let boardPage = 1;

async function showBoard(pg) {
  boardPage = pg || 1;
  const posts = await api(`/api/board${boardCategory ? '?category=' + encodeURIComponent(boardCategory) : ''}`) || [];
  const { data, page, totalPages, total } = paginate(posts, boardPage);
  const cats = ['전체', '자유', '질문', '정보공유', '건의'];
  const catColor = { '자유': '#6366f1', '질문': '#f59e0b', '정보공유': '#10b981', '건의': '#ef4444' };

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <p class="section-title" style="margin:0;">&#128172; 팀 게시판</p>
      <button class="btn btn-primary btn-sm" onclick="showBoardWrite()">글쓰기</button>
    </div>
    <div class="tabs" style="margin-bottom:12px;">
      ${cats.map(c => `<button class="tab ${(c === '전체' && !boardCategory) || c === boardCategory ? 'active' : ''}" onclick="boardCategory='${c === '전체' ? '' : c}'; showBoard(1);">${c}</button>`).join('')}
    </div>
    ${total > 0 ? `<p style="font-size:12px; color:var(--gray-500); margin-bottom:8px;">총 ${total}건</p>` : ''}
    ${data.length === 0 ? '<div class="empty-state"><div class="empty-icon">&#128172;</div><div class="empty-text">게시글이 없습니다</div></div>' :
      data.map(p => `
        <div class="list-item" onclick="showBoardPost('${p.id}')" style="cursor:pointer;">
          <div class="list-item-content">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
              <span style="font-size:10px; padding:1px 6px; border-radius:3px; background:${(catColor[p.category] || '#6366f1')}22; color:${catColor[p.category] || '#6366f1'}; font-weight:600;">${p.category}</span>
            </div>
            <div class="list-item-title">${escHtml(p.title)}</div>
            <div class="list-item-sub">${escHtml(p.author_name)} &middot; ${(p.created_at||'').substring(0,10)} &middot; &#128065;${p.view_count}${p.comment_count > 0 ? ` &middot; <span style="color:var(--primary);">&#128172;${p.comment_count}</span>` : ''}</div>
          </div>
        </div>
      `).join('')}
    ${renderPagination(page, totalPages, 'showBoard')}
  `;
}

function showBoardWrite() {
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showBoard()" style="margin-bottom:12px;">&larr; 목록</button>
    <p class="section-title">&#9997; 새 글 작성</p>
    <div class="card" style="padding:14px;">
      <div class="form-group">
        <label>카테고리</label>
        <select id="bpCategory" class="form-control">
          <option value="자유">자유</option>
          <option value="질문">질문</option>
          <option value="정보공유">정보공유</option>
          <option value="건의">건의</option>
        </select>
      </div>
      <div class="form-group">
        <label>제목</label>
        <input type="text" id="bpTitle" class="form-control" placeholder="제목을 입력하세요">
      </div>
      <div class="form-group">
        <label>내용</label>
        <textarea id="bpContent" class="form-control" rows="8" placeholder="내용을 입력하세요" style="resize:vertical;"></textarea>
      </div>
      <button class="btn btn-primary btn-block" onclick="submitBoardPost()">등록</button>
    </div>
  `;
}

async function submitBoardPost() {
  const category = document.getElementById('bpCategory').value;
  const title = document.getElementById('bpTitle').value.trim();
  const content = document.getElementById('bpContent').value.trim();
  if (!title || !content) { toast('제목과 내용을 입력하세요'); return; }
  const res = await api('/api/board', { method: 'POST', body: { category, title, content } });
  if (res) { toast('게시글이 등록되었습니다'); showBoard(1); }
}

async function showBoardPost(id) {
  const post = await api(`/api/board/${id}`);
  if (!post) return;
  const cmts = post.comments || [];
  const catColor = { '자유': '#6366f1', '질문': '#f59e0b', '정보공유': '#10b981', '건의': '#ef4444' };
  const isAuthor = currentUser && (post.author_id === currentUser.id || currentUser.isAdmin);

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showBoard(${boardPage})" style="margin-bottom:12px;">&larr; 목록</button>
    <div class="card" style="padding:14px;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
        <span style="font-size:11px; padding:2px 8px; border-radius:4px; background:${(catColor[post.category]||'#6366f1')}22; color:${catColor[post.category]||'#6366f1'}; font-weight:600;">${post.category}</span>
        <span style="font-size:11px; color:var(--gray-400);">&#128065; ${post.view_count}</span>
      </div>
      <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">${escHtml(post.title)}</h3>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">${escHtml(post.author_name)} &middot; ${(post.created_at||'').substring(0,16).replace('T',' ')}</p>
      <div style="font-size:14px; line-height:1.8; white-space:pre-wrap;">${escHtml(post.content)}</div>
    </div>

    ${isAuthor ? `<button class="btn btn-danger btn-sm" onclick="deleteBoardPost('${post.id}')" style="margin-top:8px;">삭제</button>` : ''}

    <div class="card" style="margin-top:12px; padding:14px;">
      <p class="card-title" style="margin-bottom:12px;">&#128172; 댓글 (${cmts.length})</p>
      ${cmts.length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center; padding:8px 0;">아직 댓글이 없습니다</p>' :
        cmts.map(c => {
          const isMe = currentUser && (c.author_id === currentUser.id || currentUser.isAdmin);
          return `<div style="padding:8px 0; border-bottom:1px solid var(--gray-100);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:12px; font-weight:600;">${escHtml(c.author_name)}</span>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:11px; color:var(--gray-400);">${(c.created_at||'').substring(0,16).replace('T',' ')}</span>
                ${isMe ? `<button onclick="deleteBoardComment('${c.id}','${post.id}')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:13px; padding:0;">&times;</button>` : ''}
              </div>
            </div>
            <p style="font-size:13px; line-height:1.6; white-space:pre-wrap;">${escHtml(c.content)}</p>
          </div>`;
        }).join('')}
      <div style="display:flex; gap:8px; margin-top:12px;">
        <input type="text" id="boardCommentInput" class="form-control" placeholder="댓글을 입력하세요..." style="flex:1; font-size:13px;" onkeydown="if(event.key==='Enter')postBoardComment('${post.id}')">
        <button class="btn btn-primary btn-sm" onclick="postBoardComment('${post.id}')" style="white-space:nowrap;">등록</button>
      </div>
    </div>
  `;
}

async function postBoardComment(postId) {
  const input = document.getElementById('boardCommentInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) { toast('댓글을 입력하세요'); return; }
  const res = await api(`/api/board/${postId}/comments`, { method: 'POST', body: { content } });
  if (res) { input.value = ''; showBoardPost(postId); }
}

async function deleteBoardComment(commentId, postId) {
  if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
  await api(`/api/board-comments/${commentId}`, { method: 'DELETE' });
  showBoardPost(postId);
}

async function deleteBoardPost(id) {
  if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
  const res = await api(`/api/board/${id}`, { method: 'DELETE' });
  if (res) { toast('삭제되었습니다'); showBoard(1); }
}

// ─── 출퇴근 기록 ───
function calcWorkHours(cin, cout) {
  if (!cin || !cout) return '-';
  const diff = Math.floor((new Date(cout) - new Date(cin)) / 60000);
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}시간 ${m}분`;
}

function doCheckIn() {
  const overlay = document.createElement('div');
  overlay.id = 'checkinOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:340px;color:#222;">
      <div style="font-size:18px;font-weight:700;text-align:center;margin-bottom:20px;">출근 체크</div>
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <button id="ci_office" onclick="selectWorkType('내근')" style="flex:1;padding:16px 0;border-radius:12px;border:2px solid var(--primary);background:#f0f5ff;cursor:pointer;font-size:15px;font-weight:600;color:var(--primary);">
          🏢 내근
        </button>
        <button id="ci_field" onclick="selectWorkType('외근')" style="flex:1;padding:16px 0;border-radius:12px;border:2px solid #e5e7eb;background:#fff;cursor:pointer;font-size:15px;font-weight:600;color:#555;">
          🚗 외근
        </button>
      </div>
      <div id="ci_summary_box" style="display:none;margin-bottom:16px;">
        <input id="ci_summary" type="text" placeholder="외근 업무 요약 (예: 고객사 미팅)" maxlength="100"
          style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;color:#222;background:#fff;">
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('checkinOverlay').remove()" style="flex:1;padding:12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:14px;color:#555;">취소</button>
        <button onclick="submitCheckIn()" style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--primary);color:#fff;cursor:pointer;font-size:14px;font-weight:600;">출근하기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  window._ciWorkType = '내근';
}

function selectWorkType(type) {
  window._ciWorkType = type;
  const office = document.getElementById('ci_office');
  const field = document.getElementById('ci_field');
  const summaryBox = document.getElementById('ci_summary_box');
  if (type === '내근') {
    office.style.borderColor = 'var(--primary)';
    office.style.background = '#f0f5ff';
    office.style.color = 'var(--primary)';
    field.style.borderColor = '#e5e7eb';
    field.style.background = '#fff';
    field.style.color = '#555';
    summaryBox.style.display = 'none';
  } else {
    field.style.borderColor = '#10b981';
    field.style.background = '#f0fdf4';
    field.style.color = '#059669';
    office.style.borderColor = '#e5e7eb';
    office.style.background = '#fff';
    office.style.color = '#555';
    summaryBox.style.display = 'block';
  }
}

async function showTeamAttBoard() {
  const board = await api('/api/attendance/team-board');
  if (!board) return;
  const checked = board.board.filter(b => b.checked_in);
  const notChecked = board.board.filter(b => !b.checked_in);
  const overlay = document.createElement('div');
  overlay.id = 'attBoardOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:20px;width:92%;max-width:380px;color:#222;max-height:80vh;overflow-y:auto;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:18px;font-weight:700;">오늘 출근 현황판</div>
        <div style="margin-top:8px;font-size:14px;font-weight:600;color:var(--primary);">${board.checked_count} / ${board.total}명 출근</div>
        <div style="background:#e5e7eb;border-radius:99px;height:8px;margin-top:8px;overflow:hidden;">
          <div style="background:${board.all_checked ? '#10b981' : 'var(--primary)'};height:100%;width:${Math.round(board.checked_count / board.total * 100)}%;border-radius:99px;"></div>
        </div>
      </div>
      ${checked.length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:13px;font-weight:600;color:#10b981;margin-bottom:8px;">✅ 출근 (${checked.length}명)</div>
          ${checked.map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f0fdf4;border-radius:8px;margin-bottom:4px;">
              <div><span style="font-weight:600;font-size:14px;">${escHtml(c.name)}</span> <span style="font-size:12px;color:#888;">${escHtml(c.position || '')}</span></div>
              <div style="text-align:right;">
                <span style="font-size:12px;font-weight:600;color:${c.work_type === '외근' ? '#059669' : '#2563eb'};">${c.work_type === '외근' ? '🚗외근' : '🏢내근'}</span>
                <span style="font-size:11px;color:#888;margin-left:4px;">${(c.check_in||'').substring(11,16)}</span>
                ${c.work_summary ? `<div style="font-size:11px;color:#666;margin-top:2px;">${escHtml(c.work_summary)}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>` : ''}
      ${notChecked.length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:8px;">⏳ 미출근 (${notChecked.length}명)</div>
          ${notChecked.map(nc => `
            <div style="padding:8px 10px;background:#fef2f2;border-radius:8px;margin-bottom:4px;">
              <span style="font-weight:600;font-size:14px;">${escHtml(nc.name)}</span>
              <span style="font-size:12px;color:#888;margin-left:4px;">${escHtml(nc.position || '')}</span>
            </div>`).join('')}
        </div>` : ''}
      <button onclick="document.getElementById('attBoardOverlay').remove()"
        style="width:100%;padding:12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:14px;color:#555;">닫기</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function submitCheckIn() {
  const workType = window._ciWorkType || '내근';
  const summary = (document.getElementById('ci_summary') || {}).value || '';
  const overlay = document.getElementById('checkinOverlay');
  if (overlay) overlay.remove();
  const res = await api('/api/attendance/check-in', {
    method: 'POST',
    body: { work_type: workType, work_summary: summary }
  });
  if (res) { toast(`출근 완료! (${workType})`); renderHome(); }
}

async function doCheckOut() {
  if (!confirm('퇴근 처리하시겠습니까?')) return;
  const res = await api('/api/attendance/check-out', { method: 'POST' });
  if (res) { toast('퇴근 완료! 수고하셨습니다.'); renderHome(); }
}

let attMonth = new Date().toISOString().substring(0, 7);

async function showAttendancePage() {
  const [history, team] = await Promise.all([
    api(`/api/attendance/history?month=${attMonth}`),
    isManager() ? api('/api/attendance/team') : Promise.resolve([])
  ]);
  const records = history || [];
  const teamToday = team || [];
  const totalDays = records.length;
  const lateDays = records.filter(r => r.status === 'late').length;
  const totalMinutes = records.reduce((s, r) => {
    if (r.check_in && r.check_out) return s + Math.floor((new Date(r.check_out) - new Date(r.check_in)) / 60000);
    return s;
  }, 0);
  const avgH = totalDays > 0 ? Math.floor(totalMinutes / totalDays / 60) : 0;
  const avgM = totalDays > 0 ? Math.floor(totalMinutes / totalDays % 60) : 0;

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 뒤로</button>
    <p class="section-title">&#128339; 출퇴근 기록</p>

    <div class="stats-row" style="margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-number">${totalDays}</div>
        <div class="stat-label">출근일</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" ${lateDays > 0 ? 'style="color:#ef4444;"' : ''}>${lateDays}</div>
        <div class="stat-label">지각</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${avgH}:${String(avgM).padStart(2,'0')}</div>
        <div class="stat-label">평균 근무</div>
      </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <button class="btn btn-outline btn-sm" onclick="attMonth=prevMonth(attMonth); showAttendancePage();">&lsaquo;</button>
      <span style="font-size:15px; font-weight:600;">${attMonth}</span>
      <button class="btn btn-outline btn-sm" onclick="attMonth=nextMonth(attMonth); showAttendancePage();">&rsaquo;</button>
    </div>

    ${records.length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center; padding:16px;">이번 달 출퇴근 기록이 없습니다</p>' :
      records.map(r => `
        <div class="card" style="padding:10px; margin-bottom:4px; ${r.status === 'late' ? 'border-left:3px solid #ef4444;' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:14px; font-weight:600;">${(r.work_date||'').split('T')[0]}</span>
              <span style="font-size:11px; margin-left:4px; color:${r.work_type === '외근' ? '#059669' : '#2563eb'}; font-weight:600;">${r.work_type === '외근' ? '🚗외근' : '🏢내근'}</span>
              ${r.status === 'late' ? '<span style="font-size:10px; color:#ef4444; margin-left:4px; font-weight:600;">지각</span>' : ''}
            </div>
            <div style="font-size:13px; color:var(--gray-500);">
              ${(r.check_in||'').substring(11,16)} ~ ${r.check_out ? (r.check_out||'').substring(11,16) : '--:--'}
              <span style="margin-left:6px; font-weight:600; color:var(--gray-700);">${r.check_out ? calcWorkHours(r.check_in, r.check_out) : '근무중'}</span>
            </div>
          </div>
          ${r.work_summary ? `<div style="font-size:12px; color:var(--gray-500); margin-top:4px; padding-left:2px;">${escHtml(r.work_summary)}</div>` : ''}
        </div>
      `).join('')}

    ${isManager() && teamToday.length > 0 ? `
      <p class="section-title" style="margin-top:20px;">&#128101; 오늘 팀 출퇴근 현황</p>
      ${teamToday.map(t => `
        <div class="card" style="padding:10px; margin-bottom:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-weight:600; font-size:14px;">${escHtml(t.user_name)}</span>
              <span style="font-size:12px; color:var(--gray-500); margin-left:4px;">${escHtml(t.position || '')}</span>
              <span style="font-size:11px; margin-left:4px; font-weight:600; color:${t.work_type === '외근' ? '#059669' : '#2563eb'};">${t.work_type === '외근' ? '🚗외근' : '🏢내근'}</span>
              ${t.status === 'late' ? '<span style="font-size:10px; color:#ef4444; margin-left:4px;">지각</span>' : ''}
            </div>
            <div style="font-size:12px; color:var(--gray-500);">
              ${(t.check_in||'').substring(11,16)} ${t.check_out ? '~ ' + (t.check_out||'').substring(11,16) : '<span style="color:var(--success);">근무중</span>'}
            </div>
          </div>
          ${t.work_summary ? `<div style="font-size:11px; color:var(--gray-500); margin-top:4px;">${escHtml(t.work_summary)}</div>` : ''}
        </div>
      `).join('')}
    ` : ''}
  `;
}

function prevMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return d.toISOString().substring(0, 7);
}
function nextMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return d.toISOString().substring(0, 7);
}

// ─── 알림 센터 ───
async function showNotifications() {
  const items = await api('/api/notifications') || [];
  const typeIcon = { comment: '&#128172;', approval: '&#9989;', notice: '&#128227;', todo: '&#9888;&#65039;' };
  const typeColor = { comment: '#3b82f6', approval: '#10b981', notice: '#f59e0b', todo: '#ef4444' };
  const typeLabel = { comment: '댓글', approval: '결재', notice: '공지', todo: '할 일' };

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('home')" style="margin-bottom:12px;">&larr; 홈으로</button>
    <p class="section-title">&#128276; 알림 센터</p>
    ${items.length === 0 ? '<div class="empty-state"><div class="empty-icon">&#128276;</div><div class="empty-text">새로운 알림이 없습니다</div></div>' :
      items.map(n => `
        <div class="card" style="padding:10px; margin-bottom:6px; cursor:pointer; border-left:3px solid ${typeColor[n.type]};" onclick="${notiAction(n)}">
          <div style="display:flex; align-items:flex-start; gap:10px;">
            <span style="font-size:18px; flex-shrink:0; margin-top:2px;">${typeIcon[n.type]}</span>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <span style="font-size:10px; padding:1px 6px; border-radius:3px; background:${typeColor[n.type]}22; color:${typeColor[n.type]}; font-weight:600;">${typeLabel[n.type]}</span>
                <span style="font-size:11px; color:var(--gray-400);">${formatNotiTime(n.time)}</span>
              </div>
              <div style="font-size:13px; font-weight:600;">${escHtml(n.title)}</div>
              ${n.detail ? `<div style="font-size:12px; color:var(--gray-500); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(n.detail)}</div>` : ''}
              ${n.sub ? `<div style="font-size:11px; color:var(--gray-400); margin-top:2px;">${escHtml(n.sub)}</div>` : ''}
            </div>
          </div>
        </div>
      `).join('')}
  `;
  localStorage.setItem('lastNotiCheck', new Date().toISOString());
  const badge = document.getElementById('notiBadge');
  if (badge) badge.style.display = 'none';
}

function notiAction(n) {
  if (n.type === 'comment' || n.type === 'approval') return `viewReport('${n.report_id}')`;
  if (n.type === 'notice') return `showNoticeDetail('${n.notice_id}')`;
  if (n.type === 'todo') return `showTodoPage()`;
  return '';
}

function formatNotiTime(t) {
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return '방금';
  if (diff < 60) return `${diff}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  if (diff < 10080) return `${Math.floor(diff / 1440)}일 전`;
  return t.substring(0, 10);
}

async function checkNotiCount() {
  try {
    const items = await api('/api/notifications');
    if (!items || items.length === 0) return;
    const lastCheck = localStorage.getItem('lastNotiCheck');
    const badge = document.getElementById('notiBadge');
    if (!badge) return;
    if (lastCheck) {
      const newCount = items.filter(n => new Date(n.time) > new Date(lastCheck)).length;
      badge.style.display = newCount > 0 ? 'block' : 'none';
    } else {
      badge.style.display = items.length > 0 ? 'block' : 'none';
    }
  } catch (e) {}
}

// ─── 할 일 관리 ───
async function quickAddTodo() {
  const input = document.getElementById('homeQuickTodo');
  if (!input) return;
  const title = input.value.trim();
  if (!title) { toast('할 일을 입력하세요'); return; }
  const res = await api('/api/todos', { method: 'POST', body: { title } });
  if (res) { toast('추가됨'); renderHome(); }
}

async function toggleTodoHome(id, completed) {
  await api(`/api/todos/${id}`, { method: 'PUT', body: { completed } });
  renderHome();
}

let todoShowDone = false;

async function showTodoPage() {
  const todos = await api(`/api/todos?done=${todoShowDone ? '1' : '0'}`) || [];
  const today = new Date().toISOString().split('T')[0];
  const pending = todos.filter(t => !t.completed);
  const done = todos.filter(t => t.completed);
  const pDot = { high: '#ef4444', normal: '#3b82f6', low: '#9ca3af' };
  const pLabel = { high: '높음', normal: '보통', low: '낮음' };

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('home')" style="margin-bottom:12px;">&larr; 홈으로</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <p class="section-title" style="margin:0;">&#9745; 할 일 관리</p>
      <span style="font-size:13px; color:var(--gray-500);">${pending.length}개 남음</span>
    </div>

    <div class="card" style="padding:12px; margin-bottom:16px;">
      <p style="font-weight:600; margin-bottom:8px; font-size:14px;">새 할 일</p>
      <div class="form-group">
        <input type="text" id="todoTitle" class="form-control" placeholder="할 일 내용">
      </div>
      <div class="form-group">
        <input type="text" id="todoMemo" class="form-control" placeholder="메모 (선택)">
      </div>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <select id="todoPriority" class="form-control" style="font-size:13px;">
            <option value="normal">보통</option>
            <option value="high">높음</option>
            <option value="low">낮음</option>
          </select>
        </div>
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <input type="date" id="todoDue" class="form-control" style="font-size:13px;">
        </div>
      </div>
      <button class="btn btn-primary btn-block" onclick="addTodo()">추가</button>
    </div>

    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <button class="btn ${!todoShowDone ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="todoShowDone=false; showTodoPage();">진행중 (${pending.length})</button>
      <button class="btn ${todoShowDone ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="todoShowDone=true; showTodoPage();">완료 포함</button>
    </div>

    ${pending.length === 0 && !todoShowDone ? '<div class="empty-state"><div class="empty-icon">&#127881;</div><div class="empty-text">할 일을 모두 완료했습니다!</div></div>' : ''}

    ${pending.map(t => {
      const overdue = t.due_date && (t.due_date.split('T')[0] < today);
      return `
      <div class="card" style="padding:10px; margin-bottom:6px; ${overdue ? 'border-left:3px solid #ef4444;' : ''}">
        <div style="display:flex; align-items:flex-start; gap:10px;">
          <input type="checkbox" onchange="toggleTodo('${t.id}', true)" style="width:20px; height:20px; margin-top:2px; cursor:pointer; accent-color:var(--primary); flex-shrink:0;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
              <span style="font-size:10px; padding:1px 6px; border-radius:3px; background:${pDot[t.priority]}22; color:${pDot[t.priority]}; font-weight:600;">${pLabel[t.priority]}</span>
              ${overdue ? '<span style="font-size:10px; color:#ef4444; font-weight:600;">지연</span>' : ''}
            </div>
            <div style="font-size:14px; font-weight:500;">${escHtml(t.title)}</div>
            ${t.memo ? `<div style="font-size:12px; color:var(--gray-500); margin-top:2px;">${escHtml(t.memo)}</div>` : ''}
            ${t.due_date ? `<div style="font-size:11px; color:${overdue ? '#ef4444' : 'var(--gray-500)'}; margin-top:2px;">마감: ${t.due_date.split('T')[0]}</div>` : ''}
          </div>
          <button onclick="deleteTodo('${t.id}')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px; padding:2px; flex-shrink:0;">&times;</button>
        </div>
      </div>`;
    }).join('')}

    ${todoShowDone && done.length > 0 ? `
      <p class="section-title" style="margin-top:16px;">&#9989; 완료됨 (${done.length}건)</p>
      ${done.map(t => `
        <div class="card" style="padding:10px; margin-bottom:4px; opacity:0.6;">
          <div style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" checked onchange="toggleTodo('${t.id}', false)" style="width:18px; height:18px; cursor:pointer; accent-color:var(--primary); flex-shrink:0;">
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; text-decoration:line-through; color:var(--gray-400);">${escHtml(t.title)}</div>
              <div style="font-size:11px; color:var(--gray-400);">${(t.completed_at||'').substring(0,10)} 완료</div>
            </div>
            <button onclick="deleteTodo('${t.id}')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px; padding:2px;">&times;</button>
          </div>
        </div>
      `).join('')}
    ` : ''}
  `;
}

async function addTodo() {
  const title = document.getElementById('todoTitle').value.trim();
  if (!title) { toast('할 일을 입력하세요'); return; }
  const memo = document.getElementById('todoMemo').value.trim();
  const priority = document.getElementById('todoPriority').value;
  const due_date = document.getElementById('todoDue').value || null;
  const res = await api('/api/todos', { method: 'POST', body: { title, memo, priority, due_date } });
  if (res) { toast('추가됨'); showTodoPage(); }
}

async function toggleTodo(id, completed) {
  await api(`/api/todos/${id}`, { method: 'PUT', body: { completed } });
  showTodoPage();
}

async function deleteTodo(id) {
  if (!confirm('이 할 일을 삭제하시겠습니까?')) return;
  await api(`/api/todos/${id}`, { method: 'DELETE' });
  showTodoPage();
}

// ─── 공지사항 ───
async function showNoticesList() {
  const notices = await api('/api/notices') || [];
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('home')" style="margin-bottom:12px;">&larr; 홈으로</button>
    <p class="section-title">&#128227; 공지사항 (${notices.length}건)</p>
    ${notices.length === 0 ? '<div class="empty-state"><div class="empty-icon">&#128227;</div><div class="empty-text">등록된 공지사항이 없습니다</div></div>' : notices.map(n => {
      const pColor = { urgent: '#ef4444', important: '#f59e0b', normal: '#3b82f6' };
      const pLabel = { urgent: '긴급', important: '중요', normal: '일반' };
      return `
      <div class="list-item" onclick="showNoticeDetail('${n.id}')" style="cursor:pointer;">
        <div class="list-item-content">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
            ${n.pinned ? '<span style="font-size:10px; background:#ef4444; color:#fff; padding:1px 5px; border-radius:3px;">고정</span>' : ''}
            <span style="font-size:10px; background:${pColor[n.priority] || pColor.normal}22; color:${pColor[n.priority] || pColor.normal}; padding:1px 6px; border-radius:3px; font-weight:600;">${pLabel[n.priority] || '일반'}</span>
          </div>
          <div class="list-item-title">${escHtml(n.title)}</div>
          <div class="list-item-sub">${(n.created_at||'').substring(0,10)} · ${escHtml(n.author_name || '관리자')}</div>
        </div>
      </div>`;
    }).join('')}
  `;
}

async function showNoticeDetail(id) {
  const notices = await api('/api/notices') || [];
  const n = notices.find(x => x.id === id);
  if (!n) { toast('공지사항을 찾을 수 없습니다'); return; }
  const pColor = { urgent: '#ef4444', important: '#f59e0b', normal: '#3b82f6' };
  const pLabel = { urgent: '긴급', important: '중요', normal: '일반' };
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="showNoticesList()" style="margin-bottom:12px;">&larr; 목록으로</button>
    <div class="card" style="padding:16px;">
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
        ${n.pinned ? '<span style="font-size:11px; background:#ef4444; color:#fff; padding:2px 6px; border-radius:4px;">고정</span>' : ''}
        <span style="font-size:11px; background:${pColor[n.priority] || pColor.normal}22; color:${pColor[n.priority] || pColor.normal}; padding:2px 7px; border-radius:4px; font-weight:600;">${pLabel[n.priority] || '일반'}</span>
      </div>
      <h3 style="font-size:18px; font-weight:700; margin-bottom:8px;">${escHtml(n.title)}</h3>
      <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">${(n.created_at||'').substring(0,16).replace('T',' ')} · ${escHtml(n.author_name || '관리자')}</p>
      <div style="font-size:14px; line-height:1.8; white-space:pre-wrap;">${escHtml(n.content)}</div>
    </div>
  `;
}

// ─── 공지사항 관리 (관리자) ───
async function renderAdminNoticesTab() {
  const notices = await api('/api/notices?all=1') || [];
  document.getElementById('adminTabContent').innerHTML = `
    <p class="section-title">공지사항 관리</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:16px;">총 ${notices.length}건 등록됨</p>

    <div class="card" style="padding:12px; margin-bottom:16px;">
      <p style="font-weight:600; margin-bottom:8px;">새 공지 작성</p>
      <div class="form-group">
        <input type="text" id="noticeTitle" class="form-control" placeholder="제목">
      </div>
      <div class="form-group">
        <textarea id="noticeContent" class="form-control" rows="4" placeholder="내용" style="resize:vertical;"></textarea>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <div class="form-group" style="flex:1;">
          <select id="noticePriority" class="form-control">
            <option value="normal">일반</option>
            <option value="important">중요</option>
            <option value="urgent">긴급</option>
          </select>
        </div>
        <label style="display:flex; align-items:center; gap:4px; font-size:13px; cursor:pointer;">
          <input type="checkbox" id="noticePinned"> 상단 고정
        </label>
      </div>
      <button class="btn btn-success btn-block" onclick="createNotice()">공지 등록</button>
    </div>

    <p class="section-title">등록된 공지</p>
    ${notices.length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center;">등록된 공지가 없습니다</p>' : notices.map(n => {
      const pColor = { urgent: '#ef4444', important: '#f59e0b', normal: '#3b82f6' };
      const pLabel = { urgent: '긴급', important: '중요', normal: '일반' };
      return `
      <div class="card" style="padding:10px; margin-bottom:6px; ${!n.active ? 'opacity:0.5;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:4px; margin-bottom:4px; flex-wrap:wrap;">
              ${n.pinned ? '<span style="font-size:10px; background:#ef4444; color:#fff; padding:1px 4px; border-radius:3px;">고정</span>' : ''}
              <span style="font-size:10px; background:${pColor[n.priority]}22; color:${pColor[n.priority]}; padding:1px 5px; border-radius:3px; font-weight:600;">${pLabel[n.priority]}</span>
              ${!n.active ? '<span style="font-size:10px; color:#999;">비활성</span>' : '<span style="font-size:10px; color:var(--success);">게시중</span>'}
            </div>
            <div style="font-weight:600; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(n.title)}</div>
            <div style="font-size:11px; color:var(--gray-500);">${(n.created_at||'').substring(0,10)}</div>
          </div>
          <div style="display:flex; gap:4px; flex-shrink:0; margin-left:8px;">
            <button class="btn btn-outline btn-sm" onclick="toggleNoticeActive('${n.id}', ${!n.active})" style="font-size:11px; padding:3px 8px;">${n.active ? '숨김' : '게시'}</button>
            <button class="btn btn-sm" onclick="deleteNotice('${n.id}')" style="font-size:11px; padding:3px 8px; color:var(--danger); border:1px solid var(--danger);">삭제</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  `;
}

async function createNotice() {
  const title = document.getElementById('noticeTitle').value.trim();
  const content = document.getElementById('noticeContent').value.trim();
  const priority = document.getElementById('noticePriority').value;
  const pinned = document.getElementById('noticePinned').checked;
  if (!title || !content) { toast('제목과 내용을 입력하세요'); return; }
  const res = await api('/api/notices', { method: 'POST', body: { title, content, priority, pinned } });
  if (res) { toast('공지가 등록되었습니다'); renderAdminNoticesTab(); }
}

async function toggleNoticeActive(id, active) {
  const res = await api(`/api/notices/${id}`, { method: 'PUT', body: { active } });
  if (res) { toast(active ? '공지가 게시되었습니다' : '공지가 숨김 처리되었습니다'); renderAdminNoticesTab(); }
}

async function deleteNotice(id) {
  if (!confirm('이 공지를 삭제하시겠습니까?')) return;
  const res = await api(`/api/notices/${id}`, { method: 'DELETE' });
  if (res) { toast('공지가 삭제되었습니다'); renderAdminNoticesTab(); }
}

// ─── FAB 메뉴 ───
function showFabMenu() {
  document.getElementById('fabMenu').style.display = 'block';
  document.getElementById('fabOverlay').style.display = 'block';
  document.getElementById('fabBtn').style.transform = 'rotate(45deg)';
}
function closeFabMenu() {
  document.getElementById('fabMenu').style.display = 'none';
  document.getElementById('fabOverlay').style.display = 'none';
  document.getElementById('fabBtn').style.transform = '';
}

// ─── 음성 녹음 업무일지 ───
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let _vrRecog = null;
let _vrFinalText = '';
let _vrInterim = '';
let _vrProcessed = 0;

function startVoiceReport() {
  if (!SpeechRecognition) { toast('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari를 사용해주세요.'); return; }

  const screen = document.getElementById('voiceRecordScreen');
  screen.style.display = 'flex';
  _vrFinalText = '';
  _vrInterim = '';
  _vrProcessed = 0;
  document.getElementById('vrText').textContent = '듣고 있습니다...';
  document.getElementById('vrTitle').textContent = '업무 내용을 말씀해 주세요';

  const recog = new SpeechRecognition();
  recog.lang = 'ko-KR';
  recog.interimResults = true;
  recog.continuous = false;
  recog.maxAlternatives = 1;
  _vrRecog = recog;

  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        _vrFinalText += e.results[i][0].transcript + ' ';
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    _vrInterim = interim;
    const display = (_vrFinalText + interim).trim() || '듣고 있습니다...';
    document.getElementById('vrText').textContent = display;
  };

  recog.onend = () => {
    if (_vrRecog) {
      try { _vrRecog.start(); } catch(e) {}
    }
  };

  recog.onerror = (e) => {
    if (e.error === 'not-allowed') {
      toast('마이크 권한을 허용해주세요');
      cancelVoiceReport();
    } else if (e.error === 'no-speech') {
      document.getElementById('vrTitle').textContent = '소리가 감지되지 않았습니다. 다시 말씀해 주세요.';
    }
  };

  recog.start();
}

function cancelVoiceReport() {
  if (_vrRecog) { const r = _vrRecog; _vrRecog = null; r.stop(); }
  document.getElementById('voiceRecordScreen').style.display = 'none';
  document.getElementById('vrRefineStep').style.display = 'none';
  document.getElementById('vrRecordingBtns').style.display = 'flex';
  document.getElementById('vrMicIcon').style.animation = 'vrPulse 1.5s infinite';
  document.getElementById('vrMicIcon').style.background = '#7c3aed';
}

function finishVoiceReport() {
  if (_vrRecog) { const r = _vrRecog; _vrRecog = null; r.stop(); }

  const text = (_vrFinalText + _vrInterim).trim();
  if (!text) { toast('음성이 인식되지 않았습니다'); cancelVoiceReport(); return; }

  localStorage.setItem('voiceCache', text);

  document.getElementById('vrRecordingBtns').style.display = 'none';
  document.getElementById('vrMicIcon').style.animation = 'none';
  document.getElementById('vrMicIcon').style.background = '#4a4a6a';
  document.getElementById('vrTitle').textContent = '음성 인식 완료';
  document.getElementById('vrText').textContent = text;
  document.getElementById('vrRawText').textContent = text;
  document.getElementById('vrRefinedText').value = text;
  document.getElementById('vrRefinePreview').style.display = 'none';
  document.getElementById('vrRefineStep').style.display = 'block';
}

function refineVoiceText() {
  const btn = document.getElementById('vrRefineBtn');
  btn.textContent = '정제 중...';
  btn.disabled = true;

  const raw = document.getElementById('vrRefinedText').value.trim();
  if (!raw) { toast('텍스트가 없습니다'); btn.textContent = '✨ 글다듬기'; btn.disabled = false; return; }

  setTimeout(() => {
    const refined = polishVoiceText(raw);
    document.getElementById('vrRefinedText').value = refined;

    const preview = previewVoice5W1H(refined);
    const fieldsDiv = document.getElementById('vrRefineFields');
    fieldsDiv.innerHTML = preview;
    document.getElementById('vrRefinePreview').style.display = 'block';

    btn.textContent = '✨ 글다듬기';
    btn.disabled = false;
    toast('텍스트 정제 완료! 내용을 확인해주세요');
  }, 300);
}

function polishVoiceText(text) {
  let t = text;

  // 1. 기본 정리
  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/(.)\1{3,}/g, '$1$1');

  // 2. 구어체 필러/군더더기 제거
  const fillers = [
    '그래서', '그리고', '그런데', '근데', '그래가지고', '그래갖고', '그러니까', '그니까',
    '어', '음', '아', '뭐', '저기', '있잖아', '있잖아요', '말이야', '말이에요',
    '이제', '인제', '막', '약간', '좀', '한번', '일단', '아무튼', '어쨌든',
    '진짜', '진짜로', '정말', '정말로', '되게', '엄청', '완전', '너무',
    '이거', '저거', '그거', '뭐냐면', '뭐냐하면', '어떻게보면',
    '사실은', '사실', '솔직히', '기본적으로', '원래', '원래는',
    '그냥', '걍', '뭐랄까', '어떻게', '아니', '아니요', '네',
    '예', '응', '잠깐', '잠시만', '다시', '다시말하면',
    '이런식으로', '그런식으로', '어찌됐든', '하여튼', '아무래도',
    '제가생각하기에', '내생각에는', '생각해보면', '보면은', '하면은',
    '같은경우에는', '같은경우는', '경우에는'
  ];
  const fillerRe = new RegExp('(?:^|\\s)(?:' + fillers.join('|') + ')(?:\\s|$)', 'gi');
  t = t.replace(fillerRe, ' ');
  t = t.replace(fillerRe, ' ');
  t = t.replace(/\s{2,}/g, ' ').trim();

  // 3. 구어체 문장 분리 (어미 기준)
  const splitEndings = [
    /([가-힣]+(?:했|됐|었|였|겠)(?:고|구))\s/g,
    /([가-힣]+(?:하고|되고|나서|해서|돼서|갔는데|왔는데|했는데|인데|은데|는데))\s/g,
    /([가-힣]+(?:니까|으니까|서요|거든요|잖아요|거든|잖아))\s/g,
    /([가-힣]+(?:다가|하다가|하면서|되면서|으면서))\s/g
  ];
  for (const re of splitEndings) {
    t = t.replace(re, '$1. ');
  }

  // 4. 구어체 → 문어체 변환
  const styleMap = [
    [/했거든요?/g, '했습니다'],
    [/했잖아요?/g, '했습니다'],
    [/인데요/g, '입니다'],
    [/거든요/g, '습니다'],
    [/잖아요/g, '습니다'],
    [/해야\s*돼요?/g, '해야 합니다'],
    [/해야\s*되요?/g, '해야 합니다'],
    [/해야\s*해요?/g, '해야 합니다'],
    [/할\s*거예요/g, '할 예정입니다'],
    [/할\s*거에요/g, '할 예정입니다'],
    [/할\s*건데/g, '할 예정이며'],
    [/하려고요?/g, '하려고 합니다'],
    [/하려구요?/g, '하려고 합니다'],
    [/했어요/g, '했습니다'],
    [/했어/g, '했습니다'],
    [/됐어요/g, '되었습니다'],
    [/됐어/g, '되었습니다'],
    [/갔어요/g, '갔습니다'],
    [/왔어요/g, '왔습니다'],
    [/봤어요/g, '보았습니다'],
    [/해요/g, '합니다'],
    [/돼요/g, '됩니다'],
    [/줘요/g, '주세요'],
    [/같아요/g, '같습니다'],
    [/있어요/g, '있습니다'],
    [/없어요/g, '없습니다'],
    [/모르겠어요/g, '모르겠습니다'],
    [/갈게요/g, '가겠습니다'],
    [/할게요/g, '하겠습니다'],
    [/볼게요/g, '보겠습니다']
  ];
  for (const [from, to] of styleMap) {
    t = t.replace(from, to);
  }

  // 5. 문장 분리 및 정리
  t = t.replace(/([.!?])\s*/g, '$1 ').trim();
  if (!/[.!?]/.test(t)) {
    t = t.replace(/(합니다|입니다|됩니다|겠습니다|있습니다|없습니다|했습니다|되었습니다|예정입니다)/g, '$1.');
  }
  let sentences = t.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 1);
  if (sentences.length === 0) sentences = [t];

  const cleaned = sentences.map(s => {
    s = s.trim();
    s = s.replace(/^\s*(그리고|그래서|그런데|근데|그래갖고|그래가지고|또)\s*/i, '');
    if (s && !/[.!?]$/.test(s)) s += '.';
    if (s.length > 1) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  }).filter(s => s.length > 2);

  if (cleaned.length === 0) return t;
  let result = cleaned.join(' ');

  // 6. 맥락 기반 5W1H 추출
  const whoPatterns = [
    /([가-힣]{2,4})\s*(?:님|씨|과장|대리|차장|부장|팀장|사원|주임|매니저|선임|책임|본부장|이사|담당|사장|상무|전무)/,
    /(?:제가|내가|본인이|저희|우리|우리팀|우리\s*팀이|담당자가)/,
    /([가-힣]{2,3})(?:이가|이|가)\s+(?:가|와|만나|방문|전화|보고|작성|처리|확인|검토)/
  ];
  const whenPatterns = [
    /(\d{1,2}월\s*\d{1,2}일)\s*(?:(?:오전|오후)\s*)?(?:\d{1,2}시)?/,
    /(?:오전|오후)\s*\d{1,2}시\s*(?:\d{1,2}분|반)?/,
    /\d{1,2}시\s*(?:\d{1,2}분|반)?(?:에|까지|부터)?/,
    /(?:어제|오늘|내일|모레|그저께|아까|방금)/,
    /(?:이번|지난|다음)\s*(?:주|달|월)\s*(?:월|화|수|목|금|토|일)?요?일?/,
    /(?:월|화|수|목|금|토|일)요일/,
    /(?:오전|오후|아침|점심|저녁|낮)(?:에|때|쯤)?/
  ];
  const wherePatterns = [
    /(충청[남북]?도?|경기도?|서울|부산|대구|인천|광주|대전|울산|세종|경[상남북]+도?|전[라남북]+도?|강원도?|제주도?)\s*[가-힣]{0,6}/,
    /(?:본사|지사|사무실|현장|지국|센터|회의실|연수원|공장|창고|매장|지점|사무소|영업소|출장지|사옥|빌딩|건물|식당|카페|호텔)\s*[가-힣]{0,4}/,
    /[가-힣]{1,10}(?:지국|센터|지사|사무소|영업소|지점|매장|현장|회의실|사옥|빌딩|호텔|카페)/,
    /(?:거기|그쪽|이쪽|저쪽|우리\s*회사|그\s*회사|상대\s*회사|고객사|협력사|거래처)\s*[가-힣]{0,4}/
  ];
  const whatPatterns = [
    /(?:인수인계|보고서\s*작성|회의|미팅|점검|교육|상담|접수|처리|확인|검토|작성|발송|정리|분석|세미나|연수|파견|조사|설명회|감사|계약|협의|영업|배송|수거|설치|수리|유지보수|AS|면담|발표|프레젠테이션|제안|견적|입찰|시연|데모|테스트|시험|평가|심사|승인)\s*[가-힣]{0,8}/,
    /(?:방문|출장|파견|외출|외근|출근|퇴근)\s*[가-힣]{0,6}/,
    /[가-힣]{2,6}(?:업무|작업|일|프로젝트|과제|태스크)/
  ];
  const howPatterns = [
    /(?:전화|이메일|대면|온라인|직접|팩스|문자|카톡|카카오톡|메신저|줌|화상|비대면|시스템|차량|KTX|비행기|버스|택시|지하철|자차)\s*(?:로|으로|통해|이용|타고)?\s*[가-힣]{0,4}/,
    /(?:방문하여|출장하여|전화하여|메일로|유선으로|화상으로|대면으로|비대면으로)/
  ];
  const whyPatterns = [
    /[가-힣\s]{2,15}(?:위해서?|위하여|때문에|건으로|관련하여|관련해서|목적으로|차원에서)/,
    /(?:요청|지시|필요|예정|계획|준비|대비|대응|개선|해결)\s*(?:에\s*의해|으로|이\s*있어|을\s*위해|사항)/,
    /[가-힣]{2,8}(?:요청|지시|의뢰|문의|클레임|민원|이슈|문제)(?:가|이|로|에)?\s*(?:있어|들어와|접수|발생)/
  ];

  let who = '', when = '', where = '', what = '', how = '', why = '';
  for (const re of whoPatterns) { if (!who) { const m = result.match(re); if (m) who = m[0].replace(/[가이는은]\s*$/, '').trim(); } }
  for (const re of whenPatterns) { if (!when) { const m = result.match(re); if (m) when = m[0].trim(); } }
  for (const re of wherePatterns) { if (!where) { const m = result.match(re); if (m) where = m[0].trim(); } }
  for (const re of whatPatterns) { if (!what) { const m = result.match(re); if (m) what = m[0].trim(); } }
  for (const re of howPatterns) { if (!how) { const m = result.match(re); if (m) how = m[0].trim(); } }
  for (const re of whyPatterns) { if (!why) { const m = result.match(re); if (m) why = m[0].trim(); } }

  // 7. 자연어 요약 생성
  const summaryParts = [];
  if (when) summaryParts.push(when);
  if (where) summaryParts.push(where + '에서');
  if (who) summaryParts.push(who + (who.match(/[님씨]$/) ? '이' : ''));
  if (what) summaryParts.push(what);
  if (how) summaryParts.push(how + '으로');
  if (why) summaryParts.push(why);
  if (summaryParts.length === 0 && result.length > 10) {
    summaryParts.push(result.substring(0, 60).replace(/[.!?]\s*[^.!?]*$/, ''));
  }
  if (summaryParts.length > 0) {
    let summary = summaryParts.join(' ');
    summary = summary.replace(/\s{2,}/g, ' ').trim();
    if (!/[.!?]$/.test(summary)) summary += ' 진행.';
    result = result + '\n\n[요약] ' + summary;
  }

  return result;
}

function previewVoice5W1H(text) {
  const fields = { who:'', when:'', where:'', what:'', how:'', why:'' };
  let remaining = text.replace(/\[요약\].*$/s, '').trim();

  function extract(re) {
    const m = remaining.match(re);
    if (m) { remaining = remaining.replace(m[0], ' ').replace(/\s{2,}/g, ' ').trim(); return m[0].trim(); }
    return '';
  }

  const whenP = [/\d{1,2}월\s*\d{1,2}일\s*(?:오전|오후)?\s*(?:\d{1,2}시\s*(?:\d{1,2}분)?)?/, /(?:오전|오후)\s*\d{1,2}시\s*(?:\d{1,2}분)?/, /\d{1,2}월\s*\d{1,2}일/, /(?:어제|오늘|내일|모레|그저께)/, /(?:이번|지난|다음)\s*주\s*(?:월|화|수|목|금|토|일)?요?일?/, /(?:월|화|수|목|금|토|일)요일/];
  for (const re of whenP) { if (!fields.when) fields.when = extract(re); }

  const whereP = [/(충청[남북]?도?|경기도?|서울|부산|대구|인천|광주|대전|울산|세종|경[상남북]+도?|전[라남북]+도?|강원도?|제주도?)\s*[가-힣]{0,4}(?:지역|지사|지국|센터|사무소|현장|공장)?/, /(?:본사|지사|사무실|현장|지국|센터|회의실|연수원|공장|창고|매장|지점|사무소|영업소|출장지)\s*[가-힣]{0,4}/, /[가-힣]{1,10}(?:지국|센터|지사|사무소|영업소|지점|매장|현장)/];
  for (const re of whereP) { if (!fields.where) fields.where = extract(re); }

  const whoP = [/[가-힣]{2,4}\s*(?:님|씨|과장|대리|차장|부장|팀장|본부장|이사|사원|주임|계장|담당|선임|책임|매니저)/, /(?:담당자|본인|내가|제가)\s*[가-힣]{0,4}/];
  for (const re of whoP) { if (!fields.who) { fields.who = extract(re); fields.who = fields.who.replace(/[가이는은]\s*$/, '').trim(); } }

  const howP = [/(?:전화|이메일|대면|온라인|직접|팩스|문자|카톡|시스템|차량|KTX|비행기|버스|택시|지하철)\s*(?:로|으로|통해|이용|타고)?\s*[가-힣]{0,4}/, /(?:방문하여|출장하여|전화하여|메일로|유선으로)/];
  for (const re of howP) { if (!fields.how) fields.how = extract(re); }

  const whyP = [/[가-힣\s]{2,15}(?:위해서?|위하여|때문에|건으로|관련하여|관련해서|목적으로)/, /(?:요청|지시|필요|예정)\s*(?:에\s*의해|으로|이\s*있어)/];
  for (const re of whyP) { if (!fields.why) fields.why = extract(re); }

  const whatP = [/(?:인수인계|보고서\s*작성|회의|미팅|점검|교육|상담|접수|처리|확인|검토|작성|발송|정리|분석|세미나|연수|파견|조사|설명회|감사|계약|협의|영업|배송|수거|설치|수리|유지보수|AS)\s*[가-힣]{0,8}/, /(?:방문|출장)\s*[가-힣]{0,8}/];
  for (const re of whatP) { if (!fields.what) fields.what = extract(re); }

  remaining = remaining.trim();
  if (!fields.what && remaining.length > 1) fields.what = remaining;

  const labels = { who:'누가', when:'언제', where:'어디서', what:'무엇을', how:'어떻게', why:'왜' };
  const colors = { who:'#60a5fa', when:'#f59e0b', where:'#34d399', what:'#f472b6', how:'#a78bfa', why:'#fb923c' };
  let html = '';
  for (const [k, v] of Object.entries(fields)) {
    const val = v || '<span style="color:#666;">-</span>';
    html += `<div style="margin-bottom:4px;"><span style="color:${colors[k]}; font-weight:600;">${labels[k]}:</span> ${val}</div>`;
  }
  return html;
}

async function applyRefinedVoice() {
  const refined = document.getElementById('vrRefinedText').value.trim();
  if (!refined) { toast('텍스트가 없습니다'); return; }

  localStorage.setItem('voicePending', refined);

  document.getElementById('voiceRecordScreen').style.display = 'none';
  document.getElementById('vrRefineStep').style.display = 'none';
  document.getElementById('vrRecordingBtns').style.display = 'flex';
  document.getElementById('vrMicIcon').style.animation = 'vrPulse 1.5s infinite';
  document.getElementById('vrMicIcon').style.background = '#7c3aed';

  await openNewReport();
  if (!currentUser) return;
  localStorage.removeItem('voicePending');
  setTimeout(() => { parseVoiceToFields(refined); }, 300);
}

function parseVoiceToFields(text) {
  const fields = { who: '', when: '', where: '', what: '', how: '', why: '' };
  let remaining = text;

  function extract(re) {
    const m = remaining.match(re);
    if (m) { remaining = remaining.replace(m[0], ' ').replace(/\s{2,}/g, ' ').trim(); return m[0].trim(); }
    return '';
  }

  // 1. 언제 (When) - 날짜/시간 추출
  const whenPatterns = [
    /\d{1,2}월\s*\d{1,2}일\s*(?:오전|오후)?\s*(?:\d{1,2}시\s*(?:\d{1,2}분)?)?/,
    /(?:오전|오후)\s*\d{1,2}시\s*(?:\d{1,2}분)?/,
    /\d{1,2}월\s*\d{1,2}일/,
    /(?:어제|오늘|내일|모레|그저께)/,
    /(?:이번|지난|다음)\s*주\s*(?:월|화|수|목|금|토|일)?요?일?/,
    /(?:월|화|수|목|금|토|일)요일/
  ];
  for (const re of whenPatterns) {
    if (!fields.when) fields.when = extract(re);
  }

  // 2. 어디서 (Where) - 지역/장소 추출
  const wherePatterns = [
    /(충청[남북]?도?|경기도?|서울|부산|대구|인천|광주|대전|울산|세종|경[상남북]+도?|전[라남북]+도?|강원도?|제주도?)\s*[가-힣]{0,4}(?:지역|지사|지국|센터|사무소|현장|공장)?/,
    /(?:본사|지사|사무실|현장|지국|센터|회의실|연수원|공장|창고|매장|지점|사무소|영업소|출장지)\s*[가-힣]{0,4}/,
    /[가-힣]{1,10}(?:지국|센터|지사|사무소|영업소|지점|매장|현장)/
  ];
  for (const re of wherePatterns) {
    if (!fields.where) fields.where = extract(re);
  }

  // 3. 누가 (Who) - 사람 추출
  const whoPatterns = [
    /[가-힣]{2,4}\s*(?:님|씨|과장|대리|차장|부장|팀장|본부장|이사|사원|주임|계장|담당|선임|책임|매니저)/,
    /(?:담당자|본인|내가|제가)\s*[가-힣]{0,4}/,
    /[가-힣]{2,3}(?:가|이|는|은)\s/
  ];
  for (const re of whoPatterns) {
    if (!fields.who) {
      fields.who = extract(re);
      fields.who = fields.who.replace(/[가이는은]\s*$/, '').trim();
    }
  }

  // 4. 어떻게 (How) - 방법 추출
  const howPatterns = [
    /(?:전화|이메일|대면|온라인|직접|팩스|문자|카톡|시스템|차량|KTX|비행기|버스|택시|지하철)\s*(?:로|으로|통해|이용|타고)?\s*[가-힣]{0,4}/,
    /(?:방문하여|출장하여|전화하여|메일로|유선으로)/
  ];
  for (const re of howPatterns) {
    if (!fields.how) fields.how = extract(re);
  }

  // 5. 왜 (Why) - 사유 추출
  const whyPatterns = [
    /[가-힣\s]{2,15}(?:위해서?|위하여|때문에|건으로|관련하여|관련해서|목적으로)/,
    /(?:요청|지시|필요|예정)\s*(?:에\s*의해|으로|이\s*있어)/
  ];
  for (const re of whyPatterns) {
    if (!fields.why) fields.why = extract(re);
  }

  // 6. 무엇을 (What) - 업무 내용 추출 (남은 텍스트에서)
  const whatPatterns = [
    /(?:인수인계|보고서\s*작성|회의|미팅|점검|교육|상담|접수|처리|확인|검토|작성|발송|정리|분석|세미나|연수|파견|조사|설명회|감사|계약|협의|영업|배송|수거|설치|수리|유지보수|AS)\s*[가-힣]{0,8}/,
    /(?:방문|출장)\s*[가-힣]{0,8}/
  ];
  for (const re of whatPatterns) {
    if (!fields.what) fields.what = extract(re);
  }

  // 남은 텍스트가 있고 what이 비어있으면 남은 걸 what으로
  remaining = remaining.trim();
  if (!fields.what && remaining.length > 1) {
    fields.what = remaining;
    remaining = '';
  }

  const fieldMap = { who: 'reportWho', when: 'reportWhen', where: 'reportWhere', what: 'reportWhat', how: 'reportHow', why: 'reportWhy' };
  let filled = 0;
  for (const [key, id] of Object.entries(fieldMap)) {
    if (fields[key]) {
      const el = document.getElementById(id);
      if (el) { el.value = fields[key].trim(); filled++; }
    }
  }

  const contentEl = document.getElementById('reportContent');
  if (contentEl) {
    contentEl.value = '[음성 원문] ' + text + (remaining ? '\n[미분류] ' + remaining : '');
  }

  toast(`음성 분석 완료! ${filled}개 항목 자동 입력`);
}

// ─── 음성 안내 어시스턴트 ───
let _vgActive = false;
let _vgResolve = null;
let _vgRecog = null;
let _vgSchedules = [];
let _vgDidCheckin = false;

function startVoiceGuide() {
  const today = new Date().toISOString().split('T')[0];
  if (localStorage.getItem('vgDone') === today) return;
  if (localStorage.getItem('voicePending')) return;
  if (!currentUser || currentUser.isAdmin) return;

  _vgActive = true;
  _vgSchedules = [];
  _vgDidCheckin = false;
  const overlay = document.getElementById('voiceGuideOverlay');
  overlay.style.display = 'flex';
  document.getElementById('vgChatArea').innerHTML = '';
  document.getElementById('vgQuickReplies').style.display = 'none';
  document.getElementById('vgScheduleArea').style.display = 'none';
  document.getElementById('vgMicBtn').style.display = 'none';
  document.getElementById('vgStatusText').textContent = '';

  setTimeout(() => vgConversation(), 600);
}

function closeVoiceGuide() {
  _vgActive = false;
  if (_vgRecog) { try { _vgRecog.stop(); } catch(e){} _vgRecog = null; }
  if (_vgResolve) { _vgResolve(''); _vgResolve = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  document.getElementById('voiceGuideOverlay').style.display = 'none';
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem('vgDone', today);
}

function vgSpeak(text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !_vgActive) { resolve(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 1.05;
    u.pitch = 1.1;
    u.onend = () => setTimeout(resolve, 200);
    u.onerror = () => resolve();
    setTimeout(() => speechSynthesis.speak(u), 100);
  });
}

function vgAddBubble(text, who) {
  const area = document.getElementById('vgChatArea');
  const isBot = who === 'bot';
  const div = document.createElement('div');
  div.style.cssText = `max-width:82%; padding:12px 16px; border-radius:${isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px'}; font-size:14px; line-height:1.6; animation:fadeIn .3s; word-break:keep-all; ${isBot ? 'background:rgba(255,255,255,.12); color:#fff; align-self:flex-start;' : 'background:#7c3aed; color:#fff; align-self:flex-end;'}`;
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function vgShowQuickReplies(options) {
  const c = document.getElementById('vgQuickReplies');
  c.innerHTML = options.map(o =>
    `<button onclick="vgQuickReply('${o}')" style="padding:10px 20px; border-radius:20px; border:2px solid rgba(255,255,255,.3); background:rgba(255,255,255,.06); color:#fff; font-size:14px; font-weight:600; cursor:pointer;">${o}</button>`
  ).join('');
  c.style.display = 'flex';
}

function vgHideQuickReplies() {
  document.getElementById('vgQuickReplies').style.display = 'none';
}

function vgQuickReply(text) {
  vgHideQuickReplies();
  document.getElementById('vgMicBtn').style.display = 'none';
  document.getElementById('vgStatusText').textContent = '';
  if (_vgRecog) { try { _vgRecog.stop(); } catch(e){} _vgRecog = null; }
  if (_vgResolve) { const r = _vgResolve; _vgResolve = null; r(text); }
}

function vgMicTap() {
  if (_vgRecog) { try { _vgRecog.stop(); } catch(e){} }
}

function vgListen(timeout) {
  timeout = timeout || 8000;
  return new Promise(resolve => {
    if (!SpeechRecognition || !_vgActive) { resolve(''); return; }

    document.getElementById('vgMicBtn').style.display = 'inline-flex';
    document.getElementById('vgStatusText').textContent = '듣고 있습니다... 🎤';

    _vgResolve = function(text) {
      document.getElementById('vgMicBtn').style.display = 'none';
      document.getElementById('vgStatusText').textContent = '';
      _vgResolve = null;
      resolve(text);
    };

    const recog = new SpeechRecognition();
    recog.lang = 'ko-KR';
    recog.interimResults = false;
    recog.continuous = false;
    _vgRecog = recog;

    let result = '';
    const timer = setTimeout(() => { _vgRecog = null; try { recog.stop(); } catch(e){} }, timeout);

    recog.onresult = function(e) {
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) result += e.results[i][0].transcript + ' ';
      }
    };
    recog.onend = function() {
      clearTimeout(timer);
      _vgRecog = null;
      if (_vgResolve) _vgResolve(result.trim());
    };
    recog.onerror = function() {
      clearTimeout(timer);
      _vgRecog = null;
      if (_vgResolve) _vgResolve('');
    };
    try { recog.start(); } catch(e) { if (_vgResolve) _vgResolve(''); }
  });
}

async function vgConversation() {
  if (!_vgActive) return;
  const name = currentUser.name || '사용자';

  vgAddBubble('안녕하세요 ' + name + '님! 출근하신걸 축하드려요! 🎉', 'bot');
  await vgSpeak('안녕하세요 ' + name + '님! 출근하신걸 축하드려요!');
  if (!_vgActive) return;

  await new Promise(r => setTimeout(r, 400));
  vgAddBubble('오늘 하루도 힘차게 시작해봐요! 어떤 일들이 기다리고 있을까요? 😊', 'bot');
  await vgSpeak('오늘 하루도 힘차게 시작해봐요! 어떤 일들이 기다리고 있을까요?');
  if (!_vgActive) return;

  await new Promise(r => setTimeout(r, 300));
  vgAddBubble('오늘은 내근이세요? 외근이세요? 🏢', 'bot');
  vgShowQuickReplies(['내근', '외근', '출장']);
  await vgSpeak('오늘은 내근이세요? 외근이세요?');
  if (!_vgActive) return;

  const wtResp = await vgListen(10000);
  if (!_vgActive) return;
  vgHideQuickReplies();

  let workType = '내근';
  const wt = wtResp.toLowerCase();
  if (wt.includes('외근')) workType = '외근';
  else if (wt.includes('출장')) workType = '출장';
  vgAddBubble(wtResp || workType, 'user');

  try {
    await api('/api/attendance/checkin', { method: 'POST', body: { work_type: workType, work_summary: '' } });
    _vgDidCheckin = true;
  } catch(e) {}

  await new Promise(r => setTimeout(r, 300));
  const emoji = workType === '외근' ? '🚗' : workType === '출장' ? '✈️' : '🏢';
  vgAddBubble(workType + '이시군요! ' + emoji + ' 출근 체크도 해드렸어요! 오늘 어떤 업무 계획이 있으세요? 자유롭게 말씀해주세요.', 'bot');
  await vgSpeak(workType + '이시군요! 출근 체크도 해드렸어요! 오늘 어떤 업무 계획이 있으세요? 자유롭게 말씀해주세요.');
  if (!_vgActive) return;

  const planResp = await vgListen(20000);
  if (!_vgActive) return;

  if (planResp) {
    vgAddBubble(planResp, 'user');
    _vgSchedules = vgParseSchedules(planResp);

    await new Promise(r => setTimeout(r, 300));
    vgAddBubble('네! 또 다른 일정이 있으세요?', 'bot');
    vgShowQuickReplies(['네, 더 있어요', '아니요, 끝이에요']);
    await vgSpeak('네! 또 다른 일정이 있으세요?');
    if (!_vgActive) return;

    const moreResp = await vgListen(8000);
    if (!_vgActive) return;
    vgHideQuickReplies();
    vgAddBubble(moreResp || '아니요', 'user');

    const wantMore = moreResp && (moreResp.includes('네') || moreResp.includes('더') || moreResp.includes('있') || moreResp.includes('응'));
    if (wantMore) {
      vgAddBubble('네, 말씀해주세요! 🎤', 'bot');
      await vgSpeak('네, 말씀해주세요!');
      if (!_vgActive) return;

      const more2 = await vgListen(20000);
      if (!_vgActive) return;
      if (more2) {
        vgAddBubble(more2, 'user');
        _vgSchedules = _vgSchedules.concat(vgParseSchedules(more2));
      }
    }
  }

  if (_vgSchedules.length > 0) {
    await new Promise(r => setTimeout(r, 300));
    vgAddBubble(_vgSchedules.length + '개의 일정을 정리했어요! 확인하고 저장해주세요 📋', 'bot');
    await vgSpeak(_vgSchedules.length + '개의 일정을 정리했어요! 확인하고 저장해주세요');
    vgShowSchedulePreview();
  } else {
    await new Promise(r => setTimeout(r, 300));
    vgAddBubble('오늘도 좋은 하루 되세요! 화이팅! 💪', 'bot');
    await vgSpeak('오늘도 좋은 하루 되세요! 화이팅!');
    setTimeout(() => closeVoiceGuide(), 2500);
  }
}

function vgParseSchedules(text) {
  const schedules = [];
  const parts = text.split(/(?:그리고|하고|그\s?다음에?|또|다음으로|이후에?|뒤에|그런\s?다음|끝나고|마치고)/);

  for (const part of parts) {
    const s = part.trim();
    if (!s || s.length < 2) continue;

    let time = '';
    const tm1 = s.match(/(오전|오후)\s*(\d{1,2})시\s*(?:(\d{1,2})분|반)?/);
    const tm2 = s.match(/(\d{1,2})시\s*(?:(\d{1,2})분|반)?/);
    const tm3 = s.match(/(아침|점심|저녁|낮)/);

    if (tm1) {
      let h = parseInt(tm1[2]);
      if (tm1[1] === '오후' && h < 12) h += 12;
      if (tm1[1] === '오전' && h === 12) h = 0;
      const m = tm1[3] ? parseInt(tm1[3]) : (s.includes('반') ? 30 : 0);
      time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    } else if (tm2) {
      let h = parseInt(tm2[1]);
      if (h >= 1 && h <= 7) h += 12;
      const m = tm2[2] ? parseInt(tm2[2]) : (s.includes('반') ? 30 : 0);
      time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    } else if (tm3) {
      const map = { '아침': '09:00', '점심': '12:00', '낮': '14:00', '저녁': '18:00' };
      time = map[tm3[1]] || '';
    }

    let task = s
      .replace(/(오전|오후)?\s*\d{1,2}시\s*(?:\d{1,2}분|반)?(?:에|까지|부터|쯤)?\s*/g, '')
      .replace(/(아침|점심|저녁|낮)(?:에|때|쯤)?\s*/g, '')
      .replace(/^\s*(에|을|를|는|은)\s*/, '')
      .trim();

    if (!task && !time) continue;
    if (!task) task = '일정';

    schedules.push({ time: time, task: task });
  }

  if (schedules.length === 0 && text.trim().length > 2) {
    schedules.push({ time: '', task: text.trim() });
  }
  return schedules;
}

function vgShowSchedulePreview() {
  const area = document.getElementById('vgScheduleArea');
  area.style.display = 'block';
  let html = '<div style="background:rgba(255,255,255,.1); border-radius:16px; padding:16px; margin-bottom:12px;">';
  html += '<p style="font-size:15px; font-weight:700; margin-bottom:12px;">📋 오늘의 일정</p>';
  _vgSchedules.forEach(function(s, i) {
    html += '<div style="background:rgba(255,255,255,.08); border-radius:10px; padding:10px 12px; margin-bottom:8px; display:flex; gap:8px; align-items:center;">';
    html += '<input type="time" value="' + (s.time || '') + '" onchange="_vgSchedules[' + i + '].time=this.value" style="background:rgba(255,255,255,.15); border:none; color:#fff; border-radius:8px; padding:6px; font-size:13px; width:85px;">';
    html += '<input type="text" value="' + (s.task || '') + '" onchange="_vgSchedules[' + i + '].task=this.value" style="flex:1; background:rgba(255,255,255,.15); border:none; color:#fff; border-radius:8px; padding:8px 10px; font-size:14px;">';
    html += '<button onclick="vgRemoveSchedule(' + i + ')" style="background:none; border:none; color:#f87171; font-size:18px; cursor:pointer; padding:4px;">✕</button>';
    html += '</div>';
  });
  html += '<button onclick="vgAddScheduleRow()" style="width:100%; padding:10px; border-radius:10px; border:2px dashed rgba(255,255,255,.2); background:transparent; color:rgba(255,255,255,.5); font-size:13px; cursor:pointer; margin-top:4px;">+ 일정 추가</button>';
  html += '</div>';
  html += '<div style="display:flex; gap:10px; margin-bottom:16px;">';
  html += '<button onclick="closeVoiceGuide()" style="flex:1; padding:14px; border-radius:12px; border:none; background:rgba(255,255,255,.15); color:#fff; font-size:15px; font-weight:600; cursor:pointer;">나중에</button>';
  html += '<button onclick="vgSaveSchedules()" style="flex:1; padding:14px; border-radius:12px; border:none; background:#22c55e; color:#fff; font-size:15px; font-weight:700; cursor:pointer;">저장하기 ✓</button>';
  html += '</div>';
  area.innerHTML = html;
}

function vgRemoveSchedule(i) {
  _vgSchedules.splice(i, 1);
  if (_vgSchedules.length === 0) {
    document.getElementById('vgScheduleArea').style.display = 'none';
    return;
  }
  vgShowSchedulePreview();
}

function vgAddScheduleRow() {
  _vgSchedules.push({ time: '', task: '' });
  vgShowSchedulePreview();
}

async function vgSaveSchedules() {
  const today = new Date().toISOString().split('T')[0];
  let saved = 0;
  for (const s of _vgSchedules) {
    if (!s.task.trim()) continue;
    const res = await api('/api/calendar-events', {
      method: 'POST',
      body: { title: s.task.trim(), description: '', event_date: today, event_time: s.time || '', event_type: '업무' }
    });
    if (res) saved++;
  }
  toast(saved + '개 일정이 저장되었습니다!');
  vgAddBubble(saved + '개 일정이 저장되었습니다! 오늘도 화이팅! 🔥', 'bot');
  await vgSpeak(saved + '개 일정이 저장되었습니다! 오늘도 화이팅!');
  setTimeout(() => closeVoiceGuide(), 1500);
}

// ─── 출근 체크 팝업 (매일 10시까지, 전원 출근시 종료) ───
let _attPopupDismissedAt = null;

async function checkAttendancePopup() {
  if (!currentUser) return;
  if (_vgActive || _vgDidCheckin) return;
  const now = new Date();
  const hour = now.getHours();
  if (hour >= 10) return;
  if (_attPopupDismissedAt && (Date.now() - _attPopupDismissedAt) < 30000) return;
  if (document.getElementById('attPopupOverlay')) return;

  const board = await api('/api/attendance/team-board');
  if (!board || board.all_checked) return;

  const notChecked = board.board.filter(b => !b.checked_in);
  const checked = board.board.filter(b => b.checked_in);

  const overlay = document.createElement('div');
  overlay.id = 'attPopupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9997;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:20px;width:92%;max-width:380px;color:#222;max-height:80vh;overflow-y:auto;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:20px;font-weight:700;">출근 현황판</div>
        <div style="font-size:13px;color:#888;margin-top:4px;">전원 출근 완료시 자동 종료</div>
        <div style="margin-top:8px;font-size:14px;font-weight:600;color:var(--primary);">${board.checked_count} / ${board.total}명 출근</div>
        <div style="background:#e5e7eb;border-radius:99px;height:8px;margin-top:8px;overflow:hidden;">
          <div style="background:var(--primary);height:100%;width:${Math.round(board.checked_count / board.total * 100)}%;border-radius:99px;transition:width .3s;"></div>
        </div>
      </div>
      ${checked.length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:13px;font-weight:600;color:#10b981;margin-bottom:8px;">✅ 출근 완료 (${checked.length}명)</div>
          ${checked.map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#f0fdf4;border-radius:8px;margin-bottom:4px;">
              <div>
                <span style="font-weight:600;font-size:14px;">${escHtml(c.name)}</span>
                <span style="font-size:12px;color:#888;margin-left:4px;">${escHtml(c.position || '')}</span>
              </div>
              <div style="text-align:right;">
                <span style="font-size:12px;font-weight:600;color:${c.work_type === '외근' ? '#059669' : '#2563eb'};">${c.work_type === '외근' ? '🚗외근' : '🏢내근'}</span>
                <span style="font-size:11px;color:#888;margin-left:4px;">${(c.check_in||'').substring(11,16)}</span>
                ${c.work_summary ? `<div style="font-size:11px;color:#666;margin-top:2px;">${escHtml(c.work_summary)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${notChecked.length > 0 ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:13px;font-weight:600;color:#ef4444;margin-bottom:8px;">⏳ 미출근 (${notChecked.length}명)</div>
          ${notChecked.map(nc => `
            <div style="display:flex;align-items:center;padding:8px 10px;background:#fef2f2;border-radius:8px;margin-bottom:4px;">
              <span style="font-weight:600;font-size:14px;">${escHtml(nc.name)}</span>
              <span style="font-size:12px;color:#888;margin-left:4px;">${escHtml(nc.position || '')}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <button onclick="_attPopupDismissedAt=Date.now();document.getElementById('attPopupOverlay').remove();"
        style="width:100%;padding:12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:14px;color:#555;">닫기 (30초 후 다시 표시)</button>
    </div>`;
  document.body.appendChild(overlay);
}

setInterval(checkAttendancePopup, 60000);

// 초기화 — 서버 연결 상태 표시
(async () => {
  const indicator = document.createElement('div');
  indicator.id = 'serverStatus';
  indicator.style.cssText = 'position:fixed; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.75); color:#fff; padding:8px 20px; border-radius:20px; font-size:13px; z-index:99999; display:none;';
  document.body.appendChild(indicator);

  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen && loginScreen.style.display !== 'none') {
    indicator.textContent = '서버 연결 중...';
    indicator.style.display = 'block';
  }

  await checkAuth();

  indicator.textContent = '서버 연결 완료';
  setTimeout(() => { indicator.style.display = 'none'; }, 1500);
})();

// ─── 도움말 모드 (hover 안내 말풍선) ───
let _helpMode = false;

function toggleHelpMode() {
  _helpMode = !_helpMode;
  document.body.classList.toggle('help-mode', _helpMode);
  const btn = document.getElementById('helpModeBtn');
  if (btn) btn.classList.toggle('help-active', _helpMode);
  let banner = document.getElementById('helpModeBanner');
  if (_helpMode) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'helpModeBanner';
      banner.className = 'help-mode-banner';
      banner.textContent = '도움말 모드 — 버튼이나 입력칸에 마우스를 올려보세요 (다시 ? 누르면 종료)';
      document.body.appendChild(banner);
    }
  } else {
    if (banner) banner.remove();
    hideHelpBubble();
  }
}

function hideHelpBubble() {
  const b = document.getElementById('helpBubble');
  if (b) b.classList.remove('show');
}

function showHelpBubble(el) {
  const text = el.getAttribute('data-help');
  if (!text) return;
  let b = document.getElementById('helpBubble');
  if (!b) {
    b = document.createElement('div');
    b.id = 'helpBubble';
    document.body.appendChild(b);
  }
  b.textContent = text;
  b.classList.remove('arrow-up', 'arrow-down');
  // 먼저 보이게 해서 크기 측정
  b.style.left = '-9999px';
  b.classList.add('show');
  const r = el.getBoundingClientRect();
  const bw = b.offsetWidth, bh = b.offsetHeight;
  const margin = 8;
  // 기본은 요소 위쪽, 공간 부족하면 아래쪽
  let placeAbove = r.top > bh + margin + 4;
  let top = placeAbove ? r.top - bh - margin : r.bottom + margin;
  let left = r.left + r.width / 2 - bw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
  // 화살표 위치(요소 중앙을 가리키도록)
  const arrowLeft = Math.max(12, Math.min(r.left + r.width / 2 - left, bw - 12));
  b.style.setProperty('--arrow-left', (arrowLeft - 7) + 'px');
  b.classList.add(placeAbove ? 'arrow-down' : 'arrow-up');
  b.style.left = left + 'px';
  b.style.top = top + 'px';
}

document.addEventListener('mouseover', function(e) {
  if (!_helpMode) return;
  const el = e.target.closest('[data-help]');
  if (el) showHelpBubble(el);
});
document.addEventListener('mouseout', function(e) {
  if (!_helpMode) return;
  const el = e.target.closest('[data-help]');
  if (el && !el.contains(e.relatedTarget)) hideHelpBubble();
});
document.addEventListener('focusin', function(e) {
  if (!_helpMode) return;
  const el = e.target.closest('[data-help]');
  if (el) showHelpBubble(el);
});

// ─── 지역장: 소속 관리 ───
let _regionMembers = [];

async function showRegionMembers() {
  const members = await api('/api/region/members');
  if (!members) return;
  _regionMembers = members;
  renderRegionMembers('');
}

function renderRegionMembers(keyword) {
  const kw = (keyword || '').trim().toLowerCase();
  const list = kw
    ? _regionMembers.filter(m =>
        (m.name || '').toLowerCase().includes(kw) ||
        (m.company_name || '').toLowerCase().includes(kw) ||
        (m.department || '').toLowerCase().includes(kw) ||
        (m.position || '').toLowerCase().includes(kw))
    : _regionMembers;

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <p class="section-title" style="margin:0;">&#128100; 소속 관리 <span style="font-size:12px; color:var(--gray-500); font-weight:400;">(지역장)</span></p>
      <span style="font-size:13px; color:var(--gray-500);">${list.length}명</span>
    </div>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:10px;">관리담당자의 부서·직책·팀을 대신 수정할 수 있습니다.</p>
    <div class="form-group">
      <input type="text" class="form-control" placeholder="이름·회사·부서·직책 검색"
        value="${escAttr(keyword || '')}" oninput="renderRegionMembers(this.value)"
        data-help="찾으려는 관리담당자의 이름이나 소속을 입력하면 목록이 좁혀집니다.">
    </div>
    ${list.length === 0 ? '<div class="empty-state"><div class="empty-icon">&#128100;</div><div class="empty-text">대상이 없습니다</div></div>' : list.map(m => `
      <div class="card" style="padding:12px; margin-bottom:8px;" id="rm-${m.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="min-width:0;">
            <div style="font-size:15px; font-weight:600;">${escHtml(m.name)} ${m.position ? `<span style="font-size:12px; color:var(--primary);">${escHtml(m.position)}</span>` : ''}</div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">
              ${escHtml(m.company_name || '회사 미지정')}${m.team_name ? ' · ' + escHtml(m.team_name) : ''}${m.department ? ' · ' + escHtml(m.department) : ''}
            </div>
            ${m.phone ? `<div style="font-size:11px; color:var(--gray-400); margin-top:2px;">${escHtml(m.phone)}</div>` : ''}
          </div>
          <button class="btn btn-outline btn-sm" onclick="editRegionMember('${m.id}')" data-help="이 사람의 부서·직책·팀을 수정합니다.">수정</button>
        </div>
      </div>
    `).join('')}
  `;
}

async function editRegionMember(id) {
  const m = _regionMembers.find(x => x.id === id);
  if (!m) return;
  let teams = [];
  if (m.company_id) teams = await api(`/api/companies/${m.company_id}/teams`) || [];
  const teamOpts = ['<option value="">-- 팀 미지정 --</option>']
    .concat(teams.map(t => `<option value="${t.id}"${t.id === m.team_id ? ' selected' : ''}>${escHtml(t.name)}</option>`))
    .join('');

  document.getElementById('rm-' + id).innerHTML = `
    <div style="font-size:15px; font-weight:600; margin-bottom:8px;">${escHtml(m.name)} <span style="font-size:12px; color:var(--gray-500);">소속 수정</span></div>
    <div class="form-group" style="margin-bottom:8px;">
      <label style="font-size:12px;">직책</label>
      <input type="text" id="rmPos-${id}" class="form-control" value="${escAttr(m.position || '')}" placeholder="예: 과장, 팀장, 지역장"
        data-help="이 사람의 직책을 입력하세요. '지역장'으로 지정하면 그 사람도 소속 관리 권한을 갖게 됩니다.">
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <label style="font-size:12px;">부서</label>
      <input type="text" id="rmDept-${id}" class="form-control" value="${escAttr(m.department || '')}" placeholder="예: 영업부, 전산팀"
        data-help="이 사람이 속한 부서를 입력하세요.">
    </div>
    <div class="form-group" style="margin-bottom:10px;">
      <label style="font-size:12px;">팀 ${m.company_id ? '' : '(회사 미지정 시 변경 불가)'}</label>
      <select id="rmTeam-${id}" class="form-control" ${m.company_id ? '' : 'disabled'}
        data-help="이 사람이 속한 회사의 팀 중에서 선택합니다. 회사가 없으면 변경할 수 없습니다.">
        ${teamOpts}
      </select>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-outline btn-sm" style="flex:1;" onclick="renderRegionMembers('')">취소</button>
      <button class="btn btn-primary btn-sm" style="flex:1;" onclick="saveRegionMember('${id}')" data-help="변경한 소속 정보를 저장합니다.">저장</button>
    </div>
  `;
}

async function saveRegionMember(id) {
  const position = document.getElementById('rmPos-' + id).value.trim();
  const department = document.getElementById('rmDept-' + id).value.trim();
  const teamSel = document.getElementById('rmTeam-' + id);
  const team_id = teamSel && !teamSel.disabled ? (teamSel.value || null) : null;
  const res = await api(`/api/region/members/${id}`, { method: 'PUT', body: { department, position, team_id } });
  if (res) {
    toast('소속이 수정되었습니다');
    const m = _regionMembers.find(x => x.id === id);
    if (m) {
      m.position = position;
      m.department = department;
      m.team_id = team_id;
      m.team_name = team_id && teamSel ? (teamSel.options[teamSel.selectedIndex] || {}).text || '' : '';
    }
    renderRegionMembers('');
  }
}

// ─── 워크샵 참석 명단 작성 ───
let _wsRoster = [];

async function showWorkshopRoster() {
  const members = await api('/api/region/members');
  if (!members) return;
  // 관리담당자 → 명단 행으로 변환 (소속 자동값: 회사명 우선, 없으면 부서)
  _wsRoster = members.map(m => ({
    name: m.name || '',
    affiliation: m.company_name || m.department || '',
    position: m.position || '',
    age: '',
    gender: '',
    note: '',
    included: true,
    fromApp: true
  }));
  renderWorkshopRoster();
}

function renderWorkshopRoster() {
  const includedCount = _wsRoster.filter(r => r.included).length;
  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <p class="section-title" style="margin:0;">&#128203; 워크샵 명단</p>
      <span style="font-size:13px; color:var(--gray-500);">선택 ${includedCount}명</span>
    </div>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:10px;">관리담당자를 불러왔습니다. 체크 해제로 제외하고, 나이·성별·비고를 채운 뒤 추가 인원을 더해 엑셀로 내려받으세요.</p>

    <div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:560px;">
      <thead>
        <tr style="background:var(--primary-light);">
          <th style="padding:6px 4px; width:34px;" data-help="체크된 사람만 명단에 포함됩니다.">포함</th>
          <th style="padding:6px 4px; text-align:left;">이름</th>
          <th style="padding:6px 4px; text-align:left;">소속</th>
          <th style="padding:6px 4px; text-align:left;">직함</th>
          <th style="padding:6px 4px; width:48px;">나이</th>
          <th style="padding:6px 4px; width:54px;">성별</th>
          <th style="padding:6px 4px; text-align:left;">비고</th>
          <th style="padding:6px 4px; width:28px;"></th>
        </tr>
      </thead>
      <tbody>
        ${_wsRoster.map((r, i) => `
          <tr style="border-bottom:1px solid var(--gray-100); ${r.included ? '' : 'opacity:0.45;'}">
            <td style="text-align:center;"><input type="checkbox" ${r.included ? 'checked' : ''} onchange="wsToggle(${i}, this.checked)" style="width:18px; height:18px; accent-color:var(--primary);"></td>
            <td><input type="text" value="${escAttr(r.name)}" oninput="wsSet(${i},'name',this.value)" style="width:100%; border:none; padding:6px 4px; font-size:13px; background:transparent;"></td>
            <td><input type="text" value="${escAttr(r.affiliation)}" oninput="wsSet(${i},'affiliation',this.value)" style="width:100%; border:none; padding:6px 4px; font-size:13px; background:transparent;" data-help="소속(조합/지국명)을 적습니다. 회사명이 자동으로 채워졌으며 수정할 수 있습니다."></td>
            <td><input type="text" value="${escAttr(r.position)}" oninput="wsSet(${i},'position',this.value)" style="width:100%; border:none; padding:6px 4px; font-size:13px; background:transparent;"></td>
            <td><input type="text" value="${escAttr(r.age)}" oninput="wsSet(${i},'age',this.value)" style="width:100%; border:none; padding:6px 2px; font-size:13px; text-align:center; background:transparent;" data-help="나이는 앱에 없는 정보라 직접 입력합니다. 비워둬도 됩니다."></td>
            <td><input type="text" value="${escAttr(r.gender)}" oninput="wsSet(${i},'gender',this.value)" placeholder="남/여" style="width:100%; border:none; padding:6px 2px; font-size:13px; text-align:center; background:transparent;" data-help="성별을 직접 입력합니다. 예: 남, 여."></td>
            <td><input type="text" value="${escAttr(r.note)}" oninput="wsSet(${i},'note',this.value)" style="width:100%; border:none; padding:6px 4px; font-size:13px; background:transparent;"></td>
            <td style="text-align:center;"><button onclick="wsRemove(${i})" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px;">&times;</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>

    <div style="display:flex; gap:8px; margin-top:14px;">
      <button class="btn btn-outline btn-block" onclick="wsAddRow()" data-help="앱에 없는 추가 인원을 빈 행으로 넣습니다.">+ 추가 인원</button>
      <button class="btn btn-success btn-block" onclick="downloadWorkshopRoster()" data-help="체크된 인원으로 워크숍 참석 명단 엑셀 양식을 내려받습니다.">&#128229; 엑셀 다운로드</button>
    </div>
  `;
}

function wsToggle(i, checked) {
  if (_wsRoster[i]) _wsRoster[i].included = checked;
  renderWorkshopRoster();
}

function wsSet(i, field, value) {
  if (_wsRoster[i]) _wsRoster[i][field] = value;
}

function wsRemove(i) {
  _wsRoster.splice(i, 1);
  renderWorkshopRoster();
}

function wsAddRow() {
  _wsRoster.push({ name: '', affiliation: '', position: '', age: '', gender: '', note: '', included: true, fromApp: false });
  renderWorkshopRoster();
}

async function downloadWorkshopRoster() {
  const rows = _wsRoster
    .filter(r => r.included && (r.name || '').trim())
    .map(r => ({ name: r.name, affiliation: r.affiliation, position: r.position, age: r.age, gender: r.gender, note: r.note }));
  if (rows.length === 0) { toast('명단에 포함할 인원이 없습니다'); return; }
  try {
    toast('엑셀 파일 생성 중...');
    const resp = await fetch('/api/export/workshop-roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ rows })
    });
    if (!resp.ok) throw new Error('다운로드 실패');
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `워크샵_참석명단_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast('다운로드 완료!');
  } catch (e) {
    toast('다운로드 실패: ' + e.message);
  }
}
