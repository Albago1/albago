import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react'

/** Static icon set for WMO weather codes — shared by the event detail
 *  forecast card and the protest card weather chip. Kept as a module-level
 *  map (not a component-returning function) so render-time lookups are
 *  provably static for the react-hooks/static-components rule. */
export const WEATHER_ICONS = {
  sun: Sun,
  cloudSun: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
} as const

export type WeatherIconKey = keyof typeof WEATHER_ICONS

export function weatherIconKey(code: number): WeatherIconKey {
  if (code === 0) return 'sun'
  if (code === 1 || code === 2) return 'cloudSun'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'cloud'
}

/** True for WMO codes that mean frozen precipitation ("snow" wording). */
export function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86
}
