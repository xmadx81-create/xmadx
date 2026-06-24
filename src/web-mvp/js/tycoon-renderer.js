import { FACILITY_TYPES, TYCOON_FLOORS, TYCOON_ROLES } from './engine.js';

const TILE = 40;
const GRID = 10;
const PAD = 4;
const W = TILE * GRID + PAD * 2;
const H = TILE * GRID + PAD * 2 + 28;
const TEX_SCALE = 3;

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

const FAC_SETTINGS = {
  bed: [
    { key: 'processTime', label: '채혈 시간 (턴)', type: 'slider', min: 2, max: 10, step: 1, default: 6, unit: '턴' },
    { key: 'autoDonor', label: '자동 배정', type: 'toggle', default: true },
    { key: 'priorityType', label: '우선 혈액형 채혈', type: 'slider', min: 0, max: 3, step: 1, default: 0, unit: '' },
  ],
  reception: [
    { key: 'queueLimit', label: '대기열 제한', type: 'slider', min: 3, max: 15, step: 1, default: 8, unit: '명' },
    { key: 'fastMode', label: '빠른 접수', type: 'toggle', default: false },
  ],
  storage: [
    { key: 'tempTarget', label: '목표 온도', type: 'slider', min: 1, max: 8, step: 1, default: 4, unit: '°C' },
    { key: 'autoShip', label: '자동 납품', type: 'toggle', default: false },
    { key: 'shipThreshold', label: '납품 기준', type: 'slider', min: 5, max: 30, step: 5, default: 15, unit: '팩' },
  ],
  cold_storage: [
    { key: 'tempTarget', label: '목표 온도', type: 'slider', min: -120, max: -40, step: 10, default: -80, unit: '°C' },
    { key: 'autoShip', label: '자동 납품', type: 'toggle', default: false },
  ],
  lab: [
    { key: 'processTime', label: '검사 시간', type: 'slider', min: 1, max: 8, step: 1, default: 5, unit: '턴' },
    { key: 'doubleCheck', label: '이중 검사', type: 'toggle', default: false },
  ],
  lounge: [
    { key: 'processTime', label: '휴식 시간', type: 'slider', min: 1, max: 5, step: 1, default: 3, unit: '턴' },
    { key: 'snack', label: '간식 제공', type: 'toggle', default: true },
  ],
  emergency: [
    { key: 'alwaysReady', label: '24시 대기', type: 'toggle', default: true },
    { key: 'alertLevel', label: '알림 레벨', type: 'slider', min: 1, max: 3, step: 1, default: 2, unit: '' },
  ],
  booth: [
    { key: 'campaign', label: '캠페인 강도', type: 'slider', min: 1, max: 5, step: 1, default: 3, unit: '' },
    { key: 'nightMode', label: '야간 홍보', type: 'toggle', default: false },
  ],
  _default: [
    { key: 'active', label: '활성화', type: 'toggle', default: true },
  ],
};

