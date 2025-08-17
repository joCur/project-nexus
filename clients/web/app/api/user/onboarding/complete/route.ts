import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';

/**
 * Complete onboarding and save final user profile
 * POST /api/user/onboarding/complete
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
    const { completedAt, userProfile, tutorialProgress } = body;

    // Validate required fields
    if (!completedAt || !userProfile?.fullName || !userProfile?.preferences?.workspaceName) {
      return NextResponse.json(
        { error: 'Missing required profile information' },
        { status: 400 }
      );
    }

    // Log for development
    console.log('Onboarding completed:', {
      userId: session.user.sub,
      completedAt,
      userProfile,
      tutorialProgress
    });

    // TODO: Implement actual database storage
    // Example database operations:
    
    // 1. Save user profile
    // await prisma.userProfile.upsert({
    //   where: { userId: session.user.sub },
    //   update: {
    //     fullName: userProfile.fullName,
    //     displayName: userProfile.displayName,
    //     timezone: userProfile.timezone,
    //     role: userProfile.role,
    //     preferences: userProfile.preferences,
    //     updatedAt: new Date(),
    //   },
    //   create: {
    //     userId: session.user.sub,
    //     fullName: userProfile.fullName,
    //     displayName: userProfile.displayName,
    //     timezone: userProfile.timezone,
    //     role: userProfile.role,
    //     preferences: userProfile.preferences,
    //     createdAt: new Date(),
    //   }
    // });

    // 2. Mark onboarding as complete
    // await prisma.userOnboarding.upsert({
    //   where: { userId: session.user.sub },
    //   update: {
    //     completed: true,
    //     completedAt: new Date(completedAt),
    //     finalStep: 3,
    //     tutorialProgress,
    //   },
    //   create: {
    //     userId: session.user.sub,
    //     completed: true,
    //     completedAt: new Date(completedAt),
    //     finalStep: 3,
    //     tutorialProgress,
    //   }
    // });

    // 3. Create default workspace
    // await prisma.workspace.create({
    //   data: {
    //     userId: session.user.sub,
    //     name: userProfile.preferences.workspaceName,
    //     privacy: userProfile.preferences.privacy,
    //     isDefault: true,
    //     createdAt: new Date(),
    //   }
    // });

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      userProfile: {
        fullName: userProfile.fullName,
        displayName: userProfile.displayName,
        workspaceName: userProfile.preferences.workspaceName,
      }
    });

  } catch (error) {
    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}