# 0.9.0 하단 탭 제거 · OP 코너 · 시험 — GLOBAL

SPEC: `SPEC.md`. 이 문서는 구현 전체에 걸친 아키텍처 결정과 단계 분할이다.

---

## 아키텍처 결정 (AD)

### AD-1 `[Y]` 는 자판의 단일 토큰이다

버튼 `data-move="[Y]"`, moves 배열에 `"[Y]"` 그대로 저장한다. 채점 전
`expandY(alg, yPerm)` 이 `[Y]` 를 15수 Y-perm 문자열로 치환한 뒤 `faceletsOf`
54칸 비교를 한다. 자판 스택 로직을 건드리지 않기 위해 펼치기는 채점 시점으로 미룬다.

### AD-2 `[Y]` 는 `Alg.svelte` 에서 `anchor` 역할로 렌더한다

`format.ts` 의 `AlgPart.role`. `displayPartsOf(item, yPerm)` →
`[{setup, plain}, {'[Y]', anchor}, {setup', plain}]`.  
`role: 'plain'` 이면 `splitMoves`(`src/lib/cube/notation.ts:61`) 가 낱글자로 쪼갠다.
`anchor` 는 통째로 렌더한다 — 3-style anchor 레이블과 같은 패턴.

### AD-3 역 setup 은 `invertAlg` 으로 계산한다

`src/lib/cube/notation.ts:22` 의 `invertAlg`. 데이터 파일에는 setup 만 적는다
(SPEC FR-OP-D-2). setup' 은 수학적 역원으로 코드가 계산한다.

### AD-4 OP 데이터 스키마는 M2 와 평행하다. Y 행은 별도 행이다

```json
{
  "meta": {
    "method": "OP",
    "pieceType": "corner",
    "buffer": "UBL",
    "bufferStickers": ["A","E","R"],
    "swapPiece": "DFR",
    "swapSticker": "P",
    "yPerm": "R U' R' U' R U R' F' R U R' U' R' F R",
    "source": "사용자 PDF op_corners.pdf (2026-10-29, 비공개)"
  },
  "rows": [
    { "id": "y", "letter": "Y", "setup": "", "isYRow": true },
    { "id": "b", "letter": "B", "setup": "R D'" },
    ...
  ]
}
```

Y 행(`isYRow: true`): 공식은 `[Y]` (= yPerm 15수). P 행: `isYRow` 없음, 공식은 `[Y]`.
`yPerm` 은 meta 에만 있다 — 코드가 15수를 하드코딩하지 않는다. M2 의 `parity` 필드
(`src/lib/data/edge-DF-m2.json:29`) 와 같은 패턴.

### AD-5 `gradeOp` 은 `gradeM2` 와 평행한다

`gradeOp(entered, item, allItems, yPerm): OpVerdict` — `expandY` → `faceletsOf` →
정답 비교 → correct; 항등 → identity; 다른 행 상태 → other; 그 외 → wrong; 알 수 없는
무브 → invalid-move. 두 번째 메서드 집합이라 공용 유틸로 올리지 않는다 (YAGNI).

### AD-6 `MoveKeypad` 에 `disabledTokens` prop 을 추가한다

`disabledTokens?: readonly string[]` (기본값 `[]`).
버튼 disabled = `moves.length >= MAX_MOVES || disabledTokens.includes(token)`.
현재는 전체 full 에서만 disabled (`src/lib/ui/MoveKeypad.svelte:35`).
OP 퀴즈는 Y 행 문제에서 `['[Y]']` 를 넘긴다.

### AD-7 저장 키는 세 네임스페이스로 나눈다

- `op.checked`, `op.quiz.memorizedOnly` — OP 암기 체크 / 설정
- `exam.size`, `exam.session`, `exam.records` — 시험 전용
- 기존 `memorize.*`, `m2.*`, `daily.*`, `trace.*` 는 건드리지 않는다.

`op.svelte.ts` 에 `parseOpChecked` / `serializeOpChecked`, schemaVersion 1.

### AD-8 About "암기 전체 해제" 가 `op.clearAll()` 도 호출한다

`About.svelte:30-32`. `memorize.clearAll()` · `m2.clearAll()` 과 함께 호출한다
(SPEC FR-OP-S-2).

### AD-9 서랍 그룹과 네이게이션

`SIBLING_GROUPS['/3x3/bld/op/corner'] = ['lookup','quiz']` (`src/lib/ui/nav.ts:53`).
`MENU_3BLD` 에 `{ group: '/3x3/bld/op/corner', label: 'OP 코너' }` — M2 엣지 뒤,
트레이싱 앞. `SIBLING_GROUPS` 는 탭 제거 후에도 남긴다 — 서랍 `menuFor` 가 쓴다.

### AD-10 OP 조회 원리 설명은 `<details>` (기본 접힘)

