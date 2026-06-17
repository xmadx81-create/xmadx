import { CHARACTERS, BLOOD_TYPES, STARTER_REQUESTS, EVENTS, DILEMMA_EVENTS, EQUIPMENT, COMBO_BONUSES, SENSE_TYPES, createBloodCard, generateRandomRequest } from './cards.js';

export const PHASES = ['dawn', 'morning', 'afternoon', 'night', 'settlement'];
export const PHASE_NAMES = { dawn: '새벽', morning: '오전', afternoon: '오후', night: '야간', settlement: '정산' };

export const DIFFICULTIES = {
  easy:   { label: '쉬움', bp: 15, rep: 70, sus: 0, susPerTurn: 1, eventChance: 0.25 },
  normal: { label: '보통', bp: 10, rep: 50, sus: 0, susPerTurn: 2, eventChance: 0.4 },
  hard:   { label: '어려움', bp: 7, rep: 35, sus: 10, susPerTurn: 3, eventChance: 0.55 },
};

export function createGameState(difficulty = 'normal') {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
  const deck = buildStarterDeck();
  shuffle(deck);

  return {
    turn: 1,
    phase: 'dawn',
    difficulty,
    diffSettings: diff,
    resources: { bp: diff.bp, rep: diff.rep, sus: diff.sus },
    deck,
    hand: [],
    field: [],
    equipment: [],
    shopEquipment: shuffle([...EQUIPMENT]),
    bloodPool: [],
    discardPile: [],
    requestQueue: [],
    activeRequest: null,
    completedRequests: 0,
    nextRequestNum: 1,
    recruitShop: [],
    nightActionTaken: false,
    senseUsedThisTurn: false,
    sensePreview: null,
    senseSuppress: false,
    usedDilemmas: [],
    gameOver: false,
    winner: false,
    maxCollect: 0,
    comboActivations: 0,
    log: [],
  };
}

export function refreshRecruitShop(state) {
  const pool = CHARACTERS.filter(c => c.rarity !== 'common');
  const picks = [];
  const shuffled = shuffle([...pool]);
  for (let i = 0; i < Math.min(3, shuffled.length); i++) {
    picks.push({ ...shuffled[i], recruitCost: shuffled[i].cost + 2 });
  }
  state.recruitShop = picks;
}

export function recruitCharacter(state, charId) {
  const idx = state.recruitShop.findIndex(c => c.id === charId);
  if (idx < 0) return { ok: false, reason: '모집 대상을 찾을 수 없습니다' };
  const char = state.recruitShop[idx];
  if (state.resources.bp < char.recruitCost) return { ok: false, reason: `BP 부족 (필요: ${char.recruitCost})` };

  state.resources.bp -= char.recruitCost;
  const instance = { ...char, type: 'character', instanceId: `${char.id}-${Math.random().toString(36).slice(2, 6)}` };
  delete instance.recruitCost;
  state.deck.push(instance);
  state.recruitShop.splice(idx, 1);
  state.log.push(`${char.name} 영입! (BP -${char.recruitCost}) → 덱에 추가됨`);
  return { ok: true };
}

export function nightInvestigate(state) {
  if (state.nightActionTaken) return { ok: false, reason: '이미 야간 행동을 수행했습니다' };
  const reduction = 4 + Math.floor(Math.random() * 4);
  state.resources.sus = Math.max(0, state.resources.sus - reduction);
  state.nightActionTaken = true;
  state.log.push(`야간 조사 수행: SUS -${reduction} (현재: ${state.resources.sus})`);
  return { ok: true, value: reduction };
}

export function nightPromote(state) {
  if (state.nightActionTaken) return { ok: false, reason: '이미 야간 행동을 수행했습니다' };
  const boost = 3 + Math.floor(Math.random() * 3);
  state.resources.rep += boost;
  state.nightActionTaken = true;
  state.log.push(`야간 홍보 활동: REP +${boost} (현재: ${state.resources.rep})`);
  return { ok: true, value: boost };
}

export function buyEquipment(state, equipId) {
  const idx = state.shopEquipment.findIndex(e => e.id === equipId);
  if (idx < 0) return { ok: false, reason: '장비를 찾을 수 없습니다' };
  const eq = state.shopEquipment[idx];
  if (state.resources.bp < eq.cost) return { ok: false, reason: `BP 부족 (필요: ${eq.cost}, 보유: ${state.resources.bp})` };
  if (state.equipment.find(e => e.id === equipId)) return { ok: false, reason: '이미 설치된 장비입니다' };

  state.resources.bp -= eq.cost;
  state.equipment.push(eq);
  state.shopEquipment.splice(idx, 1);
  state.log.push(`장비 설치: ${eq.name} (BP -${eq.cost}) — ${eq.description}`);
  return { ok: true };
}

