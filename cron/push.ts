// cube-study 푸시 발송 — 진입점 (SPEC FR-CR-3, #33).
//
//   node --experimental-strip-types cron/push.ts tick --instance prod
//       1분 타이머가 부른다. 구독마다 규칙(cron/rules)을 평가해 맞은 것을 보낸다.
//
//   node --experimental-strip-types cron/push.ts send-now --instance dev \
//        --title '제목' [--body '본문'] [--url /경로] (--to s_… [--to s_…] | --all) [--dedup 키]
//       운영자 즉시 발송. 받는 쪽을 꼭 고른다 — 실수로 전체에 나가지 않게 `--all` 을 따로 둔다.
//
//   --dry-run  어느 명령이든 보낼 메시지를 찍기만 한다 (구독 목록은 읽는다).
//
// 환경변수 PUSH_RELAY_API · PUSH_RELAY_KEY — 릴레이 키 파일을 systemd 가 넘긴다.
// 수동으로 돌릴 때는:  set -a; . ~/apps/push-relay/dev/data/keys/cube-study.env; set +a
//
// 로그는 stdout → journald. 키 · 알림 내용은 남기지 않는다 (연동 문서 §7, README 로그 원칙).
// `src/` 를 import 하지 않는다 (SPEC FR-CR-1).

import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadCases } from './cases.ts';
import { decorate, plan, type Message, type SubscriptionItem } from './engine.ts';
import { listSubscriptions, readEnv, send, type Fetcher } from './relay.ts';
import { RULES } from './rules/index.ts';
import type { Rule } from './rules/types.ts';

export interface Args {
  cmd: 'tick' | 'send-now';
  instance: 'prod' | 'dev';
  dryRun: boolean;
  title?: string;
  body?: string;
  url?: string;
  to: string[];
  all: boolean;
  dedup?: string;
}

export function parseArgs(argv: readonly string[]): Args {
  const cmd = argv[0];
  if (cmd !== 'tick' && cmd !== 'send-now') {
    throw new Error(`명령은 tick 또는 send-now 다: '${cmd ?? ''}'`);
  }
  const a: Args = { cmd, instance: 'prod', dryRun: false, to: [], all: false };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    const v = (): string => {
      const x = argv[++i];
      if (x === undefined) throw new Error(`${k} 에 값이 없다`);
      return x;
    };
    switch (k) {
      case '--instance': {
        const x = v();
        if (x !== 'prod' && x !== 'dev') throw new Error(`--instance 는 prod 또는 dev: '${x}'`);
        a.instance = x;
        break;
      }
      case '--dry-run':
        a.dryRun = true;
        break;
      case '--title':
        a.title = v();
        break;
      case '--body':
        a.body = v();
        break;
      case '--url':
        a.url = v();
        break;
      case '--to':
        a.to.push(v());
        break;
      case '--all':
        a.all = true;
        break;
      case '--dedup':
        a.dedup = v();
        break;
      default:
        throw new Error(`모르는 인자: ${k}`);
    }
  }
  if (a.cmd === 'send-now') {
    if (!a.title?.trim()) throw new Error('send-now 에는 --title 이 있어야 한다');
    if (a.all === (a.to.length > 0)) throw new Error('send-now 는 --to 와 --all 중 하나만 준다');
    if (a.url !== undefined && !a.url.startsWith('/')) throw new Error('--url 은 / 로 시작하는 앱 경로다');
  }
  return a;
}

/** 보내기 전에 만들어 로그에 남긴다 — 응답을 잃으면 send-log 로 찾는다 (연동 문서 §7). */
export const requestId = (cmd: string, now: Date): string =>
  `cube-${cmd}-${now.toISOString().slice(0, 16).replace(/[^0-9T]/g, '')}-${randomBytes(3).toString('hex')}`;

export function sendNowMessages(a: Args, items: readonly SubscriptionItem[], now: Date): Message[] {
  const to = a.all ? items.map((s) => s.id) : a.to;
  // dedupKey 가 없으면 같은 명령을 두 번 돌릴 때 두 번 간다. 운영자가 그걸 원할 수도 있으므로
  // 기본값은 "그 분" 이다 — 실수로 연달아 누른 것만 막는다.
  const dedupKey = a.dedup ?? `now:${now.toISOString().slice(0, 16)}`;
  const notification = decorate({
    title: a.title!.trim(),
    ...(a.body ? { body: a.body } : {}),
    ...(a.url ? { url: a.url } : {}),
  });
  return to.map((id) => ({ to: id, dedupKey, notification }));
}

interface Logger {
  log(msg: string): void;
}

export interface RunOptions {
  argv: readonly string[];
  env: NodeJS.ProcessEnv;
  now: Date;
  fetch?: Fetcher;
  logger?: Logger;
  rules?: readonly Rule[];
  casesPath?: string;
}

export async function run(o: RunOptions): Promise<void> {
  const a = parseArgs(o.argv);
  const env = readEnv(o.env);
  const f = o.fetch ?? fetch;
  const log = o.logger ?? console;
  const id = requestId(a.cmd, o.now);
  log.log(`[push] cmd=${a.cmd} instance=${a.instance} requestId=${id}${a.dryRun ? ' dry-run' : ''}`);

  // send-now --to 는 구독 목록이 필요 없다. 그 밖에는 읽는다.
  const items = a.cmd === 'send-now' && !a.all ? [] : await listSubscriptions(env, f);
  if (items.length > 0 || a.cmd === 'tick') log.log(`[push] subscriptions=${items.length}`);

  let messages: Message[];
  if (a.cmd === 'tick') {
    const p = plan(items, o.rules ?? RULES, { now: o.now, cases: loadCases(o.casesPath) });
    for (const n of p.notes) log.log(`[push] ${n}`);
    messages = p.messages;
  } else {
    messages = sendNowMessages(a, items, o.now);
  }

  if (messages.length === 0) {
    log.log('[push] nothing to send');
    return;
  }
  if (a.dryRun) {
    for (const m of messages) log.log(`[push] would send: ${JSON.stringify(m)}`);
    return;
  }

  log.log(`[push] sending ${messages.length}`);
  const results = await send(env, id, messages, f);
  let sent = 0;
  for (const r of results) {
    if (r.status === 'sent') {
      sent++;
      continue;
    }
    // sent 가 아닌 것은 전부 남긴다. failed 는 다음 tick 에 같은 dedupKey 로 다시 맞는다.
    const extra = [r.reason && `reason=${r.reason}`, r.pushStatus !== undefined && `pushStatus=${r.pushStatus}`]
      .filter(Boolean)
      .join(' ');
    log.log(`[push] result: to=${r.to} status=${r.status}${extra ? ' ' + extra : ''}`);
  }
  log.log(`[push] sent=${sent}/${results.length}`);
}

// `node cron/push.ts …` 로 돌 때만. vitest 가 import 할 때는 돌지 않는다.
function isEntry(): boolean {
  try {
    return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (isEntry()) {
  run({ argv: process.argv.slice(2), env: process.env, now: new Date() }).catch((e) => {
    console.error(`[push] error: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
}
