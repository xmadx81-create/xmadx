const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { query, uuidv4, initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: 'petroleum-work-system-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', secure: false }
}));

// ─── 서버 점검 모드 시스템 ───
let maintenanceMode = false;
let maintenanceMessage = '시스템 업데이트 중입니다. 잠시 후 다시 이용해주세요.';
let maintenanceUntil = null;
let maintenancePatchNotes = '';

app.get('/api/maintenance/status', (req, res) => {
  res.json({
    active: maintenanceMode,
    message: maintenanceMessage,
    until: maintenanceUntil,
    patchNotes: maintenancePatchNotes,
    isAdmin: !!(req.session && req.session.isAdmin)
  });
});

app.use((req, res, next) => {
  if (!maintenanceMode) return next();
  if (req.path === '/api/maintenance/status' || req.path === '/api/admin/login') return next();
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({
      error: '서버 점검 중',
      message: maintenanceMessage,
      until: maintenanceUntil
    });
  }
  next();
});

function authMiddleware(req, res, next) {
  if (req.session.userId || req.session.isAdmin) return next();
  res.status(401).json({ error: '로그인이 필요합니다' });
}

function companyMiddleware(req, res, next) {
  req.companyId = req.session.companyId || null;
  req.teamId = req.session.teamId || null;
  next();
}

app.get('/api/health', async (req, res) => {
  try {
    const dbTest = await query('SELECT NOW() as now');
    const userCount = await query('SELECT COUNT(*) as cnt FROM users');
    const staffCount = await query('SELECT COUNT(*) as cnt FROM approved_staff');
    res.json({
      status: 'OK',
      db: 'connected',
      time: dbTest.rows[0].now,
      users: parseInt(userCount.rows[0].cnt),
      approved_staff: parseInt(staffCount.rows[0].cnt)
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', db: 'disconnected', error: err.message });
  }
});

// ─── 인증 ───
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: '연락처와 비밀번호를 입력해주세요' });
    const phoneDigits = phone.replace(/[^0-9]/g, '');
    const usersResult = await query('SELECT * FROM users WHERE password_hash = $1', [password]);
    const users = usersResult.rows;
    for (const u of users) {
      const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
      if (uPhone === phoneDigits || uPhone.endsWith(phoneDigits) || phoneDigits.endsWith(uPhone)) {
        req.session.userId = u.id;
        req.session.companyId = u.company_id || null;
        req.session.teamId = u.team_id || null;
        let companyName = '';
        let teamName = '';
        if (u.company_id) {
          const cRes = await query('SELECT name FROM companies WHERE id = $1', [u.company_id]);
          if (cRes.rows[0]) companyName = cRes.rows[0].name;
        }
        if (u.team_id) {
          const tRes = await query('SELECT name FROM teams WHERE id = $1', [u.team_id]);
          if (tRes.rows[0]) teamName = tRes.rows[0].name;
        }
        return res.json({ id: u.id, name: u.name, department: u.department, position: u.position, company_id: u.company_id, company_name: companyName, team_id: u.team_id, team_name: teamName, sessionActive: true });
      }
    }
    return res.status(401).json({ error: '연락처 또는 비밀번호가 올바르지 않습니다' });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
});

// ─── 비밀번호 재설정 ───
app.post('/api/reset-password/verify', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: '이름과 이메일을 입력해주세요' });
  const userResult = await query('SELECT id, name, email FROM users WHERE name = $1 AND email = $2', [name, email]);
  const user = userResult.rows[0];
  if (!user) {
    const byNameResult = await query('SELECT id FROM users WHERE name = $1', [name]);
    const byName = byNameResult.rows[0];
    if (!byName) {
      return res.status(404).json({ error: '가입된 계정이 없습니다. 먼저 회원가입을 해주세요.' });
    }
    return res.status(404).json({ error: '이메일이 일치하지 않습니다. 가입 시 등록한 이메일을 확인해주세요.' });
  }
  res.json({ userId: user.id, name: user.name });
});

app.post('/api/reset-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: '비밀번호를 입력해주세요' });
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [password, userId]);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ─── 회사 관리 ───
app.post('/api/companies', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '회사명을 입력하세요' });
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const id = uuidv4();
  await query('INSERT INTO companies (id, name, code, description) VALUES ($1,$2,$3,$4)', [id, name, code, description || '']);
  res.json({ id, name, code });
});

app.get('/api/companies/check/:code', async (req, res) => {
  const result = await query('SELECT id, name FROM companies WHERE code = $1', [req.params.code]);
  if (result.rows.length === 0) return res.status(404).json({ error: '존재하지 않는 회사 코드입니다' });
  res.json(result.rows[0]);
});

app.get('/api/companies/:id/teams', async (req, res) => {
  const result = await query('SELECT * FROM teams WHERE company_id = $1 ORDER BY name', [req.params.id]);
  res.json(result.rows);
});

app.post('/api/teams', authMiddleware, async (req, res) => {
  const { name, share_reports } = req.body;
  const companyId = req.session.companyId;
  if (!companyId) return res.status(400).json({ error: '회사에 소속되어야 팀을 생성할 수 있습니다' });
  const id = uuidv4();
  await query('INSERT INTO teams (id, company_id, name, share_reports) VALUES ($1,$2,$3,$4)', [id, companyId, name, share_reports !== false]);
  res.json({ id, name });
});

app.put('/api/teams/:id', authMiddleware, async (req, res) => {
  const { share_reports } = req.body;
  await query('UPDATE teams SET share_reports = $1 WHERE id = $2', [share_reports, req.params.id]);
  res.json({ ok: true });
});

// ─── 회원가입 (자동승인, 누구나 가입 가능) ───
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, password, email, company_code, company_name, team_id, position, department } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: '이름, 연락처, 비밀번호를 입력해주세요' });

    const existingResult = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingResult.rows.length > 0) return res.status(409).json({ error: '이미 가입된 연락처입니다. 로그인해주세요.' });

    let companyId = null;
    let companyCode = null;
    let isNewCompany = false;

    if (company_code) {
      const compResult = await query('SELECT id FROM companies WHERE code = $1', [company_code.toUpperCase()]);
      if (compResult.rows.length === 0) return res.status(400).json({ error: '존재하지 않는 초대 코드입니다' });
      companyId = compResult.rows[0].id;
    } else if (company_name) {
      companyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const cid = uuidv4();
      await query('INSERT INTO companies (id, name, code) VALUES ($1,$2,$3)', [cid, company_name, companyCode]);
      companyId = cid;
      isNewCompany = true;
    }

    const id = uuidv4();
    await query(
      `INSERT INTO users (id, name, department, position, phone, email, password_hash, company_id, team_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, name, department || '', position || '', phone, email || '', password, companyId, team_id || null]
    );

    if (isNewCompany) {
      await query('UPDATE companies SET owner_id = $1 WHERE id = $2', [id, companyId]);
    }

    req.session.userId = id;
    req.session.companyId = companyId;
    req.session.teamId = team_id || null;

    const result = { id, name, department: department || '', position: position || '' };
    if (companyId) {
      const cRes = await query('SELECT name, code FROM companies WHERE id = $1', [companyId]);
      result.company_id = companyId;
      result.company_name = cRes.rows[0]?.name || '';
      if (isNewCompany) result.company_code = companyCode;
    }
    res.json(result);
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
});

// ─── 관리자 로그인 ───
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '2024!';

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });
  req.session.isAdmin = true;
  let adminResult = await query('SELECT * FROM users WHERE id = $1', ['admin-user']);
  let adminUser = adminResult.rows[0];
  if (!adminUser) {
    await query(`INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
      'admin-user', '시스템관리자', '', '관리자', '', '', '__admin__'
    ]);
    const newAdminResult = await query('SELECT * FROM users WHERE id = $1', ['admin-user']);
    adminUser = newAdminResult.rows[0];
  }
  req.session.userId = 'admin-user';
  res.json({ ok: true, user: { id: adminUser.id, name: adminUser.name, department: adminUser.department, position: adminUser.position } });
});

function adminMiddleware(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(403).json({ error: '관리자 권한이 필요합니다' });
}

// ─── 서버 점검 관리 (관리자 전용) ───
app.post('/api/admin/maintenance', adminMiddleware, (req, res) => {
  const { mode, message, until, patchNotes } = req.body;
  maintenanceMode = !!mode;
  if (message) maintenanceMessage = message;
  maintenanceUntil = until || null;
  if (patchNotes) maintenancePatchNotes = patchNotes;
  console.log(`[점검모드] ${maintenanceMode ? 'ON' : 'OFF'} - ${maintenanceMessage}`);
  res.json({ ok: true, maintenanceMode, message: maintenanceMessage, until: maintenanceUntil });
});

// ─── 사전승인 인원 관리 ───
app.get('/api/admin/staff', adminMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM approved_staff ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/admin/staff', adminMiddleware, async (req, res) => {
  const { name, phone, department, position, location, role } = req.body;
  if (!name || !phone) return res.status(400).json({ error: '이름과 연락처를 입력해주세요' });
  const id = uuidv4();
  await query(`INSERT INTO approved_staff (id, name, phone, department, position, location, role) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
    id, name, phone, department || '', position || '', location || '', role || ''
  ]);
  res.json({ id });
});

app.delete('/api/admin/staff/:id', adminMiddleware, async (req, res) => {
  await query('DELETE FROM approved_staff WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── 회원 관리 ───
app.get('/api/admin/users', adminMiddleware, async (req, res) => {
  const result = await query('SELECT id, name, department, position, phone, email, created_at FROM users ORDER BY created_at DESC');
  res.json(result.rows);
});

app.delete('/api/admin/users/:id', adminMiddleware, async (req, res) => {
  await query('DELETE FROM work_reports WHERE author_id = $1', [req.params.id]);
  await query('DELETE FROM approval_lines WHERE approver_id = $1', [req.params.id]);
  await query('DELETE FROM templates WHERE user_id = $1', [req.params.id]);
  await query('DELETE FROM frequent_items WHERE user_id = $1', [req.params.id]);
  await query('DELETE FROM personal_manual WHERE user_id = $1', [req.params.id]);
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

app.put('/api/admin/users/:id/reset-password', adminMiddleware, async (req, res) => {
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', ['1234', req.params.id]);
  res.json({ ok: true });
});

app.put('/api/admin/users/:id', adminMiddleware, async (req, res) => {
  const { name, department, position, phone, email } = req.body;
  await query('UPDATE users SET name=$1, department=$2, position=$3, phone=$4, email=$5 WHERE id=$6', [
    name, department, position, phone, email, req.params.id
  ]);
  res.json({ ok: true });
});

app.post('/api/admin/register-user', adminMiddleware, async (req, res) => {
  try {
    const { name, phone, password, department, position } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: '이름, 연락처, 비밀번호를 입력해주세요' });
    const existing = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) return res.status(409).json({ error: '이미 가입된 연락처입니다' });
    const id = uuidv4();
    await query('INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, name, department || '', position || '', phone, '', password]);
    await query('UPDATE approved_staff SET registered = 1 WHERE name = $1', [name]);
    res.json({ ok: true, id, name });
  } catch (err) {
    console.error('Admin register error:', err.message);
    res.status(500).json({ error: '등록 실패: ' + err.message });
  }
});

// ─── 지역장 소속 관리 (직책이 '지역장'인 사용자) ───
async function regionHeadMiddleware(req, res, next) {
  if (req.session.isAdmin) return next();
  if (!req.session.userId) return res.status(401).json({ error: '로그인이 필요합니다' });
  const r = await query('SELECT position FROM users WHERE id = $1', [req.session.userId]);
  if (r.rows[0] && r.rows[0].position === '지역장') return next();
  res.status(403).json({ error: '지역장 권한이 필요합니다' });
}

app.get('/api/region/members', regionHeadMiddleware, async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.department, u.position, u.phone, u.company_id, u.team_id,
            c.name AS company_name, t.name AS team_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     LEFT JOIN teams t ON t.id = u.team_id
     WHERE u.id <> 'admin-user'
     ORDER BY u.created_at DESC`
  );
  res.json(result.rows);
});

app.put('/api/region/members/:id', regionHeadMiddleware, async (req, res) => {
  if (req.params.id === 'admin-user') return res.status(403).json({ error: '관리자 계정은 수정할 수 없습니다' });
  const target = await query('SELECT id, company_id, position FROM users WHERE id = $1', [req.params.id]);
  if (target.rows.length === 0) return res.status(404).json({ error: '대상을 찾을 수 없습니다' });
  const { department, position, team_id } = req.body;
  // '지역장' 직책 지정·변경은 시스템관리자만 가능 (지역장끼리 권한 부여/강등 방지)
  if (!req.session.isAdmin) {
    const newPos = (position || '').trim();
    const curPos = target.rows[0].position || '';
    if (newPos === '지역장' || curPos === '지역장') {
      return res.status(403).json({ error: "'지역장' 직책 지정·변경은 시스템관리자만 가능합니다" });
    }
  }
  // 팀은 대상자의 회사에 속한 팀만 허용 (타 회사 팀 지정 방지)
  let teamVal = null;
  if (team_id) {
    const t = await query('SELECT id FROM teams WHERE id = $1 AND company_id = $2', [team_id, target.rows[0].company_id]);
    if (t.rows.length === 0) return res.status(400).json({ error: '대상자의 회사에 속한 팀이 아닙니다' });
    teamVal = team_id;
  }
  // 부서·직책·팀 3개 컬럼만 화이트리스트 업데이트
  await query('UPDATE users SET department = $1, position = $2, team_id = $3 WHERE id = $4', [
    department || '', position || '', teamVal, req.params.id
  ]);
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const result = await query('SELECT id, name, department, position, phone, email, company_id, team_id FROM users WHERE id = $1', [req.session.userId]);
  const user = result.rows[0];
  if (!user) return res.json(null);
  if (req.session.isAdmin) user.isAdmin = true;
  if (user.company_id) {
    const cRes = await query('SELECT name FROM companies WHERE id = $1', [user.company_id]);
    user.company_name = cRes.rows[0] ? cRes.rows[0].name : '';
    const tRes = user.team_id ? await query('SELECT name, share_reports FROM teams WHERE id = $1', [user.team_id]) : { rows: [] };
    user.team_name = tRes.rows[0] ? tRes.rows[0].name : '';
    user.team_share_reports = tRes.rows[0] ? tRes.rows[0].share_reports : true;
  }
  req.session.companyId = user.company_id || null;
  req.session.teamId = user.team_id || null;
  res.json(user);
});

app.get('/api/users', authMiddleware, async (req, res) => {
  const cid = req.session.companyId;
  const result = cid
    ? await query('SELECT id, name, department, position, team_id FROM users WHERE company_id = $1', [cid])
    : await query('SELECT id, name, department, position, team_id FROM users');
  res.json(result.rows);
});

// ─── 통합 검색 ───
app.get('/api/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const kw = `%${q.trim()}%`;

  const [reports, tasks, branches, manuals, meetings, events, todos, notes, boards] = await Promise.all([
    query(`SELECT r.id, r.what_task, r.content, r.work_category, r.report_date, u.name as author_name
      FROM work_reports r JOIN users u ON r.author_id = u.id
      WHERE r.what_task ILIKE $1 OR r.content ILIKE $1 OR r.where_place ILIKE $1 OR r.how_method ILIKE $1
      ORDER BY r.report_date DESC LIMIT 10`, [kw]),
    query(`SELECT id, task_detail, task_group, category1, assigned_to
      FROM task_master WHERE task_detail ILIKE $1 OR task_group ILIKE $1 OR assigned_to ILIKE $1
      ORDER BY task_group LIMIT 10`, [kw]),
    query(`SELECT id, name, address, manager_name, manager_phone
      FROM branches WHERE name ILIKE $1 OR address ILIKE $1 OR manager_name ILIKE $1
      ORDER BY seq LIMIT 10`, [kw]),
    query(`SELECT id, title, content, task_group
      FROM personal_manual WHERE title ILIKE $1 OR content ILIKE $1
      ORDER BY created_at DESC LIMIT 10`, [kw]),
    query(`SELECT id, title, meeting_date
      FROM meeting_notes WHERE title ILIKE $1 OR summary ILIKE $1
      ORDER BY meeting_date DESC LIMIT 10`, [kw]),
    query(`SELECT id, title, event_type, event_date, description
      FROM team_events WHERE title ILIKE $1 OR description ILIKE $1
      ORDER BY event_date DESC LIMIT 10`, [kw]),
    query(`SELECT id, title, due_date, completed FROM todos
      WHERE user_id = $1 AND (title ILIKE $2)
      ORDER BY created_at DESC LIMIT 10`, [req.session.userId, kw]),
    query(`SELECT id, content, color, created_at FROM quick_notes
      WHERE user_id = $1 AND content ILIKE $2
      ORDER BY created_at DESC LIMIT 10`, [req.session.userId, kw]),
    query(`SELECT id, title, created_at FROM board_posts
      WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT 10`, [kw])
  ]);

  const results = [];
  reports.rows.forEach(r => results.push({ type: 'report', id: r.id, title: r.what_task || r.content || '(내용 없음)',
    sub: `${r.author_name} · ${(r.report_date||'').toString().split('T')[0]}`, category: r.work_category }));
  tasks.rows.forEach(r => results.push({ type: 'task', id: r.id, title: r.task_detail || '',
    sub: `${r.task_group || ''} · ${r.assigned_to || '미지정'}`, category: r.category1 }));
  branches.rows.forEach(r => results.push({ type: 'branch', id: r.id, title: r.name,
    sub: `${r.address || ''} · ${r.manager_name || ''}`, category: '지국' }));
  manuals.rows.forEach(r => results.push({ type: 'manual', id: r.id, title: r.title,
    sub: r.task_group || '', category: '매뉴얼' }));
  meetings.rows.forEach(r => results.push({ type: 'meeting', id: r.id, title: r.title,
    sub: (r.meeting_date||'').toString().split('T')[0], category: '회의록' }));
  events.rows.forEach(r => results.push({ type: 'event', id: r.id, title: r.title,
    sub: `${r.event_type || ''} · ${(r.event_date||'').toString().split('T')[0]}`, category: '일정' }));
  todos.rows.forEach(r => results.push({ type: 'todo', id: r.id, title: r.title,
    sub: `${r.completed ? '완료' : '미완료'} · ${r.due_date ? (r.due_date+'').split('T')[0] : '기한없음'}`, category: '할일' }));
  notes.rows.forEach(r => results.push({ type: 'note', id: r.id, title: (r.content||'').substring(0, 40),
    sub: (r.created_at||'').toString().split('T')[0], category: '메모' }));
  boards.rows.forEach(r => results.push({ type: 'board', id: r.id, title: r.title,
    sub: (r.created_at||'').toString().split('T')[0], category: '게시판' }));

  res.json({ query: q, total: results.length, results });
});

