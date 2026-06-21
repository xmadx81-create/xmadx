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
    this._genFloorTextures();
    this._genFacTextures();
    this.gridBg = this.add.graphics();
    this.facLayer = this.add.container(0, 0);
    this.nurseLayer = this.add.container(0, 0);
    this.donorLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this._drawFloorTabs();
    this._drawGrid();
  }

  _genFloorTextures() {
    const s = TILE;
    const floors = {
      '1F': { base: '#c8b898', grout: '#a89070', hi: 'rgba(255,255,255,0.12)', lo: 'rgba(0,0,0,0.05)' },
      '2F': { base: '#a0b8c8', grout: '#7898a8', hi: 'rgba(255,255,255,0.10)', lo: 'rgba(0,0,0,0.06)' },
      'B1': { base: '#787088', grout: '#605870', hi: 'rgba(255,255,255,0.08)', lo: 'rgba(0,0,0,0.08)' },
    };
    for (const [fk, cl] of Object.entries(floors)) {
      const key = 'gentile_' + fk;
      if (this.textures.exists(key)) continue;
      const ct = this.textures.createCanvas(key, s, s);
      const cx = ct.getContext();
      cx.fillStyle = cl.base;
      cx.fillRect(0, 0, s, s);
      cx.fillStyle = cl.hi;
      cx.fillRect(2, 2, s / 2 - 2, s / 2 - 2);
      cx.fillRect(s / 2 + 1, s / 2 + 1, s / 2 - 3, s / 2 - 3);
      cx.fillStyle = cl.lo;
      cx.fillRect(s / 2 + 1, 2, s / 2 - 3, s / 2 - 2);
      cx.fillRect(2, s / 2 + 1, s / 2 - 2, s / 2 - 3);
      cx.strokeStyle = cl.grout;
      cx.lineWidth = 1;
      cx.strokeRect(0.5, 0.5, s - 1, s - 1);
      cx.beginPath();
      cx.moveTo(s / 2, 0); cx.lineTo(s / 2, s);
      cx.moveTo(0, s / 2); cx.lineTo(s, s / 2);
      cx.strokeStyle = cl.grout;
      cx.lineWidth = 0.5;
      cx.stroke();
      ct.refresh();
    }
  }

  _genFacTextures() {
    const T = TILE;
    const draw = {
      bed: (c, w, h) => {
        c.fillStyle = '#f8e8e8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#e0e8f0'; c.fillRect(4, 6, w * 0.55, h - 12);
        c.fillStyle = '#b8d0e0'; c.fillRect(6, 8, 14, h - 16);
        c.fillStyle = '#d0d8e0'; c.fillRect(22, 10, w * 0.3, h - 20);
        c.fillStyle = '#cc2222'; c.fillRect(w - 16, 3, 8, 12);
        c.fillStyle = '#dd3333'; c.fillRect(w - 15, 4, 6, 10);
        c.fillStyle = '#666'; c.fillRect(w - 12, 2, 2, h - 4);
        c.strokeStyle = '#cc2222'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(w - 11, 15); c.quadraticCurveTo(w - 11, h / 2, w * 0.55 + 4, h / 2); c.stroke();
        c.fillStyle = '#cc2222'; c.beginPath(); c.arc(w - 12, h - 8, 3, 0, Math.PI * 2); c.fill();
      },
      reception: (c, w, h) => {
        c.fillStyle = '#e8eff8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#8b7355'; c.fillRect(6, h * 0.5, w - 12, h * 0.4);
        c.fillStyle = '#a08060'; c.fillRect(6, h * 0.5, w - 12, 4);
        c.fillStyle = '#334455'; c.fillRect(w * 0.3, 8, w * 0.35, h * 0.35);
        c.fillStyle = '#4488bb'; c.fillRect(w * 0.32, 10, w * 0.31, h * 0.28);
        c.fillStyle = '#ddd'; c.fillRect(w * 0.25, h * 0.5 + 8, w * 0.2, 3);
        c.fillStyle = '#ccc'; c.fillRect(w * 0.5, h * 0.5 + 8, w * 0.2, 3);
        c.fillStyle = '#f0e0c0'; c.fillRect(10, h * 0.55, 12, 16);
        c.strokeStyle = '#888'; c.lineWidth = 0.5;
        c.strokeRect(10, h * 0.55, 12, 16);
      },
      waiting_room: (c, w, h) => {
        c.fillStyle = '#f0ede8'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 3; i++) {
          const cx = 12 + i * 22, cy = 14;
          c.fillStyle = '#4488aa'; c.fillRect(cx, cy, 16, 14);
          c.fillStyle = '#3377aa'; c.fillRect(cx, cy, 16, 4);
          c.fillStyle = '#336699'; c.fillRect(cx, cy, 3, 14);
        }
        for (let i = 0; i < 3; i++) {
          const cx = 12 + i * 22, cy = h - 28;
          c.fillStyle = '#4488aa'; c.fillRect(cx, cy, 16, 14);
          c.fillStyle = '#3377aa'; c.fillRect(cx, cy, 16, 4);
          c.fillStyle = '#336699'; c.fillRect(cx, cy, 3, 14);
        }
      },
      lounge: (c, w, h) => {
        c.fillStyle = '#f5f0e8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#cc8844'; c.fillRect(w * 0.3, h * 0.35, w * 0.4, h * 0.3);
        c.fillStyle = '#dd9955'; c.fillRect(w * 0.32, h * 0.37, w * 0.36, h * 0.26);
        c.fillStyle = '#5a8a5a';
        c.beginPath(); c.moveTo(8, h * 0.7); c.lineTo(w * 0.4, h * 0.7); c.lineTo(w * 0.4, h * 0.3);
        c.lineTo(8, h * 0.3); c.closePath(); c.fill();
        c.fillStyle = '#4a7a4a'; c.fillRect(8, h * 0.3, 6, h * 0.4);
        c.fillStyle = '#6a9a6a'; c.fillRect(10, h * 0.35, w * 0.25, h * 0.15);
        c.fillStyle = '#8B4513'; c.fillRect(w * 0.65, h * 0.1, 4, 10);
        c.fillStyle = '#228B22'; c.beginPath(); c.arc(w * 0.67, h * 0.08, 6, 0, Math.PI * 2); c.fill();
      },
      lab: (c, w, h) => {
        c.fillStyle = '#eef2f8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#bbb'; c.fillRect(8, h * 0.55, w - 16, h * 0.35);
        c.fillStyle = '#ccc'; c.fillRect(8, h * 0.55, w - 16, 3);
        c.fillStyle = '#333'; c.fillRect(14, h * 0.2, 8, h * 0.35);
        c.fillStyle = '#555'; c.fillRect(10, h * 0.15, 16, 6);
        c.fillStyle = '#777'; c.fillRect(16, h * 0.42, 12, h * 0.13);
        const tubes = ['#dd3333', '#33aa33', '#3355cc', '#ddaa22'];
        tubes.forEach((cl, i) => {
          c.fillStyle = cl; c.globalAlpha = 0.7;
          c.fillRect(w * 0.5 + i * 8, h * 0.25, 5, h * 0.3);
          c.globalAlpha = 1;
          c.fillStyle = '#999'; c.fillRect(w * 0.5 + i * 8, h * 0.22, 5, 4);
        });
      },
      storage: (c, w, h) => {
        c.fillStyle = '#dde8f0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#c0c8d0'; c.fillRect(4, 3, w - 8, h - 6);
        c.fillStyle = '#b0b8c0'; c.fillRect(4, 3, w - 8, 3);
        c.strokeStyle = '#9098a0'; c.lineWidth = 1;
        c.strokeRect(6, h * 0.15, w * 0.42, h * 0.35);
        c.strokeRect(w * 0.52, h * 0.15, w * 0.42, h * 0.35);
        c.strokeRect(6, h * 0.55, w * 0.42, h * 0.35);
        c.strokeRect(w * 0.52, h * 0.55, w * 0.42, h * 0.35);
        c.fillStyle = '#88ccee'; c.globalAlpha = 0.3;
        c.fillRect(7, h * 0.16, w * 0.41, h * 0.33);
        c.fillRect(w * 0.53, h * 0.16, w * 0.41, h * 0.33);
        c.globalAlpha = 1;
        c.fillStyle = '#aaa'; c.fillRect(w * 0.46, h * 0.25, 3, 8);
        c.fillRect(w * 0.46, h * 0.65, 3, 8);
      },
      corridor: (c, w, h) => {
        c.fillStyle = '#d8d0c0'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#bbb0a0'; c.lineWidth = 0.5;
        c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(w / 2, 2); c.lineTo(w / 2, h - 2); c.stroke();
        c.beginPath(); c.moveTo(2, h / 2); c.lineTo(w - 2, h / 2); c.stroke();
        c.setLineDash([]);
      },
      stairs: (c, w, h) => {
        c.fillStyle = '#c8c0b8'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 5; i++) {
          const sh = h / 5;
          c.fillStyle = i % 2 === 0 ? '#b0a898' : '#c0b8a8';
          c.fillRect(4 + i * 3, 2 + i * sh, w - 8 - i * 3, sh);
          c.fillStyle = '#908880'; c.fillRect(4 + i * 3, 2 + i * sh, w - 8 - i * 3, 2);
        }
      },
      emergency: (c, w, h) => {
        c.fillStyle = '#fff0e0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#e8e0d8'; c.fillRect(4, 6, w * 0.5, h - 12);
        c.fillStyle = '#d0c8c0'; c.fillRect(6, 8, 12, h - 16);
        c.fillStyle = '#cc4400'; c.fillRect(w * 0.6, 4, 16, 16);
        c.fillStyle = '#fff'; c.fillRect(w * 0.6 + 6, 7, 4, 10);
        c.fillRect(w * 0.6 + 3, 10, 10, 4);
        c.fillStyle = '#22aa44';
        c.beginPath(); c.moveTo(w * 0.7, h * 0.5); c.lineTo(w * 0.85, h * 0.35); c.lineTo(w * 0.85, h * 0.65); c.closePath(); c.fill();
        c.strokeStyle = '#22aa44'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(w * 0.85, h * 0.5); c.lineTo(w - 6, h * 0.5); c.stroke();
      },
      restroom: (c, w, h) => {
        c.fillStyle = '#e8f0f0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ddd'; c.fillRect(w * 0.2, 4, w * 0.6, h * 0.45);
        c.fillStyle = '#eee'; c.fillRect(w * 0.25, 6, w * 0.5, h * 0.35);
        c.fillStyle = '#aaddee'; c.fillRect(w * 0.3, 8, w * 0.15, h * 0.25);
        c.fillStyle = '#bbb'; c.fillRect(w * 0.2, h * 0.55, w * 0.6, h * 0.35);
        c.fillStyle = '#ccc'; c.fillRect(w * 0.25, h * 0.6, w * 0.5, h * 0.25);
      },
      booth: (c, w, h) => {
        c.fillStyle = '#fff5e0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ee5533';
        c.beginPath(); c.moveTo(w / 2, 2); c.lineTo(w - 4, h * 0.45); c.lineTo(4, h * 0.45); c.closePath(); c.fill();
        c.fillStyle = '#dd4422';
        c.beginPath(); c.moveTo(w / 2, 2); c.lineTo(w * 0.75, h * 0.45); c.lineTo(w / 2, h * 0.45); c.closePath(); c.fill();
        c.fillStyle = '#8B4513'; c.fillRect(w * 0.2, h * 0.45, w * 0.6, h * 0.45);
        c.fillStyle = '#a0522d'; c.fillRect(w * 0.2, h * 0.45, w * 0.6, 3);
      },
      elevator: (c, w, h) => {
        c.fillStyle = '#c0c0c8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#9098a0'; c.fillRect(4, 4, w - 8, h - 8);
        c.fillStyle = '#a0a8b0'; c.fillRect(4, 4, (w - 8) / 2 - 1, h - 8);
        c.fillStyle = '#a8b0b8'; c.fillRect(w / 2 + 1, 4, (w - 8) / 2 - 1, h - 8);
        c.strokeStyle = '#888'; c.lineWidth = 1; c.strokeRect(4, 4, w - 8, h - 8);
        c.fillStyle = '#dd8800';
        c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w / 2 + 5, 14); c.lineTo(w / 2 - 5, 14); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(w / 2, h - 8); c.lineTo(w / 2 + 5, h - 14); c.lineTo(w / 2 - 5, h - 14); c.closePath(); c.fill();
      },
      office: (c, w, h) => {
        c.fillStyle = '#f0ece0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#8b7355'; c.fillRect(8, h * 0.4, w - 16, h * 0.45);
        c.fillStyle = '#a08060'; c.fillRect(8, h * 0.4, w - 16, 3);
        c.fillStyle = '#334'; c.fillRect(w * 0.35, 4, w * 0.25, h * 0.3);
        c.fillStyle = '#4488bb'; c.fillRect(w * 0.37, 6, w * 0.21, h * 0.24);
        c.fillStyle = '#f0e0c0'; c.fillRect(12, h * 0.48, 10, 14);
        c.fillStyle = '#eee0d0'; c.fillRect(24, h * 0.5, 8, 10);
      },
      parking: (c, w, h) => {
        c.fillStyle = '#555'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#fff'; c.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          c.strokeRect(8 + i * (w / 4 - 2), 8, w / 4 - 6, h * 0.4);
          c.strokeRect(8 + i * (w / 4 - 2), h * 0.55, w / 4 - 6, h * 0.4);
        }
        c.fillStyle = '#fff'; c.font = 'bold 14px monospace'; c.textAlign = 'center';
        c.fillText('P', w / 2, h / 2 + 5);
      },
      cold_storage: (c, w, h) => {
        c.fillStyle = '#d0e8f0'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#a0c0d0'; c.fillRect(4, 4, w - 8, h - 8);
        c.fillStyle = '#90b0c0'; c.fillRect(4, 4, w - 8, 4);
        for (let i = 0; i < 3; i++) {
          c.strokeStyle = '#80a0b0'; c.lineWidth = 1;
          c.strokeRect(8 + i * (w / 3 - 2), 12, w / 3 - 8, h - 24);
          c.fillStyle = 'rgba(150,220,255,0.2)'; c.fillRect(9 + i * (w / 3 - 2), 13, w / 3 - 10, h - 26);
        }
        c.fillStyle = '#4499cc'; c.font = '12px Arial'; c.textAlign = 'center'; c.fillText('❄', w / 2, h / 2 + 4);
      },
    };
    const sizes = {
      bed: [2,1], reception: [2,2], waiting_room: [2,2], lounge: [2,2], lab: [2,2],
      storage: [2,1], corridor: [1,1], stairs: [1,1], emergency: [2,1], restroom: [1,1],
      booth: [1,1], elevator: [1,1], office: [2,1], parking: [3,3], cold_storage: [3,2],
    };
    for (const [id, fn] of Object.entries(draw)) {
      const key = 'fac_' + id;
      if (this.textures.exists(key)) continue;
      const [tw, th] = sizes[id] || [1, 1];
      const w = T * tw - 2;
      const h = T * th - 2;
      const ct = this.textures.createCanvas(key, w, h);
      const cx = ct.getContext();
      fn(cx, w, h);
      cx.strokeStyle = 'rgba(0,0,0,0.15)';
      cx.lineWidth = 1;
      cx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ct.refresh();
    }
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
    const gridX = PAD;
    const gridY = PAD + 28;
    const gridW = TILE * GRID;
    const gridH = TILE * GRID;
    const tileKey = 'gentile_' + this._floor;
    if (this.textures.exists(tileKey)) {
      this.bgSprite = this.add.tileSprite(gridX + gridW / 2, gridY + gridH / 2, gridW, gridH, tileKey);
      this.bgSprite.setDepth(-1);
    } else {
      this.gridBg.fillStyle(0x3a3028, 1);
      this.gridBg.fillRect(gridX, gridY, gridW, gridH);
    }
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const x = this._tileX(c);
        const y = this._tileY(r);
        this.gridBg.lineStyle(1, 0x000000, 0.12);
        this.gridBg.strokeRect(x, y, TILE - 1, TILE - 1);
      }
    }
  }

  _fullRedraw() {
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
    if (this._zoomedFac) {
      this._drawInterior();
      return;
    }
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
    const container = this.add.container(0, 0);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(x + 2, y + 2, w, h, 3);
    container.add(shadow);

    const texKey = 'fac_' + fac.id;
    let body;
    if (this.textures.exists(texKey)) {
      body = this.add.image(x + w / 2, y + h / 2, texKey);
      body.setDisplaySize(w, h);
    } else {
      body = this.add.graphics();
      const color = FAC_COLORS[fac.id] || 0x888888;
      body.fillStyle(color, 0.9);
      body.fillRoundedRect(x, y, w, h, 3);
      const icon = this.add.text(x + w / 2, y + h / 2, fac.icon, {
        fontSize: Math.min(tw, th) >= 2 ? '28px' : '20px', fontFamily: 'Arial',
      }).setOrigin(0.5);
      container.add(icon);
    }
    container.add(body);

    const border = this.add.graphics();
    border.lineStyle(1, 0xffffff, 0.2);
    border.strokeRoundedRect(x, y, w, h, 3);
    container.add(border);

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

    const hitArea = this.add.graphics();
    hitArea.fillStyle(0xffffff, 0.001);
    hitArea.fillRect(x, y, w, h);
    hitArea.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
    hitArea.on('pointerdown', () => {
      if (this._callbacks.onFacilityClick) this._callbacks.onFacilityClick(row, col);
    });
    container.add(hitArea);

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

  zoomInto(fac) {
    this._zoomedFac = fac;
    this._zoomObjs = [];
    this.facLayer.setVisible(false);
    this.nurseLayer.setVisible(false);
    this.donorLayer.setVisible(false);
    this.uiLayer.setVisible(false);
    if (this.bgSprite) this.bgSprite.setVisible(false);
    this.gridBg.setVisible(false);
    if (this._hintGraphics) this._hintGraphics.setVisible(false);
    this._drawInterior();
  }

  zoomOut() {
    this._zoomObjs.forEach(o => o.destroy());
    this._zoomObjs = [];
    this._zoomedFac = null;
    this.facLayer.setVisible(true);
    this.nurseLayer.setVisible(true);
    this.donorLayer.setVisible(true);
    this.uiLayer.setVisible(true);
    if (this.bgSprite) this.bgSprite.setVisible(true);
    this.gridBg.setVisible(true);
    if (this._hintGraphics) this._hintGraphics.setVisible(true);
  }

  _drawInterior() {
    const fac = this._zoomedFac;
    if (!fac) return;
    this._zoomObjs.forEach(o => o.destroy());
    this._zoomObjs = [];
    if (fac.id === 'bed') { this._drawBedInterior(fac); return; }
    this._drawGenericInterior(fac);
  }

  _zo(obj) { this._zoomObjs.push(obj); return obj; }

  _drawBedInterior(fac) {
    const CW = W;
    const CH = H + 22;

    const bg = this.add.graphics();
    bg.fillStyle(0xf5f0e8, 1); bg.fillRect(0, 0, CW, CH);
    const floorG = this.add.graphics();
    for (let ty = 36; ty < CH; ty += 24) {
      for (let tx = 0; tx < CW; tx += 24) {
        const shade = ((tx / 24 + ty / 24) % 2 === 0) ? 0xede5d8 : 0xe5ddd0;
        floorG.fillStyle(shade, 1); floorG.fillRect(tx, ty, 24, 24);
        floorG.lineStyle(0.5, 0xd0c8b8, 0.4); floorG.strokeRect(tx, ty, 24, 24);
      }
    }
    this._zo(bg); this._zo(floorG);

    const wallG = this.add.graphics();
    wallG.fillStyle(0xe8e0d0, 1); wallG.fillRect(0, 36, CW, 14);
    wallG.lineStyle(2, 0xc0b8a0, 1); wallG.lineBetween(0, 50, CW, 50);
    wallG.lineStyle(1, 0xd8d0c0, 0.6); wallG.lineBetween(0, 36, CW, 36);
    this._zo(wallG);

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x8b1a1a, 1); headerBg.fillRect(0, 0, CW, 36);
    headerBg.fillStyle(0xa02020, 1); headerBg.fillRect(0, 0, CW, 18);
    this._zo(headerBg);
    this._zo(this.add.text(CW / 2, 18, `🏥 채혈실 Lv.${fac.level}`, {
      fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5));
    const backBtn = this.add.text(6, 18, '◀ 나가기', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffd',
      backgroundColor: 'rgba(0,0,0,0.4)', padding: { x: 5, y: 3 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => { this.zoomOut(); if (this._callbacks.onZoomOut) this._callbacks.onZoomOut(); });
    this._zo(backBtn);

    const state = this._state;
    const bedFac = fac;
    const donor = state?.donors?.find(d => d.assignedFacility === bedFac.uid && (d.status === 'collecting' || d.status === 'seated'));

    const bedW = CW * 0.44;
    const bedH = 175;
    const bedY = 58;
    this._drawDetailBed(CW * 0.02, bedY, bedW, bedH, 'A', donor, bedFac);
    this._drawDetailBed(CW * 0.54, bedY, bedW, bedH, 'B', null, null);

    const corrY = bedY + bedH + 6;
    const corrG = this.add.graphics();
    corrG.fillStyle(0xc8c0b0, 1); corrG.fillRect(0, corrY, CW, 32);
    for (let i = 0; i < CW; i += 16) {
      const sh = i % 32 === 0 ? 0xc0b8a8 : 0xd0c8b8;
      corrG.fillStyle(sh, 1); corrG.fillRect(i, corrY, 16, 32);
    }
    corrG.lineStyle(2, 0xa09880, 1); corrG.lineBetween(0, corrY, CW, corrY);
    corrG.lineBetween(0, corrY + 32, CW, corrY + 32);
    corrG.lineStyle(1, 0xb0a890, 0.5);
    corrG.setLineDash && corrG.setLineDash([6, 4]);
    corrG.lineBetween(20, corrY + 16, CW - 20, corrY + 16);
    this._zo(corrG);

    const nurseHere = state?.nurses?.find(n => {
      const grid2 = state.floors[n.floor || '1F'];
      const cell = grid2?.[n.row]?.[n.col];
      return cell && cell.uid === fac.uid;
    });
    const nx = CW / 2, ny = corrY + 16;
    const nG = this.add.graphics();
    nG.fillStyle(0xffffff, 1); nG.fillCircle(nx, ny, 13);
    nG.lineStyle(2.5, 0xcc2222, 1); nG.strokeCircle(nx, ny, 13);
    nG.fillStyle(0xcc2222, 1); nG.fillRect(nx - 4, ny - 8, 8, 3); nG.fillRect(nx - 1.5, ny - 11, 3, 8);
    this._zo(nG);
    this._zo(this.add.text(nx, ny + 7, '👩‍⚕️', { fontSize: '10px' }).setOrigin(0.5));
    if (nurseHere) {
      const nb = this.add.graphics();
      nb.fillStyle(0x000000, 0.6); nb.fillRoundedRect(nx - 20, ny + 16, 40, 14, 4);
      this._zo(nb);
      this._zo(this.add.text(nx, ny + 23, nurseHere.charData.name, {
        fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffd',
      }).setOrigin(0.5));
    }

    const sY = corrY + 46;
    const collected = state?.totalDonors || 0;
    const bloodTotal = state ? Object.values(state.blood).reduce((s, v) => s + v, 0) : 0;
    const maxSto = state?.maxStorage || 25;
    const stoPct = maxSto > 0 ? bloodTotal / maxSto : 0;

    const sG = this.add.graphics();
    sG.fillStyle(0x1a1520, 0.92); sG.fillRoundedRect(6, sY, CW - 12, 52, 6);
    sG.lineStyle(1, 0x3a3050, 1); sG.strokeRoundedRect(6, sY, CW - 12, 52, 6);
    this._zo(sG);
    this._zo(this.add.text(14, sY + 6, '📊 채혈 현황', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f0c040',
    }));
    this._zo(this.add.text(14, sY + 22, `오늘: ${collected}건  보관: ${bloodTotal}/${maxSto}팩`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#ccc',
    }));
    const bG = this.add.graphics();
    bG.fillStyle(0x333333, 1); bG.fillRoundedRect(14, sY + 37, CW - 36, 8, 3);
    bG.fillStyle(stoPct > 0.8 ? 0xcc2222 : 0x22aa44, 1);
    bG.fillRoundedRect(14, sY + 37, (CW - 36) * stoPct, 8, 3);
    this._zo(bG);
    this._zo(this.add.text(CW - 18, sY + 41, `${Math.round(stoPct * 100)}%`, {
      fontSize: '7px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(1, 0.5));

    if (state) {
      const bTypes = ['A', 'B', 'O', 'AB'];
      const bClr = { A: 0xe74c3c, B: 0x3498db, O: 0x27ae60, AB: 0xf39c12 };
      const cY = sY + 60;
      const cG = this.add.graphics();
      cG.fillStyle(0x1a1520, 0.92); cG.fillRoundedRect(6, cY, CW - 12, 58, 6);
      cG.lineStyle(1, 0x3a3050, 1); cG.strokeRoundedRect(6, cY, CW - 12, 58, 6);
      this._zo(cG);
      this._zo(this.add.text(14, cY + 6, '🩸 혈액형별 재고', {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f0c040',
      }));
      const bW = (CW - 40) / 4;
      bTypes.forEach((bt, i) => {
        const bx = 16 + i * bW;
        const amt = state.blood[bt] || 0;
        const mH = 28;
        const bh = maxSto > 0 ? Math.max(2, (amt / maxSto) * mH) : 2;
        const bar = this.add.graphics();
        bar.fillStyle(0x333333, 1); bar.fillRoundedRect(bx, cY + 48 - mH, bW - 6, mH, 2);
        bar.fillStyle(bClr[bt], 0.85); bar.fillRoundedRect(bx, cY + 48 - bh, bW - 6, bh, 2);
        this._zo(bar);
        this._zo(this.add.text(bx + (bW - 6) / 2, cY + 52, `${bt}:${amt}`, {
          fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ddd',
        }).setOrigin(0.5, 0));
      });
    }
  }

  _drawDetailBed(bx, by, bw, bh, label, donor, bedFac) {
    const g = this.add.graphics();
    g.fillStyle(0xfcf8f2, 1); g.fillRoundedRect(bx, by, bw, bh, 8);
    g.lineStyle(2, 0xd0c0a8, 1); g.strokeRoundedRect(bx, by, bw, bh, 8);
    g.fillStyle(0xe8e0d0, 0.5); g.fillRoundedRect(bx, by, bw, 20, { tl: 8, tr: 8, bl: 0, br: 0 });
    this._zo(g);

    this._zo(this.add.text(bx + bw / 2, by + 10, `━ 침대 ${label} ━`, {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#8a7a6a',
    }).setOrigin(0.5));

    const mx = bx + 6, my = by + 26, mw = bw - 50, mh = 65;
    const mG = this.add.graphics();
    mG.fillStyle(0x888888, 1);
    mG.fillRect(mx - 2, my + mh, 4, 12); mG.fillRect(mx + mw - 2, my + mh, 4, 12);
    mG.fillRect(mx - 2, my - 2, 4, 6); mG.fillRect(mx + mw - 2, my - 2, 4, 6);
    mG.fillStyle(0xdce8f0, 1); mG.fillRoundedRect(mx, my, mw, mh, 4);
    mG.lineStyle(1, 0xb0c8d8, 1); mG.strokeRoundedRect(mx, my, mw, mh, 4);
    mG.fillStyle(0xc8dce8, 1); mG.fillRoundedRect(mx + 2, my + 6, 20, mh - 12, 8);
    mG.fillStyle(0xf0f4f8, 0.4); mG.fillRect(mx + 24, my + 2, mw - 26, mh / 2 - 2);
    this._zo(mG);

    if (donor) {
      const dG = this.add.graphics();
      dG.fillStyle(0xffd5b4, 1); dG.fillCircle(mx + 12, my + mh / 2 - 2, 9);
      dG.fillStyle(0x553322, 1);
      dG.fillCircle(mx + 9, my + mh / 2 - 5, 1.5); dG.fillCircle(mx + 15, my + mh / 2 - 5, 1.5);
      dG.fillStyle(0x5577aa, 1); dG.fillRoundedRect(mx + 22, my + mh / 2 - 12, mw - 30, 24, 3);
      dG.fillStyle(0x4466aa, 1); dG.fillRect(mx + 22, my + mh / 2 - 12, mw - 30, 5);
      dG.fillStyle(0xffd5b4, 1); dG.fillRect(mx + mw - 16, my + mh / 2 - 6, 10, 6);
      this._zo(dG);

      const bColor = { A: '#e74c3c', B: '#3498db', O: '#27ae60', AB: '#f39c12' }[donor.bloodType] || '#888';
      const dbg = this.add.graphics();
      dbg.fillStyle(parseInt(bColor.slice(1), 16), 0.15);
      dbg.fillRoundedRect(mx, my + mh + 4, mw, 16, 4);
      this._zo(dbg);
      this._zo(this.add.text(mx + mw / 2, my + mh + 12, `${donor.bloodType}형 · ${donor.isNamed ? '★ ' + (donor.name || '') : '헌혈자'}`, {
        fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: bColor,
      }).setOrigin(0.5));
    } else {
      this._zo(this.add.text(mx + mw / 2, my + mh / 2, '빈 침대', {
        fontSize: '11px', fontFamily: 'monospace', color: '#bbb',
      }).setOrigin(0.5));
    }

    const ex = bx + bw - 38, ey = by + 26;
    const eG = this.add.graphics();
    eG.fillStyle(0x999999, 1); eG.fillRect(ex + 12, ey - 4, 4, 85);
    eG.fillStyle(0x777777, 1); eG.fillRect(ex + 8, ey + 78, 12, 6);
    eG.fillStyle(0xcc2222, 1); eG.fillRoundedRect(ex, ey, 28, 32, 5);
    eG.fillStyle(0xe83838, 1); eG.fillRoundedRect(ex + 2, ey + 2, 24, 28, 4);
    eG.fillStyle(0xffffff, 0.15); eG.fillRect(ex + 3, ey + 3, 22, 10);
    this._zo(eG);
    this._zo(this.add.text(ex + 14, ey + 16, '🩸', { fontSize: '12px' }).setOrigin(0.5));

    if (donor) {
      const tG = this.add.graphics();
      tG.lineStyle(2.5, 0xcc2222, 0.8);
      tG.beginPath();
      tG.moveTo(ex + 14, ey + 32);
      tG.lineTo(ex + 14, ey + 50);
      tG.quadraticCurveTo(ex + 14, ey + 60, mx + mw - 6, my + mh / 2);
      tG.strokePath();
      const drip = this.add.circle(ex + 14, ey + 40, 2, 0xcc2222, 0.9);
      this._zo(tG); this._zo(drip);
      this.tweens.add({ targets: drip, y: ey + 55, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeIn' });
    }

    const pmx = bx + 6, pmy = by + bh - 50;
    const pmG = this.add.graphics();
    pmG.fillStyle(0x1a1a2a, 1); pmG.fillRoundedRect(pmx, pmy, bw * 0.55, 42, 4);
    pmG.lineStyle(1, 0x333355, 1); pmG.strokeRoundedRect(pmx, pmy, bw * 0.55, 42, 4);
    const pmLed = this.add.graphics();
    pmLed.fillStyle(donor ? 0x00cc00 : 0x333333, 1); pmLed.fillCircle(pmx + bw * 0.55 - 8, pmy + 6, 3);
    this._zo(pmG); this._zo(pmLed);
    if (donor) {
      const hr = 62 + Math.floor(Math.random() * 25);
      const bp1 = 105 + Math.floor(Math.random() * 25);
      const bp2 = 65 + Math.floor(Math.random() * 15);
      const spo2 = 96 + Math.floor(Math.random() * 4);
      this._zo(this.add.text(pmx + 4, pmy + 4, `♡ ${hr}`, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#44ff44',
      }));
      this._zo(this.add.text(pmx + 4, pmy + 17, `BP ${bp1}/${bp2}`, {
        fontSize: '8px', fontFamily: 'monospace', color: '#44ccff',
      }));
      this._zo(this.add.text(pmx + 4, pmy + 28, `SpO₂ ${spo2}%`, {
        fontSize: '8px', fontFamily: 'monospace', color: '#ffcc44',
      }));
    } else {
      this._zo(this.add.text(pmx + bw * 0.275, pmy + 21, '── OFF ──', {
        fontSize: '9px', fontFamily: 'monospace', color: '#444',
      }).setOrigin(0.5));
    }

    if (bedFac && bedFac.processTime > 0) {
      const pct = Math.min(1, (bedFac.progress || 0) / bedFac.processTime);
      const tY = by + bh - 16;
      const tG2 = this.add.graphics();
      tG2.fillStyle(0x333333, 1); tG2.fillRoundedRect(bx + 6, tY, bw - 12, 10, 4);
      const pColor = pct > 0.7 ? 0x22cc44 : pct > 0.3 ? 0xf0c040 : 0xcc2222;
      tG2.fillStyle(pColor, 1); tG2.fillRoundedRect(bx + 6, tY, (bw - 12) * pct, 10, 4);
      this._zo(tG2);
      this._zo(this.add.text(bx + bw / 2, tY + 5, donor ? `채혈 ${Math.round(pct * 100)}%` : '', {
        fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
        stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5));
    }
  }

  _drawGenericInterior(fac) {
    const CW = W;
    const CH = H + 22;
    const bg = this.add.graphics();
    bg.fillStyle(0xf0ebe4, 1);
    bg.fillRect(0, 0, CW, CH);
    this._zo(bg);

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x4a90d9, 1);
    headerBg.fillRect(0, 0, CW, 32);
    this._zo(headerBg);

    const title = this.add.text(CW / 2, 16, `${fac.icon} ${fac.name} Lv.${fac.level}`, {
      fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5);
    this._zo(title);

    const backBtn = this.add.text(8, 16, '← 돌아가기', {
      fontSize: '11px', fontFamily: 'monospace', color: '#ffd', backgroundColor: 'rgba(0,0,0,0.3)',
      padding: { x: 6, y: 3 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.zoomOut();
      if (this._callbacks.onZoomOut) this._callbacks.onZoomOut();
    });
    this._zo(backBtn);

    const desc = this.add.text(CW / 2, CH / 2, `${fac.icon}\n\n${fac.name} 내부 뷰\n(준비 중)`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#666', align: 'center',
    }).setOrigin(0.5);
    this._zo(desc);
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
          this.load.image('floor_tile', ASSET_BASE + 'backgrounds/floor_tile_sm.png');
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

  zoomInto(fac) {
    if (this.scene) this.scene.zoomInto(fac);
  }

  zoomOut() {
    if (this.scene) this.scene.zoomOut();
  }

  get isZoomed() {
    return this.scene && !!this.scene._zoomedFac;
  }

  destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
      this.scene = null;
    }
  }
}
