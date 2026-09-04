import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { UiProvider } from "@/components/UiProvider";
import { AppShell } from "@/components/AppShell";
import { RegisterSW } from "@/components/RegisterSW";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finanças do Casal",
  description:
    "Controle financeiro completo para o casal: lançamentos, parcelas, cartões, orçamentos, metas e relatórios.",
  manifest: "/manifest.webmanifest",
  applicationName: "Finanças do Casal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finanças",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <StoreProvider>
          <UiProvider>
            <AppShell>{children}</AppShell>
            <RegisterSW />
          </UiProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
