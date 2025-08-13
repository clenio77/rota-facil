import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