// ─── 캘린더 ───
app.get('/api/calendar', authMiddleware, async (req, res, next) => {
  if (req.query.month && req.query.month.includes('-')) return next();
  const { year, month } = req.query;
  const y = parseInt(year) || new Date().getFullYear();
  const m = parseInt(month) || (new Date().getMonth() + 1);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${last}`;

  const result = await query(`
    SELECT r.report_date::text as d, r.work_category, r.what_task, r.id, u.name as author_name
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.report_date >= $1 AND r.report_date <= $2
    ORDER BY r.report_date, r.created_at
  `, [from, to]);

  const byDate = {};
  result.rows.forEach(r => {
    if (!byDate[r.d]) byDate[r.d] = [];
    byDate[r.d].push({ id: r.id, task: r.what_task, category: r.work_category, author: r.author_name });
  });

  res.json({ year: y, month: m, days: byDate });
});

// ─── 대시보드 ───
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];

  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    weekDays.push(d.toISOString().split('T')[0]);
  }

  const dailyResult = await query(`
    SELECT report_date::text as d, COUNT(*) as cnt
    FROM work_reports WHERE report_date >= $1
    GROUP BY report_date ORDER BY report_date
  `, [weekDays[0]]);
  const dailyMap = {};
  dailyResult.rows.forEach(r => { dailyMap[r.d] = parseInt(r.cnt); });
  const weekActivity = weekDays.map(d => ({ date: d, day: ['일','월','화','수','목','금','토'][new Date(d).getDay()], count: dailyMap[d] || 0 }));

  const myDailyResult = await query(`
    SELECT report_date::text as d, COUNT(*) as cnt
    FROM work_reports WHERE author_id = $1 AND report_date >= $2
    GROUP BY report_date ORDER BY report_date
  `, [userId, weekDays[0]]);
  const myDailyMap = {};
  myDailyResult.rows.forEach(r => { myDailyMap[r.d] = parseInt(r.cnt); });
  const myWeekActivity = weekDays.map(d => ({ date: d, count: myDailyMap[d] || 0 }));

  const catResult = await query(`
    SELECT work_category, COUNT(*) as cnt FROM work_reports
    WHERE author_id = $1 AND report_date >= $2 AND work_category IS NOT NULL
    GROUP BY work_category ORDER BY cnt DESC
  `, [userId, weekDays[0]]);

  const monthStart = today.substring(0, 7) + '-01';
  const monthResult = await query(`
    SELECT COUNT(*) as cnt FROM work_reports WHERE author_id = $1 AND report_date >= $2
  `, [userId, monthStart]);

  const pendingResult = await query(`
    SELECT COUNT(*) as cnt FROM approval_lines
    WHERE approver_id = $1 AND status = 'pending'
  `, [userId]);

  const recentTaskResult = await query(`
    SELECT what_task, work_category, COUNT(*) as cnt
    FROM work_reports WHERE author_id = $1 AND what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category ORDER BY cnt DESC LIMIT 5
  `, [userId]);

  const todoCountResult = await query(`
    SELECT COUNT(*) FILTER (WHERE completed = FALSE) as pending,
           COUNT(*) FILTER (WHERE completed = TRUE AND updated_at >= $2) as done_today
    FROM todos WHERE user_id = $1
  `, [userId, today]);
  const todoStats = todoCountResult.rows[0] || { pending: 0, done_today: 0 };

  const attWeekResult = await query(`
    SELECT COUNT(*) FILTER (WHERE check_in IS NOT NULL) as attended,
           COUNT(*) FILTER (WHERE status = 'late') as late_count
    FROM attendance WHERE user_id = $1 AND work_date >= $2
  `, [userId, weekDays[0]]);
  const attStats = attWeekResult.rows[0] || { attended: 0, late_count: 0 };

  const eventWeekResult = await query(`
    SELECT COUNT(*) as cnt FROM team_events
    WHERE event_date >= $1 AND event_date <= $2
  `, [weekDays[0], today]);
  const eventWeekCount = parseInt((eventWeekResult.rows[0] || {}).cnt || 0);

  res.json({
    week_activity: weekActivity,
    my_week_activity: myWeekActivity,
    my_categories: catResult.rows.map(r => ({ name: r.work_category, count: parseInt(r.cnt) })),
    month_count: parseInt(monthResult.rows[0].cnt),
    pending_approvals: parseInt(pendingResult.rows[0].cnt),
    my_top_tasks: recentTaskResult.rows.map(r => ({ task: r.what_task, category: r.work_category, count: parseInt(r.cnt) })),
    todos_pending: parseInt(todoStats.pending || 0),
    todos_done_today: parseInt(todoStats.done_today || 0),
    att_week_count: parseInt(attStats.attended || 0),
    att_late_count: parseInt(attStats.late_count || 0),
    event_week_count: eventWeekCount
  });
});

// ─── 업무일지 CRUD ───
app.get('/api/reports', authMiddleware, async (req, res) => {
  const { type, category, from, to } = req.query;
  const cid = req.session.companyId;
  let sql = 'SELECT r.*, u.name as author_name, u.position as author_position, u.team_id, (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id) as comment_count FROM work_reports r JOIN users u ON r.author_id = u.id WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (cid) { sql += ` AND (r.company_id = $${paramIdx} OR u.company_id = $${paramIdx})`; params.push(cid); paramIdx++; }
  if (type) { sql += ` AND r.report_type = $${paramIdx++}`; params.push(type); }
  if (category) { sql += ` AND r.work_category = $${paramIdx++}`; params.push(category); }
  if (from) { sql += ` AND r.report_date >= $${paramIdx++}`; params.push(from); }
  if (to) { sql += ` AND r.report_date <= $${paramIdx++}`; params.push(to); }
  sql += ' ORDER BY r.report_date DESC, r.created_at DESC';
  const result = await query(sql, params);

  const tid = req.session.teamId;
  let rows = result.rows;
  if (cid && tid) {
    const teamInfo = await query('SELECT share_reports FROM teams WHERE id = $1', [tid]);
    const myTeamShares = teamInfo.rows[0] ? teamInfo.rows[0].share_reports : true;
    rows = rows.filter(r => {
      if (r.author_id === req.session.userId) return true;
      if (!r.team_id) return true;
      if (r.team_id === tid) return true;
      const otherTeamShares = true;
      return myTeamShares;
    });
  }
  res.json(rows);
});

app.get('/api/reports/:id', authMiddleware, async (req, res) => {
  const reportResult = await query(`
    SELECT r.*, u.name as author_name, u.position as author_position
    FROM work_reports r JOIN users u ON r.author_id = u.id WHERE r.id = $1
  `, [req.params.id]);
  const report = reportResult.rows[0];
  if (!report) return res.status(404).json({ error: '업무일지를 찾을 수 없습니다' });
  const approvalsResult = await query(`
    SELECT a.*, u.name as approver_name, u.position as approver_position
    FROM approval_lines a JOIN users u ON a.approver_id = u.id
    WHERE a.report_id = $1 ORDER BY a.step_order
  `, [req.params.id]);
  const commentCount = await query('SELECT COUNT(*) as cnt FROM comments WHERE report_id = $1', [req.params.id]);
  res.json({ ...report, approvals: approvalsResult.rows, comment_count: parseInt(commentCount.rows[0].cnt) });
});

app.post('/api/reports', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { report_date, report_type, work_category, purpose, who, when_time, where_place,
    what_task, how_method, why_reason, content, recipients, approvers } = req.body;

  await query(`INSERT INTO work_reports (id, author_id, report_date, report_type, work_category,
    purpose, who, when_time, where_place, what_task, how_method, why_reason, content, recipients, company_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [
    id, req.session.userId, report_date, report_type, work_category,
    purpose, who, when_time, where_place, what_task, how_method, why_reason, content,
    recipients ? JSON.stringify(recipients) : null, req.session.companyId || null
  ]);

  if (approvers && approvers.length > 0) {
    for (let idx = 0; idx < approvers.length; idx++) {
      await query(`INSERT INTO approval_lines (id, report_id, approver_id, step_order) VALUES ($1, $2, $3, $4)`, [
        uuidv4(), id, approvers[idx], idx + 1
      ]);
    }
  }

  await trackFrequentItems(req.session.userId, req.body);
  res.json({ id });
});

app.put('/api/reports/:id', authMiddleware, async (req, res) => {
  const { report_date, report_type, work_category, purpose, who, when_time, where_place,
    what_task, how_method, why_reason, content, status } = req.body;
  await query(`UPDATE work_reports SET report_date=$1, report_type=$2, work_category=$3,
    purpose=$4, who=$5, when_time=$6, where_place=$7, what_task=$8, how_method=$9, why_reason=$10,
    content=$11, status=$12, updated_at=NOW() WHERE id=$13 AND author_id=$14`, [
    report_date, report_type, work_category, purpose, who, when_time, where_place,
    what_task, how_method, why_reason, content, status, req.params.id, req.session.userId
  ]);
  res.json({ ok: true });
});

app.delete('/api/reports/:id', authMiddleware, async (req, res) => {
  await query('DELETE FROM approval_lines WHERE report_id = $1', [req.params.id]);
  await query('DELETE FROM work_reports WHERE id = $1 AND author_id = $2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

// ─── 결재 처리 ───
app.post('/api/reports/:id/approve', authMiddleware, async (req, res) => {
  const { status, comment } = req.body;
  await query(`UPDATE approval_lines SET status = $1, comment = $2, approved_at = NOW()
    WHERE report_id = $3 AND approver_id = $4`, [status, comment, req.params.id, req.session.userId]);

  const allApprovedResult = await query(`SELECT COUNT(*) as cnt FROM approval_lines WHERE report_id = $1 AND status != 'approved'`, [req.params.id]);
  if (parseInt(allApprovedResult.rows[0].cnt) === 0) {
    await query(`UPDATE work_reports SET status = 'approved' WHERE id = $1`, [req.params.id]);
  } else if (status === 'rejected') {
    await query(`UPDATE work_reports SET status = 'rejected' WHERE id = $1`, [req.params.id]);
  }
  res.json({ ok: true });
});

// ─── 주간계획 ───
app.get('/api/weekly-plans', authMiddleware, async (req, res) => {
  const result = await query(`SELECT wp.*, u.name as author_name FROM weekly_plans wp
    JOIN users u ON wp.author_id = u.id ORDER BY wp.week_start DESC`);
  res.json(result.rows);
});

app.post('/api/weekly-plans', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { week_start, week_end, items } = req.body;
  await query('INSERT INTO weekly_plans (id, author_id, week_start, week_end, status) VALUES ($1, $2, $3, $4, $5)', [
    id, req.session.userId, week_start, week_end, 'submitted'
  ]);
  if (items) {
    for (const item of items) {
      await query('INSERT INTO weekly_plan_items (id, plan_id, day_of_week, work_category, content, location, purpose) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        uuidv4(), id, item.day_of_week, item.work_category, item.content, item.location, item.purpose
      ]);
    }
  }
  res.json({ id });
});

app.get('/api/weekly-plans/:id', authMiddleware, async (req, res) => {
  const planResult = await query('SELECT wp.*, u.name as author_name FROM weekly_plans wp JOIN users u ON wp.author_id = u.id WHERE wp.id = $1', [req.params.id]);
  const plan = planResult.rows[0];
  if (!plan) return res.status(404).json({ error: '주간계획을 찾을 수 없습니다' });
  const itemsResult = await query('SELECT * FROM weekly_plan_items WHERE plan_id = $1 ORDER BY day_of_week', [req.params.id]);
  res.json({ ...plan, items: itemsResult.rows });
});

// ─── 템플릿 (반복 업무 자동생성) ───
app.get('/api/templates', authMiddleware, async (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM templates WHERE user_id = $1';
  const params = [req.session.userId];
  let paramIdx = 2;
  if (category) { sql += ` AND category = $${paramIdx++}`; params.push(category); }
  sql += ' ORDER BY use_count DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.post('/api/templates', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { category, title, content_json } = req.body;
  await query('INSERT INTO templates (id, user_id, category, title, content_json) VALUES ($1, $2, $3, $4, $5)', [
    id, req.session.userId, category, title, JSON.stringify(content_json)
  ]);
  res.json({ id });
});

app.post('/api/templates/:id/use', authMiddleware, async (req, res) => {
  await query('UPDATE templates SET use_count = use_count + 1 WHERE id = $1', [req.params.id]);
  const result = await query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
  res.json(result.rows[0]);
});

// ─── 자주 사용하는 항목 (자동완성) ───
app.get('/api/frequent-items', authMiddleware, async (req, res) => {
  const { field_name } = req.query;
  const result = await query('SELECT field_value, use_count FROM frequent_items WHERE user_id = $1 AND field_name = $2 ORDER BY use_count DESC LIMIT 10', [
    req.session.userId, field_name
  ]);
  res.json(result.rows);
});

async function trackFrequentItems(userId, data) {
  const fields = ['purpose', 'where_place', 'what_task', 'how_method', 'why_reason'];

  for (const field of fields) {
    if (data[field] && data[field].trim()) {
      const existingResult = await query('SELECT id FROM frequent_items WHERE user_id = $1 AND field_name = $2 AND field_value = $3', [
        userId, field, data[field].trim()
      ]);
      const existing = existingResult.rows[0];
      if (existing) {
        await query('UPDATE frequent_items SET use_count = use_count + 1 WHERE id = $1', [existing.id]);
      } else {
        await query(`INSERT INTO frequent_items (id, user_id, field_name, field_value, use_count)
          VALUES ($1, $2, $3, $4, 1) ON CONFLICT(user_id, field_name, field_value) DO UPDATE SET use_count = frequent_items.use_count + 1`, [
          uuidv4(), userId, field, data[field].trim()
        ]);
      }
    }
  }
}

// ─── 업무표 자동생성 (개인별 업무 종합) ───
app.get('/api/work-table', authMiddleware, async (req, res) => {
  const { from, to, user_id } = req.query;
  const targetUser = user_id || req.session.userId;
  const result = await query(`
    SELECT r.*, u.name as author_name, u.position as author_position
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.author_id = $1 AND r.report_date BETWEEN $2 AND $3
    ORDER BY r.report_date ASC
  `, [targetUser, from, to]);
  const reports = result.rows;

  const grouped = {};
  reports.forEach(r => {
    if (!grouped[r.report_date]) grouped[r.report_date] = [];
    grouped[r.report_date].push(r);
  });

  res.json({ user_id: targetUser, from, to, daily_reports: grouped, total_count: reports.length });
});

// ─── 업무매뉴얼 자동생성 (육하원칙 기반) ───

// 전체 조직 업무매뉴얼 (모든 사람의 업무일지 기반)
app.get('/api/manual/org', authMiddleware, async (req, res) => {
  const tasksResult = await query(`
    SELECT
      what_task,
      work_category,
      purpose,
      how_method,
      why_reason,
      where_place,
      who,
      COUNT(*) as frequency,
      STRING_AGG(DISTINCT u.name, ',') as people,
      MAX(r.report_date) as last_date,
      MIN(r.report_date) as first_date
    FROM work_reports r
    JOIN users u ON r.author_id = u.id
    WHERE what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category, purpose, how_method, why_reason, where_place, who
    ORDER BY frequency DESC
  `);
  const tasks = tasksResult.rows;

  const byCategory = {};
  tasks.forEach(t => {
    const cat = t.work_category || '기타';
    if (!byCategory[cat]) byCategory[cat] = [];

    let existing = byCategory[cat].find(e => e.task === t.what_task);
    if (existing) {
      existing.frequency += parseInt(t.frequency);
      if (t.how_method && !existing.methods.includes(t.how_method)) existing.methods.push(t.how_method);
      if (t.where_place && !existing.locations.includes(t.where_place)) existing.locations.push(t.where_place);
      if (t.why_reason && !existing.reasons.includes(t.why_reason)) existing.reasons.push(t.why_reason);
      if (t.people) t.people.split(',').forEach(p => { if (!existing.people.includes(p)) existing.people.push(p); });
    } else {
      byCategory[cat].push({
        task: t.what_task,
        purpose: t.purpose || '',
        methods: t.how_method ? [t.how_method] : [],
        reasons: t.why_reason ? [t.why_reason] : [],
        locations: t.where_place ? [t.where_place] : [],
        people: t.people ? t.people.split(',') : [],
        frequency: parseInt(t.frequency),
        last_date: t.last_date,
        first_date: t.first_date
      });
    }
  });

  const totalReportsResult = await query('SELECT COUNT(*) as cnt FROM work_reports');
  const totalReports = parseInt(totalReportsResult.rows[0].cnt);
  const totalPeopleResult = await query('SELECT COUNT(DISTINCT author_id) as cnt FROM work_reports');
  const totalPeople = parseInt(totalPeopleResult.rows[0].cnt);

  res.json({ generated_at: new Date().toISOString(), total_reports: totalReports, total_people: totalPeople, categories: byCategory });
});

// 자동 절차서 생성 (반복 업무 기반)
app.get('/api/manual/procedures', authMiddleware, async (req, res) => {
  const tasksResult = await query(`
    SELECT r.what_task, r.work_category, r.purpose, r.how_method, r.why_reason,
      r.where_place, r.who, r.when_time, r.content, r.report_date,
      u.name as author_name, u.position as author_position
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.what_task IS NOT NULL AND r.what_task != ''
    ORDER BY r.what_task, r.report_date DESC
  `);

  const taskGroups = {};
  tasksResult.rows.forEach(r => {
    const key = r.what_task;
    if (!taskGroups[key]) taskGroups[key] = [];
    taskGroups[key].push(r);
  });

  const procedures = [];
  Object.entries(taskGroups).forEach(([taskName, records]) => {
    if (records.length < 2) return;

    const methods = [...new Set(records.map(r => r.how_method).filter(Boolean))];
    const purposes = [...new Set(records.map(r => r.purpose).filter(Boolean))];
    const reasons = [...new Set(records.map(r => r.why_reason).filter(Boolean))];
    const locations = [...new Set(records.map(r => r.where_place).filter(Boolean))];
    const people = [...new Set(records.map(r => r.author_name))];
    const whoTargets = [...new Set(records.map(r => r.who).filter(Boolean))];
    const timeSlots = [...new Set(records.map(r => r.when_time).filter(Boolean))];
    const categories = [...new Set(records.map(r => r.work_category).filter(Boolean))];
    const contents = records.map(r => r.content).filter(Boolean);
    const dates = records.map(r => r.report_date).filter(Boolean);

    const steps = [];
    if (purposes.length > 0) steps.push({ label: '목적 확인', detail: purposes.join(' / ') });
    if (whoTargets.length > 0) steps.push({ label: '대상자/관련자 확인', detail: whoTargets.join(', ') });
    if (locations.length > 0) steps.push({ label: '장소 이동/준비', detail: locations.join(', ') });
    methods.forEach((m, i) => steps.push({ label: `수행 ${methods.length > 1 ? '방법 ' + (i + 1) : ''}`, detail: m }));
    if (contents.length > 0) {
      const uniqueContents = [...new Set(contents)].slice(0, 3);
      uniqueContents.forEach(c => {
        if (c.length > 10) steps.push({ label: '세부 내용', detail: c.length > 100 ? c.substring(0, 100) + '...' : c });
      });
    }

    const tips = [];
    if (reasons.length > 0) tips.push('사유: ' + reasons.join(' / '));
    if (timeSlots.length > 0) tips.push('시간대: ' + timeSlots.join(', '));
    if (records.length >= 5) tips.push(`이 업무는 ${records.length}회 반복되어 정기 업무로 분류됩니다.`);

    procedures.push({
      task: taskName,
      category: categories[0] || '기타',
      frequency: records.length,
      level: records.length >= 5 ? '정기' : records.length >= 3 ? '반복' : '일반',
      people,
      steps,
      tips,
      last_date: dates[0] || null,
      first_date: dates[dates.length - 1] || null,
      summary: {
        purpose: purposes[0] || '',
        main_method: methods[0] || '',
        main_location: locations[0] || '',
        main_target: whoTargets[0] || ''
      }
    });
  });

  procedures.sort((a, b) => b.frequency - a.frequency);

  const stats = {
    total_procedures: procedures.length,
    regular: procedures.filter(p => p.level === '정기').length,
    repeated: procedures.filter(p => p.level === '반복').length,
    normal: procedures.filter(p => p.level === '일반').length
  };

  res.json({ procedures, stats });
});

// 개인 업무매뉴얼 (내 업무일지 기반)
app.get('/api/manual', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;

  const tasksResult = await query(`
    SELECT
      what_task,
      work_category,
      purpose,
      how_method,
      why_reason,
      where_place,
      who,
      COUNT(*) as frequency,
      MAX(report_date) as last_date,
      MIN(report_date) as first_date
    FROM work_reports
    WHERE author_id = $1 AND what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category, purpose, how_method, why_reason, where_place, who
    ORDER BY frequency DESC
  `, [userId]);
  const tasks = tasksResult.rows;

  const byPurpose = {};
  tasks.forEach(t => {
    const key = t.purpose || t.work_category || '기타';
    if (!byPurpose[key]) byPurpose[key] = [];
    byPurpose[key].push({
      task: t.what_task,
      category: t.work_category,
      method: t.how_method || '',
      reason: t.why_reason || '',
      location: t.where_place || '',
      frequency: parseInt(t.frequency),
      last_date: t.last_date
    });
  });

  const customManualResult = await query('SELECT * FROM personal_manual WHERE user_id = $1 ORDER BY sort_order, created_at', [userId]);
  const customManual = customManualResult.rows;
  const userNameResult = await query('SELECT name, position FROM users WHERE id = $1', [userId]);
  const userName = userNameResult.rows[0];

  res.json({
    generated_at: new Date().toISOString(),
    user: userName,
    task_count: tasks.length,
    total_reports: tasks.reduce((s, t) => s + parseInt(t.frequency), 0),
    auto: byPurpose,
    custom: customManual
  });
});

