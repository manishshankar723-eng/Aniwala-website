/**
 * The chat widget's behaviour. Markup and styles are in `components/Chat.astro`.
 *
 * WHAT THIS FILE MAY TRUST: nothing that comes back from the network is HTML.
 * Answers are set with `textContent`; links become `<a>` only after the same
 * path rule the function applies (`isSitePath`), so a reply that somehow
 * carried `javascript:` or `//evil.com` has no way onto the page. The function
 * is the check; this is the second one (CHATBOT-PLAN.md section 4.4).
 *
 * NAVIGATION. The widget root is `transition:persist`, so it is one DOM node
 * for the life of the tab and this module runs once — every listener below is
 * attached exactly once, which is the rule the `gsap.ticker` leak taught
 * (CLAUDE.md, Scroll). The conversation is kept in sessionStorage so a full
 * reload keeps it too; it dies with the tab.
 */
import { publicConfig } from './clientConfig';
import { isSitePath } from '../../supabase/functions/chat/guards.ts';

interface Turn {
  q: string;
  a: string;
  ids: string[];
  sig: string;
}

/**
 * What the visitor SAW, for replay after a reload or a new tab of the same
 * session. Separate from `history` on purpose: `history` is the signed
 * chain the server verifies and holds only typed questions and their answers;
 * this also holds the suggestion-button answers, which never reach the server,
 * and each answer's links and hand-off buttons, which the chain does not sign.
 * Display only — nothing in it is ever sent anywhere.
 */
interface Entry {
  who: 'you' | 'bot';
  text: string;
  links?: string[];
  action?: string;
  handoff?: boolean;
}

interface State {
  session?: string;
  history: Turn[];
  transcript: Entry[];
}

/* Enough for a long session; the oldest scroll off first. */
const MAX_TRANSCRIPT = 80;

interface Suggestion {
  q: string;
  a: string;
  links: string[];
}

interface ChatData {
  titles: Record<string, string>;
  suggestions: Suggestion[];
  siteKey: string;
  welcome: string;
}

interface Reply {
  answer?: string;
  links?: unknown;
  action?: string;
  handoff?: boolean;
  turn?: Turn;
  session?: string;
  error?: string;
  /** Which limit was hit, on a 429: 'address' is the daily ten. */
  reason?: string;
}

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  getResponse: (id?: string) => string | undefined;
};

const STORE = 'aniwala-chat';
const PREFILL = 'aniwala-chat-prefill';
/* Per-visitor conveniences in localStorage. Neither is a control: the daily
   limit is enforced by `chat_take` in Postgres, and clearing storage only
   brings back the glow or an input the server will still refuse. */
const SEEN = 'aniwala-chat-seen';
const LIMITED_UNTIL = 'aniwala-chat-limited-until';

const local = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private window — the server still enforces everything */
    }
  },
};

const load = (): State => {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    if (s && Array.isArray(s.history)) {
      /* Storage is editable by anyone at this keyboard, so the shape is
         checked here and every link is re-checked again at render time. */
      const transcript: Entry[] = Array.isArray(s.transcript)
        ? s.transcript
            .filter((e: Entry) => e && (e.who === 'you' || e.who === 'bot') && typeof e.text === 'string')
            .map((e: Entry) => ({
              who: e.who,
              text: e.text.slice(0, 2000),
              links: Array.isArray(e.links) ? e.links.filter((l) => typeof l === 'string') : [],
              action: typeof e.action === 'string' ? e.action : undefined,
              handoff: e.handoff === true,
            }))
        : /* Saved before the transcript existed: rebuild what it can. */
          s.history.flatMap((t: Turn) => [
            { who: 'you', text: t.q },
            { who: 'bot', text: t.a },
          ]);
      return { session: s.session, history: s.history, transcript };
    }
  } catch {
    /* blocked or corrupt storage — start fresh */
  }
  return { history: [], transcript: [] };
};

const save = (s: State) => {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* private window — the chat still works, it just will not survive a reload */
  }
};

