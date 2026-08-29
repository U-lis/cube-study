# Phase 5 — 테스트 계획

## 테스트 커버리지 목표

두 문서(`CONVENTIONS.md`, `CLAUDE.md`)와 두 갱신(README:111, CHANGELOG 0.5.0)이 자리에 있는가. 링크가 유효한가.

문서라 자동 검사가 얕다. 사람 확인이 대부분이다.

## 실행 명령

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

문서만 바뀌지만 위 검사가 다 통과함으로써 문서 편집이 코드에 영향을 주지 않았음을 확인한다.

## 자동 검사

### T5-1. 파일 존재 — 자동

- [ ] `test -f .dc_workspace/CONVENTIONS.md`
- [ ] `test -f CLAUDE.md` (저장소 루트)
- [ ] `grep -q "CONVENTIONS.md" README.md`
- [ ] `grep -q "^## \[0.5.0\]" CHANGELOG.md`

`tests/unit/routes.test.ts` (페이즈 4 신설) 에 아래를 추가할 수 있으나 지금은 굳이 얹지 않는다 — 파일 존재 검사는 셸 명령이 값이 싸다. **선택**: 페이즈 4 의 정적 검사 파일에 이 네 자리를 얹는 것도 가능하나 이번 페이즈에 코드를 안 넣는다는 원칙과 부딪힘. 판단은 실행자에게

### T5-2. `deploy/release.sh` 검증 — 자동 (드라이런)

- [ ] `deploy/release.sh` 실행 없이 스크립트가 `## [0.5.0]` 헤딩을 인식하는지 텍스트 검증 — `grep -q '## \[0.5.0\]' CHANGELOG.md`
- [ ] 스크립트의 CHANGELOG 검증 로직(`deploy/release.sh:48-51` — SPEC 인용)이 새 헤딩을 찾는지 확인 (`grep` 명령이 스크립트 안에 있는지)

## 사람이 보는 것

### T5-3. `CLAUDE.md` 링크 유효성 — 사람

- [ ] `CLAUDE.md` 안의 다섯 문서 지도 링크가 실재 파일을 가리킴
  - `.dc_workspace/CONVENTIONS.md` — 이 페이즈에서 만든 파일
  - `.dc_workspace/SVELTE.md` — 이미 존재
  - `README.md` — 이미 존재
  - `.dc_workspace/CONTINUE.md` — 이미 존재
  - `.dc_workspace/BACKLOG.md` — 이미 존재

### T5-4. `CONVENTIONS.md` 인용 유효성 — 사람

- [ ] 각 규약 항목의 근거로 인용된 파일:라인이 실재하는지 (예: `2026_08_20/GLOBAL.md AD-13`)
  - 옛 GLOBAL.md 들은 지나간 작업의 기록이므로 라인 번호가 시간이 지나 흔들릴 수 있음. 이 페이즈 시점에는 확인이 가능함
- [ ] 각 규약 항목의 검사 파일:라인이 실재하는지 (예: `tests/e2e/conventions.spec.ts:XX`)
  - 페이즈 4 가 만든 파일. 라인 번호는 그 시점 값

### T5-5. `CLAUDE.md` 길이 — 사람

- [ ] `CLAUDE.md` 가 실제로 짧은가 (SPEC FR-NAV-16 "길이를 짧게 유지한다")
- [ ] 기본 규칙이 담겨 있고 근거는 링크로 넘어가는가 — 사례·표가 본문에 들어가 있지 않는가
- [ ] "한 홉이면 닿아야 한다" — 화면을 만들 때 필요한 규칙이 링크 하나 안 눌러도 읽히는가

### T5-6. `README.md:111` 갱신 — 사람

- [ ] 그 줄이 이제 `.dc_workspace/CONVENTIONS.md` 를 함께 가리킨다
- [ ] `## 주의` 섹션은 손대지 않았다
- [ ] `SVELTE.md` 로 가는 링크는 그대로 유지 (지금 `README.md` 의 "화면 코드를 쓰기 전에 `.dc_workspace/SVELTE.md`" 줄)

### T5-7. `CHANGELOG.md ## [0.5.0]` — 사람

- [ ] 새 헤딩이 `## [0.4.2]` 위에 있다
- [ ] 세 카테고리(추가·변경·문서)가 SPEC 요구를 반영한다
- [ ] 날짜 자리는 `YYYY-MM-DD` 로 비어 있다 (릴리스 시 채움)
- [ ] Keep a Changelog 형식을 지킨다 (기존 `## [0.4.2]` · `## [0.4.1]` 항목과 톤이 같음)

### T5-8. `SVELTE.md` 는 손대지 않았다 — 사람

- [ ] `git diff` 로 확인. 이 페이즈에서 `SVELTE.md` 변경이 없음

## 통과 기준

- 자동 검사 (`pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build`) 모두 통과 — 문서 편집이 코드에 영향 없음
- T5-1 자동 파일 존재 검사 통과
- T5-3 ~ T5-8 사람 확인 항목이 모두 예

## 페이즈 후 (사용자 몫)

- [ ] 사용자가 릴리스를 결정하면 `CHANGELOG.md` 의 `## [0.5.0]` 날짜를 채운다
- [ ] 사용자가 `deploy/release.sh` 를 실행한다 (자동 실행하지 않음)
- [ ] 배포 후 T1-7 (프리캐시 목록) 확인
