import { CHARACTERS } from './cards.js';
import { createGameState, runFullTurn, PHASE_NAMES } from './engine.js';

let gameState = null;

function initGallery() {
  const gallery = document.getElementById('card-gallery');
  renderCards(gallery, CHARACTERS);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      const filtered = filter === 'all' ? CHARACTERS : CHARACTERS.filter(c => c.faction === filter);
      renderCards(gallery, filtered);
    });
  });
}

function renderCards(container, cards) {
  container.innerHTML = cards.map(card => `
    <div class="card" data-rarity="${card.rarity}" data-id="${card.id}">
      <div class="card-portrait">
        <img src="${card.portrait}" alt="${card.name}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="placeholder" style="display:none">${factionIcon(card.faction)}</div>
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

function factionIcon(f) {
  return f === 'center' ? '🏥' : f === 'kartein' ? '🦇' : '⚖️';
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
  document.getElementById('btn-next-turn').addEventListener('click', nextTurn);
  document.getElementById('btn-auto-play').addEventListener('click', autoPlay);
}

function startGame() {
  gameState = createGameState();
  document.getElementById('btn-start-game').disabled = true;
  document.getElementById('btn-next-turn').disabled = false;
  appendLog('=== 게임 시작 ===');
  appendLog('백십자재단 혈연센터에 오신 것을 환영합니다.');
  appendLog('카르테인 가문의 5개 의뢰를 완수하세요.');
  updateUI();
}

function nextTurn() {
  if (!gameState || gameState.gameOver) return;
  gameState.log = [];
  const result = runFullTurn(gameState);
  gameState.log.forEach(msg => appendLog(msg));
  updateUI();
  if (result) showGameOver(result);
}

function autoPlay() {
  if (!gameState) startGame();
  const interval = setInterval(() => {
    if (!gameState || gameState.gameOver) { clearInterval(interval); return; }
    nextTurn();
  }, 800);
}

function updateUI() {
  if (!gameState) return;

  document.getElementById('res-bp').textContent = `BP: ${gameState.resources.bp}`;
  document.getElementById('res-rep').textContent = `REP: ${gameState.resources.rep}`;
  document.getElementById('res-sus').textContent = `SUS: ${gameState.resources.sus}`;
  document.getElementById('res-turn').textContent = `턴: ${gameState.turn}`;
  document.getElementById('res-phase').textContent = PHASE_NAMES[gameState.phase] || gameState.phase;

  renderMiniCards('hand-cards', gameState.hand);
  renderMiniCards('field-cards', gameState.field);
  renderBloodPool();
  renderRequest();
}

function renderMiniCards(containerId, cards) {
  const el = document.getElementById(containerId);
  el.innerHTML = cards.map(c => {
    const type = c.type || 'character';
    const label = type === 'blood' ? `${c.bloodType}형` : `${c.name} (${c.cost})`;
    return `<div class="mini-card ${type}">${label}</div>`;
  }).join('');
}

function renderBloodPool() {
  const el = document.getElementById('blood-cards');
  const counts = {};
  gameState.bloodPool.forEach(b => { counts[b.bloodType] = (counts[b.bloodType] || 0) + 1; });
  el.innerHTML = Object.entries(counts).map(([bt, n]) =>
    `<div class="mini-card blood">${bt}형 x${n}</div>`
  ).join('') || '<span style="color:var(--text-secondary);font-size:0.8rem">비어 있음</span>';
}

function renderRequest() {
  const el = document.getElementById('active-request');
  const req = gameState.activeRequest;
  if (!req) {
    el.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem">대기 중...</span>';
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
      <p style="margin-top:0.5rem;color:var(--text-secondary)">턴 ${gameState.turn} | BP ${gameState.resources.bp} | REP ${gameState.resources.rep} | SUS ${gameState.resources.sus}</p>
      <button class="btn-primary" style="margin-top:1rem" onclick="location.reload()">다시 시작</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initGallery();
  initGame();
});
