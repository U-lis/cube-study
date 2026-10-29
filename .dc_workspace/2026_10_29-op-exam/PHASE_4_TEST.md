# Phase 4 TEST — 세션 추출

커버리지 70%는 참고 수치다. 아래 동작을 검증한다.

## 검증할 동작

| 동작 | 레이어 | 결과 |
|------|--------|------|
| `tests/e2e/daily.spec.ts` 전체 통과 (리팩터링 전후 동일) | e2e | [ ] |
| `pnpm check` 통과 (타입 오류 없음) | build | [ ] |
| `pnpm test` 통과 (단위 테스트 회귀 없음) | unit | [ ] |
| `pnpm test:e2e` 통과 (E2E 회귀 없음) | e2e | [ ] |

## 선택적 추가 테스트

| 동작 | 레이어 | 결과 |
|------|--------|------|
| `session.test.ts` (선택): `isAnswered`, `emptyAnswer`, `parseAnswer` 라운드트립 | unit | [ ] |

## 문서 내용 검토 항목 (자동화 아님)

- [ ] `daily.ts` 에서 `DailyAnswer` 가 `QuizAnswer` 로 재export 됨
- [ ] `QuizResults.svelte` 에서 settings 싱글톤을 직접 import 하지 않음
- [ ] `daily/+page.svelte` 결과 `<ol>` 블록이 `QuizResults` 로 대체됨

## 이 Phase 에서 실제로 해당하는 경계 케이스

- `DailyAnswer` 기존 importer: `import type { DailyAnswer } from '$lib/domain/daily'` 가 그대로 컴파일된다.
- 날짜 묶임 로직은 공유 모듈에 없다. 매일 퀴즈 동작이 바뀌지 않는다.
- `daily.session` localStorage 직렬화 포맷이 변경되지 않는다.

## 롤백 기준

`tests/e2e/daily.spec.ts` 가 단 하나라도 실패하면 이 Phase 를 롤백하고 추출 범위를 줄인다.
매일 퀴즈는 이미 운영 중인 화면이므로 회귀가 허용되지 않는다.
