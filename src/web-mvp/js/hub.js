import { CHARACTERS, SENSE_TYPES, CHARACTER_MBTI, CHAR_QUOTES } from './cards.js';
import {
  createBattleState, moveUnit, attackUnit, getMovementRange, getAttackRange,
  getAttackTargets, activateSense, endPlayerPhase, endEnemyPhase,
  runEnemyPhase, checkVictory, allPlayerUnitsActed,
  STAGES, TILE_TYPES, getLivingUnits, getUnitByUid, getCombatPower,
  previewDamage, previewSkillDamage, getFlankingBonus,
  getTeamSynergy, getTeamCP, cardToUnit, gainXP, executeUltimate, useItem, SECRET_COMBOS,
  spawnReinforcements, getDangerZone,
  EQUIPMENT, RELICS, equipItem, equipRelic,
  getSkillTargetType, getSkillTargets,
  isStunned,
  WEATHER_TYPES, applyWeatherToUnit, generateTowerStage,
  getKillForecast, PASSIVE_TREE, FACTION_SYNERGY,
  getTowerRewards,
  STORY_ACTS, getScaledEnemyLevel, ROLE_MODIFIERS,
  createTycoonState, TYCOON_GRID, FACILITY_TYPES, BLOOD_TYPES,
  generateDonorWave, getDayPreview, generateOrders,
  placeFacility, assignStaff, countFacilities, getProcessingSpeed,
  tycoonTick, fulfillOrder, tycoonDayIncome,
  upgradeFacility, TYCOON_EVENTS, rollTycoonEvent,
  getAdjacencyBonus, MILESTONES, checkMilestones,
} from './engine.js';
import { loadGame, saveGame, refreshQuests, progressQuest, getCenterBuff, getQuestSummary, getAttendanceReward, addCard, saveCharProgress, recordStageClear, synthesizeCard, getSynthesisCost, checkAchievements, ACHIEVEMENTS, ensureStarterDeck, doRecruit, progressBonds, getBondBuff, getBondLevel, enhanceCard, ENHANCE_COSTS, ENHANCE_MAX, LORE_MILESTONES, getUnlockedLoreStage } from './save.js';
import { initAudio, sfxCardPlay, sfxCollect, sfxWin, sfxLose, sfxEvent, sfxEquip, sfxHit, sfxCritical, sfxDeath, sfxSkill, sfxEvade, sfxLevelUp, sfxBuff, sfxDebuff, sfxDot, sfxShield, toggleMute, isMuted } from './sound.js';

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
let battleSpeed = 1;
let autoBattle = false;
let towerMode = false;
let towerWave = 0;
let currentHardMode = false;
let battleLogHistory = [];
let playerTurnDmg = 0;
let playerTurnKills = 0;

// ── Gallery ──

let galleryFilter = 'all';
let gallerySearch = '';
let gallerySort = '';

function getFilteredGallery() {
  let list = galleryFilter === 'all' ? [...CHARACTERS] : CHARACTERS.filter(c => c.faction === galleryFilter);
  if (gallerySearch) {
    const q = gallerySearch.toLowerCase();
    list = list.filter(c => c.name.includes(q) || c.title.includes(q));
  }
  const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  if (gallerySort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  else if (gallerySort === 'rarity') list.sort((a, b) => (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9));
  else if (gallerySort === 'owned') list.sort((a, b) => {
    const oa = gameSave.cards[a.id]?.count > 0 ? 0 : 1;
    const ob = gameSave.cards[b.id]?.count > 0 ? 0 : 1;
    return oa - ob;
  });
  return list;
}

function refreshGallery() {
  renderGalleryCards(document.getElementById('card-gallery'), getFilteredGallery());
  updateCollectionProgress();
  renderSynthSection();
  updateNavBadges();
}

function updateCollectionProgress() {
  const el = document.getElementById('collection-progress');
  if (!el) return;
  const total = CHARACTERS.length;
  const owned = CHARACTERS.filter(c => gameSave.cards[c.id]?.count > 0).length;
  const pct = Math.round(owned / total * 100);
  const rarityCount = { legendary: 0, rare: 0, uncommon: 0, common: 0 };
  CHARACTERS.forEach(c => { if (gameSave.cards[c.id]?.count > 0) rarityCount[c.rarity]++; });
  el.innerHTML = `
    <div class="coll-bar"><div class="coll-fill" style="width:${pct}%"></div></div>
    <div class="coll-text">
      <span>보유 <strong>${owned}/${total}</strong> (${pct}%)</span>
      <span class="coll-rarity">👑${rarityCount.legendary} 💎${rarityCount.rare} 🔵${rarityCount.uncommon} ⚪${rarityCount.common}</span>
    </div>`;
}

function updateRecruitUI() {
  const el = document.getElementById('recruit-ticket-count');
  if (el) el.textContent = `🎫 ${gameSave.recruitTickets || 0}`;
  const btn1 = document.getElementById('btn-recruit-1');
  const btn10 = document.getElementById('btn-recruit-10');
  if (btn1) btn1.disabled = (gameSave.recruitTickets || 0) < 1;
  if (btn10) btn10.disabled = (gameSave.recruitTickets || 0) < 10;
}

function doRecruitUI(count) {
  const result = doRecruit(gameSave, CHARACTERS, count);
  if (!result.ok) return;
  saveGame(gameSave);
  updateRecruitUI();
  sfxCollect();
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  const resultEl = document.getElementById('recruit-result');
  resultEl.innerHTML = result.results.map(r =>
    `<span class="reward-card reward-${r.rarity}">${r.name} (${rarityKo[r.rarity]})</span>`
  ).join('');
  resultEl.style.display = '';
  refreshGallery();
}

function updateNavBadges() {
  const synthCount = CHARACTERS.filter(c => {
    const d = gameSave.cards[c.id];
    return d && d.count >= getSynthesisCost(d.level);
  }).length;
  const hasTickets = (gameSave.recruitTickets || 0) > 0;
  const galleryBadge = document.getElementById('badge-gallery');
  if (galleryBadge) {
    const total = synthCount + (hasTickets ? 1 : 0);
    galleryBadge.textContent = total > 0 ? total : '';
    galleryBadge.style.display = total > 0 ? '' : 'none';
  }

  const quests = getQuestSummary(gameSave);
  const completedQuests = [...(quests.daily || []), ...(quests.weekly || [])].filter(q => q.completed).length;
  const newAch = ACHIEVEMENTS.filter(a => !gameSave.achievements[a.id] && a.check(gameSave)).length;
  const statsBadge = document.getElementById('badge-stats');
  if (statsBadge) {
    const total = completedQuests + newAch;
    statsBadge.textContent = total > 0 ? total : '';
    statsBadge.style.display = total > 0 ? '' : 'none';
  }
}

function renderSynthSection() {
  const el = document.getElementById('synth-section');
  if (!el) return;
  const synthable = CHARACTERS.filter(c => {
    const d = gameSave.cards[c.id];
    if (!d || d.count <= 0) return false;
    return d.count >= getSynthesisCost(d.level);
  });
  const allOwned = CHARACTERS.filter(c => {
    const d = gameSave.cards[c.id];
    return d && d.count > 0;
  });
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  const rarityIcon = { common: '⚪', uncommon: '🔵', rare: '💎', legendary: '👑' };

  el.innerHTML = `
    <div class="synth-header">
      <span class="synth-title">⚗️ 카드 합성</span>
      <button class="synth-bulk-btn" id="btn-synth-bulk" ${synthable.length === 0 ? 'disabled' : ''}>
        일괄 합성 (${synthable.length}장)
      </button>
    </div>
    ${synthable.length === 0
      ? '<div class="synth-empty">합성 가능한 카드가 없습니다. 같은 카드를 여러 장 모으세요!</div>'
      : `<div class="synth-grid">${synthable.map(c => {
          const d = gameSave.cards[c.id];
          const cost = getSynthesisCost(d.level);
          return `<div class="synth-card" data-synth="${c.id}">
            <div class="synth-card-top rarity-border-${c.rarity}">
              <span class="synth-card-icon">${rarityIcon[c.rarity]}</span>
              <span class="synth-card-name">${c.name}</span>
            </div>
            <div class="synth-card-info">
              <span>Lv.${d.level} → Lv.${d.level + 1}</span>
              <span class="synth-card-cost">${d.count}/${cost}장</span>
            </div>
            <button class="synth-card-btn" data-synth-id="${c.id}">합성</button>
          </div>`;
        }).join('')}</div>`
    }
    ${allOwned.length > 0 && synthable.length < allOwned.length ? `<details class="synth-all-details">
      <summary>보유 카드 합성 현황 (${allOwned.length}종)</summary>
      <div class="synth-status-grid">${allOwned.map(c => {
        const d = gameSave.cards[c.id];
        const cost = getSynthesisCost(d.level);
        const ready = d.count >= cost;
        return `<div class="synth-status-row ${ready ? 'synth-ready' : ''}">
          <span>${rarityIcon[c.rarity]} ${c.name}</span>
          <span>Lv.${d.level} · ${d.count}/${cost}장</span>
        </div>`;
      }).join('')}</div>
    </details>` : ''}
  `;

  el.querySelectorAll('.synth-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const charId = btn.dataset.synthId;
      const result = synthesizeCard(gameSave, charId);
      if (result.ok) {
        saveGame(gameSave);
        sfxLevelUp();
        const charName = CHARACTERS.find(c => c.id === charId)?.name || charId;
        showSynthToast(charName, result.newLevel);
        refreshGallery();
      }
    });
  });

  document.getElementById('btn-synth-bulk')?.addEventListener('click', () => {
    const results = bulkSynthesize();
    if (results.length > 0) {
      saveGame(gameSave);
      sfxLevelUp();
      showBulkSynthResult(results);
      refreshGallery();
    }
  });
}

function bulkSynthesize() {
  const results = [];
  let changed = true;
  while (changed) {
    changed = false;
    CHARACTERS.forEach(c => {
      const d = gameSave.cards[c.id];
      if (!d || d.count <= 0) return;
      if (d.count >= getSynthesisCost(d.level)) {
        const r = synthesizeCard(gameSave, c.id);
        if (r.ok) {
          results.push({ name: c.name, id: c.id, newLevel: r.newLevel, cost: r.cost });
          changed = true;
        }
      }
    });
  }
  return results;
}

