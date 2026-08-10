<!-- dotclaude-config
working_directory: .dc_workspace
base_branch: main
language: ko_KR
worktree_path: ../cube-study-feature-memorize-check
doc_dir: 2026_08_08-memorize-check
-->

# 암기 체크 - 아키텍처 및 전역 설계

SPEC.md의 FR-MC-1~22 / NFR-MC-1~5를 구현하기 위한 아키텍처 결정과 페이즈 분해.

**목표 버전**: 0.3.0

---

## 1. 기능 개요

| 항목 | 내용 |
|------|------|
| 목적 | 케이스 × 표기(setup/direct) 단위로 "외웠다" 상태를 관리한다 |
| 문제 | 현재 앱에 암기 진도 추적 기능이 없어, 이미 외운 케이스와 아직 외우지 못한 케이스를 구분할 수 없다 |
| 해결 | localStorage 기반 체크 상태 저장 + 기준 상세/조회 화면에 체크박스 + 퀴즈 필터 + "외운거 안보기" 토글 + About 전체 해제 |

---

## 2. 아키텍처 결정

### AD-1. 진도 상태를 settings.svelte.ts와 분리

신규 모듈 2개:
- `src/lib/domain/memorize.ts` — 순수 로직 (파싱·직렬화·집계·풀 필터)
- `src/lib/ui/memorize.svelte.ts` — Svelte 상태 클래스 (싱글턴, `$state`, `$effect.root`)

근거: SPEC이 키 네임스페이스를 `memorize.` / `anchor.` / `quiz.`로 분리했고 `settings`의 `ui.*`와 성격이 다르다. 표시 취향(settings)과 학습 진도(memorize)는 라이프사이클이 다르다. 후자는 "전체 해제"라는 파괴적 명령과 `schemaVersion`이 붙는다. 순수 로직을 분리하면 `$effect.root()` 싱글턴 없이 Vitest로 단위 검증할 수 있다(`tests/unit/setup-input.test.ts`와 동일 방식).

대안 기각: `settings.svelte.ts` 확장 — 마이그레이션·전체 해제가 표시 설정 파일에 섞인다.

### AD-2. 메모리는 Set 2개, 저장은 배열

- `setupChecked: Set<CaseCode>` / `directChecked: Set<CaseCode>`
- 저장 시: `[...set].sort()`, 로드 시: `new Set(arr)`

근거: 378 케이스 목록 렌더 중 매 행마다 `has(code)` — O(1) 필요. `string[] + includes()`는 렌더당 최대 14만 회 비교. SPEC FR-MC-6이 저장 형식을 배열로 규정해 표현 분리가 강제된다. 정렬 저장은 localStorage diff를 예측 가능하게 해 테스트가 안정적이다.

### AD-3. 기준별 집계는 $derived + 순수 함수

`domain/memorize.ts`에 `anchorProgress(ds, checkedSetup): Map<AnchorName, number>` 정의. UI는 `$derived`로 소비.

근거: 기준 이름·개수 하드코딩 금지(FR-MC-2). 378 순회는 마이크로초 단위. Map 반환으로 조회 O(1). `Dataset.anchors`에 없는 이름은 집계에 등장하지 않으므로 데이터 변경 시 코드 수정이 불필요하다.

### AD-4. 프리렌더/하이드레이션 — 요소 개수·크기 불변 원칙

> ⚠️ **이 프로젝트가 이미 두 번 밟은 함정이다 (`src/routes/+page.svelte:33-46`). 새 코드를 작성하기 전에 반드시 이 원칙을 확인한다.**

`+layout.ts`, `anchors/+page.ts:5`, `anchors/[code]/+page.ts:4`가 전부 `prerender = true`.

**원칙: SSR과 CSR 렌더의 요소 구성·개수·크기가 동일하고, 값만 나중에 채운다.**

| 요소 | SSR 초기값 | CSR 갱신 방법 | 주의 |
|------|-----------|--------------|------|
| 체크박스 | `checked={false}` (크기는 CSS 고정) | 하이드레이션 후 상태만 변경 | SSR에서 크기가 달라지면 안 됨 |
| 진도 숫자 | `0/{total}` (`total`은 데이터에서 확정) | 좌측 숫자만 변경 | `font-variant-numeric: tabular-nums` + `min-width` 예약 + 우측 정렬 |
| "외운거 안보기" 필터 | 전체 목록 렌더 (토글 OFF 가정) | `class:hidden` → CSS `display:none` | DOM 개수 SSR/CSR 동일. **`{#if}`로 제거 금지** |
| "모두 암기" 안내 | 렌더하지 않음 (기본값 OFF) | `{#if browser && hideMemorized && allHidden}` 이중 방어 | SSR에 빈 공간 생기지 않음 |
| 퀴즈 | prerender 없음 | `{#if current && ds}` 패턴 유지 | 이슈 없음 |

