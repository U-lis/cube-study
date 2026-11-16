# Phase 6 TEST — 문서

문서 단계에서 새로 추가하는 자동화 테스트는 없다.

## 검증할 동작

| 동작 | 레이어 |
|------|--------|
| `pnpm check` 통과 (타입 오류 없음) | build |
| `pnpm test` 통과 (단위 테스트 회귀 없음) | unit |
| `pnpm test:e2e` 통과 (E2E 회귀 없음) | e2e |

## 문서 내용 검토 항목 (자동화 아님)

- [ ] `README.md` 에 `corner-UBL-op.json` 출처(`op_corners.pdf`), 22행 구조, setup 만 있음, `[Y]` UB↔UL 부작용, 패리티 행 없음 이유가 기재됨
- [ ] `SVELTE.md` 라우트 표에 `/3x3/bld/op/corner/{lookup,quiz}`, `/3x3/bld/3style/corner/exam` 기재됨
- [ ] `SVELTE.md` 네임스페이스 `/3x3/bld/op`, `/3x3/bld/op/corner` 가 화면 없음으로 명시됨
- [ ] `CONTINUE.md` 0.9.0 (#46·#18·#34) 완료 상태로 갱신됨
- [ ] `BACKLOG.md` #18·#34·#46 완료 표시됨
- [ ] `CHANGELOG.md` 는 **건드리지 않음** — DOCS_UPDATE 단계에서 작성
- [ ] `package.json` 버전은 **건드리지 않음** — 릴리스에서만
- [ ] `pnpm check && pnpm test && pnpm test:e2e` 통과 (CI 또는 로컬 실행으로 확인)
