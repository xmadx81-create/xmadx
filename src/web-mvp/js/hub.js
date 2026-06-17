import { CHARACTERS, EQUIPMENT, STORY_BEATS, SENSE_TYPES } from './cards.js';
import {
  createGameState, drawCards, playCharacter, collectBlood,
  activateNextRequest, fulfillRequest, processEvent, settleTurn,
  checkGameEnd, advanceTurn, runFullTurn, buyEquipment,
  recruitCharacter, refreshRecruitShop, nightInvestigate, nightPromote,
  calculateComboBonuses, PHASE_NAMES, DIFFICULTIES,
  generateDilemma, resolveDilemma, convertBlood, activateSense,
  generateRouteMap, selectRouteNode, applyRestNode, applyEventNode, NODE_TYPES,
  generateBossRequest, generateEliteRequest,
} from './engine.js';
import {
  initAudio, toggleMute, isMuted, startBGM, stopBGM,
  sfxCardPlay, sfxCollect, sfxFulfill, sfxEvent, sfxEquip, sfxWin, sfxLose,
} from './sound.js';
import { saveGame, loadGame, deleteSave, hasSave, recordGame, loadStats, ACHIEVEMENT_DEFS, loadAchievements, checkAchievements, UNLOCK_TIERS, getUnlockTier } from './storage.js';

let gameState = null;
let selectedDifficulty = 'normal';
let prevResources = { bp: null, rep: null, sus: null };
let storyTriggered = new Set();

// ── Gallery ──

function initGallery() {
  const gallery = document.getElementById('card-gallery');
  renderGalleryCards(gallery, CHARACTERS);
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      renderGalleryCards(gallery, filter === 'all' ? CHARACTERS : CHARACTERS.filter(c => c.faction === filter));
    });
  });
}

function portraitSrc(base) { return `${base}.png`; }

function renderGalleryCards(container, cards) {
  container.innerHTML = cards.map(card => `
    <div class="card" data-rarity="${card.rarity}" data-id="${card.id}">
      <div class="card-portrait">
        <img src="${portraitSrc(card.portrait)}" alt="${card.name}"
             onerror="if(this.src.endsWith('.png')){this.src=this.src.replace('.png','.svg')}else{this.style.display='none';this.nextElementSibling.style.display='flex'}" />
        <div class="placeholder" style="display:none">${card.name[0]}</div>
      </div>
      <div class="card-info">
        <span class="faction-badge ${card.faction}">${factionLabel(card.faction)}</span>
        <div class="card-name">${card.name}</div>
        <div class="card-title">${card.title}</div>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => window.__showCardPopup(el.dataset.id));
  });
}

function factionLabel(f) {
  return f === 'center' ? '혈연센터' : f === 'kartein' ? '카르테인' : '비소속';
}

// ── Card Popup ──

function showCardPopup(cardId) {
  const card = CHARACTERS.find(c => c.id === cardId);
  if (!card) return;
  const overlay = document.getElementById('card-popup');
  document.getElementById('popup-portrait').innerHTML = `
    <img src="${portraitSrc(card.portrait)}" alt="${card.name}"
         onerror="if(this.src.endsWith('.png')){this.src=this.src.replace('.png','.svg')}else{this.style.display='none'}" />
  `;
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  document.getElementById('popup-details').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-badges">
        <span class="faction-badge ${card.faction}">${factionLabel(card.faction)}</span>
        <span class="rarity-badge ${card.rarity}">${(rarityKo[card.rarity] || card.rarity).toUpperCase()}</span>
      </div>
      <h2>${card.name}</h2>
      <p class="popup-title">${card.title}</p>
    </div>
    <div class="sheet-stats">
      <div class="sheet-stat"><span class="stat-icon">⚔</span><span class="stat-val">${card.cost}</span><span class="stat-lbl">비용</span></div>
      <div class="sheet-stat"><span class="stat-icon">💪</span><span class="stat-val">${card.power}</span><span class="stat-lbl">위력</span></div>
    </div>
    <div class="sheet-ability">
      <div class="ability-label">능력</div>
      <p>${card.ability.description}</p>
    </div>
    ${card.sense ? `<div class="sheet-sense ${card.sense.baseType && SENSE_TYPES[card.sense.baseType]?.category === '혈' ? 'blood' : 'human'}">
      <div class="sense-header">
        <span class="sense-icon">${SENSE_TYPES[card.sense.baseType]?.icon || '✦'}</span>
        <span class="sense-name">${card.sense.name}</span>
        <span class="sense-badge">${card.sense.baseType} Lv.${card.sense.power}</span>
      </div>
      <p class="sense-flavor">"${card.sense.flavor}"</p>
    </div>` : ''}
    ${card.lore ? `<div class="sheet-lore"><div class="lore-label">서사</div><p>${card.lore}</p></div>` : ''}
    <p class="popup-flavor">"${card.flavor}"</p>
  `;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}
function hideCardPopup() {
  const overlay = document.getElementById('card-popup');
  overlay.classList.remove('open');
  overlay.addEventListener('transitionend', function onEnd() {
    overlay.removeEventListener('transitionend', onEnd);
    overlay.style.display = 'none';
  });
}
window.__showCardPopup = showCardPopup;

// ── Tabs ──

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'stats') renderStats();
    });
  });
}

