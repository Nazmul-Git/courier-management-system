/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for better optimization
  output: 'standalone',
  
  // Enable SWC minification
  swcMinify: true,
  
  // Handle external packages
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        {
          'socket.io': 'commonjs socket.io',
          'mongodb': 'commonjs mongodb',
          'mongoose': 'commonjs mongoose'
        }
      ];
    }
    
    // Important: return the modified config
    return config;
  },
  
  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Increase timeout for build
  staticPageGenerationTimeout: 1000,
};

export default nextConfig;