function showSynthToast(name, newLevel) {
  const toast = document.createElement('div');
  toast.className = 'milestone-toast kill-streak';
  toast.textContent = `⬆ ${name} → Lv.${newLevel}!`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function showBulkSynthResult(results) {
  const toast = document.createElement('div');
  toast.className = 'synth-bulk-result';
  toast.innerHTML = `
    <div class="synth-bulk-header">⚗️ 일괄 합성 완료! (${results.length}건)</div>
    <div class="synth-bulk-list">${results.map(r =>
      `<div class="synth-bulk-item">⬆ ${r.name} → Lv.${r.newLevel}</div>`
    ).join('')}</div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function initGallery() {
  refreshGallery();
  updateRecruitUI();
  document.getElementById('btn-recruit-1')?.addEventListener('click', () => doRecruitUI(1));
  document.getElementById('btn-recruit-10')?.addEventListener('click', () => doRecruitUI(10));
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      galleryFilter = btn.dataset.filter;
      refreshGallery();
    });
  });
  const searchInput = document.getElementById('gallery-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      gallerySearch = e.target.value;
      refreshGallery();
    });
  }
  document.querySelectorAll('.gallery-sort').forEach(btn => {
    btn.addEventListener('click', () => {
      const sort = btn.dataset.sort;
      if (gallerySort === sort) { gallerySort = ''; btn.classList.remove('active'); }
      else {
        document.querySelectorAll('.gallery-sort').forEach(b => b.classList.remove('active'));
        gallerySort = sort;
        btn.classList.add('active');
      }
      refreshGallery();
    });
  });
}

function portraitSrc(base) { return `${base}.png`; }

const ROLE_ICON = { tank: '🛡', melee_dps: '⚔', ranged_dps: '🏹', support: '💚', battle_support: '⚡', breaker: '💥', evasive_dps: '🌀', bruiser: '🔨' };

function renderGalleryCards(container, cards) {
  container.innerHTML = cards.map(card => {
    const cardData = gameSave.cards[card.id];
    const owned = cardData && cardData.count > 0;
    const lvDisplay = cardData && cardData.level > 1 ? `Lv.${cardData.level}` : '';
    const xpPct = cardData ? Math.round((cardData.xp || 0) / (cardData.level * 50) * 100) : 0;
    const roleIco = ROLE_ICON[card.role] || '?';
    return `
    <div class="card ${owned ? 'card-owned' : ''}" data-rarity="${card.rarity}" data-id="${card.id}">
      <div class="card-portrait">
        <img src="${portraitSrc(card.portrait)}" alt="${card.name}"
             onerror="if(this.src.endsWith('.png')){this.src=this.src.replace('.png','.svg')}else{this.style.display='none';this.nextElementSibling.style.display='flex'}" />
        <div class="placeholder" style="display:none">${card.name[0]}</div>
        <div class="card-rarity-dot r-${card.rarity}"></div>
        ${lvDisplay ? `<div class="card-lv-badge">${lvDisplay}</div>` : ''}
        <div class="card-role-icon">${roleIco}</div>
      </div>
      <div class="card-info">
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

function showCardPopup(cardId, initialTab) {
  const card = CHARACTERS.find(c => c.id === cardId);
  if (!card) return;
  const overlay = document.getElementById('card-popup');
  document.getElementById('popup-portrait').innerHTML = `
    <img src="${portraitSrc(card.portrait)}" alt="${card.name}"
         onerror="if(this.src.endsWith('.png')){this.src=this.src.replace('.png','.svg')}else{this.style.display='none'}" />
  `;
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  const roleLabel = { tank:'탱커', melee_dps:'근접 딜러', ranged_dps:'원거리 딜러', support:'서포터', bruiser:'브루저', battle_support:'전투 지원', evasive_dps:'암살자', breaker:'브레이커' };
  const mbti = CHARACTER_MBTI[card.id] || '????';
  const cardData = gameSave.cards[card.id];
  const owned = cardData && cardData.count > 0;
  const unitLv = cardData?.level || 1;
  const unit = cardToUnit(card, 0, 0);
  const enhance = cardData?.enhance || { atk: 0, def: 0, hp: 0, crt: 0, eva: 0 };

  const statBar = (label, val, max, color, enhVal, suffix = '') => {
    const pct = Math.min(100, Math.round(val / max * 100));
    const highlight = pct >= 70 ? ' stat-high' : '';
    const enhBadge = enhVal > 0 ? `<span class="enh-badge">+${enhVal}</span>` : '';
    return `<div class="stat-bar-row${highlight}">
      <span class="stat-bar-label">${label}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="stat-bar-val">${val}${suffix}${enhBadge}</span>
    </div>`;
  };

  const senseHtml = card.sense ? (() => {
    const info = SENSE_TYPES[card.sense.baseType];
    const cat = info?.category === '촉' ? 'human' : 'blood';
    return `<div class="sheet-sense ${cat}">
      <span class="sense-icon">${info?.icon || '?'}</span>
      <strong>${card.sense.name}</strong> (${card.sense.baseType} Lv.${card.sense.power})
      <p>${card.sense.flavor}</p>
    </div>`;
  })() : '';

  const quotesHtml = (() => {
    const q = CHAR_QUOTES[card.id];
    if (!q) return '';
    const labels = { select: '선택', attack: '공격', skill: '스킬', hit: '피격', death: '퇴장', win: '승리' };
    return `<div class="sheet-quotes">
      <div class="quotes-title">대사</div>
      <div class="quotes-grid">${Object.entries(q).map(([k, v]) =>
        `<div class="quote-item"><span class="quote-label">${labels[k] || k}</span><span class="quote-text">"${v}"</span></div>`
      ).join('')}</div>
    </div>`;
  })();

  const bondsHtml = (() => {
    if (!owned) return '';
    const bondPartners = CHARACTERS.filter(c => c.id !== card.id).map(c => {
      const lv = getBondLevel(gameSave, card.id, c.id);
      return lv > 0 ? { name: c.name, id: c.id, level: lv } : null;
    }).filter(Boolean).sort((a, b) => b.level - a.level);
    if (bondPartners.length === 0) return '';
    return `<div class="sheet-bonds">
      <div class="bonds-title">유대 관계</div>
      <div class="bonds-grid">${bondPartners.slice(0, 6).map(b =>
        `<div class="bond-item"><span class="bond-name">${b.name}</span><span class="bond-lv">Lv.${b.level} ${'❤'.repeat(Math.min(b.level, 5))}</span></div>`
      ).join('')}</div>
    </div>`;
  })();

  // ── 탭 1: 정보 ──
  const tabInfo = `
    <div class="sheet-stats-v2">
      ${statBar('HP', unit.maxHp + enhance.hp * 5, 150, '#e94560', enhance.hp * 5)}
      ${statBar('ATK', unit.atk + enhance.atk, 40, '#ff6b35', enhance.atk)}
      ${statBar('DEF', unit.def + enhance.def, 15, '#457b9d', enhance.def)}
      ${statBar('PEN', unit.pen || 0, 10, '#f97316', 0)}
      ${statBar('CRT', Math.round((unit.crt + enhance.crt * 0.02) * 100), 30, '#e9c46a', enhance.crt > 0 ? enhance.crt * 2 : 0, '%')}
      ${statBar('EVA', Math.round((unit.eva + enhance.eva * 0.02) * 100), 30, '#7ec8e3', enhance.eva > 0 ? enhance.eva * 2 : 0, '%')}
      ${statBar('MOV', unit.mov, 4, '#4b9b6e', 0)}
      ${statBar('RNG', unit.rng, 3, '#c77dff', 0)}
    </div>
    ${senseHtml}
    ${(() => {
      const tree = PASSIVE_TREE[card.role];
      if (!tree) return '';
      return `<div class="sheet-passives">
        <div class="passive-title">패시브 트리</div>
        ${tree.map(p => {
          const unlocked = unitLv >= p.lv;
          const statLabel = { maxHp:'HP', atk:'ATK', def:'DEF', crt:'CRT', eva:'EVA', pen:'PEN', rng:'RNG', maxMp:'MP', mov:'MOV' };
          const valStr = (p.stat === 'crt' || p.stat === 'eva') ? `+${Math.round(p.val * 100)}%` : `+${p.val}`;
          return `<div class="passive-node ${unlocked ? 'passive-unlocked' : 'passive-locked'}">
            <span class="passive-lv">Lv.${p.lv}</span>
            <span class="passive-name">${p.name}</span>
            <span class="passive-val">${statLabel[p.stat] || p.stat} ${valStr}</span>
          </div>`;
        }).join('')}
      </div>`;
    })()}
    ${quotesHtml}
  `;

  // ── 탭 2: 육성 ──
  const tabGrowth = (() => {
    if (!owned) return '<div class="growth-locked">카드를 보유하고 있지 않습니다.</div>';
    const synthCost = getSynthesisCost(cardData.level);
    const canSynth = cardData.count >= synthCost;

    const enhSection = `<div class="enhance-section">
      <div class="enhance-title">스탯 강화</div>
      <div class="enhance-desc">카드를 소비하여 개별 스탯을 영구 강화합니다</div>
      <div class="enhance-grid">
        ${[
          { stat: 'atk', label: 'ATK', icon: '⚔', desc: `+1 공격력 (${enhance.atk}/${ENHANCE_MAX})` },
          { stat: 'def', label: 'DEF', icon: '🛡', desc: `+1 방어력 (${enhance.def}/${ENHANCE_MAX})` },
          { stat: 'hp',  label: 'HP',  icon: '❤', desc: `+5 체력 (${enhance.hp}/${ENHANCE_MAX})` },
          { stat: 'crt', label: 'CRT', icon: '🎯', desc: `+2% 치명률 (${enhance.crt}/${ENHANCE_MAX})` },
          { stat: 'eva', label: 'EVA', icon: '💨', desc: `+2% 회피율 (${enhance.eva}/${ENHANCE_MAX})` },
        ].map(e => {
          const cost = ENHANCE_COSTS[e.stat];
          const maxed = enhance[e.stat] >= ENHANCE_MAX;
          const canEnh = !maxed && cardData.count >= cost;
          const pct = Math.round(enhance[e.stat] / ENHANCE_MAX * 100);
          return `<div class="enhance-row">
            <div class="enhance-stat-info">
              <span class="enhance-icon">${e.icon}</span>
              <span class="enhance-label">${e.label}</span>
              <span class="enhance-desc-text">${e.desc}</span>
            </div>
            <div class="enhance-bar-track"><div class="enhance-bar-fill" style="width:${pct}%"></div></div>
            <button class="enhance-btn ${canEnh ? '' : 'enhance-disabled'}" data-enh-id="${card.id}" data-enh-stat="${e.stat}" ${canEnh ? '' : 'disabled'}>
              ${maxed ? 'MAX' : `강화 (${cost}장)`}
            </button>
          </div>`;
        }).join('')}
      </div>
      <div class="enhance-stock">보유: ${cardData.count}장</div>
    </div>`;

    const synthSection = `<div class="sheet-synth">
      <div class="synth-info">
        <span class="synth-level">Lv.${cardData.level}</span>
        <span class="synth-count">보유 ${cardData.count}장</span>
      </div>
      <button class="synth-btn ${canSynth ? '' : 'synth-disabled'}" data-synth-id="${card.id}" ${canSynth ? '' : 'disabled'}>
        ⬆ 합성 레벨업 (${synthCost}장 필요)
      </button>
    </div>`;

    const equipSection = `<div class="equip-section">
      <div class="equip-section-title">장비 장착</div>
      ${['weapon', 'armor', 'accessory'].map(slot => {
        const slotIcon = { weapon: '🗡', armor: '🛡', accessory: '💍' }[slot];
        const slotName = { weapon: '무기', armor: '갑옷', accessory: '장신구' }[slot];
        const equipped = cardData.equipment?.[slot];
        const equippedItem = equipped ? EQUIPMENT.find(e => e.id === equipped) : null;
        const available = EQUIPMENT.filter(e => e.slot === slot);
        return `<div class="equip-slot-row">
          <span class="equip-slot-label">${slotIcon} ${slotName}</span>
          <select class="equip-select" data-equip-char="${card.id}" data-equip-slot="${slot}">
            <option value="">없음</option>
            ${available.map(e => `<option value="${e.id}" ${equipped === e.id ? 'selected' : ''}>${e.name} (${Object.entries(e.stats).map(([k,v]) => `${k.toUpperCase()}+${typeof v === 'number' && v < 1 ? Math.round(v*100)+'%' : v}`).join(' ')})</option>`).join('')}
          </select>
        </div>`;
      }).join('')}
      <div class="equip-slot-row">
        <span class="equip-slot-label">💎 유물</span>
        <select class="equip-select" data-equip-char="${card.id}" data-equip-slot="relic">
          <option value="">없음</option>
          ${RELICS.map(r => `<option value="${r.id}" ${cardData.relic === r.id ? 'selected' : ''}>${r.name} — ${r.desc}</option>`).join('')}
        </select>
      </div>
    </div>`;

    return `${synthSection}${enhSection}${equipSection}`;
  })();

  // ── 탭 3: 서사 ──
  const tabStory = (() => {
    const loreStage = getUnlockedLoreStage(gameSave, card.id);
    const loreParts = card.lore ? splitLore(card.lore) : ['???', '???', '???'];

    return `<div class="lore-section">
      <div class="lore-title">개인 서사</div>
      ${LORE_MILESTONES.map((m, i) => {
        const unlocked = loreStage > i;
        return `<div class="lore-stage ${unlocked ? 'lore-unlocked' : 'lore-locked'}">
          <div class="lore-stage-header">
            <span class="lore-stage-icon">${unlocked ? '📖' : '🔒'}</span>
            <span class="lore-stage-label">${m.label}</span>
            <span class="lore-stage-req">${unlocked ? '해금됨' : `Lv.${m.level} 필요`}</span>
          </div>
          <div class="lore-stage-text">${unlocked ? loreParts[i] : '???'}</div>
        </div>`;
      }).join('')}
    </div>
    ${bondsHtml}
    <p class="sheet-flavor">"${card.flavor}"</p>
  `;
  })();

  const activeTab = initialTab || 'info';
  document.getElementById('popup-details').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-badges">
        <span class="faction-badge ${card.faction}">${factionLabel(card.faction)}</span>
        <span class="rarity-badge ${card.rarity}">${(rarityKo[card.rarity] || card.rarity).toUpperCase()}</span>
        <span class="role-badge">${roleLabel[card.role] || card.role}</span>
        <span class="mbti-badge">${mbti}</span>
      </div>
      <h2>${card.name}</h2>
      <p class="sheet-title">${card.title}</p>
      ${owned ? `<div class="sheet-level-bar">Lv.${unitLv} · ${cardData.count}장</div>` : ''}
    </div>
    <div class="popup-tabs">
      <button class="popup-tab ${activeTab === 'info' ? 'active' : ''}" data-ptab="info">정보</button>
      <button class="popup-tab ${activeTab === 'growth' ? 'active' : ''}" data-ptab="growth">육성</button>
      <button class="popup-tab ${activeTab === 'story' ? 'active' : ''}" data-ptab="story">서사</button>
    </div>
    <div class="popup-tab-content" id="ptab-info" style="${activeTab === 'info' ? '' : 'display:none'}">${tabInfo}</div>
    <div class="popup-tab-content" id="ptab-growth" style="${activeTab === 'growth' ? '' : 'display:none'}">${tabGrowth}</div>
    <div class="popup-tab-content" id="ptab-story" style="${activeTab === 'story' ? '' : 'display:none'}">${tabStory}</div>
  `;

  document.querySelectorAll('.popup-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.popup-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.popup-tab-content').forEach(c => c.style.display = 'none');
      document.getElementById(`ptab-${tab.dataset.ptab}`).style.display = '';
    });
  });

  document.querySelectorAll('.synth-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const charId = btn.dataset.synthId;
      const result = synthesizeCard(gameSave, charId);
      if (result.ok) {
        saveGame(gameSave);
        const charName = CHARACTERS.find(c => c.id === charId)?.name || charId;
        showLevelUp(charName, result.newLevel);
        showCardPopup(charId, 'growth');
        refreshGallery();
      }
    });
  });

  document.querySelectorAll('.enhance-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const charId = btn.dataset.enhId;
      const stat = btn.dataset.enhStat;
      const result = enhanceCard(gameSave, charId, stat);
      if (result.ok) {
        saveGame(gameSave);
        sfxEquip();
        showCardPopup(charId, 'growth');
        refreshGallery();
      }
    });
  });

  document.querySelectorAll('.equip-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const charId = sel.dataset.equipChar;
      const slot = sel.dataset.equipSlot;
      const val = sel.value || null;
      if (!gameSave.cards[charId]) return;
      if (!gameSave.cards[charId].equipment) gameSave.cards[charId].equipment = { weapon: null, armor: null, accessory: null };
      if (slot === 'relic') {
        gameSave.cards[charId].relic = val;
      } else {
        gameSave.cards[charId].equipment[slot] = val;
      }
      saveGame(gameSave);
      sfxEquip();
      showCardPopup(charId, 'growth');
      refreshGallery();
    });
  });

  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function splitLore(lore) {
  const sentences = lore.split(/(?<=[.?!。])\s*/);
  const total = sentences.length;
  if (total <= 2) return [sentences[0] || '???', sentences.slice(1).join(' ') || '???', lore];
  const t1 = Math.ceil(total / 3);
  const t2 = Math.ceil(total * 2 / 3);
  return [
    sentences.slice(0, t1).join(' '),
    sentences.slice(t1, t2).join(' '),
    sentences.slice(t2).join(' '),
  ];
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
  const totalStages = STAGES.length;
  const clearedCount = STAGES.filter(s => gameSave.stageClears?.[s.id]).length;
  const threeStarCount = STAGES.filter(s => gameSave.stageClears?.[s.id]?.stars === 3).length;
  const pct = Math.round(clearedCount / totalStages * 100);

  const playerMaxLv = Math.max(1, ...CHARACTERS.filter(c => gameSave.cards[c.id]?.count > 0).map(c => gameSave.cards[c.id].level));

  let html = `<div class="stage-progress">
    <div class="stage-progress-bar"><div class="stage-progress-fill" style="width:${pct}%"></div></div>
    <div class="stage-progress-text">
      <span>진행 ${clearedCount}/${totalStages} (${pct}%)</span>
      <span>⭐×3: ${threeStarCount}</span>
    </div>
  </div>`;

  STORY_ACTS.forEach(act => {
    const actUnlocked = !act.unlock || gameSave.stageClears?.[act.unlock];
    const actCleared = act.stages.every(sid => gameSave.stageClears?.[sid]);
    html += `<div class="act-header ${actUnlocked ? (actCleared ? 'act-done' : '') : 'act-lock'}">
      <span class="act-header-name">${act.name}</span>
      <span class="act-header-status">${actUnlocked ? (actCleared ? '✅ 클리어' : '') : '🔒 ${act.unlock} 클리어 필요'}</span>
    </div>`;
    act.stages.forEach(sid => {
      const i = STAGES.findIndex(st => st.id === sid);
      const s = STAGES[i];
      if (!s) return;
      const enemyCount = s.enemyUnits.length;
      const maxDeploy = s.playerSpawns.length;
      const scaledLv = getScaledEnemyLevel(s, playerMaxLv);
      const difficulty = Math.min(5, Math.ceil(scaledLv / 3));
      const stars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
      const hasReinforce = s.reinforcements ? `<span class="stage-reinforce">⚠증원</span>` : '';
      const weatherInfo = s.weather && s.weather !== 'clear' && WEATHER_TYPES[s.weather]
        ? `<span class="stage-weather" title="${WEATHER_TYPES[s.weather].desc}">${WEATHER_TYPES[s.weather].icon}${WEATHER_TYPES[s.weather].name}</span>` : '';
      const clearData = gameSave.stageClears?.[s.id];
      const clearStars = clearData ? '⭐'.repeat(clearData.stars) + '☆'.repeat(3 - clearData.stars) : '';
      const clearInfo = clearData ? `<span class="stage-clear-info">${clearStars} ${clearData.bestTurns}턴 (${clearData.clears}회)</span>` : '';
      const prevStage = i > 0 ? STAGES[i - 1] : null;
      const locked = !actUnlocked || (prevStage && !gameSave.stageClears?.[prevStage.id]);
      const lvLabel = scaledLv > s.enemyLevel ? `Lv.${scaledLv} <span class="lv-scaled">↑${scaledLv - s.enemyLevel}</span>` : `Lv.${s.enemyLevel}`;
      html += `<div class="stage-card ${clearData ? 'stage-cleared' : ''} ${locked ? 'stage-locked' : ''}" data-stage="${locked ? '' : s.id}">
        <div class="stage-num">${locked ? '🔒' : i + 1}</div>
        <div class="stage-info">
          <div class="stage-name">${s.name} <span class="stage-lv">${lvLabel}</span></div>
          <div class="stage-desc">${s.description}</div>
          <div class="stage-meta">
            <span class="stage-stars">${stars}</span>
            <span class="stage-enemy-count">적 ${enemyCount}명</span>
            <span class="stage-deploy-count">출전 ${maxDeploy}명</span>
            <span class="stage-victory-badge vc-${s.victoryCondition}">${VICTORY_LABEL[s.victoryCondition] || VICTORY_LABEL.defeat_all}</span>
            ${s.tactics ? '<span class="stage-tactics-warn">⚠️전술</span>' : ''}
            ${hasReinforce}
            ${weatherInfo}
          </div>
          ${clearInfo}
          ${clearData && clearData.stars === 3 ? `<button class="stage-sweep-btn" data-sweep="${s.id}">⚡ 소탕</button>` : ''}
          ${clearData ? `<button class="stage-hard-btn ${gameSave.hardClears?.[s.id] ? 'hard-cleared' : ''}" data-hard="${s.id}">🔥 하드${gameSave.hardClears?.[s.id] ? ' ✓' : ''}</button>` : ''}
        </div>
      </div>`;
    });
  });
  const towerBest = gameSave.towerBest || 0;
  const towerInfo = towerBest > 0 ? `<span class="stage-clear-info">최고 ${towerBest}층</span>` : '';
  list.innerHTML += `<div class="stage-card stage-tower" data-stage="tower">
    <div class="stage-num">🗼</div>
    <div class="stage-info">
      <div class="stage-name">무한의 탑 <span class="stage-lv">∞</span></div>
      <div class="stage-desc">끝없는 웨이브에 도전하라. 몇 층까지 오를 수 있는가?</div>
      <div class="stage-meta">
        <span class="stage-stars">★★★★★</span>
        <span class="stage-enemy-count">무한</span>
        <span class="stage-deploy-count">출전 4명</span>
      </div>
      ${towerInfo}
    </div>
  </div>`;
  const defBest = gameSave.tycoonBest || 0;
  const defInfo = defBest > 0 ? `<span class="stage-clear-info">최고 ${defBest}일</span>` : '';
  list.innerHTML += `<div class="stage-card stage-defense" data-stage="defense">
    <div class="stage-num">🏥</div>
    <div class="stage-info">
      <div class="stage-name">헌혈의집 타이쿤 <span class="stage-lv">경영</span></div>
      <div class="stage-desc">헌혈센터를 경영하라! 시설 배치, 헌혈자 관리, 혈액 납품!</div>
      <div class="stage-meta">
        <span class="stage-stars">★★★★★</span>
        <span class="stage-enemy-count">무한 경영</span>
        <span class="stage-deploy-count">랜덤 배치</span>
      </div>
      ${defInfo}
    </div>
  </div>`;

  list.querySelectorAll('.stage-card').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('stage-hard-btn')) return;
      const sid = el.dataset.stage;
      if (!sid) return;
      if (sid === 'tower') {
        openTowerDeploy();
      } else if (sid === 'defense') {
        startTycoonMode();
      } else {
        openDeploy(sid);
      }
    });
  });

  list.querySelectorAll('.stage-hard-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const baseId = btn.dataset.hard;
      openDeploy(baseId, true);
    });
  });

  list.querySelectorAll('.stage-sweep-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      doSweep(btn.dataset.sweep);
    });
  });
}

function doSweep(stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) return;
  const clearData = gameSave.stageClears?.[stageId];
  if (!clearData || clearData.stars < 3) return;

  gameSave.stats.totalBattles++;
  gameSave.stats.wins++;
  progressQuest(gameSave, 'battle');
  progressQuest(gameSave, 'win');
  if (stageId === 'stage-4') progressQuest(gameSave, 'clear_stage4');
  recordStageClear(gameSave, stageId, clearData.bestTurns);

  const randomChar = () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const rewardCards = [
    { char: randomChar(), rarity: 'rare' },
    { char: randomChar(), rarity: 'uncommon' },
    { char: randomChar(), rarity: 'common' },
  ];
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  rewardCards.forEach(r => addCard(gameSave, r.char.id, r.rarity));
  gameSave.recruitTickets = (gameSave.recruitTickets || 0) + 2;

  const newAch = checkAchievements(gameSave);
  newAch.forEach(a => a.reward.forEach(rarity => {
    const rc = randomChar();
    addCard(gameSave, rc.id, rarity);
  }));
  saveGame(gameSave);

  const toast = document.createElement('div');
  toast.className = 'sweep-result';
  toast.innerHTML = `
    <div class="sweep-header">⚡ ${stage.name} 소탕 완료!</div>
    <div class="sweep-rewards">
      ${rewardCards.map(r => `<span class="reward-card reward-${r.rarity}">${r.char.name} (${rarityKo[r.rarity]})</span>`).join('')}
      <span class="reward-card reward-uncommon">🎫 모집권 ×2</span>
    </div>
    ${newAch.length > 0 ? `<div class="sweep-ach">${newAch.map(a => `🏆 ${a.name}`).join(' ')}</div>` : ''}
  `;
  document.body.appendChild(toast);
  sfxCollect();
  setTimeout(() => toast.remove(), 2500);

  renderStageSelect();
  updateNavBadges();
}

// ── Deploy Screen ──

let deployPreviewChar = null;

function openDeploy(stageId, hard = false) {
  currentStageId = stageId;
  currentHardMode = hard;
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) return;

  deploySelected = [];
  deployPreviewChar = null;
  const maxUnits = stage.playerSpawns.length;

  document.getElementById('stage-select').style.display = 'none';
  document.getElementById('deploy-screen').style.display = '';
  const weatherTag = stage.weather && stage.weather !== 'clear' && WEATHER_TYPES[stage.weather]
    ? ` ${WEATHER_TYPES[stage.weather].icon} ${WEATHER_TYPES[stage.weather].name}` : '';
  const hardTag = currentHardMode ? ' 🔥하드' : '';
  document.getElementById('deploy-stage-name').textContent = `${stage.name}${hardTag}${weatherTag} — 유닛 편성`;
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

  const quickBtn = document.getElementById('btn-deploy-quick');
  if (quickBtn) {
    const lastTeam = gameSave.lastTeam || [];
    const validLast = lastTeam.filter(id => CHARACTERS.find(c => c.id === id && c.faction !== 'kartein'));
    if (validLast.length > 0) {
      quickBtn.style.display = '';
      quickBtn.onclick = () => {
        deploySelected = validLast.slice(0, maxUnits);
        renderDeployBench(maxUnits);
        updateDeployUI(maxUnits);
        renderDeployRoster(document.querySelector('.roster-filter.active')?.dataset.rf || 'all');
      };
    } else {
      quickBtn.style.display = 'none';
    }
  }

  renderPresetButtons(maxUnits);

  const autoBtn = document.getElementById('btn-deploy-auto');
  if (autoBtn) {
    autoBtn.onclick = () => {
      deploySelected = autoFillTeam(maxUnits);
      renderDeployBench(maxUnits);
      updateDeployUI(maxUnits);
      renderDeployRoster(document.querySelector('.roster-filter.active')?.dataset.rf || 'all');
    };
  }
  const synergyBtn = document.getElementById('btn-synergy-guide');
  if (synergyBtn) synergyBtn.onclick = showSynergyGuide;
}

function autoFillTeam(maxUnits) {
  const owned = CHARACTERS.filter(c => c.faction !== 'kartein' && gameSave.cards[c.id]?.count > 0);
  if (owned.length === 0) return CHARACTERS.filter(c => c.faction !== 'kartein').slice(0, maxUnits).map(c => c.id);

  const scored = owned.map(c => {
    const card = gameSave.cards[c.id];
    const unit = cardToUnit(c, 0, 0);
    const cp = getCombatPower(unit);
    const lvBonus = (card.level || 1) * 10;
    const rarityBonus = { legendary: 40, rare: 20, uncommon: 10, common: 0 }[c.rarity] || 0;
    return { id: c.id, score: cp + lvBonus + rarityBonus };
  }).sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, Math.min(maxUnits * 2, scored.length));
  let bestTeam = candidates.slice(0, maxUnits).map(c => c.id);
  let bestScore = 0;

  const tryCombo = (ids) => {
    const units = ids.map(id => cardToUnit(CHARACTERS.find(c => c.id === id), 0, 0));
    const synResult = getTeamSynergy(units);
    const totalCP = ids.reduce((s, id) => s + (candidates.find(c => c.id === id)?.score || 0), 0);
    return totalCP * (0.7 + synResult.teamMult * 0.3);
  };

  bestScore = tryCombo(bestTeam);
  for (let i = 0; i < 20; i++) {
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const team = shuffled.slice(0, maxUnits).map(c => c.id);
    const score = tryCombo(team);
    if (score > bestScore) { bestScore = score; bestTeam = team; }
  }

  return bestTeam;
}

function showSynergyGuide() {
  const popup = document.getElementById('card-popup');
  const portrait = document.getElementById('popup-portrait');
  const details = document.getElementById('popup-details');
  portrait.innerHTML = `<div style="font-size:2rem;text-align:center;padding:20px">📖</div>`;

  const mbtiTable = `
    <h3>MBTI 궁합표</h3>
    <div class="synergy-guide-info">같은 N/S × 다른 E/I = 높은 시너지<br>완전 반대 = 최고 시너지 (S급)</div>
    <h3>시크릿 콤보</h3>
    <div class="synergy-guide-combos">
      ${SECRET_COMBOS.map(c => {
        const chars = c.mbtis.map(m => {
          const ch = CHARACTERS.find(ch => CHARACTER_MBTI[ch.id] === m);
          return ch ? ch.name : m;
        });
        return `<div class="synergy-combo-row">
          <span class="synergy-combo-name">「${c.name}」</span>
          <span class="synergy-combo-mult">×${c.mult}</span>
          <span class="synergy-combo-mbtis">${c.mbtis.join('+')}</span>
          <span class="synergy-combo-hint">${chars.slice(0, 2).join(', ')}…</span>
        </div>`;
      }).join('')}
    </div>
    <h3>팩션 시너지</h3>
    <div class="synergy-guide-factions">
      ${Object.entries(FACTION_SYNERGY).map(([f, tiers]) =>
        tiers.map(t => `<div class="synergy-faction-row"><span>${t.label}</span> <span>(${t.count}명)</span></div>`).join('')
      ).join('')}
    </div>
  `;
  details.innerHTML = `<h2>시너지 도감</h2>${mbtiTable}`;
  popup.style.display = 'flex';
}

function renderPresetButtons(maxUnits) {
  const container = document.getElementById('deploy-presets');
  if (!container) return;
  gameSave.teamPresets = gameSave.teamPresets || [];
  const presets = gameSave.teamPresets;

  let html = '<div class="preset-header">📋 프리셋</div><div class="preset-list">';
  for (let i = 0; i < 5; i++) {
    const p = presets[i];
    if (p) {
      const names = p.ids.map(id => CHARACTERS.find(c => c.id === id)?.name || '?').join(', ');
      html += `<button class="preset-btn preset-filled" data-idx="${i}" title="${names}">
        <span class="preset-name">${p.name}</span>
        <span class="preset-del" data-del="${i}">×</span>
      </button>`;
    } else {
      html += `<button class="preset-btn preset-empty" data-save="${i}">빈 슬롯 ${i + 1}</button>`;
    }
  }
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.preset-filled').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.classList.contains('preset-del')) return;
      const idx = +btn.dataset.idx;
      const p = presets[idx];
      if (p) {
        deploySelected = p.ids.filter(id => CHARACTERS.find(c => c.id === id)).slice(0, maxUnits);
        if (p.gear) {
          Object.entries(p.gear).forEach(([charId, g]) => {
            if (!gameSave.cards[charId]) return;
            if (g.equipment) {
              if (!gameSave.cards[charId].equipment) gameSave.cards[charId].equipment = {};
              Object.assign(gameSave.cards[charId].equipment, g.equipment);
            }
            if (g.relic !== undefined) gameSave.cards[charId].relic = g.relic;
          });
          saveGame(gameSave);
        }
        renderDeployBench(maxUnits);
        updateDeployUI(maxUnits);
        renderDeployRoster(document.querySelector('.roster-filter.active')?.dataset.rf || 'all');
      }
    });
  });

  container.querySelectorAll('.preset-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.del;
      presets[idx] = null;
      saveGame(gameSave);
      renderPresetButtons(maxUnits);
    });
  });

  container.querySelectorAll('.preset-empty').forEach(btn => {
    btn.addEventListener('click', () => {
      if (deploySelected.length === 0) return;
      const idx = +btn.dataset.save;
      const gear = {};
      deploySelected.forEach(id => {
        const card = gameSave.cards[id];
        if (card) {
          gear[id] = { equipment: card.equipment ? { ...card.equipment } : {}, relic: card.relic || null };
        }
      });
      presets[idx] = { name: `팀 ${idx + 1}`, ids: [...deploySelected], gear };
      saveGame(gameSave);
      renderPresetButtons(maxUnits);
    });
  });
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

  if (currentHardMode) {
    enemies.forEach(e => {
      const baseLv = e.level;
      for (let lv = 0; lv < baseLv; lv++) {
        e.level++;
        e.maxHp += Math.floor(e.maxHp * 0.05);
        e.atk += 2;
        e.def += 1;
      }
      e.atk = Math.floor(e.atk * 1.3);
      e.def = Math.floor(e.def * 1.3);
      e.hp = e.maxHp;
    });
  }

  const roleLabel = { tank:'탱커', melee_dps:'근딜', ranged_dps:'원딜', support:'서포터', bruiser:'브루저', battle_support:'전술', evasive_dps:'암살', breaker:'브레이커' };

  const reinforceInfo = stage.reinforcements
    ? `<div class="intel-reinforce">⚠ 증원 경고: ${stage.reinforcements.map(r => `턴${r.turn} +${r.units.length}명`).join(', ')}</div>`
    : '';

  const hardInfo = currentHardMode ? '<div class="intel-reinforce" style="color:#fc8181">🔥 하드 모드: 적 레벨 ×2 · ATK/DEF +30%</div>' : '';
  const t = stage.tactics;
  const tacticsInfo = t ? `<div class="intel-tactics">⚠️ 전장 효과: ${
    [t.enemyAtkBonus ? `적 ATK+${t.enemyAtkBonus}` : '',
     t.enemyDefBonus ? `적 DEF+${t.enemyDefBonus}` : '',
     t.enemyHpMult ? `적 HP×${t.enemyHpMult}` : ''].filter(Boolean).join(' · ')
  }</div>` : '';
  const vcInfo = `<div class="intel-vc">${VICTORY_LABEL[stage.victoryCondition] || VICTORY_LABEL.defeat_all}</div>`;

  panel.innerHTML = `
    <div class="intel-header">
      <span class="intel-title">적 정보</span>
      <span class="intel-count">${enemies.length}명 · Lv.${currentHardMode ? eLv * 2 : eLv}${currentHardMode ? ' 🔥' : ''}</span>
    </div>
    ${vcInfo}${hardInfo}${tacticsInfo}${reinforceInfo}
    <div class="intel-list">${enemies.map(e => {
      const threat = e.charData.rarity === 'legendary' ? '<span class="intel-threat boss">👑 보스</span>' :
                     e.charData.rarity === 'rare' ? '<span class="intel-threat elite">⚠ 강적</span>' : '';
      const skillInfo = e.charData.sense ? `<div class="intel-skill">${SENSE_TYPES[e.charData.sense.baseType]?.icon || '?'} ${e.charData.sense.name}</div>` : '';
      const typeIcon = { physical: '⚔️', mental: '🧠', blood: '🩸' };
      return `
      <div class="intel-unit">
        <div class="intel-portrait"><img src="${portraitSrc(`assets/portraits/${e.id}`)}" onerror="this.style.display='none'" /></div>
        <div class="intel-info">
          <div class="intel-name">${e.name} ${threat}</div>
          <div class="intel-role">${roleLabel[e.charData.role] || e.charData.role} · ${typeIcon[e.attackType] || '⚔️'} MOV${e.mov} RNG${e.rng}</div>
          ${skillInfo}
        </div>
        <div class="intel-stats">
          <span>HP${e.maxHp}</span>
          <span>ATK${e.atk}</span>
          <span>DEF${e.def}</span>
        </div>
      </div>`;
    }).join('')}</div>
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

function updateDeployUI(maxUnits) {
  document.getElementById('deploy-count').textContent = deploySelected.length;
  document.getElementById('btn-deploy-start').disabled = deploySelected.length === 0;
  updateDeploySynergy();
}

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
  if (cardData?.equipment) {
    Object.entries(cardData.equipment).forEach(([, itemId]) => { if (itemId) equipItem(unit, itemId); });
  }
  if (cardData?.relic) equipRelic(unit, cardData.relic);
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
    <div class="dd-stats-v2">
      ${(() => {
        const sb = (label, val, max, color, suffix = '') => {
          const pct = Math.min(100, Math.round(val / max * 100));
          const hi = pct >= 70 ? ' stat-high' : '';
          return `<div class="stat-bar-row${hi}"><span class="stat-bar-label">${label}</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="stat-bar-val">${val}${suffix}</span></div>`;
        };
        return sb('HP', unit.maxHp, 150, '#e94560') +
               sb('ATK', unit.atk, 40, '#ff6b35') +
               sb('DEF', unit.def, 15, '#457b9d') +
               sb('CRT', Math.round(unit.crt * 100), 30, '#e9c46a', '%') +
               sb('EVA', Math.round((unit.eva || 0) * 100), 30, '#7ec8e3', '%') +
               sb('MOV', unit.mov, 4, '#4b9b6e') +
               sb('RNG', unit.rng, 3, '#c77dff') +
               `<div class="stat-bar-row stat-high"><span class="stat-bar-label">CP</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.min(100, Math.round(cp / 300 * 100))}%;background:linear-gradient(90deg,#e9c46a,#e94560)"></div></div><span class="stat-bar-val">${cp}</span></div>`;
      })()}
    </div>
    ${senseInfo ? `<div class="dd-sense"><span class="sense-icon">${senseInfo.icon || '?'}</span> <strong>「${c.sense.name}」</strong> ${c.sense.baseType} Lv.${c.sense.power}<br><span class="dd-sense-flavor">${c.sense.flavor}</span></div>` : ''}
    ${unit.ultimates ? `<div class="dd-ults">${unit.ultimates.map(u => `<div class="dd-ult"><span>${u.icon}</span> ${u.name} <span class="dd-ult-lv">Lv.${u.unlockLevel}</span></div>`).join('')}</div>` : ''}
    ${(() => {
      const tree = PASSIVE_TREE[c.role];
      if (!tree) return '';
      const next = tree.find(p => unit.level < p.lv);
      if (!next) return '<div class="dd-passive-hint">✅ 모든 패시브 해금 완료</div>';
      const statLabel = { maxHp:'HP', atk:'ATK', def:'DEF', crt:'CRT', eva:'EVA', pen:'PEN', rng:'RNG', maxMp:'MP', mov:'MOV' };
      const valStr = (next.stat === 'crt' || next.stat === 'eva') ? `+${Math.round(next.val * 100)}%` : `+${next.val}`;
      return `<div class="dd-passive-hint">🔮 Lv.${next.lv}에 해금: <strong>${next.name}</strong> (${statLabel[next.stat]} ${valStr})</div>`;
    })()}
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
      <div class="dd-equip-slot">
        <span class="dd-slot-icon">🔮</span>
        <span class="dd-slot-name">${unit.relic ? unit.relic.name : '유물 없음'}</span>
        <button class="dd-relic-btn" data-char="${c.id}">변경</button>
      </div>
      ${unit.relic ? `<div class="dd-relic-desc">${unit.relic.desc}</div>` : ''}
    </div>
  `;

  panel.querySelectorAll('.dd-equip-btn').forEach(btn => {
    btn.addEventListener('click', () => showEquipSelect(btn.dataset.char, btn.dataset.slot));
  });
  panel.querySelectorAll('.dd-relic-btn').forEach(btn => {
    btn.addEventListener('click', () => showRelicSelect(btn.dataset.char));
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

function showRelicSelect(charId) {
  const popup = document.getElementById('card-popup');
  const details = document.getElementById('popup-details');
  document.getElementById('popup-portrait').innerHTML = `<div style="font-size:2rem;text-align:center;padding:20px">🔮</div>`;

  details.innerHTML = `
    <h2>유물 선택</h2>
    <div class="equip-select-list">
      ${RELICS.map(relic => `<button class="equip-select-item" data-relic-id="${relic.id}">
        <span class="equip-item-name">${relic.name}</span>
        <span class="equip-item-stats">${relic.desc}</span>
      </button>`).join('')}
      <button class="equip-select-item equip-cancel" data-relic-id="">해제</button>
    </div>
  `;

  details.querySelectorAll('.equip-select-item').forEach(btn => {
    btn.addEventListener('click', () => {
      popup.style.display = 'none';
      const relicId = btn.dataset.relicId;
      if (!gameSave.cards[charId]) gameSave.cards[charId] = { level: 1, xp: 0, count: 1 };
      gameSave.cards[charId].relic = relicId || null;
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

  const stage = STAGES.find(s => s.id === currentStageId);
  const enemyCpEl = document.getElementById('synergy-enemy-cp');
  if (enemyCpEl && stage) {
    const enemyUnits = stage.enemyUnits.map(eu => {
      const c = CHARACTERS.find(ch => ch.id === eu.charId);
      return c ? cardToUnit(c, 0, 0) : null;
    }).filter(Boolean);
    const enemyCP = enemyUnits.reduce((sum, u) => sum + getCombatPower(u), 0);
    const hardEnemyCP = currentHardMode ? Math.floor(enemyCP * 1.6) : enemyCP;
    const ratio = teamData.total > 0 ? (teamData.total / hardEnemyCP).toFixed(1) : '?';
    const diffClass = ratio >= 1.2 ? 'cp-advantage' : ratio >= 0.8 ? 'cp-even' : 'cp-disadvantage';
    const allyPct = Math.min(100, Math.round(teamData.total / (teamData.total + hardEnemyCP) * 100));
    const hardTag = currentHardMode ? ' <span class="cp-hard-tag">🔥하드</span>' : '';
    enemyCpEl.innerHTML = `
      <div class="cp-compare-bar"><div class="cp-ally-fill" style="width:${allyPct}%"></div></div>
      <div class="cp-compare-text">아군 <strong>${teamData.total}</strong> vs 적 <strong>${hardEnemyCP}</strong>${hardTag} · <strong class="${diffClass}">×${ratio}</strong></div>`;
    enemyCpEl.style.display = '';
  }

  const factionCounts = {};
  units.forEach(u => { factionCounts[u.faction] = (factionCounts[u.faction] || 0) + 1; });
  const factionKoShort = { center: '센터', kartein: '카르테인', neutral: '비소속' };
  let factionHtml = '';
  Object.entries(FACTION_SYNERGY).forEach(([faction, tiers]) => {
    tiers.forEach(t => {
      const cur = factionCounts[faction] || 0;
      const active = cur >= t.count;
      factionHtml += `<span class="synergy-pair ${active ? 'ss' : ''}" style="${active ? '' : 'opacity:0.4'}">${factionKoShort[faction]} ${cur}/${t.count}: ${t.label}</span>`;
    });
  });
  const factionEl = document.getElementById('synergy-faction');
  if (factionEl) factionEl.innerHTML = factionHtml;

  panel.style.display = '';
}

// ── Tower Mode ──

function openTowerDeploy() {
  towerMode = true;
  towerWave = 1;
  const towerStage = generateTowerStage(1);
  currentStageId = towerStage.id;
  STAGES.push(towerStage);
  openDeploy(towerStage.id);
}

let towerSurvivorHP = null;

function startTowerWave() {
  if (battleState) {
    towerSurvivorHP = {};
    battleState.units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
      const charId = u.charId || u.id;
      const waveHeal = Math.floor(u.maxHp * 0.2);
      const healedHp = Math.min(u.maxHp, u.hp + waveHeal);
      const mpRestore = Math.min(u.maxMp, u.mp + 2);
      towerSurvivorHP[charId] = { hp: healedHp, maxHp: u.maxHp, mp: mpRestore };
    });
  }
  const oldTowerId = STAGES.findIndex(s => s.id === `tower-${towerWave}`);
  if (oldTowerId >= 0) STAGES.splice(oldTowerId, 1);
  towerWave++;
  const nextStage = generateTowerStage(towerWave);
  STAGES.push(nextStage);
  currentStageId = nextStage.id;
  startBattle();
  if (towerSurvivorHP && battleState) {
    battleState.units.filter(u => u.team === 'player').forEach(u => {
      const charId = u.charId || u.id;
      const prev = towerSurvivorHP[charId];
      if (prev) {
        u.hp = Math.min(u.maxHp, prev.hp);
        u.mp = Math.min(u.maxMp, prev.mp);
      }
    });
    towerSurvivorHP = null;
  }
}

// ── Tycoon Mode (헌혈의집 타이쿤) ──

let tycoonState = null;
let tycoonSpeed = 1;
let tycoonLoopTimer = null;
let tycoonPrepRemain = 0;
let tycoonSelectedFacility = null;
let tycoonActiveEvent = null;

function startTycoonMode() {
  tycoonState = createTycoonState(1);
  tycoonSpeed = 1;
  tycoonActiveEvent = null;
  const prestige = gameSave.tycoonPrestige || 0;
  if (prestige > 0) {
    tycoonState.gold += prestige * 20;
    showTycoonBanner(`🏅 프레스티지 ${prestige} — 시작 골드 +${prestige * 20}G`, 'legendary');
  }
  document.getElementById('stage-select').style.display = 'none';
  document.getElementById('defense-screen').style.display = '';
  tycoonSelectedFacility = null;
  updateTycoonSpeedBtn();
  renderTycoon();
  tycoonStartPrep();
}

function renderTycoon() {
  if (!tycoonState) return;
  const { gridW, gridH, gold, reputation, day, donors, blood, orders, maxStorage } = tycoonState;
  const totalBlood = Object.values(blood).reduce((s, v) => s + v, 0);
  const waitingDonors = donors.filter(d => d.status === 'waiting').length;
  const collectingDonors = donors.filter(d => d.status === 'collecting').length;

  document.getElementById('defense-wave').innerHTML = `${day}일차 <span class="tyc-donor-count">${waitingDonors > 0 ? `대기 ${waitingDonors}` : ''}${collectingDonors > 0 ? ` 채혈 ${collectingDonors}` : ''}</span>`;
  document.getElementById('defense-lives').textContent = `⭐ ${reputation}`;
  document.getElementById('defense-merges').textContent = `🩸 ${totalBlood}/${maxStorage}`;
  document.getElementById('defense-gold').textContent = `💰 ${gold}`;
  const timerEl = document.getElementById('defense-timer');
  if (timerEl) {
    if (tycoonState.phase === 'prep') {
      const secs = Math.ceil(tycoonPrepRemain / 1000);
      timerEl.textContent = `⏱ ${secs}초`;
    } else {
      timerEl.textContent = '🏥 운영중';
    }
  }

  const synEl = document.getElementById('defense-synergy');
  if (synEl) {
    const bloodHtml = BLOOD_TYPES.map(bt => {
      const cls = blood[bt] > 0 ? 'tyc-blood-has' : '';
      return `<span class="tyc-blood-tag ${cls}" data-bt="${bt}">${bt}형: ${blood[bt]}</span>`;
    }).join('');
    const orderHtml = orders.filter(o => o.fulfilled < o.quantity && o.fulfilled >= 0).map(o => {
      const pct = Math.round(o.deadline / o.maxDeadline * 100);
      const urgCls = o.urgent ? ' tyc-order-urgent' : '';
      return `<span class="tyc-order-tag${urgCls}" data-oid="${o.id}">${o.bloodType}형 ${o.fulfilled}/${o.quantity} 💰${o.reward} <span class="tyc-order-time" style="width:${pct}%"></span></span>`;
    }).join('');
    synEl.innerHTML = bloodHtml + orderHtml;
    synEl.querySelectorAll('.tyc-order-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const oid = tag.dataset.oid;
        const result = fulfillOrder(tycoonState, oid);
        if (result.success && result.done) {
          showTycoonBanner(`📦 주문 완료! +${result.reward}G`, 'upgrade');
          sfxCollect();
        } else if (result.success) {
          showTycoonBanner(`🩸 ${result.delivered}팩 납품!`, 'same');
        } else {
          showTycoonBanner('혈액 부족!', 'same');
        }
        renderTycoon();
      });
    });
  }

  let html = `<div class="defense-grid tyc-grid" style="grid-template-columns:repeat(${gridW},1fr);grid-template-rows:repeat(${gridH},1fr)">`;
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const fac = tycoonState.grid[r][c];
      if (fac) {
        const lvStars = '★'.repeat(fac.level);
        const progressPct = fac.processTime > 0 ? Math.round(fac.progress / fac.processTime * 100) : 0;
        const staffName = fac.staff ? fac.staff.name.slice(0, 2) : '';
        const busyCls = fac.busy ? ' tyc-fac-busy' : '';
        html += `<div class="def-tile tyc-fac${busyCls}" data-row="${r}" data-col="${c}">
          <div class="tyc-fac-icon">${fac.icon}</div>
          <div class="tyc-fac-name">${fac.name.slice(0, 2)}</div>
          <div class="tyc-fac-lv">${lvStars}</div>
          ${staffName ? `<div class="tyc-fac-staff">${staffName}</div>` : ''}
          ${fac.busy ? `<div class="tyc-fac-progress"><div class="tyc-fac-progress-fill" style="width:${progressPct}%"></div></div>` : ''}
        </div>`;
      } else {
        html += `<div class="def-tile tyc-empty" data-row="${r}" data-col="${c}">
          ${tycoonSelectedFacility ? `<div class="tyc-place-hint">+</div>` : ''}
        </div>`;
      }
    }
  }
  html += '</div>';

  if (donors.length > 0) {
    html += '<div class="tyc-donor-queue">';
    donors.filter(d => d.status === 'waiting' || d.status === 'collecting').slice(0, 8).forEach(d => {
      const patiencePct = Math.round(d.patience / d.maxPatience * 100);
      const statusIcon = d.status === 'collecting' ? '🛏️' : d.isVIP ? '👑' : d.isGroup ? '👥' : d.isRepeater ? '🔄' : d.isNervous ? '😰' : '🧑';
      html += `<div class="tyc-donor ${d.patience < 5 ? 'tyc-donor-angry' : ''}">
        <span class="tyc-donor-icon">${statusIcon}</span>
        <span class="tyc-donor-bt tyc-bt-${d.bloodType}">${d.bloodType}</span>
        <div class="tyc-donor-patience"><div class="tyc-donor-patience-fill" style="width:${patiencePct}%"></div></div>
      </div>`;
    });
    html += '</div>';
  }

  document.getElementById('defense-grid-wrap').innerHTML = html;

  document.querySelectorAll('.tyc-empty').forEach(tile => {
    tile.addEventListener('click', () => {
      if (!tycoonSelectedFacility || !tycoonState) return;
      const row = parseInt(tile.dataset.row);
      const col = parseInt(tile.dataset.col);
      const result = placeFacility(tycoonState, row, col, tycoonSelectedFacility);
      if (result.success) {
        sfxCardPlay();
        showTycoonBanner(`${result.facility.name} 설치!`, 'upgrade');
        updateFacilityBtns();
        renderTycoon();
      } else {
        showTycoonBanner('설치 불가!', 'same');
      }
    });
  });

  document.querySelectorAll('.tyc-fac').forEach(tile => {
    tile.addEventListener('click', () => {
      const row = parseInt(tile.dataset.row);
      const col = parseInt(tile.dataset.col);
      showFacilityInfo(row, col);
    });
  });
}

function showFacilityInfo(row, col) {
  const fac = tycoonState.grid[row]?.[col];
  if (!fac) return;
  const existing = document.querySelector('.def-unit-info');
  if (existing) existing.remove();
  const fType = FACILITY_TYPES[fac.id];
  const speed = getProcessingSpeed(fac);
  const adjBonus = getAdjacencyBonus(tycoonState, row, col);
  const upgCost = fac.level < 3 ? fType.cost * fac.level : 0;
  const popup = document.createElement('div');
  popup.className = 'def-unit-info';
  popup.innerHTML = `
    <div class="def-info-header">${fac.icon} ${fac.name} Lv.${fac.level}</div>
    <div class="def-info-role">${fType.desc}</div>
    <div class="def-info-stats">처리속도: ${speed.toFixed(1)}x${adjBonus > 0 ? ` · 인접보너스 +${Math.round(adjBonus * 100)}%` : ''} · ${fac.staff ? `직원: ${fac.staff.name}` : '직원 없음'}</div>
    ${fac.level < 3 ? `<button class="btn-secondary tyc-upgrade-btn" style="margin-top:4px;font-size:0.7rem">업그레이드 ${upgCost}G</button>` : '<div style="font-size:0.7rem;color:#C9A54E">MAX</div>'}
    <button class="btn-secondary tyc-staff-btn" style="margin-top:4px;font-size:0.7rem">${fac.staff ? '직원 교체' : '직원 배치'}</button>`;
  document.getElementById('defense-screen').appendChild(popup);
  popup.querySelector('.tyc-upgrade-btn')?.addEventListener('click', () => {
    const result = upgradeFacility(tycoonState, row, col);
    if (result.success) {
      sfxLevelUp();
      showTycoonBanner(`${fac.name} Lv.${result.level}!`, 'upgrade');
      popup.remove();
      updateFacilityBtns();
      renderTycoon();
    } else {
      showTycoonBanner('골드 부족!', 'same');
    }
  });
  popup.querySelector('.tyc-staff-btn')?.addEventListener('click', () => {
    popup.remove();
    showStaffSelect(row, col);
  });
  setTimeout(() => popup.remove(), 5000);
  popup.addEventListener('click', (e) => { if (e.target === popup) popup.remove(); });
}

function showStaffSelect(row, col) {
  const existing = document.querySelector('.tyc-staff-panel');
  if (existing) existing.remove();
  const chars = CHARACTERS.filter(c => gameSave.ownedCards?.[c.id]);
  if (chars.length === 0) return;
  const panel = document.createElement('div');
  panel.className = 'def-reward-overlay tyc-staff-panel';
  panel.innerHTML = `<div class="def-reward-panel">
    <div class="def-reward-title">직원 배치</div>
    <div class="def-reward-cards">${chars.slice(0, 6).map(c => `
      <button class="def-reward-card" data-cid="${c.id}">
        <div class="def-reward-icon">${c.name}</div>
        <div class="def-reward-desc">${c.role} · ${c.rarity}</div>
      </button>`).join('')}
    </div></div>`;
  document.getElementById('defense-screen').appendChild(panel);
  panel.querySelectorAll('.def-reward-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid = btn.dataset.cid;
      const charData = CHARACTERS.find(c => c.id === cid);
      if (charData) {
        assignStaff(tycoonState, row, col, charData);
        sfxEquip();
        showTycoonBanner(`${charData.name} 배치!`, 'upgrade');
      }
      panel.remove();
      renderTycoon();
    });
  });
}

function showTycoonBanner(text, type) {
  const banner = document.createElement('div');
  banner.className = `defense-banner defense-banner-${type}`;
  banner.textContent = text;
  document.getElementById('defense-screen').appendChild(banner);
  setTimeout(() => banner.remove(), 2000);
}

function showDailyReport(state, dayGold, milestones) {
  const totalBlood = Object.values(state.blood).reduce((s, v) => s + v, 0);
  const msHtml = milestones.length > 0 ? `<div class="tyc-report-ms">${milestones.map(m => `🏆 ${m.label} +${m.reward}G`).join('<br>')}</div>` : '';
  showTycoonBanner(`${state.day}일차 종료! +${dayGold}G · 헌혈 ${state.totalDonors}명 · 재고 ${totalBlood}팩`, 'upgrade');
  if (msHtml) showTycoonBanner(milestones.map(m => `🏆 ${m.label}`).join(' '), 'legendary');
}

function tycoonStartPrep() {
  tycoonState.phase = 'prep';
  tycoonPrepRemain = 10000;

  const preview = getDayPreview(tycoonState.day, countFacilities(tycoonState, 'booth'));
  let previewEl = document.getElementById('defense-wave-preview');
  if (!previewEl) {
    previewEl = document.createElement('div');
    previewEl.id = 'defense-wave-preview';
    previewEl.className = 'def-wave-preview';
    document.getElementById('defense-grid-wrap').parentElement.insertBefore(previewEl, document.getElementById('defense-grid-wrap'));
  }
  previewEl.innerHTML = `<span class="def-preview-label">다음 날</span>
    <span class="def-preview-count">🧑${preview.count}명</span>
    ${preview.hasVIP ? '<span class="def-preview-boss">👑VIP</span>' : ''}`;

  const event = rollTycoonEvent(tycoonState.day);
  if (event) {
    tycoonActiveEvent = event;
    showTycoonBanner(`${event.icon} ${event.name} — ${event.desc}`, 'legendary');
  }

  tycoonState.orders.push(...generateOrders(tycoonState.day));

  updateFacilityBtns();
  const startBtn = document.getElementById('btn-defense-start');
  if (startBtn) { startBtn.disabled = false; startBtn.textContent = '개원 ▶'; }
  startTycoonLoop();
}

function updateFacilityBtns() {
  const facPanel = document.getElementById('tyc-facility-panel');
  if (!facPanel || !tycoonState) return;
  facPanel.innerHTML = Object.values(FACILITY_TYPES).map(f => {
    const canBuy = tycoonState.gold >= f.cost;
    const sel = tycoonSelectedFacility === f.id ? ' btn-primary' : ' btn-secondary';
    return `<button class="tyc-fac-btn${sel}" data-fid="${f.id}" ${!canBuy ? 'disabled' : ''}>${f.icon} ${f.name} ${f.cost}G</button>`;
  }).join('');
  facPanel.querySelectorAll('.tyc-fac-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fid = btn.dataset.fid;
      tycoonSelectedFacility = tycoonSelectedFacility === fid ? null : fid;
      updateFacilityBtns();
      renderTycoon();
    });
  });
}

function tycoonStartOperating() {
  tycoonState.phase = 'operating';
  tycoonPrepRemain = 0;
  tycoonState.tickCount = 0;
  tycoonState.boothCount = countFacilities(tycoonState, 'booth');
  let donorWave = generateDonorWave(tycoonState.day, tycoonState.boothCount);
  if (tycoonActiveEvent?.id === 'campaign') {
    donorWave = donorWave.concat(generateDonorWave(tycoonState.day, tycoonState.boothCount));
  }
  tycoonState.donorQueue = donorWave;
  tycoonState.donors = [];
  const startBtn = document.getElementById('btn-defense-start');
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = '운영 중...'; }
  const previewEl = document.getElementById('defense-wave-preview');
  if (previewEl) previewEl.innerHTML = '';
  renderTycoon();
}

function tycoonGameTick() {
  if (!tycoonState) { stopTycoonLoop(); return; }

  if (tycoonState.phase === 'prep') {
    const interval = tycoonSpeed === 2 ? 250 : 500;
    tycoonPrepRemain -= interval;
    renderTycoon();
    if (tycoonPrepRemain <= 0) tycoonStartOperating();
    return;
  }

  const events = tycoonTick(tycoonState);
  events.forEach(ev => {
    if (ev.type === 'donor_arrive') sfxEvent();
    if (ev.type === 'donor_left') { sfxDebuff(); showTycoonBanner(`😤 헌혈자 이탈! 평판 -1`, 'same'); }
    if (ev.type === 'blood_collected') sfxCollect();
    if (ev.type === 'storage_full') showTycoonBanner('❄️ 저장고 가득!', 'same');
    if (ev.type === 'order_expired') { sfxDebuff(); showTycoonBanner(`📦 주문 기한 만료! 평판 -1`, 'same'); }
    if (ev.type === 'auto_fulfilled') {
      sfxCollect();
      showTycoonBanner(`📦 자동 납품 완료!`, 'upgrade');
    }
    if (ev.type === 'booth_reputation') {
      showTycoonBanner(`🎪 홍보부스 — 평판 +${ev.amount}`, 'same');
    }
    if (ev.type === 'day_complete') {
      sfxWin();
      stopTycoonLoop();
      const dayGold = tycoonDayIncome(tycoonState.day, tycoonState.gold);
      tycoonState.gold += dayGold;

      if (tycoonActiveEvent?.id === 'inspection') {
        const hasLab = countFacilities(tycoonState, 'lab') > 0;
        if (hasLab) {
          const bonus = 50 + tycoonState.day * 10;
          tycoonState.gold += bonus;
          showTycoonBanner(`🏥 보건검사 통과! +${bonus}G`, 'legendary');
        }
      }
      if (tycoonActiveEvent?.id === 'accident') {
        const bt = BLOOD_TYPES[Math.floor(Math.random() * BLOOD_TYPES.length)];
        if (tycoonState.blood[bt] >= 3) {
          tycoonState.blood[bt] -= 3;
          const bonus = 100 + tycoonState.day * 20;
          tycoonState.gold += bonus;
          tycoonState.reputation = Math.min(30, tycoonState.reputation + 2);
          showTycoonBanner(`🚨 긴급납품 ${bt}형 3팩! +${bonus}G`, 'legendary');
        }
      }

      tycoonActiveEvent = null;

      const milestones = checkMilestones(tycoonState);
      milestones.forEach(ms => {
        showTycoonBanner(`🏆 ${ms.label} 달성! +${ms.reward}G`, 'legendary');
      });

      if (tycoonState.day > (gameSave.tycoonBest || 0)) {
        gameSave.tycoonBest = tycoonState.day;
      }
      saveGame(gameSave);
      showDailyReport(tycoonState, dayGold, milestones);
      tycoonState.day++;
      tycoonStartPrep();
      renderTycoon();
      return;
    }
  });

  renderTycoon();

  if (tycoonState.reputation <= 0) {
    sfxLose();
    endTycoonMode(false);
    return;
  }
}

function endTycoonMode(won) {
  stopTycoonLoop();
  const day = tycoonState.day;
  const prevBest = gameSave.tycoonBest || 0;
  const isNewRecord = day > prevBest;
  if (isNewRecord) gameSave.tycoonBest = day;
  gameSave.stats.totalBattles++;
  const prestigeEarned = Math.floor(day / 5);
  gameSave.tycoonPrestige = (gameSave.tycoonPrestige || 0) + prestigeEarned;
  saveGame(gameSave);

  const facCount = tycoonState.grid.flat().filter(Boolean).length;
  const screen = document.getElementById('defense-screen');
  const overlay = document.createElement('div');
  overlay.className = 'def-result-overlay';
  const title = won === false ? '폐원' : '영업 종료';
  overlay.innerHTML = `
    <div class="def-result-card">
      <div class="def-result-title ${won === false ? 'def-result-lose' : 'def-result-quit'}">${title}</div>
      <div class="def-result-wave">${day}일차${isNewRecord ? ' <span class="def-new-record">NEW RECORD!</span>' : ''}</div>
      <div class="def-result-stats">
        <div><span>최고 기록</span><strong>${gameSave.tycoonBest}일</strong></div>
        <div><span>처리 헌혈자</span><strong>${tycoonState.totalDonors}</strong></div>
        <div><span>완료 주문</span><strong>${tycoonState.completedOrders}</strong></div>
        <div><span>시설 수</span><strong>${facCount}</strong></div>
        <div><span>이탈 헌혈자</span><strong>${tycoonState.lostDonors}</strong></div>
      </div>
      ${prestigeEarned > 0 ? `<div class="def-result-prestige">🏅 프레스티지 +${prestigeEarned} (총 ${gameSave.tycoonPrestige}) — 다음 판 시작 골드 +${gameSave.tycoonPrestige * 20}G</div>` : ''}
      <button class="btn-primary def-result-close">확인</button>
    </div>`;
  screen.appendChild(overlay);
  overlay.querySelector('.def-result-close').addEventListener('click', () => {
    overlay.remove();
    tycoonState = null;
    screen.style.display = 'none';
    document.getElementById('stage-select').style.display = '';
    renderStageSelect();
  });
}

function stopTycoonLoop() {
  if (tycoonLoopTimer) { clearInterval(tycoonLoopTimer); tycoonLoopTimer = null; }
}

function startTycoonLoop() {
  stopTycoonLoop();
  if (tycoonSpeed === 0) return;
  const interval = tycoonSpeed === 2 ? 250 : 500;
  tycoonLoopTimer = setInterval(tycoonGameTick, interval);
}

function updateTycoonSpeedBtn() {
  const btn = document.getElementById('btn-defense-speed');
  if (!btn) return;
  const labels = ['⏸', '×1', '×2'];
  btn.textContent = labels[tycoonSpeed] || '⏸';
  btn.classList.toggle('btn-primary', tycoonSpeed > 0);
  btn.classList.toggle('btn-secondary', tycoonSpeed === 0);
}

function initTycoonControls() {
  document.getElementById('btn-defense-start')?.addEventListener('click', () => {
    if (!tycoonState || tycoonState.phase !== 'prep') return;
    tycoonStartOperating();
  });
  document.getElementById('btn-defense-quit')?.addEventListener('click', () => {
    if (!tycoonState) return;
    stopTycoonLoop();
    endTycoonMode(false);
  });
  document.getElementById('btn-defense-speed')?.addEventListener('click', () => {
    tycoonSpeed = (tycoonSpeed + 1) % 3;
    updateTycoonSpeedBtn();
    if (tycoonSpeed > 0) startTycoonLoop();
    else stopTycoonLoop();
  });
  document.getElementById('btn-tyc-autofulfill')?.addEventListener('click', () => {
    if (!tycoonState) return;
    tycoonState.autoFulfill = !tycoonState.autoFulfill;
    const btn = document.getElementById('btn-tyc-autofulfill');
    btn.textContent = tycoonState.autoFulfill ? '자동납품 ON' : '자동납품 OFF';
    btn.classList.toggle('btn-primary', tycoonState.autoFulfill);
    btn.classList.toggle('btn-secondary', !tycoonState.autoFulfill);
  });
}

// ── Battle Start ──

function startBattle() {
  gameSave.lastTeam = [...deploySelected];
  saveGame(gameSave);
  const centerBuff = getCenterBuff(gameSave);
  const units = deploySelected.map(id => {
    const c = CHARACTERS.find(ch => ch.id === id);
    return c ? cardToUnit(c, 0, 0) : null;
  }).filter(Boolean);
  const teamData = units.length >= 2 ? getTeamCP(units) : null;
  const synergyMult = teamData ? teamData.synergy.teamMult : 1.0;
  battleState = createBattleState(currentStageId, deploySelected, centerBuff, synergyMult);
  battleState.hardMode = currentHardMode;

  if (currentHardMode) {
    battleState.units.filter(u => u.team === 'enemy').forEach(u => {
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
  }

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
    if (cardData?.relic) equipRelic(u, cardData.relic);
    if (cardData?.enhance) {
      const e = cardData.enhance;
      u.atk += e.atk || 0;
      u.def += e.def || 0;
      u.maxHp += (e.hp || 0) * 5;
      u.hp = u.maxHp;
      u.crt += (e.crt || 0) * 0.02;
      u.eva += (e.eva || 0) * 0.02;
    }
  });

  document.getElementById('deploy-screen').style.display = 'none';
  document.getElementById('battle-screen').style.display = '';
  document.getElementById('battle-log').innerHTML = '';
  battleLogHistory = [];
  battleQuestCompleted = [];
  playerTurnDmg = 0;
  playerTurnKills = 0;
  dangerZoneActive = false;
  undoMoveData = null;
  autoBattle = false;
  battleSpeed = gameSave.settings?.battleSpeed || 1;
  document.getElementById('btn-danger-zone').classList.remove('active');
  const autoBtn = document.getElementById('btn-auto');
  if (autoBtn) { autoBtn.textContent = '▶자동'; autoBtn.classList.remove('active'); }
  const speedBtn = document.getElementById('btn-speed');
  if (speedBtn) { speedBtn.textContent = `${battleSpeed}×`; speedBtn.classList.toggle('active', battleSpeed > 1); }

  const afterIntro = () => {
    showPhaseBanner('아군 턴', 'player');
    renderBattle();
  };

  if (!gameSave.onboarded) {
    gameSave.onboarded = true;
    saveGame(gameSave);
    showOnboarding(() => showStory(battleState.stage.storyIntro, afterIntro, battleState.stage));
  } else {
    showStory(battleState.stage.storyIntro, afterIntro, battleState.stage);
  }
}

// ── Onboarding ──

function showOnboarding(callback) {
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-box">
      <h3>🎴 첫 전투 안내</h3>
      <div class="onboarding-tips">
        <div class="ob-tip"><span class="ob-icon">👆</span><span>아군 유닛을 터치하여 <strong>이동·공격·스킬</strong>을 선택하세요</span></div>
        <div class="ob-tip"><span class="ob-icon">⚔️</span><span>적에게 인접하면 <strong>기본 공격</strong>, MP가 있으면 <strong>스킬</strong>을 쓸 수 있습니다</span></div>
        <div class="ob-tip"><span class="ob-icon">🔄</span><span>모든 유닛이 행동하면 <strong>턴 종료</strong>를 눌러 적 턴으로 넘기세요</span></div>
        <div class="ob-tip"><span class="ob-icon">🏆</span><span>적을 모두 처치하면 <strong>승리</strong>! 별 3개를 노려보세요</span></div>
      </div>
      <button class="ob-start-btn">전투 시작!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  overlay.querySelector('.ob-start-btn').addEventListener('click', () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
    if (callback) callback();
  });
}

function showAttendancePopup(day, cards, attend) {
  const rarityKo = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
  const rarityIcon = { common: '🃏', uncommon: '🎴', rare: '💎', legendary: '👑' };
  const ticketHtml = attend?.tickets ? `<div class="attend-bonus">🎫 모집권 ×${attend.tickets}</div>` : '';
  const itemHtml = attend?.items ? `<div class="attend-bonus">📦 소모품 ×${attend.items.length}</div>` : '';
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-box attendance-box">
      <h3>📅 출석 ${day}일 보상!</h3>
      <div class="attend-cards">
        ${cards.map(c => `<div class="attend-card attend-${c.rarity}">
          <span class="attend-icon">${rarityIcon[c.rarity] || '🃏'}</span>
          <span class="attend-name">${c.name}</span>
          <span class="attend-rarity">${rarityKo[c.rarity]}</span>
        </div>`).join('')}
      </div>
      ${ticketHtml}${itemHtml}
      <button class="ob-start-btn">받기</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  overlay.querySelector('.ob-start-btn').addEventListener('click', () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  });
}

// ── Story Panel ──

const VICTORY_LABEL = {
  defeat_all: '🗡️ 모든 적 제압',
  survive: '🛡️ 생존',
  boss_kill: '💀 보스 처치',
  capture_point: '📍 거점 점령',
  protect_target: '🛡️ 대상 보호',
};

function showStory(text, callback, stageInfo) {
  if (!text) { if (callback) callback(); return; }
  const panel = document.getElementById('story-panel');
  const storyText = document.getElementById('story-text');
  const portrait = document.getElementById('story-portrait');

  let headerHtml = '';
  if (stageInfo) {
    const act = STORY_ACTS.find(a => a.stages.includes(stageInfo.id));
    const actLabel = act ? act.name : '';
    const vcLabel = VICTORY_LABEL[stageInfo.victoryCondition] || VICTORY_LABEL.defeat_all;
    const weatherInfo = stageInfo.weather && WEATHER_TYPES[stageInfo.weather]
      ? `${WEATHER_TYPES[stageInfo.weather].icon} ${WEATHER_TYPES[stageInfo.weather].name}` : '';
    headerHtml = `<div class="story-stage-header">
      <div class="story-act-label">${actLabel}</div>
      <div class="story-stage-name">${stageInfo.name}</div>
      <div class="story-mission-info">
        <span class="story-victory">${vcLabel}</span>
        <span class="story-lv">Lv.${stageInfo.enemyLevel} · 적 ${stageInfo.enemyUnits.length}명</span>
        ${weatherInfo ? `<span class="story-weather">${weatherInfo}</span>` : ''}
      </div>
    </div>`;
  }

  portrait.innerHTML = headerHtml;
  storyText.textContent = text;
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
  banner.className = `phase-banner ${type ? type + '-phase' : ''}`;
  banner.style.display = 'flex';
  setTimeout(() => { banner.style.display = 'none'; }, 1500 / battleSpeed);
}

// ── Render Battle Grid ──

let _renderBattleRaf = null;
function renderBattle() {
  if (_renderBattleRaf) return;
  _renderBattleRaf = requestAnimationFrame(() => {
    _renderBattleRaf = null;
    _renderBattleImpl();
  });
}
function _renderBattleImpl() {
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

      let moveCostHtml = '';
      if (highlight?.cls === 'move-range' && !unit) {
        const tInfo = TILE_TYPES[tileType];
        if (tInfo && tInfo.movCost > 1) {
          moveCostHtml = `<div class="move-cost">${tInfo.movCost}</div>`;
        }
        if (tInfo?.defBonus) {
          const sign = tInfo.defBonus > 0 ? '+' : '';
          moveCostHtml += `<div class="move-terrain-hint">${sign}${tInfo.defBonus}DEF</div>`;
        }
      }

      let dmgPreviewHtml = '';
      if (uiMode === 'attack' && highlight?.cls === 'attack-range' && unit && unit.team === 'enemy' && selectedUid) {
        const attacker = getUnitByUid(battleState, selectedUid);
        if (attacker) {
          const preview = previewDamage(battleState, attacker, unit);
          const killChance = unit.hp <= preview.maxDmg ? (unit.hp <= preview.minDmg ? '💀확살' : '⚠처치가능') : '';
          dmgPreviewHtml = `<div class="dmg-preview"><span class="dmg-preview-val">${preview.minDmg}~${preview.maxDmg}</span>${preview.crt > 0 ? `<span class="dmg-preview-crt">CRT ${preview.crt}%</span>` : ''}${killChance ? `<span class="dmg-preview-kill">${killChance}</span>` : ''}</div>`;
        }
      }

      let unitHtml = '';
      if (unit) {
        const hpPct = Math.round((unit.hp / unit.maxHp) * 100);
        const shieldPct = unit.shield > 0 ? Math.min(100 - hpPct, Math.round((unit.shield / unit.maxHp) * 100)) : 0;
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
        if (unit.dots && unit.dots.length > 0) {
          const dotIcons = unit.dots.map(d => {
            const icon = d.type === 'poison' ? '🟢' : '🩸';
            return `<span class="status-badge dot-${d.type}" title="${d.type === 'poison' ? '독' : '출혈'} ${d.turns}턴">${icon}</span>`;
          }).join('');
          buffIcons += `<div class="unit-dot-icon">${dotIcons}</div>`;
        }
        if (unit.statusEffects && unit.statusEffects.length > 0) {
          const seIcons = unit.statusEffects.map(s => {
            const icon = s.type === 'stun' ? '💫' : '🐌';
            return `<span class="status-badge se-${s.type}" title="${s.type === 'stun' ? '기절' : '둔화'} ${s.turns}턴">${icon}</span>`;
          }).join('');
          buffIcons += `<div class="unit-status-icon">${seIcons}</div>`;
        }
        if (unit.rarity === 'legendary' && unit.team === 'enemy') {
          buffIcons += `<div class="unit-leader-icon">👑</div>`;
        }

        const nameTag = unit.name.length > 4 ? unit.name.slice(0, 4) : unit.name;
        const rarityClass = unit.rarity === 'legendary' ? ' rarity-legendary' : unit.rarity === 'rare' ? ' rarity-rare' : '';
        const lvBadge = `<div class="unit-lv-badge ${unit.team}">${unit.level}</div>`;
        const mpPct = unit.maxMp > 0 ? Math.round((unit.mp / unit.maxMp) * 100) : 0;
        const mpBar = unit.maxMp > 0 ? `<div class="unit-mp-bar"><div class="unit-mp-fill" style="width:${mpPct}%"></div></div>` : '';
        unitHtml = `
          <div class="unit ${unit.team}${actedClass}${rarityClass}" data-uid="${unit.uid}">
            <img src="${portraitSrc(`assets/portraits/${unit.id}`)}" alt="${unit.name}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
            <div class="unit-initial ${unit.team}" style="display:none">${unit.name[0]}</div>
            <div class="unit-hp-bar"><div class="unit-hp-fill${hpColor}" style="width:${hpPct}%"></div>${shieldPct > 0 ? `<div class="unit-shield-fill" style="width:${shieldPct}%;left:${hpPct}%"></div>` : ''}<span class="unit-hp-num">${unit.hp}</span></div>
            ${mpBar}
            <div class="unit-name-tag ${unit.team}">${nameTag}</div>
            ${lvBadge}
            ${buffIcons}
          </div>`;
      }

      html += `<div class="tile ${tileType}${highlightClass}${dangerClass}${selectedClass}" data-x="${c}" data-y="${r}">${unitHtml}${dmgPreviewHtml}${moveCostHtml}</div>`;
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
  const towerLabel = towerMode ? ` [${towerWave}층]` : '';
  document.getElementById('hud-stage').textContent = battleState.stage.name + towerLabel;
  document.getElementById('hud-turn').textContent = `턴 ${battleState.turnNumber}`;
  const phaseEl = document.getElementById('phase-indicator');
  if (battleState.phase === 'player_phase') {
    phaseEl.textContent = '아군 턴';
    phaseEl.className = 'phase-indicator player-phase';
  } else {
    phaseEl.textContent = '적 턴';
    phaseEl.className = 'phase-indicator enemy-phase';
  }
  document.getElementById('btn-end-turn').disabled = battleState.phase !== 'player_phase';

  const weatherEl = document.getElementById('hud-weather');
  if (weatherEl) {
    const w = battleState.weather;
    if (w && w.id !== 'clear') {
      weatherEl.innerHTML = `${w.icon} ${w.name} <span class="weather-effects-summary">${w.desc}</span>`;
      weatherEl.title = w.desc;
      weatherEl.style.display = '';
    } else {
      weatherEl.style.display = 'none';
    }
  }

  const weatherOverlay = document.getElementById('weather-overlay');
  if (weatherOverlay) {
    weatherOverlay.className = 'weather-overlay';
    if (battleState.weather && battleState.weather.id !== 'clear') {
      weatherOverlay.classList.add(`weather-${battleState.weather.id}`);
    }
  }
  renderTurnOrder();
  renderBattleMinimap();
}

function renderTurnOrder() {
  if (!battleState) return;
  const bar = document.getElementById('turn-order-bar');
  if (!bar) return;
  const units = battleState.units.filter(u => u.hp > 0);
  bar.innerHTML = units.map(u => {
    const actedCls = u.acted ? ' to-acted' : '';
    const teamCls = u.team === 'player' ? 'to-player' : 'to-enemy';
    const selectedCls = selectedUid === u.uid ? ' to-selected' : '';
    const hpPct = Math.round(u.hp / u.maxHp * 100);
    return `<div class="to-unit ${teamCls}${actedCls}${selectedCls}" data-uid="${u.uid}" title="${u.name} HP${hpPct}%">
      <img src="${portraitSrc(`assets/portraits/${u.id}`)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <span class="to-initial" style="display:none">${u.name[0]}</span>
      ${u.acted ? '<div class="to-check">✓</div>' : ''}
    </div>`;
  }).join('');
  bar.querySelectorAll('.to-unit').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      const unit = getUnitByUid(battleState, uid);
      if (unit) {
        scrollToTile(unit.x, unit.y);
        showUnitDetail(unit);
      }
    });
  });
}

function renderBattleMinimap() {
  if (!battleState) return;
  const content = document.getElementById('minimap-content');
  if (!content) return;
  const { map, units } = battleState;
  let html = `<div class="mm-grid" style="grid-template-columns:repeat(${map.cols},1fr)">`;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      const unit = units.find(u => u.hp > 0 && u.x === c && u.y === r);
      let dot = '';
      if (unit) dot = `<div class="mm-dot ${unit.team}"></div>`;
      html += `<div class="mm-tile mm-${tile.type}">${dot}</div>`;
    }
  }
  html += '</div>';
  content.innerHTML = html;
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
  const roleTree = PASSIVE_TREE[unit.role] || [];
  const passiveHtml = roleTree.length > 0
    ? `<div class="passive-list">패시브: ${roleTree.map(p => {
        const unlocked = unit.passivesApplied?.includes(p.name);
        return `<span class="passive-tag ${unlocked ? 'unlocked' : 'locked'}" title="${p.stat === 'eva' || p.stat === 'crt' ? `${p.stat.toUpperCase()} +${Math.round(p.val * 100)}%` : `${p.stat.toUpperCase()} +${p.val}`}">${unlocked ? '' : '🔒'}${p.name}<small class="passive-lv">Lv.${p.lv}</small></span>`;
      }).join('')}</div>` : '';
  const shieldHtml = unit.shield > 0 ? `<div class="equip-list">🛡️ 실드: ${unit.shield}</div>` : '';
  const invulnHtml = unit.invuln ? `<div class="equip-list" style="color:#ffd700">⭐ 무적 상태</div>` : '';
  const hardTag = (battleState?.hardMode && unit.team === 'enemy') ? `<div class="equip-list" style="color:#fc8181">🔥 하드 모드 강화</div>` : '';
  const buffListHtml = (unit.buffs && unit.buffs.length > 0)
    ? `<div class="buff-list">${unit.buffs.map(b => {
        const statLabel = { atk: '⚔ATK', def: '🛡DEF', eva: '💨EVA', crt: '🎯CRT', _invuln: '⭐무적' }[b.stat] || b.stat;
        const sign = b.val > 0 ? '+' : '';
        const valStr = (b.stat === 'eva' || b.stat === 'crt') ? `${sign}${Math.round(b.val * 100)}%` : `${sign}${b.val}`;
        return `<span class="buff-tag ${b.val > 0 ? 'buff-pos' : 'buff-neg'}">${statLabel}${valStr} <small>${b.turns}턴</small></span>`;
      }).join('')}</div>` : '';
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
    ${shieldHtml}${invulnHtml}${hardTag}
    ${buffListHtml}
    ${unit.dots && unit.dots.length > 0 ? `<div class="dot-list">${unit.dots.map(d => {
      const label = d.type === 'poison' ? '🟢독' : '🩸출혈';
      return `<span class="dot-tag dot-${d.type}">${label} ${d.damage}/턴 <small>${d.turns}턴</small></span>`;
    }).join('')}</div>` : ''}
    ${unit.statusEffects && unit.statusEffects.length > 0 ? `<div class="dot-list">${unit.statusEffects.map(s => {
      const label = s.type === 'stun' ? '💫기절' : '🐌둔화';
      return `<span class="dot-tag dot-${s.type}">${label} <small>${s.turns}턴</small></span>`;
    }).join('')}</div>` : ''}
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
  showCharQuote(unit, 'select');

  const sense = unit.senseSkill;
  const hasSense = sense && sense.cooldown === 0 && unit.mp >= (sense.mpCost || 0);
  const skillBtn = document.getElementById('btn-skill');
  skillBtn.disabled = !hasSense;
  if (sense) {
    const cdInfo = sense.cooldown > 0 ? ` CD${sense.cooldown}` : '';
    skillBtn.textContent = `스킬 (MP${sense.mpCost || 0}${cdInfo})`;
  } else {
    skillBtn.textContent = '스킬';
  }

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

let skillTargetUid = null;

function onTileClick(x, y) {
  if (!battleState || battleState.phase !== 'player_phase') return;

  const clickedUnit = battleState.units.find(u => u.hp > 0 && u.x === x && u.y === y);

  if (uiMode === 'skill_target') {
    const valid = highlightedTiles.find(t => t.x === x && t.y === y && t.cls === 'skill-range');
    if (valid && clickedUnit) {
      const attacker = getUnitByUid(battleState, selectedUid);
      if (attacker) {
        executeSkillOnTarget(attacker, clickedUnit);
      }
    } else {
      cancelSelection();
    }
    return;
  }

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
    showTerrainTooltip(x, y);
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

  const targetType = getSkillTargetType(unit);

  if (targetType === 'self' || targetType === 'auto') {
    executeSkillOnTarget(unit, null);
    return;
  }

  const targets = getSkillTargets(battleState, unit);
  if (targets.length === 0) {
    appendLog(`범위 내 대상 없음`);
    return;
  }

  highlightedTiles = targets.map(t => ({ x: t.x, y: t.y, cls: 'skill-range' }));
  uiMode = 'skill_target';
  hideActionMenu();
  renderBattle();
}

function executeSkillOnTarget(attacker, target) {
  undoMoveData = null;
  const enemiesBefore = battleState.units.filter(u => u.team !== attacker.team && u.hp > 0).length;
  const result = activateSense(battleState, attacker, target);
  if (result.ok) {
    const cat = SENSE_TYPES[attacker.senseSkill.baseType]?.category;
    showSkillOverlay(attacker.senseSkill.name, cat);
    showCharQuote(attacker, 'skill');
    const skillTile = document.querySelector(`.tile[data-x="${attacker.x}"][data-y="${attacker.y}"]`);
    if (skillTile) showSkillParticles(skillTile, cat || '촉');
    appendLog(`✦ ${attacker.name}의 「${result.skillName}」 발동!`);
    result.effects.forEach(e => appendLog(`  → ${e}`));
    trackQuest('skill');

    const enemiesAfter = battleState.units.filter(u => u.team !== attacker.team && u.hp > 0).length;
    const kills = enemiesBefore - enemiesAfter;
    if (kills > 0 && attacker.team === 'player') {
      gameSave.stats.totalKills += kills;
      for (let i = 0; i < kills; i++) trackQuest('kill');
    }
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
        renderBattle();
        const utile = document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`);
        if (utile) {
          const effectKey = Object.keys(item.effect)[0];
          const label = effectKey === 'heal' ? `+${item.effect.heal}HP` :
                        effectKey === 'mp' ? `+${item.effect.mp}MP` :
                        effectKey === 'xp' ? `+${item.effect.xp}XP` : '✦버프';
          showFloatingText(utile, label, effectKey === 'heal' || effectKey === 'mp' ? 'heal' : 'buff');
        }
        cancelSelection();
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
  const forecast = getKillForecast(battleState, attacker, defender);
  const typeLabel = { physical: '물리', mental: '정신', blood: '혈액' };
  const typeIcon = { physical: '⚔️', mental: '🧠', blood: '🩸' };

  let html = '';

  const killBadge = forecast.guaranteedKill ? '<span class="cmd-kill">확정 처치</span>' :
                    forecast.canKill ? '<span class="cmd-kill-maybe">처치 가능</span>' : '';
  const counterBadge = forecast.counterKillsYou ? '<span class="cmd-counter-danger">반격 위험!</span>' :
                       forecast.canCounter ? `<span class="cmd-counter-info">반격 ~${forecast.counterDmg}</span>` : '';
  const shieldBadge = preview.invuln ? '<span class="cmd-invuln">⭐무적</span>' :
                      preview.shield > 0 ? `<span class="cmd-shield">🛡${preview.shield}</span>` : '';

  // Basic attack option
  html += `
    <button class="cmd-option" data-cmd="basic">
      <div class="cmd-illust-slot">${typeIcon[attacker.attackType] || '⚔️'}</div>
      <div class="cmd-info">
        <div class="cmd-name">기본 공격${preview.flanking > 0 ? ` <span class="cmd-flank">협공+${preview.flanking}</span>` : ''} ${shieldBadge} ${killBadge}</div>
        <div class="cmd-type">${typeLabel[attacker.attackType] || '물리'} · MP 0</div>
        <div class="cmd-dmg">예상 ${preview.minDmg}~${preview.maxDmg} <span class="cmd-crit">CRT ${Math.round(preview.critDmg)}</span></div>
      </div>
      <div class="cmd-meta">
        <span class="cmd-eva">회피 ${Math.round((preview.eva || 0) * 100)}%</span>
        ${counterBadge}
      </div>
    </button>`;

  // Skill option
  if (attacker.senseSkill) {
    const sense = attacker.senseSkill;
    const senseInfo = SENSE_TYPES[sense.baseType];
    const skillPreview = previewSkillDamage(attacker, battleState);
    const canUse = sense.cooldown === 0 && attacker.mp >= (sense.mpCost || 0);
    const cooldownText = sense.cooldown > 0 ? `쿨다운 ${sense.cooldown}턴` : '';
    const mpText = `MP ${sense.mpCost || 0}`;

    let effectText = '';
    if (skillPreview) {
      const wTag = skillPreview.weatherLabel ? ` <span class="cmd-weather-mod">${skillPreview.weatherLabel}</span>` : '';
      if (skillPreview.type === 'damage') effectText = `데미지 ${skillPreview.minDmg}~${skillPreview.maxDmg}${wTag} · ${skillPreview.range}`;
      else if (skillPreview.type === 'heal') effectText = `회복 ~${skillPreview.value}${wTag} · ${skillPreview.range}`;
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

  const targetType = getSkillTargetType(attacker);
  const target = (targetType === 'enemy_single') ? defender :
                 (targetType === 'ally_single') ? null :
                 null;

  const result = activateSense(battleState, attacker, target);
  if (!result.ok) return;

  const skillXPups = gainXP(attacker, 15);
  attacker._battleXP = (attacker._battleXP || 0) + 15;
  if (skillXPups) {
    skillXPups.forEach(lv => {
      showLevelUp(attacker.name, lv);
      appendLog(`⬆ ${attacker.name} Lv.${lv.level} 달성! (ATK+2 DEF+1 HP+${lv.hpGain})`);
      sfxLevelUp();
    });
  }

  const cat2 = SENSE_TYPES[attacker.senseSkill.baseType]?.category;
  showSkillOverlay(attacker.senseSkill.name, cat2);
  const skillTile2 = document.querySelector(`.tile[data-x="${attacker.x}"][data-y="${attacker.y}"]`);
  if (skillTile2) showSkillParticles(skillTile2, cat2 || '촉');
  sfxBuff();
  appendLog(`✦ ${attacker.name}의 「${result.skillName}」 발동!`);
  result.effects.forEach(e => appendLog(`  → ${e}`));
  trackQuest('skill');
  saveGame(gameSave);

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 600 / battleSpeed); return; }

  commandTarget = null;
  cancelSelection();
  checkAutoEndTurn();
}

async function doUltimate(unit, ultIndex) {
  undoMoveData = null;
  const enemiesBefore = battleState.units.filter(u => u.team !== unit.team && u.hp > 0).length;
  const result = executeUltimate(battleState, unit, ultIndex);
  if (!result.ok) return;

  showSkillOverlay(result.name, 'ult');
  const ultTile = document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`);
  if (ultTile) showSkillParticles(ultTile, 'ult');
  appendLog(`🌟 ${unit.name}의 궁극기 「${result.name}」!`);
  result.effects.forEach(e => appendLog(`  → ${e}`));
  trackQuest('ultimate');

  const ultXPups = gainXP(unit, 15);
  unit._battleXP = (unit._battleXP || 0) + 15;
  if (ultXPups) {
    ultXPups.forEach(lv => {
      showLevelUp(unit.name, lv);
      appendLog(`⬆ ${unit.name} Lv.${lv.level} 달성! (ATK+2 DEF+1 HP+${lv.hpGain})`);
      sfxLevelUp();
    });
  }

  const enemiesAfter = battleState.units.filter(u => u.team !== unit.team && u.hp > 0).length;
  const kills = enemiesBefore - enemiesAfter;
  if (kills > 0 && unit.team === 'player') {
    gameSave.stats.totalKills += kills;
    unit._battleKills = (unit._battleKills || 0) + kills;
    for (let i = 0; i < kills; i++) trackQuest('kill');
  }
  saveGame(gameSave);

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 600 / battleSpeed); return; }

  commandTarget = null;
  cancelSelection();
  checkAutoEndTurn();
}

// ── Combat ──

async function doAttack(attacker, defender) {
  undoMoveData = null;
  const result = attackUnit(battleState, attacker, defender);
  if (!result.ok) return;
  if (attacker.team === 'player' && result.damage > 0) playerTurnDmg += result.damage;
  if (attacker.team === 'player' && result.defenderDied) playerTurnKills++;
  if (attacker.team === 'player') showCharQuote(attacker, 'attack');
  if (!result.evaded && result.damage > 0) {
    attacker._dmgDealt = (attacker._dmgDealt || 0) + result.damage;
    defender._dmgTaken = (defender._dmgTaken || 0) + result.damage;
  }
  if (result.counterDamage > 0) {
    defender._dmgDealt = (defender._dmgDealt || 0) + result.counterDamage;
    attacker._dmgTaken = (attacker._dmgTaken || 0) + result.counterDamage;
  }
  if (result.relicHeal > 0) attacker._healDone = (attacker._healDone || 0) + result.relicHeal;
  if (!result.evaded && result.damage > 0 && defender.hp > 0) showCharQuote(defender, 'hit');

  renderBattle();

  const atkUnitEl = document.querySelector(`.tile[data-x="${attacker.x}"][data-y="${attacker.y}"] .unit`);
  if (atkUnitEl) {
    const dx = (defender.x - attacker.x) * 12;
    const dy = (defender.y - attacker.y) * 12;
    atkUnitEl.style.setProperty('--lunge-x', `${dx}px`);
    atkUnitEl.style.setProperty('--lunge-y', `${dy}px`);
    atkUnitEl.classList.add('unit-lunge');
    await delay(250 / battleSpeed);
    atkUnitEl.classList.remove('unit-lunge');
  }

  await showCombatWidget(attacker, defender, result);

  const defTile = document.querySelector(`.tile[data-x="${defender.x}"][data-y="${defender.y}"]`);
  const atkTile = document.querySelector(`.tile[data-x="${attacker.x}"][data-y="${attacker.y}"]`);

  if (result.evaded) {
    if (defTile) showFloatingText(defTile, '회피!', 'evade');
    sfxEvade();
  } else if (defTile) {
    const label = result.penetrated ? `관통! -${result.damage}` : `-${result.damage}`;
    showFloatingText(defTile, label, result.critical ? 'critical' : (result.penetrated ? 'penetrate' : 'damage'));
    result.critical ? sfxCritical() : sfxHit();
    defTile.classList.add('damage-shake');
    setTimeout(() => defTile.classList.remove('damage-shake'), 400 / battleSpeed);
    const viewport = document.getElementById('battle-viewport');
    if (viewport) {
      viewport.classList.add(result.critical ? 'screen-shake-heavy' : 'screen-shake');
      setTimeout(() => viewport.classList.remove('screen-shake', 'screen-shake-heavy'), 400 / battleSpeed);
    }
  }

  if (result.counterDamage > 0 && atkTile) {
    setTimeout(() => showFloatingText(atkTile, `-${result.counterDamage}`, 'damage'), 500 / battleSpeed);
  }

  if (result.evaded) {
    appendLog(`⚔ ${attacker.name} → ${defender.name}: 회피!`);
  } else {
    const tags = [];
    if (result.penetrated) tags.push('관통');
    if (result.critical) tags.push('크리티컬');
    appendLog(`⚔ ${attacker.name} → ${defender.name}: ${result.damage}${tags.length ? ' ' + tags.join(' ') + '!' : ''}`);
    if (result.breakdown) {
      const b = result.breakdown;
      const parts = [`ATK${b.baseAtk}-DEF${b.baseDef}`];
      if (b.terrainAtk) parts.push(`지형+${b.terrainAtk}`);
      if (b.flanking) parts.push(`협공+${b.flanking}`);
      if (b.factionAtk) parts.push(`팩션+${b.factionAtk}`);
      if (b.pen) parts.push(`관통${b.pen}`);
      if (b.critMult > 1) parts.push(`크리×1.5`);
      if (b.synergyMult !== 1) parts.push(`시너지×${b.synergyMult}`);
      appendLog(`  📊 ${parts.join(' · ')}`);
    }
  }
  if (result.counterDamage) appendLog(`  ↩ 반격: ${result.counterDamage}`);
  if (result.relicProcs && result.relicProcs.length > 0) {
    result.relicProcs.forEach(proc => {
      if (proc.type === 'lifesteal' || proc.type === 'killHeal') {
        if (atkTile) setTimeout(() => showFloatingText(atkTile, `💎+${proc.value}`, 'heal'), 700 / battleSpeed);
        showMilestoneToast(`💎 ${proc.name} 발동!`, 'relic-proc');
        sfxBuff();
      } else if (proc.type === 'fullHp' || proc.type === 'lowHp') {
        showMilestoneToast(`💎 ${proc.name} 발동!`, 'relic-proc');
      }
    });
    if (result.relicHeal > 0) appendLog(`  💎 유물 회복 +${result.relicHeal}`);
  }
  if (result.defenderDied) {
    showCharQuote(defender, 'death');
    appendLog(`  💀 ${defender.name} 전사!`);
    gameSave.stats.totalKills++;
    attacker._battleKills = (attacker._battleKills || 0) + 1;
    trackQuest('kill');
    saveGame(gameSave);
    if (defTile) showDeathEffect(defTile);
    sfxDeath();
    checkCombatMilestone(attacker, defender, result);
  }
  if (result.attackerDied) {
    appendLog(`  💀 ${attacker.name} 전사!`);
    if (atkTile) showDeathEffect(atkTile);
    sfxDeath();
  }

  // XP & Level Up
  if (result.xpGains) {
    result.xpGains.forEach(g => {
      const u = getUnitByUid(battleState, g.unit);
      g.levelUps.forEach(lv => {
        if (u) showLevelUp(u.name, lv);
        appendLog(`⬆ ${u?.name || '?'} Lv.${lv.level} 달성! (ATK+2 DEF+1 HP+${lv.hpGain})`);
        sfxLevelUp();
      });
    });
  }
  if (!result.evaded && result.damage > 0) {
    attacker._battleXP = (attacker._battleXP || 0) + 10;
  }
  if (result.defenderDied) {
    attacker._battleXP = (attacker._battleXP || 0) + 30;
  }
  if (result.counterDamage > 0) {
    defender._battleXP = (defender._battleXP || 0) + 5;
  }

  // Loot drop → save to inventory
  if (result.loot) {
    showLootDrop(result.loot);
    appendLog(`🎁 드롭: ${result.loot.name}`);
    gameSave.inventory.push(result.loot);
    if (!battleState._battleLoot) battleState._battleLoot = [];
    battleState._battleLoot.push(result.loot);
    saveGame(gameSave);
  }

  renderBattle();

  const vc = checkVictory(battleState);
  if (vc) { setTimeout(() => handleBattleEnd(vc), 1200 / battleSpeed); return; }

  cancelSelection();
  checkAutoEndTurn();
}

// ── Visual Effects ──

function showCharQuote(unit, trigger) {
  const quotes = CHAR_QUOTES[unit.charId || unit.id];
  if (!quotes || !quotes[trigger]) return;
  const tile = document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`);
  if (!tile) return;
  const bubble = document.createElement('div');
  bubble.className = 'char-speech-bubble';
  bubble.textContent = quotes[trigger];
  tile.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1800 / battleSpeed);
}

