import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/shared/session-provider";
import { auth } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Dony's World",
  description: "Connect with verified models in your state",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dony's World",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Dony's World",
  },
};

export const viewport: Viewport = {
  themeColor: "#C9A84C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // FIX: session is fetched but not passed as prop — SessionProvider doesn't accept it
  await auth();
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <SessionProvider>
          {children}
          <Toaster richColors theme="dark" position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}