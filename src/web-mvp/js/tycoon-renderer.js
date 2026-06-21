import { FACILITY_TYPES, TYCOON_FLOORS, TYCOON_ROLES } from './engine.js';

const TILE = 40;
const GRID = 10;
const PAD = 4;
const W = TILE * GRID + PAD * 2;
const H = TILE * GRID + PAD * 2 + 28;

const FAC_COLORS = {
  reception:    0x4a90d9,
  bed:          0xc0392b,
  lab:          0x8e44ad,
  storage:      0x2980b9,
  lounge:       0x27ae60,
  emergency:    0xe67e22,
  booth:        0xf39c12,
  corridor:     0x95a5a6,
  stairs:       0x7f8c8d,
  elevator:     0x546e7a,
  waiting_room: 0x5dade2,
  office:       0x8d6e63,
  parking:      0x37474f,
  cold_storage: 0x00838f,
  restroom:     0x66bb6a,
};

const FLOOR_BG = {
  'B1': 0x1a1520,
  '1F': 0x1e1912,
  '2F': 0x151a1e,
};

const ROLE_COLORS = {
  support:        0xffffff,
  battle_support: 0xff69b4,
  tank:           0x4a90d9,
  melee_dps:      0xcd853f,
  ranged_dps:     0x9b59b6,
  evasive_dps:    0xf1c40f,
  breaker:        0x95a5a6,
  bruiser:        0xe67e22,
};

const ASSET_BASE = 'assets/';
const CHAR_MAP = {
  '서윤': 'char_seoyoon',
  '하나': 'char_hana',
  '민수': 'char_minsoo',
};

class TycoonScene extends Phaser.Scene {
  constructor() {
    super('TycoonScene');
    this.facSprites = {};
    this.nurseSprites = {};
    this.gridBg = null;
    this.floorTabBtns = [];
    this.donorDots = [];
    this._state = null;
    this._floor = '1F';
    this._selectedFac = null;
    this._callbacks = {};
  }

  init(data) {
    this._callbacks = data.callbacks || {};
  }

  create() {
    this.bgSprite = null;
    this.gridBg = this.add.graphics();
    this.facLayer = this.add.container(0, 0);
    this.nurseLayer = this.add.container(0, 0);
    this.donorLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this._drawFloorTabs();
    this._drawGrid();
  }

  _tileX(col) { return PAD + col * TILE; }
  _tileY(row) { return PAD + 28 + row * TILE; }

