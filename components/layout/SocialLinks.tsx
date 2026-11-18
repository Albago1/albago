import { activeSocialLinks } from '@/lib/social'
import { FacebookGlyph, InstagramGlyph, TikTokGlyph } from '@/components/icons/BrandGlyphs'

/**
 * Quiet monochrome social icon row — the footer treatment every serious
 * platform uses: visible when you look for it, silent when you don't.
 * Renders nothing until lib/social.ts has real profile URLs.
 */

const GLYPHS = {
  instagram: InstagramGlyph,
  tiktok: TikTokGlyph,
  facebook: FacebookGlyph,
} as const

const LABELS = {
  instagram: 'AlbaGo on Instagram',
  tiktok: 'AlbaGo on TikTok',
  facebook: 'AlbaGo on Facebook',
} as const

export default function SocialLinks() {
  const links = activeSocialLinks()
  if (links.length === 0) return null

  return (
    <div className="flex items-center gap-2.5">
      {links.map(({ platform, url }) => {
        const Glyph = GLYPHS[platform]
        return (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={LABELS[platform]}
            title={LABELS[platform]}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:border-flame-500/40 hover:bg-flame-500/10 hover:text-flame-200"
          >
            <Glyph className="h-[18px] w-[18px]" />
          </a>
        )
      })}
    </div>
  )
}
