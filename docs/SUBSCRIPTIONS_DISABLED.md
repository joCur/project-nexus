# 🚨 GraphQL Subscriptions Temporarily Disabled

## Overview
Real-time subscriptions have been temporarily disabled due to backend authentication/permission issues causing GraphQL to return null for non-nullable subscription fields.

## What's Disabled
All real-time collaboration features are currently disabled:

### Canvas Subscriptions (use-canvas.ts)
- ❌ `CANVAS_CREATED_SUBSCRIPTION` - New canvas notifications
- ❌ `CANVAS_UPDATED_SUBSCRIPTION` - Canvas rename/edit notifications
- ❌ `CANVAS_DELETED_SUBSCRIPTION` - Canvas deletion notifications
- ❌ `DEFAULT_CANVAS_CHANGED_SUBSCRIPTION` - Default canvas changes

### Card Subscriptions (useCardOperations.ts)
- ❌ `CARD_CREATED_SUBSCRIPTION` - New card notifications
- ❌ `CARD_UPDATED_SUBSCRIPTION` - Card edit/move notifications
- ❌ `CARD_DELETED_SUBSCRIPTION` - Card deletion notifications

## Impact
- ✅ **App functionality preserved** - All features work without real-time updates
- ❌ **No real-time collaboration** - Users must refresh to see others' changes
- ❌ **No live notifications** - No instant updates when teammates work
- ❌ **No collaborative presence** - Can't see who's currently editing

## Backend Status
The backend subscriptions **are fully implemented**:
- ✅ Schema definitions exist in `canvasTypeDefs.ts`
- ✅ Subscription resolvers exist in `canvasResolvers.ts`
- ✅ PubSub events are published correctly
- ✅ Authentication and permission filtering implemented

## Root Cause
Backend subscription resolvers are returning `null` instead of data, likely due to:
1. **Authentication issues** - `context.isAuthenticated` failing
2. **Permission checks failing** - `hasWorkspaceAccess()` returning false
3. **Environment issues** - Development PubSub not working properly

## How to Re-enable

### 1. Debug Backend Issues
```bash
# Check authentication in subscription context
# Verify permission checks are working
# Test PubSub in development environment
```

### 2. Search for Disabled Code
```bash
# Find all disabled subscription code
grep -r "TODO.*subscriptions" clients/web/
grep -r "🚨.*SUBSCRIPTIONS" clients/web/
```

### 3. Re-enable Subscriptions
1. Uncomment `useSubscription` imports
2. Restore subscription hook implementations
3. Test real-time functionality
4. Update TodoWrite list

### 4. TodoWrite Tasks
- [ ] Re-enable canvas subscriptions in useCanvasSubscriptions hook
- [ ] Re-enable card subscriptions in useCardOperations hook
- [ ] Uncomment useSubscription imports in use-canvas.ts
- [ ] Uncomment useSubscription imports in useCardOperations.ts
- [ ] Debug backend subscription authentication/permission issues
- [ ] Test real-time collaboration features after re-enabling subscriptions

## Files Modified
- `clients/web/hooks/use-canvas.ts` - Canvas subscriptions disabled
- `clients/web/hooks/useCardOperations.ts` - Card subscriptions disabled
- Both files have commented imports and detailed TODO comments

## Expected Features When Fixed
- 🔄 **Real-time canvas updates** - See new canvases instantly
- 🔄 **Live card collaboration** - See others editing in real-time
- 🔄 **Instant notifications** - Know when teammates make changes
- 🔄 **Multi-user presence** - See who's currently active
- 🔄 **Conflict prevention** - Reduce editing conflicts

## Search Patterns
To find all disabled subscription code:
- `TODO.*subscriptions`
- `🚨.*SUBSCRIPTIONS`
- `useSubscription.*TODO`
- `TEMPORARILY DISABLED.*subscriptions`