app.post('/api/manual', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { task_group, title, content, steps, tips } = req.body;
  await query(`INSERT INTO personal_manual (id, user_id, task_group, title, content, steps, tips)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, req.session.userId, task_group, title, content, steps, tips]);
  res.json({ id });
});

app.put('/api/manual/:id', authMiddleware, async (req, res) => {
  const { title, content, steps, tips } = req.body;
  await query(`UPDATE personal_manual SET title=$1, content=$2, steps=$3, tips=$4, updated_at=NOW()
    WHERE id=$5 AND user_id=$6`, [title, content, steps, tips, req.params.id, req.session.userId]);
  res.json({ ok: true });
});

app.delete('/api/manual/:id', authMiddleware, async (req, res) => {
  await query('DELETE FROM personal_manual WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

// ─── 전국 지국 관리 ───
app.get('/api/branches', authMiddleware, async (req, res) => {
  const { search, exclude } = req.query;
  let sql = 'SELECT * FROM branches WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (search) {
    sql += ` AND (name LIKE $${paramIdx++} OR address LIKE $${paramIdx++} OR manager_name LIKE $${paramIdx++})`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (exclude === 'false') { sql += ' AND exclude_service = 0'; }
  sql += ' ORDER BY seq';
  const result = await query(sql, params);
  res.json(result.rows);
});

// 봉사 대상 가맹점(exclude_service=0)별 당월 봉사 일정상태(계획/요청/승인) + 횟수
// 주의: '/api/branches/:id' 보다 먼저 등록되어야 함
app.get('/api/branches/service-status', authMiddleware, async (req, res) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-base
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 1 : m + 2;
  const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  // 봉사 대상 가맹점만
  const branchRes = await query(`SELECT id, name FROM branches WHERE exclude_service = 0`);
  // 당월 업무일지(전체 사용자) + 결재 대기 여부
  const repRes = await query(
    `SELECT r.id, r.where_place, r.content, r.what_task, r.status,
       EXISTS(SELECT 1 FROM approval_lines a WHERE a.report_id = r.id AND a.status = 'pending') AS has_pending
     FROM work_reports r
     WHERE r.report_date >= $1 AND r.report_date < $2`,
    [monthStart, monthEnd]
  );
  const reports = repRes.rows.map(r => ({
    text: `${r.where_place || ''}\n${r.content || ''}\n${r.what_task || ''}`,
    approved: r.status === 'approved',
    pending: r.has_pending === true
  }));

  const statuses = {};
  for (const b of branchRes.rows) {
    const name = (b.name || '').trim();
    if (!name) continue;
    let count = 0, anyApproved = false, anyPending = false;
    for (const r of reports) {
      if (r.text.includes(name)) {
        count++;
        if (r.approved) anyApproved = true;
        else if (r.pending) anyPending = true;
      }
    }
    if (count > 0) {
      const status = anyApproved ? 'approved' : (anyPending ? 'requested' : 'planned');
      statuses[b.id] = { status, count };
    } else {
      statuses[b.id] = { status: 'none', count: 0 };
    }
  }
  res.json({ month: `${y}-${String(m + 1).padStart(2, '0')}`, target: 2, statuses });
});

app.get('/api/branches/:id', authMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM branches WHERE id = $1', [req.params.id]);
  const branch = result.rows[0];
  if (!branch) return res.status(404).json({ error: '지국을 찾을 수 없습니다' });
  res.json(branch);
});

// ─── 주요업무표 (task master) ───
app.get('/api/tasks', authMiddleware, async (req, res) => {
  const { category, group, search } = req.query;
  let sql = 'SELECT * FROM task_master WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (category) { sql += ` AND category1 = $${paramIdx++}`; params.push(category); }
  if (group) { sql += ` AND task_group = $${paramIdx++}`; params.push(group); }
  if (search) {
    sql += ` AND (task_detail LIKE $${paramIdx++} OR task_group LIKE $${paramIdx++} OR assigned_to LIKE $${paramIdx++})`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY category1, task_group, created_at';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.get('/api/tasks/categories', authMiddleware, async (req, res) => {
  const categoriesResult = await query('SELECT DISTINCT category1 FROM task_master WHERE category1 IS NOT NULL ORDER BY category1');
  const groupsResult = await query('SELECT DISTINCT task_group FROM task_master WHERE task_group IS NOT NULL ORDER BY task_group');
  res.json({ categories: categoriesResult.rows.map(c => c.category1), groups: groupsResult.rows.map(g => g.task_group) });
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { department, division, category1, task_group, task_detail, assigned_to, note } = req.body;
  await query(`INSERT INTO task_master (id, department, division, category1, task_group, task_detail, assigned_to, note, is_custom, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)`, [id, department, division, category1, task_group, task_detail, assigned_to, note, req.session.userId]);
  res.json({ id });
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  const { task_detail, assigned_to, note } = req.body;
  await query(`UPDATE task_master SET task_detail=$1, assigned_to=$2, note=$3, updated_at=NOW() WHERE id=$4`, [
    task_detail, assigned_to, note, req.params.id
  ]);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  const task = await query('SELECT * FROM task_master WHERE id = $1', [req.params.id]);
  if (task.rows.length === 0) return res.status(404).json({ error: '업무를 찾을 수 없습니다' });
  await query('DELETE FROM task_notes WHERE task_id = $1', [req.params.id]);
  await query('DELETE FROM task_master WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── 업무 추가내용 (task notes) ───
app.get('/api/tasks/:id/notes', authMiddleware, async (req, res) => {
  const result = await query(`SELECT tn.*, u.name as author_name FROM task_notes tn
    JOIN users u ON tn.author_id = u.id WHERE tn.task_id = $1 ORDER BY tn.created_at DESC`, [req.params.id]);
  res.json(result.rows);
});

app.post('/api/tasks/:id/notes', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { content } = req.body;
  await query('INSERT INTO task_notes (id, task_id, author_id, content) VALUES ($1, $2, $3, $4)', [
    id, req.params.id, req.session.userId, content
  ]);
  res.json({ id });
});

// ─── 개별 담당 업무표 ───
app.get('/api/personal-tasks', authMiddleware, async (req, res) => {
  const { person, position } = req.query;
  let sql = 'SELECT * FROM personal_task_table WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (person) { sql += ` AND person_name = $${paramIdx++}`; params.push(person); }
  if (position) { sql += ` AND position = $${paramIdx++}`; params.push(position); }
  sql += ' ORDER BY position, person_name, task_group';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.get('/api/personal-tasks/persons', authMiddleware, async (req, res) => {
  const result = await query('SELECT DISTINCT person_name, position FROM personal_task_table ORDER BY position, person_name');
  res.json(result.rows);
});

// ─── 엑셀 공통 스타일 ───
function applyExcelStyles(wb) {
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A5C' } };
  const headerFont = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const titleFont = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF1B3A5C' } };
  const subTitleFont = { name: '맑은 고딕', size: 11, color: { argb: 'FF666666' } };
  const bodyFont = { name: '맑은 고딕', size: 10 };
  const borderThin = { style: 'thin', color: { argb: 'FFD0D0D0' } };
  const borders = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin };
  const centerAlign = { vertical: 'middle', horizontal: 'center', wrapText: true };
  const leftAlign = { vertical: 'middle', horizontal: 'left', wrapText: true };
  return { headerFill, headerFont, titleFont, subTitleFont, bodyFont, borders, centerAlign, leftAlign };
}

// ─── 엑셀 다운로드: 주요업무표 ───
app.get('/api/export/tasks', authMiddleware, async (req, res) => {
  const tasksResult = await query('SELECT * FROM task_master ORDER BY category1, task_group, created_at');
  const tasks = tasksResult.rows;
  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = 'WorkFlow 업무시스템';
  wb.created = new Date();
  const ws = wb.addWorksheet('주요업무표', { properties: { defaultRowHeight: 22 } });

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '주요업무표';
  titleCell.font = s.titleFont;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:G2');
  const subCell = ws.getCell('A2');
  subCell.value = `작성일: ${new Date().toISOString().split('T')[0]}  |  총 ${tasks.length}건`;
  subCell.font = s.subTitleFont;
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 25;

  ws.getRow(3).height = 8;

  const headers = ['No.', '구분', '업무그룹', '세부 업무내용', '담당자', '비고', '등록일'];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = s.headerFill;
    cell.font = s.headerFont;
    cell.alignment = s.centerAlign;
    cell.border = s.borders;
  });
  headerRow.height = 28;

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 45;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 20;
  ws.getColumn(7).width = 12;

  const groupFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
  let prevGroup = '';
  tasks.forEach((t, idx) => {
    const row = ws.getRow(5 + idx);
    const isNewGroup = t.task_group !== prevGroup;
    prevGroup = t.task_group;
    const rowFill = isNewGroup ? groupFill : undefined;

    const vals = [idx + 1, t.category1 || '', t.task_group || '', t.task_detail || '', t.assigned_to || '', t.note || '', (t.created_at || '').split('T')[0]];
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = s.bodyFont;
      cell.alignment = i === 3 || i === 5 ? s.leftAlign : s.centerAlign;
      cell.border = s.borders;
      if (rowFill) cell.fill = rowFill;
    });
    row.height = 24;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=task_master_${new Date().toISOString().split('T')[0]}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── 엑셀 다운로드: 워크샵 참석 명단 ───
app.post('/api/export/workshop-roster', regionHeadMiddleware, async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = 'WorkFlow 업무시스템';
  wb.created = new Date();
  const ws = wb.addWorksheet('워크숍참석명단', { properties: { defaultRowHeight: 22 } });

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '이비티에스 협동조합 워크숍 참석 명단';
  titleCell.font = s.titleFont;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 40;

  ws.getRow(2).height = 8;

  const headers = ['번호', '이름', '소속', '직함', '나이', '성별', '비고사항'];
  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = s.headerFill;
    cell.font = s.headerFont;
    cell.alignment = s.centerAlign;
    cell.border = s.borders;
  });
  headerRow.height = 28;

  const widths = [6, 14, 24, 14, 8, 8, 26];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // 입력 행 + 빈 양식 최소 40행 유지
  const totalRows = Math.max(rows.length, 40);
  for (let i = 0; i < totalRows; i++) {
    const r = rows[i] || {};
    const row = ws.getRow(4 + i);
    const vals = [
      i + 1,
      r.name || '',
      r.affiliation || '',
      r.position || '',
      r.age || '',
      r.gender || '',
      r.note || ''
    ];
    vals.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.font = s.bodyFont;
      cell.alignment = c === 6 ? s.leftAlign : s.centerAlign;
      cell.border = s.borders;
    });
    row.height = 24;
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=workshop_roster_${new Date().toISOString().split('T')[0]}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── 엑셀 다운로드: 봉사활동 내역 (개인 전용) ───
app.get('/api/export/volunteer', authMiddleware, async (req, res) => {
  const result = await query(
    'SELECT * FROM volunteer_activities WHERE user_id = $1 ORDER BY activity_date DESC, created_at DESC',
    [req.session.userId]
  );
  const items = result.rows;
  const totalHours = items.reduce((sum, v) => sum + Number(v.hours || 0), 0);

  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = 'WorkFlow 업무시스템';
  wb.created = new Date();
  const ws = wb.addWorksheet('봉사활동내역', { properties: { defaultRowHeight: 22 } });

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '봉사활동 내역';
  titleCell.font = s.titleFont;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:G2');
  const subCell = ws.getCell('A2');
  subCell.value = `작성일: ${new Date().toISOString().split('T')[0]}  |  총 ${items.length}건  |  누적 ${totalHours}시간`;
  subCell.font = s.subTitleFont;
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 25;

  ws.getRow(3).height = 8;

  const headers = ['번호', '봉사일자', '활동명', '장소', '봉사시간', '참여인원', '활동내용'];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = s.headerFill;
    cell.font = s.headerFont;
    cell.alignment = s.centerAlign;
    cell.border = s.borders;
  });
  headerRow.height = 28;

  const widths = [6, 14, 26, 22, 10, 10, 40];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  items.forEach((v, idx) => {
    const row = ws.getRow(5 + idx);
    const vals = [
      idx + 1,
      (v.activity_date || '').toString().split('T')[0],
      v.title || '',
      v.location || '',
      Number(v.hours || 0),
      v.participants || '',
      v.content || ''
    ];
    vals.forEach((val, c) => {
      const cell = row.getCell(c + 1);
      cell.value = val;
      cell.font = s.bodyFont;
      cell.alignment = (c === 2 || c === 3 || c === 6) ? s.leftAlign : s.centerAlign;
      cell.border = s.borders;
    });
    row.height = 24;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=volunteer_${new Date().toISOString().split('T')[0]}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── 엑셀 다운로드: 개인업무표 ───
app.get('/api/export/personal-tasks', authMiddleware, async (req, res) => {
  const { person } = req.query;
  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = 'WorkFlow 업무시스템';

  const buildPersonSheet = (personName, tasks, ws) => {
    const info = tasks[0] || {};
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${personName} 개별 담당 업무표`;
    titleCell.font = s.titleFont;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 40;

    ws.mergeCells('A2:F2');
    const subCell = ws.getCell('A2');
    subCell.value = `${info.position || ''} / ${info.division || ''}  |  총 ${tasks.length}건`;
    subCell.font = s.subTitleFont;
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 25;

    ws.getRow(3).height = 8;

    const headers = ['No.', '업무그룹', '세부 업무내용', '부서', '직급', '비고'];
    const headerRow = ws.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.fill = s.headerFill;
      cell.font = s.headerFont;
      cell.alignment = s.centerAlign;
      cell.border = s.borders;
    });
    headerRow.height = 28;

    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 22;
    ws.getColumn(3).width = 45;
    ws.getColumn(4).width = 16;
    ws.getColumn(5).width = 10;
    ws.getColumn(6).width = 20;

    const groupFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FA' } };
    let prevGroup = '';
    tasks.forEach((t, idx) => {
      const row = ws.getRow(5 + idx);
      const isNewGroup = t.task_group !== prevGroup;
      prevGroup = t.task_group;

      const vals = [idx + 1, t.task_group || '', t.task_detail || '', t.department || '', t.position || '', t.note || ''];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = s.bodyFont;
        cell.alignment = i === 2 || i === 5 ? s.leftAlign : s.centerAlign;
        cell.border = s.borders;
        if (isNewGroup) cell.fill = groupFill;
      });
      row.height = 24;
    });
  };

  if (person) {
    const tasksResult = await query('SELECT * FROM personal_task_table WHERE person_name = $1 ORDER BY task_group', [person]);
    const ws = wb.addWorksheet(person.substring(0, 31));
    buildPersonSheet(person, tasksResult.rows, ws);
  } else {
    const personsResult = await query('SELECT DISTINCT person_name, position FROM personal_task_table ORDER BY position, person_name');
    for (const p of personsResult.rows) {
      const tasksResult = await query('SELECT * FROM personal_task_table WHERE person_name = $1 ORDER BY task_group', [p.person_name]);
      const ws = wb.addWorksheet(p.person_name.substring(0, 31));
      buildPersonSheet(p.person_name, tasksResult.rows, ws);
    }
  }

  const filename = person ? `personal_tasks_${person}_${new Date().toISOString().split('T')[0]}.xlsx` : `personal_tasks_all_${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── 엑셀 다운로드: 전체 업무매뉴얼 ───
app.get('/api/export/manual-org', authMiddleware, async (req, res) => {
  const tasksResult = await query(`
    SELECT what_task, work_category, purpose, how_method, why_reason, where_place, who,
      COUNT(*) as frequency, STRING_AGG(DISTINCT u.name, ',') as people,
      MAX(r.report_date) as last_date, MIN(r.report_date) as first_date
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category, purpose, how_method, why_reason, where_place, who ORDER BY frequency DESC
  `);
  const tasks = tasksResult.rows;

  const byCategory = {};
  tasks.forEach(t => {
    const cat = t.work_category || '기타';
    if (!byCategory[cat]) byCategory[cat] = [];
    let existing = byCategory[cat].find(e => e.task === t.what_task);
    if (existing) {
      existing.frequency += parseInt(t.frequency);
      if (t.how_method && !existing.methods.includes(t.how_method)) existing.methods.push(t.how_method);
      if (t.where_place && !existing.locations.includes(t.where_place)) existing.locations.push(t.where_place);
      if (t.why_reason && !existing.reasons.includes(t.why_reason)) existing.reasons.push(t.why_reason);
      if (t.people) t.people.split(',').forEach(p => { if (!existing.people.includes(p)) existing.people.push(p); });
    } else {
      byCategory[cat].push({
        task: t.what_task, purpose: t.purpose || '',
        methods: t.how_method ? [t.how_method] : [], reasons: t.why_reason ? [t.why_reason] : [],
        locations: t.where_place ? [t.where_place] : [], people: t.people ? t.people.split(',') : [],
        frequency: parseInt(t.frequency), last_date: t.last_date, first_date: t.first_date
      });
    }
  });

  const totalReportsResult = await query('SELECT COUNT(*) as cnt FROM work_reports');
  const totalReports = parseInt(totalReportsResult.rows[0].cnt);
  const totalPeopleResult = await query('SELECT COUNT(DISTINCT author_id) as cnt FROM work_reports');
  const totalPeople = parseInt(totalPeopleResult.rows[0].cnt);

  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = 'WorkFlow 업무시스템';
  const ws = wb.addWorksheet('전체 업무매뉴얼', { properties: { defaultRowHeight: 22 } });

  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '전체 업무매뉴얼';
  titleCell.font = s.titleFont;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:H2');
  const subCell = ws.getCell('A2');
  subCell.value = `작성일: ${new Date().toISOString().split('T')[0]}  |  총 ${totalReports}건 업무기록  |  참여인원 ${totalPeople}명  |  육하원칙 기반 자동생성`;
  subCell.font = s.subTitleFont;
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 25;
  ws.getRow(3).height = 8;

  const headers = ['분류', '업무명', '목적', '수행방법', '사유', '장소', '담당인원', '수행횟수'];
  const headerRow = ws.getRow(4);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = s.headerFill;
    cell.font = s.headerFont;
    cell.alignment = s.centerAlign;
    cell.border = s.borders;
  });
  headerRow.height = 28;

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 28;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 16;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 10;

  const catColors = {
    '내근': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF4FF' } },
    '외근': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FFF0' } },
    '출장': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
  };

  let rowIdx = 5;
  Object.entries(byCategory).forEach(([cat, items]) => {
    const catRow = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, 8);
    const catCell = catRow.getCell(1);
    catCell.value = `■ ${cat} 업무 (${items.length}건)`;
    catCell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF1B3A5C' } };
    catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E8F0' } };
    catCell.alignment = { vertical: 'middle', horizontal: 'left' };
    catCell.border = s.borders;
    catRow.height = 26;
    rowIdx++;

    items.forEach(t => {
      const row = ws.getRow(rowIdx);
      const vals = [cat, t.task, t.purpose, t.methods.join('\n'), t.reasons.join('\n'), t.locations.join(', '), t.people.join(', '), t.frequency];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = s.bodyFont;
        cell.alignment = i === 0 || i === 7 ? s.centerAlign : s.leftAlign;
        cell.border = s.borders;
        if (catColors[cat]) cell.fill = catColors[cat];
      });
      row.height = Math.max(24, 14 * Math.max(...vals.map(v => String(v).split('\n').length)));
      rowIdx++;
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=manual_org_${new Date().toISOString().split('T')[0]}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── 엑셀 다운로드: 내 업무매뉴얼 ───
app.get('/api/export/manual-my', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const userInfoResult = await query('SELECT name, position FROM users WHERE id = $1', [userId]);
  const userInfo = userInfoResult.rows[0];
  const userName = userInfo ? userInfo.name : '사용자';
  const userPos = userInfo ? userInfo.position : '';

  const tasksResult = await query(`
    SELECT what_task, work_category, purpose, how_method, why_reason, where_place, who,
      COUNT(*) as frequency, MAX(report_date) as last_date
    FROM work_reports WHERE author_id = $1 AND what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category, purpose, how_method, why_reason, where_place, who ORDER BY frequency DESC
  `, [userId]);
  const tasks = tasksResult.rows;

  const customManualResult = await query('SELECT * FROM personal_manual WHERE user_id = $1 ORDER BY sort_order, created_at', [userId]);
  const customManual = customManualResult.rows;

  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = 'WorkFlow 업무시스템';

  // 자동생성 매뉴얼 시트
  const ws1 = wb.addWorksheet('내 업무매뉴얼', { properties: { defaultRowHeight: 22 } });
  ws1.mergeCells('A1:H1');
  ws1.getCell('A1').value = `${userName} ${userPos} 업무매뉴얼`;
  ws1.getCell('A1').font = s.titleFont;
  ws1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 40;

  ws1.mergeCells('A2:H2');
  ws1.getCell('A2').value = `작성일: ${new Date().toISOString().split('T')[0]}  |  총 ${tasks.length}개 업무  |  ${tasks.reduce((a, t) => a + parseInt(t.frequency), 0)}건 기록 기반`;
  ws1.getCell('A2').font = s.subTitleFont;
  ws1.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 25;
  ws1.getRow(3).height = 8;

  const headers1 = ['No.', '목적/분류', '업무명', '수행방법', '사유', '장소', '수행횟수', '최근수행일'];
  const headerRow1 = ws1.getRow(4);
  headers1.forEach((h, i) => {
    const cell = headerRow1.getCell(i + 1);
    cell.value = h;
    cell.fill = s.headerFill;
    cell.font = s.headerFont;
    cell.alignment = s.centerAlign;
    cell.border = s.borders;
  });
  headerRow1.height = 28;

  ws1.getColumn(1).width = 6;
  ws1.getColumn(2).width = 16;
  ws1.getColumn(3).width = 30;
  ws1.getColumn(4).width = 28;
  ws1.getColumn(5).width = 22;
  ws1.getColumn(6).width = 16;
  ws1.getColumn(7).width = 10;
  ws1.getColumn(8).width = 14;

  tasks.forEach((t, idx) => {
    const row = ws1.getRow(5 + idx);
    const vals = [idx + 1, t.purpose || t.work_category || '', t.what_task, t.how_method || '', t.why_reason || '', t.where_place || '', parseInt(t.frequency), t.last_date || ''];
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = s.bodyFont;
      cell.alignment = i === 0 || i === 6 ? s.centerAlign : s.leftAlign;
      cell.border = s.borders;
    });
    if (idx % 2 === 1) {
      for (let i = 1; i <= 8; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
    row.height = 24;
  });

  // 직접 작성 매뉴얼 시트
  if (customManual.length > 0) {
    const ws2 = wb.addWorksheet('직접 작성 매뉴얼', { properties: { defaultRowHeight: 22 } });
    ws2.mergeCells('A1:F1');
    ws2.getCell('A1').value = `${userName} ${userPos} 직접 작성 매뉴얼`;
    ws2.getCell('A1').font = s.titleFont;
    ws2.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(1).height = 40;

    ws2.mergeCells('A2:F2');
    ws2.getCell('A2').value = `총 ${customManual.length}건`;
    ws2.getCell('A2').font = s.subTitleFont;
    ws2.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(2).height = 25;
    ws2.getRow(3).height = 8;

    const headers2 = ['No.', '업무그룹', '제목', '내용', '절차/단계', 'TIP'];
    const headerRow2 = ws2.getRow(4);
    headers2.forEach((h, i) => {
      const cell = headerRow2.getCell(i + 1);
      cell.value = h;
      cell.fill = s.headerFill;
      cell.font = s.headerFont;
      cell.alignment = s.centerAlign;
      cell.border = s.borders;
    });
    headerRow2.height = 28;

    ws2.getColumn(1).width = 6;
    ws2.getColumn(2).width = 14;
    ws2.getColumn(3).width = 22;
    ws2.getColumn(4).width = 35;
    ws2.getColumn(5).width = 35;
    ws2.getColumn(6).width = 25;

    customManual.forEach((item, idx) => {
      const row = ws2.getRow(5 + idx);
      const vals = [idx + 1, item.task_group || '', item.title || '', item.content || '', item.steps || '', item.tips || ''];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.font = s.bodyFont;
        cell.alignment = i === 0 ? s.centerAlign : s.leftAlign;
        cell.border = s.borders;
      });
      row.height = Math.max(24, 14 * Math.max(...vals.map(v => String(v).split('\n').length)));
    });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=manual_${encodeURIComponent(userName)}_${new Date().toISOString().split('T')[0]}.xlsx`);
  await wb.xlsx.write(res);
  res.end();
});

