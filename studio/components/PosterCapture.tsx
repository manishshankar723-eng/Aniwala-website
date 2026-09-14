/**
 * Pick a still for the video that was just dropped, and file it.
 *
 * Appears under the drop zone after an upload, because that is the only moment
 * the original FILE is in the browser — the frame has to come from it rather
 * than from the R2 URL, or the canvas is cross-origin and tainted and every
 * pixel read throws. See `posterFrame.ts` for that and for how the automatic
 * pick is scored.
 *
 * THE SCRUBBER IS NOT A NICETY. The automatic pick guarantees "not black",
 * which is the failure that actually shipped; it cannot know that the title
 * card is the frame you wanted. On the homepage reel it lands on a shape
 * mid-transition — a perfectly legible frame, and not the one a person would
 * choose. So the default is there to stop the bad outcome and the slider is
 * there for the good one, and neither is decoration.
 *
 * WHY IT PATCHES THROUGH THE CLIENT rather than through `onChange`. The patch
 * has to land on a DIFFERENT field from the one this input owns — the video
 * field is a string, the poster is an image beside it — and an input's
 * `onChange` only ever applies at its own path. Patching the open document by
 * id is the supported way to reach a sibling; the form is backed by the same
 * document store, so the image appears in the field above without a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text } from '@sanity/ui';
import { useClient } from 'sanity';
import { grabFrame, openVideo, pickFrame, release } from './posterFrame';

interface Props {
  file: File;
  /** The open document, draft id included — whatever the form is editing. */
  documentId: string;
  /** Where the image goes, as a patch path: `image`, or
      `blocks[_key=="block-0"].poster`. Built by the caller from the field's
      own path, so this works the same for a top-level field and one nested in
      a page-builder block. */
  fieldPath: string;
  /** Shown in the panel header so it is obvious where this is about to go. */
  fieldLabel: string;
  onDone: () => void;
}

const PREVIEW_W = 320;

export function PosterCapture({ file, documentId, fieldPath, fieldLabel, onDone }: Props) {
  const client = useClient({ apiVersion: '2024-10-01' });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  /* Draws whatever `time` currently is into the preview. Sequential by
     construction — one video, one playhead — so a drag that fires twenty
     times is queued rather than raced. */
  const draw = useCallback(async (at: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    try {
      const blob = await grabFrame(video, at);
      const bitmap = await createImageBitmap(blob);
      canvas.width = PREVIEW_W;
      canvas.height = Math.round((PREVIEW_W * bitmap.height) / bitmap.width);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
    } catch {
      /* A failed preview draw is not worth a visible error — the frame that
         matters is the one taken on save, and that reports for itself. */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let video: HTMLVideoElement | null = null;

    (async () => {
      try {
        video = await openVideo(file);
        if (cancelled) {
          release(video);
          return;
        }
        videoRef.current = video;
        setDuration(video.duration || 0);

        const best = await pickFrame(video);
        if (cancelled) return;
        setTime(best.time);
        await draw(best.time);
        if (!cancelled) setState('ready');
      } catch (e) {
        if (!cancelled) {
          setState('error');
          setMessage((e as Error).message);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (videoRef.current) release(videoRef.current);
      videoRef.current = null;
    };
  }, [file, draw]);

  const save = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setState('saving');
    setMessage(null);
    try {
      const blob = await grabFrame(video, time);
      const asset = await client.assets.upload('image', blob, {
        filename: `${file.name.replace(/\.[^.]+$/, '')}-poster.jpg`,
        contentType: 'image/jpeg',
      });

      await client
        .patch(documentId)
        .set({
          [fieldPath]: {
            _type: 'image',
            asset: { _type: 'reference', _ref: asset._id },
          },
        })
        .commit();

      setState('done');
      setMessage(`Saved to ${fieldLabel}.`);
      onDone();
    } catch (e) {
      setState('error');
      setMessage((e as Error).message);
    }
  }, [client, documentId, fieldPath, fieldLabel, file.name, onDone, time, videoRef]);

  const busy = state === 'loading' || state === 'saving';

  return (
    <Card padding={3} radius={2} border tone={state === 'error' ? 'critical' : 'transparent'}>
      <Stack gap={3}>
        <Text size={1} weight="semibold">
          Poster frame
        </Text>

        <Box>
          {/* Sized by the drawn frame, so the box does not jump when the
              first preview lands. */}
          <canvas
            ref={canvasRef}
            style={{ width: '100%', maxWidth: PREVIEW_W, borderRadius: 4, display: 'block' }}
          />
        </Box>

        {duration > 0 && (
          <input
            type="range"
            min={0}
            max={duration}
            step={Math.max(0.04, duration / 500)}
            value={time}
            disabled={busy}
            onChange={(e) => {
              const at = Number(e.currentTarget.value);
              setTime(at);
              void draw(at);
            }}
            style={{ width: '100%' }}
          />
        )}

        <Flex align="center" justify="space-between" gap={3}>
          <Box flex={1}>
            <Text size={1} muted>
              {state === 'loading'
                ? 'Reading the video and picking a frame…'
                : state === 'saving'
                  ? 'Saving…'
                  : (message ??
                    `${time.toFixed(2)}s — drag to choose a different frame, then save it to ${fieldLabel}.`)}
            </Text>
          </Box>
          <Button
            mode="ghost"
            text={state === 'done' ? 'Saved' : 'Use this frame'}
            disabled={busy || state === 'done'}
            onClick={() => void save()}
          />
        </Flex>
      </Stack>
    </Card>
  );
}

export default PosterCapture;
