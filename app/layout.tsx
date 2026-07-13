import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from 'sonner';
import AuthInitializer from '@/components/auth/AuthInitializer';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME!,
  description: 'Production-grade Email Automation Management',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthInitializer>
          {children}
        </AuthInitializer>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
