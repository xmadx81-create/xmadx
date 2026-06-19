// ═══════════════════════════════════════════════════════════════════════════
// engine.js — 헌혈의 집 (Red Ledger) Grid-Based Tactical SRPG Engine
// Pure game logic, no DOM/UI code
// ═══════════════════════════════════════════════════════════════════════════

import { CHARACTERS, SENSE_TYPES, CHARACTER_MBTI } from './cards.js';

// ── Tile Types ──────────────────────────────────────────────────────────

export const TILE_TYPES = {
  floor:         { walkable: true,  movCost: 1, label: '바닥',       icon: '·' },
  wall:          { walkable: false, movCost: 99, label: '벽',        icon: '█' },
  blood_storage: { walkable: true,  movCost: 1, label: '혈액 보관소', icon: '🩸' },
  desk:          { walkable: true,  movCost: 1, label: '데스크',      icon: '🪑' },
  entrance:      { walkable: true,  movCost: 1, label: '출입구',      icon: '🚪' },
  forest:        { walkable: true,  movCost: 2, label: '숲',         icon: '🌲', defBonus: 1 },
  mountain:      { walkable: false, movCost: 99, label: '산',        icon: '⛰️' },
  swamp:         { walkable: true,  movCost: 2, label: '늪',         icon: '🟤', defBonus: -1 },
  ice:           { walkable: true,  movCost: 1, label: '빙판',       icon: '🧊', evaBonus: 0.05 },
  graveyard:     { walkable: true,  movCost: 1, label: '묘지',       icon: '🪦', atkBonus: 2 },
  hotspring:     { walkable: true,  movCost: 1, label: '온천',       icon: '♨️', healPerTurn: 5 },
  dungeon:       { walkable: true,  movCost: 1, label: '던전',       icon: '🕳️' },
  bridge:        { walkable: true,  movCost: 1, label: '다리',       icon: '🌉' },
  valley:        { walkable: true,  movCost: 2, label: '계곡',       icon: '🏞️', defBonus: -2 },
  road:          { walkable: true,  movCost: 1, label: '도로',       icon: '🛤️' },
};

// ── Faction Constants ───────────────────────────────────────────────────

export const FACTIONS = { CENTER: 'center', KARTEIN: 'kartein', NEUTRAL: 'neutral' };

export const FACTION_SYNERGY = {
  center:  [{ count: 3, stat: 'def', val: 2, label: '센터 결속: DEF+2' }, { count: 5, stat: 'maxHp', val: 15, label: '센터 수호: HP+15' }],
  kartein: [{ count: 2, stat: 'atk', val: 2, label: '카르테인 압박: ATK+2' }, { count: 4, stat: 'crt', val: 0.05, label: '카르테인 사냥: CRT+5%' }],
  neutral: [{ count: 2, stat: 'mov', val: 1, label: '비소속 네트워크: MOV+1' }, { count: 4, stat: 'eva', val: 0.05, label: '비소속 민첩: EVA+5%' }],
};

export function applyFactionSynergy(units) {
  const playerUnits = units.filter(u => u.team === 'player' && u.hp > 0);
  const counts = {};
  playerUnits.forEach(u => { counts[u.faction] = (counts[u.faction] || 0) + 1; });
  const applied = [];
  Object.entries(FACTION_SYNERGY).forEach(([faction, tiers]) => {
    tiers.forEach(t => {
      if ((counts[faction] || 0) >= t.count) {
        playerUnits.filter(u => u.faction === faction).forEach(u => {
          if (t.stat === 'maxHp') { u.maxHp += t.val; u.hp += t.val; }
          else { u[t.stat] = (u[t.stat] || 0) + t.val; }
        });
        applied.push(t.label);
      }
    });
  });
  return applied;
}

// ── Rarity → Stat Bonus Tables ──────────────────────────────────────────

const RARITY_HP_BONUS   = { common: 10, uncommon: 20, rare: 35, legendary: 50 };
const RARITY_ATK_BONUS  = { common: 2,  uncommon: 4,  rare: 6,  legendary: 10 };
const RARITY_DEF_BONUS  = { common: 1,  uncommon: 2,  rare: 3,  legendary: 5 };
const RARITY_MOV        = { common: 3,  uncommon: 3,  rare: 2,  legendary: 2 };

// ── Role Modifiers ─────────────────────────────────────────────────────

export const ROLE_MODIFIERS = {
  tank:           { hp: 1.5,  atk: 0.7, def: 1.5, mov: 2, rng: 1, crt: 0.05, eva: 0.02, pen: 0 },
  melee_dps:      { hp: 0.9,  atk: 1.4, def: 0.8, mov: 3, rng: 1, crt: 0.12, eva: 0.05, pen: 1 },
  ranged_dps:     { hp: 0.8,  atk: 1.3, def: 0.7, mov: 2, rng: 2, crt: 0.15, eva: 0.03, pen: 0 },
  support:        { hp: 1.0,  atk: 0.6, def: 1.0, mov: 3, rng: 2, crt: 0.05, eva: 0.03, pen: 0 },
  bruiser:        { hp: 1.3,  atk: 1.1, def: 1.2, mov: 2, rng: 1, crt: 0.10, eva: 0.04, pen: 1 },
  battle_support: { hp: 1.0,  atk: 1.0, def: 0.9, mov: 3, rng: 2, crt: 0.08, eva: 0.04, pen: 0 },
  evasive_dps:    { hp: 0.85, atk: 1.2, def: 1.1, mov: 3, rng: 1, crt: 0.15, eva: 0.15, pen: 0 },
  breaker:        { hp: 1.3,  atk: 1.4, def: 1.2, mov: 3, rng: null, crt: 0.10, eva: 0.03, pen: 2 },
};

// ── Ultimates (2 per role) ────────────────────────────────────────────

export const ULTIMATES = {
  tank: [
    { id: 'ult-shield-wall', name: '철벽 방어', icon: '🛡️', type: 'team_def_buff', mpCost: 8, power: 5, duration: 2, cooldown: 5, unlockLevel: 5, desc: '아군 전체 DEF +5 (2턴)' },
    { id: 'ult-last-stand', name: '최후의 보루', icon: '🏰', type: 'self_invuln', mpCost: 10, power: 0, duration: 1, cooldown: 6, unlockLevel: 8, desc: '1턴간 데미지 무효화' },
  ],
  melee_dps: [
    { id: 'ult-storm-slash', name: '폭풍 일격', icon: '⚡', type: 'single_damage', mpCost: 7, powerMult: 2.5, cooldown: 4, unlockLevel: 5, desc: '단일 적에게 ATK×2.5 데미지' },
    { id: 'ult-berserk', name: '광전사의 분노', icon: '🔥', type: 'self_atk_buff', mpCost: 8, power: 8, duration: 2, cooldown: 5, unlockLevel: 8, desc: '자신 ATK +8 (2턴)' },
  ],
  ranged_dps: [
    { id: 'ult-snipe', name: '저격', icon: '🎯', type: 'ignore_def_damage', mpCost: 7, powerMult: 1.8, cooldown: 4, unlockLevel: 5, desc: 'DEF 무시 ATK×1.8 데미지' },
    { id: 'ult-barrage', name: '탄막 사격', icon: '💥', type: 'aoe_damage', mpCost: 9, powerMult: 1.2, range: 2, cooldown: 5, unlockLevel: 8, desc: '2칸 범위 ATK×1.2 광역 데미지' },
  ],
  support: [
    { id: 'ult-mass-heal', name: '대회복', icon: '💚', type: 'team_heal', mpCost: 8, powerMult: 0.4, cooldown: 4, unlockLevel: 5, desc: '아군 전체 HP 40% 회복' },
    { id: 'ult-revive', name: '부활', icon: '✨', type: 'revive', mpCost: 10, powerMult: 0.5, cooldown: 8, unlockLevel: 8, desc: '전사한 아군 1명 HP 50%로 부활' },
  ],
  bruiser: [
    { id: 'ult-quake', name: '지진 강타', icon: '💢', type: 'aoe_stun', mpCost: 7, powerMult: 1.5, range: 1, cooldown: 4, unlockLevel: 5, desc: '인접 적 ATK×1.5 + 1턴 기절' },
    { id: 'ult-blood-fury', name: '혈전사', icon: '🩸', type: 'lifesteal_attack', mpCost: 8, powerMult: 2.0, cooldown: 5, unlockLevel: 8, desc: 'ATK×2.0 + 50% 흡혈' },
  ],
  battle_support: [
    { id: 'ult-warcry', name: '전투 함성', icon: '📯', type: 'team_atk_buff', mpCost: 7, power: 4, duration: 2, cooldown: 4, unlockLevel: 5, desc: '아군 전체 ATK +4 (2턴)' },
    { id: 'ult-barrier', name: '보호막', icon: '🔮', type: 'team_shield', mpCost: 9, power: 15, cooldown: 5, unlockLevel: 8, desc: '아군 전체에 15 HP 실드' },
  ],
  evasive_dps: [
    { id: 'ult-shadow', name: '그림자 일격', icon: '🌑', type: 'guaranteed_crit', mpCost: 6, powerMult: 2.0, cooldown: 4, unlockLevel: 5, desc: '확정 크리티컬 ATK×2.0' },
    { id: 'ult-phantom', name: '환영', icon: '👻', type: 'self_eva_buff', mpCost: 8, power: 0.5, duration: 2, cooldown: 5, unlockLevel: 8, desc: '2턴간 회피율 +50%' },
  ],
  breaker: [
    { id: 'ult-armor-break', name: '갑파쇄', icon: '💎', type: 'def_break_slow', mpCost: 7, power: 0, cooldown: 4, unlockLevel: 5, desc: '적 DEF→0 (2턴) + 둔화 2턴' },
    { id: 'ult-soul-crush', name: '혼쇄', icon: '☠️', type: 'true_damage', mpCost: 10, powerMult: 3.0, cooldown: 6, unlockLevel: 8, desc: '방어 완전 무시 ATK×3.0' },
  ],
};

// ── Passive Skill Tree (level-gated) ──────────────────────────────────

export const PASSIVE_TREE = {
  tank:           [{ lv: 2, stat: 'maxHp', val: 10, name: '강인함' }, { lv: 4, stat: 'def', val: 3, name: '철갑' }, { lv: 6, stat: 'eva', val: 0.05, name: '직감 회피' }],
  melee_dps:      [{ lv: 2, stat: 'atk', val: 3, name: '날카로움' }, { lv: 4, stat: 'crt', val: 0.05, name: '급소 감각' }, { lv: 6, stat: 'pen', val: 2, name: '관통력' }],
  ranged_dps:     [{ lv: 2, stat: 'atk', val: 2, name: '정밀 사격' }, { lv: 4, stat: 'rng', val: 1, name: '장거리' }, { lv: 6, stat: 'crt', val: 0.08, name: '헤드샷' }],
  support:        [{ lv: 2, stat: 'maxHp', val: 8, name: '생존 본능' }, { lv: 4, stat: 'maxMp', val: 3, name: '마력 증폭' }, { lv: 6, stat: 'def', val: 2, name: '수호' }],
  bruiser:        [{ lv: 2, stat: 'atk', val: 2, name: '투쟁심' }, { lv: 4, stat: 'def', val: 2, name: '투사의 갑주' }, { lv: 6, stat: 'maxHp', val: 12, name: '불굴' }],
  battle_support: [{ lv: 2, stat: 'maxMp', val: 2, name: '전술 감각' }, { lv: 4, stat: 'atk', val: 2, name: '공격 지원' }, { lv: 6, stat: 'def', val: 2, name: '전선 유지' }],
  evasive_dps:    [{ lv: 2, stat: 'eva', val: 0.05, name: '그림자 걸음' }, { lv: 4, stat: 'atk', val: 3, name: '암습' }, { lv: 6, stat: 'crt', val: 0.1, name: '급소 일격' }],
  breaker:        [{ lv: 2, stat: 'pen', val: 2, name: '파쇄력' }, { lv: 4, stat: 'atk', val: 3, name: '파괴 본능' }, { lv: 6, stat: 'crt', val: 0.08, name: '약점 간파' }],
};

// ── UO-Style Stat Growth ──────────────────────────────────────────────

export function applyStatGrowth(unit, action) {
  if (!unit.statXP) unit.statXP = { atk: 0, def: 0, eva: 0, crt: 0, mp: 0 };
  const threshold = 30 + unit.level * 5;
  const gains = [];

  const grow = (stat, xpKey, amount, label) => {
    unit.statXP[xpKey] += amount;
    if (unit.statXP[xpKey] >= threshold) {
      unit.statXP[xpKey] -= threshold;
      if (stat === 'eva' || stat === 'crt') {
        unit[stat] = Math.min(stat === 'eva' ? 0.5 : 0.6, (unit[stat] || 0) + 0.01);
      } else if (stat === 'maxMp') {
        unit.maxMp += 1;
        unit.mp = Math.min(unit.mp + 1, unit.maxMp);
      } else {
        unit[stat] += 1;
      }
      gains.push(label);
    }
  };

  switch (action) {
    case 'attack': grow('atk', 'atk', 10, 'ATK +1'); break;
    case 'take_damage': grow('def', 'def', 8, 'DEF +1'); break;
    case 'evade': grow('eva', 'eva', 15, 'EVA +0.01'); break;
    case 'critical': grow('crt', 'crt', 12, 'CRT +0.01'); break;
    case 'use_skill': grow('maxMp', 'mp', 10, 'MP +1'); break;
  }
  return gains.length > 0 ? gains : null;
}

