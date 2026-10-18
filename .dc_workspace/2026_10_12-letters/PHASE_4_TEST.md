# Phase 4 TEST — `tests/e2e/letters-quiz.spec.ts`

| # | 검사 | 기대 |
|---|---|---|
| 1 | 진입 시 `data-stage=active`, 채점 버튼 비활성 | |
| 2 | 코너: 글자 3개 입력 전 비활성, 3개 후 활성 | |
| 3 | 정답 입력(문제 큐비를 `data-cubie` 로 읽어 답 계산) → `data-verdict data-kind=correct data-result=ok` | |
| 4 | 같은 문자 셋을 역순으로 입력해도 correct | |
| 5 | 오답 → `wrong`/`bad`, 결과 줄에 정답 글자 | |
| 6 | 판정 뒤 "다음 문제"만 보인다. 누르면 `active`, 입력 비움 | |
| 7 | 회색 설정: `data-colored` = 6 + 큐비 문자 수. 색 설정: 54 | |
| 8 | 두 설정 모두 `data-marked` = 큐비 문자 수, `data-labels` = 0 | |
| 9 | 안내 줄이 `active` 에서 보인다 | |
| 10 | 엣지 선택 시 패드 글자가 소문자 `a`–`x` | |
| 11 | 원위치 버튼이 없다 | |

문제 큐비를 E2E 가 알 수 있게 `<section data-cubie=…>` 를 둔다. 화면에 보이는 정보가 아니고 DOM 속성일 뿐이라 훈련을 해치지 않는다 (트레이싱의 시험 훅과 같은 위상).
