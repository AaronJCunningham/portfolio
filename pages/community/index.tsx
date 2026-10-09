import dynamic from 'next/dynamic'
import Link from 'next/link'
import {useCallback, useState} from 'react'
import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {useMatterRenderMode} from '@/components/matter-reel/hooks/useRenderTier'

const CommunityCloud = dynamic(() => import('@/components/community/CommunityCloud'), {ssr: false})

export default function Community() {
  const mode = useMatterRenderMode()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => { setFailed(true); setReady(false) }, [])
  const animated = mode === 'animated' && !failed

  return (
    <>
      <MetaDataHeader exactTitle title="Aaron LVX — Community" content="Seeking the hidden light of gnosis. Explore hidden histories, transformative practices, and the inner life with Aaron J. Cunningham. Resources, videos, and the Aaron LVX shop." canonical="https://aaronjcunningham.com/community" />
      <div className={`community-landing${ready && animated ? ' community-landing--ready' : ''}`}>
        <div className="community-atmosphere" aria-hidden="true">
          <div className="community-cloud-still" />
          {animated && <CommunityCloud onReady={onReady} onError={onError} />}
          <div className="community-grid" />
          <div className="community-vignette" />
        </div>
        <CommunityHeader />
        <main className="community-hero">
          <p className="community-eyebrow"><span /> AARON LVX / COMMUNITY</p>
          <h1>Seeking<br />the hidden<br /><em>light of</em> gnosis.</h1>
          <p className="community-hero__intro">For curious minds and independent spirits.</p>
          <p className="community-hero__description">Exploring hidden histories, transformative practices,<br className="community-desktop-break" /> and the inner life. A place to continue the conversation.</p>
          <div className="community-hero__actions">
            <Link className="community-button" href="/community/resources">Explore resources <span aria-hidden="true">↗</span></Link>
            <a className="community-text-link" href="https://www.youtube.com/@aaronlvx" target="_blank" rel="noopener noreferrer">Watch on YouTube <span aria-hidden="true">↗</span></a>
          </div>
        </main>
        <div className="community-field-note" aria-hidden="true"><span>01 / THE UNSEEN</span><span>{animated ? 'MOVE TO DISTURB THE FIELD' : 'A MOMENT OF STILLNESS'}</span></div>
        <footer className="community-footer"><span>LIGHT, LIFE, LOVE & LIBERTY</span><span>AARON J. CUNNINGHAM <i>/</i> @AARONLVX</span></footer>
      </div>
    </>
  )
}