function buildStarterDeck() {
  const deck = [];
  const starters = CHARACTERS.filter(c => c.rarity === 'common');
  starters.forEach(c => {
    for (let copy = 0; copy < 3; copy++) {
      deck.push({ ...c, type: 'character', instanceId: `${c.id}-${Math.random().toString(36).slice(2, 6)}` });
    }
  });
  BLOOD_TYPES.forEach(bt => {
    for (let i = 0; i < 2; i++) {
      deck.push(createBloodCard(bt));
    }
  });
  return deck;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function calculateComboBonuses(state) {
  const factionCounts = {};
  state.field.forEach(card => {
    if (card.faction) factionCounts[card.faction] = (factionCounts[card.faction] || 0) + 1;
  });

  const result = { bpBonus: 0, repBonus: 0, susReduction: 0, bloodCards: 0, active: [] };

  for (const [faction, count] of Object.entries(factionCounts)) {
    const combos = COMBO_BONUSES[faction];
    if (!combos) continue;
    for (const combo of combos) {
      if (count >= combo.threshold) {
        result.bpBonus += combo.effects.bpBonus || 0;
        result.repBonus += combo.effects.repBonus || 0;
        result.susReduction += combo.effects.susReduction || 0;
        result.bloodCards += combo.effects.bloodCards || 0;
        result.active.push(combo);
      }
    }
  }

  return result;
}

export function drawCards(state, count = 5) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (state.deck.length === 0) {
      if (state.discardPile.length === 0) break;
      state.deck = shuffle([...state.discardPile]);
      state.discardPile = [];
      state.log.push('덱 재구성: 버린 카드 더미를 섞어 새 덱 생성');
    }
    drawn.push(state.deck.pop());
  }
  state.hand.push(...drawn);
  state.log.push(`${drawn.length}장 드로우`);
  return drawn;
}

export function playCharacter(state, handIndex) {
  const card = state.hand[handIndex];
  if (!card || card.type !== 'character') return { ok: false, reason: '인물 카드가 아닙니다' };
  if (state.resources.bp < card.cost) return { ok: false, reason: 'BP 부족' };

  state.resources.bp -= card.cost;
  state.hand.splice(handIndex, 1);
  state.field.push(card);
  state.log.push(`${card.name} 배치 (BP -${card.cost})`);

  if (card.ability.type === 'reputation') {
    state.resources.rep += card.ability.value;
    state.log.push(`${card.name} 효과: REP +${card.ability.value}`);
  }

  if (card.ability.type === 'audit') {
    state.resources.sus = Math.max(0, state.resources.sus - card.ability.value);
    const nextEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    state.log.push(`${card.name} 감사: SUS -${card.ability.value}. 다음 이벤트 정보: "${nextEvent.name}"`);
  }

  if (card.ability.onPlay) {
    for (const [key, val] of Object.entries(card.ability.onPlay)) {
      state.resources[key] = (state.resources[key] || 0) + val;
    }
  }

  return { ok: true };
}

export function collectBlood(state) {
  let totalCollected = 0;
  const equipBonus = state.equipment.reduce((sum, eq) => sum + (eq.effect.collectBonus || 0), 0);
  const researchBonus = state.field.filter(c => c.ability.type === 'research').reduce((sum, c) => sum + c.ability.value, 0);

  state.field.forEach(card => {
    if (card.ability.type === 'collect') {
      const amount = card.ability.value + equipBonus;
      totalCollected += amount;

      if (card.ability.onCollect) {
        for (const [key, val] of Object.entries(card.ability.onCollect)) {
          state.resources[key] = (state.resources[key] || 0) + val;
          if (val < 0) state.resources[key] = Math.max(0, state.resources[key]);
        }
      }
    }
    if (card.ability.type === 'donate') {
      const donateCount = card.ability.value + researchBonus;
      for (let i = 0; i < donateCount; i++) {
        const bt = BLOOD_TYPES[Math.floor(Math.random() * BLOOD_TYPES.length)];
        state.bloodPool.push(createBloodCard(bt));
      }
      if (researchBonus > 0) {
        state.log.push(`연구 보너스: 혈액 생성 +${researchBonus}`);
      }
    }
    if (card.ability.type === 'research') {
      state.log.push(`${card.name}: 혈액 효율 +${card.ability.value} 적용 중`);
    }
  });

  const combos = calculateComboBonuses(state);
  totalCollected += combos.bpBonus;
  state.resources.rep += combos.repBonus;
  state.resources.sus = Math.max(0, state.resources.sus - combos.susReduction);
  for (let i = 0; i < combos.bloodCards; i++) {
    const bt = BLOOD_TYPES[Math.floor(Math.random() * BLOOD_TYPES.length)];
    state.bloodPool.push(createBloodCard(bt));
  }
  if (combos.active.length > 0) {
    state.comboActivations += combos.active.length;
    state.log.push(`콤보 발동: ${combos.active.map(c => c.label).join(', ')}`);
  }

  state.resources.bp += totalCollected;
  if (totalCollected > state.maxCollect) state.maxCollect = totalCollected;

  for (let i = state.hand.length - 1; i >= 0; i--) {
    if (state.hand[i].type === 'blood') {
      state.bloodPool.push(state.hand.splice(i, 1)[0]);
    }
  }

  state.log.push(`오후 수집: BP +${totalCollected}, 혈액 풀 ${state.bloodPool.length}장`);
  return totalCollected;
}

