import { CHARACTERS, SENSE_TYPES, CHARACTER_MBTI } from './cards.js';
import {
  createBattleState, moveUnit, attackUnit, getMovementRange, getAttackRange,
  getAttackTargets, activateSense, endPlayerPhase, endEnemyPhase,
  runEnemyPhase, checkVictory, allPlayerUnitsActed,
  STAGES, TILE_TYPES, getLivingUnits, getUnitByUid, getCombatPower,
  previewDamage, previewSkillDamage, getFlankingBonus,
  getTeamSynergy, getTeamCP, cardToUnit, gainXP, executeUltimate, useItem,
  spawnReinforcements, getDangerZone,
  EQUIPMENT, RELICS, equipItem, equipRelic,
} from './engine.js';
import { loadGame, saveGame, refreshQuests, progressQuest, getCenterBuff, getQuestSummary, getAttendanceReward, addCard, saveCharProgress, recordStageClear } from './save.js';

let gameSave = loadGame();
refreshQuests(gameSave);
saveGame(gameSave);

let battleState = null;
let uiMode = 'idle'; // idle | selected | move | attack | skill | command
let selectedUid = null;
let highlightedTiles = [];
let deploySelected = [];
let currentStageId = null;
let commandTarget = null;
let dangerZoneActive = false;
let undoMoveData = null;

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
  container.innerHTML = cards.map(card => {
    const cardData = gameSave.cards[card.id];
    const owned = cardData && cardData.count > 0;
    const lvDisplay = cardData && cardData.level > 1 ? `Lv.${cardData.level}` : '';
    const xpPct = cardData ? Math.round((cardData.xp || 0) / (cardData.level * 50) * 100) : 0;
    return `
    <div class="card ${owned ? 'card-owned' : ''}" data-rarity="${card.rarity}" data-id="${card.id}">
      <div class="card-portrait">
        <img src="${portraitSrc(card.portrait)}" alt="${card.name}"
             onerror="if(this.src.endsWith('.png')){this.src=this.src.replace('.png','.svg')}else{this.style.display='none';this.nextElementSibling.style.display='flex'}" />
        <div class="placeholder" style="display:none">${card.name[0]}</div>
        ${lvDisplay ? `<div class="card-lv-badge">${lvDisplay}</div>` : ''}
      </div>
      <div class="card-info">
        <span class="faction-badge ${card.faction}">${factionLabel(card.faction)}</span>
        <div class="card-name">${card.name}</div>
        <div class="card-title">${card.title}</div>
        ${owned ? `<div class="card-xp-bar"><div class="card-xp-fill" style="width:${xpPct}%"></div></div>` : ''}
      </div>
    </div>`;
  }).join('');
  container.querySelectorAll('.card').forEach(el => {
    el.addEventListener('click', () => showCardPopup(el.dataset.id));
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
  const senseHtml = card.sense ? (() => {
    const info = SENSE_TYPES[card.sense.baseType];
    const cat = info?.category === '촉' ? 'human' : 'blood';
    return `<div class="sheet-sense ${cat}">
      <span class="sense-icon">${info?.icon || '?'}</span>
      <strong>${card.sense.name}</strong> (${card.sense.baseType} Lv.${card.sense.power})
      <p>${card.sense.flavor}</p>
    </div>`;
  })() : '';
  const loreHtml = card.lore ? `<div class="sheet-lore"><p>${card.lore}</p></div>` : '';

  document.getElementById('popup-details').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-badges">
        <span class="faction-badge ${card.faction}">${factionLabel(card.faction)}</span>
        <span class="rarity-badge ${card.rarity}">${(rarityKo[card.rarity] || card.rarity).toUpperCase()}</span>
      </div>
      <h2>${card.name}</h2>
      <p class="sheet-title">${card.title}</p>
    </div>
    <div class="sheet-stats">
      <div class="stat"><span class="stat-label">HP</span><span class="stat-val">${card.power * 12 + ({common:10,uncommon:20,rare:35,legendary:50}[card.rarity]||0)}</span></div>
      <div class="stat"><span class="stat-label">ATK</span><span class="stat-val">${card.power * 4 + ({common:2,uncommon:4,rare:6,legendary:10}[card.rarity]||0)}</span></div>
      <div class="stat"><span class="stat-label">DEF</span><span class="stat-val">${Math.floor(card.cost/2) + ({common:1,uncommon:2,rare:3,legendary:5}[card.rarity]||0)}</span></div>
      <div class="stat"><span class="stat-label">MOV</span><span class="stat-val">${{common:3,uncommon:3,rare:2,legendary:2}[card.rarity]||3}</span></div>
    </div>
    ${senseHtml}
    ${loreHtml}
    <p class="sheet-flavor">${card.flavor}</p>
  `;
  overlay.style.display = 'flex';
}

// ── Tab Navigation ──

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add('active');
    });
  });
}

// ── Stage Select ──

function renderStageSelect() {
  const list = document.getElementById('stage-list');
  list.innerHTML = STAGES.map((s, i) => {
    const enemyCount = s.enemyUnits.length;
    const maxDeploy = s.playerSpawns.length;
    const difficulty = Math.min(5, Math.ceil((s.enemyLevel || 1) / 2));
    const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
    const hasReinforce = s.reinforcements ? `<span class="stage-reinforce">⚠증원</span>` : '';
    const clearData = gameSave.stageClears?.[s.id];
    const clearStars = clearData ? '⭐'.repeat(clearData.stars) + '☆'.repeat(3 - clearData.stars) : '';
    const clearInfo = clearData ? `<span class="stage-clear-info">${clearStars} ${clearData.bestTurns}턴 (${clearData.clears}회)</span>` : '';
    return `<div class="stage-card ${clearData ? 'stage-cleared' : ''}" data-stage="${s.id}">
      <div class="stage-num">${i + 1}</div>
      <div class="stage-info">
        <div class="stage-name">${s.name} <span class="stage-lv">Lv.${s.enemyLevel || 1}</span></div>
        <div class="stage-desc">${s.description}</div>
        <div class="stage-meta">
          <span class="stage-stars">${stars}</span>
          <span class="stage-enemy-count">적 ${enemyCount}명</span>
          <span class="stage-deploy-count">출전 ${maxDeploy}명</span>
          ${hasReinforce}
        </div>
        ${clearInfo}
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('.stage-card').forEach(el => {
    el.addEventListener('click', () => openDeploy(el.dataset.stage));
  });
}

// ── Deploy Screen ──

let deployPreviewChar = null;

function openDeploy(stageId) {
  currentStageId = stageId;
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) return;

  deploySelected = [];
  deployPreviewChar = null;
  const maxUnits = stage.playerSpawns.length;

  document.getElementById('stage-select').style.display = 'none';
  document.getElementById('deploy-screen').style.display = '';
  document.getElementById('deploy-stage-name').textContent = `${stage.name} — 유닛 편성`;
  document.getElementById('deploy-max').textContent = maxUnits;
  document.getElementById('deploy-count').textContent = '0';

  renderMapPreview(stage);
  renderEnemyIntel(stage);
  renderDeployRoster('all');
  renderDeployBench(maxUnits);
  renderRoleBalance([]);
  showDeployDetail(null);

  const centerBuff = getCenterBuff(gameSave);
  document.getElementById('deploy-center-buff').innerHTML = `<span class="center-buff-label">센터 Lv.${gameSave.centerLevel}</span> DEF+${centerBuff.defBuff} ATK+${centerBuff.atkBuff} HP+${centerBuff.hpBuff}`;

  document.querySelectorAll('.roster-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.roster-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDeployRoster(btn.dataset.rf);
    });
  });

  document.querySelectorAll('.roster-sort').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.roster-sort').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      deploySort = btn.dataset.sort;
      renderDeployRoster(document.querySelector('.roster-filter.active')?.dataset.rf || 'all');
    });
  });

  document.getElementById('btn-deploy-back').onclick = () => {
    document.getElementById('deploy-screen').style.display = 'none';
    document.getElementById('stage-select').style.display = '';
  };
  document.getElementById('btn-deploy-start').onclick = () => startBattle();
}

