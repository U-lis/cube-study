# Phase 5 — 마무리

## 검사 갱신

- `tests/e2e/conventions.spec.ts`: "홈은 넷을 모두 링크한다", "기능 화면 넷은 홈으로 올라간다" 등 개수를 박은 검사를 새 화면 둘을 포함하도록 고친다. 탭 검사에 letters 묶음을 더한다
- `tests/unit/nav.test.ts`, `tests/unit/routes.test.ts`: 새 경로가 규칙을 지키는지
- 새 E2E 제목에 템플릿 리터럴 금지 (`e2e-tags.test.ts`)

## 실측

- NFR-LT-7: 390×844 · 375×667 에서 두 화면의 진행 버튼(퀴즈)·원위치(외우기) 아래끝을 잰다. 넘치면 SegToggle 을 줄이거나 큐브 높이 하한을 조정하고 결과를 SPEC 에 적는다

## 문서

- `CHANGELOG.md` 에 `## [Unreleased]` — 외우기·퀴즈 추가 (버전 번호는 릴리스 때 정한다)
- `README.md` 에 화면 목록이 있으면 추가

## 전 검사

`pnpm check && pnpm test && pnpm test:e2e`
