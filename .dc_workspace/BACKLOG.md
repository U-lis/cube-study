# 백로그

다음 작업을 시작할 때(`/dotclaude:init-feature`) 여기서 꺼내 SPEC 으로 옮긴다.
아이디어 보관소이지 확정 명세가 아니다.

---

## 다국어 (i18n) — 0.2.0 후보

### 요구사항

- **지원 언어: en, ko 두 개만.** 그 이상 늘리지 않는다.
- **기본 언어는 시스템/브라우저 언어에서 가져온다** (`navigator.language`).
- 사용자가 선택하면 **localStorage 에 저장**하고 그 선택이 시스템 설정을 이긴다.
  (테마와 동일한 3단 구조: `system` / `en` / `ko` — `ui.theme` 와 같은 패턴)
- 전환 UI 는 **국기 아이콘** 등으로. 상단 바를 새로 만들거나 기존 하단 네비게이션에 얹는다.
  현재 상단 바에는 테마 토글만 있으므로 그 옆이 자연스럽다.

### 확정된 번역

토글 라벨은 영문을 유지할지 번역할지 결정이 필요하다. 사용자가 준 대응은 아래와 같다.

| 영문 | 한국어 |
|---|---|
| setup | 셋업 |
| optimized | 최적 |
| structural | 구조화 |
| compact | 간략화 |

### 번역 대상 정리

| 영역 | 번역 | 비고 |
|---|---|---|
| 네비게이션 (조회/기준공식/퀴즈) | O | |
| 토글 라벨 | 위 표 | |
| 토글 설명 줄 (`기준공식 + 셋업` 등) | O | |
| 무효 입력 사유 | O | **조사 처리 주의** — `josa()` 는 한국어 전용이다 |
| 퀴즈 판정 문구 | O | |
| 타깃 위치 표기 (`L = DFL의 F면`) | O | 영문은 `L = F face of DFL` 형태 |
| 큐브 표기 (`R U R' U'`) | **X** | 만국 공통 |
| 케이스 코드 · 기준공식 이름 (`LB`, `SC`) | **X** | Speffz 는 영문 고정 |
| 큐비 이름 (`UBL`, `DFR`) | **X** | 만국 공통 |

### 구현 시 주의

- `validate.ts` 의 `josa()` 는 한국어 조사(은/는, 와/과) 처리다. 영어에는 없는 개념이므로
  문구 조립을 언어별 함수로 분리해야 한다. 현재 `reasonText()` 가 문자열을 만드는 구조라
  이 지점을 언어 레이어로 빼는 것이 첫 작업이 된다.
- `verdictText()` 도 같은 성격이다.
- `<html lang>` 을 선택 언어에 맞게 갱신해야 한다. 현재 `ko` 하드코딩.
- PWA manifest 의 `lang` / `name` / `description` 도 언어별 처리를 검토한다.
  (manifest 는 빌드 타임 고정이라 한쪽만 택하거나 `lang` 을 중립으로 두는 선택이 필요)
- 라이브러리 도입 여부: 문구 수가 30개 안팎이라 `paraglide` 같은 도구 없이
  단순 사전 객체 + `$derived` 로 충분할 가능성이 높다. 번들 최소 원칙(GLOBAL 1절)과도 맞는다.
- E2E 는 현재 한국어 문구를 직접 검증하는 곳이 있다(`3-cycle이 아닙니다` 등).
  언어 전환 후에도 통과하도록 테스트를 언어 중립 셀렉터(`data-verdict` 등)로 옮기거나
  언어를 고정하고 돌려야 한다.

---

## 3D 큐브 뷰어 — 0.5.0+ 후보

손으로 쓸어 돌려보는 3D 큐브. **특정 큐비의 특정 면에만 임의의 색을 칠할 수 있어야
한다** (버퍼 UBL 과 타깃 2개를 서로 다른 색으로 구분하는 것이 목적).
2026-08-18 에 라이브러리를 조사했다.

### 결론: `three` (three.js)

임의 색상 요구를 만족하는 것이 이것뿐이다. `BoxGeometry` 는 면마다 material 인덱스가
따로라 큐비 하나에 material 6개를 물리면 면별로 색을 지정할 수 있고, `OrbitControls`
가 터치 드래그 회전을 담당한다. 큐브 자체는 직접 조립해야 한다.

