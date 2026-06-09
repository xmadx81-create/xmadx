const express = require('express');
const session = require('express-session');
const path = require('path');
const ExcelJS = require('exceljs');
const { query, uuidv4, initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: 'petroleum-work-system-2024',
  resave: false,
  saveUninitialized: false
}));

function authMiddleware(req, res, next) {
  if (req.session.userId || req.session.isAdmin) return next();
  res.status(401).json({ error: '로그인이 필요합니다' });
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
        return res.json({ id: u.id, name: u.name, department: u.department, position: u.position });
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

// ─── 가입신청 ───
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, password, email } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: '이름, 연락처, 비밀번호를 입력해주세요' });

    const phoneDigits = phone.replace(/[^0-9]/g, '');
    const staffResult = await query('SELECT * FROM approved_staff WHERE name = $1', [name]);
    const staff = staffResult.rows[0];
    if (!staff) return res.status(403).json({ error: '사전 등록된 인원이 아닙니다. 관리자에게 문의하세요.' });

    const staffPhone = staff.phone.replace(/[^0-9]/g, '');
    if (!phoneDigits.endsWith(staffPhone) && phoneDigits !== staffPhone) {
      return res.status(403).json({ error: '이름 또는 연락처가 일치하지 않습니다.' });
    }

    const existingResult = await query('SELECT id FROM users WHERE phone = $1 OR (email = $2 AND $2 != \'\')', [phone, email || '']);
    const existing = existingResult.rows[0];
    if (existing) return res.status(409).json({ error: '이미 가입된 계정입니다.' });

    const id = uuidv4();
    await query(`INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
      id, staff.name, staff.department, staff.position, phone, email || '', password
    ]);
    await query('UPDATE approved_staff SET registered = 1 WHERE id = $1', [staff.id]);

    req.session.userId = id;
    res.json({ id, name: staff.name, department: staff.department, position: staff.position });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
});

// ─── 관리자 로그인 ───
const ADMIN_PASSWORD = '2024!';

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });
  req.session.isAdmin = true;
  let adminResult = await query('SELECT * FROM users WHERE id = $1', ['admin-user']);
  let adminUser = adminResult.rows[0];
  if (!adminUser) {
    await query(`INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
      'admin-user', '시스템관리자', '석유사업본부', '관리자', '', '', '__admin__'
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
    id, name, phone, department || '석유사업본부', position || '', location || '', role || ''
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
      [id, name, department || '석유사업본부', position || '', phone, '', password]);
    await query('UPDATE approved_staff SET registered = 1 WHERE name = $1', [name]);
    res.json({ ok: true, id, name });
  } catch (err) {
    console.error('Admin register error:', err.message);
    res.status(500).json({ error: '등록 실패: ' + err.message });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const result = await query('SELECT id, name, department, position, phone, email FROM users WHERE id = $1', [req.session.userId]);
  const user = result.rows[0];
  if (user && req.session.isAdmin) user.isAdmin = true;
  res.json(user);
});

app.get('/api/users', authMiddleware, async (req, res) => {
  const result = await query('SELECT id, name, department, position FROM users');
  res.json(result.rows);
});