function init(root: HTMLElement) {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const launcher = $<HTMLButtonElement>('.chat-launcher');
  const panel = $<HTMLElement>('.chat-panel');
  const log = $<HTMLElement>('.chat-log');
  const form = $<HTMLFormElement>('.chat-form');
  const input = $<HTMLTextAreaElement>('.chat-input');
  const send = $<HTMLButtonElement>('.chat-send');
  const close = $<HTMLButtonElement>('.chat-close');
  const slot = $<HTMLElement>('.chat-turnstile');

  let data: ChatData;
  try {
    data = JSON.parse(root.dataset.chat ?? '');
  } catch {
    return;
  }

  let state = load();
  let busy = false;
  let limited = false;

  /* The launcher glows until the visitor has opened the chat once. */
  if (local.get(SEEN)) root.classList.add('is-seen');

  /* Ten typed questions per 24 hours (chat_take). When the server says the
     visitor has used them, the composer locks with a plain explanation rather
     than letting them type into a box that will only refuse. */
  function lockDaily(until: number) {
    limited = true;
    input.disabled = true;
    send.disabled = true;
    input.value = '';
    input.placeholder = 'Daily limit reached — you can ask again tomorrow';
    root.classList.add('is-limited');
    local.set(LIMITED_UNTIL, String(until));
  }
  const storedUntil = Number(local.get(LIMITED_UNTIL));
  if (storedUntil > Date.now()) lockDaily(storedUntil);

  /* ---------- rendering: text only ---------- */

  const linkLabel = (path: string) => data.titles[path] ?? data.titles[path.replace(/#.*$/, '')] ?? path;

  const scrollDown = () => {
    log.scrollTop = log.scrollHeight;
  };

  /** A message row: the bot's carry a small avatar, the visitor's sit right. */
  function row(who: 'you' | 'bot', content: HTMLElement): HTMLElement {
    const r = document.createElement('div');
    r.className = `chat-row chat-row--${who}`;
    if (who === 'bot') {
      const avatar = document.createElement('span');
      avatar.className = 'chat-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = 'A';
      r.append(avatar);
    }
    r.append(content);
    log.append(r);
    scrollDown();
    return r;
  }

  function bubble(who: 'you' | 'bot', text: string, links: string[] = [], actions: Array<[string, string, (() => void)?]> = []) {
    const item = document.createElement('div');
    item.className = 'chat-msg';
    const p = document.createElement('p');
    p.textContent = text;
    item.append(p);

    const safe = links.filter(isSitePath);
    if (safe.length || actions.length) {
      const linkRow = document.createElement('div');
      linkRow.className = 'chat-links';
      for (const href of safe) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = linkLabel(href);
        linkRow.append(a);
      }
      for (const [label, href, onClick] of actions) {
        if (!isSitePath(href)) continue;
        const a = document.createElement('a');
        a.href = href;
        a.className = 'chat-action';
        a.textContent = label;
        if (onClick) a.addEventListener('click', onClick);
        linkRow.append(a);
      }
      item.append(linkRow);
    }
    return row(who, item);
  }

  /* Hand-offs are real controls, not more chat. The enquiry pre-fill is the
     visitor's OWN last question — never model output (R13). */
  function handoffs(action: string | undefined, handoff: boolean | undefined, links: string[]) {
    const prefill = () => {
      const q = state.history.at(-1)?.q;
      try {
        if (q) sessionStorage.setItem(PREFILL, q);
      } catch {
        /* nothing to carry — the form is still one click away */
      }
    };
    const out: Array<[string, string, (() => void)?]> = [];
    if (action === 'enquiry') out.push(['Send a brief', '/contact/', prefill]);
    if (action === 'book') out.push(['Book a call', '/contact/#book']);
    if (action === 'apply') out.push(['See open roles', links.find((l) => l.startsWith('/careers/')) ?? '/careers/']);
    if (handoff && !out.length) out.push(['Get in touch', '/contact/', prefill]);
    return out;
  }

  /* The opening: a greeting and the suggestion chips. The chips answer from
     fixed text built from the CMS — no model call. */
  function welcome() {
    bubble('bot', data.welcome);
    const chips = document.createElement('div');
    chips.className = 'chat-suggestions';
    for (const s of data.suggestions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-suggestion';
      b.textContent = s.q;
      b.addEventListener('click', () => {
        chips.remove();
        say({ who: 'you', text: s.q });
        say({ who: 'bot', text: s.a, links: s.links });
      });
      chips.append(b);
    }
    log.append(chips);
  }

  /* Only links to pages this chat knows: the transcript came out of
     storage, and storage is not the server. */
  const known = (links: string[] = []) => links.filter((l) => isSitePath(l) && l in data.titles);

  function render(e: Entry) {
    if (e.who === 'you') return bubble('you', e.text);
    const links = known(e.links);
    return bubble('bot', e.text, links, handoffs(e.action, e.handoff, links));
  }

  /** Show a message AND keep it for replay. */
  function say(e: Entry) {
    render(e);
    state.transcript.push(e);
    if (state.transcript.length > MAX_TRANSCRIPT) state.transcript.splice(0, state.transcript.length - MAX_TRANSCRIPT);
    save(state);
  }

  function replay() {
    log.replaceChildren();
    welcome();
    if (state.transcript.length) log.querySelector('.chat-suggestions')?.remove();
    for (const e of state.transcript) render(e);
  }

  /* ---------- Turnstile, only once the chat is opened ---------- */

  let widgetId: string | undefined;
  let ready: Promise<TurnstileApi | null> | null = null;

  function turnstile(): Promise<TurnstileApi | null> {
    if (ready) return ready;
    ready = new Promise((resolve) => {
      const w = window as unknown as {
        turnstile?: TurnstileApi;
        aniwalaTurnstileInit?: () => void;
        aniwalaChatTurnstileReady?: () => void;
      };
      if (w.turnstile) return resolve(w.turnstile);
      /* The forms load the same script under the same id. If they got there
         first, wait for it; if this gets there first, it hands the forms their
         render too — otherwise a form on this page would wait for an onload
         that never comes. */
      w.aniwalaChatTurnstileReady = () => {
        w.aniwalaTurnstileInit?.();
        resolve(w.turnstile ?? null);
      };
      if (!document.getElementById('cf-turnstile-api')) {
        const s = document.createElement('script');
        s.id = 'cf-turnstile-api';
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=aniwalaChatTurnstileReady';
        s.async = true;
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      } else {
        const poll = setInterval(() => {
          if (w.turnstile) {
            clearInterval(poll);
            resolve(w.turnstile);
          }
        }, 200);
        setTimeout(() => {
          clearInterval(poll);
          resolve(w.turnstile ?? null);
        }, 10_000);
      }
    });
    return ready;
  }

  async function turnstileToken(): Promise<string> {
    const api = await turnstile();
    if (!api) return '';
    if (widgetId === undefined) {
      widgetId = api.render(slot, {
        sitekey: data.siteKey,
        action: 'chat',
        theme: 'auto',
        appearance: 'interaction-only',
      });
    }
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const t = api.getResponse(widgetId);
      if (t) return t;
      await new Promise((r) => setTimeout(r, 250));
    }
    return '';
  }

  function resetTurnstile() {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    try {
      if (api && widgetId !== undefined) api.reset(widgetId);
    } catch {
      /* not mounted */
    }
  }

  /* ---------- talking to the function ---------- */

  async function post(message: string, fresh: boolean): Promise<{ status: number; body: Reply }> {
    const payload: Record<string, unknown> = { message, history: fresh ? [] : state.history };
    if (!fresh && state.session) {
      payload.session = state.session;
    } else {
      const token = await turnstileToken();
      if (!token) return { status: 0, body: { error: 'verification' } };
      payload.turnstile = token;
      resetTurnstile(); // single use: the next new session needs a new solve
    }
    try {
      const res = await fetch(`${publicConfig().functionsBaseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body: Reply = {};
      try {
        body = await res.json();
      } catch {
        /* non-JSON — the status says enough */
      }
      return { status: res.status, body };
    } catch {
      return { status: 0, body: { error: 'network' } };
    }
  }

  async function ask(message: string) {
    if (busy || limited) return;
    busy = true;
    send.disabled = true;
    log.querySelector('.chat-suggestions')?.remove();
    bubble('you', message);
    const dots = document.createElement('div');
    dots.className = 'chat-msg chat-typing';
    dots.setAttribute('aria-label', 'Assistant is typing');
    dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    const thinking = row('bot', dots);

    let { status, body } = await post(message, !state.session);
    if (status === 401 || (status === 400 && body.error === 'history')) {
      // The session expired or the stored history is no longer valid: start over.
      state = { history: [], transcript: state.transcript };
      ({ status, body } = await post(message, true));
    }
    thinking.remove();

    if (body.session) state.session = body.session;
    if (status === 429 && body.reason === 'address') lockDaily(Date.now() + 24 * 60 * 60 * 1000);
    const links = Array.isArray(body.links) ? body.links.filter(isSitePath) : [];

    if (typeof body.answer === 'string' && body.answer) {
      if (body.turn) state.history.push(body.turn);
      /* The question is kept with its answer, so a reload shows the pair. */
      state.transcript.push({ who: 'you', text: message });
      say({ who: 'bot', text: body.answer, links, action: body.action, handoff: body.handoff });
    } else if (body.error === 'verification') {
      bubble('bot', 'The human check did not load, so I cannot answer here. You can reach the team directly.', [], [
        ['Get in touch', '/contact/'],
      ]);
    } else if (body.error === 'message') {
      bubble('bot', 'That message is too long — please keep it under 500 characters.');
    } else {
      bubble('bot', 'Something went wrong on my side. You can reach the team directly.', [], [['Get in touch', '/contact/']]);
    }
    save(state);
    busy = false;
    send.disabled = limited;
    input.focus();
  }

  /* ---------- open / close ---------- */

  function setOpen(open: boolean) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    root.classList.toggle('is-open', open);
    if (open && !root.classList.contains('is-seen')) {
      root.classList.add('is-seen');
      local.set(SEEN, '1');
    }
    if (open) {
      input.focus();
      if (!state.session) void turnstile();
    } else {
      launcher.focus();
    }
  }

  launcher.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    grow();
    void ask(text);
  });

  /* One line to start; grows with what is typed, up to the CSS max-height. */
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  replay();
}

/* The enquiry pre-fill, on whichever page the visitor lands. Only into an
   EMPTY field, and only once. */
function applyPrefill() {
  let q: string | null = null;
  try {
    q = sessionStorage.getItem(PREFILL);
  } catch {
    return;
  }
  if (!q) return;
  const field = document.querySelector<HTMLTextAreaElement>('#eq-form textarea[name="message"]');
  if (!field) return;
  if (!field.value) field.value = q;
  try {
    sessionStorage.removeItem(PREFILL);
  } catch {
    /* ignore */
  }
}

/**
 * Keep the button off the footer's bottom row.
 *
 * The launcher is fixed to the bottom-right corner, which is exactly where the
 * footer's legal links (the privacy policy among them) sit once the page is
 * scrolled to the end — so it covered them. While `.footer-base` is on screen
 * the launcher rises by however much of that row is visible, and settles back
 * as it scrolls away; it rides just above the row rather than on it.
 *
 * NO LEAKS ACROSS NAVIGATION (CLAUDE.md → Scroll). Each page swap brings a new
 * footer, so the observer is disconnected and re-made on `astro:page-load`;
 * the scroll and resize listeners are attached ONCE, here, and only do work
 * while the row is in view.
 */
function avoidFooter(root: HTMLElement) {
  let base: HTMLElement | null = null;
  let visible = false;
  let frame = 0;
  let io: IntersectionObserver | null = null;

  const update = () => {
    frame = 0;
    const lift = base && visible ? Math.max(0, window.innerHeight - base.getBoundingClientRect().top) : 0;
    root.style.setProperty('--chat-lift', `${Math.round(lift)}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', () => visible && schedule(), { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  const watch = () => {
    io?.disconnect();
    base = document.querySelector<HTMLElement>('.footer-base');
    visible = false;
    schedule();
    if (!base || !('IntersectionObserver' in window)) return;
    io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      schedule();
    });
    io.observe(base);
  };
  /* Now, for the page already on screen, and after every swap. Re-observing
     the same footer twice is harmless; missing the first page is not. */
  watch();
  document.addEventListener('astro:page-load', watch);
}

const w = window as unknown as { __aniwalaChat?: boolean };
if (!w.__aniwalaChat) {
  w.__aniwalaChat = true;
  const root = document.getElementById('chat');
  if (root) {
    init(root);
    avoidFooter(root);
  }
  document.addEventListener('astro:page-load', applyPrefill);
}
