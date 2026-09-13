/**
 * The video field — a drop zone that uploads to R2, not to Sanity.
 *
 * WHY THIS EXISTS RATHER THAN A `file` FIELD.
 *
 * Sanity's own file field is one line of schema and would look identical to
 * this. It also stores the video in Sanity, where it counts against the
 * project's storage and asset bandwidth, is served with no transcode, and is
 * awkward to move later. Video is the one asset heavy enough that where it
 * lives is a decision rather than a detail.
 *
 * So the FILE goes to R2 and the FIELD stores a URL. Sanity holds a string.
 *
 * HOW THE UPLOAD IS AUTHORISED, and why the file does not pass through a
 * server on the way: an Edge Function's request body is capped well below the
 * size of a real video. The browser therefore talks to R2 directly, using a
 * short-lived presigned URL from the `sign-upload` function. That function
 * checks the editor's own Sanity session before it signs anything — see its
 * header for why a shared key could not work here.
 *
 * A URL CAN STILL BE TYPED. The field is a plain string and anything already
 * in it is left alone, so a Cloudflare Stream id or a URL from
 * `scripts/upload-r2.mjs` keeps working exactly as before. This only adds a
 * second way to fill it in.
 */
import { useCallback, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui';
import { set, unset, useClient, type StringInputProps } from 'sanity';

/* Public already — it is in the website's own bundle. Overridable so a fork
   pointing at another Supabase project does not need a code change. */
const SIGN_URL = `${
  process.env.SANITY_STUDIO_SUPABASE_URL ?? 'https://ocxbnnfchqzgkbqlagnq.supabase.co'
}/functions/v1/sign-upload`;

const ACCEPT = 'video/mp4,video/webm';

/**
 * The editor's Sanity session token.
 *
 * Two places, because which one holds it depends on how the Studio
 * authenticated — a hosted studio on a `.sanity.studio` domain and a local one
 * do not agree. Checking both is the difference between this working
 * everywhere and working on one developer's machine.
 *
 * Returning undefined is handled: the component says so plainly rather than
 * failing at the upload with a 401 nobody can act on.
 */
function sessionToken(projectId: string, configured?: string): string | undefined {
  if (configured) return configured;
  try {
    return window.localStorage.getItem(`__sanity_auth_token_${projectId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export function R2VideoInput(props: StringInputProps) {
  const { value, onChange, elementProps } = props;
  const client = useClient({ apiVersion: '2024-10-01' });
  const { projectId = '', token: configuredToken } = client.config();

  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);

      const token = sessionToken(projectId, configuredToken);
      if (!token) {
        setError('Could not read your Studio session. Reload the page and try again.');
        return;
      }

      setProgress(0);
      try {
        const signed = await fetch(SIGN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });

        if (!signed.ok) {
          const body = await signed.json().catch(() => ({}));
          throw new Error(body.error ?? `Could not start the upload (${signed.status}).`);
        }

        const { uploadUrl, publicUrl, contentType } = await signed.json();

        /*
         * XHR rather than fetch, and only for this: fetch cannot report
         * upload progress. On a file this size a bar is not decoration —
         * without one there is no way to tell a slow upload from a dead one.
         */
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('Content-Type', contentType);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`R2 refused the upload (${xhr.status}).`));
          xhr.onerror = () =>
            reject(
              new Error(
                'The upload was blocked before it started. The bucket most likely has no CORS policy — see scripts/r2-cors.mjs.'
              )
            );
          xhr.send(file);
        });

        onChange(set(publicUrl));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProgress(null);
      }
    },
    [projectId, configuredToken, onChange]
  );

  const busy = progress !== null;

  return (
    <Stack gap={3}>
      {/* The stored value stays editable by hand. A pasted Stream id or an
          existing URL must not become unreachable just because a drop zone
          was added above it. */}
      <TextInput
        {...elementProps}
        value={value ?? ''}
        onChange={(e) => {
          const next = e.currentTarget.value;
          onChange(next ? set(next) : unset());
        }}
        placeholder="https://…  or a Cloudflare Stream id"
        disabled={busy}
      />

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void upload(file);
        }}
      />

      <Card
        padding={3}
        radius={2}
        tone={error ? 'critical' : 'transparent'}
        border
        onDragOver={(e: React.DragEvent) => e.preventDefault()}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) void upload(file);
        }}
      >
        <Flex align="center" justify="space-between" gap={3}>
          <Box flex={1}>
            <Text size={1} muted>
              {busy
                ? `Uploading to R2 — ${progress}%`
                : error
                  ? error
                  : 'Drop an .mp4 or .webm here. It goes to Cloudflare R2, not Sanity.'}
            </Text>
          </Box>
          <Button
            mode="ghost"
            text={busy ? 'Uploading…' : 'Choose file'}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          />
        </Flex>
      </Card>
    </Stack>
  );
}

export default R2VideoInput;
