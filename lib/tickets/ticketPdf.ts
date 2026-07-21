import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'
import { StandardFonts } from 'pdf-lib'
import { safeFetch } from '@/lib/ssrfGuard'
import { INSTRUMENT_SERIF_TTF_B64 } from './instrumentSerifFont'

/**
 * Poster-grade PDF tickets (Phase 33). SERVER ONLY — tokens are signed
 * upstream and passed in; this module just renders.
 *
 * One document, one A5 page per ticket: the event artwork and fonts are
 * embedded once, so a 4-ticket order stays a single small file. The design is
 * the cinematic brand — ink black, flame red, Instrument Serif display type —
 * so a forwarded ticket reads as an AlbaGo artifact, not a receipt.
 */

export type TicketPdfTicket = {
  serial: string
  /** Signed ALBGO1. token — becomes the QR payload. */
  token: string
  tierName: string | null
}

export type TicketPdfInput = {
  eventTitle: string
  /** e.g. "FRI 11 JUL 2026" — already localized/uppercased by the caller. */
  dateLabel: string
  /** e.g. "21:00 – 04:00" or null. */
  timeLabel: string | null
  /** "Venue · City, Country" or "Online event". */
  venueLine: string
  addressLine: string | null
  /** Absolute event URL for the footer. */
  eventUrl: string
  /** Event artwork (banner) URL — fetched and embedded when reachable. */
  artUrl: string | null
  tickets: TicketPdfTicket[]
}

// A5 portrait
const PAGE_W = 420
const PAGE_H = 595

const INK = rgb(0.031, 0.031, 0.047) // ~#08080c
const INK_PANEL = rgb(0.055, 0.055, 0.075)
const FLAME = rgb(0.933, 0.11, 0.145) // #ee1c25
const WHITE = rgb(1, 1, 1)
const GREY = rgb(0.62, 0.62, 0.66)
const GREY_DIM = rgb(0.42, 0.42, 0.46)

const ART_H = 218
const MAX_ART_BYTES = 4 * 1024 * 1024

async function fetchArt(
  doc: PDFDocument,
  artUrl: string | null,
): Promise<PDFImage | null> {
  if (!artUrl) return null
  try {
    const res = await safeFetch(artUrl, { timeoutMs: 6000 })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_ART_BYTES) return null
    if (type.includes('png') || (buf[0] === 0x89 && buf[1] === 0x50)) {
      return await doc.embedPng(buf)
    }
    if (
      type.includes('jpeg') ||
      type.includes('jpg') ||
      (buf[0] === 0xff && buf[1] === 0xd8)
    ) {
      return await doc.embedJpg(buf)
    }
    return null
  } catch {
    return null // art is decoration — the ticket must render without it
  }
}

