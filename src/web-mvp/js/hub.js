import { CHARACTERS } from './cards.js';
import {
  createGameState, drawCards, playCharacter, collectBlood,
  activateNextRequest, fulfillRequest, processEvent, settleTurn,
  checkGameEnd, advanceTurn, runFullTurn, PHASE_NAMES,
} from './engine.js';

let gameState = null;
let mode = 'manual';

function initGallery() {
  const gallery = document.getElementById('card-gallery');
  renderGalleryCards(gallery, CHARACTERS);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      const filtered = filter === 'all' ? CHARACTERS : CHARACTERS.filter(c => c.faction === filter);
      renderGalleryCards(gallery, filtered);
    });
  });
}

function portraitSrc(base) {
  return `${base}.png`;
}

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
        <div class="card-stats">
          <span class="stat">비용 ${card.cost}</span>
          <span class="stat">위력 ${card.power}</span>
          <span class="stat">${card.rarity}</span>
        </div>
        <div class="card-flavor">"${card.flavor}"</div>
      </div>
    </div>
  `).join('');
}

function factionLabel(f) {
  return f === 'center' ? '혈연센터' : f === 'kartein' ? '카르테인' : '비소속';
}

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function initGame() {
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('btn-next-phase').addEventListener('click', advancePhase);
  document.getElementById('btn-fulfill').addEventListener('click', tryFulfill);
  document.getElementById('btn-auto-play').addEventListener('click', autoPlay);
}

function startGame() {
  gameState = createGameState();
  mode = 'manual';
  document.getElementById('btn-start-game').disabled = true;
  document.getElementById('btn-next-phase').disabled = false;
  document.getElementById('btn-fulfill').disabled = true;

  appendLog('=== 게임 시작 ===');
  appendLog('백십자재단 혈연센터에 오신 것을 환영합니다.');
  appendLog('카르테인 가문의 5개 의뢰를 완수하세요.');

  gameState.phase = 'dawn';
  gameState.log = [];
  drawCards(gameState, 5);
  gameState.log.forEach(msg => appendLog(msg));
  gameState.phase = 'morning';
  appendLog('── 오전 단계: 패에서 인물 카드를 클릭하여 배치하세요 ──');
  updateUI();
}

function advancePhase() {
  if (!gameState || gameState.gameOver) return;
  gameState.log = [];

  switch (gameState.phase) {
    case 'morning':
      gameState.phase = 'afternoon';
      collectBlood(gameState);
      gameState.log.forEach(msg => appendLog(msg));
      appendLog('── 오후 수집 완료 ──');
      updateUI();
      break;

    case 'afternoon':
      gameState.phase = 'night';
      activateNextRequest(gameState);
      gameState.log.forEach(msg => appendLog(msg));
      if (gameState.activeRequest) {
        document.getElementById('btn-fulfill').disabled = false;
        appendLog('── 야간 단계: [의뢰 이행] 버튼으로 이행하거나, [다음] 으로 넘기세요 ──');
      } else {
        appendLog('── 야간 단계: 활성 의뢰 없음 ──');
      }
      if (Math.random() < 0.4) {
        gameState.log = [];
        processEvent(gameState);
        gameState.log.forEach(msg => appendLog(msg));
      }
      updateUI();
      break;

    case 'night':
      gameState.phase = 'settlement';
      document.getElementById('btn-fulfill').disabled = true;
      settleTurn(gameState);
      gameState.log.forEach(msg => appendLog(msg));

      const endResult = checkGameEnd(gameState);
      if (endResult) {
        updateUI();
        showGameOver(endResult);
        return;
      }

      advanceTurn(gameState);
      gameState.log = [];
      gameState.phase = 'dawn';
      drawCards(gameState, 5);
      gameState.log.forEach(msg => appendLog(msg));
      gameState.phase = 'morning';
      appendLog(`── 턴 ${gameState.turn} 오전: 인물 카드를 클릭하여 배치하세요 ──`);
      updateUI();
      break;

    default:
      break;
  }
}

function tryFulfill() {
  if (!gameState || !gameState.activeRequest) return;
  gameState.log = [];
  const result = fulfillRequest(gameState);
  gameState.log.forEach(msg => appendLog(msg));
  if (result.ok) {
    document.getElementById('btn-fulfill').disabled = true;
    appendLog(`의뢰 완료! (${gameState.completedRequests}/5)`);
  } else {
    appendLog(`이행 불가: ${result.reason}`);
  }
  updateUI();
}

function onHandCardClick(index) {
  if (!gameState || gameState.phase !== 'morning') return;
  const card = gameState.hand[index];
  if (!card) return;

  if (card.type === 'character') {
    gameState.log = [];
    const result = playCharacter(gameState, index);
    gameState.log.forEach(msg => appendLog(msg));
    if (!result.ok) appendLog(result.reason);
  } else {
    appendLog(`${card.type === 'blood' ? card.bloodType + '형 혈액' : card.name}: 오전엔 인물 카드만 배치 가능`);
  }
  updateUI();
}

function autoPlay() {
  if (!gameState) startGame();
  mode = 'auto';
  appendLog('=== 자동 플레이 시작 ===');

  const interval = setInterval(() => {
    if (!gameState || gameState.gameOver) {
      clearInterval(interval);
      mode = 'manual';
      return;
    }
    gameState.log = [];
    const result = runFullTurn(gameState);
    gameState.log.forEach(msg => appendLog(msg));
    updateUI();
    if (result) {
      clearInterval(interval);
      mode = 'manual';
      showGameOver(result);
    }
  }, 600);
}

function updateUI() {
  if (!gameState) return;

  document.getElementById('res-bp').textContent = `BP: ${gameState.resources.bp}`;
  document.getElementById('res-rep').textContent = `REP: ${gameState.resources.rep}`;
  document.getElementById('res-sus').textContent = `SUS: ${gameState.resources.sus}`;
  document.getElementById('res-turn').textContent = `턴: ${gameState.turn}`;
  document.getElementById('res-phase').textContent = PHASE_NAMES[gameState.phase] || gameState.phase;
  document.getElementById('res-requests').textContent = `의뢰: ${gameState.completedRequests}/5`;

  renderHandCards();
  renderFieldCards();
  renderBloodPool();
  renderRequest();

  const phaseBtn = document.getElementById('btn-next-phase');
  switch (gameState.phase) {
    case 'morning': phaseBtn.textContent = '오전 종료 →'; break;
    case 'afternoon': phaseBtn.textContent = '야간 →'; break;
    case 'night': phaseBtn.textContent = '정산 → 다음 턴'; break;
    default: phaseBtn.textContent = '다음'; break;
  }
}

function renderHandCards() {
  const el = document.getElementById('hand-cards');
  el.innerHTML = gameState.hand.map((c, i) => {
    const type = c.type || 'character';
    const label = type === 'blood' ? `${c.bloodType}형` : `${c.name}`;
    const cost = type === 'character' ? ` [${c.cost}]` : '';
    const playable = gameState.phase === 'morning' && type === 'character' && c.cost <= gameState.resources.bp;
    return `<div class="mini-card ${type} ${playable ? 'playable' : ''}"
                onclick="window.__onHandClick(${i})"
                title="${type === 'character' ? c.ability.description : c.description || ''}"
            >${label}${cost}</div>`;
  }).join('') || '<span class="empty-hint">패 비어 있음</span>';
}

function renderFieldCards() {
  const el = document.getElementById('field-cards');
  el.innerHTML = gameState.field.map(c =>
    `<div class="mini-card character field-card" title="${c.ability.description}">${c.name} [${c.power}]</div>`
  ).join('') || '<span class="empty-hint">배치된 카드 없음</span>';
}

function renderBloodPool() {
  const el = document.getElementById('blood-cards');
  const counts = {};
  gameState.bloodPool.forEach(b => { counts[b.bloodType] = (counts[b.bloodType] || 0) + 1; });
  el.innerHTML = Object.entries(counts).map(([bt, n]) =>
    `<div class="mini-card blood">${bt}형 x${n}</div>`
  ).join('') || '<span class="empty-hint">비어 있음</span>';
}

function renderRequest() {
  const el = document.getElementById('active-request');
  const req = gameState.activeRequest;
  if (!req) {
    el.innerHTML = '<span class="empty-hint">대기 중...</span>';
    return;
  }
  const needs = Object.entries(req.requirements).map(([bt, n]) => `${bt}형 x${n}`).join(', ');
  el.innerHTML = `
    <div class="request-card">
      <div class="req-title">${req.name}</div>
      <div class="req-needs">필요: ${needs}</div>
      <div class="req-turns">남은 턴: ${req.turnsLeft}</div>
    </div>
  `;
}

function appendLog(msg) {
  const log = document.getElementById('game-log');
  log.innerHTML += msg + '<br>';
  log.scrollTop = log.scrollHeight;
}

function showGameOver(result) {
  const isWin = result === 'win';
  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay';
  overlay.innerHTML = `
    <div class="game-over-box ${isWin ? 'win' : 'lose'}">
      <h2>${isWin ? '승리!' : '패배...'}</h2>
      <p>${isWin
        ? '카르테인 가문의 의뢰를 모두 완수했습니다.'
        : result === 'lose-rep'
          ? '평판이 바닥나 센터가 폐쇄되었습니다.'
          : '뱀파이어 활동이 적발되었습니다.'
      }</p>
      <p style="margin-top:0.5rem;color:var(--text-secondary)">
        턴 ${gameState.turn} | BP ${gameState.resources.bp} | REP ${gameState.resources.rep} | SUS ${gameState.resources.sus}
      </p>
      <button class="btn-primary" style="margin-top:1rem" onclick="location.reload()">다시 시작</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.__onHandClick = onHandCardClick;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initGallery();
  initGame();
});