function renderMapPreview(stage) {
  const preview = document.getElementById('deploy-map-preview');
  const map = stage.mapData;
  const rows = map.length;
  const cols = map[0].length;

  let html = `<div class="minimap" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr)">`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = map[r][c];
      const spawnIdx = stage.playerSpawns.findIndex(s => s.x === c && s.y === r);
      const isEnemy = stage.enemyUnits.some(e => e.x === c && e.y === r);
      const cls = spawnIdx >= 0 ? 'mm-spawn' : isEnemy ? 'mm-enemy' : '';
      const label = spawnIdx >= 0 ? (spawnIdx + 1) : '';
      html += `<div class="mm-tile mm-${tile} ${cls}">${label}</div>`;
    }
  }
  html += '</div>';

  const terrainTypes = [...new Set(map.flat())];
  const terrainInfo = { forest:'🌲 숲 DEF+1', mountain:'⛰️ 산 DEF+2 이동2', swamp:'🌿 늪 DEF-1 이동2', ice:'❄️ 빙판 EVA+5%', graveyard:'💀 묘지 ATK+2', hotspring:'♨️ 온천 매턴+5HP', bridge:'🌉 다리 좁은길', dungeon:'🕯️ 던전', road:'🛤️ 도로 이동1' };
  const specialTerrain = terrainTypes.filter(t => terrainInfo[t]);

  html += `<div class="minimap-legend">
    <span class="mm-legend-spawn">▪ 아군(번호=배치순)</span>
    <span class="mm-legend-enemy">▪ 적 위치</span>
    <span>맵 ${cols}×${rows}</span>
  </div>`;
  if (specialTerrain.length) {
    html += `<div class="terrain-hints">${specialTerrain.map(t => `<span class="terrain-hint">${terrainInfo[t]}</span>`).join('')}</div>`;
  }
  preview.innerHTML = html;
}

function renderEnemyIntel(stage) {
  const panel = document.getElementById('deploy-enemy-intel');
  const eLv = stage.enemyLevel || 1;
  const enemies = stage.enemyUnits.map(eu => {
    const c = CHARACTERS.find(ch => ch.id === eu.charId);
    if (!c) return null;
    const unit = cardToUnit(c, 0, 0);
    for (let lv = 1; lv < eLv; lv++) { unit.maxHp += Math.floor(unit.maxHp * 0.05); unit.atk += 2; unit.def += 1; }
    unit.level = eLv;
    unit.hp = unit.maxHp;
    return { ...unit, charData: c };
  }).filter(Boolean);

  const roleLabel = { tank:'탱커', melee_dps:'근딜', ranged_dps:'원딜', support:'서포터', bruiser:'브루저', battle_support:'전술', evasive_dps:'암살', breaker:'브레이커' };

  const reinforceInfo = stage.reinforcements
    ? `<div class="intel-reinforce">⚠ 증원 경고: ${stage.reinforcements.map(r => `턴${r.turn} +${r.units.length}명`).join(', ')}</div>`
    : '';

  panel.innerHTML = `
    <div class="intel-header">
      <span class="intel-title">적 정보</span>
      <span class="intel-count">${enemies.length}명 · Lv.${eLv}</span>
    </div>
    ${reinforceInfo}
    <div class="intel-list">${enemies.map(e => `
      <div class="intel-unit">
        <div class="intel-portrait"><img src="${portraitSrc(`assets/portraits/${e.id}`)}" onerror="this.style.display='none'" /></div>
        <div class="intel-info">
          <div class="intel-name">${e.name}</div>
          <div class="intel-role">${roleLabel[e.charData.role] || e.charData.role}</div>
        </div>
        <div class="intel-stats">
          <span>HP${e.maxHp}</span>
          <span>ATK${e.atk}</span>
          <span>DEF${e.def}</span>
        </div>
      </div>
    `).join('')}</div>
  `;
}

function getTeamCompWarnings(selectedIds) {
  const roleLabel = { tank:'탱커', melee_dps:'근딜', ranged_dps:'원딜', support:'서포터', bruiser:'브루저', battle_support:'전술', evasive_dps:'암살', breaker:'브레이커' };
  const roles = selectedIds.map(id => {
    const c = CHARACTERS.find(ch => ch.id === id);
    return c ? c.role : null;
  }).filter(Boolean);
  const warnings = [];
  const healRoles = ['support', 'battle_support'];
  const tankRoles = ['tank', 'bruiser'];
  if (roles.length >= 2 && !roles.some(r => healRoles.includes(r))) warnings.push('⚠ 힐러 없음 — 회복 불가');
  if (roles.length >= 3 && !roles.some(r => tankRoles.includes(r))) warnings.push('⚠ 탱커 없음 — 전선 유지 어려움');
  if (roles.length >= 3 && new Set(roles).size === 1) warnings.push('⚠ 같은 역할만 — 유연성 부족');
  return warnings;
}

function renderRoleBalance(selectedIds) {
  const el = document.getElementById('deploy-role-balance');
  if (selectedIds.length === 0) { el.innerHTML = ''; return; }

  const roleCounts = {};
  const roleLabel = { tank:'탱커', melee_dps:'근딜', ranged_dps:'원딜', support:'서포터', bruiser:'브루저', battle_support:'전술', evasive_dps:'암살', breaker:'브레이커' };
  const roleColor = { tank:'#457b9d', melee_dps:'#e94560', ranged_dps:'#ff8a80', support:'#4b9b6e', bruiser:'#e9a045', battle_support:'#80cbc4', evasive_dps:'#9b59b6', breaker:'#ffd700' };

  selectedIds.forEach(id => {
    const c = CHARACTERS.find(ch => ch.id === id);
    if (c) roleCounts[c.role] = (roleCounts[c.role] || 0) + 1;
  });

  const warnings = getTeamCompWarnings(selectedIds);

  el.innerHTML = `
    <div class="role-bar">${Object.entries(roleCounts).map(([role, count]) =>
      `<div class="role-segment" style="flex:${count};background:${roleColor[role] || '#555'}" title="${roleLabel[role]} ×${count}">
        <span>${roleLabel[role]} ${count}</span>
      </div>`
    ).join('')}</div>
    ${warnings.length ? `<div class="comp-warnings">${warnings.map(w => `<div class="comp-warn">${w}</div>`).join('')}</div>` : ''}
  `;
}

let deploySort = 'name';

function renderDeployRoster(filter) {
  const stage = STAGES.find(s => s.id === currentStageId);
  const maxUnits = stage ? stage.playerSpawns.length : 3;
  const playerChars = CHARACTERS.filter(c => c.faction !== 'kartein');
  const filtered = filter === 'all' ? playerChars : playerChars.filter(c => c.faction === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (deploySort === 'role') return (a.role || '').localeCompare(b.role || '');
    if (deploySort === 'rarity') {
      const order = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
      return (order[a.rarity] || 9) - (order[b.rarity] || 9);
    }
    if (deploySort === 'cp') {
      return getCombatPower(cardToUnit(b, 0, 0)) - getCombatPower(cardToUnit(a, 0, 0));
    }
    return a.name.localeCompare(b.name);
  });

  const roster = document.getElementById('deploy-roster');
  roster.innerHTML = sorted.map(c => {
    const mbti = CHARACTER_MBTI[c.id] || '????';
    const roleLabel = { tank:'탱커', melee_dps:'근딜', ranged_dps:'원딜', support:'서포터', bruiser:'브루저', battle_support:'전술', evasive_dps:'암살', breaker:'브레이커' };
    const isSelected = deploySelected.includes(c.id);
    const cardData = gameSave.cards[c.id];
    const lvDisplay = cardData ? `Lv.${cardData.level}` : '';
    return `<div class="roster-card ${isSelected ? 'roster-selected' : ''}" data-id="${c.id}" data-rarity="${c.rarity}">
      <div class="roster-portrait"><img src="${portraitSrc(c.portrait)}" alt="${c.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="roster-initial" style="display:none">${c.name[0]}</div></div>
      <div class="roster-name">${c.name}</div>
      <div class="roster-meta"><span class="roster-role">${roleLabel[c.role] || c.role}</span><span class="mbti-badge">${mbti}</span></div>
      ${lvDisplay ? `<div class="roster-lv">${lvDisplay}</div>` : ''}
      ${isSelected ? '<div class="roster-check">✓</div>' : ''}
    </div>`;
  }).join('');

  roster.querySelectorAll('.roster-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (deploySelected.includes(id)) {
        deploySelected = deploySelected.filter(x => x !== id);
      } else if (deploySelected.length < maxUnits) {
        deploySelected.push(id);
      }
      document.getElementById('deploy-count').textContent = deploySelected.length;
      document.getElementById('btn-deploy-start').disabled = deploySelected.length === 0;
      renderDeployRoster(document.querySelector('.roster-filter.active')?.dataset.rf || 'all');
      renderDeployBench(maxUnits);
      updateDeploySynergy();
      renderRoleBalance(deploySelected);
      showDeployDetail(id);
    });
  });
}

