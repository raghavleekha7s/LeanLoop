/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' is used for the self-hosted Docker image. Opt-in via env var
  // so Vercel (and normal `next build`) default to their expected layout.
  output: process.env.NEXT_OUTPUT_MODE === 'standalone' ? 'standalone' : undefined,
  experimental: {
    instrumentationHook: true,
    // pg uses Node's fs/path/net — never try to bundle it for any runtime.
    serverComponentsExternalPackages: ['pg', 'pg-native', 'pgpass', 'node-cron'],
  },
};

export default nextConfig;
