import { describe, it, expect } from 'vitest';
import {
  createGameState, drawCards, playCharacter, collectBlood,
  activateNextRequest, fulfillRequest, failRequest, checkGameEnd,
  settleTurn, advanceTurn, shuffle, runFullTurn, buyEquipment,
  recruitCharacter, refreshRecruitShop, nightInvestigate, nightPromote,
  calculateComboBonuses, DIFFICULTIES, generateDilemma, resolveDilemma, convertBlood,
  activateSense, calculateSensePassives,
  generateRouteMap, selectRouteNode, applyRestNode, applyEventNode, NODE_TYPES,
} from '../src/web-mvp/js/engine.js';
import { CHARACTERS, createBloodCard, STARTER_REQUESTS, generateRandomRequest, COMBO_BONUSES, DILEMMA_EVENTS, SENSE_TYPES } from '../src/web-mvp/js/cards.js';

describe('createGameState', () => {
  it('초기 상태가 올바르게 생성된다', () => {
    const state = createGameState();
    expect(state.turn).toBe(1);
    expect(state.phase).toBe('dawn');
    expect(state.resources.bp).toBe(10);
    expect(state.resources.rep).toBe(50);
    expect(state.resources.sus).toBe(0);
    expect(state.deck.length).toBeGreaterThan(0);
    expect(state.hand).toEqual([]);
    expect(state.completedRequests).toBe(0);
    expect(state.gameOver).toBe(false);
  });
});

describe('drawCards', () => {
  it('덱에서 카드를 드로우한다', () => {
    const state = createGameState();
    const deckSize = state.deck.length;
    drawCards(state, 5);
    expect(state.hand.length).toBe(5);
    expect(state.deck.length).toBe(deckSize - 5);
  });

  it('덱이 비면 버린 카드 더미를 재구성한다', () => {
    const state = createGameState();
    state.discardPile = [...state.deck];
    state.deck = [];
    drawCards(state, 3);
    expect(state.hand.length).toBe(3);
    expect(state.discardPile.length).toBe(0);
  });

  it('덱과 버린 카드 더미 모두 비면 가능한 만큼만 드로우한다', () => {
    const state = createGameState();
    state.deck = [createBloodCard('A')];
    state.discardPile = [];
    drawCards(state, 5);
    expect(state.hand.length).toBe(1);
  });
});

