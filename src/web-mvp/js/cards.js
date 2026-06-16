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

export const STORY_BEATS = [
  { trigger: 'turn-1', text: '백십자재단 혈연센터에 첫 출근하는 날. 밝은 형광등 아래, 모든 것이 정상적으로 보인다... 아직은.' },
  { trigger: 'first-request', text: '비밀 연락망을 통해 첫 의뢰서가 도착했다. 카르테인 가문의 혈액관리국, 그 이름만으로도 무게가 느껴진다.' },
  { trigger: 'first-complete', text: '"훌륭하군." 짧은 메모가 도착했다. 카르테인 집사 빅토르의 필체.' },
  { trigger: 'turn-5', text: '센터 운영이 안정궤도에 올랐다. 하지만 밤이 되면 다른 일이 시작된다.' },
  { trigger: 'sus-50', text: '보건당국에서 "야간 혈액 사용량 이상"을 문의해왔다. 서류를 조작해야 할지도 모른다.' },
  { trigger: 'sus-80', text: '기자가 센터 주변을 어슬렁거린다. 누군가 제보한 걸까? 시간이 얼마 남지 않았다.' },
  { trigger: 'rep-low', text: '헌혈자 수가 급감하고 있다. 센터의 평판이 흔들리면 모든 것이 무너질 수 있다.' },
  { trigger: 'final-request', text: '마지막 의뢰. 이것만 완수하면 카르테인과의 거래가 끝난다. 아니, 정말로 끝날까?' },
  { trigger: 'win', text: '카르테인 가문의 의뢰를 모두 완수했다. 듀크가 보낸 봉인된 편지: "당신은 가문의 친구입니다. 영원히."' },
  { trigger: 'lose-sus', text: '새벽 4시, 특수수사대가 센터에 도착했다. 냉장고 뒤의 비밀 통로가 발견되었다...' },
  { trigger: 'lose-rep', text: '마지막 헌혈자가 떠났다. 텅 빈 대기실에 형광등만 깜빡인다.' },
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

export const DILEMMA_EVENTS = [
  {
    id: 'dil-reporter', name: '기자의 취재 요청',
    narration: '김서하 기자가 센터의 야간 운영에 대해 취재를 요청한다. 거절하면 의심을 살 수 있고, 수락하면 비밀이 노출될 위험이 있다.',
    choices: [
      { label: '취재 수락 — 투명성 어필', desc: 'REP +8, SUS +6', effect: { rep: 8, sus: 6 } },
      { label: '정중히 거절 — 비밀 유지', desc: 'SUS -3, REP -4', effect: { sus: -3, rep: -4 } },
    ],
  },
  {
    id: 'dil-bribe', name: '보건 조사관의 암시',
    narration: '장현우 조사관이 점검 중 수상한 냉장고를 발견했다. 그는 미묘하게 "해결 방법"을 암시한다.',
    choices: [
      { label: '뇌물 제공 — 눈 감아달라', desc: 'BP -5, SUS -10', effect: { bp: -5, sus: -10 } },
      { label: '정면 돌파 — 규정대로', desc: 'REP +5, SUS +8', effect: { rep: 5, sus: 8 } },
    ],
  },
  {
    id: 'dil-overtime', name: '야근 헌혈자 발견',
    narration: '최민서가 센터 폐장 후에도 남아있다. 추가 헌혈을 받으면 혈액을 확보할 수 있지만, 건강 문제가 생기면...',
    choices: [
      { label: '추가 채혈 — 혈액 확보 우선', desc: 'BP +6, REP -5', effect: { bp: 6, rep: -5 } },
      { label: '귀가 권유 — 안전 우선', desc: 'REP +4, BP -2', effect: { rep: 4, bp: -2 } },
    ],
  },
  {
    id: 'dil-night-delivery', name: '새벽 특별 배송',
    narration: '정우진이 새벽 4시에 카르테인 가문용 "특별 혈액"을 배송해야 한다. 경로가 두 곳이다.',
    choices: [
      { label: '지름길 — 빠르지만 CCTV 구간', desc: 'BP +4, SUS +5', effect: { bp: 4, sus: 5 } },
      { label: '우회로 — 안전하지만 손실 있음', desc: 'BP +1, SUS -2', effect: { bp: 1, sus: -2 } },
    ],
  },
  {
    id: 'dil-intern', name: '실습생의 질문',
    narration: '박은지 실습생이 야간 혈액 처리량이 비정상적으로 많다며 질문한다. 호기심 많은 눈이 날카롭다.',
    choices: [
      { label: '비밀에 끌어들이기', desc: 'SUS -5, REP -3 (동료 확보)', effect: { sus: -5, rep: -3 } },
      { label: '모른 척 넘어가기', desc: 'SUS +4 (의심 증가)', effect: { sus: 4 } },
    ],
  },
  {
    id: 'dil-blood-expire', name: '혈액 유통기한 임박',
    narration: '냉장고 속 혈액 팩 다수가 유통기한이 내일이다. 폐기하면 손실이 크고, 라벨을 바꾸면...',
    choices: [
      { label: '라벨 교체 — 혈액 보존', desc: 'BP +5, SUS +7, REP -3', effect: { bp: 5, sus: 7, rep: -3 } },
      { label: '정규 폐기 — 원칙 준수', desc: 'BP -4, REP +3', effect: { bp: -4, rep: 3 } },
    ],
  },
  {
    id: 'dil-kartein-order', name: '카르테인의 긴급 요청',
    narration: '카르테인 듀크가 "특별한 혈액"을 긴급 요청한다. 공식 절차를 무시해야 빠르게 전달할 수 있다.',
    choices: [
      { label: '즉시 전달 — 가문의 신뢰', desc: 'BP +8, SUS +10', effect: { bp: 8, sus: 10 } },
      { label: '공식 절차 고수', desc: 'REP +3, SUS +3', effect: { rep: 3, sus: 3 } },
    ],
  },
  {
    id: 'dil-volunteer', name: '봉사자의 SNS',
    narration: '한소율이 센터에서 찍은 셀카를 SNS에 올리려 한다. 배경에 야간 작업 장면이 살짝 보인다.',
    choices: [
      { label: '허용 — 홍보 효과 기대', desc: 'REP +6, SUS +5', effect: { rep: 6, sus: 5 } },
      { label: '삭제 요청 — 리스크 차단', desc: 'SUS -2, REP -2', effect: { sus: -2, rep: -2 } },
    ],
  },
  {
    id: 'dil-anonymous-tip', name: '익명 제보 전화',
    narration: '보건당국에 "혈연센터의 야간 활동이 수상하다"는 익명 제보가 접수되었다는 소식이 들어온다.',
    choices: [
      { label: '선제 대응 — 자진 점검 요청', desc: 'SUS -8, BP -3, REP +2', effect: { sus: -8, bp: -3, rep: 2 } },
      { label: '무시하고 잠적', desc: 'SUS +3', effect: { sus: 3 } },
    ],
  },
  {
    id: 'dil-research', name: '윤채아의 연구 제안',
    narration: '윤채아가 특이한 혈액 패턴을 발견했다며 심층 연구를 제안한다. 연구 결과가 밖으로 새면 위험할 수 있다.',
    choices: [
      { label: '연구 승인 — 데이터 확보', desc: 'BP +4, SUS +6', effect: { bp: 4, sus: 6 } },
      { label: '연구 보류 — 안전 우선', desc: 'REP +2, SUS -2', effect: { rep: 2, sus: -2 } },
    ],
  },
  {
    id: 'dil-police', name: '순찰 경찰의 방문',
    narration: '심야에 센터 불빛을 보고 순찰 경관이 방문했다. 문을 열어야 하나?',
    choices: [
      { label: '문을 열고 응대', desc: 'SUS +5, REP +3 (협조적)', effect: { sus: 5, rep: 3 } },
      { label: '불을 끄고 숨기', desc: 'SUS -3, REP -2', effect: { sus: -3, rep: -2 } },
    ],
  },
  {
    id: 'dil-competitor', name: '경쟁 센터의 제안',
    narration: '인근 혈액원에서 "혈액 교환 협정"을 제안한다. 거래하면 혈액을 얻지만, 우리의 운영 방식이 노출될 수 있다.',
    choices: [
      { label: '협정 체결 — 혈액 확보', desc: 'BP +6, SUS +4', effect: { bp: 6, sus: 4 } },
      { label: '거절 — 독립 운영', desc: 'REP +2', effect: { rep: 2 } },
    ],
  },
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
