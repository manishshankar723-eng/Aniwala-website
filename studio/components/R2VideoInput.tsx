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
import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui';
import { set, unset, useClient, useFormValue, type Path, type StringInputProps } from 'sanity';
import { PosterCapture } from './PosterCapture';

/* Public already — it is in the website's own bundle. Overridable so a fork
   pointing at another Supabase project does not need a code change. */
const SIGN_URL = `${
  process.env.SANITY_STUDIO_SUPABASE_URL ?? 'https://ocxbnnfchqzgkbqlagnq.supabase.co'
}/functions/v1/sign-upload`;

const ACCEPT = 'video/mp4,video/webm';

/*
 * `posterField` as a real option rather than a cast.
 *
 * Sanity types `options` per field type and `StringOptions` is a closed shape,
 * so a custom key is a type error at every schema that sets one — which is the
 * behaviour you want, because the alternative is a misspelling that silently
 * never offers the panel. Declaration merging is the documented way to add
 * one, and it belongs HERE, beside the code that reads it: a schema and a
 * component that disagree about this name is exactly the failure the type is
 * being asked to catch.
 */
declare module 'sanity' {
  interface StringOptions {
    /** Sibling image field the poster panel writes to. Omit and no panel. */
    posterField?: string;
    /**
     * Does anything on the site ever play this field's audio?
     *
     * A portfolio tile ships the browser's own control bar and a visitor may
     * unmute it. A hero or a discipline loop is `data-video="silent"` and is
     * held muted for the life of the page. The upload warning below is the
     * OPPOSITE advice in those two cases, so it is declared per field rather
     * than inferred from the document type — a player added somewhere new has
     * to say so here, and the type is what makes forgetting visible.
     */
    playsAudio?: boolean;
  }
}

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

/**
 * SHA-256 of the whole file.
 *
 * The server turns this into the object key, so the same video dropped twice
 * lands on the same key instead of a second copy under a new name. Hashing a
 * large file costs a second or two of reading it; uploading a duplicate of it
 * costs the whole transfer.
 */
async function fileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Does this MP4 carry an audio track?
 *
 * Read out of the container rather than by playing the file: an <audio>-based
 * check needs playback to have started, and the browser APIs for it disagree
 * across engines. An MP4 declares each track with an `hdlr` box whose handler
 * type is `soun` for audio, which is four bytes to look for and needs no
 * decoding.
 *
 * Both ends are scanned because `moov` sits at the front of a faststart file
 * and at the back of one straight out of an editor.
 *
 * Returns undefined when it cannot tell (a webm, say) — the caller treats that
 * as "say nothing" rather than guessing.
 */