function showFloatingText(tileEl, text, type) {
  const ft = document.createElement('div');
  ft.className = `float-text ${type}`;
  ft.textContent = text;
  tileEl.appendChild(ft);
  setTimeout(() => ft.remove(), 1000 / battleSpeed);
}

function showDeathEffect(tileEl) {
  const fx = document.createElement('div');
  fx.className = 'death-effect';
  tileEl.appendChild(fx);
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'death-particle';
    p.style.setProperty('--angle', `${i * 60 + Math.random() * 30}deg`);
    p.style.setProperty('--dist', `${20 + Math.random() * 15}px`);
    fx.appendChild(p);
  }
  setTimeout(() => fx.remove(), 800 / battleSpeed);
}

function scrollToTile(x, y) {
  const viewport = document.getElementById('battle-viewport');
  if (!viewport) return;
  const tile = viewport.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`);
  if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
    setTimeout(dismiss, 2000 / battleSpeed);
  });
}

function showSkillOverlay(name, category) {
  sfxSkill();
  const overlay = document.getElementById('skill-overlay');
  const typeClass = category === '촉' ? 'sense-human' : category === 'ult' ? 'sense-ult' : 'sense-blood';
  overlay.className = `skill-overlay ${typeClass}`;
  document.getElementById('skill-overlay-name').textContent = `「${name}」`;
  overlay.style.display = 'flex';
  overlay.style.animation = 'none';
  overlay.offsetHeight;
  overlay.style.animation = '';
  setTimeout(() => { overlay.style.display = 'none'; }, 1200 / battleSpeed);
}

function showSkillParticles(tileEl, category) {
  const colors = category === '촉' ? ['#60a5fa', '#93c5fd', '#3b82f6'] :
                 category === 'ult' ? ['#fbbf24', '#f59e0b', '#fcd34d'] :
                 ['#ef4444', '#f87171', '#dc2626'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'skill-particle';
    p.style.setProperty('--angle', `${i * 45 + Math.random() * 20}deg`);
    p.style.setProperty('--dist', `${15 + Math.random() * 20}px`);
    p.style.setProperty('--color', colors[Math.floor(Math.random() * colors.length)]);
    p.style.setProperty('--delay', `${Math.random() * 0.15}s`);
    tileEl.appendChild(p);
    setTimeout(() => p.remove(), 800 / battleSpeed);
  }
}

function showMilestoneToast(text, type) {
  const toast = document.createElement('div');
  toast.className = `milestone-toast ${type}`;
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800 / battleSpeed);
}

function checkCombatMilestone(attacker, defender, result) {
  if (attacker.team !== 'player' || !result.defenderDied) return;
  const totalKills = getLivingUnits(battleState, 'enemy')
    .length === 0 ? battleState._totalPlayerKills : undefined;
  battleState._totalPlayerKills = (battleState._totalPlayerKills || 0) + 1;
  if (battleState._totalPlayerKills === 1) {
    showMilestoneToast('⚡ First Blood!', 'first-blood');
  }
  const char = CHARACTERS.find(c => c.id === defender.charId);
  if (char && char.rarity === 'legendary') {
    showMilestoneToast(`👑 보스 처치! ${defender.name}`, 'boss-kill');
  }
  const streak = attacker._battleKills || 0;
  if (streak === 3) showMilestoneToast(`🔥 ${attacker.name} 트리플 킬!`, 'kill-streak');
  else if (streak === 5) showMilestoneToast(`💀 ${attacker.name} 펜타 킬!`, 'kill-streak');
}

function showLootDrop(loot) {
  const el = document.getElementById('loot-popup');
  document.getElementById('loot-name').textContent = loot.name;
  el.style.display = '';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  setTimeout(() => { el.style.display = 'none'; }, 2000 / battleSpeed);
}

function showLevelUp(name, levelData) {
  const el = document.getElementById('levelup-popup');
  document.getElementById('levelup-name').textContent = name;
  document.getElementById('levelup-level').textContent = `Lv.${levelData.level}`;
  const statsEl = document.getElementById('levelup-stats');
  if (statsEl) {
    statsEl.innerHTML = `<span class="ls-atk">ATK+2</span><span class="ls-def">DEF+1</span><span class="ls-hp">HP+${levelData.hpGain}</span>`;
  }
  el.style.display = '';
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  setTimeout(() => { el.style.display = 'none'; }, 2500 / battleSpeed);
}

function showReinforceBanner(msg) {
  const el = document.getElementById('reinforce-banner');
  document.getElementById('reinforce-text').textContent = msg;
  el.style.display = 'flex';
  setTimeout(() => { el.style.display = 'none'; }, 2500 / battleSpeed);
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
    return `<div class="ulp-unit ${u.team}${acted} ${u.hp <= 0 ? 'ulp-dead' : ''}" data-uid="${u.uid}">
      <span class="ulp-name">${u.name}</span>
      <div class="ulp-hp-bar"><div class="ulp-hp-fill ${hpColor}" style="width:${hpPct}%"></div></div>
      <span class="ulp-hp-text">${u.hp}/${u.maxHp}</span>
      ${buffCount > 0 ? `<span class="ulp-buffs">✦${buffCount}</span>` : ''}
      ${u.dots?.length > 0 ? `<span class="ulp-dots">${u.dots.map(d => d.type === 'poison' ? '🟢' : '🩸').join('')}</span>` : ''}
      ${u.acted ? '<span class="ulp-acted">✓</span>' : ''}
    </div>`;
  };

  content.innerHTML = `
    <div class="ulp-section"><div class="ulp-label">🔵 아군</div>${playerUnits.map(renderUnit).join('')}</div>
    <div class="ulp-section"><div class="ulp-label">🔴 적</div>${enemyUnits.map(renderUnit).join('')}</div>
  `;
  content.querySelectorAll('.ulp-unit').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      const unit = getUnitByUid(battleState, uid);
      if (unit && unit.hp > 0) {
        selectedUid = unit.uid;
        highlightedTiles = [];
        showUnitDetail(unit);
        if (unit.team === 'player' && !unit.acted && battleState.phase === 'player_phase') showActionMenu(unit);
        renderBattle();
        panel.style.display = 'none';
      }
    });
  });
  panel.style.display = '';
}

// ── End Turn ──

function checkAutoEndTurn() {
  if (battleState && allPlayerUnitsActed(battleState)) {
    setTimeout(() => endTurn(), 400 / battleSpeed);
  }
}

function endTurn() {
  if (!battleState || battleState.phase !== 'player_phase') return;

  if (playerTurnDmg > 0) {
    appendLog(`📊 아군 턴 요약: 총 ${playerTurnDmg} 데미지${playerTurnKills > 0 ? ` · ${playerTurnKills} 처치` : ''}`);
  }
  endPlayerPhase(battleState);
  showPhaseBanner('적 턴', 'enemy');
  document.getElementById('btn-end-turn').disabled = true;
  if (!dangerZoneActive) {
    dangerZoneActive = true;
    document.getElementById('btn-danger-zone').classList.add('active');
    renderBattle();
  }
  const enemyCount = battleState.units.filter(u => u.team === 'enemy' && u.hp > 0).length;
  appendLogSeparator(`── 턴 ${battleState.turnNumber} · 적 페이즈 (${enemyCount}기) ──`);

  setTimeout(async () => {
    const actions = runEnemyPhase(battleState);
    const cameraTrack = gameSave.settings?.cameraTrack !== false;

    for (let ai = 0; ai < actions.length; ai++) {
      const a = actions[ai];
      if (a.type === 'attack') {
        const unit = getUnitByUid(battleState, a.unit);
        const target = getUnitByUid(battleState, a.target);
        showEnemyActionQueue(`${unit?.name || '적'} → ${target?.name || '?'} 공격 (${ai + 1}/${actions.length})`);
        renderBattle();
        if (unit) {
          highlightEnemyAction(unit);
          if (cameraTrack) scrollToTile(unit.x, unit.y);
        }
        appendLog(`⚔ ${unit?.name || '적'} → ${target?.name || '?'}: ${a.damage}${a.critical ? ' 크리티컬!' : ''}`);
        if (a.counterDamage > 0) appendLog(`  ↩ ${target?.name} 반격: ${a.counterDamage}`);
        if (a.defenderDied) {
          appendLog(`  💀 ${target?.name} 전사!`);
          const deadTile = target ? document.querySelector(`.tile[data-x="${target.x}"][data-y="${target.y}"]`) : null;
          if (deadTile) showDeathEffect(deadTile);
        }
        if (a.attackerDied) {
          appendLog(`  💀 ${unit?.name} 반격으로 전사!`);
          if (target) {
            target._battleKills = (target._battleKills || 0) + 1;
            gameSave.stats.totalKills++;
            trackQuest('kill');
            saveGame(gameSave);
          }
          const deadTile = unit ? document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`) : null;
          if (deadTile) showDeathEffect(deadTile);
        }
        const defTile = target ? document.querySelector(`.tile[data-x="${target.x}"][data-y="${target.y}"]`) : null;
        if (defTile && !a.evaded) {
          showFloatingText(defTile, `-${a.damage}`, a.critical ? 'critical' : 'damage');
          defTile.classList.add('damage-shake');
          setTimeout(() => defTile.classList.remove('damage-shake'), 400);
          const viewport = document.getElementById('battle-viewport');
          if (viewport) {
            viewport.classList.add(a.critical ? 'screen-shake-heavy' : 'screen-shake');
            setTimeout(() => viewport.classList.remove('screen-shake', 'screen-shake-heavy'), 400);
          }
        }
        if (a.counterDamage > 0) {
          const atkTile = unit ? document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`) : null;
          if (atkTile) setTimeout(() => showFloatingText(atkTile, `-${a.counterDamage}`, 'damage'), 300);
        }
        await delay(600 / battleSpeed);
      } else if (a.type === 'move') {
        const unit = getUnitByUid(battleState, a.unit);
        showEnemyActionQueue(`${unit?.name || '적'} 이동 (${ai + 1}/${actions.length})`);
        renderBattle();
        appendLog(`적 ${unit?.name || '?'} 이동`);
        await delay(300 / battleSpeed);
      } else if (a.type === 'sense') {
        showEnemyActionQueue(`적 스킬: ${a.skillName} (${ai + 1}/${actions.length})`);
        renderBattle();
        appendLog(`✦ 적 스킬: ${a.skillName}`);
        showSkillOverlay(a.skillName, 'blood');
        await delay(800 / battleSpeed);
      } else if (a.type === 'ultimate') {
        showEnemyActionQueue(`적 궁극기: ${a.name} (${ai + 1}/${actions.length})`);
        renderBattle();
        appendLog(`🌟 적 궁극기: ${a.name}`);
        a.effects?.forEach(e => appendLog(`  → ${e}`));
        showSkillOverlay(a.name, 'ult');
        await delay(1000 / battleSpeed);
      } else if (a.type === 'phase_shift') {
        const unit = getUnitByUid(battleState, a.unit);
        renderBattle();
        appendLog(`⭐ ${unit?.name || '?'} 위상 전환! 1턴간 무적`);
        showReinforceBanner(`⭐ ${unit?.name || '?'} 위상 전환!`);
        await delay(1200 / battleSpeed);
      } else if (a.type === 'enrage') {
        const unit = getUnitByUid(battleState, a.unit);
        renderBattle();
        appendLog(`🔥 ${unit?.name || '?'} 분노! ATK +${a.atkBoost}`);
        showReinforceBanner(`🔥 ${unit?.name || '?'} 분노 발동!`);
        await delay(1200 / battleSpeed);
      } else if (a.type === 'stunned') {
        const unit = getUnitByUid(battleState, a.unit);
        renderBattle();
        if (unit) {
          const tile = document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`);
          if (tile) showFloatingText(tile, '💫기절!', 'stun');
        }
        appendLog(`💫 ${unit?.name || '?'} 기절 — 행동 불가`);
        await delay(500 / battleSpeed);
      }

      const vc = checkVictory(battleState);
      if (vc) { handleBattleEnd(vc); return; }
    }

    const dotSnapshot = battleState.units
      .filter(u => u.hp > 0 && u.dots && u.dots.length > 0)
      .map(u => ({ uid: u.uid, x: u.x, y: u.y, dots: u.dots.map(d => ({ ...d })) }));

    hideEnemyActionQueue();
    const phaseResult = endEnemyPhase(battleState);

    if (phaseResult?.expiredBuffs?.length > 0) {
      phaseResult.expiredBuffs.forEach(b => {
        appendLog(`⏳ ${b.name}의 ${b.stat} 버프 종료`);
      });
    }

    if (phaseResult?.terrainHealed?.length > 0) {
      renderBattle();
      phaseResult.terrainHealed.forEach(h => {
        const tile = document.querySelector(`.tile[data-x="${h.x}"][data-y="${h.y}"]`);
        if (tile) showFloatingText(tile, `♨+${h.heal}`, 'heal');
        appendLog(`♨ ${h.name} 온천 회복 +${h.heal}`);
      });
      await delay(500 / battleSpeed);
    }

    if (dotSnapshot.length > 0) {
      renderBattle();
      dotSnapshot.forEach(snap => {
        const u = getUnitByUid(battleState, snap.uid);
        const tile = document.querySelector(`.tile[data-x="${snap.x}"][data-y="${snap.y}"]`);
        if (tile) {
          snap.dots.forEach(d => {
            const label = d.type === 'poison' ? '🟢' : '🩸';
            showFloatingText(tile, `${label}-${d.damage}`, 'dot');
            sfxDot();
          });
          if (u && u.hp <= 0) {
            appendLog(`☠ ${u.name} — 지속 피해로 전사!`);
            showFloatingText(tile, '💀전사!', 'damage');
          }
        }
      });
      await delay(600 / battleSpeed);
      const vcDot = checkVictory(battleState);
      if (vcDot) { handleBattleEnd(vcDot); return; }
    }

    const stunnedPlayers = battleState.units.filter(u => u.team === 'player' && u.hp > 0 && isStunned(u));
    if (stunnedPlayers.length > 0) {
      renderBattle();
      stunnedPlayers.forEach(u => {
        appendLog(`💫 ${u.name} 기절 — 이번 턴 행동 불가`);
        const tile = document.querySelector(`.tile[data-x="${u.x}"][data-y="${u.y}"]`);
        if (tile) showFloatingText(tile, '💫기절!', 'stun');
      });
      await delay(600 / battleSpeed);
    }

    const reinforcement = spawnReinforcements(battleState);
    if (reinforcement) {
      renderBattle();
      showReinforceBanner(reinforcement.message);
      reinforcement.units.forEach(u => appendLog(`🔴 증원: ${u.name} 등장!`));
      await delay(2000 / battleSpeed);
    }

    const totalEnemyDmg = actions.filter(a => a.type === 'attack').reduce((sum, a) => sum + (a.damage || 0), 0);
    const enemyKills = actions.filter(a => a.type === 'attack' && a.defenderDied).length;
    if (totalEnemyDmg > 0) {
      appendLog(`📊 적 턴 요약: 총 ${totalEnemyDmg} 데미지${enemyKills > 0 ? ` · ${enemyKills} 처치` : ''}`);
    }
    appendLogSeparator(`── 턴 ${battleState.turnNumber} · 아군 페이즈 ──`);
    playerTurnDmg = 0;
    playerTurnKills = 0;
    if (dangerZoneActive) {
      dangerZoneActive = false;
      document.getElementById('btn-danger-zone').classList.remove('active');
    }
    showPhaseBanner('아군 턴', 'player');
    renderBattle();
    if (autoBattle) {
      setTimeout(() => runAutoBattle(), 500 / battleSpeed);
    } else {
      checkAutoEndTurn();
    }
  }, 800 / battleSpeed);
}

