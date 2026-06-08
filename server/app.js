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

// ─── 업무일지 CRUD ───
app.get('/api/reports', authMiddleware, async (req, res) => {
  const { type, category, from, to } = req.query;
  let sql = 'SELECT r.*, u.name as author_name, u.position as author_position FROM work_reports r JOIN users u ON r.author_id = u.id WHERE 1=1';
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
  res.json({ ...report, approvals: approvalsResult.rows });
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
  await query('INSERT INTO weekly_plans (id, author_id, week_start, week_end) VALUES ($1, $2, $3, $4)', [
    id, req.session.userId, week_start, week_end
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
