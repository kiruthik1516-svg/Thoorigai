import { NextResponse } from 'next/server'
import { brand } from '@/lib/brand'
import { withApi } from '@/lib/http/handler'
import packageJson from '../../../package.json'

export const GET = withApi({ public: true }, async () =>
  NextResponse.json({
    ok: true,
    service: `${brand.shortName.toLowerCase()}-admin-dashboard`,
    version: packageJson.version,
    // F-31: the commit SHA is no longer public; deployments are identified in Vercel.
    timestamp: new Date().toISOString(),
  }),
)