function toggleBattleSpeed() {
  battleSpeed = battleSpeed === 1 ? 2 : battleSpeed === 2 ? 3 : 1;
  const btn = document.getElementById('btn-speed');
  btn.textContent = `${battleSpeed}×`;
  btn.classList.toggle('active', battleSpeed > 1);
  gameSave.settings = gameSave.settings || {};
  gameSave.settings.battleSpeed = battleSpeed;
  saveGame(gameSave);
}

function toggleAutoBattle() {
  autoBattle = !autoBattle;
  const btn = document.getElementById('btn-auto');
  btn.textContent = autoBattle ? '⏸자동' : '▶자동';
  btn.classList.toggle('active', autoBattle);
  if (autoBattle && battleState?.phase === 'player_phase') runAutoBattle();
}

async function runAutoBattle() {
  if (!autoBattle || !battleState || battleState.phase !== 'player_phase') return;
  const players = battleState.units.filter(u => u.team === 'player' && u.hp > 0 && !u.acted && !isStunned(u));
  for (const unit of players) {
    if (!autoBattle || !battleState || battleState.phase !== 'player_phase') break;
    const vc = checkVictory(battleState);
    if (vc) break;

    const moveRange = getMovementRange(battleState, unit);
    const targets = getAttackTargets(battleState, unit);
    if (targets.length > 0) {
      const target = targets.sort((a, b) => a.hp - b.hp)[0];
      await doAttack(unit, target);
      renderBattle();
      await delay(400 / battleSpeed);
    } else if (moveRange.length > 0) {
      const enemies = battleState.units.filter(u => u.team === 'enemy' && u.hp > 0);
      if (enemies.length > 0) {
        const closestEnemy = enemies.sort((a, b) => {
          const da = Math.abs(a.x - unit.x) + Math.abs(a.y - unit.y);
          const db = Math.abs(b.x - unit.x) + Math.abs(b.y - unit.y);
          return da - db;
        })[0];
        const bestTile = moveRange.sort((a, b) => {
          const da = Math.abs(closestEnemy.x - a.x) + Math.abs(closestEnemy.y - a.y);
          const db = Math.abs(closestEnemy.x - b.x) + Math.abs(closestEnemy.y - b.y);
          return da - db;
        })[0];
        if (bestTile) {
          moveUnit(battleState, unit, bestTile.x, bestTile.y);
          renderBattle();
          await delay(200 / battleSpeed);
          const newTargets = getAttackTargets(battleState, unit);
          if (newTargets.length > 0) {
            const target = newTargets.sort((a, b) => a.hp - b.hp)[0];
            await doAttack(unit, target);
            renderBattle();
            await delay(400 / battleSpeed);
          } else {
            unit.acted = true;
          }
        }
      } else {
        unit.acted = true;
      }
    } else {
      unit.acted = true;
    }
    renderBattle();
    await delay(200 / battleSpeed);
  }
  if (autoBattle && battleState?.phase === 'player_phase' && allPlayerUnitsActed(battleState)) {
    endTurn();
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function showTerrainTooltip(x, y) {
  if (!battleState) { cancelSelection(); return; }
  const tile = battleState.map.tiles[y]?.[x];
  if (!tile) { cancelSelection(); return; }
  const tileInfo = TILE_TYPES[tile.type];
  if (!tileInfo) { cancelSelection(); return; }

  const effects = [];
  if (tileInfo.defBonus) effects.push(`DEF ${tileInfo.defBonus > 0 ? '+' : ''}${tileInfo.defBonus}`);
  if (tileInfo.atkBonus) effects.push(`ATK +${tileInfo.atkBonus}`);
  if (tileInfo.evaBonus) effects.push(`EVA +${Math.round(tileInfo.evaBonus * 100)}%`);
  if (tileInfo.healPerTurn) effects.push(`매턴 HP +${tileInfo.healPerTurn}`);
  if (tileInfo.movCost > 1) effects.push(`이동비용 ${tileInfo.movCost}`);
  if (!tileInfo.walkable) effects.push('이동 불가');

  const tileEl = document.querySelector(`.tile[data-x="${x}"][data-y="${y}"]`);
  if (tileEl && effects.length > 0) {
    const tip = document.createElement('div');
    tip.className = 'terrain-tooltip';
    tip.innerHTML = `<strong>${tileInfo.icon} ${tileInfo.label}</strong><br>${effects.join(' · ')}`;
    tileEl.appendChild(tip);
    setTimeout(() => tip.remove(), 2500);
  } else if (tileEl) {
    const tip = document.createElement('div');
    tip.className = 'terrain-tooltip';
    tip.textContent = `${tileInfo.icon} ${tileInfo.label}`;
    tileEl.appendChild(tip);
    setTimeout(() => tip.remove(), 1500);
  }
  selectedUid = null;
  uiMode = 'idle';
  hideActionMenu();
  hideCommandPanel();
  showUnitDetail(null);
}

function highlightEnemyAction(unit) {
  const tile = document.querySelector(`.tile[data-x="${unit.x}"][data-y="${unit.y}"]`);
  if (tile) {
    tile.classList.add('enemy-acting');
    setTimeout(() => tile.classList.remove('enemy-acting'), 600);
  }
}

function showEnemyActionQueue(actionText) {
  const el = document.getElementById('enemy-action-queue');
  if (!el) return;
  el.textContent = actionText;
  el.style.display = '';
}
function hideEnemyActionQueue() {
  const el = document.getElementById('enemy-action-queue');
  if (el) el.style.display = 'none';
}

// ── Battle End ──

function handleBattleEnd(result) {
  const overlay = document.getElementById('battle-result');
  const box = document.getElementById('battle-result-box');
  const title = document.getElementById('result-title');
  const text = document.getElementById('result-text');

  gameSave.stats.totalBattles++;
  trackQuest('battle');

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
    if (battleState.hardMode) {
      if (!gameSave.hardClears) gameSave.hardClears = {};
      gameSave.hardClears[battleState.stageId] = { stars, clears: (gameSave.hardClears[battleState.stageId]?.clears || 0) + 1 };
    }

    const mvp = [...playerUnits].sort((a, b) => (b._battleKills || 0) - (a._battleKills || 0))[0];
    const unitSummary = playerUnits.map(u => {
      const lvInfo = ` Lv.${u.level}`;
      const hpPct = u.hp > 0 ? Math.round(u.hp / u.maxHp * 100) : 0;
      const hpBar = u.hp > 0 ? `<div class="result-hp-bar"><div class="result-hp-fill" style="width:${hpPct}%"></div></div>` : '';
      const status = u.hp > 0 ? `${u.hp}/${u.maxHp}` : '전사';
      const kills = u._battleKills || 0;
      const xpEarned = u._battleXP || 0;
      const dmgDealt = u._dmgDealt || 0;
      const dmgTaken = u._dmgTaken || 0;
      const healDone = u._healDone || 0;
      const isMvp = u.uid === mvp?.uid && kills > 0;
      const xpPct = Math.min(100, Math.round(u.xp / u.xpToNext * 100));
      return `<div class="result-unit ${u.hp <= 0 ? 'result-dead' : ''} ${isMvp ? 'result-mvp' : ''}">
        <div class="result-unit-left">
          <div class="result-unit-portrait"><img src="${portraitSrc(`assets/portraits/${u.id}`)}" onerror="this.parentElement.textContent='${u.name[0]}'" /></div>
          <div>
            <div class="result-unit-name">${isMvp ? '👑 ' : ''}${u.name}${lvInfo}</div>
            <div class="result-unit-status">${status}${kills > 0 ? ` · ${kills}킬` : ''}${xpEarned > 0 ? ` · +${xpEarned}XP` : ''}</div>
            <div class="result-unit-combat">${dmgDealt > 0 ? `⚔${dmgDealt}` : ''}${dmgTaken > 0 ? ` 🛡${dmgTaken}` : ''}${healDone > 0 ? ` 💚${healDone}` : ''}</div>
          </div>
        </div>
        ${hpBar}
        ${xpEarned > 0 ? `<div class="result-xp-bar"><div class="result-xp-fill" style="width:${xpPct}%"></div><span class="result-xp-label">${u.xp}/${u.xpToNext}</span></div>` : ''}
      </div>`;
    }).join('');

    const totalEnemies = battleState.units.filter(u => u.team === 'enemy').length;
    const weatherLabel = battleState.weather?.id !== 'clear' ? ` · ${battleState.weather.icon} ${battleState.weather.name}` : '';

    const starsHtml = Array.from({ length: 3 }, (_, i) =>
      `<span class="result-star ${i < stars ? 'earned' : 'empty'}" style="animation-delay:${i * 0.2}s">${i < stars ? '⭐' : '☆'}</span>`
    ).join('');

    const hardLabel = battleState.hardMode ? ' · 🔥 하드' : '';
    const mvpSection = (mvp && (mvp._battleKills || 0) > 0) ? `
      <div class="result-mvp-showcase">
        <div class="mvp-portrait"><img src="${portraitSrc(`assets/portraits/${mvp.id}`)}" onerror="this.parentElement.textContent='${mvp.name[0]}'" /></div>
        <div class="mvp-info">
          <div class="mvp-title">👑 MVP</div>
          <div class="mvp-name">${mvp.name} Lv.${mvp.level}</div>
          <div class="mvp-stats">${mvp._battleKills}킬 · ${mvp._battleXP || 0}XP · ${mvp.hp > 0 ? `HP ${Math.round(mvp.hp/mvp.maxHp*100)}%` : '전사'}</div>
        </div>
      </div>` : '';
    text.innerHTML = `
      <div class="result-story">${battleState.stage.storyOutro || '모든 적을 제압했습니다!'}</div>
      <div class="result-stars">${starsHtml}</div>
      <div class="result-summary">
        <span>${turns}턴</span> · <span>생존 ${survivors.length}/${playerUnits.length}</span> · <span>처치 ${enemiesDefeated}/${totalEnemies}</span>${weatherLabel}${hardLabel}
      </div>
      ${mvpSection}
      <div class="result-units">${unitSummary}</div>
    `;
    gameSave.stats.wins++;
    trackQuest('win');
    sfxWin();

    const teamCharIds = playerUnits.map(u => u.charId || u.id);
    const bondUps = progressBonds(gameSave, teamCharIds);
    if (bondUps.length > 0) {
      const bondNames = bondUps.map(b => {
        const na = CHARACTERS.find(c => c.id === b.a)?.name || b.a;
        const nb = CHARACTERS.find(c => c.id === b.b)?.name || b.b;
        return `${na}×${nb} Lv.${b.level}`;
      }).join(', ');
      text.innerHTML += `<div class="result-bonds">💕 유대 상승: ${bondNames}</div>`;
    }

    if (mvp && mvp.hp > 0) showCharQuote(mvp, 'win');

    const rewardCards = [];
    let ticketReward = 1;
    const randomChar = () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    if (towerMode) {
      const tRewards = getTowerRewards(towerWave);
      tRewards.cards.forEach(r => rewardCards.push({ char: randomChar(), rarity: r }));
      ticketReward = tRewards.tickets;
      if (tRewards.milestone) {
        text.innerHTML += `<div class="tower-milestone">🏅 ${tRewards.milestone}층 마일스톤 달성!</div>`;
      }
    } else if (battleState.hardMode) {
      rewardCards.push({ char: randomChar(), rarity: 'legendary' });
      rewardCards.push({ char: randomChar(), rarity: 'rare' });
      rewardCards.push({ char: randomChar(), rarity: 'rare' });
      ticketReward = 3;
    } else {
      const act = STORY_ACTS.find(a => a.stages.includes(battleState.stageId));
      const actNum = act ? act.act : 1;
      if (stars === 3) {
        rewardCards.push({ char: randomChar(), rarity: actNum >= 3 ? 'legendary' : 'rare' });
        rewardCards.push({ char: randomChar(), rarity: 'rare' });
        rewardCards.push({ char: randomChar(), rarity: 'uncommon' });
        ticketReward = actNum + 1;
        if (!gameSave.inventory) gameSave.inventory = [];
        const bonusItems = actNum >= 3 ? ['crtBuff', 'atkBuff'] : actNum >= 2 ? ['atkBuff'] : [];
        bonusItems.forEach(type => {
          gameSave.inventory.push({ type, name: { atkBuff: '공격버프', defBuff: '방어버프', crtBuff: '치명버프' }[type] });
        });
      } else if (stars === 2) {
        rewardCards.push({ char: randomChar(), rarity: actNum >= 2 ? 'rare' : 'uncommon' });
        rewardCards.push({ char: randomChar(), rarity: 'common' });
        ticketReward = actNum;
      } else {
        rewardCards.push({ char: randomChar(), rarity: 'common' });
      }
    }
    const rewardHtml = rewardCards.map(r => {
      addCard(gameSave, r.char.id, r.rarity);
      const rarityKoShort = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
      return `<span class="reward-card reward-${r.rarity}">${r.char.name} (${rarityKoShort[r.rarity]})</span>`;
    }).join('');
    gameSave.recruitTickets = (gameSave.recruitTickets || 0) + ticketReward;
    text.innerHTML += `<div class="result-rewards"><div class="reward-title">🎁 보상 카드</div>${rewardHtml}<span class="reward-card reward-uncommon">🎫 모집권 ×${ticketReward}</span></div>`;

    if (battleState._battleLoot && battleState._battleLoot.length > 0) {
      const itemIcon = { heal: '🧪', mp: '💧', atkBuff: '⚔️', defBuff: '🛡️', crtBuff: '🎯', xp: '💎' };
      const lootHtml = battleState._battleLoot.map(l => {
        const icon = itemIcon[Object.keys(l.effect)[0]] || '📦';
        return `<span class="reward-card reward-uncommon">${icon} ${l.name}</span>`;
      }).join('');
      text.innerHTML += `<div class="result-rewards"><div class="reward-title">📦 획득 아이템</div>${lootHtml}</div>`;
    }

    if (battleQuestCompleted.length > 0) {
      const qHtml = battleQuestCompleted.map(q =>
        `<div class="result-quest-item">🎯 <strong>${q.name}</strong></div>`
      ).join('');
      text.innerHTML += `<div class="result-rewards"><div class="reward-title">📋 달성 퀘스트</div>${qHtml}</div>`;
    }

    if (battleState.factionSynergies && battleState.factionSynergies.length > 0) {
      const fsHtml = battleState.factionSynergies.map(s => `<span class="reward-card reward-uncommon">${s}</span>`).join('');
      text.innerHTML += `<div class="result-rewards"><div class="reward-title">🤝 팩션 시너지</div>${fsHtml}</div>`;
    }

    if (battleState.stageId === 'stage-4') trackQuest('clear_stage4');
  } else {
    title.textContent = towerMode ? `무한의 탑 — ${towerWave}층에서 패배` : '패배...';
    box.className = 'battle-result-box lose';
    const loseStory = towerMode
      ? `탑의 ${towerWave}층에서 쓰러졌습니다. 최고 기록: ${Math.max(gameSave.towerBest || 0, towerWave - 1)}층`
      : '모든 아군이 전사했습니다. 다시 도전하세요.';
    text.innerHTML = `
      <div class="result-story">${loseStory}</div>
      <div class="result-summary">${battleState.turnNumber}턴 · 처치 ${enemiesDefeated}</div>
    `;
    gameSave.stats.losses++;
    sfxLose();
    if (towerMode) {
      const cleared = towerWave - 1;
      if (cleared > (gameSave.towerBest || 0)) gameSave.towerBest = cleared;
    }
  }

  const newAchievements = checkAchievements(gameSave);
  if (newAchievements.length > 0) {
    const rarityKoShort = { common: '커먼', uncommon: '언커먼', rare: '레어', legendary: '전설' };
    newAchievements.forEach(a => {
      a.reward.forEach(rarity => {
        const rc = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        addCard(gameSave, rc.id, rarity);
      });
    });
    const achHtml = newAchievements.map(a =>
      `<div class="achievement-unlock">🏆 <strong>${a.name}</strong> — ${a.desc}<br>
       <span class="achievement-reward">${a.reward.map(r => rarityKoShort[r]).join(', ')} 카드 획득!</span></div>`
    ).join('');
    text.innerHTML += `<div class="result-achievements">${achHtml}</div>`;
  }

  saveGame(gameSave);
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));

  const retryBtn = document.getElementById('btn-result-retry');
  const quickRetryBtn = document.getElementById('btn-result-quick-retry');
  const nextWaveBtn = document.getElementById('btn-result-next-wave');
  retryBtn.style.display = result === 'lose' && !towerMode ? '' : 'none';
  quickRetryBtn.style.display = result === 'lose' && !towerMode && gameSave.lastTeam?.length > 0 ? '' : 'none';
  if (nextWaveBtn) nextWaveBtn.style.display = result === 'win' && towerMode ? '' : 'none';

  const exitTower = () => {
    towerMode = false;
    towerWave = 0;
    const towIdx = STAGES.findIndex(s => s.id && s.id.startsWith('tower-'));
    if (towIdx >= 0) STAGES.splice(towIdx, 1);
  };

  const closeOverlay = () => { overlay.classList.remove('active'); overlay.style.display = 'none'; };
  document.getElementById('btn-result-ok').onclick = () => {
    closeOverlay();
    if (towerMode) exitTower();
    battleState = null;
    document.getElementById('battle-screen').style.display = 'none';
    document.getElementById('stage-select').style.display = '';
    cancelSelection();
    renderStats();
    renderStageSelect();
  };
  retryBtn.onclick = () => {
    closeOverlay();
    const stageId = battleState.stageId;
    const wasHard = battleState.hardMode;
    battleState = null;
    document.getElementById('battle-screen').style.display = 'none';
    cancelSelection();
    openDeploy(stageId, wasHard);
  };
  quickRetryBtn.onclick = () => {
    closeOverlay();
    const stageId = battleState.stageId;
    const wasHard = battleState.hardMode;
    battleState = null;
    document.getElementById('battle-screen').style.display = 'none';
    cancelSelection();
    currentStageId = stageId;
    currentHardMode = wasHard;
    deploySelected = [...(gameSave.lastTeam || [])];
    startBattle();
  };
  if (nextWaveBtn) {
    nextWaveBtn.onclick = () => {
      closeOverlay();
      battleState = null;
      startTowerWave();
    };
  }

  const logBtn = document.getElementById('btn-result-log');
  const logViewer = document.getElementById('result-log-viewer');
  if (logBtn && logViewer) {
    logBtn.onclick = () => {
      if (logViewer.style.display === 'none') {
        document.getElementById('result-log-content').innerHTML =
          battleLogHistory.map(msg => `<div class="log-entry">${msg}</div>`).join('');
        logViewer.style.display = '';
        logBtn.textContent = '📋 기록 닫기';
      } else {
        logViewer.style.display = 'none';
        logBtn.textContent = '📋 전과 기록';
      }
    };
  }
}

