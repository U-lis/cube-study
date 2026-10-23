# Phase 3 TEST

문서 단계에서 새로 추가하는 테스트는 없다.

## 검증할 동작

| 동작 | 레이어 |
|------|--------|
| `pnpm check` 통과 (타입 오류 없음) | build |
| `pnpm test` 통과 (단위 테스트 회귀 없음) | unit |
| `pnpm test:e2e` 통과 (E2E 회귀 없음) | e2e |

## 문서 내용 검토 항목 (자동화 아님)

- [x] `SVELTE.md` 라우트 표에 `/3x3/bld/m2/edge/{lookup,quiz}` 가 있다.
- [x] `SVELTE.md` 네임스페이스 `/3x3/bld/m2`, `/3x3/bld/m2/edge` 가 표에 명시됐다.
- [x] `README.md` 에 M2 데이터 출처(`m2_edges.pdf`), E(LU) 수정, 짝수 행 규칙이 기재되어 있다.
- [x] `README.md` 기능 요약 줄에 M2 엣지 조회·퀴즈가 추가됐다.
- [x] `README.md` 구조 트리의 `data/` 항목에 `edge-DF-m2.json` 이 추가됐다.
- [x] `CHANGELOG.md` 에 `## [Unreleased]` 항목이 추가됐다.
- [x] `CONTINUE.md` 섹션 1 이 0.8.0 진행 중 상태로 갱신됐다.
- [x] `BACKLOG.md` M2 (#17) 항목에 0.8.0 진행 중 표시가 추가됐다.
- [x] `GLOBAL.md` Phase 3 상태가 Complete 로 갱신됐다.
- [x] `pnpm check && pnpm test && pnpm test:e2e` 통과 (CI 또는 로컬 실행으로 확인)
