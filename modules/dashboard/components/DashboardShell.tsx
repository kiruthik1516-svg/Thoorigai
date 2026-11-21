'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import type { Role } from '@/lib/types'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'

import { SettingsDrawer } from '@/components/ui/SettingsDrawer'
import { useDialog } from '@/lib/hooks/useDialog'

/** Below this width (and on short landscape phones) navigation lives in the slide-over drawer. */
const DRAWER_QUERY = '(max-width: 1023px), (max-height: 500px)'

export function DashboardShell({ role, children }: { role: Role; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Escape, the phone's Back button and focus handling for the drawer.
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeDrawer = useCallback(() => setMobileOpen(false), [])
  useDialog(mobileOpen, closeDrawer, drawerRef)

  const handleToggleMenu = () => {
    if (typeof window !== 'undefined' && window.matchMedia(DRAWER_QUERY).matches) {
      setMobileOpen((prev) => !prev)
    } else {
      setCollapsed((prev) => !prev)
    }
  }

  return (
    <div className="app-shell w-full h-screen h-[100dvh] box-border flex overflow-hidden">
      {/* F-38: keyboard users can jump past the navigation. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {/* Full-width Inner Workspace */}
      <div className="app-shell-inner flex w-full h-full min-h-0 overflow-hidden">
        {/* Desktop / Large Screen Sidebar */}
        <Sidebar role={role} collapsed={collapsed} />

        {/* Mobile / Tablet / Foldable Slide-Over Drawer */}
        {mobileOpen && (
          <div
            ref={drawerRef}
            className="mobile-drawer fixed inset-0 z-50 flex"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Container */}
            <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-left duration-200 bg-[var(--shell)] border-r border-[var(--border)]">
              {/* Top Close Button for Mobile Accessibility */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--mute)]">Navigation</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="touch-target grid place-items-center rounded-lg text-[var(--mute)] hover:text-[var(--text)] transition-colors cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <Sidebar role={role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="main-area flex-1 flex flex-col min-w-0 min-h-0 h-full max-h-screen max-h-[100dvh] overflow-hidden bg-transparent">
          <Topbar onMenu={handleToggleMenu} role={role} />
          <main
            id="main-content"
            tabIndex={-1}
            className="content flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-transparent"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Global Settings Drawer (Theme + Accent) */}
      <SettingsDrawer />
    </div>
  )
}