function renderDeployBench(maxSlots) {
  const bench = document.getElementById('deploy-bench');
  const stage = STAGES.find(s => s.id === currentStageId);
  let html = '';
  for (let i = 0; i < maxSlots; i++) {
    const charId = deploySelected[i];
    const spawn = stage?.playerSpawns[i];
    const posLabel = spawn ? `(${spawn.x},${spawn.y})` : '';
    if (charId) {
      const c = CHARACTERS.find(ch => ch.id === charId);
      html += `<div class="bench-slot bench-filled" data-idx="${i}">
        <div class="bench-pos">${i + 1}</div>
        <div class="bench-portrait"><img src="${portraitSrc(c.portrait)}" alt="${c.name}" onerror="this.style.display='none'" /></div>
        <div class="bench-name">${c.name}</div>
        <div class="bench-controls">
          ${i > 0 ? `<button class="bench-swap" data-dir="left" data-idx="${i}">◀</button>` : '<span class="bench-swap-spacer"></span>'}
          ${i < deploySelected.length - 1 ? `<button class="bench-swap" data-dir="right" data-idx="${i}">▶</button>` : '<span class="bench-swap-spacer"></span>'}
        </div>
        <button class="bench-remove" data-id="${charId}">✕</button>
      </div>`;
    } else {
      html += `<div class="bench-slot bench-empty"><span class="bench-empty-label">${i + 1}</span><span class="bench-pos-label">${posLabel}</span></div>`;
    }
  }
  bench.innerHTML = html;

  bench.querySelectorAll('.bench-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deploySelected = deploySelected.filter(x => x !== id);
      document.getElementById('deploy-count').textContent = deploySelected.length;
      document.getElementById('btn-deploy-start').disabled = deploySelected.length === 0;
      renderDeployRoster(document.querySelector('.roster-filter.active')?.dataset.rf || 'all');
      renderDeployBench(maxSlots);
      updateDeploySynergy();
      renderRoleBalance(deploySelected);
    });
  });

  bench.querySelectorAll('.bench-swap').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      const dir = btn.dataset.dir;
      const swapIdx = dir === 'left' ? idx - 1 : idx + 1;
      if (swapIdx >= 0 && swapIdx < deploySelected.length) {
        [deploySelected[idx], deploySelected[swapIdx]] = [deploySelected[swapIdx], deploySelected[idx]];
        renderDeployBench(maxSlots);
        updateDeploySynergy();
      }
    });
  });

  bench.querySelectorAll('.bench-filled').forEach(el => {
    el.addEventListener('click', () => {
      const idx = +el.dataset.idx;
      const charId = deploySelected[idx];
      if (charId) showDeployDetail(charId);
    });
  });
}

function showDeployDetail(charId) {
  const panel = document.getElementById('deploy-detail');
  if (!charId) {
    panel.innerHTML = '<div class="deploy-detail-empty">캐릭터를 선택하세요</div>';
    return;
  }
  const c = CHARACTERS.find(ch => ch.id === charId);
  if (!c) return;

  const unit = cardToUnit(c, 0, 0);
  const cardData = gameSave.cards[c.id];
  if (cardData && cardData.level > 1) {
    for (let lv = 1; lv < cardData.level; lv++) {
      unit.level++;
      unit.maxHp += Math.floor(unit.maxHp * 0.05);
      unit.atk += 2;
      unit.def += 1;
      unit.maxMp += 1;
    }
    unit.hp = unit.maxHp;
    unit.xp = cardData.xp || 0;
    unit.xpToNext = unit.level * 50;
  }
  const cp = getCombatPower(unit);
  const mbti = CHARACTER_MBTI[c.id] || '????';
  const roleLabel = { tank:'탱커', melee_dps:'근접 딜러', ranged_dps:'원거리 딜러', support:'서포터', bruiser:'브루저', battle_support:'전투 지원', evasive_dps:'암살자', breaker:'브레이커' };
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  const factionKo = { center: '혈연센터', kartein: '카르테인', neutral: '비소속' };
  const senseInfo = c.sense ? SENSE_TYPES[c.sense.baseType] : null;

  panel.innerHTML = `
    <div class="dd-portrait"><img src="${portraitSrc(c.portrait)}" alt="${c.name}" onerror="this.style.display='none'" /></div>
    <div class="dd-header">
      <div class="dd-name">${c.name}</div>
      <div class="dd-title">${c.title}</div>
      <div class="dd-badges">
        <span class="faction-badge ${c.faction}">${factionKo[c.faction]}</span>
        <span class="rarity-badge ${c.rarity}">${rarityKo[c.rarity]}</span>
        <span class="role-badge">${roleLabel[c.role]}</span>
        <span class="mbti-badge">${mbti}</span>
      </div>
    </div>
    <div class="dd-stats">
      <div class="dd-stat"><span>HP</span><strong>${unit.maxHp}</strong></div>
      <div class="dd-stat"><span>ATK</span><strong>${unit.atk}</strong></div>
      <div class="dd-stat"><span>DEF</span><strong>${unit.def}</strong></div>
      <div class="dd-stat"><span>CRT</span><strong>${Math.round(unit.crt * 100)}%</strong></div>
      <div class="dd-stat"><span>EVA</span><strong>${Math.round((unit.eva || 0) * 100)}%</strong></div>
      <div class="dd-stat"><span>MOV</span><strong>${unit.mov}</strong></div>
      <div class="dd-stat"><span>RNG</span><strong>${unit.rng}</strong></div>
      <div class="dd-stat dd-cp"><span>전투력</span><strong>${cp}</strong></div>
    </div>
    ${senseInfo ? `<div class="dd-sense"><span class="sense-icon">${senseInfo.icon || '?'}</span> <strong>「${c.sense.name}」</strong> ${c.sense.baseType} Lv.${c.sense.power}<br><span class="dd-sense-flavor">${c.sense.flavor}</span></div>` : ''}
    ${unit.ultimates ? `<div class="dd-ults">${unit.ultimates.map(u => `<div class="dd-ult"><span>${u.icon}</span> ${u.name} <span class="dd-ult-lv">Lv.${u.unlockLevel}</span></div>`).join('')}</div>` : ''}
    <div class="dd-equip">
      <div class="dd-equip-title">장비</div>
      ${['weapon', 'armor', 'accessory'].map(slot => {
        const equipped = unit.equipment[slot];
        const slotLabel = { weapon: '무기', armor: '방어구', accessory: '장신구' }[slot];
        const slotIcon = { weapon: '⚔️', armor: '🛡️', accessory: '💍' }[slot];
        return `<div class="dd-equip-slot">
          <span class="dd-slot-icon">${slotIcon}</span>
          <span class="dd-slot-name">${equipped ? equipped.name : `${slotLabel} 없음`}</span>
          <button class="dd-equip-btn" data-char="${c.id}" data-slot="${slot}">변경</button>
        </div>`;
      }).join('')}
    </div>
  `;

  panel.querySelectorAll('.dd-equip-btn').forEach(btn => {
    btn.addEventListener('click', () => showEquipSelect(btn.dataset.char, btn.dataset.slot));
  });
}

function showEquipSelect(charId, slot) {
  const items = EQUIPMENT.filter(e => e.slot === slot);
  const slotLabel = { weapon: '무기', armor: '방어구', accessory: '장신구' }[slot];
  const popup = document.getElementById('card-popup');
  const details = document.getElementById('popup-details');
  document.getElementById('popup-portrait').innerHTML = `<div style="font-size:2rem;text-align:center;padding:20px">${{ weapon: '⚔️', armor: '🛡️', accessory: '💍' }[slot]}</div>`;

  details.innerHTML = `
    <h2>${slotLabel} 선택</h2>
    <div class="equip-select-list">
      ${items.map(item => {
        const statsText = Object.entries(item.stats).map(([k, v]) => `${k.toUpperCase()}+${typeof v === 'number' && v < 1 ? Math.round(v * 100) + '%' : v}`).join(' ');
        return `<button class="equip-select-item" data-equip-id="${item.id}">
          <span class="equip-item-name">${item.name}</span>
          <span class="equip-item-stats">${statsText}</span>
        </button>`;
      }).join('')}
      <button class="equip-select-item equip-cancel">취소</button>
    </div>
  `;

  details.querySelectorAll('.equip-select-item').forEach(btn => {
    btn.addEventListener('click', () => {
      popup.style.display = 'none';
      const equipId = btn.dataset.equipId;
      if (!equipId) return;
      if (!gameSave.cards[charId]) gameSave.cards[charId] = { level: 1, xp: 0, count: 1 };
      if (!gameSave.cards[charId].equipment) gameSave.cards[charId].equipment = {};
      gameSave.cards[charId].equipment[slot] = equipId;
      saveGame(gameSave);
      showDeployDetail(charId);
    });
  });

  popup.style.display = 'flex';
}