// ── Difficulty ──

function initDifficulty() {
  const tier = getUnlockTier();
  const hardBtn = document.querySelector('.diff-btn[data-diff="hard"]');
  if (hardBtn && tier < 1) {
    hardBtn.disabled = true;
    hardBtn.title = '1승 이상 달성 시 해금';
    hardBtn.querySelector('.diff-desc').textContent = '1승 이상 시 해금';
  }

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDifficulty = btn.dataset.diff;
    });
  });
}

// ── Game Init ──

function initGame() {
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('btn-load-game').addEventListener('click', loadSavedGame);
  document.getElementById('btn-next-phase').addEventListener('click', advancePhase);
  document.getElementById('btn-fulfill').addEventListener('click', tryFulfill);
  document.getElementById('btn-investigate').addEventListener('click', doInvestigate);
  document.getElementById('btn-promote').addEventListener('click', doPromote);
  document.getElementById('btn-auto-play').addEventListener('click', autoPlay);
  document.getElementById('btn-sound').addEventListener('click', onSoundToggle);
  document.getElementById('popup-close').addEventListener('click', hideCardPopup);
  document.getElementById('card-popup').addEventListener('click', (e) => {
    if (e.target.id === 'card-popup') hideCardPopup();
  });

  if (hasSave()) {
    document.getElementById('btn-load-game').style.display = '';
  }
}

function startGame() {
  initAudio();
  deleteSave();
  storyTriggered = new Set();
  gameState = createGameState(selectedDifficulty);
  gameState.routeMap = generateRouteMap(15);
  refreshRecruitShop(gameState);
  onGameStarted();
}

function loadSavedGame() {
  initAudio();
  const saved = loadGame();
  if (!saved) { appendLog('저장된 게임이 없습니다.'); return; }
  gameState = saved;
  onGameStarted();
  appendLog('=== 저장된 게임 불러오기 완료 ===');
}

function onGameStarted() {
  document.getElementById('btn-start-game').disabled = true;
  document.getElementById('btn-load-game').style.display = 'none';
  document.getElementById('btn-next-phase').disabled = false;
  document.getElementById('difficulty-select').style.display = 'none';

  const diff = DIFFICULTIES[gameState.difficulty || 'normal'];
  appendLog(`=== 게임 시작 (${diff.label}) ===`);

  if (gameState.routeMap) {
    appendLog('경로를 선택하여 센터를 운영하세요. 15층의 최종 의뢰를 클리어하면 승리!');
    renderRouteMap();
    updateUI();
    return;
  }

  appendLog('카르테인 가문의 5개 의뢰를 완수하세요.');
  if (gameState.phase === 'dawn' || !gameState.hand.length) {
    gameState.phase = 'dawn';
    gameState.log = [];
    drawCards(gameState, 5);
    gameState.log.forEach(msg => appendLog(msg));
    gameState.phase = 'morning';
  }
  appendLog('── 오전: 인물 배치 / 장비 구매 / 인물 모집 ──');
  checkStoryBeats();
  updateUI();
}

// ── Phase Control ──

