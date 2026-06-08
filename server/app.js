const express = require('express');
const session = require('express-session');
const path = require('path');
const { db, uuidv4 } = require('./database');

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
  if (req.session.userId) return next();
  res.status(401).json({ error: '로그인이 필요합니다' });
}

// ─── 인증 ───
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash = ?').get(email, password);
  if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, department: user.department, position: user.position });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, department, position, phone, email FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, name, department, position FROM users').all();
  res.json(users);
});

// ─── 업무일지 CRUD ───
app.get('/api/reports', authMiddleware, (req, res) => {
  const { type, category, from, to } = req.query;
  let sql = 'SELECT r.*, u.name as author_name, u.position as author_position FROM work_reports r JOIN users u ON r.author_id = u.id WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND r.report_type = ?'; params.push(type); }
  if (category) { sql += ' AND r.work_category = ?'; params.push(category); }
  if (from) { sql += ' AND r.report_date >= ?'; params.push(from); }
  if (to) { sql += ' AND r.report_date <= ?'; params.push(to); }
  sql += ' ORDER BY r.report_date DESC, r.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/reports/:id', authMiddleware, (req, res) => {
  const report = db.prepare(`
    SELECT r.*, u.name as author_name, u.position as author_position
    FROM work_reports r JOIN users u ON r.author_id = u.id WHERE r.id = ?
  `).get(req.params.id);
  if (!report) return res.status(404).json({ error: '업무일지를 찾을 수 없습니다' });
  const approvals = db.prepare(`
    SELECT a.*, u.name as approver_name, u.position as approver_position
    FROM approval_lines a JOIN users u ON a.approver_id = u.id
    WHERE a.report_id = ? ORDER BY a.step_order
  `).all(req.params.id);
  res.json({ ...report, approvals });
});

