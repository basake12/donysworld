import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SessionProvider } from "@/components/shared/session-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { auth } from "@/lib/auth";
import Smartsupp from "@/components/smartsupp";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dony's World — Connect with Verified Models",
  description: "The premium platform where clients meet verified models across Nigeria. Secure, private, powered by Dony's Coins.",
  manifest: "/manifest.json",
  icons: { apple: "/icons/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dony's World",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#C9A84C" },
    { media: "(prefers-color-scheme: light)", color: "#B8860B" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable}`}
    >
      <body
        className="bg-background text-foreground antialiased font-sans"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          <SessionProvider session={session}>
            {children}
            <Toaster />
            <SonnerToaster position="top-center" richColors closeButton />
            {/* ✅ FIX: Moved inside the provider tree so React manages it correctly.
                If Smartsupp uses a raw <script> tag internally, update it to use
                Next.js <Script strategy="afterInteractive"> from "next/script". */}
            <Smartsupp />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}