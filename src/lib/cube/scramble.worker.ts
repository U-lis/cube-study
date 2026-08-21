/**
 * 스크램블 생성 Worker. **`Cube.initSolver()` 를 부르는 저장소 안의 유일한 파일이다.**
 *
 * 왜 워커인가 — 번들 크기가 아니다. `solve.js` 는 gzip 7.1KB 다. 이유는 둘이다 (GLOBAL AD-9):
 *   1. `initSolver()` 가 실측 1695ms 다. 메인 스레드면 앱이 1.7초 멈춘다.
 *   2. heap +37MB / RSS +102MB 를 계속 붙든다. `terminate()` 로 통째 반납한다 (NFR-TR-1).
 * 그래서 `solve.js` 코드가 메인 청크에 섞이는 것 자체는 문제가 아니다. 금지 대상은 메인
 * 스레드에서의 `initSolver()` 호출 하나뿐이고, 수동 청크 분할·번들 후처리를 넣지 않는다.
 *
 * `cubejs` 자체 async API(`lib/async.js`)는 쓰지 않는다 — `window.Worker` 와 워커 URI 를
 * 전제해 번들러와 싸우게 된다. 프로토콜은 GLOBAL §3.2 표를 따른다.
 */

import Cube from 'cubejs'; // 패키지 진입점 = 풀이기 포함. 앱 코드는 계속 `cubejs/lib/cube.js` 를 쓴다.
import { scrambleFrom, type FromWorker, type ToWorker } from './scramble.js';

/**
 * 워커 전역. `lib: webworker` 를 켜면 프로젝트의 DOM 선언과 충돌하므로 타입을 끌어오지 않고
 * 우리가 쓰는 두 멤버만 좁혀서 본다.
 */
const ctx = self as unknown as {
	onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
	postMessage(message: FromWorker): void;
};

let ready = false;

ctx.onmessage = (event) => {
	const msg = event.data;

	if (msg.type === 'init') {
		if (!ready) {
			Cube.initSolver(); // 실측 1695ms. 여기서만 부른다.
			ready = true;
		}
		ctx.postMessage({ type: 'ready' });
		return;
	}

	if (msg.type === 'request') {
		if (!ready) return; // 메인은 ready 뒤에만 요청하지만 방어한다.
		// 1건씩 보낸다. n건을 모아 보내면 첫 스크램블이 n×27ms 만큼 늦어진다.
		for (let i = 0; i < msg.n; i++) {
			try {
				const { scramble, core } = scrambleFrom(Cube.random());
				ctx.postMessage({ type: 'scramble', scramble, core });
			} catch (e) {
				ctx.postMessage({ type: 'error', message: (e as Error).message });
			}
		}
	}
};
