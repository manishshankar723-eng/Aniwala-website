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
  mintVisitor,
  parseReply,
  partialReply,
  selectConcepts,
  signTurn,
  validateKnowledge,
  verifyHistory,
  verifySession,
  verifyVisitor,
  type KnowledgeIndex,
  type PartialReply,
  type Reply,
} from './guards.ts';
import { HANDOFF, buildRequest, type ModelRequest } from './prompt.ts';
import { accessToken, generateStream, parseServiceAccount, type Usage, type VertexConfig } from './vertex.ts';

const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) },
  });

const nowSec = () => Math.floor(Date.now() / 1000);

/* Supabase's runtime keeps the worker alive for a promise handed to
   `EdgeRuntime.waitUntil` after the response has gone. Elsewhere (a plain Deno
   run) the promise simply runs unawaited. Both writers it is used for already
   catch their own errors. */
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const background = (p: Promise<unknown>) => {
  try {
    if (typeof EdgeRuntime !== 'undefined') return EdgeRuntime.waitUntil(p);
  } catch {
    /* fall through */
  }
  void p;
};

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

type Take = 'ok' | 'sessions' | 'visitor' | 'crowd' | 'address' | 'session' | 'budget' | 'invalid' | 'error';

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
  /** The browser id, on a session's first message; Postgres binds it to the
      session there and finds it by `sid` after. */
  visitor?: string | null;
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
        p_visitor: p.visitor ?? null,
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

/**
 * Best effort: a turn for the weekly review, already scrubbed — a refused one,
 * or one the visitor marked unhelpful. Only an unhelpful turn carries its
 * answer and its position: the answer is what is being judged, and the
 * position is what `chat_flags_one_per_turn` holds to one flag per turn.
 */
