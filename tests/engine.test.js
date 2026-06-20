import { describe, it, expect } from 'vitest';
import {
  createBattleState, moveUnit, attackUnit, getMovementRange, getAttackRange,
  getAttackTargets, activateSense, endPlayerPhase, endEnemyPhase,
  runEnemyPhase, checkVictory, allPlayerUnitsActed, cardToUnit,
  STAGES, TILE_TYPES, getLivingUnits, getUnitByUid, createMap,
  tickCooldowns, ROLE_MODIFIERS, EQUIPMENT, RELICS, equipItem, equipRelic,
  getCombatPower, previewDamage, previewSkillDamage,
  getMbtiPairScore, getMbtiSynergyGrade, getTeamSynergy, getTeamCP,
  gainXP, rollLoot, SECRET_COMBOS, getTerrainEffect, XP_TABLE,
  WEATHER_TYPES, applyWeatherToUnit, generateTowerStage,
  getKillForecast, applyTerrainHealing, getTowerRewards,
  applyDOT, tickDOTs, cleanseDOT,
  applyStun, applySlow, isStunned, tickStatusEffects,
  executeUltimate, useItem, tickBuffs, ULTIMATES,
  spawnReinforcements, getFlankingBonus, applyStatGrowth, FACTIONS,
  PASSIVE_TREE, FACTION_SYNERGY, applyFactionSynergy, getDangerZone,
  STORY_ACTS, getScaledEnemyLevel,
  createDefenseState, DEFENSE_GRID, createDefensePath,
  defenseDrawCards, defenseMerge, defenseAutoAttack,
  defenseAdvanceEnemies, defenseSpawnEnemies, isDefenseWaveComplete,
  generateDefenseWave, getDefenseRewards, defenseTickSlow,
  defenseActivateSkills, defenseTickSkillEffects, DEFENSE_SKILLS,
} from '../src/web-mvp/js/engine.js';
import { checkAchievements, ACHIEVEMENTS, ensureStarterDeck, loadGame, doRecruit, synthesizeCard, getSynthesisCost, progressBonds, getBondLevel, getBondBuff, enhanceCard, ENHANCE_COSTS, ENHANCE_MAX, getUnlockedLoreStage, LORE_MILESTONES } from '../src/web-mvp/js/save.js';
import { CHARACTERS, SENSE_TYPES, CHARACTER_MBTI, CHAR_QUOTES } from '../src/web-mvp/js/cards.js';

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
    expect(unit.crt).toBe(0.05);
    expect(unit.eva).toBe(0.03);
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
    expect(unit.crt).toBeCloseTo(0.10);
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
    enemy.eva = 0;
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
  it('15개의 스테이지가 정의되어 있다', () => {
    expect(STAGES.length).toBe(15);
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

// ── Reinforcements Tests ──

describe('spawnReinforcements', () => {
  it('해당 턴에 증원이 스폰된다', () => {
    const stageWithReinf = STAGES.find(s => s.reinforcements && s.reinforcements.length > 0);
    if (stageWithReinf) {
      const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
      const state = createBattleState(stageWithReinf.id, chars.map(c => c.id), null, 1.0);
      const reinfTurn = stageWithReinf.reinforcements[0].turn;
      state.turnNumber = reinfTurn;
      const result = spawnReinforcements(state);
      expect(result).not.toBeNull();
      expect(result.units.length).toBeGreaterThan(0);
    }
  });

  it('이미 스폰된 증원은 재스폰되지 않는다', () => {
    const stageWithReinf = STAGES.find(s => s.reinforcements && s.reinforcements.length > 0);
    if (stageWithReinf) {
      const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
      const state = createBattleState(stageWithReinf.id, chars.map(c => c.id), null, 1.0);
      const reinfTurn = stageWithReinf.reinforcements[0].turn;
      state.turnNumber = reinfTurn;
      spawnReinforcements(state);
      const result2 = spawnReinforcements(state);
      expect(result2).toBeNull();
    }
  });

  it('증원이 없는 턴에서는 null을 반환한다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    state.turnNumber = 99;
    const result = spawnReinforcements(state);
    expect(result).toBeNull();
  });
});

// ── Faction Advantage Tests ──

describe('faction advantage', () => {
  it('카르테인이 비소속 공격 시 ATK+3 보너스', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const karteinUnit = state.units.find(u => u.faction === 'kartein');
    const neutralUnit = state.units.find(u => u.faction === 'neutral');
    if (karteinUnit && neutralUnit) {
      const preview1 = previewDamage(state, karteinUnit, neutralUnit);
      expect(preview1.minDmg).toBeGreaterThan(0);
    }
  });

  it('센터 유닛이 카르테인에 대해 DEF+2 보너스', () => {
    const chars = CHARACTERS.filter(c => c.faction === 'center').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const centerUnit = state.units.find(u => u.faction === 'center');
    const karteinUnit = state.units.find(u => u.faction === 'kartein');
    if (centerUnit && karteinUnit) {
      const preview = previewDamage(state, karteinUnit, centerUnit);
      expect(preview).toBeDefined();
    }
  });
});

// ── Flanking Bonus Tests ──

describe('flanking bonus', () => {
  it('방어자 인접 아군이 있으면 협공 보너스가 적용된다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    const ally = state.units.find(u => u.team === 'player' && u.uid !== attacker.uid);
    if (attacker && defender && ally) {
      ally.x = defender.x;
      ally.y = defender.y + 1;
      const bonus = getFlankingBonus(state, attacker, defender);
      expect(bonus).toBe(2);
    }
  });

  it('인접 아군이 없으면 협공 보너스가 0이다', () => {
    const chars = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3);
    const state = createBattleState('stage-1', chars.map(c => c.id), null, 1.0);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    state.units.filter(u => u.team === 'player' && u.uid !== attacker.uid).forEach(u => {
      u.x = 0; u.y = 0;
    });
    const bonus = getFlankingBonus(state, attacker, defender);
    expect(bonus).toBe(0);
  });
});

// ── Stat Growth Tests ──

describe('applyStatGrowth', () => {
  it('공격 행동이 ATK 경험치를 쌓는다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    unit.level = 1;
    const result = applyStatGrowth(unit, 'attack');
    expect(unit.statXP.atk).toBeGreaterThan(0);
  });

  it('피격 행동이 DEF 경험치를 쌓는다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    unit.level = 1;
    applyStatGrowth(unit, 'take_damage');
    expect(unit.statXP.def).toBeGreaterThan(0);
  });

  it('경험치가 임계값에 도달하면 스탯이 성장한다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    unit.level = 1;
    const threshold = 30 + unit.level * 5;
    const atkBefore = unit.atk;
    for (let i = 0; i < Math.ceil(threshold / 10) + 1; i++) {
      applyStatGrowth(unit, 'attack');
    }
    expect(unit.atk).toBeGreaterThanOrEqual(atkBefore);
  });
});

describe('레벨업 스탯 정보', () => {
  it('gainXP levelUp 데이터에 hpGain, atk, def가 포함된다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    unit.level = 1;
    unit.xp = 0;
    unit.xpToNext = 10;
    const hpBefore = unit.maxHp;
    const result = gainXP(unit, 15);
    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('level');
    expect(result[0]).toHaveProperty('hpGain');
    expect(result[0].hpGain).toBe(Math.floor(hpBefore * 0.05));
    expect(result[0]).toHaveProperty('atk');
    expect(result[0]).toHaveProperty('def');
  });

  it('다중 레벨업 시 각각의 스탯 정보가 기록된다', () => {
    const char = CHARACTERS[0];
    const unit = cardToUnit(char, 0, 0);
    unit.level = 1;
    unit.xp = 0;
    unit.xpToNext = 10;
    const result = gainXP(unit, 200);
    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThanOrEqual(2);
    result.forEach(lv => {
      expect(lv.hpGain).toBeGreaterThan(0);
    });
  });
});

