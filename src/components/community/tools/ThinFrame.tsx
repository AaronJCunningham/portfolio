import type { ComponentPropsWithoutRef } from 'react'

/** The fine border, corner marks and ticks from null-site's homepage. */
export default function ThinFrame({ children, className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  return <section className={`thin-frame ${className}`} {...props}>
    <div className="frame thin-frame__outline" aria-hidden="true">
      <span className="frame__tick frame__tick--left" />
      <span className="frame__tick frame__tick--right" />
    </div>
    {children}
  </section>
}
