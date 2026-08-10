# Phase 1 — 도메인 로직 기반 (foundation)

**담당**: FR-MC-1, 2, 5~9, 12, 19; NFR-MC-1, 3, 4

## 목표

이 페이즈가 끝나면:
- 암기 체크 도메인 순수 로직(`memorize.ts`)이 완성되어 Vitest 단위 테스트를 통과한다
- Svelte 상태 싱글턴(`memorize.svelte.ts`)이 존재하며 `pnpm build`(프리렌더 포함)가 성공한다
- UI는 아직 변경하지 않는다. 이후 Phase 2~6이 이 모듈을 import해 사용한다

## 선행 조건

- 기존 `pnpm build`가 성공 상태여야 한다
- `tests/unit/setup-input.test.ts` 같은 기존 단위 테스트가 통과 상태여야 한다

## 대응 SPEC

| FR/NFR | 내용 |
|--------|------|
| FR-MC-1 | 체크 단위는 케이스 × 표기. setup/direct 독립 |
| FR-MC-2 | 기준공식 이름·개수·순서 하드코딩 금지 |
| FR-MC-5 | 체크 상태 토글 → 즉시 localStorage 반영 |
| FR-MC-6 | localStorage 스키마 (`memorize.checked`, `schemaVersion: 1`) |
| FR-MC-7 | 파싱 실패 / schemaVersion 불일치 → 빈 상태 초기화 |
| FR-MC-8 | localStorage만 사용, 서버 런타임 없음 |
| FR-MC-9 | 내보내기/가져오기 없음 |
| FR-MC-12 | 집계는 런타임에 `Dataset.cases` 순회 |
| FR-MC-19 | 퀴즈 풀 필터 함수 (`poolFor`) |
| NFR-MC-1 | localStorage 읽기는 `browser` 가드 안에서만 |
| NFR-MC-3 | PWA 오프라인 — 런타임 네트워크 요청 추가 없음 |
| NFR-MC-4 | Svelte `$state` 반응성으로 자동 업데이트 |

## 수정·생성할 파일

### `src/lib/domain/memorize.ts` (신규)

순수 함수만 담는다. Svelte runes, localStorage, `browser`를 import하지 않는다.

구현할 함수:

| 함수 | 시그니처 | 역할 |
|------|----------|------|
| `parseStored` | `(raw: string \| null) => MemorizeChecked` | localStorage 문자열을 파싱. `null`·잘못된 JSON·`schemaVersion !== 1` → 빈 상태 반환 |
| `serialize` | `(checked: MemorizeChecked) => string` | `MemorizeChecked`를 JSON 문자열로 직렬화. 배열은 정렬(`[...set].sort()`) |
| `anchorProgress` | `(ds: Dataset, setupChecked: Set<CaseCode>) => Map<AnchorName, number>` | 기준별 setup 체크 케이스 수. `Dataset.cases`를 순회하며 `c.setup.anchor`로 분류. 기준 이름 하드코딩 없음 |
| `poolFor` | `(checked: MemorizeChecked, mode: Mode) => CaseCode[]` | `mode`에 따라 `setup` 또는 `direct` Set을 배열로 반환 |

타입 정의도 이 파일에 포함:

```ts
export interface MemorizeStored {
  schemaVersion: number;
  checked: { setup: string[]; direct: string[] };
}

export type MemorizeChecked = { setup: Set<CaseCode>; direct: Set<CaseCode> };
```

`anchorProgress`의 Map 키는 `Dataset.anchors`의 키를 그대로 사용한다. `AnchorName` 상수를 별도로 선언하지 않는다.

### `src/lib/ui/memorize.svelte.ts` (신규)

`settings.svelte.ts:33-43`의 `$effect.root()` + `$effect()` 자동 저장 패턴을 그대로 따른다.

구현할 내용:

- `class Memorize` — 필드:
  - `setupChecked = $state<Set<CaseCode>>(new Set())`
  - `directChecked = $state<Set<CaseCode>>(new Set())`
  - `hideMemorized = $state<boolean>(false)` — `"anchor.hideMemorized"` localStorage 키
  - `memorizedOnly = $state<boolean>(false)` — `"quiz.memorizedOnly"` localStorage 키
