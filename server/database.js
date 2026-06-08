const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const db = new Database(path.join(__dirname, '..', 'data', 'petroleum.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- 사용자
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT DEFAULT '석유사업본부',
    position TEXT,
    phone TEXT,
    email TEXT,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 결재라인 (approval line)
  CREATE TABLE IF NOT EXISTS approval_lines (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    approver_id TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    comment TEXT,
    approved_at DATETIME,
    FOREIGN KEY (approver_id) REFERENCES users(id)
  );

  -- 업무일지 (work reports)
  CREATE TABLE IF NOT EXISTS work_reports (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    report_date DATE NOT NULL,
    report_type TEXT NOT NULL CHECK(report_type IN ('daily', 'weekly')),
    work_category TEXT NOT NULL CHECK(work_category IN ('내근', '외근', '출장')),
    purpose TEXT,
    -- 육하원칙 (5W1H)
    who TEXT,
    when_time TEXT,
    where_place TEXT,
    what_task TEXT,
    how_method TEXT,
    why_reason TEXT,
    content TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected')),
    recipients TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  -- 주간계획 (weekly plans)
  CREATE TABLE IF NOT EXISTS weekly_plans (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  -- 주간계획 항목
  CREATE TABLE IF NOT EXISTS weekly_plan_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    work_category TEXT NOT NULL,
    content TEXT,
    location TEXT,
    purpose TEXT,
    FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE
  );

  -- 가맹점 관리 (franchise management)
  CREATE TABLE IF NOT EXISTS franchises (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    address TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    contract_date DATE,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'prospect')),
    franchise_type TEXT CHECK(franchise_type IN ('existing', 'new_prospect')),
    assigned_user_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id)
  );

  -- 가맹점 방문기록
  CREATE TABLE IF NOT EXISTS franchise_visits (
    id TEXT PRIMARY KEY,
    franchise_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    visit_date DATE NOT NULL,
    purpose TEXT,
    content TEXT,
    result TEXT,
    next_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (franchise_id) REFERENCES franchises(id),
    FOREIGN KEY (visitor_id) REFERENCES users(id)
  );

  -- 반복 템플릿 (reusable templates)
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 자주 사용하는 항목 (frequently used items for auto-suggest)
  CREATE TABLE IF NOT EXISTS frequent_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_value TEXT NOT NULL,
    use_count INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 데모 사용자 생성
const demoUser = db.prepare('SELECT id FROM users WHERE id = ?').get('demo-user');
if (!demoUser) {
  db.prepare(`INSERT INTO users (id, name, department, position, phone, email, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'demo-user', '김석유', '석유사업본부', '과장', '010-1234-5678', 'demo@petroleum.co.kr', 'demo1234'
  );
  db.prepare(`INSERT INTO users (id, name, department, position, phone, email, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'demo-manager', '박본부장', '석유사업본부', '본부장', '010-9876-5432', 'manager@petroleum.co.kr', 'demo1234'
  );
  db.prepare(`INSERT INTO users (id, name, department, position, phone, email, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'demo-team-lead', '이팀장', '석유사업본부', '팀장', '010-5555-1234', 'teamlead@petroleum.co.kr', 'demo1234'
  );
}

module.exports = { db, uuidv4 };
