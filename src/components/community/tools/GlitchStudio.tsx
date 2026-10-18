import Link from 'next/link'
import {useCallback, useEffect, useRef, useState} from 'react'
import type {GlitchFormat, Progress, Support} from '@/lib/glitch-studio/browser'
import {BROWSER_HELP, FORMATS, validateFiles} from '@/lib/glitch-studio/support.mjs'

type Photo = {id:string; file:File; url:string}
type Result = {url:string; width:number; height:number; bytes:number}

export default function GlitchStudio() {
  const [photos,setPhotos] = useState<Photo[]>([])
  const photosRef = useRef<Photo[]>([])
  const [format,setFormat] = useState<GlitchFormat>('vertical')
  const [title,setTitle] = useState('')
  const [dragging,setDragging] = useState(false)
  const [support,setSupport] = useState<Support | null>(null)
  const [progress,setProgress] = useState<Progress | null>(null)
  const [result,setResult] = useState<Result | null>(null)
  const [notice,setNotice] = useState('')
  const [error,setError] = useState<string | null>(null)
  const [showSharePrompt,setShowSharePrompt] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const outputUrl = useRef<string | null>(null)
  const mounted = useRef(false)
  const checkVersion = useRef(0)
  const busy = progress !== null
  const complete = result !== null

  const checkSupport = useCallback(async () => {
    const version = ++checkVersion.current
    setSupport(null)
    let next:Support
    try {next = await (await import('@/lib/glitch-studio/browser')).checkBrowserSupport()}
    catch {next = {supported:false,reason:'The browser check could not finish. Reload this page or try again.',formats:[]}}
    if(!mounted.current || version !== checkVersion.current)return
    setSupport(next)
    if(!next.supported)setError(next.reason)
    else {
      setError(null)
      setFormat(current => next.formats.includes(current) ? current : next.formats[0] as GlitchFormat)
    }
  },[])

  useEffect(() => {
    mounted.current = true
    void checkSupport()
    return () => {
      mounted.current = false
      controller.current?.abort()
      photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url))
      if(outputUrl.current)URL.revokeObjectURL(outputUrl.current)
    }
  },[checkSupport])

  useEffect(() => {
    if(!busy)return
    const warn = (event:BeforeUnloadEvent) => {event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',warn)
    return () => window.removeEventListener('beforeunload',warn)
  },[busy])

  useEffect(() => {
    if((error || showSharePrompt) && !dialog.current?.open)dialog.current?.showModal()
    if(!error && !showSharePrompt && dialog.current?.open)dialog.current.close()
  },[error,showSharePrompt])

  function dismissDialog() {setError(null);setShowSharePrompt(false)}

  function replacePhotos(next:Photo[]) {photosRef.current=next;setPhotos(next)}
  function addPhotos(files:FileList | File[]) {
    if(controller.current)return
    const incoming=Array.from(files)
    if(!incoming.length)return
    try {validateFiles([...photosRef.current.map(photo=>photo.file),...incoming])}
    catch(cause) {setError((cause as Error).message);return}
    setNotice('')
    replacePhotos([...photosRef.current,...incoming.map(file=>({id:crypto.randomUUID(),file,url:URL.createObjectURL(file)}))])
  }
  function removePhoto(id:string) {
    const photo=photosRef.current.find(item=>item.id===id)
    if(photo)URL.revokeObjectURL(photo.url)
    replacePhotos(photosRef.current.filter(item=>item.id!==id))
  }
  async function createVideo() {
    if(controller.current || !photosRef.current.length)return
    if(!support?.supported || !support.formats.includes(format)){setError(support?.reason || BROWSER_HELP);return}
    const task=new AbortController()
    controller.current=task
    setError(null);setNotice('');setProgress({stage:'preparing',percent:0})
    setShowSharePrompt(true)
    let wakeLock:WakeLockSentinel | undefined
    try {
      try {wakeLock=await navigator.wakeLock?.request('screen')} catch { /* Keep working if screen wake lock is unavailable. */ }
      task.signal.throwIfAborted()
      const {renderBrowserVideo}=await import('@/lib/glitch-studio/browser')
      const rendered=await renderBrowserVideo({
        files:photosRef.current.map(photo=>photo.file),format,title:title.trim(),signal:task.signal,
        onProgress:value=>{if(mounted.current)setProgress(value)},
      })
      if(!mounted.current || task.signal.aborted)return
      if(outputUrl.current)URL.revokeObjectURL(outputUrl.current)
      const url=URL.createObjectURL(rendered.blob)
      outputUrl.current=url
      setResult({url,width:rendered.width,height:rendered.height,bytes:rendered.blob.size})
    } catch(cause) {
      if(!mounted.current)return
      if(task.signal.aborted)setNotice('Cancelled. You can change your photos and try again.')
      else {
        console.error('Glitch Studio browser export failed:',cause)
        const message=cause instanceof Error?cause.message:''
        setError(/could not be read|24 megapixels|MP4 export|empty video|Choose |Keep /.test(message)?message:'This device could not finish the video. Try fewer photos, close other tabs, or use an up-to-date Chrome-compatible browser such as Chrome or Edge.')
      }
    } finally {
      await wakeLock?.release().catch(()=>{})
      if(controller.current===task)controller.current=null
      if(mounted.current)setProgress(null)
    }
  }

  const videoUrl=result?.url || '/tools/glitch-studio/example.mp4'
  const status=progress?.stage==='preparing'?'Preparing your photos':progress?.stage==='encoding'?'Finishing your MP4':'Creating your video'

  return <main className="glitch-studio__main">
    <Link className="glitch-studio__back" href="/community/tools">← All tools</Link>
    <header className="glitch-studio__intro">
      <div>
        <p className="community-eyebrow"><span /> 02 / PHOTO TO VIDEO</p>
        <h1>Glitch <em>Studio.</em></h1>
        <p className="glitch-studio__description">I designed Glitch Studio to create videos from photos and thought it might be useful to other people, so I’ve made it free to use. Add up to 32 photos and choose one of two video sizes for social media or Instagram posts.</p>
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
          <small>JPG, PNG, WEBP · 8 MB EACH · 64 MB TOTAL · 24 MP MAX</small>
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
        <p className="glitch-studio__note">Choose 1–32 photos. If you add fewer than 32, some will be repeated. The order is shuffled to spread out repeats.</p>

        <fieldset className="glitch-studio__options" disabled={busy}>
          <legend><span>02</span> Video options</legend>
          <div className="glitch-studio__formats" role="group" aria-label="Video format">
            {(Object.entries(FORMATS) as [GlitchFormat,typeof FORMATS[GlitchFormat]][]).map(([key,size])=><label key={key} className={format===key?'is-selected':''}>
              <input type="radio" name="format" value={key} checked={format===key} disabled={support!==null && !support.formats.includes(key)} onChange={()=>setFormat(key)} />
              <span className={`glitch-studio__format-icon${key==='portrait'?' is-portrait':''}`} />
              <span><strong>{size.width} × {size.height}</strong><small>{size.ratio} · {size.label}</small></span>
            </label>)}
          </div>
          <label className="glitch-studio__title-label" htmlFor="glitch-title">Text overlay <span>OPTIONAL</span></label>
          <input id="glitch-title" className="glitch-studio__title" type="text" value={title} maxLength={36} placeholder="Your text" onChange={event => setTitle(event.target.value)} aria-describedby="glitch-title-help" />
          <p id="glitch-title-help" className="glitch-studio__note">Add up to 36 characters to your video, or leave blank for images only. Photos are cropped to fill the frame.</p>
        </fieldset>

        <div className="glitch-studio__availability" role="status">
          <span className={`glitch-studio__light is-${support===null?'checking':support.supported?'ready':'offline'}`} />
          {support===null?'Checking your browser…':support.supported?'Ready to create on this device':'This browser cannot create the video.'}
          {support && !support.supported && <><button className="glitch-studio__text-button" onClick={()=>setError(support.reason)}>Browser requirements</button><button className="glitch-studio__text-button" onClick={()=>void checkSupport()}>Check again</button></>}
        </div>
        <button className="glitch-studio__create" disabled={busy || photos.length===0 || !support?.supported} onClick={()=>void createVideo()}>
          {busy?status:complete?'Make another version':'Create my video'}<span aria-hidden="true">↗</span>
        </button>
        {busy && <button className="glitch-studio__cancel" onClick={()=>controller.current?.abort()}>Cancel video</button>}
        {notice && <p className="glitch-studio__note" role="status">{notice}</p>}
        <p className="glitch-studio__privacy">Your photos stay on your device. The video is created in your browser, with no uploads or account. Keep this page open until it finishes, then save your video before leaving.</p>
      </section>

      <section className="glitch-studio__output" aria-label="Video preview">
        <div className="glitch-studio__section-heading"><h2>{busy ? 'Creating your video' : complete ? 'Your video' : 'Video preview'}</h2><span>{busy ? 'PROCESSING ON YOUR DEVICE' : complete ? 'READY TO DOWNLOAD' : 'EXAMPLE VIDEO'}</span></div>
        <div className={`glitch-studio__screen${result?.height === FORMATS.portrait.height ? ' is-portrait' : ''}`}>
          {busy ? <div className="glitch-studio__progress" role="status" aria-live="polite">
            <span className="glitch-studio__progress-mark" aria-hidden="true">G<span>/</span>S</span>
            <h3>{status}</h3>
            <progress max="100" value={progress?.percent || 0} aria-label={status} />
            <p>{progress?.percent || 0}% complete</p>
            <small>Keep this page open. Creation speed depends on your device.</small>
          </div> : <video key={videoUrl} src={videoUrl} controls playsInline preload="none" poster={complete ? undefined : '/tools/glitch-studio/poster.jpg'} aria-label={complete ? 'Your generated Glitch Studio video' : 'Example Glitch Studio video'} />}
        </div>
        {complete && !busy ? <>
          <a className="glitch-studio__download" href={result.url} download={`glitch-studio-${result.width}x${result.height}.mp4`}>Download MP4 <span aria-hidden="true">↓</span></a>
          <p className="glitch-studio__note">{result.width} × {result.height} · {(result.bytes/1_000_000).toFixed(1)} MB · Silent MP4. Save your video before leaving this page.</p>
        </> : <p className="glitch-studio__caption">{busy?'Your video will appear here when it is ready.':'Play the example to see the effects that will be applied to your photos.'}</p>}
        <p className="glitch-studio__flash-note">Contains flashing images and fast visual effects.</p>
        <div className="glitch-studio__output-footer"><span>PHOTO TO VIDEO</span><span>LVX / GLITCH STUDIO</span></div>
      </section>
    </div>
    <dialog className="glitch-studio__dialog" ref={dialog} aria-labelledby="glitch-dialog-title" aria-describedby="glitch-dialog-message" onCancel={dismissDialog}>
      <h2 id="glitch-dialog-title">{error?'One moment.':'Sharing your video?'}</h2>
      <p id="glitch-dialog-message">{error || <>If you share on social media, please tag <a href="https://www.instagram.com/aaronlvx_/" target="_blank" rel="noopener noreferrer">@aaronlvx_</a> if you want.</>}</p>
      <button type="button" onClick={dismissDialog}>Got it</button>
    </dialog>
  </main>
}
