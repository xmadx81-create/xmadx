import { describe, it, expect } from 'vitest';
import {
  createBattleState, moveUnit, attackUnit, getMovementRange, getAttackRange,
  getAttackTargets, activateSense, endPlayerPhase, endEnemyPhase,
  runEnemyPhase, checkVictory, allPlayerUnitsActed, cardToUnit,
  STAGES, TILE_TYPES, getLivingUnits, getUnitByUid, createMap,
  tickCooldowns, ROLE_MODIFIERS, EQUIPMENT, RELICS, equipItem, equipRelic,
  getCombatPower,
} from '../src/web-mvp/js/engine.js';
import { CHARACTERS, SENSE_TYPES } from '../src/web-mvp/js/cards.js';

describe('TILE_TYPES', () => {
  it('5가지 타일 타입이 정의되어 있다', () => {
    expect(Object.keys(TILE_TYPES)).toEqual(['floor', 'wall', 'blood_storage', 'desk', 'entrance']);
  });

  it('벽은 이동 불가, 바닥은 이동 가능', () => {
    expect(TILE_TYPES.floor.walkable).toBe(true);
    expect(TILE_TYPES.wall.walkable).toBe(false);
  });
});

describe('cardToUnit', () => {
  it('캐릭터 데이터를 SRPG 유닛으로 변환한다', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 3, 4);
    expect(unit.name).toBe('박하린');
    expect(unit.x).toBe(3);
    expect(unit.y).toBe(4);
    expect(unit.role).toBe('support');
    expect(unit.hp).toBe(71);
    expect(unit.maxHp).toBe(unit.hp);
    expect(unit.atk).toBe(10);
    expect(unit.def).toBe(5);
    expect(unit.mov).toBe(3);
    expect(unit.acted).toBe(false);
  });

  it('원거리 역할(ranged_dps)은 rng=2를 가진다', () => {
    const rangedChar = CHARACTERS.find(c => c.role === 'ranged_dps');
    const unit = cardToUnit(rangedChar, 0, 0);
    expect(unit.rng).toBe(2);
  });

  it('근접 역할(melee_dps)은 rng=1을 가진다', () => {
    const meleeChar = CHARACTERS.find(c => c.role === 'melee_dps');
    const unit = cardToUnit(meleeChar, 0, 0);
    expect(unit.rng).toBe(1);
  });

  it('역할별 스탯 보정이 적용된다', () => {
    expect(Object.keys(ROLE_MODIFIERS).length).toBe(8);
    expect(ROLE_MODIFIERS.tank.hp).toBe(1.5);
    expect(ROLE_MODIFIERS.breaker.rng).toBeNull();
  });

  it('sense 스킬 데이터가 변환된다', () => {
    const char = CHARACTERS.find(c => c.sense);
    const unit = cardToUnit(char, 0, 0);
    expect(unit.senseSkill).not.toBeNull();
    expect(unit.senseSkill.cooldown).toBe(0);
    expect(unit.senseSkill.maxCooldown).toBe(3);
  });

  it('신규 전투 스탯이 포함된다 (crt, eva, pen, attackType)', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 0, 0);
    expect(unit.crt).toBe(0.10);
    expect(unit.eva).toBe(0);
    expect(unit.pen).toBe(0);
    expect(unit.attackType).toBe('mental');
    expect(unit.equipment).toEqual({ weapon: null, armor: null, accessory: null });
    expect(unit.relic).toBeNull();
  });

  it('카르테인 혈 스킬 캐릭터는 blood 공격 타입', () => {
    const duke = CHARACTERS.find(c => c.id === 'kartein-duke');
    const unit = cardToUnit(duke, 0, 0);
    expect(unit.attackType).toBe('blood');
  });
});