// ── Equipment ──────────────────────────────────────────────────────────

export const EQUIPMENT = [
  { id: 'needle', name: '채혈침', slot: 'weapon', stats: { atk: 2 } },
  { id: 'baton', name: '보안봉', slot: 'weapon', stats: { atk: 4, crt: 0.05 } },
  { id: 'scalpel', name: '수술용 메스', slot: 'weapon', stats: { atk: 6, pen: 2 } },
  { id: 'kartein-blade', name: '카르테인 장검', slot: 'weapon', stats: { atk: 8, pen: 3, crt: 0.1 } },
  { id: 'duke-saber', name: '듀크의 의검', slot: 'weapon', stats: { atk: 12, pen: 5, crt: 0.15 } },
  { id: 'lab-coat', name: '실험복', slot: 'armor', stats: { def: 2, hp: 5 } },
  { id: 'guard-vest', name: '방호복', slot: 'armor', stats: { def: 4, hp: 10 } },
  { id: 'blood-armor', name: '혈맹 갑주', slot: 'armor', stats: { def: 6, hp: 20, eva: 0.05 } },
  { id: 'ancient-plate', name: '고대 혈족 갑주', slot: 'armor', stats: { def: 10, hp: 30, eva: 0.1 } },
  { id: 'night-goggles', name: '야간 투시경', slot: 'accessory', stats: { rng: 1 } },
  { id: 'speed-boots', name: '경량 부츠', slot: 'accessory', stats: { mov: 1 } },
  { id: 'crit-charm', name: '날카로운 부적', slot: 'accessory', stats: { crt: 0.15, atk: 3 } },
  { id: 'duke-signet', name: '듀크의 인장', slot: 'accessory', stats: { atk: 5, crt: 0.15, eva: 0.1 } },
];

export const RELICS = [
  { id: 'first-resolve', name: '첫날의 각오', desc: 'HP 100%일 때 ATK +20%', condition: 'full_hp', effect: { atkMult: 1.2 } },
  { id: 'survivor-will', name: '생존자의 의지', desc: 'HP 25% 이하일 때 DEF +50%, ATK +30%', condition: 'low_hp', effect: { atkMult: 1.3, defMult: 1.5 } },
  { id: 'blood-pact', name: '혈연의 계약', desc: '공격 시 데미지의 10% HP 흡수', condition: 'on_attack', effect: { lifesteal: 0.1 } },
  { id: 'director-glasses', name: '센터장의 안경', desc: '아군 전체 DEF +2', condition: 'field_aura', effect: { allyDef: 2 } },
  { id: 'duke-wine', name: '듀크의 와인잔', desc: '적 처치 시 HP 30% 회복', condition: 'on_kill', effect: { killHeal: 0.3 } },
];

const DEFAULT_LOADOUT = {
  tank:           { weapon: 'baton', armor: 'guard-vest' },
  melee_dps:      { weapon: 'baton', armor: 'lab-coat' },
  ranged_dps:     { weapon: 'needle', armor: 'lab-coat' },
  support:        { weapon: 'needle', armor: 'lab-coat' },
  bruiser:        { weapon: 'scalpel', armor: 'guard-vest' },
  battle_support: { weapon: 'needle', armor: 'lab-coat' },
  evasive_dps:    { weapon: 'scalpel', armor: 'lab-coat', accessory: 'speed-boots' },
  breaker:        { weapon: 'kartein-blade', armor: 'blood-armor', accessory: 'crit-charm' },
};

export function equipItem(unit, equipmentId) {
  const item = EQUIPMENT.find(e => e.id === equipmentId);
  if (!item) return false;
  if (unit.equipment[item.slot]) unequipItem(unit, item.slot);
  unit.equipment[item.slot] = item;
  const s = item.stats;
  if (s.hp)  { unit.maxHp += s.hp; unit.hp += s.hp; }
  if (s.atk) unit.atk += s.atk;
  if (s.def) unit.def += s.def;
  if (s.crt) unit.crt += s.crt;
  if (s.eva) unit.eva += s.eva;
  if (s.pen) unit.pen += s.pen;
  if (s.mov) unit.mov += s.mov;
  if (s.rng) unit.rng += s.rng;
  return true;
}

function unequipItem(unit, slot) {
  const item = unit.equipment[slot];
  if (!item) return;
  const s = item.stats;
  if (s.hp)  { unit.maxHp -= s.hp; unit.hp = Math.min(unit.hp, unit.maxHp); }
  if (s.atk) unit.atk -= s.atk;
  if (s.def) unit.def -= s.def;
  if (s.crt) unit.crt -= s.crt;
  if (s.eva) unit.eva -= s.eva;
  if (s.pen) unit.pen -= s.pen;
  if (s.mov) unit.mov -= s.mov;
  if (s.rng) unit.rng -= s.rng;
  unit.equipment[slot] = null;
}

export function equipRelic(unit, relicId) {
  const relic = RELICS.find(r => r.id === relicId);
  if (!relic) return false;
  unit.relic = relic;
  return true;
}

function autoEquip(unit) {
  const loadout = DEFAULT_LOADOUT[unit.role];
  if (!loadout) return;
  for (const [, itemId] of Object.entries(loadout)) {
    equipItem(unit, itemId);
  }
}

function getAttackType(charData, role) {
  if (charData.faction === 'kartein' && charData.sense) {
    const senseInfo = SENSE_TYPES[charData.sense.baseType];
    if (senseInfo && senseInfo.category === '혈') return 'blood';
  }
  if (role === 'breaker') return charData.faction === 'kartein' ? 'blood' : 'physical';
  if (['tank', 'melee_dps', 'bruiser', 'evasive_dps'].includes(role)) return 'physical';
  return 'mental';
}

export function getCombatPower(unit) {
  return Math.floor(
    unit.atk * 2 + unit.def * 1.5 + unit.maxHp * 0.3
    + unit.crt * 50 + unit.eva * 40 + unit.pen * 10
  );
}

// ── MBTI Synergy System ────────────────────────────────────────────────

const MBTI_DIM_SCORES = {
  EI: { same: 1, diff: 1 },
  SN: { same: 3, diff: -1 },
  TF: { same: 0, diff: 3 },
  JP: { same: 2, diff: 1 },
};

export function getMbtiPairScore(mbtiA, mbtiB) {
  if (!mbtiA || !mbtiB || mbtiA.length !== 4 || mbtiB.length !== 4) return 4;
  let score = 0;
  const dims = ['EI', 'SN', 'TF', 'JP'];
  for (let i = 0; i < 4; i++) {
    const same = mbtiA[i] === mbtiB[i];
    score += same ? MBTI_DIM_SCORES[dims[i]].same : MBTI_DIM_SCORES[dims[i]].diff;
  }
  return score;
}

export function getMbtiSynergyGrade(pairScore) {
  if (pairScore >= 8) return { grade: 'SS', mult: 2.0, label: '🔥 황금 궁합' };
  if (pairScore >= 6) return { grade: 'S',  mult: 1.5, label: '✦ 자연 동맹' };
  if (pairScore >= 4) return { grade: 'A',  mult: 1.2, label: '○ 호환' };
  if (pairScore >= 2) return { grade: 'B',  mult: 1.0, label: '— 중립' };
  if (pairScore >= 0) return { grade: 'C',  mult: 0.75, label: '△ 마찰' };
  return { grade: 'D', mult: 0.5, label: '❌ 충돌' };
}

export const SECRET_COMBOS = [
  { mbtis: ['INTJ','ENTP','INFJ','ENFP'], mult: 3.0, name: '천재 연합' },
  { mbtis: ['ISTJ','ESTJ','ISFJ','ESFJ'], mult: 2.5, name: '철벽 수비대' },
  { mbtis: ['ENTJ','INTJ','ENTP','INTP'], mult: 2.8, name: '전략가 협의회' },
  { mbtis: ['INFP','ENFP','INFJ','ENFJ'], mult: 2.5, name: '정신 공명' },
  { mbtis: ['ESTP','ISTP','ENTJ'],        mult: 2.0, name: '돌격 삼총사' },
  { mbtis: ['ENFJ','INFP','ISTP'],        mult: 2.0, name: '삼위일체' },
  { mbtis: ['INTJ','ENFP','ISTJ'],        mult: 1.8, name: '균형의 삼각' },
  { mbtis: ['ENTJ','ISFP','INTP'],        mult: 1.8, name: '창조적 리더십' },
  { mbtis: ['ESTJ','INFJ','ESTP','INFP'], mult: 2.2, name: '완전한 균형' },
  { mbtis: ['ISTP','ESTP','ESFP','ISFP'], mult: 2.0, name: '감각의 질풍' },
];

function findSecretCombo(mbtiList) {
  const sorted = [...mbtiList].sort();
  for (const combo of SECRET_COMBOS) {
    const comboSorted = [...combo.mbtis].sort();
    if (comboSorted.length > sorted.length) continue;
    const match = comboSorted.every(m => sorted.includes(m));
    if (match) return combo;
  }
  return null;
}

export function getTeamSynergy(units) {
  if (!units || units.length < 2) return { teamMult: 1.0, pairDetails: [], secretCombo: null, avgGrade: 'B' };

  const pairs = [];
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const score = getMbtiPairScore(units[i].mbti, units[j].mbti);
      const synergy = getMbtiSynergyGrade(score);
      pairs.push({ a: units[i].name, b: units[j].name, score, ...synergy });
    }
  }

  const geoMean = Math.pow(pairs.reduce((acc, p) => acc * p.mult, 1), 1 / pairs.length);

  const secret = findSecretCombo(units.map(u => u.mbti));
  const secretMult = secret ? secret.mult : 1.0;

  const finalMult = Math.round(geoMean * secretMult * 100) / 100;

  const avgScore = pairs.reduce((s, p) => s + p.score, 0) / pairs.length;
  const avgGrade = getMbtiSynergyGrade(Math.round(avgScore)).grade;

  return { teamMult: finalMult, pairDetails: pairs, secretCombo: secret, avgGrade };
}

export function getTeamCP(units) {
  const individual = units.reduce((sum, u) => sum + getCombatPower(u) * (1 + (u.level - 1) * 0.08), 0);
  const synergy = getTeamSynergy(units);
  return { total: Math.floor(individual * synergy.teamMult), individual: Math.floor(individual), synergy };
}

// ── XP / Level System ──────────────────────────────────────────────────

export const XP_TABLE = { attack: 10, kill: 30, skill: 15, takeDamage: 5 };

export function gainXP(unit, amount) {
  if (!unit || unit.hp <= 0) return null;
  unit.xp += amount;
  const levelUps = [];
  while (unit.xp >= unit.xpToNext) {
    unit.xp -= unit.xpToNext;
    unit.level++;
    unit.xpToNext = unit.level * 50;
    const hpGain = Math.floor(unit.maxHp * 0.05);
    unit.maxHp += hpGain;
    unit.hp = Math.min(unit.hp + hpGain, unit.maxHp);
    unit.atk += 2;
    unit.def += 1;
    unit.maxMp += 1;
    unit.mp = Math.min(unit.mp + 1, unit.maxMp);
    if (unit.senseSkill) {
      unit.senseSkill.power += 1;
      if (unit.level % 3 === 0 && unit.senseSkill.maxCooldown > 1) {
        unit.senseSkill.maxCooldown--;
      }
    }
    applyPassiveTree(unit);
    levelUps.push({ level: unit.level, hpGain, atk: unit.atk, def: unit.def });
  }
  return levelUps.length > 0 ? levelUps : null;
}

function applyPassiveTree(unit) {
  const tree = PASSIVE_TREE[unit.role];
  if (!tree) return;
  tree.forEach(p => {
    if (unit.level >= p.lv && !unit.passivesApplied.includes(p.name)) {
      if (p.stat === 'maxHp') { unit.maxHp += p.val; unit.hp += p.val; }
      else if (p.stat === 'maxMp') { unit.maxMp += p.val; unit.mp = Math.min(unit.mp + p.val, unit.maxMp); }
      else { unit[p.stat] = (unit[p.stat] || 0) + p.val; }
      unit.passivesApplied.push(p.name);
    }
  });
}

// ── Terrain Effects ────────────────────────────────────────────────────

export function getTerrainEffect(map, x, y) {
  if (y < 0 || y >= map.rows || x < 0 || x >= map.cols) return {};
  const tileType = map.tiles[y][x].type;
  const t = TILE_TYPES[tileType];
  if (!t) return {};
  return {
    defBonus: t.defBonus || 0,
    atkBonus: t.atkBonus || 0,
    evaBonus: t.evaBonus || 0,
    healPerTurn: t.healPerTurn || 0,
  };
}

export function applyTerrainHealing(state) {
  const healed = [];
  state.units.forEach(u => {
    if (u.hp <= 0) return;
    const effect = getTerrainEffect(state.map, u.x, u.y);
    if (effect.healPerTurn > 0 && u.hp < u.maxHp) {
      let heal = effect.healPerTurn;
      if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
      const actual = Math.min(heal, u.maxHp - u.hp);
      u.hp += actual;
      state.log.push(`♨ ${u.name} 온천 회복 +${actual} HP`);
      healed.push({ uid: u.uid, x: u.x, y: u.y, heal: actual, name: u.name });
    }
  });
  return healed;
}

// ── Ultimate Execution ─────────────────────────────────────────────────

