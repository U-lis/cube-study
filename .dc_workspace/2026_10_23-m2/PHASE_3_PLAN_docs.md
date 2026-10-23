# Phase 3 — 문서

GLOBAL AD-4, AD-9. SPEC Section 2 (FR-M2-D).

## 전제

- Phase 2 완료 (`pnpm check && pnpm test && pnpm test:e2e` 초록).

## 수정할 문서

### 1. `.dc_workspace/SVELTE.md` — 라우트 표

라우트 표에서 M2 관련 행을 찾아 경로를 갱신한다.

- 기존: 이슈 #17 이 가리키는 임시 경로 또는 미입력 상태.
- 변경: `/3x3/bld/m2/edge/{lookup,quiz}` 으로 확정 기재.
- `/3x3/bld/m2` 와 `/3x3/bld/m2/edge` 는 네임스페이스로 표에 명시한다 (화면 없음).

### 2. `README.md` — M2 데이터 주석

"데이터 파일" 또는 관련 섹션에 아래 내용을 추가한다.

- 출처: 사용자 PDF `m2_edges.pdf` (2026-10-23).
- 짝수 번째 행은 데이터에 따로 있다. 코드가 홀짝을 보고 행을 바꾸지 않는다.
- 수정 내역: E(LU) 공식은 PDF 오류 → Pochmann 원문 기준 `B L' B' M2 B L B'` 로 정정.
- 회전 없는 공식: 6개 행(M·E·P·F·O·G)의 `x' … x` 공식을 B 면 무브로 변환했다. 원인: 큐브를 돌리면 기준 자리 UB 가 틀어진다.

### 3. `.dc_workspace/CONVENTIONS.md` — `extraRows` 주석 (필요 시만)

`MoveKeypad extraRows` prop 이 화면 규약에 영향을 준다면 키패드 관련 규약에 한 줄 추가한다.
영향이 없다고 판단되면 수정하지 않는다.

## 하지 않는 것

- CHANGELOG.md, CONTINUE.md 수정 — docs-update 단계에서 처리한다.
- 버전 올리기·태그·`release.sh`.

## 순서

1. `SVELTE.md` 라우트 표 갱신.
2. `README.md` M2 데이터 주석 추가.
3. `CONVENTIONS.md` 검토 후 필요 시 수정.
4. `pnpm check && pnpm test && pnpm test:e2e` 최종 확인.

## 완료 체크리스트

- [ ] `SVELTE.md` 라우트 표에 `/3x3/bld/m2/edge/{lookup,quiz}` 기재
- [ ] `SVELTE.md` 네임스페이스 경로 명시
- [ ] `README.md` M2 데이터 출처·수정·짝수 행 규칙 추가
- [ ] `pnpm check && pnpm test && pnpm test:e2e` 초록
