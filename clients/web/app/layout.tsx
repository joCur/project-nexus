import { UserProvider } from '@auth0/nextjs-auth0/client';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Project Nexus - AI-Powered Knowledge Workspace',
  description: 'Transform scattered thoughts into an interconnected knowledge graph with AI-powered visual workspace.',
  keywords: ['knowledge graph', 'AI', 'visual workspace', 'note-taking', 'productivity'],
  authors: [{ name: 'Project Nexus Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}