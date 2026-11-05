import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display face — used sparingly for page-level moments (auth, greetings).
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "IFlow | Imaginum",
  description: "Internal project and ticket tracker for Imaginum",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo-large.png",
  },
  applicationName: "IFlow",
  // "Add to Home Screen" opens full-screen like a native app on iOS.
  appleWebApp: { capable: true, title: "IFlow", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let content extend under the notch / home indicator; the shell pads with safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101012" },
  ],
};

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={['light', 'dark', 'ocean', 'dracula', 'monokai', 'onedark', 'forest', 'sunset']}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
