import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api'); // ← ADICIONAR ISSO

  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:4173',
      'https://lumi.orionsgi.com.br', // ← ADICIONAR ISSO
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000);
  console.log('🚀 API Sankhya rodando em http://localhost:3000');
}
bootstrap();