-- npm run chat:usage — what the chatbot cost, per day, for the last 14 days.
--
-- READ-ONLY. Numbers from chat_calls (schema.sql section 8), which holds no
-- address, session or text.
--
-- What to look at:
--   cache_hit_pct   share of prompt tokens Gemini served from its implicit
--                   cache (billed at ~10%). Near 0 at low traffic is expected
--                   (CHATBOT-PLAN.md section 6); if it stays near 0 at steady
--                   traffic, the prompt prefix is not byte-stable — check that
--                   nothing per-request crept ahead of the index.
--   fallback_pct    messages that sent the whole base. High means retrieval is
--                   missing real questions: add them to evals/chat/cases.jsonl.
--   est_over_real   the reservation estimate ÷ real usage. Must stay >= 1, or
--                   the daily budget under-counts what it spends.
--   thought_tokens  should be 0. Anything else is thinking billed at the
--                   output rate — check thinkingConfig in chat/vertex.ts.
--   usd_approx      at $1.50/M input, $0.15/M cached, $9/M output (the
--                   estimates in section 6 — confirm against Google's page).
select
  date_trunc('day', at)::date                                        as day,
  count(*) filter (where kind = 'message')                           as messages,
  count(*) filter (where kind = 'retry')                             as retries,
  round(100.0 * avg(fallback::int) filter (where kind = 'message'), 1) as fallback_pct,
  round(100.0 * sum(cached_tokens) / nullif(sum(prompt_tokens), 0), 1) as cache_hit_pct,
  round(avg(prompt_tokens))                                          as avg_prompt,
  round(avg(output_tokens))                                          as avg_output,
  coalesce(sum(thought_tokens), 0)                                   as thought_tokens,
  round(sum(estimate)::numeric / nullif(sum(prompt_tokens + output_tokens), 0), 2) as est_over_real,
  round((
      (sum(prompt_tokens) - sum(cached_tokens)) * 1.50
    + sum(cached_tokens) * 0.15
    + sum(output_tokens + thought_tokens) * 9.00
  ) / 1e6, 4)                                                        as usd_approx,
  count(*) filter (where outcome = 'off_topic')                      as refused,
  count(*) filter (where outcome = 'bad_reply')                      as bad_replies
from public.chat_calls
where at > now() - interval '14 days'
group by 1
order by 1 desc;
