/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable WebSocket support
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        'socket.io': 'commonjs socket.io',
      });
    }
    return config;
  },
};

export default nextConfig;
