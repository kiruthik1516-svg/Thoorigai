'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface OpenDialog {
  marker: string
  url: string
  pushed: boolean
  closedByBack: boolean
  mounted: boolean
  container: HTMLElement | null
  close: () => void
}

/** Open dialogs, innermost last. Only the top one reacts to Escape or Back. */
const stack: OpenDialog[] = []
/** popstate events caused by our own history.back()/forward() calls, which the app router must not see. */
let ownTraversals = 0
let listening = false
/** Markers of entries we are removing right now (see onPopState). Stale markers are never in it. */
const releasing = new Set<string>()
/**
 * The Back entry of a dialog that just closed from the page, kept briefly. When another dialog opens
 * right after (the nav drawer handing over to the theme drawer, which opens in a transition) it takes
 * the entry over; otherwise it is removed. Removing it and pushing a new one at the same moment races.
 */
const SPARE_MS = 400
let spare: { url: string; marker: string; timer: number } | null = null

function takeSpare(dialog: OpenDialog) {
  if (!spare || spare.url !== window.location.href) return false
  window.clearTimeout(spare.timer)
  spare = null
  window.history.replaceState({ ...(window.history.state ?? {}), __dialog: dialog.marker }, '')
  dialog.pushed = true
  return true
}

function releaseEntry(url: string, marker: string) {
  if (spare) window.clearTimeout(spare.timer)
  spare = {
    url,
    marker,
    timer: window.setTimeout(() => {
      spare = null
      if (window.location.href !== url) return
      releasing.add(marker)
      ownTraversals += 1
      window.history.back()
    }, SPARE_MS),
  }
}

function pushEntry(dialog: OpenDialog) {
  window.history.pushState({ ...(window.history.state ?? {}), __dialog: dialog.marker }, '')
  dialog.pushed = true
}

/**
 * Runs in the capture phase, before the Next.js router's popstate listener, and hides the events that
 * belong to dialogs from it. The router treats any popstate as a navigation and discards whatever it
 * has pending (a router.refresh() after a save, a link the user just tapped), so it must only see the
 * popstate events that really change the page.
 */
function onPopState(event: PopStateEvent) {
  if (ownTraversals > 0) {
    ownTraversals -= 1
    // A navigation slipped in between our back() and the traversal, and we stepped back onto the very
    // entry we meant to remove. Step forward again, to where the router thinks it is.
    const landed = (event.state as { __dialog?: string } | null)?.__dialog
    if (landed && releasing.has(landed)) {
      ownTraversals += 1
      window.history.forward()
    } else {
      releasing.clear()
    }
    event.stopImmediatePropagation()
    return
  }
  if (spare && window.location.href === spare.url) {
    // Back pressed just after a dialog closed: that press used up the dialog's entry, so stay put.
    window.clearTimeout(spare.timer)
    spare = null
    event.stopImmediatePropagation()
    return
  }
  const top = stack[stack.length - 1]
  if (!top || !top.pushed || window.location.href !== top.url) return
  // The phone's Back button: close the innermost dialog and stay on the page.
  event.stopImmediatePropagation()
  stack.pop()
  top.closedByBack = true
  top.close()
  // If the dialog refused to close (busy saving, for example), give it a Back entry again.
  window.setTimeout(() => {
    if (!top.mounted) return
    top.closedByBack = false
    stack.push(top)
    pushEntry(top)
  }, 0)
}

/**
 * Shared behaviour for modals and drawers (mobile audit, 2026-11-20):
 * - Escape closes it,
 * - the phone's Back button closes it instead of leaving the page,
 * - focus moves into it on open, stays inside while Tab is pressed, and returns to the opener on close.
 *
 * Back support pushes one history entry with the same URL while the dialog is open. Closing it from the
 * page removes that entry again, unless a link inside it started a navigation.
 */
export function useDialog(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    if (!listening) {
      window.addEventListener('popstate', onPopState, { capture: true })
      listening = true
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = containerRef.current
    const first =
      container?.querySelector<HTMLElement>('[autofocus]') ?? container?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? container)?.focus({ preventScroll: true })

    const dialog: OpenDialog = {
      marker: `dialog-${Math.random().toString(36).slice(2)}`,
      url: window.location.href,
      pushed: false,
      closedByBack: false,
      mounted: true,
      container,
      close: () => onCloseRef.current(),
    }
    // Keep the innermost dialog on top even when nested dialogs mount together (React runs the
    // child's effect first, so the outer dialog would otherwise land above the inner one).
    const innerIndex = stack.findIndex((other) => container && other.container && container.contains(other.container))
    if (innerIndex === -1) stack.push(dialog)
    else stack.splice(innerIndex, 0, dialog)
    // Deferred one tick so React's development double-mount (mount, unmount, mount) never pushes twice.
    const pushTimer = takeSpare(dialog) ? undefined : window.setTimeout(() => pushEntry(dialog), 0)

    let navigating = false
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (link && !link.hasAttribute('download') && (link as HTMLAnchorElement).target !== '_blank') navigating = true
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== dialog) return
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !container) return
      const all = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
      // Skip controls hidden by CSS (the phone-only or desktop-only half of a layout). Without layout
      // information (jsdom) nothing has client rects, so fall back to every focusable control.
      const visible = all.filter((el) => el.getClientRects().length > 0)
      const items = visible.length > 0 ? visible : all
      if (items.length === 0) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    container?.addEventListener('click', onClick, { capture: true })
    document.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.mounted = false
      window.clearTimeout(pushTimer)
      container?.removeEventListener('click', onClick, { capture: true })
      document.removeEventListener('keydown', onKeyDown)
      const index = stack.indexOf(dialog)
      if (index !== -1) stack.splice(index, 1)
      // Closed from the page (button, Escape, save): drop the entry we pushed while we are still on it.
      // After a link tap the router is about to push the next page, so the entry is left alone.
      if (dialog.pushed && !dialog.closedByBack && !navigating && window.location.href === dialog.url) {
        releaseEntry(dialog.url, dialog.marker)
      }
      if (!navigating) opener?.focus({ preventScroll: true })
    }
  }, [open, containerRef])
}