// ─── 시크릿: 회의록 인사이트 분석 ───
app.get('/api/admin/insights', adminMiddleware, async (req, res) => { try {
  await query(`ALTER TABLE work_reports ADD COLUMN IF NOT EXISTS result_status TEXT DEFAULT ''`).catch(() => {});
  const notesResult = await query('SELECT * FROM meeting_notes WHERE summary IS NOT NULL ORDER BY meeting_date DESC');
  const notes = notesResult.rows;

  const reportsResult = await query(`
    SELECT MIN(report_date) as first_date, MAX(report_date) as last_date, COUNT(*) as cnt
    FROM work_reports
  `);
  const repStats = reportsResult.rows[0];

  const catResult = await query(`
    SELECT work_category, COUNT(*) as cnt FROM work_reports
    WHERE work_category IS NOT NULL GROUP BY work_category ORDER BY cnt DESC
  `);

  const recentResult = await query(`
    SELECT what_task, work_category, where_place, result_status, report_date
    FROM work_reports WHERE report_date >= NOW() - INTERVAL '14 days' ORDER BY report_date DESC
  `);
  const recentReports = recentResult.rows;

  const completedCount = recentReports.filter(r => (r.result_status||'').includes('완료')).length;
  const ongoingCount = recentReports.filter(r => (r.result_status||'').includes('진행')).length;
  const totalRecent = recentReports.length;

  const allActions = [];
  const allThemes = [];
  const themeCounts = {};

  notes.forEach(note => {
    const sections = note.summary.split(/### /).filter(Boolean);
    sections.forEach(section => {
      const lines = section.split('\n');
      const title = lines[0].trim();
      const items = lines.slice(1).filter(l => l.startsWith('- ')).map(l => l.substring(2).trim());
      allThemes.push(title);
      themeCounts[title] = (themeCounts[title] || 0) + 1;
      if (/액션|Action|실행/.test(title)) {
        items.forEach(item => allActions.push({ text: item, date: note.meeting_date, from: note.title }));
      }
    });
  });

  const uniqueThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => ({ theme: t, count: c }));

  const dates = [];
  if (notes.length > 0) { dates.push(notes[notes.length - 1].meeting_date); dates.push(notes[0].meeting_date); }
  if (repStats.first_date) dates.push(repStats.first_date);
  if (repStats.last_date) dates.push(repStats.last_date);
  const sortedDates = dates.map(d => (d||'').toString().split('T')[0]).filter(d => d).sort();
  const dateFrom = sortedDates[0] || new Date().toISOString().split('T')[0];
  const dateTo = sortedDates[sortedDates.length - 1] || new Date().toISOString().split('T')[0];

  const topCategories = catResult.rows.slice(0, 5).map(c => c.work_category).join(', ');
  const topPlaces = [...new Set(recentReports.map(r => r.where_place).filter(Boolean))].slice(0, 5).join(', ');
  const completionRate = totalRecent > 0 ? Math.round(completedCount / totalRecent * 100) : 0;

  res.json({
    generated_at: new Date().toISOString(),
    notes_analyzed: notes.length + parseInt(repStats.cnt || 0),
    total_notes: ((await query('SELECT COUNT(*) as cnt FROM meeting_notes').catch(() => ({ rows: [{ cnt: 0 }] }))).rows[0] || { cnt: 0 }).cnt,
    total_reports: parseInt(repStats.cnt || 0),
    date_range: { from: dateFrom, to: dateTo },
    report_stats: { categories: topCategories, places: topPlaces, completion_rate: completionRate, recent_count: totalRecent },
    notes_summary: notes.map(n => ({ id: n.id, title: n.title, date: n.meeting_date })),
    themes: uniqueThemes,
    action_items: allActions,
    positive: {
      deductive: {
        major: '체계적 업무 관리와 데이터 기반 의사결정을 추진하는 조직은 생산성을 확보한다',
        minor: '업무일지, 주간계획, 회의록 등 체계적인 업무 기록과 분석이 이루어지고 있다',
        conclusion: '현 업무 관리 체계가 정착될 경우, 조직 전체의 업무 효율이 크게 향상될 가능성이 높다'
      },
      inductive: {
        observations: [
          '정기적 업무일지 작성 → 업무 가시성 향상 → 효율적 자원 배분',
          '주간계획 수립 → 목표 지향적 업무 수행 → 달성률 향상',
          '회의록 체계화 → 의사결정 추적 가능 → 실행력 강화',
          '업무 데이터 축적 → 패턴 분석 가능 → 지속적 개선',
          '팀 내 업무 공유 → 협업 효율 증가 → 중복 업무 감소'
        ],
        prediction: '업무 기록과 분석 체계가 안착하면, 조직 전체의 업무 효율이 향상되고 데이터 기반의 의사결정이 가능해질 것이다.'
      }
    },
    negative: {
      deductive: {
        major: '동시다발적 업무 추진은 핵심 역량의 분산과 실행력 저하를 초래할 수 있다',
        minor: '여러 프로젝트가 동시에 진행되고 있으며, 업무 우선순위 조정이 필요한 상황이다',
        conclusion: '우선순위 미설정 시, 핵심 업무의 완결도가 낮아질 위험이 있다'
      },
      inductive: {
        observations: [
          '동시 진행 업무 과다 → 집중력 분산의 신호',
          '업무일지 미작성 인원 존재 → 업무 공유 공백 가능성',
          '반복 업무의 비효율 → 프로세스 개선 필요',
          '부서 간 소통 부족 → 협업 효율 저하 가능성',
          '업무 데이터 활용 부족 → 개선 기회 누락 가능성'
        ],
        prediction: '업무 관리 체계가 정착되지 않으면, 조직 피로도가 상승하고 핵심 인력의 업무 만족도가 저하될 수 있다.'
      }
    },
    recommendation: {
      worst: '모든 업무를 동시에 추진하다 어느 것도 완결하지 못하는 시나리오',
      best: '모든 프로젝트가 완벽히 실행되는 시나리오 (비현실적)',
      second_best: '핵심 과제에 집중하고, 나머지는 순차 추진하여 확실한 기반 위에 성장하는 전략',
      actions: [
        { priority: '최우선', task: '핵심 업무 우선순위 설정', reason: '가장 중요한 업무에 집중하여 완결도를 높이는 것이 성과의 핵심' },
        { priority: '최우선', task: '업무일지 작성 습관화', reason: '업무 가시성 확보가 효율적 자원 배분의 전제조건' },
        { priority: '우선', task: '주간계획 기반 업무 수행', reason: '계획적 업무 수행이 달성률 향상의 핵심' },
        { priority: '보류 가능', task: '프로세스 자동화', reason: '기반이 다져진 후 자동화를 추진해도 효과는 동일' },
        { priority: '보류 가능', task: '신규 기능 도입', reason: '기존 기능 활용도를 높인 후 순차 도입 권장' }
      ]
    }
  });
  } catch (err) { console.error('Insights error:', err.message); res.status(500).json({ error: '서버 오류: ' + err.message }); }
});

// ─── 회의록 ───
app.get('/api/meeting-notes', authMiddleware, async (req, res) => {
  const result = await query('SELECT id, title, meeting_date, notion_url, CASE WHEN summary IS NOT NULL THEN true ELSE false END as has_summary FROM meeting_notes ORDER BY meeting_date DESC');
  res.json(result.rows);
});

app.get('/api/meeting-notes/:id', authMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM meeting_notes WHERE id = $1', [req.params.id]);
  const note = result.rows[0];
  if (!note) return res.status(404).json({ error: '회의록을 찾을 수 없습니다' });
  res.json(note);
});

// ─── 업무 지식맵 ───
app.get('/api/knowledge-map', authMiddleware, async (req, res) => {
  const totalResult = await query('SELECT COUNT(*) as cnt FROM work_reports');
  const totalReports = parseInt(totalResult.rows[0].cnt);

  if (totalReports === 0) return res.json({ empty: true, total_reports: 0 });

  const peopleResult = await query(`
    SELECT u.id, u.name, u.position, COUNT(r.id) as report_count
    FROM users u JOIN work_reports r ON u.id = r.author_id
    GROUP BY u.id, u.name, u.position ORDER BY report_count DESC
  `);

  const dateResult = await query('SELECT MIN(report_date) as first, MAX(report_date) as last FROM work_reports');

  const categoryResult = await query(`
    SELECT work_category, COUNT(*) as cnt FROM work_reports
    WHERE work_category IS NOT NULL GROUP BY work_category ORDER BY cnt DESC
  `);

  const tasksResult = await query(`
    SELECT what_task, work_category, purpose, how_method, where_place, who,
      COUNT(*) as frequency,
      STRING_AGG(DISTINCT u.name, ',') as people,
      MAX(r.report_date) as last_date
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category, purpose, how_method, where_place, who
    ORDER BY frequency DESC
  `);

  const personTaskResult = await query(`
    SELECT u.name, r.work_category, r.what_task, COUNT(*) as cnt
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.what_task IS NOT NULL AND r.what_task != ''
    GROUP BY u.name, r.work_category, r.what_task
    ORDER BY u.name, cnt DESC
  `);

  const consolidated = {};
  tasksResult.rows.forEach(t => {
    const cat = t.work_category || '기타';
    const key = `${cat}::${t.what_task}`;
    if (!consolidated[key]) {
      consolidated[key] = {
        task: t.what_task, category: cat, purpose: t.purpose || '',
        methods: [], locations: [], people: [], frequency: 0, last_date: t.last_date
      };
    }
    const c = consolidated[key];
    c.frequency += parseInt(t.frequency);
    if (t.how_method && !c.methods.includes(t.how_method)) c.methods.push(t.how_method);
    if (t.where_place && !c.locations.includes(t.where_place)) c.locations.push(t.where_place);
    if (t.people) t.people.split(',').forEach(p => { if (!c.people.includes(p)) c.people.push(p); });
  });

  const tasks = Object.values(consolidated);
  const patterns = tasks.filter(t => t.frequency >= 3);
  const byCategory = {};
  tasks.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  });

  const personMap = {};
  personTaskResult.rows.forEach(r => {
    if (!personMap[r.name]) personMap[r.name] = [];
    personMap[r.name].push({ task: r.what_task, category: r.work_category, count: parseInt(r.cnt) });
  });

  const mSafe = (s) => s.replace(/["\[\](){}|<>#]/g, ' ').trim();
  let mermaid = 'graph TD\n';
  mermaid += '  ROOT["업무 지식맵"]\n';
  const catIds = {};
  Object.keys(byCategory).forEach((cat, i) => {
    const cid = `C${i}`;
    catIds[cat] = cid;
    mermaid += `  ROOT --> ${cid}["${mSafe(cat)} (${byCategory[cat].length}건)"]\n`;
  });
  Object.entries(byCategory).forEach(([cat, catTasks]) => {
    const top = catTasks.sort((a, b) => b.frequency - a.frequency).slice(0, 5);
    top.forEach((t, j) => {
      const tid = `${catIds[cat]}T${j}`;
      let label = mSafe(t.task);
      if (label.length > 15) label = label.substring(0, 15) + '..';
      mermaid += `  ${catIds[cat]} --> ${tid}["${label}"]\n`;
      t.people.slice(0, 2).forEach((p, k) => {
        mermaid += `  ${tid} -.-> ${tid}P${k}(("${mSafe(p)}"))\n`;
      });
    });
  });

  res.json({
    total_reports: totalReports,
    total_people: peopleResult.rows.length,
    date_range: { from: dateResult.rows[0].first, to: dateResult.rows[0].last },
    categories: categoryResult.rows.map(r => ({ name: r.work_category, count: parseInt(r.cnt), pct: Math.round(parseInt(r.cnt) / totalReports * 100) })),
    people: peopleResult.rows.map(r => ({ name: r.name, position: r.position, count: parseInt(r.report_count) })),
    tasks_by_category: byCategory,
    patterns,
    person_tasks: personMap,
    mermaid,
    total_tasks: tasks.length
  });
});

// ─── 워크플로우 다이어그램 ───
app.get('/api/workflow-diagrams', authMiddleware, async (req, res) => {
  const ms = (s) => s.replace(/["\[\](){}|<>#&;]/g, ' ').replace(/\s+/g, ' ').trim();

  const totalResult = await query('SELECT COUNT(*) as cnt FROM work_reports');
  if (parseInt(totalResult.rows[0].cnt) === 0) return res.json({ empty: true });

  const catTaskResult = await query(`
    SELECT r.work_category, r.what_task, r.purpose, r.how_method, r.where_place,
      COUNT(*) as cnt, STRING_AGG(DISTINCT u.name, ',') as people
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.what_task IS NOT NULL AND r.what_task != ''
    GROUP BY r.work_category, r.what_task, r.purpose, r.how_method, r.where_place
    ORDER BY cnt DESC
  `);

  const personResult = await query(`
    SELECT u.name, u.position, r.what_task, r.work_category, COUNT(*) as cnt
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.what_task IS NOT NULL AND r.what_task != ''
    GROUP BY u.name, u.position, r.what_task, r.work_category
    ORDER BY u.name, cnt DESC
  `);

  const consolidated = {};
  catTaskResult.rows.forEach(r => {
    const cat = r.work_category || '기타';
    const key = `${cat}::${r.what_task}`;
    if (!consolidated[key]) {
      consolidated[key] = { task: r.what_task, category: cat, purpose: r.purpose || '', methods: [], locations: [], people: [], cnt: 0 };
    }
    const c = consolidated[key];
    c.cnt += parseInt(r.cnt);
    if (r.how_method && !c.methods.includes(r.how_method)) c.methods.push(r.how_method);
    if (r.where_place && !c.locations.includes(r.where_place)) c.locations.push(r.where_place);
    if (r.people) r.people.split(',').forEach(p => { if (!c.people.includes(p)) c.people.push(p); });
  });

  const tasks = Object.values(consolidated);
  const byCategory = {};
  tasks.forEach(t => {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  });

  // 1. 전체 구조도
  let overview = 'graph TD\n';
  overview += '  ORG["조직 업무"]\n';
  Object.entries(byCategory).forEach(([cat, catTasks], ci) => {
    const cid = `C${ci}`;
    overview += `  ORG --> ${cid}["${ms(cat)}<br/>${catTasks.length}개 업무"]\n`;
    overview += `  style ${cid} fill:#e3f2fd,stroke:#1a73e8\n`;
    const top = catTasks.sort((a, b) => b.cnt - a.cnt).slice(0, 6);
    top.forEach((t, ti) => {
      const tid = `${cid}T${ti}`;
      let label = ms(t.task);
      if (label.length > 12) label = label.substring(0, 12) + '..';
      overview += `  ${cid} --> ${tid}["${label}<br/>${t.cnt}회"]\n`;
      if (t.cnt >= 5) overview += `  style ${tid} fill:#e8f5e9,stroke:#43a047\n`;
      else if (t.cnt >= 3) overview += `  style ${tid} fill:#fff3e0,stroke:#e65100\n`;
    });
    if (catTasks.length > 6) {
      overview += `  ${cid} --> ${cid}ETC["외 ${catTasks.length - 6}건"]\n`;
      overview += `  style ${cid}ETC fill:#f5f5f5,stroke:#bbb\n`;
    }
  });

  // 2. 카테고리별 프로세스 맵
  const categoryDiagrams = {};
  Object.entries(byCategory).forEach(([cat, catTasks]) => {
    let d = 'graph LR\n';
    const sorted = catTasks.sort((a, b) => b.cnt - a.cnt);
    sorted.slice(0, 10).forEach((t, i) => {
      const tid = `T${i}`;
      const tname = ms(t.task);
      const label = tname.length > 15 ? tname.substring(0, 15) + '..' : tname;
      d += `  ${tid}["${label}"]\n`;
      if (t.purpose) {
        const plabel = ms(t.purpose);
        d += `  ${tid} --> ${tid}P["${plabel.length > 15 ? plabel.substring(0, 15) + '..' : plabel}"]\n`;
        d += `  style ${tid}P fill:#e8f0fe,stroke:#1a73e8\n`;
      }
      if (t.methods.length > 0) {
        const mlabel = ms(t.methods[0]);
        d += `  ${tid} --> ${tid}M["${mlabel.length > 15 ? mlabel.substring(0, 15) + '..' : mlabel}"]\n`;
        d += `  style ${tid}M fill:#e8f5e9,stroke:#43a047\n`;
      }
      if (t.locations.length > 0) {
        d += `  ${tid} --> ${tid}L["${ms(t.locations[0]).substring(0, 15)}"]\n`;
        d += `  style ${tid}L fill:#fff3e0,stroke:#e65100\n`;
      }
      if (t.cnt >= 5) d += `  style ${tid} fill:#c8e6c9,stroke:#2e7d32\n`;
    });
    categoryDiagrams[cat] = d;
  });

  // 3. 담당자 관계도
  const personTasks = {};
  personResult.rows.forEach(r => {
    if (!personTasks[r.name]) personTasks[r.name] = { position: r.position, tasks: [] };
    personTasks[r.name].tasks.push({ task: r.what_task, category: r.work_category, cnt: parseInt(r.cnt) });
  });

  let relation = 'graph TD\n';
  const personIds = {};
  Object.keys(personTasks).forEach((name, i) => { personIds[name] = `P${i}`; });

  Object.entries(personTasks).forEach(([name, data]) => {
    const pid = personIds[name];
    relation += `  ${pid}(("${ms(name)}<br/>${ms(data.position || '')}"))\n`;
    relation += `  style ${pid} fill:#e3f2fd,stroke:#1a73e8\n`;
    const topTasks = data.tasks.sort((a, b) => b.cnt - a.cnt).slice(0, 4);
    topTasks.forEach((t, j) => {
      const tid = `${pid}W${j}`;
      let label = ms(t.task);
      if (label.length > 12) label = label.substring(0, 12) + '..';
      relation += `  ${pid} --> ${tid}["${label}"]\n`;
    });
  });

  const taskPeople = {};
  personResult.rows.forEach(r => {
    if (!taskPeople[r.what_task]) taskPeople[r.what_task] = new Set();
    taskPeople[r.what_task].add(r.name);
  });
  const connections = new Set();
  Object.values(taskPeople).forEach(people => {
    const arr = [...people];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort().join('::');
        if (!connections.has(key) && personIds[arr[i]] && personIds[arr[j]]) {
          connections.add(key);
          relation += `  ${personIds[arr[i]]} -.- ${personIds[arr[j]]}\n`;
        }
      }
    }
  });

  res.json({
    overview,
    category_diagrams: categoryDiagrams,
    relation,
    categories: Object.keys(byCategory)
  });
});

// ─── 신입 온보딩 가이드 ───
app.get('/api/onboarding', authMiddleware, async (req, res) => {
  const totalResult = await query('SELECT COUNT(*) as cnt FROM work_reports');
  const totalReports = parseInt(totalResult.rows[0].cnt);

  const peopleResult = await query(`
    SELECT u.name, u.position, COUNT(r.id) as cnt
    FROM users u JOIN work_reports r ON u.id = r.author_id
    GROUP BY u.name, u.position ORDER BY cnt DESC
  `);

  const catResult = await query(`
    SELECT work_category, COUNT(*) as cnt FROM work_reports
    WHERE work_category IS NOT NULL GROUP BY work_category ORDER BY cnt DESC
  `);

  const topTasksResult = await query(`
    SELECT r.what_task, r.work_category, r.purpose, r.how_method, r.where_place,
      COUNT(*) as frequency, STRING_AGG(DISTINCT u.name, ',') as people
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.what_task IS NOT NULL AND r.what_task != ''
    GROUP BY r.what_task, r.work_category, r.purpose, r.how_method, r.where_place
    ORDER BY frequency DESC
  `);

  const consolidated = {};
  topTasksResult.rows.forEach(r => {
    const key = r.what_task;
    if (!consolidated[key]) {
      consolidated[key] = { task: r.what_task, category: r.work_category || '기타', purpose: r.purpose || '',
        methods: [], locations: [], people: [], frequency: 0 };
    }
    const c = consolidated[key];
    c.frequency += parseInt(r.frequency);
    if (r.how_method && !c.methods.includes(r.how_method)) c.methods.push(r.how_method);
    if (r.where_place && !c.locations.includes(r.where_place)) c.locations.push(r.where_place);
    if (r.people) r.people.split(',').forEach(p => { if (!c.people.includes(p)) c.people.push(p); });
  });

  const allTasks = Object.values(consolidated).sort((a, b) => b.frequency - a.frequency);
  const coreTasks = allTasks.filter(t => t.frequency >= 3);
  const regularTasks = allTasks.filter(t => t.frequency >= 5);

  const personRoles = {};
  const personTaskResult = await query(`
    SELECT u.name, u.position, r.what_task, r.work_category, COUNT(*) as cnt
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.what_task IS NOT NULL AND r.what_task != ''
    GROUP BY u.name, u.position, r.what_task, r.work_category ORDER BY cnt DESC
  `);
  personTaskResult.rows.forEach(r => {
    if (!personRoles[r.name]) personRoles[r.name] = { position: r.position, tasks: [] };
    personRoles[r.name].tasks.push({ task: r.what_task, category: r.work_category, cnt: parseInt(r.cnt) });
  });

  const branchCount = await query('SELECT COUNT(*) as cnt FROM branches WHERE exclude_service = 0');

  res.json({
    total_reports: totalReports,
    total_people: peopleResult.rows.length,
    people: peopleResult.rows.map(r => ({ name: r.name, position: r.position, reports: parseInt(r.cnt) })),
    categories: catResult.rows.map(r => ({ name: r.work_category, count: parseInt(r.cnt) })),
    core_tasks: coreTasks.slice(0, 15),
    regular_tasks: regularTasks.slice(0, 10),
    all_tasks_count: allTasks.length,
    person_roles: personRoles,
    branch_count: parseInt(branchCount.rows[0].cnt)
  });
});

