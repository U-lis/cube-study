# Phase 1 TEST — `tests/unit/letters.test.ts`

| # | 검사 | 기대 |
|---|---|---|
| 1 | `gradeLetters('edge','UB',['q','a'])` · `['a','q']` | 둘 다 correct |
| 2 | `gradeLetters('corner','UBL',['R','A','E'])` | correct (순서 무관) |
| 3 | `['a','a']` (엣지 UB) | wrong, answer `['a','q']` |
| 4 | 개수 부족 `['a']` · 초과 `['a','q','b']` | wrong |
| 5 | 대소문자 섞인 입력 `['A','Q']` (엣지) | correct (정규화) |
| 6 | 전 큐비: `answerOf` 를 섞어 넣으면 correct — 코너 8 · 엣지 12 전수 | 20/20 |
| 7 | `cubiesOf` 개수 | 코너 8, 엣지 12 |
| 8 | `labelsLookup('corner')` | 글자 24칸, 각 칸 글자가 `CORNER_AT[i]`. 엣지도 같음 |
| 9 | `paintLookup(kind,'gray',colors)` | 센터 6 + 고른 종류 칸만 실제 색, 나머지 GRAY. `'color'` 면 54칸 전부 실제 색 |
| 10 | `paintQuiz` 풀린 상태, 회색 | 실제 색 칸 = 센터 6 + 큐비 칸(코너 3·엣지 2). 그 칸들이 `CORNER_FACELETS[cubie]` 와 같다 |
| 11 | `paintQuiz` 섞인 상태 (고정 facelet 문자열 하나) | 칠한 칸들의 색 집합 = 문제 큐비의 원래 색 집합. 칸 수 = 큐비 문자 수 |
| 12 | `cubieAt` 이 풀린 상태에서 `CORNER_FACELETS[cubie]` 와 같은 집합 | 20 큐비 전수 |
| 13 | `marksQuiz` | mark 가 `cubieAt` 칸에만, 나머지 null |
| 14 | 설정 판정 함수 | 유효값 true, `null`·`''`·모르는 값 false |

섞인 상태 고정값은 `new Cube().move("R U F' L2 D B'").asString()` 처럼 테스트 안에서 만든다
(무브 효과는 cubejs 가 안다).
