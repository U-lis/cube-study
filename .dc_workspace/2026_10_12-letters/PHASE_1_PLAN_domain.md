# Phase 1 — 도메인 순수부 (`src/lib/domain/letters.ts`)

GLOBAL AD-LT-1~6, 11. SPEC FR-LT-7, 7a, 12, 12a, 13, 15, 19, 23.

## 만들 것

```ts
export type LetterKind = PieceKind;                 // 'corner' | 'edge'
export type Others = 'gray' | 'color';
export type QuizStage = 'solved' | 'scrambled';
export const isLetterKind, isOthers, isQuizStage;   // 설정 판정 (AD-LT-11)

export function cubiesOf(kind): Cubie[];            // 출제 pool (AD-LT-4)
export function answerOf(kind, cubie): Sticker[];   // rotationOf(kind)[cubie]
export function normalize(kind, ch): Sticker;       // 코너 대문자·엣지 소문자 (AD-LT-2)

export type LetterVerdict = { kind: 'correct' } | { kind: 'wrong'; answer: Sticker[] };
export function gradeLetters(kind, cubie, entered): LetterVerdict;   // 정렬 비교 (AD-LT-3)

export function isCenter(i): boolean;               // i % 9 === 4
export function cubieAt(kind, facelets, cubie): number[];
//  문제 큐비의 스티커가 지금 앉은 facelet 인덱스들. stateFromFacelets 로 찾는다 (AD-LT-5)

export function paintLookup(kind, others, colors): string[];          // AD-LT-6
export function paintQuiz(kind, cubie, others, facelets, colors): string[];
export function labelsLookup(kind): (Sticker | null)[];              // 54칸, 고른 종류 칸에만 글자
export function marksQuiz(kind, cubie, facelets, mark): (Mark | null)[];  // 문제 큐비 칸에 mark
```

- `colors` 는 화면이 `faceletColors(colorScheme, facelets)` 로 만든 54칸 실제 색이다. 도메인은
  `GRAY` 만 안다 (`$lib/ui/facelets.ts` 에서 import — `GRAY` 는 상수라 순수성을 해치지 않는다.
  ui → domain 역방향 import 가 꺼림칙하면 GRAY 를 인자로 받는다. **결정: 인자로 받는다** —
  domain 이 ui 를 import 하지 않는 지금의 방향을 지킨다)
- `Mark` 타입은 `$lib/cube/cube3d-map.ts` 에서 type-only import

## 순서

1. 테스트 먼저 (`tests/unit/letters.test.ts`, PHASE_1_TEST.md)
2. 구현
3. `pnpm check && pnpm vitest run tests/unit/letters.test.ts`