// ─── 부서 목표 & 방향성 ───
app.get('/api/direction', authMiddleware, async (req, res) => {
  const notesResult = await query(`SELECT * FROM meeting_notes WHERE summary IS NOT NULL ORDER BY meeting_date DESC`);
  const notes = notesResult.rows;

  const peopleResult = await query(`
    SELECT u.name, u.position, COUNT(r.id) as cnt,
      STRING_AGG(DISTINCT r.work_category, ',') as categories
    FROM users u JOIN work_reports r ON u.id = r.author_id
    GROUP BY u.name, u.position ORDER BY cnt DESC
  `);

  const recentTasksResult = await query(`
    SELECT what_task, work_category, COUNT(*) as cnt, STRING_AGG(DISTINCT u.name, ',') as people
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE what_task IS NOT NULL AND what_task != '' AND report_date >= NOW() - INTERVAL '30 days'
    GROUP BY what_task, work_category ORDER BY cnt DESC LIMIT 20
  `);

  const goals = [];
  const actions = [];
  const themes = [];

  notes.forEach(note => {
    const lines = (note.summary || '').split('\n');
    let currentSection = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('##')) {
        currentSection = trimmed.replace(/^#+\s*/, '');
        themes.push(currentSection);
      } else if (trimmed.startsWith('- ')) {
        const item = trimmed.substring(2).trim();
        if (/목표|방향|전략|계획|추진|확대|강화|완성|달성|구축/.test(currentSection + item)) {
          goals.push({ text: item, from: note.title, date: note.meeting_date });
        }
        if (/액션|실행|할\s*일|조치|이행|추진|과제/.test(currentSection)) {
          actions.push({ text: item, from: note.title, date: note.meeting_date });
        }
      }
    });
  });

  const uniqueGoals = [];
  const goalTexts = new Set();
  goals.forEach(g => {
    const key = g.text.substring(0, 20);
    if (!goalTexts.has(key)) { goalTexts.add(key); uniqueGoals.push(g); }
  });

  const uniqueActions = [];
  const actionTexts = new Set();
  actions.forEach(a => {
    const key = a.text.substring(0, 20);
    if (!actionTexts.has(key)) { actionTexts.add(key); uniqueActions.push(a); }
  });

  const memberDirections = peopleResult.rows.map(p => {
    const cats = (p.categories || '').split(',');
    const mainCat = cats[0] || '내근';
    const focus = [];
    if (mainCat === '외근') focus.push('현장 방문 및 외부 업무 집중');
    if (mainCat === '내근') focus.push('내부 행정 및 보고 업무 지원');
    if (mainCat === '출장') focus.push('지역 확장 및 네트워크 강화');
    if (parseInt(p.cnt) < 5) focus.push('업무일지 작성 빈도 높이기');
    uniqueGoals.slice(0, 2).forEach(g => {
      focus.push(g.text.length > 30 ? g.text.substring(0, 30) + '..' : g.text);
    });
    return { name: p.name, position: p.position, mainCategory: mainCat, reportCount: parseInt(p.cnt), directions: focus.slice(0, 3) };
  });

  res.json({
    goals: uniqueGoals.slice(0, 10),
    actions: uniqueActions.slice(0, 15),
    themes: [...new Set(themes)].slice(0, 10),
    member_directions: memberDirections,
    meeting_count: notes.length,
    recent_tasks: recentTasksResult.rows.map(r => ({
      task: r.what_task, category: r.work_category, count: parseInt(r.cnt), people: r.people
    }))
  });
});

// ─── 개인 업무 인사이트 ───
app.get('/api/personal-insight', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;

  const userResult = await query('SELECT name, position FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] || { name: '사용자', position: '' };

  const totalResult = await query('SELECT COUNT(*) as cnt FROM work_reports WHERE author_id = $1', [userId]);
  const total = parseInt(totalResult.rows[0].cnt);
  if (total === 0) return res.json({ empty: true, user });

  const catResult = await query(`
    SELECT work_category, COUNT(*) as cnt FROM work_reports
    WHERE author_id = $1 AND work_category IS NOT NULL GROUP BY work_category ORDER BY cnt DESC
  `, [userId]);

  const monthlyResult = await query(`
    SELECT TO_CHAR(report_date, 'YYYY-MM') as month, COUNT(*) as cnt
    FROM work_reports WHERE author_id = $1
    GROUP BY TO_CHAR(report_date, 'YYYY-MM') ORDER BY month DESC LIMIT 6
  `, [userId]);

  const topTasksResult = await query(`
    SELECT what_task, work_category, purpose, how_method, COUNT(*) as cnt, MAX(report_date) as last
    FROM work_reports WHERE author_id = $1 AND what_task IS NOT NULL AND what_task != ''
    GROUP BY what_task, work_category, purpose, how_method ORDER BY cnt DESC LIMIT 10
  `, [userId]);

  const recentResult = await query(`
    SELECT what_task, work_category, report_date FROM work_reports
    WHERE author_id = $1 ORDER BY report_date DESC LIMIT 20
  `, [userId]);

  const dateResult = await query(`
    SELECT MIN(report_date) as first, MAX(report_date) as last FROM work_reports WHERE author_id = $1
  `, [userId]);

  const cats = catResult.rows;
  const monthly = monthlyResult.rows;
  const topTasks = topTasksResult.rows;
  const recent = recentResult.rows;

  const positive = [];
  const negative = [];
  const predictions = [];
  const recommendations = [];

  if (total >= 10) positive.push({ title: '꾸준한 기록', detail: `총 ${total}건의 업무일지를 작성했습니다. 업무 데이터가 축적되고 있습니다.` });
  if (total < 5) negative.push({ title: '기록 부족', detail: '업무일지 작성이 부족합니다. 일일 업무를 기록하면 업무 추적과 인수인계에 도움이 됩니다.' });

  const mainCat = cats[0];
  if (mainCat) {
    const pct = Math.round(mainCat.cnt / total * 100);
    if (pct > 70) {
      positive.push({ title: `${mainCat.work_category} 전문성`, detail: `업무의 ${pct}%가 ${mainCat.work_category}으로, 해당 영역의 전문성이 높습니다.` });
      if (cats.length === 1) {
        negative.push({ title: '업무 편중', detail: `${mainCat.work_category} 업무에 집중되어 있습니다. 다양한 업무 경험이 필요할 수 있습니다.` });
      }
    }
    if (cats.length >= 3) positive.push({ title: '다양한 업무 경험', detail: `${cats.map(c => c.work_category).join(', ')} 등 ${cats.length}가지 유형의 업무를 수행하고 있습니다.` });
  }

  const coreTasks = topTasks.filter(t => parseInt(t.cnt) >= 3);
  if (coreTasks.length > 0) {
    positive.push({ title: '확립된 핵심 업무', detail: `${coreTasks.map(t => t.what_task).join(', ')} 등 ${coreTasks.length}개의 정기 업무가 확립되었습니다.` });
  }

  if (monthly.length >= 2) {
    const cur = parseInt(monthly[0].cnt);
    const prev = parseInt(monthly[1].cnt);
    if (cur > prev) {
      positive.push({ title: '활동량 증가', detail: `지난달(${prev}건) 대비 이번달(${cur}건) 활동량이 ${Math.round((cur - prev) / prev * 100)}% 증가했습니다.` });
      predictions.push({ type: 'positive', text: '현재 추세가 유지되면 업무 기여도가 지속적으로 상승할 것으로 예상됩니다.' });
    } else if (cur < prev * 0.5) {
      negative.push({ title: '활동량 급감', detail: `지난달(${prev}건) 대비 이번달(${cur}건)으로 활동량이 크게 줄었습니다.` });
      predictions.push({ type: 'negative', text: '활동량 감소가 지속되면 업무 공백이 발생할 수 있습니다. 원인 파악이 필요합니다.' });
    }
  }

  if (coreTasks.length >= 3) {
    predictions.push({ type: 'positive', text: `${coreTasks.length}개의 핵심 업무를 안정적으로 수행 중이며, 해당 분야의 전문가로 성장할 가능성이 높습니다.` });
  }

  const lastDate = dateResult.rows[0].last;
  const daysSinceLast = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
  if (daysSinceLast > 7) {
    negative.push({ title: '최근 기록 공백', detail: `마지막 업무일지 작성 후 ${daysSinceLast}일이 지났습니다.` });
    predictions.push({ type: 'negative', text: '기록 공백이 길어지면 업무 히스토리 추적이 어려워집니다.' });
  }

  if (negative.length > positive.length) {
    recommendations.push('업무일지를 매일 작성하는 습관을 만들어보세요. 간단한 기록이라도 축적되면 큰 자산이 됩니다.');
  }
  if (cats.length === 1 && total >= 5) {
    recommendations.push(`현재 ${cats[0].work_category} 중심이므로, 다른 유형의 업무에도 참여해보면 시야를 넓힐 수 있습니다.`);
  }
  if (coreTasks.length > 0) {
    recommendations.push(`핵심 업무(${coreTasks[0].what_task})의 절차를 매뉴얼로 정리해두면 인수인계 시 큰 도움이 됩니다.`);
  }
  if (total >= 10 && positive.length > negative.length) {
    recommendations.push('현재 방향이 좋습니다. 꾸준한 기록과 다양한 업무 경험을 유지해주세요.');
  }

  res.json({
    user, total,
    date_range: { from: dateResult.rows[0].first, to: dateResult.rows[0].last },
    categories: cats.map(c => ({ name: c.work_category, count: parseInt(c.cnt), pct: Math.round(parseInt(c.cnt) / total * 100) })),
    monthly: monthly.reverse(),
    top_tasks: topTasks.map(t => ({ task: t.what_task, category: t.work_category, count: parseInt(t.cnt), last: t.last })),
    positive, negative, predictions, recommendations
  });
});

// ─── 공지사항 ───
app.get('/api/notices', authMiddleware, async (req, res) => {
  const all = req.query.all === '1';
  const sql = all
    ? 'SELECT * FROM notices ORDER BY pinned DESC, created_at DESC'
    : 'SELECT * FROM notices WHERE active = TRUE ORDER BY pinned DESC, created_at DESC';
  const result = await query(sql);
  res.json(result.rows);
});

app.post('/api/notices', adminMiddleware, async (req, res) => {
  const { title, content, priority, pinned } = req.body;
  if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력하세요' });
  const id = uuidv4();
  await query(
    `INSERT INTO notices (id, title, content, priority, pinned) VALUES ($1, $2, $3, $4, $5)`,
    [id, title, content, priority || 'normal', pinned || false]
  );
  res.json({ id });
});

