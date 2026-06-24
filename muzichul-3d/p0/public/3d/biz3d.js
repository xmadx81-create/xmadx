/*
 * 무지출용팔이 — Biz3D : 사업체 3D 뷰 (P0 통합 골격)
 * 설계서: muzichul-3d/INTEGRATION-3D.md
 *
 * - Three.js 지연 로드(CDN). 3D 뷰 열 때만 fetch → 평상시 0 비용.
 * - game state(snapshot)를 "읽기만" 해서 씬 구성 → 기존 게임 로직 수정 0 (격리).
 * - P0는 GLB 자산 없이 플레이스홀더 박스 씬. P1에서 박스를 GLTF 모델로 교체.
 * - classic script 로 로드 가능: <script src="3d/biz3d.js"></script>
 *
 * 사용:
 *   Biz3D.open('biz_office', { name:'IT개발사', staffCount:6, level:3 });
 *   Biz3D.close();
 *   Biz3D.setQuality('low'|'mid'|'high');
 */
(function(){
  'use strict';
  var THREE = null, renderer, scene, camera, raf = null, overlay, canvas, disposables = [];
  var drag = { on:false, x:0, y:0 }, theta = 0.7, phi = 1.15, radius = 9, autoRotate = true;
  var quality = 'mid';
  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

  // 업종 → 씬 빌더 매핑 (P1에서 GLB 씬으로 교체될 지점)
  var SCENES = {
    'default': buildOfficePlaceholder,
    'biz_office': buildOfficePlaceholder,
    // 'biz_chicken': buildChickenPlaceholder,  // P2
  };

  function ensureOverlay(){
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'biz3d-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:none;background:rgba(6,6,12,.92);';
    overlay.innerHTML =
      '<canvas id="biz3d-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;"></canvas>' +
      '<div id="biz3d-title" style="position:absolute;top:14px;left:0;right:0;text-align:center;color:#fff;font:800 16px Pretendard,sans-serif;pointer-events:none;"></div>' +
      '<div id="biz3d-sub" style="position:absolute;top:38px;left:0;right:0;text-align:center;color:#9a90b0;font:600 11px Pretendard,sans-serif;pointer-events:none;"></div>' +
      '<button id="biz3d-x" style="position:absolute;top:12px;right:12px;width:40px;height:40px;border:none;border-radius:10px;background:rgba(20,16,30,.9);color:#fff;font-size:18px;font-weight:800;cursor:pointer;">✕</button>' +
      '<div id="biz3d-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font:700 14px Pretendard,sans-serif;">3D 로딩 중…</div>' +
      '<div id="biz3d-q" style="position:absolute;bottom:14px;left:0;right:0;text-align:center;">' +
        '<button data-q="low"  style="margin:0 4px;padding:6px 12px;border:1px solid #3a3050;border-radius:8px;background:#16111f;color:#cbd5e1;font-size:12px;">저사양</button>' +
        '<button data-q="mid"  style="margin:0 4px;padding:6px 12px;border:1px solid #3a3050;border-radius:8px;background:#16111f;color:#cbd5e1;font-size:12px;">표준</button>' +
        '<button data-q="high" style="margin:0 4px;padding:6px 12px;border:1px solid #3a3050;border-radius:8px;background:#16111f;color:#cbd5e1;font-size:12px;">고품질</button>' +
      '</div>';
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('#biz3d-canvas');
    overlay.querySelector('#biz3d-x').addEventListener('click', close);
    overlay.querySelectorAll('#biz3d-q button').forEach(function(b){
      b.addEventListener('click', function(){ setQuality(b.dataset.q); });
    });
    bindDrag();
  }

  function bindDrag(){
    function down(x,y){ drag.on=true; drag.x=x; drag.y=y; autoRotate=false; }
    function move(x,y){ if(!drag.on) return; theta -= (x-drag.x)*0.008; phi += (y-drag.y)*0.006;
      phi = Math.max(0.35, Math.min(1.5, phi)); drag.x=x; drag.y=y; }
    function up(){ drag.on=false; }
    canvas.addEventListener('mousedown', function(e){ down(e.clientX,e.clientY); });
    window.addEventListener('mousemove', function(e){ move(e.clientX,e.clientY); });
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', function(e){ down(e.touches[0].clientX,e.touches[0].clientY); e.preventDefault(); }, {passive:false});
    window.addEventListener('touchmove', function(e){ if(drag.on){ move(e.touches[0].clientX,e.touches[0].clientY); e.preventDefault(); } }, {passive:false});
    window.addEventListener('touchend', up);
  }

  function pxRatio(){ return quality==='low'?1 : quality==='high'?Math.min(2,window.devicePixelRatio||1) : Math.min(1.5,window.devicePixelRatio||1); }

  async function open(bizId, snapshot){
    snapshot = snapshot || {};
    ensureOverlay();
    overlay.style.display = 'block';
    overlay.querySelector('#biz3d-title').textContent = (snapshot.name || '사업체') + ' · 3D';
    overlay.querySelector('#biz3d-sub').textContent = '직원 ' + (snapshot.staffCount||0) + '명 · 드래그로 둘러보기';
    overlay.querySelector('#biz3d-loading').style.display = 'flex';
    try {
      if (!THREE) THREE = await import(THREE_URL);  // 지연 로드
    } catch(e){
      overlay.querySelector('#biz3d-loading').textContent = '3D 로드 실패(네트워크). 저사양 모드를 이용하세요.';
      return;
    }
    overlay.querySelector('#biz3d-loading').style.display = 'none';

    // 렌더러/씬/카메라
    if (!renderer){
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias:true });
    }
    renderer.setPixelRatio(pxRatio());
    resize();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b14);
    camera = new THREE.PerspectiveCamera(50, canvas.clientWidth/canvas.clientHeight, 0.1, 100);

    // 조명(PBR 대비 — 포토리얼 자산 그대로 받게)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    var dir = new THREE.DirectionalLight(0xffffff, 1.1); dir.position.set(5,9,4); scene.add(dir);
    var fill = new THREE.DirectionalLight(0x88aaff, 0.3); fill.position.set(-6,4,-3); scene.add(fill);

    // 씬 빌드(업종별) — P1에서 GLTF 로드로 교체
    (SCENES[bizId] || SCENES['default'])(THREE, scene, snapshot, disposables);

    window.addEventListener('resize', resize);
    if (raf) cancelAnimationFrame(raf);
    var t0 = performance.now();
    (function loop(now){
      raf = requestAnimationFrame(loop);
      var t = (now - t0)/1000;
      if (autoRotate) theta += 0.0025;
      var tgt = new THREE.Vector3(0,1,0);
      camera.position.set(tgt.x + radius*Math.sin(phi)*Math.sin(theta),
                          tgt.y + radius*Math.cos(phi),
                          tgt.z + radius*Math.sin(phi)*Math.cos(theta));
      camera.lookAt(tgt);
      // 모니터/서버 LED 깜빡임(애니메이션 훅)
      scene.traverse(function(o){ if(o.userData && o.userData.blink && o.material){
        o.material.emissiveIntensity = 0.4 + 0.3*Math.sin(t*6 + o.userData.blink); } });
      renderer.render(scene, camera);
    })(t0);
  }

  function close(){
    if (raf){ cancelAnimationFrame(raf); raf = null; }
    window.removeEventListener('resize', resize);
    // GPU 자원 해제(누수 방지)
    if (scene){ scene.traverse(function(o){
      if (o.geometry) o.geometry.dispose();
      if (o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(function(m){ m.dispose(); }); }
    }); }
    disposables.length = 0;
    if (overlay) overlay.style.display = 'none';
  }

  function setQuality(q){ quality = q; if (renderer){ renderer.setPixelRatio(pxRatio()); } }

  function resize(){
    if (!renderer || !canvas) return;
    var w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    if (camera){ camera.aspect = w/h; camera.updateProjectionMatrix(); }
  }

  // ── 플레이스홀더 씬: IT개발사 사무실 (P1에서 GLB로 교체) ──
  function buildOfficePlaceholder(THREE, scene, snap, keep){
    function mat(c, opts){ var m = new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:0.8, metalness:0.1 }, opts||{})); keep.push(m); return m; }
    function box(x,y,z, w,h,d, material){ var g = new THREE.BoxGeometry(w,h,d); keep.push(g);
      var me = new THREE.Mesh(g, material); me.position.set(x,y,z); scene.add(me); return me; }

    // 바닥/벽
    box(0,-0.05,0, 12,0.1,11, mat(0x2a3344));
    box(0,1.7,-5.4, 12,3.4,0.2, mat(0x3a4658));
    box(-5.9,1.7,0, 0.2,3.4,11, mat(0x33404f));
    box(5.9,1.7,0, 0.2,3.4,11, mat(0x33404f));
    // 천장 조명(발광)
    [-3,0,3].forEach(function(lx){ box(lx,3.1,-1, 1.6,0.08,0.7, mat(0xfff7e0,{ emissive:0xfff2c0, emissiveIntensity:0.6 })); });

    // 직원 수 → 워크스테이션 수 (state-driven). 최소 1, 최대 8.
    var n = Math.max(1, Math.min(8, snap.staffCount||4));
    var cols = [-3,0,3], rows = [-2.2, 0.8];
    var colors = [0x3b82f6,0xef4444,0x10b981,0xf59e0b,0x8b5cf6,0xec4899,0x06b6d4,0x84cc16];
    for (var i=0;i<n;i++){
      var x = cols[i%3], z = rows[Math.floor(i/3)%2];
      workstation(x, z, colors[i%colors.length]);
    }
    // 서버랙(점멸 LED) + 화이트보드 + 화분
    serverRack(5,-4);
    box(-1.6,1.7,-5.28, 3,1.3,0.06, mat(0xf5f5f0,{ emissive:0x222222, emissiveIntensity:0.05 }));
    plant(-5,3); plant(5,3);

    function workstation(x,z,col){
      box(x,0.75,z, 1.7,0.08,0.85, mat(0xcaa46a));               // 책상
      box(x,0.4,z-0.36, 1.7,0.7,0.05, mat(0x9c7b46));            // 전면 패널
      box(x,1.22,z-0.22, 1.0,0.6,0.06, mat(0x0d1117));           // 모니터 베젤
      var screen = box(x,1.22,z-0.19, 0.86,0.46,0.02, mat(0x1c1c1c,{ emissive:0x1e6fe0, emissiveIntensity:0.5 }));
      screen.userData.blink = Math.random()*6;                  // 화면 깜빡임
      box(x,0.83,z+0.15, 0.75,0.05,0.24, mat(0x111827));         // 키보드
      box(x+0.66,0.86,z, 0.13,0.16,0.13, mat(0xd2603a));         // 머그
      box(x,0.5,z+0.8, 0.54,0.1,0.52, mat(0x1e293b));            // 의자 시트
      box(x,0.86,z+1.04, 0.54,0.72,0.1, mat(0x1e293b));          // 의자 등받이
      box(x,0.78,z+0.74, 0.46,0.56,0.32, mat(col));             // 직원 몸통
      box(x,1.18,z+0.74, 0.34,0.34,0.32, mat(0xf0c9a0));         // 머리
    }
    function serverRack(x,z){
      box(x,1.1,z, 0.9,2.2,0.8, mat(0x0c0f16));
      for (var i=0;i<6;i++){
        var led = box(x-0.3,0.5+i*0.3,z+0.42, 0.06,0.06,0.03, mat(0x111111,{ emissive: i%2?0x22c55e:0xf59e0b, emissiveIntensity:0.5 }));
        led.userData.blink = i*1.3;
      }
    }
    function plant(x,z){ box(x,0.2,z, 0.34,0.4,0.34, mat(0x6b4f2a)); box(x,0.7,z, 0.5,0.7,0.5, mat(0x2f8f4e)); }
  }

  // 공개 API
  window.Biz3D = { open: open, close: close, setQuality: setQuality };
})();
