<!-- dotclaude-config
working_directory: .dc_workspace
base_branch: main
language: ko_KR
worktree_path: ../cube-study-feature-op-exam
doc_dir: 2026_10_29-op-exam
-->

# 0.9.0 — 하단 탭 제거 · 시험 · OP 코너

이슈: #46 (하단 탭 제거) · #18 (OP 코너) · #34 (시험)
마일스톤: 0.9.0 · 브랜치 `feature/op-exam`

사용자가 정한 것은 **(사용자)** 로 표시한다. 나머지 세부는 "결정" 표에 근거와 함께 적었다.

**구현 권장 순서: #46 → #18 → #34.** 탭을 먼저 없애야 새로 만드는 화면이 처음부터 탭 없이 서랍에만 붙는다. OP 는 M2 와 같은 꼴이라 독립적으로 진행할 수 있다. 시험은 매일 퀴즈 코드를 건드려 가장 위험하므로 마지막이다.

---

## 1. 무엇을 만드는가

| | |
|---|---|
| #46 하단 탭 제거 | 모든 화면의 하단 형제 탭바를 없앤다. 형제 화면으로 가는 길은 ☰ 서랍 하나만 남는다 **(사용자)** |
| #18 OP 코너 조회 | `/3x3/bld/op/corner/lookup`. 타깃 21줄 + `[Y]` 자체 1줄 = 22줄 표, 줄마다 암기 체크. 원리 설명 |
| #18 OP 코너 퀴즈 | `/3x3/bld/op/corner/quiz`. 공식 `setup [Y] setup'` 전체를 친다. 자판에 `[Y]` 키 **(사용자)** |
| #34 시험 | `/3x3/bld/3style/corner/exam`. 문항 수를 고르고, 판정 없이 끝까지 풀고, 한 번에 채점. 결과를 최근 50건 쌓는다 **(사용자)** |
| 데이터 | `src/lib/data/corner-UBL-op.json`. 원본은 사용자 PDF `op_corners.pdf` (2026-10-29, 비공개) |

---

## 2. Part A — 하단 탭 제거 (FR-TB, #46)

### FR-TB-1 탭바 마크업·스타일 제거
`src/routes/+layout.svelte` 에서 탭바 마크업과 그 스타일(`min-height: 52px` + 테두리 1px = 53px sticky 영역)을 완전히 제거한다.

### FR-TB-2 `tabsFor` 정리
`src/lib/ui/nav.ts:81` 의 `tabsFor` 함수는 `+layout.svelte` 탭바가 유일한 호출처다. 다른 호출처가 없음을 확인하고 제거한다. `labelFor`(`nav.ts:57`)와 형제 묶음 계산은 서랍(FR-DR-3)이 쓰므로 남긴다.

### FR-TB-3 문서 갱신
- `.dc_workspace/CONVENTIONS.md` 1.4 절("하단 탭은 형제만 담는다") 삭제, 1.1 절 세로 순서 끝 칸("형제 탭") 삭제
- `CLAUDE.md` 의 세로 순서 항목 끝 "진행 버튼 → 형제 탭" 에서 "→ 형제 탭" 삭제, "하단 탭은 기능 칸만 다른 화면끼리다" 항목 삭제
- `.dc_workspace/SVELTE.md` 라우트 축 절의 탭 언급(예: "하단 탭의 형제" 문구) 점검 및 수정
- `.dc_workspace/2026_10_18-drawer-push/SPEC.md:139` D-10 ("하단 형제 탭은 그대로") 에 "→ #46 에서 대체됨" 주석 추가