  _drawFloorTabs() {
    this.floorTabBtns.forEach(b => b.destroy());
    this.floorTabBtns = [];
    const unlocked = this._state?.unlockedFloors || ['1F'];
    const floorIcons = { 'B1': '🅿️', '1F': '🏥', '2F': '🔬' };
    TYCOON_FLOORS.forEach((f, i) => {
      const x = PAD + i * 52;
      const y = 3;
      const isActive = f === this._floor;
      const isLocked = !unlocked.includes(f);
      const bg = this.add.graphics();
      const alpha = isLocked ? 0.2 : 1;
      bg.fillStyle(isActive ? 0xe9c46a : 0x3a3228, alpha);
      bg.fillRoundedRect(x, y, 46, 20, 5);
      bg.lineStyle(isActive ? 2 : 1, isActive ? 0xffd700 : 0x5a5040, alpha);
      bg.strokeRoundedRect(x, y, 46, 20, 5);
      const color = isActive ? '#000' : (isLocked ? '#555' : '#ddd');
      const icon = floorIcons[f] || '';
      const label = this.add.text(x + 23, y + 10, (isLocked ? '🔒' : icon) + f, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color
      }).setOrigin(0.5);
      if (!isLocked) {
        bg.setInteractive(new Phaser.Geom.Rectangle(x, y, 46, 20), Phaser.Geom.Rectangle.Contains);
        bg.on('pointerdown', () => {
          this._floor = f;
          if (this._state) this._state.currentFloor = f;
          this._fullRedraw();
          if (this._callbacks.onFloorChange) this._callbacks.onFloorChange(f);
        });
      }
      this.uiLayer.add(bg);
      this.uiLayer.add(label);
      this.floorTabBtns.push(bg, label);
    });
  }

  _drawGrid() {
    this.gridBg.clear();
    if (this.bgSprite) { this.bgSprite.destroy(); this.bgSprite = null; }
    if (this._tileSprites) { this._tileSprites.forEach(s => s.destroy()); }
    this._tileSprites = [];
    const gridX = PAD - 2;
    const gridY = PAD + 26;
    const gridW = TILE * GRID + 4;
    const gridH = TILE * GRID + 4;
    const hasTile = this.textures && this.textures.exists('floor_tile');
    if (!hasTile) {
      const bgColor = FLOOR_BG[this._floor] || 0x1e1912;
      this.gridBg.fillStyle(bgColor, 1);
      this.gridBg.fillRoundedRect(gridX, gridY, gridW, gridH, 6);
    }
    const FLOOR_TINT = { 'B1': 0x8888aa, '2F': 0xaabbdd };
    const tint = FLOOR_TINT[this._floor];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = this._tileX(c);
        const y = this._tileY(r);
        if (hasTile) {
          const sp = this.add.image(x + (TILE - 1) / 2, y + (TILE - 1) / 2, 'floor_tile');
          sp.setDisplaySize(TILE - 1, TILE - 1);
          sp.setDepth(-1);
          if (tint) sp.setTint(tint);
          this._tileSprites.push(sp);
        } else {
          this.gridBg.fillStyle(0x000000, 0.04);
          this.gridBg.fillRect(x, y, TILE - 1, TILE - 1);
        }
        this.gridBg.lineStyle(1, 0x000000, 0.15);
        this.gridBg.strokeRect(x, y, TILE - 1, TILE - 1);
      }
    }
  }

  _fullRedraw() {
    if (this._tileSprites) { this._tileSprites.forEach(s => s.destroy()); this._tileSprites = []; }
    Object.values(this.facSprites).forEach(s => s.container?.destroy());
    this.facSprites = {};
    Object.values(this.nurseSprites).forEach(s => s.container?.destroy());
    this.nurseSprites = {};
    this.donorDots.forEach(d => d.destroy());
    this.donorDots = [];
    this.facLayer.removeAll();
    this.nurseLayer.removeAll();
    this.donorLayer.removeAll();
    this._drawFloorTabs();
    this._drawGrid();
    if (this._state) this.sync(this._state);
  }

  sync(state) {
    this._state = state;
    this._renderFacilities(state);
    this._renderNurses(state);
    this._renderDonors(state);
    this._renderPlacementHints(state);
  }

  setSelectedFacility(facId) {
    this._selectedFac = facId;
    if (this._state) this._renderPlacementHints(this._state);
  }

  _renderFacilities(state) {
    const grid = state.floors ? state.floors[this._floor] : state.grid;
    const existing = new Set();
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const cell = grid[r]?.[c];
        if (!cell || cell._ref) continue;
        const uid = cell.uid;
        existing.add(uid);
        if (this.facSprites[uid]) {
          this._updateFacSprite(this.facSprites[uid], cell);
          continue;
        }
        this._createFacSprite(cell, r, c);
      }
    }
    for (const uid of Object.keys(this.facSprites)) {
      if (!existing.has(uid)) {
        this.facSprites[uid].container.destroy();
        delete this.facSprites[uid];
      }
    }
  }

  _createFacSprite(fac, row, col) {
    const tw = fac.tw || 1;
    const th = fac.th || 1;
    const x = this._tileX(col);
    const y = this._tileY(row);
    const w = TILE * tw - 2;
    const h = TILE * th - 2;
    const color = FAC_COLORS[fac.id] || 0x888888;
    const container = this.add.container(0, 0);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(x + 2, y + 2, w, h, 5);
    container.add(shadow);

    const body = this.add.graphics();
    body.fillStyle(color, 0.9);
    body.fillRoundedRect(x, y, w, h, 5);
    container.add(body);

    const highlight = this.add.graphics();
    highlight.fillStyle(0xffffff, 0.12);
    highlight.fillRoundedRect(x + 1, y + 1, w - 2, h * 0.35, { tl: 4, tr: 4, bl: 0, br: 0 });
    container.add(highlight);

    const border = this.add.graphics();
    border.lineStyle(1.5, 0xffffff, 0.25);
    border.strokeRoundedRect(x, y, w, h, 5);
    container.add(border);

    const iconSize = Math.min(tw, th) >= 2 ? '20px' : '14px';
    const icon = this.add.text(x + w / 2, y + h / 2 - (th >= 2 ? 8 : 3), fac.icon, {
      fontSize: iconSize, fontFamily: 'Arial',
    }).setOrigin(0.5);
    container.add(icon);

    const nameText = this.add.text(x + w / 2, y + h / 2 + (th >= 2 ? 12 : 6), fac.name.slice(0, 3), {
      fontSize: th >= 2 ? '10px' : '8px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#fff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameText);

    const lvText = this.add.text(x + 3, y + 2, '★'.repeat(fac.level), {
      fontSize: '7px', color: '#fbbf24',
    });
    container.add(lvText);

    const progressBg = this.add.graphics();
    const progressFill = this.add.graphics();
    container.add(progressBg);
    container.add(progressFill);

    const glow = this.add.graphics();
    container.add(glow);

    body.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
    body.on('pointerdown', () => {
      if (this._callbacks.onFacilityClick) this._callbacks.onFacilityClick(row, col);
    });

    this.facLayer.add(container);
    this.facSprites[fac.uid] = { container, body, glow, progressBg, progressFill, lvText, fac, x, y, w, h };
    this._updateFacSprite(this.facSprites[fac.uid], fac);
  }

  _updateFacSprite(sprite, fac) {
    sprite.lvText.setText('★'.repeat(fac.level));
    sprite.glow.clear();
    sprite.progressBg.clear();
    sprite.progressFill.clear();
    if (fac.busy) {
      const { x, y, w, h } = sprite;
      sprite.glow.lineStyle(2, 0x4ade80, 0.6);
      sprite.glow.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 6);
      if (fac.processTime > 0) {
        const pct = Math.min(1, fac.progress / fac.processTime);
        const barY = y + h - 5;
        sprite.progressBg.fillStyle(0x000000, 0.4);
        sprite.progressBg.fillRoundedRect(x + 3, barY, w - 6, 4, 2);
        sprite.progressFill.fillStyle(0x4ade80, 0.9);
        sprite.progressFill.fillRoundedRect(x + 3, barY, (w - 6) * pct, 4, 2);
      }
    }
    sprite.fac = fac;
  }

  _renderNurses(state) {
    const floorNurses = state.nurses.filter(n => (n.floor || '1F') === this._floor);
    const existing = new Set();
    for (const nurse of floorNurses) {
      const id = nurse.charData.id;
      existing.add(id);
      const tx = this._tileX(nurse.col) + TILE / 2;
      const ty = this._tileY(nurse.row) + TILE / 2;
      if (this.nurseSprites[id]) {
        const ns = this.nurseSprites[id];
        if (ns._targetX !== tx || ns._targetY !== ty) {
          ns._targetX = tx;
          ns._targetY = ty;
          this.tweens.add({
            targets: ns.container,
            x: tx - ns._originX,
            y: ty - ns._originY,
            duration: 300,
            ease: 'Power2',
          });
        }
        this._updateNurseState(ns, nurse);
        continue;
      }
      this._createNurseSprite(nurse, tx, ty);
    }
    for (const id of Object.keys(this.nurseSprites)) {
      if (!existing.has(id)) {
        this.nurseSprites[id].container.destroy();
        delete this.nurseSprites[id];
      }
    }
  }

  _createNurseSprite(nurse, tx, ty) {
    const roleColor = ROLE_COLORS[nurse.charData.role] || 0xffffff;
    const container = this.add.container(0, 0);
    const charKey = CHAR_MAP[nurse.charData.name];
    const hasImage = charKey && this.textures && this.textures.exists(charKey);

    const shadow = this.add.circle(tx, ty + 4, 8, 0x000000, 0.3);
    shadow.setScale(1, 0.5);
    container.add(shadow);

    let body, head, animTargets;

    if (hasImage) {
      const ring = this.add.graphics();
      ring.fillStyle(roleColor, 0.25);
      ring.fillCircle(tx, ty - 3, 16);
      ring.lineStyle(2, roleColor, 0.9);
      ring.strokeCircle(tx, ty - 3, 16);
      container.add(ring);

      body = this.add.image(tx, ty - 3, charKey);
      body.setDisplaySize(28, 28);
      container.add(body);
      head = body;
      animTargets = [body];
    } else {
      body = this.add.circle(tx, ty - 2, 9, roleColor, 0.9);
      body.setStrokeStyle(1.5, 0x000000, 0.5);
      container.add(body);

      head = this.add.circle(tx, ty - 10, 6, roleColor, 0.95);
      head.setStrokeStyle(1, 0xffffff, 0.3);
      container.add(head);

      const role = TYCOON_ROLES[nurse.charData.role] || TYCOON_ROLES.support;
      const icon = this.add.text(tx, ty - 10, role.icon, {
        fontSize: '9px',
      }).setOrigin(0.5);
      container.add(icon);
      animTargets = [body, head, icon];
    }

    const nameLabel = this.add.text(tx, ty + 12, nurse.charData.name.slice(0, 2), {
      fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#e9c46a', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameLabel);

    this.nurseLayer.add(container);
    const ns = { container, body, head, shadow, nameLabel, _originX: tx, _originY: ty, _targetX: tx, _targetY: ty, _baseScaleX: body.scaleX, _baseScaleY: body.scaleY };
    this._updateNurseState(ns, nurse);
    this.nurseSprites[nurse.charData.id] = ns;

    this.tweens.add({
      targets: animTargets,
      y: '-=2',
      duration: 600 + Math.random() * 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _updateNurseState(ns, nurse) {
    const bsx = ns._baseScaleX || 1;
    const bsy = ns._baseScaleY || 1;
    if (nurse.task === 'working') {
      ns.body.setAlpha(1);
      if (!ns._pulseAnim) {
        ns._pulseAnim = this.tweens.add({
          targets: ns.body,
          scaleX: bsx * 1.2,
          scaleY: bsy * 1.2,
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      ns.body.setAlpha(nurse.task === 'moving' ? 0.8 : 0.9);
      if (ns._pulseAnim) {
        ns._pulseAnim.stop();
        ns._pulseAnim = null;
        ns.body.setScale(bsx, bsy);
      }
    }
  }

  _renderDonors(state) {
    this.donorDots.forEach(d => d.destroy());
    this.donorDots = [];
    if (this._floor !== '1F') return;
    const waiting = state.donors.filter(d => d.status === 'waiting');
    const maxShow = 16;
    const startX = PAD + 6;
    const y = PAD + 28 + TILE * GRID + 6;

    if (waiting.length === 0) return;

    const queueBg = this.add.graphics();
    queueBg.fillStyle(0x000000, 0.35);
    queueBg.fillRoundedRect(PAD - 2, y - 6, TILE * GRID + 4, 30, 6);
    this.donorLayer.add(queueBg);
    this.donorDots.push(queueBg);

    const queueLabel = this.add.text(startX, y + 3, '🩸', { fontSize: '14px' }).setOrigin(0, 0.5);
    this.donorLayer.add(queueLabel);
    this.donorDots.push(queueLabel);

    waiting.slice(0, maxShow).forEach((d, i) => {
      const dx = startX + 22 + i * 22;
      const btColor = { A: 0xe74c3c, B: 0x3498db, O: 0x27ae60, AB: 0xf39c12 }[d.bloodType] || 0x888888;
      const pct = d.patience / d.maxPatience;
      const dotColor = pct < 0.3 ? 0xff0000 : btColor;
      const dot = this.add.circle(dx + 6, y + 1, 7, dotColor, 0.85);
      dot.setStrokeStyle(1.5, 0xffffff, 0.3);
      this.donorLayer.add(dot);
      this.donorDots.push(dot);

      const btLabel = this.add.text(dx + 6, y + 1, d.bloodType, {
        fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold',
        color: '#fff', stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5);
      this.donorLayer.add(btLabel);
      this.donorDots.push(btLabel);

      if (d.isNamed || d.isVIP) {
        const crown = this.add.text(dx + 6, y - 8, d.isNamed ? '★' : '♛', {
          fontSize: '9px', color: '#ffd700',
        }).setOrigin(0.5);
        this.donorLayer.add(crown);
        this.donorDots.push(crown);
      }

      const barBg = this.add.graphics();
      barBg.fillStyle(0x000000, 0.4);
      barBg.fillRect(dx, y + 10, 12, 3);
      barBg.fillStyle(pct < 0.3 ? 0xff0000 : 0x4ade80, 0.8);
      barBg.fillRect(dx, y + 10, 12 * pct, 3);
      this.donorLayer.add(barBg);
      this.donorDots.push(barBg);
    });

    if (waiting.length > maxShow) {
      const more = this.add.text(startX + 22 + maxShow * 22, y + 1, `+${waiting.length - maxShow}`, {
        fontSize: '10px', color: '#e9c46a', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.donorLayer.add(more);
      this.donorDots.push(more);
    }
  }

  _renderPlacementHints(state) {
    if (this._hintGraphics) {
      this._hintGraphics.destroy();
      this._hintGraphics = null;
    }
    if (!this._selectedFac || !state) return;
    const fType = FACILITY_TYPES[this._selectedFac];
    if (!fType) return;
    if (fType.floors && !fType.floors.includes(this._floor)) return;
    const grid = state.floors ? state.floors[this._floor] : state.grid;
    const tw = fType.tw || 1;
    const th = fType.th || 1;
    const hints = this.add.graphics();

    for (let r = 0; r <= GRID - th; r++) {
      for (let c = 0; c <= GRID - tw; c++) {
        let canPlace = true;
        for (let dr = 0; dr < th && canPlace; dr++) {
          for (let dc = 0; dc < tw && canPlace; dc++) {
            if (grid[r + dr]?.[c + dc]) canPlace = false;
          }
        }
        if (canPlace) {
          const x = this._tileX(c);
          const y = this._tileY(r);
          hints.fillStyle(0x4ade80, 0.12);
          hints.fillRoundedRect(x, y, TILE * tw - 2, TILE * th - 2, 3);
          hints.lineStyle(1, 0x4ade80, 0.35);
          hints.strokeRoundedRect(x, y, TILE * tw - 2, TILE * th - 2, 3);

          const hitZone = this.add.zone(x, y, TILE * tw - 2, TILE * th - 2).setOrigin(0).setInteractive();
          hitZone.on('pointerdown', () => {
            if (this._callbacks.onTileClick) this._callbacks.onTileClick(r, c);
          });
          hints.addedZones = hints.addedZones || [];
          hints.addedZones.push(hitZone);
        }
      }
    }
    this._hintGraphics = hints;
    this._hintGraphics._zones = hints.addedZones;
    this._hintGraphics.destroy = () => {
      Phaser.GameObjects.Graphics.prototype.destroy.call(hints);
      (hints.addedZones || []).forEach(z => z.destroy());
    };
  }
}

export class TycoonRenderer {
  constructor(containerId, callbacks) {
    this.containerId = containerId;
    this.callbacks = callbacks || {};
    this.game = null;
    this.scene = null;
  }

  start(state) {
    if (this.game) this.destroy();
    const self = this;
    const config = {
      type: Phaser.AUTO,
      parent: this.containerId,
      width: W,
      height: H + 22,
      backgroundColor: '#14101e',
      transparent: false,
      scene: {
        preload: function () {
          this.load.image('bg_1F', ASSET_BASE + 'backgrounds/floor_1f.png');
          this.load.image('bg_2F', ASSET_BASE + 'backgrounds/floor_2f.png');
          this.load.image('bg_B1', ASSET_BASE + 'backgrounds/floor_b1.png');
          this.load.image('floor_tile', ASSET_BASE + 'backgrounds/floor_tile.png');
          this.load.image('char_seoyoon', ASSET_BASE + 'characters/seoyoon.png');
          this.load.image('char_hana', ASSET_BASE + 'characters/hana.png');
          this.load.image('char_minsoo', ASSET_BASE + 'characters/minsoo.png');
          this.load.image('char_doyoon', ASSET_BASE + 'characters/doyoon.png');
        },
        init: function (data) { TycoonScene.prototype.init.call(this, data); },
        create: function () {
          self.scene = this;
          Object.setPrototypeOf(this, TycoonScene.prototype);
          this.facSprites = {};
          this.nurseSprites = {};
          this.bgSprite = null;
          this.gridBg = null;
          this.floorTabBtns = [];
          this.donorDots = [];
          this._state = state;
          this._floor = state.currentFloor || '1F';
          this._selectedFac = null;
          this._callbacks = self.callbacks;
          TycoonScene.prototype.create.call(this);
          this.sync(state);
        },
        update: function () {},
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false,
      },
      render: { antialias: true },
      input: { activePointers: 1 },
    };
    this.game = new Phaser.Game(config);
  }

  sync(state) {
    if (this.scene) {
      this.scene.sync(state);
    }
  }

  setSelectedFacility(facId) {
    if (this.scene && this.scene._selectedFac !== facId) {
      this.scene.setSelectedFacility(facId);
    }
  }

  setFloor(floorId) {
    if (this.scene) {
      this.scene._floor = floorId;
      this.scene._fullRedraw();
    }
  }

  destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }
  }
}
