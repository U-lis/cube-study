/**
 * 릴레이 `client.js` 로더 (SPEC FR-MT-5).
 *
 * `app.html` 에 넣지 않는다. 첫 화면과 오프라인 진입이 릴레이에 묶이지 않게, 알림
 * 설정 화면에 들어올 때와 자동 동기화가 필요할 때 한 번 붙인다. bigsix 의
 * `src/lib/ui/push/relay.ts` 와 같은 방식이다.
 *
 * API 는 전부 비동기다 (`push-relay/assets/client.js`). bigsix 가 `state()` 를 동기로
 * 타입했다가 Promise 와 문자열을 비교해 켜기 버튼이 영영 잠긴 적이 있다.
 */
import { PUBLIC_PUSH_RELAY_URL } from '$env/static/public';

export type RelayState = 'unsupported' | 'denied' | 'off' | 'on';

export interface PushRelayGlobal {
	state(): Promise<RelayState>;
	enable(meta: unknown): Promise<'on'>;
	disable(): Promise<'off'>;
	subscriptionId(): Promise<string | null>;
}

declare global {
	interface Window {
		PushRelay?: PushRelayGlobal;
	}
}

export const RELAY_URL = PUBLIC_PUSH_RELAY_URL;

const SCRIPT_ID = 'push-relay-client';
let cached: Promise<PushRelayGlobal> | null = null;

/** 붙이고 전역을 돌려준다. 실패하면 캐시를 비워 다음 호출이 다시 시도한다. */
export function loadRelay(): Promise<PushRelayGlobal> {
	if (cached) return cached;
	cached = new Promise<PushRelayGlobal>((resolve, reject) => {
		if (window.PushRelay) return resolve(window.PushRelay);
		document.getElementById(SCRIPT_ID)?.remove();
		const s = document.createElement('script');
		s.id = SCRIPT_ID;
		s.src = `${RELAY_URL}/client.js`;
		s.async = true;
		s.addEventListener('load', () =>
			window.PushRelay ? resolve(window.PushRelay) : reject(new Error('network'))
		);
		s.addEventListener('error', () => {
			cached = null;
			s.remove();
			reject(Object.assign(new Error('network'), { code: 'network' }));
		});
		document.head.appendChild(s);
	});
	return cached;
}

/** `Error.code` → 사실 문구 (FR-NT-5, 연동 문서 §2 표). */
export function errorText(code: unknown): string {
	switch (code) {
		case 'unsupported':
			return '이 브라우저는 알림을 받을 수 없습니다';
		case 'denied':
			return '알림 권한이 거부되어 있습니다. 브라우저 설정에서 허용해야 합니다';
		case 'no-service-worker':
			return '앱이 아직 준비되지 않았습니다. 잠시 뒤 다시 누르세요';
		case 'origin-not-allowed':
			return '알림 서버에 이 앱이 등록되어 있지 않습니다';
		case 'push-service-not-allowed':
			return '이 브라우저의 푸시 서비스는 지원하지 않습니다';
		case 'subscribe':
			return '브라우저가 구독을 거절했습니다';
		case 'server':
			return '알림 서버 오류입니다';
		default:
			return '알림 서버에 닿지 않았습니다';
	}
}
