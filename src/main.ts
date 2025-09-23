import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`NestJS server is running on http://localhost:${port}`);
  console.log(`WebSocket endpoint: ws://localhost:${port}/signaling`);
}
bootstrap();