async function hasAudioTrack(file: File): Promise<boolean | undefined> {
  if (file.type !== 'video/mp4') return undefined;

  const CHUNK = 2 * 1024 * 1024;
  const chunks = [await file.slice(0, Math.min(CHUNK, file.size)).arrayBuffer()];
  if (file.size > CHUNK) chunks.push(await file.slice(file.size - CHUNK).arrayBuffer());

  for (const chunk of chunks) {
    const b = new Uint8Array(chunk);
    for (let i = 0; i + 16 < b.length; i++) {
      // 'hdlr'
      if (b[i] === 0x68 && b[i + 1] === 0x64 && b[i + 2] === 0x6c && b[i + 3] === 0x72) {
        for (let j = i + 4; j < i + 16; j++) {
          // 'soun'
          if (b[j] === 0x73 && b[j + 1] === 0x6f && b[j + 2] === 0x75 && b[j + 3] === 0x6e) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * The video field's path, turned into a patch path for a SIBLING field.
 *
 * `props.path` is Sanity's own shape — strings for object keys, `{_key}` for
 * array members — and the client's patch API wants the string spelling of the
 * same thing. Dropping the last segment moves from the video field to the
 * object holding it, so `blocks[{_key}].videoUrl` + `poster` comes out as
 * `blocks[_key=="block-0"].poster`, and a top-level `video` + `image` simply
 * as `image`.
 *
 * Matched by KEY and never by index, for the reason every patch in this repo
 * is: an index is a statement about the array as it was when the form loaded,
 * and a block moved in the meantime makes it a statement about the wrong
 * block. The key travels with the item.
 */
function siblingPath(path: Path, field: string): string {
  let out = '';
  for (const seg of path.slice(0, -1)) {
    if (typeof seg === 'string') out += out ? `.${seg}` : seg;
    else if (typeof seg === 'number') out += `[${seg}]`;
    else if (seg && typeof seg === 'object' && '_key' in seg) out += `[_key=="${seg._key}"]`;
  }
  return out ? `${out}.${field}` : field;
}

export function R2VideoInput(props: StringInputProps) {
  const { value, onChange, elementProps, path, schemaType } = props;
  const client = useClient({ apiVersion: '2024-10-01' });
  const { projectId = '', token: configuredToken } = client.config();

  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  /*
   * The file stays in state after the upload, and only for the poster panel:
   * a frame can be read from the local File and not from the R2 URL, because
   * a cross-origin video taints the canvas. Cleared when the panel is done, so
   * a Studio left open for an afternoon is not holding a stack of videos in
   * memory.
   */
  const [captured, setCaptured] = useState<File | null>(null);

  /* Opt-in, per schema: `options: { posterField: 'image' }` on the video
     field. A video field with no target simply never offers the panel —
     better than guessing at a field name and patching something else. */
  const posterField = schemaType.options?.posterField;
  /* Default false: silence is what every field here did before the portfolio
     tile grew a control bar, and it is the safe half of the warning to get
     wrong. */
  const playsAudio = schemaType.options?.playsAudio ?? false;
  const documentId = useFormValue(['_id']) as string | undefined;
  const posterPath = useMemo(
    () => (posterField ? siblingPath(path, posterField) : null),
    [path, posterField]
  );

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setWarning(null);
      setStatus(null);

      const token = sessionToken(projectId, configuredToken);
      if (!token) {
        setError('Could not read your Studio session. Reload the page and try again.');
        return;
      }

      setProgress(0);
      try {
        setStatus('Reading the file');
        const [hash, audio] = await Promise.all([fileHash(file), hasAudioTrack(file)]);

        /*
         * Said, not fixed. Removing a track means rewriting the container and
         * a browser has no ffmpeg, so the honest thing is to name the cost and
         * the one command that changes it.
         *
         * WHICH ADVICE IS RIGHT DEPENDS ON THE FIELD, and this block used to
         * give one answer to every field: that nothing on the site plays
         * audio, so strip it. That stopped being true when the portfolio tile
         * got the browser's own control bar, and the wrong half is the
         * expensive one — a tile uploaded through the advice it used to give
         * shows a volume button the browser greys out, which reads as the SITE
         * refusing to unmute rather than as a file with nothing in it.
         */
        if (playsAudio) {
          /* `undefined` is "could not tell" — a webm, say — and says nothing.
             Only an explicit no is worth warning about. */
          if (audio === false) {
            setWarning(
              'This file has no audio track, so the tile shows a volume button that the browser ' +
                'greys out. If it is meant to be heard, re-upload it with ' +
                '`scripts/upload-r2.mjs <file> <key> --keep-audio` — the script strips the ' +
                'track unless you ask.'
            );
          }
        } else if (audio) {
          setWarning(
            'This file has an audio track and this field is a silent loop — the site holds it ' +
              'muted for the life of the page, so the track is bytes nobody can ever hear. ' +
              'Upload with scripts/upload-r2.mjs to strip it.'
          );
        }

        const signed = await fetch(SIGN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            hash,
          }),
        });

        if (!signed.ok) {
          const body = await signed.json().catch(() => ({}));
          throw new Error(body.error ?? `Could not start the upload (${signed.status}).`);
        }

        const { uploadUrl, publicUrl, contentType, exists } = await signed.json();

        /* Already in the bucket, byte for byte. Nothing to send. */
        if (exists) {
          onChange(set(publicUrl));
          setStatus('Already uploaded — reused the file already in the bucket.');
          /* Still offer the poster. The bucket having the video says nothing
             about whether anybody ever took a still of it. */
          setCaptured(file);
          return;
        }

        setStatus(null);

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
        setCaptured(file);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setProgress(null);
      }
    },
    [projectId, configuredToken, onChange, playsAudio]
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
        tone={error ? 'critical' : warning ? 'caution' : 'transparent'}
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
                ? (status ?? `Uploading to R2 — ${progress}%`)
                : (error ??
                  warning ??
                  status ??
                  'Drop an .mp4 or .webm here. It goes to Cloudflare R2, not Sanity.')}
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

      {captured && posterPath && documentId && (
        <PosterCapture
          file={captured}
          documentId={documentId}
          fieldPath={posterPath}
          fieldLabel={posterField as string}
          onDone={() => setCaptured(null)}
        />
      )}
    </Stack>
  );
}

export default R2VideoInput;
