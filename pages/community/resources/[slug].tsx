import Image from 'next/image'
import Link from 'next/link'
import type {GetStaticProps} from 'next'
import CommunityHeader from '@/components/community/CommunityHeader'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {ProjectBody} from '@/components/sanity/ProjectBody'
import {getProjectBySlug, getResourceSlugs} from '@/sanity/lib/projects'
import {urlFor} from '@/sanity/lib/image'
import type {Project} from '@/sanity/types'

export default function Resource({project}: {project: Project}) {
  const image = project.mainImage
  const width = Math.min(1600, image?.asset?.metadata?.dimensions?.width || 1600)
  const height = Math.round(width / (image?.asset?.metadata?.dimensions?.aspectRatio || 1.6))
  return <>
    <MetaDataHeader title={project.seo?.title || project.title} content={project.seo?.description || project.excerpt} image={project.seoImageUrl || project.imageUrl} noIndex={project.seo?.noIndex} />
    <div className="community-resources">
      <CommunityHeader />
      <main>
        <p className="community-eyebrow"><span /> COMMUNITY / RESOURCES</p>
        <h1>{project.title}</h1>
        {project.excerpt && <p>{project.excerpt}</p>}
        <article className="project-rich-text community-resource-body">
          {image?.asset && <figure>
            <Image src={urlFor(image).width(width).fit('max').auto('format').url()} alt={image.alt || ''} width={width} height={height} sizes="(max-width: 800px) 100vw, 880px" />
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>}
          <ProjectBody value={project.body} />
          {!!project.links?.length && <ul>{project.links.map(link => <li key={link._key || link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></li>)}</ul>}
        </article>
        <Link className="community-text-link" href="/community/resources">← Back to resources</Link>
      </main>
    </div>
  </>
}

export async function getStaticPaths() {
  const resources = await getResourceSlugs()
  return {paths: resources.map(resource => ({params: {slug: resource.slug}})), fallback: 'blocking'}
}

export const getStaticProps: GetStaticProps<{project: Project}, {slug: string}> = async ({params}) => {
  const project = params?.slug ? await getProjectBySlug(params.slug) : null
  if (!project) return {notFound: true, revalidate: 60}
  if (!project.isResource) return {redirect: {destination: `/${project.slug}`, permanent: false}, revalidate: 60}
  return {props: {project}, revalidate: 3600}
}
