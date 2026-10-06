/** The 11-character id from a youtube.com/watch?v= URL, or undefined. */
export function youtubeId(watchUrl: string): string | undefined {
  const match = /[?&]v=([\w-]{11})/.exec(watchUrl);
  return match?.[1];
}

/**
 * Privacy-enhanced embed URL: no tracking cookies until the viewer presses
 * play, no unrelated recommendations at the end, and inline playback on iOS
 * instead of forcing fullscreen.
 */
export function embedUrl(watchUrl: string): string | undefined {
  const id = youtubeId(watchUrl);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : undefined;
}