describe('playCharacter', () => {
  it('인물 카드를 필드에 배치한다', () => {
    const state = createGameState();
    const char = { ...CHARACTERS[1], type: 'character', instanceId: 'test' };
    state.hand = [char];
    state.resources.bp = 10;
    const result = playCharacter(state, 0);
    expect(result.ok).toBe(true);
    expect(state.field.length).toBe(1);
    expect(state.hand.length).toBe(0);
  });

  it('BP 부족 시 배치 실패', () => {
    const state = createGameState();
    const char = { ...CHARACTERS[0], type: 'character', instanceId: 'test' };
    state.hand = [char];
    state.resources.bp = 0;
    const result = playCharacter(state, 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('BP 부족');
  });

  it('인물 카드가 아니면 실패', () => {
    const state = createGameState();
    state.hand = [createBloodCard('A')];
    const result = playCharacter(state, 0);
    expect(result.ok).toBe(false);
  });
});

describe('collectBlood', () => {
  it('필드의 인물로부터 BP를 수집한다', () => {
    const state = createGameState();
    const collector = { ...CHARACTERS[1], type: 'character', instanceId: 'test' };
    state.field = [collector];
    const prevBP = state.resources.bp;
    collectBlood(state);
    expect(state.resources.bp).toBeGreaterThan(prevBP);
  });
});

describe('fulfillRequest', () => {
  it('혈액이 충분하면 의뢰를 이행한다', () => {
    const state = createGameState();
    state.activeRequest = {
      id: 'test-req', name: '테스트 의뢰',
      requirements: { A: 1 },
      reward: { bp: 5 },
      penalty: { sus: 10 },
      turnsLeft: 3,
    };
    state.bloodPool = [createBloodCard('A'), createBloodCard('B')];
    const result = fulfillRequest(state);
    expect(result.ok).toBe(true);
    expect(state.completedRequests).toBe(1);
    expect(state.bloodPool.length).toBe(1);
  });

  it('혈액 부족 시 의뢰 이행 실패', () => {
    const state = createGameState();
    state.activeRequest = {
      id: 'test-req', name: '테스트 의뢰',
      requirements: { AB: 3 },
      reward: { bp: 5 },
      penalty: { sus: 10 },
      turnsLeft: 3,
    };
    state.bloodPool = [createBloodCard('A')];
    const result = fulfillRequest(state);
    expect(result.ok).toBe(false);
  });
});

describe('checkGameEnd', () => {
  it('5개 의뢰 완료 시 승리', () => {
    const state = createGameState();
    state.completedRequests = 5;
    expect(checkGameEnd(state)).toBe('win');
    expect(state.gameOver).toBe(true);
    expect(state.winner).toBe(true);
  });

  it('REP 0 이하 시 패배', () => {
    const state = createGameState();
    state.resources.rep = 0;
    expect(checkGameEnd(state)).toBe('lose-rep');
  });

  it('SUS 100 이상 시 패배', () => {
    const state = createGameState();
    state.resources.sus = 100;
    expect(checkGameEnd(state)).toBe('lose-sus');
  });

  it('게임 진행 중이면 null', () => {
    const state = createGameState();
    expect(checkGameEnd(state)).toBeNull();
  });
});

describe('settleTurn', () => {
  it('핸드를 3장 이하로 줄인다', () => {
    const state = createGameState();
    state.hand = [
      createBloodCard('A'), createBloodCard('B'),
      createBloodCard('O'), createBloodCard('AB'),
      createBloodCard('A'),
    ];
    settleTurn(state);
    expect(state.hand.length).toBeLessThanOrEqual(3);
  });

  it('필드 카드를 버린 카드 더미로 옮긴다', () => {
    const state = createGameState();
    const char = { ...CHARACTERS[0], type: 'character', instanceId: 'test' };
    state.field = [char];
    settleTurn(state);
    expect(state.field.length).toBe(0);
    expect(state.discardPile.length).toBeGreaterThan(0);
  });
});

describe('runFullTurn', () => {
  it('한 턴을 자동으로 진행한다', () => {
    const state = createGameState();
    const result = runFullTurn(state);
    expect(state.turn).toBeGreaterThanOrEqual(1);
    expect(state.log.length).toBeGreaterThan(0);
  });

  it('게임 오버 상태에서는 실행하지 않는다', () => {
    const state = createGameState();
    state.gameOver = true;
    runFullTurn(state);
    expect(state.log.length).toBe(0);
  });
});

describe('buyEquipment', () => {
  it('장비를 구매하고 설치한다', () => {
    const state = createGameState();
    state.resources.bp = 20;
    const equipId = state.shopEquipment[0].id;
    const result = buyEquipment(state, equipId);
    expect(result.ok).toBe(true);
    expect(state.equipment.length).toBe(1);
    expect(state.shopEquipment.find(e => e.id === equipId)).toBeUndefined();
  });

  it('BP 부족 시 구매 실패', () => {
    const state = createGameState();
    state.resources.bp = 0;
    const result = buyEquipment(state, state.shopEquipment[0].id);
    expect(result.ok).toBe(false);
  });

  it('이미 설치된 장비는 재구매 불가', () => {
    const state = createGameState();
    state.resources.bp = 50;
    const eq = state.shopEquipment[0];
    buyEquipment(state, eq.id);
    state.shopEquipment.push({ ...eq });
    const result = buyEquipment(state, eq.id);
    expect(result.ok).toBe(false);
  });
});

describe('recruitCharacter', () => {
  it('캐릭터를 영입하고 덱에 추가한다', () => {
    const state = createGameState();
    refreshRecruitShop(state);
    state.resources.bp = 50;
    const char = state.recruitShop[0];
    const deckBefore = state.deck.length;
    const result = recruitCharacter(state, char.id);
    expect(result.ok).toBe(true);
    expect(state.deck.length).toBe(deckBefore + 1);
    expect(state.recruitShop.find(c => c.id === char.id)).toBeUndefined();
  });

  it('BP 부족 시 영입 실패', () => {
    const state = createGameState();
    refreshRecruitShop(state);
    state.resources.bp = 0;
    const result = recruitCharacter(state, state.recruitShop[0].id);
    expect(result.ok).toBe(false);
  });
});

describe('nightInvestigate / nightPromote', () => {
  it('조사로 SUS를 감소시킨다', () => {
    const state = createGameState();
    state.resources.sus = 30;
    const result = nightInvestigate(state);
    expect(result.ok).toBe(true);
    expect(state.resources.sus).toBeLessThan(30);
    expect(state.nightActionTaken).toBe(true);
  });

  it('홍보로 REP를 증가시킨다', () => {
    const state = createGameState();
    const repBefore = state.resources.rep;
    const result = nightPromote(state);
    expect(result.ok).toBe(true);
    expect(state.resources.rep).toBeGreaterThan(repBefore);
  });

  it('야간 행동은 1턴에 1회만 가능', () => {
    const state = createGameState();
    nightInvestigate(state);
    const result = nightPromote(state);
    expect(result.ok).toBe(false);
  });
});

describe('generateRandomRequest', () => {
  it('랜덤 의뢰를 생성한다', () => {
    const req = generateRandomRequest(1, 1);
    expect(req.id).toBeDefined();
    expect(req.requirements).toBeDefined();
    expect(Object.keys(req.requirements).length).toBeGreaterThan(0);
    expect(req.reward.bp).toBeGreaterThan(0);
    expect(req.penalty.sus).toBeGreaterThan(0);
    expect(req.turnsLeft).toBeGreaterThanOrEqual(2);
  });

  it('후반 의뢰는 요구량이 더 많다', () => {
    const early = generateRandomRequest(1, 1);
    const late = generateRandomRequest(5, 20);
    const earlyTotal = Object.values(early.requirements).reduce((a, b) => a + b, 0);
    const lateTotal = Object.values(late.requirements).reduce((a, b) => a + b, 0);
    expect(lateTotal).toBeGreaterThanOrEqual(earlyTotal);
  });
});

describe('activateNextRequest (random)', () => {
  it('의뢰를 랜덤 생성한다', () => {
    const state = createGameState();
    activateNextRequest(state);
    expect(state.activeRequest).not.toBeNull();
    expect(state.activeRequest.requirements).toBeDefined();
  });

  it('5개 완료 후 더 이상 의뢰가 생성되지 않는다', () => {
    const state = createGameState();
    state.completedRequests = 5;
    activateNextRequest(state);
    expect(state.activeRequest).toBeNull();
  });
});

describe('createGameState with difficulty', () => {
  it('쉬움 난이도는 BP 15, REP 70으로 시작', () => {
    const state = createGameState('easy');
    expect(state.resources.bp).toBe(15);
    expect(state.resources.rep).toBe(70);
    expect(state.diffSettings.susPerTurn).toBe(1);
  });

  it('어려움 난이도는 BP 7, REP 35, SUS 10으로 시작', () => {
    const state = createGameState('hard');
    expect(state.resources.bp).toBe(7);
    expect(state.resources.rep).toBe(35);
    expect(state.resources.sus).toBe(10);
    expect(state.diffSettings.susPerTurn).toBe(3);
  });
});

describe('shuffle', () => {
  it('배열의 길이를 유지한다', () => {
    const arr = [1, 2, 3, 4, 5];
    shuffle(arr);
    expect(arr.length).toBe(5);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('calculateComboBonuses', () => {
  it('같은 팩션이 threshold 이상이면 콤보가 발동한다', () => {
    const state = createGameState();
    const karteinChars = CHARACTERS.filter(c => c.faction === 'kartein');
    state.field = [
      { ...karteinChars[0], type: 'character', instanceId: 'a' },
      { ...karteinChars[1], type: 'character', instanceId: 'b' },
    ];
    const combos = calculateComboBonuses(state);
    expect(combos.active.length).toBeGreaterThan(0);
    expect(combos.susReduction).toBeGreaterThan(0);
  });

  it('threshold 미만이면 콤보가 발동하지 않는다', () => {
    const state = createGameState();
    const center = CHARACTERS.find(c => c.faction === 'center');
    const kartein = CHARACTERS.find(c => c.faction === 'kartein');
    const neutral = CHARACTERS.find(c => c.faction === 'neutral');
    state.field = [
      { ...center, type: 'character', instanceId: 'a' },
      { ...kartein, type: 'character', instanceId: 'b' },
      { ...neutral, type: 'character', instanceId: 'c' },
    ];
    const combos = calculateComboBonuses(state);
    expect(combos.active.length).toBe(0);
  });

  it('필드가 비면 콤보 없음', () => {
    const state = createGameState();
    state.field = [];
    const combos = calculateComboBonuses(state);
    expect(combos.active.length).toBe(0);
    expect(combos.bpBonus).toBe(0);
  });

  it('여러 threshold를 넘으면 콤보가 중첩 발동된다', () => {
    const state = createGameState();
    const karteinChars = CHARACTERS.filter(c => c.faction === 'kartein');
    state.field = [
      { ...karteinChars[0], type: 'character', instanceId: 'a' },
      { ...karteinChars[1], type: 'character', instanceId: 'b' },
      { ...karteinChars[2], type: 'character', instanceId: 'c' },
    ];
    const combos = calculateComboBonuses(state);
    expect(combos.active.length).toBe(2);
  });

  it('collectBlood에서 콤보 보너스가 적용된다', () => {
    const state = createGameState();
    const karteinCollectors = CHARACTERS.filter(c => c.faction === 'kartein' && c.ability.type === 'collect');
    state.field = [
      { ...karteinCollectors[0], type: 'character', instanceId: 'a' },
      { ...karteinCollectors[1], type: 'character', instanceId: 'b' },
    ];
    state.resources.sus = 20;
    const prevSUS = state.resources.sus;
    collectBlood(state);
    expect(state.resources.sus).toBeLessThan(prevSUS);
    expect(state.comboActivations).toBeGreaterThan(0);
  });
});

describe('gameState tracking fields', () => {
  it('maxCollect와 comboActivations가 초기화된다', () => {
    const state = createGameState();
    expect(state.maxCollect).toBe(0);
    expect(state.comboActivations).toBe(0);
  });
});

describe('dilemma system', () => {
  it('딜레마 이벤트가 12개 이상 정의되어 있다', () => {
    expect(DILEMMA_EVENTS.length).toBeGreaterThanOrEqual(12);
  });

  it('딜레마를 생성한다', () => {
    const state = createGameState();
    const dilemma = generateDilemma(state);
    expect(dilemma).toBeDefined();
    expect(dilemma.choices.length).toBe(2);
    expect(dilemma.narration).toBeDefined();
  });

  it('딜레마 선택이 자원을 변경한다', () => {
    const state = createGameState();
    const dilemma = generateDilemma(state);
    const repBefore = state.resources.rep;
    const bpBefore = state.resources.bp;
    const susBefore = state.resources.sus;
    const result = resolveDilemma(state, dilemma, 0);
    expect(result.ok).toBe(true);
    expect(state.nightActionTaken).toBe(true);
    const changed = state.resources.rep !== repBefore || state.resources.bp !== bpBefore || state.resources.sus !== susBefore;
    expect(changed).toBe(true);
  });

  it('사용된 딜레마를 추적한다', () => {
    const state = createGameState();
    const dilemma = generateDilemma(state);
    resolveDilemma(state, dilemma, 0);
    expect(state.usedDilemmas).toContain(dilemma.id);
  });

  it('딜레마가 중복되지 않는다', () => {
    const state = createGameState();
    const seen = new Set();
    for (let i = 0; i < DILEMMA_EVENTS.length; i++) {
      const d = generateDilemma(state);
      expect(seen.has(d.id)).toBe(false);
      seen.add(d.id);
      resolveDilemma(state, d, 0);
    }
  });
});

describe('ability types', () => {
  it('request_discount는 의뢰 이행 시 SUS 비용을 줄인다', () => {
    const state = createGameState();
    const duke = CHARACTERS.find(c => c.ability.type === 'request_discount');
    state.field = [{ ...duke, type: 'character', instanceId: 'a' }];
    state.bloodPool = [createBloodCard('A'), createBloodCard('B')];
    activateNextRequest(state);
    const susBefore = state.resources.sus;
    const req = state.activeRequest;
    if (req) {
      const needed = Object.entries(req.requirements);
      state.bloodPool = [];
      for (const [bt, count] of needed) {
        for (let i = 0; i < count; i++) state.bloodPool.push(createBloodCard(bt));
      }
      fulfillRequest(state);
    }
    expect(state.log.some(l => l.includes('할인'))).toBe(true);
  });

  it('transport는 의뢰 이행 시 BP 보너스를 준다', () => {
    const state = createGameState();
    const driver = CHARACTERS.find(c => c.ability.type === 'transport');
    state.field = [{ ...driver, type: 'character', instanceId: 'a' }];
    activateNextRequest(state);
    const req = state.activeRequest;
    if (req) {
      const needed = Object.entries(req.requirements);
      state.bloodPool = [];
      for (const [bt, count] of needed) {
        for (let i = 0; i < count; i++) state.bloodPool.push(createBloodCard(bt));
      }
      const bpBefore = state.resources.bp;
      fulfillRequest(state);
      expect(state.log.some(l => l.includes('운송 보너스'))).toBe(true);
    }
  });

  it('convert로 혈액형을 변환할 수 있다', () => {
    const state = createGameState();
    const butler = CHARACTERS.find(c => c.ability.type === 'convert');
    state.field = [{ ...butler, type: 'character', instanceId: 'a' }];
    state.bloodPool = [createBloodCard('A')];
    const result = convertBlood(state, 0, 'O');
    expect(result.ok).toBe(true);
    expect(state.bloodPool[0].bloodType).toBe('O');
  });

  it('convert는 필드에 변환자가 없으면 실패한다', () => {
    const state = createGameState();
    state.bloodPool = [createBloodCard('A')];
    const result = convertBlood(state, 0, 'O');
    expect(result.ok).toBe(false);
  });

  it('audit는 배치 시 SUS를 감소시킨다', () => {
    const state = createGameState();
    state.resources.sus = 20;
    const auditor = CHARACTERS.find(c => c.ability.type === 'audit');
    state.hand = [{ ...auditor, type: 'character', instanceId: 'a' }];
    playCharacter(state, 0);
    expect(state.resources.sus).toBeLessThan(20);
  });

  it('research는 donate 혈액 생성을 증가시킨다', () => {
    const state = createGameState();
    const researcher = CHARACTERS.find(c => c.ability.type === 'research');
    const donor = CHARACTERS.find(c => c.ability.type === 'donate');
    state.field = [
      { ...researcher, type: 'character', instanceId: 'a' },
      { ...donor, type: 'character', instanceId: 'b' },
    ];
    state.bloodPool = [];
    collectBlood(state);
    expect(state.bloodPool.length).toBe(donor.ability.value + researcher.ability.value);
  });

  it('onField 효과가 정산 시 적용된다', () => {
    const state = createGameState();
    const duke = CHARACTERS.find(c => c.ability.onField);
    if (duke) {
      state.field = [{ ...duke, type: 'character', instanceId: 'a' }];
      const susBefore = state.resources.sus;
      settleTurn(state);
      if (duke.ability.onField.sus > 0) {
        expect(state.resources.sus).toBeGreaterThan(susBefore);
      }
    }
  });

  it('onCollect 효과가 수집 시 적용된다', () => {
    const state = createGameState();
    const seoyeon = CHARACTERS.find(c => c.id === 'lee-seoyeon');
    state.field = [{ ...seoyeon, type: 'character', instanceId: 'a' }];
    state.resources.sus = 20;
    collectBlood(state);
    expect(state.resources.sus).toBeLessThan(20);
  });
});

describe('촉/혈 sense system', () => {
  it('SENSE_TYPES에 12종 스킬이 정의되어 있다', () => {
    expect(Object.keys(SENSE_TYPES).length).toBe(12);
    expect(SENSE_TYPES['예감'].category).toBe('촉');
    expect(SENSE_TYPES['혈식'].category).toBe('혈');
  });

  it('촉 6종이 각각 혈 스킬을 카운터한다', () => {
    const humanSkills = Object.entries(SENSE_TYPES).filter(([, v]) => v.category === '촉');
    expect(humanSkills.length).toBe(6);
    humanSkills.forEach(([, v]) => {
      expect(SENSE_TYPES[v.counters]).toBeDefined();
      expect(SENSE_TYPES[v.counters].category).toBe('혈');
    });
  });

  it('모든 캐릭터에 sense가 정의되어 있다', () => {
    CHARACTERS.forEach(c => {
      expect(c.sense).toBeDefined();
      expect(c.sense.name).toBeTruthy();
      expect(c.sense.baseType).toBeTruthy();
      expect(c.sense.power).toBeGreaterThan(0);
      expect(SENSE_TYPES[c.sense.baseType]).toBeDefined();
    });
  });

  it('센터/뉴트럴 캐릭터는 촉 스킬을 가진다', () => {
    CHARACTERS.filter(c => c.faction !== 'kartein').forEach(c => {
      expect(SENSE_TYPES[c.sense.baseType].category).toBe('촉');
    });
  });

  it('카르테인 캐릭터는 혈 스킬을 가진다', () => {
    CHARACTERS.filter(c => c.faction === 'kartein').forEach(c => {
      expect(SENSE_TYPES[c.sense.baseType].category).toBe('혈');
    });
  });

  it('activateSense로 촉 스킬을 발동한다', () => {
    const state = createGameState();
    const harin = CHARACTERS.find(c => c.id === 'park-harin');
    state.hand = [{ ...harin, type: 'character', instanceId: 'a' }];
    state.phase = 'morning';
    const repBefore = state.resources.rep;
    const result = activateSense(state, 0);
    expect(result.ok).toBe(true);
    expect(state.senseUsedThisTurn).toBe(true);
    expect(state.resources.rep).toBeGreaterThan(repBefore);
  });

  it('한 턴에 촉/혈 스킬은 1회만 사용 가능하다', () => {
    const state = createGameState();
    const harin = CHARACTERS.find(c => c.id === 'park-harin');
    state.hand = [
      { ...harin, type: 'character', instanceId: 'a' },
      { ...harin, type: 'character', instanceId: 'b' },
    ];
    activateSense(state, 0);
    const result = activateSense(state, 1);
    expect(result.ok).toBe(false);
  });

  it('촉 스킬이 필드의 혈 스킬을 카운터한다', () => {
    const state = createGameState();
    const seoha = CHARACTERS.find(c => c.id === 'kim-seoha');
    const duke = CHARACTERS.find(c => c.id === 'kartein-duke');
    state.field = [{ ...duke, type: 'character', instanceId: 'enemy' }];
    state.hand = [{ ...seoha, type: 'character', instanceId: 'a' }];
    const result = activateSense(state, 0);
    expect(result.ok).toBe(true);
  });

  it('정산 시 senseUsedThisTurn이 리셋된다', () => {
    const state = createGameState();
    state.senseUsedThisTurn = true;
    state.sensePreview = {};
    settleTurn(state);
    expect(state.senseUsedThisTurn).toBe(false);
    expect(state.sensePreview).toBeNull();
  });

  it('감응은 필드 인간 수에 비례하여 REP 보너스를 준다', () => {
    const state = createGameState();
    const soyul = CHARACTERS.find(c => c.id === 'han-soyul');
    const doyun = CHARACTERS.find(c => c.id === 'kim-doyun');
    state.field = [
      { ...doyun, type: 'character', instanceId: 'a' },
      { ...doyun, type: 'character', instanceId: 'b' },
      { ...doyun, type: 'character', instanceId: 'c' },
    ];
    state.hand = [{ ...soyul, type: 'character', instanceId: 'd' }];
    const repBefore = state.resources.rep;
    activateSense(state, 0);
    expect(state.resources.rep).toBeGreaterThan(repBefore);
  });
});

describe('route map system', () => {
  it('15층 루트 맵을 생성한다', () => {
    const map = generateRouteMap(15);
    expect(map.floors.length).toBe(15);
    expect(map.currentFloor).toBe(0);
    expect(map.completed).toBe(false);
  });

  it('첫 층은 노드 1개, 마지막 층은 보스 1개', () => {
    const map = generateRouteMap(15);
    expect(map.floors[0].length).toBe(1);
    expect(map.floors[0][0].type).toBe('operation');
    expect(map.floors[14].length).toBe(1);
    expect(map.floors[14][0].type).toBe('boss');
  });

  it('첫 노드만 available이다', () => {
    const map = generateRouteMap(15);
    expect(map.floors[0][0].available).toBe(true);
    map.floors.slice(1).forEach(floor => {
      floor.forEach(node => expect(node.available).toBe(false));
    });
  });

  it('노드 선택 후 다음 층 노드가 available 된다', () => {
    const state = createGameState();
    state.routeMap = generateRouteMap(15);
    const firstNode = state.routeMap.floors[0][0];
    const result = selectRouteNode(state, firstNode.id);
    expect(result.ok).toBe(true);
    expect(firstNode.visited).toBe(true);
    const hasAvailable = state.routeMap.floors[1].some(n => n.available);
    expect(hasAvailable).toBe(true);
  });

  it('available이 아닌 노드는 선택할 수 없다', () => {
    const state = createGameState();
    state.routeMap = generateRouteMap(15);
    const secondFloorNode = state.routeMap.floors[1][0];
    const result = selectRouteNode(state, secondFloorNode.id);
    expect(result.ok).toBe(false);
  });

  it('NODE_TYPES에 7종 노드가 정의되어 있다', () => {
    expect(Object.keys(NODE_TYPES).length).toBe(7);
    expect(NODE_TYPES.boss).toBeDefined();
    expect(NODE_TYPES.rest).toBeDefined();
  });

  it('휴식 노드는 REP 증가 SUS 감소', () => {
    const state = createGameState();
    state.resources.sus = 20;
    const repBefore = state.resources.rep;
    const susBefore = state.resources.sus;
    applyRestNode(state);
    expect(state.resources.rep).toBeGreaterThan(repBefore);
    expect(state.resources.sus).toBeLessThan(susBefore);
  });

  it('보스 노드 선택 시 completed가 true가 된다', () => {
    const state = createGameState();
    state.routeMap = generateRouteMap(3);
    // Navigate to boss
    selectRouteNode(state, state.routeMap.floors[0][0].id);
    const availableSecond = state.routeMap.floors[1].find(n => n.available);
    if (availableSecond) selectRouteNode(state, availableSecond.id);
    const boss = state.routeMap.floors[2].find(n => n.available);
    if (boss) {
      const result = selectRouteNode(state, boss.id);
      expect(result.ok).toBe(true);
      expect(state.routeMap.completed).toBe(true);
    }
  });
});

describe('expanded characters', () => {
  it('50명의 캐릭터가 정의되어 있다', () => {
    expect(CHARACTERS.length).toBe(50);
  });

  it('모든 팩션에 캐릭터가 있다', () => {
    const factions = [...new Set(CHARACTERS.map(c => c.faction))];
    expect(factions).toContain('center');
    expect(factions).toContain('kartein');
    expect(factions).toContain('neutral');
  });

  it('COMBO_BONUSES에 3개 팩션이 정의되어 있다', () => {
    expect(Object.keys(COMBO_BONUSES)).toEqual(['center', 'kartein', 'neutral']);
  });
});
