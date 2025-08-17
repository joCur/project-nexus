import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';

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

    // TODO: Fetch from database
    // const userProfile = await prisma.userProfile.findUnique({
    //   where: { userId: session.user.sub }
    // });

    // For now, return basic info from Auth0
    return NextResponse.json({
      userId: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      picture: session.user.picture,
      // TODO: Add database fields when implemented
      // fullName: userProfile?.fullName,
      // displayName: userProfile?.displayName,
      // role: userProfile?.role,
      // preferences: userProfile?.preferences,
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

    // Log for development
    console.log('User profile updated:', {
      userId: session.user.sub,
      fullName,
      displayName,
      timezone,
      role,
      preferences
    });

    // TODO: Save to database
    // const userProfile = await prisma.userProfile.upsert({
    //   where: { userId: session.user.sub },
    //   update: {
    //     fullName,
    //     displayName,
    //     timezone,
    //     role,
    //     preferences,
    //     updatedAt: new Date(),
    //   },
    //   create: {
    //     userId: session.user.sub,
    //     fullName,
    //     displayName,
    //     timezone,
    //     role,
    //     preferences,
    //     createdAt: new Date(),
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        fullName,
        displayName,
        timezone,
        role,
        preferences
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}