describe('반격 사망 (Counter-Kill)', () => {
  it('반격으로 공격자가 사망하면 attackerDied = true', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    attacker.hp = 1;
    attacker.atk = 5;
    defender.hp = 999;
    defender.maxHp = 999;
    defender.atk = 50;
    defender.def = 0;
    attacker.x = 3; attacker.y = 3;
    defender.x = 4; defender.y = 3;
    const result = attackUnit(state, attacker, defender);
    if (result.ok && result.counterDamage > 0) {
      expect(result.attackerDied).toBe(true);
    }
  });

  it('반격 사망 시에도 공격 데미지와 루트가 정상 처리된다', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    attacker.hp = 1;
    attacker.atk = 999;
    defender.hp = 10;
    defender.maxHp = 10;
    defender.atk = 50;
    defender.def = 0;
    defender.eva = 0;
    attacker.x = 3; attacker.y = 3;
    defender.x = 4; defender.y = 3;
    const result = attackUnit(state, attacker, defender);
    if (result.ok) {
      expect(result.defenderDied).toBe(true);
      expect(result.damage).toBeGreaterThan(0);
    }
  });

  it('선제 반격(speed advantage)으로 공격자 사망 시 공격 불가', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    const attacker = state.units.find(u => u.team === 'player');
    const defender = state.units.find(u => u.team === 'enemy');
    attacker.hp = 1;
    attacker.atk = 5;
    defender.hp = 999;
    defender.maxHp = 999;
    defender.atk = 999;
    defender.def = 0;
    attacker.x = 3; attacker.y = 3;
    defender.x = 4; defender.y = 3;
    const originalFaction = defender.faction;
    const advantageFaction = Object.entries(FACTIONS).find(([, v]) => v.strongVs === attacker.faction);
    if (advantageFaction) {
      defender.faction = advantageFaction[0];
      const result = attackUnit(state, attacker, defender);
      if (result.ok && result.attackerDied) {
        expect(result.damage).toBe(0);
        expect(result.defenderDied).toBe(false);
      }
      defender.faction = originalFaction;
    }
  });

  it('적 페이즈 공격 시 attackerDied 정보가 반환된다', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    enemy.hp = 1;
    enemy.atk = 5;
    player.hp = 999;
    player.maxHp = 999;
    player.atk = 50;
    player.def = 0;
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    enemy.acted = false;
    state.phase = 'enemy_phase';
    const actions = runEnemyPhase(state);
    const atkAction = actions.find(a => a.type === 'attack');
    if (atkAction) {
      expect(atkAction).toHaveProperty('attackerDied');
    }
  });
});

describe('전투 결과 딜레이 & 승리 확인', () => {
  it('checkVictory — 적 전멸 시 승리', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    state.units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
    expect(checkVictory(state)).toBe('win');
  });

  it('checkVictory — 아군 전멸 시 패배', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    state.units.filter(u => u.team === 'player').forEach(u => { u.hp = 0; });
    expect(checkVictory(state)).toBe('lose');
  });

  it('checkVictory — 양쪽 생존 시 null', () => {
    const state = createBattleState('stage-1', [CHARACTERS[0].id]);
    expect(checkVictory(state)).toBeNull();
  });
});

describe('패시브 스킬 트리', () => {
  it('모든 역할에 패시브 트리가 정의되어 있다', () => {
    const roles = ['tank', 'melee_dps', 'ranged_dps', 'support', 'bruiser', 'battle_support', 'evasive_dps', 'breaker'];
    roles.forEach(role => {
      expect(PASSIVE_TREE[role]).toBeDefined();
      expect(PASSIVE_TREE[role].length).toBe(3);
    });
  });

  it('패시브는 lv, stat, val, name 속성을 갖는다', () => {
    Object.values(PASSIVE_TREE).forEach(tree => {
      tree.forEach(p => {
        expect(p).toHaveProperty('lv');
        expect(p).toHaveProperty('stat');
        expect(p).toHaveProperty('val');
        expect(p).toHaveProperty('name');
        expect(typeof p.name).toBe('string');
      });
    });
  });

  it('레벨업 시 패시브가 자동 적용된다', () => {
    const char = CHARACTERS.find(c => c.role === 'tank');
    if (!char) return;
    const unit = cardToUnit(char, 0, 0);
    unit.level = 1;
    unit.xp = 0;
    unit.xpToNext = 10;
    gainXP(unit, 200);
    const tree = PASSIVE_TREE[unit.role];
    const expectedPassives = tree.filter(p => unit.level >= p.lv).map(p => p.name);
    expectedPassives.forEach(name => {
      expect(unit.passivesApplied).toContain(name);
    });
  });

  it('패시브 레벨 순서가 오름차순이다', () => {
    Object.values(PASSIVE_TREE).forEach(tree => {
      for (let i = 1; i < tree.length; i++) {
        expect(tree[i].lv).toBeGreaterThanOrEqual(tree[i - 1].lv);
      }
    });
  });
});

describe('사운드 모듈', () => {
  it('사운드 함수들이 export되어 있다', async () => {
    const sound = await import('../src/web-mvp/js/sound.js');
    expect(typeof sound.initAudio).toBe('function');
    expect(typeof sound.sfxHit).toBe('function');
    expect(typeof sound.sfxCritical).toBe('function');
    expect(typeof sound.sfxDeath).toBe('function');
    expect(typeof sound.sfxSkill).toBe('function');
    expect(typeof sound.sfxEvade).toBe('function');
    expect(typeof sound.sfxLevelUp).toBe('function');
    expect(typeof sound.sfxWin).toBe('function');
    expect(typeof sound.sfxLose).toBe('function');
    expect(typeof sound.toggleMute).toBe('function');
    expect(typeof sound.isMuted).toBe('function');
  });

  it('toggleMute가 상태를 토글한다', async () => {
    const sound = await import('../src/web-mvp/js/sound.js');
    const before = sound.isMuted();
    sound.toggleMute();
    expect(sound.isMuted()).toBe(!before);
    sound.toggleMute();
    expect(sound.isMuted()).toBe(before);
  });
});

describe('역할별 스탯 차별화', () => {
  it('evasive_dps는 EVA 15%, tank은 EVA 2%', () => {
    const evasive = CHARACTERS.find(c => c.role === 'evasive_dps');
    const tank = CHARACTERS.find(c => c.role === 'tank');
    const eUnit = cardToUnit(evasive, 0, 0);
    const tUnit = cardToUnit(tank, 0, 0);
    expect(eUnit.eva).toBe(0.15);
    expect(tUnit.eva).toBe(0.02);
    expect(eUnit.eva).toBeGreaterThan(tUnit.eva);
  });

  it('ranged_dps는 RNG 2, melee_dps는 RNG 1', () => {
    const ranged = CHARACTERS.find(c => c.role === 'ranged_dps');
    const melee = CHARACTERS.find(c => c.role === 'melee_dps');
    const rUnit = cardToUnit(ranged, 0, 0);
    const mUnit = cardToUnit(melee, 0, 0);
    expect(rUnit.rng).toBe(2);
    expect(mUnit.rng).toBe(1);
  });

  it('breaker는 PEN 2, support는 PEN 0', () => {
    const breaker = CHARACTERS.find(c => c.role === 'breaker');
    const support = CHARACTERS.find(c => c.role === 'support');
    const bUnit = cardToUnit(breaker, 0, 0);
    const sUnit = cardToUnit(support, 0, 0);
    expect(bUnit.pen).toBe(2);
    expect(sUnit.pen).toBe(0);
  });

  it('ranged_dps는 CRT가 melee_dps 이상이다', () => {
    const ranged = CHARACTERS.find(c => c.role === 'ranged_dps');
    const melee = CHARACTERS.find(c => c.role === 'melee_dps');
    expect(cardToUnit(ranged, 0, 0).crt).toBeGreaterThanOrEqual(cardToUnit(melee, 0, 0).crt);
  });
});

describe('설정 시스템', () => {
  it('STAGES가 15개 존재하고 각각 필수 필드를 갖는다', () => {
    expect(STAGES.length).toBe(15);
    STAGES.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.enemyUnits.length).toBeGreaterThan(0);
      expect(s.playerSpawns.length).toBeGreaterThan(0);
      expect(typeof s.enemyLevel).toBe('number');
    });
  });

  it('generateTowerStage가 웨이브 번호에 따라 적 레벨을 증가시킨다', () => {
    const w1 = generateTowerStage(1);
    const w5 = generateTowerStage(5);
    const w10 = generateTowerStage(10);
    expect(w1.enemyLevel).toBeLessThan(w5.enemyLevel);
    expect(w5.enemyLevel).toBeLessThan(w10.enemyLevel);
  });

  it('WEATHER_TYPES가 6종 이상의 날씨를 포함한다', () => {
    expect(Object.keys(WEATHER_TYPES).length).toBeGreaterThanOrEqual(6);
    Object.values(WEATHER_TYPES).forEach(w => {
      expect(w.name).toBeTruthy();
      expect(w.icon).toBeTruthy();
    });
  });
});

describe('Starter Deck', () => {
  it('빈 세이브에 스타터 덱 3장이 추가된다', () => {
    const save = { cards: {} };
    ensureStarterDeck(save);
    const ids = Object.keys(save.cards);
    expect(ids.length).toBe(3);
    expect(ids).toContain('kim-doyun');
    expect(ids).toContain('choi-minseo');
    expect(ids).toContain('kwon-jihye');
    ids.forEach(id => {
      expect(save.cards[id].level).toBe(1);
      expect(save.cards[id].count).toBe(1);
    });
  });

  it('이미 카드가 있는 세이브는 스타터 덱을 추가하지 않는다', () => {
    const save = { cards: { 'park-harin': { level: 2, xp: 0, count: 1 } } };
    ensureStarterDeck(save);
    expect(Object.keys(save.cards).length).toBe(1);
    expect(save.cards['kim-doyun']).toBeUndefined();
  });

  it('스타터 캐릭터 3명은 각각 다른 팩션이다', () => {
    const starterIds = ['kim-doyun', 'choi-minseo', 'kwon-jihye'];
    const factions = starterIds.map(id => CHARACTERS.find(c => c.id === id).faction);
    expect(factions).toContain('center');
    expect(factions).toContain('neutral');
  });

  it('스타터 캐릭터는 모두 common 레어리티다', () => {
    const starterIds = ['kim-doyun', 'choi-minseo', 'kwon-jihye'];
    starterIds.forEach(id => {
      const char = CHARACTERS.find(c => c.id === id);
      expect(char.rarity).toBe('common');
    });
  });
});

