// ═══════════════════════════════════════════════════════════════════════════
// engine.js — 헌혈의 집 (Red Ledger) Grid-Based Tactical SRPG Engine
// Pure game logic, no DOM/UI code
// ═══════════════════════════════════════════════════════════════════════════

import { CHARACTERS, SENSE_TYPES } from './cards.js';

// ── Tile Types ──────────────────────────────────────────────────────────

export const TILE_TYPES = {
  floor:         { walkable: true,  label: '바닥',       icon: '·' },
  wall:          { walkable: false, label: '벽',         icon: '█' },
  blood_storage: { walkable: true,  label: '혈액 보관소', icon: '🩸' },
  desk:          { walkable: true,  label: '데스크',      icon: '🪑' },
  entrance:      { walkable: true,  label: '출입구',      icon: '🚪' },
};

// ── Faction Constants ───────────────────────────────────────────────────

export const FACTIONS = { CENTER: 'center', KARTEIN: 'kartein', NEUTRAL: 'neutral' };

// ── Rarity → Stat Bonus Tables ──────────────────────────────────────────

const RARITY_HP_BONUS   = { common: 10, uncommon: 20, rare: 35, legendary: 50 };
const RARITY_ATK_BONUS  = { common: 2,  uncommon: 4,  rare: 6,  legendary: 10 };
const RARITY_DEF_BONUS  = { common: 1,  uncommon: 2,  rare: 3,  legendary: 5 };
const RARITY_MOV        = { common: 3,  uncommon: 3,  rare: 2,  legendary: 2 };

// ── Role Modifiers ─────────────────────────────────────────────────────