`<li>`를 `{#if}`로 조건부 제거하면 목록이 축소되어 레이아웃 점프 → **절대 금지.**

### AD-5. 퀴즈 풀은 $derived, 비면 안내

`pool = $derived(memorizedOnly ? poolFor(checked, quizInput) : Object.keys(ds.cases))`

`next()`가 `pool` 사용. `pool.length === 0`이면 `current = null` + 안내 표시, `next()` 호출하지 않음(FR-MC-20). `memorizedOnly`가 도중에 변경되면 `$effect`로 감지해 `next()` 재호출. `quizInput` 왕복 시 pool 자동 갱신.

### AD-6. 체크박스는 SegToggle 재사용하지 않음

표준 `<input type="checkbox">` + `<label>` 래핑, `min-height: 44px`, 라벨까지 클릭 영역.

근거: `SegToggle`은 두 값이 대등한 세그먼티드 컨트롤이라 boolean on/off에 의미론이 맞지 않고, `SegToggle<T extends string>` 이라 boolean이면 문자열 매핑 오버헤드가 생긴다.

### AD-7. 기준 상세 목록의 체크박스는 `<a>` 밖으로

`<li>` 안을 flex 두 자녀: `<label>(체크박스)` + `<a>(기존 4열 그리드)`.

근거: `<a>` 내부에 넣으면 체크박스 클릭이 링크 네비게이션을 트리거해 `preventDefault`가 필요하고 접근성·터치에서 문제. 형제로 두면 이벤트가 독립된다.

### AD-8. About 전체 해제 확인 UI

`state: 'idle' | 'confirming'`. 첫 클릭에 문구 전환, 두 번째에 실행. `<dialog>`의 `onclose`에서 `idle`로 리셋. 모달을 닫았다 열면 `confirming`이 남아 오해를 부른다. 브라우저 `confirm()` 미사용(FR-MC-22).

---

## 3. 데이터 모델

### localStorage 스키마 (키: `"memorize.checked"`)

```json
{
  "schemaVersion": 1,
  "checked": {
    "setup": ["LB", "BL"],
    "direct": ["LB"]
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `schemaVersion` | `number` | 현재 `1`. 불일치 또는 파싱 실패 시 빈 상태로 초기화 |
| `checked.setup` | `string[]` | setup 표기에서 암기 체크된 케이스 코드 배열 (정렬 저장) |
| `checked.direct` | `string[]` | direct 표기에서 암기 체크된 케이스 코드 배열 (정렬 저장) |

### 추가 localStorage 키

| 키 | 값 | 기본값 | 담당 |
|----|----|--------|------|
| `"anchor.hideMemorized"` | `"true"` \| `"false"` | `"false"` | 기준 상세 "외운거 안보기" |
| `"quiz.memorizedOnly"` | `"true"` \| `"false"` | `"false"` | 퀴즈 "암기한 것만" |

### 타입 정의 (memorize.ts에 추가)

```ts
export interface MemorizeStored {
  schemaVersion: number;
  checked: { setup: string[]; direct: string[] };
}

