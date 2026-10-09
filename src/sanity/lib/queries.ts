import {defineQuery} from 'next-sanity'

const visibleProjectsFilter = /* groq */ `
  _type == "project" &&
  defined(slug.current) &&
  visibility != "hidden" &&
  !(_id in path("drafts.**"))
`

// Missing tags preserve the portfolio placement of existing documents.
const resourceFilter = /* groq */ `("occult" in coalesce(tags, []))`
const portfolioFilter = /* groq */ `${visibleProjectsFilter} && !${resourceFilter}`
const resourcesFilter = /* groq */ `${visibleProjectsFilter} && ${resourceFilter}`

const imageFields = /* groq */ `
  asset->{
    _id,
    url,
    metadata {
      lqip,
      dimensions { width, height, aspectRatio }
    }
  },
  alt,
  caption,
  crop,
  hotspot
`

const projectCardFields = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  sortOrder,
  "isResource": ${resourceFilter},
  mainImage { ${imageFields} },
  seo {
    title,
    description,
    noIndex,
    image { ${imageFields} }
  },
  "imageUrl": coalesce(mainImage.asset->url, seo.image.asset->url)
`

export const projectsQuery = defineQuery(/* groq */ `
  *[${portfolioFilter}]
  | order(coalesce(sortOrder, 999999) asc, publishedAt desc, title asc) {
    ${projectCardFields}
  }
`)

export const matterReelProjectsQuery = defineQuery(/* groq */ `
  *[${portfolioFilter} && slug.current in $slugs] {
    ${projectCardFields}
  }
`)

export const projectBySlugQuery = defineQuery(/* groq */ `
  *[${visibleProjectsFilter} && slug.current == $slug][0] {
    ${projectCardFields},
    body[] {
      ...,
      _type == "image" => {
        ...,
        asset->{
          _id,
          url,
          metadata {
            lqip,
            dimensions { width, height, aspectRatio }
          }
        }
      }
    },
    links[] { _key, label, url },
    "seoImageUrl": coalesce(seo.image.asset->url, mainImage.asset->url),
    "seo": {
      "title": coalesce(seo.title, title),
      "description": coalesce(seo.description, excerpt),
      "noIndex": seo.noIndex == true,
      "image": seo.image { ${imageFields} }
    }
  }
`)

export const projectSlugsQuery = defineQuery(/* groq */ `
  *[${visibleProjectsFilter}] { "slug": slug.current }
`)

export const projectNavQuery = defineQuery(/* groq */ `
  *[${portfolioFilter}]
  | order(coalesce(sortOrder, 999999) asc, publishedAt desc, title asc) {
    title,
    "slug": slug.current
  }
`)

export const resourcesQuery = defineQuery(/* groq */ `
  *[${resourcesFilter}]
  | order(coalesce(sortOrder, 999999) asc, publishedAt desc, title asc) {
    ${projectCardFields}
  }
`)

export const resourceSlugsQuery = defineQuery(/* groq */ `
  *[${resourcesFilter}] { "slug": slug.current }
`)
