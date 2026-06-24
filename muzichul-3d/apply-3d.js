#!/usr/bin/env node
/*
 * 무지출용팔이 클라우드판 — 3D 손님 러시 자동 적용 + 재배포 스크립트
 *
 * 사용법 (PC에서, 코드 폴더 C:\AI_WORK\무지출용팔이 안에서):
 *   1) 이 파일(apply-3d.js)과 customer-rush-3d.html 두 개를 그 폴더에 복사
 *   2) 적용 + 배포:   node apply-3d.js
 *      적용만(배포 X): node apply-3d.js --no-deploy
 *
 * 하는 일:
 *   - customer-rush-3d.html 을 public/ 로 복사
 *   - public/index.html 의 </body> 앞에 '🍗 손님러시' 플로팅 버튼 + 오버레이(iframe) 주입
 *     (구조 독립적·추가만·중복주입 방지. 원본은 index.html.bak 으로 백업)
 *   - gcloud run deploy 로 Cloud Run(muzichul) 재배포
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const MARKER = 'MJY-3D-INJECT';
const noDeploy = process.argv.includes('--no-deploy');

function die(msg){ console.error('\n❌ ' + msg + '\n'); process.exit(1); }
function ok(msg){ console.log('✅ ' + msg); }

// 0) 사전 점검 — 클라이언트 폴더 자동 탐지(public/static/www/dist/client)
const GAME_SRC = path.join(ROOT, 'customer-rush-3d.html');
if (!fs.existsSync(GAME_SRC)) die('customer-rush-3d.html 이 이 폴더에 없습니다. 같이 복사했는지 확인하세요.');
const CANDIDATES = ['public', 'static', 'www', 'dist', 'client', '.'];
let PUB = null;
for (const c of CANDIDATES){ if (fs.existsSync(path.join(ROOT, c, 'index.html'))){ PUB = path.join(ROOT, c); break; } }
if (!PUB) die('index.html 이 있는 클라이언트 폴더를 못 찾았습니다(public/static/www/dist/client). 무지출용팔이 클라우드판 코드 폴더에서 실행하세요.');
const GAME_DST = path.join(PUB, 'customer-rush-3d.html');
const INDEX = path.join(PUB, 'index.html');
ok('클라이언트 폴더 탐지: ' + path.relative(ROOT, PUB) + '/');

// 1) 게임 파일 복사
const REL = path.relative(ROOT, PUB) || '.';
fs.copyFileSync(GAME_SRC, GAME_DST);
ok(REL + '/customer-rush-3d.html 복사 완료');

// 2) 주입 스니펫 (구조 독립적: 플로팅 버튼 + 풀스크린 오버레이 iframe)
const SNIPPET = `
<!-- ${MARKER} : 3D 손님 러시 미니게임 (자동 주입 / 추가만) -->
<style>
  #mjy3d-btn{position:fixed;right:12px;bottom:74px;z-index:99998;border:none;border-radius:14px;
    padding:12px 16px;font-size:14px;font-weight:800;color:#fff;cursor:pointer;
    background:linear-gradient(135deg,#f59e0b,#ef4444);box-shadow:0 6px 18px rgba(0,0,0,.4);}
  #mjy3d-btn:active{transform:translateY(1px);}
  #mjy3d-ov{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
    background:rgba(4,3,9,.9);padding:10px;}
  #mjy3d-box{position:relative;width:100%;max-width:440px;height:90vh;background:#0a0a14;
    border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.6);}
  #mjy3d-x{position:absolute;top:8px;right:8px;z-index:2;width:36px;height:36px;border:none;border-radius:10px;
    background:rgba(20,16,30,.9);color:#e8e8e8;font-size:16px;font-weight:800;cursor:pointer;}
  #mjy3d-box iframe{width:100%;height:100%;border:0;display:block;background:#0a0a14;}
</style>
<button id="mjy3d-btn">🍗 손님러시</button>
<div id="mjy3d-ov">
  <div id="mjy3d-box">
    <button id="mjy3d-x">✕</button>
    <iframe id="mjy3d-frame" title="손님 러시"></iframe>
  </div>
</div>
<script>(function(){
  var b=document.getElementById('mjy3d-btn'),o=document.getElementById('mjy3d-ov'),
      x=document.getElementById('mjy3d-x'),f=document.getElementById('mjy3d-frame');
  function open(){ f.src='customer-rush-3d.html'; o.style.display='flex'; }
  function close(){ o.style.display='none'; f.src='about:blank'; } // 닫으면 게임 정지
  b.addEventListener('click',open);
  x.addEventListener('click',close);
  o.addEventListener('click',function(e){ if(e.target===o) close(); });
})();</script>
<!-- /${MARKER} -->
`;

// 3) index.html 주입(중복 방지 + 백업)
let html = fs.readFileSync(INDEX, 'utf8');
if (html.indexOf(MARKER) !== -1){
  ok('이미 주입돼 있어 index.html 은 건너뜀(중복 방지)');
} else {
  fs.writeFileSync(INDEX + '.bak', html);  // 원본 백업
  const idx = html.lastIndexOf('</body>');
  if (idx === -1){ html = html + SNIPPET; }
  else { html = html.slice(0, idx) + SNIPPET + '\n' + html.slice(idx); }
  fs.writeFileSync(INDEX, html);
  ok(REL + '/index.html 에 런처 주입 완료 (백업: ' + REL + '/index.html.bak)');
}

// 4) 정적 서빙 점검(경고만)
try {
  const sv = path.join(ROOT, 'server.js');
  if (fs.existsSync(sv) && fs.readFileSync(sv,'utf8').indexOf('static') === -1){
    console.log('⚠️  server.js 에서 express.static 을 못 찾았습니다. public/ 정적 서빙이 켜져 있어야 iframe 이 로드됩니다.');
  }
} catch(e){}

// 5) 재배포
const DEPLOY_CMD = 'gcloud run deploy muzichul --source . --project muzichul-yongpali --region asia-northeast3 --allow-unauthenticated --service-account muzichul-server@muzichul-yongpali.iam.gserviceaccount.com --set-env-vars STORE_MODE=firestore,FIREBASE_PROJECT=muzichul-yongpali,AUTH_PROJECT=yongpari-1dbfa,EDITION=aa --memory 512Mi --quiet';
if (noDeploy){
  console.log('\n▶ --no-deploy: 적용만 완료. 직접 배포하려면 아래 명령을 실행하세요.\n');
  console.log(DEPLOY_CMD + '\n');
  process.exit(0);
}
console.log('\n🚀 Cloud Run 재배포 시작...\n' + DEPLOY_CMD + '\n');
try {
  execSync(DEPLOY_CMD, { stdio: 'inherit' });
  console.log('\n✅ 배포 완료! 라이브 앱에서 우하단 🍗 손님러시 버튼을 확인하세요.');
} catch(e){
  die('배포 실패. gcloud 로그인/권한을 확인하거나, 적용만 한 상태에서 수동 배포하세요:\n\n' + DEPLOY_CMD);
}
