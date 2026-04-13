'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureScreenWithout, uploadScreenshot } from '../../lib/captureScreen';

type FeedbackType = 'bug' | 'improvement' | 'feature'
type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low'

const API_BASE = 'https://api.databiz.app'

const ITEM_TYPES: { value: FeedbackType; label: string; emoji: string }[] = [
  { value: 'bug', label: 'Bug', emoji: '🐛' },
  { value: 'improvement', label: 'Verbetering', emoji: '✨' },
  { value: 'feature', label: 'Nieuwe wens', emoji: '💡' },
]

const PRIORITIES: { value: FeedbackPriority; label: string }[] = [
  { value: 'critical', label: 'Kritiek' },
  { value: 'high', label: 'Hoog' },
  { value: 'medium', label: 'Normaal' },
  { value: 'low', label: 'Laag' },
]

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: 'Wat gaat er mis? Wat deed je, en wat verwachtte je te zien?',
  improvement: 'Wat kan er beter, en waarom zou dat helpen?',
  feature: 'Wat wil je graag zien? Beschrijf de use case.',
}

export function FeedbackDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [itemType, setItemType] = useState<FeedbackType>('bug')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const capturingRef = useRef(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const resetForm = useCallback(() => {
    setDescription('')
    setItemType('bug')
    setPriority('medium')
    setSubmitted(false)
    setSubmitError(null)
    setScreenshotBlob(null)
    setScreenshotPreview(null)
    setCaptureError(null)
  }, [])

  const handleCapture = useCallback(async () => {
    if (capturingRef.current) return
    capturingRef.current = true
    setCapturing(true)
    setCaptureError(null)
    const result = await captureScreenWithout(drawerRef.current)
    capturingRef.current = false
    setCapturing(false)
    if (result) {
      setScreenshotBlob(result.blob)
      setScreenshotPreview(result.dataUrl)
    } else {
      setCaptureError('Schermafbeelding mislukt. Probeer opnieuw.')
    }
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    timerRef.current = setTimeout(resetForm, 300)
  }, [resetForm])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, handleClose])

  async function handleSubmit() {
    if (!description.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const title = description.trim().slice(0, 80) || `${itemType} via showcase`
      const res = await fetch(`${API_BASE}/api/v1/backlog/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description.trim(),
          source: 'showcase',
          item_type: itemType,
          priority,
          target_app: 'showcase',
        }),
      })
      if (!res.ok) {
        setSubmitError('Versturen mislukt. Probeer het opnieuw.')
        return
      }
      const capturedBlob = screenshotBlob
      setScreenshotBlob(null)
      setScreenshotPreview(null)
      setCaptureError(null)
      if (capturedBlob) {
        const created = await res.json() as { id: string }
        void uploadScreenshot(created.id, capturedBlob, API_BASE)
      }
      setSubmitted(true)
      timerRef.current = setTimeout(handleClose, 1800)
    } catch {
      setSubmitError('Geen verbinding. Probeer het opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={handleClose}
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Feedback geven"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0, bottom: 0, right: 0,
          width: 'min(340px, 90vw)',
          background: '#fff',
          borderLeft: '1px solid #e5e7eb',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease-in-out',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 52, borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Feedback geven</span>
          <button onClick={handleClose} aria-label="Sluiten" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {submitted ? (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Bedankt voor je feedback!</p>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>We nemen het zo snel mogelijk op.</p>
            </div>
          ) : (
            <>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Type</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {ITEM_TYPES.map(t => (
                    <button key={t.value} onClick={() => setItemType(t.value)} style={{
                      flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 600,
                      borderRadius: 6, border: '2px solid',
                      borderColor: itemType === t.value ? '#111827' : '#e5e7eb',
                      background: itemType === t.value ? '#111827' : '#fff',
                      color: itemType === t.value ? '#fff' : '#6b7280',
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}>
                      <span style={{ marginRight: 2 }}>{t.emoji}</span>{t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Urgentie</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {PRIORITIES.map(p => (
                    <button key={p.value} onClick={() => setPriority(p.value)} style={{
                      padding: '6px 4px', fontSize: 11, fontWeight: 600,
                      borderRadius: 6, border: '2px solid',
                      borderColor: priority === p.value ? '#111827' : '#e5e7eb',
                      background: priority === p.value ? '#111827' : '#fff',
                      color: priority === p.value ? '#fff' : '#6b7280',
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Omschrijving <span style={{ textTransform: 'none', fontWeight: 400 }}>(verplicht)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={PLACEHOLDERS[itemType]}
                  rows={5}
                  style={{
                    marginTop: 8, width: '100%', boxSizing: 'border-box',
                    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
                    padding: '8px 12px', fontSize: 13, color: '#111827',
                    resize: 'none', outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            </>
          )}
        </div>

        {!submitted && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {/* Screenshot sectie */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Schermafbeelding <span style={{ fontWeight: 400, textTransform: 'none' }}>(optioneel)</span>
              </div>
              {screenshotPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px', background: '#f9fafb' }}>
                  <img src={screenshotPreview} alt="preview" style={{ width: '64px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '11px', color: '#374151' }}>screenshot.png</div>
                    <button
                      type="button"
                      onClick={() => { setScreenshotBlob(null); setScreenshotPreview(null); setCaptureError(null) }}
                      style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '2px' }}
                      aria-label="Screenshot verwijderen"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCapture}
                    disabled={capturing}
                    style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: 500, border: '2px dashed #d1d5db', borderRadius: '6px', background: 'transparent', color: '#6b7280', cursor: capturing ? 'not-allowed' : 'pointer', opacity: capturing ? 0.5 : 1 }}
                  >
                    <span aria-hidden="true">📷</span> {capturing ? 'Bezig...' : 'Scherm vastleggen'}
                  </button>
                  {captureError && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>{captureError}</p>}
                </>
              )}
            </div>
            {submitError && (
              <p style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', margin: 0 }}>
                {submitError}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={handleClose} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, color: '#6b7280', cursor: 'pointer' }}>
                Annuleren
              </button>
              <button onClick={handleSubmit} disabled={!description.trim() || submitting} style={{
                padding: '6px 16px', fontSize: 12, fontWeight: 700,
                background: description.trim() && !submitting ? '#111827' : '#e5e7eb',
                border: 'none', borderRadius: 6,
                color: description.trim() && !submitting ? '#fff' : '#9ca3af',
                cursor: description.trim() && !submitting ? 'pointer' : 'not-allowed',
                transition: 'all 150ms ease',
              }}>{submitting ? 'Versturen...' : 'Versturen'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Verticaal tabje */}
      <button
        onClick={() => setIsOpen(v => !v)}
        aria-label="Feedback geven"
        aria-expanded={isOpen}
        style={{
          position: 'fixed',
          bottom: '10%',
          right: isOpen ? 'min(340px, 90vw)' : 0,
          zIndex: 51,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          background: '#111827',
          color: '#fff',
          fontSize: 11, fontWeight: 700,
          padding: '12px 7px',
          borderRadius: '6px 0 0 6px',
          border: 'none', cursor: 'pointer',
          letterSpacing: '0.06em',
          boxShadow: '-3px 0 12px rgba(0,0,0,0.15)',
          transition: 'right 300ms ease-in-out',
          userSelect: 'none',
        }}
      >
        Feedback
      </button>
    </>
  )
}
