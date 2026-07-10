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
};

export default nextConfig;
