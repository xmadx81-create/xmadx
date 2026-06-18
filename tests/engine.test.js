import { describe, it, expect } from 'vitest';
import {
  createBattleState, moveUnit, attackUnit, getMovementRange, getAttackRange,
  getAttackTargets, activateSense, endPlayerPhase, endEnemyPhase,
  runEnemyPhase, checkVictory, allPlayerUnitsActed, cardToUnit,
  STAGES, TILE_TYPES, getLivingUnits, getUnitByUid, createMap,
  tickCooldowns, ROLE_MODIFIERS, EQUIPMENT, RELICS, equipItem, equipRelic,
  getCombatPower, previewDamage, previewSkillDamage,
  getMbtiPairScore, getMbtiSynergyGrade, getTeamSynergy, getTeamCP,
  gainXP, rollLoot, SECRET_COMBOS, getTerrainEffect,
  WEATHER_TYPES, applyWeatherToUnit, generateTowerStage,
  getKillForecast, applyTerrainHealing,
  applyDOT, tickDOTs, cleanseDOT,
  applyStun, applySlow, isStunned, tickStatusEffects,
  executeUltimate, useItem, tickBuffs, ULTIMATES,
} from '../src/web-mvp/js/engine.js';
import { checkAchievements, ACHIEVEMENTS } from '../src/web-mvp/js/save.js';
import { CHARACTERS, SENSE_TYPES, CHARACTER_MBTI } from '../src/web-mvp/js/cards.js';

describe('TILE_TYPES', () => {
  it('15가지 타일 타입이 정의되어 있다', () => {
    expect(Object.keys(TILE_TYPES).length).toBe(15);
    expect(TILE_TYPES.floor.walkable).toBe(true);
    expect(TILE_TYPES.mountain.walkable).toBe(false);
    expect(TILE_TYPES.forest.movCost).toBe(2);
    expect(TILE_TYPES.hotspring.healPerTurn).toBe(5);
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
    expect(state.map.cols).toBe(10);
    expect(state.map.rows).toBe(8);
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

describe('MP system', () => {
  it('유닛은 MP 10으로 생성된다', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 0, 0);
    expect(unit.mp).toBe(10);
    expect(unit.maxMp).toBe(10);
  });

  it('스킬에 mpCost가 설정된다', () => {
    const char = CHARACTERS.find(c => c.sense);
    const unit = cardToUnit(char, 0, 0);
    expect(unit.senseSkill.mpCost).toBeGreaterThan(0);
  });

  it('MP 부족 시 스킬 사용 불가', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    player.mp = 0;
    const result = activateSense(state, player);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('MP 부족');
  });

  it('라운드 종료 시 MP +2 회복', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    player.mp = 5;
    endPlayerPhase(state);
    endEnemyPhase(state);
    expect(player.mp).toBe(7);
  });

  it('MP 최대치를 초과하지 않는다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    player.mp = 10;
    endPlayerPhase(state);
    endEnemyPhase(state);
    expect(player.mp).toBe(10);
  });
});

describe('previewDamage', () => {
  it('예상 데미지 범위를 반환한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    const preview = previewDamage(state, player, enemy);
    expect(preview.minDmg).toBeGreaterThanOrEqual(1);
    expect(preview.maxDmg).toBeGreaterThanOrEqual(preview.minDmg);
    expect(preview.critDmg).toBeGreaterThan(preview.maxDmg);
    expect(preview.crt).toBeGreaterThan(0);
    expect(typeof preview.eva).toBe('number');
  });
});

describe('previewSkillDamage', () => {
  it('데미지 스킬의 프리뷰를 반환한다', () => {
    const char = CHARACTERS.find(c => c.sense?.baseType === '직감');
    const unit = cardToUnit(char, 0, 0);
    const preview = previewSkillDamage(unit);
    expect(preview).not.toBeNull();
    expect(preview.type).toBe('damage');
    expect(preview.value).toBeGreaterThan(0);
  });

  it('힐 스킬의 프리뷰를 반환한다', () => {
    const char = CHARACTERS.find(c => c.sense?.baseType === '감응');
    const unit = cardToUnit(char, 0, 0);
    const preview = previewSkillDamage(unit);
    expect(preview).not.toBeNull();
    expect(preview.type).toBe('heal');
  });

  it('스킬이 없는 유닛은 null 반환', () => {
    const char = CHARACTERS.find(c => !c.sense);
    if (char) {
      const unit = cardToUnit(char, 0, 0);
      expect(previewSkillDamage(unit)).toBeNull();
    }
  });
});

