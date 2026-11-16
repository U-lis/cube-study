# Phase 5 — 시험 (`exam`)

GLOBAL AD-13~AD-15. SPEC FR-EX-S-1~7, FR-EX-REC-1~4.

## 전제

- Phase 4 완료 (`session.ts`, `QuizResults.svelte` 커밋됨, `pnpm check && pnpm test && pnpm test:e2e` 초록).

## 만들 것

### 1. `src/lib/domain/exam.ts` (신규)

```ts
export const EXAM_MIN = 5;
export const EXAM_MAX = 50;
export const EXAM_DEFAULT = 10;
export const EXAM_SIZES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
export const EXAM_RECORD_LIMIT = 50;

export function parseExamSize(raw: string | null): number;
// 파싱 실패 시 EXAM_DEFAULT 반환.

export interface ExamSession {
  v: 1;
  mode: InputMode;
  cases: CaseCode[];
  answers: QuizAnswer[];
  graded: boolean;
}

export function newExamSession(mode: InputMode, size: number): ExamSession;
export function parseExamSession(raw: string | null): ExamSession | null;

export interface ExamRecord {
  at: number;        // Unix ms
  date: string;      // 'YYYY-MM-DD'
  mode: InputMode;
  cases: CaseCode[];
  answers: QuizAnswer[];
  correct: number;   // 채점 시점 정답 수 스냅샷 (AD-13)
}

export interface ExamRecordsStored {
  schemaVersion: 1;
  records: ExamRecord[];
}

export function parseRecords(raw: string | null): ExamRecord[];
// 파싱 실패·corrupt → [].
export function serializeRecords(records: ExamRecord[]): string;
export function pushRecord(records: ExamRecord[], rec: ExamRecord): ExamRecord[];
// 최신 건을 앞에 추가. 50건 초과 시 가장 오래된 것을 버린다.
```

`ExamSession` 은 날짜 필드 없음 — 매일 퀴즈의 날짜 묶임은 여기에 없다 (SPEC FR-EX-R-3).

### 2. `src/lib/ui/exam.svelte.ts` (신규)

저장 키: `exam.size`, `exam.session`, `exam.records`. `schemaVersion: 1`.

- `size`: `$state`, 기본값 `EXAM_DEFAULT`. localStorage `exam.size`.
- `session`: `$state<ExamSession | null>`, 기본값 `null`. localStorage `exam.session`.
- `records`: `$state<ExamRecord[]>`, 기본값 `[]`. localStorage `exam.records`.

공개 메서드:
- `setSize(n: number)` : idle 상태에서만 변경.
- `start(mode: InputMode)` : `newExamSession(mode, size)` 로 session 생성.
  이미 unanswered 세션이 있으면 그대로 이어서 시작한다.
- `answer(idx: number, a: QuizAnswer)` : session.answers[idx] 갱신.
- `grade(allItems, yPerm?: string)` : 각 답을 채점해 `correct` 수 계산 → `session.graded = true`,
  `pushRecord` 로 records 에 추가 (date = `localDate(now, tz)`, correct 스냅샷 포함),
  `push.noteQuiz()` 호출.
- `reset()` : `session = null` (idle 로 복귀).

### 3. `src/routes/3x3/bld/3style/corner/exam/+page.svelte` (신규)

- `PageTitle` back → 홈, `<h1>` 텍스트: `시험`.
- `data-stage`: `idle` / `active` / `result`.

**idle 단계 — 설정 줄:**
- 입력 방식 `SegToggle` (settings.quizInput 공유 읽기, 매일 퀴즈와 동일 방식).
- 문항 수 `<select>` — `EXAM_SIZES` 옵션, 기본값 `EXAM_DEFAULT`.
  `src/routes/settings/notify/+page.svelte:80-89` 패턴 재사용.
- `idle` 이 아닐 때: 설정 줄을 CSS 로 접고(`disabled`) 잠근다. DOM 에서 제거하지 않는다.

**idle 단계 — 기록 목록:**
설정 줄 아래. 최신 건이 위. 형식: `YYYY-MM-DD · 방식 · N문제 중 M개`.
`correct` 는 저장된 스냅샷을 그대로 쓴다 (재채점하지 않는다, AD-13).
기록이 없으면 `기록이 없습니다`.

**active 단계:**
매일 퀴즈 run 블록과 같은 구조 (문제, 자판/AnchorPad, 이전/다음 버튼).
각 문항은 판정 없이 표시한다 — 전부 풀고 나서 한 번에 채점한다 (SPEC FR-EX-S-5).

**result 단계:**
`QuizResults` 컴포넌트로 결과 목록 + `N문제 중 M개 정답` 요약 표시.
`다시 시작` 버튼 → `exam.reset()` → idle.

**이어 풀기:**
active 세션이 있으면 첫 unanswered 문항부터 열어 이어 시작한다 (SPEC FR-EX-S-6).

