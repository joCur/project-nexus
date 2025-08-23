import { mergeResolvers } from '@graphql-tools/merge';
import { authResolvers } from './auth';
import { userResolvers } from './user';
import { healthResolvers } from './health';
import { userProfileResolvers } from './userProfile';
import { onboardingResolvers } from './onboarding';
import { workspaceResolvers } from './workspace';
import { workspaceMemberResolvers } from './workspaceMemberResolvers';
import { onboardingWorkflowResolvers } from './onboardingWorkflow';
import { cardResolvers } from './cardResolvers';

/**
 * Merge all GraphQL resolvers into a single resolver object
 */
export const resolvers = mergeResolvers([
  authResolvers,
  userResolvers,
  userProfileResolvers,
  onboardingResolvers,
  onboardingWorkflowResolvers,
  workspaceResolvers,
  workspaceMemberResolvers,
  cardResolvers,
  healthResolvers,
]);