import type { Metadata } from 'next';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HIMS | Hospital Information Management System',
    template: '%s | HIMS',
  },
  description: 'Enterprise-grade, India-first Hospital Information Management, Operating System & Clinical Decision Support Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-slate-50 text-slate-900">
        <div className="flex h-screen flex-col">
          <Navbar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