function updateDeploySynergy() {
  const panel = document.getElementById('deploy-synergy');
  if (deploySelected.length < 2) { panel.style.display = 'none'; return; }

  const units = deploySelected.map(id => {
    const c = CHARACTERS.find(ch => ch.id === id);
    return c ? cardToUnit(c, 0, 0) : null;
  }).filter(Boolean);

  const teamData = getTeamCP(units);
  const syn = teamData.synergy;

  document.getElementById('synergy-grade').textContent = syn.avgGrade;
  document.getElementById('synergy-grade').className = `synergy-grade ${syn.avgGrade.toLowerCase()}`;
  document.getElementById('synergy-mult').textContent = `×${syn.teamMult}`;
  document.getElementById('synergy-cp').textContent = teamData.total;

  const secretEl = document.getElementById('synergy-secret');
  if (syn.secretCombo) {
    secretEl.textContent = `🔥 시크릿 콤보! 「${syn.secretCombo.name}」 ×${syn.secretCombo.mult}`;
    secretEl.style.display = '';
  } else {
    secretEl.style.display = 'none';
  }

  document.getElementById('synergy-pairs').innerHTML = syn.pairDetails.map(p =>
    `<span class="synergy-pair ${p.grade.toLowerCase()}">${p.a}↔${p.b} ${p.grade}</span>`
  ).join('');

  panel.style.display = '';
}

// ── Battle Start ──

function startBattle() {
  const centerBuff = getCenterBuff(gameSave);
  const units = deploySelected.map(id => {
    const c = CHARACTERS.find(ch => ch.id === id);
    return c ? cardToUnit(c, 0, 0) : null;
  }).filter(Boolean);
  const teamData = units.length >= 2 ? getTeamCP(units) : null;
  const synergyMult = teamData ? teamData.synergy.teamMult : 1.0;
  battleState = createBattleState(currentStageId, deploySelected, centerBuff, synergyMult);

  battleState.units.filter(u => u.team === 'player').forEach(u => {
    const charId = u.charId || u.id;
    const cardData = gameSave.cards[charId];
    if (cardData && cardData.level > 1) {
      for (let lv = 1; lv < cardData.level; lv++) {
        u.level++;
        const hpGain = Math.floor(u.maxHp * 0.05);
        u.maxHp += hpGain;
        u.atk += 2;
        u.def += 1;
        u.maxMp += 1;
        u.xpToNext = u.level * 50;
      }
      u.hp = u.maxHp;
      u.mp = u.maxMp;
      u.xp = cardData.xp || 0;
    }
    if (cardData?.equipment) {
      Object.entries(cardData.equipment).forEach(([slot, itemId]) => {
        if (itemId) equipItem(u, itemId);
      });
    }
  });

  document.getElementById('deploy-screen').style.display = 'none';
  document.getElementById('battle-screen').style.display = '';
  document.getElementById('battle-log').innerHTML = '';
  dangerZoneActive = false;
  undoMoveData = null;
  document.getElementById('btn-danger-zone').classList.remove('active');

  showStory(battleState.stage.storyIntro, () => {
    showPhaseBanner('아군 턴', 'player');
    renderBattle();
  });
}

// ── Story Panel ──

function showStory(text, callback) {
  if (!text) { if (callback) callback(); return; }
  const panel = document.getElementById('story-panel');
  document.getElementById('story-text').textContent = text;
  panel.style.display = 'flex';
  document.getElementById('story-next').onclick = () => {
    panel.style.display = 'none';
    if (callback) callback();
  };
}

// ── Phase Banner ──

function showPhaseBanner(text, type) {
  const banner = document.getElementById('phase-banner');
  const span = document.getElementById('phase-banner-text');
  span.textContent = text;
  banner.className = `phase-banner ${type || ''}`;
  banner.style.display = 'flex';
  setTimeout(() => { banner.style.display = 'none'; }, 1500);
}

// ── Render Battle Grid ──

function renderBattle() {
  if (!battleState) return;
  const { map, units } = battleState;
  const grid = document.getElementById('battle-grid');
  grid.style.gridTemplateColumns = `repeat(${map.cols}, 48px)`;
  grid.style.gridTemplateRows = `repeat(${map.rows}, 48px)`;

  const dangerTiles = dangerZoneActive ? getDangerZone(battleState) : [];

  let html = '';
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      const tileType = tile.type;
      const highlight = highlightedTiles.find(t => t.x === c && t.y === r);
      const highlightClass = highlight ? ` ${highlight.cls}` : '';
      const isDanger = dangerZoneActive && dangerTiles.some(d => d.x === c && d.y === r);
      const dangerClass = isDanger ? ' danger-zone' : '';
      const unit = units.find(u => u.hp > 0 && u.x === c && u.y === r);
      const selectedClass = (selectedUid && unit && unit.uid === selectedUid) ? ' selected' : '';

      let unitHtml = '';
      if (unit) {
        const hpPct = Math.round((unit.hp / unit.maxHp) * 100);
        const hpColor = hpPct > 60 ? '' : hpPct > 30 ? ' medium' : ' low';
        const actedClass = unit.acted ? ' acted' : '';
        // 🔵 제갈량: 버프/디버프 아이콘 시각화
        let buffIcons = '';
        if (unit.buffs && unit.buffs.length > 0) {
          const icons = unit.buffs.map(b => {
            if (b.stat === 'atk') return b.val > 0 ? '⚔' : '⚔̸';
            if (b.stat === 'def') return b.val > 0 ? '🛡' : '🛡̸';
            if (b.stat === '_invuln') return '⭐';
            if (b.stat === 'eva') return '💨';
            if (b.stat === 'crt') return '🎯';
            return '✦';
          });
          buffIcons = `<div class="unit-buffs">${icons.join('')}</div>`;
        }
        if (unit.shield > 0) buffIcons += `<div class="unit-shield-icon">🛡${unit.shield}</div>`;
        if (unit.invuln) buffIcons += `<div class="unit-invuln-icon">⭐</div>`;

        unitHtml = `
          <div class="unit ${unit.team}${actedClass}" data-uid="${unit.uid}">
            <img src="${portraitSrc(`assets/portraits/${unit.id}`)}" alt="${unit.name}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
            <div class="unit-initial" style="display:none">${unit.name[0]}</div>
            <div class="unit-hp-bar"><div class="unit-hp-fill${hpColor}" style="width:${hpPct}%"></div></div>
            ${buffIcons}
          </div>`;
      }

      html += `<div class="tile ${tileType}${highlightClass}${dangerClass}${selectedClass}" data-x="${c}" data-y="${r}">${unitHtml}</div>`;
    }
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.tile').forEach(el => {
    el.addEventListener('click', () => onTileClick(+el.dataset.x, +el.dataset.y));
  });

  updateHUD();
}

// ── HUD ──

function updateHUD() {
  if (!battleState) return;
  document.getElementById('hud-stage').textContent = battleState.stage.name;
  document.getElementById('hud-turn').textContent = `턴 ${battleState.turnNumber}`;
  const phaseEl = document.getElementById('phase-indicator');
  if (battleState.phase === 'player_phase') {
    phaseEl.textContent = '아군 턴';
    phaseEl.className = 'phase-indicator player';
  } else {
    phaseEl.textContent = '적 턴';
    phaseEl.className = 'phase-indicator enemy';
  }
  document.getElementById('btn-end-turn').disabled = battleState.phase !== 'player_phase';
}

// ── Unit Detail Panel ──