export function activateNextRequest(state) {
  if (state.activeRequest) return state.activeRequest;
  if (state.completedRequests >= 5) return null;
  state.activeRequest = generateRandomRequest(state.nextRequestNum, state.turn);
  state.nextRequestNum++;
  state.log.push(`새 의뢰 도착: ${state.activeRequest.name}`);
  return state.activeRequest;
}

export function fulfillRequest(state) {
  const req = state.activeRequest;
  if (!req) return { ok: false, reason: '활성 의뢰 없음' };

  const needed = { ...req.requirements };
  const used = [];

  for (const [bt, count] of Object.entries(needed)) {
    const available = state.bloodPool.filter(b => b.bloodType === bt);
    if (available.length < count) {
      return { ok: false, reason: `${bt}형 혈액 부족 (필요: ${count}, 보유: ${available.length})` };
    }
    for (let i = 0; i < count; i++) {
      const idx = state.bloodPool.findIndex(b => b.bloodType === bt);
      used.push(state.bloodPool.splice(idx, 1)[0]);
    }
  }

  const discount = state.field.filter(c => c.ability.type === 'request_discount').reduce((sum, c) => sum + c.ability.value, 0);
  const transportBonus = state.field.filter(c => c.ability.type === 'transport').reduce((sum, c) => sum + c.ability.value, 0);

  const bpReward = (req.reward.bp || 0) + transportBonus;
  if (bpReward) state.resources.bp += bpReward;
  if (req.reward.rep) state.resources.rep += req.reward.rep;
  const susCost = Math.max(0, 3 + state.completedRequests * 3 - discount);
  state.resources.sus += susCost;

  if (discount > 0) state.log.push(`의뢰 할인: SUS 비용 -${discount}`);
  if (transportBonus > 0) state.log.push(`운송 보너스: BP +${transportBonus}`);

  state.completedRequests++;
  state.log.push(`의뢰 이행 완료: ${req.name} (완료: ${state.completedRequests}/5)`);
  state.activeRequest = null;

  return { ok: true, reward: req.reward };
}

export function failRequest(state) {
  const req = state.activeRequest;
  if (!req) return;

  if (req.penalty.sus) state.resources.sus += req.penalty.sus;
  if (req.penalty.rep) state.resources.rep += req.penalty.rep;

  state.log.push(`의뢰 실패: ${req.name} (SUS +${req.penalty.sus || 0})`);
  state.activeRequest = null;
}

export function processEvent(state) {
  const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  for (const [key, val] of Object.entries(event.effect)) {
    state.resources[key] = (state.resources[key] || 0) + val;
  }
  state.resources.rep = Math.max(0, state.resources.rep);
  state.resources.sus = Math.max(0, state.resources.sus);
  state.log.push(`이벤트: ${event.name} — ${event.description}`);
  return event;
}

export function convertBlood(state, fromIndex, targetType) {
  if (fromIndex < 0 || fromIndex >= state.bloodPool.length) return { ok: false, reason: '변환할 혈액이 없습니다' };
  if (!BLOOD_TYPES.includes(targetType)) return { ok: false, reason: '잘못된 혈액형입니다' };
  const hasConverter = state.field.some(c => c.ability.type === 'convert');
  if (!hasConverter) return { ok: false, reason: '변환 능력 보유 캐릭터가 필드에 없습니다' };
  const old = state.bloodPool[fromIndex].bloodType;
  state.bloodPool[fromIndex].bloodType = targetType;
  state.log.push(`혈액 변환: ${old}형 → ${targetType}형`);
  return { ok: true };
}

