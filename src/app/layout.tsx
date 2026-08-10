import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// Inter everywhere — the design direction (docs/build-notes.md) leans on a
// real typeface with tight tracking at display sizes.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Knowledge base",
  description: "What the team keeps re-explaining, written down once.",
};

const themeInit = `(function(){try{var t=localStorage.getItem("kb-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Runs before hydration so the theme applies without a flash. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
