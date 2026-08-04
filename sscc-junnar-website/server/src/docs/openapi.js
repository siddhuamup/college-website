/**
 * OpenAPI 3.0 Specification — SSCC Junnar ERP API
 * Documents core REST API endpoints.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SSCC Junnar ERP API',
    version: '2.1.0',
    description: 'RESTful API for Shri Shiv Chhatrapati College Junnar ERP',
  },
  servers: [
    { url: 'http://localhost:3000/api', description: 'Local Server' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ssc_token',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health Check & System Diagnostics',
        responses: {
          200: { description: 'System healthy' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'student@ssccjunnar.edu' },
                  password: { type: 'string', example: 'StrongP@ssw0rd!2026' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/payments/create-order': {
      post: {
        summary: 'Create Fee Payment Order (Razorpay / Mock)',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Order created' },
        },
      },
    },
    '/payments/verify': {
      post: {
        summary: 'Verify Payment & Generate Receipt',
        security: [{ cookieAuth: [] }],
        responses: {
          201: { description: 'Payment recorded successfully' },
        },
      },
    },
  },
};
