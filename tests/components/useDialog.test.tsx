// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { useDialog } from '@/lib/hooks/useDialog'

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  // Let a closed dialog's spare Back entry expire so it cannot leak into the next test.
  await new Promise((resolve) => setTimeout(resolve, 450))
})

function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(true, onClose, ref)
  return (
    <div ref={ref} role="dialog" aria-label={label}>
      <button type="button">{label} action</button>
      {children}
    </div>
  )
}

function Nested() {
  const [outer, setOuter] = useState(true)
  const [inner, setInner] = useState(true)
  return outer ? (
    <Dialog label="Outer" onClose={() => setOuter(false)}>
      {inner && <Dialog label="Inner" onClose={() => setInner(false)} />}
    </Dialog>
  ) : null
}

describe('useDialog', () => {
  it('closes only the innermost dialog on Escape', async () => {
    const user = userEvent.setup()
    render(<Nested />)
    expect(screen.getByRole('dialog', { name: 'Inner' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Outer' })).not.toBeInTheDocument()
  })

  it('adds one Back entry while open and removes it when closed from the page', async () => {
    vi.useFakeTimers()
    const push = vi.spyOn(window.history, 'pushState')
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const Harness = () => {
      const [open, setOpen] = useState(true)
      return open ? <Dialog label="Solo" onClose={() => setOpen(false)} /> : null
    }
    render(<Harness />)
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(push).toHaveBeenCalledOnce()
    expect(window.history.state?.__dialog).toMatch(/^dialog-/)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(back).not.toHaveBeenCalled()
    // The entry is kept briefly so a dialog opening right after can take it over, then removed.
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(back).toHaveBeenCalledOnce()
    back.mockRestore()
    push.mockRestore()
  })
})
