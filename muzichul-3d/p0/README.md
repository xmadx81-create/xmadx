# P0 — 포토리얼 3D 통합 골격 (Biz3D)

설계서 `muzichul-3d/INTEGRATION-3D.md` 의 **P0 단계** 실제 코드입니다.
"통합 구조 먼저" 결정에 따라, **자산(GLB) 없이 구조부터** 동작하게 만든 골격입니다.

## 들어있는 것
```
public/
  3d/biz3d.js        ← Biz3D 모듈(Three.js 지연로드, 사업체 3D 뷰 open/close/품질)
  biz3d-demo.html    ← 미리보기 데모(사업체 카드 → 3D로 보기)
```

## 무엇을 하나 (P0)
- 사업체 카드의 **"🏢 3D로 보기"** 버튼 → `Biz3D.open(bizId, snapshot)` 호출
- **Three.js 를 CDN에서 지연 로드**(뷰 열 때만) → 평상시 앱 무게 0
- **직원 수(snapshot.staffCount)** 에 따라 책상·직원이 늘어남 → **state 연동 검증**
- 드래그 카메라, 품질(저사양/표준/고품질) 토글, 닫을 때 GPU 자원 해제
- 씬은 **플레이스홀더 박스**(IT개발사 사무실). **P1에서 이 박스들을 포토리얼 GLB로 교체**

> 코드 안 `SCENES` 매핑과 `buildOfficePlaceholder()` 가 P1 교체 지점입니다.
> (박스 `box(...)` → `await loader.loadAsync('assets/3d/office/room.glb')` 로 치환)

## 미리보기 방법
인터넷 연결이 있는 환경에서 `public/biz3d-demo.html` 을 브라우저로 열고
직원 수를 바꾼 뒤 **🏢 3D로 보기** → 사무실 3D 뷰가 뜹니다.
(Three.js 는 `cdn.jsdelivr.net` 에서 로드)

## 클라우드판에 붙이는 방법 (GitHub 푸시 후)
1. `public/3d/biz3d.js` 를 클라우드판 `public/3d/` 로 복사
2. `public/index.html` 에 로더 1줄 추가:
   ```html
   <script src="3d/biz3d.js"></script>
   ```
3. 사업체 카드 렌더 부분에 버튼 추가(게임 state로 snapshot 구성):
   ```html
   <button onclick="Biz3D.open('biz_office', { name: biz.name, staffCount: biz.staffCount, level: biz.level })">🏢 3D로 보기</button>
   ```
   → 실제 카드 구조/필드명은 **GitHub 푸시 후 코드 보고 정확히 연결**합니다.

## 다음(P1~)
- P0 구조 확정 → IT개발사 **포토리얼 GLB** 1세트 제작/소싱 → `buildOfficePlaceholder` 를 GLTF 로드로 교체
- 이후 업종(치킨집·무무통신…) 씬 추가
