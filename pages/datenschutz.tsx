import MetaDataHeader from "@/components/metadata/MetaDataHeader";
import { Footer } from "@/components/layout/Footer";
import {CONTACT_EMAIL, CONTACT_EMAIL_HREF} from "@/config/contact";

export default function Datenschutz() {
  return (
    <>
      <MetaDataHeader title="Datenschutzerklärung" />
      <main className="legal-page">
        <section className="legal-page__content">
          <div className="section-meta">
            <span className="section-meta__index">{"//09"}</span>
            <span className="section-meta__label">DATENSCHUTZ</span>
          </div>

          <h1>Datenschutzerklärung</h1>

          <h2>Verantwortlicher</h2>
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
            <br />
            Kontakt: <a href={CONTACT_EMAIL_HREF}>{CONTACT_EMAIL}</a>
          </p>

          <h2>Hosting</h2>
          <p>
            Diese Website wird bei Vercel Inc. gehostet. Beim Aufruf der Website
            werden technisch notwendige Zugriffsdaten verarbeitet, insbesondere
            IP-Adresse, Datum und Uhrzeit der Anfrage, Browser- und
            Betriebssysteminformationen sowie die angeforderte Seite. Die
            Verarbeitung erfolgt, um die Website sicher und zuverlässig
            bereitzustellen.
          </p>

          <h2>Kontaktaufnahme</h2>
          <p>
            Wenn Sie uns per E-Mail kontaktieren, werden Ihre E-Mail-Adresse
            und die von Ihnen übermittelten Angaben verarbeitet, um Ihre Anfrage
            zu beantworten. Hierfür wird der eingesetzte E-Mail-Dienstleister
            genutzt.
          </p>

          <h2>Cookies und Google Analytics</h2>
          <p>
            Diese Website verwendet Google Analytics, einen Webanalysedienst von
            Google. Google Analytics kann Cookies verwenden und Informationen
            über die Nutzung dieser Website verarbeiten. Die Verarbeitung dient
            der Analyse und Verbesserung des Angebots. Sie können die Speicherung
            von Cookies über die Einstellungen Ihres Browsers verhindern.
          </p>

          <h2>Ihre Rechte</h2>
          <p>
            Sie haben im Rahmen der gesetzlichen Vorgaben das Recht auf Auskunft,
            Berichtigung, Löschung, Einschränkung der Verarbeitung,
            Datenübertragbarkeit und Widerspruch. Außerdem haben Sie das Recht,
            sich bei einer Datenschutzaufsichtsbehörde zu beschweren.
          </p>

          <h2>Speicherdauer</h2>
          <p>
            Personenbezogene Daten werden nur so lange gespeichert, wie es für
            den jeweiligen Zweck erforderlich ist oder gesetzliche
            Aufbewahrungspflichten bestehen.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
