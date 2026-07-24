"use client";

import { useSyncExternalStore } from 'react'
import styles from './GlobalDismissOverlay.module.css'

const STORAGE_KEY = 'hanhan-movie.global-dismiss-overlay.next-show-at'
const HIDE_DURATION_MS = 5 * 60 * 1000

let isVisible = false
let storageListenerAttached = false
let revealTimerId = null
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => {
    listener()
  })
}

function clearRevealTimer() {
  if (revealTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(revealTimerId)
  }

  revealTimerId = null
}

function setVisible(nextVisible) {
  isVisible = nextVisible
  emit()
}

function scheduleReveal(nextShowAt) {
  if (typeof window === 'undefined') {
    return
  }

  clearRevealTimer()
  setVisible(false)

  const delay = Math.max(0, nextShowAt - Date.now())
  revealTimerId = window.setTimeout(() => {
    revealTimerId = null

    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage failures; the overlay still becomes visible again.
    }

    setVisible(true)
  }, delay)
}

function readNextShowAt() {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY)
    const nextShowAt = storedValue ? Number(storedValue) : 0

    if (Number.isFinite(nextShowAt) && nextShowAt > Date.now()) {
      return nextShowAt
    }

    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Keep the overlay harmless if storage is unavailable.
  }

  return 0
}

function syncFromStorage() {
  if (typeof window === 'undefined') {
    return
  }

  const nextShowAt = readNextShowAt()

  if (nextShowAt > Date.now()) {
    scheduleReveal(nextShowAt)
    return
  }

  clearRevealTimer()
  setVisible(true)
}

function handleStorage(event) {
  if (event.key !== STORAGE_KEY) {
    return
  }

  syncFromStorage()
}

function subscribe(listener) {
  listeners.add(listener)

  if (typeof window !== 'undefined') {
    syncFromStorage()

    if (!storageListenerAttached) {
      window.addEventListener('storage', handleStorage)
      storageListenerAttached = true
    }
  }

  return () => {
    listeners.delete(listener)

    if (listeners.size === 0 && typeof window !== 'undefined' && storageListenerAttached) {
      window.removeEventListener('storage', handleStorage)
      storageListenerAttached = false
      clearRevealTimer()
    }
  }
}

function getSnapshot() {
  return isVisible
}

function getServerSnapshot() {
  return false
}

export default function GlobalDismissOverlay() {
  // Disabled by user request to improve UX and hide ads/overlay
  return null
}