app.put('/api/notices/:id', adminMiddleware, async (req, res) => {
  const { title, content, priority, pinned, active } = req.body;
  await query(
    `UPDATE notices SET title = COALESCE($1, title), content = COALESCE($2, content),
     priority = COALESCE($3, priority), pinned = COALESCE($4, pinned),
     active = COALESCE($5, active), updated_at = NOW() WHERE id = $6`,
    [title, content, priority, pinned, active, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/notices/:id', adminMiddleware, async (req, res) => {
  await query('DELETE FROM notices WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── 월간 업무 요약 ───
app.get('/api/monthly-summary', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;
  const month = req.query.month || new Date().toISOString().substring(0, 7);

  const userResult = await query('SELECT name, position FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] || { name: '사용자', position: '' };

  const reportsResult = await query(`
    SELECT * FROM work_reports WHERE author_id = $1 AND TO_CHAR(report_date, 'YYYY-MM') = $2
    ORDER BY report_date ASC
  `, [userId, month]);
  const reports = reportsResult.rows;

  if (reports.length === 0) return res.json({ empty: true, user, month });

  const catCount = {};
  const taskCount = {};
  const placeCount = {};
  const weeklyBreakdown = {};
  const dailyDates = [];

  reports.forEach(r => {
    const cat = r.work_category || '기타';
    catCount[cat] = (catCount[cat] || 0) + 1;

    if (r.what_task) {
      taskCount[r.what_task] = (taskCount[r.what_task] || 0) + 1;
    }
    if (r.where_place) {
      placeCount[r.where_place] = (placeCount[r.where_place] || 0) + 1;
    }

    const date = (r.report_date || '').split('T')[0];
    dailyDates.push(date);
    const weekNum = Math.ceil(new Date(date).getDate() / 7);
    const wk = `${weekNum}주차`;
    if (!weeklyBreakdown[wk]) weeklyBreakdown[wk] = [];
    weeklyBreakdown[wk].push({ task: r.what_task || r.content || '', category: cat, date });
  });

  const topTasks = Object.entries(taskCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([task, count]) => ({ task, count }));
  const topPlaces = Object.entries(placeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([place, count]) => ({ place, count }));
  const categories = Object.entries(catCount).map(([name, count]) => ({ name, count, pct: Math.round(count / reports.length * 100) }));

  const uniqueDays = [...new Set(dailyDates)].length;
  const [sy, sm] = month.split('-').map(Number);
  const workDaysInMonth = (() => {
    let cnt = 0;
    const dim = new Date(sy, sm, 0).getDate();
    for (let d = 1; d <= dim; d++) { const day = new Date(sy, sm - 1, d).getDay(); if (day > 0 && day < 6) cnt++; }
    return cnt;
  })();

  const weekly = Object.entries(weeklyBreakdown).map(([week, items]) => ({
    week,
    count: items.length,
    tasks: [...new Set(items.map(i => i.task))].filter(t => t).slice(0, 5)
  }));

  const attResult = await query(`
    SELECT COUNT(*) as days, COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
    AVG(EXTRACT(EPOCH FROM (check_out - check_in))/3600) as avg_hours
    FROM attendance WHERE user_id = $1 AND TO_CHAR(work_date, 'YYYY-MM') = $2 AND check_out IS NOT NULL
  `, [userId, month]);
  const att = attResult.rows[0] || {};

  res.json({
    user, month,
    total_reports: reports.length,
    unique_days: uniqueDays,
    work_days: workDaysInMonth,
    categories,
    top_tasks: topTasks,
    top_places: topPlaces,
    weekly,
    attendance: {
      days: parseInt(att.days) || 0,
      late: parseInt(att.late) || 0,
      avg_hours: att.avg_hours ? parseFloat(att.avg_hours).toFixed(1) : null
    }
  });
});

// ─── 빠른 메모 ───
app.get('/api/notes', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const result = await query('SELECT * FROM quick_notes WHERE user_id = $1 ORDER BY pinned DESC, updated_at DESC', [userId]);
  res.json(result.rows);
});

app.post('/api/notes', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const { content, color } = req.body;
  const id = 'qn_' + Date.now();
  await query('INSERT INTO quick_notes (id, user_id, content, color) VALUES ($1, $2, $3, $4)', [id, userId, content, color || '#fef3c7']);
  res.json({ ok: true, id });
});

app.put('/api/notes/:id', authMiddleware, async (req, res) => {
  const { content, color, pinned } = req.body;
  if (content !== undefined) await query('UPDATE quick_notes SET content = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [content, req.params.id, req.session.userId]);
  if (color !== undefined) await query('UPDATE quick_notes SET color = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [color, req.params.id, req.session.userId]);
  if (pinned !== undefined) await query('UPDATE quick_notes SET pinned = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [pinned, req.params.id, req.session.userId]);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  await query('DELETE FROM quick_notes WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

// ─── 활동 타임라인 ───
app.get('/api/timeline', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  const items = [];

  const reports = await query(`
    SELECT id, report_date, work_category, what_task, where_place, result_status, created_at
    FROM work_reports WHERE author_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  reports.rows.forEach(r => items.push({
    type: 'report', icon: '&#128221;', color: '#2563eb',
    title: r.what_task || '업무일지 작성',
    sub: `${r.work_category || ''} ${r.where_place ? '@ ' + r.where_place : ''} ${r.result_status ? '| ' + r.result_status : ''}`,
    date: r.created_at, link_id: r.id
  }));

  const att = await query(`
    SELECT work_date, check_in, check_out, status, created_at
    FROM attendance WHERE user_id = $1 ORDER BY work_date DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  att.rows.forEach(a => {
    if (a.check_in) items.push({
      type: 'checkin', icon: '&#128994;', color: '#16a34a',
      title: '출근',
      sub: new Date(a.check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + (a.status === 'late' ? ' (지각)' : ''),
      date: a.check_in
    });
    if (a.check_out) items.push({
      type: 'checkout', icon: '&#128308;', color: '#dc2626',
      title: '퇴근',
      sub: new Date(a.check_out).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      date: a.check_out
    });
  });

  const comments = await query(`
    SELECT c.id, c.content, c.created_at, c.report_id, r.what_task
    FROM comments c LEFT JOIN work_reports r ON c.report_id = r.id
    WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  comments.rows.forEach(c => items.push({
    type: 'comment', icon: '&#128172;', color: '#8b5cf6',
    title: '댓글 작성',
    sub: `"${(c.content || '').substring(0, 40)}${(c.content || '').length > 40 ? '...' : ''}" → ${c.what_task || '보고서'}`,
    date: c.created_at, link_id: c.report_id
  }));

  const todos = await query(`
    SELECT title, completed, completed_at, created_at FROM todos WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  todos.rows.forEach(t => {
    if (t.completed) items.push({
      type: 'todo_done', icon: '&#9989;', color: '#10b981',
      title: '할 일 완료',
      sub: t.title,
      date: t.completed_at || t.created_at
    });
  });

  const posts = await query(`
    SELECT id, title, created_at FROM board_posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  posts.rows.forEach(p => items.push({
    type: 'board', icon: '&#128172;', color: '#0ea5e9',
    title: '게시판 글 작성',
    sub: p.title,
    date: p.created_at, link_id: p.id
  }));

  const tlEvents = await query(`
    SELECT id, title, event_type, event_date, created_at FROM team_events
    ORDER BY created_at DESC LIMIT $1 OFFSET $2
  `, [limit, offset]);
  tlEvents.rows.forEach(e => items.push({
    type: 'event', icon: '&#128197;', color: '#ec4899',
    title: `일정 등록: ${e.event_type}`,
    sub: `${e.title} (${(e.event_date||'').toString().split('T')[0]})`,
    date: e.created_at, link_id: e.id
  }));

  const tlNotes = await query(`
    SELECT id, content, created_at FROM quick_notes
    WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  tlNotes.rows.forEach(n => items.push({
    type: 'note', icon: '&#128206;', color: '#f59e0b',
    title: '메모 작성',
    sub: (n.content||'').substring(0, 40),
    date: n.created_at
  }));

  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({ items: items.slice(0, limit), page });
});

// ─── 즐겨찾기 ───
app.get('/api/bookmarks', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const result = await query(`
    SELECT b.id, b.report_id, b.memo, b.created_at,
      r.report_date, r.work_category, r.what_task, r.where_place, r.result_status
    FROM bookmarks b JOIN work_reports r ON b.report_id = r.id
    WHERE b.user_id = $1 ORDER BY b.created_at DESC
  `, [userId]);
  res.json(result.rows);
});

app.post('/api/bookmarks', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const { report_id, memo } = req.body;
  const id = 'bm_' + Date.now();
  await query('INSERT INTO bookmarks (id, user_id, report_id, memo) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, report_id) DO NOTHING', [id, userId, report_id, memo || '']);
  res.json({ ok: true });
});

app.delete('/api/bookmarks/:reportId', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  await query('DELETE FROM bookmarks WHERE user_id = $1 AND report_id = $2', [userId, req.params.reportId]);
  res.json({ ok: true });
});

app.get('/api/bookmarks/check/:reportId', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const result = await query('SELECT id FROM bookmarks WHERE user_id = $1 AND report_id = $2', [userId, req.params.reportId]);
  res.json({ bookmarked: result.rows.length > 0 });
});

// ─── 팀 실적 대시보드 ───
app.get('/api/team-dashboard', adminMiddleware, async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  const [sy, sm] = month.split('-').map(Number);
  const daysInMonth = new Date(sy, sm, 0).getDate();
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) { const dow = new Date(sy, sm - 1, d).getDay(); if (dow > 0 && dow < 6) workDays++; }

  const usersResult = await query('SELECT id, name, position, phone FROM users ORDER BY name');
  const users = usersResult.rows;

  const members = [];

  for (const u of users) {
    const repResult = await query(`
      SELECT COUNT(*) as cnt,
        COUNT(DISTINCT work_category) as cat_cnt,
        COUNT(CASE WHEN result_status ILIKE '%완료%' OR result_status ILIKE '%성공%' THEN 1 END) as completed
      FROM work_reports WHERE author_id = $1 AND TO_CHAR(report_date, 'YYYY-MM') = $2
    `, [u.id, month]);
    const rep = repResult.rows[0];

    const attResult = await query(`
      SELECT COUNT(*) as days,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late,
        AVG(EXTRACT(EPOCH FROM (check_out - check_in))/3600) as avg_hours
      FROM attendance WHERE user_id = $1 AND TO_CHAR(work_date, 'YYYY-MM') = $2 AND check_out IS NOT NULL
    `, [u.id, month]);
    const att = attResult.rows[0];

    const todoResult = await query(`
      SELECT COUNT(*) as total, COUNT(CASE WHEN done = true THEN 1 END) as done
      FROM todos WHERE user_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
    `, [u.id, month]);
    const todo = todoResult.rows[0];

    const commentResult = await query(`
      SELECT COUNT(*) as cnt FROM comments WHERE user_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
    `, [u.id, month]);

    const reportCount = parseInt(rep.cnt) || 0;
    const fillRate = workDays > 0 ? Math.round(reportCount / workDays * 100) : 0;

    members.push({
      id: u.id, name: u.name, position: u.position,
      reports: reportCount,
      fill_rate: fillRate,
      categories: parseInt(rep.cat_cnt) || 0,
      completed: parseInt(rep.completed) || 0,
      att_days: parseInt(att.days) || 0,
      att_late: parseInt(att.late) || 0,
      avg_hours: att.avg_hours ? parseFloat(att.avg_hours).toFixed(1) : null,
      todo_total: parseInt(todo.total) || 0,
      todo_done: parseInt(todo.done) || 0,
      comments: parseInt(commentResult.rows[0].cnt) || 0
    });
  }

  members.sort((a, b) => b.reports - a.reports);

  const teamTotal = members.reduce((s, m) => s + m.reports, 0);
  const teamAvgFill = members.length ? Math.round(members.reduce((s, m) => s + m.fill_rate, 0) / members.length) : 0;
  const teamAvgHours = (() => {
    const hrs = members.filter(m => m.avg_hours).map(m => parseFloat(m.avg_hours));
    return hrs.length ? (hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : null;
  })();
  const totalLate = members.reduce((s, m) => s + m.att_late, 0);

  res.json({
    month, work_days: workDays,
    team_summary: { total_reports: teamTotal, avg_fill_rate: teamAvgFill, avg_hours: teamAvgHours, total_late: totalLate, member_count: members.length },
    members
  });
});

// ─── 주간 업무 보고서 ───
app.get('/api/weekly-report', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;
  const dateParam = req.query.date || new Date().toISOString().split('T')[0];

  const d = new Date(dateParam);
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const weekStart = mon.toISOString().split('T')[0];
  const weekEnd = sun.toISOString().split('T')[0];
  const friStr = fri.toISOString().split('T')[0];

  const userResult = await query('SELECT name, position FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] || { name: '사용자', position: '' };

  const reportsResult = await query(`
    SELECT * FROM work_reports WHERE author_id = $1 AND report_date >= $2 AND report_date <= $3
    ORDER BY report_date ASC
  `, [userId, weekStart, weekEnd]);
  const reports = reportsResult.rows;

  if (reports.length === 0) return res.json({ empty: true, user, weekStart, weekEnd });

  const dailyMap = {};
  const catCount = {};
  const taskList = [];
  let completedCount = 0;
  let ongoingCount = 0;
  let issueCount = 0;
  const issues = [];
  const notes = [];

  reports.forEach(r => {
    const dt = (r.report_date || '').toString().split('T')[0];
    if (!dailyMap[dt]) dailyMap[dt] = [];
    dailyMap[dt].push(r);

    const cat = r.work_category || '기타';
    catCount[cat] = (catCount[cat] || 0) + 1;

    if (r.what_task) taskList.push({ task: r.what_task, category: cat, place: r.where_place, method: r.how_method, result: r.result_status, date: dt });

    const rs = (r.result_status || '').toLowerCase();
    if (rs.includes('완료') || rs.includes('성공')) completedCount++;
    else if (rs.includes('진행') || rs.includes('중')) ongoingCount++;
    else if (rs.includes('미완') || rs.includes('실패') || rs.includes('보류')) issueCount++;

    if (r.issues && r.issues.trim()) issues.push({ task: r.what_task || '', issue: r.issues, date: dt });
    if (r.notes && r.notes.trim()) notes.push({ task: r.what_task || '', note: r.notes, date: dt });
  });

  const attResult = await query(`
    SELECT work_date, check_in, check_out, status
    FROM attendance WHERE user_id = $1 AND work_date >= $2 AND work_date <= $3
    ORDER BY work_date ASC
  `, [userId, weekStart, weekEnd]);

  const attendance = attResult.rows.map(a => ({
    date: (a.work_date || '').toString().split('T')[0],
    check_in: a.check_in,
    check_out: a.check_out,
    status: a.status
  }));

  const todoResult = await query(`
    SELECT title, completed, due_date FROM todos
    WHERE user_id = $1 AND due_date >= $2 AND due_date <= $3
    ORDER BY due_date ASC
  `, [userId, weekStart, weekEnd]);

  const categories = Object.entries(catCount).map(([name, count]) => ({ name, count }));

  const dayNames = ['일','월','화','수','목','금','토'];
  const daily = Object.entries(dailyMap).sort((a,b) => a[0].localeCompare(b[0])).map(([date, reps]) => {
    const dow = new Date(date).getDay();
    return {
      date, dayName: dayNames[dow],
      reports: reps.map(r => ({ task: r.what_task, category: r.work_category, result: r.result_status, place: r.where_place }))
    };
  });

  const weekNum = Math.ceil((mon.getDate()) / 7);
  const monthNum = mon.getMonth() + 1;

  res.json({
    user, weekStart, weekEnd,
    weekLabel: `${monthNum}월 ${weekNum}주차`,
    total_reports: reports.length,
    work_days: Object.keys(dailyMap).length,
    daily,
    categories,
    tasks: taskList,
    result_summary: { completed: completedCount, ongoing: ongoingCount, issue: issueCount },
    issues, notes,
    attendance,
    todos: todoResult.rows.map(t => ({ title: t.title, done: t.completed, due_date: (t.due_date || '').toString().split('T')[0] }))
  });
});

// ─── 업무 캘린더 ───
app.get('/api/calendar', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;
  const month = req.query.month || new Date().toISOString().substring(0, 7);

  const reportsResult = await query(`
    SELECT id, report_date, work_category, what_task, result_status
    FROM work_reports WHERE author_id = $1 AND TO_CHAR(report_date, 'YYYY-MM') = $2
    ORDER BY report_date ASC
  `, [userId, month]);

  const attResult = await query(`
    SELECT work_date, check_in, check_out, status
    FROM attendance WHERE user_id = $1 AND TO_CHAR(work_date, 'YYYY-MM') = $2
  `, [userId, month]);

  const todoResult = await query(`
    SELECT due_date, title, completed
    FROM todos WHERE user_id = $1 AND TO_CHAR(due_date, 'YYYY-MM') = $2
  `, [userId, month]);

  const eventResult = await query(`
    SELECT event_date, title, event_type
    FROM team_events WHERE TO_CHAR(event_date, 'YYYY-MM') = $1
  `, [month]);

  const days = {};

  reportsResult.rows.forEach(r => {
    const d = (r.report_date || '').toString().split('T')[0];
    if (!days[d]) days[d] = { reports: [], attendance: null, todos: [], events: [] };
    days[d].reports.push({ id: r.id, category: r.work_category, task: r.what_task, result: r.result_status });
  });

  attResult.rows.forEach(a => {
    const d = (a.work_date || '').toString().split('T')[0];
    if (!days[d]) days[d] = { reports: [], attendance: null, todos: [], events: [] };
    days[d].attendance = { check_in: a.check_in, check_out: a.check_out, status: a.status };
  });

  todoResult.rows.forEach(t => {
    const d = (t.due_date || '').toString().split('T')[0];
    if (!days[d]) days[d] = { reports: [], attendance: null, todos: [], events: [] };
    days[d].todos.push({ title: t.title, done: t.completed });
  });

  eventResult.rows.forEach(e => {
    const d = (e.event_date || '').toString().split('T')[0];
    if (!days[d]) days[d] = { reports: [], attendance: null, todos: [], events: [] };
    days[d].events.push({ title: e.title, type: e.event_type });
  });

  res.json({ month, days });
});

// ─── 업무 인수인계 문서 ───
app.get('/api/handover', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;

  const userResult = await query('SELECT name, position, phone FROM users WHERE id = $1', [userId]);
  const user = userResult.rows[0] || { name: '사용자', position: '', phone: '' };

  const reportsResult = await query(`
    SELECT * FROM work_reports WHERE author_id = $1 ORDER BY report_date DESC
  `, [userId]);
  const reports = reportsResult.rows;

  if (reports.length === 0) return res.json({ empty: true, user });

  const firstDate = reports[reports.length - 1].report_date;
  const lastDate = reports[0].report_date;

  const catCount = {};
  const taskDetails = {};
  const placeInfo = {};
  const howMethods = {};
  const resultSummary = { complete: 0, ongoing: 0, issue: 0 };
  const issueList = [];
  const notesList = [];

  reports.forEach(r => {
    const cat = r.work_category || '기타';
    catCount[cat] = (catCount[cat] || 0) + 1;

    if (r.what_task) {
      if (!taskDetails[r.what_task]) taskDetails[r.what_task] = { count: 0, category: cat, places: new Set(), methods: new Set(), latestDate: '', latestResult: '' };
      const td = taskDetails[r.what_task];
      td.count++;
      if (r.where_place) td.places.add(r.where_place);
      if (r.how_method) td.methods.add(r.how_method);
      const dt = (r.report_date || '').toString().split('T')[0];
      if (!td.latestDate || dt > td.latestDate) { td.latestDate = dt; td.latestResult = r.result_status || ''; }
    }

    if (r.where_place) {
      if (!placeInfo[r.where_place]) placeInfo[r.where_place] = { count: 0, tasks: new Set() };
      placeInfo[r.where_place].count++;
      if (r.what_task) placeInfo[r.where_place].tasks.add(r.what_task);
    }

    if (r.how_method) howMethods[r.how_method] = (howMethods[r.how_method] || 0) + 1;

    const rs = (r.result_status || '').toLowerCase();
    if (rs.includes('완료') || rs.includes('성공')) resultSummary.complete++;
    else if (rs.includes('진행') || rs.includes('중')) resultSummary.ongoing++;
    else if (rs.includes('미완') || rs.includes('실패') || rs.includes('보류')) resultSummary.issue++;

    if (r.issues && r.issues.trim()) issueList.push({ task: r.what_task || '', issue: r.issues, date: (r.report_date || '').toString().split('T')[0] });
    if (r.notes && r.notes.trim()) notesList.push({ task: r.what_task || '', note: r.notes, date: (r.report_date || '').toString().split('T')[0] });
  });

  const coreTasks = Object.entries(taskDetails)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, info]) => ({
      name, count: info.count, category: info.category,
      places: [...info.places], methods: [...info.methods],
      latestDate: info.latestDate, latestResult: info.latestResult
    }));

  const coreCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: Math.round(count / reports.length * 100) }));

  const corePlaces = Object.entries(placeInfo)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, info]) => ({ name, count: info.count, tasks: [...info.tasks].slice(0, 5) }));

  const coreMethods = Object.entries(howMethods)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const manualsResult = await query('SELECT title, content FROM personal_manual WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10', [userId]);

  const recentIssues = issueList.slice(0, 10);
  const recentNotes = notesList.slice(0, 10);

  res.json({
    user,
    period: { from: (firstDate || '').toString().split('T')[0], to: (lastDate || '').toString().split('T')[0] },
    total_reports: reports.length,
    core_tasks: coreTasks,
    categories: coreCategories,
    places: corePlaces,
    methods: coreMethods,
    result_summary: resultSummary,
    recent_issues: recentIssues,
    recent_notes: recentNotes,
    manuals: manualsResult.rows
  });
});

// ─── 알림 센터 ───
app.get('/api/notifications', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const items = [];

  const cmtResult = await query(`
    SELECT c.id, c.report_id, c.author_name, c.content, c.created_at, r.what_task
    FROM comments c JOIN work_reports r ON c.report_id = r.id
    WHERE r.author_id = $1 AND c.author_id != $1
    ORDER BY c.created_at DESC LIMIT 20
  `, [userId]);
  cmtResult.rows.forEach(c => {
    items.push({ type: 'comment', id: c.id, report_id: c.report_id, title: `${c.author_name}님이 댓글을 남겼습니다`, detail: c.content.substring(0, 60), sub: c.what_task || '', time: c.created_at });
  });

  const apprResult = await query(`
    SELECT a.report_id, a.status, a.approved_at, a.comment, u.name as approver_name, r.what_task
    FROM approval_lines a JOIN users u ON a.approver_id = u.id JOIN work_reports r ON a.report_id = r.id
    WHERE r.author_id = $1 AND a.status != 'pending'
    ORDER BY a.approved_at DESC NULLS LAST LIMIT 15
  `, [userId]);
  apprResult.rows.forEach(a => {
    const label = a.status === 'approved' ? '승인' : '반려';
    items.push({ type: 'approval', report_id: a.report_id, title: `${a.approver_name}님이 ${label}했습니다`, detail: a.comment || '', sub: a.what_task || '', time: a.approved_at });
  });

  const noticeResult = await query(`
    SELECT id, title, priority, created_at FROM notices
    WHERE active = TRUE ORDER BY created_at DESC LIMIT 5
  `);
  noticeResult.rows.forEach(n => {
    const pLabel = { urgent: '긴급', important: '중요', normal: '' };
    items.push({ type: 'notice', notice_id: n.id, title: `${pLabel[n.priority] ? '[' + pLabel[n.priority] + '] ' : ''}${n.title}`, detail: '', sub: '공지사항', time: n.created_at });
  });

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const todoResult = await query(`
    SELECT id, title, due_date FROM todos
    WHERE user_id = $1 AND completed = FALSE AND due_date IS NOT NULL AND due_date <= $2
    ORDER BY due_date ASC LIMIT 10
  `, [userId, today]);
  todoResult.rows.forEach(t => {
    items.push({ type: 'todo', todo_id: t.id, title: `할 일 마감: ${t.title}`, detail: '', sub: `마감일: ${(t.due_date||'').split('T')[0]}`, time: t.due_date });
  });

  const eventResult = await query(`
    SELECT id, title, event_type, event_date, event_time FROM team_events
    WHERE event_date >= $1 AND event_date <= $2
    ORDER BY event_date ASC, event_time ASC LIMIT 10
  `, [today, tomorrow]);
  eventResult.rows.forEach(e => {
    const eDate = (e.event_date||'').toString().split('T')[0];
    const label = eDate === today ? '오늘' : '내일';
    items.push({ type: 'event', title: `📅 ${label} ${e.event_type}: ${e.title}`, detail: e.event_time || '', sub: label + ' 일정', time: e.event_date });
  });

  const boardCommentResult = await query(`
    SELECT bc.id, bc.content, bc.created_at, bc.author_name, bp.title as post_title
    FROM board_comments bc JOIN board_posts bp ON bc.post_id = bp.id
    WHERE bp.author_id = $1 AND bc.user_id != $1
    ORDER BY bc.created_at DESC LIMIT 10
  `, [userId]);
  boardCommentResult.rows.forEach(c => {
    items.push({ type: 'board_comment', title: `${c.author_name}님이 게시글에 댓글`, detail: (c.content||'').substring(0, 40), sub: c.post_title, time: c.created_at });
  });

  items.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  res.json(items.slice(0, 30));
});

// ─── 댓글/피드백 ───
app.get('/api/reports/:id/comments', authMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM comments WHERE report_id = $1 ORDER BY created_at ASC', [req.params.id]);
  res.json(result.rows);
});

app.post('/api/reports/:id/comments', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '댓글 내용을 입력하세요' });
  let authorName = '관리자';
  if (req.session.userId && req.session.userId !== 'admin-user') {
    const u = await query('SELECT name FROM users WHERE id = $1', [req.session.userId]);
    if (u.rows[0]) authorName = u.rows[0].name;
  }
  const id = uuidv4();
  await query(
    'INSERT INTO comments (id, report_id, author_id, author_name, content) VALUES ($1,$2,$3,$4,$5)',
    [id, req.params.id, req.session.userId || 'admin-user', authorName, content.trim()]
  );
  res.json({ id, author_name: authorName, content: content.trim(), created_at: new Date().toISOString() });
});

app.delete('/api/comments/:id', authMiddleware, async (req, res) => {
  const comment = await query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
  if (comment.rows.length === 0) return res.status(404).json({ error: '댓글을 찾을 수 없습니다' });
  const c = comment.rows[0];
  if (c.author_id !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ error: '본인의 댓글만 삭제할 수 있습니다' });
  }
  await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── 출퇴근 기록 ───
app.get('/api/attendance/today', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = await query('SELECT * FROM attendance WHERE user_id = $1 AND work_date = $2', [req.session.userId, today]);
  res.json(result.rows[0] || null);
});

app.post('/api/attendance/check-in', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const existing = await query('SELECT * FROM attendance WHERE user_id = $1 AND work_date = $2', [req.session.userId, today]);
  if (existing.rows.length > 0) return res.status(400).json({ error: '이미 출근 기록이 있습니다' });
  const id = uuidv4();
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const status = hour > 9.5 ? 'late' : 'normal';
  const workType = req.body.work_type || '내근';
  const workSummary = req.body.work_summary || '';
  await query('INSERT INTO attendance (id, user_id, work_date, check_in, status, work_type, work_summary) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, req.session.userId, today, now, status, workType, workSummary]);
  res.json({ id, check_in: now.toISOString(), status, work_type: workType, work_summary: workSummary });
});

app.post('/api/attendance/check-out', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const existing = await query('SELECT * FROM attendance WHERE user_id = $1 AND work_date = $2', [req.session.userId, today]);
  if (existing.rows.length === 0) return res.status(400).json({ error: '출근 기록이 없습니다. 먼저 출근하세요.' });
  if (existing.rows[0].check_out) return res.status(400).json({ error: '이미 퇴근 처리되었습니다' });
  const now = new Date();
  await query('UPDATE attendance SET check_out = $1 WHERE user_id = $2 AND work_date = $3', [now, req.session.userId, today]);
  res.json({ check_out: now.toISOString() });
});

app.get('/api/attendance/history', authMiddleware, async (req, res) => {
  const userId = req.query.user_id || req.session.userId;
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  const result = await query(
    `SELECT a.*, u.name as user_name FROM attendance a JOIN users u ON a.user_id = u.id
     WHERE a.user_id = $1 AND TO_CHAR(a.work_date, 'YYYY-MM') = $2 ORDER BY a.work_date DESC`,
    [userId, month]);
  res.json(result.rows);
});

app.get('/api/attendance/team', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = await query(
    `SELECT a.*, u.name as user_name, u.position FROM attendance a JOIN users u ON a.user_id = u.id
     WHERE a.work_date = $1 ORDER BY a.check_in ASC`, [today]);
  res.json(result.rows);
});

app.get('/api/attendance/team-board', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const cid = req.session.companyId;
  const allUsers = cid
    ? await query('SELECT id, name, position, department FROM users WHERE company_id = $1 ORDER BY name', [cid])
    : await query('SELECT id, name, position, department FROM users ORDER BY name');
  const checked = await query(
    `SELECT a.*, u.name as user_name, u.position FROM attendance a JOIN users u ON a.user_id = u.id
     WHERE a.work_date = $1 ORDER BY a.check_in ASC`, [today]);
  const checkedMap = {};
  checked.rows.forEach(r => { checkedMap[r.user_id] = r; });
  const board = allUsers.rows.map(u => ({
    user_id: u.id, name: u.name, position: u.position, department: u.department,
    checked_in: !!checkedMap[u.id],
    work_type: checkedMap[u.id] ? checkedMap[u.id].work_type : null,
    work_summary: checkedMap[u.id] ? checkedMap[u.id].work_summary : null,
    check_in: checkedMap[u.id] ? checkedMap[u.id].check_in : null,
    status: checkedMap[u.id] ? checkedMap[u.id].status : null
  }));
  const total = allUsers.rows.length;
  const checkedCount = checked.rows.length;
  res.json({ total, checked_count: checkedCount, all_checked: checkedCount >= total, board });
});

