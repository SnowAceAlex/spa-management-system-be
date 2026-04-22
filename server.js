import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import { prisma } from './src/config/db.js'; // Đảm bảo đúng đường dẫn tới file prisma client

const app = createApp();

async function startServer() {
  try {
    // 1. Kiểm tra kết nối Database trước khi chạy server
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Database connected successfully');

    // 2. Khởi động API
    const server = app.listen(env.PORT, () => {
      console.log(`API listening on http://localhost:${env.PORT}`);
      console.log(`Swagger docs at http://localhost:${env.PORT}/docs`);
    });

    // 3. Graceful shutdown
    function shutdown(signal) {
      console.log(`Received ${signal}, shutting down...`);
      server.close(async () => {
        await prisma.$disconnect(); // Đóng kết nối prisma khi tắt server
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