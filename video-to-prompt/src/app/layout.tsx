import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Heliograph",
  description: "Heliograph turns workflow videos into clean, agent-ready prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set initial theme before hydration to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function(){
              try{
                var t = localStorage.getItem('theme');
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                var initial = t === 'light' || t === 'dark' ? t : (prefersDark ? 'dark' : 'dark');
                if(initial === 'dark') document.documentElement.classList.add('dark');
              }catch(e){ document.documentElement.classList.add('dark'); }
            })();
          `}}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
