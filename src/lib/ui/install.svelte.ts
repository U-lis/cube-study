/**
 * PWA 설치 프롬프트.
 *
 * Chrome(Android)은 설치 조건을 만족하면 하단 설치 안내(mini-infobar)를 스스로
 * 띄운다. 그래서 beforeinstallprompt 에서 preventDefault() 를 부르지 않는다 —
 * 부르면 그 자동 안내가 막힌다. 이벤트는 보관해 두고, 안내를 닫은 사용자가
 * 서랍의 「앱 설치」 로 prompt() 를 부를 수 있게 한다.
 *
 * 조건 미달이거나 이미 설치됐으면 이벤트가 오지 않으므로 항목도 안 나온다.
 * iOS Safari 는 이 이벤트 자체가 없다 — 공유 시트로만 설치된다.
 */
import { browser } from '$app/environment';

type DeferredPrompt = { prompt: () => Promise<unknown> };

class Install {
	/** beforeinstallprompt 를 받아 보관 중인가. */
	available = $state(false);

	#deferred: DeferredPrompt | null = null;

	/** 부팅 때 한 번. 이벤트는 어느 화면에서든 올 수 있어 레이아웃에서 건다. */
	start(): void {
		if (!browser) return;
		window.addEventListener('beforeinstallprompt', (e) => {
			this.#deferred = e as unknown as DeferredPrompt;
			this.available = true;
		});
		window.addEventListener('appinstalled', () => {
			this.#deferred = null;
			this.available = false;
		});
	}

	/** prompt() 는 이벤트당 한 번만 쓸 수 있다 — 부르기 전에 비운다. */
	async prompt(): Promise<void> {
		const p = this.#deferred;
		if (!p) return;
		this.#deferred = null;
		this.available = false;
		try {
			await p.prompt();
		} catch {
			// 브라우저가 거부했다. 다시 띄울 방법은 없다.
		}
	}
}

export const install = new Install();
