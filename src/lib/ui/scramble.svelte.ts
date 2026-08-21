/**
 * 스크램블 공급원. **모듈 스코프 싱글턴이 아니다** — 화면이 만들고 화면이 파괴한다.
 *
 * `settings.svelte.ts` / `memorize.svelte.ts` 처럼 싱글턴으로 두면 `/trace` 를 떠난 뒤에도
 * 워커와 그 100MB 가 살아남는다. 워커의 수명이 화면의 수명이다 (GLOBAL AD-9, NFR-TR-1).
 *
 * 상태는 여기 `$state` 필드에 두고, 결정 로직은 룬을 쓰지 않는 `ScrambleQueue` 가 한다
 * (그래야 node 단위 테스트가 돈다). 이 파일은 그 큐에 `$state` 저장소와 진짜 Worker 를
 * 붙여주는 껍데기다.
 *
 * `dispose()` 는 Phase 3 의 `onDestroy` 가 부른다. 여기서는 메서드만 만든다.
 */
import { browser } from '$app/environment';
import {
	ScrambleQueue,
	type Scramble,
	type ScrambleSink,
	type WorkerLike
} from '$lib/cube/scramble.js';

/**
 * Vite 표준 패턴. 이 한 줄이면 워커가 별도 청크로 갈라진다 — 수동 설정은 넣지 않는다.
 * `Worker.onmessage` 는 `MessageEvent` 를 받지만 우리는 `data` 만 본다.
 */
function spawnWorker(): WorkerLike {
	const worker = new Worker(new URL('../cube/scramble.worker.ts', import.meta.url), {
		type: 'module'
	});
	return worker as unknown as WorkerLike;
}

export class ScrambleSource implements ScrambleSink {
	/** 풀이기 초기화가 끝났는가. 이 전의 `take()` 는 `null` 이다 (FR-TR-2 "준비 중"). */
	ready = $state(false);
	queue = $state<Scramble[]>([]);
	/** 마지막 생성 실패 문구. 큐는 유지되므로 화면은 다음 스크램블로 넘어갈 수 있다. */
	error = $state<string | null>(null);

	readonly #queue: ScrambleQueue;

	constructor(spawn: () => WorkerLike = spawnWorker) {
		this.#queue = new ScrambleQueue(this, spawn);
	}

	/** SSR/프리렌더에는 `Worker` 가 없다. `+layout.ts` 가 `prerender = true` 다. */
	start(): void {
		if (!browser) return;
		this.#queue.start();
	}

	take(): Scramble | null {
		return this.#queue.take();
	}

	dispose(): void {
		this.#queue.dispose();
	}
}