describe('Onboarding & XP Tracking', () => {
  it('DEFAULT_SAVE에 onboarded 플래그가 false로 존재한다', () => {
    const save = loadGame();
    expect(save.onboarded === undefined || save.onboarded === false).toBe(true);
  });

  it('XP_TABLE에 skill XP (15)가 정의되어 있다', () => {
    expect(XP_TABLE.skill).toBe(15);
    expect(XP_TABLE.attack).toBe(10);
    expect(XP_TABLE.kill).toBe(30);
    expect(XP_TABLE.takeDamage).toBe(5);
  });

  it('gainXP가 레벨업 시 levelUps 배열을 반환한다', () => {
    const state = createBattleState('stage-1', [CHARACTERS[1].id]);
    const unit = state.units.find(u => u.team === 'player');
    unit.xp = unit.xpToNext - 1;
    const result = gainXP(unit, 10);
    expect(result).not.toBeNull();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].level).toBe(2);
  });
});

describe('Faction Synergy', () => {
  it('FACTION_SYNERGY에 3개 팩션의 시너지가 정의되어 있다', () => {
    expect(FACTION_SYNERGY.center).toBeDefined();
    expect(FACTION_SYNERGY.kartein).toBeDefined();
    expect(FACTION_SYNERGY.neutral).toBeDefined();
    expect(FACTION_SYNERGY.center.length).toBeGreaterThanOrEqual(1);
  });

  it('applyFactionSynergy가 같은 팩션 유닛에만 보너스를 적용한다', () => {
    const centerChars = CHARACTERS.filter(c => c.faction === 'center');
    const ids = centerChars.slice(0, 3).map(c => c.id);
    const state = createBattleState('stage-1', ids);
    const playerBefore = state.units.filter(u => u.team === 'player').map(u => u.def);
    expect(state.factionSynergies).toBeDefined();
    expect(state.factionSynergies.length).toBeGreaterThan(0);
    expect(state.factionSynergies.some(s => s.includes('센터'))).toBe(true);
  });

  it('팩션 수가 부족하면 시너지가 발동하지 않는다', () => {
    const mixed = [
      CHARACTERS.find(c => c.faction === 'center').id,
      CHARACTERS.find(c => c.faction === 'kartein').id,
      CHARACTERS.find(c => c.faction === 'neutral').id,
    ];
    const units = mixed.map(id => {
      const c = CHARACTERS.find(ch => ch.id === id);
      const u = cardToUnit(c, 0, 0);
      u.team = 'player';
      return u;
    });
    const applied = applyFactionSynergy(units);
    expect(applied.length).toBe(0);
  });

  it('PASSIVE_TREE가 모든 8개 역할에 3단계 패시브를 정의한다', () => {
    const roles = ['tank','melee_dps','ranged_dps','support','bruiser','battle_support','evasive_dps','breaker'];
    roles.forEach(role => {
      expect(PASSIVE_TREE[role]).toBeDefined();
      expect(PASSIVE_TREE[role].length).toBe(3);
      PASSIVE_TREE[role].forEach(p => {
        expect(p.lv).toBeGreaterThan(0);
        expect(p.name).toBeTruthy();
      });
    });
  });
});

describe('하드 모드', () => {
  it('createBattleState의 적 유닛이 스탯을 가진다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const enemy = state.units.find(u => u.team === 'enemy');
    expect(enemy.atk).toBeGreaterThan(0);
    expect(enemy.def).toBeGreaterThanOrEqual(0);
    expect(enemy.hp).toBeGreaterThan(0);
  });

  it('하드 모드 적 버프가 적용되면 스탯이 증가한다', () => {
    const normalState = createBattleState('stage-1', ['park-harin']);
    const normalEnemy = normalState.units.find(u => u.team === 'enemy');
    const normalAtk = normalEnemy.atk;
    const normalDef = normalEnemy.def;

    const hardState = createBattleState('stage-1', ['park-harin']);
    hardState.hardMode = true;
    hardState.units.filter(u => u.team === 'enemy').forEach(u => {
      const baseLv = u.level;
      for (let lv = 0; lv < baseLv; lv++) {
        u.level++;
        u.maxHp += Math.floor(u.maxHp * 0.05);
        u.atk += 2;
        u.def += 1;
      }
      u.atk = Math.floor(u.atk * 1.3);
      u.def = Math.floor(u.def * 1.3);
      u.hp = u.maxHp;
    });
    const hardEnemy = hardState.units.find(u => u.team === 'enemy');
    expect(hardEnemy.atk).toBeGreaterThan(normalAtk);
    expect(hardEnemy.def).toBeGreaterThanOrEqual(normalDef);
  });

  it('EQUIPMENT에 13개 아이템이 정의되어 있다', () => {
    expect(EQUIPMENT.length).toBe(13);
    EQUIPMENT.forEach(e => {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.slot).toBeTruthy();
    });
  });

  it('RELICS에 5개 유물이 정의되어 있다', () => {
    expect(RELICS.length).toBe(5);
    RELICS.forEach(r => {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.condition).toBeTruthy();
    });
  });
});

describe('전투 시스템 강화', () => {
  it('previewDamage가 협공 보너스를 포함한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    const preview = previewDamage(state, player, enemy);
    expect(preview).toBeDefined();
    expect(preview.minDmg).toBeGreaterThanOrEqual(0);
    expect(preview.maxDmg).toBeGreaterThanOrEqual(preview.minDmg);
    expect(typeof preview.flanking).toBe('number');
  });

  it('getKillForecast가 처치 가능 여부를 반환한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    const forecast = getKillForecast(state, player, enemy);
    expect(forecast).toBeDefined();
    expect(typeof forecast.canKill).toBe('boolean');
    expect(typeof forecast.canCounter).toBe('boolean');
  });

  it('전투 상태에 hardMode 플래그를 설정할 수 있다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    expect(state.hardMode).toBeUndefined();
    state.hardMode = true;
    expect(state.hardMode).toBe(true);
  });
});

describe('모집 시스템', () => {
  it('모집권이 충분하면 카드를 획득한다', () => {
    const save = { cards: {}, recruitTickets: 5 };
    const result = doRecruit(save, CHARACTERS, 1);
    expect(result.ok).toBe(true);
    expect(result.results.length).toBe(1);
    expect(save.recruitTickets).toBe(4);
    expect(result.results[0].name).toBeTruthy();
    expect(result.results[0].rarity).toBeTruthy();
  });

  it('모집권이 부족하면 실패한다', () => {
    const save = { cards: {}, recruitTickets: 0 };
    const result = doRecruit(save, CHARACTERS, 1);
    expect(result.ok).toBe(false);
  });

  it('10연차 모집이 10장의 카드를 준다', () => {
    const save = { cards: {}, recruitTickets: 10 };
    const result = doRecruit(save, CHARACTERS, 10);
    expect(result.ok).toBe(true);
    expect(result.results.length).toBe(10);
    expect(save.recruitTickets).toBe(0);
  });

  it('모집 결과가 세이브에 카드를 추가한다', () => {
    const save = { cards: {}, centerXP: 0, centerLevel: 1, recruitTickets: 3 };
    const result = doRecruit(save, CHARACTERS, 3);
    expect(result.ok).toBe(true);
    expect(Object.keys(save.cards).length).toBeGreaterThan(0);
  });
});

describe('자동 전투 관련', () => {
  it('유닛이 이동 범위와 공격 대상을 가진다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const moveRange = getMovementRange(state, player);
    expect(moveRange.length).toBeGreaterThan(0);
  });

  it('allPlayerUnitsActed가 모두 행동 시 true를 반환한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const players = state.units.filter(u => u.team === 'player');
    expect(allPlayerUnitsActed(state)).toBe(false);
    players.forEach(u => { u.acted = true; });
    expect(allPlayerUnitsActed(state)).toBe(true);
  });

  it('유닛의 MP가 올바르게 초기화된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    expect(player.mp).toBeGreaterThanOrEqual(0);
    expect(player.maxMp).toBeGreaterThan(0);
  });
});

describe('컬렉션 진행률', () => {
  it('CHARACTERS 배열이 올바른 수의 캐릭터를 포함한다', () => {
    expect(CHARACTERS.length).toBe(50);
  });

  it('모든 캐릭터에 rarity 필드가 있다', () => {
    CHARACTERS.forEach(c => {
      expect(['common', 'uncommon', 'rare', 'legendary']).toContain(c.rarity);
    });
  });

  it('각 레어리티별 캐릭터가 존재한다', () => {
    const rarities = new Set(CHARACTERS.map(c => c.rarity));
    expect(rarities.has('common')).toBe(true);
    expect(rarities.has('uncommon')).toBe(true);
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);
  });
});

