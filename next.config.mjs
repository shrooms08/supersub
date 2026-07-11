/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // The bundled replay fixture must ship inside the serverless bundle on
    // Vercel; route handlers read it with fs at runtime.
    outputFileTracingIncludes: {
      "/api/**": ["./data/replay/**"],
    },
  },
  webpack: (config) => {
    // Privy's SDK statically references optional integrations (Stripe,
    // Farcaster mini-app) that this app does not use and does not install.
    // Alias them to false so webpack resolves them to an empty module
    // instead of failing; the code paths that would use them never run.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@stripe/crypto": false,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