export const ROLE_MODIFIERS = {
  tank:           { hp: 1.5,  atk: 0.7, def: 1.5, mov: 2, rng: 1 },
  melee_dps:      { hp: 0.9,  atk: 1.4, def: 0.8, mov: 3, rng: 1 },
  ranged_dps:     { hp: 0.8,  atk: 1.3, def: 0.7, mov: 2, rng: 2 },
  support:        { hp: 1.0,  atk: 0.6, def: 1.0, mov: 3, rng: 2 },
  bruiser:        { hp: 1.3,  atk: 1.1, def: 1.2, mov: 2, rng: 1 },
  battle_support: { hp: 1.0,  atk: 1.0, def: 0.9, mov: 3, rng: 2 },
  evasive_dps:    { hp: 0.85, atk: 1.2, def: 1.1, mov: 3, rng: 1 },
  breaker:        { hp: 1.3,  atk: 1.4, def: 1.2, mov: 3, rng: null },
};

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

    hp,
    maxHp: hp,
    atk,
    def,
    mov,
    rng,
    crt: 0.10,
    eva: 0,
    pen: 0,
    attackType: getAttackType(charData, role),
    equipment: { weapon: null, armor: null, accessory: null },
    relic: null,

    senseSkill: charData.sense ? {
      name: charData.sense.name,
      baseType: charData.sense.baseType,
      power: charData.sense.power,
      flavor: charData.sense.flavor,
      effects: charData.sense.effects,
      cooldown: 0,
      maxCooldown: 3,
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

// Legend: F=floor, W=wall, B=blood_storage, D=desk, E=entrance
const F = 'floor', W = 'wall', B = 'blood_storage', D = 'desk', E = 'entrance';

export const STAGES = [
  {
    id: 'stage-1',
    name: '센터 로비',
    description: '첫 번째 임무. 로비에 침입한 카르테인 척후병을 제거하라.',
    storyIntro: '야간 근무가 시작된 혈연센터 로비. 형광등이 깜빡이더니, 낯선 인물 둘이 출입구에서 나타났다. 이 시간에 방문객이라니 — 직감이 경고한다.',
    storyOutro: '침입자를 물리쳤다. 하지만 이것은 시작에 불과하다. 쓰러진 자의 주머니에서 카르테인 가문의 인장이 발견되었다.',
    mapData: [
      [E, F, F, F, F, F, D, D],
      [F, F, F, F, F, F, F, F],
      [F, F, D, F, F, D, F, F],
      [F, F, F, F, F, F, F, F],
      [F, F, F, F, F, F, F, F],
      [D, D, F, F, F, F, F, E],
    ],
    playerSpawns: [
      { x: 0, y: 4 },
      { x: 1, y: 5 },
      { x: 0, y: 5 },
    ],
    enemyUnits: [
      { charId: 'elena-morgan', x: 7, y: 0 },
      { charId: 'kaspar-wren',  x: 6, y: 1 },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-2',
    name: '야간 창고',
    description: '혈액 보관소에 카르테인 요원들이 잠입했다. 혈액을 지켜라.',
    storyIntro: '자정. 혈액 보관소의 경보가 울린다. 보안 카메라에 4개의 그림자가 비친다. 놈들이 혈액 창고를 노리고 있다.',
    storyOutro: '창고를 지켜냈다. 하지만 도주한 요원이 가져간 정보가 걱정된다. 카르테인의 본격적인 움직임이 시작된 것 같다.',
    mapData: [
      [W, W, E, F, F, E, W, W],
      [W, F, F, F, F, F, F, W],
      [F, F, B, B, B, B, F, F],
      [F, F, B, B, B, B, F, F],
      [W, F, F, F, F, F, F, W],
      [W, W, F, F, F, F, W, W],
    ],
    playerSpawns: [
      { x: 2, y: 0 },
      { x: 5, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ],
    enemyUnits: [
      { charId: 'sergei-volkov',   x: 1, y: 4 },
      { charId: 'otto-brandt',     x: 6, y: 4 },
      { charId: 'elena-morgan',    x: 3, y: 5 },
      { charId: 'lucien-deveraux', x: 4, y: 5 },
    ],
    victoryCondition: 'defeat_all',
  },
  {
    id: 'stage-3',
    name: '지하 복도',
    description: '카르테인의 비밀 지하 통로. 강력한 적들이 기다리고 있다.',
    storyIntro: 'B2 복도 아래, 설계도에 없는 통로가 발견되었다. 배관에서 미지근한 온기가 흐른다. 이 아래에 뭔가 있다 — 가봐야 한다.',
    storyOutro: '지하 복도를 제압했다. 통로 끝에서 발견된 것은... 카르테인 가문이 수십 년간 운영해온 비밀 혈액 저장시설이었다. 진실이 밝혀지기 시작한다.',
    mapData: [
      [W, F, F, W, W, F, F, W],
      [W, F, F, F, W, F, F, W],
      [F, F, W, F, F, W, F, F],
      [F, F, W, F, F, W, F, F],
      [W, F, F, F, W, F, F, W],
      [W, F, F, W, W, F, F, W],
    ],
    playerSpawns: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ],
    enemyUnits: [
      { charId: 'viktor-hessen',  x: 1, y: 5 },
      { charId: 'aldric-thorne',  x: 6, y: 5 },
      { charId: 'marcus-vale',    x: 1, y: 3 },
      { charId: 'nigel-crowe',    x: 6, y: 3 },
      { charId: 'nadia-petrova',  x: 3, y: 4 },
      { charId: 'madeleine-voss', x: 4, y: 4 },
    ],
    victoryCondition: 'defeat_all',
  },
];

// ── Battle State Factory ────────────────────────────────────────────────

export function createBattleState(stageId, playerCharIds) {
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
    units.push(unit);
  });

  // Place enemy units
  stage.enemyUnits.forEach((eu, i) => {
    const charData = CHARACTERS.find(c => c.id === eu.charId);
    if (!charData) return;
    const unit = cardToUnit(charData, eu.x, eu.y);
    unit.team = 'enemy';
    unit.uid = `enemy-${charData.id}-${i}`;
    units.push(unit);
  });

  // Auto-equip all units with default loadout
  units.forEach(u => autoEquip(u));

  return {
    stageId,
    stage,
    map,
    units,
    phase: 'player_phase',
    turnNumber: 1,
    selectedUnit: null,
    log: [],
    victoryCondition: stage.victoryCondition,
    result: null, // 'win' | 'lose' | null
  };
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
  // Mark all enemy units as not-acted
  state.units.forEach(u => {
    if (u.team === 'enemy') u.acted = false;
  });
  // Tick cooldowns at end of full round
  tickCooldowns(state);
  state.turnNumber++;
  state.phase = 'player_phase';
  state.log.push(`── 턴 ${state.turnNumber}: 플레이어 페이즈 ──`);
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
      if (visited.has(key)) continue;
      if (!isTileWalkable(map, nx, ny)) continue;

      // Blocked by other units (can't walk through)
      const occupant = getUnitAt(state, nx, ny);
      if (occupant && occupant.uid !== unit.uid) continue;

      visited.set(key, dist + 1);
      queue.push({ x: nx, y: ny, dist: dist + 1 });
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

  // Evasion check
  if (Math.random() < (defender.eva || 0)) {
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

  // Counter reduction
  const counterMult = isCounter ? 0.7 : 1.0;

  const damage = Math.max(1, Math.floor((rawDamage + variance) * typeMult * critMult * counterMult));

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
      const heal = Math.floor(damage * attacker.relic.effect.lifesteal);
      if (heal > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        state.log.push(`  흡혈 +${heal} HP`);
      }
    }

    // Relic: kill heal
    if (defenderDied && attacker.relic?.condition === 'on_kill' && attacker.relic.effect.killHeal) {
      const heal = Math.floor(attacker.maxHp * attacker.relic.effect.killHeal);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
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

  return { ok: true, damage, critical, counterDamage, defenderDied, attackerDied, evaded, penetrated };
}

// ── Sense Skills (촉/혈 Special Abilities) ──────────────────────────────

export function activateSense(state, unit) {
  if (!unit || unit.hp <= 0) return { ok: false, reason: '유닛이 유효하지 않습니다' };
  if (!unit.senseSkill) return { ok: false, reason: '촉/혈 스킬이 없는 유닛입니다' };
  if (unit.senseSkill.cooldown > 0) return { ok: false, reason: `쿨다운 중 (${unit.senseSkill.cooldown}턴 남음)` };
  if (unit.acted) return { ok: false, reason: '이미 행동한 유닛입니다' };

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
        // Direct damage to one adjacent enemy
        const target = enemyUnits.find(e => {
          const dist = Math.abs(e.x - unit.x) + Math.abs(e.y - unit.y);
          return dist <= 2;
        });
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
        // Heal nearest ally
        const injured = allyUnits
          .filter(a => a.hp < a.maxHp)
          .sort((a, b) => {
            const da = Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y);
            const db = Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y);
            return da - db;
          });
        if (injured.length > 0) {
          const target = injured[0];
          const heal = sense.power + Math.floor(Math.random() * 4);
          target.hp = Math.min(target.maxHp, target.hp + heal);
          result.effects.push(`${target.name} HP +${heal} 회복`);
          state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name} HP +${heal} 회복`);
        } else {
          // Heal self if no injured allies
          const selfHeal = Math.floor(sense.power * 0.5);
          unit.hp = Math.min(unit.maxHp, unit.hp + selfHeal);
          result.effects.push(`자가 회복 HP +${selfHeal}`);
          state.log.push(`${unit.name}의 「${sense.name}」 — 자가 회복 HP +${selfHeal}`);
        }
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
        // Heal all allies in range 3
        const healAmount = Math.floor(sense.power * 0.7);
        allyUnits.forEach(ally => {
          const dist = Math.abs(ally.x - unit.x) + Math.abs(ally.y - unit.y);
          if (dist <= 3 && ally.hp < ally.maxHp) {
            ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
            result.effects.push(`${ally.name} HP +${healAmount}`);
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
        // Direct damage to one enemy in range 2
        const target = enemyUnits
          .sort((a, b) => {
            const da = Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y);
            const db = Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y);
            return da - db;
          })[0];
        if (target) {
          const dist = Math.abs(target.x - unit.x) + Math.abs(target.y - unit.y);
          if (dist <= 2) {
            const dmg = sense.power + Math.floor(Math.random() * 4);
            target.hp -= dmg;
            if (target.hp <= 0) target.hp = 0;
            result.effects.push(`${target.name}에게 ${dmg} 데미지`);
            state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name}에게 ${dmg} 데미지!`);
          }
        }
        break;
      }
      case '혈향': {
        // Debuff: reduce all enemies' DEF in range
        const debuffDef = Math.floor(sense.power * 0.4);
        enemyUnits.forEach(enemy => {
          const dist = Math.abs(enemy.x - unit.x) + Math.abs(enemy.y - unit.y);
          if (dist <= 3) {
            enemy.def = Math.max(0, enemy.def - debuffDef);
            result.effects.push(`${enemy.name} DEF -${debuffDef}`);
          }
        });
        state.log.push(`${unit.name}의 「${sense.name}」 발동 — 적 방어력 약화`);
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
        // Lifesteal: damage one enemy, heal self
        const target = enemyUnits
          .sort((a, b) => a.hp - b.hp)[0]; // target lowest HP
        if (target) {
          const dmg = sense.power + Math.floor(Math.random() * 3);
          target.hp -= dmg;
          if (target.hp <= 0) target.hp = 0;
          const heal = Math.floor(dmg * 0.5);
          unit.hp = Math.min(unit.maxHp, unit.hp + heal);
          result.effects.push(`${target.name}에게 ${dmg} 데미지, 자신 HP +${heal} 흡혈`);
          state.log.push(`${unit.name}의 「${sense.name}」 — ${target.name}에게 ${dmg} 데미지, 흡혈 +${heal}`);
        }
        break;
      }
      case '혈유': {
        // Charm/debuff: reduce target MOV and ATK
        const target = enemyUnits
          .sort((a, b) => b.atk - a.atk)[0]; // target highest ATK
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

  // Set cooldown
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

export function runEnemyPhase(state) {
  if (state.phase !== 'enemy_phase') return [];

  const actions = [];
  const enemies = state.units.filter(u => u.team === 'enemy' && u.hp > 0);
  const players = state.units.filter(u => u.team === 'player' && u.hp > 0);

  if (players.length === 0) return actions;

  for (const enemy of enemies) {
    if (enemy.acted) continue;

    // Find closest player unit
    let closestPlayer = null;
    let closestDist = Infinity;
    for (const p of players) {
      if (p.hp <= 0) continue;
      const dist = manhattanDist(enemy, p);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = p;
      }
    }

    if (!closestPlayer) continue;

    // Try to use sense skill if available and in range
    if (enemy.senseSkill && enemy.senseSkill.cooldown === 0 && closestDist <= 3) {
      const senseResult = activateSense(state, enemy);
      if (senseResult.ok) {
        actions.push({ type: 'sense', unit: enemy.uid, skillName: enemy.senseSkill.name, effects: senseResult.effects });
        // Check if victory changed after sense
        const vc = checkVictory(state);
        if (vc) return actions;
        continue; // sense skill uses the action
      }
    }

    // Try to attack first if already in range
    const atkRange = getAttackRange(state, enemy);
    const canAttack = atkRange.some(t => {
      const target = getUnitAt(state, t.x, t.y);
      return target && target.team === 'player' && target.hp > 0;
    });

    if (canAttack) {
      // Find best target (lowest HP)
      let bestTarget = null;
      let bestHp = Infinity;
      for (const t of atkRange) {
        const target = getUnitAt(state, t.x, t.y);
        if (target && target.team === 'player' && target.hp > 0 && target.hp < bestHp) {
          bestHp = target.hp;
          bestTarget = target;
        }
      }
      if (bestTarget) {
        const atkResult = attackUnit(state, enemy, bestTarget);
        if (atkResult.ok) {
          actions.push({ type: 'attack', unit: enemy.uid, target: bestTarget.uid, ...atkResult });
          const vc = checkVictory(state);
          if (vc) return actions;
          continue;
        }
      }
    }

    // Move toward closest player
    const movRange = getMovementRange(state, enemy);
    if (movRange.length === 0) {
      enemy.acted = true;
      continue;
    }

    // Pick the tile that gets closest to the target
    let bestTile = null;
    let bestMoveDist = Infinity;
    for (const tile of movRange) {
      const dist = manhattanDist(tile, closestPlayer);
      if (dist < bestMoveDist) {
        bestMoveDist = dist;
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
    let bestTargetAfterMove = null;
    let bestHpAfterMove = Infinity;
    for (const t of atkRangeAfterMove) {
      const target = getUnitAt(state, t.x, t.y);
      if (target && target.team === 'player' && target.hp > 0 && target.hp < bestHpAfterMove) {
        bestHpAfterMove = target.hp;
        bestTargetAfterMove = target;
      }
    }

    if (bestTargetAfterMove) {
      const atkResult = attackUnit(state, enemy, bestTargetAfterMove);
      if (atkResult.ok) {
        actions.push({ type: 'attack', unit: enemy.uid, target: bestTargetAfterMove.uid, ...atkResult });
        const vc = checkVictory(state);
        if (vc) return actions;
      }
    } else {
      enemy.acted = true;
    }
  }

  return actions;
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
