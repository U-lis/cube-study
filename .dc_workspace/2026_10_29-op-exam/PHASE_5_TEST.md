# Phase 5 TEST — 시험

커버리지 70%는 참고 수치다. 아래 동작을 검증한다.

## 검증할 동작

| 동작 | 레이어 | 결과 |
|------|--------|------|
| `exam.test.ts`: `parseExamSize` 유효 범위 5~50 | unit | [ ] |
| `exam.test.ts`: `parseExamSize` 범위 밖 / null → EXAM_DEFAULT | unit | [ ] |
| `exam.test.ts`: `parseExamSession` null / corrupt → null | unit | [ ] |
| `exam.test.ts`: `parseRecords` null / corrupt → [] | unit | [ ] |
| `exam.test.ts`: `pushRecord` 50건 초과 시 가장 오래된 건 버림 | unit | [ ] |
| `exam.test.ts`: `serializeRecords` → `parseRecords` 라운드트립 | unit | [ ] |
| `nav.test.ts`: 코너 그룹에 `exam` 포함 | unit | [ ] |
| `conventions.spec.ts` FEATURES: `/3x3/bld/3style/corner/exam` → h1 `시험` | e2e | [ ] |
| `drawer.spec.ts`: 서랍에 `시험` 항목 있다 | e2e | [ ] |
| `exam.spec.ts`: 문항 수 선택기 5~50 범위 | e2e | [ ] |
| `exam.spec.ts`: 시작 → active, 설정 줄 disabled + 접힘 | e2e | [ ] |
| `exam.spec.ts`: 나갔다 돌아오면 첫 unanswered 문항부터 이어 시작 | e2e | [ ] |
| `exam.spec.ts`: 전부 풀고 채점 → result `N문제 중 M개` (백분율 없음) | e2e | [ ] |
| `exam.spec.ts`: 기록이 result 후 idle 목록에 나타난다 | e2e | [ ] |

## 이 Phase 에서 실제로 해당하는 경계 케이스

- `correct` 는 저장된 스냅샷이다. 목록 표시 시 재채점하지 않는다 (AD-13).
- 50건 초과 시 조용히 버린다 — 사용자에게 알리지 않는다
  (`src/lib/domain/tracing.ts:216` 과 같은 패턴).
- E2E 테스트 제목에 템플릿 리터럴을 쓰지 않는다.
- 뷰포트 신호(`boundingBox`, `44` 등)를 쓰는 테스트에만 `@viewport` 를 붙인다.
