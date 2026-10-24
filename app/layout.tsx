import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { EnregistrementSW } from "@/components/layout/EnregistrementSW"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Boulangerie Hoffmann — Commandes",
    template: "%s · Boulangerie Hoffmann",
  },
  description: "Gestion des commandes de la boulangerie : saisie en boutique, fornil, chiffre d'affaires.",
  applicationName: "Boulangerie Hoffmann",
  appleWebApp: { capable: true, title: "Hoffmann", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors closeButton />
          <EnregistrementSW />
        </ThemeProvider>
      </body>
    </html>
  )
}