function advancePhase() {
  if (!gameState || gameState.gameOver) return;
  gameState.log = [];

  switch (gameState.phase) {
    case 'morning':
      gameState.phase = 'afternoon';
      collectBlood(gameState);
      sfxCollect();
      gameState.log.forEach(msg => appendLog(msg));
      appendLog('── 오후 수집 완료 ──');
      checkStoryBeats();
      updateUI();
      break;

    case 'afternoon':
      gameState.phase = 'night';
      gameState.nightActionTaken = false;
      activateNextRequest(gameState);
      gameState.log.forEach(msg => appendLog(msg));

      document.getElementById('night-actions').style.display = '';
      if (gameState.activeRequest) {
        document.getElementById('btn-fulfill').disabled = false;
      }

      showDilemma();

      if (Math.random() < (gameState.diffSettings?.eventChance ?? 0.4)) {
        gameState.log = [];
        processEvent(gameState);
        sfxEvent();
        gameState.log.forEach(msg => appendLog(msg));
      }
      checkStoryBeats();
      updateUI();
      break;

    case 'night':
      gameState.phase = 'settlement';
      document.getElementById('btn-fulfill').disabled = true;
      document.getElementById('night-actions').style.display = 'none';
      settleTurn(gameState);
      gameState.log.forEach(msg => appendLog(msg));

      saveGame(gameState);

      const endResult = checkGameEnd(gameState);
      if (endResult) {
        endResult === 'win' ? sfxWin() : sfxLose();
        recordGame(gameState, endResult);
        updateUI();
        showGameOver(endResult);
        return;
      }

      advanceTurn(gameState);

      if (gameState.routeMap && !gameState.routeMap.completed) {
        appendLog('── 경로 선택으로 돌아갑니다 ──');
        renderRouteMap();
        updateUI();
      } else {
        gameState.log = [];
        gameState.phase = 'dawn';
        drawCards(gameState, 5);
        gameState.log.forEach(msg => appendLog(msg));
        gameState.phase = 'morning';
        appendLog(`── 턴 ${gameState.turn} 오전: 인물 배치 / 장비 구매 / 인물 모집 ──`);
        checkStoryBeats();
      }
      updateUI();
      break;
  }
}

// ── Player Actions ──

function tryFulfill() {
  if (!gameState || !gameState.activeRequest) return;
  if (gameState.nightActionTaken) { appendLog('이미 야간 행동을 수행했습니다.'); return; }
  const wasBoss = gameState.activeRequest?.isBoss;
  gameState.log = [];
  const result = fulfillRequest(gameState);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) {
    sfxFulfill();
    gameState.nightActionTaken = true;
    document.getElementById('btn-fulfill').disabled = true;
    disableNightBtns();
    if (wasBoss) {
      gameState.bossDefeated = true;
      appendLog('👑 최종 의뢰 클리어! 카르테인과의 거래가 끝났다!');
    } else {
      appendLog(`의뢰 완료! (${gameState.completedRequests}/5)`);
    }
    checkStoryBeats();
  } else {
    appendLog(`이행 불가: ${result.reason}`);
  }
  updateUI();
}

function doInvestigate() {
  if (!gameState || gameState.phase !== 'night') return;
  gameState.log = [];
  const result = nightInvestigate(gameState);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) disableNightBtns();
  updateUI();
}

function doPromote() {
  if (!gameState || gameState.phase !== 'night') return;
  gameState.log = [];
  const result = nightPromote(gameState);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) disableNightBtns();
  updateUI();
}

let currentDilemma = null;

function showDilemma() {
  currentDilemma = generateDilemma(gameState);
  const el = document.getElementById('dilemma-panel');
  el.innerHTML = `
    <div class="dilemma-card">
      <div class="dilemma-header">
        <span class="dilemma-badge">딜레마</span>
        <h3>${currentDilemma.name}</h3>
      </div>
      <p class="dilemma-narration">${currentDilemma.narration}</p>
      <div class="dilemma-choices">
        ${currentDilemma.choices.map((c, i) => `
          <button class="dilemma-choice" onclick="window.__resolveDilemma(${i})">
            <span class="choice-label">${c.label}</span>
            <span class="choice-effect">${c.desc}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  el.style.display = '';
  appendLog(`── 야간: 딜레마 발생 — ${currentDilemma.name} ──`);
}

function onResolveDilemma(choiceIndex) {
  if (!currentDilemma || !gameState) return;
  gameState.log = [];
  const result = resolveDilemma(gameState, currentDilemma, choiceIndex);
  if (result.ok) {
    sfxEvent();
    gameState.log.forEach(msg => appendLog(msg));
    disableNightBtns();
    document.getElementById('dilemma-panel').style.display = 'none';
    currentDilemma = null;
  }
  updateUI();
}
window.__resolveDilemma = onResolveDilemma;

function disableNightBtns() {
  document.getElementById('btn-fulfill').disabled = true;
  document.getElementById('btn-investigate').disabled = true;
  document.getElementById('btn-promote').disabled = true;
}

function onHandCardClick(index) {
  if (!gameState || gameState.phase !== 'morning') return;
  const card = gameState.hand[index];
  if (!card) return;
  if (card.type === 'character') {
    gameState.log = [];
    const result = playCharacter(gameState, index);
    gameState.log.forEach(msg => appendLog(msg));
    if (result.ok) sfxCardPlay(); else appendLog(result.reason);
  } else {
    appendLog('오전엔 인물 카드만 배치 가능');
  }
  updateUI();
}

function onBuyEquip(equipId) {
  if (!gameState || gameState.phase !== 'morning') return;
  gameState.log = [];
  const result = buyEquipment(gameState, equipId);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) sfxEquip(); else appendLog(result.reason);
  updateUI();
}

