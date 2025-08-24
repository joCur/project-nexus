import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../utils/test-helpers';

describe('Canvas Minimal Test', () => {
  let app: Express;

  beforeAll(async () => {
    restoreConsole(); // Restore console for debugging
    app = await createTestApp();
  });

  it('should respond to a basic GraphQL query', async () => {
    try {
      const query = `
        query {
          health {
            status
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query });

      const fs = require('fs');
      fs.writeFileSync('/tmp/test-debug.log', JSON.stringify({
        status: response.status,
        body: response.body,
        error: response.error
      }, null, 2));
      
      expect(response.status).toBe(200);
    } catch (error) {
      const fs = require('fs');
      fs.writeFileSync('/tmp/test-error.log', JSON.stringify({
        error: error.message,
        stack: error.stack
      }, null, 2));
      throw error;
    }
  });

  it('should have canvas types in schema', async () => {
    const query = `
      query {
        __type(name: "Canvas") {
          name
          fields {
            name
            type {
              name
            }
          }
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query });

    console.log('Canvas type response:', JSON.stringify(response.body, null, 2));
    
    expect(response.status).toBe(200);
  });
});