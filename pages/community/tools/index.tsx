import Link from 'next/link'
import Image from 'next/image'
import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'

export default function Tools() {
  return <>
    <MetaDataHeader exactTitle title="Tools — Aaron LVX" content="Tools for study and creation. Explore Tarot on the Tree of Life and turn photos into motion with Glitch Studio." canonical="https://aaronjcunningham.com/community/tools" image="https://aaronjcunningham.com/tools/preview.jpg" imageAlt="The Aaron LVX tools collection: Tarot on the Tree of Life and Glitch Studio" />
    <div className="community-tools">
      <CommunityHeader />
      <main className="community-tools__main">
        <p className="community-eyebrow"><span /> COMMUNITY / TOOLS</p>
        <div className="community-tools__heading">
          <h1>A different<br />way to <em>see.</em></h1>
          <p>Tools for study, creation,<br />and following the connections.</p>
        </div>
        <div className="community-tools__grid">
          <Link className="community-tool-card" href="/community/tools/tree-of-life">
            <div className="community-tool-card__meta">
              <span className="community-tool-card__number">01 / TAROT</span>
              <span className="community-tool-card__tag">A STUDY IN CONNECTION</span>
            </div>
            <div className="community-tool-card__image">
              {/* A still of the same model; the gallery does not need a WebGL context. */}
              <Image src="/tools/tree-of-life/preview.jpg" alt="The interactive Tree of Life and its study notes" width={1920} height={873} sizes="(max-width: 800px) 100vw, (max-width: 1512px) 50vw, 686px" />
            </div>
            <div className="community-tool-card__body">
              <h2>Tarot on the Tree of Life.</h2>
              <p>Ten sephiroth. Twenty-two paths. One map to contemplate.</p>
              <span className="community-tool-card__open">Explore the tree <span aria-hidden="true">↗</span></span>
            </div>
          </Link>
          <Link className="community-tool-card" href="/community/tools/glitch-studio">
            <div className="community-tool-card__meta">
              <span className="community-tool-card__number">02 / MOTION</span>
              <span className="community-tool-card__tag">PHOTO TO VIDEO</span>
            </div>
            <div className="community-tool-card__image">
              <Image src="/tools/glitch-studio/preview.jpg" alt="Photographs transformed into colour, distortion and motion by Glitch Studio" width={1200} height={546} sizes="(max-width: 800px) 100vw, (max-width: 1512px) 50vw, 686px" />
            </div>
            <div className="community-tool-card__body">
              <h2>Glitch Studio.</h2>
              <p>Create a free video from up to 32 photos, with two sizes for social media or Instagram posts.</p>
              <span className="community-tool-card__open">Create a video <span aria-hidden="true">↗</span></span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  </>
}
