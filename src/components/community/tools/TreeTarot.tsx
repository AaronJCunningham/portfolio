import deck from './tarot-cards.json'

export default function TreeTarot({ cardIds, note }: { cardIds: string[]; note?: string }) {
  const cards = cardIds.map(id => deck.cards.find(card => card.id === id)).filter((card): card is (typeof deck.cards)[number] => card !== undefined)
  if (!cards.length) return null
  return <div className={`tree-tarot${cards.length === 1 ? ' tree-tarot--single' : ''}`} aria-label="Associated Rider–Waite–Smith tarot cards">
    <div className="tree-tarot__cards">
      {cards.map(card => <figure key={card.id}>
        <a href={card.src} target="_blank" rel="noreferrer" aria-label={`${card.name} — open full-size card`}>
          {/* Keep the original scans in colour; the scene's film effect never touches the cards. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.src} alt={`${card.name}, Rider–Waite–Smith tarot, illustrated by Pamela Colman Smith`} width={card.width} height={card.height} loading="lazy" decoding="async" />
        </a>
        <figcaption><a href={card.source} target="_blank" rel="noreferrer">{card.name}</a></figcaption>
      </figure>)}
    </div>
    {note && <p className="tree-tarot__note">{note}</p>}
    <p className="tree-tarot__credit"><a href={deck.source} target="_blank" rel="noreferrer">Rider–Waite–Smith · 1909</a><br />Pamela Colman Smith · Public domain</p>
  </div>
}
