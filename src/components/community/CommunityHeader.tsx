import Link from 'next/link'
import {useRouter} from 'next/router'
import type {ReactNode} from 'react'
import {SiDiscord} from 'react-icons/si'

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
        <a className="community-discord" href="https://discord.gg/EcRJXEcF" target="_blank" rel="noopener noreferrer" aria-label="Join the community on Discord (opens in a new tab)">
          <SiDiscord aria-hidden="true" focusable="false" />
          Discord
        </a>
        {links.map(({href, label}) => <Link key={href} href={href} aria-current={(href === '/community' ? pathname === href : pathname.startsWith(href)) ? 'page' : undefined}>{label}</Link>)}
      </nav>
      {actions && <div className="community-header__actions">{actions}</div>}
    </header>
  )
}
