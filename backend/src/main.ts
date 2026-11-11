// Carga las variables locales sin poner contraseñas en el código.
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function iniciar() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks(); // Cierra el pool cuando se detiene el servidor.
  app.setGlobalPrefix('api');
  // La pantalla Angular usa un proxy local; no necesita conocer PostgreSQL.
  await app.listen(3000, '127.0.0.1');
  console.log('API local: http://127.0.0.1:3000/api/categorias');
}
iniciar().catch(() => { console.error('No se pudo iniciar la API.'); process.exitCode = 1; });
