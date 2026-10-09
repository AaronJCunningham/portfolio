import {useEffect, useRef} from 'react'

export default function StoreAnnouncement() {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const announcement = dialog.current
    if (!announcement) return
    let previousOverflow: string | undefined
    const unlockScroll = () => {
      if (previousOverflow === undefined) return
      document.body.style.overflow = previousOverflow
      previousOverflow = undefined
    }
    announcement.addEventListener('close', unlockScroll)
    // Give visitors a moment to see and browse the store before greeting them.
    const timer = window.setTimeout(() => {
      announcement.showModal()
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }, 3000)
    return () => {
      window.clearTimeout(timer)
      announcement.removeEventListener('close', unlockScroll)
      if (announcement.open) announcement.close()
      unlockScroll()
    }
  }, [])

  return <dialog
    ref={dialog}
    className="shop-announcement"
    aria-labelledby="store-announcement-title"
    aria-describedby="store-announcement-description"
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
    }}
  >
    <button className="shop-announcement__close" type="button" onClick={() => dialog.current?.close()} aria-label="Close store announcement">×</button>
    <div className="shop-announcement__edition"><span className="shop-announcement__mark">LVX</span><span>COLLECTION 001</span></div>
    <div className="shop-announcement__orbit" aria-hidden="true"><i /><i /><i /></div>
    <p className="shop-announcement__eyebrow">THANKS FOR VISITING</p>
    <h2 id="store-announcement-title">Store<br /><em>coming soon.</em></h2>
    <p id="store-announcement-description">We’re getting the first LVX products ready.<br />Come back in a day or two — we’d love to see you again.</p>
    <button className="shop-announcement__explore" type="button" autoFocus onClick={() => dialog.current?.close()}>Keep exploring <span aria-hidden="true">↗</span></button>
    <p className="shop-announcement__signature">DESIGNED BY AARON J. CUNNINGHAM</p>
  </dialog>
}
