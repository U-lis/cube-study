# Phase 3 — 테스트 계획

## 테스트 커버리지 목표

퀴즈의 규약이 트레이싱과 같은 값을 쓰게 됐는가. 진행 버튼이 본문 최하단인가.

**규약을 검사로 못 박는 것은 페이즈 4 다.** 여기서는 갱신된 옛 E2E 가 통과하는지와 사람 확인이 대부분이다.

## 실행 명령

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

## 갱신된 E2E

### T3-1. `tests/e2e/pwa.spec.ts:131` — 자동

- [ ] `[data-action="submit"]` 셀렉터를 `[data-grade]` 로 갱신
- [ ] 갱신 후 통과. 오프라인에서 퀴즈 진행이 되는지 보는 검사

### T3-2. 퀴즈 관련 E2E — 자동

- [ ] `tests/e2e/quiz.spec.ts` · `tests/e2e/quiz-feedback.spec.ts` · `tests/e2e/memorize-quiz.spec.ts` 안의 `data-action="submit"` · `data-action="next"` 참조를 `[data-grade]` · `[data-next]` 로 갱신
- [ ] 판정 관련 셀렉터 (`data-verdict='correct'` 등) 가 있으면 값 자리가 `data-kind` 로 옮겨졌는지 확인해 셀렉터 조정. 값이 아니라 존재만 확인하는 곳은 그대로

### T3-3. 트레이싱 진행 버튼 자리 관련 E2E — 자동

- [ ] `tests/e2e/trace-session.spec.ts` · `tests/e2e/trace-input.spec.ts` · `tests/e2e/trace-noleak.spec.ts` 에서 진행 버튼 위치를 조건으로 삼는 검사가 있는지 확인
  - `boundingBox` 로 진행 버튼 y 좌표를 재는 검사가 있으면, 자리 이동으로 값이 바뀐다 — 기대값 갱신
  - 옛 자리를 전제로 하는 순서 검사(예: 시작 버튼이 입력칸보다 위)가 있으면 새 순서로 갱신
- [ ] 셀렉터 자체(`[data-start]` · `[data-grade]` · `[data-memorized]` · `[data-next]`)는 트레이싱이 이미 규약을 쓰고 있어 이름 갱신은 없음

## 사람이 보는 것

### T3-4. 진행 버튼 이름 — 사람

브라우저 개발자 도구로 확인:

- [ ] 퀴즈에서 제출 버튼: `data-grade` 속성이 있고 `data-action="submit"` 이 **없다**
- [ ] 퀴즈에서 "다음 문제" 버튼: `data-next` 속성이 있고 `data-action="next"` 가 **없다**
- [ ] 자판 편집 버튼(무브 키패드의 undo · clear · back 등): `data-action` 이 그대로 있다 — 다른 규약이다

### T3-5. 진행 버튼 자리 — 사람

- [ ] `/3x3/bld/trace` — 트레이싱 시작 전(`idle`): 시작 버튼이 세션 설정 바로 아래에 서고 그 아래가 비어 있다 (SPEC "결정된 것 8번")
- [ ] 트레이싱 진행 중(`tracing` · `input`): 채점 버튼(`follow` 는 트레이싱 중에도 열림, `memorize` 는 "다 외웠다" 후)이 자판 아래에 선다
- [ ] 트레이싱 결과(`result`): "다음 문제" 버튼이 결과 상세 아래에 선다
- [ ] 각 단계에서 실제로 보이는 진행 버튼은 하나뿐이다 (지금 CSS 규칙 유지 확인)

### T3-6. `data-stage` — 사람

브라우저 개발자 도구로 확인:

- [ ] 퀴즈에서 `<section class="quiz" data-stage="active">` — 문제가 뜨고 판정이 없는 상태
- [ ] 답을 제출한 뒤 `data-stage="result"`
- [ ] "다음 문제" 를 누른 뒤 다시 `data-stage="active"`
- [ ] `pool` 이 비어 안내가 뜬 상태에서 `data-stage=""` (혹은 속성 부재)

### T3-7. 판정 줄 — 사람

- [ ] 퀴즈의 정답: `.verdict` 요소가 `data-result="ok"` · `data-kind="correct"`. 초록색
- [ ] 퀴즈의 오답: `data-result="bad"` · `data-kind="wrong"` (혹은 다른 kind). 빨강
- [ ] 트레이싱의 판정: 같은 규약. 값은 지금 그대로

### T3-8. 잠금 — 사람

**퀴즈는 잠기지 않는다** (사용자 지시). 확인:

- [ ] 퀴즈에서 답을 제출하지 않은 상태로 입력 방식(direct↔setup)을 바꾸면 문제는 그대로 있고 입력만 비워진다
- [ ] "암기한 것만 출제" 토글도 문제 도중에 바꿀 수 있다
- [ ] 트레이싱은 판이 도는 동안 훈련 대상 · 모드 토글이 잠긴다 (`disabled` 확인) — 지금 동작 유지

### T3-9. 접기와 하이드레이션 — 사람

- [ ] 퀴즈 로드 직후에 판정 줄·정답 패널이 뜨지 않는다 (SSR 도 CSR 도 없음). 첫 렌더에서 부재
- [ ] 트레이싱 로드 직후에 상태줄 "준비 중" 이 한 번 뜨고 사라진다 (자리 예약. SPEC FR-NAV-18 예외)
- [ ] 트레이싱 시작 뒤 설정이 사라지되 DOM 에는 남아 있다 (개발자 도구로 확인)

## 통과 기준

- 자동 검사 (`pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build`) 모두 통과
- T3-4 ~ T3-9 사람 확인 항목이 모두 예
