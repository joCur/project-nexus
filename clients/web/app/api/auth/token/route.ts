import { getAccessToken } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

/**
 * API endpoint to retrieve Auth0 access token for GraphQL requests
 * Used by Apollo Client authentication link
 */
export async function GET() {
  try {
    console.log('Token endpoint called - attempting to get access token');
    const { accessToken } = await getAccessToken();
    
    if (!accessToken) {
      console.log('No access token available - user may not be logged in');
      return NextResponse.json(
        { error: 'No access token available' },
        { status: 401 }
      );
    }

    console.log('Access token retrieved successfully');
    return NextResponse.json({ 
      accessToken 
    });
  } catch (error) {
    console.error('Error getting access token:', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve access token' },
      { status: 500 }
    );
  }
}