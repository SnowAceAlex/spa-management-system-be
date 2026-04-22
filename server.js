import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import { prisma } from './src/config/db.js'; // Ensure correct path to Prisma client file

const app = createApp();

async function startServer() {
  try {
    // 1. Check database connection before starting the server
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected successfully');

    // 2. Start the API server
    const server = app.listen(env.PORT, () => {
      console.log(`API listening on http://localhost:${env.PORT}`);
      console.log(`Swagger docs available at http://localhost:${env.PORT}/docs`);
    });

    // 3. Graceful shutdown handling
    function shutdown(signal) {
      console.log(`Received ${signal}, shutting down...`);
      server.close(async () => {
        await prisma.$disconnect(); // Close Prisma connection on shutdown
        process.exit(0);
      });
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();