- 메서드:
  - `toggle(mode: Mode, code: CaseCode): void` — 해당 Set에서 add/delete 후 직렬화
  - `isChecked(mode: Mode, code: CaseCode): boolean`
  - `checkedFor(mode: Mode): Set<CaseCode>` — `mode === 'setup'`이면 `setupChecked`, `'direct'`이면 `directChecked`
  - `clearAll(): void` — `setupChecked`와 `directChecked`를 빈 Set으로 초기화 후 저장
- 초기 로드: `if (browser)` 가드 안에서 `parseStored(localStorage.getItem('memorize.checked'))` 호출. SSR에서는 빈 Set 유지
- 자동 저장: `$effect()`로 `setupChecked`/`directChecked` 변화를 감지해 `localStorage.setItem('memorize.checked', serialize(...))`
- `hideMemorized` 자동 저장: `$effect()`로 `"anchor.hideMemorized"` 키에 저장
- `memorizedOnly` 자동 저장: `$effect()`로 `"quiz.memorizedOnly"` 키에 저장
- 싱글턴 export: `export const memorize = new Memorize()`

`$effect.root()` 안에서 `$effect()`를 감싸 클래스 인스턴스화 시 자동 시작한다.

### `tests/unit/memorize.test.ts` (신규)

`memorize.ts`의 순수 함수만 테스트한다. `memorize.svelte.ts`(Svelte runes 의존)는 단위 테스트 대상이 아니다.

## 구현 순서

1. `src/lib/domain/memorize.ts` — 타입 정의 → `parseStored` → `serialize` → `anchorProgress` → `poolFor` 순으로 작성
2. `tests/unit/memorize.test.ts` — 각 함수 작성 직후 대응 테스트 추가 (TDD 우선)
3. `pnpm test`로 단위 테스트 전체 통과 확인
4. `src/lib/ui/memorize.svelte.ts` — Svelte 싱글턴 작성
5. `pnpm build`로 프리렌더 통과 확인

## 완료 체크리스트

- [ ] `pnpm test` 실행 시 `tests/unit/memorize.test.ts`의 모든 테스트가 통과한다
- [ ] `parseStored(null)`이 `{ setup: new Set(), direct: new Set() }`를 반환한다 (실제 반환값 확인)
- [ ] `parseStored('{ "schemaVersion": 2, "checked": { "setup": [], "direct": [] } }')`가 빈 상태를 반환한다 (schemaVersion 불일치)
- [ ] `parseStored('invalid json')`이 빈 상태를 반환한다 (파싱 실패)
- [ ] `serialize(parseStored(serialize(checked))) === serialize(checked)` — round-trip 검증 통과
- [ ] `anchorProgress`가 `Dataset.anchors`의 키를 기준으로 집계하며, 기준 이름·개수 상수를 `memorize.ts` 어디에도 쓰지 않는다 (`grep -n "GC\|TC\|BU\|IV\|KS\|KG" src/lib/domain/memorize.ts` 결과 0건)
- [ ] `poolFor(checked, 'setup')`이 `setupChecked`의 배열을 반환하고 `poolFor(checked, 'direct')`이 `directChecked`의 배열을 반환한다
- [ ] `BF`를 `setupChecked`에 추가해도 `FB`의 체크 상태가 바뀌지 않는다 (역케이스 독립)
- [ ] `memorize.svelte.ts`에서 `localStorage` 접근 코드가 전부 `if (browser)` 또는 `$effect()` (하이드레이션 후에만 실행) 안에 있다
- [ ] `pnpm build`가 성공하고 프리렌더 오류가 없다
- [ ] 신규 파일이 런타임 네트워크 요청을 추가하지 않는다 (import가 전부 로컬 경로)

## 이 페이즈에서 조심할 것

| 위험 | 대응 |
|------|------|
| SSR에서 localStorage 접근 → 빌드 실패 | `memorize.svelte.ts`의 `new Memorize()` 실행이 모듈 스코프에서 일어나므로, 생성자 안 localStorage 접근을 `if (browser)` 안으로 제한한다. `settings.svelte.ts:15` 패턴 참조 |
| `anchorProgress`에서 기준 이름 하드코딩 | `c.setup.anchor`(또는 데이터 스키마의 기준 필드)로 분류하고, `Dataset.anchors`를 참조한다. 어떤 상수도 선언하지 않는다 |
| Svelte runes를 순수 함수 파일에서 import | `memorize.ts`는 SvelteKit/Svelte를 import하지 않는다. runes는 `memorize.svelte.ts`에만 |
