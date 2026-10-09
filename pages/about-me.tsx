import Link from 'next/link'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {Footer} from '@/components/layout/Footer'

const capabilities = [
  ['01', 'Architecture to interface', 'FULL-STACK SYSTEMS'],
  ['02', 'Realtime and spatial', 'THREE.JS / WEBGPU'],
  ['03', 'Contracts to product', 'SOLIDITY / WEB3'],
  ['04', 'Design that ships', 'PRODUCT OWNERSHIP'],
] as const

const selectedProof = [
  {
    index: '01',
    title: 'Spirit Realm',
    type: 'BROWSER METAVERSE',
    href: '/threejs-metaverse',
    description:
      'A complete multiplayer Three.js world with automatic BVH colliders, live chat, an art gallery and NFT minting. Featured at NFT NYC in Times Square.',
  },
  {
    index: '02',
    title: 'The Nexus',
    type: 'REAL-TIME 3D SYSTEM',
    href: '/basedai-nexus-visualizing-a-blockchain-in-3d',
    description:
      'Live blockchain, staking and market data translated into an interactive visual system backed by two custom data services.',
  },
  {
    index: '03',
    title: 'DeFi Launchpad',
    type: 'FULL-STACK WEB3',
    href: '/building-a-defi-launchpad',
    description:
      'Five connected Solidity contracts, milestone voting, staking and transferable positions, with clone factories reducing repeat deployment cost by roughly 95%.',
  },
  {
    index: '04',
    title: 'Montra',
    type: 'BROWSER VIDEO EDITOR',
    href: '/montra-browser-video-editor',
    description:
      'Three.js development for a desktop-class editor keeping video, application state and real-time graphics synchronized in one responsive workflow.',
  },
] as const

export default function AboutMe() {
  return (
    <>
      <MetaDataHeader
        title="About Me"
        content="Aaron J. Cunningham is a lead full-stack developer and creative technologist building complete products, real-time systems, and immersive 3D experiences."
      />
      <div className="about-experience">

        <main className="about-me-page">
          <header className="about-masthead">
            <Link className="about-mark" href="/" aria-label="Return home">
              AJC
            </Link>
            <div className="about-masthead__role">
              <span>LEAD FULL-STACK DEVELOPER</span>
              <span>CREATIVE TECHNOLOGIST</span>
            </div>
            <span className="about-masthead__place">BERLIN / 2026</span>
          </header>

          <section className="about-hero" aria-labelledby="about-title">
            <div className="about-hero__main">
              <div className="about-kicker">
                <span>{'//00'}</span>
                <span>PROFILE / PRODUCT / TECHNOLOGY</span>
              </div>
              <h1 id="about-title">
                Aaron J.
                <br />
                <span className="about-hero__surname">Cunningham</span>
              </h1>
              <p>
                I turn ambitious ideas into shipped products, combining full-stack
                development, design judgment, and disciplined agentic workflows.
              </p>
              <nav className="about-hero__links" aria-label="Profile links">
                <Link
                  href="/contact"
                  className="about-pill about-pill--primary"
                >
                  Start a conversation <span aria-hidden="true">↗</span>
                </Link>
                <a
                  href="https://github.com/AaronJCunningham"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
                <a
                  href="https://twitter.com/aaron_1337"
                  target="_blank"
                  rel="noreferrer"
                >
                  Twitter
                </a>
              </nav>
            </div>

            <aside className="about-hero__aside" aria-label="Experience summary">
              <div>
                <span>POSITION</span>
                <strong>Technical depth.<br />Product ownership.<br />Design judgment.</strong>
              </div>
              <div className="about-stats">
                <p><strong>7</strong><span>YEARS<br />SOFTWARE</span></p>
                <p><strong>10</strong><span>YEARS<br />DESIGN</span></p>
              </div>
              <div className="about-hero__availability">
                <i aria-hidden="true" />
                <span>BERLIN / REMOTE</span>
              </div>
            </aside>
          </section>

          <section className="about-capabilities" aria-labelledby="capabilities-title">
            <header className="about-section-heading">
              <div className="about-kicker">
                <span>{'//01'}</span>
                <span id="capabilities-title">CAPABILITIES</span>
              </div>
              <span>IDEA → ARCHITECTURE → PRODUCT</span>
            </header>
            <div className="about-capabilities__grid">
              {capabilities.map(([index, title, detail]) => (
                <article key={index}>
                  <span>{index}</span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="about-proof" aria-labelledby="proof-title">
            <header className="about-section-heading">
              <div className="about-kicker">
                <span>{'//02'}</span>
                <span id="proof-title">SELECTED PROOF</span>
              </div>
              <span>CAPABILITIES DEMONSTRATED THROUGH SHIPPED WORK</span>
            </header>
            <div className="about-proof__list">
              {selectedProof.map((project) => (
                <Link href={project.href} className="about-proof__row" key={project.index}>
                  <div className="about-proof__meta">
                    <span>{project.index}</span>
                    <small>{project.type}</small>
                  </div>
                  <h2>{project.title}</h2>
                  <p>{project.description}</p>
                  <span className="about-proof__arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="about-story" aria-labelledby="story-title">
            <header className="about-section-heading">
              <div className="about-kicker">
                <span>{'//03'}</span>
                <span id="story-title">PROFILE</span>
              </div>
              <span>ARCHITECTURE / IMPLEMENTATION / POLISH</span>
            </header>

            <div className="about-story__layout">
              <aside>
                <span>GIVE ME AN AMBITIOUS IDEA.</span>
                <strong>I will turn it into a finished product.</strong>
              </aside>
              <div className="about-story__copy">
                <p>
                  I own architecture and implementation across frontend, backend,
                  real-time systems, Solidity and immersive 3D. My design background
                  means the work does not stop when it functions; I refine the details
                  until the product feels complete.
                </p>
                <p>
                  From 2024–2026, I was BasedAI&apos;s lead and sole developer, owning a
                  three-product suite end to end. Previously, I led Three.js development
                  at Montra and built browser-based 3D experiences at XELEVEN for clients
                  including Nike.
                </p>
                <p>
                  I use disciplined agentic workflows for planning, implementation and
                  review, with human judgment and verification before release. The tools
                  increase my range; accountability for the result stays with me.
                </p>
              </div>
            </div>
          </section>

          <section className="about-recognition" aria-labelledby="recognition-title">
            <header className="about-section-heading">
              <div className="about-kicker">
                <span>{'//04'}</span>
                <span id="recognition-title">RECOGNITION / PERSPECTIVE</span>
              </div>
              <span>WORK BEYOND THE REPOSITORY</span>
            </header>
            <div className="about-recognition__grid">
              <article>
                <span>PRESS / RECOGNITION</span>
                <strong>NFT NYC / TIMES SQUARE</strong>
                <strong>VICE MAGAZINE</strong>
                <strong>WALL STREET JOURNAL</strong>
              </article>
              <article>
                <span>SPEAKING</span>
                <strong>GOOGLE CAMPUS WARSAW</strong>
                <strong>CHAINLINK BERLIN</strong>
                <strong>FIRST ROUND MENTORSHIP</strong>
              </article>
              <article>
                <span>OTHER SIGNAL</span>
                <strong>5 BILLBOARD TOP-20 TRACKS</strong>
                <strong>OBERHAUSEN NOMINATION</strong>
                <strong>PRISM PRIZE NOMINATION</strong>
              </article>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  )
}