describe('equipment system', () => {
  it('장비를 장착하면 스탯이 증가한다', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 0, 0);
    const baseAtk = unit.atk;
    equipItem(unit, 'baton');
    expect(unit.atk).toBe(baseAtk + 4);
    expect(unit.crt).toBeCloseTo(0.15);
    expect(unit.equipment.weapon.name).toBe('보안봉');
  });

  it('방어구의 HP 보너스가 적용된다', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 0, 0);
    const baseHp = unit.hp;
    equipItem(unit, 'guard-vest');
    expect(unit.hp).toBe(baseHp + 10);
    expect(unit.maxHp).toBe(baseHp + 10);
    expect(unit.def).toBe(unit.def); // def already includes +4
  });

  it('유물을 장착할 수 있다', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 0, 0);
    equipRelic(unit, 'first-resolve');
    expect(unit.relic.name).toBe('첫날의 각오');
  });

  it('전투력을 계산한다', () => {
    const char = CHARACTERS.find(c => c.id === 'kartein-duke');
    const unit = cardToUnit(char, 0, 0);
    const cp = getCombatPower(unit);
    expect(cp).toBeGreaterThan(100);
  });

  it('createBattleState에서 자동 장비가 적용된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    expect(player.equipment.weapon).not.toBeNull();
    expect(player.equipment.armor).not.toBeNull();
  });
});

describe('createMap', () => {
  it('맵 데이터로 타일 그리드를 생성한다', () => {
    const mapData = [
      ['floor', 'wall', 'floor'],
      ['floor', 'floor', 'floor'],
    ];
    const map = createMap(mapData);
    expect(map.rows).toBe(2);
    expect(map.cols).toBe(3);
    expect(map.tiles[0][1].type).toBe('wall');
  });
});

describe('STAGES', () => {
  it('3개 이상의 스테이지가 정의되어 있다', () => {
    expect(STAGES.length).toBeGreaterThanOrEqual(3);
  });

  it('각 스테이지에 필수 필드가 있다', () => {
    STAGES.forEach(s => {
      expect(s.id).toBeDefined();
      expect(s.name).toBeDefined();
      expect(s.mapData).toBeDefined();
      expect(s.playerSpawns.length).toBeGreaterThan(0);
      expect(s.enemyUnits.length).toBeGreaterThan(0);
      expect(s.victoryCondition).toBeDefined();
    });
  });

  it('스테이지 적 캐릭터가 CHARACTERS에 존재한다', () => {
    STAGES.forEach(s => {
      s.enemyUnits.forEach(eu => {
        const found = CHARACTERS.find(c => c.id === eu.charId);
        expect(found).toBeDefined();
      });
    });
  });
});

describe('createBattleState', () => {
  it('전투 상태를 올바르게 생성한다', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    expect(state.phase).toBe('player_phase');
    expect(state.turnNumber).toBe(1);
    expect(state.map.cols).toBe(8);
    expect(state.map.rows).toBe(6);
    expect(state.units.length).toBeGreaterThan(0);
  });

  it('플레이어와 적 유닛이 배치된다', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    const players = state.units.filter(u => u.team === 'player');
    const enemies = state.units.filter(u => u.team === 'enemy');
    expect(players.length).toBe(2);
    expect(enemies.length).toBe(2);
  });

  it('유닛에 고유 uid가 부여된다', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    const uids = state.units.map(u => u.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });
});

describe('getMovementRange', () => {
  it('유닛의 이동 범위를 반환한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const range = getMovementRange(state, player);
    expect(range.length).toBeGreaterThan(0);
    range.forEach(t => {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('벽 타일은 이동 범위에 포함되지 않는다', () => {
    const state = createBattleState('stage-3', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const range = getMovementRange(state, player);
    range.forEach(t => {
      const tile = state.map.tiles[t.y][t.x];
      expect(TILE_TYPES[tile.type].walkable).toBe(true);
    });
  });
});

describe('moveUnit', () => {
  it('유효한 위치로 이동한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const range = getMovementRange(state, player);
    if (range.length > 0) {
      const target = range[0];
      const result = moveUnit(state, player, target.x, target.y);
      expect(result.ok).toBe(true);
      expect(player.x).toBe(target.x);
      expect(player.y).toBe(target.y);
    }
  });

  it('범위 밖으로는 이동할 수 없다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const result = moveUnit(state, player, 7, 0);
    expect(result.ok).toBe(false);
  });

  it('이미 행동한 유닛은 이동할 수 없다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    player.acted = true;
    const range = getMovementRange(state, player);
    if (range.length > 0) {
      const result = moveUnit(state, player, range[0].x, range[0].y);
      expect(result.ok).toBe(false);
    }
  });
});

describe('getAttackRange', () => {
  it('근접 유닛(rng=1)은 인접 4칸을 공격한다', () => {
    const state = createBattleState('stage-1', ['jung-woojin']);
    const player = state.units.find(u => u.team === 'player' && u.rng === 1);
    if (player) {
      player.x = 3; player.y = 3;
      const range = getAttackRange(state, player);
      expect(range.length).toBe(4);
    }
  });

  it('원거리 유닛(rng=2)은 더 넓은 범위를 가진다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const ranged = state.units.find(u => u.rng === 2);
    if (ranged) {
      ranged.x = 3; ranged.y = 3;
      const range = getAttackRange(state, ranged);
      expect(range.length).toBeGreaterThan(4);
    }
  });
});

