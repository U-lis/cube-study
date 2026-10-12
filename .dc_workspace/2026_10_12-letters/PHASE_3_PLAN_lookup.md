# Phase 3 — 외우기 화면

GLOBAL AD-LT-10~12. SPEC FR-LT-1~11, 23, 24.

## 고치는 것

- `src/lib/ui/nav.ts`: `SIBLING_GROUPS['/3x3/bld/letters'] = ['lookup','quiz']`, `GROUP_LABELS` (AD-LT-10). 파일 머리 주석의 "#19 가 들어오면 `/3x3/bld` 키가 생긴다" 문단을 실제 결정으로 고친다
- `src/lib/ui/facelets.ts`: `COLOR_NAME_KO` (AD-LT-12)
- `src/routes/+page.svelte`: `FEATURES` 에 두 줄
  - 외우기 — "Speffz 문자가 큐브의 어느 스티커인지 봅니다"
  - 퀴즈(문자) — 이름 충돌을 피해 표시 이름 "문자 퀴즈" — "칠해진 조각의 문자를 입력합니다"
  - 홈 목록 이름은 화면 이름과 같아야 한다는 검사가 있으면 그것을 따른다 (Phase 5 에서 확인)

## 새로 만드는 것

- `src/lib/ui/letters.svelte.ts` (AD-LT-11)
- `src/routes/3x3/bld/letters/lookup/+page.svelte`
  - 세로 순서: UpLink(홈) → `<h1>외우기</h1>` → 설정(글자 SegToggle · 다른 조각 SegToggle) → 기준 문구 → 큐브 → 원위치 버튼
  - 데이터셋은 `loadDataset` 으로 `meta.colorScheme` 만 쓴다 (트레이싱과 같다). 로드 전에는 회색 큐브
  - `facelets = new Cube().asString()` 은 `speffz.ts` 처럼 모듈 상수
  - 원위치: `<button data-reset>원위치</button>` → `cube.resetView(0)`. 44px
  - `<title>스티커 문자 — 외우기</title>`
