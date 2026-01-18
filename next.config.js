const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mantém o pacote externo no lado do servidor
  serverExternalPackages: ['tesseract.js'],
  // Habilita Turbopack (padrão no Next.js 16)
  turbopack: {},
});
