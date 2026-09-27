/**
 * Vertex AI, from a service-account key, with nothing but fetch and WebCrypto.
 *
 * Google's auth library does not fit the Deno runtime well, and the whole of
 * what it would do here is one signed JWT exchanged for a one-hour token. No
 * Deno globals, so `scripts/eval-chat.mjs` calls the same code from Node.
 *
 * THE KEY (CHATBOT-PLAN.md section 5) arrives as a parameter, never read here,
 * and neither it nor the access token is ever logged. Error messages carry a
 * status code and Google's error STATUS string, not bodies — a body can echo
 * the request, and the request is a visitor's question.
 */
import type { ModelRequest } from './prompt.ts';
import { MAX_OUTPUT_TOKENS, RESPONSE_SCHEMA } from './prompt.ts';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/**
 * `GCP_SA_KEY` as stored: base64 of the JSON file, or the JSON itself.
 * Only the two fields used are kept. `token_uri` from the file is ignored on
 * purpose — the assertion is only ever posted to Google's fixed endpoint.
 */
export function parseServiceAccount(raw: string): ServiceAccount | null {
  const text = raw.trim().startsWith('{') ? raw : (() => {
    try {
      return new TextDecoder().decode(Uint8Array.from(atob(raw.trim()), (c) => c.charCodeAt(0)));
    } catch {
      return '';
    }
  })();
  try {
    const k = JSON.parse(text) as Partial<ServiceAccount>;
    if (typeof k.client_email !== 'string' || typeof k.private_key !== 'string') return null;
    return { client_email: k.client_email, private_key: k.private_key };
  } catch {
    return null;
  }
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlText = (text: string) => b64url(new TextEncoder().encode(text));

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

/* Per isolate. A token is good for an hour; it is refreshed five minutes early. */
let cached: { email: string; token: string; exp: number } | null = null;

export async function accessToken(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  if (cached && cached.email === sa.client_email && cached.exp - 300 > nowSec) return cached.token;

  const header = b64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlText(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 })
  );
  const key = await importKey(sa.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('google token exchange returned no token');
  cached = { email: sa.client_email, token: json.access_token, exp: nowSec + (json.expires_in ?? 3600) };
  return json.access_token;
}

export interface VertexConfig {
  project: string;
  /** `asia-south1`, `global`, … */
  region: string;
  model: string;
}

export interface Usage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

/** Only letters, digits and `.-_` in anything that goes into the URL path. */
const PATH_PART = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

function endpoint(cfg: VertexConfig): string {
  if (![cfg.project, cfg.region, cfg.model].every((p) => PATH_PART.test(p))) {
    throw new Error('GCP_PROJECT_ID, GCP_REGION or GEMINI_MODEL is not a plain identifier');
  }
  const host = cfg.region === 'global' ? 'aiplatform.googleapis.com' : `${cfg.region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${cfg.project}/locations/${cfg.region}/publishers/google/models/${cfg.model}:generateContent`;
}

/**
 * Thinking OFF, or as near as the model allows. It bills at the output rate
 * and company Q&A does not need it (CHATBOT-PLAN.md section 6). Gemini 2.x
 * takes a token budget; Gemini 3 takes a level. Confirm against the chosen
 * model — `thoughtsTokenCount` in the logs says whether it worked.
 */
function thinkingConfig(model: string): Record<string, unknown> {
  return /gemini-2\./.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'minimal' };
}

/**
 * One generateContent call. Returns the text of the reply (JSON, to be parsed
 * by `parseReply`) and the usage, or throws with a message safe to log.
 */
export async function generate(
  cfg: VertexConfig,
  token: string,
  req: ModelRequest,
  signal?: AbortSignal
): Promise<{ text: string; usage: Usage; finish?: string }> {
  const res = await fetch(endpoint(cfg), {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: thinkingConfig(cfg.model),
      },
    }),
  });

  if (!res.ok) {
    let status = '';
    try {
      status = ((await res.json()) as { error?: { status?: string } }).error?.status ?? '';
    } catch {
      /* not JSON */
    }
    throw new Error(`vertex ${res.status} ${status}`.trim());
  }

  const json = (await res.json()) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    usageMetadata?: Usage;
  };
  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  return { text, usage: json.usageMetadata ?? {}, finish: cand?.finishReason };
}