function showUnitDetail(unit) {
  if (!unit) { document.getElementById('unit-detail').style.display = 'none'; return; }
  const panel = document.getElementById('unit-detail');
  document.getElementById('detail-portrait').innerHTML = `
    <img src="${portraitSrc(`assets/portraits/${unit.id}`)}" alt="${unit.name}"
         onerror="this.style.display='none'" />
  `;
  document.getElementById('detail-name').textContent = `${unit.name} Lv.${unit.level}`;
  document.getElementById('detail-title').textContent = `${unit.title} · ${unit.mbti || '????'}`;
  const hpPct = Math.round((unit.hp / unit.maxHp) * 100);
  document.getElementById('detail-hp-fill').style.width = hpPct + '%';
  document.getElementById('detail-hp-text').textContent = `HP ${unit.hp}/${unit.maxHp} · XP ${unit.xp}/${unit.xpToNext}`;
  const cp = getCombatPower(unit);
  const equipNames = ['weapon', 'armor', 'accessory']
    .map(s => unit.equipment?.[s]?.name)
    .filter(Boolean);
  const relicName = unit.relic?.name || '';
  const passiveHtml = (unit.passivesApplied && unit.passivesApplied.length)
    ? `<div class="passive-list">패시브: ${unit.passivesApplied.map(p => `<span class="passive-tag">${p}</span>`).join('')}</div>` : '';
  const shieldHtml = unit.shield > 0 ? `<div class="equip-list">🛡️ 실드: ${unit.shield}</div>` : '';
  const invulnHtml = unit.invuln ? `<div class="equip-list" style="color:#ffd700">⭐ 무적 상태</div>` : '';
  const growthHtml = unit.statXP ? Object.entries(unit.statXP)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="growth-tag">${k.toUpperCase()} +${v}</span>`).join('') : '';

  document.getElementById('detail-stats').innerHTML = `
    <div class="stat-box"><span class="stat-label">ATK</span><span class="stat-val">${unit.atk}</span></div>
    <div class="stat-box"><span class="stat-label">DEF</span><span class="stat-val">${unit.def}</span></div>
    <div class="stat-box"><span class="stat-label">CRT</span><span class="stat-val">${Math.round(unit.crt * 100)}%</span></div>
    <div class="stat-box"><span class="stat-label">EVA</span><span class="stat-val">${Math.round((unit.eva || 0) * 100)}%</span></div>
    <div class="stat-box"><span class="stat-label">PEN</span><span class="stat-val">${unit.pen || 0}</span></div>
    <div class="stat-box"><span class="stat-label">MOV</span><span class="stat-val">${unit.mov}</span></div>
    <div class="stat-box"><span class="stat-label">RNG</span><span class="stat-val">${unit.rng}</span></div>
    <div class="stat-box mp-box"><span class="stat-label">MP</span><span class="stat-val mp-val">${unit.mp}/${unit.maxMp}</span></div>
    <div class="stat-box cp-box"><span class="stat-label">전투력</span><span class="stat-val cp-val">${cp}</span></div>
    ${equipNames.length ? `<div class="equip-list">장비: ${equipNames.join(' · ')}</div>` : ''}
    ${relicName ? `<div class="equip-list">유물: ${relicName}</div>` : ''}
    ${passiveHtml}
    ${shieldHtml}${invulnHtml}
    ${growthHtml ? `<div class="growth-list">성장: ${growthHtml}</div>` : ''}
  `;
  const sense = unit.senseSkill;
  if (sense) {
    const info = SENSE_TYPES[sense.baseType];
    const cdText = sense.cooldown > 0 ? `쿨다운 ${sense.cooldown}턴` : '사용 가능';
    const mpCostText = sense.mpCost ? `MP ${sense.mpCost}` : '';
    document.getElementById('detail-sense').innerHTML = `
      <div class="sense-info">
        <span class="sense-icon">${info?.icon || '?'}</span>
        <strong>${sense.name}</strong> (${sense.baseType}) ${mpCostText} · ${cdText}
      </div>
    `;
  } else {
    document.getElementById('detail-sense').innerHTML = '';
  }
  panel.style.display = '';
}

// ── Action Menu ──

function showActionMenu(unit) {
  if (!unit || unit.team !== 'player' || unit.acted || battleState.phase !== 'player_phase') {
    document.getElementById('action-menu').style.display = 'none';
    return;
  }
  const menu = document.getElementById('action-menu');
  menu.style.display = 'flex';

  const hasSense = unit.senseSkill && unit.senseSkill.cooldown === 0 && unit.mp >= (unit.senseSkill.mpCost || 0);
  document.getElementById('btn-skill').disabled = !hasSense;

  const targets = getAttackTargets(battleState, unit);
  document.getElementById('btn-attack').disabled = targets.length === 0;

  const hasItems = gameSave.inventory && gameSave.inventory.length > 0;
  document.getElementById('btn-item').disabled = !hasItems;

  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) {
    undoBtn.style.display = (undoMoveData && undoMoveData.uid === unit.uid) ? '' : 'none';
  }
}

function hideActionMenu() {
  document.getElementById('action-menu').style.display = 'none';
}

// ── Tile Click Handler ──

function onTileClick(x, y) {
  if (!battleState || battleState.phase !== 'player_phase') return;

  const clickedUnit = battleState.units.find(u => u.hp > 0 && u.x === x && u.y === y);

  if (uiMode === 'move') {
    const valid = highlightedTiles.find(t => t.x === x && t.y === y && t.cls === 'move-range');
    if (valid) {
      const unit = getUnitByUid(battleState, selectedUid);
      undoMoveData = { uid: unit.uid, fromX: unit.x, fromY: unit.y };
      const result = moveUnit(battleState, unit, x, y);
      if (result.ok) {
        appendLog(`${unit.name} → (${x},${y}) 이동`);
        uiMode = 'selected';
        highlightedTiles = [];
        showActionMenu(unit);
        renderBattle();
        showUnitDetail(unit);
      }
    } else {
      cancelSelection();
    }
    return;
  }

  if (uiMode === 'attack') {
    const valid = highlightedTiles.find(t => t.x === x && t.y === y && t.cls === 'attack-range');
    if (valid && clickedUnit && clickedUnit.team === 'enemy') {
      const attacker = getUnitByUid(battleState, selectedUid);
      commandTarget = clickedUnit;
      uiMode = 'command';
      highlightedTiles = [];
      hideActionMenu();
      showCommandPanel(attacker, clickedUnit);
      renderBattle();
    } else {
      cancelSelection();
    }
    return;
  }

  if (uiMode === 'command') {
    cancelSelection();
    return;
  }

  // Default: select unit
  if (clickedUnit && clickedUnit.team === 'player' && !clickedUnit.acted) {
    selectedUid = clickedUnit.uid;
    uiMode = 'selected';
    highlightedTiles = [];
    showUnitDetail(clickedUnit);
    showActionMenu(clickedUnit);
    renderBattle();
  } else if (clickedUnit) {
    showUnitDetail(clickedUnit);
    selectedUid = null;
    uiMode = 'idle';
    hideActionMenu();
    renderBattle();
  } else {
    cancelSelection();
  }
}

function cancelSelection() {
  selectedUid = null;
  commandTarget = null;
  uiMode = 'idle';
  highlightedTiles = [];
  hideActionMenu();
  hideCommandPanel();
  showUnitDetail(null);
  if (document.getElementById('item-panel')) document.getElementById('item-panel').style.display = 'none';
  renderBattle();
}

// ── Actions ──

function onMoveBtn() {
  if (!selectedUid) return;
  const unit = getUnitByUid(battleState, selectedUid);
  if (!unit) return;
  const range = getMovementRange(battleState, unit);
  highlightedTiles = range.map(t => ({ x: t.x, y: t.y, cls: 'move-range' }));
  uiMode = 'move';
  renderBattle();
}

function onAttackBtn() {
  if (!selectedUid) return;
  const unit = getUnitByUid(battleState, selectedUid);
  if (!unit) return;
  const range = getAttackRange(battleState, unit);
  highlightedTiles = range.map(t => ({ x: t.x, y: t.y, cls: 'attack-range' }));
  uiMode = 'attack';
  renderBattle();
}

function onSkillBtn() {
  if (!selectedUid) return;
  const unit = getUnitByUid(battleState, selectedUid);
  if (!unit || !unit.senseSkill || unit.senseSkill.cooldown > 0) return;

  undoMoveData = null;
  const result = activateSense(battleState, unit);
  if (result.ok) {
    showSkillOverlay(unit.senseSkill.name, SENSE_TYPES[unit.senseSkill.baseType]?.category);
    appendLog(`✦ ${unit.name}의 「${result.skillName}」 발동!`);
    result.effects.forEach(e => appendLog(`  → ${e}`));
    progressQuest(gameSave, 'skill');
    saveGame(gameSave);

    const vc = checkVictory(battleState);
    if (vc) { handleBattleEnd(vc); return; }

    cancelSelection();
    checkAutoEndTurn();
  }
}

// 🔵 제갈량: 아이템 사용
function onItemBtn() {
  if (!selectedUid) return;
  const unit = getUnitByUid(battleState, selectedUid);
  if (!unit || !gameSave.inventory || gameSave.inventory.length === 0) return;

  const panel = document.getElementById('item-panel');
  const list = document.getElementById('item-list');
  const itemIcon = { heal: '🧪', mp: '💧', atkBuff: '⚔️', defBuff: '🛡️', crtBuff: '🎯', xp: '💎' };

  list.innerHTML = gameSave.inventory.map((item, i) => {
    const effectKey = Object.keys(item.effect)[0];
    return `<button class="item-option" data-idx="${i}">
      <span class="item-icon">${itemIcon[effectKey] || '📦'}</span>
      <span class="item-name">${item.name}</span>
    </button>`;
  }).join('') + `<button class="item-option item-cancel" data-idx="-1">취소</button>`;

  list.querySelectorAll('.item-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      panel.style.display = 'none';
      if (idx < 0) return;
      const item = gameSave.inventory[idx];
      if (!item) return;
      const result = useItem(battleState, unit, item);
      if (result.ok) {
        undoMoveData = null;
        gameSave.inventory.splice(idx, 1);
        saveGame(gameSave);
        appendLog(`🧪 ${unit.name}: ${result.name} 사용`);
        result.effects.forEach(e => appendLog(`  → ${e}`));
        cancelSelection();
        renderBattle();
        checkAutoEndTurn();
      }
    });
  });
  panel.style.display = 'flex';
}

function onUndoMove() {
  if (!undoMoveData) return;
  const unit = getUnitByUid(battleState, undoMoveData.uid);
  if (!unit || unit.acted) return;
  unit.x = undoMoveData.fromX;
  unit.y = undoMoveData.fromY;
  appendLog(`↩ ${unit.name} 이동 취소`);
  undoMoveData = null;
  cancelSelection();
}

function onWaitBtn() {
  if (!selectedUid) return;
  const unit = getUnitByUid(battleState, selectedUid);
  if (unit) {
    unit.acted = true;
    appendLog(`${unit.name} 대기`);
  }
  undoMoveData = null;
  cancelSelection();
  checkAutoEndTurn();
}

// ── Command Panel ──

function showCommandPanel(attacker, defender) {
  const panel = document.getElementById('command-panel');
  const list = document.getElementById('command-list');

  const preview = previewDamage(battleState, attacker, defender);
  const typeLabel = { physical: '물리', mental: '정신', blood: '혈액' };
  const typeIcon = { physical: '⚔️', mental: '🧠', blood: '🩸' };

  let html = '';

  // Basic attack option
  html += `
    <button class="cmd-option" data-cmd="basic">
      <div class="cmd-illust-slot">${typeIcon[attacker.attackType] || '⚔️'}</div>
      <div class="cmd-info">
        <div class="cmd-name">기본 공격${preview.flanking > 0 ? ` <span class="cmd-flank">협공+${preview.flanking}</span>` : ''}</div>
        <div class="cmd-type">${typeLabel[attacker.attackType] || '물리'} · MP 0</div>
        <div class="cmd-dmg">예상 ${preview.minDmg}~${preview.maxDmg} <span class="cmd-crit">CRT ${Math.round(preview.critDmg)}</span></div>
      </div>
      <div class="cmd-meta">
        <span class="cmd-eva">회피 ${Math.round((preview.eva || 0) * 100)}%</span>
      </div>
    </button>`;

  // Skill option
  if (attacker.senseSkill) {
    const sense = attacker.senseSkill;
    const senseInfo = SENSE_TYPES[sense.baseType];
    const skillPreview = previewSkillDamage(attacker);
    const canUse = sense.cooldown === 0 && attacker.mp >= (sense.mpCost || 0);
    const cooldownText = sense.cooldown > 0 ? `쿨다운 ${sense.cooldown}턴` : '';
    const mpText = `MP ${sense.mpCost || 0}`;

    let effectText = '';
    if (skillPreview) {
      if (skillPreview.type === 'damage') effectText = `데미지 ~${skillPreview.value} · ${skillPreview.range}`;
      else if (skillPreview.type === 'heal') effectText = `회복 ~${skillPreview.value} · ${skillPreview.range}`;
      else if (skillPreview.type === 'buff') effectText = `버프 +${skillPreview.value} · ${skillPreview.range}`;
      else if (skillPreview.type === 'debuff') effectText = `디버프 -${skillPreview.value} · ${skillPreview.range}`;
    }

    html += `
      <button class="cmd-option ${canUse ? '' : 'cmd-disabled'}" data-cmd="skill" ${canUse ? '' : 'disabled'}>
        <div class="cmd-illust-slot">${senseInfo?.icon || '✦'}</div>
        <div class="cmd-info">
          <div class="cmd-name">「${sense.name}」</div>
          <div class="cmd-type">${sense.baseType} · ${mpText} ${cooldownText ? `· ${cooldownText}` : ''}</div>
          <div class="cmd-dmg">${effectText}</div>
        </div>
        <div class="cmd-meta">
          <span class="cmd-mp">MP ${attacker.mp}/${attacker.maxMp}</span>
        </div>
      </button>`;
  }

  // Ultimate options
  if (attacker.ultimates) {
    attacker.ultimates.forEach((ult, idx) => {
      const locked = attacker.level < ult.unlockLevel;
      const onCd = ult.currentCooldown > 0;
      const noMp = attacker.mp < ult.mpCost;
      const canUse = !locked && !onCd && !noMp;
      const statusText = locked ? `Lv.${ult.unlockLevel} 해금` : onCd ? `쿨다운 ${ult.currentCooldown}턴` : `MP ${ult.mpCost}`;

      html += `
        <button class="cmd-option cmd-ult ${canUse ? '' : 'cmd-disabled'}" data-cmd="ult-${idx}" ${canUse ? '' : 'disabled'}>
          <div class="cmd-illust-slot cmd-ult-icon">${ult.icon || '🌟'}</div>
          <div class="cmd-info">
            <div class="cmd-name">🌟 ${ult.name}</div>
            <div class="cmd-type">궁극기 · ${statusText}</div>
            <div class="cmd-dmg">${ult.desc}</div>
          </div>
          <div class="cmd-meta">
            <span class="cmd-mp">MP ${attacker.mp}/${attacker.maxMp}</span>
          </div>
        </button>`;
    });
  }

  // Cancel button
  html += `<button class="cmd-option cmd-cancel" data-cmd="cancel">취소</button>`;

  list.innerHTML = html;

  // Target info
  document.getElementById('cmd-target-name').textContent = defender.name;
  document.getElementById('cmd-target-hp').textContent = `HP ${defender.hp}/${defender.maxHp}`;
  const tPortrait = document.getElementById('cmd-target-portrait');
  tPortrait.innerHTML = `<img src="${portraitSrc(`assets/portraits/${defender.id}`)}"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
    <div class="unit-initial" style="display:none">${defender.name[0]}</div>`;

  // Bind clicks
  list.querySelectorAll('.cmd-option').forEach(btn => {
    btn.addEventListener('click', () => onCommandSelect(btn.dataset.cmd, attacker, defender));
  });

  panel.style.display = 'flex';
}

function hideCommandPanel() {
  document.getElementById('command-panel').style.display = 'none';
}

function onCommandSelect(cmd, attacker, defender) {
  hideCommandPanel();
  if (cmd === 'basic') {
    doAttack(attacker, defender);
  } else if (cmd === 'skill') {
    doSkillAttack(attacker, defender);
  } else if (cmd.startsWith('ult-')) {
    const idx = parseInt(cmd.split('-')[1]);
    doUltimate(attacker, idx);
  } else {
    uiMode = 'selected';
    commandTarget = null;
    showActionMenu(attacker);
    renderBattle();
  }
}

async function doSkillAttack(attacker, defender) {
  undoMoveData = null;
  if (!attacker.senseSkill || attacker.senseSkill.cooldown > 0) return;

  const result = activateSense(battleState, attacker);
  if (!result.ok) return;

  showSkillOverlay(attacker.senseSkill.name, SENSE_TYPES[attacker.senseSkill.baseType]?.category);
  appendLog(`✦ ${attacker.name}의 「${result.skillName}」 발동!`);
  result.effects.forEach(e => appendLog(`  → ${e}`));
  progressQuest(gameSave, 'skill');
  saveGame(gameSave);

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 600); return; }

  commandTarget = null;
  cancelSelection();
  checkAutoEndTurn();
}

async function doUltimate(unit, ultIndex) {
  undoMoveData = null;
  const result = executeUltimate(battleState, unit, ultIndex);
  if (!result.ok) return;

  showSkillOverlay(result.name, 'ult');
  appendLog(`🌟 ${unit.name}의 궁극기 「${result.name}」!`);
  result.effects.forEach(e => appendLog(`  → ${e}`));
  progressQuest(gameSave, 'ultimate');
  saveGame(gameSave);

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 600); return; }

  commandTarget = null;
  cancelSelection();
  checkAutoEndTurn();
}

// ── Combat ──

async function doAttack(attacker, defender) {
  undoMoveData = null;
  const result = attackUnit(battleState, attacker, defender);
  if (!result.ok) return;

  renderBattle();
  await showCombatWidget(attacker, defender, result);

  const defTile = document.querySelector(`.tile[data-x="${defender.x}"][data-y="${defender.y}"]`);
  const atkTile = document.querySelector(`.tile[data-x="${attacker.x}"][data-y="${attacker.y}"]`);

  if (result.evaded) {
    if (defTile) showFloatingText(defTile, '회피!', 'evade');
  } else if (defTile) {
    const label = result.penetrated ? `관통! -${result.damage}` : `-${result.damage}`;
    showFloatingText(defTile, label, result.critical ? 'critical' : (result.penetrated ? 'penetrate' : 'damage'));
    defTile.classList.add('damage-shake');
    setTimeout(() => defTile.classList.remove('damage-shake'), 400);
  }

  if (result.counterDamage > 0 && atkTile) {
    setTimeout(() => showFloatingText(atkTile, `-${result.counterDamage}`, 'damage'), 500);
  }

  if (result.evaded) {
    appendLog(`⚔ ${attacker.name} → ${defender.name}: 회피!`);
  } else {
    const tags = [];
    if (result.penetrated) tags.push('관통');
    if (result.critical) tags.push('크리티컬');
    appendLog(`⚔ ${attacker.name} → ${defender.name}: ${result.damage}${tags.length ? ' ' + tags.join(' ') + '!' : ''}`);
  }
  if (result.counterDamage) appendLog(`  ↩ 반격: ${result.counterDamage}`);
  if (result.defenderDied) {
    appendLog(`  💀 ${defender.name} 전사!`);
    gameSave.stats.totalKills++;
    progressQuest(gameSave, 'kill');
    saveGame(gameSave);
  }
  if (result.attackerDied) appendLog(`  💀 ${attacker.name} 전사!`);

  // XP & Level Up
  if (result.xpGains) {
    result.xpGains.forEach(g => {
      g.levelUps.forEach(lv => {
        const u = getUnitByUid(battleState, g.unit);
        if (u) showLevelUp(u.name, lv.level);
        appendLog(`⬆ ${u?.name || '?'} Lv.${lv.level} 달성!`);
      });
    });
  }

  // Loot drop → save to inventory
  if (result.loot) {
    showLootDrop(result.loot);
    appendLog(`🎁 드롭: ${result.loot.name}`);
    gameSave.inventory.push(result.loot);
    saveGame(gameSave);
  }

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 600); return; }

  cancelSelection();
  checkAutoEndTurn();
}

// ── Visual Effects ──

function showFloatingText(tileEl, text, type) {
  const ft = document.createElement('div');
  ft.className = `float-text ${type}`;
  ft.textContent = text;
  tileEl.appendChild(ft);
  setTimeout(() => ft.remove(), 1000);
}

function showCombatWidget(attacker, defender, result) {
  const w = document.getElementById('combat-widget');

  const setPortrait = (id, unit) => {
    const el = document.getElementById(id);
    el.innerHTML = `<img src="${portraitSrc(`assets/portraits/${unit.id}`)}"
      onerror="this.style.display='none';this.parentElement.innerHTML='<span class=cw-initial>${unit.name[0]}</span>'" />`;
  };
  setPortrait('cw-atk-portrait', attacker);
  setPortrait('cw-def-portrait', defender);

  document.getElementById('cw-atk-name').textContent = attacker.name;
  document.getElementById('cw-def-name').textContent = defender.name;
  document.getElementById('cw-atk-stats').textContent = `ATK ${attacker.atk}  DEF ${attacker.def}`;

  const typeMap = { physical: '⚔️', mental: '🧠', blood: '🩸' };
  document.getElementById('cw-type-icon').textContent = typeMap[attacker.attackType] || '⚔️';

  const dmgEl = document.getElementById('cw-damage');
  const resultEl = document.getElementById('cw-result');
  const subEl = document.getElementById('cw-sub');
  const hpEl = document.getElementById('cw-def-hp');

  if (result.evaded) {
    dmgEl.textContent = '회피!';
    dmgEl.className = 'cw-damage evaded';
    resultEl.textContent = '';
    hpEl.textContent = '';
  } else {
    dmgEl.textContent = `-${result.damage}`;
    dmgEl.className = 'cw-damage';
    const tags = [];
    if (result.penetrated) tags.push('관통');
    if (result.critical) tags.push('크리티컬!');
    resultEl.textContent = tags.join(' ');
    if (result.defenderDied) {
      hpEl.textContent = '💀 전사';
      hpEl.className = 'cw-hp-change ko';
    } else {
      hpEl.textContent = `HP ${defender.hp}/${defender.maxHp}`;
      hpEl.className = 'cw-hp-change';
    }
  }
  subEl.textContent = result.counterDamage ? `반격 -${result.counterDamage}` : '';

  w.style.display = 'flex';
  return new Promise(resolve => {
    const dismiss = () => { w.style.display = 'none'; resolve(); };
    w.onclick = dismiss;
    setTimeout(dismiss, 2000);
  });
}

function showSkillOverlay(name, category) {
  const overlay = document.getElementById('skill-overlay');
  overlay.className = `skill-overlay ${category === '촉' ? 'human' : 'blood'}`;
  document.getElementById('skill-overlay-name').textContent = `「${name}」`;
  overlay.style.display = 'flex';
  setTimeout(() => { overlay.style.display = 'none'; }, 1200);
}

function showLootDrop(loot) {
  const el = document.getElementById('loot-popup');
  document.getElementById('loot-name').textContent = loot.name;
  el.style.display = '';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

function showLevelUp(name, level) {
  const el = document.getElementById('levelup-popup');
  document.getElementById('levelup-name').textContent = name;
  document.getElementById('levelup-level').textContent = `Lv.${level}`;
  el.style.display = '';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// 🔴 사마의: 증원 배너
function showReinforceBanner(msg) {
  const el = document.getElementById('reinforce-banner');
  document.getElementById('reinforce-text').textContent = msg;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// 🔵 제갈량: 위험 범위 토글
function toggleDangerZone() {
  dangerZoneActive = !dangerZoneActive;
  const btn = document.getElementById('btn-danger-zone');
  btn.classList.toggle('active', dangerZoneActive);
  renderBattle();
}

// 🔴🔵 유닛 상태 목록
function showUnitListPanel() {
  if (!battleState) return;
  const panel = document.getElementById('unit-list-panel');
  const content = document.getElementById('ulp-content');
  const playerUnits = battleState.units.filter(u => u.team === 'player');
  const enemyUnits = battleState.units.filter(u => u.team === 'enemy');

  const renderUnit = (u) => {
    const hpPct = u.hp > 0 ? Math.round((u.hp / u.maxHp) * 100) : 0;
    const hpColor = u.hp <= 0 ? 'dead' : hpPct > 60 ? '' : hpPct > 30 ? 'medium' : 'low';
    const acted = u.acted ? ' acted' : '';
    const buffCount = (u.buffs?.length || 0);
    return `<div class="ulp-unit ${u.team}${acted} ${u.hp <= 0 ? 'ulp-dead' : ''}">
      <span class="ulp-name">${u.name}</span>
      <div class="ulp-hp-bar"><div class="ulp-hp-fill ${hpColor}" style="width:${hpPct}%"></div></div>
      <span class="ulp-hp-text">${u.hp}/${u.maxHp}</span>
      ${buffCount > 0 ? `<span class="ulp-buffs">✦${buffCount}</span>` : ''}
      ${u.acted ? '<span class="ulp-acted">✓</span>' : ''}
    </div>`;
  };

  content.innerHTML = `
    <div class="ulp-section"><div class="ulp-label">🔵 아군</div>${playerUnits.map(renderUnit).join('')}</div>
    <div class="ulp-section"><div class="ulp-label">🔴 적</div>${enemyUnits.map(renderUnit).join('')}</div>
  `;
  panel.style.display = '';
}

// ── End Turn ──

function checkAutoEndTurn() {
  if (battleState && allPlayerUnitsActed(battleState)) {
    setTimeout(() => endTurn(), 400);
  }
}

function endTurn() {
  if (!battleState || battleState.phase !== 'player_phase') return;

  endPlayerPhase(battleState);
  showPhaseBanner('적 턴', 'enemy');
  document.getElementById('btn-end-turn').disabled = true;

  setTimeout(async () => {
    const actions = runEnemyPhase(battleState);

    for (const a of actions) {
      if (a.type === 'attack') {
        const unit = getUnitByUid(battleState, a.unit);
        const target = getUnitByUid(battleState, a.target);
        renderBattle();
        if (unit) highlightEnemyAction(unit);
        appendLog(`⚔ ${unit?.name || '적'} → ${target?.name || '?'}: ${a.damage}${a.critical ? ' 크리티컬!' : ''}`);
        if (a.defenderDied) appendLog(`  💀 ${target?.name} 전사!`);
        const defTile = target ? document.querySelector(`.tile[data-x="${target.x}"][data-y="${target.y}"]`) : null;
        if (defTile && !a.evaded) {
          showFloatingText(defTile, `-${a.damage}`, a.critical ? 'critical' : 'damage');
          defTile.classList.add('damage-shake');
          setTimeout(() => defTile.classList.remove('damage-shake'), 400);
        }
        await delay(600);
      } else if (a.type === 'move') {
        const unit = getUnitByUid(battleState, a.unit);
        renderBattle();
        appendLog(`적 ${unit?.name || '?'} 이동`);
        await delay(300);
      } else if (a.type === 'sense') {
        renderBattle();
        appendLog(`✦ 적 스킬: ${a.skillName}`);
        showSkillOverlay(a.skillName, 'blood');
        await delay(800);
      } else if (a.type === 'ultimate') {
        renderBattle();
        appendLog(`🌟 적 궁극기: ${a.name}`);
        a.effects?.forEach(e => appendLog(`  → ${e}`));
        showSkillOverlay(a.name, 'ult');
        await delay(1000);
      } else if (a.type === 'enrage') {
        const unit = getUnitByUid(battleState, a.unit);
        renderBattle();
        appendLog(`🔥 ${unit?.name || '?'} 분노! ATK +${a.atkBoost}`);
        showReinforceBanner(`🔥 ${unit?.name || '?'} 분노 발동!`);
        await delay(1200);
      }

      const vc = checkVictory(battleState);
      if (vc) { handleBattleEnd(vc); return; }
    }

    endEnemyPhase(battleState);

    const reinforcement = spawnReinforcements(battleState);
    if (reinforcement) {
      renderBattle();
      showReinforceBanner(reinforcement.message);
      reinforcement.units.forEach(u => appendLog(`🔴 증원: ${u.name} 등장!`));
      await delay(2000);
    }

    showPhaseBanner('아군 턴', 'player');
    renderBattle();
  }, 800);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function highlightEnemyAction(unit) {
  const tile = document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`);
  if (tile) {
    tile.classList.add('enemy-acting');
    setTimeout(() => tile.classList.remove('enemy-acting'), 600);
  }
}

