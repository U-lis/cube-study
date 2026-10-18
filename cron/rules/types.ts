// 규칙 — "이 구독에 지금 보낼 것이 있는가" 하나를 답한다 (SPEC FR-CR-4).
//
// 매 tick(1분) 모든 구독에 모든 규칙을 평가한다. 규칙은 I/O 가 없는 순수 함수이고
// 현재 시각은 `ctx.now` 로만 받는다 — 테스트가 시각을 마음대로 고른다.
//
// 같은 알림이 매분 다시 나가지 않게 하는 것은 **dedupKey** 다. 릴레이가 같은
// (구독, dedupKey) 를 8일 동안 한 번만 보낸다. 규칙은 "그 알림" 을 가리키는 키를
// 낸다 — 하루 한 번이면 날짜를, 사건 한 번이면 사건 이름을 넣는다.

import type { CaseInfo } from '../cases.ts';
import type { Meta } from '../meta.ts';

export interface Notification {
  title: string;
  body?: string;
  /** `/` 로 시작하는 앱 경로. 릴레이가 앱 출처 기준으로 푼다. */
  url?: string;
  tag?: string;
}

export interface Ctx {
  now: Date;
  cases: readonly CaseInfo[];
}

export interface Sub {
  id: string;
  meta: Meta;
}

export interface Hit {
  dedupKey: string;
  notification: Notification;
}

export interface Rule {
  /** 로그와 dedupKey 머리에 쓴다. 소문자·숫자·`-`. */
  id: string;
  /** 주기 규칙인가 조건 규칙인가. 로그에만 쓴다. */
  kind: 'periodic' | 'condition';
  evaluate(sub: Sub, ctx: Ctx): Hit | null;
}
