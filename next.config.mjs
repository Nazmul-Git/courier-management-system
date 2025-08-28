/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    MONGODB_URI: process.env.MONGODB_URI,
  },
  // Enable standalone output for better optimization
  output: 'standalone',
  
  // Handle external packages
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        {
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