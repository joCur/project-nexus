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

## Step 3: Create a Single Page Application (for frontend)

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

## Step 4: Configure Auth0 Actions (Optional but Recommended)

Actions are Auth0's modern way to customize the authentication flow. Let's create an Action to add custom claims and enforce email verification:

### Create a Login Action:

1. Navigate to **Actions > Library** in Auth0 Dashboard
2. Click **+ Build Custom Action**
3. Select **Post-Login** trigger (this shows the flow: "user logged in" → "token issued")
4. Configure the Action:
   - **Name**: `Add Custom Claims`
   - **Trigger**: `Post-Login`
   - **Runtime**: `Node 18` (recommended)
5. Click **Create**

### Add the Action Code:

Replace the default code with:

```javascript
/**
 * Handler that will be called during the execution of a PostLogin flow.
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://api.nexus-app.de/';
  
  // Require email verification
  if (!event.user.email_verified) {
    api.access.deny('Please verify your email before logging in.');
    return;
  }
  
  // Add custom claims to both ID and Access tokens
  const claims = {
    [`${namespace}roles`]: event.user.app_metadata?.roles || [],
    [`${namespace}permissions`]: event.user.app_metadata?.permissions || [],
    [`${namespace}workspace_id`]: event.user.app_metadata?.workspace_id || null,
    [`${namespace}user_id`]: event.user.user_id,
    [`${namespace}email`]: event.user.email
  };
  
  // Add claims to tokens
  Object.entries(claims).forEach(([key, value]) => {
    api.idToken.setCustomClaim(key, value);
    api.accessToken.setCustomClaim(key, value);
  });
  
  console.log('Custom claims added for user:', event.user.email);
};
```

### Deploy and Attach the Action:

After writing your Action code:

1. Click **Save Draft**
2. Click **Deploy** 
3. Once deployed, you should see an **"Add to flow"** or **"Use Action"** button
4. Click it and select **Login Flow**
5. The action will be automatically added to your login flow

### Alternative Deployment Method:

If you don't see the "Add to flow" button:
1. After deploying, go back to **Actions > Library**
2. Find your action in the list
3. Look for a **three-dot menu (⋯)** next to your action
4. Click it and select **"Add to Flow"** or **"Use in Flow"**
5. Choose **Login** from the dropdown

### Verify It's Working:

To confirm your action is active:
1. Go to **Monitoring > Logs** in Auth0 Dashboard
2. Perform a test login
3. You should see your console.log message in the logs
4. Look for "Custom claims added for user: [email]"

## Step 5: Enable Multi-Factor Authentication (Optional)

1. Navigate to **Security > Multi-factor Auth**
2. Enable the MFA methods you want to support:
   - One-time Password (recommended)
   - SMS (if needed)
   - Push via Guardian
3. Configure MFA policies under **Policies**

## Step 6: Set Up Environment Variables

Edit the root `.env` file with your Auth0 configuration:

```bash
# Auth0 Configuration (Required)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-spa-client-id
AUTH0_CLIENT_SECRET=your-spa-client-secret
AUTH0_AUDIENCE=https://api.nexus-app.de

# Management API credentials (Leave empty - not needed for basic auth)
AUTH0_MANAGEMENT_CLIENT_ID=
AUTH0_MANAGEMENT_CLIENT_SECRET=
```

## Step 7: Configure User Database (Optional)

If you want to use Auth0's user database:

1. Navigate to **Authentication > Database**
2. Click on **Username-Password-Authentication**
3. Configure password policy:
   - Minimum password length: 12
   - Require lowercase letters
   - Require uppercase letters
   - Require numbers
   - Require special characters

## Step 8: Test the Configuration

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

## Step 9: Get a Test Token

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
- **Management API**: Not needed for basic authentication (can add later if needed)
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