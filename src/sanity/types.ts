export type SanityImageAsset = {
  _id?: string
  url?: string
  metadata?: {
    lqip?: string
    dimensions?: {
      width?: number
      height?: number
      aspectRatio?: number
    }
  }
}

export type SanityImage = {
  asset?: SanityImageAsset
  alt?: string
  caption?: string
  crop?: unknown
  hotspot?: unknown
}

export type ProjectLink = {
  _key?: string
  label: string
  url: string
  download?: boolean
}

export type ProjectSeo = {
  title?: string
  description?: string
  image?: SanityImage
  noIndex?: boolean
}

export type ProjectListItem = {
  _id: string
  title: string
  slug: string
  excerpt?: string
  publishedAt?: string
  sortOrder?: number
  isResource?: boolean
  mainImage?: SanityImage
  seo?: ProjectSeo
  imageUrl?: string
  experiencePath?: string
}

export type Project = ProjectListItem & {
  body?: unknown[]
  links?: ProjectLink[]
  seoImageUrl?: string
  experienceLabel?: string
  standaloneExperience?: boolean
  roleLabel?: string
  attribution?: {label: string; url: string; sourceTitle: string; creator: string; roleLabel?: string}
  video?: {src: string; poster: string; width: number; height: number; caption: string}
  gallery?: Array<{src: string; alt: string; caption: string}>
}

export type ProjectNavItem = {
  title: string
  slug: string
}
