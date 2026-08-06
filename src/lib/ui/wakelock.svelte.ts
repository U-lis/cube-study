/**
 * 화면 자동 꺼짐 방지 (Screen Wake Lock).
 *
 * 공식을 보면서 큐브를 돌리는 동안 손이 화면에 닿지 않아 화면이 꺼진다.
 *
 * 잠금은 화면이 가려지면 브라우저가 알아서 해제한다. 돌아왔을 때 다시 잡지 않으면
 * 한 번 꺼진 뒤로는 영영 안 걸린다 — visibilitychange 로 다시 잡는다.
 *
 * 배터리를 먹는 기능이라 기본은 꺼짐이고, 켠 상태는 저장한다.
 */
import { browser } from '$app/environment';

const KEY = 'ui.keepAwake';

interface WakeLockSentinelLike {
	released: boolean;
	release: () => Promise<void>;
	addEventListener: (type: 'release', listener: () => void) => void;
}

function api(): { request: (t: 'screen') => Promise<WakeLockSentinelLike> } | null {
	if (!browser) return null;
	const wl = (navigator as Navigator & { wakeLock?: unknown }).wakeLock;
	return (wl as { request: (t: 'screen') => Promise<WakeLockSentinelLike> }) ?? null;
}

class WakeLock {
	/** 브라우저가 이 기능을 지원하는가. 아니면 토글 자체를 보여주지 않는다. */
	supported = $state(false);
	/** 사용자가 켜두겠다고 한 상태 */
	enabled = $state(false);
	/** 실제로 잠금이 잡혀 있는가. 켜달라고 해도 거부될 수 있다 (절전 모드 등). */
	held = $state(false);

	#sentinel: WakeLockSentinelLike | null = null;

	constructor() {
		if (!browser) return;
		this.supported = !!api();
		try {
			this.enabled = localStorage.getItem(KEY) === '1';
		} catch {
			// 저장소가 막혀 있어도 기능 자체는 쓸 수 있어야 한다
		}
	}

	start() {
		if (!this.supported) return;
		// 화면이 가려지면 브라우저가 잠금을 놓는다. 돌아오면 다시 잡는다.
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible' && this.enabled) void this.#acquire();
			else this.held = false;
		});
		if (this.enabled) void this.#acquire();
	}

	async toggle() {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY, this.enabled ? '1' : '0');
		} catch {
			// 저장에 실패해도 이번 세션에는 적용된다
		}
		if (this.enabled) await this.#acquire();
		else await this.#release();
	}

	async #acquire() {
		if (!this.supported || this.#sentinel) return;
		try {
			const s = await api()!.request('screen');
			this.#sentinel = s;
			this.held = true;
			// 절전 모드 진입 등으로 브라우저가 놓을 수 있다. 상태를 따라간다.
			s.addEventListener('release', () => {
				this.#sentinel = null;
				this.held = false;
			});
		} catch {
			// 배터리 절약 모드 등에서 거부된다. 토글은 켜진 채로 두고 다음 기회에 다시 잡는다.
			this.held = false;
		}
	}

	async #release() {
		const s = this.#sentinel;
		this.#sentinel = null;
		this.held = false;
		try {
			await s?.release();
		} catch {
			// 이미 해제된 경우
		}
	}
}

export const wakeLock = new WakeLock();
