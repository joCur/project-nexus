import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessToken } from '@auth0/nextjs-auth0';

/**
 * Get user profile
 * GET /api/user/profile
 */
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get Auth0 access token for backend API calls
    const { accessToken } = await getAccessToken();

    // Call backend GraphQL API
    const graphqlQuery = `
      query MyProfile {
        myProfile {
          id
          fullName
          displayName
          timezone
          role
          preferences
          createdAt
          updatedAt
        }
      }
    `;

    const backendResponse = await fetch(`${process.env.API_BASE_URL || 'http://backend:3000'}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: graphqlQuery,
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.status}`);
    }

    const result = await backendResponse.json();

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      // If profile doesn't exist, return basic Auth0 info
      if (result.errors.some((error: any) => error.message.includes('not found'))) {
        return NextResponse.json({
          userId: session.user.sub,
          email: session.user.email,
          name: session.user.name,
          picture: session.user.picture,
          profile: null,
        });
      }
      throw new Error('GraphQL query failed');
    }

    const profile = result.data.myProfile;

    return NextResponse.json({
      userId: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
      profile,
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update user profile
 * POST /api/user/profile
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fullName, displayName, timezone, role, preferences } = body;

    // Validate required fields
    if (!fullName) {
      return NextResponse.json(
        { error: 'Full name is required' },
        { status: 400 }
      );
    }

    // Get Auth0 access token for backend API calls
    const { accessToken } = await getAccessToken();

    // Call backend GraphQL API
    const graphqlQuery = `
      mutation UpdateMyProfile($input: UserProfileUpdateInput!) {
        updateMyProfile(input: $input) {
          id
          fullName
          displayName
          timezone
          role
          preferences
          updatedAt
        }
      }
    `;

    const graphqlVariables = {
      input: {
        fullName,
        displayName,
        timezone,
        role: role?.toUpperCase(),
        preferences: preferences || {},
      },
    };

    const backendResponse = await fetch(`${process.env.API_BASE_URL || 'http://backend:3000'}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: graphqlVariables,
      }),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.status}`);
    }

    const result = await backendResponse.json();

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      throw new Error('GraphQL query failed');
    }

    const profile = result.data.updateMyProfile;

    console.log('User profile updated:', {
      userId: session.user.sub,
      profileId: profile.id,
      fullName: profile.fullName,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile,
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}