### FR-TB-4 검사 갱신
- `tests/e2e/conventions.spec.ts` 에서 "공식 화면 넷은 형제 탭 넷을 단다", "스티커 문자 화면 둘은 서로의 형제 탭을 단다 (#19)" 를 "어느 화면에도 탭바가 없다" 로 교체
- `tests/unit/nav.test.ts` 의 `tabsFor` 관련 검사를 `tabsFor` 함수 삭제에 맞춰 제거
- 탭바 높이를 상수로 참조하거나 레이아웃 계산에 끼워 넣은 코드를 찾아 제거한다 (예: `e928c2e` 커밋이 매일 퀴즈에서 같은 부류를 밟았다)

### FR-TB-5 실측 기록
제거 후 세로 공간을 다시 재어 이슈 #46 의 표를 완성한다. 기준 실측(2026-10-29, 제거 전): 375×667에서 코너 퀴즈 740px · M2 퀴즈 717px, 390×844에서 둘 다 894px.

---

## 3. Part B — OP 코너 (FR-OP, #18)

### 3-1. 데이터 (FR-OP-D)

- **FR-OP-D-1** 버퍼 UBL (스티커 A·E·R). 교환 자리 DFR 의 R-face 스티커 = **P**. 교환 공식 `[Y]` = `R U' R' U' R U R' F' R U R' U' R' F R`. setup 은 D·F·R 무브만 쓴다 (U·B·L 은 버퍼를 건드린다).
- **FR-OP-D-2** 데이터 파일은 줄마다 **setup 만** 적는다. `[Y]` 와 역 setup 은 코드가 펼쳐 만든다 — 데이터의 공식을 코드가 수정하거나 생성하지 않는다 (CONVENTIONS 6.2). 표기 형식은 PDF 그대로 `setup [Y] setup'` **(사용자)**.
- **FR-OP-D-3** 데이터 행 22줄: 타깃 21줄 (버퍼 A·E·R 제외. P 행의 공식은 `[Y]` 단독) + **`[Y]` 행** 1줄 — 그 공식은 `[Y]` 의 15수 전체다. `[Y]` 를 하나의 공식으로 외우게 하는 줄이다 **(사용자)**. **패리티 행은 없다** — M2 SPEC FR-M2-D-6 의 "그 교환은 코너 패리티 공식의 몫" 이 OP `[Y]` 의 UB↔UL 교환으로 닫힌다.
- **FR-OP-D-4** `[Y]` 단독 효과: 코너 UBL↔DFR 교환, 엣지 UB↔UL 교환 (facelet 37·46). 이 엣지 교환이 M2 패리티(`D' L2 D M2 D' L2 D`)가 남기는 UB↔UL 이다. OP 데이터에는 패리티 행을 두지 않는다.
- **FR-OP-D-5** setup 표 (PDF 2026-10-29 검증 완료, 수정 사항 없음):

  | 문자 | setup | 문자 | setup | 문자 | setup |
  |---|---|---|---|---|---|
  | B | `R D'` | C | `F` | D | `F R'` |
  | F | `F2` | G | `D2 R` | H | `D2` |
  | I | `F' D` | J | `F2 D` | K | `D R` |
  | L | `D` | M | `R'` | N | `R2` |
  | O | `R` | P | `` (없음) | Q | `R' F` |
  | S | `D' R` | T | `D'` | U | `F'` |
  | V | `D' F'` | W | `D2 F'` | X | `D F'` |

### 3-2. 검증 (테스트)

- 21줄 전수: `setup [Y] setup'` 가 UBL ↔ 타깃 코너 교환만 한다. 바뀌는 코너는 UBL + 타깃 둘뿐, 엣지·센터는 `[Y]` 단독과 같다 (2026-10-29, cubejs 확인).
- `[Y]` 단독: 코너 UBL↔DFR, 엣지 UB↔UL (facelet 37·46).
- 무브 정의는 cubejs 가 한다 (README "무브 정의를 저장소로 다시 들여오지 말 것").

### 3-3. 조회 (FR-OP-L)