교환은 `[Y]` 하나 (UBL↔DFR); setup 은 타깃을 P 자리(DFR)로 가져온다;
D·F·R 만 쓰는 이유(U·B·L 은 버퍼 건드림); `[Y]` 의 UB↔UL 엣지 부작용과
M2 패리티와의 관계 (엣지 UB↔UL 이 닫힌다).

### AD-11 탭바 제거

`+layout.svelte` 에서 탭바 마크업과 스타일(`min-height: 52px`, 테두리 1px = 53px
sticky 영역) 전체를 제거한다. `.shell { min-height: 100dvh }` 는 그대로 둔다.  
두 quiz 화면의 `.quiz { min-height: calc(100dvh - 52px - 40px - 1rem) }` 도 수정한다.
calc 상수는 탭바 제거 후에도 오버플로를 일으켰다 (390×844 에서 제출 버튼이 33px 아래로
튀어나옴). 상수 조정 대신 **flex fill** 방식을 채택했다:

- `src/routes/+layout.svelte`: `main { display:flex; flex-direction:column; flex:1 }`
- `src/routes/3x3/bld/m2/edge/quiz/+page.svelte`: `.quiz { flex:1 }` (min-height calc 제거)
- `src/routes/3x3/bld/3style/corner/quiz/+page.svelte`: `.quiz { flex:1 }` (min-height calc 제거)

제거 후 실측 (2026-10-29, 제출 아래끝): 375×667 — 코너 671px · M2 651px;
390×844 — 둘 다 828px (≤ 844 확인). 상세는 PHASE_1_TEST.md.

### AD-12 세션 추출 — 타입과 결과 그리드만

- 새 `src/lib/domain/session.ts`: `QuizAnswer`(= 기존 `DailyAnswer`), `isAnswered`,
  `emptyAnswer`, `parseAnswer`. `daily.ts` 가 `type DailyAnswer = QuizAnswer` 를
  재export 해서 기존 importer 가 깨지지 않는다.
- 새 `src/lib/ui/QuizResults.svelte`: 매일 결과 `<ol>` 블록
  (`daily/+page.svelte:195-234` 영역) 추출. props: `results`, `mode`, `notation`.
  `data-result-case`, `data-summary`, `data-verdict`, `data-kind`, `data-result` 속성 유지.
- **공유하지 않는 것**: 세션 스토어(`daily.svelte.ts` / `exam.svelte.ts` 각자 키 소유),
  활성-단계 자판+AnchorPad 블록.

### AD-13 `ExamRecord` 는 채점 시점의 `correct` 스냅샷을 저장한다

`ExamRecord { at: number; date: string; mode; cases: CaseCode[]; answers: QuizAnswer[];
correct: number }`. 기록 목록 표시는 저장된 `correct` 를 그대로 쓴다 — 데이터가 바뀌어도
과거 기록이 바뀌지 않으며, idle 목록에서 50건을 재채점하는 비용도 없다.
`answers` 는 남겨 둔다 — 상세 보기를 나중에 추가할 수 있다 (SPEC FR-EX-REC-2).

### AD-14 시험 채점도 `push.noteQuiz()` 를 호출한다

`src/lib/push/meta.ts:21` `facts.lastQuiz`. 시험도 코너 퀴즈 채점이다 (SPEC D-10).

### AD-15 시험 문항 크기 선택기

`EXAM_SIZES = [5,10,15,20,25,30,35,40,45,50]`, `EXAM_MIN = 5`, `EXAM_MAX = 50`,
`EXAM_DEFAULT = 10`, `src/lib/domain/exam.ts`. 선택기는
`/settings/notify` `<select>` 패턴(`src/routes/settings/notify/+page.svelte:80-89`) 재사용.
입력 방식 SegToggle 은 매일 퀴즈와 동일하게 `settings.quizInput` 을 읽는다 (공유 읽기).

---

## 단계 분할

순차 6단계.

| Phase | 키워드 | 내용 | 상태 | 선행 |
|-------|--------|------|------|------|
| 1 | tabs | 탭바 제거, 문서 정리, 관련 테스트 갱신 | Complete | — |
| 2 | op-core | OP 데이터, 도메인, 스토어, 단위 테스트 | Pending | 1 |
| 3 | op-ui | MoveKeypad 확장, 네비게이션, OP 조회·퀴즈 화면 | Pending | 2 |
| 4 | session | session.ts 추출, QuizResults.svelte, daily 리팩터 | Pending | 3 |
| 5 | exam | exam.ts, exam.svelte.ts, 시험 화면 | Pending | 4 |
| 6 | docs | README, SVELTE.md, CONTINUE, BACKLOG 갱신 | Pending | 5 |

## 검사 명령

```bash
pnpm check && pnpm test && pnpm test:e2e
```

## 하지 않는 것

SPEC 범위 밖 그대로. 버전 올리기·태그·`release.sh` 는 사용자 승인 사항.
CHANGELOG 는 DOCS_UPDATE 단계에서 처리한다 — Phase 6 에서 손대지 않는다.