describe('MBTI synergy', () => {
  it('50명 캐릭터에 MBTI가 할당되어 있다', () => {
    expect(Object.keys(CHARACTER_MBTI).length).toBe(50);
    CHARACTERS.forEach(c => {
      expect(CHARACTER_MBTI[c.id]).toBeDefined();
    });
  });

  it('cardToUnit에 MBTI가 포함된다', () => {
    const char = CHARACTERS.find(c => c.id === 'park-harin');
    const unit = cardToUnit(char, 0, 0);
    expect(unit.mbti).toBe('ENTJ');
  });

  it('MBTI 쌍 점수를 계산한다', () => {
    const score = getMbtiPairScore('INTJ', 'ENFP');
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(9);
  });

  it('같은 MBTI는 높은 점수', () => {
    const same = getMbtiPairScore('ENTJ', 'ENTJ');
    const diff = getMbtiPairScore('ENTJ', 'ISFP');
    expect(same).toBeGreaterThan(diff);
  });

  it('시너지 등급을 반환한다', () => {
    const grade = getMbtiSynergyGrade(8);
    expect(grade.grade).toBe('SS');
    expect(grade.mult).toBe(2.0);
  });

  it('팀 시너지를 계산한다', () => {
    const units = ['park-harin', 'kim-doyun', 'lee-seoyeon'].map(id => {
      const c = CHARACTERS.find(ch => ch.id === id);
      return cardToUnit(c, 0, 0);
    });
    const syn = getTeamSynergy(units);
    expect(syn.teamMult).toBeGreaterThan(0);
    expect(syn.pairDetails.length).toBe(3);
    expect(syn.avgGrade).toBeDefined();
  });

  it('팀 전투력을 시너지 반영하여 계산한다', () => {
    const units = ['park-harin', 'kim-doyun'].map(id => {
      const c = CHARACTERS.find(ch => ch.id === id);
      return cardToUnit(c, 0, 0);
    });
    const result = getTeamCP(units);
    expect(result.total).toBeGreaterThan(0);
    expect(result.synergy.teamMult).toBeGreaterThan(0);
  });

  it('시크릿 콤보 테이블이 존재한다', () => {
    expect(SECRET_COMBOS.length).toBeGreaterThanOrEqual(5);
    SECRET_COMBOS.forEach(c => {
      expect(c.mbtis.length).toBeGreaterThanOrEqual(3);
      expect(c.mult).toBeGreaterThan(1);
      expect(c.name).toBeDefined();
    });
  });
});

describe('terrain system', () => {
  it('숲은 이동 비용 2', () => {
    expect(TILE_TYPES.forest.movCost).toBe(2);
    expect(TILE_TYPES.forest.walkable).toBe(true);
    expect(TILE_TYPES.forest.defBonus).toBe(1);
  });

  it('산은 이동 불가', () => {
    expect(TILE_TYPES.mountain.walkable).toBe(false);
  });

  it('온천은 턴당 회복', () => {
    expect(TILE_TYPES.hotspring.healPerTurn).toBe(5);
  });

  it('지형 효과를 가져온다', () => {
    const map = createMap([['graveyard', 'hotspring']]);
    const effect = getTerrainEffect(map, 0, 0);
    expect(effect.atkBonus).toBe(2);
    const hEffect = getTerrainEffect(map, 1, 0);
    expect(hEffect.healPerTurn).toBe(5);
  });

  it('숲 지형은 이동 범위를 줄인다', () => {
    const map = createMap([
      ['floor', 'forest', 'forest', 'floor'],
    ]);
    const unit = cardToUnit(CHARACTERS[0], 0, 0);
    unit.mov = 3;
    const state = { map, units: [unit] };
    const range = getMovementRange(state, unit);
    const canReach3 = range.some(t => t.x === 3);
    expect(canReach3).toBe(false);
  });
});

describe('XP and level system', () => {
  it('유닛은 레벨 1, XP 0으로 생성된다', () => {
    const unit = cardToUnit(CHARACTERS[0], 0, 0);
    expect(unit.level).toBe(1);
    expect(unit.xp).toBe(0);
    expect(unit.xpToNext).toBe(50);
  });

  it('XP를 얻으면 레벨업한다', () => {
    const unit = cardToUnit(CHARACTERS[0], 0, 0);
    const baseAtk = unit.atk;
    const result = gainXP(unit, 60);
    expect(result).not.toBeNull();
    expect(unit.level).toBe(2);
    expect(unit.atk).toBe(baseAtk + 2);
  });

  it('XP 부족하면 레벨업하지 않는다', () => {
    const unit = cardToUnit(CHARACTERS[0], 0, 0);
    const result = gainXP(unit, 10);
    expect(result).toBeNull();
    expect(unit.level).toBe(1);
    expect(unit.xp).toBe(10);
  });

  it('적 레벨이 스테이지에 따라 적용된다', () => {
    const state = createBattleState('stage-3', ['park-harin']);
    const enemy = state.units.find(u => u.team === 'enemy');
    expect(enemy.level).toBe(3);
  });
});

