-- ══════════════════════════════════════════════════════════════════════════
-- Migration: remove the payment function signatures that accepted client-sent tax
--
-- 20261118130000 kept record_payment / record_payment_idempotent with p_gst_rate, p_cgst and
-- p_sgst as wrappers (client tax ignored) so the previous deploy kept working. The app has called
-- only the new signatures since commit b46d9cb; these wrappers are now dead surface area (F-08).
-- ══════════════════════════════════════════════════════════════════════════

drop function if exists public.record_payment_idempotent(
  text, text, integer, bigint, text, date, text, text, numeric, bigint, bigint, text
);
drop function if exists public.record_payment(
  integer, bigint, text, date, text, text, numeric, bigint, bigint, text
);