**채점 시:**
`exam.grade()` 호출. 내부에서 `push.noteQuiz()` 가 불린다 (AD-14).

### 4. `src/lib/ui/nav.ts` 갱신

- `SIBLING_GROUPS['/3x3/bld/3style/corner']` 에 `'exam'` 추가.
- `FEATURE_LABELS` 에 `exam: '시험'` 추가.

### 5. 홈 `src/routes/+page.svelte` 갱신

시험 항목을 매일 퀴즈 뒤에 삽입한다.

- `{ path: '/3x3/bld/3style/corner/exam', name: '시험', desc: '문항 수를 골라 코너를 한 번에 채점합니다' }`

## 순서

1. `exam.ts` 작성 → `pnpm check`.
2. `exam.svelte.ts` 작성 → `pnpm check`.
3. 시험 페이지 작성 → `pnpm check`.
4. `nav.ts` · 홈 갱신 → `pnpm check`.
5. 테스트 작성 → `pnpm test && pnpm test:e2e`.
6. `pnpm check && pnpm test && pnpm test:e2e` 전체 통과.

## 완료 체크리스트

- [x] `exam.ts` 에 `EXAM_SIZES`, `parseExamSize`, `ExamSession`, `ExamRecord`, `parseRecords`, `serializeRecords`, `pushRecord` export 있음 — verified in src/lib/domain/exam.ts
- [x] `exam.svelte.ts` 에 `size`, `session`, `records`, `setSize`, `start`, `answer`, `grade`, `reset` 있음 — verified in src/lib/ui/exam.svelte.ts
- [x] 시험 페이지 `<h1>시험</h1>`, `data-stage` idle/active/result 전환 — src/routes/3x3/bld/3style/corner/exam/+page.svelte:188,193
- [x] idle: 설정 줄, 기록 목록 (correct 스냅샷 표시, 재채점 없음) — +page.svelte:197-237, CSS collapse at line 349
- [x] active: 판정 없이 진행, 마지막 문항 후 채점 버튼 — +page.svelte:240-272, controls at 283-319
- [x] result: `QuizResults` + `다시 시작` 버튼 — +page.svelte:275-281, 314-318
- [x] 이어 풀기: 재방문 시 첫 unanswered 문항부터 — +page.svelte:70-74
- [x] `nav.ts` corner group 에 `exam` 추가 — src/lib/ui/nav.ts:54
- [x] 홈 FEATURES 에 시험 추가 — src/routes/+page.svelte:37-38
- [x] `pnpm check && pnpm test && pnpm test:e2e` 초록 — 837 unit, 469 e2e passed

## 테스트 파일

### `tests/unit/exam.test.ts` (신규)

| # | 검사 | 기대 |
|---|------|------|
| E-1 | `parseExamSize` 유효 범위 | EXAM_MIN~EXAM_MAX |
| E-2 | `parseExamSize` 범위 밖 / null | EXAM_DEFAULT |
| E-3 | `parseExamSession` 유효 JSON | ExamSession |
| E-4 | `parseExamSession` null / corrupt | null |
| E-5 | `parseRecords` 유효 JSON | ExamRecord[] |
| E-6 | `parseRecords` null / corrupt | [] |
| E-7 | `pushRecord` 50건 초과 시 가장 오래된 것 버림 | length = 50 |
| E-8 | `serializeRecords` → `parseRecords` 라운드트립 | 복원 가능 |

### `tests/unit/nav.test.ts` 갱신

코너 그룹에 `exam` 이 포함됐는지 검사 추가.

### `tests/e2e/exam.spec.ts` (신규)

- 문항 수 선택기가 5~50 범위다.
- 시작 → active 전환, 설정 줄 disabled + 접힘.
- 나갔다 돌아오면 첫 unanswered 문항부터 이어 시작한다.
- 전부 풀고 채점 → result `N문제 중 M개` (백분율 없음).
- 기록이 result 후 idle 목록에 나타난다.

### `tests/e2e/drawer.spec.ts` 갱신

서랍에 `시험` 항목이 있다.

### `tests/e2e/conventions.spec.ts` 갱신

FEATURES 에 `/3x3/bld/3style/corner/exam` 경로 포함, h1 `시험`.

## 주의사항

- `correct` 는 채점 시점 스냅샷이다. 목록 표시 시 재채점하지 않는다 (AD-13).
- `settings.quizInput` 은 시험도 매일 퀴즈와 함께 공유 읽기만 한다.
  시험 전용 값을 저장하지 않는다.
- 접기는 CSS 로 한다 (`{#if}` 로 DOM 에서 제거하지 않는다).
- E2E 테스트 제목에 템플릿 리터럴을 쓰지 않는다.
- `@viewport` 는 뷰포트 신호를 쓰는 테스트에만 붙인다.
