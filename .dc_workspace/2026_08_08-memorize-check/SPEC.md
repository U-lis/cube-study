<!-- dotclaude-config
working_directory: .dc_workspace
base_branch: main
language: ko_KR
worktree_path: ../cube-study-feature-memorize-check
doc_dir: 2026_08_08-memorize-check
-->

# 암기 체크 - Specification

## 개요

3BLD 코너 3-style 학습 앱(cube-study)에 **암기 체크** 기능을 추가한다.

사용자는 케이스 × 표기(setup / optimized) 단위로 "외웠다"를 표시하고, 퀴즈에서 현재 입력 방식에 맞게 암기한 케이스만 출제하는 옵션을 사용할 수 있다. 기준 상세 화면에서는 외운 케이스를 숨기는 토글과 setup 기준 진도 집계를 확인할 수 있다.

**목표 버전**: 0.3.0

---

## 기능 요구사항 (FR)

### 체크 단위 및 대상

- [ ] **FR-MC-1**: 암기 체크 단위는 **케이스 × 표기**다. `setup` 암기 상태와 `direct`(optimized) 암기 상태를 독립적으로 저장하고 독립적으로 표시한다.
  - 같은 케이스라도 셋업형(`setup.alg`)과 최적형(`direct.alg`)은 실제로 다른 무브열이므로 따로 외운 것으로 본다.
  - 퀴즈에 이미 direct·setup 두 입력 방식이 있다(`quiz/+page.svelte:38-54` — `INPUT_OPTIONS`). 케이스 단위로만 저장하면 setup만 외운 케이스가 direct 모드 퀴즈의 "암기한 것만"에 출제되어 필터가 목적을 잃는다.
  - 체크 대상은 데이터의 케이스 전체(`Dataset.cases`, 현재 378개)다.

- [ ] **FR-MC-2**: 기준공식의 개수·이름·순서를 코드 어디에도 하드코딩하지 않는다. 기준별 집계는 런타임에 `Dataset.anchors`와 `Dataset.cases`를 순회해 계산한다.
  - 근거: `src/lib/domain/types.ts:1-11` 주석 — "v2→v3에서 기준이 10개→6개로 바뀐 전례가 있다."

### 체크박스 위치

- [ ] **FR-MC-3**: 체크박스는 두 군데에 둔다. 퀴즈 화면에는 두지 않는다.

  **(a) 조회 결과 카드 (`src/lib/ui/CaseView.svelte`)**
  - `<section class="case">` 안에서 케이스 코드(`<h1>`) 영역과 시각적으로 연결된 위치에 배치한다.
  - 체크박스 하나이며, **현재 보고 있는 표기(`settings.mode`)의 암기 상태**를 나타낸다. `settings.mode`가 `'setup'`이면 setup 암기 상태를, `'direct'`(optimized)이면 direct 암기 상태를 반영한다.
  - 체크박스 라벨 또는 근처에 어느 표기 기준인지 명시한다(예: "setup 암기", "optimized 암기"). 사용자가 direct/setup 토글을 바꿀 때 체크 상태가 함께 바뀌는 이유를 알 수 있어야 한다.
  - 근거: `CaseView.svelte:24` — `let mode = $derived(settings.mode)`; `CaseView.svelte:44-81` — `.toggles` 블록이 setup/optimized 전환 UI를 담당한다.
  - 근거: `CaseView.svelte:35-139` — 카드 DOM 구조는 `header` → `.toggles` → `.block` → `.main` → `footer` 순이다. 체크박스는 `header` 영역 내부 또는 직후에 둔다. `footer`는 역케이스 링크 전용이므로 혼용하지 않는다 (`CaseView.svelte:135-139`).

  **(b) 기준 상세 화면 케이스 목록 (`src/routes/anchors/[code]/+page.svelte`)**
  - `<ul>` 내 각 `<li>` → `<a>` 행에 체크박스를 추가한다.
  - **항상 setup 암기 상태를 표시한다.** 이 화면은 셋업 무브(`c.setup.S`)를 나열하는 화면이므로, 전역 `settings.mode`가 `'direct'`(optimized)일 때 direct 암기 상태를 표시하면 화면에 보이는 내용과 체크 기준이 어긋난다.
  - 근거: `anchors/[code]/+page.svelte:36-38` — 각 케이스 행에서 `c.setup.S` 무브열을 표시한다. 이 화면의 목적은 setup 방식 학습이다.
  - 근거: `anchors/[code]/+page.svelte:88-89` — 현재 행 그리드는 `grid-template-columns: 3.2rem 1fr 1.2rem auto`(4열)다. 체크박스 열을 추가하거나 기존 열 구조를 확장한다.

