import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mesa de Entrada',
  description: 'Sistema de validación de documentos financieros',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
