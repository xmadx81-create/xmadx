# 워크샵 방배정 도구 — 봉사앱 이식 가이드

## 개요
`xmadx` 저장소의 `public/room-assignment.html`을 봉사앱(poc, Sheets 기반)에 통합하기 위한 가이드.
봉사개발 세션에서 이 파일을 참고하여 이식 작업을 수행한다.

---

## 소스 위치
- GitHub: `xmadx81-create/xmadx` 저장소
- 브랜치: `claude/keen-turing-vnsytz`
- 파일: `public/room-assignment.html` (단일 파일, CSS+JS 인라인)

---

## 이식 방법 (3가지 중 택 1)

### 방법 A: 별도 페이지로 추가 (권장)
1. `room-assignment.html` 파일을 봉사앱 `public/` 폴더에 복사
2. 봉사앱 도구탭에 버튼 추가:
```javascript
// 도구 탭 렌더링 부분에 추가
<button class="tool-btn" onclick="openRoomAssignment()">
  <span class="tool-icon">🏢</span>
  <span>워크샵 방배정</span>
</button>
```
3. 워크숍 명단 데이터를 URL 해시로 전달:
```javascript
function openRoomAssignment() {
  // 현재 워크숍 명단에서 데이터 수집
  const data = {
    managers: selectedManagers.map(m => ({
      name: m.name,
      region: m.region,
      position: m.position,
      gender: m.gender || '',
      age: m.age || ''
    })),
    additional: additionalMembers.map(a => ({
      name: a.name,
      affiliation: a.affiliation,
      title: a.title,
      age: a.age,
      gender: a.gender,
      memo: a.memo || ''
    })),
    center: 'pohang'  // 또는 사용자 선택값
  };
  const b64 = btoa(encodeURIComponent(JSON.stringify(data)));
  window.open('/room-assignment.html#import=' + b64, '_blank');
}
```

### 방법 B: 봉사앱 내 탭으로 통합
1. `room-assignment.html`의 `<style>` 내용을 봉사앱 CSS에 병합
2. `<body>` 내 HTML을 봉사앱의 도구 렌더링 함수에 삽입
3. `<script>` 내 JS를 봉사앱 `app.js`에 병합
4. 워크숍명단 → 방배정 탭 전환 시 `importFromVolunteerApp(data)` 호출

### 방법 C: iframe으로 삽입
```javascript
function showRoomAssignment() {
  const iframe = document.createElement('iframe');
  iframe.src = '/room-assignment.html';
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  document.getElementById('toolContent').innerHTML = '';
  document.getElementById('toolContent').appendChild(iframe);

  // 데이터 전달
  iframe.onload = () => {
    iframe.contentWindow.postMessage({
      type: 'IMPORT_WORKSHOP_LIST',
      payload: { managers: [...], additional: [...], center: 'pohang' }
    }, '*');
  };

  // 결과 수신
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'ASSIGNMENT_RESULT') {
      console.log('방배정 결과:', e.data.payload);
    }
  });
}
```

---

## 봉사앱 데이터 구조 매핑

### 봉사앱 워크숍 명단 → 방배정 도구 참여자

| 봉사앱 필드 | 방배정 도구 필드 | 변환 로직 |
|---|---|---|
| name (이름) | name | 그대로 |
| region (소속) | group | 같은 소속 = 같은 그룹 |
| position (직함) | position | 지역장/본부장→vip, 관리담당자→manager |
| gender (성별) | gender | '남'→male, '여'→female |
| age (나이) | age, ageGroup | 숫자→자동 연령대 계산 |
| memo (비고) | health, memo | '거동불편'→mobility, '코골이'→snoring 자동 파싱 |

### 방배정 결과 → 봉사앱으로 반환

`exportAssignmentResult()` 호출 시 반환 형태:
```json
{
  "center": "pohang",
  "centerName": "포항 연수원",
  "date": "2026-06-17T...",
  "rooms": [
    {
      "roomId": "B201",
      "roomName": "B201",
      "capacity": 3,
      "assigned": 3,
      "people": [
        { "name": "홍길동", "gender": "남", "age": 45, "group": "경남지역본부" }
      ],
      "note": "큰편,침대"
    }
  ],
  "unassigned": [
    { "name": "미배정자", "gender": "여", "age": 30 }
  ]
}
```

---

## 연수원 데이터 (CENTERS 객체)

### 포항 연수원 — 14개 객실
| 객실 | 수용 | 층 | 특징 |
|------|------|----|------|
| B201 | 3명 | 2F | 큰편, 침대 |
| B202 | 3명 | 2F | 침대 |
| B203 | 3명 | 2F | 큰편 |
| B101 | 2~4명 | 1F | |
| C101 | 3~4명 | 1F | 복층 |
| D101 | 3~4명 | 1F | 복층 |
| E101 | 3~4명 | 1F | 복층 |
| F101 | 3~4명 | 1F | 복층 |
| A201 | 3명 | 2F | 침대 |
| A202 | 3명 | 2F | |
| A203 | 3명 | 2F | 침대 |
| A101 | 3~4명 | 1F | |
| A102 | 10명 | 1F | 온돌 |
| A103 | 3명 | 1F | |

### 경남 연수원 — 4개 객실
| 객실 | 수용 | 층 | 특징 |
|------|------|----|------|
| 101호 | 4명 | 1F | VIP |
| 204호 | 6~8명 | 2F | |
| 203호 | 10~15명 | 2F | |
| 202호 | 25~30명 | 2F | |

---

## 자동 배정 규칙 (우선순위)
1. **P1 성별 분리** — 절대 규칙, 비활성화 불가
2. **P2 건강/우대** — 거동불편→1층, 고령→침대방
3. **P3 직급 우선** — VIP/관리자→VIP·소규모방
4. **P4 그룹 묶기** — 같은 그룹 같은 방
5. **P5 연령대** — 비슷한 나이대끼리
6. **P6 최적화** — 빈자리 최소화
7. **P7 코골이** — 코골이 인원 별도 방

---

## 주요 API 함수 (통합 시 사용)

| 함수 | 설명 |
|------|------|
| `importFromVolunteerApp(data)` | 봉사앱 명단 데이터 임포트 |
| `exportAssignmentResult()` | 현재 배정 결과 JSON 반환 |
| `autoAssign()` | 자동 방배정 실행 |
| `clearAllAssignments()` | 배정 초기화 |
| `checkUrlImport()` | URL 해시 데이터 자동 파싱 |

### postMessage 이벤트
- 수신: `{ type: 'IMPORT_WORKSHOP_LIST', payload: data }` → 명단 임포트
- 수신: `{ type: 'GET_ASSIGNMENT_RESULT' }` → 결과 요청
- 발신: `{ type: 'ASSIGNMENT_RESULT', payload: result }` → 결과 응답

---

## 향후 확장
- 새 연수원 추가: `CENTERS` 객체에 building/room 데이터 추가
- 배정 결과 Sheets 저장: `exportAssignmentResult()` 반환값을 Sheets API로 저장
- 카카오톡 방배정 알림: 결과 데이터로 메시지 템플릿 생성
