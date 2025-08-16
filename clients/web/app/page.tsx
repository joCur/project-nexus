'use client';

import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';

export default function HomePage() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">Project Nexus</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2">
                  {user.picture && (
                    <img
                      src={user.picture}
                      alt={user.name || user.email}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">
                    {user.name || user.email}
                  </span>
                </div>
                <Link
                  href="/workspace"
                  className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
                >
                  Workspace
                </Link>
                <button
                  onClick={() => logout()}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => login({ returnTo: '/workspace' })}
                className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        <div className="py-20">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
              AI-Powered
              <span className="text-primary-600"> Knowledge Workspace</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Transform scattered thoughts into an interconnected knowledge graph with intelligent connections and visual organization.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              {user ? (
                <Link
                  href="/workspace"
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg md:px-10"
                >
                  Open Workspace
                </Link>
              ) : (
                <button
                  onClick={() => login({ returnTo: '/workspace' })}
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 md:py-4 md:text-lg md:px-10"
                >
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Features section */}
        <div className="py-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Features
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-primary-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AI-Powered Connections
                </h3>
                <p className="text-gray-600">
                  Automatically discover relationships between your ideas using advanced AI analysis.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Visual Canvas
                </h3>
                <p className="text-gray-600">
                  Organize your thoughts on an infinite canvas with intuitive drag-and-drop interactions.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary-100 p-3 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Real-time Sync
                </h3>
                <p className="text-gray-600">
                  Seamlessly sync across all your devices with real-time collaboration features.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}