export function executeUltimate(state, unit, ultIndex) {
  if (!unit || unit.hp <= 0 || unit.acted) return { ok: false, reason: '행동 불가' };
  const ult = unit.ultimates?.[ultIndex];
  if (!ult) return { ok: false, reason: '궁극기 없음' };
  if (unit.level < ult.unlockLevel) return { ok: false, reason: `Lv.${ult.unlockLevel} 해금` };
  if (ult.currentCooldown > 0) return { ok: false, reason: `쿨다운 ${ult.currentCooldown}턴` };
  if (unit.mp < ult.mpCost) return { ok: false, reason: `MP 부족 (${unit.mp}/${ult.mpCost})` };

  unit.mp -= ult.mpCost;
  ult.currentCooldown = ult.cooldown;
  unit.acted = true;

  const allies = state.units.filter(u => u.team === unit.team && u.hp > 0 && u.uid !== unit.uid);
  const enemies = state.units.filter(u => u.team !== unit.team && u.hp > 0);
  const result = { ok: true, name: ult.name, icon: ult.icon, type: ult.type, effects: [] };

  switch (ult.type) {
    case 'team_def_buff':
      allies.forEach(a => { a.def += ult.power; a.buffs.push({ stat: 'def', val: ult.power, turns: ult.duration }); });
      unit.def += ult.power; unit.buffs.push({ stat: 'def', val: ult.power, turns: ult.duration });
      result.effects.push(`아군 전체 DEF +${ult.power} (${ult.duration}턴)`);
      break;
    case 'team_atk_buff':
      allies.forEach(a => { a.atk += ult.power; a.buffs.push({ stat: 'atk', val: ult.power, turns: ult.duration }); });
      unit.atk += ult.power; unit.buffs.push({ stat: 'atk', val: ult.power, turns: ult.duration });
      result.effects.push(`아군 전체 ATK +${ult.power} (${ult.duration}턴)`);
      break;
    case 'self_invuln':
      unit.invuln = true;
      unit.buffs.push({ stat: '_invuln', val: 1, turns: ult.duration });
      result.effects.push(`${ult.duration}턴 무적`);
      break;
    case 'self_atk_buff':
      unit.atk += ult.power; unit.buffs.push({ stat: 'atk', val: ult.power, turns: ult.duration });
      result.effects.push(`ATK +${ult.power} (${ult.duration}턴)`);
      break;
    case 'self_eva_buff':
      unit.eva += ult.power; unit.buffs.push({ stat: 'eva', val: ult.power, turns: ult.duration });
      result.effects.push(`EVA +${Math.round(ult.power*100)}% (${ult.duration}턴)`);
      break;
    case 'single_damage': case 'guaranteed_crit': case 'ignore_def_damage': case 'true_damage': {
      const target = enemies.sort((a,b) => a.hp - b.hp)[0];
      if (target) {
        let dmg = Math.floor(unit.atk * (ult.powerMult || 2));
        if (ult.type === 'guaranteed_crit') dmg = Math.floor(dmg * 1.5);
        if (ult.type !== 'ignore_def_damage' && ult.type !== 'true_damage') dmg = Math.max(1, dmg - target.def);
        if (target.invuln) dmg = 0;
        target.hp = Math.max(0, target.hp - dmg);
        result.effects.push(`${target.name}에게 ${dmg} 데미지${target.hp <= 0 ? ' → 전사!' : ''}`);
      }
      break;
    }
    case 'aoe_damage': {
      const r = ult.range || 2;
      enemies.forEach(e => {
        const dist = Math.abs(e.x - unit.x) + Math.abs(e.y - unit.y);
        if (dist <= r) {
          let dmg = Math.floor(unit.atk * (ult.powerMult || 1));
          dmg = Math.max(1, dmg - e.def);
          if (e.invuln) dmg = 0;
          e.hp = Math.max(0, e.hp - dmg);
          result.effects.push(`${e.name}에게 ${dmg}${e.hp <= 0 ? ' 전사!' : ''}`);
        }
      });
      break;
    }
    case 'aoe_stun': {
      const r = ult.range || 1;
      enemies.forEach(e => {
        const dist = Math.abs(e.x - unit.x) + Math.abs(e.y - unit.y);
        if (dist <= r) {
          let dmg = Math.floor(unit.atk * (ult.powerMult || 1));
          dmg = Math.max(1, dmg - e.def);
          if (e.invuln) dmg = 0;
          e.hp = Math.max(0, e.hp - dmg);
          if (e.hp > 0) applyStun(e, 1);
          result.effects.push(`${e.name}에게 ${dmg}${e.hp <= 0 ? ' 전사!' : ' + 기절!'}`)
        }
      });
      break;
    }
    case 'def_break_slow': {
      const target = enemies.sort((a,b) => b.def - a.def)[0];
      if (target) {
        const origDef = target.def;
        target.def = 0;
        target.buffs.push({ stat: 'def', val: -origDef, turns: 2 });
        applySlow(target, 2);
        result.effects.push(`${target.name} DEF → 0 + 둔화 (2턴)`);
      }
      break;
    }
    case 'lifesteal_attack': {
      const target = enemies.sort((a,b) => a.hp - b.hp)[0];
      if (target) {
        let dmg = Math.floor(unit.atk * (ult.powerMult || 2));
        dmg = Math.max(1, dmg - target.def);
        if (target.invuln) dmg = 0;
        target.hp = Math.max(0, target.hp - dmg);
        let heal = Math.floor(dmg * 0.5);
        if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
        unit.hp = Math.min(unit.maxHp, unit.hp + heal);
        result.effects.push(`${target.name}에게 ${dmg}, 흡혈 +${heal}`);
      }
      break;
    }
    case 'team_heal':
      allies.concat([unit]).forEach(a => {
        if (a.hp > 0 && a.hp < a.maxHp) {
          let heal = Math.floor(a.maxHp * (ult.powerMult || 0.3));
          if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
          a.hp = Math.min(a.maxHp, a.hp + heal);
          result.effects.push(`${a.name} HP +${heal}`);
        }
      });
      break;
    case 'team_shield':
      allies.concat([unit]).forEach(a => { if (a.hp > 0) a.shield = (a.shield || 0) + ult.power; });
      result.effects.push(`아군 전체 실드 +${ult.power}`);
      break;
    case 'revive': {
      const dead = state.units.find(u => u.team === unit.team && u.hp <= 0);
      if (dead) {
        dead.hp = Math.floor(dead.maxHp * (ult.powerMult || 0.5));
        dead.acted = true;
        result.effects.push(`${dead.name} 부활! HP ${dead.hp}`);
      } else {
        unit.mp += ult.mpCost;
        ult.currentCooldown = 0;
        unit.acted = false;
        return { ok: false, reason: '부활 대상 없음' };
      }
      break;
    }
  }

  applyStatGrowth(unit, 'use_skill');
  state.log.push(`🌟 ${unit.name}의 궁극기 「${ult.name}」 발동!`);
  return result;
}

// ── Buff Tick (end of round) ──────────────────────────────────────────

export function tickBuffs(state) {
  const expired = [];
  state.units.forEach(u => {
    if (u.hp <= 0 || !u.buffs) return;
    u.buffs = u.buffs.filter(b => {
      b.turns--;
      if (b.turns <= 0) {
        if (b.stat === '_invuln') { u.invuln = false; }
        else if (b.stat === 'eva' || b.stat === 'crt') { u[b.stat] = Math.max(0, (u[b.stat] || 0) - b.val); }
        else if (b.val < 0) { u[b.stat] = (u[b.stat] || 0) - b.val; }
        else { u[b.stat] = Math.max(0, (u[b.stat] || 0) - b.val); }
        const statLabel = { atk: 'ATK', def: 'DEF', eva: 'EVA', crt: 'CRT', _invuln: '무적' };
        expired.push({ uid: u.uid, name: u.name, stat: statLabel[b.stat] || b.stat });
        return false;
      }
      return true;
    });
    if (u.ultimates) u.ultimates.forEach(ult => { if (ult.currentCooldown > 0) ult.currentCooldown--; });
  });
  return expired;
}

// 🔴 사마의: DOT 시스템 (독/출혈)
export function applyDOT(unit, type, damage, turns) {
  if (!unit.dots) unit.dots = [];
  const existing = unit.dots.find(d => d.type === type);
  if (existing) {
    existing.damage = Math.max(existing.damage, damage);
    existing.turns = Math.max(existing.turns, turns);
  } else {
    unit.dots.push({ type, damage, turns });
  }
}

export function tickDOTs(state) {
  const dotDamage = [];
  state.units.forEach(u => {
    if (u.hp <= 0 || !u.dots || u.dots.length === 0) return;
    u.dots = u.dots.filter(d => {
      u.hp = Math.max(0, u.hp - d.damage);
      const died = u.hp <= 0;
      dotDamage.push({ uid: u.uid, name: u.name, type: d.type, damage: d.damage, died });
      d.turns--;
      return d.turns > 0;
    });
  });
  return dotDamage;
}

export function cleanseDOT(unit, type) {
  if (!unit.dots) return false;
  const before = unit.dots.length;
  if (type) {
    unit.dots = unit.dots.filter(d => d.type !== type);
  } else {
    unit.dots.shift();
  }
  return unit.dots.length < before;
}

// 🔴 사마의: 기절/둔화 상태이상
export function applyStun(unit, turns = 1) {
  if (!unit.statusEffects) unit.statusEffects = [];
  const existing = unit.statusEffects.find(s => s.type === 'stun');
  if (existing) { existing.turns = Math.max(existing.turns, turns); }
  else { unit.statusEffects.push({ type: 'stun', turns }); }
}

export function applySlow(unit, turns = 2) {
  if (!unit.statusEffects) unit.statusEffects = [];
  const existing = unit.statusEffects.find(s => s.type === 'slow');
  if (existing) { existing.turns = Math.max(existing.turns, turns); }
  else {
    unit.statusEffects.push({ type: 'slow', turns });
    unit.mov = Math.max(1, unit.mov - 1);
    unit.buffs.push({ stat: 'mov', val: -1, turns });
  }
}

export function isStunned(unit) {
  return unit.statusEffects?.some(s => s.type === 'stun') || false;
}

export function tickStatusEffects(state) {
  state.units.forEach(u => {
    if (!u.statusEffects || u.hp <= 0) return;
    u.statusEffects = u.statusEffects.filter(s => {
      s.turns--;
      if (s.turns <= 0) {
        if (s.type === 'slow') u.mov += 1;
        return false;
      }
      return true;
    });
  });
}

// 🔵 제갈량: 스킬 타겟 시스템
export function getSkillTargetType(unit) {
  if (!unit.senseSkill) return null;
  const t = unit.senseSkill.baseType;
  if (['직감', '혈압', '혈기', '혈유'].includes(t)) return 'enemy_single';
  if (t === '감응') return 'ally_single';
  if (t === '투지') return 'self';
  return 'auto';
}

export function getSkillTargets(state, unit) {
  if (!unit.senseSkill) return [];
  const type = getSkillTargetType(unit);
  if (type === 'self') return [unit];
  if (type === 'auto') return [];

  const senseRange = unit.senseSkill.baseType === '혈유' || unit.senseSkill.baseType === '혈각' ? 3 : 2;

  if (type === 'enemy_single') {
    return state.units.filter(u => u.team !== unit.team && u.hp > 0 &&
      manhattanDist(u, unit) <= senseRange);
  }
  if (type === 'ally_single') {
    const allies = state.units.filter(u => u.team === unit.team && u.hp > 0 && u.uid !== unit.uid &&
      u.hp < u.maxHp);
    if (allies.length === 0) return [unit];
    return allies;
  }
  return [];
}

// ── Loot System ────────────────────────────────────────────────────────

const LOOT_TABLE = [
  { id: 'potion-small', name: '소형 포션', type: 'consumable', effect: { heal: 20 }, weight: 40 },
  { id: 'potion-mp', name: 'MP 포션', type: 'consumable', effect: { mp: 5 }, weight: 25 },
  { id: 'atk-gem', name: '공격의 보석', type: 'consumable', effect: { atkBuff: 3 }, weight: 15 },
  { id: 'def-gem', name: '방어의 보석', type: 'consumable', effect: { defBuff: 3 }, weight: 10 },
  { id: 'xp-orb', name: '경험치 구슬', type: 'consumable', effect: { xp: 25 }, weight: 8 },
  { id: 'rare-charm', name: '행운의 부적', type: 'consumable', effect: { crtBuff: 0.1 }, weight: 2 },
];

export function rollLoot() {
  const totalWeight = LOOT_TABLE.reduce((s, l) => s + l.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of LOOT_TABLE) {
    roll -= item.weight;
    if (roll <= 0) return { ...item };
  }
  return { ...LOOT_TABLE[0] };
}

// ── Stat Conversion: Card → SRPG Unit ───────────────────────────────────

