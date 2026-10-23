import {FC} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {urlFor} from '@/sanity/lib/image'
import type {ProjectListItem} from '@/sanity/types'

interface GridItemProps {
  post: ProjectListItem
  index: number
}

export const GridItem: FC<GridItemProps> = ({post, index}) => {
  const imageAlt = post.mainImage?.alt || post.seo?.image?.alt || post.title
  const imageSource = post.mainImage?.asset
    ? urlFor(post.mainImage)
        .width(1200)
        .height(750)
        .fit('crop')
        .auto('format')
        .url()
    : post.imageUrl
  const blurDataURL = post.mainImage?.asset?.metadata?.lqip
  const publishedYear = post.publishedAt
    ? new Date(post.publishedAt).getFullYear()
    : null
  const displayYear = publishedYear && !Number.isNaN(publishedYear)
    ? publishedYear
    : 'CASE STUDY'

  return (
    <Link className="work-card" href={`/${post.slug}`}>
      <article className="grid-container">
        <div className="work-card__meta">
          <span>{`//${String(index + 1).padStart(2, '0')}`}</span>
          <span>{post.experiencePath ? 'PLAYABLE / ' : ''}{displayYear}</span>
        </div>
        <div className="image_container">
          <div className="image_container__inner">
            {imageSource ? (
              <Image
                src={imageSource}
                fill
                alt={imageAlt}
                sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1100px) 50vw, (min-width: 1800px) 25vw, 33vw"
                style={{objectFit: 'cover', objectPosition: 'center'}}
                placeholder={blurDataURL ? 'blur' : 'empty'}
                blurDataURL={blurDataURL}
              />
            ) : (
              <div className="project-image-placeholder">
                <span>{post.excerpt || 'Image coming soon'}</span>
              </div>
            )}
          </div>
        </div>
        <div className="title-container">
          <div className="title-inner">
            <h2>{post.title}</h2>
            {post.excerpt && <p>{post.excerpt}</p>}
          </div>
          <span className="work-card__arrow" aria-hidden="true">↗</span>
        </div>
      </article>
    </Link>
  )
}
