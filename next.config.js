const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  reactStrictMode: true,
  // Mantém o pacote externo no lado do servidor
  serverExternalPackages: ['tesseract.js'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Evita que o webpack faça bundle do tesseract.js no server, preservando worker-scripts
      config.externals = config.externals || [];
      config.externals.push('tesseract.js');
    }
    return config;
  },
});
