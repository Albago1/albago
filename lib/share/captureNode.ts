type CaptureOptions = {
  width?: number
  height?: number
}

/**
 * Snapshot a share template to a PNG data URL.
 *
 * Rendered twice on purpose: large data-URL images (the AI poster backdrop
 * is a ~full-screen JPEG) may not be decoded yet on the first rasterization
 * pass, which produces a poster with typography but a blank backdrop. The
 * warm-up render forces the decode; the second render is the keeper. This
 * also papers over Safari's long-standing blank-image-in-foreignObject
 * first-render bug.
 */
export async function captureNodePng(
  node: HTMLElement,
  opts: CaptureOptions = {},
): Promise<string> {
  const { toPng } = await import('html-to-image')
  const options = {
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#050505',
    ...(opts.width ? { width: opts.width } : {}),
    ...(opts.height ? { height: opts.height } : {}),
  }
  await toPng(node, options)
  return toPng(node, options)
}