- [ ] **FR-MC-4**: 체크박스의 터치 대상은 44px 이상이어야 한다.
  - 근거: 기존 제약; `About.svelte:110` — 버튼 `min-height: 44px`.

- [ ] **FR-MC-5**: 체크 상태를 토글하면 즉시 localStorage에 반영한다. 별도 저장 버튼을 두지 않는다.

### localStorage 저장 형식

- [ ] **FR-MC-6**: 암기 체크 데이터를 localStorage에 저장한다. 스키마는 아래 형식을 따른다.

  ```json
  {
    "schemaVersion": 1,
    "checked": {
      "setup": ["LB", "BL", "SC"],
      "direct": ["LB", "SC"]
    }
  }
  ```

  - 저장 키: `"memorize.checked"` (기존 `ui.*` 키와 네임스페이스를 구분한다)
  - `schemaVersion` 필드를 반드시 포함한다. 형식이 바뀌어도 마이그레이션 또는 빈 상태로 초기화할 수 있게 한다.
  - `checked.setup` / `checked.direct`는 각각 해당 표기에서 체크된 케이스 코드의 배열이다.
  - 근거: `settings.svelte.ts:8-11` — 기존 키 규칙(`'ui.mode'`, `'ui.notation'`). 암기 데이터는 UI 표시 설정이 아니라 학습 진도이므로 `memorize.` 접두어를 사용한다.

- [ ] **FR-MC-7**: 읽기 시 `schemaVersion`이 인식 범위 밖이거나 JSON 파싱에 실패하면 체크 데이터를 빈 상태(`{ setup: [], direct: [] }`)로 초기화한다. 파싱 오류가 앱 기동을 막아서는 안 된다.
  - 근거: `settings.svelte.ts:15-19` — `read<T>()` 헬퍼가 허용값 밖이면 `fallback`을 반환하는 방어 패턴.

- [ ] **FR-MC-8**: 저장은 브라우저 localStorage만 사용한다. 기기 간 동기화는 하지 않는다. 정적 배포이므로 서버 런타임이 없다.

- [ ] **FR-MC-9**: 내보내기/가져오기 기능은 이번 범위 밖이다.

### 진도 표시

- [ ] **FR-MC-10**: 기준 상세 화면(`src/routes/anchors/[code]/+page.svelte`)의 케이스 수 표시 위치에 setup 체크 집계를 병기한다.
  - 현재 표시: `{data.cases.length}개 케이스` (`anchors/[code]/+page.svelte:30`)
  - 변경 후 형식: `{setup 체크 케이스 수}/{전체 케이스 수}` (예: `3/45`)
  - 진도바·퍼센트·달성 연출·축하 문구를 넣지 않는다.

- [ ] **FR-MC-11**: 기준공식 목록 화면(`src/routes/anchors/+page.svelte`)의 각 기준 카드에 setup 체크 집계를 표시한다.
  - 현재 표시: `r.count` (기준 담당 케이스 수) (`anchors/+page.svelte:28`)
  - 변경 후 형식: 케이스 수 옆에 `{setup 체크}/{전체}` 추가 (예: `3/100`)
  - 체크가 0개이면 `0/{전체}`로 표시한다. 항목을 숨기거나 별도 분류하지 않는다.
  - 이 화면도 기준 상세 화면과 같이 setup 기준을 사용한다. 기준공식 브라우저는 setup 방식 학습을 위한 화면이기 때문이다.