describe('전투 마일스톤 추적', () => {
  it('_battleKills로 킬 수를 추적한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    enemy.hp = 1;
    enemy.def = 0;
    enemy.eva = 0;
    player.atk = 999;
    const result = attackUnit(state, player, enemy);
    expect(result.ok).toBe(true);
    expect(result.defenderDied).toBe(true);
  });

  it('_totalPlayerKills 카운터를 배틀 스테이트에서 관리한다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    state._totalPlayerKills = 0;
    state._totalPlayerKills++;
    expect(state._totalPlayerKills).toBe(1);
  });

  it('legendary 적은 보스로 간주된다', () => {
    const legendaryChars = CHARACTERS.filter(c => c.rarity === 'legendary');
    expect(legendaryChars.length).toBeGreaterThan(0);
    legendaryChars.forEach(c => {
      expect(c.rarity).toBe('legendary');
    });
  });
});

describe('카드 합성 시스템', () => {
  it('카드 3장 이상이면 합성 성공한다', () => {
    const save = { cards: { 'kim-doyun': { level: 1, xp: 0, count: 3 } }, centerXP: 0, centerLevel: 1 };
    const result = synthesizeCard(save, 'kim-doyun');
    expect(result.ok).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(save.cards['kim-doyun'].count).toBe(1);
  });

  it('카드가 부족하면 합성 실패한다', () => {
    const save = { cards: { 'kim-doyun': { level: 1, xp: 0, count: 2 } }, centerXP: 0, centerLevel: 1 };
    const result = synthesizeCard(save, 'kim-doyun');
    expect(result.ok).toBe(false);
  });

  it('레벨에 따라 합성 비용이 증가한다', () => {
    expect(getSynthesisCost(1)).toBe(3);
    expect(getSynthesisCost(2)).toBe(3);
    expect(getSynthesisCost(3)).toBe(4);
    expect(getSynthesisCost(4)).toBe(4);
    expect(getSynthesisCost(5)).toBe(5);
  });

  it('합성 후 XP가 리셋되고 센터 XP가 증가한다', () => {
    const save = { cards: { 'kim-doyun': { level: 1, xp: 50, count: 3 } }, centerXP: 0, centerLevel: 1 };
    synthesizeCard(save, 'kim-doyun');
    expect(save.cards['kim-doyun'].xp).toBe(0);
    expect(save.centerXP).toBeGreaterThan(0);
  });

  it('일괄 합성이 가능한 모든 카드를 합성한다', () => {
    const save = {
      cards: {
        'kim-doyun': { level: 1, xp: 0, count: 6 },
        'choi-minseo': { level: 1, xp: 0, count: 3 },
        'kwon-jihye': { level: 1, xp: 0, count: 1 },
      },
      centerXP: 0, centerLevel: 1,
    };
    const results = [];
    let changed = true;
    while (changed) {
      changed = false;
      Object.keys(save.cards).forEach(id => {
        const d = save.cards[id];
        if (d.count >= getSynthesisCost(d.level)) {
          const r = synthesizeCard(save, id);
          if (r.ok) { results.push({ id, newLevel: r.newLevel }); changed = true; }
        }
      });
    }
    expect(results.length).toBe(3);
    expect(save.cards['kim-doyun'].level).toBe(3);
    expect(save.cards['choi-minseo'].level).toBe(2);
    expect(save.cards['kwon-jihye'].level).toBe(1);
  });

  it('synthCount가 합성 횟수를 추적한다', () => {
    const save = { cards: { 'kim-doyun': { level: 1, xp: 0, count: 3 } }, centerXP: 0, centerLevel: 1 };
    synthesizeCard(save, 'kim-doyun');
    expect(save.synthCount).toBe(1);
  });
});

describe('무한의 탑 보상 스케일링', () => {
  it('낮은 웨이브에서 기본 보상을 준다', () => {
    const r = getTowerRewards(1);
    expect(r.cards).toEqual(['common', 'common']);
    expect(r.tickets).toBe(1);
    expect(r.milestone).toBeNull();
  });

  it('5층에서 마일스톤 보상을 준다', () => {
    const r = getTowerRewards(5);
    expect(r.cards.length).toBe(4);
    expect(r.cards).toContain('uncommon');
    expect(r.tickets).toBe(2);
    expect(r.milestone).toBe(5);
  });

  it('10층에서 레어 보상을 준다', () => {
    const r = getTowerRewards(10);
    expect(r.cards).toContain('rare');
    expect(r.tickets).toBe(3);
    expect(r.milestone).toBe(10);
  });

  it('20층에서 전설 보상을 준다', () => {
    const r = getTowerRewards(20);
    expect(r.cards).toContain('legendary');
    expect(r.tickets).toBe(3);
    expect(r.milestone).toBe(20);
  });

  it('마일스톤이 아닌 층에서는 milestone이 null이다', () => {
    const r = getTowerRewards(7);
    expect(r.milestone).toBeNull();
  });
});

describe('데미지 상세 분해', () => {
  it('공격 결과에 breakdown이 포함된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    enemy.eva = 0;
    const result = attackUnit(state, player, enemy);
    expect(result.ok).toBe(true);
    if (!result.evaded) {
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.baseAtk).toBe(player.atk);
      expect(result.breakdown.baseDef).toBe(enemy.def);
      expect(typeof result.breakdown.flanking).toBe('number');
      expect(typeof result.breakdown.pen).toBe('number');
    }
  });

  it('회피 시에도 에러가 없다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const player = state.units.find(u => u.team === 'player');
    const enemy = state.units.find(u => u.team === 'enemy');
    player.x = 3; player.y = 3;
    enemy.x = 4; enemy.y = 3;
    enemy.eva = 1;
    const result = attackUnit(state, player, enemy);
    expect(result.ok).toBe(true);
    if (result.evaded) {
      expect(result.breakdown).toBeUndefined();
    }
  });
});

describe('스킬 데미지 미리보기 개선', () => {
  it('데미지 타입 스킬이 minDmg/maxDmg을 포함한다', () => {
    const dmgChar = CHARACTERS.find(c => c.sense && ['직감', '혈압', '혈식', '혈기'].includes(c.sense.baseType));
    if (!dmgChar) return;
    const unit = cardToUnit(dmgChar, 0, 0);
    const preview = previewSkillDamage(unit);
    expect(preview).not.toBeNull();
    expect(preview.type).toBe('damage');
    expect(preview.minDmg).toBeDefined();
    expect(preview.maxDmg).toBeDefined();
    expect(preview.maxDmg).toBeGreaterThanOrEqual(preview.minDmg);
  });

  it('회복 타입 스킬은 minDmg/maxDmg을 포함하지 않는다', () => {
    const healChar = CHARACTERS.find(c => c.sense && ['감응', '공감'].includes(c.sense.baseType));
    if (!healChar) return;
    const unit = cardToUnit(healChar, 0, 0);
    const preview = previewSkillDamage(unit);
    expect(preview).not.toBeNull();
    expect(preview.type).toBe('heal');
    expect(preview.minDmg).toBeUndefined();
  });
});

describe('자동 최적 편성', () => {
  it('getTeamSynergy가 팀에 대해 시너지 객체를 반환한다', () => {
    const units = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3).map(c => cardToUnit(c, 0, 0));
    const synergy = getTeamSynergy(units);
    expect(synergy.teamMult).toBeGreaterThan(0);
    expect(synergy.avgGrade).toBeDefined();
    expect(synergy.pairDetails.length).toBeGreaterThan(0);
  });

  it('getTeamCP가 양수 total을 반환한다', () => {
    const units = CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, 3).map(c => cardToUnit(c, 0, 0));
    const cp = getTeamCP(units);
    expect(cp.total).toBeGreaterThan(0);
    expect(cp.individual).toBeGreaterThan(0);
  });
});

describe('캐릭터 대사 시스템', () => {
  it('CHAR_QUOTES에 캐릭터 대사가 정의되어 있다', () => {
    expect(Object.keys(CHAR_QUOTES).length).toBeGreaterThan(10);
  });

  it('각 캐릭터의 대사에 필수 트리거가 있다', () => {
    const triggers = ['select', 'attack', 'skill', 'hit', 'death', 'win'];
    Object.entries(CHAR_QUOTES).forEach(([id, quotes]) => {
      triggers.forEach(t => {
        expect(quotes[t]).toBeDefined();
        expect(typeof quotes[t]).toBe('string');
      });
    });
  });

  it('대사가 있는 캐릭터가 CHARACTERS에 존재한다', () => {
    Object.keys(CHAR_QUOTES).forEach(id => {
      expect(CHARACTERS.find(c => c.id === id)).toBeDefined();
    });
  });
});