- **FR-OP-L-1** 표: 문자 · 자리 · 공식(`setup [Y] setup'`) · 암기 체크. `[Y]` 행은 표 맨 위에 두고 15수 전체를 보인다. 다른 줄의 `[Y]` 는 `Alg.svelte` 의 anchor 역할(3-style 기준공식 표시)로 보인다 (위임 — 결정 표).
- **FR-OP-L-2** 화면 문자는 대문자 (`A`–`X`) (위임 — M2 D-5 와 같다). 내부 키는 `speffz.ts` 의 코너 대문자 (`CORNER_INDEX`).
- **FR-OP-L-3** 원리 설명 (`<details>`, 기본 접힘): 교환은 `[Y]` 하나, setup 은 타깃을 P 자리로 가져온다, D·F·R 만 쓰는 이유(U·B·L 은 버퍼를 건드림), `[Y]` 의 UB↔UL 엣지 부작용과 M2 패리티와의 관계.
- **FR-OP-L-4** 암기 체크는 줄 단위. 저장 키 `op.checked` (3-style `memorize.checked`, M2 `m2.checked` 와 따로).

### 3-4. 퀴즈 (FR-OP-Q)

- **FR-OP-Q-1** 문제: 문자(크게) · 자리. `[Y]` 행이 문제면 `Y-perm` 으로 보이고 `[Y]` 키를 잠근다(`disabled`) — 키를 두면 `[Y]` 하나로 정답이 된다. P 는 답이 `[Y]` 하나인 것이 맞으므로 잠그지 않는다.
- **FR-OP-Q-2** 입력은 무브 자판. `MoveKeypad` 의 `extraRows` (M2 AD-3, `src/lib/ui/MoveKeypad.svelte`) 로 `[Y]` 키를 추가한다. 입력 순서: setup 무브 → `[Y]` → 역 setup 무브 **(사용자)**.
- **FR-OP-Q-3** 채점은 `[Y]` 를 펼친 54칸 상태 비교. 데이터 공식과 상태가 같으면 정답 — 다른 순서의 동치 공식도 맞다. 다른 줄과 같은 상태면 "X(…)의 공식입니다" 로 알려준다 (M2 FR-M2-Q-3 과 같은 원칙).
- **FR-OP-Q-4** "암기한 것만 출제". 저장 키 `op.quiz.memorizedOnly`. 비면 안내하고 전체로 물러나지 않는다.
- **FR-OP-Q-5** 출제는 `pickNext` (최근 20 제외).

### 3-5. 서랍 · 저장 (FR-OP-S)

- **FR-OP-S-1** 서랍 그룹 `OP 코너`. M2 엣지 그룹 다음, 트레이싱 앞에 둔다.
- **FR-OP-S-2** "앱 정보" 의 "암기 전체 해제"(`About`)가 `op.checked` 도 비운다.

---

## 4. Part C — 시험 (FR-EX, #34)

### 4-1. 공통 세션 모듈 추출 (FR-EX-R)

- **FR-EX-R-1** `src/lib/domain/daily.ts` · `src/lib/ui/daily.svelte.ts` · `src/routes/3x3/bld/3style/corner/daily/+page.svelte` 에 있는 판 진행 로직(문항 뽑기 → 답 입력 → 채점 → 결과 표시 → 이어 풀기)을 날짜 독립적인 공통 모듈로 추출한다.
- **FR-EX-R-2** 매일 퀴즈의 동작은 변경되지 않는다. `tests/e2e/daily.spec.ts` 가 리팩터링 전후로 그대로 통과해야 한다.
- **FR-EX-R-3** 날짜 묶임(`daily/+page.svelte:74`, 오늘 아닌 판 버림)은 매일 퀴즈 전용 로직이다. 공통 모듈에 들어가지 않는다.
- **FR-EX-R-4** 저장 키를 분리한다. 매일 퀴즈: `daily.size`(기존) · `daily.session`(기존). 시험: `exam.size` · `exam.session` · `exam.records`. 시험 판이 매일 퀴즈 저장을 덮지 않는다 (`src/lib/ui/daily.svelte.ts:21` `KEY_SESSION = 'daily.session'` 과 충돌 없음).

