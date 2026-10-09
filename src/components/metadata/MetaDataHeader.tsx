import Head from 'next/head'
import {useRouter} from 'next/router'

type MetaDataHeaderProps = {
  canonical?: string
  content?: string
  exactTitle?: boolean
  image?: string
  imageAlt?: string
  title?: string
  noIndex?: boolean
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>
}

const DEFAULT_DESCRIPTION = 'Aaron J. Cunningham is a lead full-stack developer and creative technologist turning ambitious ideas into shipped products.'
const DEFAULT_IMAGE = 'https://aaronjcunningham.com/images/meta-image.png'

const MetaDataHeader = ({
  canonical,
  content = DEFAULT_DESCRIPTION,
  exactTitle = false,
  image = DEFAULT_IMAGE,
  imageAlt,
  title = 'home',
  noIndex = false,
  structuredData,
}: MetaDataHeaderProps) => {
  const router = useRouter()
  const canonicalUrl = canonical || (
    'https://aaronjcunningham.com' + (router.asPath === '/' ? '' : router.asPath)
  ).split('?')[0]
  const pageTitle = exactTitle ? title : `${title} - Aaron J. Cunningham`
  const description = content || DEFAULT_DESCRIPTION
  const socialImage = image || DEFAULT_IMAGE

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex" />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialImage} />
      {imageAlt && <meta name="twitter:image:alt" content={imageAlt} />}
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={pageTitle} key="title" />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={socialImage} />
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      <meta property="og:type" content="website" />
      <meta name="yandex-verification" content="b1955c77c853f21f" />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/site.webmanifest" />
      <meta name="msapplication-TileColor" content="#030304" />
      <meta name="theme-color" content="#030304" />
      <meta name="yandex-verification" content="8d5b06a83511cd21" />
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
          }}
        />
      )}
    </Head>
  )
}

export default MetaDataHeader
