# Auth0 Setup Guide for Project Nexus Web Client

This guide walks you through setting up Auth0 authentication for the Project Nexus web client.

## Prerequisites

- Auth0 account (free tier works for development)
- Next.js development environment
- Backend API running (for user synchronization)

## Auth0 Tenant Configuration

### 1. Create Auth0 Application

1. Log in to your [Auth0 Dashboard](https://manage.auth0.com/)
2. Go to **Applications** → **Create Application**
3. Choose **Regular Web Applications**
4. Name it "Project Nexus Web Client"

### 2. Application Settings

Configure your application with these settings:

#### Basic Information
- **Name**: Project Nexus Web Client
- **Domain**: `your-tenant.auth0.com`
- **Client ID**: Copy this for your environment variables
- **Client Secret**: Copy this for your environment variables

#### Application URIs
- **Allowed Callback URLs**:
  ```
  http://localhost:3001/api/auth/callback,
  https://nexus.app/api/auth/callback
  ```

- **Allowed Logout URLs**:
  ```
  http://localhost:3001,
  https://nexus.app
  ```

- **Allowed Web Origins**:
  ```
  http://localhost:3001,
  https://nexus.app
  ```

- **Allowed Origins (CORS)**:
  ```
  http://localhost:3001,
  https://nexus.app
  ```

#### Advanced Settings

**Grant Types** (OAuth tab):
- ✅ Authorization Code
- ✅ Refresh Token
- ✅ Client Credentials (for Management API)

**Token Endpoint Authentication Method**:
- Select: `POST`

### 3. API Configuration

#### Create API for Backend Integration

1. Go to **APIs** → **Create API**
2. Configure:
   - **Name**: Project Nexus API
   - **Identifier**: `https://api.nexus-app.de`
   - **Signing Algorithm**: RS256

#### API Settings
- **Allow Skipping User Consent**: ✅ Enabled
- **Allow Offline Access**: ✅ Enabled
- **Token Expiration**: 86400 seconds (24 hours)
- **Token Expiration For Browser Flows**: 7200 seconds (2 hours)

#### API Scopes
Add these scopes for granular permissions:

```
read:cards          - Read user's cards
write:cards         - Create and update cards
delete:cards        - Delete user's cards
read:workspaces     - Read user's workspaces
write:workspaces    - Create and update workspaces
delete:workspaces   - Delete user's workspaces
admin:workspaces    - Admin access to workspaces
read:profile        - Read user profile
write:profile       - Update user profile
admin:users         - Admin user management
admin:system        - System administration
```

### 4. Rules and Actions Setup

#### Create Auth0 Action for Custom Claims

1. Go to **Actions** → **Flows** → **Login**
2. Create a new action: "Add Custom Claims"
3. Add this code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://api.nexus-app.de/';
  
  // Get user metadata
  const userRoles = event.user.app_metadata?.roles || ['user'];
  const userPermissions = event.user.app_metadata?.permissions || [
    'read:cards',
    'write:cards', 
    'read:workspaces',
    'write:workspaces',
    'read:profile',
    'write:profile'
  ];
  
  // Add custom claims to ID token and access token
  api.idToken.setCustomClaim(`${namespace}roles`, userRoles);
  api.idToken.setCustomClaim(`${namespace}permissions`, userPermissions);
  api.idToken.setCustomClaim(`${namespace}user_id`, event.user.user_id);
  
  api.accessToken.setCustomClaim(`${namespace}roles`, userRoles);
  api.accessToken.setCustomClaim(`${namespace}permissions`, userPermissions);
  api.accessToken.setCustomClaim(`${namespace}user_id`, event.user.user_id);
};
```

4. Add this action to your Login flow

#### Set Default User Metadata (Optional)

Create another action to set default metadata for new users:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Only run for new users (first login)
  if (event.stats.logins_count === 1) {
    const ManagementClient = require('auth0').ManagementClient;
    
    const management = new ManagementClient({
      domain: event.secrets.AUTH0_DOMAIN,
      clientId: event.secrets.AUTH0_M2M_CLIENT_ID,
      clientSecret: event.secrets.AUTH0_M2M_CLIENT_SECRET,
      scope: 'update:users'
    });
    
    // Set default user metadata
    await management.updateUser(
      { id: event.user.user_id },
      {
        app_metadata: {
          roles: ['user'],
          permissions: [
            'read:cards',
            'write:cards',
            'read:workspaces', 
            'write:workspaces',
            'read:profile',
            'write:profile'
          ]
        }
      }
    );
  }
};
```

### 5. Security Configuration

#### Multi-Factor Authentication (MFA)

1. Go to **Security** → **Multi-factor Auth**
2. Enable **Google Authenticator**
3. Configure MFA policies:
   - **Require MFA**: For all users (recommended)
   - **Allow Remember Browser**: 30 days

#### Attack Protection

1. Go to **Security** → **Attack Protection**
2. Enable **Brute Force Protection**:
   - Max attempts: 10
   - Block for: 1 hour
3. Enable **Suspicious IP Throttling**
4. Enable **Breached Password Detection**

#### Password Policy

