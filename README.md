# cube-study

[![CI](https://github.com/U-lis/cube-study/actions/workflows/ci.yml/badge.svg)](https://github.com/U-lis/cube-study/actions/workflows/ci.yml)
[![사이트 점검](https://github.com/U-lis/cube-study/actions/workflows/site-check.yml/badge.svg)](https://github.com/U-lis/cube-study/actions/workflows/site-check.yml)

3BLD(눈가리고 큐브 맞추기) 학습용 앱. 현재 **코너 3-style (UBL 버퍼)** 의 조회·기준공식·퀴즈와, 코너·엣지 **트레이싱 훈련** 을 제공한다.

버전과 커밋 해시는 앱 우상단 정보 버튼에서 확인할 수 있다. 버전의 정본은 `package.json` 하나이며 빌드 타임에 주입된다.

PDF에서 인덱스를 찾아 스크롤로 뒤지는 대신, 스티커 2글자를 입력하면 기준공식과 실제 공식이 즉시 나온다.

## 기능

| | |
|---|---|
| **조회** | 스티커 2글자 → 기준공식 + 공식. direct/setup, strict/compact 토글. 표기별 암기 체크박스 |
| **기준공식 브라우저** | 기준을 데이터가 정한 학습 순서로. 기준별 케이스 목록. 기준별 암기 진도·"외운거 안보기"·"역공식 안보기" |
| **아는 기준으로** | 배정된 기준을 아직 안 배웠으면 조회 카드에 아는 기준의 경로를 함께 보여준다. 배운 기준은 그 기준의 자기 케이스 2개 암기 체크로 판정한다 |
| **퀴즈** | direct(무브 직접 입력) 또는 setup(셋업 + 기준공식 선택). 큐브 시뮬레이터가 채점. "암기한 것만" 필터 |
| **트레이싱 훈련** | 랜덤 스테이트 스크램블을 3D 큐브로 보여주고, 타깃 열을 입력하면 실제 큐브 효과로 채점. 코너·엣지·양쪽, 보고 따라가기/외운 다음 입력, 비틀림 관례 A·B. 최근 50건 기록 |

화면 주소는 `/{퍼즐}/{종목}/{방법}/{세트}/{기능}` 축을 따른다 — 조회 `/3x3/bld/3style/corner/lookup`, 기준공식 `.../algs`, 퀴즈 `.../quiz`, 트레이싱 `/3x3/bld/trace`. `/` 는 홈이고 기능 넷을 나열한다. 새 화면을 어느 축에 앉히는지는 `.dc_workspace/SVELTE.md` 가 정본이다.

기준공식의 개수·이름·순서·방향은 전부 데이터가 정한다 (현재 10개: `GC BU DO CH IT OI SC VJ SV TH`). 코드에 박아두지 않으므로 데이터를 교체하면 화면이 따라간다 — `data/schema-history/README.md` 참고.

퀴즈 채점은 문자열 비교가 아니라 실제 큐브 효과로 판정한다. 같은 3-cycle을 만드는 알고리즘은 여러 개이므로, 데이터에 없는 유효한 변형도 정답 처리된다. 엣지를 건드리면 "코너는 맞지만 엣지를 건드립니다"로 구분해 알려준다.

## 실행

Node 24 + pnpm 10 을 쓴다. `packageManager` 필드가 있으므로 corepack 이 켜져 있으면 버전이 자동으로 맞는다.

```bash
pnpm install
pnpm dev           # 개발 서버 + HMR (http://localhost:5173)
```

**PWA와 오프라인 동작은 프로덕션 빌드에서만 확인된다.** 개발 서버에는 서비스워커를 등록하지 않는다 — SW 캐시가 HMR 을 가린다.

```bash
pnpm preview       # 빌드 후 서빙 (http://localhost:4173)
```

`preview` 는 매번 빌드부터 한다. `vite preview` 는 기동 시점의 파일 목록을 붙잡기 때문에, 서버를 띄워둔 채 재빌드하면 해시가 바뀐 청크를 404 로 돌려준다. 그러면 서비스워커 프리캐시가 통째로 실패한다(`bad-precaching-response`). 빌드 없이 서빙만 하려면 `pnpm preview:only`.

## 테스트

```bash
pnpm test          # 단위 (Vitest)
pnpm test:e2e      # E2E (Playwright, 모바일+데스크탑)
pnpm check         # 타입 검사 (svelte-check)
```

E2E는 Chromium이 필요하다. 없으면 `npx playwright install chromium`.

```bash
bash tests/deploy/run.sh    # 배포 스크립트 셸 테스트
```

배포 스크립트도 테스트가 있다. 임시 디렉터리에 가짜 저장소를 만들어 돌리므로
홈서버도 ssh 도 네트워크도 필요 없다. 태그가 옮겨갔을 때 서버가 따라가는지,
annotated 태그에서 커밋을 제대로 뽑는지 — 둘 다 실제로 릴리스를 반쪽으로
만들었던 버그다.

## CI

PR 과 main push 마다 타입 검사·단위·E2E·배포 스크립트 검사가 돈다.
**배포는 하지 않는다** — 홈서버는 tailnet 안이라 GitHub 러너가 닿지 못한다.

하루 한 번 배포된 사이트를 따로 점검한다. 인증서 만료 임박, 기본 경로 응답,
서비스워커 프리캐시 전수 200. 커밋과 무관하게 조용히 썩는 것들이라 CI 로는
안 잡힌다 — 인증서가 6개월간 만료 상태였던 전례가 있다.

### 데이터 회귀 테스트

`pnpm test`에 378케이스 전수 검증이 포함된다. 데이터나 시뮬레이터를 건드린 변경은 여기서 걸린다.

- 각 알고리즘이 해당 케이스를 실제로 푸는가 (direct / setup / strict)
- 엣지를 전혀 안 건드리는가
- `moves`·`strict`·`sameAlg`·`inverseTrick` 필드가 실제와 일치하는가
- 역트릭(`XY` 뒤집기 = `YX`)이 성립하는가

### 무브의 물리는 우리가 안 들고 있다

시뮬레이터의 무브 정의는 [`cubejs`](https://github.com/ldez/cubejs) 가 한다
(0.3.1). 저장소에 남은 큐브 지식은 `src/lib/cube/speffz.ts` 의 좌표 — 어느
Speffz 문자가 어느 facelet 인가 — 하나뿐이고, 그 좌표는 데이터의 타깃 삼중항
756개와 대조해 확인한다 (`tests/unit/speffz.test.ts`).

0.3.0 까지는 무브 테이블 27개를 `perms.json` 에 직접 들고 있었다. 그 안의 `L` 이
표준의 역이라 데이터 756 중 320개가 틀렸는데도 자체 검증을 전부 통과했다.
그 파일로 만든 데이터를 그 파일로 확인하는 순환 논증이었기 때문이다. 지금은
`perms.json` 이 없다 — 우리가 안 들고 있는 것은 틀릴 수 없다.

## 구조

```
src/lib/
├── data/         corner-UBL.json + {pieceType, buffer} 로더
├── cube/         큐브 시뮬레이터 (cubejs 백엔드), Speffz 좌표, 표기 유틸,
│              트레이싱 엔진 (trace.ts), 스크램블 워커, 3D 큐브 (cube3d.ts)
├── domain/       타입, 입력 검증, 표기 생성, 퀴즈 채점, 기준공식 취급,
│              암기 상태 (memorize.ts), 트레이싱 채점·세션 (tracing.ts)
└── ui/           컴포넌트, 표시 설정, Svelte 스토어 (memorize/tracing/scramble.svelte.ts)

src/routes/      화면. 경로가 곧 축이다 (3x3/bld/3style/corner/…, 3x3/bld/trace)

data/schema-history/   데이터 스키마 v1~v9 기록 (앱은 읽지 않는다)
```

데이터셋 로더는 `loadDataset({ pieceType, buffer })` 시그니처를 쓴다. UFR 버퍼·엣지 3-style을 추가할 때 `loader.ts` 내부만 바뀌고 호출부는 그대로다.

## 주의

- **데이터의 알고리즘을 재계산하거나 "더 짧은 것"으로 교체하지 말 것.** 큐브 시뮬레이터로 3중 검증(메모 방향 / 코너 해결 / 엣지 무영향)을 통과한 값이다. 길이만 보고 최적화하면 엣지 무영향 조건이 깨진다.
- **무브 정의를 저장소로 다시 들여오지 말 것.** 0.3.0 까지는 `perms.json` 에 무브 테이블을 들고 있었고, `L` 이 뒤집힌 채 실려 나갔는데 자체 검증 1512/1512 가 그걸 못 잡았다. 지금은 `cubejs` 가 정한다.
- **프라임 기호는 반드시 ASCII `'`(U+0027).** 알고리즘 렌더는 `Alg.svelte` 한 곳만 거치며 `{@html}`을 쓰지 않는다. 무브 사이에는 실제 공백 텍스트 노드가 들어간다 — 복사했을 때 무브 구분이 유지되어야 한다.
- **화면 코드를 쓰기 전에 `.dc_workspace/SVELTE.md`.** 이 저장소가 Svelte/SvelteKit 의 무엇을 쓰고 무엇을 안 쓰는지, 그리고 **새 화면의 URL 을 어느 축에 앉히는지**가 거기 있다. 서버가 없다는 사실이 프레임워크 기능의 절반을 잘라내므로, 공식 문서의 예제를 그대로 옮기면 안 되는 자리가 많다.

화면 규약(구성·흐름·표기)은 `.dc_workspace/CONVENTIONS.md` 가 정본이고, 규칙 요약과
문서 지도는 저장소 루트 `CLAUDE.md` 에 있다. 배경과 설계 근거는
`.dc_workspace/handoff/`와 `.dc_workspace/2026_08_03-corner-3style/`에 있다.

작업을 이어받을 때는 `.dc_workspace/CONTINUE.md` 부터 본다 — 지금 어디까지 왔고 다음이
무엇인지, 그리고 이미 밟은 함정들이 거기 있다. 다음에 할 일 후보는
`.dc_workspace/BACKLOG.md` 다.

## 배포

정적 빌드이므로 서버 런타임이 필요 없다. 홈서버로는 스크립트 하나면 된다.

개발 중 확인은 로컬에서 하고, **폰에 깔린 앱에 반영하는 것은 릴리스 하나뿐이다.**

```bash
./deploy/release.sh 0.2.0   # 검사 → 버전 → 태그 → push → 배포 → 검증
```

릴리스가 아니라 특정 ref 를 서버에 띄워볼 때는 배포 스크립트를 직접 부른다.

```bash
git push                    # 서버가 origin 에서 받아가므로 push 가 먼저다
./deploy/deploy.sh          # 현재 브랜치 배포
./deploy/deploy.sh v0.1.0   # 특정 ref 배포
```

서버가 직접 `git clone`/`fetch` 해서 빌드한다. 로컬 산출물을 올리지 않으므로 배포된 것이 어느 커밋인지 항상 확실하고, 커밋되지 않은 로컬 수정이 새어 나갈 수 없다.

**PWA 설치에는 유효한 HTTPS 가 필요하다.** 서비스워커는 secure context 에서만 등록되며 `localhost` 만 예외다. LAN IP 로 그냥 띄우면 설치도 오프라인도 안 된다.

접속은 Tailscale 을 타므로 **집 밖에서도 같은 명령으로 배포된다.** 공유기에 열어둔 포트는 없다.

서버 최초 설정과 운영 메모는 `deploy/README.md`.

## 라이선스

MIT
