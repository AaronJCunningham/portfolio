import Link from 'next/link'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {Footer} from '@/components/layout/Footer'
import {Grid} from '@/components/layout/Grid'
import {getProjects} from '@/sanity/lib/projects'
import type {ProjectListItem} from '@/sanity/types'

export default function Work({projects}: {projects: ProjectListItem[]}) {
  return (
    <>
      <MetaDataHeader
        title="Selected Work"
        content="Selected products and systems by Aaron J. Cunningham, a lead full-stack developer and creative technologist based in Berlin."
      />
      <div className="work-experience">

        <main className="work-page">
          <header className="work-masthead">
            <Link className="work-mark" href="/" aria-label="Return home">
              AJC
            </Link>
            <div className="work-masthead__role">
              <span>LEAD FULL-STACK DEVELOPER</span>
              <span>CREATIVE TECHNOLOGIST</span>
            </div>
            <span className="work-masthead__place">BERLIN / REMOTE</span>
          </header>

          <section className="work-hero" aria-labelledby="work-title">
            <div className="work-hero__main">
              <div className="work-kicker">
                <span>{'//00'}</span>
                <span>PORTFOLIO / PRODUCTS / SYSTEMS</span>
              </div>
              <h1 id="work-title">Selected work.</h1>
              <p>
                I turn ambitious ideas into shipped products, combining full-stack
                development, design judgment, and disciplined agentic workflows.
              </p>
              <nav className="work-hero__links" aria-label="Work page links">
                <a className="work-pill" href="#projects">
                  Explore the work <span aria-hidden="true">↓</span>
                </a>
                <Link href="/about-me">About / profile</Link>
              </nav>
            </div>

            <aside className="work-hero__aside" aria-label="Experience summary">
              <div>
                <span>POSITION</span>
                <strong>Technical depth.<br />Product ownership.<br />Design judgment.</strong>
              </div>
              <div className="work-stats">
                <p><strong>7</strong><span>YEARS<br />SOFTWARE</span></p>
                <p><strong>10</strong><span>YEARS<br />DESIGN</span></p>
              </div>
              <div className="work-hero__availability">
                <i aria-hidden="true" />
                <span>AVAILABLE / BERLIN / REMOTE</span>
              </div>
            </aside>
          </section>

          <Grid posts={projects} />
        </main>

        <Footer />
      </div>
    </>
  )
}

export async function getStaticProps() {
  try {
    const projects = await getProjects()

    return {
      props: {
        projects,
      },
      revalidate: 3600,
    }
  } catch (error) {
    console.error('Failed to fetch Sanity projects for work page', error)

    return {
      props: {
        projects: [],
      },
      revalidate: 60,
    }
  }
}