export type MemorizeChecked = { setup: Set<CaseCode>; direct: Set<CaseCode> };
```

---

## 4. 페이즈 개요

순차 진행. Phase 1 이후는 `anchors/[code]/+page.svelte` 하나가 체크박스·진도·숨기기 세 요구에 동시에 걸려 어떤 조합으로 잘라도 같은 파일을 두 워크트리에서 수정하게 된다.

| Phase | 범위 | 담당 FR/NFR | 상태 |
|-------|------|-------------|------|
| 1 | 도메인 로직 기반 — `memorize.ts` + `memorize.svelte.ts` + 단위 테스트 | FR-MC-1, 2, 5~9, 12, 19; NFR-MC-1, 3, 4 | Complete |
| 2 | 체크박스 UI — `CaseView.svelte` + `anchors/[code]/+page.svelte` | FR-MC-3, 4, 5; NFR-MC-2, 4 | Complete |
| 3 | 진도 표시 — `anchors/+page.svelte` + `anchors/[code]/+page.svelte` | FR-MC-10, 11, 12; NFR-MC-5 | Complete |
| 4 | "외운거 안보기" 토글 — `anchors/[code]/+page.svelte` | FR-MC-13~17; NFR-MC-2 | Complete |
| 5 | 퀴즈 "암기한 것만" — `quiz/+page.svelte` | FR-MC-18~20 | Complete |
| 6 | About "전체 해제" — `About.svelte` | FR-MC-21~22 | Complete |

---

## 5. 파일 목록

### 신규 생성

| 파일 | 역할 |
|------|------|
| `src/lib/domain/memorize.ts` | 순수 로직: `parseStored` / `serialize` / `anchorProgress` / `poolFor` |
| `src/lib/ui/memorize.svelte.ts` | Svelte 상태 싱글턴: `setupChecked`, `directChecked`, `hideMemorized`, `memorizedOnly`, `toggle`, `clearAll` |
| `tests/unit/memorize.test.ts` | 단위 테스트 (Phase 1) |
| `tests/e2e/memorize-checkbox.spec.ts` | 체크박스 E2E (Phase 2) |
| `tests/e2e/memorize-progress.spec.ts` | 진도 표시 E2E (Phase 3) |
| `tests/e2e/memorize-hide.spec.ts` | "외운거 안보기" E2E (Phase 4) |
| `tests/e2e/memorize-quiz.spec.ts` | 퀴즈 필터 E2E (Phase 5) |
| `tests/e2e/memorize-clear.spec.ts` | About 전체 해제 E2E (Phase 6) |

### 수정

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/ui/CaseView.svelte` | header 직후 체크박스 추가 (mode 연동) |
| `src/routes/anchors/+page.svelte` | 기준 카드에 `{체크}/{전체}` 진도 표시 |
| `src/routes/anchors/[code]/+page.svelte` | 케이스 행 체크박스 + 진도 숫자 + "외운거 안보기" 토글 |
| `src/routes/quiz/+page.svelte` | "암기한 것만" 토글 + pool `$derived` 필터 |
| `src/lib/ui/About.svelte` | "암기 표시 전체 해제" 버튼 (2단계 확인) |

### 변경 없음

| 파일 | 이유 |
|------|------|
| `src/lib/ui/settings.svelte.ts` | AD-1로 분리. memorize 관련 상태를 여기에 추가하지 않는다 |
| `src/lib/domain/types.ts` | 새 타입은 `memorize.ts`에 추가 |
| `src/lib/domain/anchor.ts` | `anchorOrder` 재사용만. 수정하지 않는다 |

---

## 6. 위험과 대응

| 위험 | 대응 |
|------|------|
| SSR에서 localStorage 접근 → 빌드 실패 | 초기값을 빈 Set으로 고정, 로드는 `if (browser)` 안. `settings.svelte.ts:5,15,33` 패턴 동일 적용 |
| 하이드레이션 후 숫자 폭 변화로 카드가 밀림 | SSR에서 `0/{total}` 확정 렌더 + `tabular-nums` + `min-width` 예약 (AD-4) |
| 하이드레이션 후 `<li>` 축소로 목록 밀림 | 필터는 CSS `display:none`만 사용, DOM 개수 동일 유지 (AD-4) |
| "모두 암기" 안내가 SSR에 잘못 렌더 | `{#if browser && hideMemorized && allHidden}` 이중 방어 |
| `<a>` 안 체크박스 클릭이 네비게이션 유발 | 체크박스를 `<a>` 밖 형제로 배치 (AD-7) |
| 퀴즈 pool이 도중에 비거나 현재 문제가 pool 밖 | `$effect`로 감지해 `next()` 재호출, 0이면 `current = null` + 안내 |
| About 확인 상태가 모달 재열림 후 잔존 | `onclose`에서 `idle`로 리셋 (AD-8) |
| 데이터 v4에서 기준 재변경 | 도메인 함수는 `Dataset.anchors`/`cases`만 참조. `pnpm build` 후 grep으로 기준 상수 0건 확인 |
| PWA 오프라인 캐시 누락 | 신규 파일 전부 번들 포함, 런타임 네트워크 요청 0 |
| 역케이스 자동 연동 오해 | `BF` 토글이 `FB`를 바꾸지 않음을 E2E로 명시 검증 |