- [ ] **FR-MC-12**: 진도 집계는 런타임에 `Dataset.cases`를 순회해 계산한다. 데이터의 기준 목록이 바뀌어도 코드 수정 없이 따라간다 (FR-MC-2와 동일 원칙).

### 기준 상세 화면 — "외운거 안보기" 토글

- [ ] **FR-MC-13**: 기준 상세 화면(`src/routes/anchors/[code]/+page.svelte`)에 "외운거 안보기" 토글을 추가한다.
  - 위치: 기준 상세 화면에만 둔다. 기준공식 목록(`/anchors`)에는 두지 않는다.
  - 판정 기준: **setup 암기 상태**. FR-MC-3(b)의 예외(항상 setup)와 일치한다.
  - 토글이 켜진 상태에서 케이스 목록은 setup 체크된 케이스를 숨긴다.

- [ ] **FR-MC-14**: "외운거 안보기" 토글 상태를 localStorage에 저장한다.
  - 저장 키: `"anchor.hideMemorized"` (값: `"true"` | `"false"`)
  - 기본값: `false` (전부 보임)
  - 근거: `settings.svelte.ts:33-43` — `$effect.root()` + `$effect()` 자동 저장 패턴을 동일하게 따른다.

- [ ] **FR-MC-15**: 토글이 켜진 상태에서 모든 케이스가 숨겨져 목록이 비면, "모두 암기 표시되어 있습니다"라는 안내를 표시한다. 빈 `<ul>`만 남기지 않는다.

- [ ] **FR-MC-16**: "외운거 안보기" 토글의 ON/OFF 여부와 무관하게, 진도 숫자(FR-MC-10)는 항상 전체 케이스 수를 분모로 한다. 숨겨진 케이스가 진도 분모에서 빠지면 안 된다.

- [ ] **FR-MC-17**: 토글이 켜지고 꺼질 때 케이스 목록의 레이아웃 점프가 없어야 한다. 기존 NFR/FR-4 — "요소가 뒤늦게 나타나며 화면을 밀면 안 된다."

### 퀴즈 — "암기한 것만" 옵션

- [ ] **FR-MC-18**: 퀴즈 화면(`src/routes/quiz/+page.svelte`)에 "암기한 것만 출제" 토글을 추가한다.
  - 저장 키: `"quiz.memorizedOnly"` (값: `"true"` | `"false"`)
  - 기본값: `false` (전체에서 출제)

- [ ] **FR-MC-19**: "암기한 것만" 토글이 켜진 상태에서 퀴즈 `next()` 함수의 출제 풀은 **현재 퀴즈 입력 방식(`settings.quizInput`)에 해당하는 표기의 체크된 케이스**만 포함한다.
  - `settings.quizInput === 'direct'`이면 `checked.direct` 목록을 풀로 사용한다.
  - `settings.quizInput === 'setup'`이면 `checked.setup` 목록을 풀로 사용한다.
  - 근거: `settings.svelte.ts:30` — `quizInput = $state<Mode>(read(KEY_QUIZ_INPUT, ['direct', 'setup'] as const, 'direct'))`.
  - 근거: `quiz/+page.svelte:69-78` — 현재 `next()`는 `Object.keys(ds.cases)`를 전체 순회한다. 이 풀을 토글 상태에 따라 필터링한다.

- [ ] **FR-MC-20**: "암기한 것만" 토글이 켜져 있고 현재 입력 방식의 암기 케이스가 0개이면:
  - 토글은 켜진 상태를 유지한다.
  - "암기 표시한 공식이 없습니다"라는 안내를 화면에 표시한다.
  - 전체 케이스에서 조용히 출제하지 않는다.