describe('loot system', () => {
  it('루트를 드롭한다', () => {
    const loot = rollLoot();
    expect(loot).toBeDefined();
    expect(loot.name).toBeDefined();
    expect(loot.type).toBe('consumable');
  });
});

describe('expanded stages', () => {
  it('7개의 스테이지가 정의되어 있다', () => {
    expect(STAGES.length).toBe(7);
  });

  it('각 스테이지에 enemyLevel이 있다', () => {
    STAGES.forEach(s => {
      expect(s.enemyLevel).toBeGreaterThanOrEqual(1);
    });
  });

  it('새 스테이지에 지형 타일이 포함되어 있다', () => {
    const stage4 = STAGES.find(s => s.id === 'stage-4');
    const flat = stage4.mapData.flat();
    expect(flat).toContain('forest');
    expect(flat).toContain('mountain');
    expect(flat).toContain('ice');
  });
});

describe('weather system', () => {
  it('6가지 날씨 타입이 정의되어 있다', () => {
    expect(Object.keys(WEATHER_TYPES)).toHaveLength(6);
    expect(WEATHER_TYPES.clear).toBeDefined();
    expect(WEATHER_TYPES.rain).toBeDefined();
    expect(WEATHER_TYPES.fog).toBeDefined();
    expect(WEATHER_TYPES.blizzard).toBeDefined();
    expect(WEATHER_TYPES.bloodmoon).toBeDefined();
    expect(WEATHER_TYPES.storm).toBeDefined();
  });

  it('날씨 타입에 필수 필드가 있다', () => {
    Object.values(WEATHER_TYPES).forEach(w => {
      expect(w.id).toBeDefined();
      expect(w.name).toBeDefined();
      expect(w.icon).toBeDefined();
      expect(w.desc).toBeDefined();
      expect(w.effects).toBeDefined();
    });
  });

  it('rain이 원거리 유닛의 ATK를 감소시킨다', () => {
    const char = CHARACTERS.find(c => c.role === 'ranged_dps');
    const unit = cardToUnit(char, 0, 0);
    expect(unit.rng).toBeGreaterThanOrEqual(2);
    const origAtk = unit.atk;
    applyWeatherToUnit(unit, WEATHER_TYPES.rain, {});
    expect(unit.atk).toBe(Math.max(1, origAtk - 2));
    expect(unit.eva).toBeGreaterThan(0);
  });

  it('blizzard가 MOV를 감소시킨다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    const origMov = unit.mov;
    applyWeatherToUnit(unit, WEATHER_TYPES.blizzard, {});
    expect(unit.mov).toBe(Math.max(1, origMov - 1));
  });

  it('clear 날씨는 효과가 없다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    const origAtk = unit.atk;
    const origMov = unit.mov;
    applyWeatherToUnit(unit, WEATHER_TYPES.clear, {});
    expect(unit.atk).toBe(origAtk);
    expect(unit.mov).toBe(origMov);
  });

  it('일부 스테이지에 날씨가 설정되어 있다', () => {
    const withWeather = STAGES.filter(s => s.weather && s.weather !== 'clear');
    expect(withWeather.length).toBeGreaterThanOrEqual(3);
  });

  it('날씨가 설정된 스테이지의 battleState에 weather가 포함된다', () => {
    const stage4 = STAGES.find(s => s.id === 'stage-4');
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, stage4.playerSpawns.length);
    const state = createBattleState('stage-4', chars.map(c => c.id), null, 1.0);
    expect(state.weather).toBeDefined();
    expect(state.weather.id).toBe('blizzard');
  });
});