export function cardToUnit(charData, x, y) {
  const r = charData.rarity;
  let hp = charData.power * 12 + (RARITY_HP_BONUS[r] || 0);
  let atk = charData.power * 4 + (RARITY_ATK_BONUS[r] || 0);
  let def = Math.floor(charData.cost / 2) + (RARITY_DEF_BONUS[r] || 0);
  let mov = RARITY_MOV[r] || 3;

  const abilityType = charData.ability?.type || '';
  let rng = (abilityType === 'research' || abilityType === 'audit') ? 2 : 1;

  const role = charData.role;
  const mod = ROLE_MODIFIERS[role];
  if (mod) {
    hp = Math.floor(hp * mod.hp);
    atk = Math.floor(atk * mod.atk);
    def = Math.floor(def * mod.def);
    mov = mod.mov;
    if (mod.rng !== null) rng = mod.rng;
  }

  return {
    id: charData.id,
    charId: charData.id,
    name: charData.name,
    title: charData.title,
    faction: charData.faction,
    rarity: charData.rarity,
    role: role || null,
    mbti: CHARACTER_MBTI[charData.id] || 'ISTJ',

    hp,
    maxHp: hp,
    atk,
    def,
    mov,
    rng,
    crt: mod?.crt ?? 0.10,
    eva: mod?.eva ?? 0,
    pen: mod?.pen ?? 0,
    attackType: getAttackType(charData, role),
    equipment: { weapon: null, armor: null, accessory: null },
    relic: null,

    mp: 10,
    maxMp: 10,

    level: 1,
    xp: 0,
    xpToNext: 50,
    statXP: { atk: 0, def: 0, eva: 0, crt: 0, mp: 0 },
    ultimates: (ULTIMATES[role] || []).map(u => ({ ...u, currentCooldown: 0 })),
    passivesApplied: [],
    shield: 0,
    invuln: false,
    buffs: [],
    dots: [],
    statusEffects: [],

    senseSkill: charData.sense ? {
      name: charData.sense.name,
      baseType: charData.sense.baseType,
      power: charData.sense.power,
      flavor: charData.sense.flavor,
      effects: charData.sense.effects,
      cooldown: 0,
      maxCooldown: 3,
      mpCost: Math.max(2, Math.ceil(charData.sense.power * 0.8)),
    } : null,

    acted: false,
    x,
    y,
  };
}

// ── Map Utilities ───────────────────────────────────────────────────────

export function createMap(mapData) {
  const rows = mapData.length;
  const cols = mapData[0].length;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    tiles[r] = [];
    for (let c = 0; c < cols; c++) {
      tiles[r][c] = {
        type: mapData[r][c],
        x: c,
        y: r,
      };
    }
  }
  return { tiles, rows, cols };
}

function getTile(map, x, y) {
  if (x < 0 || y < 0 || y >= map.rows || x >= map.cols) return null;
  return map.tiles[y][x];
}

function isTileWalkable(map, x, y) {
  const tile = getTile(map, x, y);
  if (!tile) return false;
  return TILE_TYPES[tile.type]?.walkable !== false;
}

function getUnitAt(state, x, y) {
  return state.units.find(u => u.hp > 0 && u.x === x && u.y === y) || null;
}

// ── Stages / Missions ───────────────────────────────────────────────────

// Legend
const F='floor', W='wall', B='blood_storage', D='desk', E='entrance';
const T='forest', M='mountain', S='swamp', I='ice', G='graveyard', H='hotspring', U='dungeon', R='bridge', V='valley', P='road';

