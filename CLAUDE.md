# cube-study

3BLD 학습 PWA. SvelteKit 2 + Svelte 5(룬) + adapter-static. **서버가 없다** — 전부
프리렌더한 정적 파일이고 nginx 가 그대로 내려준다.

## 문서 지도

| 문서 | 무엇 |
|---|---|
| `.dc_workspace/CONVENTIONS.md` | 화면 규약 (구성·흐름·표기). 아래 요약의 정본 |
| `.dc_workspace/SVELTE.md` | 프레임워크 규약 + **라우트 축**. 화면 코드 전에 본다 |
| `README.md` | 데이터·도메인 함정, 실행·테스트·배포 |
| `.dc_workspace/CONTINUE.md` | 지금 어디까지 왔나 |
| `.dc_workspace/BACKLOG.md` | 다음에 할 일과 그 경로 |

## 화면을 만들거나 고칠 때

- 세로 순서: 되돌아가기 → `<h1>` 화면 이름 → 설정 → 본문 → 판정 → 결과 → 진행 버튼 → 형제 탭. 순서는 고정이다. 단계에 따라 접었다 펴되 자리를 옮기지 않는다
- `<h1>` 은 화면 이름이다. 문제나 데이터를 `<h1>` 에 넣지 않는다
- 진행 버튼은 언제나 본문 최하단이다. 단계마다 누를 수 있는 것 하나만 보인다. 이름은 `data-{동작}`, 자판 안 편집 버튼만 `data-action`
- 판정 줄은 `data-verdict` + `data-kind` + `data-result`. 색은 `data-result` 만 보고 칠한다
- 설정은 **측정하는 판**이 도는 동안만 접고(CSS) 잠근다(`disabled`). 둘은 따로다. 기록을 안 남기는 화면은 잠그지 않는다
- 접는 것이 기본이다. 자리를 예약하는 것은 하이드레이션이 흔들리는 자리에만
- 접기는 CSS 로 한다. `{#if}` 로 DOM 에서 빼지 않는다 — **두 번 밟은 함정이다**
- 단계는 `data-stage` 로 낸다. 검사와 CSS 가 같은 신호를 본다
- 색만으로 알리지 않는다. 같은 자리에 문구가 함께 선다
- 터치 타깃은 44px 이상. 안 보이는 버튼은 자기 단계에서 잰다
- UI 문구는 사실만 적는다. 백분율·격려·게이미피케이션 금지

## 새 화면을 어디 둘 것인가

- URL 은 `/{퍼즐}/{종목}/{방법}/{세트}/{기능}` 축에 앉힌다. 없는 축은 건너뛴다
  (예: `/3x3/bld/3style/corner/lookup`, `/3x3/bld/trace`)
- 중간 경로에 화면을 만들지 않는다. 앞 칸들은 이름 공간이지 화면이 아니다
- 부분집합은 경로를 가르지 않는다 (2-look OLL 은 필터). 방법을 새로 파는 기준은 **알고리즘 집합이 다른가**
- 하단 탭은 기능 칸만 다른 화면끼리다. 상세는 목록의 탭을 물려받는다
- 백로그 항목별 경로와 예외는 `.dc_workspace/SVELTE.md` 의 "라우트 축"

## 코드

- 룬만 쓴다. `export let` · `$:` · `on:click` · `<slot>` · `svelte/store` 금지
- **서버 기능은 존재하지 않는다** — `+page.server` · `+server` · form actions · 서버 훅 · 비공개 환경변수
- `$effect` 는 외부 세계와 맞물릴 때만. 파생값은 `$derived`
- 알고리즘 렌더는 `Alg.svelte` 한 곳. `{@html}` 금지
- 데이터의 알고리즘을 코드가 만들거나 고치지 않는다
- E2E 테스트 제목에 템플릿 리터럴을 쓰지 않는다 (`tests/unit/e2e-tags.test.ts` 파서가 문자열 리터럴만 읽는다)

## 명령

```bash
pnpm dev            # 개발 서버 (PWA 는 여기서 확인 안 된다)
pnpm check          # 타입
pnpm test           # 단위 (Vitest)
pnpm test:e2e       # E2E (Playwright)
pnpm preview        # 빌드 후 서빙. PWA 확인은 여기서만
```

배포는 `deploy/README.md`. **릴리스는 `./deploy/release.sh` 하나뿐이고, 사용자가
명시적으로 승인한 뒤에만 부른다.**