const FAC_UPGRADES = {
  bed: [
    { id: 'bed_comfort', icon: '🛋️', name: '고급 매트리스', desc: '채혈 속도 +10%', cost: 12 },
    { id: 'bed_monitor', icon: '📟', name: '자동 모니터링', desc: '부작용 감지 확률 ↑', cost: 18 },
    { id: 'bed_dual', icon: '💉', name: '듀얼 채혈 시스템', desc: '동시 2인 채혈 가능', cost: 30 },
  ],
  reception: [
    { id: 'rec_digital', icon: '📱', name: '디지털 접수', desc: '접수 속도 2배', cost: 10 },
    { id: 'rec_kiosk', icon: '🖥️', name: '무인 키오스크', desc: '대기열 +5', cost: 15 },
  ],
  storage: [
    { id: 'sto_rack', icon: '📦', name: '랙 확장', desc: '보관 +10팩', cost: 12 },
    { id: 'sto_auto', icon: '🤖', name: '자동 분류', desc: '혈액 분류 자동화', cost: 20 },
  ],
  lab: [
    { id: 'lab_auto', icon: '🔬', name: '자동 분석기', desc: '검사 속도 -1턴', cost: 15 },
    { id: 'lab_ai', icon: '🧠', name: 'AI 판독', desc: '정확도 99%', cost: 25 },
  ],
  lounge: [
    { id: 'lng_vend', icon: '🥤', name: '자판기', desc: '만족도 +15%', cost: 8 },
    { id: 'lng_tv', icon: '📺', name: '대형 TV', desc: '대기 인내심 +3', cost: 10 },
  ],
  emergency: [
    { id: 'emg_defi', icon: '⚡', name: '제세동기', desc: '응급 처리 100%', cost: 20 },
    { id: 'emg_oxy', icon: '🫁', name: '산소공급기', desc: '안정화 속도 2배', cost: 15 },
  ],
  _default: [
    { id: 'gen_eff', icon: '⚡', name: '효율 개선', desc: '전체 성능 +10%', cost: 10 },
  ],
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
    this._genParticleTextures();
    this.gridBg = this.add.graphics();
    this.facLayer = this.add.container(0, 0);
    this.particleLayer = this.add.container(0, 0);
    this.nurseLayer = this.add.container(0, 0);
    this.donorLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this._drawFloorTabs();
    this._drawGrid();
  }

  _genParticleTextures() {
    const pts = {
      pt_blood: { r: 4, color: '#cc2222', glow: '#ff4444' },
      pt_cold: { r: 3, color: '#88ddff', glow: '#aaeeff' },
      pt_spark: { r: 3, color: '#ffdd44', glow: '#ffee88' },
      pt_paper: { r: 3, color: '#f5eedd', glow: '#ffffff', square: true },
      pt_steam: { r: 5, color: 'rgba(200,200,200,0.6)', glow: 'rgba(255,255,255,0.3)' },
      pt_heal: { r: 3, color: '#44dd88', glow: '#66ffaa' },
      pt_dot: { r: 2, color: '#ffffff', glow: '#ffffff' },
    };
    for (const [key, cfg] of Object.entries(pts)) {
      if (this.textures.exists(key)) continue;
      const sz = cfg.r * 2 + 4;
      const ct = this.textures.createCanvas(key, sz * 2, sz * 2);
      const cc = ct.getContext();
      const cx = sz, cy = sz;
      if (cfg.square) {
        cc.fillStyle = cfg.glow;
        cc.fillRect(cx - cfg.r - 1, cy - cfg.r - 1, cfg.r * 2 + 2, cfg.r * 2 + 2);
        cc.fillStyle = cfg.color;
        cc.fillRect(cx - cfg.r, cy - cfg.r, cfg.r * 2, cfg.r * 2);
      } else {
        const rg = cc.createRadialGradient(cx, cy, 0, cx, cy, cfg.r + 2);
        rg.addColorStop(0, cfg.glow); rg.addColorStop(0.5, cfg.color); rg.addColorStop(1, 'rgba(0,0,0,0)');
        cc.fillStyle = rg;
        cc.beginPath(); cc.arc(cx, cy, cfg.r + 2, 0, Math.PI * 2); cc.fill();
      }
      ct.refresh();
    }
  }

  _genFloorTextures() {
    const s = TILE;
    const floors = {
      '1F': { base: [200,184,152], grout: '#a89070', hi: 'rgba(255,255,240,0.18)', lo: 'rgba(0,0,0,0.06)', accent: [220,200,160] },
      '2F': { base: [160,184,200], grout: '#7898a8', hi: 'rgba(240,255,255,0.14)', lo: 'rgba(0,0,0,0.07)', accent: [175,200,218] },
      'B1': { base: [120,112,136], grout: '#605870', hi: 'rgba(200,200,255,0.10)', lo: 'rgba(0,0,0,0.10)', accent: [135,125,150] },
    };
    for (const [fk, cl] of Object.entries(floors)) {
      const key = 'gentile_' + fk;
      if (this.textures.exists(key)) continue;
      const ct = this.textures.createCanvas(key, s * TEX_SCALE, s * TEX_SCALE);
      const cx = ct.getContext();
      cx.scale(TEX_SCALE, TEX_SCALE);
      const [br, bg, bb] = cl.base;
      const [ar, ag, ab] = cl.accent;
      cx.fillStyle = `rgb(${br},${bg},${bb})`;
      cx.fillRect(0, 0, s, s);
      cx.fillStyle = cl.hi;
      cx.fillRect(2, 2, s / 2 - 2, s / 2 - 2);
      cx.fillRect(s / 2 + 1, s / 2 + 1, s / 2 - 3, s / 2 - 3);
      cx.fillStyle = cl.lo;
      cx.fillRect(s / 2 + 1, 2, s / 2 - 3, s / 2 - 2);
      cx.fillRect(2, s / 2 + 1, s / 2 - 2, s / 2 - 3);
      for (let i = 0; i < 12; i++) {
        const rx = Math.floor(i * 3.7 + 1) % s, ry = Math.floor(i * 4.3 + 2) % s;
        cx.fillStyle = `rgba(${ar},${ag},${ab},${0.06 + (i % 4) * 0.02})`;
        cx.fillRect(rx, ry, 2 + (i % 2), 1 + (i % 2));
      }
      for (let i = 0; i < 8; i++) {
        const rx = Math.floor(i * 5.3 + 3) % s, ry = Math.floor(i * 6.1) % s;
        cx.fillStyle = `rgba(0,0,0,${0.015 + (i % 3) * 0.008})`;
        cx.fillRect(rx, ry, 1, 1);
      }
      const grad = cx.createLinearGradient(0, 0, s, s);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.06)');
      cx.fillStyle = grad;
      cx.fillRect(0, 0, s, s);
      cx.fillStyle = 'rgba(255,255,255,0.04)';
      cx.fillRect(1, 1, s / 2 - 1, 1);
      cx.fillRect(1, 1, 1, s / 2 - 1);
      cx.fillRect(s / 2 + 1, s / 2 + 1, s / 2 - 2, 1);
      cx.fillRect(s / 2 + 1, s / 2 + 1, 1, s / 2 - 2);
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

    const _rr = (c, x, y, w, h, r) => {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
      c.closePath();
    };
    const _topGrad = (c, w, topH, c1, c2) => {
      const g = c.createLinearGradient(0, 0, 0, topH);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      c.fillStyle = g; c.fillRect(0, 0, w, topH);
    };
    const _isoBox = (c, x, y, bw, bh, depth, faceColor, topColor, sideColor, r) => {
      c.fillStyle = sideColor;
      _rr(c, x, y + depth, bw, bh, r); c.fill();
      c.fillStyle = faceColor;
      _rr(c, x, y, bw, bh, r); c.fill();
      const tg = c.createLinearGradient(x, y, x, y + bh * 0.3);
      tg.addColorStop(0, topColor); tg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = tg; _rr(c, x, y, bw, bh * 0.4, r); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.04)';
      c.fillRect(x + bw - 3, y + 2, 2, bh - 4);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fillRect(x + 1, y + 1, 2, bh - 2);
      c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.5;
      _rr(c, x, y, bw, bh, r); c.stroke();
    };
    const _noise = (c, x, y, w, h, count, alpha) => {
      for (let i = 0; i < count; i++) {
        const nx = x + Math.floor(i * 7.3 + 1) % w;
        const ny = y + Math.floor(i * 5.1 + 3) % h;
        c.fillStyle = `rgba(0,0,0,${alpha + (i % 3) * 0.005})`;
        c.fillRect(nx, ny, 1, 1);
      }
    };
    const _screenGlare = (c, x, y, sw, sh) => {
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw * 0.4, y);
      c.lineTo(x, y + sh * 0.6); c.closePath(); c.fill();
    };

    const draw = {
      bed: (c, w, h) => {
        _topGrad(c, w, h, '#fdf0f0', '#f0dde0');
        _noise(c, 0, 0, w, h, 8, 0.01);
        _isoBox(c, 4, h * 0.32, w * 0.65, h * 0.52, 5, '#e8eef6', 'rgba(255,255,255,0.4)', '#c0ccd8', 3);
        c.fillStyle = '#ccdae8'; c.fillRect(6, h * 0.35, 16, h * 0.44);
        const pg = c.createLinearGradient(0, h * 0.35, 0, h * 0.35 + h * 0.44);
        pg.addColorStop(0, 'rgba(255,255,255,0.3)'); pg.addColorStop(1, 'rgba(0,0,0,0.03)');
        c.fillStyle = pg; c.fillRect(6, h * 0.35, 16, h * 0.44);
        c.fillStyle = '#d8e2ea'; c.fillRect(24, h * 0.4, w * 0.3, h * 0.4);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(24, h * 0.4, w * 0.3, h * 0.1);
        _isoBox(c, w - 20, 1, 14, 16, 4, '#cc2222', 'rgba(255,100,100,0.45)', '#8a1010', 2);
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(w - 18, 3, 4, 8);
        c.fillStyle = '#555'; c.fillRect(w - 14, 1, 2, h * 0.78);
        c.fillStyle = '#666'; c.fillRect(w - 15, 1, 1, h * 0.78);
        c.strokeStyle = '#cc2222'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(w - 13, 18); c.quadraticCurveTo(w - 13, h * 0.5, w * 0.52, h * 0.5); c.stroke();
        c.strokeStyle = 'rgba(255,50,50,0.3)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(w - 13, 18); c.quadraticCurveTo(w - 13, h * 0.5, w * 0.52, h * 0.5); c.stroke();
        c.fillStyle = '#cc2222'; c.beginPath(); c.arc(w - 13, h - 7, 3.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,150,150,0.4)'; c.beginPath(); c.arc(w - 14, h - 8, 2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#44aa44'; c.fillRect(w * 0.55, 4, 8, 6);
        c.fillStyle = '#55cc55'; c.fillRect(w * 0.55 + 1, 5, 2, 1); c.fillRect(w * 0.55 + 4, 6, 3, 1);
      },
      reception: (c, w, h) => {
        _topGrad(c, w, h, '#eef4fc', '#dce8f4');
        _noise(c, 0, 0, w, h, 10, 0.012);
        _isoBox(c, 6, h * 0.46, w - 12, h * 0.4, 6, '#8b7355', 'rgba(180,150,110,0.5)', '#5a4430', 3);
        const dg = c.createLinearGradient(6, h * 0.46, 6, h * 0.46 + h * 0.4);
        dg.addColorStop(0, '#a08060'); dg.addColorStop(1, '#7a6045');
        c.fillStyle = dg; _rr(c, 8, h * 0.48, w - 16, h * 0.1, 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(8, h * 0.48, w - 16, 3);
        _isoBox(c, w * 0.22, 5, w * 0.5, h * 0.36, 4, '#2a3a50', 'rgba(100,150,200,0.3)', '#141e30', 2);
        const sg = c.createLinearGradient(0, 7, 0, 7 + h * 0.28);
        sg.addColorStop(0, '#55aadd'); sg.addColorStop(1, '#3377aa');
        c.fillStyle = sg; c.fillRect(w * 0.25, 8, w * 0.44, h * 0.29);
        _screenGlare(c, w * 0.25, 8, w * 0.44, h * 0.29);
        c.fillStyle = '#66ddff'; c.fillRect(w * 0.3, h * 0.12, w * 0.15, 2);
        c.fillStyle = '#88eeff'; c.fillRect(w * 0.3, h * 0.18, w * 0.25, 2);
        c.fillStyle = '#66ddff'; c.fillRect(w * 0.3, h * 0.24, w * 0.1, 2);
        c.fillStyle = '#ddd'; c.fillRect(w * 0.18, h * 0.54, w * 0.22, 3);
        c.fillStyle = '#ccc'; c.fillRect(w * 0.52, h * 0.54, w * 0.22, 3);
        _isoBox(c, 8, h * 0.58, 16, 20, 4, '#f5e6c8', 'rgba(255,255,255,0.3)', '#c8b090', 2);
        c.fillStyle = '#eeddbb'; c.fillRect(10, h * 0.62, 12, 3);
        c.fillStyle = '#ddccaa'; c.fillRect(10, h * 0.68, 12, 3);
        _isoBox(c, w - 24, h * 0.58, 14, 14, 3, '#334455', 'rgba(100,150,200,0.2)', '#222', 2);
        c.fillStyle = '#557799'; c.fillRect(w - 22, h * 0.6, 10, 8);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(w - 22, h * 0.6, 10, 3);
      },
      waiting_room: (c, w, h) => {
        _topGrad(c, w, h, '#f5f2ee', '#e8e4de');
        _noise(c, 0, 0, w, h, 10, 0.01);
        for (let i = 0; i < 3; i++) {
          const cx = 8 + i * 25;
          _isoBox(c, cx, 10, 20, 18, 5, '#3388aa', 'rgba(100,200,255,0.35)', '#1e5e78', 3);
          c.fillStyle = '#2a7898'; c.fillRect(cx + 1, 10, 20, 5);
          c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(cx + 2, 11, 18, 3);
          c.fillStyle = '#55aacc'; c.fillRect(cx + 4, 16, 12, 2);
        }
        for (let i = 0; i < 3; i++) {
          const cx = 8 + i * 25, cy = h - 32;
          _isoBox(c, cx, cy, 20, 18, 5, '#3388aa', 'rgba(100,200,255,0.35)', '#1e5e78', 3);
          c.fillStyle = '#2a7898'; c.fillRect(cx + 1, cy, 20, 5);
          c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(cx + 2, cy + 1, 18, 3);
          c.fillStyle = '#55aacc'; c.fillRect(cx + 4, cy + 10, 12, 2);
        }
        _isoBox(c, w * 0.28, h * 0.36, w * 0.44, h * 0.2, 4, '#aa8855', 'rgba(255,220,160,0.35)', '#7a5c30', 2);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(w * 0.3, h * 0.37, w * 0.4, h * 0.05);
        c.fillStyle = '#c8a060'; c.fillRect(w * 0.35, h * 0.4, w * 0.15, 3);
        c.fillStyle = '#d0b070'; c.fillRect(w * 0.55, h * 0.42, w * 0.1, 3);
      },
      lounge: (c, w, h) => {
        _topGrad(c, w, h, '#faf5ed', '#ede5d8');
        _noise(c, 0, 0, w, h, 10, 0.01);
        _isoBox(c, w * 0.22, h * 0.3, w * 0.56, h * 0.34, 5, '#cc8844', 'rgba(255,200,120,0.4)', '#995520', 3);
        c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(w * 0.24, h * 0.32, w * 0.52, h * 0.08);
        c.fillStyle = '#b87030'; c.fillRect(w * 0.3, h * 0.42, w * 0.16, 3);
        c.fillStyle = '#ddaa66'; c.fillRect(w * 0.5, h * 0.44, w * 0.12, 3);
        _isoBox(c, 3, h * 0.22, w * 0.4, h * 0.5, 6, '#4a8a4a', 'rgba(120,200,120,0.4)', '#1a5a1a', 4);
        c.fillStyle = '#5a9a5a'; c.fillRect(5, h * 0.25, w * 0.36, h * 0.14);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(5, h * 0.25, w * 0.36, h * 0.06);
        c.fillStyle = '#6aaa6a'; c.fillRect(8, h * 0.44, w * 0.3, h * 0.08);
        c.fillStyle = '#6b4423'; c.fillRect(w * 0.72, h * 0.06, 5, 14);
        c.fillStyle = '#228B22'; c.beginPath(); c.arc(w * 0.745, h * 0.04, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#33aa33'; c.beginPath(); c.arc(w * 0.73, h * 0.02, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#44cc44'; c.beginPath(); c.arc(w * 0.76, h * 0.035, 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#887766'; c.fillRect(w * 0.65, h * 0.75, 12, 8);
        c.fillStyle = '#aa9988'; c.fillRect(w * 0.65, h * 0.75, 12, 3);
        c.fillStyle = '#44aadd'; c.fillRect(w * 0.66, h * 0.77, 10, 4);
      },
      lab: (c, w, h) => {
        _topGrad(c, w, h, '#f2f5fc', '#e0e8f4');
        _noise(c, 0, 0, w, h, 10, 0.01);
        _isoBox(c, 6, h * 0.48, w - 12, h * 0.4, 6, '#b0b8c0', 'rgba(220,230,240,0.4)', '#7a8590', 3);
        const cg = c.createLinearGradient(6, h * 0.48, 6, h * 0.88);
        cg.addColorStop(0, '#c8d0d8'); cg.addColorStop(1, '#a0a8b0');
        c.fillStyle = cg; c.fillRect(8, h * 0.5, w - 16, 5);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(8, h * 0.5, w - 16, 2);
        _isoBox(c, 8, h * 0.1, 16, h * 0.38, 4, '#3a3a3a', 'rgba(150,150,150,0.3)', '#1a1a1a', 2);
        c.fillStyle = '#555'; c.fillRect(6, h * 0.06, 20, 7);
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(7, h * 0.07, 18, 3);
        c.fillStyle = '#666'; c.fillRect(14, h * 0.38, 14, h * 0.1);
        c.fillStyle = '#777'; c.fillRect(15, h * 0.39, 12, 3);
        const tubes = ['#dd3333', '#33aa33', '#3355cc', '#ddaa22', '#cc55cc'];
        tubes.forEach((cl, i) => {
          const tx = w * 0.44 + i * 8;
          const tht = h * 0.34;
          c.fillStyle = cl; c.globalAlpha = 0.8;
          _rr(c, tx, h * 0.18, 6, tht, 2); c.fill();
          c.globalAlpha = 1;
          const lg = c.createLinearGradient(tx, h * 0.18, tx + 6, h * 0.18);
          lg.addColorStop(0, 'rgba(255,255,255,0.35)'); lg.addColorStop(1, 'rgba(0,0,0,0.05)');
          c.fillStyle = lg; c.fillRect(tx, h * 0.18, 3, tht);
          c.fillStyle = '#999'; _rr(c, tx - 1, h * 0.15, 8, 5, 1); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(tx + 1, h * 0.22, 2, tht * 0.3);
        });
        c.fillStyle = '#aab8c0'; c.fillRect(w * 0.55, h * 0.55, w * 0.35, h * 0.3);
        c.fillStyle = '#bcc8d0'; c.fillRect(w * 0.57, h * 0.57, w * 0.31, h * 0.06);
        c.fillStyle = '#ccd4dc'; c.fillRect(w * 0.57, h * 0.66, w * 0.31, h * 0.06);
      },
      storage: (c, w, h) => {
        _topGrad(c, w, h, '#e8eff5', '#d0dce8');
        _noise(c, 0, 0, w, h, 6, 0.01);
        _isoBox(c, 3, 2, w - 6, h - 4, 5, '#b8c4d0', 'rgba(220,230,240,0.4)', '#8898a8', 3);
        c.strokeStyle = '#7888a0'; c.lineWidth = 1;
        c.strokeRect(6, h * 0.14, w * 0.42, h * 0.34);
        c.strokeRect(w * 0.52, h * 0.14, w * 0.42, h * 0.34);
        c.strokeRect(6, h * 0.53, w * 0.42, h * 0.34);
        c.strokeRect(w * 0.52, h * 0.53, w * 0.42, h * 0.34);
        c.fillStyle = 'rgba(130,200,240,0.2)'; c.fillRect(7, h * 0.15, w * 0.41, h * 0.33);
        c.fillRect(w * 0.53, h * 0.15, w * 0.41, h * 0.33);
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.fillRect(7, h * 0.15, w * 0.2, h * 0.33);
        c.fillRect(w * 0.53, h * 0.15, w * 0.2, h * 0.33);
        c.fillStyle = '#aab0b8'; c.fillRect(w * 0.46, h * 0.24, 3, 8);
        c.fillRect(w * 0.46, h * 0.63, 3, 8);
      },
      corridor: (c, w, h) => {
        _topGrad(c, w, h, '#e0d8cc', '#ccc4b4');
        _noise(c, 0, 0, w, h, 4, 0.008);
        c.strokeStyle = 'rgba(160,148,128,0.5)'; c.lineWidth = 0.8;
        c.setLineDash([4, 3]);
        c.beginPath(); c.moveTo(w / 2, 3); c.lineTo(w / 2, h - 3); c.stroke();
        c.beginPath(); c.moveTo(3, h / 2); c.lineTo(w - 3, h / 2); c.stroke();
        c.setLineDash([]);
        const cg = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
        cg.addColorStop(0, 'rgba(255,255,255,0.12)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = cg; c.fillRect(0, 0, w, h);
      },
      stairs: (c, w, h) => {
        _topGrad(c, w, h, '#d0c8be', '#b8b0a6');
        _noise(c, 0, 0, w, h, 4, 0.008);
        for (let i = 0; i < 5; i++) {
          const sh = h / 5;
          const sy = 2 + i * sh;
          const depth = 3;
          c.fillStyle = '#8a8278'; c.fillRect(4 + i * 2, sy + sh - depth, w - 8 - i * 2, depth);
          const sg = c.createLinearGradient(0, sy, 0, sy + sh - depth);
          sg.addColorStop(0, i % 2 === 0 ? '#c0b8a8' : '#ccbfae');
          sg.addColorStop(1, i % 2 === 0 ? '#b0a898' : '#bbb0a0');
          c.fillStyle = sg; c.fillRect(4 + i * 2, sy, w - 8 - i * 2, sh - depth);
          c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(4 + i * 2, sy, w - 8 - i * 2, 2);
        }
      },
      emergency: (c, w, h) => {
        _topGrad(c, w, h, '#fff4e8', '#f0e0cc');
        _noise(c, 0, 0, w, h, 8, 0.01);
        _isoBox(c, 4, h * 0.3, w * 0.52, h * 0.55, 4, '#e8e0d8', 'rgba(255,255,255,0.3)', '#c8c0b0', 3);
        c.fillStyle = '#d8d0c0'; c.fillRect(6, h * 0.33, 14, h * 0.46);
        _isoBox(c, w * 0.58, 2, 18, 18, 3, '#cc4400', 'rgba(255,120,50,0.3)', '#993300', 2);
        c.fillStyle = '#fff'; c.fillRect(w * 0.58 + 6, 6, 4, 10);
        c.fillRect(w * 0.58 + 3, 9, 10, 4);
        c.fillStyle = '#22aa44';
        c.beginPath(); c.moveTo(w * 0.68, h * 0.5); c.lineTo(w * 0.82, h * 0.38); c.lineTo(w * 0.82, h * 0.62); c.closePath(); c.fill();
        c.strokeStyle = '#22aa44'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(w * 0.82, h * 0.5); c.lineTo(w - 6, h * 0.5); c.stroke();
      },
      restroom: (c, w, h) => {
        _topGrad(c, w, h, '#eef5f5', '#dce8e8');
        _noise(c, 0, 0, w, h, 6, 0.01);
        _isoBox(c, w * 0.15, 3, w * 0.7, h * 0.45, 4, '#ddd', 'rgba(255,255,255,0.35)', '#bbb', 3);
        c.fillStyle = '#eee'; c.fillRect(w * 0.2, 6, w * 0.6, h * 0.33);
        c.fillStyle = 'rgba(160,220,238,0.35)'; c.fillRect(w * 0.25, 8, w * 0.2, h * 0.22);
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(w * 0.25, 8, w * 0.1, h * 0.22);
        _isoBox(c, w * 0.15, h * 0.52, w * 0.7, h * 0.35, 4, '#c8c8c8', 'rgba(255,255,255,0.3)', '#a0a0a0', 3);
        c.fillStyle = '#d8d8d8'; c.fillRect(w * 0.2, h * 0.56, w * 0.6, h * 0.25);
      },
      booth: (c, w, h) => {
        _topGrad(c, w, h, '#fff8e8', '#f0e8d0');
        _noise(c, 0, 0, w, h, 5, 0.01);
        c.fillStyle = '#dd4422';
        c.beginPath(); c.moveTo(w / 2, 1); c.lineTo(w - 3, h * 0.42); c.lineTo(3, h * 0.42); c.closePath(); c.fill();
        const rg = c.createLinearGradient(0, 1, 0, h * 0.42);
        rg.addColorStop(0, 'rgba(255,150,100,0.4)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = rg;
        c.beginPath(); c.moveTo(w / 2, 1); c.lineTo(w * 0.75, h * 0.42); c.lineTo(w * 0.25, h * 0.42); c.closePath(); c.fill();
        c.fillStyle = '#cc3311';
        c.beginPath(); c.moveTo(w / 2, 1); c.lineTo(w * 0.75, h * 0.42); c.lineTo(w / 2, h * 0.42); c.closePath(); c.fill();
        _isoBox(c, w * 0.15, h * 0.42, w * 0.7, h * 0.45, 5, '#8B4513', 'rgba(180,120,60,0.35)', '#6a3410', 3);
      },
      elevator: (c, w, h) => {
        _topGrad(c, w, h, '#d0d0d8', '#b8b8c4');
        _noise(c, 0, 0, w, h, 4, 0.008);
        _isoBox(c, 3, 3, w - 6, h - 6, 4, '#8898a8', 'rgba(180,200,220,0.3)', '#667888', 3);
        c.fillStyle = '#96a6b6'; c.fillRect(4, 4, (w - 8) / 2 - 2, h - 10);
        c.fillStyle = '#9aabb8'; c.fillRect(w / 2 + 1, 4, (w - 8) / 2 - 2, h - 10);
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(4, 4, (w - 8) / 2 - 2, h * 0.3);
        c.strokeStyle = '#667'; c.lineWidth = 1; c.strokeRect(3, 3, w - 6, h - 6);
        c.strokeStyle = '#556'; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(w / 2, 4); c.lineTo(w / 2, h - 7); c.stroke();
        c.fillStyle = '#ee9900';
        c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w / 2 + 5, 14); c.lineTo(w / 2 - 5, 14); c.closePath(); c.fill();
        c.fillStyle = '#dd8800';
        c.beginPath(); c.moveTo(w / 2, h - 8); c.lineTo(w / 2 + 5, h - 14); c.lineTo(w / 2 - 5, h - 14); c.closePath(); c.fill();
      },
      office: (c, w, h) => {
        _topGrad(c, w, h, '#f5f0e4', '#e5ddd0');
        _noise(c, 0, 0, w, h, 8, 0.01);
        _isoBox(c, 6, h * 0.38, w - 12, h * 0.45, 5, '#8b7355', 'rgba(180,150,110,0.4)', '#6b5540', 3);
        c.fillStyle = '#a08060'; c.fillRect(8, h * 0.4, w - 16, 4);
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(8, h * 0.4, w - 16, 2);
        _isoBox(c, w * 0.3, 3, w * 0.35, h * 0.3, 3, '#2a3344', 'rgba(80,130,180,0.25)', '#1a2030', 2);
        const mg = c.createLinearGradient(0, 5, 0, h * 0.28);
        mg.addColorStop(0, '#5599cc'); mg.addColorStop(1, '#3377aa');
        c.fillStyle = mg; c.fillRect(w * 0.33, 6, w * 0.29, h * 0.22);
        _screenGlare(c, w * 0.33, 6, w * 0.29, h * 0.22);
        c.fillStyle = '#66ccee'; c.fillRect(w * 0.36, h * 0.1, w * 0.12, 2);
        c.fillStyle = '#88ddff'; c.fillRect(w * 0.36, h * 0.15, w * 0.2, 2);
        _isoBox(c, 10, h * 0.48, 12, 16, 3, '#f5e6c8', 'rgba(255,255,255,0.3)', '#d5c6a8', 2);
        c.fillStyle = '#e8d8b8'; c.fillRect(12, h * 0.52, 8, 2);
        c.fillStyle = '#ddc8a8'; c.fillRect(12, h * 0.58, 8, 2);
        _isoBox(c, 26, h * 0.5, 10, 12, 2, '#eee0d0', 'rgba(255,255,255,0.25)', '#d0c4b0', 2);
        c.fillStyle = '#cc8844'; c.fillRect(w - 14, h * 0.5, 6, 6);
        c.fillStyle = '#dd9955'; c.fillRect(w - 13, h * 0.52, 4, 3);
      },
      parking: (c, w, h) => {
        const bg = c.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#5a5a5a'); bg.addColorStop(1, '#444');
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const sx = 8 + i * (w / 4 - 1);
          const sw = w / 4 - 6;
          c.strokeRect(sx, 8, sw, h * 0.38);
          c.strokeRect(sx, h * 0.55, sw, h * 0.38);
        }
        c.fillStyle = 'rgba(255,255,255,0.12)';
        for (let i = 0; i < 4; i++) {
          c.fillRect(9 + i * (w / 4 - 1), 9, w / 4 - 8, h * 0.36);
        }
        c.font = 'bold 16px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillText('P', w / 2, h / 2 + 1);
        c.fillStyle = '#fff'; c.fillText('P', w / 2, h / 2);
      },
      cold_storage: (c, w, h) => {
        _topGrad(c, w, h, '#daeef5', '#c0dce8');
        _noise(c, 0, 0, w, h, 8, 0.01);
        _isoBox(c, 3, 3, w - 6, h - 6, 5, '#a8c8d8', 'rgba(200,235,255,0.35)', '#80a8b8', 3);
        c.fillStyle = '#98bcc8'; c.fillRect(4, 4, w - 8, 5);
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(4, 4, w - 8, 3);
        for (let i = 0; i < 3; i++) {
          const cx = 8 + i * (w / 3 - 1);
          c.strokeStyle = '#78a0b0'; c.lineWidth = 1;
          c.strokeRect(cx, 12, w / 3 - 8, h - 24);
          c.fillStyle = 'rgba(150,220,255,0.18)'; c.fillRect(cx + 1, 13, w / 3 - 10, h - 26);
          c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(cx + 1, 13, (w / 3 - 10) * 0.4, h - 26);
        }
        c.font = '14px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = 'rgba(60,150,200,0.6)'; c.fillText('❄', w / 2, h / 2 + 1);
        c.fillStyle = '#4499cc'; c.fillText('❄', w / 2, h / 2);
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
      const ct = this.textures.createCanvas(key, w * TEX_SCALE, h * TEX_SCALE);
      const cx = ct.getContext();
      cx.scale(TEX_SCALE, TEX_SCALE);
      fn(cx, w, h);
      cx.strokeStyle = 'rgba(0,0,0,0.08)';
      cx.lineWidth = 0.5;
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
      if (isActive) {
        bg.fillStyle(0x000000, 0.2 * alpha);
        bg.fillRoundedRect(x + 1, y + 2, 46, 20, 6);
        bg.fillStyle(0xe9c46a, alpha);
        bg.fillRoundedRect(x, y, 46, 20, 6);
        bg.fillStyle(0xffeaa0, 0.35 * alpha);
        bg.fillRoundedRect(x + 2, y + 1, 42, 8, 4);
      } else {
        bg.fillStyle(0x3a3228, alpha);
        bg.fillRoundedRect(x, y, 46, 20, 6);
        bg.fillStyle(0xffffff, 0.05 * alpha);
        bg.fillRoundedRect(x + 2, y + 1, 42, 8, 4);
      }
      bg.lineStyle(isActive ? 2 : 1, isActive ? 0xffd700 : 0x5a5040, alpha);
      bg.strokeRoundedRect(x, y, 46, 20, 6);
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
        this.gridBg.lineStyle(1, 0x000000, 0.08);
        this.gridBg.strokeRect(x, y, TILE - 1, TILE - 1);
      }
    }
    this.gridBg.fillStyle(0x000000, 0.1);
    this.gridBg.fillRect(gridX, gridY, gridW, 4);
    this.gridBg.fillRect(gridX, gridY, 4, gridH);
    this.gridBg.fillStyle(0x000000, 0.06);
    this.gridBg.fillRect(gridX, gridY + gridH - 4, gridW, 4);
    this.gridBg.fillRect(gridX + gridW - 4, gridY, 4, gridH);
    this.gridBg.fillStyle(0xffffff, 0.03);
    this.gridBg.fillRect(gridX, gridY + gridH - 2, gridW, 2);
    this.gridBg.fillRect(gridX + gridW - 2, gridY, 2, gridH);
    for (let d = 0; d < 6; d++) {
      this.gridBg.fillStyle(0x000000, 0.015 * (6 - d));
      this.gridBg.fillRect(gridX + d, gridY + d, gridW - d * 2, 1);
      this.gridBg.fillRect(gridX + d, gridY + d, 1, gridH - d * 2);
      this.gridBg.fillRect(gridX + d, gridY + gridH - d - 1, gridW - d * 2, 1);
      this.gridBg.fillRect(gridX + gridW - d - 1, gridY + d, 1, gridH - d * 2);
    }
  }

  _fullRedraw() {
    Object.values(this.facSprites).forEach(s => { s.emitter?.destroy(); s.container?.destroy(); });
    this.facSprites = {};
    Object.values(this.nurseSprites).forEach(s => s.container?.destroy());
    this.nurseSprites = {};
    this.donorDots.forEach(d => d.destroy());
    this.donorDots = [];
    this.facLayer.removeAll();
    this.particleLayer.removeAll();
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
        this.facSprites[uid].emitter?.destroy();
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
    shadow.fillStyle(0x000000, 0.12);
    shadow.fillRoundedRect(x + 4, y + 5, w, h, 5);
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillRoundedRect(x + 2, y + 3, w, h, 4);
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
    border.lineStyle(1, 0xffffff, 0.15);
    border.strokeRoundedRect(x, y, w, h, 4);
    border.fillStyle(0xffffff, 0.06);
    border.fillRect(x + 1, y + 1, w - 2, Math.min(6, h * 0.15));
    container.add(border);

    const lvBg = this.add.graphics();
    lvBg.fillStyle(0x000000, 0.5);
    lvBg.fillRoundedRect(x + 1, y + 1, 18, 10, 3);
    lvBg.fillStyle(0xf0c040, 0.9);
    lvBg.fillRoundedRect(x + 2, y + 2, 16, 8, 2);
    container.add(lvBg);
    const lvText = this.add.text(x + 10, y + 6, fac.level, {
      fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3a2800',
    }).setOrigin(0.5);
    container.add(lvText);

    if (tw >= 2 || th >= 2) {
      const facLabel = this.add.text(x + w / 2, y + h - 4, fac.name?.slice(0, 4) || '', {
        fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold',
        color: '#fff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 1);
      container.add(facLabel);
    }

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

    const emitter = this._createFacParticles(fac, x, y, w, h);

    this.facLayer.add(container);
    this.facSprites[fac.uid] = { container, body, glow, progressBg, progressFill, lvText, fac, x, y, w, h, emitter };
    this._updateFacSprite(this.facSprites[fac.uid], fac);
  }

  _updateFacSprite(sprite, fac) {
    sprite.lvText.setText(fac.level);
    sprite.glow.clear();
    sprite.progressBg.clear();
    sprite.progressFill.clear();
    if (fac.busy) {
      const { x, y, w, h } = sprite;
      const gc = FAC_COLORS[fac.id] || 0x4ade80;
      sprite.glow.fillStyle(gc, 0.06);
      sprite.glow.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 10);
      sprite.glow.fillStyle(gc, 0.1);
      sprite.glow.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 7);
      sprite.glow.lineStyle(2, gc, 0.55);
      sprite.glow.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 5);
      sprite.glow.lineStyle(1, gc, 0.2);
      sprite.glow.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 9);
      if (fac.processTime > 0) {
        const pct = Math.min(1, fac.progress / fac.processTime);
        const barY = y + h - 7;
        sprite.progressBg.fillStyle(0x000000, 0.55);
        sprite.progressBg.fillRoundedRect(x + 2, barY, w - 4, 6, 3);
        const barColor = pct < 0.3 ? 0xf39c12 : pct < 0.7 ? 0x4ade80 : 0x3498db;
        sprite.progressFill.fillStyle(barColor, 0.9);
        sprite.progressFill.fillRoundedRect(x + 3, barY + 1, Math.max(0, (w - 6) * pct), 4, 2);
        sprite.progressFill.fillStyle(0xffffff, 0.25);
        sprite.progressFill.fillRoundedRect(x + 3, barY + 1, Math.max(0, (w - 6) * pct), 2, 1);
      }
    }
    if (sprite.emitter) {
      sprite.emitter.emitting = !!fac.busy;
    }
    sprite.fac = fac;
  }

  _createFacParticles(fac, x, y, w, h) {
    const cfg = {
      bed:          { tex: 'pt_blood', freq: 1800, speed: { min: 5, max: 15 }, lifespan: 2000, scale: { start: 0.6, end: 0 }, alpha: { start: 0.7, end: 0 }, gravityY: 20, quantity: 1 },
      lab:          { tex: 'pt_spark', freq: 2200, speed: { min: 8, max: 20 }, lifespan: 1200, scale: { start: 0.5, end: 0 }, alpha: { start: 0.8, end: 0 }, gravityY: -5, quantity: 1 },
      cold_storage: { tex: 'pt_cold',  freq: 800,  speed: { min: 3, max: 12 }, lifespan: 2500, scale: { start: 0.4, end: 0.8 }, alpha: { start: 0.5, end: 0 }, gravityY: -8, quantity: 1 },
      storage:      { tex: 'pt_cold',  freq: 2000, speed: { min: 2, max: 8 },  lifespan: 2000, scale: { start: 0.3, end: 0.6 }, alpha: { start: 0.3, end: 0 }, gravityY: -5, quantity: 1 },
      emergency:    { tex: 'pt_heal',  freq: 1500, speed: { min: 10, max: 25 }, lifespan: 1000, scale: { start: 0.5, end: 0 }, alpha: { start: 0.8, end: 0 }, gravityY: -15, quantity: 1 },
      reception:    { tex: 'pt_paper', freq: 3000, speed: { min: 3, max: 10 },  lifespan: 2000, scale: { start: 0.5, end: 0.3 }, alpha: { start: 0.6, end: 0 }, gravityY: 8, quantity: 1 },
      office:       { tex: 'pt_paper', freq: 3500, speed: { min: 2, max: 8 },   lifespan: 1800, scale: { start: 0.4, end: 0.2 }, alpha: { start: 0.5, end: 0 }, gravityY: 6, quantity: 1 },
      lounge:       { tex: 'pt_steam', freq: 2500, speed: { min: 2, max: 6 },   lifespan: 2500, scale: { start: 0.3, end: 0.7 }, alpha: { start: 0.3, end: 0 }, gravityY: -10, quantity: 1 },
      booth:        { tex: 'pt_spark', freq: 2000, speed: { min: 5, max: 15 },  lifespan: 1500, scale: { start: 0.4, end: 0 }, alpha: { start: 0.7, end: 0 }, gravityY: -8, quantity: 1 },
    };
    const pc = cfg[fac.id];
    if (!pc || !this.textures.exists(pc.tex)) return null;
    try {
      const emitter = this.add.particles(x + w / 2, y + h * 0.3, pc.tex, {
        speed: pc.speed,
        lifespan: pc.lifespan,
        scale: pc.scale,
        alpha: pc.alpha,
        gravityY: pc.gravityY || 0,
        frequency: pc.freq,
        quantity: pc.quantity || 1,
        emitting: false,
        blendMode: 'ADD',
        emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-w * 0.3, -h * 0.2, w * 0.6, h * 0.4) },
      });
      this.particleLayer.add(emitter);
      return emitter;
    } catch (e) { return null; }
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
      const nid = nurse.charData.id || nurse.charData.name;
      const seedVal = nid.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const charKey = '_npcTex_' + (roleColor).toString(16) + '_' + (seedVal % 100);
      if (!this.textures.exists(charKey)) {
        const ct = this.textures.createCanvas(charKey, 24 * TEX_SCALE, 30 * TEX_SCALE);
        const cc = ct.getContext();
        cc.scale(TEX_SCALE, TEX_SCALE);
        const rv = (roleColor >> 16) & 0xff, gv = (roleColor >> 8) & 0xff, bv = roleColor & 0xff;
        const baseCol = `rgb(${rv},${gv},${bv})`;
        const darkCol = `rgb(${Math.max(0,rv-60)},${Math.max(0,gv-60)},${Math.max(0,bv-60)})`;
        const lightCol = `rgb(${Math.min(255,rv+50)},${Math.min(255,gv+50)},${Math.min(255,bv+50)})`;
        const skins = ['#ffd5b4','#f0c8a0','#d4a574','#c68642','#8d5524'];
        const skinIdx = seedVal % skins.length;
        const skinCol = skins[skinIdx];
        const skinShade = skins[Math.min(skinIdx + 1, skins.length - 1)];
        const hairs = ['#1a1a1a','#332211','#554433','#8b6914','#a0522d','#2c1608'];
        const hairCol = hairs[seedVal % hairs.length];
        const hairDark = hairs[(seedVal + 1) % hairs.length];
        cc.fillStyle = 'rgba(0,0,0,0.25)';
        cc.beginPath(); cc.ellipse(12, 28, 7, 3, 0, 0, Math.PI * 2); cc.fill();
        cc.fillStyle = darkCol; cc.fillRect(7, 20, 4, 8); cc.fillRect(13, 20, 4, 8);
        cc.fillStyle = `rgb(${Math.max(0,rv-80)},${Math.max(0,gv-80)},${Math.max(0,bv-80)})`;
        cc.fillRect(7, 26, 4, 2); cc.fillRect(13, 26, 4, 2);
        const bodyG = cc.createLinearGradient(5, 10, 5, 20);
        bodyG.addColorStop(0, lightCol); bodyG.addColorStop(1, baseCol);
        cc.fillStyle = bodyG; cc.fillRect(5, 10, 14, 11);
        cc.fillStyle = darkCol; cc.fillRect(5, 10, 14, 2);
        cc.fillStyle = 'rgba(255,255,255,0.15)'; cc.fillRect(6, 11, 5, 8);
        cc.fillStyle = skinShade; cc.fillRect(2, 12, 3, 7); cc.fillRect(19, 12, 3, 7);
        cc.fillStyle = skinCol; cc.fillRect(2, 12, 3, 2); cc.fillRect(19, 12, 3, 2);
        const headG = cc.createLinearGradient(6, 1, 6, 10);
        headG.addColorStop(0, skinCol); headG.addColorStop(1, skinShade);
        cc.fillStyle = headG; cc.fillRect(6, 1, 12, 10);
        cc.fillStyle = 'rgba(255,255,255,0.12)'; cc.fillRect(7, 2, 4, 3);
        cc.fillStyle = hairCol; cc.fillRect(5, 0, 14, 4);
        if (seedVal % 3 === 0) { cc.fillRect(5, 0, 3, 8); cc.fillRect(16, 0, 3, 8); }
        else if (seedVal % 3 === 1) { cc.fillRect(5, 0, 14, 5); }
        cc.fillStyle = hairDark; cc.fillRect(5, 0, 14, 2);
        cc.fillStyle = '#111'; cc.fillRect(8, 5, 2, 2); cc.fillRect(14, 5, 2, 2);
        cc.fillStyle = '#fff'; cc.fillRect(8, 5, 1, 1); cc.fillRect(14, 5, 1, 1);
        cc.fillStyle = '#e87070'; cc.fillRect(10, 8, 4, 1);
        cc.fillStyle = baseCol; cc.fillRect(17, 10, 4, 4);
        cc.fillStyle = lightCol; cc.fillRect(17, 10, 4, 2);
        ct.refresh();
      }
      body = this.add.image(tx, ty - 2, charKey);
      body.setDisplaySize(20, 26);
      container.add(body);
      head = body;
      animTargets = [body];
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

      const dTexKey = '_donorTex_' + d.bloodType + '_' + i;
      if (!this.textures.exists(dTexKey)) {
        const ct = this.textures.createCanvas(dTexKey, 14 * TEX_SCALE, 18 * TEX_SCALE);
        const cc = ct.getContext();
        cc.scale(TEX_SCALE, TEX_SCALE);
        const cr = (btColor >> 16) & 0xff, cg = (btColor >> 8) & 0xff, cb = btColor & 0xff;
        cc.fillStyle = 'rgba(0,0,0,0.2)';
        cc.beginPath(); cc.ellipse(7, 17, 4, 2, 0, 0, Math.PI * 2); cc.fill();
        cc.fillStyle = `rgb(${Math.max(0,cr-40)},${Math.max(0,cg-40)},${Math.max(0,cb-40)})`;
        cc.fillRect(4, 12, 3, 5); cc.fillRect(7, 12, 3, 5);
        cc.fillStyle = `rgb(${cr},${cg},${cb})`;
        cc.fillRect(3, 6, 8, 7);
        cc.fillStyle = `rgb(${Math.min(255,cr+40)},${Math.min(255,cg+40)},${Math.min(255,cb+40)})`;
        cc.fillRect(4, 7, 6, 2);
        const skins = ['#ffd5b4','#f0c8a0','#d4a574','#c68642'];
        cc.fillStyle = skins[i % skins.length];
        cc.fillRect(4, 0, 6, 6);
        const hairs = ['#222','#443322','#665544','#8b6914'];
        cc.fillStyle = hairs[i % hairs.length];
        cc.fillRect(3, 0, 8, 3);
        cc.fillStyle = '#111'; cc.fillRect(5, 3, 1, 1); cc.fillRect(8, 3, 1, 1);
        ct.refresh();
      }
      const donorSprite = this.add.image(dx + 6, y + 1, dTexKey);
      donorSprite.setDisplaySize(14, 18);
      this.donorLayer.add(donorSprite);
      this.donorDots.push(donorSprite);

      const btLabel = this.add.text(dx + 6, y + 10, d.bloodType, {
        fontSize: '6px', fontFamily: 'monospace', fontStyle: 'bold',
        color: '#fff', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      this.donorLayer.add(btLabel);
      this.donorDots.push(btLabel);

      if (d.isNamed || d.isVIP) {
        const crown = this.add.text(dx + 6, y - 10, d.isNamed ? '★' : '♛', {
          fontSize: '9px', color: '#ffd700',
        }).setOrigin(0.5);
        this.donorLayer.add(crown);
        this.donorDots.push(crown);
      }

      const barBg = this.add.graphics();
      barBg.fillStyle(0x000000, 0.5);
      barBg.fillRoundedRect(dx, y + 14, 12, 3, 1);
      barBg.fillStyle(pct < 0.3 ? 0xff0000 : 0x4ade80, 0.85);
      barBg.fillRoundedRect(dx, y + 14, 12 * pct, 3, 1);
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
    this._activeTab = 'settings';
    this.facLayer.setVisible(false);
    this.particleLayer.setVisible(false);
    this.nurseLayer.setVisible(false);
    this.donorLayer.setVisible(false);
    this.uiLayer.setVisible(false);
    if (this.bgSprite) this.bgSprite.setVisible(false);
    this.gridBg.setVisible(false);
    if (this._hintGraphics) this._hintGraphics.setVisible(false);
    this._drawInterior();
    this._playZoomTransition();
  }

  zoomOut() {
    this._zoomObjs.forEach(o => o.destroy());
    this._zoomObjs = [];
    this._zoomedFac = null;
    this.facLayer.setVisible(true);
    this.particleLayer.setVisible(true);
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
    const router = {
      bed: '_drawBedInterior', reception: '_drawReceptionInterior',
      lab: '_drawLabInterior', storage: '_drawStorageInterior',
      cold_storage: '_drawStorageInterior', lounge: '_drawLoungeInterior',
      emergency: '_drawEmergencyInterior', waiting_room: '_drawWaitingInterior',
      office: '_drawOfficeInterior', booth: '_drawBoothInterior',
      restroom: '_drawRestroomInterior', parking: '_drawParkingInterior',
      corridor: '_drawCorridorInterior', stairs: '_drawCorridorInterior',
      elevator: '_drawCorridorInterior',
    };
    const method = router[fac.id];
    if (method && this[method]) { this[method](fac); return; }
    this._drawGenericInterior(fac);
  }

  _zo(obj) { this._zoomObjs.push(obj); return obj; }

  _playZoomTransition() {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 1); overlay.fillRect(0, 0, W, H + 22);
    overlay.setAlpha(0.8);
    this._zo(overlay);
    this.tweens.add({ targets: overlay, alpha: 0, duration: 350, ease: 'Power2', onComplete: () => overlay.destroy() });
    this._zoomObjs.forEach(obj => {
      if (obj === overlay) return;
      const origAlpha = obj.alpha || 1;
      obj.setAlpha(0);
      this.tweens.add({ targets: obj, alpha: origAlpha, duration: 300, delay: 80, ease: 'Power1' });
    });
  }

  _drawInteriorBase(fac, headerColor, floorColor1, floorColor2) {
    const CW = W, CH = H + 22;
    const bg = this.add.graphics();
    bg.fillStyle(floorColor1, 1); bg.fillRect(0, 0, CW, CH);
    const floorG = this.add.graphics();
    for (let ty = 44; ty < CH; ty += 20) {
      for (let tx = 0; tx < CW; tx += 20) {
        const shade = ((tx / 20 + ty / 20) % 2 === 0) ? floorColor1 : floorColor2;
        floorG.fillStyle(shade, 1); floorG.fillRect(tx, ty, 20, 20);
        floorG.lineStyle(0.3, 0xc8c0b0, 0.25); floorG.strokeRect(tx, ty, 20, 20);
      }
    }
    this._zo(bg); this._zo(floorG);

    const wallG = this.add.graphics();
    wallG.fillStyle(0xf0e8d8, 1); wallG.fillRect(0, 40, CW, 4);
    wallG.fillStyle(0xe0d8c8, 1); wallG.fillRect(0, 36, CW, 4);
    wallG.lineStyle(1.5, 0xb0a890, 1); wallG.lineBetween(0, 44, CW, 44);
    wallG.lineStyle(0.5, 0xd0c8b8, 0.5); wallG.lineBetween(0, 36, CW, 36);
    this._zo(wallG);

    const headerBg = this.add.graphics();
    headerBg.fillStyle(headerColor, 1); headerBg.fillRect(0, 0, CW, 36);
    const lighter = headerColor + 0x1a1a1a > 0xffffff ? 0xffffff : headerColor + 0x1a1a1a;
    headerBg.fillStyle(lighter, 0.6); headerBg.fillRect(0, 0, CW, 12);
    headerBg.fillStyle(0x000000, 0.15); headerBg.fillRect(0, 30, CW, 6);
    this._zo(headerBg);

    const lvBadge = this.add.graphics();
    lvBadge.fillStyle(0x000000, 0.35); lvBadge.fillRoundedRect(CW - 50, 6, 44, 22, 11);
    lvBadge.fillStyle(0xf0c040, 1); lvBadge.fillRoundedRect(CW - 49, 7, 42, 20, 10);
    this._zo(lvBadge);
    this._zo(this.add.text(CW - 28, 17, `Lv.${fac.level}`, {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#3a2a00',
    }).setOrigin(0.5));

    this._zo(this.add.text(CW / 2 - 10, 18, `${fac.icon} ${fac.name}`, {
      fontSize: '13px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5));

    const backBtn = this.add.text(6, 18, '◀ 나가기', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffd',
      backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 6, y: 3 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => { this.zoomOut(); if (this._callbacks.onZoomOut) this._callbacks.onZoomOut(); });
    backBtn.on('pointerover', () => backBtn.setStyle({ backgroundColor: 'rgba(255,200,0,0.3)' }));
    backBtn.on('pointerout', () => backBtn.setStyle({ backgroundColor: 'rgba(0,0,0,0.5)' }));
    this._zo(backBtn);

    return { CW, CH };
  }

  _findNurse(fac) {
    const state = this._state;
    if (!state?.nurses) return null;
    return state.nurses.find(n => {
      const grid2 = state.floors[n.floor || '1F'];
      const cell = grid2?.[n.row]?.[n.col];
      return cell && (cell.uid === fac.uid || cell._ref === fac.uid);
    });
  }

  _drawNpcSlot(x, y, emoji, name, labelColor) {
    const clr = parseInt((labelColor || '#4a90d9').slice(1), 16);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.2); shadow.fillEllipse(x + 1, y + 16, 22, 6);
    this._zo(shadow);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1); g.fillCircle(x, y, 15);
    g.fillStyle(clr, 0.12); g.fillCircle(x, y, 15);
    g.lineStyle(2.5, clr, 1); g.strokeCircle(x, y, 15);
    g.fillStyle(0xffffff, 0.3); g.fillCircle(x - 4, y - 5, 4);
    this._zo(g);
    this._zo(this.add.text(x, y + 1, emoji, { fontSize: '14px' }).setOrigin(0.5));
    if (name) {
      const nb = this.add.graphics();
      nb.fillStyle(0x1a1520, 0.8); nb.fillRoundedRect(x - 24, y + 17, 48, 14, 5);
      nb.lineStyle(0.5, clr, 0.4); nb.strokeRoundedRect(x - 24, y + 17, 48, 14, 5);
      this._zo(nb);
      this._zo(this.add.text(x, y + 24, name, {
        fontSize: '7px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffd',
      }).setOrigin(0.5));
    }
  }

  _drawReceptionInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x2c5f8a, 0xe8e4dc, 0xddd8d0);
    const state = this._state;
    const g = this.add.graphics();
    g.fillStyle(0x8b6914, 1); g.fillRoundedRect(CW * 0.15, 60, CW * 0.7, 55, 6);
    g.fillStyle(0xa07820, 1); g.fillRoundedRect(CW * 0.15, 60, CW * 0.7, 20, { tl: 6, tr: 6, bl: 0, br: 0 });
    g.lineStyle(2, 0x705010, 1); g.strokeRoundedRect(CW * 0.15, 60, CW * 0.7, 55, 6);
    this._zo(g);
    this._zo(this.add.text(CW / 2, 70, '📋 접수 데스크', {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5));
    const pc = this.add.graphics();
    pc.fillStyle(0x333333, 1); pc.fillRoundedRect(CW * 0.25, 82, 30, 22, 3);
    pc.fillStyle(0x4488cc, 1); pc.fillRoundedRect(CW * 0.25 + 2, 84, 26, 16, 2);
    pc.fillStyle(0x555555, 1); pc.fillRect(CW * 0.25 + 10, 104, 10, 4);
    this._zo(pc);
    const pc2 = this.add.graphics();
    pc2.fillStyle(0x333333, 1); pc2.fillRoundedRect(CW * 0.58, 82, 30, 22, 3);
    pc2.fillStyle(0x44cc88, 1); pc2.fillRoundedRect(CW * 0.58 + 2, 84, 26, 16, 2);
    pc2.fillStyle(0x555555, 1); pc2.fillRect(CW * 0.58 + 10, 104, 10, 4);
    this._zo(pc2);

    const nurse = this._findNurse(fac);
    this._drawNpcSlot(CW * 0.35, 100, '🛡️', nurse?.charData?.name, '#4a90d9');
    this._drawNpcSlot(CW * 0.65, 100, '🛡️', null, '#4a90d9');

    const qY = 130;
    const ropG = this.add.graphics();
    ropG.lineStyle(3, 0xcc8833, 0.6);
    ropG.lineBetween(CW * 0.2, qY, CW * 0.2, qY + 100);
    ropG.lineBetween(CW * 0.8, qY, CW * 0.8, qY + 100);
    for (let i = 0; i < 4; i++) {
      ropG.lineStyle(2, 0xcc8833, 0.4);
      ropG.lineBetween(CW * 0.2, qY + 25 * i + 10, CW * 0.8, qY + 25 * i + 10);
    }
    this._zo(ropG);
    this._zo(this.add.text(CW / 2, qY + 6, '── 대기열 ──', {
      fontSize: '9px', fontFamily: 'monospace', color: '#999',
    }).setOrigin(0.5));

    const donors = state?.donors?.filter(d => d.status === 'waiting' || d.status === 'queued') || [];
    const maxQ = Math.min(donors.length, 6);
    for (let i = 0; i < maxQ; i++) {
      const dx = CW * 0.3 + (i % 3) * 60;
      const dy = qY + 30 + Math.floor(i / 3) * 35;
      const d = donors[i];
      const bClr = { A: '#e74c3c', B: '#3498db', O: '#27ae60', AB: '#f39c12' }[d.bloodType] || '#888';
      this._drawNpcSlot(dx, dy, '🧑', d.isNamed ? d.name : null, bClr);
    }
    if (donors.length === 0) {
      this._zo(this.add.text(CW / 2, qY + 55, '대기자 없음', {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(0.5));
    }
    this._drawControlTabs(fac, 248);
  }

  _drawLabInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x6a1b8a, 0xe4e8ec, 0xdce0e4);
    const state = this._state;
    const g = this.add.graphics();
    g.fillStyle(0xcccccc, 1); g.fillRoundedRect(12, 56, CW - 24, 50, 5);
    g.fillStyle(0xeeeeee, 1); g.fillRoundedRect(12, 56, CW - 24, 18, { tl: 5, tr: 5, bl: 0, br: 0 });
    g.lineStyle(1, 0x999999, 1); g.strokeRoundedRect(12, 56, CW - 24, 50, 5);
    this._zo(g);
    this._zo(this.add.text(CW / 2, 65, '🔬 실험대', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#555',
    }).setOrigin(0.5));

    const items = [
      { x: 30, emoji: '🔬', label: '현미경' },
      { x: 100, emoji: '🧪', label: '시약' },
      { x: 170, emoji: '⚗️', label: '원심분리' },
      { x: 250, emoji: '🖥️', label: '분석기' },
      { x: 330, emoji: '📊', label: '결과' },
    ];
    items.forEach(it => {
      this._zo(this.add.text(it.x, 80, it.emoji, { fontSize: '16px' }));
      this._zo(this.add.text(it.x + 10, 98, it.label, {
        fontSize: '7px', fontFamily: 'monospace', color: '#777',
      }).setOrigin(0.5));
    });

    const sampY = 116;
    const sg = this.add.graphics();
    sg.fillStyle(0xf0f4f8, 0.9); sg.fillRoundedRect(12, sampY, CW - 24, 60, 5);
    sg.lineStyle(1, 0xc0c8d0, 1); sg.strokeRoundedRect(12, sampY, CW - 24, 60, 5);
    this._zo(sg);
    this._zo(this.add.text(20, sampY + 6, '🩸 검사 중인 혈액 샘플', {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6a1b8a',
    }));
    const bTypes = ['A', 'B', 'O', 'AB'];
    const bClr = { A: 0xe74c3c, B: 0x3498db, O: 0x27ae60, AB: 0xf39c12 };
    bTypes.forEach((bt, i) => {
      const sx = 24 + i * 90;
      const amt = state?.blood?.[bt] || 0;
      const tg = this.add.graphics();
      tg.fillStyle(bClr[bt], 0.2); tg.fillRoundedRect(sx, sampY + 24, 78, 28, 4);
      tg.lineStyle(1, bClr[bt], 0.5); tg.strokeRoundedRect(sx, sampY + 24, 78, 28, 4);
      this._zo(tg);
      this._zo(this.add.text(sx + 6, sampY + 30, `🧪 ${bt}형`, {
        fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold',
        color: '#' + bClr[bt].toString(16).padStart(6, '0'),
      }));
      this._zo(this.add.text(sx + 6, sampY + 42, `${amt}팩`, {
        fontSize: '8px', fontFamily: 'monospace', color: '#666',
      }));
    });

    const nurse = this._findNurse(fac);
    this._drawNpcSlot(CW * 0.3, 205, '🔍', nurse?.charData?.name, '#8e44ad');
    this._drawNpcSlot(CW * 0.7, 205, '🔍', null, '#8e44ad');

    this._drawControlTabs(fac, 240);
  }

  _drawStorageInterior(fac) {
    const isCold = fac.id === 'cold_storage';
    const { CW, CH } = this._drawInteriorBase(fac,
      isCold ? 0x005566 : 0x1a5276,
      isCold ? 0xd0e8f0 : 0xe0dcd4,
      isCold ? 0xc4dce8 : 0xd8d4cc
    );
    const state = this._state;

    const shelfY = 56;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const sx = 14 + col * 130, sy = shelfY + row * 74;
        const sg = this.add.graphics();
        sg.fillStyle(isCold ? 0x88bbcc : 0x8b7355, 1);
        sg.fillRoundedRect(sx, sy, 120, 66, 4);
        sg.fillStyle(isCold ? 0xaaddee : 0xa08860, 1);
        sg.fillRoundedRect(sx + 2, sy + 2, 116, 18, 3);
        sg.fillRoundedRect(sx + 2, sy + 24, 116, 18, 3);
        sg.fillRoundedRect(sx + 2, sy + 46, 116, 18, 3);
        sg.lineStyle(1, isCold ? 0x668899 : 0x6b5335, 1);
        sg.strokeRoundedRect(sx, sy, 120, 66, 4);
        this._zo(sg);

        const bloodBags = Math.floor(Math.random() * 5);
        for (let b = 0; b < bloodBags; b++) {
          const bx = sx + 8 + b * 22;
          this._zo(this.add.text(bx, sy + 6, '🩸', { fontSize: '10px' }));
        }
      }
    }

    const tempY = 210;
    const tG = this.add.graphics();
    tG.fillStyle(0x1a1a2e, 0.9); tG.fillRoundedRect(12, tempY, CW - 24, 32, 5);
    tG.lineStyle(1, 0x3a3060, 1); tG.strokeRoundedRect(12, tempY, CW - 24, 32, 5);
    this._zo(tG);
    const temp = isCold ? '-80°C' : '4°C';
    const bloodTotal = state ? Object.values(state.blood).reduce((s, v) => s + v, 0) : 0;
    const maxSto = state?.maxStorage || 25;
    this._zo(this.add.text(20, tempY + 8, `🌡️ ${temp}`, {
      fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: isCold ? '#44ddff' : '#44ff88',
    }));
    this._zo(this.add.text(CW - 20, tempY + 8, `📦 ${bloodTotal}/${maxSto}팩`, {
      fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f0c040',
    }).setOrigin(1, 0));

    const nurse = this._findNurse(fac);
    if (nurse) this._drawNpcSlot(CW * 0.5, tempY + 52, '📦', nurse.charData?.name, '#2980b9');

    this._drawControlTabs(fac, 260);
  }

  _drawLoungeInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x1a7a4a, 0xe8e0d0, 0xdcd4c4);
    const state = this._state;

    const sofaG = this.add.graphics();
    sofaG.fillStyle(0x6b4423, 1); sofaG.fillRoundedRect(20, 60, CW * 0.55, 45, 8);
    sofaG.fillStyle(0x7a5030, 1); sofaG.fillRoundedRect(22, 62, CW * 0.55 - 4, 18, 6);
    sofaG.fillStyle(0x5a3418, 1);
    sofaG.fillRoundedRect(20, 60, 12, 45, { tl: 8, tr: 0, bl: 8, br: 0 });
    sofaG.fillRoundedRect(20 + CW * 0.55 - 12, 60, 12, 45, { tl: 0, tr: 8, bl: 0, br: 8 });
    this._zo(sofaG);
    this._zo(this.add.text(20 + CW * 0.275, 88, '🛋️ 소파', {
      fontSize: '9px', fontFamily: 'monospace', color: '#a08060',
    }).setOrigin(0.5));

    const tvG = this.add.graphics();
    tvG.fillStyle(0x222222, 1); tvG.fillRoundedRect(CW * 0.65, 56, CW * 0.28, 50, 4);
    tvG.fillStyle(0x3366aa, 1); tvG.fillRoundedRect(CW * 0.65 + 3, 59, CW * 0.28 - 6, 40, 3);
    tvG.fillStyle(0x333333, 1); tvG.fillRect(CW * 0.65 + CW * 0.14 - 4, 106, 8, 6);
    this._zo(tvG);
    this._zo(this.add.text(CW * 0.65 + CW * 0.14, 76, '📺', { fontSize: '18px' }).setOrigin(0.5));

    const vendG = this.add.graphics();
    vendG.fillStyle(0xcc3333, 1); vendG.fillRoundedRect(CW * 0.7, 120, 60, 80, 5);
    vendG.fillStyle(0xdd5555, 1); vendG.fillRoundedRect(CW * 0.7 + 4, 124, 52, 30, 3);
    vendG.fillStyle(0xee8888, 1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      vendG.fillCircle(CW * 0.7 + 10 + c * 13, 130 + r * 8, 3);
    }
    vendG.fillStyle(0x222222, 1); vendG.fillRoundedRect(CW * 0.7 + 4, 158, 52, 36, 3);
    this._zo(vendG);
    this._zo(this.add.text(CW * 0.7 + 30, 175, '🥤', { fontSize: '14px' }).setOrigin(0.5));

    const tableG = this.add.graphics();
    tableG.fillStyle(0xc8a878, 1); tableG.fillRoundedRect(30, 120, 100, 50, 5);
    tableG.lineStyle(1, 0xa88850, 1); tableG.strokeRoundedRect(30, 120, 100, 50, 5);
    this._zo(tableG);
    this._zo(this.add.text(50, 135, '☕', { fontSize: '14px' }));
    this._zo(this.add.text(90, 135, '🍪', { fontSize: '14px' }));

    const donors = state?.donors?.filter(d => d.status === 'resting') || [];
    const restSlots = Math.min(donors.length, 3);
    for (let i = 0; i < restSlots; i++) {
      const d = donors[i];
      this._drawNpcSlot(50 + i * 50, 196, '😌', d.isNamed ? d.name : null, '#27ae60');
    }
    if (donors.length === 0) {
      this._zo(this.add.text(80, 190, '쉬는 사람 없음', {
        fontSize: '10px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(0.5));
    }

    const nurse = this._findNurse(fac);
    if (nurse) this._drawNpcSlot(CW * 0.4, 220, '💬', nurse.charData?.name, '#27ae60');

    this._drawControlTabs(fac, 248);
  }

  _drawEmergencyInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0xaa3311, 0xf0e8e0, 0xe8e0d8);
    const state = this._state;

    const bedG = this.add.graphics();
    bedG.fillStyle(0x888888, 1);
    bedG.fillRect(28, 90, 4, 10); bedG.fillRect(CW * 0.52, 90, 4, 10);
    bedG.fillRect(28, 150, 4, 10); bedG.fillRect(CW * 0.52, 150, 4, 10);
    bedG.fillStyle(0xdce8f0, 1); bedG.fillRoundedRect(24, 60, CW * 0.52, 95, 5);
    bedG.lineStyle(1.5, 0xb0c8d8, 1); bedG.strokeRoundedRect(24, 60, CW * 0.52, 95, 5);
    bedG.fillStyle(0xc8dce8, 1); bedG.fillRoundedRect(28, 66, 26, 80, 8);
    this._zo(bedG);
    this._zo(this.add.text(24 + CW * 0.26, 105, '🛏️ 응급 침대', {
      fontSize: '9px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5));

    const defiG = this.add.graphics();
    defiG.fillStyle(0xeecc22, 1); defiG.fillRoundedRect(CW * 0.6, 60, 70, 50, 6);
    defiG.lineStyle(2, 0xcc9900, 1); defiG.strokeRoundedRect(CW * 0.6, 60, 70, 50, 6);
    defiG.fillStyle(0x333333, 1); defiG.fillRoundedRect(CW * 0.6 + 8, 66, 54, 30, 3);
    defiG.fillStyle(0x22cc22, 1); defiG.fillCircle(CW * 0.6 + 35, 100, 5);
    this._zo(defiG);
    this._zo(this.add.text(CW * 0.6 + 35, 80, '⚡', { fontSize: '14px' }).setOrigin(0.5));
    this._zo(this.add.text(CW * 0.6 + 35, 115, '제세동기', {
      fontSize: '7px', fontFamily: 'monospace', color: '#666',
    }).setOrigin(0.5));

    const oxyG = this.add.graphics();
    oxyG.fillStyle(0x228844, 1); oxyG.fillRoundedRect(CW * 0.6, 125, 34, 55, 5);
    oxyG.lineStyle(1, 0x116633, 1); oxyG.strokeRoundedRect(CW * 0.6, 125, 34, 55, 5);
    oxyG.fillStyle(0x44aa66, 1); oxyG.fillCircle(CW * 0.6 + 17, 140, 8);
    this._zo(oxyG);
    this._zo(this.add.text(CW * 0.6 + 17, 140, '🫁', { fontSize: '10px' }).setOrigin(0.5));
    this._zo(this.add.text(CW * 0.6 + 17, 185, 'O₂', {
      fontSize: '8px', fontFamily: 'monospace', fontStyle: 'bold', color: '#228844',
    }).setOrigin(0.5));

    const kitG = this.add.graphics();
    kitG.fillStyle(0xcc2222, 1); kitG.fillRoundedRect(CW * 0.8, 125, 50, 35, 5);
    kitG.fillStyle(0xffffff, 1);
    kitG.fillRect(CW * 0.8 + 20, 130, 10, 25);
    kitG.fillRect(CW * 0.8 + 13, 138, 24, 10);
    this._zo(kitG);
    this._zo(this.add.text(CW * 0.8 + 25, 166, '구급함', {
      fontSize: '7px', fontFamily: 'monospace', color: '#cc2222',
    }).setOrigin(0.5));

    const statusG = this.add.graphics();
    statusG.fillStyle(0x1a1520, 0.9); statusG.fillRoundedRect(12, 200, CW - 24, 28, 5);
    this._zo(statusG);
    const incidents = state?.incidents || 0;
    this._zo(this.add.text(20, 206, `🚨 부작용 발생: ${incidents}건`, {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff6644',
    }));
    this._zo(this.add.text(CW - 20, 206, '대기 중 ✅', {
      fontSize: '10px', fontFamily: 'monospace', color: '#44cc66',
    }).setOrigin(1, 0));

    const nurse = this._findNurse(fac);
    if (nurse) this._drawNpcSlot(CW * 0.5, 252, '👩‍⚕️', nurse.charData?.name, '#e67e22');

    this._drawControlTabs(fac, 270);
  }

  _drawWaitingInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x2471a3, 0xe4e0d8, 0xdcd8d0);
    const state = this._state;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const cx = 20 + col * 95, cy = 60 + row * 70;
        const cG = this.add.graphics();
        cG.fillStyle(0x5588aa, 1); cG.fillRoundedRect(cx, cy, 38, 36, 4);
        cG.fillStyle(0x6699bb, 1); cG.fillRoundedRect(cx, cy, 38, 12, { tl: 4, tr: 4, bl: 0, br: 0 });
        cG.lineStyle(1, 0x447799, 1); cG.strokeRoundedRect(cx, cy, 38, 36, 4);
        cG.fillStyle(0x5588aa, 1); cG.fillRect(cx + 2, cy + 36, 6, 8);
        cG.fillRect(cx + 30, cy + 36, 6, 8);
        this._zo(cG);
      }
    }

    const magG = this.add.graphics();
    magG.fillStyle(0xc8a878, 1); magG.fillRoundedRect(CW * 0.7, 58, 80, 60, 5);
    magG.lineStyle(1, 0xa88850, 1); magG.strokeRoundedRect(CW * 0.7, 58, 80, 60, 5);
    this._zo(magG);
    this._zo(this.add.text(CW * 0.7 + 40, 72, '📚 잡지', {
      fontSize: '9px', fontFamily: 'monospace', color: '#8a7a5a',
    }).setOrigin(0.5));
    for (let i = 0; i < 4; i++) {
      const colors = ['📕', '📗', '📘', '📙'];
      this._zo(this.add.text(CW * 0.7 + 8 + i * 18, 88, colors[i], { fontSize: '14px' }));
    }

    const wG = this.add.graphics();
    wG.fillStyle(0xaaddff, 0.3); wG.fillRoundedRect(CW * 0.7, 130, 80, 50, 5);
    wG.lineStyle(1, 0x88bbdd, 0.5); wG.strokeRoundedRect(CW * 0.7, 130, 80, 50, 5);
    this._zo(wG);
    this._zo(this.add.text(CW * 0.7 + 40, 145, '💧', { fontSize: '16px' }).setOrigin(0.5));
    this._zo(this.add.text(CW * 0.7 + 40, 168, '정수기', {
      fontSize: '8px', fontFamily: 'monospace', color: '#6699bb',
    }).setOrigin(0.5));

    const donors = state?.donors?.filter(d => d.status === 'waiting' || d.status === 'queued') || [];
    const maxD = Math.min(donors.length, 8);
    for (let i = 0; i < maxD; i++) {
      const row = Math.floor(i / 4), col = i % 4;
      const dx = 28 + col * 95, dy = 75 + row * 70;
      const d = donors[i];
      this._drawNpcSlot(dx + 19, dy + 6, '🧑', d.isNamed ? d.name : null, '#5dade2');
    }
    if (donors.length === 0) {
      this._zo(this.add.text(CW * 0.35, 105, '대기자 없음', {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(0.5));
    }

    this._drawControlTabs(fac, 248);
  }

  _drawOfficeInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x5d4037, 0xe8e4dc, 0xe0dcd4);

    const deskG = this.add.graphics();
    deskG.fillStyle(0x8d6e63, 1); deskG.fillRoundedRect(CW * 0.1, 60, CW * 0.5, 50, 5);
    deskG.fillStyle(0x9e8070, 1); deskG.fillRoundedRect(CW * 0.1, 60, CW * 0.5, 16, { tl: 5, tr: 5, bl: 0, br: 0 });
    deskG.lineStyle(1, 0x6d4e3d, 1); deskG.strokeRoundedRect(CW * 0.1, 60, CW * 0.5, 50, 5);
    this._zo(deskG);
    const pcG = this.add.graphics();
    pcG.fillStyle(0x333333, 1); pcG.fillRoundedRect(CW * 0.18, 68, 50, 32, 3);
    pcG.fillStyle(0x4488cc, 1); pcG.fillRoundedRect(CW * 0.18 + 3, 70, 44, 26, 2);
    pcG.fillStyle(0x555555, 1); pcG.fillRect(CW * 0.18 + 18, 100, 14, 5);
    this._zo(pcG);
    this._zo(this.add.text(CW * 0.43, 78, '📋', { fontSize: '14px' }));
    this._zo(this.add.text(CW * 0.5, 78, '✏️', { fontSize: '12px' }));

    const chairG = this.add.graphics();
    chairG.fillStyle(0x444444, 1); chairG.fillCircle(CW * 0.3, 128, 14);
    chairG.fillStyle(0x555555, 1); chairG.fillRoundedRect(CW * 0.3 - 10, 115, 20, 12, 3);
    this._zo(chairG);

    const cabinetG = this.add.graphics();
    cabinetG.fillStyle(0x888888, 1); cabinetG.fillRoundedRect(CW * 0.68, 56, 100, 100, 5);
    cabinetG.lineStyle(1, 0x666666, 1); cabinetG.strokeRoundedRect(CW * 0.68, 56, 100, 100, 5);
    for (let i = 0; i < 4; i++) {
      cabinetG.fillStyle(0x999999, 1); cabinetG.fillRoundedRect(CW * 0.68 + 4, 60 + i * 24, 92, 20, 2);
      cabinetG.fillStyle(0xaaaaaa, 1); cabinetG.fillRect(CW * 0.68 + 40, 66 + i * 24, 20, 8);
    }
    this._zo(cabinetG);
    this._zo(this.add.text(CW * 0.68 + 50, 160, '서류 캐비넷', {
      fontSize: '7px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5));

    const certG = this.add.graphics();
    certG.fillStyle(0xf5e6c8, 1); certG.fillRoundedRect(CW * 0.15, 165, 90, 55, 4);
    certG.lineStyle(2, 0xc8a060, 1); certG.strokeRoundedRect(CW * 0.15, 165, 90, 55, 4);
    this._zo(certG);
    this._zo(this.add.text(CW * 0.15 + 45, 182, '🏆 인증서', {
      fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#8b6914',
    }).setOrigin(0.5));
    this._zo(this.add.text(CW * 0.15 + 45, 200, '헌혈의집 운영허가', {
      fontSize: '7px', fontFamily: 'monospace', color: '#a08050',
    }).setOrigin(0.5));

    const nurse = this._findNurse(fac);
    if (nurse) this._drawNpcSlot(CW * 0.3, 150, '🏢', nurse.charData?.name, '#8d6e63');

    this._drawControlTabs(fac, 235);
  }

  _drawBoothInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0xb8860b, 0xf0e8d8, 0xe8e0d0);

    const bannerG = this.add.graphics();
    bannerG.fillStyle(0xcc2222, 1); bannerG.fillRoundedRect(CW * 0.1, 54, CW * 0.8, 40, 6);
    bannerG.lineStyle(2, 0xaa1111, 1); bannerG.strokeRoundedRect(CW * 0.1, 54, CW * 0.8, 40, 6);
    this._zo(bannerG);
    this._zo(this.add.text(CW / 2, 74, '🩸 헌혈하면 생명을 살립니다! 🩸', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#fff',
    }).setOrigin(0.5));

    const tableG = this.add.graphics();
    tableG.fillStyle(0xcc8833, 1); tableG.fillRoundedRect(CW * 0.15, 104, CW * 0.7, 40, 5);
    tableG.fillStyle(0xdd9944, 1); tableG.fillRoundedRect(CW * 0.15, 104, CW * 0.7, 15, { tl: 5, tr: 5, bl: 0, br: 0 });
    tableG.lineStyle(1, 0xaa6620, 1); tableG.strokeRoundedRect(CW * 0.15, 104, CW * 0.7, 40, 5);
    this._zo(tableG);
    this._zo(this.add.text(CW * 0.25, 120, '📄', { fontSize: '16px' }));
    this._zo(this.add.text(CW * 0.4, 118, '팜플렛', { fontSize: '8px', fontFamily: 'monospace', color: '#ffd' }));
    this._zo(this.add.text(CW * 0.6, 120, '🎁', { fontSize: '16px' }));
    this._zo(this.add.text(CW * 0.72, 118, '기념품', { fontSize: '8px', fontFamily: 'monospace', color: '#ffd' }));

    const megaG = this.add.graphics();
    megaG.fillStyle(0xf5e6c8, 0.8); megaG.fillRoundedRect(CW * 0.2, 156, CW * 0.6, 50, 6);
    megaG.lineStyle(1, 0xd0c0a0, 1); megaG.strokeRoundedRect(CW * 0.2, 156, CW * 0.6, 50, 6);
    this._zo(megaG);
    this._zo(this.add.text(CW / 2, 172, '📣 홍보 활동', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#b8860b',
    }).setOrigin(0.5));
    const fame = this._state?.fame || 0;
    this._zo(this.add.text(CW / 2, 190, `명성: ${fame} · 다음날 헌혈자 +3`, {
      fontSize: '9px', fontFamily: 'monospace', color: '#888',
    }).setOrigin(0.5));

    const nurse = this._findNurse(fac);
    if (nurse) this._drawNpcSlot(CW * 0.5, 230, '📣', nurse.charData?.name, '#f39c12');

    this._drawControlTabs(fac, 255);
  }

  _drawRestroomInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x2e7d32, 0xe4e8e4, 0xdce0dc);

    for (let i = 0; i < 3; i++) {
      const sx = 20 + i * 130;
      const stG = this.add.graphics();
      stG.fillStyle(0xd0d0d0, 1); stG.fillRoundedRect(sx, 56, 110, 80, 5);
      stG.lineStyle(1.5, 0xaaaaaa, 1); stG.strokeRoundedRect(sx, 56, 110, 80, 5);
      stG.fillStyle(0xbbbbbb, 1); stG.fillRect(sx + 50, 72, 14, 22);
      stG.fillStyle(0xcccccc, 1); stG.fillCircle(sx + 57, 68, 5);
      this._zo(stG);
      this._zo(this.add.text(sx + 55, 108, '🚽', { fontSize: '14px' }).setOrigin(0.5));
      const occupied = Math.random() > 0.5;
      this._zo(this.add.text(sx + 55, 125, occupied ? '🔴 사용중' : '🟢 비어있음', {
        fontSize: '7px', fontFamily: 'monospace', color: occupied ? '#cc4444' : '#44aa44',
      }).setOrigin(0.5));
    }

    const sinkY = 150;
    const sinkG = this.add.graphics();
    sinkG.fillStyle(0xeeeeee, 1); sinkG.fillRoundedRect(20, sinkY, CW - 40, 40, 5);
    sinkG.lineStyle(1, 0xcccccc, 1); sinkG.strokeRoundedRect(20, sinkY, CW - 40, 40, 5);
    this._zo(sinkG);
    for (let i = 0; i < 4; i++) {
      const sx = 40 + i * 88;
      this._zo(this.add.text(sx, sinkY + 10, '🚰', { fontSize: '16px' }));
    }
    this._zo(this.add.text(CW / 2, sinkY + 35, '── 세면대 ──', {
      fontSize: '8px', fontFamily: 'monospace', color: '#aaa',
    }).setOrigin(0.5));

    const mirG = this.add.graphics();
    mirG.fillStyle(0xaaddff, 0.3); mirG.fillRoundedRect(30, sinkY - 8, CW - 60, 8, 2);
    mirG.lineStyle(1, 0x88bbdd, 0.5); mirG.strokeRoundedRect(30, sinkY - 8, CW - 60, 8, 2);
    this._zo(mirG);

    this._drawControlTabs(fac, 210);
  }

  _drawParkingInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x263238, 0xc0c0c0, 0xb8b8b8);

    const pg = this.add.graphics();
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const px = 18 + col * 128, py = 58 + row * 82;
        pg.lineStyle(2, 0xffffff, 0.6);
        pg.strokeRect(px, py, 115, 70);
        pg.lineStyle(1, 0xffff00, 0.3);
        pg.lineBetween(px + 2, py + 35, px + 113, py + 35);
      }
    }
    this._zo(pg);

    const cars = ['🚗', '🚙', '🚕', '🏎️', '🚐'];
    const parkedCount = Math.min(3 + Math.floor(Math.random() * 3), 5);
    for (let i = 0; i < parkedCount; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const cx = 18 + col * 128 + 57, cy = 58 + row * 82 + 35;
      this._zo(this.add.text(cx, cy, cars[i % cars.length], { fontSize: '24px' }).setOrigin(0.5));
    }
    for (let i = parkedCount; i < 6; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      const cx = 18 + col * 128 + 57, cy = 58 + row * 82 + 35;
      this._zo(this.add.text(cx, cy, 'P', {
        fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', color: '#666',
      }).setOrigin(0.5));
    }

    const infoG = this.add.graphics();
    infoG.fillStyle(0x1a1a2e, 0.9); infoG.fillRoundedRect(12, 228, CW - 24, 24, 5);
    this._zo(infoG);
    this._zo(this.add.text(20, 234, `🅿️ 주차: ${parkedCount}/6대  · 일일 헌혈자 +5`, {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#80cbc4',
    }));

    this._drawControlTabs(fac, 260);
  }

  _drawCorridorInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac,
      fac.id === 'stairs' ? 0x5d4037 : fac.id === 'elevator' ? 0x37474f : 0x607d8b,
      0xe0dcd4, 0xd8d4cc
    );

    if (fac.id === 'corridor') {
      const g = this.add.graphics();
      for (let i = 0; i < CW; i += 20) {
        g.fillStyle(i % 40 === 0 ? 0xd0c8b8 : 0xc8c0b0, 1);
        g.fillRect(i, 60, 20, 120);
      }
      g.lineStyle(2, 0xa09880, 1);
      g.lineBetween(0, 60, CW, 60);
      g.lineBetween(0, 180, CW, 180);
      g.lineStyle(1, 0xb0a890, 0.5);
      g.lineBetween(20, 120, CW - 20, 120);
      this._zo(g);
      this._zo(this.add.text(CW / 2, 120, '🚶 ← 이동 통로 →', {
        fontSize: '12px', fontFamily: 'monospace', color: '#888',
      }).setOrigin(0.5));
      const arrows = this.add.graphics();
      arrows.lineStyle(2, 0x888888, 0.5);
      for (let i = 0; i < 5; i++) {
        const ax = 40 + i * 80;
        arrows.lineBetween(ax, 110, ax + 12, 120);
        arrows.lineBetween(ax + 12, 120, ax, 130);
      }
      this._zo(arrows);
    } else if (fac.id === 'stairs') {
      const g = this.add.graphics();
      for (let i = 0; i < 8; i++) {
        const shade = 0xb0a090 - i * 0x080808;
        g.fillStyle(shade, 1);
        g.fillRect(CW * 0.15, 60 + i * 18, CW * 0.7, 16);
        g.lineStyle(1, 0x908070, 1);
        g.strokeRect(CW * 0.15, 60 + i * 18, CW * 0.7, 16);
      }
      this._zo(g);
      const railG = this.add.graphics();
      railG.lineStyle(3, 0x888888, 0.8);
      railG.lineBetween(CW * 0.15, 60, CW * 0.15, 204);
      railG.lineBetween(CW * 0.85, 60, CW * 0.85, 204);
      for (let i = 0; i < 8; i++) {
        railG.lineStyle(2, 0x999999, 0.5);
        railG.lineBetween(CW * 0.15, 68 + i * 18, CW * 0.15, 60 + i * 18);
        railG.lineBetween(CW * 0.85, 68 + i * 18, CW * 0.85, 60 + i * 18);
      }
      this._zo(railG);
      this._zo(this.add.text(CW / 2, 130, '🪜 계단', {
        fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#888',
      }).setOrigin(0.5));
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x888888, 1); g.fillRoundedRect(CW * 0.15, 56, CW * 0.7, 140, 8);
      g.fillStyle(0x999999, 1); g.fillRoundedRect(CW * 0.15 + 4, 60, CW * 0.7 - 8, 132, 6);
      g.lineStyle(2, 0x666666, 1); g.strokeRoundedRect(CW * 0.15, 56, CW * 0.7, 140, 8);
      g.fillStyle(0x777777, 1);
      g.fillRect(CW / 2 - 2, 60, 4, 132);
      this._zo(g);
      this._zo(this.add.text(CW / 2, 100, '🛗', { fontSize: '28px' }).setOrigin(0.5));
      const floorDisp = this.add.graphics();
      floorDisp.fillStyle(0x222222, 1); floorDisp.fillRoundedRect(CW / 2 - 20, 130, 40, 20, 4);
      this._zo(floorDisp);
      this._zo(this.add.text(CW / 2, 140, fac.floor || '1F', {
        fontSize: '11px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ff4444',
      }).setOrigin(0.5));
      this._zo(this.add.text(CW / 2, 165, '▲ ▼', {
        fontSize: '14px', fontFamily: 'monospace', color: '#aaa',
      }).setOrigin(0.5));
    }

    this._drawControlTabs(fac, 220);
  }

  _drawBedInterior(fac) {
    const { CW, CH } = this._drawInteriorBase(fac, 0x8b1a1a, 0xede5d8, 0xe5ddd0);

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

    this._drawControlTabs(fac, corrY + 40);
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

    const desc = this.add.text(CW / 2, 120, `${fac.icon}\n\n${fac.name} 내부 뷰\n(준비 중)`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#666', align: 'center',
    }).setOrigin(0.5);
    this._zo(desc);

    this._drawControlTabs(fac, 200);
  }

  _drawControlTabs(fac, startY) {
    const CW = W;
    const tabW = Math.floor((CW - 16) / 3);
    const tabH = 32;
    const panelH = 200;
    const px = 6, py = startY;

    if (!this._activeTab) this._activeTab = 'settings';
    const tabs = [
      { key: 'settings', label: '⚙️ 설정', color: 0x6c5ce7 },
      { key: 'upgrade', label: '📈 업그레이드', color: 0xfdcb6e },
      { key: 'stats', label: '📊 통계', color: 0x00cec9 },
    ];

    const tabBg = this.add.graphics();
    tabBg.fillStyle(0x14101e, 0.96);
    tabBg.fillRoundedRect(px, py, CW - 12, tabH + panelH, 10);
    tabBg.lineStyle(1.5, 0x2d2850, 1);
    tabBg.strokeRoundedRect(px, py, CW - 12, tabH + panelH, 10);
    tabBg.fillStyle(0x1a1530, 0.5);
    tabBg.fillRoundedRect(px + 1, py + 1, CW - 14, tabH, { tl: 10, tr: 10, bl: 0, br: 0 });
    this._zo(tabBg);

    tabs.forEach((tab, i) => {
      const tx = px + 3 + i * tabW;
      const active = this._activeTab === tab.key;
      const tG = this.add.graphics();
      if (active) {
        tG.fillStyle(tab.color, 0.15);
        tG.fillRoundedRect(tx, py + 3, tabW - 4, tabH - 4, { tl: 8, tr: 8, bl: 0, br: 0 });
        tG.fillStyle(tab.color, 1);
        tG.fillRect(tx + 8, py + tabH - 3, tabW - 20, 3);
      }
      this._zo(tG);
      const tLabel = this.add.text(tx + tabW / 2, py + tabH / 2, tab.label, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: active ? 'bold' : '',
        color: active ? '#fff' : '#666',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      tLabel.on('pointerdown', () => {
        this._activeTab = tab.key;
        this._drawInterior();
      });
      this._zo(tLabel);
    });

    const divG = this.add.graphics();
    divG.lineStyle(1, 0x2d2850, 0.8);
    divG.lineBetween(px + 6, py + tabH, px + CW - 18, py + tabH);
    this._zo(divG);

    const contentY = py + tabH + 8;
    const contentW = CW - 24;
    if (this._activeTab === 'settings') {
      this._drawTabSettings(fac, px + 6, contentY, contentW, panelH - tabH - 16);
    } else if (this._activeTab === 'upgrade') {
      this._drawTabUpgrade(fac, px + 6, contentY, contentW, panelH - tabH - 16);
    } else {
      this._drawTabStats(fac, px + 6, contentY, contentW, panelH - tabH - 16);
    }
  }

  _drawTabSettings(fac, x, y, w, h) {
    const settings = FAC_SETTINGS[fac.id] || FAC_SETTINGS._default;
    let cy = y;

    settings.forEach((s) => {
      if (cy + 36 > y + h) return;

      const rowBg = this.add.graphics();
      rowBg.fillStyle(0x1a1530, 0.4); rowBg.fillRoundedRect(x - 2, cy - 2, w + 4, 32, 5);
      this._zo(rowBg);

      this._zo(this.add.text(x + 2, cy + 2, s.label, {
        fontSize: '9px', fontFamily: 'monospace', color: '#b8b0cc',
      }));

      if (s.type === 'slider') {
        const val = fac[s.key] ?? s.default;
        const barX = x + 18, barY = cy + 18, barW = w - 80;
        const sG = this.add.graphics();
        sG.fillStyle(0x2a2540, 1); sG.fillRoundedRect(barX, barY, barW, 10, 5);
        const pct = (val - s.min) / (s.max - s.min);
        sG.fillStyle(0x6c5ce7, 1); sG.fillRoundedRect(barX, barY, barW * pct, 10, 5);
        sG.fillStyle(0xffffff, 1); sG.fillCircle(barX + barW * pct, barY + 5, 6);
        sG.lineStyle(1.5, 0x6c5ce7, 1); sG.strokeCircle(barX + barW * pct, barY + 5, 6);
        this._zo(sG);
        this._zo(this.add.text(barX + barW + 12, barY + 5, `${val}${s.unit || ''}`, {
          fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: '#a29bfe',
        }).setOrigin(0, 0.5));

        const hitMinus = this.add.text(barX - 6, barY + 5, '−', {
          fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6c5ce7',
          backgroundColor: 'rgba(108,92,231,0.15)', padding: { x: 3, y: 0 },
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        hitMinus.on('pointerdown', () => {
          const nv = Math.max(s.min, (fac[s.key] ?? s.default) - s.step);
          fac[s.key] = nv;
          if (this._callbacks.onSettingChange) this._callbacks.onSettingChange(fac, s.key, nv);
          this._drawInterior();
        });
        this._zo(hitMinus);
        const hitPlus = this.add.text(x + w + 2, barY + 5, '+', {
          fontSize: '12px', fontFamily: 'monospace', fontStyle: 'bold', color: '#6c5ce7',
          backgroundColor: 'rgba(108,92,231,0.15)', padding: { x: 3, y: 0 },
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        hitPlus.on('pointerdown', () => {
          const nv = Math.min(s.max, (fac[s.key] ?? s.default) + s.step);
          fac[s.key] = nv;
          if (this._callbacks.onSettingChange) this._callbacks.onSettingChange(fac, s.key, nv);
          this._drawInterior();
        });
        this._zo(hitPlus);
      } else if (s.type === 'toggle') {
        const val = fac[s.key] ?? s.default;
        const tgX = x + w - 40, tgY = cy + 6;
        const tgG = this.add.graphics();
        tgG.fillStyle(val ? 0x00b894 : 0x2d2850, 1);
        tgG.fillRoundedRect(tgX, tgY, 36, 18, 9);
        if (val) { tgG.fillStyle(0x00b894, 0.3); tgG.fillRoundedRect(tgX - 2, tgY - 2, 40, 22, 11); }
        tgG.fillStyle(0xffffff, 1);
        tgG.fillCircle(val ? tgX + 27 : tgX + 9, tgY + 9, 7);
        tgG.lineStyle(1, val ? 0x00b894 : 0x444466, 1);
        tgG.strokeCircle(val ? tgX + 27 : tgX + 9, tgY + 9, 7);
        this._zo(tgG);
        const tgHit = this.add.zone(tgX - 2, tgY - 2, 40, 22).setOrigin(0).setInteractive({ useHandCursor: true });
        tgHit.on('pointerdown', () => {
          fac[s.key] = !(fac[s.key] ?? s.default);
          if (this._callbacks.onSettingChange) this._callbacks.onSettingChange(fac, s.key, fac[s.key]);
          this._drawInterior();
        });
        this._zo(tgHit);
      }
      cy += 38;
    });
  }

  _drawTabUpgrade(fac, x, y, w, h) {
    const upgrades = FAC_UPGRADES[fac.id] || FAC_UPGRADES._default;
    let cy = y;

    upgrades.forEach((u, i) => {
      if (cy + 38 > y + h) return;
      const owned = (fac.upgrades || []).includes(u.id);
      const rowG = this.add.graphics();
      rowG.fillStyle(owned ? 0x1a3020 : 0x222233, 0.8);
      rowG.fillRoundedRect(x, cy, w, 34, 5);
      rowG.lineStyle(1, owned ? 0x27ae60 : 0x3a3060, 0.6);
      rowG.strokeRoundedRect(x, cy, w, 34, 5);
      this._zo(rowG);

      this._zo(this.add.text(x + 6, cy + 8, `${u.icon} ${u.name}`, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold',
        color: owned ? '#8f8' : '#ddd',
      }));
      this._zo(this.add.text(x + 6, cy + 22, u.desc, {
        fontSize: '8px', fontFamily: 'monospace', color: '#999',
      }));

      if (owned) {
        this._zo(this.add.text(x + w - 6, cy + 17, '✓', {
          fontSize: '14px', fontFamily: 'monospace', fontStyle: 'bold', color: '#4f4',
        }).setOrigin(1, 0.5));
      } else {
        const costBtn = this.add.text(x + w - 6, cy + 17, `💰${u.cost}`, {
          fontSize: '9px', fontFamily: 'monospace', fontStyle: 'bold', color: '#f0c040',
          backgroundColor: 'rgba(60,50,20,0.8)', padding: { x: 4, y: 2 },
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        costBtn.on('pointerdown', () => {
          if (this._callbacks.onUpgrade) this._callbacks.onUpgrade(fac, u);
        });
        this._zo(costBtn);
      }
      cy += 38;
    });
  }

  _drawTabStats(fac, x, y, w, h) {
    const state = this._state;
    const stats = this._getFacStats(fac, state);
    let cy = y;

    stats.forEach((s) => {
      if (cy + 28 > y + h) return;
      this._zo(this.add.text(x, cy, s.label, {
        fontSize: '9px', fontFamily: 'monospace', color: '#999',
      }));
      this._zo(this.add.text(x + w, cy, s.value, {
        fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold', color: s.color || '#fff',
      }).setOrigin(1, 0));

      if (s.bar !== undefined) {
        const barY = cy + 14;
        const bG = this.add.graphics();
        bG.fillStyle(0x333344, 1); bG.fillRoundedRect(x, barY, w, 6, 3);
        const bColor = s.bar > 0.7 ? 0x27ae60 : s.bar > 0.4 ? 0xf0c040 : 0xe74c3c;
        bG.fillStyle(bColor, 1); bG.fillRoundedRect(x, barY, w * s.bar, 6, 3);
        this._zo(bG);
        cy += 10;
      }
      cy += 20;
    });
  }

  _getFacStats(fac, state) {
    if (fac.id === 'bed') {
      const collected = state?.totalDonors || 0;
      const bloodTotal = state ? Object.values(state.blood).reduce((s, v) => s + v, 0) : 0;
      const maxSto = state?.maxStorage || 25;
      const bStr = state ? ['A', 'B', 'O', 'AB'].map(t => `${t}:${state.blood[t] || 0}`).join(' ') : '-';
      return [
        { label: '오늘 채혈', value: `${collected}건`, color: '#4fc3f7' },
        { label: '보관량', value: `${bloodTotal}/${maxSto}팩`, color: '#a5d6a7', bar: maxSto > 0 ? bloodTotal / maxSto : 0 },
        { label: '혈액형별', value: bStr, color: '#ffab91' },
        { label: '처리 속도', value: `${fac.processTime}턴`, color: '#f0c040' },
        { label: '가동률', value: `${fac.busy ? '100%' : '0%'}`, bar: fac.busy ? 1 : 0 },
      ];
    }
    if (fac.id === 'storage' || fac.id === 'cold_storage') {
      const blood = state ? Object.values(state.blood).reduce((s, v) => s + v, 0) : 0;
      const max = state?.maxStorage || 25;
      return [
        { label: '보관량', value: `${blood}/${max}팩`, color: '#4fc3f7', bar: max > 0 ? blood / max : 0 },
        { label: '온도', value: fac.id === 'cold_storage' ? '-80°C' : '4°C', color: '#80deea' },
        { label: '레벨', value: `Lv.${fac.level}`, color: '#ce93d8' },
      ];
    }
    if (fac.id === 'lab') {
      return [
        { label: '검사 속도', value: `${fac.processTime}턴`, color: '#f0c040' },
        { label: '정확도', value: '95%', bar: 0.95, color: '#a5d6a7' },
        { label: '레벨', value: `Lv.${fac.level}`, color: '#ce93d8' },
      ];
    }
    return [
      { label: '레벨', value: `Lv.${fac.level}`, color: '#ce93d8' },
      { label: '상태', value: fac.busy ? '가동 중' : '대기', color: fac.busy ? '#a5d6a7' : '#999' },
    ];
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
          const pw = TILE * tw - 2, ph = TILE * th - 2;
          hints.fillStyle(0x4ade80, 0.08);
          hints.fillRoundedRect(x, y, pw, ph, 4);
          hints.fillStyle(0x4ade80, 0.15);
          hints.fillRoundedRect(x + 2, y + 2, pw - 4, ph - 4, 3);
          hints.lineStyle(1.5, 0x4ade80, 0.45);
          hints.strokeRoundedRect(x + 1, y + 1, pw - 2, ph - 2, 4);
          hints.fillStyle(0x4ade80, 0.3);
          hints.fillCircle(x + pw / 2, y + ph / 2, Math.min(pw, ph) * 0.12);

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
