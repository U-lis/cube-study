# cube-study

3BLD(눈가리고 큐브 맞추기) 학습용 앱. 현재 **코너 3-style (UBL 버퍼)** 조회와 퀴즈를 제공한다.

버전과 커밋 해시는 앱 우상단 정보 버튼에서 확인할 수 있다. 버전의 정본은 `package.json` 하나이며 빌드 타임에 주입된다.

PDF에서 인덱스를 찾아 스크롤로 뒤지는 대신, 스티커 2글자를 입력하면 기준공식과 실제 공식이 즉시 나온다.

## 기능

| | |
|---|---|
| **조회** | 스티커 2글자 → 기준공식 + 공식. direct/setup, strict/compact 토글 |
| **기준공식 브라우저** | 기준을 담당 케이스 수 순으로. 기준별 케이스 목록 |
| **퀴즈** | direct(무브 직접 입력) 또는 setup(셋업 + 기준공식 선택). 큐브 시뮬레이터가 채점 |

기준공식의 개수·이름·순서·방향은 전부 데이터가 정한다 (현재 6개: `GC TC BU IV KS KG`). 코드에 박아두지 않으므로 데이터를 교체하면 화면이 따라간다 — `data/schema-history/README.md` 참고.

퀴즈 채점은 문자열 비교가 아니라 실제 큐브 효과로 판정한다. 같은 3-cycle을 만드는 알고리즘은 여러 개이므로, 데이터에 없는 유효한 변형도 정답 처리된다. 엣지를 건드리면 "코너는 맞지만 엣지를 건드립니다"로 구분해 알려준다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 + HMR (http://localhost:5173)
```

**PWA와 오프라인 동작은 프로덕션 빌드에서만 확인된다.** 개발 서버에는 서비스워커를 등록하지 않는다 — SW 캐시가 HMR 을 가린다.

```bash
npm run preview    # 빌드 후 서빙 (http://localhost:4173)
```

`preview` 는 매번 빌드부터 한다. `vite preview` 는 기동 시점의 파일 목록을 붙잡기 때문에, 서버를 띄워둔 채 재빌드하면 해시가 바뀐 청크를 404 로 돌려준다. 그러면 서비스워커 프리캐시가 통째로 실패한다(`bad-precaching-response`). 빌드 없이 서빙만 하려면 `npm run preview:only`.

## 테스트

```bash
npm test           # 단위 (Vitest)
npm run test:e2e   # E2E (Playwright, 모바일+데스크탑)
npx svelte-check   # 타입 검사
```

E2E는 Chromium이 필요하다. 없으면 `npx playwright install chromium`.

### 데이터 회귀 테스트

`npm test`에 378케이스 전수 검증이 포함된다. 데이터나 시뮬레이터를 건드린 변경은 여기서 걸린다.

- 각 알고리즘이 해당 케이스를 실제로 푸는가 (direct / setup / strict)
- 엣지를 전혀 안 건드리는가
- `moves`·`strict`·`sameAlg`·`inverseTrick` 필드가 실제와 일치하는가
- 역트릭(`XY` 뒤집기 = `YX`)이 성립하는가

## 구조

```
src/lib/
├── data/         corner-UBL.json + {pieceType, buffer} 로더
├── cube/         큐브 시뮬레이터 (스티커 치환 방식), 표기 유틸
├── domain/       타입, 입력 검증, 표기 생성, 퀴즈 채점, 기준공식 취급
└── ui/           컴포넌트, 표시 설정

data/schema-history/   데이터 스키마 v1~v3 기록 (앱은 읽지 않는다)
```

데이터셋 로더는 `loadDataset({ pieceType, buffer })` 시그니처를 쓴다. UFR 버퍼·엣지 3-style을 추가할 때 `loader.ts` 내부만 바뀌고 호출부는 그대로다.

## 주의

- **데이터의 알고리즘을 재계산하거나 "더 짧은 것"으로 교체하지 말 것.** 큐브 시뮬레이터로 3중 검증(메모 방향 / 코너 해결 / 엣지 무영향)을 통과한 값이다. 길이만 보고 최적화하면 엣지 무영향 조건이 깨진다.
- **프라임 기호는 반드시 ASCII `'`(U+0027).** 알고리즘 렌더는 `Alg.svelte` 한 곳만 거치며 `{@html}`을 쓰지 않는다. 무브 사이에는 실제 공백 텍스트 노드가 들어간다 — 복사했을 때 무브 구분이 유지되어야 한다.

배경과 설계 근거는 `.dc_workspace/handoff/`와 `.dc_workspace/2026_08_03-corner-3style/`에 있다.

## 배포

정적 빌드이므로 `build/`를 그대로 서빙하면 된다. 서버 런타임이 필요 없다.

```nginx
root /path/to/cube-study/build;
try_files $uri $uri.html $uri/index.html /index.html;
```

PWA 설치에는 HTTPS가 필요하다.

## 라이선스

MIT