function onRecruit(charId) {
  if (!gameState || gameState.phase !== 'morning') return;
  gameState.log = [];
  const result = recruitCharacter(gameState, charId);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) sfxCardPlay();
  else appendLog(result.reason);
  updateUI();
}

function autoPlay() {
  if (!gameState) startGame();
  appendLog('=== 자동 플레이 ===');
  const interval = setInterval(() => {
    if (!gameState || gameState.gameOver) { clearInterval(interval); return; }
    gameState.log = [];
    const result = runFullTurn(gameState);
    gameState.log.forEach(msg => appendLog(msg));
    updateUI();
    if (result) {
      clearInterval(interval);
      result === 'win' ? sfxWin() : sfxLose();
      recordGame(gameState, result);
      showGameOver(result);
    }
  }, 600);
}

function onSoundToggle() {
  initAudio();
  const wasMuted = isMuted();
  toggleMute();
  const btn = document.getElementById('btn-sound');
  if (wasMuted) { startBGM(); btn.textContent = 'BGM OFF'; }
  else { stopBGM(); btn.textContent = 'BGM ON'; }
}

// ── UI Rendering ──

function pulseResource(elId, oldVal, newVal) {
  if (oldVal === null || oldVal === newVal) return;
  const el = document.getElementById(elId);
  const cls = newVal > oldVal ? 'res-pulse-up' : 'res-pulse-down';
  el.classList.remove('res-pulse-up', 'res-pulse-down');
  // Force reflow to restart animation if same class re-applied
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

function updateUI() {
  if (!gameState) return;
  document.getElementById('res-bp').textContent = `BP: ${gameState.resources.bp}`;
  document.getElementById('res-rep').textContent = `REP: ${gameState.resources.rep}`;
  document.getElementById('res-sus').textContent = `SUS: ${gameState.resources.sus}`;
  document.getElementById('res-turn').textContent = `턴: ${gameState.turn}`;
  document.getElementById('res-phase').textContent = PHASE_NAMES[gameState.phase] || gameState.phase;
  document.getElementById('res-requests').textContent = `의뢰: ${gameState.completedRequests}/5`;

  // B2: Resource pulse animation
  pulseResource('res-bp', prevResources.bp, gameState.resources.bp);
  pulseResource('res-rep', prevResources.rep, gameState.resources.rep);
  pulseResource('res-sus', prevResources.sus, gameState.resources.sus);
  prevResources = { bp: gameState.resources.bp, rep: gameState.resources.rep, sus: gameState.resources.sus };

  renderHandCards();
  renderFieldCards();
  renderBloodPool();
  renderRequest();
  renderShop();
  renderInstalledEquip();
  renderRecruitShop();

  const phaseBtn = document.getElementById('btn-next-phase');
  switch (gameState.phase) {
    case 'morning': phaseBtn.textContent = '오전 종료 →'; break;
    case 'afternoon': phaseBtn.textContent = '야간 →'; break;
    case 'night': phaseBtn.textContent = '정산 → 다음 턴'; break;
    default: phaseBtn.textContent = '다음'; break;
  }

  document.getElementById('btn-investigate').disabled = gameState.nightActionTaken;
  document.getElementById('btn-promote').disabled = gameState.nightActionTaken;
}

function renderHandCards() {
  const el = document.getElementById('hand-cards');
  const shouldFlip = gameState.phase === 'morning' || gameState.phase === 'dawn';
  el.innerHTML = gameState.hand.map((c, i) => {
    const type = c.type || 'character';
    const playable = gameState.phase === 'morning' && type === 'character' && c.cost <= gameState.resources.bp;
    const flipClass = shouldFlip ? ' card-flip' : '';
    if (type === 'blood') {
      return `<div class="vcard blood${flipClass}" onclick="window.__onHandClick(${i})">
        <div class="vcard-icon">🩸</div>
        <div class="vcard-name">${c.bloodType}형</div>
      </div>`;
    }
    const senseInfo = c.sense ? SENSE_TYPES[c.sense.baseType] : null;
    const senseTag = senseInfo ? `<span class="vcard-sense ${senseInfo.category}">${senseInfo.icon}${c.sense.name}</span>` : '';
    const canSense = gameState && !gameState.senseUsedThisTurn && c.sense && gameState.phase === 'morning';
    return `<div class="vcard ${playable ? 'playable' : ''}${flipClass}" data-rarity="${c.rarity}"
                onclick="window.__onHandClick(${i})">
      <div class="vcard-thumb"><img src="${portraitSrc(c.portrait)}" alt="" onerror="this.style.display='none'"/></div>
      <div class="vcard-body">
        <div class="vcard-name">${c.name}</div>
        <div class="vcard-stats"><span>⚔${c.cost}</span><span>💪${c.power}</span></div>
        <div class="vcard-ability">${c.ability.description}</div>
        ${senseTag}
      </div>
      ${canSense ? `<button class="btn-sense ${senseInfo.category}" onclick="event.stopPropagation();window.__onSense(${i})" title="${c.sense.baseType} Lv.${c.sense.power}">촉/혈</button>` : ''}
    </div>`;
  }).join('') || '<span class="empty-hint">패 비어 있음</span>';
  if (shouldFlip) {
    el.querySelectorAll('.card-flip').forEach(card => {
      card.addEventListener('animationend', () => card.classList.remove('card-flip'), { once: true });
    });
  }
}

function renderFieldCards() {
  const el = document.getElementById('field-cards');
  const cards = gameState.field.map(c => {
    const si = c.sense ? SENSE_TYPES[c.sense.baseType] : null;
    return `<div class="vcard field-card" data-rarity="${c.rarity}">
      <div class="vcard-thumb"><img src="${portraitSrc(c.portrait)}" alt="" onerror="this.style.display='none'"/></div>
      <div class="vcard-body">
        <div class="vcard-name">${c.name}</div>
        <div class="vcard-stats"><span>💪${c.power}</span>${si ? `<span class="sense-mini ${si.category}">${si.icon}</span>` : ''}</div>
        <div class="vcard-ability">${c.ability.description}</div>
      </div>
    </div>`;
  }).join('');

  const combos = calculateComboBonuses(gameState);
  const comboHtml = combos.active.length > 0
    ? `<div class="combo-indicator">${combos.active.map(c => `<span class="combo-tag">${c.label}</span>`).join('')}</div>`
    : '';

  el.innerHTML = (cards || '<span class="empty-hint">배치된 카드 없음</span>') + comboHtml;
}

function renderBloodPool() {
  const el = document.getElementById('blood-cards');
  const hasConverter = gameState.field.some(c => c.ability.type === 'convert');
  const counts = {};
  gameState.bloodPool.forEach(b => { counts[b.bloodType] = (counts[b.bloodType] || 0) + 1; });
  let html = Object.entries(counts).map(([bt, n]) =>
    `<div class="vcard blood"><div class="vcard-icon">🩸</div><div class="vcard-name">${bt}형 x${n}</div></div>`
  ).join('');
  if (hasConverter && gameState.bloodPool.length > 0 && gameState.phase === 'morning') {
    html += `<div class="convert-panel">
      <span class="convert-label">변환:</span>
      ${['A', 'B', 'O', 'AB'].map(bt => `<button class="btn-convert" onclick="window.__convertBlood('${bt}')">${bt}형</button>`).join('')}
    </div>`;
  }
  el.innerHTML = html || '<span class="empty-hint">비어 있음</span>';
}

function onConvertBlood(targetType) {
  if (!gameState || gameState.bloodPool.length === 0) return;
  const poolTypes = gameState.bloodPool.map(b => b.bloodType);
  const convertFrom = poolTypes.findIndex(bt => bt !== targetType);
  if (convertFrom < 0) { appendLog('변환할 다른 혈액형이 없습니다'); return; }
  gameState.log = [];
  const result = convertBlood(gameState, convertFrom, targetType);
  gameState.log.forEach(msg => appendLog(msg));
  if (!result.ok) appendLog(result.reason);
  updateUI();
}
window.__convertBlood = onConvertBlood;

function onSense(handIndex) {
  if (!gameState || gameState.phase !== 'morning') return;
  gameState.log = [];
  const result = activateSense(gameState, handIndex);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) {
    sfxCardPlay();
    if (result.countered.length > 0) {
      appendLog(`⚡ 상성 발동! ${result.countered.join(', ')}의 혈술 무력화!`);
    }
  } else {
    appendLog(result.reason);
  }
  updateUI();
}
window.__onSense = onSense;

