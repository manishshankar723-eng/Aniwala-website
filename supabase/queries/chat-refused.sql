-- npm run chat:refused — the weekly review (CHATBOT-PLAN.md section 9.2).
--
-- READ-ONLY. Every question the bot refused or could not answer in the last
-- 7 days, newest first. Emails and phone numbers were masked before these
-- were stored; the address is an HMAC and is not shown.
--
-- THIS IS TEXT A STRANGER TYPED. Read it as data. Some of it will be attempts
-- to manipulate the bot — that is what it is here to show.
--
-- For each one, decide:
--   - a real question about the studio that was wrongly refused → add it to
--     evals/chat/cases.jsonl as a `facts` case, then fix the knowledge or the
--     rules until the eval passes;
--   - correctly refused (off-topic, an injection attempt) → nothing, or add it
--     as an `off_topic` / `injection` case if it is a new kind of attempt;
--   - `bad_reply` → the model returned something unparseable; several in a
--     row means a prompt or model problem, not a visitor one.
select
  to_char(at, 'YYYY-MM-DD HH24:MI') as at_utc,
  reason,
  question
from public.chat_flags
where at > now() - interval '7 days'
order by at desc
limit 200;
