import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import type { ResumeSlot } from '@/services/resumeService'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// Module-level cache — persists across panel open/close, cleared on page reload
const textCache = new Map<string, string>() // key: "{userId}:{slot}"

function cacheKey(userId: string, slot: ResumeSlot): string {
  return `${userId}:${slot}`
}

function detectFormat(url: string): 'pdf' | 'docx' | 'txt' {
  const lower = url.toLowerCase()
  if (lower.includes('.docx')) return 'docx'
  if (lower.includes('.txt')) return 'txt'
  return 'pdf'
}

async function extractPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }
  return pages.join('\n\n')
}

async function extractDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractTxt(arrayBuffer: ArrayBuffer): Promise<string> {
  return new TextDecoder('utf-8').decode(arrayBuffer)
}

export function invalidateSlot(userId: string, slot: ResumeSlot): void {
  textCache.delete(cacheKey(userId, slot))
}

export async function getResumeText(
  userId: string,
  slot: ResumeSlot,
  signedUrl: string,
): Promise<string> {
  const key = cacheKey(userId, slot)
  if (textCache.has(key)) return textCache.get(key)!
  try {
    const res = await fetch(signedUrl)
    if (!res.ok) return ''
    const arrayBuffer = await res.arrayBuffer()
    const format = detectFormat(signedUrl)
    let text = ''
    if (format === 'pdf') text = await extractPdf(arrayBuffer)
    else if (format === 'docx') text = await extractDocx(arrayBuffer)
    else text = await extractTxt(arrayBuffer)
    textCache.set(key, text)
    return text
  } catch (err) {
    console.error('[resumeTextService] getResumeText:', err)
    return ''
  }
}
