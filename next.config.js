const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const securityHeaders = [
  // Prevent clickjacking — blocks the site from being embedded in iframes
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent browsers from MIME-sniffing a response away from declared content-type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control how much referrer info is included with requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy XSS filter still respected by some older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Lock down browser features — no camera/mic/geo/payment needed
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Force HTTPS for 2 years (only active once fully on HTTPS — safe for donysworld.com)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

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
    // formats removed — Cloudinary handles f_auto itself
  },

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