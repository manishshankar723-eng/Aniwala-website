/**
 * chat — the website's automated assistant.
 *
 * CHATBOT-PLAN.md is the design and the reasons; section 0 is the security
 * review this code follows. In one paragraph: the model has no tools, no data
 * beyond public page content, and no secrets, so an injection wins nothing.
 * What this function adds around it is everything a model cannot be trusted
 * to do — who may ask (Turnstile, then a signed session), how much (limits in
 * Postgres, reserved BEFORE each call), what history is genuine (a signed
 * chain), what the visitor typed that must not travel (the PII scrub), and
 * what of the reply may reach the page (`parseReply`).
 *
 * Deploy:  supabase functions deploy chat --no-verify-jwt
 *
 * `--no-verify-jwt` because visitors have no Supabase session, as for
 * `submit`. The authorisation is the Turnstile token or the session token.
 *
 * NEVER LOG MESSAGE TEXT. Function logs sit outside RLS and outside every
 * retention rule in this repo. Ids, counts, modes and token usage only.
 */
import { allowedOrigin, corsHeaders as cors } from '../_shared/util.ts';
import { clientIp, verifyTurnstile } from '../_shared/turnstile.ts';
import {
  LIMITS,
  REFUSAL,
  buildIndex,
  cleanMessage,
  hashAddr,
  mintSession,
  parseReply,
  selectConcepts,
  signTurn,
  validateKnowledge,
  verifyHistory,
  verifySession,
  type KnowledgeIndex,
  type Reply,
} from './guards.ts';
import { HANDOFF, buildRequest } from './prompt.ts';
import { accessToken, generate, parseServiceAccount, type Usage, type VertexConfig } from './vertex.ts';

const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) },
  });

const nowSec = () => Math.floor(Date.now() / 1000);

/* ------------------------------------------------------------------ */
/* The body, capped BEFORE it is parsed                                */
/* ------------------------------------------------------------------ */

async function readLimited(msg: Request | Response, max: number): Promise<string | null> {
  if (Number(msg.headers.get('content-length') ?? 0) > max) return null;
  const reader = msg.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return new TextDecoder().decode(all);
}

/* ------------------------------------------------------------------ */
/* Knowledge: fetched from the FIXED site, never from the request      */
/* ------------------------------------------------------------------ */

/*
 * SITE_URL and nothing else. The request's Origin may be the staging site
 * (EXTRA_ORIGINS), and a preview build is not what the live bot answers from.
 * Ten minutes fresh; a failed refresh keeps the last good copy and tries again
 * in a minute. With no good copy at all, callers answer with a fixed hand-off.
 */
const KNOWLEDGE_TTL_MS = 10 * 60 * 1000;
let kb: { index: KnowledgeIndex; at: number } | null = null;

async function knowledge(): Promise<KnowledgeIndex | null> {
  if (kb && Date.now() - kb.at < KNOWLEDGE_TTL_MS) return kb.index;
  const site = (Deno.env.get('SITE_URL') ?? 'https://aniwala.com').replace(/\/$/, '');
  try {
    const res = await fetch(`${site}/chat/knowledge.json`, {
      signal: AbortSignal.timeout(5000),
      // A redirect off the site is not a knowledge file.
      redirect: 'error',
    });
    if (!res.ok) throw new Error(`knowledge ${res.status}`);
    const text = await readLimited(res, 1024 * 1024);
    if (text === null) throw new Error('knowledge over 1MB');
    const concepts = validateKnowledge(JSON.parse(text));
    if (!concepts) throw new Error('knowledge failed validation');
    kb = { index: buildIndex(concepts), at: Date.now() };
  } catch (err) {
    console.error('chat knowledge refresh failed:', String(err));
    if (kb) kb.at = Date.now() - KNOWLEDGE_TTL_MS + 60_000;
  }
  return kb?.index ?? null;
}

/* ------------------------------------------------------------------ */
/* Postgres: the limits and the refused-turn log                        */
/* ------------------------------------------------------------------ */

type Take = 'ok' | 'sessions' | 'address' | 'session' | 'budget' | 'invalid' | 'error';

/**
 * Reserve `tokens` for one model call. FAILS CLOSED: if the database cannot
 * be asked, the call is not made. A bot that is briefly down costs nothing; a
 * budget that stops being checked is the one thing this must not allow.
 */
