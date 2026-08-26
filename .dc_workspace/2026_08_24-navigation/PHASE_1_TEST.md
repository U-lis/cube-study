# Phase 1 — 테스트 계획

## 테스트 커버리지 목표

라우트 이동이 흠 없이 통과하는지 본다. 새 화면 기능은 이 페이즈가 만들지 않으므로 새 검사는 두 자리뿐 — `nav.ts` 의 순수 함수와 홈 화면 자체.

**규약 검사(FR-NAV-17)는 페이즈 4 가 만든다.** 여기서는 옛 검사가 다 통과하는지가 완료 조건이다.

## 실행 명령

```bash
pnpm check                                # 타입 (svelte-check)
pnpm test                                 # 단위 472개
pnpm test tests/unit/nav.test.ts          # nav.ts 단위 테스트 (신규)
pnpm test:e2e                             # E2E 304개
pnpm build                                # adapter-static strict
pnpm preview                              # 손으로 확인
```

## 새 단위 테스트

### T1-1. `tests/unit/nav.test.ts` — 자동

`src/lib/ui/nav.ts` 의 `tabsFor` · `isHome` 를 순수 함수로 검사한다. jsdom 필요 없다 — 문자열만 다룬다.

| # | 입력 | 기대 |
|---|---|---|
| a | `tabsFor('/', null)` | 빈 배열 (홈은 형제 없음) |
| b | `tabsFor('/3x3/bld/3style/corner/lookup', '/3x3/bld/3style/corner/lookup')` | 세 탭, `lookup` 이 active |
| c | `tabsFor('/3x3/bld/3style/corner/algs', '/3x3/bld/3style/corner/algs')` | 세 탭, `algs` 가 active |
| d | `tabsFor('/3x3/bld/3style/corner/algs/GC', '/3x3/bld/3style/corner/algs/[code]')` | 세 탭, `algs` 가 active (동적 걷어낸 부모) |
| e | `tabsFor('/3x3/bld/3style/corner/quiz', '/3x3/bld/3style/corner/quiz')` | 세 탭, `quiz` 가 active |
| f | `tabsFor('/3x3/bld/trace', '/3x3/bld/trace')` | 빈 배열 (형제 없음) |
| g | `isHome('/')` | true |
| h | `isHome('/3x3/bld/trace')` | false |
| i | `tabsFor` 가 낸 각 탭의 `href` | 절대 경로. `.../lookup`, `.../algs`, `.../quiz` |
| j | `tabsFor` 가 낸 각 탭의 `label` | 한국어 라벨 (`FEATURE_LABELS` 값) |

## 새 E2E

### T1-2. `tests/e2e/lookup.spec.ts` 의 새 진입 경로 — 자동

라우트 이동이 정확한지 위 spec 의 통과 자체가 확인한다. 별도 파일을 만들지 않는다 — 라우트가 옮겨졌다는 사실은 기존 E2E 304개가 새 경로에서 다 통과하는 것으로 증명된다.

**한 곳만 새로 확인해 둔다.** `nginx try_files` 가 옛 북마크를 홈으로 떨어뜨리는지는 로컬에서 확인할 수 없다 — 사람이 배포 후 본다 (T1-6). 로컬 `pnpm preview` 는 `try_files` 규칙이 없으므로 404 를 낸다.

### T1-3. `tests/e2e/about.spec.ts` 는 유지 — 자동

`about.spec.ts` 는 상단 바(정보 모달) 검사다. 홈에서도 상단 바가 그대로 뜨므로 `goto('/')` 를 옮기지 않는다.

**검사**: 이 페이즈 완료 시 `about.spec.ts` 를 손대지 않고 통과한다.

## 자동 검사 (기존 재사용)

### T1-4. `pnpm build` (adapter-static strict) — 자동

`strict: true` 가 링크 안 된 라우트를 잡는다. 홈이 네 기능을 모두 링크하므로 크롤러가 전부 찾는다.

**증거**: 빌드 로그에 프리렌더된 라우트 목록이 뜬다. 확인 항목:

- `/` (홈)
- `/3x3/bld/3style/corner/lookup`
- `/3x3/bld/3style/corner/algs`
- `/3x3/bld/3style/corner/algs/GC` … (기준 상세, 데이터 개수만큼)
- `/3x3/bld/3style/corner/algs/direct` (기준 없는 케이스가 있을 때)
- `/3x3/bld/3style/corner/quiz`
- `/3x3/bld/trace`

옛 경로(`/anchors`, `/quiz`, `/trace`)가 프리렌더 목록에 뜨면 폴더 이동이 덜 됐다.

### T1-5. `tests/unit/e2e-tags.test.ts` 는 계속 통과 — 자동

E2E 파일의 `test(...)` 제목이 문자열 리터럴로 파싱되고, `@viewport` 태그 규약이 지켜진다. 이 페이즈가 만드는 E2E 는 없으므로 자동으로 통과. 다만 goto URL 을 옮기다 실수로 제목에 템플릿 리터럴을 넣지 않았는지 이 검사가 확인한다.

## 사람이 보는 것

### T1-6. 배포·미리보기에서 만져본다 — 사람

**이 페이즈가 끝나는 순간의 조건이다.** 사용자 지시에 따라 페이즈 1 뒤에 배포·미리보기가 되어야 한다.

- [ ] `pnpm preview` 로 홈이 뜬다
- [ ] 홈에서 네 기능 링크가 다 보인다. 진도·통계·환영 문구가 없다
- [ ] 각 링크를 눌러 새 경로가 열린다
- [ ] 조회·기준공식·퀴즈에서 하단 탭 세 개(조회·기준공식·퀴즈)가 뜬다. 트레이싱은 안 뜬다. 홈도 안 뜬다
- [ ] 기준 상세로 들어가면 하단 탭 세 개가 그대로 뜨고 "기준공식" 이 활성이다 (AD-NAV-B)
- [ ] 각 기능 화면 상단에 "홈" 링크가 있다 (기준 상세만 "기준공식")
- [ ] 뒤로가기가 여전히 "닫기" 하나만 뜻한다 (설치된 앱에서 확인. AD-NAV-4)
- [ ] `/anchors` 를 손으로 쳐도 (nginx 없는 환경에서는) 홈이 뜬다 — 이 확인은 배포 환경에서. 로컬 `pnpm preview` 는 404

### T1-7. 프리캐시 목록 확인 — 사람 (배포 후)

`sw.js` 의 프리캐시 항목이 새 라우트로 갱신됐는가. `deploy.sh` 의 프리캐시 전수 대조가 확인한다. 하나라도 404 면 오프라인이 통째로 죽는데 화면으로는 안 보인다 (SPEC "배포").

**배포는 이 페이즈 안이 아니다.** 사용자가 배포 명령을 부른다.

## 통과 기준

- 위 자동 검사가 모두 통과 (`pnpm check` · `pnpm test` · `pnpm test:e2e` · `pnpm build`)
- T1-6 사람 확인 항목이 모두 예
