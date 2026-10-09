import Image from 'next/image'
import {useEffect, useId, useRef, useState} from 'react'
import type {Product} from './products'

export default function ProductGallery({product}: {product: Product}) {
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const activeRef = useRef(0)
  const trackId = useId()
  const multiple = product.images.length > 1

  useEffect(() => {
    const element = track.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      element.scrollTo({left: activeRef.current * element.clientWidth, behavior: 'instant' as ScrollBehavior})
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function showImage(index: number) {
    const next = (index + product.images.length) % product.images.length
    track.current?.scrollTo({
      left: next * track.current.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' as ScrollBehavior : 'smooth',
    })
  }

  return (
    <section className={`shop-gallery${multiple ? " shop-gallery--multiple" : ""}`} aria-label={`${product.name} images`} aria-roledescription={multiple ? 'carousel' : undefined}>
      {multiple && <div className="shop-gallery__thumbnails" role="group" aria-label="Choose a product image">
        {product.images.map((image, index) => (
          <button type="button" key={`${product.id}-${index}`} onClick={() => {if (index !== active) showImage(index)}} aria-label={`Show image ${index + 1}: ${image.alt}`} aria-disabled={index === active} aria-controls={trackId}>
            <Image src={image.src} alt="" fill sizes="(max-width: 700px) 44px, 80px" />
          </button>
        ))}
      </div>}
      <div className="shop-gallery__stage">
        <div
          ref={track}
          id={trackId}
          className="shop-gallery__track"
          tabIndex={multiple ? 0 : undefined}
          aria-label={multiple ? 'Product images. Use left and right arrow keys to browse.' : undefined}
          onScroll={event => {
            const element = event.currentTarget
            const index = Math.max(0, Math.min(product.images.length - 1, Math.round(element.scrollLeft / element.clientWidth)))
            activeRef.current = index
            setActive(index)
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              showImage(event.key === 'Home' ? 0 : event.key === 'End' ? product.images.length - 1 : active + (event.key === 'ArrowRight' ? 1 : -1))
            }
          }}
        >
          {product.images.map((image, index) => (
            <div className="shop-gallery__slide" key={`${product.id}-${index}`} role="group" aria-roledescription={multiple ? 'slide' : undefined} aria-label={`${index + 1} of ${product.images.length}`} aria-hidden={index !== active}>
              <Image src={image.src} alt={image.alt} fill sizes="(max-width: 700px) calc(100vw - 96px), 48vw" priority={index === 0} draggable={false} />
            </div>
          ))}
        </div>
        {multiple && <div className="shop-gallery__arrows">
          <button type="button" onClick={() => showImage(active - 1)} aria-label="Previous image" aria-controls={trackId}>←</button>
          <button type="button" onClick={() => showImage(active + 1)} aria-label="Next image" aria-controls={trackId}>→</button>
        </div>}
      </div>
      <div className="shop-gallery__toolbar">
        <p aria-live="polite" aria-atomic="true">Image {active + 1} / {product.images.length}</p>
        <a href={product.images[active].src} target="_blank" rel="noopener noreferrer" aria-label={`View full-size image ${active + 1} of ${product.name} (opens in a new tab)`}>View full size <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  )
}