### 앱 정보 모달 — 전체 해제

- [ ] **FR-MC-21**: 앱 정보 모달(`src/lib/ui/About.svelte`)에 "암기 표시 전체 해제" 버튼을 추가한다.
  - 위치: 기존 "업데이트 확인" 버튼(`About.svelte:31-39`) 아래에 추가한다.
  - setup과 direct 두 표기의 체크를 모두 초기화한다(`checked.setup = []`, `checked.direct = []`).
  - 근거: `About.svelte:21-47` — `<dialog>` 내 `.body` 구조. `About.svelte:110` — 버튼 `min-height: 44px`.

- [ ] **FR-MC-22**: "암기 표시 전체 해제" 버튼을 누르면 확인 절차를 거친 후 실행한다.
  - 확인 절차: 버튼이 "정말 해제합니다"(또는 동등한 문구)로 바뀌고, 다시 누르면 실행된다. 브라우저 `confirm()` 다이얼로그를 쓰지 않는다. `<dialog>` 모달 내 인라인 확인 UI를 사용한다.
  - 실행 후: `checked.setup`과 `checked.direct`가 모두 빈 배열이 되고, localStorage의 `"memorize.checked"` 항목이 갱신된다.
  - 되돌릴 수 없는 동작임을 UI에서 명확히 알린다.

---

## 비기능 요구사항 (NFR)

- [ ] **NFR-MC-1**: localStorage 읽기는 `browser` 가드(`$app/environment`) 안에서 수행한다. SSR(SvelteKit 정적 빌드의 프리렌더 단계)에서 `localStorage`에 접근하면 오류가 난다.
  - 근거: `settings.svelte.ts:5,15` — `import { browser } from '$app/environment'`; `if (!browser) return fallback`.

- [ ] **NFR-MC-2**: 체크 상태 변경이 결과 카드 및 케이스 목록의 레이아웃을 변경하면 안 된다. FR-MC-17 참고.

- [ ] **NFR-MC-3**: PWA 오프라인 동작을 깨지 않는다. 암기 체크 관련 신규 파일은 빌드 번들에 포함되거나 localStorage에 저장되어야 한다. 런타임 네트워크 요청을 추가하지 않는다.

- [ ] **NFR-MC-4**: 체크 상태를 반영하는 UI 업데이트는 Svelte `$state` 반응성을 통해 자동으로 일어나야 한다. 수동 DOM 조작이나 강제 재렌더를 쓰지 않는다.
  - 근거: `settings.svelte.ts:23-30` — `$state<Mode>(...)` 패턴.

- [ ] **NFR-MC-5**: dry한 정보 앱 톤을 유지한다. 다음을 넣지 않는다.
  - 진도바, 퍼센트 표시
  - "N개 남았어요", "다 외웠어요!" 같은 동기부여/축하 문구
  - 배지, 연속 기록, 달성 연출 등 게임화 요소
  - 근거: 기존 NFR-9.

---

## 제약

- **기준공식 하드코딩 금지**: 기준공식의 개수·이름·순서를 코드 어디에도 박지 않는다. v2→v3에서 기준이 10개에서 6개로 바뀐 전례가 있다. 기준 관련 모든 집계는 `Dataset.anchors`와 `Dataset.cases`를 읽어 계산한다.
  - 근거: `types.ts:1-11`; `README.md:20`.

- **데이터 알고리즘 재계산 금지**: `Dataset.cases`의 알고리즘 필드를 재계산하거나 교체하지 않는다.

- **역케이스 자동 연동 없음**: `BF`를 체크해도 `FB`가 자동으로 체크되지 않는다. 역케이스는 각각 독립적으로 체크한다.
  - 근거: `types.ts:94` — `CaseEntry.inverse: CaseCode`.

