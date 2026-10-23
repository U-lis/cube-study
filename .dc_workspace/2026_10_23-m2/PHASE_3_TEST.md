# Phase 3 TEST

문서 단계에서 새로 추가하는 테스트는 없다.

## 검증할 동작

| 동작 | 레이어 |
|------|--------|
| `pnpm check` 통과 (타입 오류 없음) | build |
| `pnpm test` 통과 (단위 테스트 회귀 없음) | unit |
| `pnpm test:e2e` 통과 (E2E 회귀 없음) | e2e |

## 문서 내용 검토 항목 (자동화 아님)

- `SVELTE.md` 라우트 표에 `/3x3/bld/m2/edge/{lookup,quiz}` 가 있다.
- `README.md` 에 M2 데이터 출처(`m2_edges.pdf`), E(LU) 수정, 짝수 행 규칙이 기재되어 있다.
- CHANGELOG·CONTINUE 는 이 Phase 에서 건드리지 않았다.
