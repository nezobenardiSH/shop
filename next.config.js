/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone output for Render deployment
  // output: 'standalone',
  poweredByHeader: false,
  
  // Production optimizations
  compiler: {
    // Keep console logs for debugging - we can remove this later
    removeConsole: false,
    // Alternative: only remove console.log but keep console.error and console.warn
    // removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig