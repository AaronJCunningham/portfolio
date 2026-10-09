import Link from 'next/link'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {Footer} from '@/components/layout/Footer'
import {CONTACT_EMAIL, CONTACT_EMAIL_HREF} from '@/config/contact'

export default function Contact() {
  return (
    <>
      <MetaDataHeader title="Contact" content="Contact Aaron J. Cunningham for freelance development, creative collaborations, podcast appearances, and ambitious digital projects." />
      <div className="about-experience contact-experience">
        <main className="about-me-page">
          <header className="about-masthead">
            <Link className="about-mark" href="/" aria-label="Return home">AJC</Link>
            <div className="about-masthead__role">
              <span>LEAD FULL-STACK DEVELOPER</span>
              <span>CREATIVE TECHNOLOGIST</span>
            </div>
            <span className="about-masthead__place">BERLIN / {new Date().getFullYear()}</span>
          </header>

          <section className="about-hero contact-layout" aria-labelledby="contact-title">
            <div className="about-hero__main contact-intro">
              <div className="about-kicker"><span>{'//00'}</span><span>CONTACT / PROJECTS / COLLABORATION</span></div>
              <h1 id="contact-title">Let’s<br /><span className="contact-title-accent">talk.</span></h1>
              <p>I’m available for collaborations<br />and freelance projects.</p>
              <div className="about-hero__availability contact-availability">
                <i aria-hidden="true" />
                <span>BERLIN / REMOTE</span>
              </div>
            </div>

            <div className="contact-details">
              <p className="contact-details__label">LET’S MAKE SOMETHING GOOD</p>
              <h2>Projects, conversations,<br />and new possibilities.</h2>
              <p>I’m a full-stack developer and creative technologist. I build websites, digital products, and interactive 3D experiences, taking projects from the first idea through to launch.</p>
              <p>I’m also open to creative collaborations, podcast appearances, and conversations around my YouTube work. If you have something in mind, I’d love to hear about it.</p>
              <a className="contact-email" href={CONTACT_EMAIL_HREF}>
                <span className="contact-email__label">EMAIL ME</span>
                <span className="contact-email__address">{CONTACT_EMAIL}</span>
                <span className="contact-email__arrow" aria-hidden="true">↗</span>
              </a>
              <p className="contact-details__note">Tell me a little about your idea and what you’re looking for.</p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