// ─── 통합 검색 ───
app.get('/api/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const kw = `%${q.trim()}%`;

  const [reports, tasks, branches, manuals, meetings] = await Promise.all([
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
      ORDER BY meeting_date DESC LIMIT 10`, [kw])
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

  res.json({ query: q, total: results.length, results });
});

// ─── 캘린더 ───
app.get('/api/calendar', authMiddleware, async (req, res) => {
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

  res.json({
    week_activity: weekActivity,
    my_week_activity: myWeekActivity,
    my_categories: catResult.rows.map(r => ({ name: r.work_category, count: parseInt(r.cnt) })),
    month_count: parseInt(monthResult.rows[0].cnt),
    pending_approvals: parseInt(pendingResult.rows[0].cnt),
    my_top_tasks: recentTaskResult.rows.map(r => ({ task: r.what_task, category: r.work_category, count: parseInt(r.cnt) }))
  });
});

// ─── 업무일지 CRUD ───
app.get('/api/reports', authMiddleware, async (req, res) => {
  const { type, category, from, to } = req.query;
  let sql = 'SELECT r.*, u.name as author_name, u.position as author_position, (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id) as comment_count FROM work_reports r JOIN users u ON r.author_id = u.id WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (type) { sql += ` AND r.report_type = $${paramIdx++}`; params.push(type); }
  if (category) { sql += ` AND r.work_category = $${paramIdx++}`; params.push(category); }
  if (from) { sql += ` AND r.report_date >= $${paramIdx++}`; params.push(from); }
  if (to) { sql += ` AND r.report_date <= $${paramIdx++}`; params.push(to); }
  sql += ' ORDER BY r.report_date DESC, r.created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
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
    purpose, who, when_time, where_place, what_task, how_method, why_reason, content, recipients)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`, [
    id, req.session.userId, report_date, report_type, work_category,
    purpose, who, when_time, where_place, what_task, how_method, why_reason, content,
    recipients ? JSON.stringify(recipients) : null
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

// ─── 가맹점 관리 ───
app.get('/api/franchises', authMiddleware, async (req, res) => {
  const { region, status, type } = req.query;
  let sql = 'SELECT f.*, u.name as assigned_user_name FROM franchises f LEFT JOIN users u ON f.assigned_user_id = u.id WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (region) { sql += ` AND f.region = $${paramIdx++}`; params.push(region); }
  if (status) { sql += ` AND f.status = $${paramIdx++}`; params.push(status); }
  if (type) { sql += ` AND f.franchise_type = $${paramIdx++}`; params.push(type); }
  sql += ' ORDER BY f.created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.post('/api/franchises', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { name, region, address, owner_name, owner_phone, contract_date, status, franchise_type, notes } = req.body;
  await query(`INSERT INTO franchises (id, name, region, address, owner_name, owner_phone, contract_date, status, franchise_type, assigned_user_id, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
    id, name, region, address, owner_name, owner_phone, contract_date, status || 'active', franchise_type, req.session.userId, notes
  ]);
  res.json({ id });
});

app.get('/api/franchises/:id/visits', authMiddleware, async (req, res) => {
  const result = await query(`SELECT fv.*, u.name as visitor_name FROM franchise_visits fv
    JOIN users u ON fv.visitor_id = u.id WHERE fv.franchise_id = $1 ORDER BY fv.visit_date DESC`, [req.params.id]);
  res.json(result.rows);
});

app.post('/api/franchises/:id/visits', authMiddleware, async (req, res) => {
  const id = uuidv4();
  const { visit_date, purpose, content, result, next_action } = req.body;
  await query(`INSERT INTO franchise_visits (id, franchise_id, visitor_id, visit_date, purpose, content, result, next_action)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [id, req.params.id, req.session.userId, visit_date, purpose, content, result, next_action]);
  res.json({ id });
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

app.get('/api/branches/:id', authMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM branches WHERE id = $1', [req.params.id]);
  const branch = result.rows[0];
  if (!branch) return res.status(404).json({ error: '지국을 찾을 수 없습니다' });
  res.json(branch);
});

// ─── 기존가맹 거래처 신청서 ───
app.get('/api/franchise-apps', authMiddleware, async (req, res) => {
  const { search, status, oil } = req.query;
  let sql = 'SELECT * FROM franchise_apps WHERE 1=1';
  const params = [];
  let paramIdx = 1;
  if (search) {
    sql += ` AND (store_name LIKE $${paramIdx++} OR owner_name LIKE $${paramIdx++} OR address LIKE $${paramIdx++} OR biz_number LIKE $${paramIdx++} OR manager LIKE $${paramIdx++})`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) { sql += ` AND status = $${paramIdx++}`; params.push(status); }
  if (oil) { sql += ` AND oil_company LIKE $${paramIdx++}`; params.push(`%${oil}%`); }
  sql += ' ORDER BY seq';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.get('/api/franchise-apps/:id', authMiddleware, async (req, res) => {
  const result = await query('SELECT * FROM franchise_apps WHERE id = $1', [req.params.id]);
  const appData = result.rows[0];
  if (!appData) return res.status(404).json({ error: '데이터를 찾을 수 없습니다' });
  res.json(appData);
});

app.put('/api/franchise-apps/:id', authMiddleware, async (req, res) => {
  const { store_name, owner_name, biz_number, phone_land, owner_phone, address, oil_company, status, memo, paint_date, bank_info } = req.body;
  await query(`UPDATE franchise_apps SET store_name=$1, owner_name=$2, biz_number=$3, phone_land=$4, owner_phone=$5, address=$6, oil_company=$7, status=$8, memo=$9, paint_date=$10, bank_info=$11, updated_at=NOW() WHERE id=$12`, [
    store_name, owner_name, biz_number, phone_land, owner_phone, address, oil_company, status, memo, paint_date, bank_info, req.params.id
  ]);
  res.json({ ok: true });
});

app.get('/api/franchise-apps/stats/summary', authMiddleware, async (req, res) => {
  const totalResult = await query('SELECT COUNT(*) as cnt FROM franchise_apps');
  const total = parseInt(totalResult.rows[0].cnt);
  const byStatusResult = await query('SELECT status, COUNT(*) as cnt FROM franchise_apps GROUP BY status');
  const byStatus = byStatusResult.rows;
  const byOilResult = await query("SELECT oil_company, COUNT(*) as cnt FROM franchise_apps WHERE oil_company != '' AND oil_company IS NOT NULL GROUP BY oil_company ORDER BY cnt DESC");
  const byOil = byOilResult.rows;
  res.json({ total, byStatus, byOil });
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
  wb.creator = '석유사업본부 업무시스템';
  wb.created = new Date();
  const ws = wb.addWorksheet('주요업무표', { properties: { defaultRowHeight: 22 } });

  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '석유사업본부 주요업무표';
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

// ─── 엑셀 다운로드: 개인업무표 ───
app.get('/api/export/personal-tasks', authMiddleware, async (req, res) => {
  const { person } = req.query;
  const wb = new ExcelJS.Workbook();
  const s = applyExcelStyles(wb);
  wb.creator = '석유사업본부 업무시스템';

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
  wb.creator = '석유사업본부 업무시스템';
  const ws = wb.addWorksheet('전체 업무매뉴얼', { properties: { defaultRowHeight: 22 } });

  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = '석유사업본부 전체 업무매뉴얼';
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
  wb.creator = '석유사업본부 업무시스템';

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
app.get('/api/admin/insights', adminMiddleware, async (req, res) => {
  const notesResult = await query('SELECT * FROM meeting_notes WHERE summary IS NOT NULL ORDER BY meeting_date DESC');
  const notes = notesResult.rows;

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

  res.json({
    generated_at: new Date().toISOString(),
    notes_analyzed: notes.length,
    total_notes: (await query('SELECT COUNT(*) as cnt FROM meeting_notes')).rows[0].cnt,
    date_range: notes.length > 0 ? { from: notes[notes.length - 1].meeting_date, to: notes[0].meeting_date } : null,
    notes_summary: notes.map(n => ({ id: n.id, title: n.title, date: n.meeting_date })),
    themes: uniqueThemes,
    action_items: allActions,
    positive: {
      deductive: {
        major: '체계적 조직 확장과 서비스 다각화를 동시 추진하는 조직은 시장 지배력을 확보한다',
        minor: '석유사업본부는 전국주유소연합회 출범, 지역조직 구축, 묶음 관리 서비스 개발, 앱 교육을 동시에 체계적으로 추진하고 있다',
        conclusion: '현 전략이 완결될 경우, 하반기 내 석유 유통 시장에서 유의미한 영향력을 확보할 가능성이 높다'
      },
      inductive: {
        observations: [
          '가맹계약서 1,200개 확보 → 3,000개 목표까지 확장 의지 확인',
          '회장 직접 가맹점 방문 → 현장 신뢰도 상승 → 재계약률 향상 패턴',
          '소단위 앱 교육 전환 → 현장 적용률 향상 → 디지털 전환 가속',
          '러시아 직수입·저유고 건설·SBS 다큐 → 공급망 자립 기반 구축',
          '워크숍·회식으로 팀 결속 강화 → 실행력 유지'
        ],
        prediction: '2026년 하반기, 가맹점 순증 가속과 묶음 서비스 수익 모델 안착으로 자생적 성장 궤도 진입이 예상된다. 연말까지 가맹 2,000개소 돌파 가능성이 있으며, 제5정유사 제휴가 실현되면 업계 판도가 변화할 것이다.'
      }
    },
    negative: {
      deductive: {
        major: '동시다발적 프로젝트 추진은 핵심 역량의 분산과 실행력 저하를 초래한다',
        minor: '연합회 출범, 850명 규모 대형 행사, 교육, 지역재편, 선거대응, 저유고 건설, 앱 개발이 동시에 진행되고 있으며, 일부 직영 주유소에서 근무 태도 문제와 비용 커뮤니케이션 공백이 이미 발생하고 있다',
        conclusion: '우선순위 미설정 시, 핵심 사업 어느 것도 완결되지 못하는 "미완의 확장" 상태에 빠질 위험이 있다'
      },
      inductive: {
        observations: [
          '직영 주유소 고객 응대 미흡 → 현장 관리 공백의 신호',
          '공과금·유류대금 사전보고 없이 끊김 → 내부 커뮤니케이션 체계의 약화',
          '예산 미확정 상태의 대규모 행사 기획 → 재정 리스크 노출',
          '정치적 중립 표방 vs 법 개정 위한 정치인 관계 유지 → 외부 환경 변수의 불확실성',
          '주유소 사장들의 높은 경계심 → 신뢰 구축 속도가 기대보다 느릴 가능성'
        ],
        prediction: '관리 인력이 확장 속도를 따라잡지 못할 경우, 하반기 조직 피로도가 급상승하여 핵심 인력 이탈과 가맹점 이탈이 동시에 발생할 수 있다. 특히 정유사의 견제가 본격화되면 계약 전환율이 급격히 하락할 위험이 있다.'
      }
    },
    recommendation: {
      worst: '모든 프로젝트를 동시에 밀어붙이다 어느 것도 완결하지 못하고, 현장 관리까지 무너지는 시나리오',
      best: '모든 프로젝트가 완벽히 실행되어 연말까지 업계 판도 변화를 이끄는 시나리오 (비현실적)',
      second_best: '핵심 3대 과제에 집중하고, 나머지는 3분기 이후 순차 추진하여 확실한 기반 위에 성장하는 전략',
      actions: [
        { priority: '최우선', task: '가맹점 관리 체계 완성', reason: '1,200개 기존 가맹점의 만족도가 신규 영업보다 중요. 이탈 방지가 곧 성장' },
        { priority: '최우선', task: '직영 주유소 현장 관리 정상화', reason: '근무 태도·비용 보고 문제는 조직 신뢰의 근간. 즉시 해결 필요' },
        { priority: '우선', task: '연합회 조직 기반 완성', reason: '500명 추가 가입 확보가 법 개정 추진의 전제조건' },
        { priority: '보류 가능', task: '대규모 행사·워크숍', reason: '기반이 다져진 후 실시해도 효과는 동일. 예산 확정 후 추진 권장' },
        { priority: '보류 가능', task: '러시아 직수입·제5정유사 제휴', reason: '중장기 과제로 분류. 현재는 정보 수집 단계 유지' }
      ]
    }
  });
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
  mermaid += '  ROOT["석유사업본부 업무"]\n';
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
  overview += '  ORG["석유사업본부"]\n';
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
  const franchiseCount = await query('SELECT COUNT(*) as cnt FROM franchises');

  res.json({
    total_reports: totalReports,
    total_people: peopleResult.rows.length,
    people: peopleResult.rows.map(r => ({ name: r.name, position: r.position, reports: parseInt(r.cnt) })),
    categories: catResult.rows.map(r => ({ name: r.work_category, count: parseInt(r.cnt) })),
    core_tasks: coreTasks.slice(0, 15),
    regular_tasks: regularTasks.slice(0, 10),
    all_tasks_count: allTasks.length,
    person_roles: personRoles,
    branch_count: parseInt(branchCount.rows[0].cnt),
    franchise_count: parseInt(franchiseCount.rows[0].cnt)
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
    if (mainCat === '외근') focus.push('현장 방문 및 가맹점 관리 집중');
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
    SELECT title, done, updated_at, created_at FROM todos WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  todos.rows.forEach(t => {
    if (t.done) items.push({
      type: 'todo_done', icon: '&#9989;', color: '#10b981',
      title: '할 일 완료',
      sub: t.title,
      date: t.updated_at || t.created_at
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
  await query('DELETE FROM bookmarks WHERE user_id = $1 AND report_id = $2', [userId, parseInt(req.params.reportId)]);
  res.json({ ok: true });
});

app.get('/api/bookmarks/check/:reportId', authMiddleware, async (req, res) => {
  const userId = req.session.userId;
  const result = await query('SELECT id FROM bookmarks WHERE user_id = $1 AND report_id = $2', [userId, parseInt(req.params.reportId)]);
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
    SELECT title, done, due_date FROM todos
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
    todos: todoResult.rows.map(t => ({ title: t.title, done: t.done, due_date: (t.due_date || '').toString().split('T')[0] }))
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
    SELECT due_date, title, done
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
    days[d].todos.push({ title: t.title, done: t.done });
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
  const todoResult = await query(`
    SELECT id, title, due_date FROM todos
    WHERE user_id = $1 AND completed = FALSE AND due_date IS NOT NULL AND due_date <= $2
    ORDER BY due_date ASC LIMIT 10
  `, [userId, today]);
  todoResult.rows.forEach(t => {
    items.push({ type: 'todo', todo_id: t.id, title: `할 일 마감: ${t.title}`, detail: '', sub: `마감일: ${(t.due_date||'').split('T')[0]}`, time: t.due_date });
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
  await query('INSERT INTO attendance (id, user_id, work_date, check_in, status) VALUES ($1,$2,$3,$4,$5)',
    [id, req.session.userId, today, now, status]);
  res.json({ id, check_in: now.toISOString(), status });
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
    console.log(`석유사업본부 업무시스템 서버 실행: http://localhost:${PORT}`);
  });
})();
