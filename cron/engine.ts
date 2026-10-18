// 규칙 평가 — 구독 × 규칙 → 보낼 메시지 (SPEC FR-CR-4, 5, 8). I/O 없음.

import { validateMeta } from './meta.ts';
import type { Ctx, Notification, Rule } from './rules/types.ts';

/** 릴레이 `/v1/subscriptions` 의 한 항목. meta 는 검증 전이다. */
export interface SubscriptionItem {
  id: string;
  meta: unknown;
}

/** `push-relay/schema/cron-v1/send-request.json` 의 `#/$defs/message`. */
export interface Message {
  to: string;
  dedupKey?: string;
  notification: Notification & { icon: string; badge: string };
}

/**
 * 모든 알림에 붙이는 그림 (FR-IC). `badge` 가 없으면 Android 상태바에 종이 뜬다.
 * 앱 경로라 릴레이가 앱 출처 기준으로 푼다 (스키마 `link`).
 */
export const ICON = '/icon-192.png';
export const BADGE = '/badge-96.png';

/** 알림 하나의 JSON 상한 (연동 문서 §6). 넘으면 요청 전체가 400 이다. */
export const NOTIFICATION_BYTE_LIMIT = 3072;

export const decorate = (n: Notification): Message['notification'] => ({ ...n, icon: ICON, badge: BADGE });

export const notificationBytes = (n: Message['notification']): number =>
  Buffer.byteLength(JSON.stringify(n), 'utf8');

export interface Plan {
  messages: Message[];
  /** 로그에 남길 사정. 구독 ID 와 규칙 ID 만 — 내용은 남기지 않는다. */
  notes: string[];
}

export function plan(items: readonly SubscriptionItem[], rules: readonly Rule[], ctx: Ctx): Plan {
  const messages: Message[] = [];
  const notes: string[] = [];
  for (const item of items) {
    const meta = validateMeta(item.meta);
    if (!meta) {
      notes.push(`skip invalid meta: id=${item.id}`);
      continue;
    }
    for (const rule of rules) {
      let hit;
      try {
        hit = rule.evaluate({ id: item.id, meta }, ctx);
      } catch (e) {
        // 규칙 하나의 버그로 다른 규칙·구독이 멈추지 않는다
        notes.push(`rule error: rule=${rule.id} id=${item.id} ${(e as Error).message}`);
        continue;
      }
      if (!hit) continue;
      const notification = decorate(hit.notification);
      const bytes = notificationBytes(notification);
      if (bytes > NOTIFICATION_BYTE_LIMIT) {
        notes.push(`skip oversized: rule=${rule.id} id=${item.id} bytes=${bytes}`);
        continue;
      }
      messages.push({ to: item.id, dedupKey: hit.dedupKey, notification });
      notes.push(`hit: rule=${rule.id} kind=${rule.kind} id=${item.id}`);
    }
  }
  return { messages, notes };
}
