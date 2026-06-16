export const BLOOD_TYPES = ['A', 'B', 'O', 'AB'];
export const FACTIONS = { CENTER: 'center', KARTEIN: 'kartein', NEUTRAL: 'neutral' };
export const RARITIES = { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', LEGENDARY: 'legendary' };

export const CHARACTERS = [
  {
    id: 'park-harin',
    name: '박하린',
    title: '혈연센터장',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.RARE,
    cost: 4,
    power: 3,
    ability: { type: 'collect', value: 2, description: 'BP +2 수집. 배치 시 REP +5' },
    flavor: '밝은 미소 뒤의 차가운 계산',
    portrait: 'assets/portraits/park-harin',
  },
  {
    id: 'kim-doyun',
    name: '김도윤',
    title: '신입 간호사',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.COMMON,
    cost: 1,
    power: 1,
    ability: { type: 'collect', value: 1, description: 'BP +1 수집' },
    flavor: '순수한 열정, 위험한 무지',
    portrait: 'assets/portraits/kim-doyun',
  },
  {
    id: 'lee-seoyeon',
    name: '이서연',
    title: '베테랑 채혈사',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.UNCOMMON,
    cost: 3,
    power: 2,
    ability: { type: 'collect', value: 3, description: 'BP +3 수집. SUS -2' },
    flavor: '의심의 눈초리, 완벽한 기술',
    portrait: 'assets/portraits/lee-seoyeon',
  },
  {
    id: 'kartein-duke',
    name: '카르테인 듀크',
    title: '혈액관리국장',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.LEGENDARY,
    cost: 7,
    power: 5,
    ability: { type: 'request_discount', value: 2, description: '의뢰 이행 비용 -2. SUS +5' },
    flavor: '우아한 포식자',
    portrait: 'assets/portraits/kartein-duke',
  },
  {
    id: 'choi-minseo',
    name: '최민서',
    title: '단골 헌혈자',
    faction: FACTIONS.NEUTRAL,
    rarity: RARITIES.COMMON,
    cost: 1,
    power: 1,
    ability: { type: 'donate', value: 2, description: '혈액 카드 2장 생성' },
    flavor: '헌혈 300회의 사나이',
    portrait: 'assets/portraits/choi-minseo',
  },
  {
    id: 'jung-woojin',
    name: '정우진',
    title: '혈액운송기사',
    faction: FACTIONS.NEUTRAL,
    rarity: RARITIES.UNCOMMON,
    cost: 2,
    power: 2,
    ability: { type: 'transport', value: 1, description: '의뢰 이행 시 BP 보너스 +1' },
    flavor: '새벽 4시의 특별 배송',
    portrait: 'assets/portraits/jung-woojin',
  },
  {
    id: 'viktor-hessen',
    name: '빅토르 헤센',
    title: '카르테인 집사',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.RARE,
    cost: 5,
    power: 3,
    ability: { type: 'convert', value: 1, description: '혈액 카드 1장을 아무 혈액형으로 변환' },
    flavor: '300년의 충성',
    portrait: 'assets/portraits/viktor-hessen',
  },
  {
    id: 'han-soyul',
    name: '한소율',
    title: '대학생 봉사자',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.COMMON,
    cost: 1,
    power: 1,
    ability: { type: 'reputation', value: 3, description: 'REP +3' },
    flavor: 'SNS 좋아요의 힘',
    portrait: 'assets/portraits/han-soyul',
  },
  {
    id: 'nigel-crowe',
    name: '나이젤 크로우',
    title: '야간 감사관',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.RARE,
    cost: 4,
    power: 3,
    ability: { type: 'audit', value: 3, description: 'SUS -3. 이벤트 카드 1장 확인' },
    flavor: '장부에 숨긴 진실',
    portrait: 'assets/portraits/nigel-crowe',
  },
  {
    id: 'yun-chaea',
    name: '윤채아',
    title: '혈액연구원',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.UNCOMMON,
    cost: 3,
    power: 2,
    ability: { type: 'research', value: 1, description: '혈액 카드 효율 +1 (이번 턴)' },
    flavor: '데이터는 거짓말하지 않는다',
    portrait: 'assets/portraits/yun-chaea',
  },
  {
    id: 'shin-yujin',
    name: '신유진',
    title: '접수 담당자',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.UNCOMMON,
    cost: 2,
    power: 1,
    ability: { type: 'collect', value: 2, description: 'BP +2 수집. SUS -2' },
    flavor: '원칙대로 하겠습니다',
    portrait: 'assets/portraits/shin-yujin',
  },
  {
    id: 'oh-taehyun',
    name: '오태현',
    title: '혈액분석사',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.UNCOMMON,
    cost: 3,
    power: 2,
    ability: { type: 'collect', value: 2, description: 'BP +2 수집. REP +5' },
    flavor: '분석은 거짓을 허용하지 않는다',
    portrait: 'assets/portraits/oh-taehyun',
  },
  {
    id: 'yang-mira',
    name: '양미라',
    title: '헌혈 홍보대사',
    faction: FACTIONS.CENTER,
    rarity: RARITIES.RARE,
    cost: 5,
    power: 3,
    ability: { type: 'donate', value: 3, description: '혈액 카드 3장 생성' },
    flavor: '헌혈은 사랑입니다, 진심으로',
    portrait: 'assets/portraits/yang-mira',
  },
  {
    id: 'elena-morgan',
    name: '엘레나 모르간',
    title: '야행성 수습생',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.UNCOMMON,
    cost: 2,
    power: 2,
    ability: { type: 'collect', value: 1, description: 'BP +1 수집' },
    flavor: '낮에는 졸고, 밤에 일한다',
    portrait: 'assets/portraits/elena-morgan',
  },
  {
    id: 'sergei-volkov',
    name: '세르게이 볼코프',
    title: '동유럽 연락관',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.UNCOMMON,
    cost: 4,
    power: 3,
    ability: { type: 'collect', value: 3, description: 'BP +3 수집' },
    flavor: '동유럽 루트는 조용해야 해',
    portrait: 'assets/portraits/sergei-volkov',
  },
  {
    id: 'isadora-kartein',
    name: '이사도라 카르테인',
    title: '가문 장녀',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.LEGENDARY,
    cost: 8,
    power: 6,
    ability: { type: 'collect', value: 5, description: 'BP +5 수집' },
    flavor: '가문의 피는 속일 수 없다',
    portrait: 'assets/portraits/isadora-kartein',
  },
  {
    id: 'dimitri-rad',
    name: '디미트리 라드',
    title: '혈액 감정사',
    faction: FACTIONS.KARTEIN,
    rarity: RARITIES.RARE,
    cost: 5,
    power: 4,
    ability: { type: 'collect', value: 4, description: 'BP +4 수집. SUS -2' },
    flavor: '보르도산 1847년, 최고의 빈티지',
    portrait: 'assets/portraits/dimitri-rad',
  },
  {
    id: 'park-eunji',
    name: '박은지',
    title: '의대생 실습생',
    faction: FACTIONS.NEUTRAL,
    rarity: RARITIES.UNCOMMON,
    cost: 2,
    power: 1,
    ability: { type: 'donate', value: 2, description: '혈액 카드 2장 생성' },
    flavor: '실습이라면서 왜 이렇게 많이...',
    portrait: 'assets/portraits/park-eunji',
  },
  {
    id: 'jang-hyunwoo',
    name: '장현우',
    title: '보건복지부 조사관',
    faction: FACTIONS.NEUTRAL,
    rarity: RARITIES.UNCOMMON,
    cost: 3,
    power: 2,
    ability: { type: 'reputation', value: 4, description: 'REP +4' },
    flavor: '규정을 따르면 아무 문제 없습니다',
    portrait: 'assets/portraits/jang-hyunwoo',
  },
  {
    id: 'kim-seoha',
    name: '김서하',
    title: '의료 전문기자',
    faction: FACTIONS.NEUTRAL,
    rarity: RARITIES.RARE,
    cost: 4,
    power: 3,
    ability: { type: 'reputation', value: 8, description: 'REP +8' },
    flavor: '기사 한 줄이면 세상이 바뀐다',
    portrait: 'assets/portraits/kim-seoha',
  },
];

export function createBloodCard(bloodType) {
  return {
    id: `blood-${bloodType}-${Date.now()}`,
    type: 'blood',
    bloodType,
    value: 1,
    name: `${bloodType}형 혈액`,
    description: `${bloodType}형 혈액 1단위`,
  };
}

export function createRequestCard(id, requirements, reward, penalty) {
  return {
    id,
    type: 'request',
    name: `카르테인 의뢰 #${id}`,
    requirements,
    reward,
    penalty,
    turnsLeft: 3,
  };
}

export const STARTER_REQUESTS = [
  createRequestCard('req-1', { A: 2 }, { bp: 5 }, { sus: 10 }),
  createRequestCard('req-2', { B: 1, O: 1 }, { bp: 4, rep: 3 }, { sus: 8 }),
  createRequestCard('req-3', { O: 3 }, { bp: 8 }, { sus: 15 }),
  createRequestCard('req-4', { A: 1, B: 1, AB: 1 }, { bp: 10, rep: 5 }, { sus: 12 }),
  createRequestCard('req-5', { AB: 2, O: 2 }, { bp: 15, rep: 10 }, { sus: 20, rep: -10 }),
];

export const EVENTS = [
  { id: 'evt-campaign', name: '헌혈 캠페인 성공', effect: { rep: 5, bp: 3 }, description: '백십자재단 캠페인이 성공적! REP+5, BP+3' },
  { id: 'evt-inspection', name: '보건당국 점검', effect: { sus: -5, rep: -3 }, description: '정기 점검 통과. SUS-5, REP-3' },
  { id: 'evt-shortage', name: '혈액 부족 사태', effect: { bp: -3, rep: 5 }, description: '혈액 부족으로 긴급 모집. BP-3, REP+5' },
  { id: 'evt-leak', name: '내부 정보 유출', effect: { sus: 8 }, description: '누군가 야간 활동을 목격. SUS+8' },
  { id: 'evt-donation-day', name: '세계 헌혈의 날', effect: { bp: 5, rep: 5 }, description: '특별 행사! BP+5, REP+5' },
  { id: 'evt-blackout', name: '정전 사고', effect: { bp: -2, sus: 3 }, description: '냉장고 일시 정지. BP-2, SUS+3' },
];

export const EQUIPMENT = [
  { id: 'eq-centrifuge', name: '고속 원심분리기', cost: 4, effect: { collectBonus: 1 }, description: '매 턴 BP 수집량 +1' },
  { id: 'eq-fridge', name: '특수 냉장고', cost: 3, effect: { bloodCapacity: 2 }, description: '혈액 보관 한도 +2' },
  { id: 'eq-lounge', name: '프리미엄 대기실', cost: 5, effect: { repBonus: 2 }, description: '매 턴 REP +2' },
  { id: 'eq-cctv', name: '위장 CCTV', cost: 4, effect: { susReduction: 1 }, description: '매 턴 SUS -1' },
];

export const COMBO_BONUSES = {
  center: [
    { threshold: 3, label: '팀워크', effects: { bpBonus: 1 }, description: '센터 3+ 시너지: BP 수집 +1' },
    { threshold: 4, label: '완벽한 운영', effects: { repBonus: 2 }, description: '센터 4+ 시너지: REP +2' },
  ],
  kartein: [
    { threshold: 2, label: '어둠의 결속', effects: { susReduction: 1 }, description: '카르테인 2+ 시너지: SUS -1' },
    { threshold: 3, label: '밤의 지배', effects: { bpBonus: 1 }, description: '카르테인 3+ 시너지: BP +1' },
  ],
  neutral: [
    { threshold: 2, label: '네트워크', effects: { bloodCards: 1 }, description: '비소속 2+ 시너지: 혈액 +1' },
    { threshold: 3, label: '사회적 유대', effects: { repBonus: 1 }, description: '비소속 3+ 시너지: REP +1' },
  ],
};

export function generateRandomRequest(requestNum, turn) {
  const types = [...BLOOD_TYPES];
  const unitCount = 1 + requestNum;
  const typeCount = Math.min(1 + Math.floor(requestNum / 2), 3);
  const shuffledTypes = types.sort(() => Math.random() - 0.5);
  const requirements = {};
  for (let t = 0; t < typeCount; t++) {
    requirements[shuffledTypes[t]] = 0;
  }
  const keys = Object.keys(requirements);
  for (let i = 0; i < unitCount; i++) {
    requirements[keys[i % keys.length]]++;
  }
  const totalNeeded = Object.values(requirements).reduce((a, b) => a + b, 0);
  const bpReward = 3 + totalNeeded * 2 + Math.floor(requestNum * 1.5);
  const repReward = requestNum >= 3 ? Math.floor(requestNum * 2) : 0;
  const susPenalty = 5 + requestNum * 3;

  return {
    id: `req-${requestNum}-t${turn}`,
    type: 'request',
    name: `카르테인 의뢰 #${requestNum}`,
    requirements,
    reward: { bp: bpReward, ...(repReward > 0 ? { rep: repReward } : {}) },
    penalty: { sus: susPenalty },
    turnsLeft: Math.max(2, 4 - Math.floor(requestNum / 3)),
  };
}
