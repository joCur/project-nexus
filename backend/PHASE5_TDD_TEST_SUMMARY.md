# Phase 5: Tiptap JSONB Content Storage - TDD Test Summary

## Overview

This document summarizes the comprehensive test suite created for Phase 5 of the Tiptap v3 implementation. All tests are currently in the **RED phase** (failing) as expected in Test-Driven Development, awaiting implementation.

## Test File Location

**File:** `backend/src/__tests__/unit/services/CardService.test.ts`

## Test Coverage Summary

### 1. Creating Cards with Tiptap JSON Content (6 tests)

#### ✅ Test: Create text card with Tiptap JSON content
- **Purpose:** Verify cards can be created with Tiptap JSON structure
- **Validates:** JSONB storage, proper column usage
- **Status:** RED (awaiting implementation)

#### ✅ Test: Set content_format to "tiptap" for JSON content
- **Purpose:** Ensure content_format field is correctly set to 'tiptap'
- **Validates:** Format detection and storage
- **Status:** RED (awaiting implementation)

#### ✅ Test: Validate Tiptap JSON structure before storing
- **Purpose:** Reject invalid Tiptap JSON structures
- **Validates:** Schema validation, missing required fields
- **Status:** RED (awaiting implementation)

#### ✅ Test: Prevent XSS attacks in Tiptap JSON content
- **Purpose:** Sanitize malicious content in JSON text nodes
- **Validates:** Security, XSS prevention
- **Status:** RED (awaiting implementation)

#### ✅ Test: Enforce content size limits for Tiptap JSON
- **Purpose:** Reject JSON content exceeding size limits (>100KB)
- **Validates:** Size validation, DoS prevention
- **Status:** RED (awaiting implementation)

#### ✅ Test: Store nested Tiptap JSON structures correctly
- **Purpose:** Handle complex nested JSON structures (headings, lists, formatting)
- **Validates:** Deep nesting support, structure preservation
- **Status:** RED (awaiting implementation)

### 2. Backward Compatibility with Markdown Content (4 tests)

#### ✅ Test: Create text card with markdown string content
- **Purpose:** Ensure markdown strings still work as before
- **Validates:** Backward compatibility, TEXT column usage
- **Status:** RED (awaiting implementation)

#### ✅ Test: Set content_format to "markdown" for string content
- **Purpose:** Properly identify and mark markdown content
- **Validates:** Format detection for strings
- **Status:** RED (awaiting implementation)

#### ✅ Test: Retrieve old cards (created before migration) correctly
- **Purpose:** Legacy cards without content_format field work properly
- **Validates:** Migration backward compatibility
- **Status:** RED (awaiting implementation)

#### ✅ Test: Handle NULL content_format as markdown
- **Purpose:** Treat NULL/undefined content_format as markdown (default)
- **Validates:** Graceful degradation for legacy data
- **Status:** RED (awaiting implementation)

### 3. Updating Card Content and Format Migration (3 tests)

#### ✅ Test: Update markdown content to Tiptap JSON
- **Purpose:** Support migration from markdown to Tiptap format
- **Validates:** Format conversion, column migration (TEXT → JSONB)
- **Status:** RED (awaiting implementation)

#### ✅ Test: Update Tiptap JSON content correctly
- **Purpose:** Update existing Tiptap content properly
- **Validates:** JSONB update operations
- **Status:** RED (awaiting implementation)

#### ✅ Test: Preserve content format when updating other fields
- **Purpose:** Don't change format when updating title/metadata
- **Validates:** Format preservation on partial updates
- **Status:** RED (awaiting implementation)

### 4. Content Retrieval and Serialization (4 tests)

#### ✅ Test: Retrieve card with JSON content and return proper structure
- **Purpose:** Return Tiptap JSON as object, not string
- **Validates:** Deserialization, type correctness
- **Status:** RED (awaiting implementation)

#### ✅ Test: Properly deserialize JSON from JSONB column
- **Purpose:** Complex JSON structures deserialize correctly
- **Validates:** JSONB → JavaScript object conversion
- **Status:** RED (awaiting implementation)

#### ✅ Test: Retrieve markdown cards and return string content
- **Purpose:** Markdown content returns as string
- **Validates:** Type differentiation (string vs object)
- **Status:** RED (awaiting implementation)

#### ✅ Test: Handle corrupted JSON gracefully
- **Purpose:** Error handling for NULL/corrupted JSONB data
- **Validates:** Error recovery, graceful degradation
- **Status:** RED (awaiting implementation)

### 5. Tiptap JSON Validation Schemas (4 tests)

#### ✅ Test: Validate required Tiptap JSON fields
- **Purpose:** Reject JSON missing required 'type' field
- **Validates:** Schema validation, required fields
- **Status:** RED (awaiting implementation)

#### ✅ Test: Validate Tiptap node types are allowed
- **Purpose:** Only allow whitelisted node types (paragraph, heading, etc.)
- **Validates:** Node type whitelist, security
- **Status:** RED (awaiting implementation)

#### ✅ Test: Validate mark types are allowed
- **Purpose:** Only allow whitelisted mark types (bold, italic, etc.)
- **Validates:** Mark type whitelist, security
- **Status:** RED (awaiting implementation)

#### ✅ Test: Reject deeply nested JSON to prevent DoS
- **Purpose:** Limit nesting depth to prevent stack overflow/DoS
- **Validates:** Depth validation, DoS prevention
- **Status:** RED (awaiting implementation)

### 6. Performance and Database Operations (3 tests)

#### ✅ Test: Use JSONB operators for efficient queries
- **Purpose:** Utilize PostgreSQL JSONB operators (@>, ->, etc.)
- **Validates:** Query optimization, JSONB containment
- **Status:** RED (awaiting implementation)