- `three@0.185.1` (2026-07-01), MIT
- 실측 크기: `three.module.min.js` 357.0 KB → **gzip 84.8 KB**
  (`three.core` gzip 99.0 KB, `three.webgpu` gzip 180.8 KB — WebGL 로 충분하다)
- alternatives 데이터처럼 지연 로드하면 초기 진입에는 영향이 없다

**이 저장소와 잘 맞는다.** `sim.ts` 가 이미 `{ 위치: 원래_스티커 }` 상태를 내놓고
`speffz.ts` 가 facelet 좌표를 들고 있어서 렌더러가 받을 입력이 준비돼 있다. 렌더러는
무브를 모르고 상태만 그리므로, 0.3.1 에서 정한 "무브의 물리는 저장소에 두지 않는다" 와도
충돌하지 않는다.

### 탈락: `cubing` (cubing.js)

큐브 전용이고 `<twisty-player>` 웹 컴포넌트에 드래그 회전이 이미 들어 있어서 가장
유력해 보였지만, **면에 임의 색을 못 넣는다.**

```ts
type StickeringMask      = { orbits: Record<string, OrbitStickeringMask> }
type OrbitStickeringMask = { pieces: (PieceStickeringMask | null)[] }
type PieceStickeringMask = { facelets: (FaceletMeshStickeringMask | ... | null)[] }

// 면에 넣을 수 있는 값이 고정 7종 열거형이다
type FaceletMeshStickeringMask =
  "regular" | "dim" | "oriented" | "experimentalOriented2" | "ignored" | "invisible" | "mystery"
```

`FaceletStickeringMask` 도 `{ mask, hintMask }` 뿐이고 타입 전체에 hex/color 를 받는
필드가 없다. 즉 "강조 / 흐리게 / 숨김" 은 되고 "이 면을 이 색으로" 는 안 된다.
`dist/lib/cubing` 이 8.2MB (chunks 6.8MB) 라 크기도 균형이 안 맞는다.

`cubing@0.63.3` (2026-02-26), MPL-2.0 OR GPL-3.0-or-later.
요구가 "강조/흐리게" 로 바뀌면 이쪽이 다시 1순위가 된다.

### 이미 쓰는 `cubejs` 는 렌더링을 못 한다

혼동하기 쉬워 적어둔다. `cubejs` (ldez, 1.3.2) 는 `lib/` 에 파일 4개뿐이고
(`cube.js` `solve.js` `async.js` `worker.js`) 노출 API 가 모델과 솔버뿐이다 —
`move` `multiply` `asString` `isSolved` `upright` 등. 그리기 메서드가 없다.

npm 검색도 노이즈가 크다. **분석 플랫폼 Cube.js (`@cubejs-client/*`) 가 이름을
선점**해서 "cube" 로 검색하면 상위를 그쪽이 차지한다. 우리와 무관하다.
`three-rubiks-cube` (2020-09-28), `rubiks-cube` (2018-08-26) 은 방치 상태다.

---

## 그 밖의 로드맵 (0.1.0 SPEC 의 Out of Scope 에서)

| 항목 | 예정 |
|---|---|
| 학습 상태 저장, 기준별 진도율 | 0.2.0 |
| 퀴즈 오답 재출제 · 반복 로직 | 0.2.0 |
| 필터 (무브 수별, pure/conj별, 기준공식별) | 0.2.0 |
| 온스크린 스티커 입력 패드 | 0.2.0 이후 재검토 |
| 큐브 2D 전개도, 입력 공식 시뮬레이션 재생 | 0.3.0 |
| M2 엣지 / OP 코너 참조표, 패리티 안내 | 0.4.0 |
| UFR 버퍼 코너 데이터 | 0.5.0+ |
| 엣지 3-style (440+ 케이스) | 0.5.0+ |
| 멀티페이즈 타이머 | 0.5.0+ |
| 3D 큐브 애니메이션 | 0.5.0+ — 위 "3D 큐브 뷰어" 절에 라이브러리 조사 결과 |

진도율 기능을 만들 때는 NFR-9(dry한 정보 앱)를 특히 주의한다. 그 영역은
진도바와 달성 연출이 기본값처럼 붙는다.
