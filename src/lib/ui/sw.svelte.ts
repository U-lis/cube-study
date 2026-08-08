/**
 * 서비스워커 등록과 업데이트.
 *
 * 설치된 PWA 는 홈 버튼으로 나갔다 들어와도 메모리에서 복구된다. 새 탐색이
 * 일어나지 않으므로 브라우저가 sw.js 를 다시 확인할 계기가 없다. 그대로 두면
 * 앱을 완전히 종료했다 켜기 전까지 옛 버전에 갇힌다.
 *
 * 그래서 화면에 돌아올 때마다, 그리고 주기적으로 직접 물어본다.
 */
import { browser, dev } from '$app/environment';

/** 새로고침 직후 "업데이트했다"고 알리기 위한 표식. 새로고침을 건너뛰고 살아남아야 한다. */
const FLAG = 'sw.justUpdated';
/** 화면이 켜져 있는 동안의 확인 주기. 하루 종일 열어두는 경우를 위한 것이다. */
const POLL_MS = 30 * 60 * 1000;

class ServiceWorkerState {
	/** 방금 새 버전으로 갱신되었는가. 토스트를 띄우는 쪽이 읽는다. */
	justUpdated = $state(false);
	/** 수동 확인 중인가 */
	checking = $state(false);
	/** 수동 확인 결과 문구. 없으면 표시하지 않는다. */
	message = $state('');

	#reg: ServiceWorkerRegistration | null = null;

	constructor() {
		if (!browser) return;
		try {
			if (sessionStorage.getItem(FLAG)) {
				sessionStorage.removeItem(FLAG);
				this.justUpdated = true;
			}
		} catch {
			// 프라이빗 모드 등에서 sessionStorage 가 막혀 있어도 앱은 돌아야 한다
		}
	}

	async register() {
		if (!browser || dev || !('serviceWorker' in navigator)) return;

		/**
		 * 새 워커가 제어를 넘겨받으면 한 번 새로고침한다.
		 *
		 * autoUpdate(skipWaiting + clientsClaim)는 워커만 바꾼다. 떠 있는 화면은
		 * 여전히 옛 JS 라, 새로고침하지 않으면 옛 버전이 계속 보인다. 게다가 배포가
		 * 옛 청크를 지우므로 그 화면에서 지연 로드가 404 날 수 있다.
		 *
		 * 최초 등록 때도 controllerchange 가 오는데 그때는 새로고침할 이유가 없다.
		 * controller 가 이미 있었는지로 구분한다.
		 */
		const hadController = !!navigator.serviceWorker.controller;
		let reloading = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (!hadController || reloading) return;
			reloading = true;
			try {
				sessionStorage.setItem(FLAG, '1');
			} catch {
				// 표식을 못 남겨도 갱신 자체는 진행한다
			}
			location.reload();
		});

		// vite-pwa 가 만드는 registerSW.js 는 './sw.js' 상대경로를 써서 /anchors 같은
		// 하위 경로로 첫 진입하면 404 가 난다. 절대경로로 직접 등록한다.
		this.#reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void this.#update();
		});
		setInterval(() => {
			if (document.visibilityState === 'visible') void this.#update();
		}, POLL_MS);
	}

	async #update() {
		try {
			await this.#reg?.update();
		} catch {
			// 오프라인이면 실패한다. 다음 기회에 다시 본다.
		}
	}

	/**
	 * 사용자가 직접 누르는 확인. 자동 갱신이 막혔을 때 빠져나올 구멍이다.
	 * 새 버전이 있으면 controllerchange 가 뒤따르며 화면이 새로고침된다.
	 */
	async checkNow() {
		if (!browser || !('serviceWorker' in navigator)) return;
		this.checking = true;
		this.message = '';
		try {
			const reg = this.#reg ?? (await navigator.serviceWorker.getRegistration()) ?? null;
			this.#reg = reg;
			if (!reg) {
				this.message = '서비스워커가 등록되어 있지 않습니다';
				return;
			}
			await reg.update();
			// 새 워커가 잡혔으면 곧 controllerchange 가 오고 화면이 새로고침된다.
			this.message = reg.installing || reg.waiting ? '새 버전을 받는 중' : '최신 버전입니다';
		} catch {
			this.message = '확인하지 못했습니다 (오프라인?)';
		} finally {
			this.checking = false;
		}
	}

	dismiss() {
		this.justUpdated = false;
	}
}

export const sw = new ServiceWorkerState();