/** Greedy word-wrap capped at `maxLines`; last line ellipsized on overflow. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (line && lines.length === maxLines && lines[maxLines - 1] !== line) {
    let last = `${lines[maxLines - 1]}…`
    while (font.widthOfTextAtSize(last, size) > maxWidth && last.length > 2) {
      last = `${last.slice(0, -2)}…`
    }
    lines[maxLines - 1] = last
  }
  return lines
}

function drawDashedRule(page: PDFPage, y: number, x0: number, x1: number) {
  for (let x = x0; x < x1; x += 10) {
    page.drawRectangle({
      x,
      y,
      width: 5,
      height: 1,
      color: rgb(1, 1, 1),
      opacity: 0.16,
    })
  }
}

async function drawTicketPage(
  doc: PDFDocument,
  input: TicketPdfInput,
  ticket: TicketPdfTicket,
  art: PDFImage | null,
  serif: PDFFont,
  sans: PDFFont,
  sansBold: PDFFont,
  mono: PDFFont,
) {
  const page = doc.addPage([PAGE_W, PAGE_H])
  const margin = 28

  // Ink base
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: INK })

  // Artwork header — cover-cropped into the top band. Horizontal overflow
  // falls off-page; vertical overflow is painted over by the body panel below.
  if (art) {
    const scale = Math.max(PAGE_W / art.width, ART_H / art.height)
    const w = art.width * scale
    const h = art.height * scale
    page.drawImage(art, {
      x: (PAGE_W - w) / 2,
      y: PAGE_H - ART_H - (h - ART_H) / 2,
      width: w,
      height: h,
    })
    // Scrim fade into ink so the kicker text always reads.
    for (let i = 0; i < 6; i++) {
      page.drawRectangle({
        x: 0,
        y: PAGE_H - ART_H + i * 10,
        width: PAGE_W,
        height: 10,
        color: INK,
        opacity: 0.42 - i * 0.07,
      })
    }
  } else {
    // Brand backdrop: ink with a flame glow block.
    page.drawRectangle({
      x: 0,
      y: PAGE_H - ART_H,
      width: PAGE_W,
      height: ART_H,
      color: INK_PANEL,
    })
    page.drawRectangle({
      x: 0,
      y: PAGE_H - ART_H,
      width: PAGE_W,
      height: 4,
      color: FLAME,
    })
    page.drawText('ALBAGO', {
      x: margin,
      y: PAGE_H - 54,
      size: 26,
      font: serif,
      color: WHITE,
      opacity: 0.16,
    })
  }
  // Body panel covers any art spill below the header band.
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H - ART_H,
    color: INK,
  })

  // ---- Text block under the art -------------------------------------------
  let y = PAGE_H - ART_H - 34

  // Flame time kicker — TIME PROMINENT, always the first thing read.
  const kicker = input.timeLabel
    ? `${input.dateLabel} · ${input.timeLabel}`
    : input.dateLabel
  page.drawText(kicker, {
    x: margin,
    y,
    size: 12.5,
    font: sansBold,
    color: FLAME,
  })
  y -= 12

  // Display title (Instrument Serif)
  const titleSize = 27
  const titleLines = wrapText(
    input.eventTitle,
    serif,
    titleSize,
    PAGE_W - margin * 2,
    2,
  )
  for (const line of titleLines) {
    y -= titleSize + 4
    page.drawText(line, { x: margin, y, size: titleSize, font: serif, color: WHITE })
  }

  y -= 20
  page.drawText(input.venueLine, {
    x: margin,
    y,
    size: 11,
    font: sansBold,
    color: WHITE,
    opacity: 0.88,
  })
  if (input.addressLine) {
    y -= 15
    page.drawText(input.addressLine, {
      x: margin,
      y,
      size: 9.5,
      font: sans,
      color: GREY,
    })
  }

  y -= 22
  drawDashedRule(page, y, margin, PAGE_W - margin)

  // ---- QR block ------------------------------------------------------------
  const qrPng = await QRCode.toBuffer(ticket.token, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 480,
    color: { dark: '#000000', light: '#ffffff' },
  })
  const qrImage = await doc.embedPng(qrPng)

  const qrBox = 148
  const qrPad = 12
  const qrY = y - 30 - qrBox - qrPad * 2
  page.drawRectangle({
    x: margin,
    y: qrY,
    width: qrBox + qrPad * 2,
    height: qrBox + qrPad * 2,
    color: WHITE,
  })
  page.drawImage(qrImage, {
    x: margin + qrPad,
    y: qrY + qrPad,
    width: qrBox,
    height: qrBox,
  })

  // Right column next to the QR
  const colX = margin + qrBox + qrPad * 2 + 20
  let colY = qrY + qrBox + qrPad * 2 - 16
  const rightLabel = (label: string, value: string, valueFont: PDFFont, size = 13) => {
    page.drawText(label.toUpperCase(), {
      x: colX,
      y: colY,
      size: 7.5,
      font: sansBold,
      color: GREY_DIM,
    })
    colY -= size + 4
    page.drawText(value, { x: colX, y: colY, size, font: valueFont, color: WHITE })
    colY -= 22
  }
  if (ticket.tierName) rightLabel('Ticket', ticket.tierName, sansBold, 12)
  rightLabel('Serial', ticket.serial, mono, 13)
  rightLabel('Price', 'Free', sansBold, 12)

  page.drawText('Show this code at the door', {
    x: colX,
    y: qrY + 6,
    size: 8.5,
    font: sans,
    color: GREY,
  })

  // ---- Footer --------------------------------------------------------------
  drawDashedRule(page, 64, margin, PAGE_W - margin)
  page.drawText('ALBAGO', {
    x: margin,
    y: 40,
    size: 15,
    font: serif,
    color: WHITE,
  })
  page.drawRectangle({ x: margin + 66, y: 40, width: 3, height: 12, color: FLAME })
  page.drawText(input.eventUrl.replace(/^https?:\/\/(www\.)?/, ''), {
    x: margin + 78,
    y: 43,
    size: 8.5,
    font: sans,
    color: GREY,
  })
  page.drawText(
    'Valid for one entry — the first scan at the door wins. Non-transferable once scanned.',
    { x: margin, y: 24, size: 7.5, font: sans, color: GREY_DIM },
  )
}

export async function buildTicketPdf(input: TicketPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(`AlbaGo ticket — ${input.eventTitle}`)
  doc.setAuthor('AlbaGo')

  let serif: PDFFont
  try {
    serif = await doc.embedFont(
      Uint8Array.from(Buffer.from(INSTRUMENT_SERIF_TTF_B64, 'base64')),
      { subset: true },
    )
  } catch {
    serif = await doc.embedFont(StandardFonts.TimesRomanBold)
  }
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.CourierBold)

  const art = await fetchArt(doc, input.artUrl)

  for (const ticket of input.tickets) {
    await drawTicketPage(doc, input, ticket, art, serif, sans, sansBold, mono)
  }

  return doc.save()
}
