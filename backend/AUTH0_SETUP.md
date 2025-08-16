# Auth0 Setup Guide for Project Nexus

This guide will walk you through setting up Auth0 for the Project Nexus backend authentication system.

## Step 1: Create Auth0 Account and Tenant

1. Go to [https://auth0.com](https://auth0.com) and sign up for a free account
2. During setup, you'll create a tenant (e.g., `project-nexus` or your organization name)
3. Note your tenant domain - it will look like: `your-tenant.auth0.com` or `your-tenant.us.auth0.com`

## Step 2: Create an API in Auth0

1. In the Auth0 Dashboard, navigate to **Applications > APIs**
2. Click **"+ Create API"**
3. Configure the API:
   - **Name**: `Project Nexus API`
   - **Identifier**: `https://api.nexus.app` (this becomes your audience)
   - **Signing Algorithm**: `RS256` (leave as default)
4. Click **Create**

## Step 3: Create a Machine-to-Machine Application

1. After creating the API, Auth0 will automatically create a Machine-to-Machine application
2. Navigate to **Applications > Applications**
3. Find the application created for your API (usually named "Project Nexus API (Test Application)")
4. Click on it to view details

## Step 4: Create a Single Page Application (for frontend)

1. In **Applications**, click **"+ Create Application"**
2. Configure:
   - **Name**: `Project Nexus Web`
   - **Application Type**: `Single Page Application`
3. Click **Create**
4. In the application settings, configure:
   - **Allowed Callback URLs**: 
     ```
     http://localhost:3001/callback,
     http://localhost:3000/callback,
     https://your-production-domain.com/callback
     ```
   - **Allowed Logout URLs**: 
     ```
     http://localhost:3001,
     http://localhost:3000,
     https://your-production-domain.com
     ```
   - **Allowed Web Origins**: 
     ```
     http://localhost:3001,
     http://localhost:3000,
     https://your-production-domain.com
     ```
   - **Allowed Origins (CORS)**: Same as Web Origins
5. Save the changes

## Step 5: Configure Auth0 Rules (Optional but Recommended)

1. Navigate to **Auth Pipeline > Rules**
2. Create a new rule to add custom claims:

```javascript
function addCustomClaims(user, context, callback) {
  // Add custom claims to the ID token
  const namespace = 'https://api.nexus.app/';
  
  context.idToken[namespace + 'roles'] = user.app_metadata?.roles || [];
  context.idToken[namespace + 'permissions'] = user.app_metadata?.permissions || [];
  context.idToken[namespace + 'workspace_id'] = user.app_metadata?.workspace_id || null;
  
  // Add email verification requirement
  if (!user.email_verified) {
    return callback(new UnauthorizedError('Please verify your email before logging in.'));
  }
  
  callback(null, user, context);
}
```

## Step 6: Enable Multi-Factor Authentication (Optional)

1. Navigate to **Security > Multi-factor Auth**
2. Enable the MFA methods you want to support:
   - One-time Password (recommended)
   - SMS (if needed)
   - Push via Guardian
3. Configure MFA policies under **Policies**

## Step 7: Set Up Environment Variables

Create a `.env` file in the backend directory with the following Auth0 configuration:

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-spa-client-id
AUTH0_CLIENT_SECRET=your-spa-client-secret
AUTH0_AUDIENCE=https://api.nexus.app

# Optional: Management API credentials (for user management)
AUTH0_MANAGEMENT_CLIENT_ID=your-m2m-client-id
AUTH0_MANAGEMENT_CLIENT_SECRET=your-m2m-client-secret
```

## Step 8: Configure User Database (Optional)

If you want to use Auth0's user database:

1. Navigate to **Authentication > Database**
2. Click on **Username-Password-Authentication**
3. Configure password policy:
   - Minimum password length: 12
   - Require lowercase letters
   - Require uppercase letters
   - Require numbers
   - Require special characters

## Step 9: Test the Configuration

1. Copy the `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Auth0 credentials in the `.env` file

3. Start the backend services:
   ```bash
   docker-compose up -d postgres redis
   npm run dev
   ```

4. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```

5. The Auth0 health check should show "OK" if configured correctly

## Step 10: Get a Test Token

To test authentication, you can get a test token:

1. In Auth0 Dashboard, go to your API
2. Click on the **Test** tab
3. Copy the test token
4. Use it in your API requests:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/graphql
   ```

## Important URLs and Values to Save

- **Tenant Domain**: `your-tenant.auth0.com`
- **API Audience**: `https://api.nexus.app`
- **SPA Client ID**: From your SPA application
- **SPA Client Secret**: From your SPA application (keep secure!)
- **M2M Client ID**: From your M2M application
- **M2M Client Secret**: From your M2M application (keep secure!)
- **JWKS URI**: `https://your-tenant.auth0.com/.well-known/jwks.json`

## Security Best Practices

1. **Never commit secrets**: Keep `.env` files out of version control
2. **Use environment-specific configs**: Different Auth0 applications for dev/staging/prod
3. **Enable MFA**: Require MFA for admin users
4. **Regular token rotation**: Implement refresh token rotation
5. **Monitor suspicious activity**: Use Auth0's anomaly detection
6. **Implement rate limiting**: Already configured in the backend
7. **Validate email addresses**: Require email verification

## Troubleshooting

### Common Issues:

1. **"Audience is invalid"**: Make sure the audience in your token matches `AUTH0_AUDIENCE` in `.env`
2. **"Invalid token"**: Check that `AUTH0_DOMAIN` is correct and includes the region if applicable
3. **"JWKS error"**: Ensure your Auth0 tenant is accessible and the domain is correct
4. **"Unauthorized"**: Verify the token has the required scopes/permissions

### Debug Mode:

Set `LOG_LEVEL=debug` in your `.env` file to see detailed Auth0 authentication logs.

## Next Steps

1. Configure the frontend to use Auth0 (see frontend documentation)
2. Set up user roles and permissions in Auth0
3. Implement workspace-level permissions
4. Configure social login providers (Google, GitHub, etc.)
5. Set up email templates for verification and password reset

## Support

- Auth0 Documentation: https://auth0.com/docs
- Auth0 Community: https://community.auth0.com
- Project Nexus Issues: [GitHub Issues]