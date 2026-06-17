import { CHARACTERS, SENSE_TYPES } from './cards.js';
import {
  createBattleState, moveUnit, attackUnit, getMovementRange, getAttackRange,
  getAttackTargets, activateSense, endPlayerPhase, endEnemyPhase,
  runEnemyPhase, checkVictory, allPlayerUnitsActed,
  STAGES, TILE_TYPES, getLivingUnits, getUnitByUid, getCombatPower,
  previewDamage, previewSkillDamage,
} from './engine.js';

let battleState = null;
let uiMode = 'idle'; // idle | selected | move | attack | skill | command
let selectedUid = null;
let highlightedTiles = [];
let deploySelected = [];
let currentStageId = null;
let commandTarget = null;

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
  list.innerHTML = STAGES.map((s, i) => `
    <div class="stage-card" data-stage="${s.id}">
      <div class="stage-num">${i + 1}</div>
      <div class="stage-info">
        <div class="stage-name">${s.name}</div>
        <div class="stage-desc">${s.description}</div>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.stage-card').forEach(el => {
    el.addEventListener('click', () => openDeploy(el.dataset.stage));
  });
}

// ── Deploy Screen ──

function openDeploy(stageId) {
  currentStageId = stageId;
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) return;

  deploySelected = [];
  const maxUnits = stage.playerSpawns.length;

  document.getElementById('stage-select').style.display = 'none';
  document.getElementById('deploy-screen').style.display = '';
  document.getElementById('deploy-stage-name').textContent = `${stage.name} — 유닛 편성`;
  document.getElementById('deploy-max').textContent = maxUnits;
  document.getElementById('deploy-count').textContent = '0';

  const playerChars = CHARACTERS.filter(c => c.faction !== 'kartein');
  const roster = document.getElementById('deploy-roster');
  roster.innerHTML = playerChars.map(c => {
    const hp = c.power * 12 + ({common:10,uncommon:20,rare:35,legendary:50}[c.rarity]||0);
    const atk = c.power * 4 + ({common:2,uncommon:4,rare:6,legendary:10}[c.rarity]||0);
    return `<div class="deploy-unit" data-id="${c.id}" data-rarity="${c.rarity}">
      <div class="deploy-thumb"><img src="${portraitSrc(c.portrait)}" alt="" onerror="this.style.display='none'"/></div>
      <div class="deploy-info">
        <div class="deploy-name">${c.name}</div>
        <div class="deploy-stats">HP:${hp} ATK:${atk}</div>
      </div>
    </div>`;
  }).join('');

  roster.querySelectorAll('.deploy-unit').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      if (deploySelected.includes(id)) {
        deploySelected = deploySelected.filter(x => x !== id);
        el.classList.remove('selected');
      } else if (deploySelected.length < maxUnits) {
        deploySelected.push(id);
        el.classList.add('selected');
      }
      document.getElementById('deploy-count').textContent = deploySelected.length;
      document.getElementById('btn-deploy-start').disabled = deploySelected.length === 0;
    });
  });

  document.getElementById('btn-deploy-back').onclick = () => {
    document.getElementById('deploy-screen').style.display = 'none';
    document.getElementById('stage-select').style.display = '';
  };
  document.getElementById('btn-deploy-start').onclick = () => startBattle();
}

// ── Battle Start ──

function startBattle() {
  battleState = createBattleState(currentStageId, deploySelected);
  document.getElementById('deploy-screen').style.display = 'none';
  document.getElementById('battle-screen').style.display = '';
  document.getElementById('battle-log').innerHTML = '';

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
  grid.style.gridTemplateColumns = `repeat(${map.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${map.rows}, 1fr)`;

  let html = '';
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      const tileType = tile.type;
      const highlight = highlightedTiles.find(t => t.x === c && t.y === r);
      const highlightClass = highlight ? ` ${highlight.cls}` : '';
      const unit = units.find(u => u.hp > 0 && u.x === c && u.y === r);
      const selectedClass = (selectedUid && unit && unit.uid === selectedUid) ? ' selected' : '';

      let unitHtml = '';
      if (unit) {
        const hpPct = Math.round((unit.hp / unit.maxHp) * 100);
        const hpColor = hpPct > 60 ? '' : hpPct > 30 ? ' medium' : ' low';
        const actedClass = unit.acted ? ' acted' : '';
        unitHtml = `
          <div class="unit ${unit.team}${actedClass}" data-uid="${unit.uid}">
            <img src="${portraitSrc(`assets/portraits/${unit.id}`)}" alt="${unit.name}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
            <div class="unit-initial" style="display:none">${unit.name[0]}</div>
            <div class="unit-hp-bar"><div class="unit-hp-fill${hpColor}" style="width:${hpPct}%"></div></div>
          </div>`;
      }

      html += `<div class="tile ${tileType}${highlightClass}${selectedClass}" data-x="${c}" data-y="${r}">${unitHtml}</div>`;
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
  document.getElementById('detail-name').textContent = unit.name;
  document.getElementById('detail-title').textContent = unit.title;
  const hpPct = Math.round((unit.hp / unit.maxHp) * 100);
  document.getElementById('detail-hp-fill').style.width = hpPct + '%';
  document.getElementById('detail-hp-text').textContent = `${unit.hp}/${unit.maxHp}`;
  const cp = getCombatPower(unit);
  const equipNames = ['weapon', 'armor', 'accessory']
    .map(s => unit.equipment?.[s]?.name)
    .filter(Boolean);
  const relicName = unit.relic?.name || '';
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

  const result = activateSense(battleState, unit);
  if (result.ok) {
    showSkillOverlay(unit.senseSkill.name, SENSE_TYPES[unit.senseSkill.baseType]?.category);
    appendLog(`✦ ${unit.name}의 「${result.skillName}」 발동!`);
    result.effects.forEach(e => appendLog(`  → ${e}`));

    const vc = checkVictory(battleState);
    if (vc) { handleBattleEnd(vc); return; }

    cancelSelection();
    checkAutoEndTurn();
  }
}

function onWaitBtn() {
  if (!selectedUid) return;
  const unit = getUnitByUid(battleState, selectedUid);
  if (unit) {
    unit.acted = true;
    appendLog(`${unit.name} 대기`);
  }
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
        <div class="cmd-name">기본 공격</div>
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
  } else {
    uiMode = 'selected';
    commandTarget = null;
    showActionMenu(attacker);
    renderBattle();
  }
}

async function doSkillAttack(attacker, defender) {
  if (!attacker.senseSkill || attacker.senseSkill.cooldown > 0) return;

  const result = activateSense(battleState, attacker);
  if (!result.ok) return;

  showSkillOverlay(attacker.senseSkill.name, SENSE_TYPES[attacker.senseSkill.baseType]?.category);
  appendLog(`✦ ${attacker.name}의 「${result.skillName}」 발동!`);
  result.effects.forEach(e => appendLog(`  → ${e}`));

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 600); return; }

  commandTarget = null;
  cancelSelection();
  checkAutoEndTurn();
}

// ── Combat ──

async function doAttack(attacker, defender) {
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
  if (result.defenderDied) appendLog(`  💀 ${defender.name} 전사!`);
  if (result.attackerDied) appendLog(`  💀 ${attacker.name} 전사!`);

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

  setTimeout(() => {
    const actions = runEnemyPhase(battleState);

    actions.forEach(a => {
      if (a.type === 'attack') {
        const target = getUnitByUid(battleState, a.target);
        appendLog(`⚔ 적 → ${target?.name || '?'}: ${a.damage}${a.critical ? ' 크리티컬!' : ''}`);
        if (a.defenderDied) appendLog(`  💀 ${target?.name} 전사!`);
      } else if (a.type === 'move') {
        const unit = getUnitByUid(battleState, a.unit);
        appendLog(`적 ${unit?.name || '?'} 이동`);
      } else if (a.type === 'sense') {
        appendLog(`✦ 적 스킬: ${a.skillName}`);
      }
    });

    const vc = checkVictory(battleState);
    if (vc) { handleBattleEnd(vc); return; }

    endEnemyPhase(battleState);
    showPhaseBanner('아군 턴', 'player');
    renderBattle();
  }, 800);
}

// ── Battle End ──

function handleBattleEnd(result) {
  const overlay = document.getElementById('battle-result');
  const box = document.getElementById('battle-result-box');
  const title = document.getElementById('result-title');
  const text = document.getElementById('result-text');

  if (result === 'win') {
    title.textContent = '승리!';
    box.className = 'battle-result-box win';
    text.textContent = battleState.stage.storyOutro || '모든 적을 제압했습니다!';
  } else {
    title.textContent = '패배...';
    box.className = 'battle-result-box lose';
    text.textContent = '모든 아군이 전사했습니다. 다시 도전하세요.';
  }
  overlay.style.display = 'flex';
  document.getElementById('btn-result-ok').onclick = () => {
    overlay.style.display = 'none';
    battleState = null;
    document.getElementById('battle-screen').style.display = 'none';
    document.getElementById('stage-select').style.display = '';
    cancelSelection();
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

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initGallery();
  renderStageSelect();

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
  document.getElementById('btn-end-turn').addEventListener('click', endTurn);
});
