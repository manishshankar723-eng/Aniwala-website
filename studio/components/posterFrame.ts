/**
 * Pulling a still out of a video, in the browser, with no ffmpeg.
 *
 * WHY THIS IS POSSIBLE AT ALL. A `<video>` fed a `blob:` URL from a local
 * `File` is same-origin, so a canvas it is drawn onto is NOT tainted and
 * `getImageData` works. That is the whole trick, and it is why the frame has
 * to be taken from the file the editor just dropped rather than from the R2
 * URL afterwards — a cross-origin video would taint the canvas and every read
 * would throw, CORS headers or no.
 *
 * WHY A POSTER MATTERS ENOUGH TO BUILD THIS. A `<video>` with no poster paints
 * a black rectangle until its first frame decodes, so on a cold load the
 * poster IS the hero for as long as the download takes. Before this, every
 * still on the site was a separate manual upload that nobody revisited when
 * the video changed, which is how the homepage spent a while showing a frame
 * from the middle of a previous cut.
 *
 * WHICH FRAME. Frame 0 is the obvious pick and it is usually wrong: graded
 * work opens on black or fades up, so a poster grabbed from the first frame is
 * the black rectangle it was meant to prevent. Frames are scored on CONTRAST —
 * the standard deviation of luma — rather than brightness, because brightness
 * alone rejects black and then cheerfully picks a white flash. Spread asks
 * "is there anything in this picture", which is nearer the question.
 *
 * It is a DEFAULT, not a judgement, and the difference is the point. No
 * measurement knows that the title card is the frame you wanted; the automatic
 * pick exists so the failure mode is "a reasonable frame" instead of "black",
 * and the scrubber exists because you will often want a different one.
 */

/** Where the automatic pick looks, and how finely. */
const WINDOW_S = 15;
const SAMPLES = 30;

/* The thumbnail the score is computed on. Tiny on purpose: 16x9 is 144 pixels,
   which is plenty to tell a black frame from a picture and costs nothing to
   draw thirty times. */
const GRID_W = 16;
const GRID_H = 9;

export interface FrameScore {
  time: number;
  score: number;
}

/**
 * A `<video>` holding the file, ready to seek.
 *
 * Kept out of the document deliberately — it never needs to be seen, and an
 * off-DOM element cannot be caught by a stylesheet or a stray selector. It
 * must be revoked by the caller; `release` below is that.
 */
export async function openVideo(file: File): Promise<HTMLVideoElement> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;
  /* Without this some engines decline to decode a video that is not displayed
     anywhere, and every seek resolves onto an empty frame. */
  video.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    const ok = () => resolve();
    const bad = () => reject(new Error('That file could not be read as a video.'));
    video.addEventListener('loadedmetadata', ok, { once: true });
    video.addEventListener('error', bad, { once: true });
  });

  return video;
}

/** Give the blob URL back. A page that drops several videos without this
    holds every one of them in memory until it is reloaded. */
export function release(video: HTMLVideoElement) {
  URL.revokeObjectURL(video.src);
  video.removeAttribute('src');
  video.load();
}

/**
 * Move to a timestamp and wait until the frame is actually there.
 *
 * `currentTime = t` is not synchronous and the pixels are not ready when it
 * returns — drawing straight after it yields the PREVIOUS frame, or a blank
 * one. `seeked` is the event that says the new frame is decoded and drawable.
 */
function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', fail);
      reject(new Error('Could not seek that video.'));
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', fail);
    /* Clamped just inside the end: seeking exactly to `duration` lands past
       the last frame on some engines and never fires `seeked`. */
    video.currentTime = Math.max(0, Math.min(time, (video.duration || 0) - 0.05));
  });
}

/** Luma spread of one frame, 0 (flat) upward. */
function contrast(pixels: Uint8ClampedArray): number {
  const n = pixels.length / 4;
  const luma = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    /* Rec. 601, which is what the eye weights and what "brightness" means
       here — a pure blue frame is dark, a pure green one is not. */
    const y = 0.299 * pixels[i * 4] + 0.587 * pixels[i * 4 + 1] + 0.114 * pixels[i * 4 + 2];
    luma[i] = y;
    sum += y;
  }
  const mean = sum / n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (luma[i] - mean) ** 2;
  return Math.sqrt(variance / n);
}

/**
 * Score the opening and return the best timestamp.
 *
 * Sequential rather than parallel, and that is not laziness: one `<video>` has
 * one playhead, so overlapping seeks on it resolve against each other and the
 * scores come back attached to the wrong times.
 */
export async function pickFrame(video: HTMLVideoElement): Promise<FrameScore> {
  const canvas = document.createElement('canvas');
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { time: 0, score: 0 };

  const span = Math.min(WINDOW_S, video.duration || WINDOW_S);
  const step = span / SAMPLES;

  let best: FrameScore = { time: 0, score: -1 };

  for (let i = 0; i < SAMPLES; i++) {
    const time = i * step;
    try {
      await seek(video, time);
    } catch {
      break;
    }
    ctx.drawImage(video, 0, 0, GRID_W, GRID_H);
    const score = contrast(ctx.getImageData(0, 0, GRID_W, GRID_H).data);
    if (score > best.score) best = { time, score };
  }

  return best.score < 0 ? { time: 0, score: 0 } : best;
}

/**
 * The still itself, at the video's own resolution.
 *
 * JPEG at 0.9 rather than PNG: this is a photograph of a rendered frame, and a
 * lossless copy of one is several megabytes for no visible gain. Sanity will
 * re-encode and resize it on delivery anyway.
 */
export async function grabFrame(video: HTMLVideoElement, time: number): Promise<Blob> {
  await seek(video, time);

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the frame.');
  ctx.drawImage(video, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  );
  if (!blob) throw new Error('Could not encode the frame.');
  return blob;
}
