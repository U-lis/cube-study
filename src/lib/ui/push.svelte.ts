/**
 * 알림 상태 (SPEC FR-NT · FR-MT).
 *
 * **켜짐 여부의 정본은 릴레이다** (`PushRelay.state()`, FR-NT-4). 여기 저장하는 것은
 * 시각과 "마지막으로 보낸 meta" 뿐이다. 후자가 있으면 켜 둔 적이 있다는 **짐작**이고,
 * 서랍의 값 표시와 자동 동기화가 그것으로 릴레이를 부를지 정한다 — 켠 적 없는
 * 기기에서 `client.js` 를 받으러 나가지 않는다 (FR-MT-5).
 *
 * 짐작이 틀리면(다른 곳에서 권한을 거뒀다) 릴레이에 물어본 순간 바로잡는다.
 */
import { browser } from '$app/environment';
import { buildMeta, DEFAULT_DAILY, isHHMM, localDate, type PushMeta } from '$lib/push/meta.js';
import { errorText, loadRelay, type RelayState } from '$lib/push/relay.js';

const KEY_DAILY = 'push.daily';
const KEY_SENT = 'push.sentMeta';
const KEY_LAST_QUIZ = 'push.lastQuiz';

function get(key: string): string | null {
	if (!browser) return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function put(key: string, v: string | null) {
	try {
		if (v === null) localStorage.removeItem(key);
		else localStorage.setItem(key, v);
	} catch {
		// 저장이 막혀도 이번 세션은 돈다
	}
}

const tz = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export type PushView = 'loading' | RelayState;

class Push {
	/** 매일 퀴즈 시각. 꺼져 있어도 남겨 둔다 — 다시 켤 때 그 시각이다. */
	daily = $state<string>(isHHMM(get(KEY_DAILY)) ? (get(KEY_DAILY) as string) : DEFAULT_DAILY);
	/** 마지막으로 릴레이에 보낸 meta 의 직렬화. 있으면 켜 둔 적이 있다. */
	sentMeta = $state<string | null>(get(KEY_SENT));
	lastQuiz = $state<string | null>(get(KEY_LAST_QUIZ));

	/** 릴레이에 물어본 결과. 물어보기 전에는 `loading`. */
	view = $state<PushView>('loading');
	busy = $state(false);
	/** 마지막 실패의 사실 문구. 성공하면 비운다. */
	error = $state('');

	/** 짐작으로 켜져 있는가. 서랍의 값 표시가 쓴다 — 릴레이를 부르지 않는다. */
	get assumedOn(): boolean {
		return this.sentMeta !== null;
	}

	meta(): PushMeta {
		return buildMeta(tz(), this.daily, this.lastQuiz ? { lastQuiz: this.lastQuiz } : {});
	}

	#setSent(v: string | null) {
		this.sentMeta = v;
		put(KEY_SENT, v);
	}

	/** 설정 화면이 들어올 때. 릴레이에 지금 상태를 묻는다. */
	async refresh() {
		this.error = '';
		try {
			const relay = await loadRelay();
			this.view = await relay.state();
			if (this.view !== 'on' && this.sentMeta !== null) this.#setSent(null);
		} catch (e) {
			this.view = 'off';
			this.error = errorText((e as { code?: unknown }).code);
		}
	}

	/** 켬. 사용자 제스처 안에서 부른다 — 권한을 묻는다 (FR-NT-3). */
	async enable() {
		if (this.busy) return;
		this.busy = true;
		this.error = '';
		try {
			const relay = await loadRelay();
			const m = this.meta();
			await relay.enable(m);
			this.#setSent(JSON.stringify(m));
			this.view = 'on';
		} catch (e) {
			const code = (e as { code?: unknown }).code;
			this.error = errorText(code);
			if (code === 'denied' || code === 'unsupported') this.view = code;
		} finally {
			this.busy = false;
		}
	}

	async disable() {
		if (this.busy) return;
		this.busy = true;
		this.error = '';
		try {
			const relay = await loadRelay();
			await relay.disable();
			this.#setSent(null);
			this.view = 'off';
		} catch (e) {
			this.error = errorText((e as { code?: unknown }).code);
		} finally {
			this.busy = false;
		}
	}

	/** 시각을 바꾼다. 켜져 있으면 곧바로 다시 보낸다 (FR-NT-7). */
	async setDaily(t: string) {
		if (!isHHMM(t) || t === this.daily) return;
		this.daily = t;
		put(KEY_DAILY, t);
		await this.sync();
	}

	/**
	 * 코너 퀴즈를 채점했다. 날짜가 바뀔 때만 meta 가 바뀐다 (FR-MT-4) — 채점마다
	 * 릴레이를 때리지 않는다.
	 */
	noteQuiz(now = new Date()) {
		const today = localDate(now, tz());
		if (this.lastQuiz === today) return;
		this.lastQuiz = today;
		put(KEY_LAST_QUIZ, today);
		void this.sync();
	}

	/**
	 * 자동 동기화 (FR-MT-3). 켜 둔 적이 있고 meta 가 달라졌을 때만 보낸다.
	 * 권한이 이미 있으므로 제스처 없이 `enable` 해도 된다. 실패는 조용히 넘긴다.
	 */
	async sync() {
		if (!browser || this.sentMeta === null) return;
		const m = JSON.stringify(this.meta());
		if (m === this.sentMeta) return;
		try {
			const relay = await loadRelay();
			if ((await relay.state()) !== 'on') {
				this.#setSent(null);
				return;
			}
			await relay.enable(JSON.parse(m));
			this.#setSent(m);
		} catch {
			// 오프라인이면 다음 기회에. 짐작은 그대로 둔다
		}
	}
}

export const push = new Push();
