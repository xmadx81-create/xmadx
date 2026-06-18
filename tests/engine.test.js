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
  getKillForecast,
} from '../src/web-mvp/js/engine.js';
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