1. Go to **Security** → **Password Policy**
2. Configure:
   - **Length**: Minimum 8 characters
   - **Character sets**: 3 of 4 required
   - **Password history**: 5 passwords
   - **Password dictionary**: Enabled

## Environment Variables Setup

### 1. Configure Environment Variables

Since this project uses Docker Compose, all environment variables are configured in the root `.env` file (not `.env.local`).

Copy the example environment file:
```bash
cp .env.example .env
```

### 2. Fill in Auth0 Configuration

Edit the `.env` file in the project root with your Auth0 settings:

```bash
# Required Auth0 settings
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id_from_auth0
AUTH0_CLIENT_SECRET=your_client_secret_from_auth0
AUTH0_SECRET=$(openssl rand -hex 32)
AUTH0_BASE_URL=http://localhost:3001
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.nexus.app

# Backend integration (these are set by Docker Compose)
GRAPHQL_ENDPOINT=http://backend:3000/graphql
API_BASE_URL=http://backend:3000
```

### 3. Generate AUTH0_SECRET

Generate a secure random secret:

```bash
# Using OpenSSL (recommended)
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## User Management

### Default User Roles

The system supports these roles:
- `user` - Standard user (default)
- `premium` - Premium features access
- `admin` - Administrative access
- `super_admin` - Full system access

### Assigning Roles and Permissions

#### Via Auth0 Dashboard

1. Go to **User Management** → **Users**
2. Select a user
3. Go to **app_metadata** section
4. Add:

```json
{
  "roles": ["admin"],
  "permissions": [
    "read:cards",
    "write:cards",
    "delete:cards",
    "read:workspaces",
    "write:workspaces",
    "admin:workspaces",
    "admin:users"
  ]
}
```

#### Via Management API

```javascript
const ManagementClient = require('auth0').ManagementClient;

const management = new ManagementClient({
  domain: 'your-tenant.auth0.com',
  clientId: 'your_m2m_client_id',
  clientSecret: 'your_m2m_client_secret',
  scope: 'update:users'
});

await management.updateUser(
  { id: 'auth0|user_id' },
  {
    app_metadata: {
      roles: ['admin'],
      permissions: ['admin:users', 'admin:system']
    }
  }
);
```

## Testing Authentication

### 1. Start Development Server

Using Docker Compose (recommended):
```bash
docker-compose up web
```

Or standalone:
```bash
cd clients/web
npm run dev
```

### 2. Test Login Flow

1. Visit `http://localhost:3001` (note the port 3001)
2. Click login button (if implemented)
3. Should redirect to Auth0 Universal Login
4. After login, should redirect back to application

### 3. Test API Integration

Check that user sync works:

1. Login successfully
2. Check backend logs for user sync messages
3. Verify user exists in database
4. Check JWT token includes custom claims

### 4. Test Protected Routes

```typescript
// Example protected component
import { ProtectedRoute, Permissions } from '@/components/auth/ProtectedRoute';

function AdminPanel() {
  return (
    <ProtectedRoute 
      requiredPermissions={[Permissions.ADMIN_USERS]}
      redirectTo="/dashboard"
    >
      <div>Admin content here</div>
    </ProtectedRoute>
  );
}
```

## Production Deployment

### 1. Update Auth0 URLs

Add production URLs to Auth0 application settings:
- Callback URLs: `https://nexus.app/api/auth/callback`
- Logout URLs: `https://nexus.app`
- Web Origins: `https://nexus.app`

### 2. Production Environment Variables

```bash
AUTH0_BASE_URL=https://nexus.app
GRAPHQL_ENDPOINT=https://api.nexus.app/graphql
NODE_ENV=production
```

### 3. Security Checklist

- ✅ Use strong AUTH0_SECRET (32+ characters)
- ✅ Enable HTTPS in production
- ✅ Configure proper CORS settings
- ✅ Enable MFA for all users
- ✅ Set up monitoring and alerting
- ✅ Configure rate limiting
- ✅ Enable attack protection features

## Troubleshooting

### Common Issues

#### 1. "Invalid state" Error
- Check AUTH0_SECRET is properly set
- Ensure callback URLs match exactly

#### 2. "Access Denied" Error  
- Verify user has required permissions
- Check custom claims are being added

#### 3. User Sync Failures
- Check GraphQL endpoint is accessible
- Verify backend Auth0 configuration
- Check network connectivity

#### 4. Session Expires Too Quickly
- Verify session configuration in lib/auth0-config.ts
- Check cookie settings for your domain

### Debug Mode

Enable debug logging:

```bash
DEBUG=@auth0/nextjs-auth0:*
npm run dev
```

### Logs to Check

- Browser Network tab for Auth0 requests
- Backend logs for user sync operations  
- Auth0 Dashboard logs for authentication events

## Support Resources

- [Auth0 Next.js SDK Documentation](https://auth0.com/docs/quickstart/webapp/nextjs)
- [Auth0 React SDK Documentation](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 Management API](https://auth0.com/docs/api/management/v2)
- [Project Nexus Backend Integration](../../backend/AUTH0_SETUP.md)