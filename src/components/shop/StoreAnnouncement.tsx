import {useEffect, useRef} from 'react'

export default function StoreAnnouncement() {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const announcement = dialog.current
    if (!announcement) return
    const previousOverflow = document.body.style.overflow
    const unlockScroll = () => {document.body.style.overflow = previousOverflow}
    announcement.addEventListener('close', unlockScroll)
    announcement.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      announcement.removeEventListener('close', unlockScroll)
      announcement.close()
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
    <p className="shop-announcement__eyebrow">SOMETHING IS TAKING SHAPE</p>
    <h2 id="store-announcement-title">Store<br /><em>coming soon.</em></h2>
    <p id="store-announcement-description">The first LVX collection is on its way.<br />Take a look around while we get things ready.</p>
    <button className="shop-announcement__explore" type="button" autoFocus onClick={() => dialog.current?.close()}>Explore the collection <span aria-hidden="true">↗</span></button>
    <p className="shop-announcement__signature">DESIGNED BY AARON J. CUNNINGHAM</p>
  </dialog>
}
