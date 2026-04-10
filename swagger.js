import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

export function swaggerMiddleware(app) {
  const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
      title: 'Spa CRM API',
      version: '0.1.0',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  };

  const spec = swaggerJSDoc({
    definition: swaggerDefinition,
    apis: ['./src/routes/**/*.js'],
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  app.get('/docs.json', (_req, res) => res.json(spec));
}
