import React from "react";
import Link from "next/link";
import {CONTACT_EMAIL, CONTACT_EMAIL_HREF} from "@/config/contact";

import { FaGithub, FaTwitter } from "react-icons/fa";

export function Footer({}) {
  return (
    <footer id="contact" className="site-footer">
      <div className="site-footer__header">
        <div className="section-meta">
          <span className="section-meta__index">{"//07"}</span>
          <span className="section-meta__label">CONNECT</span>
        </div>
        <p className="site-footer__intro">
          For freelance projects and creative collaborations.
        </p>
        <span className="site-footer__location">BERLIN / REMOTE</span>
      </div>

      <a className="footer_cta-link footer_cta-link--email" href={CONTACT_EMAIL_HREF}>
        <span className="footer_cta-label">START A CONVERSATION</span>
        <strong className="footer_cta-address">{CONTACT_EMAIL}</strong>
        <span className="footer_cta-arrow" aria-hidden="true">↗</span>
      </a>

      <div id="footer_icons">
        <a
          className="footer_icon"
          href="https://twitter.com/aaron_1337"
          target="_blank"
          rel="noreferrer"
          aria-label="Aaron Cunningham on Twitter"
        >
          <span className="footer_icon-mark" aria-hidden="true"><FaTwitter /></span>
          <span className="footer_icon-copy">
            <strong>Twitter</strong>
            <small>NOTES / SIGNAL</small>
          </span>
          <span className="footer_icon-arrow" aria-hidden="true">↗</span>
        </a>
        <a
          className="footer_icon"
          href="https://github.com/AaronJCunningham"
          target="_blank"
          rel="noreferrer"
          aria-label="Aaron Cunningham on GitHub"
        >
          <span className="footer_icon-mark" aria-hidden="true"><FaGithub /></span>
          <span className="footer_icon-copy">
            <strong>GitHub</strong>
            <small>CODE / EXPERIMENTS</small>
          </span>
          <span className="footer_icon-arrow" aria-hidden="true">↗</span>
        </a>
      </div>

      <nav className="footer_legal" aria-label="Copyright and legal links">
        <span className="footer_legal-copy">All Rights Reserved Aaron J. Cunningham - 2026</span>
        <span className="footer_legal-separator" aria-hidden="true">|</span>
        <Link href="/impressum">Impressum</Link>
        <span className="footer_legal-separator" aria-hidden="true">|</span>
        <Link href="/datenschutz">Datenschutzerklärung</Link>
      </nav>
    </footer>
  );
}