// ── Battle End ──

function handleBattleEnd(result) {
  const overlay = document.getElementById('battle-result');
  const box = document.getElementById('battle-result-box');
  const title = document.getElementById('result-title');
  const text = document.getElementById('result-text');

  gameSave.stats.totalBattles++;
  progressQuest(gameSave, 'battle');

  saveCharProgress(gameSave, battleState.units);

  const playerUnits = battleState.units.filter(u => u.team === 'player');
  const survivors = playerUnits.filter(u => u.hp > 0);
  const enemiesDefeated = battleState.units.filter(u => u.team === 'enemy' && u.hp <= 0).length;

  if (result === 'win') {
    title.textContent = '승리!';
    box.className = 'battle-result-box win';
    const turns = battleState.turnNumber;
    const stars = turns <= 5 ? 3 : turns <= 8 ? 2 : 1;
    recordStageClear(gameSave, battleState.stageId, turns);

    const unitSummary = playerUnits.map(u => {
      const lvInfo = u.level > 1 ? ` Lv.${u.level}` : '';
      const status = u.hp > 0 ? `HP ${u.hp}/${u.maxHp}` : '💀 전사';
      return `<div class="result-unit ${u.hp <= 0 ? 'result-dead' : ''}">
        <span class="result-unit-name">${u.name}${lvInfo}</span>
        <span class="result-unit-status">${status}</span>
      </div>`;
    }).join('');

    text.innerHTML = `
      <div class="result-story">${battleState.stage.storyOutro || '모든 적을 제압했습니다!'}</div>
      <div class="result-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
      <div class="result-summary">
        <span>${turns}턴</span> · <span>생존 ${survivors.length}/${playerUnits.length}</span> · <span>처치 ${enemiesDefeated}</span>
      </div>
      <div class="result-units">${unitSummary}</div>
    `;
    gameSave.stats.wins++;
    progressQuest(gameSave, 'win');
    addCard(gameSave, CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id, 'common');
    if (battleState.stageId === 'stage-4') progressQuest(gameSave, 'clear_stage4');
  } else {
    title.textContent = '패배...';
    box.className = 'battle-result-box lose';
    text.innerHTML = `
      <div class="result-story">모든 아군이 전사했습니다. 다시 도전하세요.</div>
      <div class="result-summary">${battleState.turnNumber}턴 · 처치 ${enemiesDefeated}</div>
    `;
    gameSave.stats.losses++;
  }

  saveGame(gameSave);
  overlay.style.display = 'flex';
  document.getElementById('btn-result-ok').onclick = () => {
    overlay.style.display = 'none';
    battleState = null;
    document.getElementById('battle-screen').style.display = 'none';
    document.getElementById('stage-select').style.display = '';
    cancelSelection();
    renderStats();
  };
}