export const STAGES = [
  {
    id: 'stage-1',
    name: '센터 로비',
    description: '첫 번째 임무. 로비에 침입한 카르테인 척후병을 제거하라.',
    storyIntro: '야간 근무가 시작된 혈연센터 로비. 형광등이 깜빡이더니, 낯선 인물 둘이 출입구에서 나타났다.',
    storyOutro: '침입자를 물리쳤다. 쓰러진 자의 주머니에서 카르테인 가문의 인장이 발견되었다.',
    enemyLevel: 1,
    mapData: [
      [E, F, F, F, F, F, D, D, F, F],
      [F, F, F, F, F, F, F, F, F, F],
      [F, F, D, F, F, D, F, F, D, F],
      [F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F, F, F],
      [F, F, D, F, F, D, F, F, D, F],
      [D, D, F, F, F, F, F, F, F, E],
    ],
    playerSpawns: [
      { x: 0, y: 5 }, { x: 1, y: 6 }, { x: 0, y: 7 },
    ],
    enemyUnits: [
      { charId: 'elena-morgan', x: 9, y: 0 },
      { charId: 'kaspar-wren',  x: 8, y: 1 },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-2',
    name: '야간 창고',
    description: '혈액 보관소에 카르테인 요원들이 잠입했다. 혈액을 지켜라.',
    storyIntro: '자정. 혈액 보관소의 경보가 울린다. 보안 카메라에 4개의 그림자가 비친다.',
    storyOutro: '창고를 지켜냈다. 카르테인의 본격적인 움직임이 시작된 것 같다.',
    enemyLevel: 2,
    mapData: [
      [W, W, E, F, F, F, E, W, W, W],
      [W, F, F, F, F, F, F, F, F, W],
      [F, F, B, B, B, B, B, B, F, F],
      [F, F, B, B, B, B, B, B, F, F],
      [F, F, F, F, F, F, F, F, F, F],
      [W, F, F, F, D, D, F, F, F, W],
      [W, W, F, F, F, F, F, F, W, W],
      [W, W, W, F, F, F, F, W, W, W],
    ],
    playerSpawns: [
      { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    ],
    enemyUnits: [
      { charId: 'sergei-volkov',   x: 1, y: 5 },
      { charId: 'otto-brandt',     x: 8, y: 5 },
      { charId: 'elena-morgan',    x: 3, y: 7 },
      { charId: 'lucien-deveraux', x: 6, y: 7 },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-3',
    name: '지하 복도',
    description: '카르테인의 비밀 지하 통로. 강력한 적들이 기다리고 있다.',
    storyIntro: 'B2 복도 아래, 설계도에 없는 통로가 발견되었다.',
    storyOutro: '통로 끝에서 발견된 것은 카르테인 가문이 수십 년간 운영해온 비밀 혈액 저장시설이었다.',
    enemyLevel: 3,
    mapData: [
      [W, U, U, W, W, U, U, W, W, U],
      [W, U, U, U, W, U, U, U, W, U],
      [U, U, W, U, U, W, U, U, U, U],
      [U, U, W, U, U, W, U, U, U, U],
      [W, U, U, U, W, U, U, U, W, U],
      [W, U, U, W, W, U, U, W, W, U],
      [U, U, U, U, U, U, U, U, U, U],
      [W, U, U, U, W, U, U, U, U, W],
    ],
    playerSpawns: [
      { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 },
    ],
    enemyUnits: [
      { charId: 'viktor-hessen',  x: 1, y: 5 },
      { charId: 'aldric-thorne',  x: 6, y: 5 },
      { charId: 'marcus-vale',    x: 1, y: 3 },
      { charId: 'nigel-crowe',    x: 6, y: 3 },
      { charId: 'nadia-petrova',  x: 3, y: 7 },
      { charId: 'madeleine-voss', x: 6, y: 7 },
    ],
    reinforcements: [
      { turn: 3, units: [{ charId: 'kaspar-wren', x: 9, y: 7 }], message: '🔴 통로 끝에서 적 증원 출현!' },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-4',
    name: '빙결의 숲',
    weather: 'blizzard',
    description: '겨울 산림 속 카르테인 전초기지. 빙판과 숲이 이동을 방해한다.',
    storyIntro: '도시 외곽의 동결된 숲. 카르테인의 보급로를 차단하기 위해 깊숙이 들어왔다. 나뭇가지 사이로 은발이 스친다.',
    storyOutro: '전초기지를 파괴했다. 하지만 숲 깊은 곳에서 더 강한 기운이 느껴진다.',
    enemyLevel: 4,
    mapData: [
      [T, T, F, I, I, F, T, T, T, M, M, T],
      [T, F, F, I, I, F, F, T, F, F, M, T],
      [F, F, T, F, F, F, T, F, F, T, F, F],
      [F, F, T, F, T, T, F, F, T, F, F, F],
      [T, F, F, F, T, T, F, F, F, F, F, T],
      [T, F, F, I, F, F, I, F, F, T, F, T],
      [F, F, T, I, F, F, I, T, F, F, F, F],
      [T, T, T, F, F, F, F, T, T, F, T, T],
      [M, T, F, F, T, T, F, F, T, F, T, M],
      [M, M, T, F, F, F, F, T, M, M, M, M],
    ],
    playerSpawns: [
      { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 2 },
    ],
    enemyUnits: [
      { charId: 'nikolai-frost',     x: 10, y: 1 },
      { charId: 'madeleine-voss',    x: 9, y: 3 },
      { charId: 'dimitri-rad',       x: 7, y: 5 },
      { charId: 'kaspar-wren',       x: 10, y: 6 },
      { charId: 'nadia-petrova',     x: 8, y: 8 },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-5',
    name: '계곡의 다리',
    weather: 'rain',
    description: '깊은 계곡을 가로지르는 오래된 다리. 양쪽에서 적이 밀려온다.',
    storyIntro: '카르테인 본거지로 향하는 유일한 길. 좁은 다리 위에서 적의 매복이 시작됐다.',
    storyOutro: '다리를 건넜다. 계곡 너머로 카르테인의 성이 보인다. 최종 결전이 다가오고 있다.',
    enemyLevel: 5,
    mapData: [
      [M, V, V, M, M, F, F, F, F, M, V, M],
      [M, V, F, F, M, F, F, F, F, M, V, M],
      [F, F, F, F, F, F, F, F, F, F, F, F],
      [V, V, F, R, R, R, R, R, F, V, V, V],
      [V, V, F, R, R, R, R, R, F, V, V, V],
      [F, F, F, F, F, F, F, F, F, F, F, F],
      [M, V, F, F, M, F, F, M, F, F, V, M],
      [M, V, V, M, M, F, F, M, M, V, V, M],
      [M, M, V, V, F, F, F, F, V, V, M, M],
      [M, M, M, V, V, F, F, V, V, M, M, M],
    ],
    playerSpawns: [
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 5 }, { x: 2, y: 5 },
    ],
    enemyUnits: [
      { charId: 'aldric-thorne',     x: 9, y: 2 },
      { charId: 'sergei-volkov',     x: 10, y: 2 },
      { charId: 'marcus-vale',       x: 9, y: 5 },
      { charId: 'vivienne-la-croix', x: 7, y: 3 },
      { charId: 'otto-brandt',       x: 7, y: 4 },
      { charId: 'lucien-deveraux',   x: 5, y: 8 },
    ],
    reinforcements: [
      { turn: 2, units: [{ charId: 'dimitri-rad', x: 5, y: 9 }], message: '🔴 계곡 아래에서 적 증원!' },
      { turn: 4, units: [{ charId: 'nadia-petrova', x: 10, y: 5 }, { charId: 'kaspar-wren', x: 11, y: 5 }], message: '🔴 적 후속 부대 도착!' },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-6',
    name: '묘지의 온천',
    weather: 'fog',
    description: '고대 뱀파이어들의 묘지. 온천에서 회복하며 싸워라.',
    storyIntro: '카르테인 선조들의 묘지. 기이하게도 뜨거운 온천이 솟아오르고 있다. 묘비 사이로 적들이 깨어난다.',
    storyOutro: '묘지의 수호자를 물리쳤다. 고대의 비밀이 담긴 석판을 발견했다.',
    enemyLevel: 6,
    mapData: [
      [G, G, F, F, T, T, F, F, G, G, F, F],
      [G, F, F, H, F, F, H, F, F, G, F, F],
      [F, F, G, F, F, F, F, G, F, F, F, S],
      [F, H, F, F, G, G, F, F, H, F, S, S],
      [F, F, F, G, G, G, G, F, F, F, F, F],
      [T, F, G, G, W, W, G, G, F, T, F, F],
      [T, F, F, G, W, W, G, F, F, T, F, F],
      [F, F, H, F, F, F, F, H, F, F, F, F],
      [G, F, F, F, G, G, F, F, F, G, F, F],
      [G, G, F, F, T, T, F, F, G, G, F, F],
    ],
    playerSpawns: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ],
    enemyUnits: [
      { charId: 'isadora-kartein',   x: 4, y: 4 },
      { charId: 'cecilia-kartein',   x: 5, y: 4 },
      { charId: 'viktor-hessen',     x: 9, y: 0 },
      { charId: 'nikolai-frost',     x: 10, y: 2 },
      { charId: 'nigel-crowe',       x: 9, y: 8 },
      { charId: 'aldric-thorne',     x: 10, y: 5 },
      { charId: 'nadia-petrova',     x: 5, y: 9 },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-7',
    name: '카르테인 성',
    description: '최종 결전. 카르테인 듀크와의 대결.',
    storyIntro: '카르테인 성의 대전(大殿). 듀크가 옥좌에서 일어선다. "여기까지 왔군. 하지만 이것으로 끝이다."',
    storyOutro: '듀크를 물리쳤다! 하지만 그는 미소를 지으며 사라졌다. "다음에 또 만나지..."',
    enemyLevel: 8,
    mapData: [
      [W, W, W, U, U, U, U, U, U, W, W, W],
      [W, U, U, U, F, F, F, F, U, U, U, W],
      [W, U, F, F, F, F, F, F, F, F, U, W],
      [U, U, F, F, F, G, G, F, F, F, U, U],
      [U, F, F, F, G, G, G, G, F, F, F, U],
      [U, F, F, F, G, G, G, G, F, F, F, U],
      [U, U, F, F, F, F, F, F, F, F, U, U],
      [W, U, F, F, F, F, F, F, F, F, U, W],
      [W, U, U, F, F, F, F, F, F, U, U, W],
      [W, W, U, U, E, E, E, E, U, U, W, W],
    ],
    playerSpawns: [
      { x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }, { x: 7, y: 9 },
    ],
    enemyUnits: [
      { charId: 'kartein-duke',      x: 5, y: 3 },
      { charId: 'isadora-kartein',   x: 4, y: 4 },
      { charId: 'cecilia-kartein',   x: 7, y: 4 },
      { charId: 'commissioner-park', x: 6, y: 3 },
      { charId: 'aldric-thorne',     x: 2, y: 2 },
      { charId: 'marcus-vale',       x: 9, y: 2 },
      { charId: 'vivienne-la-croix', x: 3, y: 6 },
      { charId: 'nikolai-frost',     x: 8, y: 6 },
    ],
    reinforcements: [
      { turn: 3, units: [{ charId: 'sergei-volkov', x: 3, y: 9 }, { charId: 'elena-morgan', x: 8, y: 9 }], message: '🔴 성문에서 카르테인 근위대 출현!' },
      { turn: 5, units: [{ charId: 'otto-brandt', x: 5, y: 0 }], message: '🔴 옥좌 뒤에서 암살자 출현!' },
    ],
    victoryCondition: 'defeat_all',
    weather: 'bloodmoon',
  },
];

// 🔴 사마의: 날씨 시스템
export const WEATHER_TYPES = {
  clear:     { id: 'clear',     name: '맑음',   icon: '☀️', desc: '효과 없음', effects: {} },
  rain:      { id: 'rain',      name: '비',     icon: '🌧️', desc: '원거리 ATK-2, 전체 EVA+5%', effects: { rangedAtkPenalty: 2, evaBonus: 0.05 } },
  fog:       { id: 'fog',       name: '안개',   icon: '🌫️', desc: '사거리 2→1, 원거리 ATK-3', effects: { rngReduction: 1, rangedAtkPenalty: 3 } },
  blizzard:  { id: 'blizzard',  name: '눈보라', icon: '❄️', desc: '전체 MOV-1, 빙판 EVA+10%', effects: { movPenalty: 1, iceEvaBonus: 0.1 } },
  bloodmoon: { id: 'bloodmoon', name: '혈월',   icon: '🌑', desc: '카르테인 ATK+3, 회복 효과 -30%', effects: { karteinAtkBonus: 3, healReduction: 0.3 } },
  storm:     { id: 'storm',     name: '폭풍',   icon: '⛈️', desc: '전체 CRT+10%, 반격 데미지 +20%', effects: { crtBonus: 0.1, counterBoost: 0.2 } },
};

export function applyWeatherToUnit(unit, weather, state) {
  if (!weather || weather.id === 'clear') return;
  const fx = weather.effects;
  if (fx.rangedAtkPenalty && unit.rng >= 2) unit.atk = Math.max(1, unit.atk - fx.rangedAtkPenalty);
  if (fx.evaBonus) unit.eva += fx.evaBonus;
  if (fx.rngReduction && unit.rng >= 2) unit.rng = Math.max(1, unit.rng - fx.rngReduction);
  if (fx.movPenalty) unit.mov = Math.max(1, unit.mov - fx.movPenalty);
  if (fx.karteinAtkBonus && unit.faction === 'kartein') unit.atk += fx.karteinAtkBonus;
  if (fx.crtBonus) unit.crt += fx.crtBonus;
}

// 🔴🔵 무한의 탑 — 웨이브 스테이지 생성기
export function generateTowerStage(wave) {
  const cols = 10, rows = 8;
  const tiles = ['floor', 'floor', 'floor', 'floor', 'floor', 'forest', 'graveyard', 'swamp', 'ice', 'hotspring'];
  const mapData = [];
  for (let r = 0; r < rows; r++) {
    mapData[r] = [];
    for (let c = 0; c < cols; c++) {
      if ((r === 0 || r === rows - 1) && (c === 0 || c === cols - 1)) { mapData[r][c] = 'wall'; continue; }
      mapData[r][c] = Math.random() < 0.15 ? tiles[Math.floor(Math.random() * tiles.length)] : 'floor';
    }
  }

  const enemyPool = CHARACTERS.filter(c => c.faction === 'kartein');
  const enemyCount = Math.min(8, 2 + Math.floor(wave * 0.8));
  const enemyUnits = [];
  for (let i = 0; i < enemyCount; i++) {
    const char = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    let x, y;
    do {
      x = 5 + Math.floor(Math.random() * (cols - 6));
      y = Math.floor(Math.random() * (rows - 2)) + 1;
    } while (enemyUnits.some(e => e.x === x && e.y === y) || mapData[y][x] === 'wall');
    enemyUnits.push({ charId: char.id, x, y });
  }

  const weathers = Object.keys(WEATHER_TYPES);
  const weather = wave <= 2 ? 'clear' : weathers[Math.floor(Math.random() * weathers.length)];

  return {
    id: `tower-${wave}`,
    name: `무한의 탑 ${wave}층`,
    description: `웨이브 ${wave} — 적 ${enemyCount}명`,
    storyIntro: wave === 1 ? '탑의 문이 열렸다. 끝이 보이지 않는 나선 계단이 이어진다.' : null,
    storyOutro: null,
    enemyLevel: Math.min(20, wave + 1),
    mapData,
    playerSpawns: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
    enemyUnits,
    victoryCondition: 'defeat_all',
    weather,
    reinforcements: wave >= 5 && wave % 3 === 0 ? [{
      turn: 3,
      units: [{ charId: enemyPool[Math.floor(Math.random() * enemyPool.length)].id, x: cols - 2, y: rows - 2 }],
      message: '🔴 탑 수호자 증원!'
    }] : null,
  };
}

export function getTowerRewards(wave) {
  const cards = [];
  if (wave >= 20) cards.push('legendary', 'rare', 'rare', 'uncommon');
  else if (wave >= 15) cards.push('rare', 'rare', 'uncommon', 'uncommon');
  else if (wave >= 10) cards.push('rare', 'uncommon', 'uncommon', 'common');
  else if (wave >= 5) cards.push('uncommon', 'uncommon', 'common', 'common');
  else if (wave >= 3) cards.push('uncommon', 'common', 'common');
  else cards.push('common', 'common');
  const tickets = wave >= 10 ? 3 : wave >= 5 ? 2 : 1;
  const milestone = (wave === 5 || wave === 10 || wave === 15 || wave === 20) ? wave : null;
  return { cards, tickets, milestone };
}

export function createBattleState(stageId, playerCharIds, centerBuff, teamSynergyMult) {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) throw new Error(`Stage not found: ${stageId}`);

  const map = createMap(stage.mapData);
  const units = [];

  // Place player units
  const playerChars = playerCharIds
    .map(id => CHARACTERS.find(c => c.id === id))
    .filter(Boolean);

  playerChars.forEach((charData, i) => {
    const spawn = stage.playerSpawns[i];
    if (!spawn) return;
    const unit = cardToUnit(charData, spawn.x, spawn.y);
    unit.team = 'player';
    // Disambiguate duplicate ids
    unit.uid = `player-${charData.id}-${i}`;
    if (centerBuff) {
      unit.maxHp += centerBuff.hpBuff;
      unit.hp = unit.maxHp;
      unit.atk += centerBuff.atkBuff;
      unit.def += centerBuff.defBuff;
    }
    units.push(unit);
  });

  // Place enemy units (scaled to stage enemyLevel)
  stage.enemyUnits.forEach((eu, i) => {
    const charData = CHARACTERS.find(c => c.id === eu.charId);
    if (!charData) return;
    const unit = cardToUnit(charData, eu.x, eu.y);
    unit.team = 'enemy';
    unit.uid = `enemy-${charData.id}-${i}`;
    const eLv = stage.enemyLevel || 1;
    for (let lv = 1; lv < eLv; lv++) {
      unit.level++;
      unit.maxHp += Math.floor(unit.maxHp * 0.05);
      unit.hp = unit.maxHp;
      unit.atk += 2;
      unit.def += 1;
      unit.xpToNext = unit.level * 50;
    }
    units.push(unit);
  });

  // Auto-equip all units with default loadout
  units.forEach(u => autoEquip(u));

  // 🔴 사마의: 보스(레전더리) 적에게 유물 자동 장비
  const BOSS_RELICS = ['duke-wine', 'survivor-will', 'blood-pact', 'first-resolve', 'director-glasses'];
  let relicIdx = 0;
  units.filter(u => u.team === 'enemy' && u.rarity === 'legendary').forEach(u => {
    equipRelic(u, BOSS_RELICS[relicIdx % BOSS_RELICS.length]);
    relicIdx++;
  });

  // 🔴 사마의: 리더 아우라 — 레전더리 적이 있으면 아군 적 전체 강화
  const leaders = units.filter(u => u.team === 'enemy' && u.rarity === 'legendary');
  if (leaders.length > 0) {
    units.filter(u => u.team === 'enemy' && u.hp > 0).forEach(u => {
      u.atk += 2;
      u.def += 1;
      u._leaderBuff = true;
    });
  }

  const weatherId = stage.weather || 'clear';
  const weather = WEATHER_TYPES[weatherId] || WEATHER_TYPES.clear;
  const state = {
    stageId,
    stage,
    map,
    units,
    phase: 'player_phase',
    turnNumber: 1,
    selectedUnit: null,
    log: [],
    victoryCondition: stage.victoryCondition,
    result: null,
    teamSynergyMult: teamSynergyMult || 1.0,
    weather,
  };

  if (weather.id !== 'clear') {
    units.forEach(u => applyWeatherToUnit(u, weather, state));
  }

  state.factionSynergies = applyFactionSynergy(units);

  return state;
}

// ── Turn Phase Management ───────────────────────────────────────────────

export function endPlayerPhase(state) {
  if (state.phase !== 'player_phase') return;
  // Mark all player units as not-acted for next turn
  state.units.forEach(u => {
    if (u.team === 'player') u.acted = false;
  });
  state.phase = 'enemy_phase';
  state.log.push(`── 턴 ${state.turnNumber}: 적 페이즈 ──`);
}

export function endEnemyPhase(state) {
  if (state.phase !== 'enemy_phase') return;
  state.units.forEach(u => {
    if (u.team === 'enemy') u.acted = false;
  });
  state.units.forEach(u => {
    if (u.hp > 0) u.mp = Math.min(u.maxMp, u.mp + 2);
  });
  const terrainHealed = applyTerrainHealing(state);
  tickCooldowns(state);
  const expiredBuffs = tickBuffs(state);
  tickStatusEffects(state);
  const dotResults = tickDOTs(state);
  if (dotResults.length > 0) {
    dotResults.forEach(d => {
      const label = d.type === 'poison' ? '🟢독' : '🔴출혈';
      state.log.push(`${label} ${d.name} -${d.damage} HP`);
    });
  }
  state.turnNumber++;
  state.phase = 'player_phase';
  state.log.push(`── 턴 ${state.turnNumber}: 플레이어 페이즈 ──`);
  state.units.filter(u => u.team === 'player' && u.hp > 0 && isStunned(u)).forEach(u => {
    u.acted = true;
    state.log.push(`💫 ${u.name}은 기절 상태! 이번 턴 행동 불가`);
  });
  return { terrainHealed, expiredBuffs };
}

// ── Movement (BFS) ──────────────────────────────────────────────────────

export function getMovementRange(state, unit) {
  if (!unit || unit.hp <= 0) return [];

  const { map } = state;
  const visited = new Map(); // key "x,y" → distance
  const queue = [{ x: unit.x, y: unit.y, dist: 0 }];
  visited.set(`${unit.x},${unit.y}`, 0);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const { x, y, dist } = queue.shift();
    if (dist >= unit.mov) continue;

    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!isTileWalkable(map, nx, ny)) continue;

      const tile = getTile(map, nx, ny);
      const movCost = TILE_TYPES[tile.type]?.movCost || 1;
      const newDist = dist + movCost;
      if (newDist > unit.mov) continue;
      if (visited.has(key) && visited.get(key) <= newDist) continue;

      const occupant = getUnitAt(state, nx, ny);
      if (occupant && occupant.uid !== unit.uid) continue;

      visited.set(key, newDist);
      queue.push({ x: nx, y: ny, dist: newDist });
    }
  }

  // Remove the unit's current position, return only reachable tiles
  const result = [];
  for (const [key, dist] of visited) {
    if (dist === 0) continue; // skip current position
    const [cx, cy] = key.split(',').map(Number);
    // Must not be occupied by another unit at the destination
    const occupant = getUnitAt(state, cx, cy);
    if (!occupant || occupant.uid === unit.uid) {
      result.push({ x: cx, y: cy });
    }
  }
  return result;
}

// ── Move Unit ───────────────────────────────────────────────────────────

export function moveUnit(state, unit, targetX, targetY) {
  if (!unit || unit.hp <= 0) return { ok: false, reason: '유닛이 유효하지 않습니다' };
  if (unit.acted) return { ok: false, reason: '이미 행동한 유닛입니다' };

  const range = getMovementRange(state, unit);
  const valid = range.some(t => t.x === targetX && t.y === targetY);
  if (!valid) return { ok: false, reason: '이동 범위 밖입니다' };

  const fromX = unit.x;
  const fromY = unit.y;
  unit.x = targetX;
  unit.y = targetY;

  state.log.push(`${unit.name} 이동: (${fromX},${fromY}) → (${targetX},${targetY})`);
  return { ok: true };
}

// ── Attack Range ────────────────────────────────────────────────────────

export function getAttackRange(state, unit) {
  if (!unit || unit.hp <= 0) return [];

  const result = [];
  const { map } = state;

  if (unit.rng === 1) {
    // Melee: 4 adjacent tiles
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ];
    for (const { dx, dy } of dirs) {
      const nx = unit.x + dx;
      const ny = unit.y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.cols && ny < map.rows) {
        result.push({ x: nx, y: ny });
      }
    }
  } else {
    // Ranged (rng=2): all tiles within Manhattan distance 1..rng
    for (let dy = -unit.rng; dy <= unit.rng; dy++) {
      for (let dx = -unit.rng; dx <= unit.rng; dx++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < 1 || dist > unit.rng) continue;
        const nx = unit.x + dx;
        const ny = unit.y + dy;
        if (nx >= 0 && ny >= 0 && nx < map.cols && ny < map.rows) {
          result.push({ x: nx, y: ny });
        }
      }
    }
  }

  return result;
}

