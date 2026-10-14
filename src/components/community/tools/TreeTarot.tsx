import Image from 'next/image'
import riderWaite from './tarot-cards.json'
import thoth from './thoth-cards.json'
import type { Aeon } from './tree-aeon'

export default function TreeTarot({ cardIds, note, aeon = 'old' }: { cardIds: string[]; note?: string; aeon?: Aeon }) {
  const deck = aeon === 'new' ? thoth : riderWaite
  const cards = cardIds.map(id => deck.cards.find(card => card.id === id)).filter((card): card is (typeof deck.cards)[number] => card !== undefined)
  if (!cards.length) return null
  return <div className={`tree-tarot${cards.length === 1 ? ' tree-tarot--single' : ''}`} aria-label={`Associated ${deck.deck} cards`}>
    <div className="tree-tarot__cards">
      {cards.map(card => <figure key={`${aeon}:${card.id}`}>
        <a href={card.src} target="_blank" rel="noreferrer" aria-label={`${card.name} — open full-size card`}>
          {/* Keep the original scans in colour; the scene's film effect never touches the cards. */}
          {aeon === 'new' ? <Image src={card.src} alt={`${card.name}, ${deck.deck}, illustrated by ${deck.artist}`} width={card.width} height={card.height} sizes="(max-width: 600px) 140px, 180px" quality={85} /> : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.src} alt={`${card.name}, ${deck.deck}, illustrated by ${deck.artist}`} width={card.width} height={card.height} loading="lazy" decoding="async" />
          )}
        </a>
        <figcaption><a href={card.source} target="_blank" rel="noreferrer">{card.name}</a></figcaption>
      </figure>)}
    </div>
    {aeon === 'new' && <p className="tree-tarot__note">Thoth artwork. Study notes retain the supplied book’s original card descriptions.</p>}
    {note && aeon === 'old' && <p className="tree-tarot__note">{note}</p>}
    <p className="tree-tarot__credit"><a href={deck.source} target="_blank" rel="noreferrer">{aeon === 'new' ? 'Thoth Tarot' : 'Rider–Waite–Smith · 1909'}</a><br />{aeon === 'new' ? 'Lady Frieda Harris · Aleister Crowley' : 'Pamela Colman Smith · Public domain'}</p>
  </div>
}