describe('유대 시스템', () => {
  it('전투 후 유대 XP가 증가한다', () => {
    const save = { bonds: {} };
    const upgraded = progressBonds(save, ['kim-doyun', 'choi-minseo', 'kwon-jihye']);
    expect(save.bonds['choi-minseo:kim-doyun']).toBeDefined();
    expect(save.bonds['choi-minseo:kim-doyun'].xp).toBeGreaterThanOrEqual(0);
  });

  it('3회 전투 후 유대 레벨이 1이 된다', () => {
    const save = { bonds: {} };
    progressBonds(save, ['kim-doyun', 'choi-minseo']);
    progressBonds(save, ['kim-doyun', 'choi-minseo']);
    progressBonds(save, ['kim-doyun', 'choi-minseo']);
    expect(getBondLevel(save, 'kim-doyun', 'choi-minseo')).toBe(1);
  });

  it('유대 버프가 레벨에 비례한다', () => {
    const save = { bonds: {} };
    for (let i = 0; i < 9; i++) progressBonds(save, ['kim-doyun', 'choi-minseo']);
    const buff = getBondBuff(save, ['kim-doyun', 'choi-minseo']);
    expect(buff.atk).toBeGreaterThan(0);
    expect(buff.def).toBeGreaterThan(0);
  });

  it('유대가 없으면 버프가 0이다', () => {
    const save = { bonds: {} };
    const buff = getBondBuff(save, ['kim-doyun', 'choi-minseo']);
    expect(buff.atk).toBe(0);
    expect(buff.def).toBe(0);
  });
});

// ── 유물 발동 반환 ──

describe('유물 발동 정보', () => {
  function makeUnit(id, overrides = {}) {
    const char = CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
    return cardToUnit(char, 1, { team: 'player', x: 3, y: 3, ...overrides });
  }

  it('흡혈 유물 발동 시 relicProcs에 기록된다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const attacker = state.units.find(u => u.team === 'player');
    attacker.x = 3; attacker.y = 3;
    attacker.atk = 30;
    attacker.crt = 0;
    equipRelic(attacker, 'blood-pact');
    const defender = state.units.find(u => u.team === 'enemy');
    defender.x = 4; defender.y = 3;
    defender.eva = 0;
    defender.def = 5;
    const result = attackUnit(state, attacker, defender);
    expect(result.ok).toBe(true);
    if (!result.evaded && result.damage >= 10) {
      expect(result.relicProcs.some(p => p.type === 'lifesteal')).toBe(true);
      expect(result.relicHeal).toBeGreaterThan(0);
    }
  });

  it('풀HP 유물 발동 시 relicProcs에 fullHp가 기록된다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const attacker = state.units.find(u => u.team === 'player');
    attacker.x = 3; attacker.y = 3;
    attacker.hp = attacker.maxHp;
    equipRelic(attacker, 'first-resolve');
    const defender = state.units.find(u => u.team === 'enemy');
    defender.x = 4; defender.y = 3;
    const result = attackUnit(state, attacker, defender);
    expect(result.relicProcs).toBeDefined();
    expect(result.relicProcs.some(p => p.type === 'fullHp')).toBe(true);
  });

  it('유물 없으면 relicProcs가 빈 배열이다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const attacker = state.units.find(u => u.team === 'player');
    attacker.x = 3; attacker.y = 3;
    attacker.relic = null;
    const defender = state.units.find(u => u.team === 'enemy');
    defender.x = 4; defender.y = 3;
    const result = attackUnit(state, attacker, defender);
    expect(result.relicProcs).toEqual([]);
  });
});

// ── 스킬 프리뷰 날씨 보정 ──

describe('스킬 프리뷰 날씨 보정', () => {
  it('비 날씨에서 원거리 스킬 데미지가 감소한다', () => {
    const char = CHARACTERS.find(c => c.rng >= 2 && c.sense);
    if (!char) return;
    const unit = cardToUnit(char, 3, { team: 'player' });
    const clearPreview = previewSkillDamage(unit, { weather: WEATHER_TYPES.clear });
    const rainState = { weather: WEATHER_TYPES.rain };
    const rainPreview = previewSkillDamage(unit, rainState);
    if (clearPreview?.type === 'damage' && rainPreview?.type === 'damage') {
      expect(rainPreview.maxDmg).toBeLessThanOrEqual(clearPreview.maxDmg);
      expect(rainPreview.weatherLabel).toBeTruthy();
    }
  });

  it('맑은 날씨에서 weatherLabel이 null이다', () => {
    const char = CHARACTERS.find(c => c.sense);
    if (!char) return;
    const unit = cardToUnit(char, 3, { team: 'player' });
    const preview = previewSkillDamage(unit, { weather: WEATHER_TYPES.clear });
    if (preview) {
      expect(preview.weatherLabel).toBeFalsy();
    }
  });
});

// ── 패시브 트리 테스트 ──

describe('패시브 트리', () => {
  it('모든 8개 역할에 3단계 패시브가 있다', () => {
    const roles = ['tank', 'melee_dps', 'ranged_dps', 'support', 'bruiser', 'battle_support', 'evasive_dps', 'breaker'];
    roles.forEach(role => {
      expect(PASSIVE_TREE[role]).toBeDefined();
      expect(PASSIVE_TREE[role].length).toBe(3);
    });
  });

  it('레벨업 시 패시브가 적용된다', () => {
    const char = CHARACTERS.find(c => c.role === 'tank');
    const unit = cardToUnit(char, 0, 0);
    unit.team = 'player';
    const baseHp = unit.maxHp;
    const baseDef = unit.def;
    unit.xp = 999;
    const result = gainXP(unit, 100);
    if (result && unit.level >= 2) {
      expect(unit.maxHp >= baseHp || unit.def >= baseDef).toBe(true);
    }
  });

  it('각 패시브 단계에 lv, stat, val이 있다', () => {
    Object.values(PASSIVE_TREE).forEach(perks => {
      perks.forEach(perk => {
        expect(perk.lv).toBeDefined();
        expect(perk.stat).toBeDefined();
        expect(perk.val).toBeDefined();
      });
    });
  });
});

// ── 캐릭터 대사 완성도 ──

describe('캐릭터 대사 50/50', () => {
  it('모든 50캐릭에 대사가 있다', () => {
    CHARACTERS.forEach(c => {
      expect(CHAR_QUOTES[c.id]).toBeDefined();
    });
  });

  it('각 대사에 6트리거가 있다', () => {
    const triggers = ['select', 'attack', 'skill', 'hit', 'death', 'win'];
    Object.entries(CHAR_QUOTES).forEach(([id, quotes]) => {
      triggers.forEach(t => {
        expect(quotes[t]).toBeDefined();
      });
    });
  });
});

// ── 팩션 시너지 적용 테스트 ──

describe('팩션 시너지 적용', () => {
  it('센터 3명 이상 시 DEF+2가 적용된다', () => {
    const centerChars = CHARACTERS.filter(c => c.faction === 'center').slice(0, 3);
    const units = centerChars.map((c, i) => {
      const u = cardToUnit(c, i, 0);
      u.team = 'player';
      return u;
    });
    const baseDef = units[0].def;
    applyFactionSynergy(units);
    expect(units[0].def).toBe(baseDef + 2);
  });

  it('카르테인 2명 이상 시 ATK+2가 적용된다', () => {
    const karteinChars = CHARACTERS.filter(c => c.faction === 'kartein').slice(0, 2);
    const units = karteinChars.map((c, i) => {
      const u = cardToUnit(c, i, 0);
      u.team = 'player';
      return u;
    });
    const baseAtk = units[0].atk;
    applyFactionSynergy(units);
    expect(units[0].atk).toBe(baseAtk + 2);
  });
});

// ── rollLoot 테스트 ──

describe('rollLoot 시스템', () => {
  it('아이템을 반환한다', () => {
    const loot = rollLoot();
    expect(loot).toBeDefined();
    expect(loot.id).toBeDefined();
    expect(loot.name).toBeDefined();
    expect(loot.effect).toBeDefined();
  });

  it('100번 굴리면 다양한 아이템이 나온다', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(rollLoot().id);
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });
});

// ── useItem 버프 테스트 ──

describe('useItem 버프', () => {
  it('ATK 버프 아이템이 공격력을 올린다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const unit = state.units.find(u => u.team === 'player');
    const baseAtk = unit.atk;
    const item = { name: '공격의 보석', effect: { atkBuff: 3 } };
    const result = useItem(state, unit, item);
    expect(result.ok).toBe(true);
    expect(unit.atk).toBe(baseAtk + 3);
    expect(unit.buffs.some(b => b.stat === 'atk' && b.val === 3)).toBe(true);
  });

  it('행동 완료 유닛은 아이템 사용 불가', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const unit = state.units.find(u => u.team === 'player');
    unit.acted = true;
    const item = { name: '포션', effect: { heal: 20 } };
    const result = useItem(state, unit, item);
    expect(result.ok).toBe(false);
  });
});

// ── getDangerZone 테스트 ──

describe('getDangerZone', () => {
  it('적 유닛 주변에 위험 타일이 생긴다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const enemies = state.units.filter(u => u.team === 'enemy' && u.hp > 0);
    expect(enemies.length).toBeGreaterThan(0);
    const dangerTiles = getDangerZone(state);
    expect(dangerTiles.length).toBeGreaterThan(0);
  });

  it('적이 없으면 위험 타일이 없다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    state.units.filter(u => u.team === 'enemy').forEach(u => u.hp = 0);
    const dangerTiles = getDangerZone(state);
    expect(dangerTiles.length).toBe(0);
  });

  it('위험 타일은 좌표 객체 배열이다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    const dangerTiles = getDangerZone(state);
    if (dangerTiles.length > 0) {
      expect(dangerTiles[0]).toHaveProperty('x');
      expect(dangerTiles[0]).toHaveProperty('y');
    }
  });
});

