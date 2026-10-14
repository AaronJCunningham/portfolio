import Link from 'next/link'
import {useRouter} from 'next/router'
import type {ReactNode} from 'react'

const links = [
  {href: '/community', label: 'Community'},
  {href: '/community/resources', label: 'Resources'},
  {href: '/community/tools', label: 'Tools'},
  {href: '/community/shop', label: 'Shop'},
]

export default function CommunityHeader({actions}: {actions?: ReactNode}) {
  const {pathname} = useRouter()
  return (
    <header className="community-header">
      <Link className="community-brand" href="/community" aria-label="Aaron LVX community">AARON <span>LVX</span></Link>
      <nav aria-label="Community navigation">
        {links.map(({href, label}) => <Link key={href} href={href} aria-current={(href === '/community' ? pathname === href : pathname.startsWith(href)) ? 'page' : undefined}>{label}</Link>)}
      </nav>
      {actions && <div className="community-header__actions">{actions}</div>}
    </header>
  )
}
