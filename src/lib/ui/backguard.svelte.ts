/**
 * 설치된 앱에서의 뒤로가기 처리.
 *
 * 뒤로가기가 방문 기록을 되짚으면 아까 본 케이스들을 하나씩 지나며 한참 뒤에야
 * 앱이 닫힌다. 화면 이동은 하단 탭으로만 하고, 뒤로가기는 "닫기" 하나만 뜻하게 한다.
 * 실수로 닫지 않도록 두 번 누르게 한다.
 *
 * 동작 방식은 히스토리에 감시용 항목을 하나 심어두는 것이다.
 *
 *   [기준, 감시]  ← 감시 항목에 서 있다
 *   1회 → 감시 항목이 소모되어 기준으로 내려온다. 토스트를 띄우고 그대로 둔다.
 *          이제 뒤에 아무것도 없으므로 다음 뒤로가기는 앱을 닫는다.
 *   2회 → 닫힘. (popstate 가 오지 않는다 — 브라우저가 앱을 닫아버린다)
 *   시간이 지나면 감시 항목을 다시 심어 처음 상태로 돌린다.
 *
 * 브라우저 탭에서는 켜지 않는다. 탭의 뒤로가기를 가로채는 것은 사용자를 가두는 짓이고,
 * 애초에 닫을 앱도 아니다. iOS 설치 PWA 는 시스템 뒤로가기 버튼 자체가 없어 무관하다.
 */
import { browser } from '$app/environment';
import { pushState } from '$app/navigation';

/** 두 번째 뒤로가기를 기다리는 시간 */
const WINDOW_MS = 2000;

/** 감시 항목임을 표시한다. 다른 shallow routing 상태와 섞이지 않게 한다. */
const GUARD = { __backGuard: true } as const;

function isStandalone(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		window.matchMedia('(display-mode: fullscreen)').matches ||
		window.matchMedia('(display-mode: minimal-ui)').matches ||
		// iOS Safari 의 옛 방식
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

class BackGuard {
	/** 한 번 눌러 예고된 상태. 이때 다시 누르면 닫힌다. */
	armed = $state(false);
	/** 설치된 앱에서만 켜진다. 화면이 안내 문구를 띄울지 판단할 때도 쓴다. */
	active = $state(false);

	/** 감시 항목이 스택에 있다고 믿는 상태. history.state 내부 구조에 기대지 않는다. */
	planted = $state(false);
	/** 심기가 실패한 이유. 실기기에서만 나는 문제라 화면으로 읽을 수 있어야 한다. */
	lastError = $state('');
	/** 심기를 시도한 횟수 */
	attempts = $state(0);

	#timer: ReturnType<typeof setTimeout> | undefined;

	start() {
		if (!browser || this.active || !isStandalone()) return;
		this.active = true;

		this.#plant();

		/**
		 * 화면에 돌아올 때마다 감시 항목을 다시 심는다.
		 *
		 * 뒤로가기로 앱을 나가면 감시 항목은 이미 소모된 상태다. 그 뒤 안드로이드가
		 * 페이지를 메모리에서 복구하면 하이드레이션도 afterNavigate 도 다시 일어나지
		 * 않아 다시 심을 계기가 없다. 그대로 두면 첫 뒤로가기가 예고 없이 앱을 닫는다.
		 *
		 * 복구 시점에는 예고도 무효로 본다. 나갔다 온 사이에 2초는 이미 지났다.
		 */
		const revive = () => {
			if (document.visibilityState !== 'visible') return;
			clearTimeout(this.#timer);
			this.armed = false;
			this.#plant();
		};
		document.addEventListener('visibilitychange', revive);
		window.addEventListener('pageshow', revive);

		window.addEventListener('popstate', () => {
			// 감시 항목이 소모되었다. 이제 뒤에 아무것도 없으므로 다음 뒤로가기는 닫는다.
			this.planted = false;
			this.armed = true;
			clearTimeout(this.#timer);
			this.#timer = setTimeout(() => {
				this.armed = false;
				this.#plant();
			}, WINDOW_MS);
		});
	}

	/**
	 * 감시 항목을 심는다. 같은 URL 이라 화면에는 아무 변화가 없다.
	 *
	 * 최초 로드에서는 라우터 초기화가 끝나기 전이라 pushState 가 예외를 던진다.
	 * 이때 포기하면 앱을 켜자마자 누른 첫 뒤로가기가 예고 없이 앱을 닫는다.
	 * 준비될 때까지 짧게 다시 시도한다.
	 */
	#plant(attempt = 0) {
		if (!this.active || this.planted) return;
		this.attempts = attempt + 1;
		try {
			pushState('', GUARD);
			this.planted = true;
			this.lastError = '';
		} catch (e) {
			this.lastError = e instanceof Error ? e.message : String(e);
			// 하이드레이션이 끝나면 통한다. 그래도 안 되면 조용히 접는다 —
			// 무한히 재시도하느니 뒤로가기가 평소대로 동작하는 편이 낫다.
			if (attempt < 40) setTimeout(() => this.#plant(attempt + 1), 50);
		}
	}

	/**
	 * 화면 이동 뒤에 호출한다. 예고 중이 아닌데 감시 항목이 없으면 다시 심는다.
	 * 이걸 빼먹으면 탭을 옮긴 뒤의 첫 뒤로가기가 예고 없이 앱을 닫는다.
	 */
	rearm() {
		if (this.armed) return;
		this.#plant();
	}

	dismiss() {
		this.armed = false;
	}
}

export const backGuard = new BackGuard();