- **기기 간 동기화 없음**: localStorage 사용. 서버 런타임이 없는 정적 배포이므로 동기화 수단이 없다.

- **내보내기/가져오기 없음**: 이번 버전(0.3.0) 범위 밖이다.

- **퀴즈 화면 체크박스 없음**: 퀴즈 중 "지금 풀고 있는 케이스를 체크"하는 UI를 퀴즈 화면에 두지 않는다.

- **기술 스택 고정**: SvelteKit 2 + TypeScript + `adapter-static` + `@vite-pwa/sveltekit`. 정적 빌드.

---

## Out of Scope

| 항목 | 비고 |
|------|------|
| 내보내기 / 가져오기 (JSON 파일) | 다음 버전 후보 |
| 기기 간 동기화 | 서버 런타임 없으므로 계획 없음 |
| 케이스별 "학습중" 중간 상태 (체크 외 부분 표시) | 계획 없음 |
| 역케이스 자동 연동 | 이번 범위 밖 |
| 암기 날짜 기록 / 복습 일정 | 계획 없음 |
| 퀴즈 화면 체크박스 | 이번 범위 밖 |
| 진도바, 퍼센트, 달성 애니메이션 | NFR-MC-5로 명시 금지 |

---

## 코드 조사 결과 요약

본 SPEC 작성에 참조한 실제 파일과 근거 라인:

| 파일 | 참조 내용 |
|------|-----------|
| `src/lib/ui/settings.svelte.ts:8-11` | localStorage 키 네이밍 규칙 (`ui.*`) |
| `src/lib/ui/settings.svelte.ts:15-19` | `read<T>()` 방어 읽기 패턴 |
| `src/lib/ui/settings.svelte.ts:23-30` | `mode`, `quizInput` 두 설정의 분리 구조 |
| `src/lib/ui/settings.svelte.ts:33-43` | `$effect.root()` + `$effect()` 자동 저장 패턴 |
| `src/lib/domain/types.ts:1-11` | 기준공식 하드코딩 금지 사유 (v2→v3 전례) |
| `src/lib/domain/types.ts:22` | `CaseCode` 타입 |
| `src/lib/domain/types.ts:94` | `CaseEntry.inverse: CaseCode` |
| `src/lib/domain/types.ts:128-133` | `Dataset.cases: Record<CaseCode, CaseEntry>` |
| `src/lib/ui/CaseView.svelte:24` | `let mode = $derived(settings.mode)` — 체크박스 표기 기준 |
| `src/lib/ui/CaseView.svelte:35-139` | 결과 카드 DOM 구조 (체크박스 삽입 위치 근거) |
| `src/routes/anchors/+page.svelte:17-51` | 기준공식 목록 카드 구조 (`r.count` 위치) |
| `src/routes/anchors/[code]/+page.svelte:30` | 케이스 수 표시 (`{data.cases.length}개 케이스`) |
| `src/routes/anchors/[code]/+page.svelte:32-52` | 케이스 목록 `<ul>` + 행 그리드 4열 구조 |
| `src/routes/anchors/[code]/+page.svelte:36-38` | `c.setup.S` 무브열 표시 — 이 화면이 setup 전용인 근거 |
| `src/routes/quiz/+page.svelte:38-54` | `INPUT_OPTIONS` — direct/setup 두 입력 방식 정의 |
| `src/routes/quiz/+page.svelte:69-78` | `next()` 출제 풀 생성 로직 |
| `src/lib/ui/About.svelte:21-47` | 정보 모달 `<dialog>` 구조 |
| `src/lib/ui/About.svelte:31-39` | "업데이트 확인" 버튼 — 전체 해제 버튼 삽입 기준점 |
| `src/lib/ui/About.svelte:110` | 버튼 `min-height: 44px` |
| `README.md:20` | 현재 기준공식 6개 (`GC TC BU IV KS KG`) — 데이터 기준, 하드코딩 금지 재확인 |