// ── Faction Advantage ───────────────────────────────────────────────────

function getFactionAdvantage(attacker, defender) {
  // center > kartein on defense (+2 DEF to center)
  // kartein > neutral on attack (+3 ATK to kartein)
  // neutral > center on speed (neutral attacks first in counter)
  return {
    atkBonus: (attacker.faction === FACTIONS.KARTEIN && defender.faction === FACTIONS.NEUTRAL) ? 3 : 0,
    defBonus: (defender.faction === FACTIONS.CENTER && attacker.faction === FACTIONS.KARTEIN) ? 2 : 0,
    speedAdvantage: (attacker.faction === FACTIONS.NEUTRAL && defender.faction === FACTIONS.CENTER),
  };
}

// ── Combat ──────────────────────────────────────────────────────────────

function isInRange(attackerUnit, targetX, targetY) {
  const dist = Math.abs(attackerUnit.x - targetX) + Math.abs(attackerUnit.y - targetY);
  return dist >= 1 && dist <= attackerUnit.rng;
}

function calcCombatResult(state, attacker, defender, isCounter = false) {
  let atkPower = attacker.atk;
  let defPower = defender.def;

  // Terrain bonuses
  if (state) {
    const atkTerrain = getTerrainEffect(state.map, attacker.x, attacker.y);
    const defTerrain = getTerrainEffect(state.map, defender.x, defender.y);
    atkPower += atkTerrain.atkBonus || 0;
    defPower += defTerrain.defBonus || 0;
  }

  // Relic: full HP ATK boost
  if (attacker.relic?.condition === 'full_hp' && attacker.hp >= attacker.maxHp) {
    atkPower = Math.floor(atkPower * (attacker.relic.effect.atkMult || 1));
  }
  // Relic: low HP ATK/DEF boost
  if (attacker.relic?.condition === 'low_hp' && attacker.hp <= attacker.maxHp * 0.25) {
    atkPower = Math.floor(atkPower * (attacker.relic.effect.atkMult || 1));
  }
  if (defender.relic?.condition === 'low_hp' && defender.hp <= defender.maxHp * 0.25) {
    defPower = Math.floor(defPower * (defender.relic.effect.defMult || 1));
  }

  // Relic: field aura DEF
  if (state) {
    state.units.filter(u => u.team === defender.team && u.hp > 0 && u.uid !== defender.uid).forEach(ally => {
      if (ally.relic?.condition === 'field_aura') defPower += ally.relic.effect.allyDef || 0;
    });
  }

  // Faction bonus
  const faction = getFactionAdvantage(attacker, defender);
  atkPower += faction.atkBonus;
  defPower += faction.defBonus;

  // 🔵 제갈량: 협공 보너스 (인접 아군 1명당 ATK +2)
  atkPower += getFlankingBonus(state, attacker, defender);

  // Evasion check (includes terrain bonus)
  const defTerrainEva = state ? (getTerrainEffect(state.map, defender.x, defender.y).evaBonus || 0) : 0;
  if (Math.random() < ((defender.eva || 0) + defTerrainEva)) {
    return { damage: 0, critical: false, evaded: true, penetrated: false };
  }

  // Penetration
  const pen = attacker.pen || 0;
  const effectiveDef = Math.max(0, defPower - pen);
  const penetrated = pen > 0 && defPower > effectiveDef;

  // Raw damage
  const rawDamage = atkPower - effectiveDef;

  // Type multiplier
  let typeMult = 1.0;
  if (attacker.attackType === 'blood') typeMult = 1.1;

  // Variance (15% of ATK, minimum range 1)
  const variance = Math.floor(Math.random() * Math.max(1, Math.floor(atkPower * 0.15)));

  // Critical
  const critical = Math.random() < (attacker.crt || 0.1);
  const critMult = critical ? 1.5 : 1.0;

  // Counter reduction + weather counter boost
  let counterMult = isCounter ? 0.7 : 1.0;
  if (isCounter && state?.weather?.effects?.counterBoost) {
    counterMult += state.weather.effects.counterBoost;
  }

  // Team synergy multiplier (player units only, capped at 1.5× for balance)
  let synergyMult = 1.0;
  if (state && attacker.team === 'player' && state.teamSynergyMult) {
    synergyMult = Math.min(1.5, 0.7 + state.teamSynergyMult * 0.3);
  }

  const damage = Math.max(1, Math.floor((rawDamage + variance) * typeMult * critMult * counterMult * synergyMult));

  return { damage, critical, evaded: false, penetrated };
}

export function attackUnit(state, attacker, defender) {
  if (!attacker || !defender || attacker.hp <= 0 || defender.hp <= 0) {
    return { ok: false, reason: '유효하지 않은 전투입니다' };
  }

  const atkRange = getAttackRange(state, attacker);
  const inRange = atkRange.some(t => t.x === defender.x && t.y === defender.y);
  if (!inRange) {
    return { ok: false, reason: '공격 범위 밖입니다' };
  }

  const defAdvantage = getFactionAdvantage(defender, attacker);
  const defenderCountersFirst = defAdvantage.speedAdvantage;

  let counterDamage = 0;
  let defenderDied = false;
  let attackerDied = false;
  let evaded = false;
  let penetrated = false;
  let counterEvaded = false;
  let relicHeal = 0;

  // Speed advantage: defender counters first
  if (defenderCountersFirst && isInRange(defender, attacker.x, attacker.y)) {
    const cResult = calcCombatResult(state, defender, attacker, true);
    if (cResult.evaded) {
      state.log.push(`${attacker.name} 회피! ${defender.name}의 선제 반격을 피했다`);
    } else {
      counterDamage = cResult.damage;
      attacker.hp -= counterDamage;
      if (attacker.hp <= 0) {
        attacker.hp = 0;
        attackerDied = true;
        state.log.push(`${defender.name}의 선제 반격! ${attacker.name}에게 ${counterDamage} 데미지 → 전사!`);
        attacker.acted = true;
        return { ok: true, damage: 0, critical: false, counterDamage, defenderDied: false, attackerDied: true, evaded: false, penetrated: false };
      }
      state.log.push(`${defender.name}의 선제 반격! ${attacker.name}에게 ${counterDamage} 데미지`);
    }
  }

  // Primary attack
  const atkResult = calcCombatResult(state, attacker, defender);
  evaded = atkResult.evaded;
  penetrated = atkResult.penetrated;
  let damage = 0;
  let critical = false;

  if (evaded) {
    state.log.push(`${defender.name} 회피! ${attacker.name}의 공격을 피했다`);
  } else {
    damage = atkResult.damage;
    critical = atkResult.critical;
    if (defender.invuln) {
      state.log.push(`${defender.name} 무적! 데미지 무효화`);
      damage = 0;
    } else if (defender.shield > 0) {
      const absorbed = Math.min(defender.shield, damage);
      defender.shield -= absorbed;
      damage -= absorbed;
      if (absorbed > 0) state.log.push(`  실드 흡수 ${absorbed}`);
    }
    defender.hp -= damage;
    if (defender.hp <= 0) {
      defender.hp = 0;
      defenderDied = true;
    }

    const tags = [];
    if (penetrated) tags.push('관통!');
    if (critical) tags.push('크리티컬!');
    if (defenderDied) tags.push('전사!');
    const tagStr = tags.length > 0 ? ` (${tags.join(' ')})` : '';
    state.log.push(`${attacker.name} → ${defender.name}: ${damage} 데미지${tagStr}`);

    // Relic: lifesteal
    if (attacker.relic?.condition === 'on_attack' && attacker.relic.effect.lifesteal) {
      let heal = Math.floor(damage * attacker.relic.effect.lifesteal);
      if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
      if (heal > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        relicHeal += heal;
        state.log.push(`  흡혈 +${heal} HP`);
      }
    }

    // Relic: kill heal
    if (defenderDied && attacker.relic?.condition === 'on_kill' && attacker.relic.effect.killHeal) {
      let heal = Math.floor(attacker.maxHp * attacker.relic.effect.killHeal);
      if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      relicHeal += heal;
      state.log.push(`  처치 회복 +${heal} HP`);
    }
  }

  // Counter-attack (normal, not speed-advantage)
  if (!defenderCountersFirst && !defenderDied && !evaded && isInRange(defender, attacker.x, attacker.y)) {
    const cResult = calcCombatResult(state, defender, attacker, true);
    counterEvaded = cResult.evaded;
    if (counterEvaded) {
      state.log.push(`${attacker.name} 회피! ${defender.name}의 반격을 피했다`);
    } else {
      counterDamage = cResult.damage;
      attacker.hp -= counterDamage;
      if (attacker.hp <= 0) {
        attacker.hp = 0;
        attackerDied = true;
      }
      state.log.push(`${defender.name} 반격! ${attacker.name}에게 ${counterDamage} 데미지${attackerDied ? ' → 전사!' : ''}`);
    }
  }

  attacker.acted = true;

  // UO stat growth
  if (!evaded && damage > 0) applyStatGrowth(attacker, 'attack');
  if (counterDamage > 0) { applyStatGrowth(attacker, 'take_damage'); applyStatGrowth(defender, 'attack'); }
  if (evaded) applyStatGrowth(defender, 'evade');
  if (critical) applyStatGrowth(attacker, 'critical');

  // XP awards
  const xpGains = [];
  if (!evaded && damage > 0) {
    const atkXP = gainXP(attacker, XP_TABLE.attack);
    if (atkXP) xpGains.push({ unit: attacker.uid, levelUps: atkXP });
  }
  if (defenderDied) {
    const killXP = gainXP(attacker, XP_TABLE.kill);
    if (killXP) xpGains.push({ unit: attacker.uid, levelUps: killXP });
  }
  if (counterDamage > 0) {
    const defXP = gainXP(defender, XP_TABLE.takeDamage);
    if (defXP) xpGains.push({ unit: defender.uid, levelUps: defXP });
  }

  // Loot drop on kill (guaranteed for legendary enemies)
  let loot = null;
  if (defenderDied) {
    loot = rollLoot();
    if (!loot && defender.rarity === 'legendary') loot = rollLoot();
  }

  return { ok: true, damage, critical, counterDamage, defenderDied, attackerDied, evaded, penetrated, xpGains, loot, relicHeal };
}

// ── Damage Preview (non-destructive estimate) ─────────────────────────

export function previewDamage(state, attacker, defender) {
  let atkPower = attacker.atk;
  let defPower = defender.def;

  if (attacker.relic?.condition === 'full_hp' && attacker.hp >= attacker.maxHp) {
    atkPower = Math.floor(atkPower * (attacker.relic.effect.atkMult || 1));
  }
  if (attacker.relic?.condition === 'low_hp' && attacker.hp <= attacker.maxHp * 0.25) {
    atkPower = Math.floor(atkPower * (attacker.relic.effect.atkMult || 1));
  }
  if (defender.relic?.condition === 'low_hp' && defender.hp <= defender.maxHp * 0.25) {
    defPower = Math.floor(defPower * (defender.relic.effect.defMult || 1));
  }
  if (state) {
    state.units.filter(u => u.team === defender.team && u.hp > 0 && u.uid !== defender.uid).forEach(ally => {
      if (ally.relic?.condition === 'field_aura') defPower += ally.relic.effect.allyDef || 0;
    });
  }

  const faction = getFactionAdvantage(attacker, defender);
  atkPower += faction.atkBonus;
  defPower += faction.defBonus;
  const flanking = getFlankingBonus(state, attacker, defender);
  atkPower += flanking;

  const pen = attacker.pen || 0;
  const effectiveDef = Math.max(0, defPower - pen);
  const rawDamage = atkPower - effectiveDef;
  let typeMult = 1.0;
  if (attacker.attackType === 'blood') typeMult = 1.1;

  const minDmg = Math.max(1, Math.floor(rawDamage * typeMult));
  const maxVariance = Math.max(1, Math.floor(atkPower * 0.15));
  const maxDmg = Math.max(1, Math.floor((rawDamage + maxVariance) * typeMult));
  const critDmg = Math.max(1, Math.floor((rawDamage + maxVariance) * typeMult * 1.5));

  return { minDmg, maxDmg, critDmg, crt: attacker.crt, eva: defender.eva, flanking, shield: defender.shield || 0, invuln: !!defender.invuln };
}

