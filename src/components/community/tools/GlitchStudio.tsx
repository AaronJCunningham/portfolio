import Link from 'next/link'
import {useCallback, useEffect, useRef, useState} from 'react'

type Photo = {id: string; file: File; url: string}
type Job = {id: string; status: 'queued' | 'rendering' | 'complete' | 'failed'; progress: number; position?: number; error?: string; expiresAt?: number; width?: number; height?: number}
const SESSION_KEY = 'glitch-studio-job-v1'
const MAX_BYTES = 64 * 1024 * 1024

async function fetchStatus(url: string, signal?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, {once: true})
  const timeout = setTimeout(abort, 12000)
  try { return await fetch(url, {signal: controller.signal, cache: 'no-store'}) }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
}

export default function GlitchStudio() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const photosRef = useRef<Photo[]>([])
  const [format, setFormat] = useState('vertical')
  const [title, setTitle] = useState('')
  const [dragging, setDragging] = useState(false)
  const [endpoint, setEndpoint] = useState<string | null>(null)
  const [availability, setAvailability] = useState<'checking' | 'ready' | 'offline'>('checking')
  const [upload, setUpload] = useState<number | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [connectionLost, setConnectionLost] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<XMLHttpRequest | null>(null)
  const busy = upload !== null || job?.status === 'queued' || job?.status === 'rendering'
  const complete = job?.status === 'complete'

  useEffect(() => {
    const configured = process.env.NEXT_PUBLIC_GLITCH_RENDERER_URL?.replace(/\/$/, '')
    const base = configured || (process.env.NODE_ENV === 'development' ? `${location.protocol}//${location.hostname}:4319` : '')
    setEndpoint(base)
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
      if (saved?.endpoint === base && /^[a-f0-9]{48}$/.test(saved.id)) setJob({id: saved.id, status: 'queued', progress: 0})
    } catch { /* A fresh session works without persistent browser storage. */ }
    return () => {
      photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url))
      request.current?.abort()
    }
  }, [])

  const checkAvailability = useCallback(async (signal?: AbortSignal) => {
    if (endpoint === null) return
    if (!endpoint) { setAvailability('offline'); return }
    try {
      const response = await fetchStatus(`${endpoint}/health`, signal)
      if (!response.ok) throw new Error('Unavailable')
      const health = await response.json()
      setAvailability(health.available ? 'ready' : 'offline')
    } catch { if (!signal?.aborted) setAvailability('offline') }
  }, [endpoint])

  useEffect(() => {
    const controller = new AbortController()
    void checkAvailability(controller.signal)
    const interval = setInterval(() => void checkAvailability(controller.signal), 30000)
    return () => { controller.abort(); clearInterval(interval) }
  }, [checkAvailability])

  useEffect(() => {
    if (!job?.id || !endpoint || job.status === 'complete' || job.status === 'failed') return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const response = await fetchStatus(`${endpoint}/jobs/${job.id}`, controller.signal)
        const body = await response.json()
        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            setJob(current => current && {...current, status: 'failed', error: body.error})
            try { sessionStorage.removeItem(SESSION_KEY) } catch {}
            return
          }
          throw new Error('Connection interrupted')
        }
        setConnectionLost(false)
        setJob(body)
        if (body.status === 'complete' || body.status === 'failed') return
      } catch { if (controller.signal.aborted) return; setConnectionLost(true) }
      timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [job?.id, job?.status, endpoint])

  useEffect(() => {
    if (job?.status !== 'complete' || !job.expiresAt) return
    const timeout = setTimeout(() => {
      setJob(current => current && {...current, status: 'failed', error: 'This video has expired. Create another version to download it.'})
      try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    }, Math.max(0, job.expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [job?.status, job?.expiresAt])

  useEffect(() => {
    if (error && !dialog.current?.open) dialog.current?.showModal()
    if (!error && dialog.current?.open) dialog.current.close()
  }, [error])

  function replacePhotos(next: Photo[]) { photosRef.current = next; setPhotos(next) }
  function addPhotos(files: FileList | File[]) {
    if (busy) return
    const incoming = Array.from(files)
    if (!incoming.length) return
    if (photosRef.current.length + incoming.length > 32) { setError('Choose up to 32 images. Remove a few before adding more.'); return }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Use JPG, PNG or WebP images.'); return }
    if (incoming.some(file => file.size > 8 * 1024 * 1024)) { setError('Each image must be 8 MB or smaller.'); return }
    if ([...photosRef.current.map(p => p.file), ...incoming].reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) { setError('Keep your total upload under 64 MB.'); return }
    replacePhotos([...photosRef.current, ...incoming.map((file, i) => ({id: `${Date.now()}-${i}-${Math.random()}`, file, url: URL.createObjectURL(file)}))])
  }
  function removePhoto(id: string) {
    const photo = photosRef.current.find(item => item.id === id)
    if (photo) URL.revokeObjectURL(photo.url)
    replacePhotos(photosRef.current.filter(item => item.id !== id))
  }
  function resetJob() {
    setJob(null); setConnectionLost(false)
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
  }
  async function createVideo() {
    if (busy || !photos.length) return
    if (!endpoint || availability !== 'ready') { setError('Video creation is temporarily unavailable. Please try again later.'); return }
    resetJob(); setUpload(0)
    const form = new FormData()
    photos.forEach(photo => form.append('images', photo.file))
    form.append('format', format); form.append('title', title.trim())
    const xhr = new XMLHttpRequest()
    request.current = xhr
    xhr.open('POST', `${endpoint}/jobs`)
    xhr.timeout = 120000
    xhr.upload.onprogress = event => { if (event.lengthComputable) setUpload(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => {
      setUpload(null)
      let body
      try { body = JSON.parse(xhr.responseText) } catch { setError('The upload could not be completed. Please try again.'); return }
      if (xhr.status < 200 || xhr.status >= 300) { setError(body.error || 'The video could not be created. Please try again.'); void checkAvailability(); return }
      setJob({id: body.id, status: 'queued', progress: 0})
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({id: body.id, endpoint})) } catch {}
    }
    xhr.onerror = xhr.ontimeout = () => { setUpload(null); setError('The upload was interrupted. Check your connection and try again.') }
    xhr.send(form)
  }

  const videoUrl = complete ? `${endpoint}/jobs/${job.id}/video` : '/tools/glitch-studio/example.mp4'
  const status = upload !== null ? (upload < 100 ? 'Uploading your images' : 'Preparing your images')
    : job?.status === 'queued' ? (job.position ? `In the queue · position ${job.position}` : 'Getting ready')
    : job?.status === 'rendering' ? (job.progress >= 97 ? 'Finishing your MP4' : 'Creating your video') : ''

  return <main className="glitch-studio__main">
    <Link className="glitch-studio__back" href="/community/tools">← All tools</Link>
    <header className="glitch-studio__intro">
      <div>
        <p className="community-eyebrow"><span /> 02 / PHOTO TO VIDEO</p>
        <h1>Glitch <em>Studio.</em></h1>
        <p className="glitch-studio__description">I designed Glitch Studio to create videos from photos and thought it might be useful to other people, so I’ve made it free to use. Upload up to 32 photos and choose one of two video sizes for social media or Instagram posts.</p>
      </div>
      <p className="glitch-studio__spec">FREE TO CREATE<br />37 SECONDS / 30 FPS / MP4</p>
    </header>

    <div className="glitch-studio__workspace">
      <section className="glitch-studio__input" aria-label="Create your video">
        <div className="glitch-studio__section-heading"><h2><span>01</span> Your images</h2><span>{photos.length.toString().padStart(2, '0')} / 32</span></div>
        <label className={`glitch-studio__dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-disabled' : ''}`}
          onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); addPhotos(event.dataTransfer.files) }}>
          <input className="glitch-studio__file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} aria-label="Choose images" onChange={event => { if (event.target.files) addPhotos(event.target.files); event.target.value = '' }} />
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 23V5m-6 6 6-6 6 6M5 21v6h22v-6" stroke="currentColor" strokeWidth="1" /></svg>
          <strong>{photos.length ? 'Add more images' : 'Drop your images here'}</strong>
          <span>or click to choose files</span>
          <small>JPG, PNG, WEBP · 8 MB EACH · 64 MB TOTAL</small>
        </label>
        {photos.length > 0 && <>
          <div className="glitch-studio__photos" aria-label="Selected images">
            {photos.map((photo, index) => <figure key={photo.id}>
              {/* Object URLs are temporary local previews, not network assets. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.file.name} />
              <figcaption>{String(index + 1).padStart(2, '0')}</figcaption>
              <button type="button" disabled={busy} onClick={() => removePhoto(photo.id)} aria-label={`Remove ${photo.file.name}`}>×</button>
            </figure>)}
          </div>
          <button className="glitch-studio__text-button" disabled={busy} onClick={() => { photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url)); replacePhotos([]) }}>Clear images</button>
        </>}
        <p className="glitch-studio__note">Choose 1–32 photos. If you upload fewer than 32, some will be repeated. The order is shuffled to spread out repeats.</p>

        <fieldset className="glitch-studio__options" disabled={busy}>
          <legend><span>02</span> Video options</legend>
          <div className="glitch-studio__formats" role="group" aria-label="Video format">
            <label className={format === 'vertical' ? 'is-selected' : ''}><input type="radio" name="format" value="vertical" checked={format === 'vertical'} onChange={() => setFormat('vertical')} /><span className="glitch-studio__format-icon" /><span><strong>720 × 1280</strong><small>9:16 · Social media</small></span></label>
            <label className={format === 'portrait' ? 'is-selected' : ''}><input type="radio" name="format" value="portrait" checked={format === 'portrait'} onChange={() => setFormat('portrait')} /><span className="glitch-studio__format-icon is-portrait" /><span><strong>720 × 900</strong><small>4:5 · Instagram posts</small></span></label>
          </div>
          <label className="glitch-studio__title-label" htmlFor="glitch-title">Text overlay <span>OPTIONAL</span></label>
          <input id="glitch-title" className="glitch-studio__title" type="text" value={title} maxLength={36} placeholder="Your text" onChange={event => setTitle(event.target.value)} aria-describedby="glitch-title-help" />
          <p id="glitch-title-help" className="glitch-studio__note">Add up to 36 characters to your video, or leave blank for images only. Photos are cropped to fill the frame.</p>
        </fieldset>

        <div className="glitch-studio__availability" role="status">
          <span className={`glitch-studio__light is-${availability}`} />
          {availability === 'checking' ? 'Checking the studio…' : availability === 'ready' ? 'Studio ready' : 'Video creation is temporarily unavailable.'}
          {availability === 'offline' && <button className="glitch-studio__text-button" onClick={() => { setAvailability('checking'); void checkAvailability() }}>Check again</button>}
        </div>
        <button className="glitch-studio__create" disabled={busy || photos.length === 0 || availability !== 'ready'} onClick={() => void createVideo()}>
          {busy ? status : complete ? 'Make another version' : 'Create my video'}<span aria-hidden="true">↗</span>
        </button>
        <p className="glitch-studio__privacy">No account. Up to 3 videos per hour. Images are deleted after processing; videos expire after one hour. Rendering continues if you leave this page.</p>
      </section>

      <section className="glitch-studio__output" aria-label="Video preview">
        <div className="glitch-studio__section-heading"><h2>{complete ? 'Your video' : 'Video preview'}</h2><span>{complete ? 'READY TO DOWNLOAD' : busy ? 'PROCESSING' : 'EXAMPLE VIDEO'}</span></div>
        <div className={`glitch-studio__screen${complete && job.width === 720 && job.height === 900 ? ' is-portrait' : ''}`}>
          {busy ? <div className="glitch-studio__progress" role="status" aria-live="polite">
            <span className="glitch-studio__progress-mark" aria-hidden="true">G<span>/</span>S</span>
            <h3>{status}</h3>
            <progress max="100" value={upload !== null ? upload : job?.progress || 0} aria-label={status} />
            <p>{upload !== null ? `${upload}% uploaded` : job?.status === 'rendering' ? `${job.progress}% rendered` : 'Waiting to start.'}</p>
            <small>{connectionLost ? 'Connection interrupted. Reconnecting automatically…' : upload !== null ? 'Keep this page open until the upload finishes.' : 'We’re rendering your video. You can come back to this tab.'}</small>
          </div> : <video key={videoUrl} src={videoUrl} controls playsInline preload="none" poster={complete ? undefined : '/tools/glitch-studio/poster.jpg'} aria-label={complete ? 'Your generated Glitch Studio video' : 'Example Glitch Studio video'} />}
        </div>
        {job?.status === 'failed' ? <div className="glitch-studio__failure" role="alert"><p>{job.error || 'The video could not be created. Please try again.'}</p><button className="glitch-studio__text-button" onClick={resetJob}>Try again</button></div>
          : complete ? <>
            <a className="glitch-studio__download" href={`${videoUrl}?download=1`}>Download MP4 <span aria-hidden="true">↓</span></a>
            <p className="glitch-studio__note">Silent MP4 · Download within one hour. Add your own music in your favourite editor.</p>
          </> : <p className="glitch-studio__caption">{busy ? 'Your video will appear here when it is ready.' : 'Play the example to see the effects that will be applied to your photos.'}</p>}
        <p className="glitch-studio__flash-note">Contains flashing images and fast visual effects.</p>
        <div className="glitch-studio__output-footer"><span>PHOTO TO VIDEO</span><span>LVX / GLITCH STUDIO</span></div>
      </section>
    </div>
    <dialog className="glitch-studio__dialog" ref={dialog} aria-labelledby="glitch-dialog-title" onCancel={() => setError(null)}>
      <h2 id="glitch-dialog-title">One moment.</h2><p>{error}</p><button onClick={() => setError(null)}>Got it</button>
    </dialog>
  </main>
}
