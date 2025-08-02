import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Function Insights - AI-Powered Session Analysis',
  description: 'Analyze user session recordings with AI to detect friction points and improve UX',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}