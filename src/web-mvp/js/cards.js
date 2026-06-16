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
    portrait: 'assets/portraits/park-harin.svg',
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
    portrait: 'assets/portraits/kim-doyun.svg',
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
    portrait: 'assets/portraits/lee-seoyeon.svg',
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
    portrait: 'assets/portraits/kartein-duke.svg',
  },
  {
    id: 'choi-minseo',
    name: '최민서',
    title: '단골 헌혈자',
    faction: FACTIONS.NEUTRAL,
    rarity: RARITIES.COMMON,
    cost: 1,
    power: 1,
    ability: { type: 'donate', value: 3, description: '혈액 카드 3장 생성' },
    flavor: '헌혈 300회의 사나이',
    portrait: 'assets/portraits/choi-minseo.svg',
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
    portrait: 'assets/portraits/jung-woojin.svg',
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
    portrait: 'assets/portraits/viktor-hessen.svg',
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
    portrait: 'assets/portraits/han-soyul.svg',
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
    portrait: 'assets/portraits/nigel-crowe.svg',
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
    portrait: 'assets/portraits/yun-chaea.svg',
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
  { id: 'eq-cctv', name: '위장 CCTV', cost: 3, effect: { susReduction: 2 }, description: '매 턴 SUS -2' },
];
