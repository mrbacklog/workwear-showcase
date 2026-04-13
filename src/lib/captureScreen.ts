import { toPng } from 'html-to-image'

export async function captureScreenWithout(hideElement: HTMLElement | null): Promise<{ blob: Blob; dataUrl: string } | null> {
  const root = document.getElementById('__next') ?? document.body
  const prevVisibility = hideElement?.style.visibility ?? ''
  if (hideElement) hideElement.style.visibility = 'hidden'

  await new Promise<void>((resolve) => requestAnimationFrame(() => { requestAnimationFrame(() => resolve()) }))

  try {
    const dataUrl = await toPng(root, {
      quality: 0.85,
      pixelRatio: 1,
      skipAutoScale: true,
      filter: (node) => !(node instanceof HTMLIFrameElement),
    })
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    return { blob, dataUrl }
  } catch {
    return null
  } finally {
    if (hideElement) hideElement.style.visibility = prevVisibility
  }
}

export async function uploadScreenshot(itemId: string, blob: Blob, baseUrl: string): Promise<string | null> {
  try {
    const form = new FormData()
    form.append('file', blob, 'screenshot.png')
    const res = await fetch(`${baseUrl}/api/v1/backlog/items/${itemId}/screenshot`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) return null
    const data = await res.json() as { screenshot_url: string }
    return data.screenshot_url
  } catch {
    return null
  }
}