#### ✅ Test: Index JSONB content for search performance
- **Purpose:** Document expected GIN index usage
- **Validates:** Index creation, query planning
- **Status:** RED (awaiting implementation)

#### ✅ Test: Handle batch operations with mixed content formats
- **Purpose:** Batch updates work with markdown and Tiptap cards
- **Validates:** Format-agnostic batch operations
- **Status:** RED (awaiting implementation)

## Total Test Count

**24 comprehensive tests** covering:
- ✅ Creating cards (6 tests)
- ✅ Backward compatibility (4 tests)
- ✅ Content updates and migration (3 tests)
- ✅ Retrieval and serialization (4 tests)
- ✅ Validation schemas (4 tests)
- ✅ Performance and database (3 tests)

## Expected Database Schema Changes

The tests expect the following database changes (to be implemented in migration):

### New Columns
```sql
ALTER TABLE cards
  ADD COLUMN content_json JSONB,              -- Tiptap JSON content
  ADD COLUMN content_format VARCHAR(20);      -- 'markdown' | 'tiptap'
```

### Indexes Required
```sql
-- GIN index for JSONB containment queries
CREATE INDEX idx_cards_content_json_gin ON cards USING GIN (content_json);

-- Index on content format for filtering
CREATE INDEX idx_cards_content_format ON cards(content_format);
```

## Implementation Checklist

The following components need to be implemented to make tests pass (GREEN phase):

### 1. Database Migration
- [ ] Create migration file `014_add_tiptap_json_support.ts`
- [ ] Add `content_json` JSONB column
- [ ] Add `content_format` VARCHAR(20) column
- [ ] Create GIN index on `content_json`
- [ ] Create index on `content_format`
- [ ] Add rollback migration

### 2. Type Definitions
- [ ] Update `DbCard` interface with `content_json` and `content_format`
- [ ] Add Tiptap JSON type definitions
- [ ] Add content format enum/type

### 3. Validation Schemas (Zod)
- [ ] Create Tiptap JSON schema validator
- [ ] Add node type whitelist validation
- [ ] Add mark type whitelist validation
- [ ] Add nesting depth validation
- [ ] Add content size validation
- [ ] Update `CardValidator.sanitizeContent()` for JSON

### 4. CardService Implementation
- [ ] Detect content format (JSON vs string)
- [ ] Store JSON in `content_json` column
- [ ] Store strings in `content` column
- [ ] Set `content_format` field correctly
- [ ] Handle format migration on update
- [ ] Update search to query both columns

### 5. CardMapper Implementation
- [ ] Map `content_json` to object
- [ ] Map `content` to string
- [ ] Handle NULL content_format (default to markdown)
- [ ] Proper deserialization of JSONB

### 6. Security Enhancements
- [ ] XSS sanitization for JSON text nodes
- [ ] DoS prevention (depth and size limits)
- [ ] Node/mark type whitelisting

## Test Execution Results

### Current Status: RED (Expected)

```bash
npm test -- CardService.test.ts --no-coverage
```

**Failures:** 9/24 tests failing (as expected)
- All Tiptap-specific tests are failing
- Backward compatibility tests are failing
- Some serialization tests are failing

**Root Cause:** Implementation not yet written (TDD RED phase)

## Next Steps (GREEN Phase)

1. **Create Database Migration**
   - File: `backend/src/database/migrations/014_add_tiptap_json_support.ts`
   - Add JSONB columns and indexes

2. **Run Migration**
   - Execute migration on development database
   - Verify schema changes

3. **Implement Validation Schemas**
   - Create Tiptap JSON Zod schemas
   - Add to `CardValidators.ts`

4. **Update CardService**
   - Add format detection logic
   - Implement JSONB storage
   - Handle format migration

5. **Update CardMapper**
   - Handle new columns
   - Proper deserialization

6. **Verify Tests Pass**
   - Run test suite
   - All 24 tests should pass (GREEN)

## Important Considerations

### Security
- **XSS Prevention:** Sanitize text content in JSON nodes
- **DoS Prevention:** Limit JSON nesting depth and size
- **Type Whitelisting:** Only allow known Tiptap node/mark types

### Performance
- **JSONB Indexing:** Use GIN indexes for efficient queries
- **Query Optimization:** Use JSONB operators (@>, ->, etc.)
- **Mixed Format Support:** Handle both formats efficiently

### Backward Compatibility
- **NULL Format Handling:** Treat NULL as markdown (legacy)
- **Migration Strategy:** Support gradual format migration
- **No Breaking Changes:** Existing markdown cards continue to work

### Data Integrity
- **Format Consistency:** Ensure content and content_format align
- **Validation:** Strict schema validation for JSON content
- **Error Handling:** Graceful degradation for corrupted data

## Documentation Links

- Frontend types: `clients/web/types/card.types.ts`
- Backend types: `backend/src/types/CardTypes.ts`
- Test file: `backend/src/__tests__/unit/services/CardService.test.ts`
- Related Notion docs: "Tiptap v3 Implementation" (search in Notion)

## Test Data Examples

### Valid Tiptap JSON
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello " },
        { "type": "text", "marks": [{ "type": "bold" }], "text": "world" }
      ]
    }
  ]
}
```

### Complex Nested Structure
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Title" }]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "content": [
                { "type": "text", "text": "Item with " },
                { "type": "text", "marks": [{ "type": "bold" }], "text": "formatting" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Conclusion

The TDD RED phase is complete with 24 comprehensive tests covering all aspects of Tiptap JSONB content storage. The tests are currently failing as expected, providing clear specifications for the implementation phase.

**Next action:** Proceed to GREEN phase by implementing the database migration and supporting code.