// ── Route Map ──

function renderRouteMap() {
  if (!gameState?.routeMap) return;
  const map = gameState.routeMap;
  const panel = document.getElementById('route-map');
  const grid = document.getElementById('route-map-grid');
  document.getElementById('route-floor').textContent = `(${map.currentFloor + 1}/${map.floors.length}층)`;

  const visibleStart = Math.max(0, map.currentFloor - 1);
  const visibleEnd = Math.min(map.floors.length, map.currentFloor + 5);

  grid.innerHTML = '';
  for (let f = visibleStart; f < visibleEnd; f++) {
    const floorDiv = document.createElement('div');
    floorDiv.className = 'route-floor-row';

    const label = document.createElement('span');
    label.className = 'route-floor-label';
    label.textContent = `${f + 1}F`;
    floorDiv.appendChild(label);

    const nodesDiv = document.createElement('div');
    nodesDiv.className = 'route-nodes';

    map.floors[f].forEach(node => {
      const info = NODE_TYPES[node.type];
      const btn = document.createElement('button');
      btn.className = `route-node ${node.type}`;
      if (node.visited) btn.classList.add('visited');
      if (node.id === map.currentNode) btn.classList.add('current');
      if (node.available) btn.classList.add('available');
      btn.innerHTML = `<span class="node-icon">${info.icon}</span><span class="node-label">${info.label}</span>`;
      btn.title = info.desc;
      if (node.available) {
        btn.addEventListener('click', () => onSelectNode(node.id));
      }
      nodesDiv.appendChild(btn);
    });

    floorDiv.appendChild(nodesDiv);
    grid.appendChild(floorDiv);
  }

  panel.style.display = '';
}

