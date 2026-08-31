import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

const sora = localFont({
  src: "./fonts/Sora-VariableFont_wght.ttf",
  variable: "--font-heading",
  weight: "100 800",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/Inter-VariableFont_opsz,wght.ttf",
  variable: "--font-mono-ui",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "melo flow — Processos",
  description: "Sistema interno de gestão de tarefas no estilo Processos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
