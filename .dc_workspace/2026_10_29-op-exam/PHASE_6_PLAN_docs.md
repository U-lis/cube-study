# Phase 6 — 문서 (`docs`)

GLOBAL AD-4, AD-11. SPEC FR-TB-3.

## 전제

- Phase 5 완료 (`pnpm check && pnpm test && pnpm test:e2e` 초록).

## 수정할 문서

### 1. `README.md` — 데이터 섹션

"데이터 파일" 또는 관련 섹션에 `corner-UBL-op.json` 항목을 추가한다.

- 출처: 사용자 PDF `op_corners.pdf` (2026-10-29, 비공개).
- 22행: 타깃 21행 + Y 행 1행. 버퍼 UBL / 교환 자리 DFR(P).
- 데이터에는 setup 만 있다. `[Y]`·역 setup 은 코드가 조합한다.
- `[Y]` 단독 부작용: 엣지 UB↔UL — M2 패리티가 남기는 UB↔UL 을 닫는다.
- 패리티 행 없음: OP `[Y]` 의 UB↔UL 부작용이 그 역할을 한다.

### 2. `.dc_workspace/SVELTE.md` — 라우트 표 갱신

- `/3x3/bld/op/corner/{lookup,quiz}` 추가.
- `/3x3/bld/3style/corner/exam` 추가.
- 네임스페이스(`/3x3/bld/op`, `/3x3/bld/op/corner`)는 화면 없음으로 명시한다.

### 3. `.dc_workspace/CONTINUE.md` 갱신

현재 0.9.0 진행 상태(이슈 #46·#18·#34 완료)로 갱신한다.

### 4. `.dc_workspace/BACKLOG.md` 갱신

- #18 (OP 코너), #34 (시험), #46 (하단 탭 제거) 항목에 0.9.0 완료 표시.

## 하지 않는 것

- **CHANGELOG.md** — DOCS_UPDATE 단계에서 처리한다.
  이 branch 에서 `## [Unreleased]` 도 직접 쓰지 않는다. 릴리스 시 `release.sh` 가
  `## [x.y.z]` 헤딩을 요구하므로 DOCS_UPDATE 가 먼저 채운다.
- `package.json` 버전 — 릴리스(`./deploy/release.sh`)에서만 올린다.
- 태그·`release.sh` 실행 — 사용자 명시적 승인 후에만.

## 순서

1. `README.md` 데이터 섹션 갱신.
2. `SVELTE.md` 라우트 표 갱신.
3. `CONTINUE.md` 상태 갱신.
4. `BACKLOG.md` 항목 갱신.
5. `pnpm check && pnpm test && pnpm test:e2e` 최종 확인.

## 완료 체크리스트

- [ ] `README.md` 에 `corner-UBL-op.json` 출처·구조·부작용 기재
- [ ] `SVELTE.md` 라우트 표에 OP 조회·퀴즈·시험 경로 기재
- [ ] `SVELTE.md` 네임스페이스 경로 명시
- [ ] `CONTINUE.md` 0.9.0 완료 상태 반영
- [ ] `BACKLOG.md` #18·#34·#46 완료 표시
- [ ] `pnpm check && pnpm test && pnpm test:e2e` 초록

## 주의사항

- CHANGELOG 는 DOCS_UPDATE 단계에서 작성한다. Phase 6 에서 손대지 않는다.
- Phase 1 에서 이미 수정한 CONVENTIONS.md · CLAUDE.md 는 다시 건드리지 않는다
  (Phase 1 체크리스트에서 완료).