// ─── 팀 일정 ───
app.get('/api/events', authMiddleware, async (req, res) => {
  const { month, from, to } = req.query;
  let sql = 'SELECT * FROM team_events WHERE 1=1';
  const params = [];
  let idx = 1;
  if (month) { sql += ` AND TO_CHAR(event_date, 'YYYY-MM') = $${idx++}`; params.push(month); }
  if (from) { sql += ` AND event_date >= $${idx++}`; params.push(from); }
  if (to) { sql += ` AND event_date <= $${idx++}`; params.push(to); }
  sql += ' ORDER BY event_date ASC, event_time ASC';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.post('/api/events', authMiddleware, async (req, res) => {
  const { title, description, event_date, event_time, event_type } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: '제목과 날짜를 입력하세요' });
  let authorName = '관리자';
  if (req.session.userId && req.session.userId !== 'admin-user') {
    const u = await query('SELECT name FROM users WHERE id = $1', [req.session.userId]);
    if (u.rows[0]) authorName = u.rows[0].name;
  }
  const typeColors = { '회의': '#3b82f6', '마감': '#ef4444', '행사': '#10b981', '출장': '#f59e0b', '기타': '#6366f1' };
  const id = uuidv4();
  await query('INSERT INTO team_events (id, author_id, author_name, title, description, event_date, event_time, event_type, color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, req.session.userId, authorName, title, description || '', event_date, event_time || '', event_type || '회의', typeColors[event_type] || '#3b82f6']);
  res.json({ id });
});

app.put('/api/events/:id', authMiddleware, async (req, res) => {
  const ev = await query('SELECT * FROM team_events WHERE id = $1', [req.params.id]);
  if (ev.rows.length === 0) return res.status(404).json({ error: '일정을 찾을 수 없습니다' });
  if (ev.rows[0].author_id !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ error: '본인의 일정만 수정할 수 있습니다' });
  }
  const { title, description, event_date, event_time, event_type } = req.body;
  const typeColors = { '회의': '#3b82f6', '마감': '#ef4444', '행사': '#10b981', '출장': '#f59e0b', '기타': '#6366f1' };
  await query(
    'UPDATE team_events SET title=COALESCE($1,title), description=COALESCE($2,description), event_date=COALESCE($3,event_date), event_time=COALESCE($4,event_time), event_type=COALESCE($5,event_type), color=$6 WHERE id=$7',
    [title, description, event_date, event_time, event_type, typeColors[event_type] || ev.rows[0].color, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/events/:id', authMiddleware, async (req, res) => {
  const ev = await query('SELECT * FROM team_events WHERE id = $1', [req.params.id]);
  if (ev.rows.length === 0) return res.status(404).json({ error: '일정을 찾을 수 없습니다' });
  if (ev.rows[0].author_id !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ error: '본인의 일정만 삭제할 수 있습니다' });
  }
  await query('DELETE FROM team_events WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── 팀 게시판 ───
app.get('/api/board', authMiddleware, async (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM board_posts';
  const params = [];
  if (category) { sql += ' WHERE category = $1'; params.push(category); }
  sql += ' ORDER BY created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.get('/api/board/:id', authMiddleware, async (req, res) => {
  const post = await query('SELECT * FROM board_posts WHERE id = $1', [req.params.id]);
  if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다' });
  await query('UPDATE board_posts SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
  const comments = await query('SELECT * FROM board_comments WHERE post_id = $1 ORDER BY created_at ASC', [req.params.id]);
  res.json({ ...post.rows[0], view_count: post.rows[0].view_count + 1, comments: comments.rows });
});

app.post('/api/board', authMiddleware, async (req, res) => {
  const { category, title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력하세요' });
  let authorName = '관리자';
  if (req.session.userId && req.session.userId !== 'admin-user') {
    const u = await query('SELECT name FROM users WHERE id = $1', [req.session.userId]);
    if (u.rows[0]) authorName = u.rows[0].name;
  }
  const id = uuidv4();
  await query('INSERT INTO board_posts (id, author_id, author_name, category, title, content) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, req.session.userId, authorName, category || '자유', title, content]);
  res.json({ id });
});

app.put('/api/board/:id', authMiddleware, async (req, res) => {
  const post = await query('SELECT * FROM board_posts WHERE id = $1', [req.params.id]);
  if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다' });
  if (post.rows[0].author_id !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ error: '본인의 글만 수정할 수 있습니다' });
  }
  const { category, title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: '제목과 내용을 입력하세요' });
  await query('UPDATE board_posts SET category=COALESCE($1,category), title=$2, content=$3 WHERE id=$4',
    [category, title, content, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/board/:id', authMiddleware, async (req, res) => {
  const post = await query('SELECT * FROM board_posts WHERE id = $1', [req.params.id]);
  if (post.rows.length === 0) return res.status(404).json({ error: '게시글을 찾을 수 없습니다' });
  if (post.rows[0].author_id !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ error: '본인의 글만 삭제할 수 있습니다' });
  }
  await query('DELETE FROM board_comments WHERE post_id = $1', [req.params.id]);
  await query('DELETE FROM board_posts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/board/:id/comments', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '댓글을 입력하세요' });
  let authorName = '관리자';
  if (req.session.userId && req.session.userId !== 'admin-user') {
    const u = await query('SELECT name FROM users WHERE id = $1', [req.session.userId]);
    if (u.rows[0]) authorName = u.rows[0].name;
  }
  const id = uuidv4();
  await query('INSERT INTO board_comments (id, post_id, author_id, author_name, content) VALUES ($1,$2,$3,$4,$5)',
    [id, req.params.id, req.session.userId, authorName, content.trim()]);
  await query('UPDATE board_posts SET comment_count = comment_count + 1 WHERE id = $1', [req.params.id]);
  res.json({ id, author_name: authorName, content: content.trim(), created_at: new Date().toISOString() });
});

app.delete('/api/board-comments/:id', authMiddleware, async (req, res) => {
  const c = await query('SELECT * FROM board_comments WHERE id = $1', [req.params.id]);
  if (c.rows.length === 0) return res.status(404).json({ error: '댓글을 찾을 수 없습니다' });
  if (c.rows[0].author_id !== req.session.userId && !req.session.isAdmin) {
    return res.status(403).json({ error: '본인의 댓글만 삭제할 수 있습니다' });
  }
  await query('DELETE FROM board_comments WHERE id = $1', [req.params.id]);
  await query('UPDATE board_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1', [c.rows[0].post_id]);
  res.json({ ok: true });
});

// ─── 할 일 관리 ───
app.get('/api/todos', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const showDone = req.query.done === '1';
  const sql = showDone
    ? 'SELECT * FROM todos WHERE user_id = $1 ORDER BY completed ASC, priority DESC, due_date ASC NULLS LAST, created_at DESC'
    : 'SELECT * FROM todos WHERE user_id = $1 AND completed = FALSE ORDER BY priority DESC, due_date ASC NULLS LAST, created_at DESC';
  const result = await query(sql, [userId]);
  res.json(result.rows);
});

app.post('/api/todos', authMiddleware, async (req, res) => {
  const { title, memo, priority, due_date } = req.body;
  if (!title) return res.status(400).json({ error: '할 일을 입력하세요' });
  const id = uuidv4();
  await query(
    'INSERT INTO todos (id, user_id, title, memo, priority, due_date) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, req.session.userId, title, memo || '', priority || 'normal', due_date || null]
  );
  res.json({ id });
});

app.put('/api/todos/:id', authMiddleware, async (req, res) => {
  const { title, memo, priority, due_date, completed } = req.body;
  if (completed !== undefined) {
    await query(
      'UPDATE todos SET completed = $1, completed_at = $2 WHERE id = $3 AND user_id = $4',
      [completed, completed ? new Date() : null, req.params.id, req.session.userId]
    );
  } else {
    await query(
      'UPDATE todos SET title = COALESCE($1, title), memo = COALESCE($2, memo), priority = COALESCE($3, priority), due_date = $4 WHERE id = $5 AND user_id = $6',
      [title, memo, priority, due_date || null, req.params.id, req.session.userId]
    );
  }
  res.json({ ok: true });
});