export function activateSense(state, handIndex) {
  const card = state.hand[handIndex];
  if (!card || !card.sense) return { ok: false, reason: '촉/혈 스킬이 없는 카드입니다' };
  if (state.senseUsedThisTurn) return { ok: false, reason: '이번 턴에 이미 촉/혈 스킬을 사용했습니다' };

  const sense = card.sense;
  const senseInfo = SENSE_TYPES[sense.baseType];
  if (!senseInfo) return { ok: false, reason: '알 수 없는 스킬 타입' };

  const result = { ok: true, sense, countered: [] };

  if (sense.effects?.onPlay) {
    for (const [key, val] of Object.entries(sense.effects.onPlay)) {
      state.resources[key] = (state.resources[key] || 0) + val;
      if (key === 'rep' || key === 'bp') state.resources[key] = Math.max(0, state.resources[key]);
    }
  }

  if (senseInfo.category === '촉') {
    const counterTarget = senseInfo.counters;
    const enemiesCountered = state.field.filter(c => c.sense?.baseType === counterTarget);
    enemiesCountered.forEach(enemy => {
      if (enemy.sense.effects?.onField) {
        for (const [key, val] of Object.entries(enemy.sense.effects.onField)) {
          const reverse = val > 0 ? -val : Math.abs(val);
          state.resources[key] = (state.resources[key] || 0) + reverse;
        }
      }
      result.countered.push(enemy.name);
    });

    if (sense.baseType === '감응') {
      const humanCount = state.field.filter(c => c.faction !== 'kartein').length;
      const resonanceBonus = Math.floor(humanCount * sense.power * 0.3);
      if (resonanceBonus > 0) {
        state.resources.rep += resonanceBonus;
        state.log.push(`감응 공명: 필드 인간 ${humanCount}명 → REP +${resonanceBonus}`);
      }
    }

    if (sense.baseType === '예감') {
      const nextEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      state.sensePreview = nextEvent;
      state.log.push(`예감 발동: 다음 이벤트 예지 — "${nextEvent.name}"`);
    }

    if (sense.baseType === '투지') {
      const susThreshold = 60;
      if (state.resources.sus >= susThreshold) {
        const crisisPower = Math.floor(sense.power * 1.5);
        state.resources.rep += crisisPower;
        state.log.push(`투지 각성! 위기 상황(SUS≥${susThreshold}) → REP +${crisisPower}`);
      }
    }
  }

  if (senseInfo.category === '혈') {
    if (sense.baseType === '혈압') {
      state.senseSuppress = true;
      state.log.push('혈압 발동: 다음 인간 스킬 1회 봉쇄');
    }
    if (sense.baseType === '혈유') {
      const humans = state.field.filter(c => c.faction !== 'kartein' && c.sense);
      if (humans.length > 0) {
        const target = humans[Math.floor(Math.random() * humans.length)];
        state.resources.bp += Math.floor(sense.power * 0.5);
        state.log.push(`혈유 매혹: ${target.name} 조종 → BP +${Math.floor(sense.power * 0.5)}`);
      }
    }
    if (sense.baseType === '혈식') {
      const damage = sense.power;
      state.resources.bp += damage;
      state.log.push(`혈식 각성: BP +${damage} (대가: SUS 폭증)`);
    }
  }

  state.senseUsedThisTurn = true;
  const category = senseInfo.category === '촉' ? '촉' : '혈';
  state.log.push(`${category} 스킬 발동: ${card.name}의 「${sense.name}」 (${sense.baseType} Lv.${sense.power})`);
  if (result.countered.length > 0) {
    state.log.push(`상성 카운터! ${result.countered.join(', ')}의 ${senseInfo.counters} 무력화`);
  }

  return result;
}

export function calculateSensePassives(state) {
  const passiveEffects = { repBonus: 0, susReduction: 0, bpBonus: 0 };

  state.field.forEach(card => {
    if (!card.sense) return;
    const senseInfo = SENSE_TYPES[card.sense.baseType];
    if (!senseInfo || senseInfo.type !== 'passive') return;

    if (card.sense.effects?.onField) {
      for (const [key, val] of Object.entries(card.sense.effects.onField)) {
        if (key === 'rep') passiveEffects.repBonus += val;
        if (key === 'sus') passiveEffects.susReduction -= val;
        if (key === 'bp') passiveEffects.bpBonus += val;
      }
    }
  });

  return passiveEffects;
}

