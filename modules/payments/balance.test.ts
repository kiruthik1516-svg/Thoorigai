import { describe, expect, it } from 'vitest'
import { balanceAfterPayment } from './balance'

const ledger = [
  { id: 'RCPT-3', amount: 500000, payment_date: '2026-07-02', instance_number: 2, created_at: '2026-07-02T10:00:00Z' },
  { id: 'RCPT-1', amount: 300000, payment_date: '2026-06-01', instance_number: 1, created_at: '2026-06-01T10:00:00Z' },
  { id: 'RCPT-9', amount: 200000, payment_date: '2026-08-15', instance_number: 3, created_at: '2026-08-15T10:00:00Z' },
]
const student = { total: 1500000, paid: 1000000 }

describe('balanceAfterPayment', () => {
  it('counts only this payment and the ones before it', () => {
    expect(balanceAfterPayment('RCPT-1', ledger, student)).toBe(12000)
    expect(balanceAfterPayment('RCPT-3', ledger, student)).toBe(7000)
    expect(balanceAfterPayment('RCPT-9', ledger, student)).toBe(5000)
  })

  it('falls back to the current balance when the payment is not in the ledger, and never goes below zero', () => {
    expect(balanceAfterPayment('missing', ledger, student)).toBe(5000)
    expect(balanceAfterPayment('RCPT-9', ledger, { total: 900000, paid: 1000000 })).toBe(0)
  })
})
