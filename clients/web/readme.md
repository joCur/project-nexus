# Project Nexus Web Client

AI-powered visual knowledge workspace built with Next.js 14 and Auth0 authentication.

## Features

- **Auth0 Integration**: Enterprise-grade authentication with Universal Login
- **Type-Safe Authentication**: Complete TypeScript support for auth flows
- **Protected Routes**: Role and permission-based access control
- **Session Management**: 4-hour sessions with secure cookie configuration
- **User Synchronization**: Automatic sync with backend GraphQL API
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Accessibility**: WCAG 2.1 compliant with screen reader support

## Authentication Architecture

This implementation follows the security requirements specified in the technical architecture:

### Key Components

1. **Auth0 Configuration** (`lib/auth0-config.ts`)
   - 4-hour session duration
   - Production cookie configuration for .nexus.app domain
   - Environment-specific settings

2. **API Route Handlers** (`app/api/auth/[auth0]/route.ts`)
   - Auth0 callback processing
   - User synchronization with backend
   - Error handling and logging

3. **Authentication Hook** (`hooks/use-auth.ts`)
   - Type-safe user state management
   - Permission and role checking utilities
   - Login/logout functions with options

4. **Protected Route Component** (`components/auth/ProtectedRoute.tsx`)
   - Automatic authentication requirement
   - Permission-based access control
   - Custom authorization logic support

5. **TypeScript Types** (`types/auth.ts`)
   - Complete type definitions for Auth0 integration
   - Backend interface compatibility
   - Type guards and utilities

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env.local
```

Fill in your Auth0 configuration:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=$(openssl rand -hex 32)
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.nexus-app.de
GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

### 3. Auth0 Setup

Follow the [Auth0 Setup Guide](./AUTH0_SETUP.md) to configure your Auth0 tenant.

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Project Structure

```
clients/web/
├── app/                          # Next.js App Router
│   ├── api/auth/[auth0]/        # Auth0 API routes
│   ├── workspace/               # Protected workspace pages
│   ├── layout.tsx               # Root layout with Auth0 provider
│   └── page.tsx                 # Homepage
├── components/
│   └── auth/
│       └── ProtectedRoute.tsx   # Authentication components
├── hooks/
│   └── use-auth.ts              # Authentication hooks
├── lib/
│   └── auth0-config.ts          # Auth0 configuration
├── styles/
│   └── globals.css              # Global styles and Auth components
├── types/
│   └── auth.ts                  # Authentication TypeScript types
├── .env.example                 # Environment variables template
├── AUTH0_SETUP.md              # Auth0 configuration guide
└── README.md                   # This file
```

## Usage Examples

### Basic Authentication

```tsx
import { useAuth } from '@/hooks/use-auth';

function MyComponent() {
  const { user, isLoading, login, logout } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {user ? (
        <div>
          <p>Welcome, {user.email}!</p>
          <button onClick={() => logout()}>Logout</button>
        </div>
      ) : (
        <button onClick={() => login()}>Login</button>
      )}
    </div>
  );
}
```

### Protected Routes

```tsx
import { ProtectedRoute, Permissions } from '@/components/auth/ProtectedRoute';

function AdminPanel() {
  return (
    <ProtectedRoute 
      requiredPermissions={[Permissions.ADMIN_USERS]}
      redirectTo="/dashboard"
    >
      <div>Admin-only content</div>
    </ProtectedRoute>
  );
}
```

### Permission Checking

```tsx
import { useAuth, Permissions, Roles } from '@/hooks/use-auth';

function ConditionalFeature() {
  const { checkPermission, hasRole } = useAuth();
  
  const canCreateCards = checkPermission(Permissions.WRITE_CARDS);
  const isAdmin = hasRole(Roles.ADMIN);
  
  return (
    <div>
      {canCreateCards && <button>Create Card</button>}
      {isAdmin && <button>Admin Panel</button>}
    </div>
  );
}
```

### Higher-Order Component

```tsx
import { withAuth } from '@/components/auth/ProtectedRoute';

const ProtectedPage = withAuth(
  function MyPage() {
    return <div>Protected content</div>;
  },
  {
    requiredPermissions: [Permissions.READ_CARDS],
    redirectTo: '/login'
  }
);
```

## Configuration

### Session Management

Sessions are configured for 4-hour duration as per security requirements:

```typescript
session: {
  cookie: {
    domain: process.env.NODE_ENV === 'production' ? '.nexus.app' : undefined,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
  absoluteDuration: 4 * 60 * 60, // 4 hours
  rolling: false,
}
```

### Custom Claims

Auth0 custom claims are automatically extracted:

```typescript
// Available in user object
user.roles           // ['user', 'admin']
user.permissions     // ['read:cards', 'write:cards']
user.internalUserId  // Internal database user ID
```

### Environment Variables

#### Required

- `AUTH0_DOMAIN` - Your Auth0 tenant domain
- `AUTH0_CLIENT_ID` - Auth0 application client ID
- `AUTH0_CLIENT_SECRET` - Auth0 application client secret
- `AUTH0_SECRET` - Secret for session encryption (32+ characters)
- `AUTH0_BASE_URL` - Application base URL
- `AUTH0_ISSUER_BASE_URL` - Auth0 issuer URL
- `AUTH0_AUDIENCE` - API audience for backend access

#### Optional

- `AUTH0_ORGANIZATION` - Auth0 organization ID
- `GRAPHQL_ENDPOINT` - Backend GraphQL API endpoint
- `NEXT_PUBLIC_APP_URL` - Public application URL

## Security Features

- **Secure Session Management**: httpOnly cookies with 4-hour expiration
- **CSRF Protection**: Built-in CSRF protection via Auth0 SDK
- **XSS Protection**: Secure token handling and sanitization
- **Permission-Based Access**: Granular permission checking
- **Attack Protection**: Integration with Auth0's security features
- **Audit Logging**: Authentication events logged to backend

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run Jest tests

### Testing Authentication

1. Start the development server
2. Visit `http://localhost:3000`
3. Click "Sign In" to test login flow
4. Verify user sync in backend logs
5. Test protected routes in `/workspace`

## Deployment

### Production Environment

Update Auth0 application settings:

```
Allowed Callback URLs: https://nexus.app/api/auth/callback
Allowed Logout URLs: https://nexus.app
Allowed Web Origins: https://nexus.app
```

Set production environment variables:

```bash
AUTH0_BASE_URL=https://nexus.app
NODE_ENV=production
```

### Security Checklist

- ✅ Strong AUTH0_SECRET (32+ characters)
- ✅ HTTPS enabled in production
- ✅ Secure cookie configuration
- ✅ CORS properly configured
- ✅ Rate limiting enabled
- ✅ MFA enabled for users
- ✅ Attack protection configured

## Troubleshooting

### Common Issues

1. **"Invalid state" errors**: Check AUTH0_SECRET configuration
2. **Session expires immediately**: Verify cookie domain settings
3. **User sync failures**: Check backend GraphQL endpoint
4. **Permission errors**: Verify Auth0 custom claims configuration

### Debug Mode

Enable debug logging:

```bash
DEBUG=@auth0/nextjs-auth0:* npm run dev
```

## Support

- [Auth0 Next.js Documentation](https://auth0.com/docs/quickstart/webapp/nextjs)
- [Project Nexus Backend Integration](../../backend/AUTH0_SETUP.md)
- [Technical Architecture](../../project-documentation/technical-architecture.md)