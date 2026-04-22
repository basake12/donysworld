const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./cloudinary-loader.js",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/**",
      },
    ],
    deviceSizes: [375, 640, 750, 828, 1080, 1200],
    minimumCacheTTL: 3600,
    // formats is intentionally removed — Cloudinary handles f_auto itself
  },

  // Turbopack is default in Next.js 16 — the old webpack fs fallback
  // is not needed as Turbopack handles it automatically.
  turbopack: {},

  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "*.vercel.app", "donysworld.com"],
    },
  },

  compress: true,
  poweredByHeader: false,
};

module.exports = withPWA(nextConfig);