export function previewSkillDamage(unit) {
  if (!unit.senseSkill) return null;
  const sense = unit.senseSkill;
  const senseInfo = SENSE_TYPES[sense.baseType];
  if (!senseInfo) return null;

  const dmgTypes = ['직감', '혈압', '혈식', '혈기'];
  const healTypes = ['감응', '공감'];
  const buffTypes = ['예감', '투지', '혈맹'];
  const debuffTypes = ['혈각', '혈향', '혈유'];

  if (dmgTypes.includes(sense.baseType)) {
    return { type: 'damage', value: sense.power, range: sense.baseType === '혈식' ? '광역 2칸' : '2칸' };
  }
  if (healTypes.includes(sense.baseType)) {
    const healAmt = sense.baseType === '공감' ? Math.floor(sense.power * 0.7) : sense.power;
    return { type: 'heal', value: healAmt, range: sense.baseType === '공감' ? '광역 3칸' : '가장 가까운 아군' };
  }
  if (buffTypes.includes(sense.baseType)) {
    return { type: 'buff', value: Math.floor(sense.power * 0.5), range: sense.baseType === '투지' ? '자신' : '2칸 아군' };
  }
  if (debuffTypes.includes(sense.baseType)) {
    return { type: 'debuff', value: Math.floor(sense.power * 0.4), range: '3칸 적' };
  }
  return null;
}

// ── Sense Skills (촉/혈 Special Abilities) ──────────────────────────────

