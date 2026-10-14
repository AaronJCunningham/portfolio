import content from './tree-content.json'
import thoth from './thoth-cards.json'

export type Aeon = 'old' | 'new'

// This is a reversible study overlay. The source edition and image files stay intact.
const letterFields = new Set(['Letter / value', 'Letter meaning', 'Final letter / value', 'Intelligence'])
const swappedParts = content.parts.map(part => {
  const donorId = part.id === 'path-15' ? 'path-28' : part.id === 'path-28' ? 'path-15' : null
  if (!donorId) return part
  const donor = content.parts.find(entry => entry.id === donorId)!
  return {
    ...part,
    paragraphs: part.id === 'path-15'
      ? ['He means window. In New Aeon mode it is paired with XVII — The Star and the existing Aquarius correspondence set. The Star imagery and associations below are retained from the supplied book.']
      : ['Tzaddi means fish hook. In New Aeon mode it is paired with IV — The Emperor and the existing Aries correspondence set. The Emperor imagery and associations below are retained from the supplied book.'],
    correspondences: [
      ...donor.correspondences.filter(item => !letterFields.has(item.label)),
      ...part.correspondences.filter(item => letterFields.has(item.label)),
    ],
    sections: donor.sections,
    tarotCardIds: donor.tarotCardIds,
    palette: donor.palette,
    source: donor.source,
  }
})

// IDs identify the corresponding card across decks, not the numeral printed on it:
// Strength (major-08) becomes XI Lust; Justice (major-11) becomes VIII Adjustment.
const newAeonParts = swappedParts.map(part => {
  if (part.kind !== 'path' || part.tarotCardIds.length !== 1) return part
  const card = thoth.cards.find(card => card.id === part.tarotCardIds[0])
  if (!card) throw new Error(`Missing Thoth card for ${part.id}`)
  return {
    ...part,
    correspondences: part.correspondences.map(row => row.label === 'Tarot' ? { ...row, value: card.name } : row),
  }
})

export function partsForAeon(aeon: Aeon) {
  return aeon === 'new' ? newAeonParts : content.parts
}
