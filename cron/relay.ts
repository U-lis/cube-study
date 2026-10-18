// 릴레이 cron 창구 (연동 문서 §6). 홈서버 안 loopback · API 키.

export type Fetcher = typeof fetch;

export interface Env {
  api: string;
  key: string;
}

/** 키 파일(`~/apps/push-relay/<env>/data/keys/cube-study.env`)이 systemd 로 넘긴 값. */
export function readEnv(env: NodeJS.ProcessEnv): Env {
  const api = env.PUSH_RELAY_API?.trim();
  const key = env.PUSH_RELAY_KEY?.trim();
  if (!api) throw new Error('PUSH_RELAY_API 가 없다 (키 파일을 EnvironmentFile 로 넘겼는가)');
  if (!key) throw new Error('PUSH_RELAY_KEY 가 없다');
  return { api: api.replace(/\/+$/, ''), key };
}

export interface SendResult {
  to: string;
  status: 'sent' | 'suppressed' | 'not-found' | 'gone' | 'failed';
  reason?: string;
  pushStatus?: number;
}

async function fail(what: string, r: Response): Promise<never> {
  const text = await r.text().catch(() => '');
  // 응답 본문은 오류 코드 JSON 이다. 키는 요청 헤더에만 있으므로 여기 실리지 않는다.
  throw new Error(`${what}: ${r.status}${text ? ' ' + text.slice(0, 200) : ''}`);
}

/** `next` 가 null 이 될 때까지 이어 받는다. */
export async function listSubscriptions(env: Env, f: Fetcher): Promise<{ id: string; meta: unknown }[]> {
  const out: { id: string; meta: unknown }[] = [];
  let after: string | null = null;
  for (let i = 0; i < 1000; i++) {
    const qs = after === null ? '' : `?after=${encodeURIComponent(after)}`;
    const r = await f(`${env.api}/v1/subscriptions${qs}`, {
      headers: { authorization: `Bearer ${env.key}` },
    });
    if (!r.ok) await fail('구독 목록', r);
    const body = (await r.json()) as { items?: { id: string; meta: unknown }[]; next?: string | null };
    out.push(...(body.items ?? []));
    if (typeof body.next !== 'string' || body.next === '') break;
    after = body.next;
  }
  return out;
}

export async function send(
  env: Env,
  requestId: string,
  messages: unknown[],
  f: Fetcher,
): Promise<SendResult[]> {
  const r = await f(`${env.api}/v1/send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requestId, messages }),
  });
  if (!r.ok) await fail('발송', r);
  return ((await r.json()) as { results: SendResult[] }).results;
}
