import MetaDataHeader from "@/components/metadata/MetaDataHeader";
import { Footer } from "@/components/layout/Footer";
import {CONTACT_EMAIL, CONTACT_EMAIL_HREF} from "@/config/contact";

export default function Impressum() {
  return (
    <>
      <MetaDataHeader title="Impressum" />
      <main className="legal-page">
        <section className="legal-page__content">
          <div className="section-meta">
            <span className="section-meta__index">{"//08"}</span>
            <span className="section-meta__label">IMPRESSUM</span>
          </div>

          <h1>Impressum</h1>

          <h2>Angaben gemäß § 5 DDG</h2>
          <p>
            Aaron J. Cunningham
            <br />
            c/o Meister
            <br />
            Uhlandstr. 29
            <br />
            10719 Berlin
            <br />
            Deutschland
          </p>

          <h2>Umsatzsteuer-ID</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
            <br />
            DE321776741
          </p>

          <h2>Kontakt</h2>
          <p>
            <a href={CONTACT_EMAIL_HREF}>{CONTACT_EMAIL}</a>
          </p>

          <h2>Verantwortlich für den Inhalt</h2>
          <p>
            Verantwortlich nach § 18 Abs. 2 MStV:
            <br />
            Aaron J. Cunningham
            <br />
            c/o Meister
            <br />
            Uhlandstr. 29
            <br />
            10719 Berlin
            <br />
            Deutschland
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
