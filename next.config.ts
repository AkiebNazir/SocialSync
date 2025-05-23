import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude 'async_hooks' from client-side bundle
      config.resolve.fallback = {
        ...config.resolve.fallback, // Ensure we don't overwrite other fallbacks
        async_hooks: false,
      };
    }
    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
