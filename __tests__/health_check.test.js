const request = require('supertest');
const { app, startServer } = require('../server'); 

let server;

beforeAll(async () => {
  server = await startServer(); 
});

afterAll(async () => {
  if (server) {
    server.close(); 
  }
});

describe('Health Check Endpoint', () => {
  const endpoint = '/healthz';

  it('should return 200 for a valid GET request with no body and allowed headers', async () => {
    const response = await request(app).get(endpoint);
    expect(response.status).toBe(200);
  });

  it('should return 400 if request contains a body', async () => {
    const response = await request(app)
      .get(endpoint)
      .send({ invalid: 'data' });

    expect(response.status).toBe(400);
  });

  it('should return 400 if request contains a content-type header', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(400);
  });

  it('should return 400 if request contains query parameters', async () => {
    const response = await request(app).get(`${endpoint}?param=value`);
    expect(response.status).toBe(400);
  });

  it('should return 400 if request contains invalid headers', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('X-Custom-Header', 'invalid');

    expect(response.status).toBe(400);
  });

  it('should return 405 if the request method is HEAD', async () => {
    const response = await request(app).head(endpoint);
    expect(response.status).toBe(405);
  });

  it('should return 405 if the request method is PUT', async () => {
    const response = await request(app).put(endpoint);
    expect(response.status).toBe(405);
  });

  it('should return 405 if the request method is DELETE', async () => {
    const response = await request(app).delete(endpoint);
    expect(response.status).toBe(405);
  });

  it('should return 503 if there is a server error', async () => {
    jest.spyOn(require('../models').HealthCheck, 'create').mockImplementation(() => {
      throw new Error('Database failure');
    });

    const response = await request(app).get(endpoint);
    expect(response.status).toBe(503);
  });
});