async function take(p: {
  addr: string;
  sid: string;
  kind: 'message' | 'retry';
  newSession: boolean;
  tokens: number;
}): Promise<Take> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const daily = Number(Deno.env.get('CHAT_DAILY_TOKENS'));
  try {
    const res = await fetch(`${url}/rest/v1/rpc/chat_take`, {
      method: 'POST',
      headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_addr: p.addr,
        p_sid: p.sid,
        p_kind: p.kind,
        p_new_session: p.newSession,
        p_tokens: p.tokens,
        p_daily_tokens: Number.isFinite(daily) && daily > 0 ? Math.floor(daily) : 2_000_000,
      }),
    });
    if (!res.ok) {
      console.error(`chat_take failed: ${res.status}`);
      return 'error';
    }
    return (await res.json()) as Take;
  } catch (err) {
    console.error('chat_take unreachable:', String(err));
    return 'error';
  }
}

/**
 * Best effort: what each model call cost, for `npm run chat:usage` — which is
 * how anyone checks the implicit cache is hitting. NUMBERS ONLY: no address,
 * no session id, no text, so the table can be kept and read freely.
 */
async function recordCalls(
  calls: Array<{ kind: 'message' | 'retry'; estimate: number; usage?: Usage }>,
  mode: 'selective' | 'full',
  fallback: boolean,
  outcome: string
) {
  if (!calls.length) return;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null);
  try {
    const res = await fetch(`${url}/rest/v1/chat_calls`, {
      method: 'POST',
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(
        calls.map((c) => ({
          kind: c.kind,
          mode,
          fallback,
          outcome: outcome.slice(0, 40),
          estimate: n(c.estimate),
          prompt_tokens: n(c.usage?.promptTokenCount),
          cached_tokens: n(c.usage?.cachedContentTokenCount) ?? (c.usage ? 0 : null),
          output_tokens: n(c.usage?.candidatesTokenCount),
          thought_tokens: n(c.usage?.thoughtsTokenCount) ?? (c.usage ? 0 : null),
        }))
      ),
    });
    if (!res.ok) console.error(`chat_calls insert failed: ${res.status}`);
  } catch (err) {
    console.error('chat_calls insert unreachable:', String(err));
  }
}

/** Best effort: a refused turn, already scrubbed, for the weekly review. */
async function flag(addr: string, sid: string, reason: 'off_topic' | 'bad_reply', question: string) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  try {
    const res = await fetch(`${url}/rest/v1/chat_flags`, {
      method: 'POST',
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ addr, sid, reason, question: question.slice(0, LIMITS.message) }),
    });
    if (!res.ok) console.error(`chat flag insert failed: ${res.status}`);
  } catch (err) {
    console.error('chat flag insert unreachable:', String(err));
  }
}

/* ------------------------------------------------------------------ */