// ── Battle Log ──

function appendLogSeparator(text) {
  const log = document.getElementById('battle-log');
  const sep = document.createElement('div');
  sep.className = 'log-separator';
  sep.textContent = text;
  log.appendChild(sep);
  log.scrollTop = log.scrollHeight;
}

let logFilterMode = 'all';

function appendLog(msg) {
  const log = document.getElementById('battle-log');
  const entry = document.createElement('div');
  let cls = 'log-entry';
  let category = 'other';
  if (msg.includes('💀') || msg.includes('전사')) { cls += ' log-kill'; category = 'kill'; }
  else if (msg.includes('⚔') || msg.includes('데미지') || msg.includes('반격') || msg.includes('📊')) { cls += ' log-damage'; category = 'damage'; }
  else if (msg.includes('회복') || (msg.includes('+') && msg.includes('HP'))) { cls += ' log-heal'; category = 'heal'; }
  else if (msg.includes('✦') || msg.includes('스킬') || msg.includes('궁극기') || msg.includes('🌟')) { cls += ' log-skill'; category = 'skill'; }
  else if (msg.includes('⬆') || msg.includes('Lv.')) cls += ' log-levelup';
  else if (msg.includes('🎁') || msg.includes('드롭')) cls += ' log-loot';
  entry.className = cls;
  entry.dataset.cat = category;
  entry.textContent = msg;
  if (logFilterMode !== 'all' && category !== logFilterMode) entry.style.display = 'none';
  log.appendChild(entry);
  while (log.children.length > 150) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
  battleLogHistory.push(msg);
}