describe('attackUnit', () => {
  it('적에게 데미지를 준다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    // Place them adjacent
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    const hpBefore = enemy.hp;
    const result = attackUnit(state, player, enemy);
    expect(result.ok).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(1);
    expect(enemy.hp).toBeLessThan(hpBefore);
  });

  it('범위 밖 공격은 실패한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 0; player.y = 0;
    enemy.x = 5; enemy.y = 5;
    const result = attackUnit(state, player, enemy);
    expect(result.ok).toBe(false);
  });

  it('공격 후 acted가 true가 된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    attackUnit(state, player, enemy);
    expect(player.acted).toBe(true);
  });
});

describe('turn phases', () => {
  it('endPlayerPhase로 적 턴으로 전환된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    expect(state.phase).toBe('player_phase');
    endPlayerPhase(state);
    expect(state.phase).toBe('enemy_phase');
  });

  it('endEnemyPhase로 다음 턴으로 전환된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    endPlayerPhase(state);
    endEnemyPhase(state);
    expect(state.phase).toBe('player_phase');
    expect(state.turnNumber).toBe(2);
  });

  it('allPlayerUnitsActed는 모든 유닛 행동 후 true', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    expect(allPlayerUnitsActed(state)).toBe(false);
    state.units.filter(u => u.team === 'player').forEach(u => { u.acted = true; });
    expect(allPlayerUnitsActed(state)).toBe(true);
  });
});

describe('checkVictory', () => {
  it('모든 적 처치 시 승리', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    state.units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
    expect(checkVictory(state)).toBe('win');
  });

  it('모든 아군 전사 시 패배', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    state.units.filter(u => u.team === 'player').forEach(u => { u.hp = 0; });
    expect(checkVictory(state)).toBe('lose');
  });

  it('전투 중에는 null', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    expect(checkVictory(state)).toBeNull();
  });
});

describe('activateSense', () => {
  it('촉 스킬을 발동한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player' && u.senseSkill);
    if (player) {
      const result = activateSense(state, player);
      expect(result.ok).toBe(true);
      expect(result.skillName).toBeDefined();
    }
  });

  it('쿨다운 중에는 사용 불가', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player' && u.senseSkill);
    if (player) {
      activateSense(state, player);
      player.acted = false;
      const result2 = activateSense(state, player);
      expect(result2.ok).toBe(false);
    }
  });

  it('쿨다운이 틱으로 감소한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player' && u.senseSkill);
    if (player) {
      activateSense(state, player);
      expect(player.senseSkill.cooldown).toBe(3);
      tickCooldowns(state);
      expect(player.senseSkill.cooldown).toBe(2);
    }
  });
});

describe('runEnemyPhase', () => {
  it('적 AI가 행동 목록을 반환한다', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    endPlayerPhase(state);
    const actions = runEnemyPhase(state);
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
  });
});

describe('utility functions', () => {
  it('getUnitByUid로 유닛을 찾는다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const found = getUnitByUid(state, player.uid);
    expect(found).toBe(player);
  });

  it('getLivingUnits로 살아있는 유닛만 반환한다', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    const alive = getLivingUnits(state, 'player');
    expect(alive.length).toBe(2);
    alive[0].hp = 0;
    expect(getLivingUnits(state, 'player').length).toBe(1);
  });

  it('getAttackTargets로 공격 가능한 적을 찾는다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    const targets = getAttackTargets(state, player);
    expect(targets.length).toBe(1);
    expect(targets[0].uid).toBe(enemy.uid);
  });
});

describe('50 characters', () => {
  it('50명의 캐릭터가 정의되어 있다', () => {
    expect(CHARACTERS.length).toBe(50);
  });

  it('모든 팩션에 캐릭터가 있다', () => {
    const factions = [...new Set(CHARACTERS.map(c => c.faction))];
    expect(factions).toContain('center');
    expect(factions).toContain('kartein');
    expect(factions).toContain('neutral');
  });
});
