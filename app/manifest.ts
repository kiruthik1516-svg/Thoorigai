import type { MetadataRoute } from 'next'
import { brand } from '@/lib/brand'

/** Lets phones install the dashboard to the home screen (mobile audit, 2026-11-20). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.displayName} Admin`,
    short_name: brand.shortName,
    description: 'Students, fees, attendance and assessments for the academy.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: brand.theme.colors.navy,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