function setLogFilter(mode) {
  logFilterMode = mode;
  const log = document.getElementById('battle-log');
  if (!log) return;
  Array.from(log.children).forEach(el => {
    if (el.classList.contains('log-separator')) { el.style.display = ''; return; }
    if (mode === 'all') { el.style.display = ''; return; }
    el.style.display = el.dataset.cat === mode ? '' : 'none';
  });
}

// ── Quest Toast ──

let battleQuestCompleted = [];

function trackQuest(type, amount) {
  const completed = progressQuest(gameSave, type, amount);
  if (completed && completed.length > 0) {
    completed.forEach(q => {
      appendLog(`🎯 퀘스트 달성: ${q.name}`);
      battleQuestCompleted.push(q);
      showQuestToast(q.name);
    });
  }
}

function showQuestToast(name) {
  const toast = document.createElement('div');
  toast.className = 'quest-toast';
  toast.innerHTML = `🎯 <strong>${name}</strong> 달성!`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('active'));
  setTimeout(() => { toast.classList.remove('active'); setTimeout(() => toast.remove(), 300); }, 2500 / battleSpeed);
}

// ── Stats & Quests Rendering ──

function renderHome() {
  const el = document.getElementById('home-dashboard');
  if (!el) return;
  const s = gameSave.stats;
  const quests = getQuestSummary(gameSave);
  const centerBuff = getCenterBuff(gameSave);
  const ownedCount = CHARACTERS.filter(c => gameSave.cards[c.id]?.count > 0).length;
  const ownedChars = CHARACTERS.filter(c => gameSave.cards[c.id]?.count > 0);
  const synthable = CHARACTERS.filter(c => {
    const d = gameSave.cards[c.id];
    return d && d.count >= getSynthesisCost(d.level);
  }).length;
  const dailyDone = (quests.daily || []).filter(q => q.completed).length;
  const dailyTotal = (quests.daily || []).length;
  const weeklyDone = (quests.weekly || []).filter(q => q.completed).length;
  const weeklyTotal = (quests.weekly || []).length;
  const totalStages = STAGES.length;
  const clearedStages = STAGES.filter(st => gameSave.stageClears?.[st.id]).length;
  const nextStage = STAGES.find(st => !gameSave.stageClears?.[st.id]);
  const tickets = gameSave.recruitTickets || 0;

  const greeter = ownedChars.length > 0
    ? ownedChars[Math.floor(Math.random() * ownedChars.length)]
    : null;
  const greeterQuote = greeter && CHAR_QUOTES[greeter.id]
    ? CHAR_QUOTES[greeter.id].select : null;

  const currentAct = STORY_ACTS.find(a =>
    a.stages.some(sid => !gameSave.stageClears?.[sid])
  ) || STORY_ACTS[STORY_ACTS.length - 1];
  const actProgress = currentAct.stages.filter(sid => gameSave.stageClears?.[sid]).length;

  const storyMapHtml = STORY_ACTS.map(act => {
    const unlocked = !act.unlock || gameSave.stageClears?.[act.unlock];
    const cleared = act.stages.every(sid => gameSave.stageClears?.[sid]);
    const isCurrent = act === currentAct;
    const prog = act.stages.filter(sid => gameSave.stageClears?.[sid]).length;
    return `<div class="story-act-node ${unlocked ? (cleared ? 'act-cleared' : (isCurrent ? 'act-current' : 'act-unlocked')) : 'act-locked'}">
      <div class="act-marker">${unlocked ? (cleared ? '✦' : (isCurrent ? '◉' : '○')) : '🔒'}</div>
      <div class="act-label">${act.name}</div>
      <div class="act-prog">${unlocked ? `${prog}/${act.stages.length}` : '미해금'}</div>
    </div>`;
  }).join('<div class="act-connector"></div>');

  el.innerHTML = `
    <div class="home-atmosphere">
      <div class="blood-drip drip-1"></div>
      <div class="blood-drip drip-2"></div>
      <div class="blood-drip drip-3"></div>
    </div>
    <div class="home-hero">
      <div class="home-hero-glow"></div>
      <div class="home-hero-text">
        <h2>🩸 헌혈의 집</h2>
        <p class="home-subtitle">백십자재단 혈연센터 · 혈액관리국</p>
        <div class="home-center-badge">${centerBuff.label}</div>
      </div>
      ${greeter ? `<div class="home-greeter">
        <div class="greeter-portrait">
          <img src="${portraitSrc(greeter.portrait)}" alt="${greeter.name}"
               onerror="this.style.display='none'" />
        </div>
        <div class="greeter-bubble">
          <div class="greeter-name">${greeter.name}</div>
          <div class="greeter-quote">"${greeterQuote || '어서 오세요.'}"</div>
        </div>
      </div>` : ''}
    </div>

    <div class="story-map">
      <div class="story-map-title">📖 스토리 진행</div>
      <div class="story-act-track">${storyMapHtml}</div>
      ${nextStage ? `<div class="story-next">
        <span class="story-next-label">다음 임무:</span>
        <strong>${nextStage.name}</strong>
        <span class="story-next-lv">Lv.${nextStage.enemyLevel} · 적 ${nextStage.enemyUnits.length}명</span>
      </div>` : `<div class="story-next story-complete">🎉 모든 스토리 클리어!</div>`}
    </div>

    <div class="home-grid">
      <div class="home-card home-card-action" data-goto="play">
        <div class="home-card-title">⚔️ 전투</div>
        <div class="home-card-body">
          <div>스테이지 ${clearedStages}/${totalStages}</div>
          <div>승률 ${s.totalBattles ? Math.round(s.wins / s.totalBattles * 100) : 0}% (${s.wins}승)</div>
          <div>🗼 탑 최고 ${gameSave.towerBest || 0}층</div>
          ${nextStage ? `<div class="home-alert">▶ ${nextStage.name} 도전하기</div>` : ''}
        </div>
      </div>
      <div class="home-card">
        <div class="home-card-title">📋 퀘스트</div>
        <div class="home-card-body">
          <div>일일: ${dailyDone}/${dailyTotal} ${dailyDone === dailyTotal && dailyTotal > 0 ? '✅' : ''}</div>
          <div>주간: ${weeklyDone}/${weeklyTotal} ${weeklyDone === weeklyTotal && weeklyTotal > 0 ? '✅' : ''}</div>
          <div>출석: ${quests.attendance}일째</div>
        </div>
      </div>
      <div class="home-card home-card-action" data-goto="gallery">
        <div class="home-card-title">🃏 컬렉션</div>
        <div class="home-card-body">
          <div>보유 ${ownedCount}/${CHARACTERS.length}</div>
          ${synthable > 0 ? `<div class="home-alert">⚗️ 합성 가능 ${synthable}장</div>` : ''}
          ${tickets > 0 ? `<div class="home-alert">🎫 모집권 ${tickets}장</div>` : ''}
        </div>
      </div>
    </div>
  `;

  el.querySelectorAll('.home-card-action').forEach(card => {
    card.addEventListener('click', () => {
      const tab = card.dataset.goto;
      if (tab) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');
        document.getElementById(`tab-${tab}`)?.classList.add('active');
      }
    });
  });
}

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
      <div class="stat-item"><span>🗼 탑 최고</span><strong>${gameSave.towerBest || 0}층</strong></div>
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

  const achHtml = ACHIEVEMENTS.map(a => {
    const done = gameSave.achievements[a.id];
    return `<div class="quest-item ${done ? 'quest-done' : ''}">
      <span class="quest-name">${a.name}</span>
      <span class="quest-progress">${a.desc}</span>
      ${done ? '<span class="quest-check">🏆</span>' : ''}
    </div>`;
  }).join('');

  const itemIcon = { heal: '🧪', mp: '💧', atkBuff: '⚔️', defBuff: '🛡️', crtBuff: '🎯', xp: '💎' };
  const inv = gameSave.inventory || [];
  const invHtml = inv.length > 0
    ? inv.map(item => {
        const icon = itemIcon[Object.keys(item.effect)[0]] || '📦';
        return `<div class="quest-item"><span class="quest-name">${icon} ${item.name}</span></div>`;
      }).join('')
    : '<div class="quest-item"><span class="quest-name" style="opacity:0.5">아이템 없음</span></div>';

  const hardClears = gameSave.hardClears || {};
  const hardCount = Object.keys(hardClears).length;
  const hardHtml = hardCount > 0
    ? Object.entries(hardClears).map(([sid, data]) => {
        const stage = STAGES.find(st => st.id === sid);
        return `<div class="quest-item quest-done"><span class="quest-name">🔥 ${stage?.name || sid}</span><span class="quest-progress">${data.clears}회</span></div>`;
      }).join('')
    : '';

  const ownedChars = CHARACTERS.filter(c => gameSave.cards[c.id]?.count > 0);
  const rarityIcon = { legendary: '👑', rare: '💎', uncommon: '🔵', common: '⚪' };
  const charHtml = ownedChars.length > 0
    ? ownedChars.sort((a, b) => {
        const ro = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
        return (ro[a.rarity] ?? 9) - (ro[b.rarity] ?? 9);
      }).map(c => {
        const d = gameSave.cards[c.id];
        const cost = getSynthesisCost(d.level);
        return `<div class="char-stat-row">
          <span class="char-stat-name">${rarityIcon[c.rarity]} ${c.name}</span>
          <span class="char-stat-info">Lv.${d.level} · ×${d.count} · ${d.count >= cost ? '✅합성가능' : `${d.count}/${cost}`}</span>
        </div>`;
      }).join('')
    : '<div class="quest-item"><span class="quest-name" style="opacity:0.5">보유 카드 없음</span></div>';

  document.getElementById('stats-history').innerHTML = `
    <details class="stats-details" open>
      <summary>🃏 보유 캐릭터 (${ownedChars.length}/${CHARACTERS.length})</summary>
      <div class="char-stat-grid">${charHtml}</div>
    </details>
    <details class="stats-details">
      <summary>📦 인벤토리 (${inv.length})</summary>
      ${invHtml}
    </details>
    ${hardCount > 0 ? `<details class="stats-details"><summary>🔥 하드 클리어 (${hardCount})</summary>${hardHtml}</details>` : ''}
    <details class="stats-details" open>
      <summary>📋 퀘스트</summary>
      ${renderQuestList(quests.daily, '일일')}
      ${renderQuestList(quests.weekly, '주간')}
      ${quests.monthly ? renderQuestList([quests.monthly], '월간') : ''}
    </details>
    <details class="stats-details">
      <summary>🏆 업적 (${Object.keys(gameSave.achievements).length}/${ACHIEVEMENTS.length})</summary>
      ${achHtml}
    </details>
  `;
}

