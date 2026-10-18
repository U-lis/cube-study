# Phase 3 TEST

## 단위

| # | 검사 | 기대 |
|---|---|---|
| 1 | `tabsFor('/3x3/bld/letters/lookup', …)` | 탭 둘, 라벨 `외우기`·`퀴즈`, lookup 활성 |
| 2 | `tabsFor('/3x3/bld/3style/corner/lookup', …)` | 라벨 `조회` 그대로 |
| 3 | `COLOR_NAME_KO` 가 `PAINT` 의 키 6개를 다 덮는다 | 6/6 |

## E2E (`tests/e2e/letters-lookup.spec.ts`)

| # | 검사 | 기대 |
|---|---|---|
| 4 | h1 "외우기", 되돌아가기 홈, 탭 외우기·퀴즈 | |
| 5 | 기준 문구 "위 흰색 · 앞 초록" | |
| 6 | 코너 선택 → 캔버스 `data-labels=24`. 엣지 → 24 | |
| 7 | 다른 조각 회색 → `data-colored` = 6+24. 색 → 54 | |
| 8 | 원위치 버튼 높이 ≥ 44px, 누르면 오류 없음 | |
| 9 | 설정이 새로고침 뒤에도 남는다 | |