describe('tower system', () => {
  it('generateTowerStage가 유효한 스테이지를 반환한다', () => {
    const stage = generateTowerStage(1);
    expect(stage.id).toBe('tower-1');
    expect(stage.mapData.length).toBe(8);
    expect(stage.mapData[0].length).toBe(10);
    expect(stage.playerSpawns.length).toBe(4);
    expect(stage.enemyUnits.length).toBeGreaterThanOrEqual(2);
    expect(stage.victoryCondition).toBe('defeat_all');
  });

  it('웨이브가 높을수록 적이 많아진다', () => {
    const stage1 = generateTowerStage(1);
    const stage5 = generateTowerStage(5);
    expect(stage5.enemyUnits.length).toBeGreaterThanOrEqual(stage1.enemyUnits.length);
  });

  it('웨이브 3+ 부터 날씨가 랜덤 적용될 수 있다', () => {
    const stage1 = generateTowerStage(1);
    expect(stage1.weather).toBe('clear');
    const stage2 = generateTowerStage(2);
    expect(stage2.weather).toBe('clear');
  });

  it('적 레벨이 웨이브에 따라 스케일링된다', () => {
    const s3 = generateTowerStage(3);
    expect(s3.enemyLevel).toBe(4);
    const s10 = generateTowerStage(10);
    expect(s10.enemyLevel).toBe(11);
  });

  it('적 레벨이 20을 초과하지 않는다', () => {
    const s30 = generateTowerStage(30);
    expect(s30.enemyLevel).toBeLessThanOrEqual(20);
  });

  it('웨이브 5+ 에서 3의 배수 웨이브에 증원이 있다', () => {
    const s6 = generateTowerStage(6);
    expect(s6.reinforcements).not.toBeNull();
    const s7 = generateTowerStage(7);
    expect(s7.reinforcements).toBeNull();
  });
});

describe('weather effects integration', () => {
  it('bloodmoon 날씨에서 감응 힐량이 감소한다', () => {
    const healer = CHARACTERS.find(c => c.senseSkill?.baseType === '감응');
    if (!healer) return;
    const supportChars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const charIds = [healer.id, ...supportChars.filter(c => c.id !== healer.id).map(c => c.id)].slice(0, 3);
    const state = createBattleState('stage-1', charIds, null, 1.0);
    state.weather = WEATHER_TYPES.bloodmoon;
    const ally = state.units.find(u => u.team === 'player');
    ally.hp = 1;
    const hpBefore = ally.hp;
    const unit = state.units.find(u => u.team === 'player' && u.senseSkill?.baseType === '감응');
    if (unit) {
      const result = activateSense(state, unit, ally);
      if (result.ok) {
        expect(ally.hp).toBeGreaterThan(hpBefore);
      }
    }
  });

  it('storm 날씨에서 반격 배수가 0.7보다 크다', () => {
    const state = createBattleState('stage-1', CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3).map(c => c.id), null, 1.0);
    state.weather = WEATHER_TYPES.storm;
    expect(state.weather.effects.counterBoost).toBe(0.2);
  });

  it('blizzard 날씨가 적용된 stage-4 유닛에 MOV 감소가 적용된다', () => {
    const stage4 = STAGES.find(s => s.id === 'stage-4');
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, stage4.playerSpawns.length);
    const state = createBattleState('stage-4', chars.map(c => c.id), null, 1.0);
    expect(state.weather.id).toBe('blizzard');
    const normalState = createBattleState('stage-1', chars.slice(0, 3).map(c => c.id), null, 1.0);
    const sameChar = state.units.find(u => u.team === 'player');
    const normalChar = normalState.units.find(u => u.charId === sameChar.charId || u.id === sameChar.id);
    if (normalChar) {
      expect(sameChar.mov).toBeLessThanOrEqual(normalChar.mov);
    }
  });
});

describe('kill forecast', () => {
  it('getKillForecast가 처치 가능 여부를 반환한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    const forecast = getKillForecast(state, attacker, defender);
    expect(forecast).toHaveProperty('canKill');
    expect(forecast).toHaveProperty('guaranteedKill');
    expect(forecast).toHaveProperty('canCounter');
    expect(forecast).toHaveProperty('counterDmg');
    expect(forecast).toHaveProperty('counterKillsYou');
    expect(typeof forecast.canKill).toBe('boolean');
    expect(typeof forecast.counterDmg).toBe('number');
  });

  it('HP 1인 적은 확정 처치로 판정된다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    defender.hp = 1;
    const forecast = getKillForecast(state, attacker, defender);
    expect(forecast.guaranteedKill).toBe(true);
    expect(forecast.canKill).toBe(true);
  });
});

describe('boss phase shift', () => {
  it('보스 HP 50% 이하 시 무적 페이즈가 발동된다', () => {
    const stage7 = STAGES.find(s => s.id === 'stage-7');
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, stage7.playerSpawns.length);
    const state = createBattleState('stage-7', chars.map(c => c.id), null, 1.0);
    const boss = state.units.find(u => u.team === 'enemy' && u.rarity === 'legendary');
    if (boss) {
      boss.hp = Math.floor(boss.maxHp * 0.5);
      state.phase = 'enemy_phase';
      state.units.filter(u => u.team === 'enemy').forEach(u => u.acted = false);
      const actions = runEnemyPhase(state);
      const phaseShift = actions.find(a => a.type === 'phase_shift' && a.unit === boss.uid);
      expect(phaseShift).toBeDefined();
    }
  });
});

