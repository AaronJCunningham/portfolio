import Link from 'next/link'
import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {getResources} from '@/sanity/lib/projects'
import type {ProjectListItem} from '@/sanity/types'

export default function Resources({resources}: {resources: ProjectListItem[]}) {
  return <>
    <MetaDataHeader exactTitle title="Resources — Aaron LVX" content="The Aaron LVX reading room. Reading lists, references, and practices to accompany the channel." canonical="https://aaronjcunningham.com/community/resources" />
    <div className="community-resources">
      <CommunityHeader />
      <main>
        <p className="community-eyebrow"><span /> COMMUNITY / RESOURCES</p>
        <h1>The reading<br /><em>room.</em></h1>
        <p className="community-resources__intro">Go a little deeper.</p>
        <p>Reading lists, references, and practices to accompany the conversations on the channel.{resources.length === 0 && ' The first resources are on their way.'}</p>
        <div className="community-resource-list">
          {resources.length ? resources.map((resource, index) => <div key={resource._id}><span>{String(index + 1).padStart(2, '0')}</span><h2><Link href={`/community/resources/${resource.slug}`}>{resource.title}</Link></h2><span aria-hidden="true">↗</span></div>) : ['Reading & references', 'Practices & reflections', 'Notes from the channel'].map((title, index) => <div key={title}><span>0{index + 1}</span><h2>{title}</h2><span>COMING SOON</span></div>)}
        </div>
        <a className="community-button" href="https://www.youtube.com/@aaronlvx" target="_blank" rel="noopener noreferrer">Explore the channel <span aria-hidden="true">↗</span></a>
        <Link className="community-text-link" href="/community">← Back to community</Link>
      </main>
    </div>
  </>
}

export async function getStaticProps() {
  return {props: {resources: await getResources()}, revalidate: 3600}
}