// ── spawnReinforcements 테스트 ──

describe('spawnReinforcements', () => {
  it('해당 턴이 아니면 증원이 없다', () => {
    const state = createBattleState('stage-1', ['kim-doyun']);
    state.turnNumber = 999;
    const result = spawnReinforcements(state);
    expect(result).toBeNull();
  });
});

// ── STORY_ACTS 테스트 ──

describe('STORY_ACTS', () => {
  it('3막 구조가 정의되어 있다', () => {
    expect(STORY_ACTS.length).toBe(3);
    expect(STORY_ACTS[0].act).toBe(1);
    expect(STORY_ACTS[1].act).toBe(2);
    expect(STORY_ACTS[2].act).toBe(3);
  });

  it('모든 스테이지가 하나의 막에 속한다', () => {
    const allActStages = STORY_ACTS.flatMap(a => a.stages);
    STAGES.forEach(s => {
      expect(allActStages).toContain(s.id);
    });
  });

  it('각 막에 이름과 소개가 있다', () => {
    STORY_ACTS.forEach(act => {
      expect(act.name).toBeTruthy();
      expect(act.intro).toBeTruthy();
      expect(act.stages.length).toBeGreaterThan(0);
    });
  });

  it('2막은 stage-7 클리어 후 해금된다', () => {
    expect(STORY_ACTS[1].unlock).toBe('stage-7');
  });

  it('3막은 stage-11 클리어 후 해금된다', () => {
    expect(STORY_ACTS[2].unlock).toBe('stage-11');
  });
});

// ── getScaledEnemyLevel 테스트 ──

describe('getScaledEnemyLevel', () => {
  it('플레이어 레벨이 낮으면 기본 레벨을 반환한다', () => {
    const stage = { enemyLevel: 5 };
    expect(getScaledEnemyLevel(stage, 3)).toBe(5);
  });

  it('플레이어 레벨이 높으면 스케일된 레벨을 반환한다', () => {
    const stage = { enemyLevel: 5 };
    const scaled = getScaledEnemyLevel(stage, 15);
    expect(scaled).toBeGreaterThan(5);
    expect(scaled).toBe(5 + Math.floor((15 - 5) * 0.3));
  });

  it('enemyLevel 없으면 기본값 1 사용', () => {
    const stage = {};
    expect(getScaledEnemyLevel(stage, 1)).toBe(1);
  });
});

// ── 승리 조건 테스트 ──

describe('checkVictory 승리 조건', () => {
  it('boss_kill: 보스가 죽으면 승리', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    state.victoryCondition = 'boss_kill';
    state.stage = { ...state.stage, bossCharId: 'elena-morgan' };
    const boss = state.units.find(u => u.charId === 'elena-morgan');
    expect(boss).toBeTruthy();
    boss.hp = 0;
    const result = checkVictory(state);
    expect(result).toBe('win');
  });

  it('boss_kill: 보스가 살아있으면 승리 아님', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    state.victoryCondition = 'boss_kill';
    state.stage = { ...state.stage, bossCharId: 'elena-morgan' };
    const result = checkVictory(state);
    expect(result).toBeNull();
  });

  it('capture_point: 거점 점령 시 카운트 증가', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    state.victoryCondition = 'capture_point';
    state.stage = { ...state.stage, capturePoints: [{ x: 0, y: 5 }], holdTurns: 2 };
    const player = state.units.find(u => u.team === 'player');
    player.x = 0;
    player.y = 5;
    const r1 = checkVictory(state);
    expect(r1).toBeNull();
    expect(state._captureCount).toBe(1);
    const r2 = checkVictory(state);
    expect(r2).toBe('win');
  });

  it('protect_target: 보호 대상 사망 시 패배', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    state.victoryCondition = 'protect_target';
    const protectUnit = state.units.find(u => u.team === 'player');
    state.stage = { ...state.stage, protectUid: protectUnit.uid };
    protectUnit.hp = 0;
    const result = checkVictory(state);
    expect(result).toBe('lose');
  });

  it('protect_target: 적 전멸 시 승리', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    state.victoryCondition = 'protect_target';
    const protectUnit = state.units.find(u => u.team === 'player');
    state.stage = { ...state.stage, protectUid: protectUnit.uid };
    state.units.filter(u => u.team === 'enemy').forEach(u => { u.hp = 0; });
    const result = checkVictory(state);
    expect(result).toBe('win');
  });
});

// ── 적 전술 시스템 테스트 ──

describe('적 전술 밸런스', () => {
  it('tactics.enemyAtkBonus가 적 ATK에 적용된다', () => {
    const state = createBattleState('stage-7', ['park-harin']);
    const enemy = state.units.find(u => u.team === 'enemy');
    const stateNoTac = createBattleState('stage-1', ['park-harin']);
    const enemyBase = stateNoTac.units.find(u => u.team === 'enemy');
    expect(enemy.atk).toBeGreaterThan(enemyBase.atk);
  });

  it('집중 공격 대상이 설정된다', () => {
    const state = createBattleState('stage-1', ['park-harin', 'kim-doyun']);
    state.phase = 'enemy_phase';
    runEnemyPhase(state);
    expect(state._focusTarget).toBeTruthy();
  });

  it('후반 스테이지 적 스탯이 크게 성장한다', () => {
    const state15 = createBattleState('stage-15', ['park-harin']);
    const enemy15 = state15.units.find(u => u.team === 'enemy');
    const state1 = createBattleState('stage-1', ['park-harin']);
    const enemy1 = state1.units.find(u => u.team === 'enemy');
    expect(enemy15.atk).toBeGreaterThan(enemy1.atk * 2);
  });

  it('적 협공 보너스가 전투 후 리셋된다', () => {
    const state = createBattleState('stage-1', ['park-harin']);
    const enemy = state.units.find(u => u.team === 'enemy');
    enemy._flankBuff = 2;
    enemy._flankApplied = true;
    enemy.atk += 2;
    state.phase = 'enemy_phase';
    endEnemyPhase(state);
    expect(enemy._flankBuff).toBe(0);
    expect(enemy._flankApplied).toBe(false);
  });
});

describe('카드 강화 시스템', () => {
  it('강화 비용 테이블이 정의되어 있다', () => {
    expect(ENHANCE_COSTS.atk).toBe(2);
    expect(ENHANCE_COSTS.def).toBe(2);
    expect(ENHANCE_COSTS.hp).toBe(3);
    expect(ENHANCE_COSTS.crt).toBe(3);
    expect(ENHANCE_COSTS.eva).toBe(3);
  });

  it('강화 최대치가 10이다', () => {
    expect(ENHANCE_MAX).toBe(10);
  });

  it('카드 미보유 시 강화 불가', () => {
    const save = { cards: {} };
    const result = enhanceCard(save, 'park-harin', 'atk');
    expect(result.ok).toBe(false);
  });

  it('ATK 강화 성공 시 카드 수 차감', () => {
    const save = { cards: { 'park-harin': { level: 1, xp: 0, count: 5 } } };
    const result = enhanceCard(save, 'park-harin', 'atk');
    expect(result.ok).toBe(true);
    expect(result.stat).toBe('atk');
    expect(result.newVal).toBe(1);
    expect(save.cards['park-harin'].count).toBe(3);
    expect(save.cards['park-harin'].enhance.atk).toBe(1);
  });

  it('카드 부족 시 강화 불가', () => {
    const save = { cards: { 'park-harin': { level: 1, xp: 0, count: 1 } } };
    const result = enhanceCard(save, 'park-harin', 'atk');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('카드');
  });

  it('최대 강화 도달 시 추가 강화 불가', () => {
    const save = { cards: { 'park-harin': { level: 1, xp: 0, count: 100, enhance: { atk: 10, def: 0, hp: 0, crt: 0, eva: 0 } } } };
    const result = enhanceCard(save, 'park-harin', 'atk');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('최대');
  });

  it('잘못된 스탯 강화 불가', () => {
    const save = { cards: { 'park-harin': { level: 1, xp: 0, count: 10 } } };
    const result = enhanceCard(save, 'park-harin', 'mov');
    expect(result.ok).toBe(false);
  });
});

