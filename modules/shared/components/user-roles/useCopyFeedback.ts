'use client'

import { useState } from 'react'

async function writeToClipboard(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return
    }
    throw new Error('Clipboard API unavailable')
  } catch {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    } catch {
      // Ignore fallback failure silently
    }
  }
}

/** Copies text and remembers, for 2.5 seconds, which code or link was copied (for the check-mark feedback). */
export function useCopyFeedback() {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  const copy = async (text: string, id: string, type: 'code' | 'link') => {
    await writeToClipboard(text)
    if (type === 'code') {
      setCopiedCodeId(id)
      setTimeout(() => setCopiedCodeId(null), 2500)
    } else {
      setCopiedLinkId(id)
      setTimeout(() => setCopiedLinkId(null), 2500)
    }
  }

  return { copy, copiedCodeId, copiedLinkId }
}