### 4-2. 시험 화면 (FR-EX-S)

- **FR-EX-S-1** 경로: `/3x3/bld/3style/corner/exam`. 진입은 서랍만 — 하단 탭은 #46 에서 없어진다 **(사용자)**.
- **FR-EX-S-2** 문항 수는 시험 화면 설정 줄에서 사용자가 고른다. 범위 5 ~ 50, 기본값 10 **(사용자: 최대 50)**. 진행 중 설정 줄을 접고 잠근다 (`disabled`) — 시험 기록을 남기는 화면이므로 CONVENTIONS 2.3 에 따라 잠근다.
- **FR-EX-S-3** 출제 범위: `buildDailySet` (`src/lib/domain/daily.ts:59`) 그대로 사용 — 현재 입력 방식의 암기 체크한 것 우선, 모자라면 나머지에서 채운다.
- **FR-EX-S-4** 횟수 제한 없다. 하루 한 판은 매일 퀴즈(`daily`) 의 규칙이다.
- **FR-EX-S-5** 진행 중 각 문항은 판정 없이 표시한다. 전부 풀고 나서 한 번에 채점한다 (SPEC `2026_10_18-drawer-push` FR-DQ-4 와 같은 흐름).
- **FR-EX-S-6** 중간에 나가면 이어서 푼다. 답 없는 첫 문항부터 연다 (FR-DQ-6 과 같다).
- **FR-EX-S-7** 채점 시 `push.noteQuiz()` 를 호출한다 (`src/lib/push/meta.ts:21` `facts.lastQuiz` 갱신). 매일 퀴즈 채점(`daily/+page.svelte:133`)과 같은 처리다.

### 4-3. 기록 (FR-EX-REC)

- **FR-EX-REC-1** 결과는 기기에 쌓는다. 최근 50건. 상한 근거: 50문항 한 건 ≈ 3.5KB(추정). Web Storage 출처당 약 5MiB 이지만 `put()` 이 조용히 실패를 삼킨다(`src/lib/ui/daily.svelte.ts:31`). 상한이 있으면 그 경로가 없다. 숫자만 바꾸면 늘릴 수 있다 (`src/lib/domain/tracing.ts:216` `RECORD_LIMIT = 50` 과 같은 패턴).
- **FR-EX-REC-2** 한 건의 내용: 날짜 · 입력 방식 · 문항 수 · 맞힌 수 · 문항별 `{case, answer}`. 판정은 저장하지 않는다 — 같은 답이면 같은 판정이다 (FR-DQ-6 과 같은 이유).
- **FR-EX-REC-3** 기록 스키마는 처음부터 버전을 단다. 칸을 늘릴 때는 선택 필드로 추가한다. 기존 `memorize.*` · `trace.*` · `daily.*` 스키마는 건드리지 않는다.
- **FR-EX-REC-4** 시험 화면 `idle` 단계 설정 줄 아래에 기록 목록을 표시한다 (별도 화면이 아니다). 표시 형식: 날짜 · 입력 방식 · `N문제 중 M개`, 최신 건이 위. 백분율을 쓰지 않는다 (CONVENTIONS 4.5).

---

## 5. 결정