export function activateSense(state, unit, chosenTarget) {
  if (!unit || unit.hp <= 0) return { ok: false, reason: '유닛이 유효하지 않습니다' };
  if (!unit.senseSkill) return { ok: false, reason: '촉/혈 스킬이 없는 유닛입니다' };
  if (unit.senseSkill.cooldown > 0) return { ok: false, reason: `쿨다운 중 (${unit.senseSkill.cooldown}턴 남음)` };
  if (unit.acted) return { ok: false, reason: '이미 행동한 유닛입니다' };
  const mpCost = unit.senseSkill.mpCost || 0;
  if (unit.mp < mpCost) return { ok: false, reason: `MP 부족 (${unit.mp}/${mpCost})` };

  const sense = unit.senseSkill;
  const senseInfo = SENSE_TYPES[sense.baseType];
  if (!senseInfo) return { ok: false, reason: '알 수 없는 스킬 타입' };

  const result = {
    ok: true,
    skillName: sense.name,
    baseType: sense.baseType,
    effects: [],
  };

  const allyUnits = state.units.filter(u => u.team === unit.team && u.hp > 0 && u.uid !== unit.uid);
  const enemyUnits = state.units.filter(u => u.team !== unit.team && u.hp > 0);

  if (senseInfo.category === '촉') {
    // Human sense skills
    switch (sense.baseType) {
      case '예감': {
        // Buff DEF of all allies within range 2
        const buffAmount = Math.floor(sense.power * 0.5);
        allyUnits.forEach(ally => {
          const dist = Math.abs(ally.x - unit.x) + Math.abs(ally.y - unit.y);
          if (dist <= 2) {
            ally.def += buffAmount;
            result.effects.push(`${ally.name} DEF +${buffAmount}`);
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 아군 DEF 강화`);
        break;
      }
      case '직감': {
        const target = chosenTarget || enemyUnits.find(e => manhattanDist(e, unit) <= 2);
        if (target) {
          const dmg = sense.power + Math.floor(Math.random() * 3);
          target.hp -= dmg;
          if (target.hp <= 0) target.hp = 0;
          result.effects.push(`${target.name}에게 ${dmg} 데미지${target.hp <= 0 ? ' → 전사!' : ''}`);
          state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name}에게 ${dmg} 데미지!`);
        } else {
          result.effects.push('범위 내 적 없음');
          state.log.push(`${unit.name}의 「${sense.name}」 — 범위 내 적 없음`);
        }
        break;
      }
      case '감응': {
        const target = chosenTarget || allyUnits.filter(a => a.hp < a.maxHp)
          .sort((a, b) => manhattanDist(a, unit) - manhattanDist(b, unit))[0] || unit;
        let heal = sense.power + Math.floor(Math.random() * 4);
        if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
        target.hp = Math.min(target.maxHp, target.hp + heal);
        if (target.dots && target.dots.length > 0) {
          cleanseDOT(target);
          result.effects.push(`${target.name} 상태이상 해제`);
        }
        result.effects.push(`${target.name} HP +${heal} 회복`);
        state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name} HP +${heal} 회복`);
        break;
      }
      case '혈각': {
        // Debuff enemy ATK
        const debuffAmount = Math.floor(sense.power * 0.4);
        enemyUnits.forEach(enemy => {
          const dist = Math.abs(enemy.x - unit.x) + Math.abs(enemy.y - unit.y);
          if (dist <= 3) {
            enemy.atk = Math.max(1, enemy.atk - debuffAmount);
            result.effects.push(`${enemy.name} ATK -${debuffAmount}`);
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 적 ATK 약화`);
        break;
      }
      case '투지': {
        // Buff own ATK and DEF
        const atkBuff = Math.floor(sense.power * 0.6);
        const defBuff = Math.floor(sense.power * 0.3);
        unit.atk += atkBuff;
        unit.def += defBuff;
        result.effects.push(`자신 ATK +${atkBuff}, DEF +${defBuff}`);
        state.log.push(`${unit.name}의 「${sense.name}」 — ATK +${atkBuff}, DEF +${defBuff}`);
        break;
      }
      case '공감': {
        let healAmount = Math.floor(sense.power * 0.7);
        if (state.weather?.effects?.healReduction) healAmount = Math.max(1, Math.floor(healAmount * (1 - state.weather.effects.healReduction)));
        allyUnits.forEach(ally => {
          const dist = manhattanDist(ally, unit);
          if (dist <= 3 && ally.hp < ally.maxHp) {
            ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
            if (ally.dots && ally.dots.length > 0) {
              cleanseDOT(ally);
              result.effects.push(`${ally.name} HP +${healAmount} + 상태이상 해제`);
            } else {
              result.effects.push(`${ally.name} HP +${healAmount}`);
            }
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 광역 회복`);
        break;
      }
    }
  } else {
    // 혈 skills (vampire)
    switch (sense.baseType) {
      case '혈압': {
        const target = chosenTarget || enemyUnits
          .filter(e => manhattanDist(e, unit) <= 2)
          .sort((a, b) => manhattanDist(a, unit) - manhattanDist(b, unit))[0];
        if (target) {
          const dmg = sense.power + Math.floor(Math.random() * 4);
          target.hp -= dmg;
          if (target.hp <= 0) target.hp = 0;
          result.effects.push(`${target.name}에게 ${dmg} 데미지`);
          state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name}에게 ${dmg} 데미지!`);
        }
        break;
      }
      case '혈향': {
        const debuffDef = Math.floor(sense.power * 0.4);
        const poisonDmg = Math.floor(sense.power * 0.3);
        enemyUnits.forEach(enemy => {
          const dist = manhattanDist(enemy, unit);
          if (dist <= 3) {
            enemy.def = Math.max(0, enemy.def - debuffDef);
            applyDOT(enemy, 'poison', poisonDmg, 3);
            result.effects.push(`${enemy.name} DEF -${debuffDef} + 독 ${poisonDmg}/턴`);
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 적 방어력 약화 + 중독`);
        break;
      }
      case '혈맹': {
        // Buff all ally kartein units' ATK
        const buffAtk = Math.floor(sense.power * 0.5);
        allyUnits.forEach(ally => {
          if (ally.faction === FACTIONS.KARTEIN) {
            ally.atk += buffAtk;
            result.effects.push(`${ally.name} ATK +${buffAtk}`);
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 카르테인 동맹 강화`);
        break;
      }
      case '혈식': {
        // AOE: damage all enemies in range 2
        const aoeDmg = Math.floor(sense.power * 0.8);
        enemyUnits.forEach(enemy => {
          const dist = Math.abs(enemy.x - unit.x) + Math.abs(enemy.y - unit.y);
          if (dist <= 2) {
            enemy.hp -= aoeDmg;
            if (enemy.hp <= 0) enemy.hp = 0;
            result.effects.push(`${enemy.name}에게 ${aoeDmg} 데미지${enemy.hp <= 0 ? ' → 전사!' : ''}`);
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 광역 공격!`);
        break;
      }
      case '혈기': {
        const target = chosenTarget || enemyUnits.sort((a, b) => a.hp - b.hp)[0];
        if (target) {
          const dmg = sense.power + Math.floor(Math.random() * 3);
          target.hp -= dmg;
          if (target.hp <= 0) target.hp = 0;
          applyDOT(target, 'bleed', Math.floor(sense.power * 0.25), 2);
          let heal = Math.floor(dmg * 0.5);
          if (state.weather?.effects?.healReduction) heal = Math.max(1, Math.floor(heal * (1 - state.weather.effects.healReduction)));
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          const bleedDmg = Math.floor(sense.power * 0.25);
          result.effects.push(`${target.name}에게 ${dmg} 데미지 + 출혈 ${bleedDmg}/턴, 흡혈 +${heal}`);
          state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name}에게 ${dmg} 데미지, 출혈, 흡혈 +${heal}`);
        }
        break;
      }
      case '혈유': {
        const target = chosenTarget || enemyUnits.sort((a, b) => b.atk - a.atk)[0];
        if (target) {
          const atkReduce = Math.floor(sense.power * 0.5);
          const movReduce = 1;
          target.atk = Math.max(1, target.atk - atkReduce);
          target.mov = Math.max(1, target.mov - movReduce);
          result.effects.push(`${target.name} ATK -${atkReduce}, MOV -${movReduce} (매혹)`);
          state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name} 매혹! ATK -${atkReduce}, MOV -${movReduce}`);
        }
        break;
      }
    }
  }

  // Deduct MP and set cooldown
  unit.mp -= mpCost;
  sense.cooldown = sense.maxCooldown;
  unit.acted = true;

  return result;
}

// ── Cooldown Tick ────────────────────────────────────────────────────────

export function tickCooldowns(state) {
  state.units.forEach(u => {
    if (u.hp > 0 && u.senseSkill && u.senseSkill.cooldown > 0) {
      u.senseSkill.cooldown--;
    }
  });
}

// ── Victory Check ───────────────────────────────────────────────────────

export function checkVictory(state) {
  const playerAlive = state.units.filter(u => u.team === 'player' && u.hp > 0);
  const enemyAlive = state.units.filter(u => u.team === 'enemy' && u.hp > 0);

  // Lose condition: all player units defeated
  if (playerAlive.length === 0) {
    state.result = 'lose';
    state.log.push('패배... 모든 아군이 전사했습니다.');
    return 'lose';
  }

  // Win conditions based on stage type
  if (state.victoryCondition === 'defeat_all') {
    if (enemyAlive.length === 0) {
      state.result = 'win';
      state.log.push('승리! 모든 적을 제압했습니다!');
      return 'win';
    }
  } else if (state.victoryCondition === 'survive') {
    // Survive for N turns (check at end of turn)
    const surviveTurns = state.stage.surviveTurns || 5;
    if (state.turnNumber > surviveTurns && playerAlive.length > 0) {
      state.result = 'win';
      state.log.push(`승리! ${surviveTurns}턴 생존 성공!`);
      return 'win';
    }
  }

  return null;
}

// ── Enemy AI ────────────────────────────────────────────────────────────

function manhattanDist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 🔵 제갈량: 인접 아군 수 = 협공 보너스
export function getFlankingBonus(state, attacker, defender) {
  if (!state) return 0;
  const allies = state.units.filter(u =>
    u.team === attacker.team && u.hp > 0 && u.uid !== attacker.uid &&
    manhattanDist(u, defender) <= 1
  );
  return allies.length * 2;
}

// 🔴 사마의: 적 타겟 우선순위 — 힐러 > 약체 > 원딜 > 가까운 적
function scoreTarget(enemy, target) {
  let score = 0;
  const healRoles = ['support', 'battle_support'];
  const squishyRoles = ['ranged_dps', 'evasive_dps'];
  if (healRoles.includes(target.role)) score += 50;
  if (squishyRoles.includes(target.role)) score += 20;
  const hpPct = target.hp / target.maxHp;
  if (hpPct < 0.3) score += 40;
  else if (hpPct < 0.6) score += 15;
  const canKill = target.hp <= enemy.atk - target.def + 3;
  if (canKill) score += 60;
  score -= manhattanDist(enemy, target) * 3;
  return score;
}

// 🔴 사마의: 이동 시 방어 지형 선호
function scoreMoveTile(state, tile, target) {
  let score = 0;
  score -= manhattanDist(tile, target) * 10;
  const terrain = getTerrainEffect(state.map, tile.x, tile.y);
  score += (terrain.defBonus || 0) * 5;
  score += (terrain.evaBonus || 0) * 30;
  score += (terrain.atkBonus || 0) * 3;
  return score;
}

export function runEnemyPhase(state) {
  if (state.phase !== 'enemy_phase') return [];

  const actions = [];
  const enemies = state.units.filter(u => u.team === 'enemy' && u.hp > 0);
  const players = state.units.filter(u => u.team === 'player' && u.hp > 0);

  if (players.length === 0) return actions;

  // 🔴 사마의: 보스(레전더리)는 마지막에 행동 (부하가 먼저 길을 닦는다)
  enemies.sort((a, b) => {
    const aIsBoss = a.rarity === 'legendary' ? 1 : 0;
    const bIsBoss = b.rarity === 'legendary' ? 1 : 0;
    return aIsBoss - bIsBoss;
  });

  for (const enemy of enemies) {
    if (enemy.acted) continue;

    if (isStunned(enemy)) {
      enemy.acted = true;
      state.log.push(`💫 ${enemy.name}은 기절 상태! 행동 불가`);
      actions.push({ type: 'stunned', unit: enemy.uid });
      continue;
    }

    // 🔴 사마의: 전략적 타겟 선정 (힐러 우선 > 처치 가능 > 약체 > 가까운 적)
    let priorityTarget = null;
    let bestScore = -Infinity;
    for (const p of players) {
      if (p.hp <= 0) continue;
      const score = scoreTarget(enemy, p);
      if (score > bestScore) {
        bestScore = score;
        priorityTarget = p;
      }
    }

    if (!priorityTarget) continue;

    // 🔴 사마의: 보스 무적 페이즈 — HP 50% 이하 시 1턴 무적 (1회)
    if (enemy.rarity === 'legendary' && !enemy._phaseShield && enemy.hp <= enemy.maxHp * 0.5) {
      enemy._phaseShield = true;
      enemy.invuln = true;
      enemy.buffs.push({ stat: '_invuln', val: 0, turns: 1 });
      state.log.push(`⭐ ${enemy.name}의 위상 전환! 1턴간 무적!`);
      actions.push({ type: 'phase_shift', unit: enemy.uid });
    }

    // 🔴 사마의: 보스 분노 — HP 30% 이하 시 ATK 폭증 (1회)
    if (enemy.rarity === 'legendary' && !enemy._enraged && enemy.hp <= enemy.maxHp * 0.3) {
      enemy._enraged = true;
      const rage = Math.floor(enemy.atk * 0.4);
      enemy.atk += rage;
      enemy.buffs.push({ stat: 'atk', val: rage, turns: 99 });
      state.log.push(`🔥 ${enemy.name}의 분노! ATK +${rage}!`);
      actions.push({ type: 'enrage', unit: enemy.uid, atkBoost: rage });
    }

    // 🔴 사마의: 궁극기 AI (보스 우선)
    if (enemy.rarity === 'legendary' && enemy.ultimates) {
      const usableUlt = enemy.ultimates.findIndex(ult =>
        enemy.level >= ult.unlockLevel && ult.currentCooldown === 0 && enemy.mp >= ult.mpCost
      );
      if (usableUlt >= 0) {
        const ultResult = executeUltimate(state, enemy, usableUlt);
        if (ultResult.ok) {
          actions.push({ type: 'ultimate', unit: enemy.uid, name: ultResult.name, effects: ultResult.effects });
          const vc = checkVictory(state);
          if (vc) return actions;
          continue;
        }
      }
    }

    // 🔴 사마의: 서포터 적 — 아군 HP 낮으면 회복 스킬 우선
    const isHealerType = enemy.senseSkill && ['감응', '공감'].includes(enemy.senseSkill.baseType);
    if (isHealerType && enemy.senseSkill.cooldown === 0 &&
        enemy.mp >= (enemy.senseSkill.mpCost || 0)) {
      const woundedAlly = enemies.find(a => a.uid !== enemy.uid && a.hp > 0 && a.hp < a.maxHp * 0.6 &&
        manhattanDist(a, enemy) <= 4);
      if (woundedAlly) {
        const senseResult = activateSense(state, enemy);
        if (senseResult.ok) {
          actions.push({ type: 'sense', unit: enemy.uid, skillName: enemy.senseSkill.name, effects: senseResult.effects });
          if (enemy.rarity !== 'legendary') continue;
        }
      }
    }

    // 🔴 사마의: 스킬 사용 AI (MP 체크 포함)
    if (enemy.senseSkill && enemy.senseSkill.cooldown === 0 &&
        enemy.mp >= (enemy.senseSkill.mpCost || 0) &&
        manhattanDist(enemy, priorityTarget) <= 4) {
      const senseResult = activateSense(state, enemy);
      if (senseResult.ok) {
        actions.push({ type: 'sense', unit: enemy.uid, skillName: enemy.senseSkill.name, effects: senseResult.effects });
        const vc = checkVictory(state);
        if (vc) return actions;
        // 🔴 보스는 스킬 쓰고도 공격 가능 (2회 행동)
        if (enemy.rarity !== 'legendary') continue;
      }
    }

    // Try to attack first if already in range
    const atkRange = getAttackRange(state, enemy);
    const targetsInRange = [];
    for (const t of atkRange) {
      const target = getUnitAt(state, t.x, t.y);
      if (target && target.team === 'player' && target.hp > 0) {
        targetsInRange.push(target);
      }
    }

    if (targetsInRange.length > 0) {
      // 🔴 사마의: 범위 내 최적 타겟 선택 (우선순위 점수 기반)
      targetsInRange.sort((a, b) => scoreTarget(enemy, b) - scoreTarget(enemy, a));
      const bestTarget = targetsInRange[0];
      const atkResult = attackUnit(state, enemy, bestTarget);
      if (atkResult.ok) {
        actions.push({ type: 'attack', unit: enemy.uid, target: bestTarget.uid, ...atkResult });
        const vc = checkVictory(state);
        if (vc) return actions;
        continue;
      }
    }

    // 🔴 사마의: 치명상 적 후퇴 AI (HP 25% 이하, 비보스 → 회복 지형으로 도주)
    const isRetreating = enemy.rarity !== 'legendary' && enemy.hp <= enemy.maxHp * 0.25;

    // 🔴 사마의: 전략적 이동 — 타겟에 접근하되 방어 지형 선호
    const movRange = getMovementRange(state, enemy);
    if (movRange.length === 0) {
      enemy.acted = true;
      continue;
    }

    let bestTile = null;
    let bestTileScore = -Infinity;
    for (const tile of movRange) {
      let score;
      if (isRetreating) {
        const terrain = getTerrainEffect(state.map, tile.x, tile.y);
        score = (terrain.healPerTurn || 0) * 50 + (terrain.defBonus || 0) * 10 + (terrain.evaBonus || 0) * 40;
        const nearestPlayer = players.reduce((best, p) => {
          const d = manhattanDist(tile, p);
          return d > (best || 0) ? d : best;
        }, 0);
        score += nearestPlayer * 5;
      } else {
        score = scoreMoveTile(state, tile, priorityTarget);
      }
      if (score > bestTileScore) {
        bestTileScore = score;
        bestTile = tile;
      }
    }

    if (bestTile) {
      const moveResult = moveUnit(state, enemy, bestTile.x, bestTile.y);
      if (moveResult.ok) {
        actions.push({ type: 'move', unit: enemy.uid, x: bestTile.x, y: bestTile.y });
      }
    }

    // Try to attack after moving
    const atkRangeAfterMove = getAttackRange(state, enemy);
    const targetsAfterMove = [];
    for (const t of atkRangeAfterMove) {
      const target = getUnitAt(state, t.x, t.y);
      if (target && target.team === 'player' && target.hp > 0) {
        targetsAfterMove.push(target);
      }
    }

    if (targetsAfterMove.length > 0) {
      targetsAfterMove.sort((a, b) => scoreTarget(enemy, b) - scoreTarget(enemy, a));
      const atkResult = attackUnit(state, enemy, targetsAfterMove[0]);
      if (atkResult.ok) {
        actions.push({ type: 'attack', unit: enemy.uid, target: targetsAfterMove[0].uid, ...atkResult });
        const vc = checkVictory(state);
        if (vc) return actions;
      }
    } else {
      enemy.acted = true;
    }
  }

  return actions;
}

// 🔵 제갈량: 전투 중 아이템 사용
export function useItem(state, unit, item) {
  if (!unit || unit.hp <= 0 || unit.acted) return { ok: false, reason: '행동 불가' };
  const effects = [];
  if (item.effect.heal) {
    const heal = Math.min(item.effect.heal, unit.maxHp - unit.hp);
    unit.hp += heal;
    effects.push(`HP +${heal} 회복`);
  }
  if (item.effect.mp) {
    const mp = Math.min(item.effect.mp, unit.maxMp - unit.mp);
    unit.mp += mp;
    effects.push(`MP +${mp} 회복`);
  }
  if (item.effect.atkBuff) {
    unit.atk += item.effect.atkBuff;
    unit.buffs.push({ stat: 'atk', val: item.effect.atkBuff, turns: 3 });
    effects.push(`ATK +${item.effect.atkBuff} (3턴)`);
  }
  if (item.effect.defBuff) {
    unit.def += item.effect.defBuff;
    unit.buffs.push({ stat: 'def', val: item.effect.defBuff, turns: 3 });
    effects.push(`DEF +${item.effect.defBuff} (3턴)`);
  }
  if (item.effect.crtBuff) {
    unit.crt += item.effect.crtBuff;
    unit.buffs.push({ stat: 'crt', val: item.effect.crtBuff, turns: 3 });
    effects.push(`CRT +${Math.round(item.effect.crtBuff * 100)}% (3턴)`);
  }
  if (item.effect.xp) {
    const xpResult = gainXP(unit, item.effect.xp);
    effects.push(`XP +${item.effect.xp}`);
  }
  unit.acted = true;
  return { ok: true, name: item.name, effects };
}

// ── Utility: Check if player phase should auto-end ──────────────────────

export function allPlayerUnitsActed(state) {
  const playerUnits = state.units.filter(u => u.team === 'player' && u.hp > 0);
  return playerUnits.length > 0 && playerUnits.every(u => u.acted);
}

// ── Utility: Get valid targets for attack ───────────────────────────────

export function getAttackTargets(state, unit) {
  if (!unit || unit.hp <= 0) return [];
  const atkRange = getAttackRange(state, unit);
  return atkRange
    .map(t => getUnitAt(state, t.x, t.y))
    .filter(target => target && target.team !== unit.team && target.hp > 0);
}

export function getKillForecast(state, attacker, defender) {
  const preview = previewDamage(state, attacker, defender);
  const canKill = preview.maxDmg >= defender.hp;
  const guaranteedKill = preview.minDmg >= defender.hp;
  const canCounter = isInRange(defender, attacker.x, attacker.y) && defender.hp > 0;
  let counterDmg = 0;
  if (canCounter) {
    const raw = Math.max(1, Math.floor(defender.atk * 0.7) - attacker.def);
    counterDmg = raw + Math.floor(defender.atk * 0.1);
  }
  const counterKillsYou = canCounter && counterDmg >= attacker.hp;
  return { canKill, guaranteedKill, canCounter, counterDmg, counterKillsYou };
}

// ── Utility: Get unit by UID ────────────────────────────────────────────

export function getUnitByUid(state, uid) {
  return state.units.find(u => u.uid === uid) || null;
}

// ── Utility: Get living units by team ───────────────────────────────────

export function getLivingUnits(state, team) {
  return state.units.filter(u => u.team === team && u.hp > 0);
}

// ── Utility: Reset unit actions for new phase ───────────────────────────

export function resetActedFlags(state, team) {
  state.units.forEach(u => {
    if (u.team === team) u.acted = false;
  });
}

// 🔴 사마의: 적 증원 시스템
export function spawnReinforcements(state) {
  const stage = state.stage;
  if (!stage.reinforcements) return null;
  const wave = stage.reinforcements.find(r => r.turn === state.turnNumber && !r.spawned);
  if (!wave) return null;

  const spawned = [];
  wave.units.forEach((eu, i) => {
    const charData = CHARACTERS.find(c => c.id === eu.charId);
    if (!charData) return;
    if (getUnitAt(state, eu.x, eu.y)) return;
    const unit = cardToUnit(charData, eu.x, eu.y);
    unit.team = 'enemy';
    unit.uid = `reinforce-${charData.id}-${state.turnNumber}-${i}`;
    const eLv = stage.enemyLevel || 1;
    for (let lv = 1; lv < eLv; lv++) {
      unit.level++;
      unit.maxHp += Math.floor(unit.maxHp * 0.05);
      unit.hp = unit.maxHp;
      unit.atk += 2;
      unit.def += 1;
    }
    autoEquip(unit);
    unit.acted = true;
    state.units.push(unit);
    spawned.push(unit);
  });
  wave.spawned = true;
  if (spawned.length > 0) {
    state.log.push(wave.message || '🔴 적 증원 출현!');
  }
  return spawned.length > 0 ? { units: spawned, message: wave.message } : null;
}

// 🔵 제갈량: 적 위험 범위 계산
export function getDangerZone(state) {
  const enemies = state.units.filter(u => u.team === 'enemy' && u.hp > 0);
  const dangerTiles = new Set();
  for (const enemy of enemies) {
    const movRange = getMovementRange(state, enemy);
    const positions = [{ x: enemy.x, y: enemy.y }, ...movRange];
    for (const pos of positions) {
      const tmpUnit = { ...enemy, x: pos.x, y: pos.y };
      if (tmpUnit.rng === 1) {
        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        for (const { dx, dy } of dirs) {
          const nx = pos.x + dx, ny = pos.y + dy;
          if (nx >= 0 && ny >= 0 && nx < state.map.cols && ny < state.map.rows) {
            dangerTiles.add(`${nx},${ny}`);
          }
        }
      } else {
        for (let dy = -tmpUnit.rng; dy <= tmpUnit.rng; dy++) {
          for (let dx = -tmpUnit.rng; dx <= tmpUnit.rng; dx++) {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < 1 || dist > tmpUnit.rng) continue;
            const nx = pos.x + dx, ny = pos.y + dy;
            if (nx >= 0 && ny >= 0 && nx < state.map.cols && ny < state.map.rows) {
              dangerTiles.add(`${nx},${ny}`);
            }
          }
        }
      }
    }
  }
  return [...dangerTiles].map(key => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}