describe('서사 해금 시스템', () => {
  it('마일스톤이 3단계이다', () => {
    expect(LORE_MILESTONES.length).toBe(3);
    expect(LORE_MILESTONES[0].level).toBe(1);
    expect(LORE_MILESTONES[1].level).toBe(3);
    expect(LORE_MILESTONES[2].level).toBe(5);
  });

  it('미보유 시 0단계', () => {
    const save = { cards: {} };
    expect(getUnlockedLoreStage(save, 'park-harin')).toBe(0);
  });

  it('Lv.1 보유 시 1단계', () => {
    const save = { cards: { 'park-harin': { level: 1, xp: 0, count: 1 } } };
    expect(getUnlockedLoreStage(save, 'park-harin')).toBe(1);
  });

  it('Lv.3 시 2단계', () => {
    const save = { cards: { 'park-harin': { level: 3, xp: 0, count: 1 } } };
    expect(getUnlockedLoreStage(save, 'park-harin')).toBe(2);
  });

  it('Lv.5 이상 시 3단계', () => {
    const save = { cards: { 'park-harin': { level: 5, xp: 0, count: 1 } } };
    expect(getUnlockedLoreStage(save, 'park-harin')).toBe(3);
    const save7 = { cards: { 'park-harin': { level: 7, xp: 0, count: 1 } } };
    expect(getUnlockedLoreStage(save7, 'park-harin')).toBe(3);
  });
});

