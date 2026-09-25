import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalHttpExceptionFilter } from './core/filters/http-exception.filter.js';

async function bootstrap() {
  const logger = new Logger('HIMS-Bootstrap');
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    })
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // OpenAPI Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('HIMS Enterprise API')
    .setDescription(
      'Authoritative REST API Contract for the Multi-Tenant Hospital Information Management System & Hospital Operating System'
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_PORT || process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`HIMS Canonical Backend API listening at http://localhost:${port}/api/v1`);
  logger.log(`OpenAPI Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
