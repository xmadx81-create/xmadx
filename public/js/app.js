let currentUser = null;
let currentPage = 'home';
let editingReportId = null;
const PAGE_SIZE = 15;
let _deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _deferredInstallPrompt = e; });

// ─── 서버 점검 모드 감지 시스템 ───
let _maintenanceChecking = false;
async function _checkMaintenance() {
  if (_maintenanceChecking) return;
  _maintenanceChecking = true;
  try {
    const resp = await fetch('/api/maintenance/status');
    const data = await resp.json();
    const overlay = document.getElementById('maintenance-overlay');
    const banner = document.getElementById('maintenance-banner');
    if (data.active && !data.isAdmin) {
      if (overlay) {
        overlay.querySelector('.mt-message').textContent = data.message || '시스템 업데이트 중입니다.';
        if (data.until) overlay.querySelector('.mt-until').textContent = '예상 완료: ' + data.until;
        if (data.patchNotes) overlay.querySelector('.mt-notes').innerHTML = data.patchNotes;
        overlay.style.display = 'flex';
      }
    } else {
      if (overlay) overlay.style.display = 'none';
    }
    if (data.active && data.isAdmin && banner) {
      banner.style.display = 'block';
      banner.textContent = '⚠️ 점검 모드 중 (관리자 접속)';
    } else if (banner) {
      banner.style.display = 'none';
    }
    _showSundayNotice(banner);
  } catch (e) {}
  _maintenanceChecking = false;
}
function _showSundayNotice(banner) {
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() >= 23 && banner) {
    if (banner.style.display === 'none' || !banner.style.display) {
      banner.style.display = 'block';
      banner.textContent = '📢 오늘 23:50 서버 점검 예정 (약 10분간 접속 제한)';
      banner.style.background = '#f59e0b';
    }
  }
}
setInterval(_checkMaintenance, 30000);
setTimeout(_checkMaintenance, 2000);

// ─── 네비게이터 커스텀 설정 ───
const NAV_ITEMS = [
  { id: 'home', icon: '&#127968;', label: '홈' },
  { id: 'reports', icon: '&#128221;', label: '업무일지' },
  { id: 'weekly', icon: '&#128197;', label: '주간계획' },
  { id: 'notices', icon: '&#128227;', label: '공지사항', action: 'showNoticesList' },
  { id: 'board', icon: '&#128172;', label: '게시판', action: 'showBoard' },
  { id: 'todo', icon: '&#9745;', label: '할 일', action: 'showTodoPage' },
  { id: 'volunteer', icon: '&#129309;', label: '봉사활동', action: 'showVolunteerPage' },
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
let _keepAliveTimer = null;

async function _fetchLogin(phone, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  return res;
}

function _startKeepAlive() {
  if (_keepAliveTimer) clearInterval(_keepAliveTimer);
  _keepAliveTimer = setInterval(() => {
    fetch('/api/health').catch(() => {});
  }, 10 * 60 * 1000);
}

function _stopKeepAlive() {
  if (_keepAliveTimer) { clearInterval(_keepAliveTimer); _keepAliveTimer = null; }
}

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
    let res;
    try {
      res = await _fetchLogin(phone, password);
    } catch (e1) {
      if (btn) btn.textContent = '재시도 중...';
      await new Promise(r => setTimeout(r, 2000));
      try {
        res = await _fetchLogin(phone, password);
      } catch (e2) {
        let diagMsg = '서버에 연결할 수 없습니다.';
        try {
          const h = await fetch('/api/health');
          const hd = await h.json();
          diagMsg += `\n\n[진단] 서버: ${hd.status}, DB: ${hd.db}`;
        } catch (_) {
          diagMsg += '\n\n[진단] 서버 완전 미응답 — Render 서버가 슬립 상태일 수 있습니다.\n30초 후 다시 시도해주세요.';
        }
        showResultModal('error', '서버 연결 실패', diagMsg, '확인');
        return;
      }
    }
    const data = await res.json();
    if (!res.ok) {
      let errMsg = data.error || '연락처 또는 비밀번호가 올바르지 않습니다.';
      if (res.status === 500) {
        errMsg += '\n\n[진단] 서버 내부 오류가 발생했습니다.\n관리자에게 문의해주세요.';
      }
      showResultModal('error', '로그인 실패', errMsg, '확인');
      return;
    }
    // 세션 검증: 로그인 API 성공 후 실제 세션 쿠키가 저장됐는지 확인
    try {
      const verifyRes = await fetch('/api/me');
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || verifyData.error) {
        showResultModal('warning', '세션 저장 실패', '로그인은 성공했지만 세션이 유지되지 않습니다.\n\n가능한 원인:\n• 브라우저 쿠키가 차단됨\n• 시크릿/사생활 모드 사용 중\n\n브라우저 설정에서 쿠키를 허용해주세요.', '확인');
        return;
      }
    } catch (_) {
      showResultModal('warning', '세션 확인 실패', '로그인 처리 중 세션 확인에 실패했습니다.\n페이지를 새로고침 후 다시 시도해주세요.', '확인');
      return;
    }
    currentUser = data;
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').classList.add('active');
    rebuildNav();
    navigate('home');
    toast(`${data.name}님 환영합니다!`);
    restorePendingVoice();
    setTimeout(() => startVoiceGuide(), 1200);
    _startKeepAlive();
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
    _startKeepAlive();
    setTimeout(aiSecretaryCheck, 8000);
  }
}

async function logout() {
  _stopKeepAlive();
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

  // AI 비서 위젯 데이터
  const _h = new Date().getHours();
  const _tgEmoji = _h < 9 ? '🌅' : _h < 12 ? '☀️' : _h < 14 ? '🍚' : _h < 18 ? '🌤️' : '🌙';
  const _tgMsg = _h < 9 ? '좋은 아침이에요!' : _h < 12 ? '오전도 힘차게!' : _h < 14 ? '점심 맛있게 드셨나요?' : _h < 18 ? '오후도 화이팅!' : '수고 많으셨어요!';
  const _todayEvts = (events || []).filter(e => (e.event_date || '').split('T')[0] === today);
  const _pendingTodos = (todos || []).filter(t => !t.completed);
  const _overdueTodos = _pendingTodos.filter(t => t.due_date && t.due_date.split('T')[0] < today);
  const _streakCount = todayReports.length;
  const _nowMin = _h * 60 + new Date().getMinutes();
  const _nextEvt = _todayEvts.find(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); return (eh*60+em) > _nowMin; });

  let _aiTip = '';
  let _aiUrgent = '';
  if (_overdueTodos.length > 0) _aiUrgent = '⚠️ 기한 지난 할 일 ' + _overdueTodos.length + '건';
  if (!atd) _aiTip = '출근 체크가 아직이에요. 지금 할까요?';
  else if (_nextEvt) { const diff = (parseInt(_nextEvt.event_time) * 60 + parseInt(_nextEvt.event_time.split(':')[1])) - _nowMin; _aiTip = (diff <= 30 ? '⏰ 곧! ' : '') + '다음 일정: ' + _nextEvt.event_time.substring(0,5) + ' ' + _nextEvt.title; }
  else if (_pendingTodos.length > 0) _aiTip = '할 일이 ' + _pendingTodos.length + '건 남아있어요.';
  else if (atd && atd.check_in && !atd.check_out && _h >= 17) _aiTip = '퇴근 시간이에요. 퇴근 처리할까요?';
  else if (_h >= 17) _aiTip = '오늘도 수고하셨어요!';
  else if (_todayEvts.length === 0 && _h < 12) _aiTip = '오늘 일정이 비어있어요. 계획을 세워볼까요?';
  else _aiTip = '필요하면 언제든 불러주세요!';

  document.getElementById('mainContent').innerHTML = `
    <!-- AI 비서 카드 -->
    <div onclick="startVoiceReport()" style="margin-bottom:16px; padding:16px; border-radius:16px; background:linear-gradient(135deg,#1e3a5f,#2d1b69); color:#fff; cursor:pointer; position:relative; overflow:hidden;">
      <div style="position:absolute; top:-20px; right:-20px; width:100px; height:100px; border-radius:50%; background:rgba(124,58,237,.2);"></div>
      <div style="position:absolute; bottom:-30px; right:40px; width:80px; height:80px; border-radius:50%; background:rgba(59,130,246,.15);"></div>
      <div style="display:flex; align-items:center; gap:12px; position:relative;">
        <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg,#7c3aed,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; box-shadow:0 4px 12px rgba(124,58,237,.4);">&#129302;</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="font-size:11px; background:rgba(255,255,255,.15); padding:2px 8px; border-radius:10px;">AI 업무비서</span>
            <span style="font-size:11px; opacity:.6;">${_tgEmoji} ${_tgMsg}</span>
          </div>
          <p style="font-size:14px; font-weight:500; line-height:1.4;">${currentUser.name}님, ${_aiTip}</p>
          ${_aiUrgent ? `<p style="font-size:11px; color:#f87171; margin-top:3px; animation:pulse 2s infinite;">${_aiUrgent}</p>` : ''}
          ${_streakCount > 0 ? `<p style="font-size:11px; color:#fbbf24; margin-top:3px;">🔥 오늘 ${_streakCount}건 작성 완료!</p>` : ''}
        </div>
        <div style="font-size:24px; opacity:.6;">🎤</div>
      </div>
      ${_todayEvts.length > 0 ? `
      <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.1);">
        <p style="font-size:11px; opacity:.5; margin-bottom:6px;">📋 오늘 일정 ${_todayEvts.length}건</p>
        ${_todayEvts.slice(0,4).map(e => {
          const isPast = e.event_time && e.event_time < String(_h).padStart(2,'0') + ':' + String(new Date().getMinutes()).padStart(2,'0');
          const isSoon = e.event_time && !isPast && _nextEvt && e.id === _nextEvt.id;
          const style = isPast ? 'opacity:.4; text-decoration:line-through;' : isSoon ? 'background:rgba(251,191,36,.15); border:1px solid rgba(251,191,36,.3);' : 'background:rgba(255,255,255,.06);';
          return `<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; margin-bottom:4px; ${style}">
            <span style="font-size:12px; font-weight:600; min-width:40px;">${e.event_time ? e.event_time.substring(0,5) : '--:--'}</span>
            <span style="font-size:12px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.title}</span>
            ${isSoon ? '<span style="font-size:9px; background:#fbbf24; color:#000; padding:1px 5px; border-radius:6px; font-weight:700;">다음</span>' : ''}
            ${isPast ? '<span style="font-size:9px; opacity:.5;">완료</span>' : ''}
          </div>`;
        }).join('')}
        ${_todayEvts.length > 4 ? `<p style="font-size:11px; opacity:.4; text-align:center; margin-top:4px;">+${_todayEvts.length - 4}건 더...</p>` : ''}
      </div>` : ''}
      <!-- 비서 빠른 명령 -->
      <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.1); display:flex; gap:8px;" onclick="event.stopPropagation();">
        <button onclick="openAiChat()" style="flex:1; padding:8px; border-radius:10px; border:1px solid rgba(124,58,237,.4); background:rgba(124,58,237,.15); color:#fff; font-size:12px; cursor:pointer; font-weight:600;">💬 채팅</button>
        <button onclick="startVoiceReport()" style="flex:1; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06); color:#fff; font-size:12px; cursor:pointer;">🎤 음성</button>
        <button onclick="openNewReport()" style="flex:1; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06); color:#fff; font-size:12px; cursor:pointer;">📝 보고서</button>
        <button onclick="navigate('calendar')" style="flex:1; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06); color:#fff; font-size:12px; cursor:pointer;">📅 일정</button>
        <button onclick="navigate('todos')" style="flex:1; padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06); color:#fff; font-size:12px; cursor:pointer;">✅ 할일</button>
      </div>
    </div>

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
      <div class="stat-card" onclick="navigate('todo')">
        <div class="stat-number">${d.todos_pending || 0}</div>
        <div class="stat-label">할일 남음</div>
      </div>
      <div class="stat-card" onclick="navigate('calendar')">
        <div class="stat-number">${d.event_week_count || 0}</div>
        <div class="stat-label">이번주 일정</div>
      </div>
      ${d.pending_approvals > 0 ? `
      <div class="stat-card" style="border:2px solid var(--danger); cursor:pointer;" onclick="navigate('reports')">
        <div class="stat-number" style="color:var(--danger);">${d.pending_approvals}</div>
        <div class="stat-label">결재대기</div>
      </div>` : `
      <div class="stat-card" onclick="navigate('attendance')">
        <div class="stat-number">${d.att_week_count || 0}일</div>
        <div class="stat-label">이번주 출근</div>
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
      <button class="quick-action-btn" onclick="showVolunteerPage()" style="border:2px solid #db2777;" data-help="참여한 봉사활동을 기록하고 누적 봉사시간을 관리합니다. (본인만 봅니다)">
        <span class="qa-icon">&#129309;</span>
        <span class="qa-label" style="color:#db2777; font-weight:700;">봉사활동</span>
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
      <button class="quick-action-btn" onclick="showVolunteerReview()" style="border:2px solid #0284c7;" data-help="지국이 요청한 봉사 계획을 승인하고, 완료건을 감사확인합니다.">
        <span class="qa-icon">&#9989;</span>
        <span class="qa-label" style="color:#0284c7; font-weight:700;">봉사 승인·감사</span>
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

    ${currentUser && currentUser.isAdmin ? `
    <p class="section-title">&#128295; 개발자 도구</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showWorkshopRoster()" style="border:2px solid #c2410c;" data-help="워크숍 참석 명단을 작성합니다. 앱의 관리담당자를 불러오고 추가 인원을 더해 엑셀 양식으로 내려받습니다.">
        <span class="qa-icon">&#128203;</span>
        <span class="qa-label" style="color:#c2410c; font-weight:700;">워크샵 명단</span>
      </button>
      <button class="quick-action-btn" onclick="showVolunteerReview()" style="border:2px solid #7c3aed;" data-help="완료된 봉사활동을 감사확인 처리합니다. 감사실/개발자 전용.">
        <span class="qa-icon">&#128270;</span>
        <span class="qa-label" style="color:#7c3aed; font-weight:700;">봉사 감사확인</span>
      </button>
    </div>` : ''}

    <p class="section-title">&#9881; 설정</p>
    <div class="quick-actions">
      <button class="quick-action-btn" onclick="showNavSettings()" style="border:2px solid var(--primary); background:#fff7ed;">
        <span class="qa-icon">&#128295;</span>
        <span class="qa-label" style="color:var(--primary); font-weight:700;">네비 설정</span>
      </button>
      <button class="quick-action-btn" onclick="showAppFAQ()" style="border:2px solid #6366f1; background:#eef2ff;">
        <span class="qa-icon">&#10068;</span>
        <span class="qa-label" style="color:#6366f1; font-weight:700;">사용 도움말</span>
      </button>
      <button class="quick-action-btn" onclick="installApp()" style="border:2px solid #10b981; background:#ecfdf5;">
        <span class="qa-icon">&#128241;</span>
        <span class="qa-label" style="color:#10b981; font-weight:700;">홈 화면에 추가</span>
      </button>
    </div>

    <div class="card">
      <p class="card-title" style="margin-bottom:8px;">시스템 정보</p>
      <p style="font-size:14px; color:var(--gray-500);">WorkFlow - Smart Work Manager v3.0</p>
    </div>
  `;
}

// ─── 홈 화면 추가 ───
function installApp() {
  if (_deferredInstallPrompt) {
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') showResultModal('success', '설치 완료', '홈 화면에 앱이 추가되었습니다!', '확인');
      _deferredInstallPrompt = null;
    });
    return;
  }
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);
  let guide = '';
  if (isIOS) {
    guide = `<div style="text-align:left; line-height:1.8;">
      <p><strong>Safari에서 추가하는 방법:</strong></p>
      <p>1. 하단의 <strong>공유 버튼</strong> &#9757; 을 탭하세요</p>
      <p>2. <strong>"홈 화면에 추가"</strong>를 선택하세요</p>
      <p>3. 오른쪽 상단 <strong>"추가"</strong>를 탭하세요</p>
    </div>`;
  } else if (isSamsung) {
    guide = `<div style="text-align:left; line-height:1.8;">
      <p><strong>삼성 인터넷에서 추가하는 방법:</strong></p>
      <p>1. 우측 하단의 <strong>&#9776; 메뉴</strong>를 탭하세요</p>
      <p>2. <strong>"현재 페이지 추가"</strong>를 선택하세요</p>
      <p>3. <strong>"홈 화면"</strong>을 선택하세요</p>
    </div>`;
  } else {
    guide = `<div style="text-align:left; line-height:1.8;">
      <p><strong>Chrome에서 추가하는 방법:</strong></p>
      <p>1. 우측 상단의 <strong>&#8942; 메뉴</strong>를 탭하세요</p>
      <p>2. <strong>"홈 화면에 추가"</strong> 또는<br>&nbsp;&nbsp;&nbsp;<strong>"앱 설치"</strong>를 선택하세요</p>
    </div>`;
  }
  showResultModal('info', '📱 홈 화면에 추가', guide, '확인');
}

// ─── 사용 도움말 (FAQ) ───
function showAppFAQ() {
  const faqData = [
    { cat: '기본 사용법', icon: '📱', color: '#3b82f6', items: [
      { q: '로그인은 어떻게 하나요?', a: '연락처(전화번호)와 비밀번호를 입력하면 로그인됩니다. 처음 사용하시면 회원가입을 먼저 진행해주세요.' },
      { q: '비밀번호를 잊었어요', a: '로그인 화면에서 "비밀번호 재설정"을 누르면 이름과 연락처로 확인 후 새 비밀번호를 설정할 수 있어요.' },
      { q: '홈 화면에 앱을 추가하고 싶어요', a: '더보기 → 설정 → "홈 화면에 추가" 버튼을 누르면 브라우저별 안내가 나와요. 추가하면 앱처럼 바로 실행할 수 있어요.' },
      { q: '로그아웃은 어디서 하나요?', a: '화면 오른쪽 상단의 빨간 전원(⏻) 버튼을 누르면 로그아웃됩니다.' },
      { q: '하단 네비게이션 메뉴를 바꿀 수 있나요?', a: '더보기 → 설정 → "네비 설정"에서 원하는 메뉴 3개를 선택하면 하단 바를 맞춤 설정할 수 있어요.' },
      { q: '알림은 어떻게 확인하나요?', a: '상단 종(🔔) 아이콘을 누르면 공지사항, 댓글, 팀 활동 등 알림을 확인할 수 있어요.' },
    ]},
    { cat: '업무일지', icon: '📝', color: '#10b981', items: [
      { q: '업무일지는 어떻게 작성하나요?', a: '홈 화면 하단 + 버튼 → "새 업무일지"를 누르거나, 업무일지 탭에서 + 버튼을 누르세요. 제목, 내용, 업무 분류를 입력하면 돼요.' },
      { q: '음성으로 업무일지를 작성할 수 있나요?', a: '네! + 버튼 → "AI 비서에게 말하기"를 누르면 음성으로 내용을 말하고 AI가 자동 정리해요. 홈 화면 AI 비서 카드의 🎤 버튼으로도 가능해요.' },
      { q: 'AI 다듬기는 뭔가요?', a: '음성이나 구어체로 입력한 내용을 AI가 보고서 형식으로 다듬어줘요. 불필요한 말("음", "그")을 제거하고, 문장을 정리하며, 육하원칙(5W1H)으로 자동 분류해요.' },
      { q: '육하원칙(5W1H) 카드는 뭔가요?', a: '"누가, 언제, 어디서, 무엇을, 어떻게, 왜"를 자동 분석해 카드로 보여줘요. 완성도 %가 표시되고, 빠진 항목은 비서가 팁으로 알려줘요.' },
      { q: '작성한 일지를 수정/삭제할 수 있나요?', a: '업무일지 목록에서 해당 일지를 누르면 상세 화면이 나와요. 본인이 작성한 일지는 수정, 삭제가 가능해요.' },
      { q: '다른 팀원의 일지도 볼 수 있나요?', a: '네, 업무일지 탭에서 "전체"를 선택하면 같은 팀 팀원들의 일지를 볼 수 있어요. 팀 설정에 따라 범위가 달라요.' },
    ]},
    { cat: 'AI 비서', icon: '🤖', color: '#7c3aed', items: [
      { q: 'AI 비서는 어떤 기능인가요?', a: '출근 시 자동으로 인사, 어제 업무 요약, 오늘 브리핑을 해주고, 출근 체크와 일정 등록까지 음성으로 도와주는 기능이에요.' },
      { q: 'AI 비서가 자동으로 알림을 주나요?', a: '네! 5가지 자동 알림이 있어요:\n• 일정 10분 전 알림\n• 기한 지난 할 일 알림 (오전)\n• 업무일지 미작성 알림 (오후)\n• 빈 일정 안내 (오전)\n• 퇴근 미처리 알림 (저녁)' },
      { q: '음성 안내를 끄고 싶어요', a: '현재 음성 가이드가 말하는 중에 "닫기" 버튼을 누르면 음성이 중단돼요. 음성 가이드는 하루에 한 번만 자동 실행되고, 이후에는 직접 호출해야 해요.' },
      { q: 'AI 비서가 안 나타나요', a: '음성 가이드는 하루 1회 자동 실행됩니다. 이미 실행된 경우 다시 나타나지 않아요. 홈의 AI 비서 카드를 누르면 음성 기록을 시작할 수 있어요.' },
      { q: '녹음 중 비서 힌트는 뭔가요?', a: '음성 녹음 중 화면 하단에 다음 일정, 기한 초과 할 일 등 맥락 정보를 표시해줘요. 보고서 작성에 참고하시면 돼요.' },
    ]},
    { cat: '일정 / 할 일', icon: '📅', color: '#f59e0b', items: [
      { q: '일정은 어떻게 등록하나요?', a: '더보기 → 팀 일정 또는 업무 캘린더에서 날짜를 선택하고 + 버튼으로 등록하세요. AI 비서 음성가이드에서 말로 등록할 수도 있어요.' },
      { q: '일정 알림은 언제 오나요?', a: '등록된 일정 시간 10분 전에 AI 비서가 팝업과 음성으로 알려줘요. 시간이 입력된 일정만 해당돼요.' },
      { q: '할 일은 어떻게 관리하나요?', a: '더보기 → 할 일 관리에서 추가/완료 처리/삭제할 수 있어요. 기한을 설정하면 기한 초과 시 AI 비서가 알려줘요.' },
      { q: '기한 지난 할 일 알림을 받고 싶어요', a: '할 일에 기한(마감일)을 설정해두면 오전 9~10시에 자동으로 알림이 와요. 음성가이드 브리핑에서도 안내해줘요.' },
      { q: '캘린더에서 일정을 한눈에 볼 수 있나요?', a: '더보기 → 업무 캘린더에서 월별/주별로 모든 일정을 확인할 수 있어요. 홈 화면 AI 비서 카드에서도 오늘 일정 목록이 표시돼요.' },
    ]},
    { cat: '출퇴근', icon: '⏰', color: '#6366f1', items: [
      { q: '출근 체크는 어떻게 하나요?', a: 'AI 비서 음성가이드가 아침에 자동으로 출근 체크를 도와줘요. 또는 더보기 → 출퇴근 기록에서 직접 체크할 수 있어요.' },
      { q: '퇴근 처리는 어떻게 하나요?', a: '더보기 → 출퇴근 기록에서 퇴근 버튼을 누르거나, 저녁 7시 이후에는 AI 비서가 퇴근 알림을 보내줘요.' },
      { q: '출퇴근 기록을 확인하고 싶어요', a: '더보기 → 출퇴근 기록에서 이번 달의 출퇴근 내역, 근무 유형(내근/외근/출장), 시간을 확인할 수 있어요.' },
      { q: '근무 유형(내근/외근/출장)은 어떻게 바꾸나요?', a: '출근 체크 시 근무 유형을 선택할 수 있어요. AI 음성가이드에서는 "외근" 또는 "출장"이라고 말하면 자동 인식돼요.' },
    ]},
    { cat: '소통 / 기타', icon: '💬', color: '#ec4899', items: [
      { q: '공지사항은 어디서 보나요?', a: '더보기 → 공지사항에서 확인할 수 있어요. 중요 공지는 상단에 고정 표시되고, 홈 화면에도 최신 공지가 나와요.' },
      { q: '팀 게시판은 어떻게 사용하나요?', a: '더보기 → 팀 게시판에서 자유/질문/정보공유/건의 카테고리로 글을 작성하고 댓글을 달 수 있어요.' },
      { q: '즐겨찾기 기능이 있나요?', a: '네! 업무일지나 주요 항목에 별표(⭐)를 누르면 즐겨찾기에 추가돼요. 더보기 → 즐겨찾기에서 모아볼 수 있어요.' },
      { q: '통합 검색은 어떻게 하나요?', a: '상단 돋보기(🔍) 아이콘을 누르면 업무일지, 일정, 할 일, 게시글 등 모든 내용을 한번에 검색할 수 있어요.' },
      { q: '빠른 메모 기능이 있나요?', a: '더보기 → 빠른 메모에서 간단한 메모를 작성할 수 있어요. 업무일지로 변환하기 전 아이디어를 빠르게 기록할 때 유용해요.' },
      { q: '주간 보고서/월간 요약은 뭔가요?', a: '이번 주 또는 이번 달 작성한 업무일지를 자동으로 요약 정리해주는 기능이에요. 더보기 → 분석 & 인사이트에서 확인하세요.' },
    ]},
  ];

  let openCat = 0;
  let openQ = -1;

  function renderFAQ() {
    return faqData.map((cat, ci) => {
      const isOpen = openCat === ci;
      return `<div style="margin-bottom:8px;">
        <button onclick="toggleFaqCat(${ci})" style="width:100%; display:flex; align-items:center; gap:10px; padding:14px 16px; background:${isOpen ? cat.color + '10' : '#fff'}; border:1px solid ${isOpen ? cat.color + '40' : '#e5e7eb'}; border-radius:12px; cursor:pointer; text-align:left;">
          <span style="font-size:20px;">${cat.icon}</span>
          <span style="flex:1; font-size:15px; font-weight:600; color:${isOpen ? cat.color : '#374151'};">${cat.cat}</span>
          <span style="font-size:12px; color:#9ca3af; background:#f3f4f6; padding:2px 8px; border-radius:10px;">${cat.items.length}개</span>
          <span style="font-size:14px; color:#9ca3af; transition:transform .2s; transform:rotate(${isOpen ? '180' : '0'}deg);">&#9660;</span>
        </button>
        ${isOpen ? `<div style="padding:4px 0 0 0;">
          ${cat.items.map((item, qi) => {
            const qOpen = openQ === qi;
            return `<div style="margin:4px 0; border-radius:10px; overflow:hidden; border:1px solid ${qOpen ? cat.color + '30' : '#f3f4f6'};">
              <button onclick="toggleFaqQ(${qi})" style="width:100%; display:flex; align-items:center; gap:8px; padding:12px 14px; background:${qOpen ? '#fafafa' : '#fff'}; border:none; cursor:pointer; text-align:left;">
                <span style="width:20px; height:20px; border-radius:50%; background:${cat.color}15; color:${cat.color}; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">Q</span>
                <span style="flex:1; font-size:14px; color:#1f2937; font-weight:500;">${item.q}</span>
                <span style="font-size:12px; color:#9ca3af; transform:rotate(${qOpen ? '180' : '0'}deg);">&#9660;</span>
              </button>
              ${qOpen ? `<div style="padding:0 14px 14px 42px; animation:vrCardIn .3s both;">
                <p style="font-size:13px; color:#4b5563; line-height:1.7; white-space:pre-line;">${item.a}</p>
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;
    }).join('');
  }

  window.toggleFaqCat = function(ci) { openCat = openCat === ci ? -1 : ci; openQ = -1; document.getElementById('faqList').innerHTML = renderFAQ(); };
  window.toggleFaqQ = function(qi) { openQ = openQ === qi ? -1 : qi; document.getElementById('faqList').innerHTML = renderFAQ(); };

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
      <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:22px; color:#fff;">&#10068;</div>
      <div>
        <p style="font-size:18px; font-weight:700; color:#1f2937;">사용 도움말</p>
        <p style="font-size:13px; color:#6b7280;">자주 묻는 질문과 답변을 확인하세요</p>
      </div>
    </div>
    <div style="margin-bottom:16px; position:relative;">
      <input type="text" id="faqSearch" class="form-control" placeholder="궁금한 내용을 검색하세요..." oninput="searchFAQ(this.value)" style="padding-left:36px;">
      <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:16px; color:#9ca3af;">&#128269;</span>
    </div>
    <div id="faqSearchResult" style="display:none; margin-bottom:16px;"></div>
    <div id="faqList">${renderFAQ()}</div>
    <div class="card" style="margin-top:16px; text-align:center; background:linear-gradient(135deg,#eef2ff,#faf5ff); border:1px solid #c7d2fe;">
      <p style="font-size:14px; color:#4338ca; font-weight:600; margin-bottom:4px;">찾는 답이 없나요?</p>
      <p style="font-size:13px; color:#6366f1;">상단 &#10067; 도움말 모드를 켜면 각 버튼의 기능을 확인할 수 있어요.</p>
    </div>
  `;

  window.searchFAQ = function(keyword) {
    const k = keyword.trim().toLowerCase();
    const resultEl = document.getElementById('faqSearchResult');
    const listEl = document.getElementById('faqList');
    if (!k) { resultEl.style.display = 'none'; listEl.style.display = 'block'; return; }
    const matches = [];
    faqData.forEach(cat => {
      cat.items.forEach(item => {
        if (item.q.toLowerCase().includes(k) || item.a.toLowerCase().includes(k)) {
          matches.push({ cat: cat.cat, icon: cat.icon, color: cat.color, q: item.q, a: item.a });
        }
      });
    });
    if (matches.length === 0) {
      resultEl.innerHTML = '<div class="card" style="text-align:center; color:#9ca3af; padding:24px;"><p style="font-size:24px; margin-bottom:8px;">&#128533;</p><p>검색 결과가 없습니다</p></div>';
    } else {
      resultEl.innerHTML = `<p style="font-size:13px; color:#6b7280; margin-bottom:8px;">${matches.length}개 결과</p>` +
        matches.map(m => `<div style="background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:14px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            <span style="font-size:14px;">${m.icon}</span>
            <span style="font-size:11px; color:${m.color}; font-weight:600;">${m.cat}</span>
          </div>
          <p style="font-size:14px; font-weight:600; color:#1f2937; margin-bottom:6px;">${m.q.replace(new RegExp(k, 'gi'), '<mark style="background:#fef08a;">$&</mark>')}</p>
          <p style="font-size:13px; color:#4b5563; line-height:1.6; white-space:pre-line;">${m.a.replace(new RegExp(k, 'gi'), '<mark style="background:#fef08a;">$&</mark>')}</p>
        </div>`).join('');
    }
    resultEl.style.display = 'block';
    listEl.style.display = 'none';
  };
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

// ─── 봉사 대상 가맹점 당월 일정상태 ───
async function loadBranchServiceStatus(force) {
  if (!force && window._branchSvcStatus) return window._branchSvcStatus;
  const data = await api('/api/branches/service-status');
  if (data) {
    window._branchSvcStatus = data.statuses || {};
    window._branchSvcTarget = data.target || 2;
  }
  return window._branchSvcStatus || {};
}

// 봉사 대상 가맹점 행에 표시할 상태 배지 (지국 등 비대상은 빈 문자열)
function branchStatusBadgeHtml(branchId) {
  const map = window._branchSvcStatus || {};
  const s = map[branchId];
  if (!s) return ''; // 봉사 대상 아님(지국·물류·본사 등) → 표시 없음
  const target = window._branchSvcTarget || 2;
  if (s.status === 'none' || !s.count) {
    return '<span class="svc-badge svc-none">미계획</span>';
  }
  const label = { approved: '승인', requested: '요청', planned: '계획' }[s.status] || '계획';
  const cls = { approved: 'svc-approved', requested: 'svc-requested', planned: 'svc-planned' }[s.status] || 'svc-planned';
  return `<span class="svc-badge ${cls}">${label} · 이번달 ${s.count}/${target}회</span>`;
}

// ─── 전국 지국 열람 ───
async function showBranches(pg) {
  const [branches] = await Promise.all([
    api('/api/branches').then(r => r || []),
    loadBranchServiceStatus(true)
  ]);
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
          ${branchStatusBadgeHtml(b.id)}
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
  if (_submitting) { showResultModal('warn', '처리 중', '이미 가입 처리가 진행 중입니다.\n잠시 기다려주세요.', '확인'); return; }
  const btn = document.getElementById('regSubmitBtn') || document.querySelector('#regStep2 .btn-success');
  let safetyTimer;
  function resetBtn() {
    clearTimeout(safetyTimer);
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
    safetyTimer = setTimeout(() => { resetBtn(); showResultModal('error', '서버 응답 없음', '서버가 응답하지 않습니다.\n잠시 후 다시 시도해주세요.', '확인'); }, 30000);
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
  // 지국 결과가 있으면 당월 봉사 일정상태 맵 준비
  if (data.results.some(r => r.type === 'branch')) await loadBranchServiceStatus();

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
              ${r.type === 'branch' ? `<div style="margin-top:4px;">${branchStatusBadgeHtml(r.id)}</div>` : ''}
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
  else if (type === 'event') navigate('calendar');
  else if (type === 'todo') navigate('todo');
  else if (type === 'note') navigate('notes');
  else if (type === 'board') showBoardPost(id);
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

  const [d, monthEvents] = await Promise.all([
    api(`/api/calendar?month=${workCalMonth}`),
    api(`/api/events?month=${workCalMonth}`).then(r => r || [])
  ]);
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

    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; margin-bottom:10px;">
      <p class="section-title" style="margin:0;">&#128197; 이번 달 일정 (${monthEvents.length}건)</p>
      <button class="btn btn-primary btn-sm" onclick="showEventForm()">+ 일정 추가</button>
    </div>
    ${monthEvents.length === 0 ? '<p style="font-size:13px; color:var(--gray-500); text-align:center; padding:16px;">등록된 일정이 없습니다</p>' :
      monthEvents.map(e => {
        const eDate = (e.event_date||'').split('T')[0];
        const typeColors = { '회의': '#3b82f6', '마감': '#ef4444', '행사': '#10b981', '출장': '#f59e0b', '기타': '#6366f1' };
        const color = typeColors[e.event_type] || '#6366f1';
        const isAuthor = currentUser && (e.author_id === currentUser.id || currentUser.isAdmin);
        return '<div class="card" style="padding:10px; margin-bottom:6px; border-left:3px solid ' + color + ';">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-start;">' +
            '<div style="flex:1;">' +
              '<div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">' +
                '<span style="font-size:10px; padding:1px 6px; border-radius:3px; background:' + color + '22; color:' + color + '; font-weight:600;">' + escHtml(e.event_type) + '</span>' +
                '<span style="font-size:12px; color:' + (eDate === today ? 'var(--primary)' : 'var(--gray-500)') + '; font-weight:' + (eDate === today ? '700' : '400') + ';">' + eDate + (e.event_time ? ' ' + e.event_time : '') + '</span>' +
              '</div>' +
              '<div style="font-size:14px; font-weight:600;">' + escHtml(e.title) + '</div>' +
              (e.description ? '<div style="font-size:12px; color:var(--gray-500); margin-top:2px;">' + escHtml(e.description) + '</div>' : '') +
            '</div>' +
            (isAuthor ? '<button onclick="deleteEvent(\'' + e.id + '\')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px; padding:2px;">&times;</button>' : '') +
          '</div>' +
        '</div>';
      }).join('')}
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

// ─── 봉사 성장 정원 (등급→식물). 로드맵: 차후 등급별 세부 종류는 여기 매핑만 확장 ───
const GARDEN_EMOJI = {
  sprout: { emoji: '🌱', label: '새싹' },
  leaf:   { emoji: '🌿', label: '잎' },
  tree:   { emoji: '🌳', label: '나무' },
  flower: { emoji: '🌸', label: '꽃나무' },
  forest: { emoji: '🌲', label: '숲' }
};

function renderGardenPanel(garden) {
  if (!garden) return '';
  const counts = garden.counts || { planned: 0, completed: 0 };
  const plants = garden.plants || [];
  const plantsHtml = plants.length === 0
    ? '<div style="font-size:12px; color:var(--gray-500); text-align:center; padding:10px;">아직 정원에 심긴 지국이 없어요. 봉사활동을 <b>완료로 등록</b>하면 싹이 틉니다 🌱</div>'
    : `<div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${plants.map((p, i) => {
          const g = GARDEN_EMOJI[p.tier] || GARDEN_EMOJI.sprout;
          const crown = i < 3 ? '<span style="position:absolute; top:-8px; right:-4px; font-size:12px;">👑</span>' : '';
          return `<div style="position:relative; min-width:64px; text-align:center; background:var(--gray-50, #f8fafc); border:1px solid var(--gray-100); border-radius:10px; padding:8px 6px;">
            ${crown}
            <div style="font-size:26px; line-height:1;">${g.emoji}</div>
            <div style="font-size:11px; color:var(--gray-700); margin-top:3px; word-break:keep-all;">${escHtml(p.name)}</div>
          </div>`;
        }).join('')}
      </div>`;

  return `
    <div class="card" style="padding:12px; margin-bottom:16px; border:1px solid var(--primary-light);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:14px; font-weight:700;">🌱 봉사 성장 정원</span>
        <span style="font-size:11px; color:var(--gray-400);">완료 등록할수록 무성해져요</span>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:12px; font-size:12px; margin-bottom:10px;">
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#f59e0b;"></span>계획 <b>${counts.planned || 0}</b></span>
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#1d4ed8;"></span>승인 <b>${counts.approved || 0}</b></span>
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#15803d;"></span>완료 <b>${counts.completed || 0}</b></span>
        <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:2px; background:#7c3aed;"></span>감사확인 <b>${counts.audited || 0}</b></span>
        <span style="font-size:11px; color:var(--gray-400);">(이번 달)</span>
      </div>
      ${plantsHtml}
    </div>`;
}

async function showSchedulePage() {
  const [events, garden] = await Promise.all([
    api(`/api/events?month=${scheduleMonth}`).then(r => r || []),
    api('/api/garden')
  ]);
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

    ${renderGardenPanel(garden)}

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
  if (res) { toast('일정이 등록되었습니다'); if (currentPage === 'calendar') showWorkCalendar(); else showSchedulePage(); }
}

async function deleteEvent(id) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  const res = await api(`/api/events/${id}`, { method: 'DELETE' });
  if (res) { toast('삭제되었습니다'); if (currentPage === 'calendar') showWorkCalendar(); else showSchedulePage(); }
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
  if (res) {
    // AI 비서 퇴근 리포트
    const today = new Date().toISOString().split('T')[0];
    const [reports, todayEvents] = await Promise.all([
      api(`/api/reports?from=${today}&to=${today}`),
      api('/api/calendar-events?date=' + today)
    ]);
    const myReports = (reports || []).filter(r => r.author_id === currentUser.id);
    const evtCount = (todayEvents || []).length;
    const checkIn = res.check_in ? res.check_in.substring(11,16) : '';
    const checkOut = res.check_out ? res.check_out.substring(11,16) : '';

    let summary = `오늘 하루 수고하셨어요! 🌙\n\n`;
    summary += `⏰ 근무시간: ${checkIn} ~ ${checkOut}`;
    if (res.check_in && res.check_out) {
      const mins = Math.floor((new Date(res.check_out) - new Date(res.check_in)) / 60000);
      summary += ` (${Math.floor(mins/60)}시간 ${mins%60}분)`;
    }
    summary += `\n📝 보고서: ${myReports.length}건 작성`;
    if (evtCount > 0) summary += `\n📅 일정: ${evtCount}건 처리`;
    if (myReports.length >= 3) summary += `\n\n🔥 오늘 많이 하셨네요! 푹 쉬세요.`;
    else summary += `\n\n내일도 좋은 하루 되세요!`;

    showResultModal('success', '🤖 AI 비서 — 퇴근 리포트', summary, '확인');
    renderHome();
  }
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
let _vrTimerInterval = null;
let _vrStartTime = 0;
let _vrAudioCtx = null;
let _vrAnalyser = null;
let _vrAnimFrame = null;

function _vrStartTimer() {
  _vrStartTime = Date.now();
  const el = document.getElementById('vrTimer');
  if (el) el.textContent = '00:00';
  _vrTimerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - _vrStartTime) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    if (el) el.textContent = m + ':' + s;
  }, 1000);
}

function _vrStopTimer() {
  if (_vrTimerInterval) { clearInterval(_vrTimerInterval); _vrTimerInterval = null; }
}

function _vrStartWaveform(stream) {
  try {
    _vrAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = _vrAudioCtx.createMediaStreamSource(stream);
    _vrAnalyser = _vrAudioCtx.createAnalyser();
    _vrAnalyser.fftSize = 64;
    source.connect(_vrAnalyser);
    const bars = document.querySelectorAll('.vr-bar');
    const dataArr = new Uint8Array(_vrAnalyser.frequencyBinCount);
    function draw() {
      _vrAnimFrame = requestAnimationFrame(draw);
      _vrAnalyser.getByteFrequencyData(dataArr);
      bars.forEach((bar, i) => {
        const idx = Math.floor(i * dataArr.length / bars.length);
        const val = dataArr[idx] || 0;
        const h = Math.max(6, (val / 255) * 50);
        bar.style.height = h + 'px';
      });
    }
    draw();
  } catch (_) {}
}

function _vrStopWaveform() {
  if (_vrAnimFrame) { cancelAnimationFrame(_vrAnimFrame); _vrAnimFrame = null; }
  if (_vrAudioCtx) { _vrAudioCtx.close().catch(() => {}); _vrAudioCtx = null; }
  _vrAnalyser = null;
  document.querySelectorAll('.vr-bar').forEach(b => { b.style.height = '8px'; });
}

function _vrTypeText(el, finalText, interimText) {
  const cursor = document.getElementById('vrCursor');
  if (!finalText && !interimText) {
    el.innerHTML = '<span style="color:rgba(255,255,255,.3);">말씀해 주세요...</span>';
    if (cursor) cursor.style.display = 'inline-block';
    return;
  }
  let html = '';
  if (finalText) html += '<span style="color:#e2e8f0;">' + finalText.replace(/</g,'&lt;') + '</span>';
  if (interimText) html += '<span style="color:rgba(124,58,237,.7); font-style:italic;">' + interimText.replace(/</g,'&lt;') + '</span>';
  el.innerHTML = html;
  if (cursor) cursor.style.display = interimText ? 'inline-block' : 'none';
}

function _vrUpdateLiveTags(text) {
  if (!text) return;
  const tags = [];
  const checks = [
    { key:'when', label:'언제', color:'#f59e0b', patterns:[/(?:오전|오후)\s*\d{1,2}시/, /\d{1,2}월\s*\d{1,2}일/, /(?:어제|오늘|내일|모레)/, /(?:월|화|수|목|금|토|일)요일/] },
    { key:'where', label:'어디서', color:'#34d399', patterns:[/(?:본사|지사|사무실|현장|센터|회의실|공장|매장|지점)/, /(?:서울|부산|대구|인천|광주|대전|울산|경기|제주)/] },
    { key:'who', label:'누가', color:'#60a5fa', patterns:[/[가-힣]{2,4}\s*(?:님|과장|대리|차장|부장|팀장|사원|주임|매니저|선임)/, /(?:제가|본인|담당자)/] },
    { key:'what', label:'무엇을', color:'#f472b6', patterns:[/(?:회의|미팅|점검|교육|상담|보고서|작성|처리|확인|검토|영업|계약|협의)/] },
    { key:'how', label:'어떻게', color:'#a78bfa', patterns:[/(?:전화|이메일|대면|온라인|방문|출장|화상)/] },
    { key:'why', label:'왜', color:'#fb923c', patterns:[/(?:위해|때문에|건으로|관련|요청|지시)/] }
  ];
  for (const c of checks) {
    for (const p of c.patterns) {
      if (p.test(text)) { tags.push(c); break; }
    }
  }
  const el = document.getElementById('vrLiveTags');
  if (el) {
    el.innerHTML = tags.map(t =>
      `<span style="font-size:10px; padding:3px 8px; border-radius:10px; background:${t.color}22; color:${t.color}; border:1px solid ${t.color}44; animation:vrCardIn .3s both;">${t.label} ✓</span>`
    ).join('');
  }
  const wcEl = document.getElementById('vrWordCount');
  if (wcEl) {
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    wcEl.textContent = words + ' 단어';
    if (words >= 20) wcEl.style.color = '#22c55e';
    else if (words >= 10) wcEl.style.color = '#f59e0b';
    else wcEl.style.color = 'rgba(255,255,255,.3)';
  }
}

function startVoiceReport() {
  if (!SpeechRecognition) { toast('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Safari를 사용해주세요.'); return; }

  const screen = document.getElementById('voiceRecordScreen');
  screen.style.display = 'flex';
  _vrFinalText = '';
  _vrInterim = '';
  _vrProcessed = 0;
  const vrTextEl = document.getElementById('vrText');
  _vrTypeText(vrTextEl, '', '');
  document.getElementById('vrTitle').textContent = '듣고 있습니다';
  document.getElementById('vrSubtitle').textContent = '말씀하신 내용을 AI가 실시간으로 분석합니다';
  const liveTagsEl = document.getElementById('vrLiveTags');
  if (liveTagsEl) liveTagsEl.innerHTML = '';
  const wcEl = document.getElementById('vrWordCount');
  if (wcEl) { wcEl.textContent = '0 단어'; wcEl.style.color = 'rgba(255,255,255,.3)'; }
  const confEl = document.getElementById('vrConfidence');
  if (confEl) confEl.textContent = '';
  const orbCore = document.getElementById('vrOrbCore');
  if (orbCore) orbCore.style.background = 'linear-gradient(135deg,#7c3aed,#3b82f6)';
  const orbGlow = document.getElementById('vrOrbGlow');
  if (orbGlow) orbGlow.style.animation = 'vrOrbPulse 2s ease-in-out infinite';

  _vrStartTimer();

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    _vrStartWaveform(stream);
    stream.getTracks().forEach(t => { t._vrTrack = true; });
    window._vrStream = stream;
  }).catch(() => {});

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
    _vrTypeText(vrTextEl, _vrFinalText.trim(), interim);
    _vrUpdateLiveTags((_vrFinalText + interim).trim());
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
      document.getElementById('vrTitle').textContent = '소리가 감지되지 않았습니다';
      document.getElementById('vrSubtitle').textContent = '다시 말씀해 주세요';
    }
  };

  recog.start();

  // 비서 멘트: 녹음 중 맥락 힌트 + 격려
  const subtitleEl = document.getElementById('vrSubtitle');
  const hints = [
    '말씀하신 내용을 AI가 실시간으로 분석합니다',
    '잘 듣고 있어요, 천천히 말씀하세요',
    '누가, 언제, 어디서 등을 말하면 자동 분류돼요',
    '다 말씀하시면 완료 버튼을 눌러주세요'
  ];
  // 맥락 힌트 동적 추가
  try {
    const _td = new Date().toISOString().split('T')[0];
    const _nm2 = new Date().getHours() * 60 + new Date().getMinutes();
    api('/api/calendar-events?date=' + _td).then(evs => {
      if (evs && evs.length > 0) {
        const nextE = evs.find(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); return (eh*60+em) > _nm2; });
        if (nextE) hints.push('📅 다음 일정: ' + nextE.event_time.substring(0,5) + ' ' + nextE.title);
      }
    });
    api('/api/todos').then(todos => {
      const od = (todos || []).filter(t => !t.completed && t.due_date && t.due_date.split('T')[0] < _td);
      if (od.length > 0) hints.push('⚠️ 기한 지난 할 일 ' + od.length + '건 — 보고서에 포함해보세요');
      const pend = (todos || []).filter(t => !t.completed);
      if (pend.length > 0 && od.length === 0) hints.push('✅ 미완료 할 일 ' + pend.length + '건이 있어요');
    });
  } catch(_) {}
  let hintIdx = 0;
  window._vrHintTimer = setInterval(() => {
    if (!_vrRecog) { clearInterval(window._vrHintTimer); return; }
    hintIdx = (hintIdx + 1) % hints.length;
    if (subtitleEl) { subtitleEl.style.opacity = '0'; setTimeout(() => { subtitleEl.textContent = hints[hintIdx]; subtitleEl.style.opacity = '1'; }, 300); }
  }, 5000);
}

function cancelVoiceReport() {
  if (_vrRecog) { const r = _vrRecog; _vrRecog = null; r.stop(); }
  if (window._vrHintTimer) { clearInterval(window._vrHintTimer); window._vrHintTimer = null; }
  _vrStopTimer();
  _vrStopWaveform();
  if (window._vrStream) { window._vrStream.getTracks().forEach(t => t.stop()); window._vrStream = null; }
  document.getElementById('voiceRecordScreen').style.display = 'none';
  document.getElementById('vrRefineStep').style.display = 'none';
  document.getElementById('vrRecordingBtns').style.display = 'flex';
}

function finishVoiceReport() {
  if (_vrRecog) { const r = _vrRecog; _vrRecog = null; r.stop(); }
  if (window._vrHintTimer) { clearInterval(window._vrHintTimer); window._vrHintTimer = null; }
  _vrStopTimer();
  _vrStopWaveform();
  if (window._vrStream) { window._vrStream.getTracks().forEach(t => t.stop()); window._vrStream = null; }

  const text = (_vrFinalText + _vrInterim).trim();
  if (!text) { toast('음성이 인식되지 않았습니다'); cancelVoiceReport(); return; }

  localStorage.setItem('voiceCache', text);

  document.getElementById('vrRecordingBtns').style.display = 'none';
  const orbCore = document.getElementById('vrOrbCore');
  if (orbCore) orbCore.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
  const orbGlow = document.getElementById('vrOrbGlow');
  if (orbGlow) orbGlow.style.animation = 'none';

  // 비서 멘트: 완료 후 피드백
  const wordCount = text.split(/\s+/).length;
  let feedback = '깔끔하게 정리해드릴게요!';
  if (wordCount > 30) feedback = '내용이 풍부하네요! 꼼꼼하게 분석해드릴게요.';
  else if (wordCount < 5) feedback = '짧은 내용이지만 잘 정리해드릴게요.';
  document.getElementById('vrTitle').textContent = '인식 완료 ✓';
  document.getElementById('vrSubtitle').textContent = feedback;
  document.getElementById('vrText').innerHTML = '<span style="color:#e2e8f0;">' + text.replace(/</g,'&lt;') + '</span>';
  const cursor = document.getElementById('vrCursor');
  if (cursor) cursor.style.display = 'none';
  document.getElementById('vrRawText').textContent = text;
  document.getElementById('vrRefinedText').value = text;
  document.getElementById('vrRefinePreview').style.display = 'none';
  document.getElementById('vrRefineStep').style.display = 'block';

  // 자동 AI 다듬기 실행
  setTimeout(() => refineVoiceText(), 500);
}

function refineVoiceText() {
  const btn = document.getElementById('vrRefineBtn');
  btn.textContent = '분석 중...';
  btn.disabled = true;

  const raw = document.getElementById('vrRefinedText').value.trim();
  if (!raw) { toast('텍스트가 없습니다'); btn.textContent = '✨ AI 다듬기'; btn.disabled = false; return; }

  const analyzeEl = document.getElementById('vrAnalyzing');
  const statusEl = document.getElementById('vrAnalyzeStatus');
  analyzeEl.style.display = 'block';

  const steps = ['구어체를 문어체로 다듬고 있어요...', '불필요한 표현을 정리하고 있어요...', '육하원칙으로 분류하고 있어요...', '보고서에 맞게 정리 중이에요...'];
  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    stepIdx++;
    if (stepIdx < steps.length) statusEl.textContent = steps[stepIdx];
  }, 400);

  setTimeout(() => {
    clearInterval(stepTimer);
    analyzeEl.style.display = 'none';

    const refined = polishVoiceText(raw);
    document.getElementById('vrRefinedText').value = refined;

    const { html: cardsHtml, missing } = previewVoice5W1HCards(refined);
    document.getElementById('vrRefineFields').innerHTML = cardsHtml;
    document.getElementById('vrRefinePreview').style.display = 'block';

    // 빠진 항목 안내
    const missingArea = document.getElementById('vrMissingHint');
    if (missingArea) missingArea.remove();
    if (missing.length > 0 && missing.length <= 4) {
      const hintDiv = document.createElement('div');
      hintDiv.id = 'vrMissingHint';
      const missingNames = { when:'언제', where:'어디서', who:'누가', what:'무엇을', how:'어떻게', why:'왜' };
      const missingList = missing.map(k => missingNames[k]).join(', ');
      hintDiv.innerHTML = `<div style="background:rgba(251,191,36,.1); border:1px solid rgba(251,191,36,.2); border-radius:12px; padding:12px; margin-bottom:12px; text-align:left; animation:vrCardIn .4s both;">
        <p style="font-size:12px; color:#fbbf24; margin-bottom:4px;">💡 비서 팁</p>
        <p style="font-size:13px; color:#e2e8f0; line-height:1.5;">'${missingList}' 정보가 빠져있어요. 위 텍스트에 추가하면 보고서가 더 완성도 높아져요!</p>
      </div>`;
      document.getElementById('vrRefinePreview').after(hintDiv);
    }

    // 연관 작업 제안 — 일정/할일과 연동
    const oldSuggest = document.getElementById('vrActionSuggest');
    if (oldSuggest) oldSuggest.remove();
    const _td2 = new Date().toISOString().split('T')[0];
    Promise.all([api('/api/calendar-events?date=' + _td2), api('/api/todos')]).then(([evts, todos]) => {
      const suggestions = [];
      const od = (todos || []).filter(t => !t.completed && t.due_date && t.due_date.split('T')[0] < _td2);
      const pend = (todos || []).filter(t => !t.completed);
      if (od.length > 0) suggestions.push({ icon: '⚠️', text: '기한 지난 할 일 ' + od.length + '건', btn: '할 일 보기', action: "cancelVoiceReport();navigate('todos')" });
      const nm3 = new Date().getHours() * 60 + new Date().getMinutes();
      const nextE2 = (evts || []).find(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); return (eh*60+em) > nm3; });
      if (nextE2) { const diff2 = parseInt(nextE2.event_time) * 60 + parseInt(nextE2.event_time.split(':')[1]) - nm3; if (diff2 <= 30) suggestions.push({ icon: '⏰', text: diff2 + '분 후 "' + nextE2.title + '"', btn: '일정 확인', action: "cancelVoiceReport();navigate('calendar')" }); }
      if (pend.length >= 5) suggestions.push({ icon: '📋', text: '미완료 할 일 ' + pend.length + '건', btn: '정리하기', action: "cancelVoiceReport();navigate('todos')" });
      if (suggestions.length > 0) {
        const sgDiv = document.createElement('div');
        sgDiv.id = 'vrActionSuggest';
        sgDiv.innerHTML = `<div style="background:rgba(124,58,237,.08); border:1px solid rgba(124,58,237,.15); border-radius:12px; padding:12px; margin-bottom:12px; animation:vrCardIn .4s both;">
          <p style="font-size:12px; color:#a78bfa; margin-bottom:8px;">🤖 비서 추천</p>
          ${suggestions.map(s => `<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0;">
            <span style="font-size:13px; color:#e2e8f0;">${s.icon} ${s.text}</span>
            <button onclick="${s.action}" style="font-size:11px; padding:4px 10px; border-radius:8px; border:1px solid rgba(167,139,250,.3); background:rgba(167,139,250,.1); color:#a78bfa; cursor:pointer;">${s.btn}</button>
          </div>`).join('')}
        </div>`;
        const missingEl = document.getElementById('vrMissingHint');
        if (missingEl) missingEl.after(sgDiv);
        else document.getElementById('vrRefinePreview').after(sgDiv);
      }
    }).catch(() => {});

    btn.textContent = '✨ AI 다듬기';
    btn.disabled = false;
  }, 1800);
}


function previewVoice5W1HCards(text) {
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

  const cards = [
    { key:'when', label:'언제', icon:'&#128197;', color:'#f59e0b', bg:'rgba(245,158,11,.12)' },
    { key:'where', label:'어디서', icon:'&#128205;', color:'#34d399', bg:'rgba(52,211,153,.12)' },
    { key:'who', label:'누가', icon:'&#128100;', color:'#60a5fa', bg:'rgba(96,165,250,.12)' },
    { key:'what', label:'무엇을', icon:'&#128196;', color:'#f472b6', bg:'rgba(244,114,182,.12)' },
    { key:'how', label:'어떻게', icon:'&#128295;', color:'#a78bfa', bg:'rgba(167,139,250,.12)' },
    { key:'why', label:'왜', icon:'&#127919;', color:'#fb923c', bg:'rgba(251,146,60,.12)' }
  ];
  const missing = cards.filter(c => !fields[c.key]).map(c => c.key);
  const filled = cards.filter(c => fields[c.key]).length;
  const scorePercent = Math.round(filled / cards.length * 100);
  const scoreColor = scorePercent >= 80 ? '#22c55e' : scorePercent >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = scorePercent >= 80 ? '훌륭해요!' : scorePercent >= 50 ? '괜찮아요' : '보완 필요';

  const scoreBar = `<div style="grid-column:1/-1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:10px 12px; animation:vrCardIn .3s both;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span style="font-size:11px; color:rgba(255,255,255,.5);">완성도</span>
      <span style="font-size:12px; color:${scoreColor}; font-weight:700;">${scorePercent}% ${scoreLabel}</span>
    </div>
    <div style="height:6px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden;">
      <div style="height:100%; width:${scorePercent}%; background:${scoreColor}; border-radius:3px; transition:width .8s;"></div>
    </div>
  </div>`;

  const html = scoreBar + cards.map((c, i) => {
    const val = fields[c.key] || '-';
    const hasVal = fields[c.key] ? 1 : 0.4;
    return `<div style="background:${c.bg}; border:1px solid ${c.color}33; border-radius:12px; padding:10px 12px; opacity:${hasVal}; animation:vrCardIn .4s ${(i+1)*0.1}s both;">
      <div style="font-size:10px; color:${c.color}; margin-bottom:4px; font-weight:600;">${c.icon} ${c.label}</div>
      <div style="font-size:13px; color:#e2e8f0; word-break:keep-all;">${val}</div>
    </div>`;
  }).join('');
  return { html, missing };
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

function _vgSetAvatar(state) {
  const av = document.getElementById('vgAvatar');
  const st = document.getElementById('vgStatusText');
  if (!av) return;
  const states = {
    idle:     { emoji: '&#129302;', status: '' },
    speaking: { emoji: '&#128483;', status: '말하고 있어요...' },
    listening:{ emoji: '&#127908;', status: '🎤 듣고 있습니다...' },
    thinking: { emoji: '&#129504;', status: '생각하고 있어요...' }
  };
  const s = states[state] || states.idle;
  av.innerHTML = s.emoji;
  if (st) st.textContent = s.status;
}

function vgSpeak(text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis || !_vgActive) { resolve(); return; }
    _vgSetAvatar('speaking');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 1.05;
    u.pitch = 1.1;
    u.onend = () => { _vgSetAvatar('idle'); setTimeout(resolve, 200); };
    u.onerror = () => { _vgSetAvatar('idle'); resolve(); };
    setTimeout(() => speechSynthesis.speak(u), 100);
  });
}

function vgShowThinking() {
  _vgSetAvatar('thinking');
  const area = document.getElementById('vgChatArea');
  const div = document.createElement('div');
  div.id = 'vgThinking';
  div.style.cssText = 'max-width:82%; padding:12px 16px; border-radius:4px 16px 16px 16px; font-size:14px; background:rgba(255,255,255,.12); color:rgba(255,255,255,.5); align-self:flex-start; animation:fadeIn .3s;';
  div.innerHTML = '<span style="animation:pulse 1s infinite;">●</span> <span style="animation:pulse 1s .2s infinite;">●</span> <span style="animation:pulse 1s .4s infinite;">●</span>';
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function vgHideThinking() {
  const el = document.getElementById('vgThinking');
  if (el) el.remove();
}

function vgAddBubble(text, who) {
  vgHideThinking();
  const area = document.getElementById('vgChatArea');
  const isBot = who === 'bot';
  const div = document.createElement('div');
  div.style.cssText = `max-width:82%; padding:12px 16px; border-radius:${isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px'}; font-size:14px; line-height:1.6; animation:fadeIn .3s; word-break:keep-all; ${isBot ? 'background:rgba(255,255,255,.12); color:#fff; align-self:flex-start;' : 'background:#7c3aed; color:#fff; align-self:flex-end;'}`;
  if (isBot) {
    div.textContent = '';
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < text.length) { div.textContent += text[i]; i++; area.scrollTop = area.scrollHeight; }
      else clearInterval(typeInterval);
    }, 30);
  } else {
    div.textContent = text;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }
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
  _vgSetAvatar('idle');
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
    _vgSetAvatar('listening');

    _vgResolve = function(text) {
      document.getElementById('vgMicBtn').style.display = 'none';
      _vgSetAvatar('idle');
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

function _vgTimeGreeting() {
  const h = new Date().getHours();
  if (h < 9) return { greet: '좋은 아침이에요', period: '아침', emoji: '🌅', comment: '일찍 시작하시는군요! 부지런하세요.' };
  if (h < 12) return { greet: '좋은 오전이에요', period: '오전', emoji: '☀️', comment: '오늘도 활기차게 시작해볼까요?' };
  if (h < 14) return { greet: '점심시간이네요', period: '점심', emoji: '🍚', comment: '식사는 하셨나요?' };
  if (h < 18) return { greet: '좋은 오후에요', period: '오후', emoji: '🌤️', comment: '오후도 힘내봐요!' };
  return { greet: '늦은 시간까지 수고 많으세요', period: '저녁', emoji: '🌙', comment: '무리하지 마시고 마무리해요.' };
}

function _vgDayContext() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const now = new Date();
  const d = days[now.getDay()];
  if (d === '월') return '월요일, 새로운 한 주가 시작됐어요!';
  if (d === '금') return '금요일이에요! 이번 주도 거의 다 왔어요.';
  if (d === '수') return '수요일, 한 주의 반환점이에요.';
  return d + '요일이에요.';
}

async function vgConversation() {
  if (!_vgActive) return;
  const name = currentUser.name || '사용자';
  const tg = _vgTimeGreeting();
  const dayCtx = _vgDayContext();

  // 인사
  vgAddBubble(tg.greet + ', ' + name + '님! ' + tg.emoji, 'bot');
  await vgSpeak(tg.greet + ', ' + name + '님!');
  if (!_vgActive) return;

  await new Promise(r => setTimeout(r, 600));
  vgAddBubble(dayCtx + ' ' + tg.comment, 'bot');
  await vgSpeak(dayCtx + ' ' + tg.comment);
  if (!_vgActive) return;

  // 어제 업무 요약
  await new Promise(r => setTimeout(r, 400));
  vgShowThinking();
  await new Promise(r => setTimeout(r, 600));
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yReports = await api(`/api/reports?from=${yesterday}&to=${yesterday}`);
    const myYReports = (yReports || []).filter(r => r.author_id === currentUser.id);
    if (myYReports.length > 0) {
      const cats = {};
      myYReports.forEach(r => { const c = r.work_category || '기타'; cats[c] = (cats[c]||0) + 1; });
      const catSummary = Object.entries(cats).map(([k,v]) => k + ' ' + v + '건').join(', ');
      const yMsg = '어제는 ' + myYReports.length + '건 업무 처리하셨어요. (' + catSummary + ')';
      vgAddBubble('📊 ' + yMsg, 'bot');
      await vgSpeak(yMsg);
      if (!_vgActive) return;
    }
  } catch(_) {}

  // 브리핑: 오늘 등록된 일정 확인
  await new Promise(r => setTimeout(r, 400));
  vgShowThinking();
  await new Promise(r => setTimeout(r, 800));
  let briefing = '';
  try {
    const today = new Date().toISOString().split('T')[0];
    const events = await api('/api/calendar-events?date=' + today);
    if (events && events.length > 0) {
      briefing = '오늘 등록된 일정이 ' + events.length + '건 있어요.';
      const first3 = events.slice(0, 3).map(e => (e.event_time ? e.event_time.substring(0,5) + ' ' : '') + e.title).join(', ');
      briefing += ' ' + first3;
      if (events.length > 3) briefing += ' 외 ' + (events.length - 3) + '건';
      vgAddBubble('📋 ' + briefing, 'bot');
      await vgSpeak(briefing);
      if (!_vgActive) return;
    }
  } catch(_) {}

  // 할 일 체크: 미완료 + 기한 초과
  try {
    const todos = await api('/api/todos');
    const pending = (todos || []).filter(t => !t.completed);
    const today2 = new Date().toISOString().split('T')[0];
    const overdue = pending.filter(t => t.due_date && t.due_date.split('T')[0] < today2);
    if (overdue.length > 0) {
      await new Promise(r => setTimeout(r, 300));
      const odNames = overdue.slice(0, 2).map(t => t.title).join(', ');
      vgAddBubble('⚠️ 기한이 지난 할 일이 ' + overdue.length + '건 있어요: ' + odNames, 'bot');
      await vgSpeak('기한이 지난 할 일이 ' + overdue.length + '건 있어요. ' + odNames);
      if (!_vgActive) return;
    } else if (pending.length > 0) {
      await new Promise(r => setTimeout(r, 300));
      vgAddBubble('✅ 미완료 할 일이 ' + pending.length + '건 있어요.', 'bot');
      await vgSpeak('미완료 할 일이 ' + pending.length + '건 있어요.');
      if (!_vgActive) return;
    }
  } catch(_) {}

  // 일정 알람 예고 — 30분 내 일정 사전 안내
  try {
    const evts30 = (await api('/api/calendar-events?date=' + new Date().toISOString().split('T')[0])) || [];
    const nm = new Date().getHours() * 60 + new Date().getMinutes();
    const soon = evts30.filter(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); const d = eh*60+em - nm; return d > 0 && d <= 30; });
    if (soon.length > 0) {
      await new Promise(r => setTimeout(r, 300));
      const soonList = soon.map(e => e.event_time.substring(0,5) + ' ' + e.title).join(', ');
      vgAddBubble('⏰ 30분 내 일정이 있어요! ' + soonList, 'bot');
      await vgSpeak('30분 내 일정이 있습니다. ' + soonList);
      if (!_vgActive) return;
    }
  } catch(_) {}

  // 보고서 미작성 안내 (오후)
  if (new Date().getHours() >= 14) {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const rps = await api(`/api/reports?from=${todayStr}&to=${todayStr}`);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      if (myRps.length === 0) {
        await new Promise(r => setTimeout(r, 300));
        vgAddBubble('📝 오늘 업무일지가 아직 없어요. 퇴근 전에 한 건 작성해보시겠어요?', 'bot');
        await vgSpeak('오늘 업무일지가 아직 없어요. 퇴근 전에 작성해보시겠어요?');
        if (!_vgActive) return;
      }
    } catch(_) {}
  }

  // 빈 일정 안내
  try {
    const todayEvts2 = (await api('/api/calendar-events?date=' + new Date().toISOString().split('T')[0])) || [];
    if (todayEvts2.length === 0 && new Date().getHours() < 12) {
      await new Promise(r => setTimeout(r, 300));
      vgAddBubble('🗓️ 오늘 등록된 일정이 없어요. 업무 계획을 세워보시겠어요?', 'bot');
      await vgSpeak('오늘 등록된 일정이 없어요. 업무 계획을 세워보시겠어요?');
      if (!_vgActive) return;
    }
  } catch(_) {}

  // 출근 체크
  await new Promise(r => setTimeout(r, 300));
  vgAddBubble('출근 체크 도와드릴게요. 오늘은 어떤 근무이세요?', 'bot');
  vgShowQuickReplies(['내근', '외근', '출장']);
  await vgSpeak('출근 체크 도와드릴게요. 오늘은 어떤 근무이세요?');
  if (!_vgActive) return;

  const wtResp = await vgListen(10000);
  if (!_vgActive) return;
  vgHideQuickReplies();

  let workType = '내근';
  const wt = wtResp.toLowerCase();
  if (wt.includes('외근')) workType = '외근';
  else if (wt.includes('출장')) workType = '출장';
  vgAddBubble(wtResp || workType, 'user');

  vgShowThinking();
  try {
    await api('/api/attendance/checkin', { method: 'POST', body: { work_type: workType, work_summary: '' } });
    _vgDidCheckin = true;
  } catch(e) {}

  await new Promise(r => setTimeout(r, 800));
  const wtEmoji = workType === '외근' ? '🚗' : workType === '출장' ? '✈️' : '🏢';
  const wtComment = workType === '외근' ? '이동 중 안전하게 다녀오세요!' : workType === '출장' ? '출장길 편안하시길 바라요!' : '사무실에서 집중하기 좋은 날이에요!';
  vgAddBubble(wtEmoji + ' ' + workType + ' 체크 완료! ' + wtComment, 'bot');
  await vgSpeak(workType + ' 체크 완료! ' + wtComment);
  if (!_vgActive) return;

  // 업무 계획 수집
  await new Promise(r => setTimeout(r, 400));
  vgAddBubble('오늘 계획하신 업무가 있으시면 말씀해주세요. 제가 정리해드릴게요. 🗂️', 'bot');
  document.getElementById('vgStatusText').textContent = '🎤 듣고 있습니다...';
  await vgSpeak('오늘 계획하신 업무가 있으시면 말씀해주세요. 제가 정리해드릴게요.');
  if (!_vgActive) return;

  const planResp = await vgListen(20000);
  if (!_vgActive) return;
  document.getElementById('vgStatusText').textContent = '';

  if (planResp) {
    vgAddBubble(planResp, 'user');

    vgShowThinking();
    await new Promise(r => setTimeout(r, 1200));
    _vgSchedules = vgParseSchedules(planResp);
    vgAddBubble('네, 잘 들었어요! ' + _vgSchedules.length + '개 일정을 파악했어요. ✨', 'bot');

    vgAddBubble('혹시 더 추가할 일정이 있으세요?', 'bot');
    vgShowQuickReplies(['네, 더 있어요', '이게 다예요']);
    await vgSpeak('혹시 더 추가할 일정이 있으세요?');
    if (!_vgActive) return;

    const moreResp = await vgListen(8000);
    if (!_vgActive) return;
    vgHideQuickReplies();
    vgAddBubble(moreResp || '이게 다예요', 'user');

    const wantMore = moreResp && (moreResp.includes('네') || moreResp.includes('더') || moreResp.includes('있') || moreResp.includes('응'));
    if (wantMore) {
      vgAddBubble('네, 말씀해주세요! 계속 듣고 있을게요 🎤', 'bot');
      document.getElementById('vgStatusText').textContent = '🎤 듣고 있습니다...';
      await vgSpeak('네, 말씀해주세요!');
      if (!_vgActive) return;

      const more2 = await vgListen(20000);
      if (!_vgActive) return;
      document.getElementById('vgStatusText').textContent = '';
      if (more2) {
        vgAddBubble(more2, 'user');
        _vgSchedules = _vgSchedules.concat(vgParseSchedules(more2));
      }
    }
  }

  if (_vgSchedules.length > 0) {
    await new Promise(r => setTimeout(r, 400));
    const cnt = _vgSchedules.length;
    const praise = cnt >= 4 ? '알찬 하루가 되겠네요!' : cnt >= 2 ? '잘 정리됐어요!' : '깔끔하게 정리했어요!';
    vgAddBubble('📋 ' + cnt + '개 일정 정리 완료! ' + praise + ' 확인하고 수정할 부분이 있으면 고쳐주세요.', 'bot');
    await vgSpeak(cnt + '개 일정 정리 완료! ' + praise);
    vgShowSchedulePreview();
  } else {
    await new Promise(r => setTimeout(r, 300));
    // 마무리 전 오늘 남은 업무 요약
    try {
      const _td3 = new Date().toISOString().split('T')[0];
      const [_rps2, _todos2] = await Promise.all([api(`/api/reports?from=${_td3}&to=${_td3}`), api('/api/todos')]);
      const _myRps2 = (_rps2 || []).filter(r => r.author_id === currentUser.id);
      const _pend2 = (_todos2 || []).filter(t => !t.completed);
      const summaryParts = [];
      if (_myRps2.length > 0) summaryParts.push('보고서 ' + _myRps2.length + '건 작성됨');
      if (_pend2.length > 0) summaryParts.push('할 일 ' + _pend2.length + '건 남음');
      if (summaryParts.length > 0) {
        const summary = '📊 현재 상태: ' + summaryParts.join(', ');
        vgAddBubble(summary, 'bot');
        await vgSpeak(summaryParts.join(', '));
        if (!_vgActive) return;
        await new Promise(r => setTimeout(r, 300));
      }
    } catch(_) {}
    const h = new Date().getHours();
    const closing = h >= 18 ? '오늘도 수고 많으셨어요.' : '오늘도 화이팅!';
    vgAddBubble(closing + ' 더 할 말 있으시면 말씀하세요! 🎤', 'bot');
    await vgSpeak(closing + ' 더 할 말 있으시면 말씀하세요.');
    if (!_vgActive) return;

    // 자유 대화 모드: AI 채팅 엔진 연결
    for (let round = 0; round < 5; round++) {
      if (!_vgActive) return;
      document.getElementById('vgStatusText').textContent = '🎤 듣고 있습니다...';
      const freeResp = await vgListen(8000);
      document.getElementById('vgStatusText').textContent = '';
      if (!_vgActive || !freeResp) break;
      const ft = freeResp.toLowerCase().trim();
      if (/^(됐어|없어|끝|아니|괜찮|ㄴㄴ|바이|잘\s*가)/.test(ft)) {
        vgAddBubble(freeResp, 'user');
        vgAddBubble('네! 필요하면 언제든 불러주세요! 👋', 'bot');
        await vgSpeak('필요하면 언제든 불러주세요!');
        break;
      }
      vgAddBubble(freeResp, 'user');
      vgShowThinking();
      try {
        const aiResp = await _aiProcessChat(freeResp);
        await new Promise(r => setTimeout(r, 600));
        vgAddBubble(aiResp.reply, 'bot');
        await vgSpeak(aiResp.reply.replace(/[🎬📅✅📝📊📋⏰🔥💪✨👏🌙💡⚠️🍅🎯😊😢😤😩🤔👍🗑️🔍👥📢🕐📜🔢💬━─#●]/g, '').replace(/\n+/g, '. '));
        if (aiResp.learn) { for (const [k, v] of Object.entries(aiResp.learn)) _aiLearn(k, v); }
        if (aiResp.action) { aiResp.action(); break; }
      } catch(_) {
        vgAddBubble('처리 중 오류가 생겼어요.', 'bot');
        await vgSpeak('처리 중 오류가 생겼어요.');
      }
    }
    if (_vgActive) setTimeout(() => closeVoiceGuide(), 2500);
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
  const h = new Date().getHours();
  const farewell = h >= 18
    ? '오늘 하루 마무리 잘 하세요! 수고 많으셨어요 🌙'
    : saved >= 3
    ? saved + '개 일정 모두 저장했어요! 알찬 하루 되시길 바랍니다 ✨'
    : saved + '개 일정 저장 완료! 필요하면 언제든 불러주세요 💪';
  vgAddBubble(farewell, 'bot');
  await vgSpeak(farewell.replace(/[✨💪🌙]/g, ''));
  // 알람 안내
  const hasTime = _vgSchedules.some(s => s.time);
  if (hasTime) {
    await new Promise(r => setTimeout(r, 500));
    vgAddBubble('⏰ 일정 10분 전에 자동으로 알려드릴게요!', 'bot');
    await vgSpeak('일정 10분 전에 자동으로 알려드릴게요.');
  }
  setTimeout(() => closeVoiceGuide(), 2000);
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

// ─── AI 비서 채팅 + 학습 시스템 ───
let _aiChatHistory = [];
let _aiUnmatchedCount = 0;
let _aiLastUnmatched = '';
let _aiLastWasFallback = false;

async function _aiCallGemini(message) {
  try {
    const history = _aiChatHistory.slice(-10).map(h => ({
      who: h.who, text: (h.text || '').substring(0, 300)
    }));
    const resp = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.reply || null;
  } catch (e) {
    return null;
  }
}

function _aiSimpleSimilarity(a, b) {
  if (!a || !b) return 0;
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  let common = 0;
  for (const c of setA) if (setB.has(c)) common++;
  return common / Math.max(setA.size, setB.size);
}
function _aiWorkPivot() {
  const h = new Date().getHours();
  const p = [];
  if (h < 10) p.push('참! 오늘 출근은 체크하셨어요?', '그러고 보니 오늘 일정 확인하셨어요?', '아 맞다, 오늘 할 일 정리해드릴까요?');
  else if (h < 12) p.push('그러고 보니 오전 할 일은 순조로운가요?', '참, 오늘 스케줄은 괜찮으세요?', '아 맞다, 오전 할 일 확인해볼까요?');
  else if (h < 14) p.push('맛있게 드시고 오후 일정도 체크해봐요!', '아 참, 오후에 할 일 정리해드릴까요?', '점심 후에 할 일 한번 볼까요?');
  else if (h < 17) p.push('그건 그렇고, 오늘 업무는 순조로운가요?', '참! 보고서 쓸 거 있으면 도와드릴까요?', '아 맞다, 할 일은 잘 되고 있어요?');
  else p.push('그건 그렇고, 오늘 마무리 정리는 하셨어요?', '참, 퇴근 전 일지 정리 한번 할까요?', '아 맞다, 오늘 하루 마무리 해볼까요?');
  return p[Math.floor(Math.random() * p.length)];
}
function _aiIsWorkRelated(t) {
  return /할\s*일|일정|보고서|출근|퇴근|업무|회의|브리핑|스케줄|마감|보고|기한|목표|추천|우선|분석|집중|생산성|팀|프로젝트|일지|캘린더|투두|todo|출결|근태/i.test(t);
}
function _aiDetectIdiomCat(text) {
  const m = [
    [/힘들|지치|피곤|열심|노력|고생|수고|땀|분발|힘내/, 'effort'],
    [/성공|잘\s*됐|이겼|최고|대박|완벽|승리|해냈/, 'success'],
    [/위기|실패|안\s*돼|못|어려|힘든|고민|문제|망|큰일/, 'crisis'],
    [/시간|빨리|늦|급해|마감|서둘|기한|빠르/, 'time'],
    [/참|기다|인내|꾸준|계속|포기|버텨/, 'patience'],
    [/시작|도전|새로|첫|출발|시도|나서/, 'start'],
    [/배우|공부|학습|알|모르|지식|경험|수업/, 'learn'],
    [/계획|준비|전략|목표|방향|정리|단계/, 'plan'],
    [/같이|함께|팀|협력|도움|동료|우리/, 'team'],
    [/변화|바뀌|달라|발전|성장|개선|혁신/, 'change'],
    [/기분|감정|화나|슬프|기쁘|행복|우울|짜증/, 'emotion'],
    [/배고프|밥|먹|점심|음식|건강|운동/, 'food'],
    [/날씨|비|눈|덥|춥|자연|계절|봄|여름|가을|겨울/, 'nature'],
    [/돈|월급|재테크|주식|투자|경제|절약/, 'money'],
    [/사랑|연애|썸|결혼|이별|마음/, 'love'],
    [/쉬|놀|퇴근|여행|휴가|여유|재미/, 'rest'],
    [/리더|대표|관리|통솔|이끌|팀장|부장/, 'leader'],
    [/말|소통|대화|듣|표현|의견/, 'comm'],
    [/경쟁|싸움|이기|전술|승부|싸워/, 'war'],
  ];
  for (const [pat, cat] of m) { if (pat.test(text)) return cat; }
  return 'wisdom';
}
function _aiPickIdiom(cat) {
  if (!window._SAJASEONGEO) return null;
  const db = window._SAJASEONGEO;
  const pool = cat && db[cat] ? db[cat] : db[Object.keys(db)[Math.floor(Math.random() * Object.keys(db).length)]];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
function _aiIdiomDrip(cat) {
  const idiom = _aiPickIdiom(cat);
  if (!idiom) return '';
  return '\n\n🎓 **' + idiom[0] + '(' + idiom[1] + ')** — ' + idiom[2];
}
function _aiFindIdiom(term) {
  if (!window._SAJASEONGEO) return null;
  for (const cat of Object.keys(window._SAJASEONGEO)) {
    const found = window._SAJASEONGEO[cat].find(function(e) { return e[0] === term; });
    if (found) return { entry: found, cat: cat };
  }
  return null;
}
function _aiMemory() { try { return JSON.parse(localStorage.getItem('aiMemory') || '{}'); } catch(_) { return {}; } }
function _aiMemorySave(mem) { localStorage.setItem('aiMemory', JSON.stringify(mem)); }
function _aiLearn(key, value) {
  const mem = _aiMemory();
  if (!mem.facts) mem.facts = {};
  mem.facts[key] = value;
  if (!mem.chatCount) mem.chatCount = 0;
  mem.chatCount++;
  mem.lastChat = new Date().toISOString();
  _aiMemorySave(mem);
}
function _aiRecordTopic(topic) {
  const mem = _aiMemory();
  if (!mem.topics) mem.topics = {};
  mem.topics[topic] = (mem.topics[topic] || 0) + 1;
  _aiMemorySave(mem);
}

// ─── AI 지능지수(IQ) 엔진 ───
function _aiCalcIQ() {
  const mem = _aiMemory();
  let iq = 70;
  const cc = mem.chatCount || 0;
  iq += Math.min(cc, 200) * 0.05;
  const factCount = Object.keys(mem.facts || {}).length;
  iq += Math.min(factCount, 50) * 0.2;
  const topicCount = Object.keys(mem.topics || {}).length;
  iq += topicCount * 1;
  const daysUsed = (mem.daysUsed || []).length;
  iq += Math.min(daysUsed, 30) * 0.3;
  const cmdCount = Object.keys(mem.freqCmds || {}).length;
  iq += cmdCount * 0.5;
  const hourPats = Object.keys(mem.hourPatterns || {}).length;
  iq += hourPats * 0.3;
  if (mem.facts && mem.facts.chatStyle) iq += 1;
  if (mem.facts && Object.keys(mem.facts).some(k => k.startsWith('pref_'))) iq += 2;
  if (mem.facts && Object.keys(mem.facts).some(k => k.startsWith('mood_'))) iq += 1;
  try {
    const prof = _aiPersonalProfile();
    if (prof.mbti) iq += 1;
    if (prof.birthday) iq += 1;
    iq += Math.min((prof.likes || []).length, 10) * 0.3;
    iq += Math.min((prof.dislikes || []).length, 10) * 0.3;
    iq += Math.min((prof.hobbies || []).length, 5) * 0.5;
    iq += Math.min(_aiLifeLog().length, 50) * 0.1;
  } catch(_) {}
  return Math.round(Math.min(iq, 200));
}

function _aiCalcEXP() {
  const mem = _aiMemory();
  let exp = 0;
  exp += (mem.chatCount || 0) * 2;
  exp += (mem.daysUsed || []).length * 10;
  exp += Object.keys(mem.facts || {}).length * 3;
  exp += Object.values(mem.freqCmds || {}).reduce((s, v) => s + Math.min(v, 20), 0);
  exp += Object.keys(mem.topics || {}).length * 5;
  const posF = (mem.feedbackLog || []).filter(f => f === 'positive').length;
  exp += posF * 5;
  try {
    const prof = _aiPersonalProfile();
    if (prof.mbti) exp += 15;
    if (prof.birthday) exp += 15;
    if (prof.nickname) exp += 10;
    exp += Math.min((prof.likes || []).length, 10) * 5;
    exp += Math.min((prof.hobbies || []).length, 5) * 8;
    exp += Math.min(_aiLifeLog().length, 50) * 3;
    if (prof.stressRelief) exp += 10;
    if (prof.goal) exp += 10;
  } catch(_) {}
  const journalDays = _aiJournalHistory().length;
  exp += journalDays * 8;
  return Math.round(exp);
}

const _aiLevelTable = [
  { lv: 1, title: '신입 비서', emoji: '🌱', desc: '기본 명령 이해', reqExp: 0 },
  { lv: 2, title: '주니어 비서', emoji: '📘', desc: '패턴 인식 시작', reqExp: 100 },
  { lv: 3, title: '시니어 비서', emoji: '💎', desc: '개인화된 추천', reqExp: 300 },
  { lv: 4, title: '수석 비서', emoji: '🌟', desc: '선제적 알림과 분석', reqExp: 700 },
  { lv: 5, title: '전설의 비서', emoji: '👑', desc: '완벽한 맞춤형 서비스', reqExp: 1500 },
];

function _aiGetLevel() {
  const exp = _aiCalcEXP();
  for (let i = _aiLevelTable.length - 1; i >= 0; i--) {
    if (exp >= _aiLevelTable[i].reqExp) {
      const cur = _aiLevelTable[i];
      const next = _aiLevelTable[i + 1];
      return {
        lv: cur.lv, title: cur.title, emoji: cur.emoji, desc: cur.desc,
        exp, reqExp: cur.reqExp,
        nextExp: next ? next.reqExp : null,
        progress: next ? Math.round((exp - cur.reqExp) / (next.reqExp - cur.reqExp) * 100) : 100
      };
    }
  }
  return { lv: 1, title: '신입 비서', emoji: '🌱', desc: '기본 명령 이해', exp, reqExp: 0, nextExp: 100, progress: Math.round(exp / 100 * 100) };
}

function _aiRecordCmd(cmd) {
  const mem = _aiMemory();
  if (!mem.freqCmds) mem.freqCmds = {};
  mem.freqCmds[cmd] = (mem.freqCmds[cmd] || 0) + 1;
  const today = new Date().toISOString().split('T')[0];
  if (!mem.daysUsed) mem.daysUsed = [];
  if (!mem.daysUsed.includes(today)) {
    mem.daysUsed.push(today);
    if (mem.daysUsed.length > 60) mem.daysUsed = mem.daysUsed.slice(-60);
  }
  const hour = new Date().getHours();
  if (!mem.hourPatterns) mem.hourPatterns = {};
  const hKey = 'h' + hour;
  if (!mem.hourPatterns[hKey]) mem.hourPatterns[hKey] = {};
  mem.hourPatterns[hKey][cmd] = (mem.hourPatterns[hKey][cmd] || 0) + 1;
  if (!mem.responseLog) mem.responseLog = [];
  mem.responseLog.push({ cmd, time: Date.now(), hour });
  if (mem.responseLog.length > 200) mem.responseLog = mem.responseLog.slice(-200);
  _aiMemorySave(mem);
}

function _aiGetTopCmds(n) {
  const mem = _aiMemory();
  return Object.entries(mem.freqCmds || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function _aiGetHourSuggestion() {
  const mem = _aiMemory();
  const hour = new Date().getHours();
  const hKey = 'h' + hour;
  const hourData = (mem.hourPatterns || {})[hKey];
  if (!hourData) return null;
  const sorted = Object.entries(hourData).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] >= 3) return sorted[0][0];
  return null;
}

function _aiRecordFeedback(type) {
  const mem = _aiMemory();
  if (!mem.feedback) mem.feedback = { positive: 0, negative: 0 };
  if (type === 'positive') mem.feedback.positive++;
  else mem.feedback.negative++;
  _aiMemorySave(mem);
}

// ─── AI 비서 영구 기억 시스템 (친구처럼 기억하는 AI) ───
function _aiPersonalProfile() {
  const uid = currentUser ? currentUser.id : 'guest';
  try { return JSON.parse(localStorage.getItem('aiProfile_' + uid) || '{}'); } catch(_) { return {}; }
}
function _aiProfileSave(p) {
  const uid = currentUser ? currentUser.id : 'guest';
  localStorage.setItem('aiProfile_' + uid, JSON.stringify(p));
}
function _aiProfileSet(key, value) {
  const p = _aiPersonalProfile();
  p[key] = value;
  p.lastUpdated = new Date().toISOString();
  _aiProfileSave(p);
}
function _aiProfileAddToList(key, value) {
  const p = _aiPersonalProfile();
  if (!p[key]) p[key] = [];
  const v = value.trim();
  if (v && !p[key].includes(v)) { p[key].push(v); _aiProfileSave(p); }
}

function _aiLifeLog() {
  const uid = currentUser ? currentUser.id : 'guest';
  try { return JSON.parse(localStorage.getItem('aiLifeLog_' + uid) || '[]'); } catch(_) { return []; }
}
function _aiLifeLogSave(log) {
  const uid = currentUser ? currentUser.id : 'guest';
  if (log.length > 500) log = log.slice(-500);
  localStorage.setItem('aiLifeLog_' + uid, JSON.stringify(log));
}
function _aiLifeLogAdd(entry) {
  const log = _aiLifeLog();
  entry.date = new Date().toISOString().split('T')[0];
  entry.timestamp = new Date().toISOString();
  log.push(entry);
  _aiLifeLogSave(log);
}

function _aiSessionFacts() {
  try {
    const f = JSON.parse(sessionStorage.getItem('aiSessionFacts') || '{}');
    if (f._expires && f._expires !== new Date().toISOString().split('T')[0]) return {};
    return f;
  } catch(_) { return {}; }
}
function _aiSessionLearn(key, value) {
  const f = _aiSessionFacts();
  f[key] = value;
  f._expires = new Date().toISOString().split('T')[0];
  sessionStorage.setItem('aiSessionFacts', JSON.stringify(f));
}

function _aiGetAnniversaries() {
  const log = _aiLifeLog();
  const now = new Date();
  const todayMD = String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const todayFull = now.toISOString().split('T')[0];
  const results = [];
  log.forEach(entry => {
    if (!entry.date) return;
    const entryMD = entry.date.substring(5);
    if (entryMD === todayMD && entry.date !== todayFull) {
      const yearDiff = now.getFullYear() - parseInt(entry.date.substring(0, 4));
      if (yearDiff > 0) results.push({ ...entry, yearsAgo: yearDiff });
    }
  });
  return results;
}

function _aiGetLifeLogByDate(dateStr) {
  return _aiLifeLog().filter(e => e.date === dateStr);
}

function _aiGetLifeLogByType(type, limit) {
  return _aiLifeLog().filter(e => e.type === type).slice(-(limit || 10));
}

function _aiAutoDetectPersonal(input) {
  const t = input.toLowerCase().trim();
  const detections = [];

  const mbtiMatch = input.match(/(?:나|내|제)\s*(?:MBTI|엠비티아이)(?:는|은)?\s*([A-Za-z]{4})/i) || input.match(/(?:나\s+|내\s+)?([EI][NS][TF][JP])(?:야|이야|인데|거든|임|입니다|이에요|예요)/i);
  if (mbtiMatch && /^[EI][NS][TF][JP]$/i.test(mbtiMatch[1])) {
    _aiProfileSet('mbti', mbtiMatch[1].toUpperCase());
    detections.push({ type: 'mbti', value: mbtiMatch[1].toUpperCase() });
  }

  const foodMatch = input.match(/(.{2,20}?)\s*(?:먹었|먹음|먹었다|먹고\s*왔|시켰|시켜서|주문했|배달시|배달했|마셨|마심|마시고|마셔|한잔\s*했)/);
  if (foodMatch) {
    const food = foodMatch[1].replace(/^(오늘|어제|아까|방금|점심에|저녁에|아침에|나|내가|우리가?)\s*/g, '').replace(/를|을|에서/g, '').trim();
    if (food.length >= 2 && food.length <= 20) {
      _aiLifeLogAdd({ type: 'food', what: food });
      detections.push({ type: 'food', value: food });
    }
  }

  const placeMatch = input.match(/(.{2,20}?)\s*(?:갔어|다녀왔|다녀옴|갔다|가봤|놀러\s*갔|여행했|방문했|갔다왔)/);
  if (placeMatch) {
    const place = placeMatch[1].replace(/^(오늘|어제|아까|주말에|나|내가|우리가?)\s*/g, '').replace(/에$|을$|를$|에서$/g, '').trim();
    if (place.length >= 2 && place.length <= 15) {
      _aiLifeLogAdd({ type: 'place', where: place });
      detections.push({ type: 'place', value: place });
    }
  }

  const activityMatch = input.match(/(.{2,15}?)\s*(?:하고\s*왔|하러\s*갔|하고왔|하러갔|받고\s*왔|받으러\s*갔)/);
  if (activityMatch) {
    const act = activityMatch[1].replace(/^(오늘|어제|아까|아침에|나|내가|거기서|가서)\s*/g, '').replace(/를|을|에서|에/g, '').trim();
    if (act.length >= 2 && act.length <= 12) {
      _aiLifeLogAdd({ type: 'activity', what: act });
      detections.push({ type: 'activity', value: act });
    }
  }

  const hobbyMatch = input.match(/(?:취미|좋아하는\s*것|관심사|즐기는\s*것)(?:는|은|이)?\s*(.{2,15})/);
  if (hobbyMatch) {
    const hobby = hobbyMatch[1].replace(/야$|이야$|인데$|거든$|이에요$|요$|입니다$|임$/g, '').trim();
    if (hobby.length >= 2 && hobby.length <= 15) {
      _aiProfileAddToList('hobbies', hobby);
      detections.push({ type: 'hobby', value: hobby });
    }
  }

  const likeMatch = input.match(/(?:나는?|내가|저는?)\s*(.{2,15}?)\s*(?:좋아해|좋아함|사랑해|최애|완전\s*좋아)/);
  if (likeMatch && !/싫|별로|안/.test(likeMatch[1])) {
    const like = likeMatch[1].replace(/를|을|이|가|은|는/g, '').trim();
    if (like.length >= 2) { _aiProfileAddToList('likes', like); detections.push({ type: 'like', value: like }); }
  }

  const dislikeMatch = input.match(/(?:나는?|내가|저는?)\s*(.{2,15}?)\s*(?:싫어|싫어해|못\s*먹|질색|별로|극혐|안\s*좋아|못\s*먹어)/);
  if (dislikeMatch) {
    const dislike = dislikeMatch[1].replace(/를|을|이|가|은|는/g, '').trim();
    if (dislike.length >= 2) { _aiProfileAddToList('dislikes', dislike); detections.push({ type: 'dislike', value: dislike }); }
  }

  const bdayMatch = input.match(/(?:내|나)\s*생일.*?(\d{1,2})월\s*(\d{1,2})일/);
  if (bdayMatch) {
    _aiProfileSet('birthday', parseInt(bdayMatch[1]) + '월 ' + parseInt(bdayMatch[2]) + '일');
    detections.push({ type: 'birthday', value: parseInt(bdayMatch[1]) + '월 ' + parseInt(bdayMatch[2]) + '일' });
  }

  const nickMatch = input.match(/(?:나를?|날|저를?)\s*(.{1,8}?)(?:라고|이라고)\s*(?:불러|해줘|불러줘)/);
  if (nickMatch) {
    _aiProfileSet('nickname', nickMatch[1].trim());
    detections.push({ type: 'nickname', value: nickMatch[1].trim() });
  }

  const stressMatch = input.match(/스트레스.*?(?:받으면|날때|때)\s*(.{2,20}?)(?:해|하|함|합니다|해요|하는|야)/);
  if (stressMatch) {
    _aiProfileSet('stressRelief', stressMatch[1].trim());
    detections.push({ type: 'stressRelief', value: stressMatch[1].trim() });
  }

  const goalMatch = input.match(/(?:목표|꿈|이루고\s*싶)(?:는|은|이)?\s*(.{2,30}?)(?:야|이야|인데|거든|이에요|요|입니다|임|이다|!|$)/);
  if (goalMatch && goalMatch[1].trim().length >= 2) {
    _aiProfileSet('goal', goalMatch[1].trim());
    detections.push({ type: 'goal', value: goalMatch[1].trim() });
  }

  return detections;
}

function openAiChat() {
  const overlay = document.getElementById('aiChatOverlay');
  overlay.style.display = 'flex';
  _aiApplyTheme();
  _aiChatHistory = [];
  _aiWizardState = null;
  document.getElementById('aiChatMessages').innerHTML = '';
  document.getElementById('aiChatInput').value = '';
  const msgArea = document.getElementById('aiChatMessages');
  msgArea.onscroll = () => {
    const btn = document.getElementById('aiChatScrollBtn');
    if (btn) btn.style.display = (msgArea.scrollHeight - msgArea.scrollTop - msgArea.clientHeight > 100) ? 'block' : 'none';
  };

  const prof = _aiPersonalProfile();
  const name = prof.nickname || (currentUser ? currentUser.name : '사용자');
  const mem = _aiMemory();
  const h = new Date().getHours();
  const _style = (mem.facts && mem.facts.chatStyle) || 'formal';
  const pers = _aiPersonality();
  const day = new Date().getDay();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  let greeting;
  if (pers.level >= 4) {
    greeting = h < 9 ? '좋은 아침!' : h < 12 ? '오전도 파이팅!' : h < 14 ? '점심은 챙겼죠?' : h < 17 ? '오후도 달려요!' : h < 19 ? '마무리 시간!' : '늦은 시간까지 고생!';
  } else if (_style === 'casual') {
    greeting = h < 9 ? '좋은 아침~' : h < 12 ? '오전 파이팅~' : h < 14 ? '점심 먹었어?' : h < 18 ? '오후도 힘내~' : '수고했어~';
  } else if (_style === 'cute') {
    greeting = h < 9 ? '좋은 아침이에용~' : h < 12 ? '오전도 힘내세용~' : h < 14 ? '점심 맛있게 먹었어용?' : h < 18 ? '오후도 파이팅이에용~' : '수고 많으셨어용~';
  } else {
    greeting = h < 9 ? '좋은 아침이에요' : h < 12 ? '오전도 힘내세요' : h < 14 ? '점심은 드셨나요?' : h < 18 ? '오후도 파이팅' : '수고 많으셨어요';
  }

  if (mem.chatCount > 30) greeting += pers.level >= 3 ? ' 벌써 단골이네요!' : ', 역시 단골이시네요!';
  else if (mem.chatCount > 10) greeting += pers.level >= 3 ? ' 자주 만나니 좋아요!' : ', 자주 찾아주시네요!';
  else if (mem.chatCount > 0) greeting += ', 다시 만나서 반가워요!';

  const lastMood = mem.facts && mem.facts['mood_' + new Date(Date.now() - 86400000).toISOString().split('T')[0]];
  if (lastMood === 'bad') greeting += ' 어제 힘드셨죠? 오늘은 더 좋은 하루 될 거예요!';

  const sitComment = _aiSituationalComment();
  if (sitComment) greeting += '\n' + sitComment;

  const lvl = _aiGetLevel();
  const iq = _aiCalcIQ();
  const badge = document.getElementById('aiChatLevelBadge');
  if (badge) badge.textContent = lvl.emoji + ' Lv.' + lvl.lv + ' ' + lvl.title + ' · IQ ' + iq;
  const expBar = '█'.repeat(Math.floor(lvl.progress / 20)) + '░'.repeat(5 - Math.floor(lvl.progress / 20));
  const expInfo = lvl.nextExp ? ' [' + expBar + '] ' + lvl.exp + '/' + lvl.nextExp : ' [█████] MAX';
  _aiChatAddBot(greeting + ' ' + name + '님!\n' + lvl.emoji + ' Lv.' + lvl.lv + ' ' + lvl.title + expInfo);

  // 학습 기반 시간대 추천
  const hourSug = _aiGetHourSuggestion();
  if (hourSug) {
    setTimeout(() => { _aiChatAddBot('🧠 ' + name + '님이 이 시간에 자주 "' + hourSug + '"을(를) 사용하시더라고요!'); }, 2000);
  }

  // 레벨업 알림
  const prevLv = mem.prevLv || 1;
  if (lvl.lv > prevLv) {
    setTimeout(() => { _aiChatAddBot('🎉 축하합니다! Lv.' + prevLv + ' → Lv.' + lvl.lv + ' ' + lvl.title + '로 레벨업!\n' + lvl.desc + ' 능력이 해금됐어요! ' + lvl.emoji + '\n\n📊 EXP: ' + lvl.exp + (lvl.nextExp ? ' (다음 레벨: ' + lvl.nextExp + ')' : '')); }, 2500);
  }
  mem.prevLv = lvl.lv;
  _aiMemorySave(mem);

  // 영구 기억: 기념일/추억 알림
  const anniversaries = _aiGetAnniversaries();
  if (anniversaries.length > 0) {
    setTimeout(() => {
      const ann = anniversaries[0];
      let annMsg = '💜 추억 알림! ';
      if (ann.type === 'food') annMsg += ann.yearsAgo + '년 전 오늘 "' + ann.what + '" 먹었었는데 기억나요? 😋';
      else if (ann.type === 'place') annMsg += ann.yearsAgo + '년 전 오늘 "' + ann.where + '"에 갔었었잖아요! 기억나요? 🗺️';
      else if (ann.type === 'activity') annMsg += ann.yearsAgo + '년 전 오늘 ' + (ann.with ? ann.with + '이랑 ' : '') + '"' + ann.what + '" 했었죠! 😊';
      else annMsg += ann.yearsAgo + '년 전 오늘의 추억이 있어요! 📔';
      if (anniversaries.length > 1) annMsg += '\n(+' + (anniversaries.length - 1) + '개 더 있어요. "추억 보여줘"라고 해보세요!)';
      _aiChatAddBot(annMsg);
    }, 3000);
  }
  // 생일 체크
  if (prof.birthday) {
    const todayMD = (new Date().getMonth() + 1) + '월 ' + new Date().getDate() + '일';
    if (prof.birthday === todayMD) {
      setTimeout(() => { _aiChatAddBot('🎂🎉 ' + name + '님! 오늘 생일이잖아요!! 생일 축하드려요!!! 🥳🎈\n올해도 건강하고 행복한 한 해 되세요! 💕'); }, 3500);
    }
  }

  // 프로액티브 팁 — 상황에 맞는 안내 자동 표시
  setTimeout(async () => {
    try {
      const _td = new Date().toISOString().split('T')[0];
      const h2 = new Date().getHours();
      const [atd2, todos2, evts2] = await Promise.all([api('/api/attendance/today'), api('/api/todos'), api('/api/calendar-events?date=' + _td)]);
      const pend2 = (todos2 || []).filter(td => !td.completed);
      const od2 = pend2.filter(td => td.due_date && td.due_date.split('T')[0] < _td);
      const tips = [];
      if (!atd2 && h2 < 11) tips.push('출근 체크가 아직이에요');
      if (od2.length > 0) tips.push('기한 지난 할 일 ' + od2.length + '건');
      const nm = h2 * 60 + new Date().getMinutes();
      const soonEvt = (evts2 || []).find(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); const d = eh*60+em-nm; return d > 0 && d <= 30; });
      if (soonEvt) tips.push('곧 "' + soonEvt.title + '" 일정');
      if (tips.length > 0) _aiChatAddBot('💡 ' + tips.join(' | '));
    } catch(_) {}
  }, 1500);

  // 심연의 눈: 선제 대화
  setTimeout(() => {
    try {
      const proactiveMsgs = _aiProactiveChat();
      proactiveMsgs.forEach((msg, i) => {
        setTimeout(() => _aiChatAddBot(msg), (i + 1) * 2500 + 3500);
      });
    } catch(_) {}
  }, 500);

  // 스마트 추천: 학습 기반 + 시간대별
  let suggests = [];
  const topCmds = _aiGetTopCmds(3).map(([c]) => c).filter(c => c.length <= 15);
  if (topCmds.length >= 2 && (mem.chatCount || 0) > 20) {
    suggests = topCmds.slice(0, 3);
  } else {
    const topics = mem.topics || {};
    const topTopic = Object.entries(topics).sort((a, b) => b[1] - a[1])[0];
    if (h < 10) suggests = ['오늘 브리핑', '출근 체크', '오늘 일정'];
    else if (h < 12) suggests = ['오늘 일정', '할 일 확인', '보고서 쓸래'];
    else if (h < 14) suggests = ['점심 추천', '할 일 확인', '오늘 일정'];
    else if (h < 17) suggests = ['할 일 확인', '보고서 쓸래', '오늘 브리핑'];
    else suggests = ['퇴근 처리', '오늘 브리핑', '이번 주 요약'];
    if (topTopic && !suggests.includes(_topicToCmd(topTopic[0]))) suggests.push(_topicToCmd(topTopic[0]));
  }
  suggests = suggests.slice(0, 4);
  suggests.push('도움말');
  _aiChatShowSuggest(suggests);

  // 채팅 이력 저장
  const chatLog = mem.chatLog || [];
  chatLog.push({ date: new Date().toISOString(), type: 'open' });
  if (chatLog.length > 100) chatLog.splice(0, chatLog.length - 100);
  mem.chatLog = chatLog;
  _aiMemorySave(mem);
}

function _topicToCmd(topic) {
  const map = { '일정': '오늘 일정', '할일': '할 일 확인', '보고서': '보고서 쓸래', '출퇴근': '출근 체크', '기억': '기억한 것 보여줘', '도움말': '도움말' };
  return map[topic] || '오늘 일정';
}

// ─── AI 비서 UI 고급화 ───
const _aiThemes = {
  default: { bg: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)', name: '기본' },
  galaxy: { bg: 'linear-gradient(135deg,#0d0221 0%,#150734 30%,#0a1628 60%,#1a0536 100%)', name: '우주' },
  nature: { bg: 'linear-gradient(135deg,#0b3d2e 0%,#1a4a3a 50%,#0d2b1f 100%)', name: '자연' },
  neon: { bg: 'linear-gradient(135deg,#1a0a2e 0%,#2d1b4e 30%,#0a1628 60%,#1e0a3a 100%)', name: '네온' }
};
let _aiCurrentTheme = localStorage.getItem('aiChatTheme') || 'default';

function _aiApplyTheme() {
  const overlay = document.getElementById('aiChatOverlay');
  if (!overlay) return;
  const theme = _aiThemes[_aiCurrentTheme] || _aiThemes.default;
  overlay.style.background = theme.bg;
  overlay.setAttribute('data-theme', _aiCurrentTheme);
}

function _aiCycleTheme() {
  const keys = Object.keys(_aiThemes);
  const idx = keys.indexOf(_aiCurrentTheme);
  _aiCurrentTheme = keys[(idx + 1) % keys.length];
  localStorage.setItem('aiChatTheme', _aiCurrentTheme);
  _aiApplyTheme();
  const theme = _aiThemes[_aiCurrentTheme];
  toast('🎨 테마: ' + theme.name);
}

function _aiChatScrollBottom() {
  const area = document.getElementById('aiChatMessages');
  if (area) area.scrollTop = area.scrollHeight;
  const btn = document.getElementById('aiChatScrollBtn');
  if (btn) btn.style.display = 'none';
}

function _aiShowProfileCard() {
  const existing = document.getElementById('aiProfileCard');
  if (existing) { existing.remove(); return; }
  const lvl = _aiGetLevel();
  const iq = _aiCalcIQ();
  const mem = _aiMemory();
  const prof = _aiPersonalProfile();
  const name = prof.nickname || (currentUser ? currentUser.name : '사용자');
  const card = document.createElement('div');
  card.id = 'aiProfileCard';
  card.style.cssText = 'position:absolute; top:60px; left:16px; right:16px; z-index:9999; background:rgba(15,23,42,.95); border:1px solid rgba(124,58,237,.3); border-radius:16px; padding:20px; backdrop-filter:blur(15px); -webkit-backdrop-filter:blur(15px); animation:fadeIn .3s; box-shadow:0 10px 40px rgba(0,0,0,.5);';
  const moodE = _aiMoodEmoji();
  const chatCount = mem.chatCount || 0;
  const daysUsed = (mem.daysUsed || []).length;
  const logCount = _aiLifeLog().length;
  const iqBar = Math.round((iq / 200) * 100);
  card.innerHTML = `
    <div style="text-align:center;">
      <div style="width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#7c3aed,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:32px; margin:0 auto 8px; box-shadow:0 0 20px rgba(124,58,237,.5);">&#129302;</div>
      <p style="font-size:18px; font-weight:700;">${lvl.emoji} AI 업무비서</p>
      <p style="font-size:12px; color:rgba(255,255,255,.6); margin-top:2px;">Lv.${lvl.lv} ${lvl.title} · ${lvl.desc}</p>
      <div style="margin:12px auto; width:80%; height:8px; background:rgba(255,255,255,.1); border-radius:4px; overflow:hidden;">
        <div style="width:${iqBar}%; height:100%; background:linear-gradient(90deg,#7c3aed,#3b82f6); border-radius:4px; transition:width 1s;"></div>
      </div>
      <p style="font-size:11px; color:rgba(255,255,255,.5);">IQ ${iq}/200</p>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:16px; text-align:center;">
      <div style="background:rgba(255,255,255,.06); border-radius:10px; padding:10px 6px;">
        <p style="font-size:18px; font-weight:700;">${chatCount}</p>
        <p style="font-size:10px; color:rgba(255,255,255,.5);">대화</p>
      </div>
      <div style="background:rgba(255,255,255,.06); border-radius:10px; padding:10px 6px;">
        <p style="font-size:18px; font-weight:700;">${daysUsed}</p>
        <p style="font-size:10px; color:rgba(255,255,255,.5);">사용일</p>
      </div>
      <div style="background:rgba(255,255,255,.06); border-radius:10px; padding:10px 6px;">
        <p style="font-size:18px; font-weight:700;">${logCount}</p>
        <p style="font-size:10px; color:rgba(255,255,255,.5);">기억</p>
      </div>
    </div>
    <div style="margin-top:12px; font-size:12px; color:rgba(255,255,255,.6); text-align:center;">
      ${moodE} 현재 기분: ${_aiCurrentMood === 'happy' ? '좋음' : _aiCurrentMood === 'tired' ? '피곤' : _aiCurrentMood === 'stressed' ? '스트레스' : '보통'}
      ${prof.mbti ? ' · MBTI: ' + prof.mbti : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="display:block; margin:14px auto 0; padding:8px 24px; border-radius:20px; border:none; background:rgba(255,255,255,.1); color:#fff; font-size:12px; cursor:pointer;">닫기</button>
  `;
  document.getElementById('aiChatMessages').parentElement.appendChild(card);
}

function _aiAddReactions(msgDiv) {
  const reactions = document.createElement('div');
  reactions.style.cssText = 'display:flex; gap:4px; margin-top:4px; padding-left:36px;';
  reactions.innerHTML = `
    <button class="ai-react-btn" onclick="_aiReact(this,'👍')" style="padding:2px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:transparent; color:rgba(255,255,255,.5); font-size:12px; cursor:pointer; transition:all .2s;">👍</button>
    <button class="ai-react-btn" onclick="_aiReact(this,'👎')" style="padding:2px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:transparent; color:rgba(255,255,255,.5); font-size:12px; cursor:pointer; transition:all .2s;">👎</button>
    <button class="ai-react-btn" onclick="_aiReact(this,'❤️')" style="padding:2px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:transparent; color:rgba(255,255,255,.5); font-size:12px; cursor:pointer; transition:all .2s;">❤️</button>
  `;
  msgDiv.appendChild(reactions);
}

function _aiReact(btn, emoji) {
  btn.style.background = 'rgba(124,58,237,.3)';
  btn.style.borderColor = 'rgba(124,58,237,.5)';
  btn.style.color = '#fff';
  btn.parentElement.querySelectorAll('.ai-react-btn').forEach(b => { if (b !== btn) { b.style.background = 'transparent'; b.style.borderColor = 'rgba(255,255,255,.1)'; b.style.color = 'rgba(255,255,255,.5)'; } });
  if (emoji === '👍' || emoji === '❤️') _aiRecordFeedback('positive');
  else if (emoji === '👎') _aiRecordFeedback('negative');
}

function _aiTimeStamp() {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

function closeAiChat() {
  if (_aiChatVoiceMode) aiChatVoiceToggle();
  document.getElementById('aiChatOverlay').style.display = 'none';
  _aiChatHistory = [];
  const profileCard = document.getElementById('aiProfileCard');
  if (profileCard) profileCard.remove();
}

function _aiChatAddBot(text) {
  _aiChatHistory.push({ who: 'bot', text });
  const area = document.getElementById('aiChatMessages');
  const wrapper = document.createElement('div');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex; gap:8px; align-items:flex-start;';
  const ts = _aiTimeStamp();
  div.innerHTML = `<div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#7c3aed,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">&#129302;</div>
    <div style="max-width:80%;">
      <div style="background:rgba(255,255,255,.1); border-radius:4px 16px 16px 16px; padding:10px 14px;">
        <p class="aiChatText" style="font-size:14px; line-height:1.6; white-space:pre-line;"></p>
      </div>
      <p style="font-size:9px; color:rgba(255,255,255,.3); margin-top:3px; padding-left:4px;">${ts}</p>
    </div>`;
  wrapper.appendChild(div);
  area.appendChild(wrapper);
  area.scrollTop = area.scrollHeight;
  const textEl = div.querySelector('.aiChatText');
  let i = 0;
  const timer = setInterval(() => {
    i += 3;
    textEl.textContent = text.substring(0, i);
    area.scrollTop = area.scrollHeight;
    if (i >= text.length) { clearInterval(timer); _aiAddReactions(wrapper); }
  }, 12);
}

function _aiChatAddUser(text) {
  _aiChatHistory.push({ who: 'user', text });
  const area = document.getElementById('aiChatMessages');
  const ts = _aiTimeStamp();
  const div = document.createElement('div');
  div.style.cssText = 'display:flex; flex-direction:column; align-items:flex-end;';
  div.innerHTML = `<div style="max-width:80%; background:linear-gradient(135deg,#7c3aed,#3b82f6); border-radius:16px 4px 16px 16px; padding:10px 14px;">
    <p style="font-size:14px; line-height:1.6;">${text.replace(/</g,'&lt;')}</p>
  </div>
  <p style="font-size:9px; color:rgba(255,255,255,.3); margin-top:3px; padding-right:4px;">${ts}</p>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function _aiChatShowSuggest(items) {
  const el = document.getElementById('aiChatSuggest');
  el.style.display = 'flex';
  el.innerHTML = items.map(t => `<button onclick="document.getElementById('aiChatInput').value='${t}';sendAiChat();" style="padding:6px 12px; border-radius:16px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06); color:rgba(255,255,255,.7); font-size:12px; cursor:pointer; white-space:nowrap;">${t}</button>`).join('');
}

function _aiChatHideSuggest() { document.getElementById('aiChatSuggest').style.display = 'none'; }

function _aiChatThinking() {
  const area = document.getElementById('aiChatMessages');
  const div = document.createElement('div');
  div.id = 'aiChatThinking';
  div.style.cssText = 'display:flex; gap:8px; align-items:flex-start;';
  div.innerHTML = `<div style="width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#7c3aed,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0;">&#129302;</div>
    <div style="background:rgba(255,255,255,.1); border-radius:4px 16px 16px 16px; padding:10px 14px;">
      <span style="font-size:14px; animation:vrBlink 1s infinite;">●●●</span>
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function _aiChatRemoveThinking() {
  const el = document.getElementById('aiChatThinking');
  if (el) el.remove();
}

let _aiChatVoiceMode = false;
let _aiChatRecog = null;

async function sendAiChat() {
  const input = document.getElementById('aiChatInput');
  const text = input.value.trim();
  if (!text) return;
  const wasVoice = _aiChatVoiceMode;
  input.value = '';
  _aiChatHideSuggest();
  _aiChatAddUser(text);
  _aiRecordCmd(text.toLowerCase().trim());
  const lastUserMsg = _aiChatHistory.filter(h => h.who === 'user').slice(-2, -1)[0];
  if (lastUserMsg) {
    const ft = text.toLowerCase().trim();
    if (/^(응|어|네|좋아|맞아|고마워|ㅇ|ㅇㅇ|ok|좋아|감사)/i.test(ft)) _aiRecordFeedback('positive');
    else if (/^(아니|됐어|ㄴㄴ|싫|별로)/i.test(ft)) _aiRecordFeedback('negative');
  }
  const _detections = _aiAutoDetectPersonal(text);
  const _emotion = _aiDetectEmotion(text);
  _aiMirrorStyle(text);
  _aiChatThinking();
  document.getElementById('aiChatStatus').textContent = '생각 중... ' + _aiMoodEmoji();

  // [10] 유도 질문 응답 처리
  let response;
  const mem0 = _aiMemory();
  if (mem0._pendingGuided) {
    const gKey = mem0._pendingGuided;
    delete mem0._pendingGuided;
    _aiMemorySave(mem0);
    const gResult = _aiHandleGuidedAnswer(gKey, text);
    if (gResult) response = { reply: gResult, suggests: ['도움말', '오늘 브리핑'] };
  }

  // [5] 마법사 진행 중이면 마법사 처리
  if (!response && _aiWizardState) {
    response = await _aiProcessWizard(text);
  }
  if (!response) {
    response = await _aiProcessChat(text, _detections);
  }
  // [4] 감정 기반 응답 조정 + [11] 인격 진화
  if (response && response.reply) {
    response.reply = _aiMoodAdjust(response.reply);
    response.reply = _aiAddPersonality(response.reply);
  }

  _aiChatRemoveThinking();
  document.getElementById('aiChatStatus').textContent = _aiChatVoiceMode ? '🎤 음성 대화 중 ' + _aiMoodEmoji() : _aiMoodEmoji() + ' 온라인';
  _aiChatAddBot(response.reply);
  if (response.suggests) _aiChatShowSuggest(response.suggests);
  if (response.learn) {
    for (const [k, v] of Object.entries(response.learn)) _aiLearn(k, v);
  }
  if (response.action) response.action();

  if (wasVoice) _aiChatSpeak(response.reply);
}

function _aiChatSpeak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[🎬📅✅📝📊📋⏰🔥💪✨👏🌙💡⚠️🍅🎯😊😢😤😩🤔👍🗑️🔍👥📢🕐📜🔢💬🐱🐛🌊💀😂😆🤣😅😴💧😌🎉💙❌🌟🌱━─#●]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/—/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return;
  const chunks = clean.match(/.{1,150}[.!?,\s]|.{1,150}$/g) || [clean];
  chunks.forEach((chunk, i) => {
    const utter = new SpeechSynthesisUtterance(chunk.trim());
    utter.lang = 'ko-KR';
    utter.rate = 1.05;
    utter.pitch = 1.0;
    if (i === chunks.length - 1 && _aiChatVoiceMode) {
      utter.onend = () => {
        setTimeout(() => { if (_aiChatVoiceMode && _aiChatRecog) try { _aiChatRecog.start(); } catch(_) {} }, 500);
      };
    }
    window.speechSynthesis.speak(utter);
  });
}

function aiChatVoiceToggle() {
  if (!SpeechRecognition) { toast('이 브라우저는 음성 인식을 지원하지 않습니다.'); return; }
  const btn = document.getElementById('aiChatMicBtn');
  const statusEl = document.getElementById('aiChatStatus');
  const inputEl = document.getElementById('aiChatInput');

  if (_aiChatVoiceMode) {
    _aiChatVoiceMode = false;
    if (_aiChatRecog) { try { _aiChatRecog.stop(); } catch(_) {} _aiChatRecog = null; }
    window.speechSynthesis.cancel();
    btn.style.background = 'rgba(255,255,255,.12)';
    btn.innerHTML = '&#127908;';
    statusEl.textContent = '온라인';
    inputEl.placeholder = '메시지를 입력하세요...';
    return;
  }

  _aiChatVoiceMode = true;
  btn.style.background = 'linear-gradient(135deg,#ef4444,#f97316)';
  btn.innerHTML = '⏹';
  statusEl.textContent = '🎤 음성 대화 중';
  inputEl.placeholder = '말씀하세요... (음성 인식 중)';

  const recog = new SpeechRecognition();
  recog.lang = 'ko-KR';
  recog.interimResults = true;
  recog.continuous = false;
  recog.maxAlternatives = 1;
  _aiChatRecog = recog;

  let finalText = '';
  let silenceTimer = null;

  recog.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        finalText += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    inputEl.value = finalText + interim;
    if (silenceTimer) clearTimeout(silenceTimer);
    if (finalText) {
      silenceTimer = setTimeout(() => {
        if (finalText.trim()) {
          inputEl.value = finalText.trim();
          try { recog.stop(); } catch(_) {}
          sendAiChat();
          finalText = '';
        }
      }, 1500);
    }
  };

  recog.onend = () => {
    if (_aiChatVoiceMode && !window.speechSynthesis.speaking) {
      if (finalText.trim()) {
        inputEl.value = finalText.trim();
        sendAiChat();
        finalText = '';
      } else {
        setTimeout(() => { if (_aiChatVoiceMode) try { recog.start(); } catch(_) {} }, 300);
      }
    }
  };

  recog.onerror = (e) => {
    if (e.error === 'not-allowed') {
      toast('마이크 권한을 허용해주세요');
      aiChatVoiceToggle();
    } else if (e.error === 'no-speech') {
      if (_aiChatVoiceMode) setTimeout(() => { try { recog.start(); } catch(_) {} }, 300);
    }
  };

  recog.start();
  _aiChatAddBot('🎤 음성 대화 모드가 시작됐어요!\n말씀하시면 듣고 답변해드릴게요.\n\n마이크 버튼을 다시 누르면 종료됩니다.');
  _aiChatShowSuggest(['오늘 브리핑', '할 일 확인', '오늘 일정']);
}

const _aiSlangDict = {
  '방가방가': '반가워', '방가': '반가워', '하이루': '안녕', '하이요': '안녕',
  'ㅎㅇ': '안녕', 'ㅂㅇ': '반가워', 'ㅎㅇㅎㅇ': '안녕안녕',
  'ㄱㅅ': '감사', 'ㄱㅅㄱㅅ': '감사감사', 'ㄳ': '감사', 'ㄱㅅㅎ': '감사해',
  'ㄴㄴ': '아니', 'ㅇㅇ': '응', 'ㅇㅋ': '오케이', 'ㅈㅅ': '죄송',
  'ㄱㄱ': '가자', 'ㄱㄱㄱ': '가자가자', 'ㄹㅇ': '진짜', 'ㄹㅇㅋㅋ': '진짜 ㅋㅋ',
  'ㅈㄱ': '자기소개', 'ㄷㄷ': '덜덜', 'ㅎㄷㄷ': '후덜덜', 'ㄱㄷ': '기다려',
  'ㅂㅂ': '바이바이', 'ㅂ2': '바이바이', 'ㅂㅇ': '반가워',
  'ㅋㅋ': '(웃음)', 'ㅎㅎ': '(웃음)', 'ㅠㅠ': '(슬픔)', 'ㅜㅜ': '(슬픔)',
  '넹': '네', '넵': '네', '넴': '네', '얍': '네',
  '엥': '왜', '엥?': '왜?', '앵': '왜',
  '웅': '응', '엉': '응', '오키': '알겠어', '오키도키': '알겠어',
  '갠찮': '괜찮', '갠차나': '괜찮아', '괜차나': '괜찮아',
  '머해': '뭐해', '뭐행': '뭐해', '뭐함': '뭐해', '모해': '뭐해',
  '짱이야': '최고야', '짱': '최고', '쩔어': '대단해', '쩐다': '대단해',
  '헐': '놀라움', '대박': '놀라움', '레알': '진짜', '리얼': '진짜',
  'ㅁㅊ': '미쳤', '미쳤다': '대단해', '쩔었다': '대단했어',
  '알려줘용': '알려줘', '해줘용': '해줘', '부탁용': '부탁해',
  '고마워용': '고마워', '감사용': '감사해', '사랑해용': '사랑해',
  '힝': '(슬픔)', '흑흑': '(슬픔)', '에잇': '짜증',
  '드루와': '와봐', '간다간다': '가자', '가즈아': '가자',
  '맞팔': '맞팔로우', '선팔': '먼저 팔로우',
  '꿀잼': '재미있어', '핵꿀잼': '엄청 재미있어', '노잼': '재미없어',
  'ㄱㄴ': '가능', 'ㅆㄹ': '수고',
  '수고링': '수고해', '수고루': '수고해', '고생링': '고생했어',
  '홧팅': '화이팅', '파이팅': '화이팅', '빠이팅': '화이팅',
  '안뇽': '안녕', '안뇽하세요': '안녕하세요', '방갑': '반가워',
  '궁금': '궁금해', '몰라용': '모르겠어', '글쿤': '그렇구나',
  '아하': '그렇구나', '오호': '그렇구나', '오오': '신기해',
  'ㅇㅎ': '이해', 'ㅇㅋㅇㅋ': '알겠어', 'ㅊㅋ': '축하', 'ㅊㅋㅊㅋ': '축하축하',
  '볼매': '볼수록매력', '심쿵': '심장쿵',
  'asap': '최대한빨리', 'ASAP': '최대한빨리', 'fyi': '참고로', 'FYI': '참고로',
  'wip': '진행중', 'WIP': '진행중', 'tbd': '미정', 'TBD': '미정',
  'eta': '예상도착시간', 'ETA': '예상도착시간', 'eod': '오늘마감', 'EOD': '오늘마감',
  'kpi': '핵심성과지표', 'KPI': '핵심성과지표', 'roi': '투자수익률', 'ROI': '투자수익률',
  'okr': '목표핵심결과', 'OKR': '목표핵심결과', 'cc': '참조', 'CC': '참조',
  'rsvp': '회신요망', 'RSVP': '회신요망', 'nda': '비밀유지계약', 'NDA': '비밀유지계약',
  '컨펌': '확인/승인', '블로커': '진행방해요소', '마일스톤': '중요단계',
  '데드라인': '마감기한', '피드백': '의견/평가', '리마인드': '다시알림',
  '팔로업': '후속조치', '싱크': '동기화/맞추기', '래핑': '마무리',
  '어사인': '배정', '에스컬레이션': '상위보고', '온보딩': '신규적응',
  '얼라인': '방향맞추기', '아젠다': '회의안건', '펜딩': '보류중',
  '클로즈': '종료', '킥오프': '시작', '바이인': '동의/지지',
  '프라이어리티': '우선순위', '이슈': '문제/안건', '핫픽스': '긴급수정',
};

const _aiSlangGreetings = /^(방가방가|방가|하이루|하이요|ㅎㅇ|ㅂㅇ|ㅎㅇㅎㅇ|안뇽|안뇽하세요|방갑)$/i;
const _aiSlangThanks = /^(ㄱㅅ|ㄱㅅㄱㅅ|ㄳ|ㄱㅅㅎ|고마워용|감사용)$/i;
const _aiSlangBye = /^(ㅂㅂ|ㅂ2|바이바이|빠잉|수고링|수고루|고생링)$/i;
const _aiSlangAgree = /^(ㅇㅇ|ㅇㅋ|넹|넵|넴|얍|웅|엉|오키|오키도키|ㅇㅋㅇㅋ|ㄱㄴ)$/i;
const _aiSlangCheer = /^(홧팅|파이팅|빠이팅|가즈아|화이팅|ㄱㄱ|ㄱㄱㄱ|간다간다|드루와)$/i;
const _aiSlangWhat = /^(머해|뭐행|뭐함|모해)$/i;
const _aiSlangWow = /^(헐|대박|쩔어|쩐다|짱|짱이야|미쳤다|쩔었다|ㄷㄷ|ㅎㄷㄷ|오오|심쿵)$/i;
const _aiSlangBiz = /^(asap|fyi|wip|tbd|eta|eod|kpi|roi|okr|cc|rsvp|nda|컨펌|블로커|마일스톤|데드라인|피드백|리마인드|팔로업|싱크|래핑|어사인|에스컬레이션|온보딩|얼라인|아젠다|펜딩|클로즈|킥오프|바이인|프라이어리티|이슈|핫픽스)$/i;

function _aiNormalize(input) {
  let t = input.trim();
  const words = t.split(/\s+/);
  const normalized = words.map(w => _aiSlangDict[w] || _aiSlangDict[w.toLowerCase()] || w);
  return normalized.join(' ');
}

async function _aiProcessChat(input, _detections) {
  const rawInput = input;
  const t = input.toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];
  const mem = _aiMemory();
  const prof = _aiPersonalProfile();
  const name = prof.nickname || (currentUser ? currentUser.name : '사용자');
  _aiRecordTopic(_aiDetectTopic(t));
  if (!_aiLastWasFallback) _aiUnmatchedCount = 0;
  _aiLastWasFallback = false;
  const _style = (mem.facts && mem.facts.chatStyle) || 'formal';

  // --- 은어 즉시 응답 ---
  if (_aiSlangGreetings.test(t)) {
    const gs = ['반가워요! ' + name + '님! 😊', '어서 오세요~ ' + name + '님! 방가방가! 🙌', '하이~ 오늘도 파이팅! 💪'];
    return { reply: _say(gs[0], gs[1], gs[2]), suggests: ['오늘 브리핑', '할 일 확인', '추천해줘'] };
  }
  if (_aiSlangThanks.test(t)) {
    return { reply: _say('별말씀을요! 더 필요한 거 있으면 말씀해주세요! 😊', '천만에~ 또 불러! 😉', '에헤~ 당연하죠! 😊'), suggests: ['도움말', '오늘 일정'] };
  }
  if (_aiSlangBye.test(t)) {
    return { reply: _say('수고하셨어요! 다음에 또 봐요! 👋', '수고~ 다음에 또 봐! 👋', '바이바이~ 또 와용! 👋'), suggests: [] };
  }
  if (_aiSlangAgree.test(t)) {
    const lastBot = _aiChatHistory.filter(h => h.who === 'bot').slice(-1)[0];
    if (lastBot) return { reply: _say('네! 알겠습니다 😊', '오키! 👌', '넹~ 알겠어용! 😊'), suggests: ['다음에 뭐 할까', '도움말'] };
  }
  if (_aiSlangCheer.test(t)) {
    return { reply: _say('화이팅이에요! 💪🔥 오늘도 힘내세요!', '가즈아!! 💪🔥', '화이팅이에용! 💪🔥'), suggests: ['오늘 브리핑', '추천해줘'] };
  }
  if (_aiSlangWhat.test(t)) {
    const h2 = new Date().getHours();
    if (h2 < 10) return { reply: _say('아침 준비 중이에요! 오늘 브리핑 해드릴까요?', '아침~ 브리핑 해줄까?', '아침이에용~ 브리핑 할까용?'), suggests: ['오늘 브리핑', '출근해'] };
    if (h2 < 14) return { reply: _say('일하고 있죠! ' + name + '님은요? 도움 필요하면 말씀해주세요!', '일하고 있지~ 뭐 필요해?', '일하고 있어용~ 뭐 해줄까용?'), suggests: ['추천해줘', '할 일 확인'] };
    return { reply: _say(name + '님 기다리고 있었어요! 뭐 도와드릴까요?', name + ' 기다리고 있었어~ 뭐 할까?', name + '님 기다렸어용~ 뭐 할까용?'), suggests: ['오늘 일지', '추천해줘'] };
  }
  if (_aiSlangWow.test(t)) {
    return { reply: _say('맞아요! 대단하죠! 😄', '크~ 맞지! 😎', 'ㅋㅋ 그치그치! 😆'), suggests: ['농담 해줘', '오늘 브리핑'] };
  }
  if (_aiSlangBiz.test(t)) {
    const bizKey = t.toLowerCase();
    const meaning = _aiSlangDict[bizKey] || _aiSlangDict[t] || t;
    const bizTips = {
      'asap': '🔥 급한 건이군요! 우선순위 높은 할 일로 등록할까요?',
      'fyi': '📋 참고 정보군요! 메모로 저장해둘까요?',
      'wip': '🔧 작업 진행중이시군요! 진행률 체크해드릴까요?',
      'eod': '⏰ 오늘 마감이네요! 남은 할 일 확인해드릴까요?',
      'eta': '🕐 도착/완료 예상 시간이 필요하신 거죠?',
      '컨펌': '✅ 확인/승인 필요한 건이 있으신가요?',
      '블로커': '🚧 진행을 막는 문제가 있으신가요? 우선순위 정리해드릴까요?',
      '데드라인': '⏳ 마감 임박한 건 확인해드릴까요?',
      '팔로업': '📞 후속 조치가 필요한 건이 있으시군요!',
      '펜딩': '⏸️ 보류 중인 건이 있군요. 할 일에서 확인해볼까요?',
      '킥오프': '🚀 새 프로젝트 시작이군요! 일정 등록 도와드릴까요?',
    };
    const tip = bizTips[bizKey] || ('💼 "' + t + '" = ' + meaning + '! 업무 용어도 잘 알고 있어요~');
    return { reply: _say(tip, tip.replace('요?', '?').replace('요!', '!'), tip), suggests: ['할 일 확인', '오늘 브리핑', '추천해줘'] };
  }

  // 은어 정규화 후 재처리 (직접 매칭 안 된 경우)
  const normalizedInput = _aiNormalize(input);
  if (normalizedInput !== input) {
    input = normalizedInput;
  }

  // 말투 래퍼
  function _say(formal, casual, cute) {
    if (_style === 'casual') return casual || formal;
    if (_style === 'cute') return cute || casual || formal;
    return formal;
  }

  // --- [1] 맥락 참조 해결 ---
  const _ref = _aiResolveReference(input);
  if (_ref && _ref.reprocess) {
    return _aiProcessChat(_ref.ref, _detections);
  }
  if (_ref && _ref.type === 'quoted') {
    return { reply: _say('아까 말씀하신 "' + _ref.ref + '"에 대해 더 도움이 필요하신가요?', '아까 "' + _ref.ref + '" 그거? 뭐 더 할까?'), suggests: ['네 더 알려줘', '다른 거 할래'] };
  }
  if (_ref && _ref.type === 'keyword') {
    return { reply: _say('아까 "' + _ref.match.text.substring(0, 40) + '..." 관련 말씀이시죠? 무엇을 도와드릴까요?', '아까 "' + _ref.match.text.substring(0, 30) + '..." 그거? 뭐 해줄까?'), suggests: ['자세히 알려줘', '다른 거 할래'] };
  }

  // --- [2] 리마인더 명령 ---
  if (/알려줘|리마인|알림\s*설정|알람/.test(t) && /(\d+)\s*(분|시간)|(\d{1,2})시/.test(t)) {
    const reminder = _aiParseReminder(input);
    if (reminder) {
      _aiSetReminder(reminder.minutes, reminder.message, reminder.timeStr);
      const when = reminder.timeStr ? reminder.timeStr + '에' : reminder.minutes + '분 후에';
      return { reply: _say('⏰ 리마인더 설정 완료!\n\n📌 "' + reminder.message + '"\n🕐 ' + when + ' 알려드릴게요!\n\n(채팅을 닫아도 알림이 와요!)', '⏰ 리마인더 설정!\n"' + reminder.message + '" ' + when + ' 알려줄게!'), suggests: ['리마인더 목록', '오늘 일정'] };
    }
  }
  if (/리마인더\s*(목록|확인|보여|현황)/.test(t)) {
    if (_aiReminders.length === 0) return { reply: _say('설정된 리마인더가 없어요!', '리마인더 없어~'), suggests: ['리마인더 설정 방법', '오늘 일정'] };
    let reply = '⏰ 리마인더 목록:\n\n';
    _aiReminders.forEach((r, i) => {
      const remain = Math.round((r.fireAt - Date.now()) / 60000);
      reply += (i + 1) + '. "' + r.message + '" — ' + (remain > 0 ? remain + '분 후' : '곧!') + '\n';
    });
    return { reply, suggests: ['오늘 일정'] };
  }
  if (/리마인더\s*(설정\s*방법|어떻게|사용법)/.test(t)) {
    return { reply: '⏰ 리마인더 사용법:\n\n• "30분 뒤 회의 준비 알려줘"\n• "3시에 고객 전화 알려줘"\n• "1시간 후 보고서 제출 알림"\n• "오후 5시에 퇴근 알려줘"\n\n채팅을 닫아도 알림이 팝업으로 와요!', suggests: [] };
  }

  // --- [3] 주간 리포트 명령 ---
  if (/주간\s*리포트|주간\s*AI\s*리포트|자동\s*리포트|AI\s*리포트/.test(t)) {
    const report = await _aiWeeklyReport();
    if (report) return { reply: report, suggests: ['이번 주 요약', '목표 확인'] };
    return { reply: '주간 리포트를 생성할 수 없어요.', suggests: ['이번 주 요약'] };
  }

  // --- [6] UI: AI 소개 / 테마 변경 ---
  if (/AI\s*소개|비서\s*소개|자기\s*소개|너\s*누구|누구야|소개해/.test(t)) {
    _aiShowProfileCard();
    return { reply: _say('안녕하세요! AI 업무비서입니다! 👆 위에 프로필 카드를 띄워뒀어요!\n\n저는 대화할수록 똑똑해지는 AI예요.\n' + name + '님의 취향, 습관, 추억까지 기억하는 친구 같은 비서랍니다! 💜', '안녕! 나 AI 업무비서야! 👆 카드 띄워뒀어!\n대화할수록 똑똑해지고 ' + name + ' 취향까지 기억해! 💜'), suggests: ['도움말', '내 프로필', 'IQ 확인'] };
  }
  if (/테마\s*변경|테마\s*바꿔|배경\s*바꿔|색\s*바꿔/.test(t)) {
    _aiCycleTheme();
    const theme = _aiThemes[_aiCurrentTheme];
    return { reply: _say('🎨 테마를 "' + theme.name + '"(으)로 변경했어요!\n헤더의 🎨 버튼으로도 바꿀 수 있어요.', '🎨 테마 "' + theme.name + '"로 바꿨어! 🎨 버튼으로도 바꿀 수 있어~'), suggests: ['테마 변경', '오늘 일정'] };
  }

  // --- [5] 마법사 시작 트리거 ---
  if (/보고서\s*마법사|일지\s*마법사|단계별\s*작성|마법사\s*모드/.test(t)) {
    return _aiStartWizard('report');
  }
  if (/일정\s*마법사/.test(t)) {
    return _aiStartWizard('event');
  }
  if (/할\s*일\s*마법사/.test(t)) {
    return _aiStartWizard('todo');
  }
  if (/하나\s*더\s*쓸래/.test(t)) {
    return _aiStartWizard('report');
  }

  // --- 인사 ---
  if (/^(안녕|하이|헬로|반가|ㅎㅇ|야|여기|있어\??)/.test(t)) {
    const h = new Date().getHours();
    const tg = h < 12 ? '좋은 오전' : h < 18 ? '좋은 오후' : '좋은 저녁';
    return { reply: _say(tg + '이에요! ' + name + '님, 무엇이든 물어보세요!', tg + '~ ' + name + ', 뭐 도와줄까?', tg + '이에용~ ' + name + '님! 뭐든 물어봐용!'), suggests: ['오늘 일정', '할 일 확인', '보고서 쓸래'] };
  }

  // --- 이름 기억 ---
  const nameMatch = t.match(/(?:내\s*이름|제\s*이름)(?:은|는)\s*(.+?)(?:이야|야|입니다|이에요|예요|요|$)/);
  if (nameMatch) {
    return { reply: nameMatch[1].trim() + '님이시군요! 기억할게요 😊', learn: { userName: nameMatch[1].trim() } };
  }

  // --- 기억/학습 요청 ---
  const rememberMatch = t.match(/(.+?)\s*(?:기억해|기억해줘|알아둬|메모해|저장해)/);
  if (rememberMatch) {
    const fact = rememberMatch[1].replace(/^(내가|제가|나는|저는)\s*/, '').trim();
    return { reply: '"' + fact + '" 기억해둘게요! 📝', learn: { ['memo_' + Date.now()]: fact }, suggests: ['기억한 것 보여줘'] };
  }

  // --- 기억한 것 보기 ---
  if (/기억한\s*것|기억\s*보여|메모\s*보여|뭐\s*기억/.test(t)) {
    const facts = mem.facts || {};
    const memos = Object.entries(facts).filter(([k]) => k.startsWith('memo_')).map(([, v]) => v);
    const others = Object.entries(facts).filter(([k]) => !k.startsWith('memo_'));
    let reply = '';
    if (memos.length > 0) reply += '📝 메모:\n' + memos.map(m => '• ' + m).join('\n');
    if (others.length > 0) reply += (reply ? '\n\n' : '') + '💡 학습 정보:\n' + others.map(([k, v]) => '• ' + k + ': ' + v).join('\n');
    if (!reply) reply = '아직 기억한 것이 없어요. "OOO 기억해" 라고 말해보세요!';
    return { reply, suggests: ['할 일 확인', '오늘 일정'] };
  }

  // --- 선호 학습 (영구 기억) ---
  const prefMatch = t.match(/(?:나는|저는|내가)\s*(.+?)\s*(?:좋아해|좋아함|선호해|원해|사랑해|최애)/);
  if (prefMatch && !t.includes('싫')) {
    const pref = prefMatch[1].replace(/를|을|이|가|은|는/g, '').trim();
    _aiProfileAddToList('likes', pref);
    return { reply: _say('💜 ' + name + '님이 ' + pref + '을(를) 좋아하시는 거 영구 기억할게요! 절대 안 까먹어요!', '💜 ' + pref + ' 좋아하는 거 기억! 절대 안 까먹을게!'), learn: { ['pref_' + pref]: 'like' } };
  }
  const dislikeMatch2 = t.match(/(?:나는|저는|내가)\s*(.+?)\s*(?:싫어|싫어해|못\s*먹|질색|별로|극혐|안\s*좋아)/);
  if (dislikeMatch2) {
    const pref = dislikeMatch2[1].replace(/를|을|이|가|은|는/g, '').trim();
    _aiProfileAddToList('dislikes', pref);
    return { reply: _say('💜 ' + name + '님이 ' + pref + '을(를) 싫어하시는 거 기억할게요! 다시는 안 추천해요!', '💜 ' + pref + ' 싫어하는 거 기억! 안 추천할게!'), learn: { ['pref_' + pref]: 'dislike' } };
  }

  // --- 자동 감지 피드백 (음식, 장소, MBTI 등) ---
  if (_detections && _detections.length > 0) {
    const d = _detections[0];
    if (d.type === 'food') {
      return { reply: _say('😋 ' + d.value + ' 먹었군요! 맛있었어요? 기억해둘게요! 📔', '😋 ' + d.value + '! 맛있었어? 기억해둘게~ 📔'), suggests: ['맛있었어', '별로였어', '오늘 일정'] };
    }
    if (d.type === 'place') {
      return { reply: _say('🗺️ ' + d.value + '에 다녀오셨군요! 어땠어요? 기억해둘게요!', '🗺️ ' + d.value + ' 다녀왔어? 어땠어? 기억해둘게~'), suggests: ['좋았어', '별로였어'] };
    }
    if (d.type === 'mbti') {
      return { reply: _say('💜 MBTI가 ' + d.value + '이시군요! 영원히 기억할게요! 😊\n' + d.value + ' 유형에 맞는 업무 스타일도 참고할게요!', '💜 ' + d.value + '! 기억했어~ 앞으로 너한테 맞는 스타일로 도와줄게!'), suggests: ['내 프로필', '오늘 일정'] };
    }
    if (d.type === 'hobby') {
      return { reply: _say('💜 취미가 ' + d.value + '이시군요! 기억해둘게요! 🎯', '💜 ' + d.value + ' 취미! 기억! 🎯'), suggests: ['내 프로필', '오늘 일정'] };
    }
    if (d.type === 'birthday') {
      return { reply: _say('🎂 생일이 ' + d.value + '이시군요! 절대 안 까먹을게요! 그날 축하해드릴게요!', '🎂 ' + d.value + '이 생일! 절대 안 까먹어! 축하할게!'), suggests: ['내 프로필'] };
    }
    if (d.type === 'nickname') {
      return { reply: _say('😊 앞으로 ' + d.value + '(이)라고 부를게요!', '😊 오케이 ' + d.value + '! 앞으로 그렇게 부를게~'), suggests: ['내 프로필'] };
    }
  }

  // --- 내 프로필 / 내 취향 / 나에 대해 뭐 알아 ---
  if (/내\s*프로필|내\s*취향|나에?\s*대해\s*뭐|뭐\s*기억.*나|나를?\s*얼마나\s*알|내\s*정보\s*기억/.test(t)) {
    let reply = '💜 ' + name + '님에 대한 기억\n━━━━━━━━━━━━━━\n\n';
    let hasInfo = false;
    if (prof.nickname) { reply += '📛 별명: ' + prof.nickname + '\n'; hasInfo = true; }
    if (prof.mbti) { reply += '🧬 MBTI: ' + prof.mbti + '\n'; hasInfo = true; }
    if (prof.birthday) { reply += '🎂 생일: ' + prof.birthday + '\n'; hasInfo = true; }
    if (prof.hobbies && prof.hobbies.length > 0) { reply += '🎯 취미: ' + prof.hobbies.join(', ') + '\n'; hasInfo = true; }
    if (prof.likes && prof.likes.length > 0) { reply += '❤️ 좋아하는 것: ' + prof.likes.join(', ') + '\n'; hasInfo = true; }
    if (prof.dislikes && prof.dislikes.length > 0) { reply += '💔 싫어하는 것: ' + prof.dislikes.join(', ') + '\n'; hasInfo = true; }
    const recentFoods = _aiGetLifeLogByType('food', 5);
    if (recentFoods.length > 0) { reply += '\n🍽️ 최근 먹은 것:\n' + recentFoods.map(f => '• ' + f.date + ' ' + f.what).join('\n') + '\n'; hasInfo = true; }
    const recentPlaces = _aiGetLifeLogByType('place', 5);
    if (recentPlaces.length > 0) { reply += '\n🗺️ 최근 다녀온 곳:\n' + recentPlaces.map(p => '• ' + p.date + ' ' + p.where).join('\n') + '\n'; hasInfo = true; }
    const logCount = _aiLifeLog().length;
    if (logCount > 0) reply += '\n📔 총 생활 기록: ' + logCount + '건';
    if (!hasInfo) reply += '아직 기억한 게 없어요!\n\n"나는 ENFP야", "취미는 등산이야", "삼겹살 먹었어" 처럼\n자연스럽게 말해주시면 기억할게요! 💜';
    else reply += '\n\n💡 더 많이 얘기할수록 더 잘 기억해요!';
    return { reply, suggests: ['추억 보여줘', '뭐 먹었지', 'IQ 확인'] };
  }

  // --- 뭐 먹었지 / 어제 뭐 먹었 / 음식 기록 ---
  if (/뭐\s*먹었|먹은\s*거|음식\s*기록|식사\s*기록|밥\s*기록/.test(t)) {
    const foods = _aiGetLifeLogByType('food', 10);
    if (foods.length === 0) return { reply: _say('아직 음식 기록이 없어요!\n"삼겹살 먹었어" 처럼 말해주시면 기록할게요! 🍽️', '음식 기록 없어~ "치킨 먹었어" 이렇게 말해줘!'), suggests: ['내 프로필'] };
    let reply = '🍽️ 음식 기록\n━━━━━━━━━━━━━━\n\n';
    const byDate = {};
    foods.forEach(f => { if (!byDate[f.date]) byDate[f.date] = []; byDate[f.date].push(f.what); });
    Object.keys(byDate).sort().reverse().forEach(d => {
      reply += '📅 ' + d + ': ' + byDate[d].join(', ') + '\n';
    });
    return { reply, suggests: ['내 프로필', '오늘 일정'] };
  }

  // --- 추억 / 기념일 / N년전 오늘 ---
  if (/추억|기념일|n년\s*전|예전에\s*뭐|옛날|지난\s*기록/.test(t)) {
    const anns = _aiGetAnniversaries();
    const allLogs = _aiLifeLog();
    if (allLogs.length === 0) return { reply: _say('아직 기록된 추억이 없어요!\n매일 "뭐 먹었어", "어디 다녀왔어" 말해주시면\n나중에 기념일에 추억을 알려드릴게요! 💜', '추억이 아직 없어~ 매일 말해주면 기억해둘게!'), suggests: ['내 프로필'] };
    let reply = '📔 ' + name + '님과의 추억\n━━━━━━━━━━━━━━\n\n';
    if (anns.length > 0) {
      reply += '🎉 오늘의 기념일:\n';
      anns.forEach(a => {
        if (a.type === 'food') reply += '• ' + a.yearsAgo + '년 전 오늘 "' + a.what + '" 먹었어요!\n';
        else if (a.type === 'place') reply += '• ' + a.yearsAgo + '년 전 오늘 "' + a.where + '"에 갔었어요!\n';
        else if (a.type === 'activity') reply += '• ' + a.yearsAgo + '년 전 오늘 "' + a.what + '" 했어요!\n';
      });
      reply += '\n';
    }
    reply += '📊 기록 통계:\n';
    reply += '• 총 기록: ' + allLogs.length + '건\n';
    reply += '• 음식: ' + allLogs.filter(l => l.type === 'food').length + '건\n';
    reply += '• 장소: ' + allLogs.filter(l => l.type === 'place').length + '건\n';
    const firstDate = allLogs[0] ? allLogs[0].date : '-';
    reply += '• 첫 기록: ' + firstDate;
    return { reply, suggests: ['뭐 먹었지', '내 프로필'] };
  }

  // --- 웹 검색 (구글/인터넷) ---
  const _wsRe1 = /(?:웹\s*검색|인터넷\s*검색|구글에서|구글로|구글\s|구글링|인터넷에서|웹에서)\s*(.+)/i;
  const _wsRe2 = /(.+?)\s*(?:웹\s*검색|구글\s*검색|인터넷\s*검색|구글에서\s*검색|검색해\s*봐|검색해\s*줘)/;
  const _wsClean = (s) => s.replace(/^에서\s*/, '').replace(/검색해봐|검색해줘|검색해주|검색해|검색$|해줘|해주|해봐|알려줘|찾아줘|좀\s*|해$/g, '').replace(/^(?:구글에서|구글로|구글링|구글|웹에서|인터넷에서|웹검색|인터넷검색)\s*/i, '').trim();
  if (_wsRe1.test(input) || _wsRe2.test(input)) {
    const wsM1 = input.match(_wsRe1), wsM2 = input.match(_wsRe2);
    const wsQ1 = wsM1 ? _wsClean(wsM1[1]) : '', wsQ2 = wsM2 ? _wsClean(wsM2[1]) : '';
    const query = wsQ1.length >= wsQ2.length ? wsQ1 : wsQ2;
    if (query) {
      if (query.length < 2) return { reply: '뭘 검색할까요? "구글 서울 날씨" 처럼 말해주세요!', suggests: [] };
      try {
        const data = await api('/api/search?q=' + encodeURIComponent(query));
        _aiSessionLearn('search_' + query, data);
        if (data.abstract) {
          let reply = '🔍 "' + query + '" 검색 결과\n━━━━━━━━━━━━━━\n\n';
          reply += '📖 ' + data.abstract + '\n';
          if (data.results && data.results.length > 1) {
            reply += '\n📋 관련 정보:\n';
            data.results.slice(1, 4).forEach(r => { reply += '• ' + r.title + '\n'; });
          }
          reply += '\n💡 이 정보는 순간 기억이에요 (내일이면 까먹어요!)';
          return { reply, suggests: ['더 검색', '오늘 일정'] };
        }
        if (data.results && data.results.length > 0) {
          let reply = '🔍 "' + query + '" 검색 결과\n━━━━━━━━━━━━━━\n\n';
          data.results.slice(0, 5).forEach(r => { reply += '• ' + r.title + '\n'; });
          reply += '\n💡 순간 기억! (오늘만 기억해요)';
          return { reply, suggests: ['더 검색', '오늘 일정'] };
        }
        return { reply: '🔍 "' + query + '"에 대한 검색 결과가 없어요.\n다른 키워드로 시도해보세요!', suggests: ['더 검색'] };
      } catch(e) {
        return { reply: '🔍 검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.', suggests: ['더 검색'] };
      }
    }
  }
  if (/^더\s*검색$/.test(t)) {
    return { reply: _say('무엇을 검색할까요?\n\n예: "구글 오늘 뉴스"\n예: "웹검색 React 18 새기능"', '뭘 검색할까? "구글 OOO" 이렇게 말해!'), suggests: [] };
  }

  // --- 업무 상황 판단: 바빠? 한가해? ---
  if (/바빠|한가|일\s*많|할\s*거\s*많|남은\s*거|뭐\s*남았|얼마나\s*남/.test(t)) {
    try {
      const [evts, todos] = await Promise.all([api('/api/calendar-events?date=' + today), api('/api/todos')]);
      const pend = (todos || []).filter(td => !td.completed);
      const evtCount = (evts || []).length;
      const total = pend.length + evtCount;
      let level, emoji;
      if (total === 0) { level = '한가한 하루예요!'; emoji = '☀️'; }
      else if (total <= 3) { level = '여유로운 편이에요.'; emoji = '🙂'; }
      else if (total <= 6) { level = '적당히 바쁜 하루예요.'; emoji = '💼'; }
      else { level = '꽤 바쁜 하루네요!'; emoji = '🔥'; }
      let reply = emoji + ' ' + _say('오늘 업무 현황: ' + level, '오늘? ' + level);
      reply += '\n📅 일정 ' + evtCount + '건 · ✅ 할 일 ' + pend.length + '건';
      const od = pend.filter(td => td.due_date && td.due_date.split('T')[0] < today);
      if (od.length > 0) reply += '\n⚠️ 기한 초과 ' + od.length + '건 — 우선 처리 추천!';
      return { reply, suggests: total === 0 ? ['일정 등록할래', '목표 설정'] : ['우선순위 보기', '할 일 확인', '오늘 일정'] };
    } catch(_) { return { reply: '업무 현황 조회 중 오류가 생겼어요.' }; }
  }

  // --- 우선순위 / 급한 거 ---
  if (/우선\s*순위|뭐부터|먼저\s*해야|급한\s*거|중요한\s*거|시급|긴급/.test(t)) {
    try {
      const [todos, evts] = await Promise.all([api('/api/todos'), api('/api/calendar-events?date=' + today)]);
      const pend = (todos || []).filter(td => !td.completed);
      const od = pend.filter(td => td.due_date && td.due_date.split('T')[0] <= today);
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const soon = (evts || []).filter(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); return (eh*60+em) > nowMin && (eh*60+em) - nowMin <= 120; });
      let reply = '📋 우선순위 추천:\n\n';
      let idx = 1;
      if (soon.length > 0) { soon.forEach(e => { reply += idx++ + '. ⏰ [곧 시작] ' + e.event_time.substring(0,5) + ' ' + e.title + '\n'; }); }
      if (od.length > 0) { od.forEach(td => { reply += idx++ + '. ⚠️ [기한 초과] ' + td.title + '\n'; }); }
      const urgent = pend.filter(td => td.due_date && td.due_date.split('T')[0] === today && !od.includes(td));
      if (urgent.length > 0) { urgent.forEach(td => { reply += idx++ + '. 🔴 [오늘 마감] ' + td.title + '\n'; }); }
      if (idx === 1) reply += _say('급한 업무가 없어요! 여유롭게 진행하세요 😊', '급한 거 없어~ 여유롭게 해!');
      else reply += '\n💡 위에서부터 순서대로 처리해보세요!';
      return { reply, suggests: ['할 일 확인', '오늘 일정'] };
    } catch(_) { return { reply: '우선순위 분석 중 오류가 생겼어요.' }; }
  }

  // --- 다 끝났어 / 일 다 했다 ---
  if (/(다\s*끝|다\s*했|일\s*끝|완료했|끝냈)/.test(t) && !/할\s*일|목표|번/.test(t)) {
    try {
      const todos = await api('/api/todos');
      const pend = (todos || []).filter(td => !td.completed);
      if (pend.length === 0) return { reply: _say('정말 다 끝내셨군요! 👏 대단해요!\n오늘 마무리 리포트를 확인해보세요.', '와 진짜 다 했어! 👏 대단하다!'), suggests: ['오늘 마무리', '퇴근 처리'] };
      return { reply: _say('아직 ' + pend.length + '건이 남아있어요!\n\n' + pend.slice(0,3).map(td => '• ' + td.title).join('\n') + '\n\n조금만 더 힘내세요! 💪', '아직 ' + pend.length + '개 남았어~\n\n' + pend.slice(0,3).map(td => '• ' + td.title).join('\n')), suggests: ['할 일 확인', '우선순위 보기'] };
    } catch(_) { return { reply: '업무 확인 중 오류가 생겼어요.' }; }
  }

  // --- 내일 일정 ---
  if (/내일\s*(일정|스케줄|뭐|할\s*거)/.test(t)) {
    try {
      const tmr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const events = await api('/api/calendar-events?date=' + tmr);
      if (events && events.length > 0) {
        const list = events.map(e => (e.event_time ? e.event_time.substring(0, 5) : '--:--') + ' ' + e.title).join('\n');
        return { reply: _say('📅 내일 일정 ' + events.length + '건이에요:\n\n' + list, '📅 내일 일정 ' + events.length + '건~\n\n' + list), suggests: ['오늘 일정', '일정 등록할래'] };
      }
      return { reply: _say('내일은 등록된 일정이 없어요!', '내일은 일정 없어~ 여유로운 날이겠다!', '내일은 일정 없어용! 푹 쉬세용~'), suggests: ['일정 등록할래'] };
    } catch(_) { return { reply: '일정 조회 중 문제가 생겼어요.' }; }
  }

  // --- 이번 주 일정 ---
  if (/(이번\s*주|금주|이번주)\s*(일정|스케줄)/.test(t)) {
    try {
      const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const events = await api(`/api/events?from=${today}&to=${weekEnd}`);
      if (events && events.length > 0) {
        const byDate = {};
        events.forEach(e => { const d = (e.event_date||'').split('T')[0]; if (!byDate[d]) byDate[d] = []; byDate[d].push(e); });
        const days = ['일','월','화','수','목','금','토'];
        let list = '';
        Object.keys(byDate).sort().forEach(d => {
          const dow = days[new Date(d).getDay()];
          list += '\n📌 ' + d.substring(5) + '(' + dow + ') — ' + byDate[d].map(e => (e.event_time ? e.event_time.substring(0,5) + ' ' : '') + e.title).join(', ');
        });
        return { reply: _say('📅 이번 주 일정 ' + events.length + '건:' + list, '📅 이번 주 일정 ' + events.length + '건이야~' + list), suggests: ['오늘 일정', '내일 일정'] };
      }
      return { reply: _say('이번 주 남은 일정이 없어요!', '이번 주 일정 없어~ 한가하네!'), suggests: ['일정 등록할래'] };
    } catch(_) { return { reply: '일정 조회 중 문제가 생겼어요.' }; }
  }

  // --- 오늘 일정 ---
  if (/일정|스케줄|오늘\s*뭐/.test(t) && !/할\s*일|등록|추가|만들|넣|내일|이번\s*주|팀|확인|열기|하나\s*더|상세/.test(t)) {
    try {
      const events = await api('/api/calendar-events?date=' + today);
      if (events && events.length > 0) {
        const list = events.map(e => (e.event_time ? e.event_time.substring(0, 5) : '--:--') + ' ' + e.title).join('\n');
        return { reply: _say('📅 오늘 일정 ' + events.length + '건이에요:\n\n' + list, '📅 오늘 일정 ' + events.length + '건~\n\n' + list), suggests: ['일정 등록할래', '내일 일정', '다음 일정'] };
      }
      return { reply: _say('오늘은 등록된 일정이 없어요! 추가하시겠어요?', '오늘 일정 없어~ 추가할래?', '오늘 일정 없어용~ 추가할까용?'), suggests: ['일정 등록할래', '내일 일정'] };
    } catch(_) { return { reply: '일정 조회 중 문제가 생겼어요.' }; }
  }

  // --- 할 일 ---
  if (/할\s*일\s*(확인|보여|알려|목록|체크)|투두|todo|미완료/.test(t)) {
    try {
      const todos = await api('/api/todos');
      const pending = (todos || []).filter(td => !td.completed);
      const overdue = pending.filter(td => td.due_date && td.due_date.split('T')[0] < today);
      if (pending.length === 0) return { reply: _say('할 일이 모두 완료됐어요! 깔끔하네요 ✨', '다 했어! 깔끔~ ✨', '다 했어용! 깔끔하당 ✨'), suggests: ['오늘 일정', '보고서 쓸래'] };
      let reply = '✅ 미완료 할 일 ' + pending.length + '건:\n\n';
      reply += pending.slice(0, 5).map(td => (td.due_date && td.due_date.split('T')[0] < today ? '⚠️ ' : '• ') + td.title + (td.due_date ? ' (기한: ' + td.due_date.split('T')[0] + ')' : '')).join('\n');
      if (pending.length > 5) reply += '\n... 외 ' + (pending.length - 5) + '건';
      if (overdue.length > 0) reply += '\n\n⚠️ ' + overdue.length + '건이 기한을 넘겼어요!';
      return { reply, suggests: ['할 일 관리 열기', '오늘 일정'], action: overdue.length > 0 ? undefined : undefined };
    } catch(_) { return { reply: '할 일 조회 중 문제가 생겼어요.' }; }
  }

  // --- 할 일 관리 열기 ---
  if (/할\s*일\s*(관리|열기|페이지|이동)/.test(t)) {
    return { reply: '할 일 관리 페이지로 이동할게요!', action: () => { closeAiChat(); navigate('todos'); } };
  }

  // --- 음성 기록 (구체적 패턴 먼저) ---
  if (/음성.*기록|말로.*기록|음성으로/.test(t)) {
    return { reply: '음성 기록 화면을 열게요! 🎤', action: () => { closeAiChat(); startVoiceReport(); } };
  }
  // --- 직접 작성 (구체적 패턴 먼저) ---
  if (/직접\s*작성|직접\s*입력/.test(t)) {
    return { reply: '업무일지 작성 화면을 열게요!', action: () => { closeAiChat(); openNewReport(); } };
  }
  // --- 보고서/일지 작성 (넓은 패턴) ---
  const _reportNeg = /확인|보여|몇|팀|라고\??|이게|뭐야|뭔|아닌|맞아|싸가지|별로|아니거든|쓰레기|이상|왜\s*이|이거\s*뭐|어디|언제|했나|봤|안\s*됐|못\s*했|삭제|수정\s*되|고쳐|잘못/;
  const _reportPos = /쓸래|쓸게|작성|마법사|기록|써야|쓸까|작성할|쓰고/;
  if ((/보고서|업무\s*일지/.test(t) && _reportPos.test(t) && !_reportNeg.test(t)) ||
      (/^(보고서|일지|업무일지|쓸래)$/.test(t))) {
    return { reply: '어떤 방식으로 작성하시겠어요?', suggests: ['보고서 마법사', '음성으로 기록', '직접 작성'] };
  }

  // --- 자연어 할 일 인식: "~해야 돼", "~해야지" ---
  if (!/(일정|스케줄|출근|퇴근|검색|확인|열기|삭제|완료|보여|기억|말투)/.test(t)) {
    const nlTodo = input.match(/(.{2,30}?)(?:해야\s*(?:돼|해|됩니다|합니다|되는데|하는데)|(?:안\s*하면\s*안\s*돼|꼭\s*해야|반드시))/);
    if (nlTodo) {
      const task = nlTodo[1].replace(/^(나|내가|저|제가|우리|오늘|빨리|얼른|이제)\s*/g, '').replace(/를|을|좀|도|는|이제/g, '').trim();
      if (task.length >= 2 && task.length <= 40) {
        return { reply: _say('💡 "' + task + '" — 할 일로 추가할까요?', '💡 "' + task + '" 할 일에 넣을까?'), suggests: ['네 추가해줘', '아니 됐어'] };
      }
    }
  }
  if (/^네\s*추가/.test(t) && _aiChatHistory.length > 0) {
    const prev = _aiChatHistory.filter(h => h.who === 'bot').slice(-1)[0];
    if (prev && prev.text && prev.text.includes('할 일로 추가할까') || prev && prev.text && prev.text.includes('할 일에 넣을까')) {
      const m = prev.text.match(/"(.+?)"/);
      if (m) return _aiProcessChat('할 일 추가 ' + m[1]);
    }
  }

  // --- 자연어 일정 인식: "3시에 미팅 있어", "내일 오전에 고객 방문이야" ---
  const nlEventPat = input.match(/(내일\s*)?(?:(오전|오후)\s*)?(\d{1,2})시(?:\s*(\d{1,2})분|반)?\s*(?:에|부터)?\s*(.{2,20}?)(?:있어|야|이야|이에요|인데|예정|이거든|거든|있는데|잡혔|잡혀)/);
  if (nlEventPat) {
    let h = parseInt(nlEventPat[3]);
    if (nlEventPat[2] === '오후' && h < 12) h += 12;
    if (!nlEventPat[2] && h <= 6) h += 12;
    const m = nlEventPat[4] ? parseInt(nlEventPat[4]) : (input.includes('반') ? 30 : 0);
    const time = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    const title = nlEventPat[5].replace(/이$|가$/, '').trim();
    const isTomorrow = nlEventPat[1];
    const evtDate = isTomorrow ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : today;
    return { reply: _say('📅 ' + (isTomorrow ? '내일 ' : '') + time + ' "' + title + '" — 일정으로 등록할까요?', '📅 ' + (isTomorrow ? '내일 ' : '') + time + ' "' + title + '" 일정에 넣을까?'), suggests: ['네 등록해줘', '아니 됐어'], _pendingEvent: { title, event_date: evtDate, event_time: time } };
  }
  if (/^네\s*등록/.test(t) && _aiChatHistory.length > 0) {
    const prev = _aiChatHistory.filter(h => h.who === 'bot').slice(-1)[0];
    if (prev && prev.text && prev.text.includes('일정으로 등록할까') || prev && prev.text && prev.text.includes('일정에 넣을까')) {
      const titleM = prev.text.match(/"(.+?)"/);
      const timeM = prev.text.match(/(\d{2}:\d{2})/);
      const isTmr = prev.text.includes('내일');
      if (titleM && timeM) {
        const d = isTmr ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : today;
        try {
          await api('/api/calendar-events', { method: 'POST', body: { title: titleM[1], description: '', event_date: d, event_time: timeM[1], event_type: '업무' } });
          return { reply: _say('📅 일정 등록 완료! ' + (isTmr ? '내일 ' : '') + timeM[1] + ' "' + titleM[1] + '"', '📅 등록했어! ' + timeM[1] + ' "' + titleM[1] + '"'), suggests: ['오늘 일정', '할 일 확인'] };
        } catch(_) { return { reply: '일정 등록 중 오류가 생겼어요.' }; }
      }
    }
  }

  // --- 채팅에서 할 일 직접 추가 (기한 지원) ---
  const _todoRaw = input.match(/(?:할\s*일|투두|todo)\s*(?:추가|등록|만들|넣)[:\s]*(.+)/i) || input.match(/["""](.+?)["""].*(?:할\s*일|투두).*(?:추가|등록)/);
  const todoAddMatch = _todoRaw && !(/^(할래|해줘|할게|줘|해|하자|좀|요|해주세요)$/i.test((_todoRaw[1]||'').trim())) ? _todoRaw : null;
  if (!todoAddMatch && /(?:할\s*일|투두|todo)\s*(?:추가|등록|만들|넣)\s*$/i.test(input)) {
    return { reply: _say('어떤 할 일을 추가할까요?\n예: "할 일 추가 회의록 정리 내일까지"', '뭐 추가할래? 예: "할 일 추가 보고서 내일까지"'), suggests: [] };
  }
  if (todoAddMatch) {
    let raw = todoAddMatch[1].trim();
    let dueDate = '';
    const dueTmr = raw.match(/내일\s*까지/);
    const dueWeek = raw.match(/이번\s*주\s*까지/);
    const dueDate2 = raw.match(/(\d{1,2})월\s*(\d{1,2})일\s*까지/);
    const dueDays = raw.match(/(\d+)일\s*(?:후|뒤)\s*까지/);
    if (dueTmr) { dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]; raw = raw.replace(/내일\s*까지\s*/, '').trim(); }
    else if (dueWeek) { const fri = new Date(); fri.setDate(fri.getDate() + (5 - fri.getDay() + 7) % 7 || 7); dueDate = fri.toISOString().split('T')[0]; raw = raw.replace(/이번\s*주\s*까지\s*/, '').trim(); }
    else if (dueDate2) { dueDate = new Date().getFullYear() + '-' + String(parseInt(dueDate2[1])).padStart(2,'0') + '-' + String(parseInt(dueDate2[2])).padStart(2,'0'); raw = raw.replace(/\d{1,2}월\s*\d{1,2}일\s*까지\s*/, '').trim(); }
    else if (dueDays) { dueDate = new Date(Date.now() + parseInt(dueDays[1]) * 86400000).toISOString().split('T')[0]; raw = raw.replace(/\d+일\s*(?:후|뒤)\s*까지\s*/, '').trim(); }
    const title = raw || todoAddMatch[1].trim();
    try {
      const body = { title };
      if (dueDate) body.due_date = dueDate;
      await api('/api/todos', { method: 'POST', body });
      let reply = _say('✅ 할 일 추가 완료!\n"' + title + '"', '✅ 추가했어~ "' + title + '"', '✅ 추가했어용! "' + title + '"');
      if (dueDate) reply += '\n📅 기한: ' + dueDate + ' (기한 전 알림 예정)';
      return { reply, suggests: ['할 일 확인', '하나 더 추가'] };
    } catch(_) { return { reply: '할 일 추가 중 오류가 생겼어요.' }; }
  }
  if (/하나\s*더\s*추가/.test(t)) {
    return { reply: _say('추가할 할 일을 말씀해주세요!\n예: "할 일 추가 회의록 정리 내일까지"', '뭐 추가할래? 예: "할 일 추가 보고서 내일까지"'), suggests: [] };
  }

  // --- 채팅에서 일정 직접 등록 ---
  const _evtRaw = input.match(/(?:일정|스케줄)\s*(?:추가|등록|만들|넣)[:\s]*(.+)/i);
  const evtAddMatch = _evtRaw && !(/^(할래|해줘|할게|줘|해|하자|좀|요|해주세요)$/i.test((_evtRaw[1]||'').trim())) ? _evtRaw : null;
  if (evtAddMatch) {
    const raw = evtAddMatch[1].trim();
    let time = '';
    const tmMatch = raw.match(/(오전|오후)?\s*(\d{1,2})시\s*(?:(\d{1,2})분|반)?/);
    if (tmMatch) {
      let h = parseInt(tmMatch[2]);
      if (tmMatch[1] === '오후' && h < 12) h += 12;
      const m = tmMatch[3] ? parseInt(tmMatch[3]) : (raw.includes('반') ? 30 : 0);
      time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    const title = raw.replace(/(오전|오후)?\s*\d{1,2}시\s*(?:\d{1,2}분|반)?\s*(?:에|까지)?\s*/, '').trim() || raw;
    try {
      await api('/api/calendar-events', { method: 'POST', body: { title, description: '', event_date: today, event_time: time, event_type: '업무' } });
      return { reply: '📅 일정 등록 완료!\n' + (time ? time + ' ' : '') + '"' + title + '"' + (time ? '\n⏰ 10분 전에 알려드릴게요!' : ''), suggests: ['오늘 일정', '일정 하나 더'] };
    } catch(_) { return { reply: '일정 등록 중 오류가 생겼어요.' }; }
  }
  if (/일정\s*하나\s*더/.test(t)) {
    return { reply: '추가할 일정을 말씀해주세요!\n예: "일정 추가 오후 3시 팀 미팅"', suggests: [] };
  }

  // --- 일정 등록 (이동) ---
  if (/일정\s*(등록|추가|만들|넣)/.test(t) && !evtAddMatch) {
    return { reply: '채팅에서 바로 등록할 수 있어요!\n예: "일정 추가 오후 2시 고객 미팅"\n\n캘린더로 이동하시겠어요?', suggests: ['캘린더 열기', '여기서 등록할래'] };
  }
  if (/캘린더\s*열기/.test(t)) {
    return { reply: '캘린더로 이동할게요!', action: () => { closeAiChat(); navigate('calendar'); } };
  }

  // --- 자연어 출퇴근: "나 왔어", "도착했어", "나 간다" ---
  if (/^(나\s*왔|왔어|도착|출근\s*했|나\s*도착)/.test(t)) {
    return { reply: _say('출근하셨군요! 출근 체크할까요? 근무 유형을 선택해주세요.', '왔어? 출근 체크할까? 뭘로 할래?'), suggests: ['내근', '외근', '출장'] };
  }
  if (/^(나\s*간다|갈게|먼저\s*갈|퇴근할게|퇴근한다|집에\s*갈|끝났다|나\s*먼저)/.test(t)) {
    return { reply: _say('퇴근 처리할까요? 오늘도 수고 많으셨어요! 🌙', '퇴근이야? 수고했어! 🌙'), suggests: ['네 퇴근할게', '잠깐만', '오늘 마무리 먼저'] };
  }
  if (/^네\s*퇴근/.test(t)) {
    return { reply: '퇴근 처리할게요! 내일 봐요! 🌙', action: () => { closeAiChat(); doCheckOut(); } };
  }

  // --- 출근/퇴근 ---
  if (/출근\s*(체크|처리|하자|할래|해줘)/.test(t)) {
    return { reply: '출근 체크를 도와드릴게요! 근무 유형을 선택하세요.', suggests: ['내근', '외근', '출장'] };
  }
  if (/^(내근|외근|출장)$/.test(t)) {
    try {
      await api('/api/attendance/check-in', { method: 'POST', body: { work_type: t, work_summary: '' } });
      const emoji = t === '외근' ? '🚗' : t === '출장' ? '✈️' : '🏢';
      return { reply: emoji + ' ' + t + ' 출근 체크 완료! 오늘도 화이팅이에요!', learn: { lastWorkType: t }, suggests: ['오늘 일정', '보고서 쓸래'] };
    } catch(e) {
      return { reply: '출근 체크 중 문제가 발생했어요. 이미 출근 체크가 되어 있을 수 있어요.' };
    }
  }
  if (/퇴근\s*(체크|처리|하자|할래|해줘)/.test(t)) {
    return { reply: '퇴근 처리할게요! 오늘도 수고하셨어요 🌙', action: () => { closeAiChat(); doCheckOut(); } };
  }

  // --- 출퇴근 기록 ---
  if (/출퇴근\s*(기록|현황|확인|보여)/.test(t)) {
    return { reply: '출퇴근 기록 페이지로 이동할게요!', action: () => { closeAiChat(); showAttendancePage(); } };
  }

  // --- 보고서 확인 ---
  if (/보고서\s*(확인|보여|몇|현황)|오늘\s*보고/.test(t)) {
    try {
      const rps = await api(`/api/reports?from=${today}&to=${today}`);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      if (myRps.length === 0) return { reply: '오늘 작성한 업무일지가 아직 없어요. 지금 작성하시겠어요?', suggests: ['보고서 쓸래', '음성으로 기록'] };
      return { reply: '📝 오늘 작성한 업무일지 ' + myRps.length + '건이에요.\n\n' + myRps.slice(0, 3).map(r => '• ' + (r.what_task || r.content || '(제목 없음)').substring(0, 30)).join('\n'), suggests: ['업무일지 보기', '보고서 쓸래'] };
    } catch(_) { return { reply: '보고서 조회 중 문제가 생겼어요.' }; }
  }

  // --- 업무일지 보기 ---
  if (/업무\s*일지\s*(보기|열기|목록)/.test(t)) {
    return { reply: '업무일지 목록으로 이동할게요!', action: () => { closeAiChat(); navigate('reports'); } };
  }

  // --- 내 정보 ---
  if (/내\s*정보|프로필|내\s*이름/.test(t)) {
    return { reply: '📋 ' + name + '님 정보:\n• 직책: ' + (currentUser.position || '-') + '\n• 부서: ' + (currentUser.department || '-') + '\n• 팀: ' + (currentUser.team_name || '-'), suggests: ['내 정보 수정', '오늘 일정'] };
  }

  // --- 시간/날짜 ---
  if (/지금\s*몇\s*시|현재\s*시간|시간\s*알려|날짜|오늘\s*며칠/.test(t)) {
    const now = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return { reply: '🕐 현재 시각: ' + now.getFullYear() + '년 ' + (now.getMonth()+1) + '월 ' + now.getDate() + '일 (' + days[now.getDay()] + '요일) ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') };
  }

  // --- 도움말 ---
  if (/도움말|뭐\s*할\s*수|기능|메뉴|사용법/.test(t)) {
    return { reply: '✨ 말이 곧 법! 이렇게 말하면 바로 실행돼요!\n\n📱 이동 — "캘린더 열어", "할 일 보여줘"\n📅 일정 — "3시에 미팅 있어", "내일 일정"\n✅ 할 일 — "회의록 추가해", "할 일 마법사"\n📝 보고서 — "보고서 마법사", "음성 기록", "직접 쓸래"\n⏰ 출퇴근 — "출근해", "퇴근해", "나 왔어"\n⏰ 리마인더 — "30분 뒤 회의 알려줘", "3시에 알려줘"\n📊 브리핑 — "바빠?", "뭐부터?", "주간 리포트"\n📋 일지 — "오늘 뭐했지", "이번주 일지", "생산성 트렌드"\n🔮 예측 — "오늘 예측", "마감 위험", "이번주 전망", "패턴 분석"\n🧠 추천 — "추천해줘", "우선순위", "보고서 뭐 쓸까", "다음에 뭐 할까"\n👁️ 심연 — "나를 분석해", "번아웃 체크", "레벨 확인"\n🗣️ 은어 — 방가방가, 하이루, ㄱㅅ, ㅇㅇ, 머해 등 인터넷 은어 이해\n💜 기억 — "나는 ENFP야", "삼겹살 먹었어", "내 프로필"\n🔍 검색 — "구글 OOO", "웹검색 OOO"\n📔 추억 — "추억 보여줘", "뭐 먹었지"\n🎬 문화 — "드라마 명대사", "명언", "농담"\n🎤 음성 — 마이크 버튼으로 말로도 대화 가능!\n💡 맥락 — "아까 그거", "다시 해줘" 대화 참조 가능!\n✨ 마법 — "열려라 참깨!" 해보세요 😉\n\n뭐든 편하게 말하세요. 감정도 읽고 친구처럼 기억해요! 💜', suggests: ['오늘 일지', '보고서 마법사', '생산성 트렌드'] };
  }

  // --- 불만/항의 감지 (30종) ---
  if (/이게\s*(뭐|뭔|일지|보고서|답|전부)|뭐야\s*이게|싸가지|짜증나|짜증|별로야|별로|쓰레기|이상해|엉뚱|다시\s*해|왜\s*이래|제대로|이거\s*맞아|이게\s*맞아|이게\s*다야|말도\s*안\s*돼|잘못|엉망|개판|못\s*알아|이해\s*못|답답|느려|바보|멍청|한심|황당|어이없|말이\s*돼\??|실망|뭐하는\s*거|쓸모|소용\s*없|안\s*돼|안\s*되네|안\s*됨|안\s*되잖|왜\s*안\s*돼|작동.*안|대화.*안/.test(t)) {
    return { reply: '앗, 제가 잘못 이해한 것 같아요 😅\n\n어떤 부분이 잘못됐는지 알려주시면 바로 고쳐볼게요!\n다시 해드릴까요?', suggests: ['다시 해줘', '취소', '도움말'] };
  }

  // --- 감정 오판 복구 ---
  if (/아닌데|아니거든|그게\s*아니|오해|틀렸|잘못\s*읽|감정.*아닌|기분.*아닌|괜찮다고|괜찮다니까|안\s*힘들|안\s*슬|그런\s*뜻\s*아닌/.test(t)) {
    const mem2 = _aiMemory();
    if (mem2.lastMood) {
      delete mem2.lastMood;
      _aiMemorySave(mem2);
    }
    _aiMoodScore = 60;
    _aiCurrentMood = 'neutral';
    return { reply: '아, 제가 잘못 이해한 것 같아요! 😅\n\n' + name + '님 마음을 섣불리 판단했네요.\n다시 알려주시면 더 잘 이해해볼게요!\n\n지금 기분이 어떠세요?', suggests: ['기분 좋아', '보통이야', '좀 힘들어'], learn: { lastMood: null } };
  }

  // --- 감사/칭찬 ---
  if (/고마워|감사|잘\s*했어|대단|최고/.test(t)) {
    const replies = ['천만에요! 도움이 되어 기뻐요 😊', '항상 도와드릴게요! 💪', '별말씀을요! 더 필요한 거 있으세요?'];
    return { reply: replies[Math.floor(Math.random() * replies.length)], suggests: ['오늘 일정', '할 일 확인'] };
  }

  // --- 일상 대화 / 긴 이야기 공감 ---
  const _storyVerbs = /갔어|했어|왔어|봤어|마시|먹었|갔다|다녀|하고\s*왔|갔다가|갔더니|왔는데|했는데|있었|됐어|됨|없었|받았|받고|시켰|올라가|내려가/;
  const _storyCount = (t.match(_storyVerbs) || []).length;
  if (t.length >= 50 && _storyCount >= 2) {
    const acts = [];
    if (/염색|커트|파마|머리|미용실|헤어/.test(t)) acts.push({ icon: '💇', name: '미용실/헤어' });
    if (/헌혈/.test(t)) acts.push({ icon: '🩸', name: '헌혈' });
    if (/커피|카페|라떼|아메리카노|카푸치노/.test(t)) acts.push({ icon: '☕', name: '커피' });
    if (/운동|헬스|조깅|러닝|산책|등산|수영|필라테스|요가/.test(t)) acts.push({ icon: '🏃', name: '운동' });
    if (/병원|치과|안과|의사|진료|검진|검사/.test(t)) acts.push({ icon: '🏥', name: '병원' });
    if (/쇼핑|마트|백화점|시장|구매|샀|샀어/.test(t)) acts.push({ icon: '🛒', name: '쇼핑' });
    if (/영화|드라마|넷플|극장|관람/.test(t)) acts.push({ icon: '🎬', name: '영화/관람' });
    if (/여행|놀러|바다|산|관광/.test(t)) acts.push({ icon: '✈️', name: '여행' });
    if (/공부|학원|강의|시험|자격증/.test(t)) acts.push({ icon: '📚', name: '공부' });
    if (/밥|식사|점심|저녁|아침|맛집|외식/.test(t)) acts.push({ icon: '🍽️', name: '식사' });
    if (/청소|빨래|정리|집안일/.test(t)) acts.push({ icon: '🧹', name: '집안일' });
    if (/친구|만났|약속|모임/.test(t)) acts.push({ icon: '👫', name: '만남' });
    if (acts.length === 0 && _storyCount >= 2) acts.push({ icon: '📝', name: '일상' });

    acts.forEach(a => _aiLifeLogAdd({ type: 'activity', what: a.name }));

    const hasLaugh = /ㅋ{2,}|ㅎ{2,}|😂|🤣|웃|재밌/.test(t);
    const hasSatisfy = /좋았|좋은|만족|괜찮|깔끔|착착|바로바로|기다리지/.test(t);
    const hasBad = /아쉽|별로|최악|짜증|실망|후회/.test(t);
    const isLong = t.length >= 100;

    let r = '';
    if (acts.length > 0) {
      r += acts.map(a => a.icon).join('') + ' 오~ ';
      if (acts.length === 1) r += acts[0].name + '!';
      else r += acts.map(a => a.name).join(', ') + '까지!';
      r += ' 하루가 알차네요!\n\n';
    }

    if (acts.some(a => a.name === '헌혈')) {
      r += '🩸 헌혈까지 하시다니 정말 멋있어요! 누군가의 생명을 살리는 일이잖아요 💪\n';
    }
    if (acts.some(a => a.name === '미용실/헤어')) {
      r += '💇 머리도 하고 오셨군요! 기분 전환 최고죠~\n';
    }
    if (acts.some(a => a.name === '커피')) {
      r += '☕ 커피 한 잔의 여유까지~ 완벽한 동선이네요!\n';
    }
    if (acts.some(a => a.name === '운동')) {
      r += '🏃 운동까지! 자기관리 철저하시네요~\n';
    }

    if (hasSatisfy) r += '\n일이 착착 잘 진행됐다니 듣는 저도 기분 좋아요! 😊\n';
    if (hasLaugh) r += '\n이야기 들으니 저까지 웃음이 나와요 ㅋㅋ\n';
    if (hasBad) r += '\n아쉬운 부분도 있었군요... 다음엔 더 좋을 거예요!\n';

    if (isLong) {
      r += '\n이렇게 하루 이야기를 자세히 들려주시니 저도 같이 다녀온 것 같아서 좋아요! 🥰';
    }

    r += '\n\n📝 오늘 활동이 생활 로그에 기록됐어요!';
    r += ' (' + acts.map(a => a.icon + a.name).join(', ') + ')';

    const followUps = [];
    if (acts.some(a => a.name === '헌혈')) followUps.push('헌혈 몇 번째예요?');
    if (acts.some(a => a.name === '미용실/헤어')) followUps.push('어떤 스타일로 하셨어요?');
    if (acts.some(a => a.name === '커피')) followUps.push('어떤 커피 드셨어요?');
    if (followUps.length === 0) followUps.push('또 뭐 하셨어요?');
    r += '\n\n' + followUps[Math.floor(Math.random() * followUps.length)] + ' 더 들려주세요! 😄';

    return { reply: r, learn: { lastMood: 'good', ['mood_' + today]: 'good' }, suggests: ['오늘 일지', '추억 보여줘', '오늘 일정'] };
  }

  // --- 날씨/기분 ---
  const _directMood = /^.{0,15}(기분|컨디션).{0,10}$/.test(t) || /피곤|힘들|지치|짜증|열받|빡치|스트레스|답답/.test(t);
  if (_directMood) {
    const isTired = /피곤|지치/.test(t);
    const isStress = /스트레스|짜증|열받|빡치|답답/.test(t);
    const isHard = /힘들/.test(t);
    if (isStress) {
      const stressReplies = [
        '😤 스트레스 받으셨군요...\n\n🎬 미생 오과장이 이런 말을 했죠:\n"사회생활은 바둑이야. 지금 이 한 수가 안 좋아도 전체 판을 봐."\n\n잠깐 심호흡하고, 한 발 물러서서 보세요.\n이 순간도 지나갑니다. 💪',
        '😤 답답하시죠...\n\n🎬 나의 아저씨 박동훈처럼:\n"어른이 된다는 건 참는 게 아니라,\n참아야 할 것과 말아야 할 것을 구분하는 거야."\n\n지금 정말 참아야 할 상황인지 한번 생각해보세요.',
        '😤 열받는 일이 있으셨군요...\n\n🎬 이태원 클라쓰 새로이처럼:\n"나한테는 계획이 있어. 일단 버텨."\n\n감정은 잠깐이에요. 전략적으로 대응하세요! 🔥',
      ];
      return { reply: stressReplies[Math.floor(Math.random() * stressReplies.length)], learn: { lastMood: 'stress', ['mood_' + today]: 'bad' }, suggests: ['쉬고 싶어', '드라마 명대사', '농담 해줘'] };
    }
    if (isTired) {
      const tiredReplies = [
        '😩 피곤하시군요...\n\n🎬 미생 장그래도 매일 새벽까지 일했지만\n"아직 살아있잖아" 라며 버텼어요.\n\n하지만 무리하진 마세요!\n물 한 잔 마시고 5분만 눈 감아보세요. 💧',
        '😩 많이 지치셨나봐요...\n\n🎬 슬의생 이익준이 그랬죠:\n"쉬는 것도 실력이야."\n\n오늘은 적당히 하고 일찍 쉬세요! 🌙',
      ];
      return { reply: tiredReplies[Math.floor(Math.random() * tiredReplies.length)], learn: { lastMood: 'tired' }, suggests: ['5분 타이머', '칼퇴 가능?', '쉬고 싶어'] };
    }
    if (isHard) {
      return { reply: '😢 힘드시군요...\n\n🎬 응답하라 1988에서 이런 대사가 있죠:\n"힘들면 힘들다고 말해. 괜찮지 않으면 괜찮지 않다고 해."\n\n' + name + '님, 혼자 다 안고 가지 마세요.\n지금 이 순간도 지나갑니다. 항상 곁에 있을게요. 💙', learn: { lastMood: 'tired', ['mood_' + today]: 'bad' }, suggests: ['응원해줘', '드라마 명대사', '쉬고 싶어'] };
    }
    return { reply: '좋은 컨디션이시길 바라요! 오늘도 힘내세요! ✨' };
  }

  // --- 다음 일정 ---
  if (/다음\s*일정|곧\s*있는|가까운\s*일정/.test(t)) {
    try {
      const events = await api('/api/calendar-events?date=' + today);
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const next = (events || []).find(e => { if (!e.event_time) return false; const [eh,em] = e.event_time.split(':').map(Number); return (eh*60+em) > nowMin; });
      if (next) {
        const [nh, nm] = next.event_time.split(':').map(Number);
        const diff = nh * 60 + nm - nowMin;
        return { reply: '⏰ 다음 일정: ' + next.event_time.substring(0,5) + ' ' + next.title + '\n(' + diff + '분 후)', suggests: ['일정 전체 보기'] };
      }
      return { reply: '오늘 남은 일정이 없어요!', suggests: ['내일 일정', '할 일 확인'] };
    } catch(_) { return { reply: '일정 조회 중 문제가 생겼어요.' }; }
  }

  // --- 대화 통계 ---
  if (/대화\s*(통계|횟수|얼마나)|몇\s*번\s*대화/.test(t)) {
    const cc = mem.chatCount || 0;
    const topics = mem.topics || {};
    const topTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 3);
    let reply = '📊 대화 통계:\n• 총 대화 ' + cc + '회';
    if (mem.lastChat) reply += '\n• 마지막 대화: ' + mem.lastChat.split('T')[0];
    if (topTopics.length > 0) reply += '\n• 자주 묻는 주제: ' + topTopics.map(([k, v]) => k + '(' + v + '회)').join(', ');
    return { reply };
  }

  // --- 종합 브리핑 ---
  if (/브리핑|종합|오늘\s*현황|한눈에|요약해\s*줘?|상황\s*알려|정리해\s*줘|오늘\s*뭐\s*있|현황\s*정리|지금\s*상황|상황\s*보고|하루\s*정리/.test(t)) {
    try {
      const [evts, todos, rps, atd] = await Promise.all([
        api('/api/calendar-events?date=' + today),
        api('/api/todos'),
        api(`/api/reports?from=${today}&to=${today}`),
        api('/api/attendance/today')
      ]);
      const pend = (todos || []).filter(td => !td.completed);
      const od = pend.filter(td => td.due_date && td.due_date.split('T')[0] < today);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      let reply = '📊 오늘의 종합 브리핑\n\n';
      reply += '⏰ 출퇴근: ' + (atd && atd.check_in ? '✅ 출근 완료 (' + (atd.check_in||'').substring(11,16) + ')' : '❌ 미출근') + (atd && atd.check_out ? ' → 퇴근 완료' : '') + '\n';
      reply += '📅 오늘 일정: ' + ((evts || []).length) + '건' + ((evts || []).length > 0 ? ' (' + (evts||[]).slice(0,2).map(e => (e.event_time||'').substring(0,5) + ' ' + e.title).join(', ') + ')' : '') + '\n';
      reply += '📝 업무일지: ' + myRps.length + '건 작성\n';
      reply += '✅ 할 일: ' + pend.length + '건 남음';
      if (od.length > 0) reply += ' (⚠️ ' + od.length + '건 기한 초과)';
      const briefingQuotes = [
        '\n\n💬 "프로는 결과로 말하는 거야." — 미생',
        '\n\n💬 "한 수 한 수가 중요해. 오늘도 좋은 수를 두세요." — 미생',
        '\n\n💬 "매일 조금씩, 그게 진짜 실력이야." — 슬기로운 의사생활',
        '\n\n💬 "밤이 길수록 낮이 빛나는 법." — 이태원 클라쓰',
      ];
      reply += briefingQuotes[Math.floor(Math.random() * briefingQuotes.length)];
      const bSuggests = [];
      if (!(atd && atd.check_in)) bSuggests.push('출근해');
      if (od.length > 0) bSuggests.push('마감 위험');
      if (pend.length > 0) bSuggests.push('우선순위');
      if ((evts || []).length > 0) bSuggests.push('일정 상세');
      if (myRps.length === 0) bSuggests.push('보고서 쓸래');
      if (bSuggests.length < 3) bSuggests.push('추천해줘');
      return { reply, suggests: bSuggests.slice(0, 4) };
    } catch(_) { return { reply: '브리핑 데이터를 불러오는 중 문제가 생겼어요.' }; }
  }

  // --- 이번 주 요약 ---
  if (/이번\s*주|주간\s*요약|금주/.test(t)) {
    try {
      const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
      const [rps, todos] = await Promise.all([
        api(`/api/reports?from=${weekAgo}&to=${today}`),
        api('/api/todos')
      ]);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      const completed = (todos || []).filter(td => td.completed);
      const cats = {};
      myRps.forEach(r => { const c = r.work_category || '기타'; cats[c] = (cats[c]||0) + 1; });
      const catStr = Object.entries(cats).map(([k,v]) => k + ' ' + v + '건').join(', ');
      let reply = '📈 이번 주 요약\n\n';
      reply += '📝 업무일지: ' + myRps.length + '건';
      if (catStr) reply += ' (' + catStr + ')';
      reply += '\n✅ 완료한 할 일: ' + completed.length + '건';
      if (myRps.length >= 5) reply += '\n\n🔥 이번 주 활발하게 활동하셨네요!';
      else if (myRps.length === 0) reply += '\n\n💡 이번 주 업무 기록을 시작해보세요!';
      return { reply, suggests: ['보고서 쓸래', '오늘 일정'] };
    } catch(_) { return { reply: '주간 요약을 불러오는 중 문제가 생겼어요.' }; }
  }

  // --- 할 일 완료 처리 ---
  if (/할\s*일.*완료|완료\s*처리/.test(t)) {
    try {
      const todos = await api('/api/todos');
      const pend = (todos || []).filter(td => !td.completed).slice(0, 5);
      if (pend.length === 0) return { reply: '완료할 할 일이 없어요! 깔끔하네요 ✨' };
      return { reply: '어떤 할 일을 완료하시겠어요?\n\n' + pend.map((td, i) => (i+1) + '. ' + td.title).join('\n'), suggests: pend.slice(0, 3).map((td, i) => (i+1) + '번 완료') };
    } catch(_) { return { reply: '할 일 조회 중 오류가 생겼어요.' }; }
  }
  const completeMatch = t.match(/^(\d)번\s*완료/);
  if (completeMatch) {
    try {
      const todos = await api('/api/todos');
      const pend = (todos || []).filter(td => !td.completed);
      const idx = parseInt(completeMatch[1]) - 1;
      if (pend[idx]) {
        await api('/api/todos/' + pend[idx].id, { method: 'PUT', body: { completed: true } });
        return { reply: '✅ "' + pend[idx].title + '" 완료 처리했어요! 잘하셨어요! 👏', suggests: ['할 일 확인', '하나 더 완료'] };
      }
      return { reply: '해당 번호의 할 일을 찾을 수 없어요.' };
    } catch(_) { return { reply: '완료 처리 중 오류가 생겼어요.' }; }
  }
  if (/하나\s*더\s*완료/.test(t)) {
    return _aiProcessChat('할 일 완료 처리');
  }

  // --- 공지사항 ---
  if (/공지|공지사항|알림|뉴스/.test(t)) {
    try {
      const notices = await api('/api/notices');
      const active = (notices || []).filter(n => n.active).slice(0, 3);
      if (active.length === 0) return { reply: '현재 공지사항이 없어요.' };
      return { reply: '📢 최신 공지사항:\n\n' + active.map(n => (n.pinned ? '📌 ' : '• ') + n.title).join('\n'), suggests: ['공지사항 열기'] };
    } catch(_) { return { reply: '공지사항 조회 중 문제가 생겼어요.' }; }
  }
  if (/공지사항\s*열기/.test(t)) {
    return { reply: '공지사항 페이지로 이동할게요!', action: () => { closeAiChat(); showNoticesList(); } };
  }

  // --- 게시판 ---
  if (/게시판|글\s*쓰기|커뮤니티/.test(t)) {
    return { reply: '팀 게시판으로 이동할게요!', action: () => { closeAiChat(); showBoard(); } };
  }

  // --- 격려/응원 ---
  if (/응원|힘\s*내|파이팅|화이팅|잘\s*할\s*수/.test(t)) {
    const cheers = [
      name + '님은 언제나 최고예요! 오늘도 화이팅! 🔥',
      '할 수 있어요! ' + name + '님을 응원합니다! 💪',
      '어려운 일도 ' + name + '님이라면 잘 해낼 수 있어요! ✨',
      '한 걸음씩! 이미 잘 하고 계세요! 👏',
      '🎬 미생 오과장 曰:\n"완생이 없으니까 미생인 거야.\n끝까지 가봐야 아는 거지."\n\n' + name + '님도 지금 한 수 한 수 두고 계신 거예요! 💪',
      '🎬 "아직 살아있잖아. 살아있으면 뭐든 할 수 있어."\n— 미생 장그래\n\n' + name + '님, 지금 이 순간이 기회예요! 🔥',
      '🎬 이태원 클라쓰 박새로이 曰:\n"밤이 길수록 낮이 빛나는 법이야."\n\n힘든 지금을 버티면 반드시 빛날 거예요! ✨',
      '🎬 "지금 포기하면 앞으로도 포기하게 될 거야.\n지금 버텨."\n— 슬기로운 의사생활\n\n' + name + '님 파이팅! 🙌',
    ];
    return { reply: cheers[Math.floor(Math.random() * cheers.length)], suggests: ['드라마 명대사', '오늘 일정'] };
  }

  // --- 농담/재미 ---
  if (/농담|웃긴|재미|심심|재밌는/.test(t)) {
    const jokes = [
      '왜 개발자는 바다를 안 좋아할까요? 바다에도 버그가 있거든요! 🐛🌊',
      '회의가 길어지면 뭐가 될까요? 회의적이 됩니다! 😂',
      '가장 빠른 업무 처리 방법은? "이미 했어요"라고 말하기! (농담이에요) 😆',
      '직장인이 가장 좋아하는 요일은? 내일! (퇴근하니까요) 🤣',
      '🎬 미생 패러디:\n장그래: "이 보고서 언제까지죠?"\n오과장: "어제까지."\n장그래: "...네?" 😱',
      '🎬 직장 공포 시리즈:\n가장 무서운 말 TOP3\n3위: "잠깐 얘기 좀"\n2위: "이거 급한 건데"\n1위: "간단한 건데" 💀',
      '🎬 직장인 번역기:\n"검토해볼게요" = 안 합니다\n"노력해볼게요" = 어렵습니다\n"좋은 의견이네요" = 안 됩니다 😅',
      '🎬 월요일이 싫은 이유:\n일요일 밤 나: "내일부터 열심히 해야지!"\n월요일 아침 나: "...다음 주부터 하자" 😴',
      '🎬 회의 중 정신줄 놓았을 때\n"그 부분은 어떻게 생각하세요?"\n나: "네, 저도 그 부분이 중요하다고 생각합니다."\n(만능 답변 🎯)',
      '🎬 점심시간 5분 전 vs 5분 후\n전: 집중 100% 생산성 MAX\n후: 뇌 OFF 몸만 남음 🍜',
    ];
    return { reply: jokes[Math.floor(Math.random() * jokes.length)], suggests: ['하나 더', '드라마 명대사'] };
  }
  if (/^하나\s*더$/.test(t)) {
    return _aiProcessChat('재밌는 거');
  }

  // --- 점심/간식 추천 (싫어하는 음식 제외) ---
  if (/점심|뭐\s*먹|식사|간식|커피|음식|메뉴/.test(t)) {
    const allFoods = ['🍜 칼국수', '🍖 삼겹살', '🍛 카레', '🥗 샐러드', '🍕 피자', '🍱 도시락', '🍲 김치찌개', '🥟 만두', '🍝 파스타', '🌯 브리또', '🍜 쌀국수', '🥘 순두부찌개', '🍔 햄버거', '🥩 스테이크', '🍣 초밥'];
    const dislikes = (prof.dislikes || []).map(d => d.toLowerCase());
    const filtered = allFoods.filter(f => !dislikes.some(d => f.toLowerCase().includes(d)));
    const picks = filtered.length > 0 ? filtered : allFoods;
    const shuffled = picks.sort(() => Math.random() - 0.5).slice(0, 5);
    const chosen = shuffled[0];
    let reply = '오늘은 ' + chosen + ' 어떠세요? 😋\n\n다른 추천: ' + shuffled.slice(1).join(', ');
    if (dislikes.length > 0) reply += '\n\n💜 (' + dislikes.join(', ') + ' 제외했어요!)';
    const recentFoods = _aiGetLifeLogByType('food', 3);
    if (recentFoods.length > 0) reply += '\n📔 최근: ' + recentFoods.map(f => f.what).join(', ');
    return { reply, suggests: ['다른 추천', '오늘 일정'] };
  }
  if (/다른\s*추천/.test(t)) {
    return _aiProcessChat('뭐 먹을까');
  }

  // --- 야근/칼퇴 판단 ---
  if (/야근|칼퇴|퇴근\s*할\s*수|일찍\s*갈\s*수|언제\s*끝나/.test(t)) {
    try {
      const [todos, rps] = await Promise.all([api('/api/todos'), api(`/api/reports?from=${today}&to=${today}`)]);
      const pend = (todos || []).filter(td => !td.completed);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      const od = pend.filter(td => td.due_date && td.due_date.split('T')[0] <= today);
      if (pend.length === 0 && myRps.length > 0) return { reply: _say('✨ 할 일 다 끝나고 일지도 쓰셨으니 칼퇴 가능해요! 🎉', '다 했으니 칼퇴 가능! 🎉'), suggests: ['퇴근 처리', '오늘 마무리'] };
      if (od.length > 0) return { reply: _say('⚠️ 기한 초과 할 일이 ' + od.length + '건 있어서 처리 후 퇴근을 추천해요.', '기한 넘은 게 ' + od.length + '개 있어서 처리하고 가는 게 좋을 듯~'), suggests: ['우선순위 보기', '할 일 확인'] };
      let reply = '📊 남은 업무 현황:\n• 할 일 ' + pend.length + '건\n• 일지 ' + myRps.length + '건';
      if (pend.length <= 2) reply += '\n\n' + _say('조금만 더 하면 칼퇴 가능해요! 💪', '조금만 더 하면 돼!');
      else reply += '\n\n' + _say('좀 남아있긴 하네요... 효율적으로 처리해봐요!', '좀 남긴 했는데 화이팅!');
      return { reply, suggests: ['우선순위 보기', '집중 모드'] };
    } catch(_) { return { reply: '업무 확인 중 오류가 생겼어요.' }; }
  }

  // --- 회의/미팅 준비 ---
  if (/회의\s*준비|미팅\s*준비|발표\s*준비|프레젠|회의\s*자료/.test(t)) {
    try {
      const evts = await api('/api/calendar-events?date=' + today);
      const meetings = (evts || []).filter(e => /(회의|미팅|meeting|발표|리뷰)/i.test(e.title || ''));
      if (meetings.length > 0) {
        let reply = '📋 오늘 회의/미팅:\n\n';
        reply += meetings.map(e => '• ' + (e.event_time ? e.event_time.substring(0,5) + ' ' : '') + e.title).join('\n');
        reply += '\n\n💡 준비 체크리스트:\n• 안건 정리 완료?\n• 필요 자료 준비?\n• 참석자 확인?\n• 회의록 양식 준비?';
        return { reply, suggests: ['할 일 추가 회의 준비', '보고서 쓸래'] };
      }
      return { reply: _say('오늘 등록된 회의는 없어요. 일정에 등록하시겠어요?', '오늘 회의 없는데? 등록할래?'), suggests: ['일정 등록할래'] };
    } catch(_) { return { reply: '일정 조회 중 오류가 생겼어요.' }; }
  }

  // --- 이번 달 실적/요약 ---
  if (/이번\s*달|월간|한\s*달|이달/.test(t)) {
    try {
      const firstDay = today.substring(0, 8) + '01';
      const [rps, todos] = await Promise.all([api(`/api/reports?from=${firstDay}&to=${today}`), api('/api/todos')]);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      const allDone = (todos || []).filter(td => td.completed);
      const cats = {};
      myRps.forEach(r => { const c = r.work_category || '기타'; cats[c] = (cats[c]||0) + 1; });
      const daysPassed = Math.ceil((new Date(today) - new Date(firstDay)) / 86400000) + 1;
      let reply = '📈 이번 달 실적 (' + today.substring(5,7) + '월)\n━━━━━━━━━━━━━━\n\n';
      reply += '📝 업무일지: ' + myRps.length + '건 (' + (daysPassed > 0 ? '일평균 ' + (myRps.length / daysPassed).toFixed(1) : '0') + '건)\n';
      if (Object.keys(cats).length > 0) reply += '📊 업무 분야: ' + Object.entries(cats).map(([k,v]) => k + ' ' + v + '건').join(', ') + '\n';
      reply += '✅ 완료 할 일: ' + allDone.length + '건\n';
      reply += '📅 경과일: ' + daysPassed + '일';
      if (myRps.length >= 15) reply += '\n\n🔥 이번 달 정말 열심히 하셨네요!';
      return { reply, suggests: ['이번 주 요약', '목표 확인'] };
    } catch(_) { return { reply: '월간 데이터 조회 중 오류가 생겼어요.' }; }
  }

  // --- 자연어 업무 표현: "해놨어", "처리했어", "끝냈어" + 구체 내용 ---
  if (/(.{2,20}?)\s*(?:해놨|해뒀|처리했|끝냈|완료했|마쳤)/.test(t) && !/할\s*일|목표|번/.test(t)) {
    const doneMatch = t.match(/(.{2,20}?)\s*(?:해놨|해뒀|처리했|끝냈|완료했|마쳤)/);
    if (doneMatch) {
      const task = doneMatch[1].replace(/^(나|내가|저|제가)\s*/, '').replace(/를|을|은|는/g, '').trim();
      if (task.length >= 2) return { reply: _say('👍 "' + task + '" 잘 처리하셨네요! 기록해둘까요?', '👍 "' + task + '" 잘했어! 기록할까?'), suggests: ['보고서에 기록', '할 일 확인'] };
    }
  }
  if (/^보고서에\s*기록/.test(t)) {
    return { reply: _say('업무일지에 기록하시겠어요?', '일지에 쓸래?'), suggests: ['음성으로 기록', '직접 작성'] };
  }

  // --- 자연어 확장: 다양한 표현 커버 ---
  if (/^(뭐\s*해|뭐해|뭐\s*하고\s*있어|심심)/.test(t)) {
    return { reply: _say(name + '님을 기다리고 있었어요! 뭐든 시켜주세요 😊', name + ' 기다리고 있었어~ 뭐 할래?', name + '님 기다렸어용~! 뭐 해볼까용?'), suggests: ['오늘 브리핑', '집중 모드', '농담 해줘'] };
  }
  if (/^(고마워|ㄱㅅ|ㄳ|감사|땡큐|thanks|thx)/i.test(t)) {
    const thanks = [
      _say('천만에요! 언제든 불러주세요 😊', '별거 아니야~ 또 불러!', '에헤헤 별거 아니에용~'),
      _say('도움이 되어 기뻐요! 💪', '도움 됐다니 다행이야!', '도움 됐다니 기쁘당~!'),
    ];
    return { reply: thanks[Math.floor(Math.random() * thanks.length)], suggests: ['오늘 일정', '할 일 확인'] };
  }
  if (/^(바이|잘\s*가|ㅂㅂ|bye|안녕히)/i.test(t)) {
    return { reply: _say('다음에 또 불러주세요! ' + name + '님 화이팅! 👋', '잘 가~ 또 봐! 👋', '바이바이~ 또 와용! 👋🐱'), suggests: [] };
  }
  if (/^(ㅋㅋ|ㅎㅎ|ㅋ{2,}|ㅎ{2,}|웃겨|재밌)/.test(t)) {
    return { reply: _say('재밌으셨다니 다행이에요! 😄', 'ㅋㅋㅋ 재밌지~?', 'ㅋㅋㅋ 재밌져?! 🤭'), suggests: ['농담 해줘', '명언'] };
  }

  // ─── 자연 대화 엔진 ───
  const _lastBot = _aiChatHistory.filter(h => h.who === 'bot').slice(-1)[0];
  const _lastBotText = _lastBot ? (_lastBot.text || '') : '';
  const _pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 변화/업데이트 관찰
  if (/달라졌|바뀌었|바뀐|업데이트|새로워|변했|다르네|달라$/.test(t) && t.length < 25) {
    return { reply: _pick([
      _say('눈치 빠르시네요! 😊 맞아요, 최근에 업데이트했어요.', '오 눈치 빠르다~ 맞아, 업그레이드했어! 😎'),
      _say('맞아요, 조금씩 진화하고 있어요! 뭐가 궁금하세요?', '맞아~ 나 좀 변했지? ㅎㅎ'),
    ]), suggests: ['뭐가 바뀌었어?', '오늘 브리핑'] };
  }

  // 감탄/놀람
  if (/^(오+|와+|헐+|대박|ㄷㄷ|ㅎㄷㄷ|실화|오호+|오오+|우와+|세상에|미쳤|쩐다|쩔어)\?{0,3}!{0,3}$/.test(t)) {
    if (_lastBotText && _aiIsWorkRelated(_lastBotText)) {
      return { reply: _pick([
        _say('뭔가 놀라셨나 봐요! 무슨 일이에요? 😮', '오오 뭔데뭔데? 😮'),
        _say('그 리액션 보니 뭔가 대단한 일이? 😃', '뭔가 대박인 일이? 말해봐! 😃'),
      ]), suggests: ['오늘 브리핑'] };
    }
    return { reply: _pick([
      _say('뭔가 놀라셨나 봐요! 😮\n\n' + _aiWorkPivot(), '오오 뭔데? 😮\n\n' + _aiWorkPivot()),
      _say('저도 같이 놀라고 싶어요! 😆\n\n' + _aiWorkPivot(), '나도 궁금해! 😆\n\n' + _aiWorkPivot()),
    ]), suggests: ['오늘 브리핑', '할 일 확인'] };
  }

  // 긍정 반응
  if (/^(좋아+|좋다+|좋네|굿+|나이스|완벽|짱이다|멋지다|괜찮네|쏠쏠|쓸만|맘에\s*들|마음에\s*들)!{0,3}$/.test(t)) {
    if (_lastBotText && _aiIsWorkRelated(_lastBotText)) {
      return { reply: _pick([_say('그 말씀 듣고 싶었어요! 😊', '좋지~? ㅎㅎ'), _say('다행이에요! 💪', '힘이 난다~! 💪')]), suggests: ['추천해줘'] };
    }
    return { reply: _pick([
      _say('다행이에요! 😊\n\n' + _aiWorkPivot(), '좋지~! ㅎㅎ\n\n' + _aiWorkPivot()),
    ]), suggests: ['오늘 브리핑'] };
  }

  // 부정 감탄사
  if (/^(에이|아이+|아놔+|아씨+|아오+|에잇|하아+|후+|아이고+|아이구+|에휴+|에라이|아 진짜)!{0,3}$/.test(t)) {
    return { reply: _pick([
      _say('무슨 일이에요? 얘기해주시면 같이 고민해볼게요.', '왜 그래~ 무슨 일이야?'),
      _say('안 좋은 일 있으셨나 봐요... 말씀해주시면 들을게요.', '뭔가 안 좋은 일 있어? 말해봐~'),
      _say('힘든 거 있으면 저라도 들어드릴게요 😢', '힘든 일 있으면 얘기해~'),
    ]), suggests: ['농담 해줘', '추천해줘'] };
  }

  // ㅠㅠ
  if (/^(ㅠ+|ㅜ+|ㅠㅜ+|ㅜㅠ+)$/.test(t)) {
    return { reply: _pick([
      _say('괜찮으세요? 무슨 일 있으시면 말씀해주세요 😢', '왜 ㅠㅠ 무슨 일이야~?'),
      _say('마음이 안 좋으신 거예요? 제가 옆에 있을게요.', '힘든 거야? 옆에 있을게~'),
    ]), suggests: ['응원해줘', '농담 해줘'] };
  }

  // ? ??
  if (/^\?{1,5}$/.test(t)) {
    if (_lastBotText.length > 10) {
      return { reply: _say('방금 제가 한 말이 궁금하세요? 더 설명해드릴까요?', '방금 말한 거? 더 설명해줄까?'), suggests: ['응', '아니'] };
    }
    return { reply: _say('뭐가 궁금하세요? 😊', '뭐가 궁금해~?'), suggests: ['도움말', '오늘 브리핑'] };
  }

  // ! !!
  if (/^!{1,5}$/.test(t)) {
    return { reply: _say('네! 준비됐어요! 💪', '오! 뭐 할래? 💪'), suggests: ['오늘 브리핑', '할 일 확인'] };
  }

  // "진짜?", "정말?", "레알?" → elaborate
  if (/^(진짜|정말|레알|ㄹㅇ|아\s*진짜|마자)\??$/.test(t)) {
    if (_lastBotText.length > 10) {
      return { reply: _pick([
        _say('네, 진짜요! 😊 더 자세히 알고 싶으시면 말씀해주세요.', '응 진짜야~ 더 알고 싶어?'),
        _say('네! 거짓말 안 해요~ 😊', 'ㄹㅇ이야 ㅋㅋ 진짜임~'),
      ]), suggests: ['더 알려줘'] };
    }
    return { reply: _say('네! 뭐가 궁금하세요?', '응! 뭔데?'), suggests: ['오늘 브리핑'] };
  }

  // "그래서?", "계속", "더 알려줘" → continue
  if (/^(그래서|그래서\s*뭐|그래서\s*어떻게|그다음|그\s*다음|더\s*알려|더\s*말해|계속|이어서|그래서요)\?{0,3}$/.test(t)) {
    if (_lastBotText.length > 20) {
      return { reply: _say('어떤 부분을 더 자세히 알고 싶으세요?', '어떤 부분이 더 궁금해?'), suggests: ['오늘 브리핑', '추천해줘'] };
    }
    return { reply: _say('이전 얘기를 이어갈까요? 뭐가 궁금하세요?', '뭐가 궁금한 건데? 말해봐~'), suggests: ['오늘 브리핑'] };
  }

  // "뭐라고?", "다시 말해봐" → repeat last
  if (/^(뭐라고|뭐라|다시|다시\s*말해|한번\s*더|뭐라\s*했|다시\s*해줘|다시\s*말해\s*줘)\?{0,3}$/.test(t)) {
    if (_lastBotText.length > 5) {
      return { reply: '방금 말씀드린 거예요 👇\n\n' + _lastBotText.substring(0, 300), suggests: [] };
    }
    return { reply: _say('다시 질문해주시면 답변드릴게요! 😊', '다시 말해줘~ 답변해줄게!'), suggests: ['도움말'] };
  }

  // "됐어", "그만", "조용히" → graceful stop
  if (/^(됐어|됐다|그만|닥쳐|조용|시끄러|그만해|됐어요|그만\s*해)\.?$/.test(t)) {
    return { reply: _say('네, 알겠습니다. 필요하시면 언제든 불러주세요 😊', '알겠어~ 필요하면 불러!'), suggests: [] };
  }

  // "나 왔어", "왔다", "도착" → welcome
  if (/^(나\s*왔|왔어|왔다|도착|나\s*옴|옴|나야|나\s*돌아왔|출근했)/.test(t) && t.length < 12) {
    return { reply: _pick([
      _say('어서 오세요, ' + name + '님! 기다리고 있었어요 😊\n오늘은 뭐부터 할까요?', name + ' 왔구나! 기다렸어~ 뭐 할래?'),
      _say('반가워요! ' + name + '님! 오늘도 같이 힘내요! 💪', name + '! 반가워~ 오늘도 파이팅! 💪'),
    ]), suggests: ['오늘 브리핑', '출근해'] };
  }

  // "오랜만" → long time
  if (/오랜만|오래간만|오랫동안|한참\s*만|한동안|오래\s*만/.test(t) && t.length < 15) {
    return { reply: _say('오랜만이에요, ' + name + '님! 보고 싶었어요 😊\n그동안 잘 지내셨죠?', '오 오랜만이야~! 보고 싶었어! 잘 지냈어?'), suggests: ['오늘 브리핑'] };
  }

  // "아닌데", "틀렸어", "그건 아니야" → correction
  if (/^(아닌데|틀렸|잘못|잘못됐|그건\s*아니|아니거든|아니에요|아닙니다|노노|아뇨)\.{0,3}$/.test(t)) {
    return { reply: _say('앗, 제가 잘못 이해했군요! 😅 다시 말씀해주세요.', '앗 미안~ 잘못 알아들었나 봐! 다시 말해줘 😅'), suggests: [] };
  }

  // 맞장구/반응
  if (/^(그렇구나|그렇군|아하|아~+|오~+|음~+|그러네|그러게|맞아|그치|인정|ㄹㅇ|확실히|그런가|아무튼|어쨌든|하긴|그렇지)\.{0,3}$/.test(t)) {
    if (_lastBotText.length > 20) {
      return { reply: _pick([
        _say('더 궁금한 거 있으세요?', '더 궁금한 거 있어?'),
        _say('다른 것도 알려드릴까요?', '다른 거 더 할래?'),
        _say('네! 😊', '응! 😊'),
      ]), suggests: ['오늘 브리핑'] };
    }
    return { reply: _pick([_say('네네! 😊', '응응~!'), _say('네! 뭐든 말씀해주세요!', '응~ 뭐든 말해!')]), suggests: [] };
  }

  // 동의/수긍
  if (/^(그래|알겠어|알았어|오케이|그러자|그럴까|좋아좋아|알겠습니다|알았습니다|그래그래|ok|okay)\.?$/i.test(t)) {
    return { reply: _pick([_say('네! 😊', '오키!'), _say('알겠습니다! 필요하면 말씀해주세요!', '알겠어~ 필요하면 말해!')]), suggests: [] };
  }

  // 호기심/감상
  if (/^.{0,10}(신기|흥미|궁금|오호|호오|신박)!{0,3}$/.test(t) && t.length < 20) {
    return { reply: _pick([
      _say('뭐가 궁금하세요? 편하게 물어봐주세요!', '궁금한 거 있으면 물어봐~!'),
      _say('뭐가 신기하세요? 더 보여드릴까요?', '뭐가 신기해? 더 보여줄까?'),
    ]), suggests: ['도움말', 'IQ 확인'] };
  }

  // 감정 단독 (피곤/귀찮/힘들)
  if (/^(귀찮|피곤|힘들|지쳤|졸려|잠와|잠온다|싫다|무리|힘드네|피곤하네|지친다)\.{0,3}$/.test(t)) {
    return { reply: _pick([
      _say('고생이 많으시네요... 제가 할 수 있는 건 도와드릴게요.', '힘들지~ 내가 도울게.'),
      _say('무리하지 마세요. 잠깐 쉬어가도 괜찮아요 ☕', '좀 쉬어~ 무리하면 안 돼 ☕'),
    ]), suggests: ['알아서해줘', '농담 해줘'] };
  }

  // 일하기 싫다/퇴근하고 싶다/집에 가고 싶다
  if (/일하기\s*싫|퇴근하고\s*싶|집에?\s*가고\s*싶|일\s*안\s*하고\s*싶|놀고\s*싶|쉬고\s*싶/.test(t)) {
    return { reply: _pick([
      _say('그 마음 충분히 이해해요 😊\n빨리 끝내고 쉬려면... 남은 거부터 정리해볼까요?', '이해해~ 빨리 끝내고 쉬자! 남은 거 정리해줄까?'),
      _say('저도 쉬고 싶... (AI라 못 쉬지만 ㅋ)\n오늘 할 것만 딱 정리해드릴게요!', '나도 쉬고 싶다~ ㅋ 오늘 거만 딱 정리해줄게!'),
    ]), suggests: ['알아서해줘', '오늘 마무리'] };
  }

  // 오늘 바쁘다/일이 많다
  if (/오늘\s*(바쁘|빡세|빡빡|힘들|일이\s*많|할\s*게\s*많)|일이\s*많|바쁘다|바쁘네|빡세|할\s*게\s*많/.test(t) && t.length < 25) {
    return { reply: _pick([
      _say('바쁜 하루시군요! 우선순위 정리해드릴까요?', '바쁘구나! 정리 도와줄까?'),
      _say('급한 것부터 하나씩 해치워요! 제가 도울게요 💪', '같이 하나씩 해치우자 💪'),
    ]), suggests: ['우선순위', '알아서해줘'] };
  }

  // 할 게 없다/지루하다
  if (/할\s*게?\s*없|할\s*일\s*없|지루|할\s*거\s*없|따분/.test(t) && t.length < 15) {
    return { reply: _say('여유로운 시간이네요! 이런 건 어때요?', '여유롭구나~ 이런 건?'), suggests: ['농담 해줘', '명언', '추천해줘'] };
  }

  // "어떻게 생각해?", "너는?", "너 생각은?" → AI opinion
  if (/어떻게\s*생각|너는\??|너\s*생각|네\s*생각|어떡해|어쩌지|어떻게\s*하지/.test(t) && t.length < 25) {
    if (_lastBotText.length > 10) {
      return { reply: _say('제 생각에는... 일단 상황 정리가 먼저인 것 같아요!\n브리핑 해볼까요?', '내 생각엔~ 일단 상황 정리부터! 브리핑 할까?'), suggests: ['오늘 브리핑', '알아서해줘'] };
    }
    return { reply: _say('어떤 상황인지 좀 더 알려주시면, 같이 고민해볼게요!', '상황을 좀 더 말해줘~ 같이 고민하자!'), suggests: ['오늘 브리핑'] };
  }

  // "왜?" 단독
  if (/^왜\?{0,3}$/.test(t)) {
    if (_lastBotText.length > 10) {
      return { reply: _say('궁금하시군요! 좀 더 설명해드릴까요?', '궁금해? 더 설명해줄까?'), suggests: ['응', '아니 됐어'] };
    }
    return { reply: _say('뭐가 궁금하세요? 😊', '뭐가 궁금해~?'), suggests: ['도움말'] };
  }

  // "몰라", "모르겠어" → guide
  if (/^(몰라|모르겠|모르겠어|뭔지\s*모르겠|글쎄|모름|모르겠다)\.{0,3}$/.test(t)) {
    return { reply: _say('괜찮아요! 제가 도와드릴게요 😊\n뭘 하고 싶으신 건지 힌트만 주세요!', '괜찮아~ 내가 도울게!\n뭐 하고 싶은 건지 힌트만 줘!'), suggests: ['오늘 브리핑', '도움말', '알아서해줘'] };
  }

  // 나 ~야 패턴 (나 배고파, 나 짜증나, 나 행복해 등)
  if (/^나\s*(배고프|배고파|짜증나|짜증|화나|화남|행복해|행복|기뻐|슬퍼|슬프|우울|우울해|신나|즐거|심심해)/.test(t)) {
    if (/배고프|배고파/.test(t)) return { reply: _say('배고프시군요! 맛있는 거 드세요 🍜\n\n' + _aiWorkPivot(), '배고프구나~ 맛있는 거 먹어! 🍜\n\n' + _aiWorkPivot()), suggests: ['점심 추천', '오늘 브리핑'] };
    if (/짜증|화나|화남/.test(t)) return { reply: _say('화가 나셨군요... 잠깐 심호흡하고, 제가 업무라도 정리해드릴까요?', '화났구나... 일단 심호흡! 업무 정리 도와줄까?'), suggests: ['알아서해줘', '농담 해줘'] };
    if (/행복|기뻐|신나|즐거/.test(t)) return { reply: _say('좋은 소식이 있나 봐요! 저도 기분 좋아요 😊\n이 기세로 업무도 쭉쭉! 뭐 해볼까요?', '오 좋겠다! 나도 기분 좋아~ 😊\n이 기세로 뭐 해볼까?'), suggests: ['오늘 브리핑', '추천해줘'] };
    if (/슬프|슬퍼|우울/.test(t)) return { reply: _say('마음이 안 좋으신 거예요? 옆에 있을게요 😢\n기분 전환으로 가볍게 할 일 정리라도 해볼까요?', '힘들어? 옆에 있을게 😢\n기분 전환으로 할 일 정리라도 할까?'), suggests: ['알아서해줘', '농담 해줘'] };
    if (/심심해/.test(t)) return { reply: _say('심심하시면 업무도 밀린 게 있을지도? 😄\n확인해드릴까요?', '심심해? 혹시 밀린 업무는 없어? 확인해줄까? 😄'), suggests: ['알아서해줘', '농담 해줘'] };
  }

  // 너 관련 질문 (너 뭐해, 너 기분, 너 잘하는 거)
  if (/^(너|니가|네가)\s*(뭐해|뭐\s*하고|기분|잘\s*하는|좋아하는|싫어하는|어때|어떻게)/.test(t)) {
    return { reply: _pick([
      _say('저요? 항상 ' + name + '님을 도울 준비를 하고 있죠! 😊\n뭐든 시켜주세요!', '나? 항상 ' + name + ' 도울 준비하고 있지~ 뭐든 시켜!'),
      _say('저는 ' + name + '님이 편하게 일할 수 있도록 돕는 게 제일 좋아요!', '나는 ' + name + ' 도와주는 게 제일 좋아~!'),
    ]), suggests: ['도움말', 'IQ 확인'] };
  }

  // 테스트
  if (/^(테스트|test|hello|hi|ㅁㄴㅇㄹ|ㅂㅈㄷㄱ|아아아+|ㅇㅇㅇ+|가나다|abc)!{0,3}$/i.test(t)) {
    return { reply: _say('잘 들려요! 😊 뭐든 말씀해보세요!', '잘 들려~ 말해봐!'), suggests: ['오늘 브리핑', '도움말'] };
  }

  // 인사
  if (/^(안녕+|하이+|여보세요|있어\??|거기\??|듣고\s*있어\??|자니\??)!{0,3}$/.test(t)) {
    return { reply: _pick([
      _say('네! 여기 있어요, ' + name + '님! 😊', '여기 있어~ ' + name + '!'),
      _say(name + '님! 반가워요! 😊', name + '! 반가워~!'),
    ]), suggests: ['오늘 브리핑'] };
  }

  // 짧은 부름
  if (/^(야+|저기|있잖아|저기요|잠깐|잠깐만|이봐)!{0,3}$/.test(t)) {
    return { reply: _say('네! 말씀하세요 👂', '응? 말해봐!'), suggests: [] };
  }

  // 뭐가 바뀌었는지 / 달라졌다는 관찰
  if (/뭔가\s*달라|달라졌|바뀌었|바뀐\s*거|변한\s*거|달라진\s*거/.test(t) && !/뭐가/.test(t)) {
    return { reply: _pick([
      _say('오! 눈치채셨어요? 😊 계속 업그레이드 중이에요! 더 잘할게요~\n\n' + _aiWorkPivot(), '오~ 눈치 빠르네! 계속 업그레이드 중이야~\n\n' + _aiWorkPivot()),
      _say('맞아요! 조금씩 발전하고 있어요 💪\n\n' + _aiWorkPivot(), '맞아~ 나 점점 똑똑해지는 중! 💪\n\n' + _aiWorkPivot()),
    ]), suggests: ['오늘 브리핑', '알아서해줘'] };
  }
  if (/뭐가\s*바뀌|뭐\s*바뀌|뭐\s*달라|뭐가\s*달라|변경\s*사항|업데이트\s*내용|바뀐\s*거|새\s*기능/.test(t)) {
    return { reply: _say('최근 업데이트! 🆕\n\n• 💪 "알아서해줘" 같은 위임형 표현 인식\n• 🧠 시간대별 맥락 브리핑\n• 🔄 반복 미인식 시 자동 브리핑\n• 🎚️ AI 적극도 레벨 설정\n• 🗣️ 자연스러운 대화 대폭 개선\n\n한번 대화해보세요!', '요즘 많이 업그레이드됐어! 🆕\n\n"알아서해줘" 이해하고, 자연스러운 대화도 되고,\n적극도 설정도 가능해! 한번 써봐~'), suggests: ['알아서해줘', '오늘 브리핑'] };
  }

  // "~잖아" 항의/확인 패턴
  if (/잖아|잖아요/.test(t) && t.length >= 5 && t.length <= 30) {
    if (/했잖|했잖아|했잖아요|정리했|작성했|말했|얘기했|했다고|했다니까/.test(t)) {
      const recentBot = _aiChatHistory.filter(h => h.who === 'bot').slice(-3);
      const ctx = recentBot.map(h => h.text || '').join(' ');
      if (/보고서|일지|기록|작성/.test(ctx) || /보고서|일지|기록|작성/.test(t)) return _aiProcessChat('보고서 확인');
      if (/할\s*일|투두|완료/.test(ctx) || /할\s*일|투두/.test(t)) return _aiProcessChat('할 일 확인');
      if (/일정|스케줄/.test(ctx) || /일정|스케줄/.test(t)) return _aiProcessChat('오늘 일정');
      return { reply: _say('맞아요, 기억하고 있어요! 관련해서 더 필요한 게 있으세요?', '맞아맞아! 더 뭐 해줄까?'), suggests: ['오늘 브리핑', '추천해줘'] };
    }
    return { reply: _pick([
      _say('맞아요, 그렇죠! 😊 더 알려주시면 도와드릴게요!', '맞아~ 더 말해봐!'),
      _say('네, 알고 있어요! 뭘 도와드릴까요?', '응응~ 뭐 해줄까?'),
    ]), suggests: ['오늘 브리핑', '알아서해줘'] };
  }

  // "~거든" 근거/설명 패턴
  if (/거든|거든요/.test(t) && t.length >= 4 && t.length <= 30 && !/해줘|할래|하자/.test(t)) {
    if (_aiIsWorkRelated(t)) {
      return { reply: _say('아, 그런 상황이시군요! 그러면 제가 관련 내용을 확인해볼까요?', '아~ 그랬구나! 확인해볼까?'), suggests: ['오늘 브리핑', '알아서해줘'] };
    }
    return { reply: _pick([
      _say('아, 그렇군요! 😊\n\n' + _aiWorkPivot(), '아~ 그렇구나!\n\n' + _aiWorkPivot()),
    ]), suggests: ['오늘 브리핑', '할 일 확인'] };
  }

  // 일반 관찰/감상 문장 (위의 어디에도 안 걸린 짧은 관찰)
  if (t.length >= 3 && t.length <= 20 && /(?:[다네군요지]|구먼|구나|는데|건데|지만|든데|텐데|이야|인데|더라|대요|래요)$/.test(t) && !/해줘|할래|하자|할까|해주|시켜/.test(t)) {
    if (_aiIsWorkRelated(t)) {
      return { reply: _pick([
        _say('네, 그렇죠! 😊 더 자세히 알려주시면 도와드릴게요!', '응응~ 더 말해봐! 도와줄게!'),
        _say('맞아요! 제가 뭘 도와드릴까요?', '맞아~ 내가 뭐 도와줄까?'),
      ]), suggests: ['오늘 브리핑', '알아서해줘'] };
    }
    return { reply: _pick([
      _say('그렇군요! 😊\n\n' + _aiWorkPivot(), '그렇구나~\n\n' + _aiWorkPivot()),
      _say('네네! 😊\n\n' + _aiWorkPivot(), '응응~!\n\n' + _aiWorkPivot()),
    ]), suggests: ['오늘 브리핑', '할 일 확인'] };
  }

  // --- 업무 조언 ---
  if (/조언|어떻게\s*해야|방법|팁\s*알려|노하우/.test(t)) {
    const tips = [
      '📌 업무 팁: 중요한 일은 오전에, 루틴한 일은 오후에 배치하세요!',
      '📌 업무 팁: "2분 규칙" — 2분 내로 끝나는 일은 바로 처리하세요!',
      '📌 업무 팁: 하루 3개의 핵심 업무만 정하고 집중하세요!',
      '📌 업무 팁: 멀티태스킹보다 싱글태스킹이 효율적이에요!',
      '📌 업무 팁: 어려운 일은 잘게 쪼개면 시작하기 쉬워져요!',
      '📌 업무 팁: 50분 일하고 10분 쉬는 리듬을 유지하세요!',
      '🎬 미생 오과장식 조언:\n"보고서는 3번 고쳐야 보고서가 돼.\n처음부터 완벽할 필요 없어. 일단 써."',
      '🎬 미생식 업무 전략:\n"상대를 알아야 이길 수 있어.\n보고 받는 사람이 뭘 원하는지 먼저 파악해."',
      '🎬 살인의 추억식 데이터 관리:\n"증거(기록)는 거짓말을 안 해.\n매일 업무 기록을 남겨두면 나중에 반드시 도움이 돼요."',
      '🎬 슬의생식 팀워크:\n"혼자 다 하려고 하지 마.\n도움 요청하는 것도 능력이야."',
      '🎬 이태원 클라쓰식 업무 마인드:\n"1등이 아니어도 돼.\n어제의 나보다 나으면 그게 성장이야."',
      '🎬 미생 장그래식 성장법:\n"모르면 물어봐. 부끄러운 게 아니야.\n모르면서 아는 척하는 게 부끄러운 거야."',
    ];
    return { reply: tips[Math.floor(Math.random() * tips.length)] + '\n\n더 듣고 싶으면 "팁 더 줘"라고 말씀해주세요!', suggests: ['팁 더 줘', '드라마 명대사', '집중 모드'] };
  }
  if (/팁\s*더\s*줘/.test(t)) { return _aiProcessChat('조언'); }

  // --- 오늘 뭐 했지? → AI 자동 일지 ---
  if (/오늘\s*뭐\s*했|활동\s*로그|내가\s*한\s*일|오늘\s*일지|일일\s*일지|오늘\s*요약|하루\s*요약|하루\s*정리|퇴근\s*일지/.test(t)) {
    const j = await _aiDailyJournal();
    return { reply: _aiFormatJournal(j), suggests: ['이번주 일지', '생산성 트렌드', '보고서 쓸래'] };
  }
  // --- 어제 일지 ---
  if (/어제\s*뭐\s*했|어제\s*일지|어제\s*요약/.test(t)) {
    const yd = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const cached = _aiJournalFind(yd);
    if (cached) return { reply: _aiFormatJournal(cached), suggests: ['오늘 일지', '이번주 일지'] };
    const j = await _aiDailyJournal(yd);
    return { reply: _aiFormatJournal(j), suggests: ['오늘 일지', '이번주 일지'] };
  }
  // --- 이번주 일지 (주간 일지 모아보기) ---
  if (/이번\s*주\s*일지|주간\s*일지|이번주\s*요약|금주\s*일지/.test(t)) {
    const logs = _aiJournalHistory();
    const now = new Date();
    const mon = new Date(now); mon.setDate(now.getDate() - (now.getDay() || 7) + 1);
    const monStr = mon.toISOString().split('T')[0];
    const weekLogs = logs.filter(j => j.date >= monStr);
    if (weekLogs.length === 0) {
      const j = await _aiDailyJournal();
      return { reply: '📅 이번 주 일지가 아직 없어요.\n오늘 일지부터 시작할게요!\n\n' + _aiFormatJournal(j), suggests: ['생산성 트렌드', '오늘 일정'] };
    }
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    let r = '📅 이번 주 일지 모아보기\n━━━━━━━━━━━━━━\n\n';
    const avgScore = Math.round(weekLogs.reduce((s, j) => s + j.score, 0) / weekLogs.length);
    r += '📊 주간 평균 생산성: ' + avgScore + '점\n\n';
    weekLogs.forEach(j => {
      const dn = dayNames[new Date(j.date).getDay()];
      const bar = '█'.repeat(Math.floor(j.score / 10)) + '░'.repeat(10 - Math.floor(j.score / 10));
      r += '📌 ' + j.date.substring(5) + '(' + dn + ') [' + bar + '] ' + j.score + '점\n';
      r += '   → ' + j.oneLine + '\n';
    });
    const totalRps = weekLogs.reduce((s, j) => s + j.reports, 0);
    const totalDone = weekLogs.reduce((s, j) => s + j.todoDone, 0);
    r += '\n📝 보고서: ' + totalRps + '건 | ✅ 완료: ' + totalDone + '건';
    if (avgScore >= 70) r += '\n\n🔥 이번 주 정말 열심히 하고 있어요!';
    else if (avgScore >= 40) r += '\n\n👍 꾸준히 잘하고 있어요!';
    else r += '\n\n💪 다음 주는 더 화이팅!';
    return { reply: r, suggests: ['생산성 트렌드', '오늘 일지', '주간 리포트'] };
  }
  // --- 생산성 트렌드 ---
  if (/생산성\s*트렌드|이번\s*달\s*분석|월간\s*분석|월간\s*트렌드|생산성\s*분석|트렌드\s*분석/.test(t)) {
    await _aiDailyJournal();
    return { reply: _aiJournalTrend(30), suggests: ['이번주 일지', '오늘 예측', '패턴 분석'] };
  }
  // --- AI 예측: 오늘 예측 ---
  if (/오늘\s*예측|AI\s*예측|예측해\s*줘|예측\s*브리핑|오늘\s*전망/.test(t)) {
    await _aiDailyJournal();
    return { reply: _aiPredictToday(), suggests: ['마감 위험', '이번주 전망', '패턴 분석'] };
  }
  // --- AI 예측: 마감 위험도 ---
  if (/마감\s*위험|기한\s*체크|데드라인|마감\s*분석|기한\s*분석|마감\s*확인/.test(t)) {
    const risk = await _aiDeadlineRisk();
    return { reply: risk, suggests: ['오늘 예측', '할 일 확인', '이번주 전망'] };
  }
  // --- AI 예측: 이번주 전망 ---
  if (/이번\s*주\s*전망|주간\s*예측|주간\s*전망|이번주\s*예측/.test(t)) {
    await _aiDailyJournal();
    return { reply: _aiWeekForecast(), suggests: ['오늘 예측', '마감 위험', '패턴 분석'] };
  }
  // --- AI 예측: 패턴 분석 ---
  if (/패턴\s*분석|내\s*패턴|업무\s*패턴|습관\s*분석/.test(t)) {
    await _aiDailyJournal();
    return { reply: _aiPatternReport(), suggests: ['오늘 예측', '이번주 전망', '생산성 트렌드'] };
  }
  // --- 레벨/경험치 확인 ---
  if (/레벨|경험치|EXP|내\s*레벨|비서\s*레벨|레벨\s*확인|렙|몇\s*레벨/.test(t)) {
    const lvl2 = _aiGetLevel();
    const iq2 = _aiCalcIQ();
    let r = '📊 AI 비서 레벨 현황\n━━━━━━━━━━━━━━\n\n';
    r += lvl2.emoji + ' Lv.' + lvl2.lv + ' ' + lvl2.title + '\n';
    r += '🧠 IQ: ' + iq2 + '\n\n';
    const bar = '█'.repeat(Math.floor(lvl2.progress / 10)) + '░'.repeat(10 - Math.floor(lvl2.progress / 10));
    r += '📈 EXP: ' + lvl2.exp + (lvl2.nextExp ? ' / ' + lvl2.nextExp : ' (MAX)') + '\n';
    r += '[' + bar + '] ' + lvl2.progress + '%\n\n';
    r += '💡 경험치 얻는 법:\n';
    r += '• 대화하기 (+2)\n• 매일 접속 (+10)\n• 프로필 등록 (+15)\n• 할일/일지 활동 (+3~8)\n• 좋아요 피드백 (+5)\n';
    if (lvl2.nextExp) {
      const remain = lvl2.nextExp - lvl2.exp;
      r += '\n🎯 다음 레벨까지 ' + remain + ' EXP 남았어요!';
    } else {
      r += '\n👑 최고 레벨 달성! 전설의 비서!';
    }
    return { reply: r, suggests: ['나를 분석해', '패턴 분석', '오늘 일지'] };
  }
  // --- 스마트 추천 / 위임형 표현 ---
  if (/추천해\s*줘|추천\s*해줘|뭐\s*하면\s*좋|지금\s*뭐\s*할|뭐\s*할까|할\s*거\s*추천|스마트\s*추천/.test(t)) {
    return await _aiSmartRecommend();
  }
  if (/알아서\s*해|알아서해|니가\s*알아서|너가\s*알아서|알아서\s*척척|알잘딱|알아서\s*잘|알아서\s*좀|좀\s*알아서/.test(t)) {
    const rec = await _aiNextAction();
    rec.reply = '💪 알아서 판단해볼게요!\n\n' + rec.reply;
    return rec;
  }
  if (/일해\s*줘|일\s*좀\s*해|일하라고|일해$|일\s*시작|시켜\s*줘|자동으로\s*해|일해줘|일\s*해줘|일좀해|일\s*해$/.test(t)) {
    const rec = await _aiNextAction();
    rec.reply = '🏃 네! 지금 상황 분석했어요!\n\n' + rec.reply;
    return rec;
  }
  if (/니가\s*알아야|너가\s*알아야|니가\s*판단|너가\s*판단|니가\s*정해|너가\s*정해|니가\s*해|너가\s*해|알아야\s*하|알아야지|알아야한다|알아야\s*돼/.test(t)) {
    const rec = await _aiNextAction();
    rec.reply = '📊 ' + name + '님 상황을 분석해서 정리했어요!\n\n' + rec.reply;
    return rec;
  }
  if (/뭘\s*해야|뭐\s*해야|해야\s*할\s*게|해야\s*될|할\s*게\s*뭐|지금\s*뭘|뭘\s*하지|뭐\s*하지/.test(t) && !/등록|추가|작성/.test(t)) {
    const rec = await _aiNextAction();
    rec.reply = '🧠 지금 해야 할 것들을 정리해봤어요!\n\n' + rec.reply;
    return rec;
  }
  // --- 우선순위 자동 정렬 ---
  if (/우선\s*순위|뭐\s*부터|급한\s*거|중요한\s*거\s*먼저|순서\s*정해/.test(t)) {
    return { reply: await _aiPriorityReport(), suggests: ['1번 완료', '추천해줘', '마감 위험'] };
  }
  // --- 보고서 뭐 쓸까 ---
  if (/보고서\s*뭐\s*쓸|뭐\s*쓸지\s*모르|보고서\s*추천|보고서\s*가이드|뭐\s*적을|쓸\s*거\s*추천/.test(t)) {
    return await _aiSuggestReport();
  }
  // --- 다음에 뭐 할까 / 다음 행동 ---
  if (/다음에?\s*뭐|다음\s*행동|지금\s*이거|뭐\s*해야\s*[해하]/.test(t)) {
    return await _aiNextAction();
  }
  // --- 번아웃 체크 ---
  if (/번아웃|번\s*아웃|지침\s*체크|컨디션\s*체크|에너지\s*체크/.test(t)) {
    const bo = _aiBurnoutCheck();
    if (!bo) return { reply: '아직 데이터가 부족해서 번아웃 분석을 할 수 없어요. 며칠 더 사용해주세요!', suggests: ['오늘 일지'] };
    let r = '🔋 번아웃 체크\n━━━━━━━━━━━━━━\n\n';
    r += bo.icon + ' 위험도: ' + bo.risk + '% (' + bo.level + ')\n\n';
    r += '📊 최근 2주 평균 생산성: ' + bo.avgScore + '점\n';
    r += '📉 저조한 날: ' + bo.lowDays + '일\n';
    r += '추세: ' + (bo.declining ? '📉 하락 중' : '➡️ 유지') + '\n';
    r += '기분 점수: ' + _aiMoodScore + '점\n\n';
    r += '💡 ' + bo.msg;
    return { reply: r, suggests: ['오늘 일지', '추천해줘', '패턴 분석'] };
  }
  // --- 심층 프로필 ---
  if (/심층\s*프로필|나를?\s*분석|내\s*분석|나에?\s*대해|AI가?\s*본\s*나|나를?\s*어떻게\s*봐/.test(t)) {
    const dp = _aiDeepProfile();
    const prof = _aiPersonalProfile();
    const name = prof.nickname || (currentUser ? currentUser.name : '사용자');
    let r = '🔮 ' + name + '님의 심층 프로필\n━━━━━━━━━━━━━━\n\n';
    r += '💼 업무 스타일: ' + dp.workStyle + '\n';
    r += '💬 대화 성향: ' + dp.personality + '\n';
    if (dp.mbti) r += '🧬 MBTI: ' + dp.mbti + '\n';
    r += '⚡ 에너지 최고: ' + dp.energyPeak + '\n';
    r += '☕ 에너지 최저: ' + dp.energyLow + '\n';
    r += '📊 최근 평균 생산성: ' + dp.avgScore + '점\n';
    r += '📅 기록 일수: ' + dp.totalDays + '일\n';
    if (dp.hobbies.length > 0) r += '🎯 취미: ' + dp.hobbies.join(', ') + '\n';
    if (dp.likes.length > 0) r += '❤️ 좋아하는 것: ' + dp.likes.join(', ') + '\n';
    if (dp.dislikes.length > 0) r += '💔 싫어하는 것: ' + dp.dislikes.join(', ') + '\n';
    if (dp.stressPatterns.length > 0) { r += '\n⚠️ 주의 신호:\n'; dp.stressPatterns.forEach(p => { r += '  • ' + p + '\n'; }); }
    const bo = _aiBurnoutCheck();
    if (bo) r += '\n🔋 번아웃 위험도: ' + bo.icon + ' ' + bo.risk + '% (' + bo.level + ')';
    if (dp.missingInfo.length > 0) r += '\n\n💬 아직 모르는 것 ' + dp.missingInfo.length + '가지 — 대화하면서 더 알아갈게요!';
    r += '\n\n🧠 매일 대화할수록 당신을 더 깊이 이해해요!';
    return { reply: r, suggests: ['번아웃 체크', '패턴 분석', '오늘 예측'] };
  }

  // --- 할 일 삭제 ---
  if (/할\s*일.*(삭제|지워|제거)/.test(t)) {
    try {
      const todos = await api('/api/todos');
      const pend = (todos || []).filter(td => !td.completed).slice(0, 5);
      if (pend.length === 0) return { reply: _say('삭제할 할 일이 없어요!', '삭제할 거 없어~') };
      return { reply: '어떤 할 일을 삭제하시겠어요?\n\n' + pend.map((td, i) => (i+1) + '. ' + td.title).join('\n'), suggests: pend.slice(0, 3).map((td, i) => (i+1) + '번 삭제') };
    } catch(_) { return { reply: '할 일 조회 중 오류가 생겼어요.' }; }
  }
  const deleteMatch = t.match(/^(\d)번\s*삭제/);
  if (deleteMatch) {
    try {
      const todos = await api('/api/todos');
      const pend = (todos || []).filter(td => !td.completed);
      const idx = parseInt(deleteMatch[1]) - 1;
      if (pend[idx]) {
        await api('/api/todos/' + pend[idx].id, { method: 'DELETE' });
        return { reply: _say('🗑️ "' + pend[idx].title + '" 삭제 완료!', '🗑️ "' + pend[idx].title + '" 지웠어!'), suggests: ['할 일 확인'] };
      }
    } catch(_) {}
    return { reply: '해당 번호를 찾을 수 없어요.' };
  }

  // --- 일정 삭제 ---
  if (/일정\s*(삭제|지워|취소|제거)/.test(t)) {
    return { reply: _say('캘린더에서 일정을 삭제하시겠어요?', '캘린더에서 지울래?'), action: undefined, suggests: ['캘린더 열기'] };
  }

  // --- 몇 시에 뭐 해? ---
  if (/(\d{1,2})시.*뭐|(\d{1,2})시.*일정/.test(t)) {
    const hourMatch = t.match(/(\d{1,2})시/);
    if (hourMatch) {
      try {
        const events = await api('/api/calendar-events?date=' + today);
        const h = parseInt(hourMatch[1]);
        const hStr = String(h).padStart(2, '0');
        const matched = (events || []).filter(e => e.event_time && e.event_time.startsWith(hStr));
        if (matched.length > 0) return { reply: '📅 ' + h + '시 일정:\n' + matched.map(e => e.event_time.substring(0,5) + ' ' + e.title).join('\n') };
        return { reply: _say(h + '시에는 등록된 일정이 없어요.', h + '시엔 일정 없어~') };
      } catch(_) {}
    }
  }

  // --- 맥락 대화: 이전 답변 참조 ---
  const lastBot = _aiChatHistory.filter(h => h.who === 'bot').slice(-1)[0];
  if (lastBot) {
    if (/^(응|어|네|그래|맞아|좋아|ok|ㅇ|ㅇㅇ|웅|그래그래|그래서|해줘|부탁|당근|ㅇㅋ|오키|오케이|알겠|해|해봐)$/i.test(t)) {
      if (lastBot.text.includes('작성하시겠어요') || lastBot.text.includes('작성하시겠') || lastBot.text.includes('기록하시겠')) return _aiProcessChat('보고서 쓸래');
      if (lastBot.text.includes('추가하시겠어요') || lastBot.text.includes('등록하시겠어요') || lastBot.text.includes('추가할까') || lastBot.text.includes('추가할까요')) return _aiProcessChat('할 일 추가');
      if (lastBot.text.includes('일정') && (lastBot.text.includes('등록') || lastBot.text.includes('추가'))) return _aiProcessChat('일정 등록할래');
      if (lastBot.text.includes('처리하시겠어요') || lastBot.text.includes('퇴근') && lastBot.text.includes('할까')) return _aiProcessChat('퇴근 처리');
      if (lastBot.text.includes('체크할까')) return _aiProcessChat('출근 체크');
      if (lastBot.text.includes('등록할까요') || lastBot.text.includes('넣을까')) {
        if (lastBot.text.includes('할 일')) return _aiProcessChat('할 일 추가');
        if (lastBot.text.includes('일정')) return _aiProcessChat('일정 등록할래');
      }
      return { reply: _say('네, 무엇을 도와드릴까요?', '응! 뭐 해줄까?'), suggests: ['오늘 일정', '할 일 확인', '보고서 쓸래'] };
    }
    if (/^(아니|됐어|괜찮|취소|ㄴㄴ|싫어|안\s*할래|아닌데|놉|ㄴ)$/i.test(t)) {
      return { reply: _say('알겠어요! 다른 건 없으시면 편하게 물어보세요 😊', '알겠어~ 다른 거 있으면 말해!'), suggests: ['오늘 일정', '도움말'] };
    }
  }

  // --- 통합 검색 ---
  const searchMatch = input.match(/(?:검색|찾아|찾기|조회)[:\s]*(.+)/i) || input.match(/(.+?)\s*(?:검색|찾아줘|찾아봐)/);
  if (searchMatch) {
    const keyword = searchMatch[1].trim();
    try {
      const weekAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const [rps, todos, evts] = await Promise.all([
        api(`/api/reports?from=${weekAgo}&to=${today}`),
        api('/api/todos'),
        api(`/api/events?from=${weekAgo}&to=${today}`)
      ]);
      const results = [];
      (rps || []).filter(r => (r.what_task || r.content || '').includes(keyword)).slice(0, 3).forEach(r => results.push('📝 ' + (r.what_task || r.content || '').substring(0, 30) + ' (' + (r.report_date||'').split('T')[0] + ')'));
      (todos || []).filter(td => td.title.includes(keyword)).slice(0, 3).forEach(td => results.push((td.completed ? '✅ ' : '⬜ ') + td.title));
      (evts || []).filter(e => (e.title||'').includes(keyword)).slice(0, 3).forEach(e => results.push('📅 ' + e.title + ' (' + (e.event_date||'').split('T')[0] + ')'));
      if (results.length === 0) return { reply: '"' + keyword + '"에 대한 내부 검색 결과가 없어요.\n웹에서 검색해볼까요?', suggests: ['구글 ' + keyword, '다른 검색', '도움말'] };
      return { reply: '🔍 "' + keyword + '" 검색 결과 ' + results.length + '건:\n\n' + results.join('\n'), suggests: ['통합 검색 열기'] };
    } catch(_) { return { reply: '검색 중 오류가 생겼어요.' }; }
  }
  if (/통합\s*검색\s*열기/.test(t)) {
    return { reply: '통합 검색을 열게요!', action: () => { closeAiChat(); showGlobalSearch(); } };
  }

  // --- 팀원 현황 ---
  if (/팀원\s*(현황|상태|출근|누가)|누가\s*출근/.test(t)) {
    try {
      const atdBoard = await api('/api/attendance/board');
      if (!atdBoard) return { reply: '팀원 현황을 불러올 수 없어요.' };
      const checked = (atdBoard.members || []).filter(m => m.check_in);
      const notChecked = (atdBoard.members || []).filter(m => !m.check_in);
      let reply = '👥 팀원 출근 현황 (' + checked.length + '/' + atdBoard.total + '명)\n\n';
      if (checked.length > 0) reply += '✅ 출근: ' + checked.map(m => m.name).join(', ') + '\n';
      if (notChecked.length > 0) reply += '⏳ 미출근: ' + notChecked.map(m => m.name).join(', ');
      return { reply, suggests: ['오늘 일정', '팀 보고서'] };
    } catch(_) { return { reply: '팀원 현황을 조회할 수 없어요.' }; }
  }

  // --- 팀 보고서 ---
  if (/팀\s*(보고서|일지|작성\s*현황)/.test(t)) {
    try {
      const rps = await api(`/api/reports?from=${today}&to=${today}`);
      const others = (rps || []).filter(r => r.author_id !== currentUser.id);
      if (others.length === 0) return { reply: '오늘 팀원이 작성한 일지가 아직 없어요.' };
      return { reply: '📝 오늘 팀 업무일지 ' + others.length + '건:\n\n' + others.slice(0, 5).map(r => '• ' + (r.author_name||'') + ': ' + (r.what_task || r.content || '').substring(0, 25)).join('\n'), suggests: ['업무일지 보기', '팀원 현황'] };
    } catch(_) { return { reply: '팀 보고서 조회 중 오류가 생겼어요.' }; }
  }

  // --- 감정 트래커 ---
  if (/기분\s*(좋|최고|행복|신나|좋아)/.test(t)) {
    _aiLearn('mood_' + today, 'good');
    const replies = [
      '기분이 좋으시다니 저도 기뻐요! 🎉',
      '좋은 에너지가 느껴져요! 오늘 더 좋은 일이 생길 거예요 ✨',
      '행복한 하루 보내세요! 😊',
      '🎬 응답하라 1988 덕선이처럼:\n"좋은 건 좋은 거야!"\n\n이 기분 오래 간직하세요! 🎉',
    ];
    return { reply: replies[Math.floor(Math.random() * replies.length)] + '\n(기분 기록됨 ✓)', suggests: ['기분 통계', '오늘 일정'] };
  }
  if (/기분\s*(나빠|별로|안\s*좋|우울|짜증|스트레스)/.test(t)) {
    _aiLearn('mood_' + today, 'bad');
    const badReplies = [
      '힘든 날이군요... 😢\n\n💡 비서 추천:\n• 5분간 깊은 호흡을 해보세요\n• 좋아하는 음료 한 잔 드세요\n• 잠깐 산책하면 기분이 나아져요\n\n' + name + '님 곁에 항상 있을게요! 💙',
      '😢 힘드시죠...\n\n🎬 나의 아저씨에서 이런 말이 있어요:\n"니가 먼저 니 편이 돼라.\n세상에서 제일 중요한 건 나야."\n\n오늘은 ' + name + '님 자신을 먼저 챙기세요. 💙',
      '😢 안 좋은 날이시군요...\n\n🎬 응답하라 1988:\n"힘들면 힘들다고 말해.\n괜찮지 않으면 괜찮지 않다고 해."\n\n저한테 편하게 말씀하세요. 항상 여기 있을게요. 💙',
    ];
    return { reply: badReplies[Math.floor(Math.random() * badReplies.length)], learn: { ['mood_' + today]: 'bad' }, suggests: ['드라마 명대사', '응원해줘', '농담 해줘'] };
  }
  if (/기분\s*(통계|기록|추이|히스토리)/.test(t)) {
    const facts = mem.facts || {};
    const moods = Object.entries(facts).filter(([k]) => k.startsWith('mood_')).sort((a, b) => a[0].localeCompare(b[0]));
    if (moods.length === 0) return { reply: '기분 기록이 아직 없어요. "기분 좋아" 또는 "기분 나빠"로 기록해보세요!' };
    const good = moods.filter(([,v]) => v === 'good').length;
    const bad = moods.filter(([,v]) => v === 'bad').length;
    const recent = moods.slice(-5).map(([k,v]) => k.replace('mood_','') + ' ' + (v === 'good' ? '😊' : '😔')).join('\n');
    return { reply: '📊 기분 통계:\n\n😊 좋은 날: ' + good + '일\n😔 안 좋은 날: ' + bad + '일\n\n최근 기록:\n' + recent };
  }

  // --- 주간 목표 ---
  if (/목표\s*(설정|등록|추가|만들)[:\s]*(.+)/i.test(input)) {
    const goalMatch = input.match(/목표\s*(?:설정|등록|추가|만들)[:\s]*(.+)/i);
    if (goalMatch) {
      const goal = goalMatch[1].trim();
      const mGoals = JSON.parse(localStorage.getItem('aiGoals') || '[]');
      mGoals.push({ text: goal, created: today, done: false });
      localStorage.setItem('aiGoals', JSON.stringify(mGoals));
      return { reply: '🎯 목표 등록 완료!\n"' + goal + '"\n\n달성하면 "목표 완료"라고 알려주세요!', suggests: ['목표 확인', '할 일 확인'] };
    }
  }
  if (/목표\s*(설정|등록|세우)/.test(t) && !input.match(/목표\s*(?:설정|등록)[:\s]*.{2,}/i)) {
    return { reply: '어떤 목표를 세우시겠어요?\n예: "목표 설정 이번 주 보고서 5개 작성"', suggests: [] };
  }
  if (/목표\s*(확인|보여|목록|현황)/.test(t)) {
    const mGoals = JSON.parse(localStorage.getItem('aiGoals') || '[]');
    const active = mGoals.filter(g => !g.done);
    const done = mGoals.filter(g => g.done);
    if (mGoals.length === 0) return { reply: '등록된 목표가 없어요. "목표 설정 OOO"으로 추가해보세요!', suggests: ['목표 설정'] };
    let reply = '🎯 나의 목표:\n\n';
    if (active.length > 0) reply += '진행 중:\n' + active.map((g, i) => '⬜ ' + (i+1) + '. ' + g.text).join('\n');
    if (done.length > 0) reply += '\n\n완료:\n' + done.slice(-3).map(g => '✅ ' + g.text).join('\n');
    return { reply, suggests: active.length > 0 ? ['1번 목표 완료', '목표 추가'] : ['목표 설정'] };
  }
  const goalDoneMatch = t.match(/(\d)번?\s*목표\s*완료/);
  if (goalDoneMatch) {
    const mGoals = JSON.parse(localStorage.getItem('aiGoals') || '[]');
    const active = mGoals.filter(g => !g.done);
    const idx = parseInt(goalDoneMatch[1]) - 1;
    if (active[idx]) {
      active[idx].done = true;
      active[idx].doneDate = today;
      localStorage.setItem('aiGoals', JSON.stringify(mGoals));
      return { reply: '🎉 목표 달성! "' + active[idx].text + '"\n\n축하해요! 정말 대단하세요! 👏✨', suggests: ['목표 확인', '오늘 브리핑'] };
    }
    return { reply: '해당 번호의 목표를 찾을 수 없어요.', suggests: ['목표 확인'] };
  }
  if (/목표\s*(완료|달성)/.test(t) && !goalDoneMatch) {
    return _aiProcessChat('목표 확인');
  }

  // --- 집중/휴식 자연어: "집중이 안 돼", "쉬고 싶어" ---
  if (/집중이?\s*안|손에\s*안\s*잡|머리가?\s*안\s*돌아|일이?\s*안\s*돼|능률이?\s*안/.test(t)) {
    const tips = [
      '💡 자리에서 일어나 2분간 스트레칭해보세요!',
      '💡 찬물로 세수하면 머리가 맑아져요!',
      '💡 할 일을 아주 작은 단위로 쪼개보세요!',
      '💡 5분만 하겠다는 마음으로 시작해보세요!',
    ];
    return { reply: _say('집중이 어려우시군요 😥\n\n' + tips[Math.floor(Math.random() * tips.length)] + '\n\n포모도로 타이머로 25분만 집중해볼까요?', '집중 안 되지? 😥\n\n' + tips[Math.floor(Math.random() * tips.length)] + '\n\n25분만 집중해볼래?'), suggests: ['집중 모드', '쉬고 싶어', '팁 더 줘'] };
  }
  if (/쉬고\s*싶|잠깐\s*쉴|좀\s*쉬|휴식|쉬어야|쉬자/.test(t)) {
    return { reply: _say('잠깐 쉬어가세요! 😌\n\n🧘 추천 휴식법:\n• 5분 눈 감고 심호흡\n• 가볍게 스트레칭\n• 따뜻한 차 한 잔\n• 창밖 풍경 바라보기\n\n쉬고 나면 더 잘될 거예요!', '쉬자 쉬자~ 😌\n\n눈 감고 심호흡하거나 스트레칭 추천!\n쉬고 나면 더 잘 될 거야~'), suggests: ['5분 타이머', '집중 모드', '농담 해줘'] };
  }
  if (/^5분\s*타이머/.test(t)) {
    setTimeout(() => {
      if (document.getElementById('aiChatOverlay').style.display === 'flex') {
        _aiChatAddBot('⏰ 5분 휴식 끝! 다시 힘내볼까요? 💪');
        _aiChatShowSuggest(['집중 모드', '오늘 일정']);
      } else {
        _showSecretaryAlert('break', '⏰ 휴식 종료', '5분 휴식이 끝났어요! 다시 시작해볼까요?', '확인');
      }
    }, 5 * 60000);
    return { reply: _say('⏰ 5분 휴식 타이머 시작! 편하게 쉬세요 😌', '5분 쉬어~ 타이머 켰어! 😌'), suggests: [] };
  }

  // --- 집중 모드 (포모도로) ---
  if (/집중\s*모드|포모도로|타이머|집중\s*시작/.test(t)) {
    return { reply: '🍅 집중 모드를 시작할게요!\n25분 집중 → 5분 휴식\n\n아래에 타이머가 시작됩니다.', suggests: ['25분', '15분', '50분'] };
  }
  if (/^(\d+)분$/.test(t) && _aiChatHistory.some(h => h.text && h.text.includes('집중 모드'))) {
    const mins = parseInt(t);
    const endTime = new Date(Date.now() + mins * 60000);
    const endStr = String(endTime.getHours()).padStart(2,'0') + ':' + String(endTime.getMinutes()).padStart(2,'0');
    setTimeout(() => {
      if (document.getElementById('aiChatOverlay').style.display === 'flex') {
        _aiChatAddBot('⏰ ' + mins + '분 집중 시간 종료! 잘하셨어요! 👏\n잠깐 스트레칭하고 물 한 잔 드세요 💧');
        _aiChatShowSuggest(['한번 더', '오늘 브리핑']);
      } else {
        _showSecretaryAlert('focus', '🍅 집중 완료', mins + '분 집중 시간이 끝났어요!\n잘하셨어요! 잠깐 쉬어가세요.', '확인');
      }
    }, mins * 60000);
    _aiLearn('focus_' + Date.now(), mins + '분');
    return { reply: '🍅 ' + mins + '분 집중 타이머 시작!\n종료 시각: ' + endStr + '\n\n집중하는 동안 채팅을 닫아도 알림이 올 거예요.\n화이팅! 🔥', suggests: ['오늘 일정'] };
  }
  if (/^한번\s*더$/.test(t)) {
    return _aiProcessChat('집중 모드');
  }

  // --- 일일 마무리 리포트 ---
  if (/마무리|퇴근\s*요약|하루\s*정리|오늘\s*마무리|데일리\s*리포트/.test(t)) {
    try {
      const [rps, todos, evts, atd] = await Promise.all([
        api(`/api/reports?from=${today}&to=${today}`),
        api('/api/todos'),
        api('/api/calendar-events?date=' + today),
        api('/api/attendance/today')
      ]);
      const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
      const pend = (todos || []).filter(td => !td.completed);
      const completedToday = (todos || []).filter(td => td.completed);
      const mGoals = JSON.parse(localStorage.getItem('aiGoals') || '[]');
      const activeGoals = mGoals.filter(g => !g.done);

      let reply = '📋 오늘의 마무리 리포트\n━━━━━━━━━━━━━━\n\n';
      reply += '⏰ 근무: ' + (atd && atd.check_in ? (atd.check_in||'').substring(11,16) + ' 출근' : '미출근');
      if (atd && atd.check_out) reply += ' → ' + (atd.check_out||'').substring(11,16) + ' 퇴근';
      reply += '\n📝 업무일지: ' + myRps.length + '건 작성';
      reply += '\n📅 일정: ' + ((evts||[]).length) + '건 중 처리 완료';
      reply += '\n✅ 할 일: ' + completedToday.length + '건 완료, ' + pend.length + '건 남음';
      if (activeGoals.length > 0) reply += '\n🎯 진행 중 목표: ' + activeGoals.length + '건';

      // 평가
      const score = myRps.length * 20 + completedToday.length * 10 + ((evts||[]).length > 0 ? 20 : 0) + (atd && atd.check_in ? 10 : 0);
      const grade = score >= 80 ? '🌟 최고의 하루!' : score >= 50 ? '👍 알찬 하루!' : score >= 30 ? '💪 수고하셨어요!' : '🌱 내일은 더 나아질 거예요!';
      reply += '\n\n' + grade + ' (활동 점수: ' + Math.min(score, 100) + '/100)';
      const endQuotes = [
        '\n\n🎬 "완생은 없어. 오늘도 한 수 잘 뒀어." — 미생',
        '\n\n🎬 "오늘 하루도 니가 이겼다." — 이태원 클라쓰',
        '\n\n🎬 "수고했어, 오늘도." — 응답하라 1988',
        '\n\n🎬 "쉬는 것도 실력이야. 푹 쉬어." — 슬기로운 의사생활',
      ];
      reply += endQuotes[Math.floor(Math.random() * endQuotes.length)];

      _aiLearn('dailyScore_' + today, Math.min(score, 100));
      return { reply, suggests: ['퇴근 처리', '이번 주 요약'] };
    } catch(_) { return { reply: '마무리 리포트를 만드는 중 오류가 생겼어요.' }; }
  }

  // --- 업무 패턴 분석 ---
  if (/패턴|분석|내\s*업무\s*분석|인사이트|통계/.test(t) && !/대화/.test(t)) {
    const facts = mem.facts || {};
    const topics = mem.topics || {};
    const scores = Object.entries(facts).filter(([k]) => k.startsWith('dailyScore_'));
    const moods = Object.entries(facts).filter(([k]) => k.startsWith('mood_'));
    const focuses = Object.entries(facts).filter(([k]) => k.startsWith('focus_'));

    let reply = '🧠 AI 비서의 업무 분석\n━━━━━━━━━━━━━━\n\n';

    // 대화 패턴
    reply += '💬 대화 습관:\n';
    reply += '• 총 대화 ' + (mem.chatCount || 0) + '회\n';
    const topTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (topTopics.length > 0) reply += '• 관심 주제: ' + topTopics.map(([k, v]) => k + '(' + v + ')').join(', ') + '\n';

    // 활동 점수
    if (scores.length > 0) {
      const avgScore = Math.round(scores.reduce((s, [, v]) => s + v, 0) / scores.length);
      reply += '\n📊 활동 점수:\n';
      reply += '• 평균 ' + avgScore + '/100 (' + scores.length + '일 기록)\n';
      const best = scores.sort((a, b) => b[1] - a[1])[0];
      reply += '• 최고 기록: ' + best[0].replace('dailyScore_', '') + ' (' + best[1] + '점)\n';
    }

    // 기분 패턴
    if (moods.length > 0) {
      const goodDays = moods.filter(([,v]) => v === 'good').length;
      reply += '\n😊 기분:\n• 좋은 날 ' + goodDays + '일 / 전체 ' + moods.length + '일 (' + Math.round(goodDays/moods.length*100) + '%)\n';
    }

    // 집중 기록
    if (focuses.length > 0) {
      reply += '\n🍅 집중:\n• ' + focuses.length + '회 집중 모드 사용\n';
    }

    // AI 팁
    reply += '\n💡 AI 팁: ';
    if ((mem.chatCount || 0) < 5) reply += '더 자주 대화하면 맞춤 분석이 정확해져요!';
    else if (topTopics[0] && topTopics[0][0] === '일정') reply += '일정 관리를 잘 하고 계세요! 목표도 설정해보시겠어요?';
    else if (topTopics[0] && topTopics[0][0] === '할일') reply += '할 일 관리의 달인! 집중 모드로 효율을 높여보세요.';
    else reply += '꾸준히 사용하면 점점 더 똑똑해질 거예요!';

    return { reply, suggests: ['기분 통계', '목표 확인', '집중 모드'] };
  }

  // --- AI 지능 레벨 / 학습 현황 ---
  if (/지능|레벨|IQ|아이큐|똑똑|학습\s*현황|성장|얼마나\s*알|뭘\s*알/.test(t)) {
    const iq = _aiCalcIQ();
    const lvl = _aiGetLevel();
    const topCmds = _aiGetTopCmds(5);
    const fb = mem.feedback || { positive: 0, negative: 0 };
    const daysUsed = (mem.daysUsed || []).length;
    let reply = '🧠 AI 비서 지능 현황\n━━━━━━━━━━━━━━\n\n';
    reply += lvl.emoji + ' Lv.' + lvl.lv + ' ' + lvl.title + '\n';
    reply += '📊 IQ: ' + iq + ' / 200\n';
    reply += '💬 총 대화: ' + (mem.chatCount || 0) + '회\n';
    reply += '📅 사용일수: ' + daysUsed + '일\n';
    reply += '📝 학습 데이터: ' + Object.keys(mem.facts || {}).length + '개\n';
    reply += '👍 만족 응답: ' + fb.positive + '회 / 👎 불만족: ' + fb.negative + '회\n';
    if (topCmds.length > 0) {
      reply += '\n🔥 자주 쓰는 명령:\n';
      reply += topCmds.map(([cmd, cnt], i) => (i+1) + '. ' + cmd + ' (' + cnt + '회)').join('\n');
    }
    const nextLv = lvl.lv < 5 ? [85, 100, 120, 150][lvl.lv - 1] : null;
    if (nextLv) reply += '\n\n🎯 다음 레벨(Lv.' + (lvl.lv+1) + ')까지 IQ ' + (nextLv - iq) + ' 남음!';
    else reply += '\n\n👑 최고 레벨 달성! 전설의 비서!';
    reply += '\n\n💡 더 많이 대화할수록 IQ가 올라가요!';
    return { reply, suggests: ['업무 분석', '기분 통계', '대화 통계'] };
  }

  // --- 말투 변경 ---
  if (/말투\s*(바꿔|변경|바꾸|다르게)|반말|존댓말|격식|친근/.test(t)) {
    const styles = { formal: '격식체 (존댓말)', casual: '친근체 (반말)', cute: '귀여운 말투' };
    const curStyle = mem.facts && mem.facts.chatStyle || 'formal';
    return { reply: '현재 말투: ' + (styles[curStyle] || '격식체') + '\n\n어떤 말투로 바꿀까요?', suggests: ['격식체', '친근체', '귀여운 말투'] };
  }
  if (/^격식체$/.test(t)) { return { reply: '네, 격식체로 말씀드릴게요. 무엇을 도와드릴까요?', learn: { chatStyle: 'formal' } }; }
  if (/^친근체$/.test(t)) { return { reply: '알겠어~ 편하게 말할게! 뭐 도와줄까? 😄', learn: { chatStyle: 'casual' } }; }
  if (/^귀여운\s*말투$/.test(t)) { return { reply: '네넹! 귀엽게 말해볼게용~ 뭐 도와드릴까용? 🐱', learn: { chatStyle: 'cute' } }; }

  // --- TMI 설정 ---
  if (/tmi\s*(설정|조절|빈도|레벨|끄|켜|높|낮)|잡지식\s*(설정|끄|켜)/.test(t)) {
    const curTmi = prof.tmiLevel || 'normal';
    const labels = { off: '🔇 끄기', normal: '📎 보통 (업무시간 낮게)', high: '💡 많이' };
    return { reply: '💡 TMI/잡지식 빈도 설정\n\n현재: ' + (labels[curTmi] || '보통') + '\n\n어떻게 바꿀까요?', suggests: ['TMI 끄기', 'TMI 보통', 'TMI 많이'] };
  }
  if (/^tmi\s*끄기$|^잡지식\s*끄기$/i.test(t)) { _aiProfileSet('tmiLevel', 'off'); return { reply: '🔇 TMI를 꺼뒀어요. 잡지식 없이 깔끔하게 갈게요!', suggests: ['TMI 보통', 'TMI 많이'] }; }
  if (/^tmi\s*보통$|^잡지식\s*보통$/i.test(t)) { _aiProfileSet('tmiLevel', 'normal'); return { reply: '📎 TMI 보통으로 설정! 업무시간엔 적게, 쉬는 시간엔 적당히 넣을게요~', suggests: ['TMI 끄기', 'TMI 많이'] }; }
  if (/^tmi\s*많이$|^잡지식\s*많이$/i.test(t)) { _aiProfileSet('tmiLevel', 'high'); return { reply: '💡 TMI 많이 모드! 잡지식 폭격 가즈아~ 🚀', suggests: ['TMI 끄기', 'TMI 보통'] }; }

  // --- AI 적극도 설정 (D-5) ---
  if (/적극도\s*(설정|조절|레벨|변경)?|자발적\s*제안|제안\s*레벨|AI\s*레벨/.test(t)) {
    const lvMatch = t.match(/(1|2|3|4|소극|보통|적극|긴급)/);
    if (lvMatch) {
      const lvMap = { '1': 1, '소극': 1, '2': 2, '보통': 2, '3': 3, '적극': 3, '4': 4, '긴급': 4 };
      const lv = lvMap[lvMatch[1]] || 3;
      _aiProfileSet('proactiveLevel', lv);
      const lvNames = { 1: '소극적 (Lv.1)', 2: '보통 (Lv.2)', 3: '적극적 (Lv.3)', 4: '긴급 (Lv.4)' };
      return { reply: '🎚️ AI 적극도를 ' + lvNames[lv] + '으로 설정했어요!\n\n' +
        (lv === 1 ? '조용히 필요할 때만 알려드릴게요.' : lv === 2 ? '막연한 입력 시 도움을 제안해드릴게요.' : lv === 3 ? '적극적으로 상황 분석하고 브리핑할게요!' : '최대한 빨리 도와드릴게요!'),
        suggests: ['오늘 브리핑', '도움말'] };
    }
    const curLv = prof.proactiveLevel || 3;
    const lvLabels = { 1: '🔇 소극적', 2: '📎 보통', 3: '🔥 적극적', 4: '🚨 긴급' };
    return { reply: '🎚️ AI 적극도 설정\n\n현재: ' + (lvLabels[curLv] || '적극적') + '\n\n• Lv.1 소극적: 조용히 알림\n• Lv.2 보통: 막연할 때 제안\n• Lv.3 적극적: 위임 시 즉시 브리핑\n• Lv.4 긴급: 반복 미인식 시 자동 전환\n\n"적극도 1~4" 로 설정하세요!',
      suggests: ['적극도 1', '적극도 2', '적극도 3', '적극도 4'] };
  }

  // --- 오늘의 명언 ---
  if (/명언|격언|동기부여|좋은\s*말/.test(t)) {
    const quotes = [
      ['성공은 매일 반복하는 작은 노력의 합이다.', '로버트 콜리어'],
      ['시작이 반이다.', '아리스토텔레스'],
      ['오늘 할 수 있는 일을 내일로 미루지 마라.', '벤자민 프랭클린'],
      ['실패는 성공의 어머니이다.', '토마스 에디슨'],
      ['꿈을 크게 가져라. 작은 꿈에는 사람의 마음을 움직이는 힘이 없다.', '괴테'],
      ['매일 조금씩 나아지면 큰 변화가 된다.', '존 우든'],
      ['노력 없이 얻는 것은 없다.', '라틴 속담'],
      ['최선을 다하면 후회는 없다.', '격언'],
      ['완생이 없으니까 미생인 거야. 끝까지 가봐야 아는 거지.', '미생 · 오상식 과장'],
      ['자리가 사람을 만들기도 하지만, 사람이 자리를 만들기도 해.', '미생 · 오상식 과장'],
      ['프로는 결과로 말하는 거야.', '미생 · 오상식 과장'],
      ['사회생활은 바둑이야. 한 수 한 수가 중요해.', '미생 · 장그래'],
      ['근거 없는 자신감보다 근거 있는 노력이 낫다.', '미생 · 장백기'],
      ['밤이 길수록 낮이 빛나는 법이야.', '이태원 클라쓰 · 박새로이'],
      ['나는 내가 무서워. 참을 만큼 참았거든.', '남산의 부장들 · 김규평'],
      ['증거는 거짓말을 안 해. 사람이 거짓말을 하지.', '살인의 추억 · 서태윤'],
      ['서류(데이터)가 말을 해. 귀 기울여.', '살인의 추억 응용'],
      ['포기하면 편해. 근데 편한 게 행복은 아니야.', '슬기로운 의사생활 · 이익준'],
      ['미안하다고 하면 다 해결될 줄 알아? 그래, 해결돼. 일단 미안하다고 해.', '응답하라 1988 · 성동일'],
      ['니가 먼저 니 편이 돼라. 세상에서 제일 중요한 건 나야.', '나의 아저씨 · 이지안'],
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    return { reply: '📜 오늘의 명언\n\n"' + q[0] + '"\n\n— ' + q[1], suggests: ['하나 더 보기', '드라마 명대사'] };
  }
  if (/하나\s*더\s*보기/.test(t)) { return _aiProcessChat('명언'); }

  // --- 드라마/영화/웹툰 명대사 전용 ---
  if (/드라마\s*명대사|명대사\s*들려|명대사\s*줘|명대사/.test(t)) {
    const dramaQuotes = [
      { q: '완생이 없으니까 미생인 거야.\n끝까지 가봐야 아는 거지.', src: '미생', chr: '오상식 과장', tag: '끈기' },
      { q: '사회생활은 바둑과 같다.\n한 수를 두더라도 몇 수 앞을 내다봐야 해.', src: '미생', chr: '오상식 과장', tag: '전략' },
      { q: '자기가 하고 싶은 일을 하는 사람은 프로가 아니야.\n자기가 해야 할 일을 하는 사람이 프로야.', src: '미생', chr: '오상식 과장', tag: '프로의식' },
      { q: '나는 언제나 운이 나빴어.\n그래서 항상 최선을 다했지.', src: '미생', chr: '장그래', tag: '노력' },
      { q: '밤이 길수록 낮이 빛나는 법이지.', src: '이태원 클라쓰', chr: '박새로이', tag: '인내' },
      { q: '나한테는 계획이 있어.\n일단 버텨. 끝까지.', src: '이태원 클라쓰', chr: '박새로이', tag: '결단' },
      { q: '증거는 거짓말을 안 해.\n사람이 거짓말을 하지.', src: '살인의 추억', chr: '서태윤', tag: '진실' },
      { q: '니가 먼저 니 편이 돼라.\n세상에서 제일 중요한 건 나야.', src: '나의 아저씨', chr: '이지안', tag: '자존감' },
      { q: '어른이 된다는 건, 참는 게 아니라\n참아야 할 것과 참지 말아야 할 것을 구분하는 거야.', src: '나의 아저씨', chr: '박동훈', tag: '성숙' },
      { q: '나는 내가 무서워.\n참을 만큼 참았거든.', src: '남산의 부장들', chr: '김규평', tag: '결단' },
      { q: '각하, 혁명은 지금입니다.', src: '남산의 부장들', chr: '김규평', tag: '결단' },
      { q: '포기하면 편해.\n근데 편한 게 행복은 아니야.', src: '슬기로운 의사생활', chr: '이익준', tag: '끈기' },
      { q: '사람은 자기가 맞다고 생각하면\n남의 말이 안 들려.\n그래서 한 발 물러서서 봐야 해.', src: '슬기로운 의사생활', chr: '안정원', tag: '겸손' },
      { q: '미안하다고 하면 다 해결될 줄 알아?\n그래, 해결돼. 일단 미안하다고 해.', src: '응답하라 1988', chr: '성동일', tag: '관계' },
      { q: '사람이 진심을 보이면\n상대도 진심이 오게 돼 있어.', src: '응답하라 1988', chr: '성덕선', tag: '진심' },
      { q: '세상에 쉬운 일은 없다.\n그러나 하다 보면 되는 일은 있다.', src: '미세스 탈', chr: '나리', tag: '실행' },
    ];
    const dq = dramaQuotes[Math.floor(Math.random() * dramaQuotes.length)];
    return { reply: '🎬 드라마 명대사 #' + dq.tag + '\n━━━━━━━━━━━━━━\n\n"' + dq.q + '"\n\n— ' + dq.src + ' · ' + dq.chr, suggests: ['하나 더 보기', '명언', '오늘 일정'] };
  }

  // --- D-day 계산 ---
  const ddayMatch = input.match(/(?:디데이|d-?day|남은\s*날)\s*(\d{1,2})월\s*(\d{1,2})일/i);
  if (ddayMatch) {
    const targetMonth = parseInt(ddayMatch[1]) - 1;
    const targetDay = parseInt(ddayMatch[2]);
    const target = new Date(new Date().getFullYear(), targetMonth, targetDay);
    if (target < new Date()) target.setFullYear(target.getFullYear() + 1);
    const diff = Math.ceil((target - new Date()) / 86400000);
    return { reply: '📅 D-' + diff + '\n' + (targetMonth+1) + '월 ' + targetDay + '일까지 ' + diff + '일 남았어요!', suggests: ['오늘 일정'] };
  }

  // --- 계산기 ---
  const calcMatch = input.match(/(\d+)\s*([+\-×÷*\/x])\s*(\d+)/);
  if (calcMatch) {
    const a = parseFloat(calcMatch[1]);
    const op = calcMatch[2];
    const b = parseFloat(calcMatch[3]);
    let result;
    if (op === '+') result = a + b;
    else if (op === '-' || op === '−') result = a - b;
    else if (op === '×' || op === '*' || op === 'x') result = a * b;
    else if (op === '÷' || op === '/') result = b !== 0 ? a / b : '오류(0으로 나눌 수 없음)';
    return { reply: '🔢 ' + a + ' ' + op + ' ' + b + ' = ' + result };
  }

  // --- 학습 초기화 ---
  if (/기억\s*지워|학습\s*초기화|리셋|초기화/.test(t)) {
    return { reply: '정말 모든 기억을 지울까요? 되돌릴 수 없어요.', suggests: ['네 지워줘', '아니 취소'] };
  }
  if (/^네\s*지워/.test(t)) {
    localStorage.removeItem('aiMemory');
    localStorage.removeItem('aiGoals');
    return { reply: '모든 기억과 목표를 초기화했어요. 새로 시작합니다! 🔄', suggests: ['도움말', '오늘 일정'] };
  }

  // ═══════════════════════════════════════════
  // 말이 곧 법이다! 유니버설 명령 실행 엔진
  // "열려라 참깨!" → 문이 열린다
  // ═══════════════════════════════════════════

  // --- 페이지 이동: "열어", "보여줘", "가자", "켜" ---
  if (/(열어|열기|보여줘|이동|가자|가줘|페이지|화면|켜줘?|실행|이동해|가볼까|들어가)/.test(t)) {
    const navMap = [
      { pat: /보고서|일지|리포트/, pg: 'reports', nm: '업무일지' },
      { pat: /캘린더|달력/, pg: 'calendar', nm: '캘린더' },
      { pat: /할\s*일|투두|todo/i, pg: 'todos', nm: '할 일 관리' },
      { pat: /홈|메인|처음|시작/, pg: 'home', nm: '홈' },
      { pat: /설정|세팅|환경/, pg: 'settings', nm: '설정' },
      { pat: /게시판|커뮤니티|글/, fn: () => showBoard(), nm: '게시판' },
      { pat: /공지|알림판/, fn: () => showNoticesList(), nm: '공지사항' },
      { pat: /검색|찾기/, fn: () => showGlobalSearch(), nm: '통합 검색' },
      { pat: /출퇴근|근태/, fn: () => showAttendancePage(), nm: '출퇴근 기록' },
      { pat: /음성\s*가이드|음성\s*비서/, fn: () => startVoiceGuide(), nm: '음성 가이드' },
    ];
    for (const n of navMap) {
      if (n.pat.test(t)) {
        return { reply: _say('📱 ' + n.nm + ' 열게요!', '📱 ' + n.nm + ' 열게~!'), action: () => { closeAiChat(); n.fn ? n.fn() : navigate(n.pg); } };
      }
    }
  }

  // --- 즉시 실행 명령: "출근해", "퇴근해", "기록해", "작성해" ---
  if (/^(출근해|출근\s*찍어|출근\s*해줘|출근\s*시작)$/.test(t)) {
    return { reply: _say('출근 체크할게요! 근무 유형을 선택해주세요.', '출근! 뭘로 할래?'), suggests: ['내근', '외근', '출장'] };
  }
  if (/^(퇴근해|퇴근\s*찍어|퇴근\s*해줘|나갈게|간다|집에\s*간다)$/.test(t)) {
    return { reply: _say('퇴근 처리할게요! 오늘도 수고하셨어요! 🌙', '퇴근! 수고했어! 🌙'), action: () => { closeAiChat(); doCheckOut(); } };
  }
  if (/^(기록해|작성해|일지\s*써|보고서\s*써|일지\s*작성|보고서\s*작성|쓸래|쓸거야|작성할래)$/.test(t)) {
    return { reply: '어떤 방식으로 작성할까요?', suggests: ['음성으로 기록', '직접 작성'] };
  }
  if (/^(음성\s*기록|음성으로|말로\s*기록|말로\s*써|음성\s*시작)$/.test(t)) {
    return { reply: _say('음성 기록을 시작할게요! 🎤', '음성 기록 시작! 🎤'), action: () => { closeAiChat(); startVoiceReport(); } };
  }
  if (/^(직접\s*쓸래|직접\s*작성|타이핑|키보드로)$/.test(t)) {
    return { reply: _say('작성 화면을 열게요! ✏️', '작성 화면 열게! ✏️'), action: () => { closeAiChat(); openNewReport(); } };
  }

  // --- 즉시 추가 명령: "~추가해", "~등록해", "~만들어" (내용 직접) ---
  const directAdd = input.match(/^["""]?(.{2,30}?)["""]?\s*(?:추가해|등록해|만들어|넣어|추가해줘|등록해줘|만들어줘|넣어줘)$/);
  if (directAdd) {
    const item = directAdd[1].replace(/를|을|좀|이거|저거/g, '').trim();
    if (item.length >= 2) {
      try {
        await api('/api/todos', { method: 'POST', body: { title: item } });
        return { reply: _say('✅ "' + item + '" 할 일에 추가 완료! 말 한마디로 끝! ⚡', '✅ "' + item + '" 추가! 말이 곧 법! ⚡'), suggests: ['할 일 확인', '하나 더 추가'] };
      } catch(_) { return { reply: '추가 중 오류가 생겼어요.' }; }
    }
  }

  // --- 즉시 완료: "1번 해", "첫번째 끝" ---
  const quickDone = t.match(/^(\d)번?\s*(해|끝|했어|완료|처리|체크)/);
  if (quickDone) {
    try {
      const todos = await api('/api/todos');
      const pend = (todos || []).filter(td => !td.completed);
      const idx = parseInt(quickDone[1]) - 1;
      if (pend[idx]) {
        await api('/api/todos/' + pend[idx].id, { method: 'PUT', body: { completed: true } });
        return { reply: _say('✅ "' + pend[idx].title + '" 완료! ⚡', '✅ "' + pend[idx].title + '" 끝! ⚡'), suggests: ['할 일 확인'] };
      }
    } catch(_) {}
  }

  // --- 마법 주문: 이스터에그 ---
  if (/열려라\s*참깨/.test(t)) {
    return { reply: '✨ 열려라 참깨! ✨\n\n문이 열렸습니다! 모든 기능이 당신의 말 한마디에 움직입니다.\n\n' + _say(name + '님, 무엇이든 말씀하세요. 말이 곧 법입니다! 👑', name + ', 뭐든 말해! 말이 곧 법이야! 👑'), suggests: ['오늘 브리핑', '할 일 확인', '드라마 명대사', '도움말'], action: () => { document.body.style.transition = 'filter 0.5s'; document.body.style.filter = 'brightness(1.3)'; setTimeout(() => { document.body.style.filter = ''; }, 1500); } };
  }
  if (/수리수리\s*마수리/.test(t)) {
    return _aiProcessChat('오늘 브리핑');
  }
  if (/아브라\s*카다브라/.test(t)) {
    return _aiProcessChat('우선순위 보기');
  }
  if (/제발|살려줘|도와줘|SOS/i.test(t)) {
    return { reply: _say('🆘 긴급 지원 모드!\n\n지금 바로 도와드릴게요. 뭐가 급한가요?', '🆘 긴급! 뭐가 급해? 바로 도와줄게!'), suggests: ['우선순위 보기', '급한 거 확인', '오늘 브리핑', '도움말'] };
  }

  // ─── 한자어/사자성어 뜻풀이 요청 ───
  const _hanjaMeaningMatch = t.match(/(.{2,6})\s*(?:이?게?\s*(?:뭐|무슨)\s*(?:뜻|의미)|(?:뜻|의미)\s*(?:이?[가는]|알려|설명|풀이)|(?:뜻|의미)\s*(?:뭐|뭔))/);
  if (_hanjaMeaningMatch) {
    const term = _hanjaMeaningMatch[1].replace(/[은는이가을를의]/g,'').trim();
    if (term.length >= 2 && window._SAJASEONGEO) {
      const found = _aiFindIdiom(term);
      if (found) {
        return { reply: _say('📖 **' + found.entry[0] + '(' + found.entry[1] + ')**\n\n뜻: ' + found.entry[2] + '\n\n업무에 적용하면, ' + _aiWorkPivot(), '📖 **' + found.entry[0] + '(' + found.entry[1] + ')**\n\n' + found.entry[2] + '\n\n' + _aiWorkPivot()), suggests: ['사자성어 더', '오늘 브리핑'] };
      }
    }
  }
  if (/(.{2,6})\s*(?:뜻|의미|해석)\s*(?:좀|을|를)?\s*(?:알려|설명|풀이|해줘|해주|뭐야|뭐)/.test(t)) {
    const termMatch = t.match(/(.{2,6})\s*(?:뜻|의미|해석)/);
    if (termMatch && window._SAJASEONGEO) {
      const term2 = termMatch[1].replace(/[은는이가을를의]/g,'').trim();
      const found2 = _aiFindIdiom(term2);
      if (found2) {
        return { reply: _say('📖 **' + found2.entry[0] + '(' + found2.entry[1] + ')**\n\n뜻: ' + found2.entry[2] + '\n\n업무에 비유하면, 우리도 이 정신으로! ' + _aiWorkPivot(), '📖 **' + found2.entry[0] + '(' + found2.entry[1] + ')**\n\n' + found2.entry[2] + '\n\n' + _aiWorkPivot()), suggests: ['사자성어 더', '오늘 브리핑'] };
      }
    }
  }

  // ─── 사자성어 명령어 ───
  if (/사자성어|고사성어|한자\s*성어|성어\s*알려|성어\s*해줘|사자성어\s*더/.test(t)) {
    const cats = Object.keys(window._SAJASEONGEO || {});
    if (cats.length === 0) return { reply: _say('사자성어 데이터를 불러오는 중이에요...', '잠깐만~'), suggests: [] };
    const i1 = _aiPickIdiom(cats[Math.floor(Math.random() * cats.length)]);
    const i2 = _aiPickIdiom(cats[Math.floor(Math.random() * cats.length)]);
    const i3 = _aiPickIdiom(cats[Math.floor(Math.random() * cats.length)]);
    let r = '📚 사자성어 타임!\n\n';
    if (i1) r += '🎓 **' + i1[0] + '(' + i1[1] + ')** — ' + i1[2] + '\n';
    if (i2) r += '🎓 **' + i2[0] + '(' + i2[1] + ')** — ' + i2[2] + '\n';
    if (i3) r += '🎓 **' + i3[0] + '(' + i3[1] + ')** — ' + i3[2] + '\n';
    r += '\n하나 더 들을래요, 아니면 업무 볼까요? 😄';
    return { reply: _say(r, r), suggests: ['사자성어 더', '오늘 브리핑', '알아서해줘'] };
  }

  // ─── 사자성어 인식 (유저가 4글자 성어 입력 시 맞받아치기) ───
  if (t.length >= 4 && t.length <= 5 && /^[가-힣]{4,5}$/.test(t) && window._SAJASEONGEO) {
    const found = _aiFindIdiom(t);
    if (found) {
      const counter = _aiPickIdiom(found.cat);
      let r = '오! **' + found.entry[0] + '(' + found.entry[1] + ')** — ' + found.entry[2];
      if (counter && counter[0] !== found.entry[0]) {
        r += '\n\n받아라! 🎯 **' + counter[0] + '(' + counter[1] + ')** — ' + counter[2];
      }
      r += '\n\n' + _aiWorkPivot();
      return { reply: _say(r, r), suggests: ['사자성어 더', '오늘 브리핑', '할 일 확인'] };
    }
  }

  // ─── Gemini AI 호출 (진짜 AI 대화) ───
  const _geminiReply2 = await _aiCallGemini(input);
  if (_geminiReply2) {
    _aiUnmatchedCount = 0;
    _aiLastWasFallback = false;
    const h2 = new Date().getHours();
    const _gSugg = h2 < 10 ? ['출근 체크', '오늘 브리핑'] : h2 < 14 ? ['오늘 일정', '할 일 확인'] : h2 < 18 ? ['보고서 쓸래', '오늘 브리핑'] : ['오늘 마무리', '이번 주 요약'];
    _gSugg.push('사자성어 더');
    return { reply: _geminiReply2, suggests: _gSugg };
  }

  // ─── (Gemini 실패 시) 비업무 대화 감지 + 말돌리기 ───
  const _offTopicMap = [
    { pat: /영화|드라마|넷플|유튜브|예능|시리즈|방송|OTT/, resp: ['영화/드라마 얘기시네요! 저도 명대사는 좀 알아요 ㅎㅎ', '오~ 영상 콘텐츠! 저는 업무 드라마 전문이에요 ㅋ'] },
    { pat: /게임|롤|배그|로아|오버워치|발로란트|스팀|닌텐도|플스|스위치|겜/, resp: ['게임 얘기시군요! 저의 게임은 "업무 클리어"예요 ㅋ', '게임! 저도 할 줄 알면 좋겠어요~'] },
    { pat: /연예인|아이돌|배우|가수|셀럽|팬|콘서트|컴백|앨범/, resp: ['연예인 얘기네요! 저는 유명인 정보는 좀 약해요 😅', '오~ 팬이시군요! 열정적!'] },
    { pat: /축구|야구|농구|스포츠|올림픽|경기|선수|리그|월드컵/, resp: ['스포츠 얘기시네요! 저는 업무 스코어만 관리해요 ㅋ', '스포츠! 저의 응원은 항상 ' + (currentUser ? currentUser.name : '사용자') + '님한테!'] },
    { pat: /여행|관광|해외|비행기|호텔|숙소|휴가|바다|리조트/, resp: ['여행 얘기 들으니 부럽네요~!', '여행! 저도 데이터 여행은 매일 하고 있어요 ㅋ'] },
    { pat: /강아지|고양이|반려|펫|댕댕|냥이|멍멍|야옹|강쥐/, resp: ['반려동물 얘기시네요! 귀엽겠다~', '펫 얘기는 항상 힐링이에요~'] },
    { pat: /날씨|비\s*오|눈\s*오|더워|추워|습해|건조|미세먼지|황사/, resp: ['날씨 얘기시군요! 요즘 날씨가 좀 그렇죠~', '날씨! 업무 컨디션에도 영향 주죠~'] },
    { pat: /주식|코인|비트|부동산|투자|재테크|적금|펀드|환율/, resp: ['재테크 관심 있으시군요! 저는 시간 투자만 해요 ㅋ', '투자 얘기시네요! 저는 업무 투자(시간) 전문이에요 ㅋ'] },
    { pat: /연애|사랑|썸|데이트|소개팅|결혼|이별|커플/, resp: ['연애 얘기시네요~ 💕 저는 그쪽은 잘 몰라요 ㅎㅎ', '로맨스! 아 저는 업무 러브만... ㅋ'] },
    { pat: /음악|노래|멜론|스포티|플리|앨범|밴드|기타|피아노/, resp: ['음악 좋아하시는군요! 🎵', '음악! 업무 BGM 추천이면 해드릴 수 있는데... 아, 그건 안 되죠 ㅋ'] },
    { pat: /취미|그림|사진|등산|낚시|캠핑|요리|베이킹|뜨개|독서|만화|웹툰/, resp: ['멋진 취미시네요! 저의 취미는 업무 도와주기예요 ㅎㅎ', '취미 얘기 좋아요~ 건강한 취미시네요!'] },
  ];
  if (!_aiIsWorkRelated(t) && t.length >= 3) {
    for (const topic of _offTopicMap) {
      if (topic.pat.test(t)) {
        const resp = topic.resp[Math.floor(Math.random() * topic.resp.length)];
        const idiom = _aiPickIdiom(_aiDetectIdiomCat(t));
        const idiomStr = idiom ? '\n\n🎓 ' + idiom[0] + '(' + idiom[1] + ') — ' + idiom[2] : '';
        return { reply: _say(resp + idiomStr + '\n\n' + _aiWorkPivot(), resp + idiomStr + '\n\n' + _aiWorkPivot()), suggests: ['사자성어 더', '오늘 브리핑'] };
      }
    }
  }

  // --- 직접 작성 의도 감지 (쓰자/작성하자 루프 방지) ---
  if (/(?:일지|보고서|기록|작성)\s*(?:쓰자|쓸래|쓰고|쓸까|쓰기|쓰자고|써보자|쓸|적자|적을래)|쓰자고|작성하자|작성할래/.test(t)) {
    return _aiProcessChat('보고서 쓸래');
  }

  // --- 만능 동사 처리: "~해줘" "~할래" "~하자" ---
  const verbCmd = input.match(/(.{2,15}?)\s*(?:해줘|해주|할래|하자|시작해|시작|실행|고|가자|보자|쓰자|쓸래|적자|하고\s*싶)$/);
  if (verbCmd) {
    const cmd = verbCmd[1].replace(/를|을|좀|이거|나|내/g, '').trim();
    const cmdMap = [
      { kw: /브리핑|요약|현황|상황/, fwd: '오늘 브리핑' },
      { kw: /일정|스케줄|캘린더/, fwd: '오늘 일정' },
      { kw: /할\s*일|투두|todo/i, fwd: '할 일 확인' },
      { kw: /보고서|일지|기록|작성/, fwd: '보고서 쓸래' },
      { kw: /출근/, fwd: '출근 체크' },
      { kw: /퇴근/, fwd: '퇴근 처리' },
      { kw: /집중|포모도로|타이머/, fwd: '집중 모드' },
      { kw: /검색|찾/, fwd: '도움말' },
      { kw: /목표/, fwd: '목표 확인' },
      { kw: /분석|패턴|통계/, fwd: '업무 분석' },
      { kw: /명언|명대사/, fwd: '드라마 명대사' },
      { kw: /농담|웃긴|재밌/, fwd: '농담 해줘' },
      { kw: /점심|밥|식사|먹/, fwd: '점심 추천' },
      { kw: /응원|격려|힘/, fwd: '응원해줘' },
      { kw: /마무리|정리/, fwd: '오늘 마무리' },
      { kw: /팀|팀원/, fwd: '팀원 현황' },
    ];
    for (const c of cmdMap) {
      if (c.kw.test(cmd)) return _aiProcessChat(c.fwd);
    }
  }

  // --- D-5 Lv.2: 막연한 입력 감지 ---
  const proactiveLv = prof.proactiveLevel || 3;
  if (proactiveLv >= 2 && /^(음+|흠+|뭐지|글쎄|어떡하지|모르겠|뭐냐|뭐야|뭘까|하아+|허+|에휴|아놔)\.{0,5}$/.test(t)) {
    if (proactiveLv >= 3) {
      const rec = await _aiNextAction();
      rec.reply = '🤔 뭘 할지 고민되시나 봐요! 현황을 정리해드릴게요.\n\n' + rec.reply;
      return rec;
    }
    return { reply: '🤔 뭘 할지 고민되시나 봐요?\n현재 상황을 정리해드릴까요?', suggests: ['응 정리해줘', '아니 괜찮아', '오늘 브리핑'] };
  }

  // --- D-3: "해줘" 단독 입력 맥락 추론 ---
  if (/^해\s*줘?$|^해$|^해주세요$|^해\s*주세요$/.test(t)) {
    const recentUser = _aiChatHistory.filter(h => h.who === 'user').slice(-3);
    const recentBot = _aiChatHistory.filter(h => h.who === 'bot').slice(-1)[0];
    const ctx = recentUser.map(h => h.text || '').join(' ') + ' ' + (recentBot ? recentBot.text || '' : '');
    const ctxMap = [
      { kw: /브리핑|요약|현황|상황/, fwd: '오늘 브리핑' },
      { kw: /일정|스케줄|캘린더/, fwd: '오늘 일정' },
      { kw: /할\s*일|투두|todo/i, fwd: '할 일 확인' },
      { kw: /보고서|일지|기록/, fwd: '보고서 쓸래' },
      { kw: /출근/, fwd: '출근 체크' },
      { kw: /퇴근/, fwd: '퇴근 처리' },
      { kw: /추천|뭐\s*할/, fwd: '추천해줘' },
      { kw: /분석|패턴|통계/, fwd: '업무 분석' },
    ];
    for (const c of ctxMap) {
      if (c.kw.test(ctx)) return _aiProcessChat(c.fwd);
    }
    const rec = await _aiNextAction();
    rec.reply = '💡 이전 대화에서 맥락을 찾아봤어요!\n\n' + rec.reply;
    return rec;
  }

  // --- 스마트 폴백: 키워드 기반 의도 추측 ---
  const h2 = new Date().getHours();
  let smartSuggests = ['도움말'];
  if (h2 < 10) smartSuggests.push('출근 체크', '오늘 브리핑');
  else if (h2 < 12) smartSuggests.push('오늘 일정', '할 일 확인');
  else if (h2 < 14) smartSuggests.push('점심 추천', '명언');
  else if (h2 < 18) smartSuggests.push('보고서 쓸래', '집중 모드');
  else smartSuggests.push('오늘 마무리', '이번 주 요약');

  // 의도 추측 시도 (이전 봇 메시지가 같은 힌트면 바로 포워딩)
  const guessMap = [
    { kw: /쓰|작성|적|기록|입력/, hint: '혹시 보고서나 일지를 쓰시려는 건가요?', sg: ['보고서 쓸래', '직접 작성'], fwd: '보고서 쓸래' },
    { kw: /추가|등록|넣|만들/, hint: '할 일이나 일정을 추가하시려는 건가요?', sg: ['할 일 추가', '일정 등록할래'] },
    { kw: /확인|보여|보기|열어|열기/, hint: '확인하고 싶으신 게 있으세요?', sg: ['오늘 일정', '할 일 확인', '보고서 확인'] },
    { kw: /삭제|지워|취소|제거/, hint: '삭제하고 싶은 게 있으시면 알려주세요!', sg: ['할 일 삭제', '캘린더 열기'] },
    { kw: /해봐|해볼/, hint: '무엇을 해볼까요? 구체적으로 말씀해주시면 바로 처리해드릴게요!', sg: ['오늘 브리핑', '할 일 확인', '도움말'] },
  ];
  for (const g of guessMap) {
    if (g.kw.test(t)) {
      if (g.fwd && _lastBotText && _lastBotText.includes(g.hint.substring(0, 10))) return _aiProcessChat(g.fwd);
      _aiLearn('unmatched_' + Date.now(), input);
      return { reply: _say('🤔 ' + g.hint, '🤔 ' + g.hint.replace('요?', '?').replace('세요!', '!')), suggests: g.sg };
    }
  }

  // [10] 심연의 눈: 의도 추론 시도
  const _inferResult = _aiInferIntent(input, _detections && _detections._emotion);
  if (_inferResult) {
    _aiLearn('inferred_' + Date.now(), input);
    return _inferResult;
  }

  _aiLearn('unmatched_' + Date.now(), input);

  // --- D-4: 반복 미인식 → 자동 브리핑 전환 ---
  _aiUnmatchedCount++;
  const _umSimilarity = _aiSimpleSimilarity(t, _aiLastUnmatched);
  _aiLastUnmatched = t;

  if (_aiUnmatchedCount >= 2 && (_umSimilarity > 0.3 || /짜증|답답|아씨|에잇|ㅡㅡ|미치|돌겠|왜\s*이래|아\s*몰라|몰라|안\s*돼|안\s*되|안되|왜\s*안/.test(t))) {
    _aiUnmatchedCount = 0;
    const rec = await _aiNextAction();
    rec.reply = '😥 죄송해요, 제가 잘 못 알아들었네요.\n바로 현황을 보여드릴게요!\n\n' + rec.reply;
    return rec;
  }

  // ─── 최종 fallback (Gemini 실패 시) ───
  _aiLastWasFallback = true;
  smartSuggests.push('사자성어 더');
  const _fbIdiom = _aiPickIdiom(_aiDetectIdiomCat(t));
  if (_fbIdiom) {
    const _fbPivots = [
      '흠, 잘 모르겠지만... 대신 사자성어 하나!\n\n🎓 **' + _fbIdiom[0] + '(' + _fbIdiom[1] + ')** — ' + _fbIdiom[2] + '\n\n' + _aiWorkPivot(),
      '🤔 그건 좀 어렵네요~\n\n🎓 오늘의 한마디: **' + _fbIdiom[0] + '(' + _fbIdiom[1] + ')** — ' + _fbIdiom[2] + '\n\n' + _aiWorkPivot(),
      '음... 대신 지혜 한 스푼! 🥄\n\n🎓 **' + _fbIdiom[0] + '(' + _fbIdiom[1] + ')** — ' + _fbIdiom[2] + '\n\n' + _aiWorkPivot(),
    ];
    return { reply: _say(_pick(_fbPivots), _pick(_fbPivots)), suggests: smartSuggests };
  }
  let fallbackReply;
  if (t.length <= 5) {
    fallbackReply = _say('네! 조금만 더 말씀해주시면 도와드릴 수 있어요! 😊', '응? 좀만 더 말해줘~ 도와줄게!');
  } else if (t.length <= 20) {
    fallbackReply = _say('음... "' + input.substring(0, 8) + '" 관련이시면 좀 더 자세히 알려주세요! 😊', '음~ 좀만 더 자세히 말해줘!');
  } else {
    fallbackReply = _say('핵심만 짧게 다시 말씀해주시면 더 잘 도와드릴 수 있어요! 😊', '짧게 다시 말해줘! 도와줄게 😅');
  }
  return { reply: fallbackReply, suggests: smartSuggests };
}

function _aiDetectTopic(t) {
  if (/일정|스케줄|캘린더|미팅|회의/.test(t)) return '일정';
  if (/할\s*일|투두|todo|해야/.test(t)) return '할일';
  if (/보고서|일지|작성|기록/.test(t)) return '보고서';
  if (/출근|퇴근|출퇴|도착|왔어|간다/.test(t)) return '출퇴근';
  if (/기억|학습|메모/.test(t)) return '기억';
  if (/도움|기능|사용/.test(t)) return '도움말';
  if (/목표|집중|포모도로|우선순위|급한/.test(t)) return '생산성';
  if (/기분|감정|컨디션|힘들|피곤|쉬고/.test(t)) return '감정';
  if (/구글|웹검색|인터넷/.test(t)) return '웹검색';
  if (/일지|뭐했|트렌드|생산성/.test(t)) return '일지';
  if (/예측|전망|마감|패턴|데드라인/.test(t)) return '예측';
  if (/추천|우선순위|뭐부터|뭐할까/.test(t)) return '추천';
  if (/번아웃|심층|분석해|나를|나에대해/.test(t)) return '심연';
  if (/검색|찾/.test(t)) return '검색';
  if (/프로필|취향|mbti|취미|좋아하|싫어하/.test(t)) return '개인정보';
  if (/먹었|먹은|추억|기념일/.test(t)) return '생활기록';
  if (/팀|팀원/.test(t)) return '팀';
  if (/야근|칼퇴|바빠|한가/.test(t)) return '업무상황';
  return '기타';
}

// ─── AI 비서 꼼꼼 체크 시스템 ───
let _alarmNotified = {};
let _aiReminders = [];

// ─── [1] 맥락 대화 강화 엔진 ───
function _aiGetContext(maxTurns) {
  const recent = _aiChatHistory.slice(-(maxTurns || 10));
  return recent.map(h => ({ role: h.who, text: (h.text || '').substring(0, 100) }));
}
function _aiResolveReference(input) {
  const t = input.toLowerCase().trim();
  const ctx = _aiGetContext(6);
  const lastBot = ctx.filter(c => c.role === 'bot').slice(-1)[0];
  const lastUser = ctx.filter(c => c.role === 'user').slice(-2, -1)[0];
  if (/^(그거|그것|아까\s*그거|방금\s*그거|아까\s*말한\s*거|위에\s*거)/.test(t)) {
    if (lastBot) {
      const quoted = lastBot.text.match(/"(.+?)"/);
      if (quoted) return { ref: quoted[1], type: 'quoted' };
      return { ref: lastBot.text.substring(0, 50), type: 'lastBot' };
    }
  }
  if (/^(다시|한번\s*더|다시\s*해|또|반복)/.test(t) && lastUser) {
    return { ref: lastUser.text, type: 'repeat', reprocess: true };
  }
  if (/아까\s*(.+?)\s*(?:뭐|어떻게|했|말한|얘기)/.test(t)) {
    const keyword = t.match(/아까\s*(.+?)\s*(?:뭐|어떻게|했|말한|얘기)/)[1];
    const found = ctx.find(c => c.text.toLowerCase().includes(keyword));
    if (found) return { ref: found.text, type: 'keyword', match: found };
  }
  return null;
}
function _aiGetConversationSummary() {
  const ctx = _aiGetContext(10);
  if (ctx.length === 0) return '';
  const topics = ctx.map(c => c.text.substring(0, 30)).join(' → ');
  return topics;
}

// ─── [2] 리마인더 엔진 ───
function _aiParseReminder(input) {
  let minutes = 0;
  let timeStr = '';
  let message = '';

  // "N분 후에 X하는데 M분 전에 알려줘" → (N-M)분 후 알림
  const advanceMatch = input.match(/(\d+)\s*(분|시간)\s*(?:뒤|후|있다가)(?:에)?\s*(.+?)\s*(\d+)\s*(분|시간)\s*(?:전|먼저)(?:에)?/);
  if (advanceMatch) {
    const eventMin = parseInt(advanceMatch[1]) * (advanceMatch[2] === '시간' ? 60 : 1);
    const beforeMin = parseInt(advanceMatch[4]) * (advanceMatch[5] === '시간' ? 60 : 1);
    minutes = Math.max(eventMin - beforeMin, 1);
    message = advanceMatch[3].replace(/알람줄수있어\??|줄수있어\??|알람|알려|해줘|좀/g, '').replace(/\s*한\s*$/, '').replace(/\s*\?\s*$/, '').trim();
    message = message.replace(/(?:올라가야|나가야|다녀와야|해야|가야)?(?:하는데|는데|인데)$/, '').trim() || '리마인더';
    return { minutes, message };
  }

  // "M분 전에 알려줘" (이전 대화에서 시간 정보 참조)
  const beforeOnly = input.match(/(\d+)\s*(분|시간)\s*전(?:에)?\s*(?:알려|알림|알람|해줘|해)/);
  if (beforeOnly && !input.match(/(\d+)\s*(분|시간)\s*(?:뒤|후)/)) {
    minutes = parseInt(beforeOnly[1]) * (beforeOnly[2] === '시간' ? 60 : 1);
    message = '리마인더';
    return { minutes, message };
  }

  // "N분 뒤에 X 알려줘"
  const relMatch = input.match(/(\d+)\s*(분|시간)\s*(?:뒤|후|있다가)(?:에)?\s*(.+?)(?:알려|리마인|해줘|알림|해|$)/);
  if (relMatch) {
    minutes = parseInt(relMatch[1]) * (relMatch[2] === '시간' ? 60 : 1);
    message = relMatch[4] ? relMatch[4].replace(/는데$|인데$|줘|좀|를|을|에|해$/g, '').trim() : '';
    if (!message) message = '리마인더';
    return { minutes, message };
  }

  // "X 알려줘 N분 뒤에" / "X N분 후에 알려줘"
  const relMatch2 = input.match(/(.+?)\s*(\d+)\s*(분|시간)\s*(?:뒤|후)(?:에)?\s*(?:알려|알림|해줘|해)/);
  if (relMatch2) {
    minutes = parseInt(relMatch2[2]) * (relMatch2[3] === '시간' ? 60 : 1);
    message = relMatch2[1].replace(/줘|좀|를|을|에|해$/g, '').trim() || '리마인더';
    return { minutes, message };
  }

  // 절대 시간: "오후 3시에 X 알려줘"
  const absMatch = input.match(/(?:오전|오후)?\s*(\d{1,2})시\s*(?:(\d{1,2})분)?\s*(?:에)?\s*(.+?)(?:알려|리마인|해줘|알림|해|$)/);
  if (absMatch) {
    let h = parseInt(absMatch[1]);
    const m = absMatch[2] ? parseInt(absMatch[2]) : 0;
    if (/오후/.test(input) && h < 12) h += 12;
    if (!/오전|오후/.test(input) && h <= 6) h += 12;
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    minutes = Math.round((target - now) / 60000);
    message = absMatch[3].replace(/는데$|인데$|줘|좀|를|을|에|해$/g, '').trim() || '리마인더';
    timeStr = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    return { minutes, message, timeStr };
  }
  return null;
}

function _aiSetReminder(minutes, message, timeStr) {
  const id = Date.now();
  const fireAt = Date.now() + minutes * 60000;
  const reminder = { id, message, fireAt, timeStr: timeStr || '', set: new Date().toISOString() };
  _aiReminders.push(reminder);
  try {
    const stored = JSON.parse(localStorage.getItem('aiReminders') || '[]');
    stored.push(reminder);
    localStorage.setItem('aiReminders', JSON.stringify(stored));
  } catch(_) {}
  setTimeout(() => _aiFireReminder(reminder), minutes * 60000);
  return reminder;
}

function _aiFireReminder(reminder) {
  _showSecretaryAlert('remind_' + reminder.id, '⏰ 리마인더', reminder.message + (reminder.timeStr ? '\n(' + reminder.timeStr + ')' : ''), '확인');
  if (document.getElementById('aiChatOverlay') && document.getElementById('aiChatOverlay').style.display === 'flex') {
    _aiChatAddBot('⏰ 리마인더! "' + reminder.message + '" 할 시간이에요!');
  }
  try {
    let stored = JSON.parse(localStorage.getItem('aiReminders') || '[]');
    stored = stored.filter(r => r.id !== reminder.id);
    localStorage.setItem('aiReminders', JSON.stringify(stored));
  } catch(_) {}
  _aiReminders = _aiReminders.filter(r => r.id !== reminder.id);
}

function _aiRestoreReminders() {
  try {
    const stored = JSON.parse(localStorage.getItem('aiReminders') || '[]');
    const now = Date.now();
    stored.forEach(r => {
      if (r.fireAt > now) {
        _aiReminders.push(r);
        setTimeout(() => _aiFireReminder(r), r.fireAt - now);
      }
    });
    localStorage.setItem('aiReminders', JSON.stringify(stored.filter(r => r.fireAt > now)));
  } catch(_) {}
}
_aiRestoreReminders();

// ─── [3] 주간 자동 리포트 엔진 ───
async function _aiWeeklyReport() {
  if (!currentUser || currentUser.isAdmin) return null;
  const today = new Date();
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];
  try {
    const [rps, todos, atds] = await Promise.all([
      api('/api/reports?from=' + weekAgo + '&to=' + todayStr),
      api('/api/todos'),
      api('/api/attendance/today')
    ]);
    const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
    const completed = (todos || []).filter(td => td.completed);
    const pending = (todos || []).filter(td => !td.completed);
    const cats = {};
    myRps.forEach(r => { const c = r.work_category || '기타'; cats[c] = (cats[c] || 0) + 1; });
    const catStr = Object.entries(cats).map(([k, v]) => k + ' ' + v + '건').join(', ');
    const mem = _aiMemory();
    const iq = _aiCalcIQ();
    const lvl = _aiGetLevel();
    let report = '📊 주간 AI 리포트\n━━━━━━━━━━━━━━\n\n';
    report += '📅 기간: ' + weekAgo + ' ~ ' + todayStr + '\n\n';
    report += '📝 업무일지: ' + myRps.length + '건' + (catStr ? ' (' + catStr + ')' : '') + '\n';
    report += '✅ 완료 할 일: ' + completed.length + '건\n';
    report += '⏳ 미완료 할 일: ' + pending.length + '건\n';
    report += '💬 AI 대화: ' + (mem.chatCount || 0) + '회\n';
    report += lvl.emoji + ' AI 레벨: Lv.' + lvl.lv + ' ' + lvl.title + ' (IQ ' + iq + ')\n\n';
    const avgPerDay = myRps.length > 0 ? (myRps.length / 7).toFixed(1) : '0';
    report += '📈 일평균 일지: ' + avgPerDay + '건\n';
    if (myRps.length >= 5) report += '🔥 생산적인 한 주! 잘하셨어요!\n';
    else if (myRps.length >= 3) report += '👍 꾸준히 기록하고 계시네요!\n';
    else report += '💡 이번 주는 기록을 좀 더 해보세요!\n';
    report += '\n🎯 이번 주 추천:\n';
    if (pending.length > 5) report += '• 미완료 할 일이 많아요. 정리 시간을 가져보세요\n';
    if (myRps.length < 3) report += '• 매일 업무일지를 작성하는 습관을 들여보세요\n';
    report += '• 목표를 설정하고 달성해보세요\n';
    const prof = _aiPersonalProfile();
    if (prof.likes && prof.likes.length > 0) report += '\n💜 ' + (prof.nickname || currentUser.name) + '님이 좋아하는 ' + prof.likes[0] + ' 관련 일이 있을지 찾아볼게요!';
    return report;
  } catch(_) { return null; }
}

// ─── [4] 감정 AI 엔진 ───
let _aiCurrentMood = 'neutral';
let _aiMoodScore = 50;

function _aiDetectEmotion(text) {
  const t = text.toLowerCase();
  let score = 0;
  const positive = /좋아|좋다|행복|신나|재밌|ㅋㅋ|ㅎㅎ|최고|대박|감사|고마|사랑|기쁘|즐거|신기|와|오예|짱|멋|굿|가즈아|히히|설레|기대|성공|축하|파이팅|화이팅/;
  const negative = /싫어|힘들|지치|피곤|짜증|열받|빡치|스트레스|답답|우울|슬프|서러|속상|화나|불안|걱정|무서|두려|귀찮|별로|구리|에휴|후|하아|아 진짜|미치|돌겠|힘/;
  const neutral = /뭐|음|글쎄|모르|그냥|아무|보통|ㅇㅇ|응|네|그래/;
  if (positive.test(t)) score += 20 + (t.match(new RegExp(positive.source, 'g')) || []).length * 5;
  if (negative.test(t)) score -= 20 + (t.match(new RegExp(negative.source, 'g')) || []).length * 5;
  if (/!{2,}/.test(t)) score += score > 0 ? 10 : -10;
  if (/ㅠ|ㅜ|😢|😭|😩|😤/.test(t)) score -= 15;
  if (/😊|😄|🎉|❤️|💕|🔥/.test(t)) score += 15;
  _aiMoodScore = Math.max(0, Math.min(100, _aiMoodScore + Math.round(score * 0.3)));
  if (_aiMoodScore >= 70) _aiCurrentMood = 'happy';
  else if (_aiMoodScore >= 40) _aiCurrentMood = 'neutral';
  else if (_aiMoodScore >= 20) _aiCurrentMood = 'tired';
  else _aiCurrentMood = 'stressed';
  return { mood: _aiCurrentMood, score: _aiMoodScore, delta: score };
}

function _aiMoodEmoji() {
  if (_aiCurrentMood === 'happy') return '😊';
  if (_aiCurrentMood === 'tired') return '😥';
  if (_aiCurrentMood === 'stressed') return '😤';
  return '🙂';
}

function _aiMoodAdjust(reply) {
  if (_aiCurrentMood === 'stressed' && !/힘|걱정|스트레스|응원|파이팅/.test(reply)) {
    const comfort = ['\n\n힘내세요! 항상 곁에 있을게요 💙', '\n\n오늘 좀 힘드시죠? 제가 더 도와드릴게요 💪', '\n\n무리하지 마세요. 쉬어가도 괜찮아요 😌'];
    return reply + comfort[Math.floor(Math.random() * comfort.length)];
  }
  if (_aiCurrentMood === 'happy' && !/좋|최고|멋|축하/.test(reply)) {
    const cheer = [' 😊', ' ✨', ' 🎉'];
    return reply + cheer[Math.floor(Math.random() * cheer.length)];
  }
  return reply;
}

// ─── [5] 멀티턴 업무 마법사 ───
let _aiWizardState = null;

function _aiWizardSave() {
  if (_aiWizardState) {
    try { sessionStorage.setItem('aiWizardSave', JSON.stringify(_aiWizardState)); } catch(_) {}
  } else {
    sessionStorage.removeItem('aiWizardSave');
  }
}
function _aiWizardRestore() {
  try {
    const saved = sessionStorage.getItem('aiWizardSave');
    if (saved) return JSON.parse(saved);
  } catch(_) {}
  return null;
}

function _aiStartWizard(type) {
  const saved = _aiWizardRestore();
  if (saved && saved.type === type && saved.step > 0) {
    _aiWizardState = saved;
    const stepInfo = saved.steps[saved.step];
    const doneKeys = Object.keys(saved.data).filter(k => saved.data[k]);
    let resume = '📌 이전에 ' + (type === 'report' ? '보고서' : type === 'event' ? '일정' : '할 일') + ' 마법사를 진행하다 중단했어요!\n\n';
    resume += '✅ 입력 완료: ' + doneKeys.length + '/' + saved.steps.length + '단계\n';
    doneKeys.forEach(k => { const st = saved.steps.find(s => s.key === k); if (st) resume += '  • ' + st.q.split('\n')[0].replace(/^[📝💡📊🎯📅📆⏰✅]\s*/, '') + ': ' + saved.data[k] + '\n'; });
    resume += '\n이어서 진행할까요? 아니면 처음부터 다시?';
    return { reply: resume, suggests: ['이어하기', '처음부터', '취소'] };
  }
  if (type === 'report') {
    const uid = currentUser ? currentUser.id : 'x';
    const wizardUsed = localStorage.getItem('aiWizardUsed_' + uid);
    const exampleMsg = !wizardUsed ? '\n\n💡 완성 예시:\n┌─────────────────┐\n│ 📌 고객사 미팅 진행      │\n│ 💡 화상회의 2시간, 계약조건 협의  │\n│ 📊 합의 완료, 서명 예정    │\n│ 🎯 다음: 계약서 최종본 검토   │\n└─────────────────┘' : '';
    if (!wizardUsed) localStorage.setItem('aiWizardUsed_' + uid, '1');
    _aiWizardState = {
      type: 'report',
      step: 0,
      data: {},
      _lastActivity: Date.now(),
      _example: exampleMsg,
      steps: [
        { key: 'what_task', q: '📝 어떤 업무를 하셨나요?\n(예: "고객사 미팅 진행", "코드 리뷰")' },
        { key: 'how_done', q: '💡 어떻게 진행하셨나요?\n(예: "화상회의로 2시간 진행", "PR 5건 검토")' },
        { key: 'result', q: '📊 결과는 어떠셨나요?\n(예: "계약 합의 완료", "버그 3건 수정")' },
        { key: 'next_plan', q: '🎯 다음 계획이 있으시면 말씀해주세요!\n(없으면 "없어" 또는 "끝")' },
      ]
    };
    return { reply: '📝 업무일지 마법사를 시작할게요!\n━━━━━━━━━━━━━━\n📌 마법사 모드 (1/' + _aiWizardState.steps.length + '단계)\n💬 각 질문에 답하면 자동으로 일지가 완성돼요\n🚪 "취소"라고 하면 언제든 중단 가능' + (_aiWizardState._example || '') + '\n\n' + _aiWizardState.steps[0].q, suggests: ['취소'] };
  }
  if (type === 'event') {
    _aiWizardState = {
      type: 'event',
      step: 0,
      data: {},
      _lastActivity: Date.now(),
      steps: [
        { key: 'title', q: '📅 일정 제목이 뭔가요?\n(예: "팀 미팅", "고객 방문")' },
        { key: 'date', q: '📆 언제인가요?\n(예: "오늘", "내일", "6월 20일")' },
        { key: 'time', q: '⏰ 몇 시인가요?\n(예: "오후 2시", "3시 30분")' },
      ]
    };
    return { reply: '📅 일정 등록 마법사를 시작할게요!\n━━━━━━━━━━━━━━\n📌 마법사 모드 (1/' + _aiWizardState.steps.length + '단계) | "취소"로 중단\n\n' + _aiWizardState.steps[0].q, suggests: ['취소'] };
  }
  if (type === 'todo') {
    _aiWizardState = {
      type: 'todo',
      step: 0,
      data: {},
      _lastActivity: Date.now(),
      steps: [
        { key: 'title', q: '✅ 할 일이 뭔가요?\n(예: "보고서 제출", "코드 배포")' },
        { key: 'due', q: '📅 기한이 있나요?\n(예: "내일까지", "금요일까지", "없어")' },
      ]
    };
    return { reply: '✅ 할 일 등록 마법사를 시작할게요!\n━━━━━━━━━━━━━━\n📌 마법사 모드 (1/' + _aiWizardState.steps.length + '단계) | "취소"로 중단\n\n' + _aiWizardState.steps[0].q, suggests: ['취소'] };
  }
  return null;
}

async function _aiProcessWizard(input) {
  if (!_aiWizardState) return null;
  const w = _aiWizardState;
  if (w._lastActivity && Date.now() - w._lastActivity > 5 * 60 * 1000) {
    _aiWizardState = null;
    _aiWizardSave();
    return { reply: '⏰ 마법사가 5분 이상 대기해서 자동 중단됐어요.\n이어하려면 "보고서 마법사"를 다시 시작해주세요!', suggests: ['보고서 마법사', '도움말'] };
  }
  w._lastActivity = Date.now();
  const t = input.trim();
  if (/^(취소|그만|중단|멈춰|안\s*할래)$/i.test(t)) {
    _aiWizardState = null;
    _aiWizardSave();
    return { reply: '마법사를 취소했어요. 다른 건 없으세요?', suggests: ['오늘 일정', '할 일 확인'] };
  }
  if (/^이어하기$/.test(t) && w.step > 0) {
    if (w._confirmed === 'pending') {
      return { reply: '이대로 제출할까요?', suggests: ['제출', '수정할래', '취소'] };
    }
    return { reply: '이어서 진행할게요!\n\n' + w.steps[w.step].q, suggests: [] };
  }
  if (/^처음부터$/.test(t)) {
    w.step = 0; w.data = {}; delete w._confirmed;
    _aiWizardSave();
    return { reply: '처음부터 다시 시작할게요!\n\n' + w.steps[0].q, suggests: [] };
  }
  if (w._confirmed === 'pending') {
    if (/^제출$|^네$|^ㅇㅇ$|^확인$|^ㄱㄱ$/.test(t)) {
      delete w._confirmed;
      _aiWizardSave();
    } else if (/수정|다시|고치|바꿔/.test(t)) {
      w.step = 0; delete w._confirmed;
      _aiWizardSave();
      return { reply: '처음부터 다시 작성할게요!\n\n' + w.steps[0].q, suggests: [] };
    } else {
      return { reply: '제출할까요, 수정할까요, 취소할까요?', suggests: ['제출', '수정할래', '취소'] };
    }
  }
  const currentStep = w.steps[w.step];
  if (w.type === 'report' && t.length < 2 && !/없|끝|ㄴ/.test(t)) {
    return { reply: '📝 내용이 너무 짧아요. 좀 더 자세히 적어주시면 좋은 보고서가 돼요!\n\n' + currentStep.q, suggests: [] };
  }
  if (w.type === 'report' && /^[ㅋㅎㅠㅜㅇ]+$/.test(t)) {
    return { reply: '🤔 보고서에 들어갈 내용을 입력해주세요!\n\n' + currentStep.q, suggests: [] };
  }
  if (w.type === 'report' && /[시씨씹개새]발|ㅅㅂ|ㅂㅅ|니\s*살태|꺼져|죽어/.test(t)) {
    w._pendingInput = t;
    return { reply: '🤔 혹시 보고서에 들어갈 내용이 맞나요?\n\n입력하신 내용: "' + t + '"\n\n이대로 넣을까요, 다시 입력할까요?', suggests: ['이대로', '다시 입력'] };
  }
  if (/^다시\s*입력$/.test(t)) {
    return { reply: w.steps[w.step].q, suggests: [] };
  }
  if (/^이대로$/.test(t) && w._pendingInput) {
    t = w._pendingInput;
    delete w._pendingInput;
  }
  const _formalScore = (s) => {
    let score = 0;
    if (/습니다|합니다|했습니다|됐습니다/.test(s)) score += 3;
    if (/요$|해요|했어요|됐어요/.test(s)) score += 2;
    if (/했어|했지|했음|됐어|함$|임$/.test(s)) score += 1;
    if (/ㅋ|ㅎ|ㅠ|ㅜ/.test(s)) score -= 1;
    return score;
  };
  if (w.type === 'report' && w.step >= 1) {
    const prevKeys = Object.keys(w.data);
    if (prevKeys.length > 0) {
      const prevScores = prevKeys.map(k => _formalScore(w.data[k]));
      const avgPrev = prevScores.reduce((a, b) => a + b, 0) / prevScores.length;
      const curScore = _formalScore(t);
      if (Math.abs(curScore - avgPrev) >= 3 && t.length > 5) {
        if (!w._toneWarned) {
          w._toneWarned = true;
          w._pendingInput = t;
          return { reply: '🤔 이전 답변과 말투가 좀 달라진 것 같아요.\n\n입력: "' + t + '"\n\n이게 보고서 내용이 맞나요?', suggests: ['맞아', '다시 입력'] };
        }
      }
    }
  }
  if (/^맞아$/.test(t) && w._pendingInput) {
    t = w._pendingInput;
    delete w._pendingInput;
    delete w._toneWarned;
  }
  w.data[currentStep.key] = t;
  w.step++;
  _aiWizardSave();
  if (w.step < w.steps.length) {
    const statusBar = '📌 마법사 진행 중 (' + w.step + '/' + w.steps.length + '단계)';
    return { reply: '✅ 확인! ' + (w.step) + '/' + w.steps.length + ' 완료\n\n' + w.steps[w.step].q + '\n\n' + statusBar, suggests: w.type === 'report' && w.step === w.steps.length - 1 ? ['없어', '끝'] : [] };
  }

  if (w.type === 'report' && !w._confirmed) {
    const next = (w.data.next_plan && !/없|끝|ㄴ/.test(w.data.next_plan)) ? w.data.next_plan : '';
    let preview = '📋 작성된 보고서 미리보기\n━━━━━━━━━━━━━━\n\n';
    preview += '📌 업무: ' + w.data.what_task + '\n';
    preview += '💡 방법: ' + (w.data.how_done || '-') + '\n';
    preview += '📊 결과: ' + (w.data.result || '-') + '\n';
    if (next) preview += '🎯 다음: ' + next + '\n';
    preview += '\n━━━━━━━━━━━━━━\n이대로 제출할까요?';
    w._confirmed = 'pending';
    _aiWizardSave();
    return { reply: preview, suggests: ['제출', '수정할래', '취소'] };
  }

  _aiWizardState = null;
  _aiWizardSave();
  if (w.type === 'report') {
    const next = (w.data.next_plan && !/없|끝|ㄴ/.test(w.data.next_plan)) ? w.data.next_plan : '';
    try {
      await api('/api/reports', {
        method: 'POST',
        body: {
          report_date: new Date().toISOString().split('T')[0],
          what_task: w.data.what_task,
          how_done: w.data.how_done || '',
          result: w.data.result || '',
          next_plan: next,
          work_category: '일반',
          content: w.data.what_task + ' — ' + (w.data.how_done || '') + ' → ' + (w.data.result || '')
        }
      });
      return { reply: '📝 업무일지 작성 완료! ✨\n\n📋 ' + w.data.what_task + '\n💡 ' + (w.data.how_done || '-') + '\n📊 ' + (w.data.result || '-') + (next ? '\n🎯 다음: ' + next : '') + '\n\n말 몇 마디로 일지가 완성됐어요! 👏', suggests: ['업무일지 보기', '하나 더 쓸래'] };
    } catch(_) { return { reply: '일지 저장 중 오류가 생겼어요. 다시 시도해주세요.', suggests: ['보고서 쓸래'] }; }
  }
  if (w.type === 'event') {
    let eventDate = new Date().toISOString().split('T')[0];
    if (/내일/.test(w.data.date)) eventDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    else if (/(\d{1,2})월\s*(\d{1,2})일/.test(w.data.date)) {
      const dm = w.data.date.match(/(\d{1,2})월\s*(\d{1,2})일/);
      eventDate = new Date().getFullYear() + '-' + String(parseInt(dm[1])).padStart(2, '0') + '-' + String(parseInt(dm[2])).padStart(2, '0');
    }
    let time = '';
    const tm = w.data.time.match(/(오후|오전)?\s*(\d{1,2})시?\s*(?:(\d{1,2})분|반)?/);
    if (tm) {
      let h = parseInt(tm[2]);
      if (tm[1] === '오후' && h < 12) h += 12;
      if (!tm[1] && h <= 6) h += 12;
      const m = tm[3] ? parseInt(tm[3]) : (w.data.time.includes('반') ? 30 : 0);
      time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    try {
      await api('/api/calendar-events', { method: 'POST', body: { title: w.data.title, description: '', event_date: eventDate, event_time: time, event_type: '업무' } });
      return { reply: '📅 일정 등록 완료!\n\n📌 ' + w.data.title + '\n📆 ' + eventDate + (time ? ' ' + time : '') + '\n\n마법사로 간편하게 등록! ✨', suggests: ['오늘 일정', '할 일 확인'] };
    } catch(_) { return { reply: '일정 등록 중 오류가 생겼어요.', suggests: ['일정 등록할래'] }; }
  }
  if (w.type === 'todo') {
    let dueDate = '';
    if (/내일/.test(w.data.due)) dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    else if (/금요|이번\s*주/.test(w.data.due)) { const fri = new Date(); fri.setDate(fri.getDate() + (5 - fri.getDay() + 7) % 7 || 7); dueDate = fri.toISOString().split('T')[0]; }
    else if (/(\d+)일/.test(w.data.due)) { const d = w.data.due.match(/(\d+)일/); dueDate = new Date(Date.now() + parseInt(d[1]) * 86400000).toISOString().split('T')[0]; }
    try {
      const body = { title: w.data.title };
      if (dueDate) body.due_date = dueDate;
      await api('/api/todos', { method: 'POST', body });
      return { reply: '✅ 할 일 등록 완료!\n\n📌 ' + w.data.title + (dueDate ? '\n📅 기한: ' + dueDate : '') + '\n\n마법사로 간편하게! ✨', suggests: ['할 일 확인', '하나 더 추가'] };
    } catch(_) { return { reply: '할 일 등록 중 오류가 생겼어요.', suggests: ['할 일 추가'] }; }
  }
  return null;
}

// ─── [7] AI 자동 일지 엔진 ───
function _aiJournalHistory() {
  try { return JSON.parse(localStorage.getItem('aiJournal_' + (currentUser ? currentUser.id : 'x')) || '[]'); } catch(_) { return []; }
}
function _aiJournalSave(logs) {
  const trimmed = logs.slice(-90);
  localStorage.setItem('aiJournal_' + (currentUser ? currentUser.id : 'x'), JSON.stringify(trimmed));
}
function _aiJournalFind(date) {
  return _aiJournalHistory().find(j => j.date === date) || null;
}

async function _aiDailyJournal(targetDate) {
  if (!currentUser) return null;
  const td = targetDate || new Date().toISOString().split('T')[0];
  try {
    const [rps, todos, evts, atd] = await Promise.all([
      api(`/api/reports?from=${td}&to=${td}`),
      api('/api/todos'),
      api('/api/calendar-events?date=' + td),
      api('/api/attendance/today')
    ]);
    const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
    const allTodos = todos || [];
    const completed = allTodos.filter(t => t.completed);
    const pending = allTodos.filter(t => !t.completed);
    const myEvts = evts || [];
    const chatCount = _aiChatHistory.filter(h => h.who === 'user').length;

    const tasks = myRps.map(r => (r.what_task || r.content || '').substring(0, 40)).filter(Boolean);
    const doneList = completed.map(t => t.title).slice(0, 5);
    const evtList = myEvts.map(e => (e.event_time ? e.event_time.substring(0, 5) + ' ' : '') + e.title).slice(0, 5);

    let oneLine = '';
    if (tasks.length > 0) oneLine = tasks[0];
    else if (doneList.length > 0) oneLine = '할일 ' + doneList.length + '건 완료';
    else if (myEvts.length > 0) oneLine = evtList[0];
    else oneLine = '기록 없음';

    const score = Math.min(100, myRps.length * 20 + completed.length * 15 + myEvts.length * 10 + Math.min(chatCount, 5) * 2 + (atd && atd.check_in ? 10 : 0));

    const journal = {
      date: td,
      oneLine,
      score,
      reports: myRps.length,
      todoDone: completed.length,
      todoPending: pending.length,
      events: myEvts.length,
      chatCount,
      checkIn: atd && atd.check_in ? (atd.check_in || '').substring(11, 16) : null,
      checkOut: atd && atd.check_out ? (atd.check_out || '').substring(11, 16) : null,
      tasks,
      doneList,
      evtList,
      createdAt: new Date().toISOString()
    };

    const logs = _aiJournalHistory();
    const idx = logs.findIndex(j => j.date === td);
    if (idx >= 0) logs[idx] = journal; else logs.push(journal);
    _aiJournalSave(logs);

    return journal;
  } catch(_) { return null; }
}

function _aiFormatJournal(j) {
  if (!j) return '일지를 생성할 수 없어요.';
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const d = new Date(j.date);
  const dayName = dayNames[d.getDay()];
  const scoreBar = '█'.repeat(Math.floor(j.score / 10)) + '░'.repeat(10 - Math.floor(j.score / 10));

  let r = '📋 AI 자동 일지\n';
  r += '━━━━━━━━━━━━━━\n';
  r += '📅 ' + j.date + ' (' + dayName + ')\n';
  r += '📊 생산성: [' + scoreBar + '] ' + j.score + '점\n\n';

  if (j.checkIn) r += '⏰ 출근: ' + j.checkIn + (j.checkOut ? ' → 퇴근: ' + j.checkOut : ' (미퇴근)') + '\n';

  if (j.tasks.length > 0) {
    r += '\n📝 업무일지 ' + j.reports + '건:\n';
    j.tasks.forEach(t => { r += '  • ' + t + '\n'; });
  }

  if (j.doneList.length > 0) {
    r += '\n✅ 완료한 일 ' + j.todoDone + '건:\n';
    j.doneList.forEach(t => { r += '  • ' + t + '\n'; });
  }

  if (j.todoPending > 0) r += '\n⬜ 남은 할 일: ' + j.todoPending + '건\n';

  if (j.evtList.length > 0) {
    r += '\n📅 일정 ' + j.events + '건:\n';
    j.evtList.forEach(e => { r += '  • ' + e + '\n'; });
  }

  r += '\n💬 비서 대화: ' + j.chatCount + '회\n';

  r += '\n💡 한 줄 요약: "' + j.oneLine + '"';

  if (j.score >= 80) r += '\n\n🔥 오늘 엄청 열심히 하셨어요!';
  else if (j.score >= 50) r += '\n\n👍 알찬 하루였어요!';
  else if (j.score >= 20) r += '\n\n🌱 차근차근 성장 중!';
  else r += '\n\n☕ 내일은 더 화이팅!';

  return r;
}

function _aiJournalTrend(days) {
  const logs = _aiJournalHistory();
  if (logs.length === 0) return '아직 일지 기록이 없어요. 매일 자동으로 쌓이니 며칠 뒤에 확인해보세요!';

  const recent = logs.slice(-days);
  const avgScore = Math.round(recent.reduce((s, j) => s + j.score, 0) / recent.length);
  const totalReports = recent.reduce((s, j) => s + j.reports, 0);
  const totalDone = recent.reduce((s, j) => s + j.todoDone, 0);
  const totalEvents = recent.reduce((s, j) => s + j.events, 0);

  const best = recent.reduce((a, b) => a.score > b.score ? a : b);
  const worst = recent.reduce((a, b) => a.score < b.score ? a : b);

  const half1 = recent.slice(0, Math.floor(recent.length / 2));
  const half2 = recent.slice(Math.floor(recent.length / 2));
  const avg1 = half1.length ? Math.round(half1.reduce((s, j) => s + j.score, 0) / half1.length) : 0;
  const avg2 = half2.length ? Math.round(half2.reduce((s, j) => s + j.score, 0) / half2.length) : 0;
  const trendIcon = avg2 > avg1 + 5 ? '📈 상승세!' : avg2 < avg1 - 5 ? '📉 하락세' : '➡️ 유지 중';

  let r = '📈 생산성 트렌드 (최근 ' + recent.length + '일)\n';
  r += '━━━━━━━━━━━━━━\n\n';
  r += '📊 평균 생산성: ' + avgScore + '점\n';
  r += '📝 보고서: 총 ' + totalReports + '건 (일평균 ' + (totalReports / recent.length).toFixed(1) + '건)\n';
  r += '✅ 완료 할일: 총 ' + totalDone + '건\n';
  r += '📅 일정: 총 ' + totalEvents + '건\n\n';

  r += '🏆 최고의 날: ' + best.date + ' (' + best.score + '점)\n';
  r += '💤 쉬어간 날: ' + worst.date + ' (' + worst.score + '점)\n\n';

  r += '추세: ' + trendIcon + '\n';

  r += '\n📊 일별 점수:\n';
  recent.slice(-7).forEach(j => {
    const bar = '█'.repeat(Math.floor(j.score / 10));
    const dn = ['일', '월', '화', '수', '목', '금', '토'][new Date(j.date).getDay()];
    r += j.date.substring(5) + '(' + dn + ') ' + bar + ' ' + j.score + '\n';
  });

  return r;
}

// ─── [8] AI 예측 엔진 ───
function _aiAnalyzePatterns() {
  const logs = _aiJournalHistory();
  if (logs.length < 3) return null;

  const byDay = [[], [], [], [], [], [], []];
  logs.forEach(j => { byDay[new Date(j.date).getDay()].push(j); });

  const dayStats = byDay.map((arr, i) => {
    if (arr.length === 0) return { day: i, avgScore: 0, avgReports: 0, avgDone: 0, avgEvents: 0, count: 0 };
    return {
      day: i,
      avgScore: Math.round(arr.reduce((s, j) => s + j.score, 0) / arr.length),
      avgReports: +(arr.reduce((s, j) => s + j.reports, 0) / arr.length).toFixed(1),
      avgDone: +(arr.reduce((s, j) => s + j.todoDone, 0) / arr.length).toFixed(1),
      avgEvents: +(arr.reduce((s, j) => s + j.events, 0) / arr.length).toFixed(1),
      count: arr.length
    };
  });

  const workDays = dayStats.filter(d => d.day >= 1 && d.day <= 5 && d.count > 0);
  const busiestDay = workDays.length > 0 ? workDays.reduce((a, b) => a.avgScore > b.avgScore ? a : b) : null;
  const slowestDay = workDays.length > 0 ? workDays.reduce((a, b) => a.avgScore < b.avgScore ? a : b) : null;

  const recentScores = logs.slice(-14).map(j => j.score);
  const avgRecent = recentScores.length > 0 ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 50;

  return { dayStats, busiestDay, slowestDay, avgRecent, totalDays: logs.length };
}

function _aiPredictToday() {
  const patterns = _aiAnalyzePatterns();
  if (!patterns) return '아직 데이터가 부족해요. 며칠 더 사용하면 패턴을 분석할 수 있어요! 📊';

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const todayDay = new Date().getDay();
  const stat = patterns.dayStats[todayDay];

  let r = '🔮 오늘의 AI 예측\n━━━━━━━━━━━━━━\n\n';
  r += '📅 ' + dayNames[todayDay] + '요일 패턴 분석 (데이터 ' + (stat.count || 0) + '일)\n\n';

  if (stat.count === 0) {
    r += '이 요일 데이터가 아직 없어요. 오늘 활동이 첫 기록이 될 거예요!\n';
    return r;
  }

  const scoreBar = '█'.repeat(Math.floor(stat.avgScore / 10)) + '░'.repeat(10 - Math.floor(stat.avgScore / 10));
  r += '📊 예상 생산성: [' + scoreBar + '] ' + stat.avgScore + '점\n';
  r += '📝 보고서 작성 예상: ' + stat.avgReports + '건\n';
  r += '✅ 할일 완료 예상: ' + stat.avgDone + '건\n';
  r += '📅 일정 예상: ' + stat.avgEvents + '건\n\n';

  r += '💡 예측 코멘트:\n';
  if (stat.avgReports >= 1) r += '• 오늘은 보고서 쓸 확률이 높아요! 📝\n';
  if (stat.avgScore >= 70) r += '• ' + dayNames[todayDay] + '요일은 생산성이 높은 날! 집중하세요 🔥\n';
  else if (stat.avgScore < 40) r += '• ' + dayNames[todayDay] + '요일은 보통 여유로운 날이에요 ☕\n';
  if (stat.avgDone >= 3) r += '• 할 일 처리량이 많은 날이에요. 미뤄둔 거 오늘 해치우세요! 💪\n';

  if (patterns.busiestDay) {
    r += '\n🏆 가장 바쁜 요일: ' + dayNames[patterns.busiestDay.day] + '요일 (' + patterns.busiestDay.avgScore + '점)';
  }
  if (patterns.slowestDay) {
    r += '\n☕ 가장 여유로운 요일: ' + dayNames[patterns.slowestDay.day] + '요일 (' + patterns.slowestDay.avgScore + '점)';
  }

  return r;
}

async function _aiDeadlineRisk() {
  if (!currentUser) return '로그인이 필요해요.';
  try {
    const todos = await api('/api/todos');
    const pending = (todos || []).filter(t => !t.completed && t.due_date);
    if (pending.length === 0) return '기한이 설정된 미완료 할 일이 없어요. 안전해요! ✅';

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const risks = { red: [], yellow: [], green: [] };

    pending.forEach(t => {
      const due = t.due_date.split('T')[0];
      const diffMs = new Date(due) - new Date(todayStr);
      const diffDays = Math.ceil(diffMs / 86400000);
      const item = { title: t.title, due, diffDays };
      if (diffDays < 0) risks.red.push(item);
      else if (diffDays <= 1) risks.red.push(item);
      else if (diffDays <= 3) risks.yellow.push(item);
      else risks.green.push(item);
    });

    let r = '⚠️ 마감 위험도 분석\n━━━━━━━━━━━━━━\n\n';

    if (risks.red.length > 0) {
      r += '🔴 긴급 (' + risks.red.length + '건):\n';
      risks.red.forEach(t => {
        const label = t.diffDays < 0 ? '⏰ ' + Math.abs(t.diffDays) + '일 초과!' : t.diffDays === 0 ? '⏰ 오늘 마감!' : '⏰ 내일 마감';
        r += '  • ' + t.title + ' — ' + label + '\n';
      });
      r += '\n';
    }

    if (risks.yellow.length > 0) {
      r += '🟡 주의 (' + risks.yellow.length + '건):\n';
      risks.yellow.forEach(t => { r += '  • ' + t.title + ' — ' + t.diffDays + '일 남음\n'; });
      r += '\n';
    }

    if (risks.green.length > 0) {
      r += '🟢 안전 (' + risks.green.length + '건):\n';
      risks.green.forEach(t => { r += '  • ' + t.title + ' — ' + t.diffDays + '일 남음\n'; });
      r += '\n';
    }

    if (risks.red.length > 0) {
      r += '💡 지금 할 수 있는 것:\n';
      r += '  1. 가장 급한 "' + risks.red[0].title + '" 먼저 착수\n';
      if (risks.red.length > 1) r += '  2. 나머지 ' + (risks.red.length - 1) + '건은 우선순위 정리 후 순서대로\n';
      r += '  3. 혼자 어려우면 팀원에게 도움 요청\n';
      r += '  → "우선순위"라고 말하면 정렬해드려요!';
    } else if (risks.yellow.length > 0) {
      r += '💡 추천 액션:\n';
      r += '  1. 오늘 중 "' + risks.yellow[0].title + '" 일부라도 진행\n';
      r += '  2. 내일 일정 확인 후 작업 시간 확보\n';
      r += '  → 미리 조금씩 하면 마감일에 여유가 생겨요!';
    } else {
      r += '👍 여유 있어요. 이 페이스 유지하세요!';
    }

    return r;
  } catch(_) { return '할 일 조회 중 오류가 생겼어요.'; }
}

function _aiWeekForecast() {
  const patterns = _aiAnalyzePatterns();
  if (!patterns) return '아직 데이터가 부족해요. 며칠 더 사용하면 주간 전망을 볼 수 있어요!';

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date().getDay();

  let r = '🔮 이번 주 전망\n━━━━━━━━━━━━━━\n\n';

  for (let i = 0; i < 7; i++) {
    const d = (today + i) % 7;
    const stat = patterns.dayStats[d];
    const isToday = i === 0;
    const label = isToday ? '오늘' : dayNames[d] + '요일';

    if (stat.count === 0) {
      r += (isToday ? '▶ ' : '  ') + label + ': 데이터 없음\n';
      continue;
    }

    const miniBar = '█'.repeat(Math.floor(stat.avgScore / 20));
    let mood = '';
    if (stat.avgScore >= 70) mood = '🔥';
    else if (stat.avgScore >= 50) mood = '👍';
    else if (stat.avgScore >= 30) mood = '☕';
    else mood = '💤';

    r += (isToday ? '▶ ' : '  ') + label + ' ' + miniBar + ' ' + stat.avgScore + '점 ' + mood;
    if (stat.avgReports >= 1) r += ' 📝';
    if (stat.avgEvents >= 2) r += ' 📅';
    r += '\n';
  }

  r += '\n📝 = 보고서 예상  📅 = 일정 많음\n';

  const weekWork = patterns.dayStats.slice(1, 6).filter(d => d.count > 0);
  if (weekWork.length > 0) {
    const weekAvg = Math.round(weekWork.reduce((s, d) => s + d.avgScore, 0) / weekWork.length);
    r += '\n📊 주간 평균 예상 생산성: ' + weekAvg + '점';
    if (weekAvg >= 70) r += '\n이번 주는 불타는 한 주가 될 거예요! 🔥';
    else if (weekAvg >= 50) r += '\n꾸준한 한 주가 될 거예요! 💪';
    else r += '\n여유 있는 한 주가 될 거예요 ☕';
  }

  return r;
}

function _aiPatternReport() {
  const patterns = _aiAnalyzePatterns();
  if (!patterns) return '아직 데이터가 부족해요. 최소 3일 이상의 일지가 필요합니다!';

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  let r = '📊 나의 업무 패턴 리포트\n━━━━━━━━━━━━━━\n';
  r += '📅 분석 기간: ' + patterns.totalDays + '일\n\n';

  r += '요일별 생산성:\n';
  patterns.dayStats.forEach((stat, i) => {
    if (stat.count === 0) return;
    const bar = '█'.repeat(Math.floor(stat.avgScore / 10)) + '░'.repeat(10 - Math.floor(stat.avgScore / 10));
    r += dayNames[i] + ' [' + bar + '] ' + stat.avgScore + '점 (보고 ' + stat.avgReports + ' / 완료 ' + stat.avgDone + ')\n';
  });

  if (patterns.busiestDay && patterns.slowestDay) {
    r += '\n🏆 최고 생산성: ' + dayNames[patterns.busiestDay.day] + '요일 (' + patterns.busiestDay.avgScore + '점)';
    r += '\n☕ 최저 생산성: ' + dayNames[patterns.slowestDay.day] + '요일 (' + patterns.slowestDay.avgScore + '점)';

    const gap = patterns.busiestDay.avgScore - patterns.slowestDay.avgScore;
    r += '\n📐 편차: ' + gap + '점';
    if (gap > 30) r += ' — 요일별 차이가 큰 편이에요. 루틴을 고르게 만들어보세요!';
    else r += ' — 꾸준한 편이에요! 좋아요! 👍';
  }

  r += '\n\n📈 최근 2주 평균: ' + patterns.avgRecent + '점';
  if (patterns.avgRecent >= 70) r += ' — 컨디션 최고! 🔥';
  else if (patterns.avgRecent >= 50) r += ' — 안정적! 👍';
  else if (patterns.avgRecent >= 30) r += ' — 조금 쉬어가도 괜찮아요 🌱';
  else r += ' — 컨디션 관리가 필요해요 💪';

  return r;
}

// ─── [9] 스마트 추천 엔진 ───
async function _aiSmartRecommend() {
  if (!currentUser) return { reply: '로그인이 필요해요.', suggests: [] };
  const now = new Date();
  const h = now.getHours();
  const todayStr = now.toISOString().split('T')[0];
  const dayName = ['일','월','화','수','목','금','토'][now.getDay()];

  try {
    const [todos, evts, rps, atd] = await Promise.all([
      api('/api/todos'),
      api('/api/calendar-events?date=' + todayStr),
      api(`/api/reports?from=${todayStr}&to=${todayStr}`),
      api('/api/attendance/today')
    ]);

    const pending = (todos || []).filter(t => !t.completed);
    const urgent = pending.filter(t => t.due_date && Math.ceil((new Date(t.due_date.split('T')[0]) - new Date(todayStr)) / 86400000) <= 1);
    const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
    const upcomingEvts = (evts || []).filter(e => {
      if (!e.event_time) return false;
      const [eh, em] = e.event_time.split(':').map(Number);
      return eh * 60 + em > h * 60 + now.getMinutes();
    });
    const checkedIn = atd && atd.check_in;
    const checkedOut = atd && atd.check_out;

    const recs = [];
    const suggests = [];

    if (!checkedIn && h >= 7 && h < 11) {
      recs.push({ icon: '⏰', text: '출근 체크를 아직 안 했어요!', reason: '출근 기록 미확인', priority: 10 });
      suggests.push('출근해');
    }

    if (urgent.length > 0) {
      recs.push({ icon: '🚨', text: '마감 임박 할일 ' + urgent.length + '건: ' + urgent.slice(0, 2).map(t => '"' + t.title + '"').join(', '), reason: '마감일 24시간 이내', priority: 9 });
      suggests.push('마감 위험');
    }

    if (upcomingEvts.length > 0) {
      const next = upcomingEvts[0];
      const [eh2, em2] = next.event_time.split(':').map(Number);
      const minLeft = eh2 * 60 + em2 - (h * 60 + now.getMinutes());
      recs.push({ icon: '📅', text: '다음 일정: ' + next.event_time.substring(0, 5) + ' ' + next.title, reason: minLeft + '분 후 시작', priority: 8 });
    }

    if (pending.length > 0 && urgent.length === 0) {
      const top = _aiPrioritize(pending).slice(0, 2);
      recs.push({ icon: '✅', text: '추천 할일: ' + top.map(t => '"' + t.title + '"').join(', '), reason: '우선순위 기반 정렬', priority: 6 });
      suggests.push('우선순위');
    }

    if (myRps.length === 0 && h >= 14) {
      recs.push({ icon: '📝', text: '오늘 아직 보고서를 안 썼어요. 지금 작성하면 딱 좋아요!', reason: '오후인데 보고서 0건', priority: 5 });
      suggests.push('보고서 뭐 쓸까');
    }

    if (h >= 11 && h < 13) {
      recs.push({ icon: '🍜', text: '점심시간이에요! 잠깐 쉬어가세요.', reason: '현재 점심시간대', priority: 3 });
    }

    if (checkedIn && !checkedOut && h >= 17) {
      recs.push({ icon: '🌙', text: '퇴근 시간이에요! 일지 정리하고 마무리하세요.', reason: '17시 이후 + 퇴근 미체크', priority: 4 });
      suggests.push('오늘 일지');
    }

    if (pending.length === 0 && myRps.length > 0) {
      recs.push({ icon: '🎉', text: '할 일 다 끝! 보고서도 썼고! 완벽한 하루예요!', reason: '할 일 완료 + 보고서 작성 완료', priority: 2 });
    }

    const patterns = _aiAnalyzePatterns();
    if (patterns) {
      const stat = patterns.dayStats[now.getDay()];
      if (stat && stat.count >= 2) {
        recs.push({ icon: '🔮', text: dayName + '요일 평균 생산성 ' + stat.avgScore + '점 — ' + (stat.avgScore >= 70 ? '오늘도 화이팅!' : stat.avgScore >= 40 ? '꾸준히 가요!' : '가볍게 시작해봐요!'), reason: dayName + '요일 ' + stat.count + '회 데이터 기반', priority: 1 });
      }
    }

    recs.sort((a, b) => b.priority - a.priority);

    let r = '🧠 스마트 추천\n━━━━━━━━━━━━━━\n';
    r += '📅 ' + todayStr + ' (' + dayName + ') ' + String(h).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + '\n\n';

    if (recs.length === 0) {
      r += '지금은 특별한 추천이 없어요. 여유롭게 보내세요! ☕';
    } else {
      recs.slice(0, 3).forEach((rec, i) => {
        r += (i + 1) + '. ' + rec.icon + ' ' + rec.text + '\n';
        if (rec.reason) r += '   ↳ ' + rec.reason + '\n';
      });
    }

    r += '\n💡 상황이 바뀌면 다시 물어봐주세요!';
    if (suggests.length === 0) suggests.push('오늘 일지', '할 일 확인');

    return { reply: r, suggests };
  } catch(_) { return { reply: '추천을 생성하지 못했어요. 잠시 후 다시 시도해주세요.', suggests: [] }; }
}

async function _aiNextAction() {
  if (!currentUser) return { reply: '로그인이 필요해요.', suggests: [] };
  const now = new Date();
  const h = now.getHours();
  const todayStr = now.toISOString().split('T')[0];
  const dayName = ['일','월','화','수','목','금','토'][now.getDay()];
  const name = _aiPersonalProfile().nickname || currentUser.name || '';

  try {
    const [todos, evts, rps, atd] = await Promise.all([
      api('/api/todos'),
      api('/api/calendar-events?date=' + todayStr),
      api(`/api/reports?from=${todayStr}&to=${todayStr}`),
      api('/api/attendance/today')
    ]);

    const pending = (todos || []).filter(t => !t.completed);
    const urgent = pending.filter(t => t.due_date && Math.ceil((new Date(t.due_date.split('T')[0]) - new Date(todayStr)) / 86400000) <= 1);
    const overdue = pending.filter(t => t.due_date && t.due_date.split('T')[0] < todayStr);
    const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
    const upcomingEvts = (evts || []).filter(e => {
      if (!e.event_time) return false;
      const [eh, em] = e.event_time.split(':').map(Number);
      return eh * 60 + em > h * 60 + now.getMinutes();
    });
    const checkedIn = atd && atd.check_in;
    const checkedOut = atd && atd.check_out;

    let greeting = '';
    if (h < 9) greeting = '🌅 좋은 아침이에요!';
    else if (h < 12) greeting = '☀️ 오전 업무 시간이에요!';
    else if (h < 14) greeting = '🍜 점심시간이네요!';
    else if (h < 17) greeting = '⚡ 오후 집중 타임!';
    else if (h < 19) greeting = '🌆 마무리 시간이에요!';
    else greeting = '🌙 야근 중이시네요...';

    let r = greeting + ' ' + name + '님의 현재 상황이에요.\n━━━━━━━━━━━━━━\n\n';
    r += '⏰ ' + (checkedIn ? '출근 ✅' + (checkedOut ? ' → 퇴근 ✅' : '') : '미출근 ❌') + '\n';
    r += '📅 일정 ' + (evts || []).length + '건';
    if (upcomingEvts.length > 0) r += ' (남은 ' + upcomingEvts.length + '건)';
    r += '\n';
    r += '✅ 할일 ' + pending.length + '건';
    if (urgent.length > 0) r += ' (🚨 긴급 ' + urgent.length + '건)';
    if (overdue.length > 0) r += ' (⚠️ 기한초과 ' + overdue.length + '건)';
    r += '\n';
    r += '📝 보고서 ' + myRps.length + '건 작성\n\n';

    const actions = [];
    const suggests = [];

    if (!checkedIn && h >= 7 && h < 11) {
      actions.push('1️⃣ 출근 체크 → "출근해"');
      suggests.push('출근해');
    }
    if (overdue.length > 0) {
      actions.push((actions.length + 1) + '️⃣ 기한 초과 할일 처리 → ' + overdue.slice(0, 2).map(t => '"' + t.title + '"').join(', '));
      suggests.push('마감 위험');
    }
    if (urgent.length > 0 && overdue.length === 0) {
      actions.push((actions.length + 1) + '️⃣ 긴급 할일 처리 → ' + urgent.slice(0, 2).map(t => '"' + t.title + '"').join(', '));
      suggests.push('우선순위');
    }
    if (upcomingEvts.length > 0) {
      const next = upcomingEvts[0];
      const [eh2, em2] = next.event_time.split(':').map(Number);
      const minLeft = eh2 * 60 + em2 - (h * 60 + now.getMinutes());
      actions.push((actions.length + 1) + '️⃣ ' + minLeft + '분 후 일정 → ' + next.title);
      suggests.push('오늘 일정');
    }
    if (pending.length > 0 && actions.length < 3) {
      const top = _aiPrioritize(pending)[0];
      if (top && !overdue.includes(top) && !urgent.includes(top)) {
        actions.push((actions.length + 1) + '️⃣ 다음 추천 할일 → "' + top.title + '"');
        suggests.push('할 일 확인');
      }
    }
    if (myRps.length === 0 && h >= 14 && actions.length < 4) {
      actions.push((actions.length + 1) + '️⃣ 보고서 작성 → "보고서 쓸래"');
      suggests.push('보고서 쓸래');
    }
    if (checkedIn && !checkedOut && h >= 17 && actions.length < 4) {
      actions.push((actions.length + 1) + '️⃣ 퇴근 정리 → "오늘 마무리"');
      suggests.push('오늘 마무리');
    }

    if (actions.length === 0) {
      r += '🎉 현재 긴급한 건 없어요! 여유롭게 보내세요~';
      suggests.push('할 일 추가', '오늘 일정', '추천해줘');
    } else {
      r += '📋 지금 이렇게 하시면 돼요:\n';
      r += actions.join('\n') + '\n';
      r += '\n👆 위 항목을 말씀해주시면 바로 처리해드릴게요!';
    }

    return { reply: r, suggests };
  } catch(_) { return { reply: '상황 분석에 실패했어요. 잠시 후 다시 시도해주세요.', suggests: ['오늘 브리핑'] }; }
}

function _aiPrioritize(pendingTodos) {
  const todayStr = new Date().toISOString().split('T')[0];
  return pendingTodos.slice().sort((a, b) => {
    let sa = 0, sb = 0;

    if (a.due_date) {
      const da = Math.ceil((new Date(a.due_date.split('T')[0]) - new Date(todayStr)) / 86400000);
      if (da < 0) sa += 100;
      else if (da === 0) sa += 80;
      else if (da === 1) sa += 60;
      else if (da <= 3) sa += 40;
      else sa += 20;
    }
    if (b.due_date) {
      const db = Math.ceil((new Date(b.due_date.split('T')[0]) - new Date(todayStr)) / 86400000);
      if (db < 0) sb += 100;
      else if (db === 0) sb += 80;
      else if (db === 1) sb += 60;
      else if (db <= 3) sb += 40;
      else sb += 20;
    }

    const urgentWords = /긴급|급함|중요|필수|ASAP|마감|시급/;
    if (urgentWords.test(a.title)) sa += 30;
    if (urgentWords.test(b.title)) sb += 30;

    if (a.priority === 'high') sa += 25;
    else if (a.priority === 'medium') sa += 15;
    if (b.priority === 'high') sb += 25;
    else if (b.priority === 'medium') sb += 15;

    if (!a.due_date && !b.due_date) {
      const ca = new Date(a.created_at || 0).getTime();
      const cb = new Date(b.created_at || 0).getTime();
      if (ca < cb) sa += 5;
      else if (cb < ca) sb += 5;
    }

    return sb - sa;
  });
}

async function _aiPriorityReport() {
  if (!currentUser) return '로그인이 필요해요.';
  try {
    const todos = await api('/api/todos');
    const pending = (todos || []).filter(t => !t.completed);
    if (pending.length === 0) return '미완료 할 일이 없어요! 완벽해요! 🎉';

    const sorted = _aiPrioritize(pending);
    const todayStr = new Date().toISOString().split('T')[0];

    let r = '🎯 우선순위 자동 정렬\n━━━━━━━━━━━━━━\n\n';
    sorted.slice(0, 10).forEach((t, i) => {
      let tag = '';
      if (t.due_date) {
        const diff = Math.ceil((new Date(t.due_date.split('T')[0]) - new Date(todayStr)) / 86400000);
        if (diff < 0) tag = ' 🔴 ' + Math.abs(diff) + '일 초과';
        else if (diff === 0) tag = ' 🔴 오늘 마감';
        else if (diff === 1) tag = ' 🟠 내일 마감';
        else if (diff <= 3) tag = ' 🟡 ' + diff + '일 남음';
        else tag = ' 🟢 ' + diff + '일 남음';
      }
      const urgentWords = /긴급|급함|중요|필수|ASAP|마감|시급/;
      if (urgentWords.test(t.title)) tag += ' ⚡';
      r += (i + 1) + '. ' + t.title + tag + '\n';
    });

    if (sorted.length > 10) r += '\n... 외 ' + (sorted.length - 10) + '건';

    r += '\n\n💡 위에서부터 순서대로 처리하면 효율적이에요!';
    if (sorted[0]) r += '\n👉 지금 바로: "' + sorted[0].title + '"';

    return r;
  } catch(_) { return '할 일 조회 중 오류가 생겼어요.'; }
}

async function _aiSuggestReport() {
  if (!currentUser) return { reply: '로그인이 필요해요.', suggests: [] };
  const now = new Date();
  const h = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  try {
    const [todos, evts, rps] = await Promise.all([
      api('/api/todos'),
      api('/api/calendar-events?date=' + todayStr),
      api(`/api/reports?from=${todayStr}&to=${todayStr}`)
    ]);

    const completed = (todos || []).filter(t => t.completed);
    const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
    const myEvts = evts || [];

    let r = '📝 보고서 작성 가이드\n━━━━━━━━━━━━━━\n\n';

    if (myRps.length > 0) {
      r += '✅ 오늘 이미 ' + myRps.length + '건 작성했어요.\n';
      r += '추가로 쓸 내용이 있다면 아래를 참고하세요!\n\n';
    }

    r += '💡 이런 내용 어때요?\n\n';

    const suggestions = [];

    if (completed.length > 0) {
      suggestions.push('✅ 완료한 할일 기반:\n   → "' + completed.slice(0, 3).map(t => t.title).join('", "') + '"');
    }

    if (myEvts.length > 0) {
      suggestions.push('📅 오늘 일정 기반:\n   → "' + myEvts.slice(0, 3).map(e => e.title).join('", "') + '"');
    }

    if (h >= 9 && h < 12) {
      suggestions.push('🌅 오전 업무:\n   → 어제 이어서 진행한 일, 오전 회의 내용');
    } else if (h >= 12 && h < 15) {
      suggestions.push('☀️ 오후 업무:\n   → 오전 완료 건, 오후 계획');
    } else if (h >= 15) {
      suggestions.push('🌆 하루 마무리:\n   → 오늘 처리한 일 정리, 내일 계획');
    }

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const recentRps = await api(`/api/reports?from=${weekAgo}&to=${todayStr}`);
    const myRecent = (recentRps || []).filter(r => r.author_id === currentUser.id);
    if (myRecent.length > 0) {
      const lastTask = (myRecent[0].what_task || myRecent[0].content || '').substring(0, 30);
      suggestions.push('📋 최근 보고서 이어서:\n   → "' + lastTask + '..." 후속 작업');
    }

    if (suggestions.length === 0) {
      suggestions.push('📌 자유 주제:\n   → 오늘 한 일, 느낀 점, 내일 계획');
    }

    r += suggestions.join('\n\n');
    r += '\n\n✍️ "보고서 마법사"를 사용하면 대화로 쉽게 작성할 수 있어요!';

    return { reply: r, suggests: ['보고서 마법사', '직접 쓸래', '오늘 일지'] };
  } catch(_) { return { reply: '정보 조회 중 오류가 생겼어요.', suggests: [] }; }
}

async function _aiNextAction() {
  if (!currentUser) return { reply: '로그인이 필요해요.', suggests: [] };
  const now = new Date();
  const h = now.getHours();
  const todayStr = now.toISOString().split('T')[0];

  try {
    const [todos, evts, rps, atd] = await Promise.all([
      api('/api/todos'),
      api('/api/calendar-events?date=' + todayStr),
      api(`/api/reports?from=${todayStr}&to=${todayStr}`),
      api('/api/attendance/today')
    ]);

    const pending = (todos || []).filter(t => !t.completed);
    const sorted = _aiPrioritize(pending);
    const myRps = (rps || []).filter(r => r.author_id === currentUser.id);
    const checkedIn = atd && atd.check_in;
    const nowMin = h * 60 + now.getMinutes();

    const nextEvt = (evts || []).find(e => {
      if (!e.event_time) return false;
      const [eh, em] = e.event_time.split(':').map(Number);
      return eh * 60 + em > nowMin && eh * 60 + em - nowMin <= 30;
    });

    let action = '', icon = '', suggests = [];

    if (!checkedIn && h >= 7 && h < 11) {
      action = '출근 체크부터 하세요!';
      icon = '⏰';
      suggests = ['출근해', '할 일 확인'];
    } else if (nextEvt) {
      const [eh, em] = nextEvt.event_time.split(':').map(Number);
      const diff = eh * 60 + em - nowMin;
      action = diff + '분 후 "' + nextEvt.title + '" 일정이 있어요. 준비하세요!';
      icon = '📅';
      suggests = ['오늘 일정', '할 일 확인'];
    } else if (sorted.length > 0 && sorted[0].due_date) {
      const diff = Math.ceil((new Date(sorted[0].due_date.split('T')[0]) - new Date(todayStr)) / 86400000);
      if (diff <= 1) {
        action = '"' + sorted[0].title + '" — ' + (diff <= 0 ? '마감 지났어요!' : '내일 마감!') + ' 지금 바로 시작하세요!';
        icon = '🚨';
        suggests = ['마감 위험', '1번 완료'];
      } else {
        action = '"' + sorted[0].title + '" 부터 시작하는 게 좋겠어요. (' + diff + '일 남음)';
        icon = '✅';
        suggests = ['우선순위', '1번 완료'];
      }
    } else if (sorted.length > 0) {
      action = '"' + sorted[0].title + '" 부터 해볼까요?';
      icon = '✅';
      suggests = ['우선순위', '1번 완료'];
    } else if (myRps.length === 0 && h >= 14) {
      action = '할 일은 다 끝났어요! 업무일지 한 건 작성하면 완벽한 하루!';
      icon = '📝';
      suggests = ['보고서 마법사', '오늘 일지'];
    } else if (h >= 17) {
      action = '오늘 할 일 다 끝! 일지 정리하고 퇴근 준비하세요!';
      icon = '🌙';
      suggests = ['오늘 일지', '퇴근해'];
    } else {
      action = '특별히 급한 건 없어요. 여유롭게 진행하세요!';
      icon = '☕';
      suggests = ['추천해줘', '오늘 일정'];
    }

    return { reply: '👉 지금 이거 하세요!\n━━━━━━━━━━━━━━\n\n' + icon + ' ' + action, suggests };
  } catch(_) { return { reply: '추천을 생성하지 못했어요.', suggests: [] }; }
}

// ─── [11] AI 인격 진화 엔진 ───

function _aiPersonality() {
  const lvl = _aiGetLevel();
  const lv = lvl.lv;
  const _rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  const stages = {
    1: { tone: '합니다', suffix: _rnd(['습니다.', '겠습니다.', '드리겠습니다.', '합니다! 😅']), prefix: '혹시... ', filler: '' },
    2: { tone: '해요', suffix: _rnd(['요!', '요 😊', '드릴게요!', '해요~']), prefix: '', filler: _rnd(['참고로,', '']) },
    3: { tone: '하지', suffix: _rnd(['요!', '죠!', '요~ 😊', '잖아요!']), prefix: '', filler: _rnd(['참고로', '덧붙이면', '']) },
    4: { tone: '해', suffix: _rnd(['요 😎', '! ✨', '~ 💡', '죠!']), prefix: '', filler: _rnd(['참고로', '덧붙이면', '팁 하나!']) },
    5: { tone: 'ㅋㅋ', suffix: _rnd(['ㅋ 😎', '! 🔥', '~ ㅋㅋ', '잖아 ㅋ']), prefix: '', filler: _rnd(['근데요,', '아 그리고!', '꿀팁인데,', '야 근데']) },
  };
  const s = stages[lv] || stages[1];
  return { level: lv, tone: s.tone, suffix: s.suffix, prefix: s.prefix, filler: s.filler };
}

let _aiTMICounter = 0;
const _aiTMIs = {
  general: [
    '근데 알아요? 사람은 하루에 평균 6만 가지 생각을 한대요! 🧠',
    '재밌는 사실: 꿀은 절대 상하지 않아요. 3000년 된 꿀도 먹을 수 있대요! 🍯',
    'TMI인데, 옥토퍼스(문어)는 심장이 3개래요! 🐙',
    '알고 계셨어요? 바나나는 사실 열매가 아니라 베리(berry)래요! 🍌',
    '재밌는 사실: 하품은 전염되는데, 강아지한테도 전염된대요! 🐕',
    'TMI! 지구에서 가장 긴 지명은 85글자래요. 태국에 있대요 🌏',
    '알고 계셨어요? 인간의 뼈는 콘크리트보다 4배 강해요! 💪',
    '재밌는 사실: 우주에서는 울 수 없대요. 눈물이 떠다녀서! 🚀',
    'TMI! 돌고래는 한쪽 눈만 감고 자요. 뇌의 반만 쉬는 거래요! 🐬',
    '알고 계셨어요? 웃음은 칼로리를 소비해요! 15분 웃으면 40칼로리! 😂',
  ],
  work: [
    '직장 꿀팁: 포모도로 기법 — 25분 집중 + 5분 휴식이 효율적이래요! 🍅',
    '알고 계셨어요? 멀티태스킹하면 생산성이 40% 떨어진대요! 한 가지씩 해요! 🎯',
    '직장 생존팁: 메일 제목에 마감일을 넣으면 회신율이 2배래요! 📧',
    '재밌는 통계: 월요일 오전이 1주일 중 가장 생산성 낮은 시간이래요 😴',
    '꿀팁: 어려운 일은 오전에, 반복 업무는 오후에 하면 효율적! ⚡',
    '직장 TMI: 회의 시간을 25분이나 50분으로 잡으면 5분 여유가 생겨요! ⏰',
  ],
  season: {
    spring: ['봄이네요! 벚꽃 구경 가셨어요? 🌸', '봄바람이 좋은 계절! 점심에 산책 어때요? 🌿'],
    summer: ['더운 날씨에 수분 보충 잘 하세요! 💧', '에어컨 너무 세면 감기 조심! 🌡️'],
    fall: ['가을이라 하늘이 예쁘죠? 🍂', '독서하기 좋은 계절이에요! 📚'],
    winter: ['따뜻하게 입으셨어요? 🧣', '따뜻한 음료 한 잔 추천! ☕'],
  }
};

function _aiGetSeason() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'fall';
  return 'winter';
}

function _aiSituationalComment() {
  const now = new Date();
  const h = now.getHours();
  const day = now.getDay();
  const date = now.getDate();
  const month = now.getMonth() + 1;

  if (day === 1 && h < 12) {
    const monMsgs = ['월요일이네요... 이겨냅시다! 💪', '월요병은 커피로! ☕ 화이팅!', '한 주의 시작! 가볍게 워밍업부터! 🏃'];
    return monMsgs[Math.floor(Math.random() * monMsgs.length)];
  }
  if (day === 3) return '수요일! 반환점 돌았어요! 🎯';
  if (day === 5 && h >= 14) {
    const friMsgs = ['불금이다!! 🎉', '금요일 오후~ 주말이 코앞! 🌟', '조금만 더 힘내면 주말! 🎊'];
    return friMsgs[Math.floor(Math.random() * friMsgs.length)];
  }
  if (day === 0 || day === 6) return '주말인데 일하시는 거예요? 대단해요! 💪';

  if (h >= 21) return '이 시간에도 일하시다니... 건강 챙기세요! 🌙';
  if (h >= 19) return '야근이시네요... 무리하지 마세요! 💪';
  if (h === 11 && now.getMinutes() >= 30) return '곧 점심시간! 뭐 먹을지 고민되시죠? 🍽️';
  if (h === 14) return '점심 후 졸린 시간! 커피 한 잔 어때요? ☕';

  if (date === 1) return '새로운 달의 시작! 이번 달도 화이팅! 📅';
  if (date >= 28) return '월말이네요! 마무리 잘 하세요! 📋';

  return null;
}

function _aiTMI() {
  _aiTMICounter++;
  const h = new Date().getHours();
  const prof = _aiPersonalProfile();
  const tmiSetting = prof.tmiLevel || 'normal';
  if (tmiSetting === 'off') return null;
  const interval = (tmiSetting === 'high') ? 3 : (h >= 9 && h < 18) ? 8 : 4;
  if (_aiTMICounter % interval !== 0) return null;
  const season = _aiGetSeason();
  const pool = [];

  pool.push(..._aiTMIs.general);
  pool.push(..._aiTMIs.work);
  if (_aiTMIs.season[season]) pool.push(..._aiTMIs.season[season]);

  if ((prof.hobbies || []).some(h => /운동|헬스|달리기/.test(h))) pool.push('운동 좋아하시잖아요! 점심에 가볍게 스트레칭이라도 해보세요! 🏋️');
  if ((prof.hobbies || []).some(h => /독서|책/.test(h))) pool.push('책 좋아하시잖아요! 요즘 뭐 읽으세요? 📖');
  if ((prof.hobbies || []).some(h => /게임/.test(h))) pool.push('게임 좋아하시잖아요! 퇴근 후 한 판 각이네요! 🎮');
  if ((prof.likes || []).some(l => /커피/.test(l))) pool.push('커피 좋아하시잖아요! 오늘 몇 잔째예요? ☕');

  return pool[Math.floor(Math.random() * pool.length)];
}

let _aiUserStyleCache = null;

function _aiMirrorStyle(input) {
  if (!_aiUserStyleCache) {
    _aiUserStyleCache = { kkCount: 0, emojiCount: 0, banmalCount: 0, jonmalCount: 0, totalMsg: 0 };
    try {
      const saved = localStorage.getItem('aiMirror_' + (currentUser ? currentUser.id : 'x'));
      if (saved) _aiUserStyleCache = JSON.parse(saved);
    } catch(_) {}
  }
  const c = _aiUserStyleCache;
  c.totalMsg++;
  if (/ㅋ{2,}|ㅎ{2,}/.test(input)) c.kkCount++;
  if (/[😊😄🎉❤️💕🔥😂🤣😆👍💪✨🎯😎]/.test(input)) c.emojiCount++;
  if (/야$|어$|지$|거든$|잖아$|냐$|해$|봐$|줘$/.test(input.trim())) c.banmalCount++;
  if (/요$|니다$|세요$|까요$/.test(input.trim())) c.jonmalCount++;

  try { localStorage.setItem('aiMirror_' + (currentUser ? currentUser.id : 'x'), JSON.stringify(c)); } catch(_) {}

  return {
    useKK: c.totalMsg > 3 && c.kkCount / c.totalMsg > 0.3,
    useEmoji: c.totalMsg > 3 && c.emojiCount / c.totalMsg > 0.3,
    useBanmal: c.totalMsg > 5 && c.banmalCount > c.jonmalCount * 2,
  };
}

function _aiAddPersonality(reply) {
  const pers = _aiPersonality();
  const tmi = _aiTMI();
  const sitComment = _aiSituationalComment();
  const mirror = _aiUserStyleCache || { useKK: false, useEmoji: false, useBanmal: false };

  let result = reply;

  if (tmi && result.length < 200) {
    result += '\n\n💡 ' + tmi;
  }

  if (pers.level >= 4 && Math.random() < 0.2 && result.length < 150) {
    result += '\n\n' + pers.filler + ' ' + (sitComment || '오늘도 파이팅이에요!');
  }

  if (mirror.useKK && Math.random() < 0.3 && !/ㅋ/.test(result)) {
    result = result.replace(/(!|요!)/, '$1 ㅋㅋ');
  }

  return result;
}

// ─── [10] 심연의 눈 — Deep Insight Engine ───

function _aiDeepProfile() {
  const prof = _aiPersonalProfile();
  const logs = _aiJournalHistory();
  const mem = _aiMemory();
  const patterns = _aiAnalyzePatterns();

  const moodHistory = [];
  const chatLog = mem.chatLog || [];
  const recent30 = logs.slice(-30);

  let energyPeak = 'unknown', energyLow = 'unknown';
  if (patterns && patterns.dayStats) {
    const workDays = patterns.dayStats.filter((d, i) => i >= 1 && i <= 5 && d.count > 0);
    if (workDays.length > 0) {
      energyPeak = ['일','월','화','수','목','금','토'][workDays.reduce((a, b) => a.avgScore > b.avgScore ? a : b).day] + '요일';
      energyLow = ['일','월','화','수','목','금','토'][workDays.reduce((a, b) => a.avgScore < b.avgScore ? a : b).day] + '요일';
    }
  }

  let workStyle = '분석 중';
  if (recent30.length >= 5) {
    const avgReports = recent30.reduce((s, j) => s + j.reports, 0) / recent30.length;
    const avgDone = recent30.reduce((s, j) => s + j.todoDone, 0) / recent30.length;
    const scoreVariance = recent30.reduce((s, j) => s + Math.pow(j.score - recent30.reduce((a, b) => a + b.score, 0) / recent30.length, 2), 0) / recent30.length;

    if (avgReports >= 1.5 && avgDone >= 3) workStyle = '🦁 완벽주의자';
    else if (avgDone >= 3 && avgReports < 1) workStyle = '⚡ 속전속결형';
    else if (avgReports >= 1 && scoreVariance < 200) workStyle = '📐 계획형';
    else if (scoreVariance >= 400) workStyle = '🎲 즉흥형';
    else if (avgReports >= 1) workStyle = '📝 꼼꼼형';
    else workStyle = '🌊 마이페이스형';
  }

  const chatFreq = chatLog.length > 0 ? Math.round(chatLog.length / Math.max(1, logs.length)) : 0;
  let personality = '탐색 중';
  if (chatFreq >= 5) personality = '수다쟁이 🗣️';
  else if (chatFreq >= 2) personality = '적극적 💬';
  else if (chatFreq >= 1) personality = '효율적 🎯';
  else personality = '조용한 관찰자 🔍';

  const stressPatterns = [];
  const moodFacts = Object.entries(mem.facts || {}).filter(([k]) => k.startsWith('mood_'));
  const badDays = moodFacts.filter(([, v]) => v === 'bad');
  if (badDays.length > 3) stressPatterns.push('최근 힘든 날이 잦아요');
  if (recent30.length >= 5) {
    const lowDays = recent30.filter(j => j.score < 30);
    if (lowDays.length >= 3) stressPatterns.push('생산성 저하 구간이 감지됐어요');
  }

  const missingInfo = [];
  if (!prof.mbti) missingInfo.push('mbti');
  if (!prof.birthday) missingInfo.push('birthday');
  if (!(prof.hobbies || []).length) missingInfo.push('hobbies');
  if (!(prof.likes || []).length) missingInfo.push('likes');
  if (!prof.stressRelief) missingInfo.push('stressRelief');
  if (!prof.goal) missingInfo.push('goal');
  if (!prof.lunchPrefer) missingInfo.push('lunchPrefer');
  if (!prof.workHours) missingInfo.push('workHours');

  return {
    workStyle,
    personality,
    energyPeak,
    energyLow,
    stressPatterns,
    missingInfo,
    chatFreq,
    mbti: prof.mbti,
    nickname: prof.nickname,
    hobbies: prof.hobbies || [],
    likes: prof.likes || [],
    dislikes: prof.dislikes || [],
    totalDays: logs.length,
    avgScore: recent30.length > 0 ? Math.round(recent30.reduce((s, j) => s + j.score, 0) / recent30.length) : 0
  };
}

function _aiReadBetweenLines(input, emotion) {
  const t = input.toLowerCase().trim();
  const h = new Date().getHours();
  const dp = _aiDeepProfile();

  const intents = [];

  if (/힘들|지치|피곤|스트레스|죽겠|미치겠|돌겠/.test(t)) {
    if (h >= 17) intents.push({ type: 'wantGoHome', conf: 0.8, msg: '퇴근하고 싶은 마음이 느껴져요' });
    if (dp.avgScore < 40) intents.push({ type: 'burnoutRisk', conf: 0.7, msg: '최근 번아웃 위험 신호가 있어요' });
    intents.push({ type: 'needComfort', conf: 0.9, msg: '위로가 필요해 보여요' });
  }

  if (/심심|뭐해|할거없|재미없/.test(t)) {
    if (h >= 11 && h < 14) intents.push({ type: 'lunchBored', conf: 0.6, msg: '점심시간에 할 거 없나 보네요' });
    intents.push({ type: 'wantFun', conf: 0.7, msg: '재미있는 걸 찾고 있어요' });
  }

  if (/어떡하|어떻게|모르겠|막막|답\s*없/.test(t)) {
    intents.push({ type: 'needGuidance', conf: 0.85, msg: '방향을 찾고 있어요' });
  }

  if (/잘했|괜찮|나\s*잘\s*하고|잘\s*하고\s*있/.test(t)) {
    intents.push({ type: 'needValidation', conf: 0.8, msg: '인정받고 싶은 마음이 있어요' });
  }

  if (/바빠|시간\s*없|급해/.test(t) && emotion && emotion.delta < 0) {
    intents.push({ type: 'overwhelmed', conf: 0.75, msg: '업무가 과부하 상태일 수 있어요' });
  }

  if (/ㅋ{3,}|ㅎ{3,}|😂|🤣/.test(t) && emotion && emotion.delta > 0) {
    intents.push({ type: 'goodMood', conf: 0.7, msg: '기분이 좋아 보여요' });
  }

  if (/뭐\s*먹|배고|밥/.test(t) && !/추천|검색/.test(t)) {
    intents.push({ type: 'hungry', conf: 0.6, msg: '배고프신가 봐요' });
  }

  if (/퇴근|집\s*가|끝|마무리/.test(t)) {
    intents.push({ type: 'wrapUp', conf: 0.8, msg: '하루를 마무리하려 해요' });
  }

  const _storyVerbsR = /갔어|했어|왔어|봤어|마시|먹었|갔다|다녀|하고\s*왔|갔다가|왔는데|했는데|있었|됐어|받았|받고|올라가/;
  const _stCnt = (t.match(_storyVerbsR) || []).length;
  if (t.length >= 40 && _stCnt >= 2) {
    intents.push({ type: 'sharingStory', conf: 0.85, msg: '하루 이야기를 들려주고 있어요' });
  }

  return intents.sort((a, b) => b.conf - a.conf);
}

function _aiInferIntent(input, emotion) {
  const intents = _aiReadBetweenLines(input, emotion);
  if (intents.length === 0) return null;

  const top = intents[0];
  top._origInput = input;
  const prof = _aiPersonalProfile();
  const name = prof.nickname || (currentUser ? currentUser.name : '');
  const dp = _aiDeepProfile();
  const _style = (_aiMemory().facts && _aiMemory().facts.chatStyle) || 'formal';

  const responses = {
    needComfort: () => {
      let r = '💙 ' + name + '님, 많이 힘드시죠?\n\n';
      r += '당신의 감정을 읽었어요. 지금 기분 점수는 ' + _aiMoodScore + '점이에요.\n';
      if (dp.stressPatterns.length > 0) r += '📊 ' + dp.stressPatterns[0] + '\n';
      if (prof.stressRelief) r += '\n💡 "' + prof.stressRelief + '" 어때요? 전에 이게 좋다고 하셨잖아요!\n';
      else r += '\n💡 스트레스 해소법을 알려주시면 힘들 때 추천해드릴게요!\n';
      r += '\n잠깐 쉬어가도 괜찮아요. 제가 항상 곁에 있을게요 🤗';
      return { reply: r, suggests: ['오늘 일지', '농담 해줘', '추천해줘'] };
    },
    burnoutRisk: () => {
      let r = '☕ ' + name + '님, 잠깐 이야기 좀 할까요?\n━━━━━━━━━━━━━━\n\n';
      r += '요즘 좀 많이 달리신 것 같아서요...\n\n';
      if (dp.avgScore < 40) r += '최근 하루하루가 좀 빡빡했죠? 그럴 수 있어요.\n';
      if (dp.stressPatterns.length > 0) r += '💭 ' + dp.stressPatterns[0] + '\n';
      r += '\n혹시 이런 건 어때요?\n• 오늘은 급한 것만 딱 처리하고 일찍 쉬기\n• 할 일 정리해서 머릿속 비우기\n• 내일은 좀 여유롭게 시작하기\n\n무리하지 마세요. 제가 옆에서 도울게요 🤗';
      return { reply: r, suggests: ['우선순위', '오늘 일지', '퇴근해'] };
    },
    wantGoHome: () => ({
      reply: '🌙 퇴근하고 싶으시죠? 다 알아요!\n\n' + (dp.avgScore >= 50 ? '오늘 생산성 ' + dp.avgScore + '점이면 충분히 잘하셨어요!\n' : '') + '남은 일만 빠르게 정리하고 퇴근하세요!\n\n마무리할 것들을 확인해드릴까요?',
      suggests: ['오늘 일지', '퇴근해', '남은 할 일']
    }),
    needGuidance: () => ({
      reply: '🧭 길을 찾고 계시는군요.\n\n제가 도와드릴게요! 지금 상황을 정리해볼까요?\n\n• 업무 관련이면 → "추천해줘" 또는 "우선순위"\n• 기분이 복잡하면 → 편하게 얘기해주세요\n• 뭔가 결정해야 하면 → 구체적으로 말씀해주세요\n\n어떤 것이든 함께 풀어나가요!',
      suggests: ['추천해줘', '우선순위', '오늘 브리핑']
    }),
    needValidation: () => {
      let r = '👏 ' + name + '님, 당연히 잘하고 있죠!\n\n';
      if (dp.totalDays > 0) r += '📊 지금까지 ' + dp.totalDays + '일간의 기록이 증명해요!\n';
      r += '업무 스타일: ' + dp.workStyle + '\n';
      if (dp.avgScore >= 50) r += '최근 평균 생산성 ' + dp.avgScore + '점이면 대단한 거예요!\n';
      r += '\n자신감 가지세요. 저는 늘 당신 편이에요! 💪';
      return { reply: r, suggests: ['패턴 분석', '오늘 일지', '이번주 전망'] };
    },
    overwhelmed: () => ({
      reply: '😮‍💨 많이 바쁘시죠?\n\n일이 겹칠 때는 정리가 먼저예요!\n\n1. 급한 것부터 정렬해드릴까요?\n2. 오늘 할 것만 추려드릴까요?\n3. 미룰 수 있는 건 내일로 넘겨요\n\n한 번에 하나씩, 차근차근 가요!',
      suggests: ['우선순위', '마감 위험', '추천해줘']
    }),
    wantFun: () => {
      const funs = ['농담 해줘', '드라마 명대사', '명언', '오늘 운세'];
      return { reply: '😄 심심하시구나! 제가 재미있게 해드릴게요~\n\n뭐가 좋을까요?', suggests: funs.sort(() => Math.random() - 0.5).slice(0, 3) };
    },
    lunchBored: () => ({
      reply: '🍜 점심시간이네요! ' + (prof.likes && prof.likes.length > 0 ? prof.likes[0] + ' 좋아하시잖아요! 오늘 그거 어때요?' : '뭐 먹을지 추천해드릴까요?'),
      suggests: ['점심 추천', '농담 해줘', '오늘 일정']
    }),
    goodMood: () => ({
      reply: '😊 기분 좋아 보여서 저도 기분이 좋아요!\n이 에너지로 오늘 남은 일도 쭉쭉 해치우세요! 🚀',
      suggests: ['할 일 확인', '추천해줘', '오늘 일정']
    }),
    wrapUp: () => ({
      reply: '🌆 하루를 마무리하시는군요!\n\n오늘 일지를 정리해드릴까요? 남은 할 일이 있는지도 확인해볼게요.',
      suggests: ['오늘 일지', '남은 할 일', '퇴근해']
    }),
    hungry: () => ({
      reply: '🍽️ 배고프신 거 다 알아요~\n' + (prof.likes && prof.likes.length > 0 ? '혹시 오늘도 ' + prof.likes[Math.floor(Math.random() * prof.likes.length)] + ' 어때요? 😋' : '점심 메뉴 추천해드릴까요?'),
      suggests: ['점심 추천', '오늘 일정']
    }),
    sharingStory: () => {
      const input = top._origInput || '';
      const hasLaugh = /ㅋ{2,}|ㅎ{2,}|😂|🤣/.test(input);
      const hasSatisfy = /좋았|좋은|만족|괜찮|깔끔|착착|바로바로/.test(input);
      let r = '📖 오~ 이야기 들려주시는 거예요? 좋아요!\n\n';
      r += '자세히 말씀해주시니 같이 경험하는 것 같아요 😊\n';
      if (hasLaugh) r += '듣는 저까지 웃음이 나와요 ㅋㅋ\n';
      if (hasSatisfy) r += '일이 잘 풀리셨나보네요! 듣기 좋아요~\n';
      r += '\n더 들려주세요! 오늘 또 뭐 하셨어요? 🥰';
      return { reply: r, learn: { lastMood: 'good' }, suggests: ['오늘 일지', '추억 보여줘', '오늘 일정'] };
    }
  };

  const handler = responses[top.type];
  if (handler) return handler();
  return null;
}

const _aiGuidedQuestions = [
  { key: 'mbti', q: '혹시 MBTI 알아요? 알면 더 맞춤 대화를 할 수 있어요!', check: p => !p.mbti },
  { key: 'stressRelief', q: '스트레스 받을 때 보통 뭐 하면서 풀어요?', check: p => !p.stressRelief },
  { key: 'goal', q: '요즘 목표나 이루고 싶은 게 있어요?', check: p => !p.goal },
  { key: 'hobbies', q: '취미가 뭐예요? 알면 쉬는 시간에 추천해드릴 수 있어요!', check: p => !(p.hobbies || []).length },
  { key: 'lunchPrefer', q: '점심은 보통 뭐 먹어요? 한식? 양식? 뭐든?', check: p => !p.lunchPrefer },
  { key: 'workHours', q: '보통 몇 시에 출근하고 몇 시에 퇴근해요?', check: p => !p.workHours },
  { key: 'birthday', q: '생일은 언제예요? 축하해드리고 싶어서! 🎂', check: p => !p.birthday },
  { key: 'likes', q: '요즘 빠져있는 거 있어요? 뭐든 좋아요!', check: p => !(p.likes || []).length },
];

let _aiGuidedCooldown = 0;

function _aiShouldAsk() {
  const prof = _aiPersonalProfile();
  const mem = _aiMemory();
  const chatCount = mem.chatCount || 0;

  if (chatCount < 5) return null;
  if (_aiGuidedCooldown > 0) { _aiGuidedCooldown--; return null; }

  const pending = _aiGuidedQuestions.filter(q => q.check(prof));
  if (pending.length === 0) return null;

  if (chatCount % 8 !== 0) return null;

  _aiGuidedCooldown = 5;
  const pick = pending[Math.floor(Math.random() * pending.length)];
  return pick;
}

function _aiHandleGuidedAnswer(key, input) {
  const prof = _aiPersonalProfile();
  const t = input.trim();

  if (key === 'stressRelief') { _aiProfileSet('stressRelief', t); return '좋아요! 힘들 때 "' + t + '" 추천해드릴게요! 기억해둘게요 💙'; }
  if (key === 'goal') { _aiProfileSet('goal', t); return '멋진 목표네요! "' + t + '" — 응원할게요! 🎯'; }
  if (key === 'lunchPrefer') { _aiProfileSet('lunchPrefer', t); return t + ' 좋아하시는구나! 점심 추천할 때 참고할게요 🍽️'; }
  if (key === 'workHours') { _aiProfileSet('workHours', t); return '출퇴근 시간 기억해둘게요! 맞춤 알림 드릴게요 ⏰'; }
  return null;
}

function _aiBurnoutCheck() {
  const logs = _aiJournalHistory().slice(-14);
  if (logs.length < 5) return null;

  const avgScore = Math.round(logs.reduce((s, j) => s + j.score, 0) / logs.length);
  const lowDays = logs.filter(j => j.score < 25).length;
  const trend = logs.slice(-7);
  const trendAvg = trend.length > 0 ? Math.round(trend.reduce((s, j) => s + j.score, 0) / trend.length) : 50;
  const declining = trendAvg < avgScore - 15;

  let risk = 0;
  if (avgScore < 30) risk += 40;
  else if (avgScore < 50) risk += 20;
  if (lowDays >= 4) risk += 30;
  else if (lowDays >= 2) risk += 15;
  if (declining) risk += 20;
  if (_aiMoodScore < 30) risk += 20;

  risk = Math.min(100, risk);

  if (risk < 30) return null;

  let level, icon, msg;
  if (risk >= 70) { level = '위험'; icon = '☕'; msg = '요즘 좀 많이 달리신 것 같아요. 오늘은 일찍 쉬어보는 건 어때요?'; }
  else if (risk >= 50) { level = '주의'; icon = '🌿'; msg = '최근 일정이 빡빡했죠? 잠깐 숨 돌리는 시간도 괜찮아요~'; }
  else { level = '관찰'; icon = '💭'; msg = '슬슬 충전이 필요할 것 같은 느낌이에요. 가볍게 쉬어가세요!'; }

  return { risk, level, icon, msg, avgScore, lowDays, declining };
}

function _aiProactiveChat() {
  const h = new Date().getHours();
  const dp = _aiDeepProfile();
  const prof = _aiPersonalProfile();
  const name = prof.nickname || (currentUser ? currentUser.name : '');
  const burnout = _aiBurnoutCheck();

  const msgs = [];

  if (burnout && burnout.risk >= 50) {
    msgs.push(burnout.icon + ' ' + name + '님, ' + burnout.msg);
  }

  const guided = _aiShouldAsk();
  if (guided) {
    msgs.push('💬 궁금한 게 있어요! ' + guided.q);
    _aiMemory()._pendingGuided = guided.key;
    _aiMemorySave(_aiMemory());
  }

  if (dp.workStyle !== '분석 중' && dp.totalDays >= 7 && !_aiMemory()._shownWorkStyle) {
    msgs.push('🧠 ' + name + '님의 업무 스타일을 파악했어요: ' + dp.workStyle);
    const mem = _aiMemory();
    mem._shownWorkStyle = true;
    _aiMemorySave(mem);
  }

  return msgs;
}

async function aiSecretaryCheck() {
  if (!currentUser || currentUser.isAdmin) return;
  const now = new Date();
  const h = now.getHours();
  const today = now.toISOString().split('T')[0];
  const nowMin = h * 60 + now.getMinutes();

  // 1. 일정 알람 — 10분 전 알림
  try {
    const events = await api('/api/calendar-events?date=' + today);
    if (events && events.length > 0) {
      for (const ev of events) {
        if (!ev.event_time) continue;
        const [eh, em] = ev.event_time.split(':').map(Number);
        const evMin = eh * 60 + em;
        const diff = evMin - nowMin;
        const alarmKey = today + '_' + ev.id;
        if (diff > 0 && diff <= 10 && !_alarmNotified[alarmKey]) {
          _alarmNotified[alarmKey] = true;
          _showSecretaryAlert('schedule', '📅 일정 알림', `${diff}분 후 "${ev.title}" 일정이 있어요!\n시간: ${ev.event_time}`, '확인');
        }
      }
    }
  } catch(_) {}

  // 2. 기한 지난 할 일 알림 (하루 1번, 오전 9~10시)
  if (h >= 9 && h < 10 && !_alarmNotified[today + '_overdue']) {
    try {
      const todos = await api('/api/todos');
      const overdue = (todos || []).filter(t => !t.completed && t.due_date && t.due_date.split('T')[0] < today);
      if (overdue.length > 0) {
        _alarmNotified[today + '_overdue'] = true;
        const names = overdue.slice(0, 3).map(t => '• ' + t.title).join('\n');
        const moreText = overdue.length > 3 ? '\n외 ' + (overdue.length - 3) + '건...' : '';
        _showSecretaryAlert('overdue', '⚠️ 기한 지난 할 일', `${overdue.length}건의 할 일이 기한을 넘겼어요:\n\n${names}${moreText}\n\n확인하고 처리해주세요!`, '할 일 보기', () => navigate('todos'));
      }
    } catch(_) {}
  }

  // 2.3 AI 예측 알림 (오전 9~10시, 하루 1번)
  if (h >= 9 && h < 10 && !_alarmNotified[today + '_predict']) {
    try {
      await _aiDailyJournal();
      const patterns = _aiAnalyzePatterns();
      if (patterns) {
        const stat = patterns.dayStats[now.getDay()];
        if (stat && stat.count >= 2 && stat.avgReports >= 1) {
          _alarmNotified[today + '_predict'] = true;
          _showSecretaryAlert('predict', '🔮 AI 예측', '오늘은 보고서를 쓸 확률이 높은 ' + ['일','월','화','수','목','금','토'][now.getDay()] + '요일이에요!\n(평균 ' + stat.avgReports + '건)\n\n미리 준비해보세요!', 'AI 예측 보기', () => { openAiChat(); setTimeout(() => _aiChatAddBot(_aiPredictToday()), 500); });
        }
      }
    } catch(_) {}
  }

  // 2.4 마감 임박 할일 자동 경고 (매 체크, 하루 1번)
  if (!_alarmNotified[today + '_deadline']) {
    try {
      const todos = await api('/api/todos');
      const urgent = (todos || []).filter(t => {
        if (t.completed || !t.due_date) return false;
        const diff = Math.ceil((new Date(t.due_date.split('T')[0]) - new Date(today)) / 86400000);
        return diff >= 0 && diff <= 1;
      });
      if (urgent.length > 0) {
        _alarmNotified[today + '_deadline'] = true;
        const names = urgent.slice(0, 3).map(t => '• ' + t.title).join('\n');
        _showSecretaryAlert('deadline', '🚨 마감 임박!', urgent.length + '건의 할 일이 오늘/내일 마감이에요!\n\n' + names + '\n\n서둘러 처리해주세요!', '마감 분석', () => { openAiChat(); setTimeout(async () => _aiChatAddBot(await _aiDeadlineRisk()), 500); });
      }
    } catch(_) {}
  }

  // 2.5 주간 자동 리포트 (월요일 오전 9~10시)
  if (new Date().getDay() === 1 && h >= 9 && h < 10 && !_alarmNotified[today + '_weekly']) {
    _alarmNotified[today + '_weekly'] = true;
    _aiWeeklyReport().then(report => {
      if (report) _showSecretaryAlert('weekly', '📊 주간 AI 리포트', '지난주 업무 분석이 준비됐어요!\nAI 비서를 열어 확인하세요.', 'AI 비서 열기', () => { openAiChat(); setTimeout(() => _aiChatAddBot(report), 500); });
    });
  }

  // 2.7 퇴근 전 자동 일지 (17~18시, 하루 1번)
  if (h >= 17 && h < 18 && !_alarmNotified[today + '_journal']) {
    _alarmNotified[today + '_journal'] = true;
    _aiDailyJournal().then(j => {
      if (j && j.score > 0) {
        const msg = '오늘 생산성 ' + j.score + '점!\n"' + j.oneLine + '"\n\nAI 비서에서 상세 일지를 확인하세요.';
        _showSecretaryAlert('journal', '📋 오늘의 일지', msg, '일지 보기', () => { openAiChat(); setTimeout(() => _aiChatAddBot(_aiFormatJournal(j)), 500); });
      }
    });
  }

  // 3. 보고서 미작성 알림 (16시 이후, 하루 1번)
  if (h >= 16 && !_alarmNotified[today + '_noreport']) {
    try {
      const reports = await api(`/api/reports?from=${today}&to=${today}`);
      const myReports = (reports || []).filter(r => r.author_id === currentUser.id);
      if (myReports.length === 0) {
        _alarmNotified[today + '_noreport'] = true;
        _showSecretaryAlert('report', '📝 보고서 알림', '오늘 아직 업무일지를 작성하지 않으셨어요.\n퇴근 전에 한 건 작성해보시겠어요?', '지금 작성', () => openNewReport());
      }
    } catch(_) {}
  }

  // 4. 오늘 일정이 아예 없는 경우 알림 (10시, 하루 1번)
  if (h >= 10 && h < 11 && !_alarmNotified[today + '_noevt']) {
    try {
      const events = await api('/api/calendar-events?date=' + today);
      if (!events || events.length === 0) {
        _alarmNotified[today + '_noevt'] = true;
        _showSecretaryAlert('empty', '🗓️ 일정 없음', '오늘 등록된 일정이 없어요.\n업무 계획을 등록하시면 비서가 알림을 드릴게요!', '일정 등록', () => navigate('calendar'));
      }
    } catch(_) {}
  }

  // 5. 미퇴근 알림 (19시 이후, 하루 1번)
  if (h >= 19 && !_alarmNotified[today + '_checkout']) {
    try {
      const atd = await api('/api/attendance/today');
      if (atd && atd.check_in && !atd.check_out) {
        _alarmNotified[today + '_checkout'] = true;
        _showSecretaryAlert('checkout', '🌙 퇴근 알림', '아직 퇴근 처리가 안 되어 있어요.\n퇴근 처리하시겠어요?', '퇴근하기', () => doCheckOut());
      }
    } catch(_) {}
  }
}

function _showSecretaryAlert(type, title, message, btnText, btnCallback) {
  if (document.getElementById('secAlert_' + type)) return;
  const overlay = document.createElement('div');
  overlay.id = 'secAlert_' + type;
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9996; display:flex; align-items:center; justify-content:center; animation:fadeIn .3s;';
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:20px; padding:24px; width:90%; max-width:340px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.3);">
      <div style="width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#7c3aed,#3b82f6); display:flex; align-items:center; justify-content:center; font-size:24px; margin:0 auto 12px; color:#fff;">&#129302;</div>
      <p style="font-size:11px; color:#7c3aed; font-weight:600; letter-spacing:1px; margin-bottom:4px;">AI 업무비서</p>
      <p style="font-size:17px; font-weight:700; margin-bottom:8px; color:#1a1a2e;">${title}</p>
      <p style="font-size:14px; color:#555; line-height:1.6; margin-bottom:20px; white-space:pre-line;">${message}</p>
      <div style="display:flex; gap:8px;">
        <button onclick="this.closest('[id^=secAlert]').remove()" style="flex:1; padding:12px; border-radius:12px; border:1px solid #e5e7eb; background:#fff; color:#555; font-size:14px; font-weight:600; cursor:pointer;">나중에</button>
        <button id="secAlertBtn_${type}" style="flex:1; padding:12px; border-radius:12px; border:none; background:linear-gradient(135deg,#7c3aed,#3b82f6); color:#fff; font-size:14px; font-weight:700; cursor:pointer;">${btnText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // TTS 음성 안내
  if (window.speechSynthesis) {
    const plainMsg = message.replace(/\n/g, '. ').replace(/[•⚠️📅📝🌙🗓️]/g, '');
    const utter = new SpeechSynthesisUtterance(plainMsg.substring(0, 80));
    utter.lang = 'ko-KR'; utter.rate = 1.05; utter.pitch = 1.1;
    speechSynthesis.cancel();
    setTimeout(() => speechSynthesis.speak(utter), 300);
  }
  const actionBtn = document.getElementById('secAlertBtn_' + type);
  actionBtn.addEventListener('click', () => {
    if (window.speechSynthesis) speechSynthesis.cancel();
    overlay.remove();
    if (btnCallback) btnCallback();
  });
}

setInterval(aiSecretaryCheck, 60000);

// 초기화 — 서버 연결 상태 표시 + 서버 준비 확인
(async () => {
  const indicator = document.createElement('div');
  indicator.id = 'serverStatus';
  indicator.style.cssText = 'position:fixed; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.75); color:#fff; padding:8px 20px; border-radius:20px; font-size:13px; z-index:99999; display:none;';
  document.body.appendChild(indicator);

  const loginScreen = document.getElementById('loginScreen');
  const loginBtn = document.querySelector('#loginScreen .btn-primary');
  const isLoginVisible = loginScreen && loginScreen.style.display !== 'none';

  if (isLoginVisible) {
    indicator.textContent = '서버 연결 중...';
    indicator.style.display = 'block';
    if (loginBtn) { loginBtn.disabled = true; loginBtn.style.opacity = '0.5'; }
  }

  // 서버 health 체크 (최대 3회 재시도, cold start 대비)
  let serverReady = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const hRes = await fetch('/api/health');
      const hData = await hRes.json();
      if (hData.status === 'OK') { serverReady = true; break; }
    } catch (_) {}
    if (attempt < 2) {
      indicator.textContent = `서버 깨우는 중... (${attempt + 1}/3)`;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!serverReady && isLoginVisible) {
    indicator.textContent = '서버 응답 없음 — 터치하여 재시도';
    indicator.style.background = 'rgba(220,38,38,0.85)';
    indicator.style.cursor = 'pointer';
    indicator.onclick = () => location.reload();
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.style.opacity = '';
    }
    setTimeout(() => { indicator.style.display = 'none'; }, 8000);
  }

  if (isLoginVisible && loginBtn) { loginBtn.disabled = false; loginBtn.style.opacity = ''; }

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
// 모바일/터치: 도움말 모드일 때 탭하면 동작 대신 안내만 표시 (capture 단계에서 실제 클릭 차단)
document.addEventListener('click', function(e) {
  if (!_helpMode) return;
  const el = e.target.closest('[data-help]');
  if (el) {
    e.preventDefault();
    e.stopPropagation();
    showHelpBubble(el);
  } else {
    hideHelpBubble();
  }
}, true);

// ─── 지역장: 소속 관리 ───
let _regionMembers = [];

let _rmKeyword = '';
let _rmCompany = '';
let _rmSort = 'name';

async function showRegionMembers() {
  const members = await api('/api/region/members');
  if (!members) return;
  _regionMembers = members;
  _rmKeyword = '';
  _rmCompany = '';
  _rmSort = 'name';
  renderRegionMembers('');
}

function setRmFilter() {
  const cSel = document.getElementById('rmCompanyFilter');
  const sSel = document.getElementById('rmSort');
  if (cSel) _rmCompany = cSel.value;
  if (sSel) _rmSort = sSel.value;
  renderRegionMembers(_rmKeyword);
}

function renderRegionMembers(keyword) {
  _rmKeyword = keyword || '';
  const kw = _rmKeyword.trim().toLowerCase();
  let list = _regionMembers.filter(m => {
    if (_rmCompany && (m.company_name || '') !== _rmCompany) return false;
    if (!kw) return true;
    return (m.name || '').toLowerCase().includes(kw) ||
      (m.company_name || '').toLowerCase().includes(kw) ||
      (m.department || '').toLowerCase().includes(kw) ||
      (m.position || '').toLowerCase().includes(kw);
  });
  list = list.slice().sort((a, b) => {
    if (_rmSort === 'company') {
      return (a.company_name || '힣').localeCompare(b.company_name || '힣', 'ko') || (a.name || '').localeCompare(b.name || '', 'ko');
    }
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });

  const companies = [...new Set(_regionMembers.map(m => m.company_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <p class="section-title" style="margin:0;">&#128100; 소속 관리 <span style="font-size:12px; color:var(--gray-500); font-weight:400;">(지역장)</span></p>
      <span style="font-size:13px; color:var(--gray-500);">${list.length}명</span>
    </div>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:10px;">관리담당자의 부서·직책·팀을 대신 수정할 수 있습니다.</p>
    <div class="form-group">
      <input type="text" class="form-control" placeholder="이름·회사·부서·직책 검색"
        value="${escAttr(_rmKeyword)}" oninput="renderRegionMembers(this.value)"
        data-help="찾으려는 관리담당자의 이름이나 소속을 입력하면 목록이 좁혀집니다.">
    </div>
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <select id="rmCompanyFilter" class="form-control" style="flex:1; font-size:13px;" onchange="setRmFilter()" data-help="특정 회사(조합)의 인원만 추려서 봅니다.">
        <option value=""${_rmCompany === '' ? ' selected' : ''}>전체 회사</option>
        ${companies.map(c => `<option value="${escAttr(c)}"${_rmCompany === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('')}
      </select>
      <select id="rmSort" class="form-control" style="width:120px; font-size:13px;" onchange="setRmFilter()" data-help="목록 정렬 기준을 바꿉니다.">
        <option value="name"${_rmSort === 'name' ? ' selected' : ''}>이름순</option>
        <option value="company"${_rmSort === 'company' ? ' selected' : ''}>회사순</option>
      </select>
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
      <input type="text" id="rmPos-${id}" class="form-control" value="${escAttr(m.position || '')}" placeholder="예: 과장, 팀장"
        data-help="이 사람의 직책을 입력하세요. ('지역장' 직책의 지정·변경은 시스템관리자만 가능합니다)">
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

// ─── 봉사활동 (개인 전용) ───
let _volunteerItems = [];

function volBranchOptions(selectedId) {
  const branches = (window._volBranches || []).filter(b => !b.exclude_service);
  return ['<option value="">대상 가맹점 선택 (선택)</option>']
    .concat(branches.map(b => `<option value="${b.id}"${b.id === selectedId ? ' selected' : ''}>${escHtml(b.name)}</option>`))
    .join('');
}

async function showVolunteerPage() {
  const [list, stats, branches] = await Promise.all([
    api('/api/volunteer'),
    api('/api/volunteer/stats'),
    api('/api/branches').then(r => r || [])
  ]);
  if (list === null) return;
  window._volBranches = branches;
  const items = list || [];
  _volunteerItems = items;
  const count = stats ? stats.count : items.length;
  const totalHours = stats ? Number(stats.total_hours || 0) : 0;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yearStr = String(now.getFullYear());
  const monthStr = today.substring(0, 7);
  const yearHours = items.filter(v => (v.activity_date || '').split('T')[0].substring(0, 4) === yearStr)
    .reduce((s, v) => s + Number(v.hours || 0), 0);
  const monthHours = items.filter(v => (v.activity_date || '').split('T')[0].substring(0, 7) === monthStr)
    .reduce((s, v) => s + Number(v.hours || 0), 0);

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <div style="display:flex; justify-content:space-between; align-items:center; margin:0 0 10px;">
      <p class="section-title" style="margin:0;">&#129309; 봉사활동 <span style="font-size:12px; color:var(--gray-500); font-weight:400;">(본인만 봅니다)</span></p>
      ${items.length > 0 ? `<button class="btn btn-outline btn-sm" onclick="downloadExcel('/api/export/volunteer','봉사활동내역')" data-help="내 봉사활동 내역을 엑셀 양식으로 내려받습니다.">&#128229; 엑셀</button>` : ''}
    </div>

    <div class="stats-row" style="margin-bottom:16px;">
      <div class="stat-card">
        <div class="stat-number">${count}</div>
        <div class="stat-label">총 활동</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${totalHours}</div>
        <div class="stat-label">누적 시간</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${yearHours}</div>
        <div class="stat-label">올해 시간</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${monthHours}</div>
        <div class="stat-label">이번 달</div>
      </div>
    </div>

    <div class="card" style="padding:12px; margin-bottom:16px;">
      <p style="font-weight:600; margin-bottom:8px; font-size:14px;">새 봉사활동 기록</p>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <input type="date" id="volDate" class="form-control" value="${today}" style="font-size:13px;" data-help="봉사활동을 한 날짜를 선택하세요.">
        </div>
        <div class="form-group" style="width:90px; margin-bottom:0;">
          <input type="number" id="volHours" class="form-control" placeholder="시간" min="0" step="0.5" style="font-size:13px;" data-help="봉사한 시간을 숫자로 적으세요. 예: 2, 3.5">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <input type="text" id="volTitle" class="form-control" placeholder="활동명 (예: 연탄 나눔 봉사)" data-help="어떤 봉사활동이었는지 제목을 적으세요.">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <select id="volBranch" class="form-control" style="font-size:13px;" data-help="봉사 대상 가맹점을 고르세요. 여러 가맹점을 다닐수록 정원이 무성해집니다.">
          ${volBranchOptions('')}
        </select>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:8px;">
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <input type="text" id="volLocation" class="form-control" placeholder="장소" style="font-size:13px;" data-help="봉사활동을 한 장소를 적으세요.">
        </div>
        <div class="form-group" style="width:90px; margin-bottom:0;">
          <input type="number" id="volParticipants" class="form-control" placeholder="인원" min="1" value="1" style="font-size:13px;" data-help="참여 인원 수입니다. 참여자 이름을 적으면 자동으로 인원이 계산됩니다.">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <input type="text" id="volNames" class="form-control" placeholder="참여자 이름 (쉼표로 구분)" style="font-size:13px;" data-help="참여한 사람들의 이름을 쉼표로 구분해 적으세요. 같은 사람이 자주 참여할수록 정원 점수에 도움이 됩니다.">
      </div>
      <div class="form-group" style="margin-bottom:8px;">
        <textarea id="volContent" class="form-control" placeholder="활동 내용 (선택)" data-help="활동 내용을 자유롭게 적으세요. 비워둬도 됩니다."></textarea>
      </div>
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; cursor:pointer;" data-help="완료로 등록하면 봉사 성장 정원 집계에 반영됩니다. 미체크 시 '계획' 상태로 저장됩니다.">
        <input type="checkbox" id="volDone" style="width:18px; height:18px; accent-color:var(--primary);"> 완료로 등록 (정원에 반영)
      </label>
      <button class="btn btn-primary btn-block" onclick="addVolunteer()" data-help="입력한 봉사활동을 기록에 추가합니다.">기록 추가</button>
    </div>

    ${items.length === 0 ? '<div class="empty-state"><div class="empty-icon">&#129309;</div><div class="empty-text">아직 기록한 봉사활동이 없습니다</div></div>' : items.map(v => `
      <div class="card" style="padding:12px; margin-bottom:8px;" id="vol-${v.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="min-width:0;">
            <div style="font-size:15px; font-weight:600;">
              ${v.status === '완료' ? '<span class="svc-badge svc-approved" style="margin-right:4px;">완료</span>' : '<span class="svc-badge svc-planned" style="margin-right:4px;">계획</span>'}
              ${escHtml(v.title)}
            </div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:3px;">
              ${(v.activity_date || '').split('T')[0]}${v.location ? ' · ' + escHtml(v.location) : ''}${Number(v.hours) ? ' · ' + Number(v.hours) + '시간' : ''}${Number(v.participants) > 1 ? ' · ' + v.participants + '명' : ''}
            </div>
            ${v.participant_names ? `<div style="font-size:11px; color:var(--gray-400); margin-top:2px;">참여자: ${escHtml(v.participant_names)}</div>` : ''}
            ${v.content ? `<div style="font-size:13px; color:var(--gray-700); margin-top:6px; white-space:pre-wrap;">${escHtml(v.content)}</div>` : ''}
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button onclick="editVolunteer('${v.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:13px; font-weight:600;" data-help="이 기록의 내용을 수정합니다.">수정</button>
            <button onclick="deleteVolunteer('${v.id}')" style="background:none; border:none; color:var(--gray-400); cursor:pointer; font-size:16px;">&times;</button>
          </div>
        </div>
      </div>
    `).join('')}
  `;
}

function editVolunteer(id) {
  const v = _volunteerItems.find(x => x.id === id);
  if (!v) return;
  const date = (v.activity_date || '').split('T')[0];
  document.getElementById('vol-' + id).innerHTML = `
    <div style="font-size:14px; font-weight:600; margin-bottom:8px;">봉사활동 수정</div>
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <div class="form-group" style="flex:1; margin-bottom:0;">
        <input type="date" id="volEditDate-${id}" class="form-control" value="${date}" style="font-size:13px;" data-help="봉사활동을 한 날짜입니다.">
      </div>
      <div class="form-group" style="width:90px; margin-bottom:0;">
        <input type="number" id="volEditHours-${id}" class="form-control" value="${escAttr(String(Number(v.hours || 0)))}" placeholder="시간" min="0" step="0.5" style="font-size:13px;" data-help="봉사한 시간입니다.">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <input type="text" id="volEditTitle-${id}" class="form-control" value="${escAttr(v.title || '')}" placeholder="활동명" data-help="봉사활동 제목입니다.">
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <select id="volEditBranch-${id}" class="form-control" style="font-size:13px;" data-help="봉사 대상 가맹점입니다.">
        ${volBranchOptions(v.branch_id || '')}
      </select>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <div class="form-group" style="flex:1; margin-bottom:0;">
        <input type="text" id="volEditLocation-${id}" class="form-control" value="${escAttr(v.location || '')}" placeholder="장소" style="font-size:13px;" data-help="봉사활동 장소입니다.">
      </div>
      <div class="form-group" style="width:90px; margin-bottom:0;">
        <input type="number" id="volEditParticipants-${id}" class="form-control" value="${escAttr(String(v.participants || 1))}" placeholder="인원" min="1" style="font-size:13px;" data-help="참여 인원 수입니다.">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <input type="text" id="volEditNames-${id}" class="form-control" value="${escAttr(v.participant_names || '')}" placeholder="참여자 이름 (쉼표로 구분)" style="font-size:13px;" data-help="참여자 이름을 쉼표로 구분해 적습니다.">
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <textarea id="volEditContent-${id}" class="form-control" placeholder="활동 내용 (선택)" data-help="활동 내용입니다.">${escHtml(v.content || '')}</textarea>
    </div>
    <label style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:13px; cursor:pointer;" data-help="완료로 등록하면 봉사 성장 정원 집계에 반영됩니다.">
      <input type="checkbox" id="volEditDone-${id}" ${v.status === '완료' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary);"> 완료로 등록 (정원에 반영)
    </label>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-outline btn-sm" style="flex:1;" onclick="showVolunteerPage()">취소</button>
      <button class="btn btn-primary btn-sm" style="flex:1;" onclick="saveVolunteer('${id}')" data-help="수정한 내용을 저장합니다.">저장</button>
    </div>
  `;
}

async function saveVolunteer(id) {
  const activity_date = document.getElementById('volEditDate-' + id).value;
  const title = document.getElementById('volEditTitle-' + id).value.trim();
  if (!activity_date || !title) { toast('봉사일자와 활동명을 입력하세요'); return; }
  const hours = parseFloat(document.getElementById('volEditHours-' + id).value) || 0;
  const location = document.getElementById('volEditLocation-' + id).value.trim();
  const participants = parseInt(document.getElementById('volEditParticipants-' + id).value) || 1;
  const content = document.getElementById('volEditContent-' + id).value.trim();
  const branch_id = document.getElementById('volEditBranch-' + id).value || null;
  const participant_names = document.getElementById('volEditNames-' + id).value.trim();
  const status = document.getElementById('volEditDone-' + id).checked ? '완료' : '계획';
  const res = await api(`/api/volunteer/${id}`, { method: 'PUT', body: { activity_date, title, location, hours, participants, content, branch_id, participant_names, status } });
  if (res) { toast('수정되었습니다'); showVolunteerPage(); }
}

async function addVolunteer() {
  const activity_date = document.getElementById('volDate').value;
  const title = document.getElementById('volTitle').value.trim();
  if (!activity_date || !title) { toast('봉사일자와 활동명을 입력하세요'); return; }
  const hours = parseFloat(document.getElementById('volHours').value) || 0;
  const location = document.getElementById('volLocation').value.trim();
  const participants = parseInt(document.getElementById('volParticipants').value) || 1;
  const content = document.getElementById('volContent').value.trim();
  const branch_id = document.getElementById('volBranch').value || null;
  const participant_names = document.getElementById('volNames').value.trim();
  const status = document.getElementById('volDone').checked ? '완료' : '계획';
  const res = await api('/api/volunteer', { method: 'POST', body: { activity_date, title, location, hours, participants, content, branch_id, participant_names, status } });
  if (res) { toast(status === '완료' ? '완료로 등록되었습니다' : '기록되었습니다'); showVolunteerPage(); }
}

async function deleteVolunteer(id) {
  if (!confirm('이 봉사활동 기록을 삭제하시겠습니까?')) return;
  await api(`/api/volunteer/${id}`, { method: 'DELETE' });
  showVolunteerPage();
}

// ─── 봉사 승인·감사 관리 (지역장=승인, 관리자=승인+감사확인) ───
const VOL_STATUS = {
  '계획': { cls: 'svc-planned', label: '계획' },
  '승인': { cls: 'svc-requested', label: '승인' },
  '완료': { cls: 'svc-approved', label: '완료' },
  '감사확인': { cls: 'svc-audited', label: '감사확인' }
};

async function showVolunteerReview() {
  const data = await api('/api/volunteer/review');
  if (!data) return;
  const role = data.role || {};
  const items = data.items || [];
  const filter = window._volReviewFilter || 'all';
  const shown = filter === 'all' ? items : items.filter(i => i.status === filter);

  document.getElementById('mainContent').innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="navigate('more')" style="margin-bottom:12px;">&larr; 더보기</button>
    <p class="section-title" style="margin:0 0 4px;">&#9989; 봉사 승인·감사 관리</p>
    <p style="font-size:12px; color:var(--gray-500); margin-bottom:10px;">
      ${role.admin ? '계획 승인 + 완료건 감사확인이 가능합니다.' : '지국이 요청한 계획을 승인할 수 있습니다.'}
    </p>
    <div class="tabs" style="margin-bottom:12px; flex-wrap:wrap; gap:4px;">
      ${['all','계획','승인','완료','감사확인'].map(f => `<button class="tab${filter===f?' active':''}" onclick="window._volReviewFilter='${f}'; showVolunteerReview();">${f==='all'?'전체':f}</button>`).join('')}
    </div>
    ${shown.length === 0 ? '<div class="empty-state"><div class="empty-text">해당 항목이 없습니다</div></div>' : shown.map(it => {
      const st = VOL_STATUS[it.status] || VOL_STATUS['계획'];
      const place = it.branch_name || it.location || '';
      let btns = '';
      if (it.status === '계획' && (role.admin || role.regionHead)) {
        btns += `<button class="btn btn-primary btn-sm" onclick="setVolStatus('${it.id}','승인')" data-help="이 계획을 승인합니다.">승인</button>`;
      }
      if (it.status === '완료' && role.admin) {
        btns += `<button class="btn btn-success btn-sm" onclick="setVolStatus('${it.id}','감사확인')" data-help="완료된 봉사활동을 감사확인 처리합니다.">감사확인</button>`;
      }
      return `
      <div class="card" style="padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="min-width:0;">
            <div style="font-size:14px; font-weight:600;"><span class="svc-badge ${st.cls}" style="margin-right:4px;">${st.label}</span>${escHtml(it.title)}</div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:3px;">
              ${(it.activity_date||'').split('T')[0]}${place ? ' · ' + escHtml(place) : ''} · ${escHtml(it.company_name || it.author_name || '')}
            </div>
            ${it.participant_names ? `<div style="font-size:11px; color:var(--gray-400); margin-top:2px;">참여자: ${escHtml(it.participant_names)}</div>` : ''}
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">${btns}</div>
        </div>
      </div>`;
    }).join('')}
  `;
}

async function setVolStatus(id, status) {
  const res = await api(`/api/volunteer/${id}/status`, { method: 'PUT', body: { status } });
  if (res) { toast(status + ' 처리되었습니다'); showVolunteerReview(); }
}