function onSelectNode(nodeId) {
  if (!gameState) return;
  gameState.log = [];
  const result = selectRouteNode(gameState, nodeId);
  gameState.log.forEach(msg => appendLog(msg));
  if (!result.ok) { appendLog(result.reason); return; }

  const node = result.node;
  renderRouteMap();

  switch (node.type) {
    case 'operation':
    case 'elite':
      document.getElementById('route-map').style.display = 'none';
      startTurnFromMap(node.type === 'elite');
      break;
    case 'dilemma':
      document.getElementById('route-map').style.display = 'none';
      startDilemmaFromMap();
      break;
    case 'shop':
      document.getElementById('route-map').style.display = 'none';
      startShopFromMap();
      break;
    case 'rest':
      gameState.log = [];
      const rest = applyRestNode(gameState);
      gameState.log.forEach(msg => appendLog(msg));
      sfxCollect();
      updateUI();
      renderRouteMap();
      if (gameState.routeMap.completed) showGameOver('win');
      break;
    case 'event':
      gameState.log = [];
      applyEventNode(gameState);
      sfxEvent();
      gameState.log.forEach(msg => appendLog(msg));
      updateUI();
      renderRouteMap();
      break;
    case 'boss':
      document.getElementById('route-map').style.display = 'none';
      startTurnFromMap(true);
      break;
  }
}

function startTurnFromMap(isEliteOrBoss) {
  const currentNode = gameState.routeMap?.floors[gameState.routeMap.currentFloor]
    ?.find(n => n.id === gameState.routeMap.currentNode);
  const isBoss = currentNode?.type === 'boss';

  if (isBoss) {
    appendLog('── 👑 최종 의뢰! 이것이 마지막이다 ──');
    gameState.activeRequest = generateBossRequest(gameState);
    gameState.log.push(`최종 의뢰 도착: ${gameState.activeRequest.name}`);
  } else if (isEliteOrBoss) {
    appendLog('── ⚠️ 긴급 의뢰 발생! ──');
    gameState.activeRequest = generateEliteRequest(gameState);
    gameState.log.push(`긴급 의뢰 도착: ${gameState.activeRequest.name}`);
  }

  gameState.phase = 'dawn';
  gameState.log = [];
  drawCards(gameState, 5);
  gameState.log.forEach(msg => appendLog(msg));
  gameState.phase = 'morning';
  appendLog(`── 턴 ${gameState.turn} 오전: 인물 배치 / 장비 구매 ──`);
  checkStoryBeats();
  updateUI();
}

function startDilemmaFromMap() {
  gameState.phase = 'night';
  gameState.nightActionTaken = false;
  showDilemma();
  updateUI();
}

function startShopFromMap() {
  gameState.phase = 'morning';
  refreshRecruitShop(gameState);
  appendLog('── 🛒 암시장 — 특별 모집과 장비를 확인하세요 ──');
  updateUI();
}

window.__selectNode = onSelectNode;

function renderRequest() {
  const el = document.getElementById('active-request');
  const req = gameState.activeRequest;
  if (!req) { el.innerHTML = '<span class="empty-hint">대기 중...</span>'; return; }
  const needs = Object.entries(req.requirements).map(([bt, n]) => `${bt}형 x${n}`).join(', ');
  el.innerHTML = `
    <div class="request-card">
      <div class="req-title">${req.name}</div>
      <div class="req-needs">필요: ${needs}</div>
      <div class="req-reward">보상: BP +${req.reward.bp}${req.reward.rep ? ` / REP +${req.reward.rep}` : ''}</div>
      <div class="req-turns">남은 턴: ${req.turnsLeft}</div>
    </div>
  `;
}