// ── Battle Log ──

function appendLog(msg) {
  const log = document.getElementById('battle-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// ── Init ──

// ── Stats & Quests Rendering ──

function renderStats() {
  const s = gameSave.stats;
  const centerBuff = getCenterBuff(gameSave);
  const quests = getQuestSummary(gameSave);

  document.getElementById('stats-summary').innerHTML = `
    <div class="center-info">
      <div class="center-level">${centerBuff.label}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-item"><span>총 전투</span><strong>${s.totalBattles}</strong></div>
      <div class="stat-item"><span>승리</span><strong>${s.wins}</strong></div>
      <div class="stat-item"><span>패배</span><strong>${s.losses}</strong></div>
      <div class="stat-item"><span>승률</span><strong>${s.totalBattles ? Math.round(s.wins/s.totalBattles*100) : 0}%</strong></div>
      <div class="stat-item"><span>총 처치</span><strong>${s.totalKills}</strong></div>
      <div class="stat-item"><span>출석</span><strong>${quests.attendance}일</strong></div>
    </div>
  `;

  const renderQuestList = (list, title) => {
    if (!list || list.length === 0) return '';
    return `<h4>${title}</h4>` + list.map(q => `
      <div class="quest-item ${q.completed ? 'quest-done' : ''}">
        <span class="quest-name">${q.name}</span>
        <span class="quest-progress">${Math.min(q.progress, q.goal)}/${q.goal}</span>
        ${q.completed ? '<span class="quest-check">✅</span>' : ''}
      </div>
    `).join('');
  };

  document.getElementById('stats-history').innerHTML = `
    ${renderQuestList(quests.daily, '📋 일일 퀘스트')}
    ${renderQuestList(quests.weekly, '📅 주간 퀘스트')}
    ${quests.monthly ? renderQuestList([quests.monthly], '🏆 월간 퀘스트') : ''}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initGallery();
  renderStageSelect();
  renderStats();

  const attend = getAttendanceReward(gameSave.quests.attendance);
  if (attend) {
    appendLog(`🎁 출석 ${gameSave.quests.attendance}일 보상!`);
    attend.cards.forEach(rarity => {
      const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      addCard(gameSave, randomChar.id, rarity);
    });
    saveGame(gameSave);
  }

  document.getElementById('popup-close').addEventListener('click', () => {
    document.getElementById('card-popup').style.display = 'none';
  });
  document.getElementById('card-popup').addEventListener('click', (e) => {
    if (e.target.id === 'card-popup') document.getElementById('card-popup').style.display = 'none';
  });

  document.getElementById('btn-move').addEventListener('click', onMoveBtn);
  document.getElementById('btn-attack').addEventListener('click', onAttackBtn);
  document.getElementById('btn-skill').addEventListener('click', onSkillBtn);
  document.getElementById('btn-wait').addEventListener('click', onWaitBtn);
  document.getElementById('btn-item').addEventListener('click', onItemBtn);
  document.getElementById('btn-undo').addEventListener('click', onUndoMove);
  document.getElementById('btn-end-turn').addEventListener('click', endTurn);
  document.getElementById('btn-danger-zone').addEventListener('click', toggleDangerZone);
  document.getElementById('btn-unit-list').addEventListener('click', showUnitListPanel);
  document.getElementById('ulp-close').addEventListener('click', () => {
    document.getElementById('unit-list-panel').style.display = 'none';
  });
});