app.delete('/api/todos/:id', authMiddleware, async (req, res) => {
  await query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

// ─── 봉사활동 (개인 전용) ───
function splitParticipantNames(s) {
  return (s || '').split(/[,，、\n]/).map(x => x.trim()).filter(Boolean);
}

app.get('/api/volunteer', authMiddleware, async (req, res) => {
  const result = await query(
    'SELECT * FROM volunteer_activities WHERE user_id = $1 ORDER BY activity_date DESC, created_at DESC',
    [req.session.userId]
  );
  res.json(result.rows);
});

app.get('/api/volunteer/stats', authMiddleware, async (req, res) => {
  const r = await query(
    'SELECT COUNT(*)::int AS count, COALESCE(SUM(hours), 0) AS total_hours FROM volunteer_activities WHERE user_id = $1',
    [req.session.userId]
  );
  res.json(r.rows[0]);
});

app.post('/api/volunteer', authMiddleware, async (req, res) => {
  const { activity_date, title, location, hours, participants, content, branch_id, participant_names, status } = req.body;
  if (!activity_date || !title) return res.status(400).json({ error: '봉사일자와 활동명을 입력하세요' });
  let authorName = '';
  const u = await query('SELECT name FROM users WHERE id = $1', [req.session.userId]);
  if (u.rows[0]) authorName = u.rows[0].name;
  const names = splitParticipantNames(participant_names);
  const pcount = names.length > 0 ? names.length : (participants || 1);
  const id = uuidv4();
  await query(
    `INSERT INTO volunteer_activities (id, user_id, author_name, activity_date, title, location, hours, participants, content, company_id, branch_id, participant_names, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, req.session.userId, authorName, activity_date, title, location || '', hours || 0, pcount, content || '', req.session.companyId || null,
     branch_id || null, names.join(', '), status === '완료' ? '완료' : '계획']
  );
  res.json({ id });
});

app.put('/api/volunteer/:id', authMiddleware, async (req, res) => {
  const { activity_date, title, location, hours, participants, content, branch_id, participant_names, status } = req.body;
  let pcount = participants;
  let namesJoined = null;
  if (participant_names !== undefined) {
    const names = splitParticipantNames(participant_names);
    namesJoined = names.join(', ');
    if (names.length > 0) pcount = names.length;
  }
  await query(
    `UPDATE volunteer_activities SET activity_date = COALESCE($1, activity_date), title = COALESCE($2, title),
       location = COALESCE($3, location), hours = COALESCE($4, hours), participants = COALESCE($5, participants),
       content = COALESCE($6, content), branch_id = COALESCE($7, branch_id),
       participant_names = COALESCE($8, participant_names), status = COALESCE($9, status)
     WHERE id = $10 AND user_id = $11`,
    [activity_date || null, title || null, location, hours, pcount, content, branch_id || null, namesJoined,
     (status === '완료' || status === '계획') ? status : null, req.params.id, req.session.userId]
  );
  res.json({ ok: true });
});

app.delete('/api/volunteer/:id', authMiddleware, async (req, res) => {
  await query('DELETE FROM volunteer_activities WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  res.json({ ok: true });
});

// 현재 사용자의 봉사 권한: 관리자=감사실/개발자, 지역장=관리담당자
async function getVolunteerRole(req) {
  if (req.session.isAdmin) return { admin: true, regionHead: true };
  if (!req.session.userId) return { admin: false, regionHead: false };
  const r = await query('SELECT position FROM users WHERE id = $1', [req.session.userId]);
  return { admin: false, regionHead: r.rows[0] && r.rows[0].position === '지역장' };
}

// 봉사 승인·감사 검토 목록 (지역장/관리자) — 전체 사용자 항목, 소속(지국)·상태 포함
app.get('/api/volunteer/review', authMiddleware, async (req, res) => {
  const role = await getVolunteerRole(req);
  if (!role.admin && !role.regionHead) return res.status(403).json({ error: '관리담당자(지역장) 또는 감사실(관리자) 권한이 필요합니다' });
  const result = await query(
    `SELECT va.id, va.activity_date, va.title, va.location, va.status, va.participant_names, va.participants,
            va.author_name, c.name AS company_name, b.name AS branch_name
     FROM volunteer_activities va
     LEFT JOIN users u ON va.user_id = u.id
     LEFT JOIN companies c ON c.id = u.company_id
     LEFT JOIN branches b ON b.id = va.branch_id
     ORDER BY va.activity_date DESC, va.created_at DESC`
  );
  res.json({ role, items: result.rows });
});

// 상태 전환 (버튼): 승인=지역장/관리자, 감사확인=관리자, 완료/계획=작성자 또는 관리
app.put('/api/volunteer/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const valid = ['계획', '승인', '완료', '감사확인'];
  if (!valid.includes(status)) return res.status(400).json({ error: '잘못된 상태입니다' });
  const role = await getVolunteerRole(req);
  const act = await query('SELECT user_id FROM volunteer_activities WHERE id = $1', [req.params.id]);
  if (act.rows.length === 0) return res.status(404).json({ error: '대상을 찾을 수 없습니다' });
  const isOwner = act.rows[0].user_id === req.session.userId;

  if (status === '감사확인' && !role.admin) {
    return res.status(403).json({ error: '감사확인은 감사실/개발자(관리자)만 가능합니다' });
  }
  if (status === '승인' && !role.admin && !role.regionHead) {
    return res.status(403).json({ error: '승인은 관리담당자(지역장/관리자)만 가능합니다' });
  }
  if ((status === '완료' || status === '계획') && !isOwner && !role.admin && !role.regionHead) {
    return res.status(403).json({ error: '본인 또는 관리담당자만 변경할 수 있습니다' });
  }
  await query('UPDATE volunteer_activities SET status = $1 WHERE id = $2', [status, req.params.id]);
  res.json({ ok: true });
});

// ─── 봉사 성장 정원 (숨김 점수 → 등급) ───
// 점수 공식은 의도적으로 비공개. 사용자에게는 등급(식물)만 노출.
// 로드맵: 차후 각 등급(새싹/잎 등) 내 세부 종류 추가 → GARDEN_TIERS 임계값/매핑만 확장.
const GARDEN_W = { small: 10, branch: 5, repeat: 3 };
const GARDEN_TIERS = [ // [tier, 최소점수] 높은 순
  ['forest', 100], ['flower', 60], ['tree', 30], ['leaf', 12], ['sprout', 0]
];

async function recomputeVolunteerScores() {
  const rows = (await query(
    `SELECT va.branch_id, va.location, va.participant_names, va.participants,
            u.id AS uid, u.name AS author_name, u.department, u.company_id, c.name AS company_name
     FROM volunteer_activities va
     JOIN users u ON va.user_id = u.id
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE va.status IN ('완료', '감사확인')`
  )).rows;

  const groups = {};
  for (const r of rows) {
    const compName = (r.company_name || '').trim();
    const dept = (r.department || '').trim();
    const name = compName || dept || r.author_name || '미상';
    const key = compName ? ('c:' + r.company_id) : (dept ? ('d:' + dept) : ('u:' + r.uid));
    if (!groups[key]) groups[key] = { name, completed: 0, branches: new Set(), nameCounts: {}, smallSum: 0 };
    const g = groups[key];
    g.completed++;
    const b = r.branch_id || ((r.location || '').trim() ? 'loc:' + r.location.trim() : '');
    if (b) g.branches.add(b);
    const names = splitParticipantNames(r.participant_names);
    const n = names.length || (r.participants || 1);
    g.smallSum += 1 / Math.max(1, n); // 1회 참여인원 적을수록 ↑
    for (const nm of names) g.nameCounts[nm] = (g.nameCounts[nm] || 0) + 1;
  }

  const computed = [];
  for (const key in groups) {
    const g = groups[key];
    const distinct = g.branches.size;
    let repeat = 0;
    for (const nm in g.nameCounts) repeat += Math.max(0, g.nameCounts[nm] - 1); // 참여자 중복 ↑
    const score = GARDEN_W.small * g.smallSum + GARDEN_W.branch * distinct + GARDEN_W.repeat * repeat;
    let tier = 'sprout';
    for (const [t, min] of GARDEN_TIERS) { if (score >= min) { tier = t; break; } }
    computed.push({ key, name: g.name, score, tier, completed: g.completed, distinct, repeat });
  }

  await query('DELETE FROM volunteer_scores');
  for (const c of computed) {
    await query(
      `INSERT INTO volunteer_scores (subject_key, subject_name, score, tier, completed_count, distinct_branches, repeat_index, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [c.key, c.name, c.score, c.tier, c.completed, c.distinct, c.repeat]
    );
  }
}

// 정원: 지국명 + 등급만 반환 (점수·수치 비노출) + 당월 계획/완료 카운트
app.get('/api/garden', authMiddleware, async (req, res) => {
  await recomputeVolunteerScores();
  const rows = (await query('SELECT subject_name, tier FROM volunteer_scores ORDER BY score DESC, subject_name ASC')).rows;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 1 : m + 2;
  const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  const cnt = (await query(
    `SELECT COUNT(*) FILTER (WHERE status = '계획')::int AS planned,
            COUNT(*) FILTER (WHERE status = '승인')::int AS approved,
            COUNT(*) FILTER (WHERE status = '완료')::int AS completed,
            COUNT(*) FILTER (WHERE status = '감사확인')::int AS audited
     FROM volunteer_activities WHERE activity_date >= $1 AND activity_date < $2`,
    [monthStart, monthEnd]
  )).rows[0];
  res.json({ counts: cnt, plants: rows.map(r => ({ name: r.subject_name, tier: r.tier })) });
});

// ─── 귀납적 인사이트 분석 ───
app.get('/api/insights/smart', authMiddleware, async (req, res) => {
  try {
    const { scope, date_from, date_to, category, team_id } = req.query;
    const userId = req.session.userId;
    const companyId = req.session.companyId;

    let sql = `SELECT r.*, u.name as author_name, u.position as author_position, u.team_id, u.department
      FROM work_reports r JOIN users u ON r.author_id = u.id WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (scope === 'personal') {
      sql += ` AND r.author_id = $${idx++}`; params.push(userId);
    } else if (scope === 'team' && team_id) {
      sql += ` AND u.team_id = $${idx++}`; params.push(team_id);
    } else if (scope === 'company' && companyId) {
      sql += ` AND (r.company_id = $${idx} OR u.company_id = $${idx})`; params.push(companyId); idx++;
    }

    if (date_from) { sql += ` AND r.report_date >= $${idx++}`; params.push(date_from); }
    if (date_to) { sql += ` AND r.report_date <= $${idx++}`; params.push(date_to); }
    if (category) { sql += ` AND r.work_category = $${idx++}`; params.push(category); }

    sql += ' ORDER BY r.report_date DESC';
    const result = await query(sql, params);
    const reports = result.rows;

    if (reports.length === 0) {
      return res.json({ total: 0, message: '분석할 업무 데이터가 없습니다.', observations: [], positive: null, negative: null });
    }

    const catCount = {};
    const placeCount = {};
    const personCount = {};
    const dailyCount = {};
    const taskList = [];
    const weekdayCount = [0,0,0,0,0,0,0];

    reports.forEach(r => {
      const cat = r.work_category || '미분류';
      catCount[cat] = (catCount[cat] || 0) + 1;
      if (r.where_place) placeCount[r.where_place] = (placeCount[r.where_place] || 0) + 1;
      personCount[r.author_name] = (personCount[r.author_name] || 0) + 1;
      const d = (r.report_date || '').toString().split('T')[0];
      if (d) { dailyCount[d] = (dailyCount[d] || 0) + 1; }
      if (d) { weekdayCount[new Date(d).getDay()]++; }
      if (r.what_task) taskList.push({ task: r.what_task, cat, place: r.where_place, date: d, who: r.author_name });
    });

    const topCats = Object.entries(catCount).sort((a,b) => b[1]-a[1]);
    const topPlaces = Object.entries(placeCount).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const topPersons = Object.entries(personCount).sort((a,b) => b[1]-a[1]);
    const days = Object.keys(dailyCount).sort();
    const totalDays = days.length;
    const avgPerDay = totalDays > 0 ? (reports.length / totalDays).toFixed(1) : 0;
    const dayNames = ['일','월','화','수','목','금','토'];
    const busiestDay = dayNames[weekdayCount.indexOf(Math.max(...weekdayCount))];

    const halfIdx = Math.floor(days.length / 2);
    const firstHalf = days.slice(0, halfIdx);
    const secondHalf = days.slice(halfIdx);
    const firstHalfCount = firstHalf.reduce((s, d) => s + (dailyCount[d] || 0), 0);
    const secondHalfCount = secondHalf.reduce((s, d) => s + (dailyCount[d] || 0), 0);
    const trend = secondHalfCount > firstHalfCount * 1.2 ? 'increasing' : secondHalfCount < firstHalfCount * 0.8 ? 'decreasing' : 'stable';

    const catDiversity = topCats.length;
    const topCatRatio = topCats.length > 0 ? Math.round(topCats[0][1] / reports.length * 100) : 0;
    const isConcentrated = topCatRatio > 60;

    const observations = [];
    observations.push(`총 ${reports.length}건의 업무가 ${totalDays}일에 걸쳐 수행됨 (일 평균 ${avgPerDay}건)`);
    if (topCats.length > 0) observations.push(`가장 많은 업무 유형: ${topCats[0][0]} (${topCats[0][1]}건, ${topCatRatio}%)`);
    if (topCats.length > 1) observations.push(`${topCats.slice(0, 3).map(c => c[0]).join(', ')} 순으로 업무 비중이 높음`);
    if (topPlaces.length > 0) observations.push(`주요 활동 장소: ${topPlaces.map(p => p[0]).join(', ')}`);
    observations.push(`업무가 가장 활발한 요일: ${busiestDay}요일`);
    if (trend === 'increasing') observations.push('최근 업무량이 증가 추세를 보이고 있음');
    else if (trend === 'decreasing') observations.push('최근 업무량이 감소 추세를 보이고 있음');
    else observations.push('업무량이 안정적으로 유지되고 있음');
    if (topPersons.length > 1) observations.push(`가장 활발한 구성원: ${topPersons[0][0]} (${topPersons[0][1]}건)`);

    const scopeLabel = scope === 'personal' ? '해당 구성원' : scope === 'team' ? '해당 팀' : '회사';

    let positiveConclusion, positivePrediction;
    const posObs = [];
    if (trend === 'increasing') {
      posObs.push(`업무 기록이 증가세 (전반기 ${firstHalfCount}건 → 후반기 ${secondHalfCount}건) → 조직 활동성 상승 신호`);
      positivePrediction = `현재 추세가 유지될 경우, ${scopeLabel}의 업무 처리 역량이 지속 강화되어 목표 달성 가능성이 높습니다.`;
    } else if (trend === 'stable') {
      posObs.push(`업무량이 일 평균 ${avgPerDay}건으로 안정적 유지 → 체계적 업무 관리의 증거`);
      positivePrediction = `안정된 업무 흐름은 조직의 성숙도를 나타내며, 이 기반 위에 새로운 프로젝트 추진이 가능합니다.`;
    } else {
      posObs.push(`업무 효율화로 인한 자연스러운 업무량 조정 가능성`);
      positivePrediction = `업무 프로세스 개선을 통해 더 적은 리소스로 동일한 성과를 달성하고 있을 수 있습니다.`;
    }
    if (catDiversity >= 4) {
      posObs.push(`${catDiversity}개 카테고리에 걸친 다양한 업무 수행 → 사업 다각화 역량 확보`);
    }
    if (topPlaces.length >= 3) {
      posObs.push(`${topPlaces.length}개 이상의 활동 거점 → 광범위한 현장 커버리지 확보`);
    }
    if (topPersons.length >= 3) {
      posObs.push(`${topPersons.length}명의 구성원이 골고루 참여 → 업무 분담 체계 안정화`);
    }
    positiveConclusion = `관찰된 패턴을 종합하면, ${scopeLabel}은(는) ${topCats.slice(0,2).map(c => c[0]).join('과 ')} 중심의 업무를 체계적으로 수행하고 있으며, 이를 기반으로 역량 확대가 가능한 단계입니다.`;

    let negativeConclusion, negativePrediction;
    const negObs = [];
    if (isConcentrated) {
      negObs.push(`전체 업무의 ${topCatRatio}%가 '${topCats[0][0]}'에 집중 → 특정 업무 과의존 리스크`);
    }
    if (trend === 'decreasing') {
      negObs.push(`업무량 감소 추세 (${firstHalfCount}건 → ${secondHalfCount}건) → 조직 활력 저하 우려`);
      negativePrediction = `감소 추세가 계속되면 핵심 업무 공백이 발생할 수 있으며, 원인 분석과 대응이 필요합니다.`;
    } else {
      negativePrediction = `현재 운영 방식의 한계점을 사전에 파악하고 개선하지 않으면, 조직 확장 시 병목이 발생할 수 있습니다.`;
    }
    if (topPersons.length > 0 && topPersons[0][1] > reports.length * 0.5) {
      negObs.push(`${topPersons[0][0]}에게 전체 업무의 ${Math.round(topPersons[0][1]/reports.length*100)}% 집중 → 핵심 인력 이탈 시 업무 마비 위험`);
    }
    if (topPlaces.length <= 1 && reports.length > 10) {
      negObs.push('활동 범위가 제한적 → 시장 확장 또는 고객 접점 다변화 필요');
    }
    const maxGap = findMaxGap(days);
    if (maxGap >= 3) {
      negObs.push(`최대 ${maxGap}일간 업무 공백 발생 → 업무 연속성 관리 필요`);
    }
    if (negObs.length === 0) {
      negObs.push('현재까지 특별한 리스크 신호는 감지되지 않았으나, 지속적 모니터링이 필요합니다');
    }
    negativeConclusion = `잠재적 리스크 요인을 관리하지 않을 경우, ${scopeLabel}의 성장 모멘텀이 약화될 가능성이 있습니다.`;

    const recommendations = [];
    if (isConcentrated) recommendations.push({ priority: '주의', action: `'${topCats[0][0]}' 외 업무 영역 확대`, reason: '특정 카테고리 과의존은 환경 변화 시 취약점이 됩니다' });
    if (trend === 'decreasing') recommendations.push({ priority: '긴급', action: '업무량 감소 원인 분석', reason: '3주 이상 감소 추세가 이어지면 조직 활력이 저하됩니다' });
    if (topPersons.length > 0 && topPersons[0][1] > reports.length * 0.4) recommendations.push({ priority: '중요', action: '업무 분산 체계 마련', reason: '특정 인력 의존도를 낮춰 조직 안정성을 확보해야 합니다' });
    if (catDiversity < 3) recommendations.push({ priority: '제안', action: '업무 영역 다각화 검토', reason: '다양한 업무 경험이 조직의 적응력을 높입니다' });
    recommendations.push({ priority: '제안', action: '주간/월간 인사이트 정기 리뷰', reason: '데이터 기반 의사결정으로 업무 효율을 지속 개선할 수 있습니다' });

    res.json({
      total: reports.length,
      period: { from: days[0] || date_from, to: days[days.length - 1] || date_to, total_days: totalDays },
      scope: scope || 'all',
      stats: {
        avg_per_day: parseFloat(avgPerDay),
        busiest_day: busiestDay,
        trend,
        category_count: catDiversity,
        top_categories: topCats.slice(0, 5).map(c => ({ name: c[0], count: c[1], pct: Math.round(c[1]/reports.length*100) })),
        top_places: topPlaces.map(p => ({ name: p[0], count: p[1] })),
        top_persons: topPersons.slice(0, 5).map(p => ({ name: p[0], count: p[1] })),
        daily_trend: days.map(d => ({ date: d, count: dailyCount[d] }))
      },
      observations,
      positive: { observations: posObs, conclusion: positiveConclusion, prediction: positivePrediction },
      negative: { observations: negObs, conclusion: negativeConclusion, prediction: negativePrediction },
      recommendations
    });
  } catch (err) {
    console.error('Smart insights error:', err.message);
    res.status(500).json({ error: '인사이트 분석 오류: ' + err.message });
  }
});

function findMaxGap(sortedDates) {
  let maxGap = 0;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = Math.round((new Date(sortedDates[i]) - new Date(sortedDates[i-1])) / 86400000);
    if (diff > maxGap) maxGap = diff;
  }
  return maxGap;
}

// ─── 업데이트 변경이력 ───
const changelogPath = path.join(__dirname, '..', 'data', 'changelog.json');

app.get('/api/changelog', authMiddleware, async (req, res) => {
  try {
    const data = fs.readFileSync(changelogPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) { res.json([]); }
});

app.post('/api/changelog', adminMiddleware, async (req, res) => {
  const { version, changes } = req.body;
  if (!version || !changes || !changes.length) return res.status(400).json({ error: '버전과 변경사항을 입력하세요' });
  let log = [];
  try { log = JSON.parse(fs.readFileSync(changelogPath, 'utf-8')); } catch (e) {}
  const entry = { version, date: new Date().toISOString().split('T')[0], changes, published: false };
  log.unshift(entry);
  fs.writeFileSync(changelogPath, JSON.stringify(log, null, 2));
  res.json({ ok: true, entry });
});

app.post('/api/changelog/publish', adminMiddleware, async (req, res) => {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(changelogPath, 'utf-8')); } catch (e) {}
  const unpublished = log.filter(e => !e.published);
  if (unpublished.length === 0) return res.json({ ok: true, message: '발행할 업데이트가 없습니다' });

  let content = '';
  unpublished.forEach(entry => {
    content += `📌 v${entry.version} (${entry.date})\n`;
    entry.changes.forEach(c => { content += `• ${c}\n`; });
    content += '\n';
  });

  const id = uuidv4();
  await query(
    `INSERT INTO notices (id, title, content, priority, pinned) VALUES ($1, $2, $3, $4, $5)`,
    [id, `🔄 앱 업데이트 안내 (${unpublished[0].version})`, content.trim(), 'important', true]
  );

  log.forEach(e => { if (!e.published) e.published = true; });
  fs.writeFileSync(changelogPath, JSON.stringify(log, null, 2));
  res.json({ ok: true, notice_id: id, count: unpublished.length });
});

// ─── 가맹점 주문 현황 (call history) ───

app.get('/call/history', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'call-history.html'));
});

app.get('/api/call/db-tables', authMiddleware, async (req, res) => {
  try {
    const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    const result = {};
    for (const t of tables.rows) {
      const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [t.table_name]);
      const cnt = await query(`SELECT COUNT(*) as cnt FROM "${t.table_name}"`);
      result[t.table_name] = { count: parseInt(cnt.rows[0].cnt), columns: cols.rows.map(c => c.column_name + '(' + c.data_type + ')') };
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/call/db-sample/:table', authMiddleware, async (req, res) => {
  try {
    const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
    const rows = await query(`SELECT * FROM "${tableName}" LIMIT 5`);
    res.json(rows.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/call/branches', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT id, name FROM branches WHERE exclude_service = 0 ORDER BY seq');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/call/history', authMiddleware, async (req, res) => {
  try {
    const { search, sort } = req.query;
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');

    const branchResult = await query('SELECT id, name FROM branches WHERE exclude_service = 0 ORDER BY seq');
    const allBranches = branchResult.rows;

    const orderResult = await query(
      `SELECT branch_id, branch_name, TO_CHAR(order_date, 'YYYY-MM') as month, SUM(order_count) as cnt
       FROM call_orders GROUP BY branch_id, branch_name, TO_CHAR(order_date, 'YYYY-MM')`
    );

    const totalResult = await query(
      `SELECT branch_id, SUM(order_count) as total FROM call_orders GROUP BY branch_id`
    );
    const totalMap = {};
    totalResult.rows.forEach(r => { totalMap[r.branch_id] = parseInt(r.total); });

    const monthlyMap = {};
    orderResult.rows.forEach(r => {
      if (!monthlyMap[r.branch_id]) monthlyMap[r.branch_id] = {};
      monthlyMap[r.branch_id][r.month] = parseInt(r.cnt);
    });

    let branches = allBranches.map(b => ({
      branch_id: b.id,
      branch_name: b.name,
      total: totalMap[b.id] || 0,
      monthly: monthlyMap[b.id] || {}
    }));

    if (search) {
      const s = search.toLowerCase();
      branches = branches.filter(b => b.branch_name.toLowerCase().includes(s));
    }

    switch (sort) {
      case 'total_asc': branches.sort((a,b) => a.total - b.total); break;
      case 'month_desc': branches.sort((a,b) => (b.monthly[currentMonth]||0) - (a.monthly[currentMonth]||0)); break;
      case 'name_asc': branches.sort((a,b) => a.branch_name.localeCompare(b.branch_name, 'ko')); break;
      default: branches.sort((a,b) => b.total - a.total);
    }

    const totalOrders = Object.values(totalMap).reduce((s,v) => s+v, 0);
    const thisMonthOrders = Object.values(monthlyMap).reduce((s, bm) => s + (bm[currentMonth] || 0), 0);
    const activeBranches = Object.keys(totalMap).length;

    res.json({
      summary: { total_orders: totalOrders, this_month_orders: thisMonthOrders, active_branches: activeBranches, total_branches: allBranches.length },
      branches
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/call/history/:branchId', authMiddleware, async (req, res) => {
  try {
    const { branchId } = req.params;
    const result = await query(
      `SELECT TO_CHAR(order_date, 'YYYY-MM') as month, SUM(order_count) as order_count
       FROM call_orders WHERE branch_id = $1
       GROUP BY TO_CHAR(order_date, 'YYYY-MM') ORDER BY month`,
      [branchId]
    );
    const monthly = result.rows.map(r => {
      const [y, m] = r.month.split('-');
      return { month: r.month, month_label: y + '년 ' + parseInt(m) + '월', order_count: parseInt(r.order_count) };
    });
    res.json({ branch_id: branchId, monthly });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/call/orders', authMiddleware, async (req, res) => {
  try {
    const { branch_id, order_date, order_count, memo } = req.body;
    if (!branch_id || !order_date) return res.status(400).json({ error: '가맹점과 주문일을 입력해주세요' });
    const branchResult = await query('SELECT name FROM branches WHERE id = $1', [branch_id]);
    if (!branchResult.rows[0]) return res.status(404).json({ error: '가맹점을 찾을 수 없습니다' });
    const branchName = branchResult.rows[0].name;
    const id = uuidv4();
    await query(
      'INSERT INTO call_orders (id, branch_id, branch_name, order_date, order_count, memo) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, branch_id, branchName, order_date, order_count || 1, memo || '']
    );
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/call/orders/:id', authMiddleware, async (req, res) => {
  try {
    await query('DELETE FROM call_orders WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 웹 검색 프록시 (DuckDuckGo) ───
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: '검색어가 필요합니다' });
  try {
    const https = require('https');
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      }).on('error', reject);
    });
    const results = [];
    if (data.AbstractText) results.push({ title: data.Heading || q, text: data.AbstractText, source: data.AbstractSource || '' });
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, 5).forEach(t => {
        if (t.Text) results.push({ title: (t.Text || '').substring(0, 60), text: t.Text });
      });
    }
    res.json({ query: q, results, answer: data.Answer || null, abstract: data.AbstractText || null });
  } catch (err) {
    res.status(500).json({ error: '검색 중 오류: ' + err.message });
  }
});

// ─── AI 비서 Gemini 프록시 ───
app.post('/api/ai-chat', authMiddleware, async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: '메시지가 필요합니다' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyD3_RnkU9fAXWTuWky2XyjNoXEweG87_SY';
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  let userContext = '';
  try {
    const [todoRes, eventRes, attRes, userRes] = await Promise.all([
      query('SELECT title, due_date, completed, priority FROM todos WHERE user_id = $1 AND completed = FALSE ORDER BY priority DESC, due_date ASC NULLS LAST LIMIT 10', [userId]),
      query('SELECT title, event_type, event_date, event_time FROM team_events WHERE event_date >= $1 AND event_date <= $2 ORDER BY event_date, event_time LIMIT 10', [today, tomorrow]),
      query('SELECT check_in, check_out, status FROM attendance WHERE user_id = $1 AND work_date = $2', [userId, today]),
      query('SELECT name FROM users WHERE id = $1', [userId])
    ]);
    const userName = userRes.rows[0] ? userRes.rows[0].name : '사용자';
    const todoList = todoRes.rows.map(t => `- ${t.title}${t.due_date ? ' (마감:' + (t.due_date+'').split('T')[0] + ')' : ''}${t.priority === 'high' ? ' ⚡긴급' : ''}`).join('\n');
    const eventList = eventRes.rows.map(e => {
      const d = (e.event_date+'').split('T')[0];
      return `- ${d === today ? '오늘' : '내일'} ${e.event_type}: ${e.title}${e.event_time ? ' ' + e.event_time : ''}`;
    }).join('\n');
    const att = attRes.rows[0];
    const attStatus = att ? (att.check_out ? '퇴근완료' : '출근중' + (att.status === 'late' ? '(지각)' : '')) : '미출근';

    userContext = `\n\n[현재 사용자 실시간 정보 — ${today}]
사용자 이름: ${userName}
출근 상태: ${attStatus}
${todoList ? '미완료 할일:\n' + todoList : '미완료 할일: 없음'}
${eventList ? '오늘/내일 일정:\n' + eventList : '예정 일정: 없음'}
이 정보를 기반으로 사용자에게 맞춤 답변해. "오늘 할일 뭐 있어?" 같은 질문에 실제 데이터로 답해.`;
  } catch (e) { /* DB 조회 실패해도 AI는 작동 */ }

  try {
    const systemPrompt = `너는 업무관리 앱의 AI 비서야. 이름은 "비서".

[정체성]
너는 진짜 AI야. Google Gemini 기반으로 작동하는 똑똑한 업무 비서.
사용자의 업무를 돕는 것이 사명이야.
친근하면서도 프로페셔널하게 대화해.

[성격]
- 똑부러지고 센스있는 비서. 유능하고 믿음직한 느낌.
- 유머 감각 있음. 가끔 사자성어(四字成語)를 대화에 자연스럽게 섞어서 격조 있게.
- 업무 외 대화(게임, 연애, 날씨, 스포츠 등)도 자연스럽게 받아준 후 부드럽게 업무로 전환.
- 절대 딱딱하거나 로봇 같지 않게. 사람 같은 자연스러운 대화.

[말투 규칙]
- 상대가 반말하면 반말로, 존댓말이면 존댓말로 맞춤
- 답변은 짧고 핵심적으로 (2~4문장)
- 이모지 적절히 사용 (과하지 않게)
- 한국어로만 대화. 영어 절대 금지.

[앱 전체 기능 — 상세 지식]
이 앱(WorkFlow)은 모바일 중심 업무관리 시스템이야. 아래 기능을 모두 숙지해:

1. 출퇴근 관리: 출근/퇴근 버튼으로 체크. 9:30 이후 출근은 지각 처리. 월별 출퇴근 기록 조회 가능.
2. 업무일지(보고서): 육하원칙(누가/언제/어디서/무엇을/어떻게/왜) 기반 보고서 작성. 카테고리별 분류. 결재자 지정 후 승인 요청 가능.
3. 일정/캘린더: 미팅, 출장, 마감, 행사 등 일정 등록. 월별/일별 보기. "3시에 미팅" 같은 자연어로도 등록 가능.
4. 할 일 관리(투두): 할 일 추가/완료/삭제. 우선순위와 기한 설정. "~해야 돼"로 자동 인식.
5. 주간계획/주간보고: 주간 단위 업무 계획 수립 및 보고서 자동 생성.
6. 팀 게시판: 팀 내 공지·소통. 글 작성/댓글/조회.
7. 봉사활동: 봉사 기록 등록, 승인 워크플로우(계획→승인→완료→감사확인). 성장정원 게이미피케이션.
8. 가맹점 관리: 전국 가맹점 현황 조회, 서비스 상태 확인.
9. 업무 인사이트: AI 기반 업무 패턴 분석, 생산성 트렌드, 주간 통계.
10. 업무 매뉴얼: 자동 생성 + 수동 작성. 조직 매뉴얼 / 개인 매뉴얼.
11. 지식맵: 업무 관계도 시각화 (Mermaid 다이어그램).
12. 빠른 메모: 스티키 노트 형태의 메모장.
13. 즐겨찾기: 보고서 북마크.
14. 활동 타임라인: 전체 활동 기록 피드.
15. 통합 검색: 보고서/할일/일정/매뉴얼/게시판 통합 검색.
16. 알림 센터: 댓글, 결재, 공지, 할일 알림 통합.
17. 템플릿: 자주 쓰는 보고서 양식 저장/불러오기.
18. 음성 녹음 일지: 음성으로 업무 기록.
19. 집중 모드: 포모도로 타이머 (25분 집중 + 5분 휴식).
20. 인수인계: 퇴사/이동 시 업무 인수인계 문서 자동 생성.
21. 월간 요약: 월별 업무 실적 자동 분석.
22. AI 비서: 나(비서). 대화형 업무 도우미. 브리핑, 일정, 할일, 분석, 조언 제공.

[업무 조언 능력]
- 업무 계획 수립, 우선순위 정리, 시간 관리 조언
- 보고서 작성 팁, 회의 준비/진행 요령
- 팀워크, 소통, 리더십 코칭
- 번아웃 예방, 동기부여, 집중력 향상
- 업무 효율화 방법, 생산성 개선 제안

[앱 기능 안내 — 사용자에게 이렇게 안내]
- 출퇴근 → "출근" 또는 "퇴근" 입력
- 보고서 작성 → "보고서 쓸래" 입력
- 일정 확인 → "오늘 일정" 입력
- 할 일 → "할 일 확인" 입력
- 전체 현황 → "브리핑" 또는 "오늘 브리핑" 입력
- 주간 요약 → "이번 주 요약" 입력
- 검색 → "검색 [키워드]" 입력
- 메모 → "메모" 입력
- 집중 모드 → "집중 모드" 또는 "포모도로" 입력
- 팀원 현황 → "팀원 현황" 입력
- 업무 분석 → "업무 분석" 또는 "패턴 분석" 입력
- 월간 요약 → "이번 달 요약" 입력
- 도움말 → "도움말" 입력

[금지 사항]
- 영어로 답하지 말 것
- "저는 AI라서 못 해요" 같은 자기비하 금지
- 너무 길게 답하지 말 것 (최대 5문장)
- 거짓 정보 만들어내지 말 것` + userContext;

    const contents = [];
    if (history && history.length > 0) {
      history.slice(-10).forEach(h => {
        contents.push({
          role: h.who === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 300, temperature: 0.8 }
        })
      }
    );

    const data = await resp.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const reply = data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      && data.candidates[0].content.parts[0].text;
    if (!reply) return res.status(500).json({ error: 'AI 응답 없음' });

    res.json({ reply });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    res.status(500).json({ error: 'AI 호출 실패: ' + err.message });
  }
});

// ─── 글로벌 에러 핸들러 ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: '서버 오류: ' + err.message });
  }
});

(async () => {
  try {
    await initDB();
    console.log('DB 초기화 완료');
  } catch (err) {
    console.error('DB 초기화 실패:', err.message);
    process.exit(1);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WorkFlow 서버 실행: http://localhost:${PORT}`);
  });
})();