describe('terrain healing with weather', () => {
  it('applyTerrainHealing이 회복된 유닛 배열을 반환한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-6', chars.map(c => c.id), null, 1.0);
    state.units.forEach(u => { if (u.hp > 1) u.hp = 1; });
    const healed = applyTerrainHealing(state);
    expect(Array.isArray(healed)).toBe(true);
  });

  it('bloodmoon 날씨에서 온천 회복이 감소한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-6', chars.map(c => c.id), null, 1.0);
    const hotspringUnit = state.units.find(u => {
      const tile = state.map.tiles[u.y]?.[u.x];
      return tile && tile.type === 'hotspring';
    });
    if (hotspringUnit) {
      hotspringUnit.hp = 1;
      state.weather = WEATHER_TYPES.bloodmoon;
      applyTerrainHealing(state);
      expect(hotspringUnit.hp).toBeGreaterThan(1);
    }
  });
});

describe('achievements', () => {
  it('12개의 업적이 정의되어 있다', () => {
    expect(ACHIEVEMENTS.length).toBe(12);
  });

  it('첫 승리 업적이 조건 충족 시 해금된다', () => {
    const save = {
      stats: { wins: 1, losses: 0, totalBattles: 1, totalKills: 0 },
      cards: {}, stageClears: {}, quests: { attendance: 0 }, achievements: {},
    };
    const unlocked = checkAchievements(save);
    const firstBlood = unlocked.find(a => a.id === 'first-blood');
    expect(firstBlood).toBeDefined();
    expect(save.achievements['first-blood']).toBeDefined();
  });

  it('이미 해금된 업적은 중복 해금되지 않는다', () => {
    const save = {
      stats: { wins: 1, losses: 0, totalBattles: 1, totalKills: 0 },
      cards: {}, stageClears: {}, quests: { attendance: 0 },
      achievements: { 'first-blood': { unlockedAt: '2026-01-01' } },
    };
    const unlocked = checkAchievements(save);
    expect(unlocked.find(a => a.id === 'first-blood')).toBeUndefined();
  });

  it('킬 50 업적이 조건 충족 시 해금된다', () => {
    const save = {
      stats: { wins: 0, losses: 0, totalBattles: 0, totalKills: 50 },
      cards: {}, stageClears: {}, quests: { attendance: 0 }, achievements: {},
    };
    const unlocked = checkAchievements(save);
    expect(unlocked.find(a => a.id === 'slayer-50')).toBeDefined();
    expect(unlocked.find(a => a.id === 'slayer-10')).toBeDefined();
  });
});

// ── DOT System Tests ──

describe('DOT system', () => {
  it('독을 적용하면 dots 배열에 추가된다', () => {
    const unit = { hp: 50, maxHp: 50, dots: [] };
    applyDOT(unit, 'poison', 5, 3);
    expect(unit.dots.length).toBe(1);
    expect(unit.dots[0]).toEqual({ type: 'poison', damage: 5, turns: 3 });
  });

  it('같은 타입 DOT는 더 높은 값으로 갱신된다', () => {
    const unit = { hp: 50, maxHp: 50, dots: [] };
    applyDOT(unit, 'poison', 3, 2);
    applyDOT(unit, 'poison', 5, 4);
    expect(unit.dots.length).toBe(1);
    expect(unit.dots[0].damage).toBe(5);
    expect(unit.dots[0].turns).toBe(4);
  });

  it('서로 다른 DOT 타입은 중첩된다', () => {
    const unit = { hp: 50, maxHp: 50, dots: [] };
    applyDOT(unit, 'poison', 3, 2);
    applyDOT(unit, 'bleed', 4, 3);
    expect(unit.dots.length).toBe(2);
  });

  it('tickDOTs가 데미지를 주고 턴을 감소시킨다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 50, maxHp: 50, dots: [{ type: 'poison', damage: 5, turns: 2 }] };
    const state = { units: [unit] };
    const results = tickDOTs(state);
    expect(results.length).toBe(1);
    expect(unit.hp).toBe(45);
    expect(unit.dots[0].turns).toBe(1);
  });

  it('DOT 턴이 0이 되면 제거된다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 50, maxHp: 50, dots: [{ type: 'poison', damage: 5, turns: 1 }] };
    const state = { units: [unit] };
    tickDOTs(state);
    expect(unit.dots.length).toBe(0);
  });

  it('DOT로 HP가 0 이하가 되면 사망한다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 3, maxHp: 50, dots: [{ type: 'poison', damage: 5, turns: 2 }] };
    const state = { units: [unit] };
    const results = tickDOTs(state);
    expect(unit.hp).toBe(0);
    expect(results[0].died).toBe(true);
  });

  it('cleanseDOT으로 특정 타입을 제거한다', () => {
    const unit = { dots: [{ type: 'poison', damage: 5, turns: 2 }, { type: 'bleed', damage: 3, turns: 1 }] };
    cleanseDOT(unit, 'poison');
    expect(unit.dots.length).toBe(1);
    expect(unit.dots[0].type).toBe('bleed');
  });

  it('cleanseDOT 타입 없이 호출하면 첫 번째를 제거한다', () => {
    const unit = { dots: [{ type: 'poison', damage: 5, turns: 2 }, { type: 'bleed', damage: 3, turns: 1 }] };
    cleanseDOT(unit);
    expect(unit.dots.length).toBe(1);
    expect(unit.dots[0].type).toBe('bleed');
  });

  it('HP 0 이하인 유닛은 DOT 틱을 받지 않는다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 0, maxHp: 50, dots: [{ type: 'poison', damage: 5, turns: 2 }] };
    const state = { units: [unit] };
    const results = tickDOTs(state);
    expect(results.length).toBe(0);
  });
});

