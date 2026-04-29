/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' is used for the self-hosted Docker image. Opt-in via env var
  // so Vercel (and normal `next build`) default to their expected layout.
  output: process.env.NEXT_OUTPUT_MODE === 'standalone' ? 'standalone' : undefined,
  experimental: {
    instrumentationHook: true,
    // For server-component / route-handler bundles.
    serverComponentsExternalPackages: ['pg', 'pg-native', 'pgpass', 'node-cron'],
  },
  // serverComponentsExternalPackages doesn't apply to the instrumentation
  // bundle, so we also externalize pg/node-cron at the webpack level for any
  // server-side compile. This stops webpack from trying to follow pg's
  // imports of Node built-ins (`net`, `dns`, `fs`) into the bundle.
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = ['pg', 'pg-native', 'pgpass', 'node-cron'];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        ({ request }, callback) => {
          if (request && externals.includes(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ].filter(Boolean);
    }
    return config;
  },
};

export default nextConfig;