function renderShop() {
  const el = document.getElementById('shop-cards');
  if (!gameState.shopEquipment?.length) { el.innerHTML = '<span class="empty-hint">품절</span>'; return; }
  el.innerHTML = gameState.shopEquipment.map(eq => {
    const canBuy = gameState.phase === 'morning' && eq.cost <= gameState.resources.bp;
    return `<div class="vcard equip ${canBuy ? 'buyable' : ''}" onclick="window.__onBuyEquip('${eq.id}')">
      <div class="vcard-icon">🔧</div>
      <div class="vcard-body">
        <div class="vcard-name">${eq.name}</div>
        <div class="vcard-stats"><span>⚔${eq.cost}</span></div>
        <div class="vcard-ability">${eq.description}</div>
      </div>
    </div>`;
  }).join('');
}

function renderInstalledEquip() {
  const el = document.getElementById('installed-equip');
  document.getElementById('equip-count').textContent = gameState.equipment.length ? `(${gameState.equipment.length})` : '';
  el.innerHTML = gameState.equipment.map(eq =>
    `<div class="vcard equip installed">
      <div class="vcard-icon">✅</div>
      <div class="vcard-body">
        <div class="vcard-name">${eq.name}</div>
        <div class="vcard-ability">${eq.description}</div>
      </div>
    </div>`
  ).join('') || '<span class="empty-hint">설치된 장비 없음</span>';
}