export function generateDilemma(state) {
  const usedIds = state.usedDilemmas || [];
  const available = DILEMMA_EVENTS.filter(d => !usedIds.includes(d.id));
  if (available.length === 0) {
    state.usedDilemmas = [];
    return DILEMMA_EVENTS[Math.floor(Math.random() * DILEMMA_EVENTS.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

export function resolveDilemma(state, dilemma, choiceIndex) {
  const choice = dilemma.choices[choiceIndex];
  if (!choice) return { ok: false };
  for (const [key, val] of Object.entries(choice.effect)) {
    state.resources[key] = (state.resources[key] || 0) + val;
  }
  state.resources.rep = Math.max(0, state.resources.rep);
  state.resources.sus = Math.max(0, state.resources.sus);
  if (!state.usedDilemmas) state.usedDilemmas = [];
  state.usedDilemmas.push(dilemma.id);
  state.nightActionTaken = true;
  state.log.push(`딜레마: ${dilemma.name} → "${choice.label}"`);
  return { ok: true, choice };
}

export function settleTurn(state) {
  const equipRepBonus = state.equipment.reduce((sum, eq) => sum + (eq.effect.repBonus || 0), 0);
  const equipSusReduction = state.equipment.reduce((sum, eq) => sum + (eq.effect.susReduction || 0), 0);

  state.field.forEach(card => {
    if (card.ability.onField) {
      for (const [key, val] of Object.entries(card.ability.onField)) {
        state.resources[key] = (state.resources[key] || 0) + val;
      }
      state.log.push(`${card.name} 필드 효과: ${Object.entries(card.ability.onField).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(', ')}`);
    }
  });

  state.resources.rep += equipRepBonus;
  state.resources.sus += (state.diffSettings?.susPerTurn ?? 2);
  state.resources.sus = Math.max(0, state.resources.sus - equipSusReduction);

  if (state.activeRequest) {
    state.activeRequest.turnsLeft--;
    if (state.activeRequest.turnsLeft <= 0) {
      failRequest(state);
    }
  }

  while (state.hand.length > 3) {
    state.discardPile.push(state.hand.pop());
  }

  state.field.forEach(card => state.discardPile.push(card));
  state.field = [];
  state.nightActionTaken = false;
  state.senseUsedThisTurn = false;
  state.sensePreview = null;
  state.senseSuppress = false;
  refreshRecruitShop(state);

  state.log.push(`턴 ${state.turn} 정산 완료 — BP:${state.resources.bp} REP:${state.resources.rep} SUS:${state.resources.sus}`);
}

export function checkGameEnd(state) {
  if (state.completedRequests >= 5) {
    state.gameOver = true;
    state.winner = true;
    state.log.push('승리! 카르테인 가문의 5개 의뢰를 모두 이행했습니다.');
    return 'win';
  }
  if (state.resources.rep <= 0) {
    state.gameOver = true;
    state.log.push('패배... 평판이 바닥나 센터가 폐쇄되었습니다.');
    return 'lose-rep';
  }
  if (state.resources.sus >= 100) {
    state.gameOver = true;
    state.log.push('패배... 뱀파이어 활동이 적발되었습니다.');
    return 'lose-sus';
  }
  return null;
}

export function advanceTurn(state) {
  state.turn++;
  state.phase = 'dawn';
}

export function runFullTurn(state) {
  if (state.gameOver) return;

  state.phase = 'dawn';
  drawCards(state, 5);

  state.phase = 'morning';
  let placed = true;
  while (placed) {
    placed = false;
    for (let i = state.hand.length - 1; i >= 0; i--) {
      const card = state.hand[i];
      if (card.type === 'character' && card.cost <= state.resources.bp) {
        playCharacter(state, i);
        placed = true;
        break;
      }
    }
  }

  const affordable = state.shopEquipment
    .filter(eq => eq.cost <= state.resources.bp && !state.equipment.find(e => e.id === eq.id))
    .sort((a, b) => a.cost - b.cost);
  if (affordable.length > 0) buyEquipment(state, affordable[0].id);

  state.phase = 'afternoon';
  collectBlood(state);

  state.phase = 'night';
  activateNextRequest(state);
  if (state.activeRequest) {
    const result = fulfillRequest(state);
    if (!result.ok) {
      state.log.push(`의뢰 이행 불가: ${result.reason}`);
    }
  }
  if (Math.random() < (state.diffSettings?.eventChance ?? 0.4)) processEvent(state);

  state.phase = 'settlement';
  settleTurn(state);

  const endResult = checkGameEnd(state);
  if (!endResult) advanceTurn(state);

  return endResult;
}