async function flag(
  addr: string,
  sid: string,
  reason: 'off_topic' | 'bad_reply' | 'unhelpful',
  question: string,
  rated?: { answer: string; turn: number }
): Promise<boolean> {
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
      body: JSON.stringify({
        addr,
        sid,
        reason,
        question: question.slice(0, LIMITS.message),
        ...(rated ? { answer: rated.answer.slice(0, LIMITS.answer), turn: rated.turn } : {}),
      }),
    });
    // 409: this turn was already flagged — the visitor's click still counts.
    if (res.ok || res.status === 409) return true;
    console.error(`chat flag insert failed: ${res.status}`);
  } catch (err) {
    console.error('chat flag insert unreachable:', String(err));
  }
  return false;
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
  let body: {
    message?: unknown;
    session?: unknown;
    turnstile?: unknown;
    history?: unknown;
    stream?: unknown;
    visitor?: unknown;
    feedback?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'bad_request' }, origin);
  }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad_request' }, origin);

  const ip = clientIp(req);

  /* ---------- feedback: "not helpful" on an answer this session was given ----------
     `feedback` is the turn's position in the history. Only a turn this
     function SIGNED can be flagged, so the row holds the scrubbed question the
     model saw and the answer it actually sent — never text the page supplied.
     No model call and no reservation; the flood bound is the session (a
     Turnstile solve each, 20 an hour per address, 12 turns each) and the
     one-flag-per-turn index. */
  if (body.feedback !== undefined) {
    const fsid = await verifySession(body.session, secret, nowSec());
    if (!fsid) return json(401, { error: 'session' }, origin);
    const turns = await verifyHistory(secret, fsid, body.history);
    const n = body.feedback;
    if (!turns || typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n >= turns.length) {
      return json(400, { error: 'feedback' }, origin);
    }
    const ok = await flag(await hashAddr(ip, secret), fsid, 'unhelpful', turns[n].q, { answer: turns[n].a, turn: n });
    console.log(JSON.stringify({ evt: 'chat', outcome: ok ? 'feedback' : 'feedback_failed' }));
    return json(ok ? 200 : 503, { ok }, origin);
  }

  /* ---------- who: a session, or a fresh Turnstile solve that mints one ---------- */
  let sid = await verifySession(body.session, secret, nowSec());
  let newSession: string | undefined;
  let vid: string | null = null;
  let newVisitor: string | undefined;
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
    /* The browser's id comes back with every new session, renewed — kept if
       the browser still holds a good one, fresh if not (see mintVisitor). */
    const known = await verifyVisitor(body.visitor, secret, nowSec());
    const issued = await mintVisitor(secret, nowSec(), known ?? undefined);
    vid = issued.vid;
    newVisitor = issued.token;
  }

  /* ---------- what: a genuine history and a real message ---------- */
  const history = await verifyHistory(secret, sid, body.history);
  if (!history) return json(400, { error: 'history' }, origin);
  const question = cleanMessage(body.message);
  if (!question) return json(400, { error: 'message' }, origin);

  const index = await knowledge();
  if (!index) return json(503, { error: 'unavailable', answer: HANDOFF.failed, handoff: true, session: newSession, visitor: newVisitor }, origin);

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

  /* The first reservation is made BEFORE any response is started, so a limit
     still answers with its own status rather than inside a 200 stream. */
  const first = buildRequest(index, selection.ids, history, question);
  log.estimate += first.estimate;
  const reserved = await take({ addr, sid: sid!, kind: 'message', newSession: Boolean(newSession), visitor: vid, tokens: first.estimate });
  if (reserved !== 'ok') {
    log.outcome = `limit:${reserved}`;
    console.log(JSON.stringify({ evt: 'chat', ...log }));
    const answer =
      reserved === 'budget' || reserved === 'error'
        ? HANDOFF.busy
        : reserved === 'visitor' || reserved === 'address'
          ? HANDOFF.daily
          : reserved === 'crowd'
            ? HANDOFF.crowd
            : HANDOFF.limit;
    /* 'address' is the name the page locks its composer on for 24 hours, so
       the per-browser ten keeps it. 'crowd' — the address ceiling — must not
       lock anyone: it is the network that is busy, not this visitor. */
    const reason = reserved === 'visitor' ? 'address' : reserved;
    return json(429, { error: 'limit', reason, answer, handoff: true, session: newSession, visitor: newVisitor }, origin);
  }

  /**
   * One model call, already reserved. `watch` sees the reply as it arrives;
   * returning 'stop' aborts the call there ('stopped').
   */
  async function call(
    request: ModelRequest,
    kind: 'message' | 'retry',
    watch: (p: PartialReply) => void | 'stop'
  ): Promise<Reply | null | 'stopped'> {
    const entry: { kind: 'message' | 'retry'; estimate: number; usage?: Usage } = { kind, estimate: request.estimate };
    calls.push(entry);
    const stop = new AbortController();
    let stopped = false;
    try {
      const token = await accessToken(sa!);
      const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(Math.max(deadline - Date.now(), 1000))]);
      const out = await generateStream(
        vertex,
        token,
        request,
        (text) => {
          if (stopped) return;
          if (watch(partialReply(text)) === 'stop') {
            stopped = true;
            stop.abort();
          }
        },
        signal
      );
      usages.push(out.usage);
      entry.usage = out.usage;
      return parseReply(out.text, index!);
    } catch (err) {
      if (stopped) return 'stopped';
      console.error('chat model call failed:', String(err));
      return null;
    }
  }

  /**
   * The turn. `emit` receives the answer text as it is written — only an
   * answer that will be KEPT: once the first call has said which material it
   * is missing, either it streams, or it is aborted right there and the retry
   * streams instead. Whatever was emitted, the final body carries the checked
   * answer, and the page shows that.
   */
  async function run(emit: (delta: string) => void): Promise<{ status: number; body: Record<string, unknown> }> {
    let ids = selection.ids;
    let sent = '';
    const forward = (p: PartialReply) => {
      if (p.onTopic !== true || p.answer === undefined) return;
      if (p.answer.length > sent.length && p.answer.startsWith(sent)) {
        emit(p.answer.slice(sent.length));
        sent = p.answer;
      }
    };

    /* null = the first call has not said yet what it needs. */
    let wider: string[] | null = null;
    const widen = (need: string[]): string[] => {
      const extra = need.filter((id) => index!.ids.has(id) && !ids.includes(id)).slice(0, LIMITS.topK);
      return mode === 'selective' && extra.length && Date.now() < deadline - 3000
        ? [...new Set([...ids, ...extra])].sort()
        : [];
    };

    let reply = await call(first, 'message', (p) => {
      if (p.onTopic !== true || !p.need) return;
      if (wider === null) {
        wider = widen(p.need);
        if (wider.length) return 'stop';
      }
      forward(p);
    });
    /* A model that wrote `need` after the answer: decide from the whole reply,
       the way this worked before streaming. Nothing was emitted in that case. */
    const retryIds: string[] = wider ?? (reply && reply !== 'stopped' && reply.onTopic ? widen(reply.need) : []);

    /* One retry, never more, and only for ids that are real. */
    if (retryIds.length) {
      const request = buildRequest(index!, retryIds, history!, question!);
      log.estimate += request.estimate;
      log.retried = true;
      const t = await take({ addr, sid: sid!, kind: 'retry', newSession: false, tokens: request.estimate });
      if (t === 'ok') {
        const second = await call(request, 'retry', forward);
        if (second && second !== 'stopped') {
          reply = second;
          ids = retryIds;
        }
      }
    }
    const final = reply === 'stopped' ? null : reply;

    let answer: string;
    let links: string[] = [];
    let action: Reply['action'] = 'none';
    if (!final) {
      answer = HANDOFF.failed;
      log.outcome = 'bad_reply';
      background(flag(addr, sid!, 'bad_reply', question!));
    } else if (!final.onTopic) {
      answer = REFUSAL;
      log.outcome = 'off_topic';
      background(flag(addr, sid!, 'off_topic', question!));
    } else {
      ({ answer, links, action } = final);
      log.outcome = 'answered';
    }

    /* What this turn carries forward. After a fallback nothing SPECIFIC was
       picked, so nothing is carried — otherwise every later turn would drag the
       whole base along, and the id list would outgrow the history check. */
    const carried = selection.fallback && ids === selection.ids ? [] : ids;
    const sig = await signTurn(secret, sid!, history!.length, last?.sig ?? '', question!, answer, carried);
    console.log(JSON.stringify({ evt: 'chat', ...log, usage: usages }));
    /* Bookkeeping after the reply, not in front of it. */
    background(recordCalls(calls, mode, selection.fallback, log.outcome));

    return {
      status: 200,
      body: {
        answer,
        links,
        action,
        handoff: !final || !final.onTopic,
        turn: { q: question, a: answer, ids: carried, sig },
        session: newSession,
        visitor: newVisitor,
      },
    };
  }

  /* A page that posts no `stream` gets JSON, exactly as before — so the site
     and this function can be deployed in either order. */
  if (body.stream !== true) {
    const { status, body: out } = await run(() => {});
    return json(status, out, origin);
  }

  /* Server-sent events over a POST: `{"d": text}` as the answer is written,
     then exactly one `{"status", "body"}` — the same body the JSON path
     returns. The status of THIS response is 200 whatever happens next. */
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        send(await run((d) => send({ d })));
      } catch (err) {
        console.error('chat stream failed:', String(err));
        send({ status: 500, body: { error: 'unavailable', answer: HANDOFF.failed, handoff: true, session: newSession, visitor: newVisitor } });
      }
      ctrl.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...cors(origin),
    },
  });
});
