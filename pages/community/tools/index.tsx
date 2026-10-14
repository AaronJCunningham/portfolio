import Link from 'next/link'
import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'

export default function Tools() {
  return <>
    <MetaDataHeader exactTitle title="Tools — Aaron LVX" content="Tools for study and contemplation. Discover Tarot on the Tree of Life." canonical="https://aaronjcunningham.com/community/tools" />
    <div className="community-tools">
      <CommunityHeader />
      <main className="community-tools__main">
        <p className="community-eyebrow"><span /> COMMUNITY / TOOLS</p>
        <div className="community-tools__heading">
          <h1>A different<br />way to <em>see.</em></h1>
          <p>Tools for study, reflection,<br />and following the connections.</p>
        </div>
        <Link className="community-tool-card" href="/community/tools/tree-of-life">
          <div className="community-tool-card__image">
            {/* A still of the same model; the gallery does not need a WebGL context. */}
            <img src="/tools/tree-of-life/preview.jpg" alt="The Tree of Life in the Proof of Belief experience" width={1920} height={873} />
            <span className="community-tool-card__number">01 / TAROT</span>
          </div>
          <div className="community-tool-card__body">
            <span className="community-tool-card__tag">A STUDY IN CONNECTION</span>
            <h2>Tarot on the<br />Tree of Life.</h2>
            <p>Ten sephiroth. Twenty-two paths.<br />One map to contemplate.</p>
            <span className="community-tool-card__open">View the tree <span aria-hidden="true">↗</span></span>
          </div>
        </Link>
      </main>
    </div>
  </>
}
