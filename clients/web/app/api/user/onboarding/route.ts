import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';

/**
 * Save onboarding progress
 * POST /api/user/onboarding
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
    const { step, completedAt, tutorialProgress, userProfile } = body;

    // TODO: Save to database
    // For now, we'll just validate the data structure
    if (typeof step !== 'number' || !completedAt) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Log for development
    console.log('Onboarding progress saved:', {
      userId: session.user.sub,
      step,
      completedAt,
      tutorialProgress,
      userProfile
    });

    // TODO: Implement actual database storage
    // Example:
    // await prisma.userOnboarding.upsert({
    //   where: { userId: session.user.sub },
    //   update: { step, completedAt, tutorialProgress, userProfile },
    //   create: { userId: session.user.sub, step, completedAt, tutorialProgress, userProfile }
    // });

    return NextResponse.json({
      success: true,
      message: 'Onboarding progress saved',
      step,
    });

  } catch (error) {
    console.error('Error saving onboarding progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}