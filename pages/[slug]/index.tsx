import Image from 'next/image'
import Link from 'next/link'

import {Footer} from '@/components/layout/Footer'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {ProjectBody} from '@/components/sanity/ProjectBody'
import {urlFor} from '@/sanity/lib/image'
import {getProjectBySlug, getProjectNavigation, getProjectSlugs} from '@/sanity/lib/projects'
import type {Project, ProjectNavItem} from '@/sanity/types'

interface DynamicProjectProps {
  project: Project
  previousProject?: ProjectNavItem | null
  nextProject?: ProjectNavItem | null
}

interface Params {
  slug: string
}

interface StaticPropsContext {
  params: Params
}

const formatDate = (date?: string) =>
  date
    ? new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

export default function DynamicProject({project, previousProject, nextProject}: DynamicProjectProps) {
  const publishedDate = formatDate(project.publishedAt)
  const leadImageDimensions = project.mainImage?.asset?.metadata?.dimensions
  const leadImageWidth = Math.min(1800, leadImageDimensions?.width || 1800)
  const leadImageHeight = Math.round(
    leadImageWidth / (leadImageDimensions?.aspectRatio || 1.6),
  )
  const leadImageUrl = project.mainImage?.asset
    ? urlFor(project.mainImage)
        .width(leadImageWidth)
        .fit('max')
        .auto('format')
        .url()
    : project.imageUrl
  const leadBlurDataURL = project.mainImage?.asset?.metadata?.lqip
  const projectStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.seo?.description || project.excerpt,
    url: `https://www.aaronjcunningham.com/${project.slug}`,
    image: project.seoImageUrl || project.imageUrl,
    datePublished: project.publishedAt,
    author: {
      '@type': 'Person',
      name: 'Aaron J. Cunningham',
      url: 'https://www.aaronjcunningham.com',
    },
    ...(project.attribution && {
      isBasedOn: {
        '@type': 'SoftwareApplication',
        name: project.attribution.sourceTitle,
        url: project.attribution.url,
        author: {'@type': 'Person', name: project.attribution.creator},
      },
      creditText: project.attribution.label,
    }),
  }

  return (
    <>
      <MetaDataHeader
        title={project.seo?.title || project.title}
        content={project.seo?.description || project.excerpt}
        image={project.seoImageUrl || project.imageUrl}
        noIndex={project.seo?.noIndex}
        structuredData={projectStructuredData}
      />

      <div className={`project-experience${project.attribution ? ' project-experience--adaptation' : ''}`}>

        <main className="project-case">
          <header className="project-masthead">
            <Link className="project-mark" href="/" aria-label="Return home">
              AJC
            </Link>
            <span>{project.attribution ? 'INTERACTIVE EXPERIMENT / SELECTED WORK' : 'CASE STUDY / SELECTED WORK'}</span>
          </header>

          <section className="project-hero" aria-labelledby="project-title">
            <div className="project-kicker">
              <span>{project.attribution ? '// INTERACTIVE EXPERIMENT' : '// CASE STUDY'}</span>
              <span>{publishedDate || 'SELECTED PROJECT'}</span>
            </div>
            <h1 id="project-title">{project.title}</h1>
            {project.excerpt && <p>{project.excerpt}</p>}

            {project.experiencePath && /^\/(?!\/)[a-z0-9/-]+$/.test(project.experiencePath) && (
              <div className="project-hero__actions">
                {project.standaloneExperience ? (
                  <a className="project-play-link" href={project.experiencePath}>
                    {project.experienceLabel || 'Enter experience'} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <Link className="project-play-link" href={project.experiencePath}>
                    {project.experienceLabel || 'Enter experience'} <span aria-hidden="true">↗</span>
                  </Link>
                )}
                {project.attribution && (
                  <a className="project-original-credit" href={project.attribution.url} target="_blank" rel="noopener noreferrer">
                    {project.attribution.label} <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            )}

            <div className="project-hero__footer">
              <span>AARON J. CUNNINGHAM</span>
              <span>{project.roleLabel || 'DESIGN / DEVELOPMENT / PRODUCT'}</span>
              <i aria-hidden="true" />
            </div>
          </section>

          {project.video ? (
            <figure className="project-lead-media">
              <video
                controls
                playsInline
                muted
                loop
                preload="none"
                poster={project.video.poster}
                width={project.video.width}
                height={project.video.height}
                aria-label={`${project.title} — full page recording`}
              >
                <source src={project.video.src} type="video/mp4" />
                <a href={project.video.src}>Download the video</a>
              </video>
              <figcaption><span>{'//00'}</span><span>{project.video.caption}</span></figcaption>
            </figure>
          ) : leadImageUrl && (
            <figure className="project-lead-media">
              <Image
                src={leadImageUrl}
                alt={project.mainImage?.alt || `${project.title} project preview`}
                width={leadImageWidth}
                height={leadImageHeight}
                sizes="(max-width: 820px) calc(100vw - 40px), 80vw"
                placeholder={leadBlurDataURL ? 'blur' : 'empty'}
                blurDataURL={leadBlurDataURL}
              />
              <figcaption>
                <span>{'//00'}</span>
                <span>{project.mainImage?.caption || 'PROJECT OVERVIEW'}</span>
              </figcaption>
            </figure>
          )}

          {project.gallery && project.gallery.length > 0 && (
            <div className="project-gallery" aria-label="Views from the simulator">
              {project.gallery.map(image => (
                <figure key={image.src}>
                  <Image src={image.src} alt={image.alt} width={1920} height={873} sizes="(max-width: 820px) calc(100vw - 40px), 40vw" />
                  <figcaption>{image.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}

          <section className="project-content" aria-label={`${project.title} case study content`}>
            <aside className="project-content__rail">
              <div>
                <span>{'//01'}</span>
                <strong>PROJECT NOTES</strong>
              </div>
              <dl>
                <div>
                  <dt>{project.attribution ? project.attribution.roleLabel || 'BERLIN ADAPTATION' : 'AUTHOR'}</dt>
                  <dd>AARON J. CUNNINGHAM</dd>
                </div>
                {publishedDate && (
                  <div>
                    <dt>PUBLISHED</dt>
                    <dd>{publishedDate}</dd>
                  </div>
                )}
              </dl>
              {project.links && project.links.length > 0 && (
                <nav aria-label="Project links">
                  {project.links.map((link) => (
                    <a
                      key={link._key || link.url}
                      href={link.url}
                      download={link.download || undefined}
                      target={link.url.startsWith('/') && !link.url.startsWith('//') ? undefined : '_blank'}
                      rel={link.url.startsWith('/') && !link.url.startsWith('//') ? undefined : 'noopener noreferrer'}
                    >
                      {link.label} <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </nav>
              )}
            </aside>

            <article className="project-rich-text">
              <ProjectBody value={project.body} />
            </article>
          </section>

          <nav className="project-bottom-nav" aria-label="More case studies">
            {previousProject ? (
              <Link href={`/${previousProject.slug}`}>
                <span>PREVIOUS PROJECT</span>
                <strong>{previousProject.title}</strong>
              </Link>
            ) : (
              <div />
            )}
            {nextProject ? (
              <Link href={`/${nextProject.slug}`}>
                <span>NEXT PROJECT</span>
                <strong>{nextProject.title}</strong>
              </Link>
            ) : (
              <Link href="/work">
                <span>CONTINUE</span>
                <strong>All work</strong>
              </Link>
            )}
          </nav>
        </main>

        <Footer />
      </div>
    </>
  )
}

export const getStaticPaths = async () => {
  try {
    const projects = await getProjectSlugs()

    const paths = projects.map((project) => ({
      params: {slug: project.slug},
    }))

    return {
      paths,
      fallback: 'blocking',
    }
  } catch (error) {
    console.error('Failed to fetch Sanity project paths during build', error)

    return {
      paths: [],
      fallback: 'blocking',
    }
  }
}

export async function getStaticProps({params}: StaticPropsContext) {
  try {
    const [project, navigation] = await Promise.all([
      getProjectBySlug(params.slug),
      getProjectNavigation(),
    ])

    if (!project) {
      return {notFound: true, revalidate: 60}
    }

    if (project.isResource) {
      return {redirect: {destination: `/community/resources/${project.slug}`, permanent: false}, revalidate: 60}
    }

    const currentIndex = navigation.findIndex((item) => item.slug === params.slug)
    const previousProject =
      currentIndex >= 0 && currentIndex < navigation.length - 1 ? navigation[currentIndex + 1] : null
    const nextProject = currentIndex > 0 ? navigation[currentIndex - 1] : null

    return {
      props: {
        project,
        previousProject,
        nextProject,
      },
      revalidate: 3600,
    }
  } catch (error) {
    console.error(`Failed to fetch Sanity project for slug "${params.slug}"`, error)
    return {notFound: true, revalidate: 60}
  }
}
