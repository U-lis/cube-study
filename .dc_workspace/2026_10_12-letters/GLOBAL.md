# 스티커 문자 훈련 — GLOBAL

SPEC: `SPEC.md` (승인 2026-10-12). 이 문서는 구현 전체에 걸친 결정과 단계 분할이다.
사용자가 자리를 비운 동안 세부 결정을 위임받았다 (2026-10-12). 아래 "AD" 중 사용자 결정이
아닌 것은 전부 그 위임으로 정한 것이고, 최종 보고에 목록으로 낸다.

---

## 아키텍처 결정 (AD)

### AD-LT-1 도메인 순수부는 `src/lib/domain/letters.ts` 한 파일

채점·출제 pool·54칸 칠 배열·54칸 글자 배열·설정 값 판정을 여기 둔다. Svelte·`three`·
`cubejs` 를 import 하지 않는다. 무작위 상태의 facelet 문자열과 난수는 **인자로 받는다**
(`quiz.ts` 와 같은 규칙 — 난수를 안에서 부르면 테스트가 확률에 기댄다).

`speffz.ts`·`sim.ts` 는 import 한다. 문자 ↔ 자리 표를 새로 만들지 않는다 (SPEC 제약).

### AD-LT-2 엣지 문자는 소문자다

이 저장소의 규약이다. `EDGE_INDEX` 의 키가 `a`–`x` 이고 (`speffz.ts:45`), 트레이싱의
`StickerPad` 도 엣지를 소문자로 낸다. 외우기 화면의 큐브 글자, 퀴즈 패드, 판정 문구가 모두
이 규약을 따른다. 코너는 대문자다. 같은 글자 A–X 가 코너·엣지에 다 있어서, 대소문자가
종류를 구분하는 표시도 된다.

### AD-LT-3 채점은 정렬 비교 (SPEC FR-LT-15)

```ts
gradeLetters(kind, cubie, entered: string[]): LetterVerdict
// 정답 = rotationOf(kind)[cubie]. 둘 다 정렬해 join 한 문자열을 비교한다.
```

입력은 대소문자를 종류에 맞춰 정규화한다(코너 대문자·엣지 소문자). 패드가 이미 그 글자만
내므로 정규화는 방어선이다.

### AD-LT-4 문제는 큐비 이름으로 식별한다 (SPEC FR-LT-19)

pool 은 `Object.keys(CORNER_FACELETS)`(8) / `Object.keys(EDGE_FACELETS)`(12) 다. `pickNext`
가 그대로 받는다 (`CaseCode` 는 `string`). 역케이스 개념이 없으므로 `inverseOf` 는 넘기지 않는다.

### AD-LT-5 2단계의 무작위 상태 = `Cube.random().asString()`

`cubejs/lib/cube.js` 의 `Cube.random()` 은 풀이기 없이 돈다 (`cube.js:266`). 화면이 문제마다
한 번 부르고, 54칸 문자열을 도메인 함수에 넘긴다. 문제 큐비가 지금 어디 있는지는
`stateFromFacelets` (`sim.ts:73`)로 찾는다 — 자리 문자 → 그 자리에 온 원래 문자. 원래 문자가
문제 큐비의 것인 자리들이 칠할 칸이다.

1단계는 풀린 문자열(`new Cube().asString()`)을 같은 함수에 넣는다. 경로가 하나다.

### AD-LT-6 54칸 칠 배열 규칙

`paintLookup(kind, others, colors)` · `paintQuiz(kind, cubie, others, facelets, colors)` 가 54칸
색 배열을 낸다. `colors` 는 `faceletColors(colorScheme, facelets)` 결과(실제 색)다.

| 칸 | 외우기 | 퀴즈 |
|---|---|---|
| 센터 | 실제 색 | 실제 색 |
| 글자 종류 / 문제 큐비 | 실제 색 | 실제 색 |
| 그 밖 | `others` 가 회색이면 `GRAY`, 색이면 실제 색 | 같음 |

외우기의 "그 밖"은 **다른 종류**의 조각이고, 퀴즈의 "그 밖"은 **문제 큐비가 아닌 모든 조각**이다
(같은 종류 포함).

### AD-LT-7 퀴즈 문제 큐비 외곽선 = 트레이싱 `MARK_PALETTE.current`

