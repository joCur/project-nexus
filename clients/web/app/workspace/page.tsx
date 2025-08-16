'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Permissions } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';

function WorkspaceContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Workspace</h1>
            <div className="flex items-center space-x-2">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name || user.email}
                  className="h-8 w-8 rounded-full"
                />
              )}
              <span className="text-sm text-gray-700">
                {user?.name || user?.email}
              </span>
            </div>
          </div>

          <div className="mt-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Welcome to your Knowledge Workspace
              </h2>
              
              <div className="space-y-4">
                <p className="text-gray-600">
                  This is your protected workspace where you can create and manage your knowledge graphs.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">User Information</h3>
                    <dl className="space-y-1 text-sm">
                      <div>
                        <dt className="text-gray-500">Email:</dt>
                        <dd className="text-gray-900">{user?.email}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Name:</dt>
                        <dd className="text-gray-900">{user?.name || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Email Verified:</dt>
                        <dd className="text-gray-900">
                          {user?.email_verified ? (
                            <span className="text-green-600">✓ Verified</span>
                          ) : (
                            <span className="text-red-600">✗ Not verified</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Permissions</h3>
                    <div className="space-y-1 text-sm">
                      {user?.roles && user.roles.length > 0 ? (
                        <>
                          <div>
                            <span className="text-gray-500">Roles:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.roles.map((role) => (
                                <span
                                  key={role}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500">No roles assigned</p>
                      )}
                      
                      {user?.permissions && user.permissions.length > 0 ? (
                        <>
                          <div className="mt-3">
                            <span className="text-gray-500">Permissions:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.permissions.slice(0, 4).map((permission) => (
                                <span
                                  key={permission}
                                  className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                                >
                                  {permission}
                                </span>
                              ))}
                              {user.permissions.length > 4 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  +{user.permissions.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 mt-3">No permissions assigned</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Next Steps</h3>
                  <ul className="text-blue-800 text-sm space-y-1">
                    <li>• Create your first knowledge card</li>
                    <li>• Explore the infinite canvas</li>
                    <li>• Let AI discover connections between your ideas</li>
                    <li>• Invite collaborators to your workspace</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <ProtectedRoute
      requiredPermissions={['read:workspaces']}
      redirectTo="/workspace"
    >
      <WorkspaceContent />
    </ProtectedRoute>
  );
}