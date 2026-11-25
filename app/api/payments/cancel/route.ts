import { apiResult, withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { cancelPaymentSchema } from '@/modules/payments/schema'
import { cancelPayment } from '@/modules/payments/service'

/** POST /api/payments/cancel — cancel an invoice (admins only); it stays on record. */
export const POST = withApi(
  { roles: rolesFor('payments', 'update'), body: cancelPaymentSchema, userRateLimit: { limit: 10, window: '1 m' } },
  async ({ body }) => apiResult(await cancelPayment(body)),
)