function renderSettings() {
  gameSave.settings = gameSave.settings || {};
  const s = gameSave.settings;

  const sfxBtn = document.getElementById('setting-sfx');
  const bgmBtn = document.getElementById('setting-bgm');
  const camBtn = document.getElementById('setting-camera');

  if (sfxBtn) {
    sfxBtn.textContent = isMuted() ? 'OFF' : 'ON';
    sfxBtn.classList.toggle('off', isMuted());
    sfxBtn.onclick = () => {
      toggleMute();
      sfxBtn.textContent = isMuted() ? 'OFF' : 'ON';
      sfxBtn.classList.toggle('off', isMuted());
      s.muted = isMuted();
      saveGame(gameSave);
    };
  }

  if (bgmBtn) {
    bgmBtn.textContent = s.bgmOff ? 'OFF' : 'ON';
    bgmBtn.classList.toggle('off', !!s.bgmOff);
    bgmBtn.onclick = () => {
      s.bgmOff = !s.bgmOff;
      bgmBtn.textContent = s.bgmOff ? 'OFF' : 'ON';
      bgmBtn.classList.toggle('off', s.bgmOff);
      saveGame(gameSave);
    };
  }

  if (camBtn) {
    const camOn = s.cameraTrack !== false;
    camBtn.textContent = camOn ? 'ON' : 'OFF';
    camBtn.classList.toggle('off', !camOn);
    camBtn.onclick = () => {
      s.cameraTrack = s.cameraTrack === false ? true : false;
      camBtn.textContent = s.cameraTrack !== false ? 'ON' : 'OFF';
      camBtn.classList.toggle('off', s.cameraTrack === false);
      saveGame(gameSave);
    };
  }

  document.querySelectorAll('.setting-speed').forEach(btn => {
    const spd = parseInt(btn.dataset.speed);
    btn.classList.toggle('active', spd === (s.battleSpeed || 1));
    btn.onclick = () => {
      s.battleSpeed = spd;
      battleSpeed = spd;
      document.querySelectorAll('.setting-speed').forEach(b => b.classList.toggle('active', parseInt(b.dataset.speed) === spd));
      saveGame(gameSave);
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', () => initAudio(), { once: true });

  gameSave.settings = gameSave.settings || {};
  battleSpeed = gameSave.settings.battleSpeed || 1;
  if (gameSave.settings.muted) toggleMute();

  initTabs();
  renderHome();
  initGallery();
  renderStageSelect();
  renderStats();
  renderSettings();
  initTycoonControls();

  document.querySelectorAll('.log-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.log-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLogFilter(btn.dataset.logf);
    });
  });

  const attend = getAttendanceReward(gameSave.quests.attendance);
  if (attend && gameSave.quests.lastAttendanceReward !== gameSave.quests.attendance) {
    gameSave.quests.lastAttendanceReward = gameSave.quests.attendance;
    const rewardedCards = [];
    attend.cards.forEach(rarity => {
      const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      addCard(gameSave, randomChar.id, rarity);
      rewardedCards.push({ name: randomChar.name, rarity });
    });
    if (attend.tickets) {
      gameSave.recruitTickets = (gameSave.recruitTickets || 0) + attend.tickets;
    }
    if (attend.items) {
      if (!gameSave.inventory) gameSave.inventory = [];
      attend.items.forEach(type => {
        gameSave.inventory.push({ type, name: { heal: '회복약', mp: 'MP포션', atkBuff: '공격버프', defBuff: '방어버프', crtBuff: '치명버프', xp: '경험치서' }[type] || type });
      });
    }
    saveGame(gameSave);
    showAttendancePopup(gameSave.quests.attendance, rewardedCards, attend);
  }

  function closeCardPopup() {
    const popup = document.getElementById('card-popup');
    popup.classList.remove('open');
    setTimeout(() => { popup.style.display = 'none'; }, 400);
  }
  document.getElementById('popup-close').addEventListener('click', closeCardPopup);
  document.getElementById('card-popup').addEventListener('click', (e) => {
    if (e.target.id === 'card-popup') closeCardPopup();
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
  document.getElementById('btn-speed').addEventListener('click', toggleBattleSpeed);
  document.getElementById('btn-auto')?.addEventListener('click', toggleAutoBattle);
  document.getElementById('btn-minimap-toggle')?.addEventListener('click', () => {
    document.getElementById('battle-minimap')?.classList.toggle('collapsed');
  });
  document.getElementById('ulp-close').addEventListener('click', () => {
    document.getElementById('unit-list-panel').style.display = 'none';
  });

  document.getElementById('btn-save-export').addEventListener('click', () => {
    const data = JSON.stringify(gameSave, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redledger-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-save-import').addEventListener('click', () => {
    document.getElementById('save-import-input').click();
  });
  document.getElementById('save-import-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.stats || !imported.cards) { alert('유효하지 않은 세이브 파일입니다.'); return; }
        if (!confirm('현재 진행을 덮어쓰시겠습니까?')) return;
        Object.assign(gameSave, imported);
        saveGame(gameSave);
        renderStats();
        renderStageSelect();
        initGallery();
        alert('세이브를 불러왔습니다!');
      } catch { alert('파일을 읽을 수 없습니다.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-save-reset').addEventListener('click', () => {
    if (!confirm('정말 초기화하시겠습니까? 모든 진행이 삭제됩니다.')) return;
    if (!confirm('되돌릴 수 없습니다. 계속하시겠습니까?')) return;
    localStorage.removeItem('redledger_save');
    location.reload();
  });

  const exportSave = () => {
    const data = JSON.stringify(gameSave, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `redledger-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importSave = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.stats || !imported.cards) { alert('유효하지 않은 세이브 파일입니다.'); return; }
        if (!confirm('현재 진행을 덮어쓰시겠습니까?')) return;
        Object.assign(gameSave, imported);
        saveGame(gameSave);
        renderStats();
        renderStageSelect();
        initGallery();
        renderSettings();
        alert('세이브를 불러왔습니다!');
      } catch { alert('파일을 읽을 수 없습니다.'); }
    };
    reader.readAsText(file);
  };

  document.getElementById('btn-settings-export')?.addEventListener('click', exportSave);
  document.getElementById('btn-settings-import')?.addEventListener('click', () => {
    document.getElementById('settings-import-input').click();
  });
  document.getElementById('settings-import-input')?.addEventListener('change', (e) => {
    if (e.target.files[0]) importSave(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-settings-reset')?.addEventListener('click', () => {
    if (!confirm('정말 초기화하시겠습니까? 모든 진행이 삭제됩니다.')) return;
    if (!confirm('되돌릴 수 없습니다. 계속하시겠습니까?')) return;
    localStorage.removeItem('redledger_save');
    location.reload();
  });
});
