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

const themeBootScript = `
(function () {
  var storageKey = 'nm-theme';
  var cookieKey = 'mf-theme';
  var theme = 'light';

  try {
    var storedTheme = window.localStorage.getItem(storageKey);
    var cookieMatch = document.cookie.match(new RegExp('(?:^|; )' + cookieKey + '=(dark|light)(?:;|$)'));
    var cookieTheme = cookieMatch ? cookieMatch[1] : null;

    if (storedTheme === 'dark' || storedTheme === 'light') {
      theme = storedTheme;
    } else if (cookieTheme === 'dark' || cookieTheme === 'light') {
      theme = cookieTheme;
      window.localStorage.setItem(storageKey, theme);
    }

    document.cookie = cookieKey + '=' + theme + '; path=/; max-age=31536000; samesite=lax';
  } catch (_) {}

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.appendChild(themeColor);
  }
  themeColor.content = theme === 'dark' ? '#0e1211' : '#f5f6f3';
})();
`;

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
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning className={`${sora.variable} ${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