Deno.serve(async (req) => {
  const origin = allowedOrigin(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json(405, { error: 'method' }, origin);
  // Stops other websites driving this from a visitor's browser. It is not
  // authentication — a script sets any Origin it likes.
  if (!origin) return json(403, { error: 'forbidden' }, null);

  const secret = Deno.env.get('CHAT_SECRET') ?? '';
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
  const sa = parseServiceAccount(Deno.env.get('GCP_SA_KEY') ?? '');
  const vertex: VertexConfig = {
    project: Deno.env.get('GCP_PROJECT_ID') ?? '',
    region: Deno.env.get('GCP_REGION') ?? 'global',
    model: Deno.env.get('GEMINI_MODEL') ?? '',
  };
  /* CHAT_SECRET and nothing else — never MODERATION_SECRET or BOOKING_SECRET,
     which sign approve and confirm links (CHATBOT-PLAN.md R1). */
  if (
    secret.length < 32 ||
    !turnstileSecret ||
    !sa ||
    !vertex.project ||
    !vertex.model ||
    !Deno.env.get('SUPABASE_URL') ||
    !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  ) {
    console.error('chat is not configured: check CHAT_SECRET, TURNSTILE_SECRET_KEY, GCP_*, GEMINI_MODEL');
    return json(503, { error: 'unavailable', answer: HANDOFF.failed, handoff: true }, origin);
  }

  const raw = await readLimited(req, LIMITS.bodyBytes);
  if (raw === null) return json(413, { error: 'too_large' }, origin);
  let body: { message?: unknown; session?: unknown; turnstile?: unknown; history?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'bad_request' }, origin);
  }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad_request' }, origin);

  const ip = clientIp(req);

  /* ---------- who: a session, or a fresh Turnstile solve that mints one ---------- */
  let sid = await verifySession(body.session, secret, nowSec());
  let newSession: string | undefined;
  if (!sid) {
    const token = typeof body.turnstile === 'string' ? body.turnstile : '';
    if (!token) return json(401, { error: 'session' }, origin);
    // A new session starts with no history — anything else was signed for another sid.
    if (Array.isArray(body.history) && body.history.length) return json(400, { error: 'history' }, origin);
    const verdict = await verifyTurnstile({ token, secret: turnstileSecret, origin, ip, action: 'chat' });
    if (!verdict.ok) {
      return verdict.reason === 'unreachable'
        ? json(503, { error: 'unavailable', answer: HANDOFF.failed, handoff: true }, origin)
        : json(403, { error: 'verification' }, origin);
    }
    const minted = await mintSession(secret, nowSec());
    sid = minted.sid;
    newSession = minted.token;
  }

  /* ---------- what: a genuine history and a real message ---------- */
  const history = await verifyHistory(secret, sid, body.history);
  if (!history) return json(400, { error: 'history' }, origin);
  const question = cleanMessage(body.message);
  if (!question) return json(400, { error: 'message' }, origin);

  const index = await knowledge();
  if (!index) return json(503, { error: 'unavailable', answer: HANDOFF.failed, handoff: true, session: newSession }, origin);

  const addr = await hashAddr(ip, secret);
  const mode = Deno.env.get('CHAT_KNOWLEDGE_MODE') === 'full' ? 'full' : 'selective';
  const last = history.at(-1);
  const selection =
    mode === 'full'
      ? { ids: [...index.ids].sort(), fallback: true }
      : selectConcepts(index, { question, previous: last?.q, loaded: last?.ids });

  /* ---------- the model, behind a reservation ---------- */
  const deadline = Date.now() + 15_000;
  const usages: Usage[] = [];
  /* One row per model call for chat_calls — numbers only (see recordCalls). */
  const calls: Array<{ kind: 'message' | 'retry'; estimate: number; usage?: Usage }> = [];
  const log = { mode, fallback: selection.fallback, retried: false, ids: selection.ids.length, estimate: 0, outcome: '' };

  async function ask(ids: string[], kind: 'message' | 'retry'): Promise<Reply | null | Take> {
    const request = buildRequest(index!, ids, history!, question!);
    log.estimate += request.estimate;
    const t = await take({ addr, sid: sid!, kind, newSession: Boolean(newSession), tokens: request.estimate });
    if (t !== 'ok') return t;
    const call: { kind: 'message' | 'retry'; estimate: number; usage?: Usage } = { kind, estimate: request.estimate };
    calls.push(call);
    try {
      const token = await accessToken(sa!);
      const out = await generate(vertex, token, request, AbortSignal.timeout(Math.max(deadline - Date.now(), 1000)));
      usages.push(out.usage);
      call.usage = out.usage;
      return parseReply(out.text, index!);
    } catch (err) {
      console.error('chat model call failed:', String(err));
      return null;
    }
  }

  let ids = selection.ids;
  let reply = await ask(ids, 'message');

  if (typeof reply === 'string') {
    log.outcome = `limit:${reply}`;
    console.log(JSON.stringify({ evt: 'chat', ...log }));
    const answer =
      reply === 'budget' || reply === 'error'
        ? HANDOFF.busy
        : reply === 'address'
          ? HANDOFF.daily
          : HANDOFF.limit;
    return json(429, { error: 'limit', reason: reply, answer, handoff: true, session: newSession }, origin);
  }

  /* One model-requested retry, never more, and only for ids that are real. */
  if (reply && reply.onTopic && reply.need.length && mode === 'selective') {
    const extra = reply.need.filter((id) => !ids.includes(id));
    if (extra.length && Date.now() < deadline - 3000) {
      const wider = [...new Set([...ids, ...extra])].sort();
      const second = await ask(wider, 'retry');
      log.retried = true;
      if (second && typeof second !== 'string') {
        reply = second;
        ids = wider;
      }
    }
  }

  let answer: string;
  let links: string[] = [];
  let action: Reply['action'] = 'none';
  if (!reply) {
    answer = HANDOFF.failed;
    log.outcome = 'bad_reply';
    await flag(addr, sid, 'bad_reply', question);
  } else if (!reply.onTopic) {
    answer = REFUSAL;
    log.outcome = 'off_topic';
    await flag(addr, sid, 'off_topic', question);
  } else {
    ({ answer, links, action } = reply);
    log.outcome = 'answered';
  }

  /* What this turn carries forward. After a fallback nothing SPECIFIC was
     picked, so nothing is carried — otherwise every later turn would drag the
     whole base along, and the id list would outgrow the history check. */
  const carried = selection.fallback && ids === selection.ids ? [] : ids;
  const sig = await signTurn(secret, sid, history.length, last?.sig ?? '', question, answer, carried);
  console.log(JSON.stringify({ evt: 'chat', ...log, usage: usages }));
  await recordCalls(calls, mode, selection.fallback, log.outcome);

  return json(
    200,
    {
      answer,
      links,
      action,
      handoff: !reply || !reply.onTopic,
      turn: { q: question, a: answer, ids: carried, sig },
      session: newSession,
    },
    origin
  );
});
