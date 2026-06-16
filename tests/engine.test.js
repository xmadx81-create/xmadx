import { describe, it, expect } from 'vitest';
import {
  createGameState, drawCards, playCharacter, collectBlood,
  activateNextRequest, fulfillRequest, failRequest, checkGameEnd,
  settleTurn, advanceTurn, shuffle, runFullTurn, buyEquipment,
  recruitCharacter, refreshRecruitShop, nightInvestigate, nightPromote,
  DIFFICULTIES,
} from '../src/web-mvp/js/engine.js';
import { CHARACTERS, createBloodCard, STARTER_REQUESTS, generateRandomRequest } from '../src/web-mvp/js/cards.js';

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
