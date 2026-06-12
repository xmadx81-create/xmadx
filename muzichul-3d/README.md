# 🍗 무지출용팔이 클라우드판 — 3D 손님 러시 자동 적용 패키지

라이브 앱(`muzichul` Cloud Run)에 **3D 손님 러시 미니게임**을 넣고 재배포하는 패키지입니다.
이 작업은 **클라우드판 코드가 있는 PC**(`C:\AI_WORK\무지출용팔이`)에서 해야 합니다.
(웹 세션의 AI는 PC·구글클라우드에 접근할 수 없어 마지막 실행만 PC에서 합니다.)

## 들어있는 것
| 파일 | 역할 |
|------|------|
| `customer-rush-3d.html` | 3D 손님 러시 게임(순수 WebGL, 외부 라이브러리 0, 검증 완료) |
| `apply-3d.js` | 자동 적용 + 재배포 스크립트 |

## 적용 방법 (명령어 1줄)

1. 이 폴더의 **두 파일**(`apply-3d.js`, `customer-rush-3d.html`)을
   `C:\AI_WORK\무지출용팔이` 폴더 안에 복사합니다.
2. 그 폴더에서 터미널을 열고 실행:

   ```bash
   cd C:\AI_WORK\무지출용팔이
   node apply-3d.js
   ```

끝입니다. 스크립트가 자동으로:
- `customer-rush-3d.html` → `public/` 복사
- `public/index.html` 의 `</body>` 앞에 **우하단 🍗 손님러시 버튼 + 오버레이**를 주입
  (추가만 · 중복 방지 · 원본은 `public/index.html.bak` 으로 백업)
- `gcloud run deploy` 로 Cloud Run 재배포

배포가 끝나면 **라이브 앱 우하단에 🍗 손님러시 버튼**이 생깁니다.

## 옵션
- **배포 없이 적용만**: `node apply-3d.js --no-deploy` → 끝에 배포 명령을 출력해 줍니다(원할 때 수동 실행).
- **되돌리기**: `public/index.html.bak` 을 `public/index.html` 로 복원하고 재배포.

## 안전성
- 기존 코드 **변경 0** (추가만). 게임 로직·데이터(Firestore)·로그인과 무관.
- 미니게임은 iframe 으로 격리 → 기존 전역 변수/함수와 충돌 없음.
- 주의: `gcloud` 가 설치·로그인(계정 `deahnote62`)돼 있어야 배포됩니다.
- 주의: `sa-key.json` 등 비밀키는 커밋/업로드하지 마세요.

## 참고
정적 서빙(`express.static('public')`)이 켜져 있어야 iframe 이 로드됩니다.
대부분의 단일 클라이언트 구성에선 기본 적용돼 있습니다. 스크립트가 못 찾으면 경고를 띄웁니다.
