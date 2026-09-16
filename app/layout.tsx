import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: "Ohrly — Field MVP",
  description: "Observe mudanças, registre intervenções e acompanhe o que aconteceu depois.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