| # | 결정 | 근거 |
|---|---|---|
| D-1 | OP 경로 `/3x3/bld/op/corner/{lookup,quiz}` | `SVELTE.md` 라우트 축 표가 #18 을 `/3x3/bld/op/corner/lookup` 으로 이미 적었다. 퀴즈는 M2 D-1 과 같은 이유로 형제 |
| D-2 | 시험 경로 `/3x3/bld/3style/corner/exam` | **(사용자)**. 코너 3-style 세트 안의 기능 칸 — `lookup · algs · quiz · daily` 와 같은 층 |
| D-3 | `[Y]` 는 조회 표의 독립 행이고 퀴즈 출제 대상이다 | **(사용자)**. P 행 공식이 `[Y]` 하나다. 외워야 하는 공식이므로 암기 체크·퀴즈 대상에 포함한다 |
| D-4 | 퀴즈 표기 `setup [Y] setup'`, 자판에 `[Y]` 키 | **(사용자)**. PDF 표기를 그대로 따른다. 채점은 `[Y]` 를 펼쳐 54칸 비교 |
| D-5 | `[Y]` 행 문제에서 `[Y]` 키 비활성화 | P 행은 공식이 `[Y]` 단독이라 `[Y]` 키를 허용하면 입력 즉시 정답이 되어 훈련 가치가 없다 |
| D-6 | 저장 키 `op.checked` · `op.quiz.memorizedOnly` | 코너 3-style (`memorize.checked`) · M2 (`m2.checked`) 와 분리. 같은 문자(A–X)를 다른 방법에서 쓰므로 키가 섞이면 진도가 갈린다 |
| D-7 | About "전체 해제"가 `op.checked` 도 비운다 | 버튼 문구 "암기 전체 해제"가 일부만 비우면 거짓이 된다 (M2 D-7 과 같은 이유) |
| D-8 | 시험 문항 수 최소 5 · 기본 10 | 매일 퀴즈 `DAILY_MIN = 5` (`src/lib/domain/daily.ts:18`) 와 같게. 기본값은 매일 퀴즈 기본(10)과 동일 |
| D-9 | 기록 50건 상한 | FR-EX-REC-1 근거. `tracing.ts:216` `RECORD_LIMIT = 50` 과 같은 패턴 |
| D-10 | 시험 채점도 `push.noteQuiz()` 호출 | `facts.lastQuiz` 는 "코너 퀴즈를 마지막으로 채점한 날짜" (`src/lib/push/meta.ts:21`). 시험도 코너 퀴즈 채점이다 |
| D-11 | 탭 제거가 뒤집는 결정: `2026_10_18-drawer-push/SPEC.md:139` D-10 "하단 형제 탭은 그대로" | **(사용자, 2026-10-29)**. 훈련 화면이 한 화면에 드는 것을 택한다. 형제 이동 1탭 → 2탭 비용은 그대로 남는다 |
| D-12 | `tabsFor` 제거, `labelFor` · 형제 묶음 계산 유지 | `tabsFor`(`nav.ts:81`)의 호출처가 탭바 하나뿐임을 확인 후 제거. `labelFor`(`nav.ts:57`)은 서랍(FR-DR-3)이 쓴다 |

---

## 6. NFR / 제약

- 룬만 쓴다. `export let` · `$:` · `on:click` · `<slot>` · `svelte/store` 없음.
- 서버 기능 없음. `+page.server` · `+server` · form actions · 서버 훅 · 비공개 환경변수 없음.
- 접기는 CSS. `{#if}` 로 DOM 요소를 넣고 빼지 않는다 (CONVENTIONS 5.1, 이 저장소가 두 번 밟은 함정).
- 단계는 `data-stage` 로 낸다. 터치 타깃 44px 이상. UI 문구는 사실만 — 백분율·격려·게이미피케이션 없음.
- E2E 테스트 제목에 템플릿 리터럴 없음. `tests/unit/e2e-tags.test.ts` 파서가 문자열 리터럴만 읽는다.
- 기존 `memorize.*` · `trace.*` · `daily.*` 저장 스키마를 건드리지 않는다.
- `package.json` 버전은 릴리스(`./deploy/release.sh`)에서만 올린다.

---

## 7. 범위 밖

- 애니메이션 (#45)
- 조회 화면의 3D 큐브 (#36)
- 매일 퀴즈 · 푸시에 M2 · OP 를 넣는 것
- M2 · OP 세트를 위한 시험 화면
