import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

export default config({
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mantém o pacote externo no lado do servidor
  serverExternalPackages: ['tesseract.js'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Evita que o webpack faça bundle do tesseract.js no server, preservando worker-scripts
      config.externals = config.externals || [];
      config.externals.push('tesseract.js');
    }
    
    // Melhorias de performance e estabilidade
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };
    
    return config;
  },
});