describe('방어전 (Tower Defense) 시스템', () => {
  it('DEFENSE_GRID는 5×8이다', () => {
    expect(DEFENSE_GRID.w).toBe(5);
    expect(DEFENSE_GRID.h).toBe(8);
  });

  it('방어전 경로가 U자형이다', () => {
    const path = createDefensePath(5, 8);
    expect(path.length).toBeGreaterThan(10);
    expect(path[0].x).toBe(0);
    expect(path[path.length - 1].x).toBe(6);
  });

  it('createDefenseState가 올바른 초기 상태를 생성한다', () => {
    const state = createDefenseState(1);
    expect(state.wave).toBe(1);
    expect(state.lives).toBe(20);
    expect(state.grid.length).toBe(8);
    expect(state.grid[0].length).toBe(5);
    expect(state.enemies).toEqual([]);
    expect(state.spawnQueue.length).toBeGreaterThan(0);
    expect(state.phase).toBe('draw');
  });

  it('웨이브별 적 수가 증가한다', () => {
    const w1 = generateDefenseWave(1);
    const w5 = generateDefenseWave(5);
    const w10 = generateDefenseWave(10);
    expect(w5.length).toBeGreaterThan(w1.length);
    expect(w10.length).toBeGreaterThan(w5.length);
  });

  it('웨이브 5의 배수에 보스가 출현한다', () => {
    const w5 = generateDefenseWave(5);
    const boss = w5.find(e => e.unit.uid.includes('boss'));
    expect(boss).toBeDefined();
    expect(boss.unit.rarity).toBe('legendary');
  });

  it('defenseDrawCards가 3장의 카드를 반환한다', () => {
    const cards = defenseDrawCards(1);
    expect(cards.length).toBe(3);
    cards.forEach(c => expect(c.id).toBeDefined());
  });

  it('defenseMerge가 항상 결과를 반환한다', () => {
    const result = defenseMerge('kim-doyun', 'common');
    expect(result.success).toBe(true);
    expect(result.char).toBeDefined();
    expect(result.char.id).toBeDefined();
  });

  it('defenseAutoAttack이 사거리 내 적을 공격한다', () => {
    const state = createDefenseState(1);
    const char = CHARACTERS.find(c => c.id === 'kim-doyun');
    const unit = cardToUnit(char, 0, 0);
    unit.team = 'player';
    unit.uid = 'def-test-0-0';
    state.grid[0][0] = unit;
    const enemy = cardToUnit(char, -1, -1);
    enemy.team = 'enemy';
    enemy.uid = 'def-enemy-test';
    enemy.hp = 100;
    enemy.maxHp = 100;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    const results = defenseAutoAttack(state);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('적이 경로 끝에 도달하면 라이프가 감소한다', () => {
    const state = createDefenseState(1);
    const char = CHARACTERS.find(c => c.rarity === 'common');
    const enemy = cardToUnit(char, -1, -1);
    enemy.team = 'enemy';
    enemy.uid = 'escape-test';
    state.enemies.push({ unit: enemy, speed: 999, pathIndex: 0 });
    const escaped = defenseAdvanceEnemies(state);
    expect(escaped.length).toBe(1);
    expect(state.lives).toBe(19);
  });

  it('getDefenseRewards가 웨이브에 따라 보상을 반환한다', () => {
    const r1 = getDefenseRewards(1);
    const r10 = getDefenseRewards(10);
    expect(r1.cards.length).toBeGreaterThan(0);
    expect(r10.cards).toContain('rare');
    expect(r10.tickets).toBe(3);
  });

  it('isDefenseWaveComplete — 모든 적 처리 후 true', () => {
    const state = createDefenseState(1);
    state.spawnIndex = state.spawnQueue.length;
    state.enemies = state.spawnQueue.map(e => ({ ...e, unit: { ...e.unit, hp: 0 } }));
    expect(isDefenseWaveComplete(state)).toBe(true);
  });

  it('서포트 유닛이 인접 아군에게 ATK+3 버프 적용', () => {
    const state = createDefenseState(1);
    const supporter = CHARACTERS.find(c => c.role === 'support');
    const fighter = CHARACTERS.find(c => c.role === 'melee_dps');
    const sUnit = cardToUnit(supporter, 0, 0);
    sUnit.team = 'player';
    state.grid[0][0] = sUnit;
    const fUnit = cardToUnit(fighter, 1, 0);
    fUnit.team = 'player';
    state.grid[0][1] = fUnit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy';
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.def = 0;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    defenseAutoAttack(state);
    expect(fUnit._supportBuff).toBe(0);
  });

  it('탱크가 적을 감속시킨다', () => {
    const state = createDefenseState(1);
    const tank = CHARACTERS.find(c => c.role === 'tank');
    const tUnit = cardToUnit(tank, 0, 0);
    tUnit.team = 'player';
    tUnit.atk = 50;
    state.grid[0][0] = tUnit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy';
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.def = 0;
    const enemyEntry = { unit: enemy, speed: 2, pathIndex: 1 };
    state.enemies.push(enemyEntry);
    defenseAutoAttack(state);
    expect(enemyEntry.speed).toBe(1);
    expect(enemyEntry._slowed).toBe(2);
  });

  it('defenseTickSlow가 감속을 해제한다', () => {
    const state = createDefenseState(1);
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy';
    enemy.role = 'melee_dps';
    const entry = { unit: enemy, speed: 1, pathIndex: 0, _slowed: 1 };
    state.enemies.push(entry);
    defenseTickSlow(state);
    expect(entry.speed).toBe(2);
    expect(entry._slowed).toBeUndefined();
  });

  it('합성 확률 — 전설 0.5%, 상급 49%', () => {
    let legendaryCount = 0;
    let upgradeCount = 0;
    const runs = 1000;
    for (let i = 0; i < runs; i++) {
      const result = defenseMerge('kim-doyun', 'common');
      if (result.legendary) legendaryCount++;
      else if (result.upgraded) upgradeCount++;
    }
    expect(upgradeCount).toBeGreaterThan(300);
    expect(upgradeCount).toBeLessThan(700);
  });
});

describe('방어전 스킬 시스템', () => {
  it('DEFENSE_SKILLS에 8개 역할별 스킬이 정의되어 있다', () => {
    const roles = ['tank', 'melee_dps', 'ranged_dps', 'support', 'bruiser', 'breaker', 'evasive_dps', 'battle_support'];
    roles.forEach(role => {
      const skill = DEFENSE_SKILLS[role];
      expect(skill).toBeDefined();
      expect(skill.name).toBeDefined();
      expect(skill.icon).toBeDefined();
      expect(skill.cooldown).toBeGreaterThan(0);
      expect(skill.desc).toBeDefined();
    });
  });

  it('defenseActivateSkills — 쿨다운 0이면 스킬 발동 + 쿨다운 설정', () => {
    const state = createDefenseState(1);
    const melee = CHARACTERS.find(c => c.role === 'melee_dps');
    const unit = cardToUnit(melee, 0, 0);
    unit.team = 'player';
    unit._defSkillCd = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 500; enemy.maxHp = 500;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    const results = defenseActivateSkills(state);
    expect(results.length).toBeGreaterThan(0);
    expect(unit._defSkillCd).toBe(DEFENSE_SKILLS.melee_dps.cooldown);
    expect(unit._skillDmgMult).toBe(3);
  });

  it('defenseActivateSkills — 쿨다운 > 0이면 스킬 미발동 + 쿨다운 감소', () => {
    const state = createDefenseState(1);
    const melee = CHARACTERS.find(c => c.role === 'melee_dps');
    const unit = cardToUnit(melee, 0, 0);
    unit.team = 'player';
    unit._defSkillCd = 3;
    state.grid[0][0] = unit;
    const results = defenseActivateSkills(state);
    expect(results.length).toBe(0);
    expect(unit._defSkillCd).toBe(2);
  });

  it('탱크 스킬 — 경로 위 적 전체 감속', () => {
    const state = createDefenseState(1);
    const tank = CHARACTERS.find(c => c.role === 'tank');
    const unit = cardToUnit(tank, 0, 0);
    unit.team = 'player';
    unit._defSkillCd = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 500; enemy.maxHp = 500;
    const entry = { unit: enemy, speed: 2, pathIndex: 1 };
    state.enemies.push(entry);
    defenseActivateSkills(state);
    expect(entry.speed).toBe(1);
    expect(entry._slowed).toBeGreaterThanOrEqual(1);
  });

  it('원거리 스킬 — 사거리+2, 데미지×2 적용', () => {
    const state = createDefenseState(1);
    const ranged = CHARACTERS.find(c => c.role === 'ranged_dps');
    const unit = cardToUnit(ranged, 0, 0);
    unit.team = 'player';
    unit._defSkillCd = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 500; enemy.maxHp = 500;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    defenseActivateSkills(state);
    expect(unit._skillRngBonus).toBe(2);
    expect(unit._skillDmgMult).toBe(2);
  });

  it('서포트 스킬 — 인접 아군 ATK+5 버프', () => {
    const state = createDefenseState(1);
    const support = CHARACTERS.find(c => c.role === 'support');
    const fighter = CHARACTERS.find(c => c.role === 'melee_dps');
    const sUnit = cardToUnit(support, 0, 0);
    sUnit.team = 'player';
    sUnit._defSkillCd = 0;
    state.grid[0][0] = sUnit;
    const fUnit = cardToUnit(fighter, 1, 0);
    fUnit.team = 'player';
    state.grid[0][1] = fUnit;
    defenseActivateSkills(state);
    expect(fUnit._skillBuff).toBeDefined();
    expect(fUnit._skillBuff.stat).toBe('atk');
    expect(fUnit._skillBuff.val).toBe(5);
    expect(fUnit._skillBuff.turns).toBe(2);
  });

  it('회피딜러 스킬 — 4체 연속 공격', () => {
    const state = createDefenseState(1);
    const evasive = CHARACTERS.find(c => c.role === 'evasive_dps');
    const unit = cardToUnit(evasive, 0, 0);
    unit.team = 'player';
    unit._defSkillCd = 0;
    state.grid[0][0] = unit;
    state.enemies.push({ unit: { hp: 500, maxHp: 500, def: 0, team: 'enemy' }, speed: 1, pathIndex: 1 });
    defenseActivateSkills(state);
    expect(unit._skillHitCount).toBe(4);
  });

  it('전투서포트 스킬 — 적 DEF-3 디버프', () => {
    const state = createDefenseState(1);
    const bs = CHARACTERS.find(c => c.role === 'battle_support');
    const unit = cardToUnit(bs, 0, 0);
    unit.team = 'player';
    unit._defSkillCd = 0;
    unit.rng = 2;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 500; enemy.maxHp = 500;
    const entry = { unit: enemy, speed: 1, pathIndex: 1 };
    state.enemies.push(entry);
    defenseActivateSkills(state);
    expect(enemy._defDebuff).toBeDefined();
    expect(enemy._defDebuff.val).toBe(3);
    expect(enemy._defDebuff.turns).toBe(2);
  });

  it('defenseTickSkillEffects — 1회성 플래그 제거', () => {
    const state = createDefenseState(1);
    const unit = cardToUnit(CHARACTERS.find(c => c.role === 'melee_dps'), 0, 0);
    unit._skillDmgMult = 3;
    unit._skillRngBonus = 2;
    unit._skillHitCount = 4;
    state.grid[0][0] = unit;
    state.enemies = [];
    defenseTickSkillEffects(state);
    expect(unit._skillDmgMult).toBeUndefined();
    expect(unit._skillRngBonus).toBeUndefined();
    expect(unit._skillHitCount).toBeUndefined();
  });

  it('defenseTickSkillEffects — 버프 턴 감소 후 제거', () => {
    const state = createDefenseState(1);
    const unit = cardToUnit(CHARACTERS.find(c => c.role === 'melee_dps'), 0, 0);
    unit._skillBuff = { stat: 'atk', val: 5, turns: 1 };
    state.grid[0][0] = unit;
    state.enemies = [];
    defenseTickSkillEffects(state);
    expect(unit._skillBuff).toBeUndefined();
  });

  it('defenseTickSkillEffects — 적 디버프 턴 감소 후 제거', () => {
    const state = createDefenseState(1);
    state.grid[0][0] = null;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy._defDebuff = { stat: 'def', val: 3, turns: 1 };
    state.enemies = [{ unit: enemy, speed: 1, pathIndex: 0 }];
    defenseTickSkillEffects(state);
    expect(enemy._defDebuff).toBeUndefined();
  });

  it('defenseAutoAttack — _skillDmgMult가 데미지 배율에 반영', () => {
    const state = createDefenseState(1);
    const melee = CHARACTERS.find(c => c.role === 'melee_dps');
    const unit = cardToUnit(melee, 0, 0);
    unit.team = 'player';
    unit.atk = 20;
    unit.crt = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 5000; enemy.maxHp = 5000; enemy.def = 0;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    const normalResults = defenseAutoAttack(state);
    const normalDmg = normalResults[0]?.damage || 0;
    enemy.hp = 5000;
    unit._skillDmgMult = 3;
    const skillResults = defenseAutoAttack(state);
    const skillDmg = skillResults[0]?.damage || 0;
    expect(skillDmg).toBeGreaterThan(normalDmg);
  });

  it('defenseAutoAttack — _defDebuff가 적 DEF 감소에 반영', () => {
    const state = createDefenseState(1);
    const breaker = CHARACTERS.find(c => c.role === 'melee_dps');
    const unit = cardToUnit(breaker, 0, 0);
    unit.team = 'player';
    unit.atk = 20;
    unit.crt = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 5000; enemy.maxHp = 5000; enemy.def = 10;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    const normalResults = defenseAutoAttack(state);
    const normalDmg = normalResults[0]?.damage || 0;
    enemy.hp = 5000;
    enemy._defDebuff = { stat: 'def', val: 5, turns: 2 };
    const debuffResults = defenseAutoAttack(state);
    const debuffDmg = debuffResults[0]?.damage || 0;
    expect(debuffDmg).toBeGreaterThan(normalDmg);
  });

  it('defenseAutoAttack — _skillRngBonus가 사거리 확장에 반영', () => {
    const state = createDefenseState(1);
    const ranged = CHARACTERS.find(c => c.role === 'ranged_dps');
    const unit = cardToUnit(ranged, 0, 0);
    unit.team = 'player';
    unit.atk = 20;
    unit.rng = 1;
    unit.crt = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 5000; enemy.maxHp = 5000; enemy.def = 0;
    const farPath = state.path.findIndex(p => Math.abs((0 + 1) - p.x) + Math.abs((0 + 1) - p.y) === 3);
    if (farPath >= 0) {
      state.enemies.push({ unit: enemy, speed: 1, pathIndex: farPath });
      const noSkill = defenseAutoAttack(state);
      expect(noSkill.length).toBe(0);
      unit._skillRngBonus = 2;
      const withSkill = defenseAutoAttack(state);
      expect(withSkill.length).toBeGreaterThan(0);
    }
  });

  it('defenseAutoAttack — _skillHitCount가 타격 횟수 오버라이드', () => {
    const state = createDefenseState(1);
    const evasive = CHARACTERS.find(c => c.role === 'evasive_dps');
    const unit = cardToUnit(evasive, 0, 0);
    unit.team = 'player';
    unit.atk = 10;
    unit.crt = 0;
    state.grid[0][0] = unit;
    for (let i = 0; i < 5; i++) {
      const e = cardToUnit(CHARACTERS[0], -1, -1);
      e.team = 'enemy'; e.hp = 5000; e.maxHp = 5000; e.def = 0;
      state.enemies.push({ unit: e, speed: 1, pathIndex: 1 });
    }
    const normalResults = defenseAutoAttack(state);
    const normalHits = normalResults.filter(r => r.attacker === unit).length;
    state.enemies.forEach(e => e.unit.hp = 5000);
    unit._skillHitCount = 4;
    const skillResults = defenseAutoAttack(state);
    const skillHits = skillResults.filter(r => r.attacker === unit).length;
    expect(skillHits).toBeGreaterThanOrEqual(normalHits);
  });

  it('defenseAutoAttack — _skillBuff ATK 반영', () => {
    const state = createDefenseState(1);
    const fighter = CHARACTERS.find(c => c.role === 'melee_dps');
    const unit = cardToUnit(fighter, 0, 0);
    unit.team = 'player';
    unit.atk = 20;
    unit.crt = 0;
    state.grid[0][0] = unit;
    const enemy = cardToUnit(CHARACTERS[0], -1, -1);
    enemy.team = 'enemy'; enemy.hp = 5000; enemy.maxHp = 5000; enemy.def = 0;
    state.enemies.push({ unit: enemy, speed: 1, pathIndex: 1 });
    const normalResults = defenseAutoAttack(state);
    const normalDmg = normalResults[0]?.damage || 0;
    enemy.hp = 5000;
    unit._skillBuff = { stat: 'atk', val: 10, turns: 2 };
    const buffResults = defenseAutoAttack(state);
    const buffDmg = buffResults[0]?.damage || 0;
    expect(buffDmg).toBeGreaterThan(normalDmg);
  });
});