app.post('/api/reports', authMiddleware, (req, res) => {
  const id = uuidv4();
  const { report_date, report_type, work_category, purpose, who, when_time, where_place,
    what_task, how_method, why_reason, content, recipients, approvers } = req.body;

  db.prepare(`INSERT INTO work_reports (id, author_id, report_date, report_type, work_category,
    purpose, who, when_time, where_place, what_task, how_method, why_reason, content, recipients)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, req.session.userId, report_date, report_type, work_category,
    purpose, who, when_time, where_place, what_task, how_method, why_reason, content,
    recipients ? JSON.stringify(recipients) : null
  );

  if (approvers && approvers.length > 0) {
    const insertApproval = db.prepare(`INSERT INTO approval_lines (id, report_id, approver_id, step_order) VALUES (?, ?, ?, ?)`);
    approvers.forEach((approverId, idx) => {
      insertApproval.run(uuidv4(), id, approverId, idx + 1);
    });
  }

  trackFrequentItems(req.session.userId, req.body);
  res.json({ id });
});

app.put('/api/reports/:id', authMiddleware, (req, res) => {
  const { report_date, report_type, work_category, purpose, who, when_time, where_place,
    what_task, how_method, why_reason, content, status } = req.body;
  db.prepare(`UPDATE work_reports SET report_date=?, report_type=?, work_category=?,
    purpose=?, who=?, when_time=?, where_place=?, what_task=?, how_method=?, why_reason=?,
    content=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND author_id=?`).run(
    report_date, report_type, work_category, purpose, who, when_time, where_place,
    what_task, how_method, why_reason, content, status, req.params.id, req.session.userId
  );
  res.json({ ok: true });
});

app.delete('/api/reports/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM approval_lines WHERE report_id = ?').run(req.params.id);
  db.prepare('DELETE FROM work_reports WHERE id = ? AND author_id = ?').run(req.params.id, req.session.userId);
  res.json({ ok: true });
});

// ─── 결재 처리 ───
app.post('/api/reports/:id/approve', authMiddleware, (req, res) => {
  const { status, comment } = req.body;
  db.prepare(`UPDATE approval_lines SET status = ?, comment = ?, approved_at = CURRENT_TIMESTAMP
    WHERE report_id = ? AND approver_id = ?`).run(status, comment, req.params.id, req.session.userId);

  const allApproved = db.prepare(`SELECT COUNT(*) as cnt FROM approval_lines WHERE report_id = ? AND status != 'approved'`).get(req.params.id);
  if (allApproved.cnt === 0) {
    db.prepare(`UPDATE work_reports SET status = 'approved' WHERE id = ?`).run(req.params.id);
  } else if (status === 'rejected') {
    db.prepare(`UPDATE work_reports SET status = 'rejected' WHERE id = ?`).run(req.params.id);
  }
  res.json({ ok: true });
});

// ─── 주간계획 ───
app.get('/api/weekly-plans', authMiddleware, (req, res) => {
  const plans = db.prepare(`SELECT wp.*, u.name as author_name FROM weekly_plans wp
    JOIN users u ON wp.author_id = u.id ORDER BY wp.week_start DESC`).all();
  res.json(plans);
});

app.post('/api/weekly-plans', authMiddleware, (req, res) => {
  const id = uuidv4();
  const { week_start, week_end, items } = req.body;
  db.prepare('INSERT INTO weekly_plans (id, author_id, week_start, week_end) VALUES (?, ?, ?, ?)').run(
    id, req.session.userId, week_start, week_end
  );
  if (items) {
    const insert = db.prepare('INSERT INTO weekly_plan_items (id, plan_id, day_of_week, work_category, content, location, purpose) VALUES (?, ?, ?, ?, ?, ?, ?)');
    items.forEach(item => {
      insert.run(uuidv4(), id, item.day_of_week, item.work_category, item.content, item.location, item.purpose);
    });
  }
  res.json({ id });
});

app.get('/api/weekly-plans/:id', authMiddleware, (req, res) => {
  const plan = db.prepare('SELECT wp.*, u.name as author_name FROM weekly_plans wp JOIN users u ON wp.author_id = u.id WHERE wp.id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: '주간계획을 찾을 수 없습니다' });
  const items = db.prepare('SELECT * FROM weekly_plan_items WHERE plan_id = ? ORDER BY day_of_week').all(req.params.id);
  res.json({ ...plan, items });
});

// ─── 가맹점 관리 ───
app.get('/api/franchises', authMiddleware, (req, res) => {
  const { region, status, type } = req.query;
  let sql = 'SELECT f.*, u.name as assigned_user_name FROM franchises f LEFT JOIN users u ON f.assigned_user_id = u.id WHERE 1=1';
  const params = [];
  if (region) { sql += ' AND f.region = ?'; params.push(region); }
  if (status) { sql += ' AND f.status = ?'; params.push(status); }
  if (type) { sql += ' AND f.franchise_type = ?'; params.push(type); }
  sql += ' ORDER BY f.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/franchises', authMiddleware, (req, res) => {
  const id = uuidv4();
  const { name, region, address, owner_name, owner_phone, contract_date, status, franchise_type, notes } = req.body;
  db.prepare(`INSERT INTO franchises (id, name, region, address, owner_name, owner_phone, contract_date, status, franchise_type, assigned_user_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, region, address, owner_name, owner_phone, contract_date, status || 'active', franchise_type, req.session.userId, notes
  );
  res.json({ id });
});

app.get('/api/franchises/:id/visits', authMiddleware, (req, res) => {
  const visits = db.prepare(`SELECT fv.*, u.name as visitor_name FROM franchise_visits fv
    JOIN users u ON fv.visitor_id = u.id WHERE fv.franchise_id = ? ORDER BY fv.visit_date DESC`).all(req.params.id);
  res.json(visits);
});

app.post('/api/franchises/:id/visits', authMiddleware, (req, res) => {
  const id = uuidv4();
  const { visit_date, purpose, content, result, next_action } = req.body;
  db.prepare(`INSERT INTO franchise_visits (id, franchise_id, visitor_id, visit_date, purpose, content, result, next_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.params.id, req.session.userId, visit_date, purpose, content, result, next_action);
  res.json({ id });
});

// ─── 템플릿 (반복 업무 자동생성) ───
app.get('/api/templates', authMiddleware, (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM templates WHERE user_id = ?';
  const params = [req.session.userId];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY use_count DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/templates', authMiddleware, (req, res) => {
  const id = uuidv4();
  const { category, title, content_json } = req.body;
  db.prepare('INSERT INTO templates (id, user_id, category, title, content_json) VALUES (?, ?, ?, ?, ?)').run(
    id, req.session.userId, category, title, JSON.stringify(content_json)
  );
  res.json({ id });
});

app.post('/api/templates/:id/use', authMiddleware, (req, res) => {
  db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(req.params.id);
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  res.json(template);
});

// ─── 자주 사용하는 항목 (자동완성) ───
app.get('/api/frequent-items', authMiddleware, (req, res) => {
  const { field_name } = req.query;
  const items = db.prepare('SELECT field_value, use_count FROM frequent_items WHERE user_id = ? AND field_name = ? ORDER BY use_count DESC LIMIT 10')
    .all(req.session.userId, field_name);
  res.json(items);
});

function trackFrequentItems(userId, data) {
  const fields = ['purpose', 'where_place', 'what_task', 'how_method', 'why_reason'];
  const upsert = db.prepare(`INSERT INTO frequent_items (id, user_id, field_name, field_value, use_count)
    VALUES (?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET use_count = use_count + 1`);
  const find = db.prepare('SELECT id FROM frequent_items WHERE user_id = ? AND field_name = ? AND field_value = ?');

  fields.forEach(field => {
    if (data[field] && data[field].trim()) {
      const existing = find.get(userId, field, data[field].trim());
      if (existing) {
        db.prepare('UPDATE frequent_items SET use_count = use_count + 1 WHERE id = ?').run(existing.id);
      } else {
        upsert.run(uuidv4(), userId, field, data[field].trim());
      }
    }
  });
}

// ─── 업무표 자동생성 (개인별 업무 종합) ───
app.get('/api/work-table', authMiddleware, (req, res) => {
  const { from, to, user_id } = req.query;
  const targetUser = user_id || req.session.userId;
  const reports = db.prepare(`
    SELECT r.*, u.name as author_name, u.position as author_position
    FROM work_reports r JOIN users u ON r.author_id = u.id
    WHERE r.author_id = ? AND r.report_date BETWEEN ? AND ?
    ORDER BY r.report_date ASC
  `).all(targetUser, from, to);

  const grouped = {};
  reports.forEach(r => {
    if (!grouped[r.report_date]) grouped[r.report_date] = [];
    grouped[r.report_date].push(r);
  });

  res.json({ user_id: targetUser, from, to, daily_reports: grouped, total_count: reports.length });
});

// ─── 개인업무 매뉴얼 자동생성 ───
app.get('/api/manual', authMiddleware, (req, res) => {
  const reports = db.prepare(`
    SELECT work_category, purpose, what_task, how_method, where_place, COUNT(*) as frequency
    FROM work_reports WHERE author_id = ?
    GROUP BY work_category, purpose, what_task, how_method, where_place
    ORDER BY frequency DESC
  `).all(req.session.userId);

  const manual = {};
  reports.forEach(r => {
    if (!manual[r.work_category]) manual[r.work_category] = [];
    manual[r.work_category].push({
      purpose: r.purpose,
      task: r.what_task,
      method: r.how_method,
      location: r.where_place,
      frequency: r.frequency
    });
  });

  res.json({ generated_at: new Date().toISOString(), manual });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`석유사업본부 업무시스템 서버 실행: http://localhost:${PORT}`);
});
