import Cookie from '@/components/cookie/Cookie'
import MatterReel from '@/components/matter-reel/MatterReel'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {MATTER_REEL_SLUGS} from '@/components/matter-reel/matterReel.config'
import {getMatterReelProjects} from '@/sanity/lib/projects'
import type {ProjectListItem} from '@/sanity/types'

const profileStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Aaron J. Cunningham',
  url: 'https://www.aaronjcunningham.com',
  jobTitle: 'Lead Full-Stack Developer and Creative Technologist',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Berlin',
    addressCountry: 'DE',
  },
  sameAs: [
    'https://github.com/AaronJCunningham',
    'https://twitter.com/aaron_1337',
  ],
}

type HomeProps = {
  projects: ProjectListItem[]
}

export default function Home({projects}: HomeProps) {
  return (
    <>
      <MetaDataHeader
        exactTitle
        title="Aaron J. Cunningham"
        content="Aaron J. Cunningham's interactive WebGPU portfolio: one persistent field of matter transforms into networks, machines, signals, portals and constellations."
        structuredData={profileStructuredData}
      />
      <Cookie />
      <MatterReel projects={projects} />
    </>
  )
}

export async function getStaticProps() {
  try {
    const projects = await getMatterReelProjects(MATTER_REEL_SLUGS)

    return {
      props: {projects},
      revalidate: 3600,
    }
  } catch (error) {
    console.error('Failed to fetch Sanity projects for homepage', error)

    return {
      props: {projects: []},
      revalidate: 60,
    }
  }
}
