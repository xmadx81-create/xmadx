const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_KlgHs8MJz6aj@ep-soft-resonance-aofgmv2m-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('Query error:', err.message, '\nSQL:', text.substring(0, 200));
    throw err;
  }
}

async function initDB() {
  console.log('Connecting to PostgreSQL (Neon)...');
  try {
    const test = await pool.query('SELECT NOW()');
    console.log('PostgreSQL connected:', test.rows[0].now);
  } catch (err) {
    console.error('PostgreSQL connection FAILED:', err.message);
    throw err;
  }
  // ═══ CREATE TABLES (each separately for pooler compatibility) ═══
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT DEFAULT '석유사업본부',
      position TEXT, phone TEXT, email TEXT, password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS approval_lines (
      id TEXT PRIMARY KEY, report_id TEXT NOT NULL, approver_id TEXT NOT NULL,
      step_order INTEGER NOT NULL, status TEXT DEFAULT 'pending', comment TEXT,
      approved_at TIMESTAMP, FOREIGN KEY (approver_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS work_reports (
      id TEXT PRIMARY KEY, author_id TEXT NOT NULL, report_date DATE NOT NULL,
      report_type TEXT NOT NULL, work_category TEXT NOT NULL, purpose TEXT, who TEXT,
      when_time TEXT, where_place TEXT, what_task TEXT, how_method TEXT, why_reason TEXT,
      content TEXT, task_ref_id TEXT, status TEXT DEFAULT 'draft', recipients TEXT,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS weekly_plans (
      id TEXT PRIMARY KEY, author_id TEXT NOT NULL, week_start DATE NOT NULL,
      week_end DATE NOT NULL, status TEXT DEFAULT 'draft', created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS weekly_plan_items (
      id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, day_of_week INTEGER NOT NULL,
      work_category TEXT NOT NULL, content TEXT, location TEXT, purpose TEXT,
      FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS franchises (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL, address TEXT,
      owner_name TEXT, owner_phone TEXT, contract_date DATE, status TEXT DEFAULT 'active',
      franchise_type TEXT, assigned_user_id TEXT, notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(), FOREIGN KEY (assigned_user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS franchise_visits (
      id TEXT PRIMARY KEY, franchise_id TEXT NOT NULL, visitor_id TEXT NOT NULL,
      visit_date DATE NOT NULL, purpose TEXT, content TEXT, result TEXT, next_action TEXT,
      created_at TIMESTAMP DEFAULT NOW(), FOREIGN KEY (franchise_id) REFERENCES franchises(id),
      FOREIGN KEY (visitor_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL,
      title TEXT NOT NULL, content_json TEXT NOT NULL, use_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS frequent_items (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, field_name TEXT NOT NULL,
      field_value TEXT NOT NULL, use_count INTEGER DEFAULT 1,
      UNIQUE (user_id, field_name, field_value), FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY, seq INTEGER, name TEXT NOT NULL, address TEXT,
      manager_name TEXT, manager_phone TEXT, exclude_service INTEGER DEFAULT 0,
      field_contact_name TEXT, field_contact_phone TEXT, email TEXT,
      move_status TEXT, move_address TEXT, move_note TEXT, created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS task_master (
      id TEXT PRIMARY KEY, department TEXT, division TEXT, category1 TEXT,
      task_group TEXT, task_detail TEXT, assigned_to TEXT, note TEXT,
      is_custom INTEGER DEFAULT 0, created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS task_notes (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, author_id TEXT NOT NULL,
      content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW(),
      FOREIGN KEY (task_id) REFERENCES task_master(id), FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS personal_manual (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, task_group TEXT, title TEXT NOT NULL,
      content TEXT, steps TEXT, tips TEXT, is_auto INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(), FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS personal_task_table (
      id TEXT PRIMARY KEY, department TEXT, division TEXT, position TEXT,
      person_name TEXT, task_group TEXT, task_detail TEXT, note TEXT,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS approved_staff (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL,
      department TEXT DEFAULT '석유사업본부', position TEXT, location TEXT, role TEXT,
      registered INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS franchise_apps (
      id TEXT PRIMARY KEY, seq INTEGER, receipt_date TEXT, join_date TEXT,
      manager TEXT, branch TEXT, store_name TEXT, owner_name TEXT, biz_number TEXT,
      phone_land TEXT, owner_phone TEXT, bank_info TEXT, address TEXT,
      applicant_name TEXT, applicant_org TEXT, applicant_title TEXT, applicant_phone TEXT,
      oil_company TEXT, app_type TEXT, paint_date TEXT, actual_date TEXT,
      status TEXT DEFAULT '정상', memo TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS meeting_notes (
      id TEXT PRIMARY KEY, notion_id TEXT UNIQUE, title TEXT NOT NULL,
      meeting_date DATE NOT NULL, summary TEXT, notion_url TEXT,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      priority TEXT DEFAULT 'normal', pinned BOOLEAN DEFAULT FALSE,
      active BOOLEAN DEFAULT TRUE, author_name TEXT DEFAULT '관리자',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
      memo TEXT DEFAULT '', priority TEXT DEFAULT 'normal',
      due_date DATE, completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, report_id TEXT NOT NULL, author_id TEXT NOT NULL,
      author_name TEXT NOT NULL, content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, work_date DATE NOT NULL,
      check_in TIMESTAMP, check_out TIMESTAMP, status TEXT DEFAULT 'normal',
      memo TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, work_date))`,
    `CREATE TABLE IF NOT EXISTS board_posts (
      id TEXT PRIMARY KEY, author_id TEXT NOT NULL, author_name TEXT NOT NULL,
      category TEXT DEFAULT '자유', title TEXT NOT NULL, content TEXT NOT NULL,
      view_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS board_comments (
      id TEXT PRIMARY KEY, post_id TEXT NOT NULL, author_id TEXT NOT NULL,
      author_name TEXT NOT NULL, content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS team_events (
      id TEXT PRIMARY KEY, author_id TEXT NOT NULL, author_name TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT DEFAULT '',
      event_date DATE NOT NULL, event_time TEXT DEFAULT '',
      event_type TEXT DEFAULT '회의', color TEXT DEFAULT '#3b82f6',
      created_at TIMESTAMP DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, report_id INTEGER NOT NULL,
      memo TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, report_id))`,
    `CREATE TABLE IF NOT EXISTS quick_notes (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL,
      color TEXT DEFAULT '#fef3c7', pinned BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`
  ];
  for (const sql of tables) {
    await query(sql);
  }
  console.log('All tables created');

  // ═══ SEED DATA ═══

  // ─── 데모 사용자 생성 ───
  const demoCheck = await query(`SELECT id FROM users WHERE id = $1`, ['demo-user']);
  if (demoCheck.rows.length === 0) {
    await query(
      `INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['demo-user', '김석유', '석유사업본부', '과장', '010-1234-5678', 'demo@petroleum.co.kr', 'demo1234']
    );
    await query(
      `INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['demo-manager', '박본부장', '석유사업본부', '본부장', '010-9876-5432', 'manager@petroleum.co.kr', 'demo1234']
    );
    await query(
      `INSERT INTO users (id, name, department, position, phone, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['demo-team-lead', '이팀장', '석유사업본부', '팀장', '010-5555-1234', 'teamlead@petroleum.co.kr', 'demo1234']
    );
  }

  // ─── 전국 지국 데이터 시드 ───
  const branchCount = await query(`SELECT COUNT(*) as cnt FROM branches`);
  if (parseInt(branchCount.rows[0].cnt) === 0) {
    const branches = [
      [1,'거제지국','경남 거제시 사등면 두동로 54-8, 나라빌딩 302호','조선이','010-3131-2318',0,'이세진(전산)','010-6520-0924','ebts_geoje@naver.com'],
      [2,'거창지점','경남 거창군 거창읍 대평리 1296-5번지 1층','변인해','010-3689-1833',0,'','',''],
      [3,'경남연수원','경남 창원시 마산합포구 오동서6길28, 1층','이수진','010-8621-3434',0,'박현정(전산)','010-3572-3434','ebts_kny@naver.com'],
      [4,'경산중앙지국','경북 경산시 삼성현로 600, ebts 협동조합','이향희','010-6612-9387',0,'김혜선(전산)','010-5003-2642','ebts_gyeongsan@naver.com'],
      [5,'경주건천지국','경북 경주시 충효녹지길 34, 2층','차은산','010-9608-0177',0,'차은산','010-9608-0177','ebts_geoncheon@naver.com'],
      [6,'경주남부지국','경북 경주시 동성로25, 2층','엄은혜','010-4612-7679',0,'엄은혜','010-4612-7679','ebts_gyeongju@naver.com'],
      [7,'경주서라벌지국','경북 경주시 서라벌대로417 (경주 독도사랑휴게소)','이종희','010-2577-0111',0,'이종희','010-2577-0111','ebts_gyeongjuwest@naver.com'],
      [8,'고성지점','경남 고성군 고성읍 중앙로 25번길 58, 고성시장상가 마5동 105호','이정선','010-4445-8684',0,'강나운(팀장)','010-3975-9628','ebts_goseong@naver.com'],
      [9,'광양서부지국','전남 광양시 광영동 802-20, 3층 이비티에스협동조합','이선미','010-6368-3786',0,'이유진(전산)','010-9922-9612','ebts_gwangyang@naver.com'],
      [10,'광양중동지국','전남 광양시 중마중앙로 128, 2층','고금선','010-8512-8889',0,'고금선','010-8512-8889','ebts_jeonnam@naver.com'],
      [11,'광주동부지국','광주 동구 천변우로 339, 제일오피스텔 1605호','김영복','010-2613-5063',0,'김영복','010-2613-5063','ebts_gjdb@naver.com'],
      [12,'광주비엔날레지점','광주 북구 우치로 228번길 36-15 (2층)','김대희','010-9944-4556',0,'김대희','010-9944-4556','ebts_biennale@naver.com'],
      [13,'광주빛고을지점','광주 서구 쌍촌동 1273-13, 상무네이처빌 201호','문혜경','010-2708-7564',0,'문혜경','010-2708-7564','ebts_kjbge@naver.com'],
      [14,'광주중앙지국','광주 동구 문화전당로19-1, 서은빌딩 501호','강병구','010-4494-3737',0,'최정원','010-2610-1111','ebts_kjja@naver.com'],
      [15,'구미광평지국','경북 구미시 광평동322 1층','김해숙','010-3050-9497',0,'김해숙','010-3050-9497',''],
      [16,'구미금오지국','경북 구미시 구미중앙로 25길18, 2층','장재도','010-8587-7171',0,'장재도','010-8587-7171',''],
      [17,'구미복지센터','경북 구미시 원평동1033-4 1.2층','장희순','010-7559-7556',0,'','',''],
      [18,'구미송정지국','경북 구미시 송원서로2길 9, 2층','장희순','010-7559-8556',0,'','',''],
      [19,'구미옥계지국','경북 구미시 옥계2공단로 278-13, 2층','이상남','010-9585-7974',0,'이성제(전산)','010-6395-4059','ebts_gmok@naver.com'],
      [20,'구미지국','경북 구미시 금오시장로 28, 1층','오도현','010-2860-8238',0,'장유나','010-7713-7993','ebts_gumi@naver.com'],
      [21,'구미형곡지국','경북 구미시 형곡동 278-4, 2층','김은숙','010-2746-7469',0,'장호영(전산)','010-4138-4198','ebts_hyeonggok@naver.com'],
      [22,'군산지국','전북 군산시 하신1길29-4, 1층','문순옥','010-3044-2963',0,'문순옥','010-3044-2963','ebts_gunsan@naver.com'],
      [23,'김해중앙지국','경남 김해시 분성로 664번지, 2층','김현서','010-3340-3474',0,'김현서','010-3340-3474','ebts_gimhaejungang@naver.com'],
      [24,'김해지국','경남 김해시 대청계곡길24, 지하 1층','오진숙','010-5052-1027',0,'오진숙','010-5052-1027','ebts_kh@naver.com'],
      [25,'남원지국','전북 남원시 동림로47, 1층','김종관','010-2654-1683',0,'이정아(전산)','010-3550-1683','ebts_namwon@naver.com'],
      [26,'대구남부지국','대구 달서구 월곡로137 루마 버텍스 2층','홍미선','010-5290-8301',0,'홍미선','010-5290-8301','ebts_dgnambu@naver.com'],
      [27,'대구동부지국','대구 동구 해동로 214, 아파트상가 2층','최영숙','010-2810-3621',0,'최영숙','010-2810-3621','ebts_dongboo@naver.com'],
      [28,'대구문화센터','대구 달서구 월곡로26길 33, 3층','김지혜','010-5305-0824',1,'김지혜(전산)','010-5305-0824','ebts_dghealing@naver.com'],
      [29,'대구서부지국','대구 서구 통학로 17, 2층 (내당동 13-33)','정옥희','010-3519-4678',0,'최혜원(팀장)','010-5337-6871','ebts_dgsb@naver.com'],
      [30,'대구송현지점','대구 달서구 월배로 433, 2층','장미애','010-5586-5520',0,'박지현(전산)','010-5693-1119','ebts_dgsh@naver.com'],
      [31,'대구수성지국','대구 수성구 국채보상로 969, 3층','이재옥','010-3829-8288',0,'박현지(전산)','010-4923-8288','ebts_soosung@naver.com'],
      [32,'대구지국','대구 동구 동대구로85길 60, 4층 이비티에스협동조합','김재희','010-9925-4062',0,'김재희','010-9925-4062','ebts_daegu@naver.com'],
      [33,'대전서부지국','대전 유성구 구암동 592-3, 201호 이비티에스협동조합','이정아','010-6708-6457',0,'최영숙(교육팀장)','010-5172-3674','ebts_djsb@naver.com'],
      [34,'대전지국','대전 중구 계백로 1719, 센트리아오피스텔 12층1225호','박종천','010-8082-5505',0,'박종천','010-8082-5505','ebts_daejeon@naver.com'],
      [35,'리츠지국','울산 울주군 삼남읍 도호1길 12, 골드테라스타워상가 1011호','박해선','010-6792-9800',0,'박해선','010-6792-9800','ebts_reits@naver.com'],
      [36,'마산동부지국','경남 창원시 마산회원구 합성동7길 17, 1층','박미지','010-6606-5158',0,'박미지','010-6606-5158','ebts_msdb@naver.com'],
      [37,'마산해운지국','경남 창원시 마산합포구 남성동130번지 2층','','',0,'김규림(전산)','010-6601-3558','ebts_mshu@naver.com'],
      [38,'문경지국','경북 문경시 시청2길 16, 2층','박정아','010-6688-2870',0,'박정아','010-6688-2870',''],
      [39,'부산대지국','부산 금정구 금정로126, 5층','유송재','010-2664-1581',0,'조영미','010-4722-1660','ebts_bsd@naver.com'],
      [40,'부산동구지국','부산 동구 중앙대로336, 한성빌딩 301호','김광현','010-7751-6288',0,'현용선(전산)','010-2784-3578','ebts_dong-gu6288@naver.com'],
      [41,'부산수영문화센터','부산 수영구 광안동 1077-19, 4층','유영내','010-7710-8944',0,'강도원(전산)','010-4699-5024','ebts_suyoung@naver.com'],
      [42,'부산영도지국','부산 영도구 태종로 70-1, 3층 (대교동1가)','이동희','010-3550-9028',0,'이동희','010-3550-9028','ebts_yeongdo@naver.com'],
      [43,'상주지국','경북 상주시 무양동 246-5 (상주시 상산로 333) 2층','이유희','010-4523-1395',0,'','',''],
      [44,'성주지국','경북 성주군 성주로 3244, 202호','김주형','010-3506-3935',0,'송서목','010-5714-3915','ebts_seongju@naver.com'],
      [45,'순천지국','전남 광양시 광양읍 인덕로 985, 3층','박미건','010-7680-4600',0,'박미건','010-7680-4600','ebts_yeosu@naver.com'],
      [46,'신경산지국','경북 경산시 원효로26길 17, 1층','정명희','010-8223-1435',0,'이미나','010-7432-9920','ebts_newks@naver.com'],
      [47,'신양산지국','경남 양산시 물금읍 증산역로 177, 라피에스타양산 5층 제5-002호','김은숙','010-9575-7876',0,'전하나(전산)','010-8636-9926','ebts_yangsantwo@naver.com'],
      [48,'경남지역본부','경남 양산시 물금읍 야리2길 27 골든프라자 201호','김권아','010-5185-1354',0,'','',''],
      [49,'양산지국','경남 양산시 물금읍 야리4길 13, 에이원시티 4층404호','윤정애','010-2486-4708',0,'허진희(전산)','010-3585-3542','ebts_yangsan@naver.com'],
      [50,'왜관지국','경북 칠곡군 왜관읍 평장2길 92, 2층 이비티에스','최숙금','010-5160-7128',0,'이홍태','010-3934-1327','ebts_wg@naver.com'],
      [51,'울산남목지국','울산 동구 방어진순환도로 1158 3층','남명우','010-2018-0050',0,'김도은(전산)','010-3345-7052','ebts_nammok@naver.com'],
      [52,'울산남부지국','울산 남구 삼산로67번길 29, 명동빌딩 301호','서주연','010-3168-7715',0,'서주연','010-3168-7715','ebts_ulsansouth@naver.com'],
      [53,'울산동부지국','울산 동구 고늘로 6, 대영빌딩 506호','최민숙','010-2368-1808',0,'한채연(전산)','010-3631-2936','ebts_bangeojin@naver.com'],
      [54,'울산중부지국','울산 중구 종가6길 21, 우정혁신타워 905호','김명구','010-3336-4175',0,'김영렬(전산)','010-8432-0136','ebts_usjb@naver.com'],
      [55,'울산지국','울산 남구 중앙로 255, 201호','허혜린','010-4554-0057',0,'허혜린','010-4554-0057','ebts_ulsancenter@naver.com'],
      [56,'익산지국','전북 익산시 익산대로16길39 sk빌딩 5층','전원호','010-3915-0093',0,'전원호','010-3915-0093','ebts_iksan@naver.com'],
      [57,'전주문화센터','전주 덕진구 정여립로 1115번지, 402,403호','장영숙','010-4121-5021',0,'','010-3462-8670','ebts_honam@naver.com'],
      [58,'전주수유지국','전북 전주시 완산구 백제대로 427, 6층','한상권','010-8005-7955',0,'한상권','010-8005-7955','ebts_suyu@naver.com'],
      [59,'전주지국','전북 전주시 완산구 백제대로 413, 5층','미와','010-3136-0719',0,'미와','010-3136-0719','ebts_jj@naver.com'],
      [60,'정읍지국','전북 정읍시 정인1길 52, 2층','원희찬','010-2602-6427',0,'원희찬','010-2602-6427','ebts_jeongeup@naver.com'],
      [61,'진주강남지국','경남 진주시 강남로 343 필하우스 301호','차순희','010-4376-4807',0,'김채담','010-5543-3345','ebts_kangnam@naver.com'],
      [62,'진주복지센터','경남 진주시 정촌면 예하리 1271-1 2층','김채담','010-5543-3345',0,'','',''],
      [63,'진주지국','경남 진주시 대신로419번지 4층','김예림','010-2414-5358',0,'박지우','010-9219-2936','ebts_jinju@naver.com'],
      [64,'진해지국','경남 창원시 진해구 진해대로 762, 지하1층 104호','장화연','010-2280-5652',0,'이효윤','010-7763-0106','ebts_jh@naver.com'],
      [65,'창원남부지국','경남 창원시 의창구 차룡로 48번길 44, 스타트업타워 1714호','이진희','010-5143-7623',0,'','',''],
      [66,'창원문화센터','경남 창원시 성산구 용지로169번길 7, 한성빌딩 10층','장향립','010-2581-3470',0,'장향립','010-2581-3470','ebts_cwhc@naver.com'],
      [67,'창원서부지국','창원시 의창구 지귀로 117, 1층','오순희','010-8506-7966',0,'김지은','010-4960-1372','ebts_chsb@naver.com'],
      [68,'창원중앙지국','경남 창원시 성산구 중앙대로 111, 평화상가 202호','이미화','010-9800-2768',0,'이미화','010-9800-2768','ebts_changwon@naver.com'],
      [69,'천안지점','충남 천안시 동남구 신용로 16, 2층 (다가동 371-6번지)','신보윤','010-5053-6573',0,'신보윤','010-5053-6573','ebts_cheonan@naver.com'],
      [70,'청주문화센터','충북 청주시 흥덕구 사운로 226번길 4층 401호','석정숙','010-7383-1982',0,'','','ebts_cheongju@naver.com'],
      [71,'칠곡지국','대구시 북구 구암동 675-7, 경우 카정비 2층','김순옥','010-3502-3305',0,'김순옥','010-3502-3305','ebts_chilgok@naver.com'],
      [72,'통영중앙지점','경남 통영시 해미당2길 15, 2층','김연남','010-8445-0358',0,'김연남','010-8445-0358','ebts_mmy@naver.com'],
      [73,'통영지국','경남 통영시 북신발개등1길9, 이비티에스 통영지점','김원숙','010-6541-1532',0,'김원숙','010-6541-1532','ebts_ty@naver.com'],
      [74,'팔공산교육센터','대구 동구 갓바위로 223-35, 팔공산 청춘산장','정미희','010-3915-3320',1,'정미희','010-3915-3320','ebts_ccsanjang@naver.com'],
      [75,'포항남부지국','경북 포항시 북구 동빈1가84-25번지 봉황빌 2층전체','정선분','010-3866-9845',0,'조희원(전산)','010-4817-4852','ebts_pohangsouth1@naver.com'],
      [76,'포항문화센터','경북 포항시 남구 상대로 124-1, 세환빌딩 4층','선예령','010-7544-4920',0,'강한별(전산)','010-5179-1605','ebts_pohangnorthern@naver.com'],
      [77,'포항오천지국','경북 포항시 남구 오천읍 용덕리 367-16, 2층 좌측상가','김민경','010-9511-6161',0,'이여원(전산)','010-4136-2533','ebts_ocheon@naver.com'],
      [78,'합천지국','경남 합천군 합천읍 충효로 27, 2층','김지애','010-9235-3154',0,'김지애(전산)','010-9235-3154','ebts_hapcheon@naver.com'],
      [79,'해운대지국','부산 해운대구 좌동순환로249번길 21, 아이에스프라자 208호','노상화','010-5882-2342',0,'하정','010-7666-9344','ebts_haeundae@naver.com'],
      [80,'구미공간청춘','경북 구미시 형곡동 168-18','권기은','010-6532-0728',1,'','',''],
      [81,'김해공간청춘','경남 김해시 장유면 대청계곡길 24','권계순','010-5162-9010',1,'','',''],
      [82,'진주공간청춘','경남 진주시 정촌면 예하리 1271-1 2층','김양희','010-8182-3682',1,'','',''],
      [83,'팔공산공간청춘','대구 동구 파계로 622','한승연','010-3803-3258',1,'','',''],
      [84,'포항공간청춘','경북 포항시 남구 송도해안길 68','김미란','010-3823-2599',1,'','',''],
      [85,'구미물류','경북 구미시 금오시장로 28, 1층','오도현','010-2860-8238',1,'','',''],
      [86,'마산물류','경남 창원시 마산회원구 합성동7길 17, 1층','박동필','010-2896-3658',1,'','',''],
      [87,'정읍물류','전북 정읍시 정읍북로 135 독도사랑주유소 9','박종례','010-9676-7973',1,'','',''],
      [88,'제1교육 물류','경북 경산시 압량읍 원효로 549-4','','',1,'','',''],
      [89,'본사부','대구 수성구 대흥동 877 수성정문타워 8층(801~807호)','','',1,'','',''],
    ];

    for (const b of branches) {
      await query(
        `INSERT INTO branches (id, seq, name, address, manager_name, manager_phone, exclude_service, field_contact_name, field_contact_phone, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8]]
      );
    }
  }

  // ─── 주요업무표 데이터 시드 ───
  const taskCount = await query(`SELECT COUNT(*) as cnt FROM task_master`);
  if (parseInt(taskCount.rows[0].cnt) === 0) {
    const tasks = [
      ['독도사랑 주유소','석유사업 본부','가맹영업','영업사원 실적관리','영업사원 성과금 관리','백무결',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','영업사원 실적관리','의향서,신청서 접수 및 일간/주간/월간 실적관리','김민관 황영석',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','영업사원 실적관리','업무일지 취합 및 주유소리스트 업데이트','전원',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','영업사원 실적관리','실적이전 및 인계관리','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 사원관리','신규사원 등록','곽영철 김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 사원관리','영업사원 리스트 관리','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 사원관리','영업사원 면담 및 실적관리','곽영철',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 사원관리','명함/명찰/유니폼 지급 관련 업무','백무결 민수경 연지운',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 교육관리','정기교육 및 순회교육','곽영철 김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 교육관리','교육 공문 및 교육 자료 작성','백무결 연지운',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 교육관리','순회교육 신청 스케줄 관리','백무결 김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹영업 교육관리','지역별 미방문 또는 방문 가능 주유소 리스트 작성','백무결',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','현판부착 및 신주유천하 ID/비번 생성 및 배부','김민관 황영석',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','가맹주유소 보조금 지급(정기보조금/어플사용실적보조금/도색보조금)','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','가맹탈퇴 및 환급관리','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','외관도색 주유소 신청 및 면담','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','의향서>신청서 전환 관리','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','현판 발주 및 재고 관리','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','가맹 후 주유소 해피콜 관리','김민관',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','가맹 신청서 접수 대장 관리','황영석 백무결',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','가맹주유소 관리','가맹점 DB 관리','백무결 연지운',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','신주유천하 어플','어플 개발 관련 업무','백무결 연지운',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','신주유천하 어플','앱 테스트 및 버그, 개선사항 관리','',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','신주유천하 어플','고객센터 문의전화 대응','연지운 민수경',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','시스템 개발','가맹점 봉사활동 통합관리 시스템 개발','백무결 연지운',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','디자인업무','독도사랑주유소연합회 관련 디자인 업무','연지운',''],
      ['독도사랑 주유소','석유사업 본부','가맹영업','차량관리','홈로리 및 유조차량 관리','황영석',''],
      ['독도사랑 주유소','석유사업 본부','지사관리','충청지역관리','지역의 지부장 이하 관리담당자 인원관리 및 할당 가맹점 관리/지역 거점 사무실/직영관리 주유소 임대 물건 탐색','백무결 민수경 황영석 연지운',''],
      ['독도사랑 주유소','석유사업 본부','지사관리','경북지역관리','지역의 지부장 이하 관리담당자 인원관리 및 할당 가맹점 관리','강신흥',''],
      ['독도사랑 주유소','석유사업 본부','지사관리','경남지역관리','지역의 지부장 이하 관리담당자 인원관리 및 할당 가맹점 관리','김권아',''],
      ['독도사랑 주유소','석유사업 본부','협업 관리','가맹점 청소 봉사활동 관리','그린카드 공문 작성 - 가맹점 청소 봉사활동에 대한 우수지국 포상제도','백무결',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','임대계약','신규 임대차 계약, 임기 만료시 재계약','유희창',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','근태관리, 담당 부(차)장 지원','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','석유사업 관리본부,영업본부 개인경비 작성 및 관리','정지은',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','석유사업 관리본부 업무일지 출장보고서 정리 및 보완','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','석유사업 영업본부 비품구매 및 지출결의서 작성','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 각종 공과금 및 부가세 납부 및 관리','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 근무자 4대보험 취득 및 상실 신고','민수경',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 유류발주 및 입하','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 근무자 급여자료 관리(서울 회계팀 소통)','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 월간 근무일정 보고 및 공지','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 판매단가 결정서 보고 및 공지','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 근무자 인적사항 데이터 관리','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 배상책임보험 관리','',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','주유소 근무자 급여자료 관리','황영석 민수경',''],
      ['독도사랑 주유소','석유사업 본부','직영운영','행정업무','직영주유소 판매실적,업무일지','연지운 정지은',''],
      ['독도사랑 주유소','석유사업 본부','저유고 건립','공사','저유고 건립 공사 진행 전반 업무추진 및 현장 관리','유희창',''],
      ['독도사랑 주유소','석유사업 본부','직영운영팀','직영주유소 관리(경북-구미,김천)','이비티에스7(김천), 이비티에스8(구미도량), 독도사랑2(구미장천) 독도사랑13(성주), 독도사랑24(문경)','최영관','5개소'],
      ['독도사랑 주유소','석유사업 본부','직영운영팀','직영주유소 관리(경북-포항,경주)','이비티에스(경주), 이비티에스1(포항), 이비티에스2(울산호계) 독도사랑1(경주감포), 독도사랑12(포항), 독도사랑20(경주휴게소)','박기억','6개소'],
      ['독도사랑 주유소','석유사업 본부','직영운영팀','직영주유소 관리(대구,경산,경남)','이비티에스6(대구), 독도사랑4(김해), 독도사랑10(창원), 독도사랑21(합천) 독도사랑23(고성), 독도사랑26(거제), 독도사랑27(경산), 독도사랑28(대구)','허성오','8개소'],
      ['독도사랑 주유소','석유사업 본부','직영운영팀','직영주유소 관리(전북,호남)','독도사랑3(남원), 독도사랑5(군산), 독도사랑7(전주), 독도사랑6(광양) 독도사랑9(정읍), 독도사랑8(태안), 독도사랑11(광주)','이덕성','7개소'],
      ['독도사랑 주유소','석유사업 본부','직영운영팀','직영주유소 시설관리','직영주유소 시설 및 설비 A/S전담','이재무','26개소'],
    ];

    for (const t of tasks) {
      await query(
        `INSERT INTO task_master (id, department, division, category1, task_group, task_detail, assigned_to, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), t[0], t[1], t[2], t[3], t[4], t[5], t[6]]
      );
    }

    const personalTasks = [
      ['본사부','석유사업 영업본부','본부장','곽영철','가맹영업 총괄관리','가맹영업과 관련된 모든 업무의 총지시 및 감독/관리',''],
      ['본사부','석유사업 영업본부','본부장','곽영철','가맹영업 사원관리','영업사원 면담 및 실적관리',''],
      ['본사부','석유사업 영업본부','본부장','곽영철','가맹영업 교육관리','정기교육 및 순회교육',''],
      ['본사부','석유사업 영업본부','이사','김민관','가맹주유소 관리','현판부착 및 신주유천하 ID/비번 생성 및 배부',''],
      ['본사부','석유사업 영업본부','이사','김민관','가맹주유소 관리','가맹주유소 보조금 지급(정기/어플/도색)',''],
      ['본사부','석유사업 영업본부','이사','김민관','가맹주유소 관리','가맹탈퇴 및 환급관리',''],
      ['본사부','석유사업 영업본부','이사','김민관','가맹영업 실적관리','의향서,신청서 접수 및 실적관리',''],
      ['본사부','석유사업 영업본부','이사','김민관','가맹영업 사원관리','신규사원 등록 및 리스트 관리',''],
      ['본사부','석유사업 영업본부','이사','김권아','경남지역본부 지역장','지역 가맹관리 담당자 관리 및 할당 가맹점 관리',''],
      ['본사부','석유사업 영업본부','부장','강신흥','경북지역본부 지역장','지역 가맹관리 담당자 관리 및 할당 가맹점 관리',''],
      ['본사부','석유사업 영업본부','부장','백무결','가맹영업 실적관리','가맹 신청서 접수 대장 관리 및 데이터 정합성 체크',''],
      ['본사부','석유사업 영업본부','부장','백무결','가맹영업 실적관리','성과금 지급예정 내역 보고서 작성/보고',''],
      ['본사부','석유사업 영업본부','부장','백무결','가맹점DB관리','가맹점에 관련된 모든 데이터 연동 관리',''],
      ['본사부','석유사업 영업본부','부장','백무결','가맹영업 교육관리','정기/순회교육 공문 작성 및 일정 관리',''],
      ['본사부','석유사업 영업본부','부장','백무결','신주유천하 어플','어플 개발 관련 업무',''],
      ['본사부','석유사업 영업본부','부장','백무결','충청지역장','지역 가맹관리 담당자 관리 및 할당 가맹점 관리',''],
      ['본사부','석유사업 영업본부','차장','유희창','직영주유소 계약','직영주유소 신규/재계약 전반',''],
      ['본사부','석유사업 영업본부','차장','유희창','직영주유소 관리','직영주유소 근무자 근태 관리 및 운영 전반 지원',''],
      ['본사부','석유사업 영업본부','차장','유희창','저유고 건립 준비','토지 매입 등기 이전 및 개발행위 허가',''],
      ['본사부','석유사업 영업본부','차장','유희창','저유고 건립 공사','저유고 토목 공사 및 탱크 제작 관리',''],
      ['본사부','석유사업 영업본부','과장','황영석','가맹영업 실적관리','의향서,신청서 접수 및 일간/주간/월간 실적관리',''],
      ['본사부','석유사업 영업본부','과장','황영석','석유사업 관리본부 지원','직영주유소 근무자 급여관리',''],
      ['본사부','석유사업 영업본부','과장','황영석','차량관리','홈로리 및 유조차량 관리',''],
      ['본사부','석유사업 영업본부','과장','민수경','행정업무','직영주유소 근무자 4대보험 취득 및 상실 신고',''],
      ['본사부','석유사업 영업본부','과장','민수경','행정업무','직영주유소 유류발주 및 입하',''],
      ['본사부','석유사업 영업본부','과장','민수경','충청지역 지역관리','충청지역 할당 가맹점 우호도 조사 및 관리',''],
      ['본사부','석유사업 영업본부','대리','연지운','영업사원 실적관리','대전, 충청도권 영업사원 관리',''],
      ['본사부','석유사업 영업본부','대리','연지운','신주유천하 어플','어플 테스트 및 버그/개선사항 관리',''],
      ['본사부','석유사업 영업본부','대리','연지운','디자인 업무','독도사랑주유소연합회 관련 디자인 업무',''],
      ['본사부','석유사업 영업본부','대리','연지운','개발 업무','가맹영업/주유소 관리 통합 플랫폼 개발',''],
      ['본사부','석유사업 영업본부','사원','정지은','행정업무','석유사업 관리본부,영업본부 개인경비 작성 및 관리',''],
      ['본사부','석유사업 영업본부','사원','정지은','행정업무','석유사업 관리본부 업무일지 출장보고서 정리 및 보완',''],
      ['본사부','석유사업 영업본부','사원','정지은','행정업무','석유사업 영업본부 비품구매 및 지출결의서 작성',''],
    ];

    for (const t of personalTasks) {
      await query(
        `INSERT INTO personal_task_table (id, department, division, position, person_name, task_group, task_detail, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), t[0], t[1], t[2], t[3], t[4], t[5], t[6]]
      );
    }
  }

  // ─── 기존가맹 거래처 신청서 시드 ───
  const faCount = await query(`SELECT COUNT(*) as cnt FROM franchise_apps`);
  if (parseInt(faCount.rows[0].cnt) === 0) {
    const faFile = path.join(__dirname, '..', 'data', 'franchise_applications.json');
    if (fs.existsSync(faFile)) {
      const faData = JSON.parse(fs.readFileSync(faFile, 'utf-8'));
      for (const r of faData) {
        await query(
          `INSERT INTO franchise_apps (id, seq, receipt_date, join_date, manager, branch, store_name, owner_name, biz_number, phone_land, owner_phone, bank_info, address, applicant_name, applicant_org, applicant_title, applicant_phone, oil_company, app_type, paint_date, actual_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [uuidv4(), parseInt(r['번호']) || 0, r['접수일자'], r['가맹일자'], r['담당자'], r['소속'], r['가맹점상호'], r['대표자'], r['사업자번호'], r['유선전화'], r['대표자연락처'], r['계좌정보'], r['사업장주소'], r['신청자이름'], r['신청자소속'], r['직책'], r['연락처'], r['정유사'], r['구분'], r['도색완료일자'], r['실제작성일자']]
        );
      }
    }
  }

  // ─── 사전승인 인원 시드 ───
  const staffCount = await query(`SELECT COUNT(*) as cnt FROM approved_staff`);
  if (parseInt(staffCount.rows[0].cnt) === 0) {
    const staffList = [
      ['백무결', '28228079', '석유사업본부', '부장', '본사부', '충청지역본부_지역장'],
      ['곽영철', '64330082', '석유사업본부', '본부장', '본사부', '총괄'],
      ['김민관', '86149995', '석유사업본부', '이사', '본사부', '가맹영업총괄'],
      ['유희창', '44871177', '석유사업본부', '차장', '본사부', '직영관리'],
      ['민수경', '57800511', '석유사업본부', '과장', '본사부', '충청지역본부_관리담당'],
      ['황영석', '90844373', '석유사업본부', '과장', '본사부', '충청지역본부_관리담당'],
      ['정지은', '63146093', '석유사업본부', '사원', '본사부', '행정담당'],
      ['연지운', '46955363', '석유사업본부', '대리', '본사부', '충청지역본부_관리담당'],
      ['강신흥', '30680019', '석유사업본부', '부장', '본사부', '경북지역본부_지역장'],
      ['김권아', '51851354', '석유사업본부', '이사', '본사부', '경북지역본부_지역장'],
      ['박기억', '38179845', '석유사업본부', '부장', '경주', '직영관리'],
      ['허성오', '35264304', '석유사업본부', '부장', '대구', '직영관리'],
      ['이재무', '35642317', '석유사업본부', '부장', '경주', '직영관리'],
      ['이덕성', '35890737', '석유사업본부', '차장', '', '직영관리'],
      ['최영관', '20660432', '석유사업본부', '부장', '구미', '직영관리'],
    ];

    for (const s of staffList) {
      await query(
        `INSERT INTO approved_staff (id, name, phone, department, position, location, role) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), s[0], s[1], s[2], s[3], s[4], s[5]]
      );
    }
  }

  // ─── 회의록 시드 ───
  const mnCount = await query(`SELECT COUNT(*) as cnt FROM meeting_notes`);
  if (parseInt(mnCount.rows[0].cnt) === 0) {
    const mnFile = path.join(__dirname, '..', 'data', 'meeting_notes.json');
    if (fs.existsSync(mnFile)) {
      const mnData = JSON.parse(fs.readFileSync(mnFile, 'utf-8'));
      for (const r of mnData) {
        await query(
          `INSERT INTO meeting_notes (id, notion_id, title, meeting_date, summary, notion_url) VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), r.notion_id, r.title, r.meeting_date, r.summary || null, r.notion_url || null]
        );
      }
    }
  }

  await query(`UPDATE weekly_plans SET status = 'submitted' WHERE status = 'draft'`);

  console.log('PostgreSQL database initialized successfully');
}

module.exports = { query, uuidv4, initDB, pool };