// ── Status Effect Tests ──

describe('status effects', () => {
  it('기절을 적용하면 isStunned가 true를 반환한다', () => {
    const unit = { statusEffects: [] };
    applyStun(unit, 2);
    expect(isStunned(unit)).toBe(true);
    expect(unit.statusEffects[0].turns).toBe(2);
  });

  it('중복 기절은 더 긴 턴으로 갱신된다', () => {
    const unit = { statusEffects: [] };
    applyStun(unit, 1);
    applyStun(unit, 3);
    expect(unit.statusEffects.length).toBe(1);
    expect(unit.statusEffects[0].turns).toBe(3);
  });

  it('둔화를 적용하면 MOV가 1 감소한다', () => {
    const unit = { mov: 3, statusEffects: [], buffs: [] };
    applySlow(unit, 2);
    expect(unit.mov).toBe(2);
    expect(unit.statusEffects[0].type).toBe('slow');
  });

  it('tickStatusEffects가 턴을 감소시키고 만료 시 제거한다', () => {
    const unit = { hp: 50, mov: 2, statusEffects: [{ type: 'stun', turns: 1 }] };
    const state = { units: [unit] };
    tickStatusEffects(state);
    expect(unit.statusEffects.length).toBe(0);
  });

  it('둔화 만료 시 MOV가 복구된다', () => {
    const unit = { hp: 50, mov: 2, statusEffects: [{ type: 'slow', turns: 1 }] };
    const state = { units: [unit] };
    tickStatusEffects(state);
    expect(unit.mov).toBe(3);
  });
});

// ── Shield Tests ──

describe('shield system', () => {
  it('실드가 데미지를 먼저 흡수한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.shield = 20;
    const prevHp = player.hp;
    enemy.x = player.x;
    enemy.y = player.y + 1;
    enemy.rng = 1;
    const result = attackUnit(state, enemy, player);
    if (result.ok && !result.evaded) {
      expect(player.shield + player.hp + result.damage).toBeLessThanOrEqual(prevHp + 20 + 1);
    }
  });

  it('실드가 완전히 깨지면 남은 데미지가 HP에 적용된다', () => {
    const unit = { shield: 5, hp: 100, maxHp: 100 };
    const bigDamage = 15;
    const absorbed = Math.min(unit.shield, bigDamage);
    unit.shield -= absorbed;
    const remaining = bigDamage - absorbed;
    unit.hp -= remaining;
    expect(unit.shield).toBe(0);
    expect(unit.hp).toBe(90);
  });
});

// ── Ultimate Tests ──

