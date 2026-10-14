import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import ProofOfBelief from '@/components/community/tools/reference/proof-of-belief'

export default function TreeOfLife() {
  return <>
    <MetaDataHeader exactTitle title="Tarot on the Tree of Life — Aaron LVX" content="Explore the ten sephiroth and twenty-two paths of the Tree of Life, with information about each sephirah and connection." canonical="https://aaronjcunningham.com/community/tools/tree-of-life" image="https://aaronjcunningham.com/tools/tree-of-life/preview.jpg" imageAlt="An interactive Tree of Life with a framed information panel" />
    <div className="tree-reference"><ProofOfBelief /></div>
  </>
}
