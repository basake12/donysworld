const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "supabase-images",
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "unsplash-images",
        expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "next-static",
        expiration: { maxEntries: 500, maxAgeSeconds: 604800 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
    formats: ["image/webp"],
    deviceSizes: [375, 640, 750, 828, 1080, 1200],
    minimumCacheTTL: 3600,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "192.168.1.187:3000",
        "*.vercel.app",
      ],
    },
  },
  compress: true,
  poweredByHeader: false,
};

module.exports = withPWA(nextConfig);