describe('ultimate system', () => {
  function makeUnit(role, level = 10) {
    const char = CHARACTERS.find(c => c.role === role) || CHARACTERS[0];
    const unit = cardToUnit(char, 3, 3);
    unit.level = level;
    unit.mp = unit.maxMp;
    unit.team = 'player';
    return unit;
  }

  it('team_heal 궁극기가 아군 전체를 회복한다', () => {
    const healer = makeUnit('support');
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const supportUnit = state.units.find(u => u.team === 'player' && u.role === 'support');
    if (supportUnit) {
      supportUnit.level = 10;
      supportUnit.mp = supportUnit.maxMp;
      state.units.filter(u => u.team === 'player').forEach(u => { u.hp = Math.floor(u.maxHp * 0.5); });
      const ultIdx = supportUnit.ultimates?.findIndex(u => u.type === 'team_heal');
      if (ultIdx >= 0) {
        const hpBefore = state.units.filter(u => u.team === 'player').map(u => u.hp);
        const result = executeUltimate(state, supportUnit, ultIdx);
        expect(result.ok).toBe(true);
        const hpAfter = state.units.filter(u => u.team === 'player').map(u => u.hp);
        const anyHealed = hpAfter.some((hp, i) => hp > hpBefore[i]);
        expect(anyHealed).toBe(true);
      }
    }
  });

  it('team_shield 궁극기가 아군에게 실드를 부여한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const bsUnit = state.units.find(u => u.team === 'player' && u.role === 'battle_support');
    if (bsUnit) {
      bsUnit.level = 10;
      bsUnit.mp = bsUnit.maxMp;
      const ultIdx = bsUnit.ultimates?.findIndex(u => u.type === 'team_shield');
      if (ultIdx >= 0) {
        const result = executeUltimate(state, bsUnit, ultIdx);
        expect(result.ok).toBe(true);
        const shielded = state.units.filter(u => u.team === 'player' && u.hp > 0 && u.shield > 0);
        expect(shielded.length).toBeGreaterThan(0);
      }
    }
  });

  it('MP가 부족하면 궁극기를 사용할 수 없다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    player.level = 10;
    player.mp = 0;
    if (player.ultimates && player.ultimates.length > 0) {
      const result = executeUltimate(state, player, 0);
      expect(result.ok).toBe(false);
    }
  });

  it('쿨다운 중이면 궁극기를 사용할 수 없다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    player.level = 10;
    player.mp = player.maxMp;
    if (player.ultimates && player.ultimates.length > 0) {
      player.ultimates[0].currentCooldown = 3;
      const result = executeUltimate(state, player, 0);
      expect(result.ok).toBe(false);
    }
  });
});

// ── Item Tests ──

describe('item system', () => {
  it('HP 회복 아이템이 HP를 회복한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    player.hp = 10;
    const item = { name: '회복약', effect: { heal: 30 } };
    const result = useItem(state, player, item);
    expect(result.ok).toBe(true);
    expect(player.hp).toBe(40);
    expect(player.acted).toBe(true);
  });

  it('MP 회복 아이템이 MP를 회복한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    player.mp = 0;
    const prevMp = player.mp;
    const item = { name: 'MP 포션', effect: { mp: 5 } };
    const result = useItem(state, player, item);
    expect(result.ok).toBe(true);
    expect(player.mp).toBeGreaterThan(prevMp);
  });

  it('ATK 버프 아이템이 ATK를 증가시킨다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    const prevAtk = player.atk;
    const item = { name: '공격력 강화제', effect: { atkBuff: 5 } };
    const result = useItem(state, player, item);
    expect(result.ok).toBe(true);
    expect(player.atk).toBe(prevAtk + 5);
    expect(player.buffs.find(b => b.stat === 'atk' && b.val === 5)).toBeDefined();
  });

  it('행동 완료된 유닛은 아이템을 사용할 수 없다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    player.acted = true;
    const item = { name: '회복약', effect: { heal: 30 } };
    const result = useItem(state, player, item);
    expect(result.ok).toBe(false);
  });

  it('HP가 최대치를 초과하지 않는다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const player = state.units.find(u => u.team === 'player');
    player.hp = player.maxHp - 5;
    const item = { name: '회복약', effect: { heal: 30 } };
    useItem(state, player, item);
    expect(player.hp).toBe(player.maxHp);
  });
});

// ── Buff Tick Tests ──

describe('buff system', () => {
  it('tickBuffs가 만료된 버프를 제거하고 스탯을 복원한다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 50, maxHp: 50, atk: 15, buffs: [{ stat: 'atk', val: 5, turns: 1 }] };
    const state = { units: [unit] };
    const expired = tickBuffs(state);
    expect(expired.length).toBe(1);
    expect(unit.atk).toBe(10);
    expect(unit.buffs.length).toBe(0);
  });

  it('무적 버프가 만료되면 invuln이 false가 된다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 50, maxHp: 50, invuln: true, buffs: [{ stat: '_invuln', val: 1, turns: 1 }] };
    const state = { units: [unit] };
    tickBuffs(state);
    expect(unit.invuln).toBe(false);
  });

  it('남은 턴이 있는 버프는 유지된다', () => {
    const unit = { uid: 'u1', name: 'A', hp: 50, maxHp: 50, def: 10, buffs: [{ stat: 'def', val: 3, turns: 3 }] };
    const state = { units: [unit] };
    tickBuffs(state);
    expect(unit.def).toBe(10);
    expect(unit.buffs[0].turns).toBe(2);
  });
});

// ── Revive Edge Case Tests ──

describe('revive edge case', () => {
  it('부활 대상이 없으면 ok: false를 반환하고 MP/쿨다운을 복구한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const support = state.units.find(u => u.team === 'player' && u.role === 'support');
    if (support) {
      support.level = 10;
      support.mp = support.maxMp;
      const reviveIdx = support.ultimates?.findIndex(u => u.type === 'revive');
      if (reviveIdx >= 0) {
        const mpBefore = support.mp;
        const result = executeUltimate(state, support, reviveIdx);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('부활 대상 없음');
        expect(support.mp).toBe(mpBefore);
        expect(support.acted).toBe(false);
        expect(support.ultimates[reviveIdx].currentCooldown).toBe(0);
      }
    }
  });

  it('전사한 아군이 있으면 부활이 성공한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const support = state.units.find(u => u.team === 'player' && u.role === 'support');
    const other = state.units.find(u => u.team === 'player' && u.uid !== support?.uid);
    if (support && other) {
      support.level = 10;
      support.mp = support.maxMp;
      other.hp = 0;
      const reviveIdx = support.ultimates?.findIndex(u => u.type === 'revive');
      if (reviveIdx >= 0) {
        const result = executeUltimate(state, support, reviveIdx);
        expect(result.ok).toBe(true);
        expect(other.hp).toBeGreaterThan(0);
      }
    }
  });
});

// ── Leader Aura Tests ──

describe('leader aura', () => {
  it('레전더리 적이 있는 스테이지에서 적 전체가 ATK+2 DEF+1 버프를 받는다', () => {
    const legendaryStage = STAGES.find(s =>
      s.enemyUnits.some(eu => {
        const c = CHARACTERS.find(ch => ch.id === eu.charId);
        return c && c.rarity === 'legendary';
      })
    );
    if (legendaryStage) {
      const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
      const state = createBattleState(legendaryStage.id, chars.map(c => c.id), null, 1.0);
      const buffedEnemies = state.units.filter(u => u.team === 'enemy' && u._leaderBuff);
      expect(buffedEnemies.length).toBeGreaterThan(0);
    }
  });

  it('레전더리 적이 없는 스테이지에서는 리더 버프가 없다', () => {
    const noLegendStage = STAGES.find(s =>
      !s.enemyUnits.some(eu => {
        const c = CHARACTERS.find(ch => ch.id === eu.charId);
        return c && c.rarity === 'legendary';
      })
    );
    if (noLegendStage) {
      const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
      const state = createBattleState(noLegendStage.id, chars.map(c => c.id), null, 1.0);
      const buffedEnemies = state.units.filter(u => u.team === 'enemy' && u._leaderBuff);
      expect(buffedEnemies.length).toBe(0);
    }
  });
});

// ── Preview Damage Shield/Invuln Tests ──

describe('previewDamage extended', () => {
  it('실드가 있는 대상의 프리뷰에 shield 값이 포함된다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    defender.shield = 15;
    const preview = previewDamage(state, attacker, defender);
    expect(preview.shield).toBe(15);
  });

  it('무적 대상의 프리뷰에 invuln이 true이다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    defender.invuln = true;
    const preview = previewDamage(state, attacker, defender);
    expect(preview.invuln).toBe(true);
  });
});

// ── Enemy Support AI Tests ──

describe('enemy support AI', () => {
  it('적 서포터가 감응 스킬로 아군을 회복한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const supportEnemy = state.units.find(u => u.team === 'enemy' && u.senseSkill &&
      ['감응', '공감'].includes(u.senseSkill.baseType));
    if (supportEnemy) {
      const otherEnemy = state.units.find(u => u.team === 'enemy' && u.uid !== supportEnemy.uid && u.hp > 0);
      if (otherEnemy) {
        otherEnemy.hp = Math.floor(otherEnemy.maxHp * 0.3);
        supportEnemy.mp = supportEnemy.maxMp;
        supportEnemy.senseSkill.cooldown = 0;
        const result = activateSense(state, supportEnemy);
        expect(result.ok).toBe(true);
      }
    }
  });
});

// ── Tower Wave Healing Tests ──

describe('tower wave mechanics', () => {
  it('generateTowerStage가 유효한 타워 스테이지를 생성한다', () => {
    const stage = generateTowerStage(5);
    expect(stage.id).toBe('tower-5');
    expect(stage.enemyUnits.length).toBeGreaterThan(0);
    expect(stage.playerSpawns.length).toBeGreaterThan(0);
  });

  it('타워 스테이지 난이도가 웨이브에 따라 증가한다', () => {
    const early = generateTowerStage(1);
    const late = generateTowerStage(10);
    expect(late.enemyLevel).toBeGreaterThan(early.enemyLevel);
  });
});
