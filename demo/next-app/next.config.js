/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: true,
    images: {
        unoptimized: true
    }
  },
  output: 'standalone',
};

module.exports = nextConfig;