`{ color: '#ff45c8', outline: 'double' }` (`tracing.ts:811`). 새 값을 만들지 않고 import 한다 —
표가 둘이면 한쪽만 고치는 날이 온다. 이미 6색 위에서 쓰이는 값이다.

**"다른 큐비: 회색"일 때도 외곽선을 두른다.** 규칙이 하나가 되고(설정에 따라 표시 방식이
갈리지 않는다), 회색 바탕에서도 해가 없다. SPEC FR-LT-12a 가 설계로 넘긴 항목이다.

### AD-LT-8 스티커 글자 = 글자별 `CanvasTexture` 평면

- `cube3d.ts` 가 글자마다 128×128 캔버스에 글자를 그려 `CanvasTexture` 를 만든다. 같은
  글자는 텍스처를 공유한다 (공유가 금지된 것은 **색** material 이다 — 칸마다 색이 다르므로.
  글자 텍스처는 글자가 같으면 같다)
- 스티커마다 투명 평면 하나를 외곽선처럼 살짝 띄워 둔다 (`OUTLINE_LIFT` 와 같은 방식).
  글자가 없으면 `visible = false`
- **대비**: 굵은 sans, 채움 `#111`, 외곽선 흰색(글자 크기의 약 18%). 흰 스티커에서는 검정 글자가,
  파랑·빨강 스티커에서는 흰 테두리가 경계를 만든다. 6색 모두에서 둘 중 하나가 선다 (SPEC FR-LT-10)
- **글자의 위쪽**: 그 면을 정면에서 볼 때 0행 쪽이다. `cube3d-map.ts` 의 `PLACE` 에서
  `PLACE(0,1) − PLACE(1,1)` 로 **파생**한다 (U 면은 뒤쪽, D 면은 앞쪽, 옆면은 위쪽). 따로
  적은 표가 없으므로 facelet 순서와 어긋날 수 없다. 순수 함수 `labelUp(i)` 로 빼서 54칸 전수 테스트한다
- 인자: `setLabels(labels: (string | null)[])` 54칸. `Cube3D.svelte` 의 `labels` prop 으로 받는다

### AD-LT-9 원위치 = `Cube3D` 가 내보내는 `resetView(index)`

`orientation` prop 은 값이 바뀔 때만 반영된다 (`Cube3D.svelte:74`). 같은 값으로 되돌리려면
명령이 필요하다. Svelte 5 컴포넌트가 함수를 export 하고 부모가 `bind:this` 로 부른다 (룬 규약
안이다). `cube3d.ts` 의 `setOrientation` 은 **관성(TrackballControls 감쇠)을 끊고** 카메라를 옮긴다 —
끊지 않으면 원위치 직후에도 돌던 방향으로 계속 미끄러진다. 끊는 방법은 Phase 2 에서 `three`
소스를 보고 정한다.

퀴즈는 문제마다 무작위 각도를 `resetView(random)` 으로 건다. 같은 각도가 연달아 뽑혀도
카메라가 돌아간다 (prop 만 쓰면 같은 값이라 안 움직인다).

### AD-LT-10 탭·제목 라벨은 묶음별로 덮어쓴다 (SPEC FR-LT-24)

`nav.ts` 에 `GROUP_LABELS: Record<묶음경로, Partial<Record<기능칸, 라벨>>>` 를 더한다.
`'/3x3/bld/letters': { lookup: '외우기' }`. 없으면 `FEATURE_LABELS` 로 떨어진다.
경로 칸 이름은 그대로 `lookup` 이다.

### AD-LT-11 설정 저장 `src/lib/ui/letters.svelte.ts`

`tracing.svelte.ts` 의 `$effect.root` 자동 저장 패턴. 키는 `letters.*` 로 분리한다.

| 키 | 값 | 기본 |
|---|---|---|
| `letters.lookup.kind` | `corner` / `edge` | `corner` |
| `letters.lookup.others` | `gray` / `color` | `gray` |
| `letters.quiz.kind` | `corner` / `edge` | `corner` |
| `letters.quiz.stage` | `solved` / `scrambled` | `solved` |
| `letters.quiz.others` | `gray` / `color` | `gray` |

읽기·쓰기를 `try/catch` 로 감싼다 (SPEC FR-LT-23). 값 판정 함수는 도메인(`letters.ts`)에 둔다.

### AD-LT-12 색 이름 → 한국어 (외우기의 기준 방향 문구)

`colorScheme` 값(`W`·`G` …) → `흰색`·`초록` … 표를 `src/lib/ui/facelets.ts` 에 둔다 (`PAINT`
옆 — 색 이름을 화면 값으로 옮기는 표가 모이는 곳). 문구: **"기준: 위 흰색 · 앞 초록"**.
U·F 의 색 이름은 `colorScheme.U` · `colorScheme.F` 에서 읽는다.

### AD-LT-13 퀴즈 화면 흐름

- 단계(`data-stage`): `active` → `result`. 3-style 퀴즈처럼 `idle` 이 없다
- 진행 버튼: `active` 에 "채점"(`data-grade`, 입력이 다 차야 눌림), `result` 에 "다음 문제"(`data-next`)
- 판정 줄: `data-verdict` · `data-kind`(`correct` / `wrong`) · `data-result`(`ok` / `bad`).
  문구 "정답" / "오답". 오답이면 결과 줄에 정답 글자를 함께 적는다
- 숨은 큐비 안내: `active` 동안 큐브 아래 한 줄 — **"문제 조각이 뒤쪽에 있으면 큐브를 돌려야 보입니다"**.
  위치는 말하지 않는다 (SPEC FR-LT-17)
- 패드: `StickerPad` 그대로. `max` = 큐비 문자 수(코너 3 · 엣지 2). 구분자는 `separatorHidden`

### AD-LT-14 시험 훅

E2E 가 WebGL 픽셀을 세지 않고도 상태를 확인하도록 `Cube3D` 의 캔버스에 속성을 단다.

- `data-labels` = 글자가 찍힌 칸 수
- `data-marked` = 외곽선이 켜진 칸 수
- `data-colored` = 회색이 아닌 칸 수 (외우기·퀴즈 칠 규칙 확인)

캔버스 픽셀 검사가 이미 있는 곳(`PAINT` 를 export 하는 이유)은 건드리지 않는다.

---

### AD-LT-15 설정은 한 줄에 나란히, 설명 줄 없음 (구현 중 추가)

실측(PHASE_5_TEST)에서 설정마다 붙는 머리말·설명 줄이 퀴즈의 채점 버튼을 화면 밖으로 밀었다
(390×844 에서 1063px). 두 화면 모두 설정을 한 줄 grid 로 세우고 설명은 `title` 로만 둔다.
퀴즈의 단계 토글은 머리말 "큐브", 라벨 "풀림 / 섞임" 으로 줄였다 (세 칸이 한 줄에 들어가야 한다).
`SegToggle` 은 설명이 비면 줄을 그리지 않는다 (`.hint:empty`).

## 단계 분할

순차로 간다. 1·2 는 서로 독립이지만 둘 다 작아서 병렬 머지 비용이 더 크다.

| Phase | 이름 | 내용 | 산출 |
|---|---|---|---|
| 1 | domain | `letters.ts` 순수부 + 단위 테스트 | 채점·pool·칠·글자·설정 판정 |
| 2 | viewer | `cube3d-map.ts` `labelUp`, `cube3d.ts` 글자·리셋·관성, `Cube3D.svelte` `labels`·`resetView`·시험 훅 | 뷰어 확장 |
| 3 | lookup | `nav.ts` 묶음 라벨·탭, `letters.svelte.ts`, 색 이름 표, 외우기 화면, 홈 항목 | `/3x3/bld/letters/lookup` |
| 4 | quiz | 퀴즈 화면 | `/3x3/bld/letters/quiz` |
| 5 | wrap | 규약 검사 갱신, 새 E2E, 세로 공간 실측, 문서(CHANGELOG·CONTINUE 아님·nav 주석) | 전 검사 통과 |

## 검사 명령

```bash
pnpm check && pnpm test && pnpm test:e2e
```

## 하지 않는 것

SPEC 의 Out of Scope 그대로. 추가로: 버전 올리기·태그·`release.sh` 는 이 작업의 일이 아니다
(사용자 승인 사항). 임시 배포는 `./deploy/deploy.sh feature/sticker-letters` 로 한다 (2026-10-12 승인).
