import { INestApplication, ValidationPipe } from '@nestjs/common';

// Un solo lugar para la configuración global: main.ts y los tests e2e la usan igual,
// así que un test que pasa significa que la API real se comporta igual
export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}