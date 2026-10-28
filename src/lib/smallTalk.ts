/**
 * Small talk, answered in the widget from fixed text — no human check, no
 * model call, none of the daily ten.
 *
 * A message qualifies only if it is made ENTIRELY of these phrases ("hi, how
 * are you?", "ok thanks bye") — one word left over and it goes to the model,
 * so "hi, what do you charge?" and "how are your rates?" are still questions.
 * The model is the backstop for anything missing here (the "pleasantries"
 * rule in `supabase/functions/chat/prompt.ts`); this list is what keeps the
 * common ones free and instant.
 *
 * A phrase that is too BROAD fails silently: a studio question swallowed by a
 * canned reply never reaches the model, and nothing errors. So every phrase
 * added here wants a case in `tests/chat.test.ts`, on whichever side of the
 * line it belongs. Leave out "yes", "no", "sure" and "what do you do": after
 * an answer those carry meaning the model has the history to read.
 *
 * Pure — no imports, no DOM — so `npm run test:chat` loads it under Node.
 */

/* Punctuation is stripped before matching, so no apostrophes: "im", "whats".
   Marks are KEPT (\p{M}): Devanagari writes its vowels as marks, and without
   them "नमस्ते" is "नमसत" and matches nothing. */
type Talk = 'bye' | 'thanks' | 'kind' | 'who' | 'how' | 'fine' | 'hello' | 'ack';
const TALK: Array<[Talk, string]> = [
  [
    'hello',
    '(h+i+|h+e+y+a*|h+e+l+o+|h+l+o+|hiya|yo+|howdy|greetings|hola|namaste|namaskar|salaam|good (morning|afternoon|evening|day)' +
      '|नमस्ते|नमस्कार|प्रणाम|हेलो|हाय)' +
      '( there| all| team| everyone| aniwala( studios)?| bot| assistant)?( ji| जी)?',
  ],
  [
    'how',
    'how (are|r) (you|u|ya)( doing)?( today)?|hru|how( i|)s (it going|everything|your day|life)|how (have|ve) you been' +
      '|how do you do|whats up|wh?a+s+u+p+|sup|and (you|u)|(what|how) about you|hbu|wbu|you good' +
      '|(aap )?kaise (ho|hain)( aap)?|kya ha+l hai|sab (theek|thik)( hai)?' +
      '|(आप )?कैसे (हो|हैं)( आप)?|क्या हाल (है|हैं)|सब ठीक( है)?',
  ],
  [
    'fine',
    '((i( a|)m |im )(good|fine|great|well|ok(ay)?|doing (good|well|great|fine))|good|fine|doing (good|well|great|fine))( thanks)?' +
      '|not bad|all good' +
      '|(main )?(theek|thik) (hoon|hu|hun)|badhiya' +
      '|(मैं )?ठीक (हूँ|हूं|हु)|बढ़िया',
  ],
  [
    'who',
    'who (are|r) (you|u)|what (are|r) (you|u)|whats your name|(are|r) (you|u) (a |an )?(bot|robot|ai|human|real( person)?|person)' +
      '|is this (a |an )?(bot|robot|ai|human|real person)|am i (talking|chatting) (to|with) (a |an )?(bot|robot|ai|human|real person)' +
      '|what can (you|u) (do|help with)|how can (you|u) help( me)?|help( me)?',
  ],
  [
    'thanks',
    '(thank (you|u)|thanks+|thx|ty|tysm|many thanks)( (so|very) much| a lot| again| for (the|your) help)?' +
      '|dhanyava+d|dhanyawa+d|shukriya|धन्यवाद|शुक्रिया',
  ],
  [
    'kind',
    '(nice|great|cool|lovely|beautiful|amazing) (website|site|work|portfolio)|(i )?love (your|the) (work|website|site|animation)' +
      '|(you( a|)re|youre|ur) (very |so |really )?(great|awesome|helpful|amazing|the best)|(very |so )?helpful|that helps|good bot',
  ],
  [
    'bye',
    'by+e+( bye)?|good ?bye|good night|see (you|ya)( later| soon)?|cya|ttyl|take care|have a (good|nice|great) day|alvida' +
      '|अलविदा|बाय|फिर मिलेंगे',
  ],
  ['ack', 'o+k+(ay)?|k|cool|great|perfect|nice|awesome|alright|got it|understood|noted|sounds good|makes sense'],
];
/* NFC on both sides: "बढ़िया" can arrive with its nukta precomposed or not. */
const TALK_RE = TALK.map(([kind, src]) => [kind, new RegExp(`^(?:${src})(?: |$)`.normalize('NFC'))] as const);

const ASK = 'What would you like to know — our services, past work, how a project runs, or open roles?';
const TALK_REPLY: Record<Talk, string> = {
  bye: 'Thanks for stopping by! If you want to talk to the team, get in touch any time.',
  thanks: 'You are welcome! Anything else I can help with?',
  kind: "Thank you — that's kind of you. Anything else you'd like to know?",
  who: "I'm Aniwala Studios' automated assistant, not a person. I can answer questions about our services, past work, how a project runs and open roles — for anything else, the team is a message away through the contact page.",
  how: `I'm doing well, thanks for asking. ${ASK}`,
  fine: `Glad to hear it. ${ASK}`,
  hello: ASK,
  ack: 'Anything else I can help with?',
};
/* When a message mixes them, the one answered: "ok thanks bye" is a bye. */
const TALK_ORDER: Talk[] = ['bye', 'thanks', 'kind', 'who', 'how', 'fine', 'hello', 'ack'];
/* A hello is answered with one, whatever else the message held — "hii how are
   you" gets "Hi! I'm doing well…", not just the second half. In kind where
   it is easy to: a good morning, a namaste. A thanks or a bye is the end of
   a conversation, not the start, so it gets no greeting. */
const GREETS: Talk[] = ['kind', 'who', 'how', 'fine', 'hello'];
function greetingFor(m: string): string {
  /* Word edges by space, not \b — \b is ASCII-only and never fires in Devanagari. */
  const time = /(?:^| )good (morning|afternoon|evening)(?: |$)/.exec(m);
  if (time) return `Good ${time[1]}!`;
  if (/(?:^| )(namaste|namaskar|नमस्ते|नमस्कार)(?: |$)/.test(m)) return 'Namaste!';
  return 'Hi!';
}

/** The fixed reply for a message that is only small talk, else null. */
export function smallTalk(message: string): string | null {
  const m = message
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  /* Only emoji or punctuation — a wave, a thumbs up, "?" — which may open the
     chat or come after an answer, so no "Hello". */
  if (!m) return message.trim() ? ASK : null;
  const seen = new Set<Talk>();
  let rest = m;
  for (let i = 0; rest && i < 4; i++) {
    /* The longest phrase wins, so "good morning" is a hello, not a "good". */
    let best: [Talk, number] | null = null;
    for (const [kind, re] of TALK_RE) {
      const hit = re.exec(rest);
      if (hit && (!best || hit[0].length > best[1])) best = [kind, hit[0].length];
    }
    if (!best) return null;
    seen.add(best[0]);
    rest = rest.slice(best[1]);
  }
  if (rest) return null;
  const kind = TALK_ORDER.find((k) => seen.has(k))!;
  return seen.has('hello') && GREETS.includes(kind) ? `${greetingFor(m)} ${TALK_REPLY[kind]}` : TALK_REPLY[kind];
}
