import ThinFrame from './ThinFrame'
import content from './tree-content.json'
import TreeTarot from './TreeTarot'
import { useId, useRef, useState, type ReactNode } from 'react'

type TreePart = {
  id: string; modelKey?: string; kind: string; number: number; title: string; subtitle: string; paragraphs: string[];
  hebrew?: string;
  correspondences?: { label: string; value: string }[];
  sections?: { title: string; paragraphs: string[] }[];
  source?: { title: string; pages?: string; url?: string };
  palette?: { name: string; colors: string[]; basis: string; note?: string };
  tarotCardIds?: string[];
  tarotNote?: string;
}
export const treeParts: TreePart[] = content.parts
export const treeVeils: TreePart[] = content.veils
export const treeEntries = [...treeVeils, ...treeParts]

export function treePartId(metadata: Record<string, unknown>) {
  const key = metadata.sephirah ?? metadata.connects
  return treeParts.find(part => part.modelKey === key)?.id ?? null
}

export default function TreeInfoPanel({ activeId, pinned, onReset, mobileControls }: { activeId: string | null; pinned: boolean; onReset: () => void; mobileControls?: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const gesture = useRef<{ y: number; id: number } | null>(null)
  const suppressClick = useRef(false)
  const part = treeEntries.find(item => item.id === activeId)
  const detail = part ?? content.overview
  const singleCard = part?.tarotCardIds?.length === 1
  const correspondences = !!part?.correspondences?.length && <dl className="tree-info__correspondences">{part.correspondences.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
  const index = part?.kind === 'veil' ? `Veil ${String(part.number).padStart(2, '0')} / 03 · Above Kether` : part ? `${part.kind === 'sephirah' ? 'Sephirah' : 'Path'} ${String(part.number).padStart(2, '0')} / ${part.kind === 'sephirah' ? '10' : '32'}` : '10 sephiroth / 22 paths'

  return <ThinFrame className="tree-info" aria-label="Tree of Life information" data-expanded={expanded} onKeyDown={event => { if (event.key === 'Escape' && expanded) { event.stopPropagation(); setExpanded(false) } }}>
    <button className="tree-info__drawer-toggle" aria-expanded={expanded} aria-controls={contentId} aria-label={expanded ? 'Back to tree' : `Read about ${detail.title}`} onClick={event => {
      const dragged = suppressClick.current && event.detail > 0
      suppressClick.current = false
      if (dragged) return
      setExpanded(value => !value)
    }} onPointerDown={event => {
      gesture.current = { y: event.clientY, id: event.pointerId }
      suppressClick.current = false
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerUp={event => {
      if (gesture.current?.id !== event.pointerId) return
      const distance = event.clientY - gesture.current.y
      gesture.current = null
      if (Math.abs(distance) > 32) { suppressClick.current = true; setExpanded(distance < 0) }
    }} onPointerCancel={() => { gesture.current = null }}>
      <span className="tree-info__drawer-handle" aria-hidden="true" />
      <span className="tree-info__drawer-close">↓ Back to tree</span>
      <span className="tree-info__peek" aria-live="polite" aria-atomic="true">
        <span className="tree-info__peek-meta"><span>{part ? index : 'Tarot on the Tree of Life'}</span><span>Read more ↑</span></span>
        <span className="tree-info__peek-title">{part ? detail.title : 'Explore the Tree'}</span>
        <span className="tree-info__peek-subtitle">{part ? detail.subtitle : 'Tap a sephirah, path or veil to begin.'}</span>
      </span>
    </button>
    <div id={contentId} className="tree-info__content" key={activeId ?? 'overview'} aria-live="polite" aria-atomic="true" tabIndex={0} aria-label={part ? `${part.title} details` : 'Introduction'}>
      <p className="tree-info__index">{index}</p>
      <h2>{part?.hebrew && <span className="tree-info__letter" lang="he">{part.hebrew}</span>}{detail.title}</h2>
      <p className="tree-info__subtitle">{detail.subtitle}</p>
      {part?.palette && <div className="tree-info__palette" aria-label={`Associated colour: ${part.palette.name}`}><span aria-hidden="true" className="tree-info__swatches">{part.palette.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>{part.palette.name}</div>}
      <div className={`tree-info__lead${singleCard ? ' tree-info__lead--card' : ''}`}>
        <div><div className="tree-info__body">{detail.paragraphs.map((text, i) => <p key={i}>{text}</p>)}</div>{singleCard && correspondences}</div>
        {singleCard && part?.tarotCardIds && <TreeTarot cardIds={part.tarotCardIds} />}
      </div>
      {!!part?.tarotCardIds && part.tarotCardIds.length > 1 && <TreeTarot cardIds={part.tarotCardIds} note={part.tarotNote} />}
      {!singleCard && correspondences}
      {detail.sections?.map(section => <div className="tree-info__section" key={section.title}><h3>{section.title}</h3>{section.paragraphs.map((text, i) => <p key={i}>{text}</p>)}</div>)}
      {part?.palette?.note && <div className="tree-info__section"><h3>Colour in this study</h3><p>{part.palette.note}</p></div>}
      {detail.source && <p className="tree-info__source">{detail.source.url ? <a href={detail.source.url} target="_blank" rel="noreferrer">{detail.source.title}</a> : detail.source.title}{detail.source.pages && <> · pp. {detail.source.pages}</>}</p>}
    </div>
    <div className="tree-info__footer"><p className="tree-info__hint" id="tree-navigation-hint">{pinned ? 'Selection kept open. Scroll for cards and correspondences.' : 'Hover to explore a colour. Click or tap to colour the tree and particles.'}<span className="tree-info__keyboard"> Focus the tree and use arrow keys to explore; Escape returns to the introduction.</span></p>{pinned && <button className="tree-info__reset" onClick={onReset}>Back to introduction</button>}<div className="tree-info__mobile-controls">{mobileControls}</div></div>
  </ThinFrame>
}
