/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  async rewrites() {
    return [{source: '/play/berlin', destination: '/experiments/berlin/index.html'}]
  },
  async headers() {
    return [{
      source: '/experiments/berlin/:path*',
      headers: [{key: 'Cache-Control', value: 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'}],
    }]
  },
  async redirects() {
    return [
      {source: '/shop/:path*', destination: '/community/shop/:path*', permanent: true},
      {source: '/community/shop/long-sleeve', destination: '/community/shop/sweatshirt', permanent: true},
      {source: '/community/shop/demo', destination: '/community/shop/payment', permanent: false},
    ]
  },
  images: {
    remotePatterns: [
      {protocol: 'https', hostname: 'xeleven.space'},
      {protocol: 'https', hostname: 'cdn.sanity.io'},
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'node:module': false,
      'module': false,
      'fs': false,
      'path': false,
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      'node:module': false,
    }

    return config
  },
}

module.exports = nextConfig
