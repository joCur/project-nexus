import { mergeResolvers } from '@graphql-tools/merge';
import { authResolvers } from './auth';
import { userResolvers } from './user';
import { healthResolvers } from './health';

/**
 * Merge all GraphQL resolvers into a single resolver object
 */
export const resolvers = mergeResolvers([
  authResolvers,
  userResolvers,
  healthResolvers,
]);