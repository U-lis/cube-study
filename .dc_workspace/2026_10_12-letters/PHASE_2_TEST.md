# Phase 2 TEST

## 단위 (`tests/unit/cube3d.test.ts` 에 추가)

| # | 검사 | 기대 |
|---|---|---|
| 1 | `labelUp` 이 U 면 전 칸에서 `[0,0,-1]`, D 면 `[0,0,1]`, R·F·L·B 면 `[0,1,0]` | 54칸 전수 |
| 2 | `labelUp(i)` 는 그 칸의 면 법선과 수직 | 54칸 |
| 3 | `assertLabels` | 53칸·숫자·두 글자 거부, 54칸 null/1글자 통과 |

## 번들

| # | 검사 | 기대 |
|---|---|---|
| 4 | `tests/unit/bundle-three.test.ts` | 그대로 통과 (three 지연 로드 유지) |

## 트레이싱 회귀

| # | 검사 | 기대 |
|---|---|---|
| 5 | 기존 `trace-*.spec.ts` | 그대로 통과 |

화면 동작(글자 보임·원위치)은 Phase 3 E2E 가 본다.
