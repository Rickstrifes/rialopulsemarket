import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/contexts/WalletContextProvider";
import Navbar from "@/components/Navbar";

import { Toaster } from "react-hot-toast";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Pulse - Solana Prediction Market",
  description: "Predict the future on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} antialiased min-h-screen flex flex-col font-sans bg-background text-foreground`}
      >
        <WalletContextProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'glass-toast',
              success: {
                duration: 5000,
                className: 'glass-toast glass-toast-success',
                iconTheme: {
                  primary: "#22c55e",
                  secondary: "#13141f",
                },
              },
              error: {
                duration: 5000,
                className: 'glass-toast glass-toast-error',
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#13141f",
                },
              },
            }}
          />
          <Navbar />
          <main className="grow container mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="py-4 text-center text-sm text-gray-500 border-t border-gray-800 flex flex-row justify-center items-center gap-2">
            Our Social Media
            <a
              href="https://x.com/pulsemarket0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors flex items-center"
              aria-label="X (Twitter)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="w-4 h-4 ml-1">
                <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.873 11.633Z"/>
              </svg>
            </a>
          </footer>
        </WalletContextProvider>
      </body>
    </html>
  );
}