function renderRecruitShop() {
  const el = document.getElementById('recruit-cards');
  if (!gameState.recruitShop?.length) { el.innerHTML = '<span class="empty-hint">대기 중</span>'; return; }
  const tier = getUnlockTier();
  el.innerHTML = gameState.recruitShop.map(c => {
    const rarityLocked = (c.rarity === 'rare' && tier < 2) || (c.rarity === 'legendary' && tier < 4);
    if (rarityLocked) {
      return `<div class="vcard recruit locked"><div class="vcard-icon">🔒</div><div class="vcard-body"><div class="vcard-name">??? [잠김]</div><div class="vcard-ability">${c.rarity === 'rare' ? '3승' : '5승'} 이상 필요</div></div></div>`;
    }
    const canRecruit = gameState.phase === 'morning' && c.recruitCost <= gameState.resources.bp;
    return `<div class="vcard recruit ${canRecruit ? 'recruitable' : ''}" data-rarity="${c.rarity}" onclick="window.__onRecruit('${c.id}')">
      <div class="vcard-thumb"><img src="${portraitSrc(c.portrait)}" alt="" onerror="this.style.display='none'"/></div>
      <div class="vcard-body">
        <div class="vcard-name">${c.name}</div>
        <div class="vcard-stats"><span>⚔${c.recruitCost}</span><span class="rarity-dot ${c.rarity}">${c.rarity}</span></div>
        <div class="vcard-ability">${c.ability.description}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Stats ──

function renderStats() {
  const stats = loadStats();
  const summary = document.getElementById('stats-summary');
  const totalWins = (stats.wins.easy || 0) + (stats.wins.normal || 0) + (stats.wins.hard || 0);
  const totalLosses = (stats.losses.easy || 0) + (stats.losses.normal || 0) + (stats.losses.hard || 0);

  summary.innerHTML = `
    <div class="stats-grid">
      <div class="stat-box"><span class="stat-num">${stats.totalGames}</span><span class="stat-label">총 게임</span></div>
      <div class="stat-box win"><span class="stat-num">${totalWins}</span><span class="stat-label">승리</span></div>
      <div class="stat-box lose"><span class="stat-num">${totalLosses}</span><span class="stat-label">패배</span></div>
      <div class="stat-box"><span class="stat-num">${stats.totalGames ? Math.round(totalWins / stats.totalGames * 100) : 0}%</span><span class="stat-label">승률</span></div>
    </div>
    <div class="stats-detail">
      ${['easy', 'normal', 'hard'].map(d => {
        const label = DIFFICULTIES[d].label;
        const w = stats.wins[d] || 0;
        const l = stats.losses[d] || 0;
        const best = stats.bestTurn[d];
        return `<div class="stat-row">
          <span class="stat-diff">${label}</span>
          <span>${w}승 ${l}패</span>
          <span>${best ? `최단 ${best}턴` : '-'}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  const achieveEl = document.getElementById('achievements-grid');
  if (achieveEl) {
    const unlocked = loadAchievements();
    achieveEl.innerHTML = ACHIEVEMENT_DEFS.map(def => {
      const done = unlocked.includes(def.id);
      return `<div class="achieve-card ${done ? 'unlocked' : 'locked'}">
        <div class="achieve-name">${def.name}</div>
        <div class="achieve-desc">${def.description}</div>
      </div>`;
    }).join('');
  }

  const unlockEl = document.getElementById('unlock-tree');
  if (unlockEl) {
    const currentTier = getUnlockTier();
    unlockEl.innerHTML = UNLOCK_TIERS.map(t => {
      const reached = currentTier >= t.tier;
      return `<div class="unlock-node ${reached ? 'reached' : 'locked'}">
        <div class="unlock-tier">Tier ${t.tier}</div>
        <div class="unlock-label">${t.label}</div>
        <div class="unlock-desc">${t.description}</div>
      </div>`;
    }).join('<div class="unlock-connector"></div>');
  }

  const history = document.getElementById('stats-history');
  if (!stats.history.length) {
    history.innerHTML = '<span class="empty-hint">기록 없음</span>';
    return;
  }
  history.innerHTML = stats.history.slice(0, 20).map(h => {
    const isWin = h.result === 'win';
    const diff = DIFFICULTIES[h.difficulty]?.label || h.difficulty;
    return `<div class="history-row ${isWin ? 'win' : 'lose'}">
      <span>${isWin ? '승' : '패'}</span>
      <span>${diff}</span>
      <span>턴 ${h.turn}</span>
      <span>의뢰 ${h.completed}/5</span>
      <span class="history-date">${new Date(h.date).toLocaleDateString('ko')}</span>
    </div>`;
  }).join('');
}

function appendLog(msg) {
  const log = document.getElementById('game-log');
  log.innerHTML += msg + '<br>';
  log.scrollTop = log.scrollHeight;
}

function appendStory(text) {
  const log = document.getElementById('game-log');
  log.innerHTML += `<span class="story-text">${text}</span><br>`;
  log.scrollTop = log.scrollHeight;
}

function checkStoryBeats() {
  if (!gameState) return;

  function fire(trigger) {
    if (storyTriggered.has(trigger)) return;
    const beat = STORY_BEATS.find(b => b.trigger === trigger);
    if (beat) {
      storyTriggered.add(trigger);
      appendStory(beat.text);
    }
  }

  if (gameState.turn === 1) fire('turn-1');
  if (gameState.turn === 5) fire('turn-5');
  if (gameState.completedRequests === 1 && !storyTriggered.has('first-complete')) fire('first-complete');
  if (gameState.completedRequests === 4 && gameState.activeRequest) fire('final-request');
  if (gameState.activeRequest && !storyTriggered.has('first-request') && gameState.nextRequestNum === 2) fire('first-request');
  if (gameState.resources.sus >= 50) fire('sus-50');
  if (gameState.resources.sus >= 80) fire('sus-80');
  if (gameState.resources.rep <= 20 && gameState.resources.rep > 0) fire('rep-low');
}

function showAchievementToast(achieveId) {
  const def = ACHIEVEMENT_DEFS.find(a => a.id === achieveId);
  if (!def) return;
  const toast = document.createElement('div');
  toast.className = 'achieve-toast';
  toast.innerHTML = `<span class="achieve-toast-label">업적 달성!</span><strong>${def.name}</strong><span>${def.description}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showGameOver(result) {
  const endBeat = STORY_BEATS.find(b => b.trigger === result);
  if (endBeat) appendStory(endBeat.text);

  const newAchievements = checkAchievements(gameState, result);
  newAchievements.forEach((id, i) => setTimeout(() => showAchievementToast(id), i * 800));

  const isWin = result === 'win';
  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-box ${isWin ? 'win' : 'lose'}">
      <h2>${isWin ? '승리!' : '패배...'}</h2>
      <p>${isWin
        ? '카르테인 가문의 의뢰를 모두 완수했습니다.'
        : result === 'lose-rep' ? '평판이 바닥나 센터가 폐쇄되었습니다.' : '뱀파이어 활동이 적발되었습니다.'
      }</p>
      <p style="margin-top:0.5rem;color:var(--text-secondary)">
        ${DIFFICULTIES[gameState.difficulty]?.label || '보통'} · 턴 ${gameState.turn} · BP ${gameState.resources.bp} · REP ${gameState.resources.rep} · SUS ${gameState.resources.sus}
      </p>
      ${newAchievements.length > 0 ? `<div class="game-over-achievements">${newAchievements.map(id => {
        const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
        return `<span class="achieve-badge new">${def.name}</span>`;
      }).join('')}</div>` : ''}
      <button class="btn-primary" style="margin-top:1rem" onclick="location.reload()">다시 시작</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.__onHandClick = onHandCardClick;
window.__onBuyEquip = onBuyEquip;
window.__onRecruit = onRecruit;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initGallery();
  initDifficulty();
  initGame();

  const base = document.querySelector('script[src]')?.src.replace(/assets\/.*/, '') || '/';
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = base + 'manifest.webmanifest';
  document.head.appendChild(manifestLink);

  const touchIcon = document.createElement('link');
  touchIcon.rel = 'apple-touch-icon';
  touchIcon.href = base + 'icons/icon-192.png';
  document.head.appendChild(touchIcon);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
  }
});
