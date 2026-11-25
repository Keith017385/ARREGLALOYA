// CU-01: sesiones de usuario guardadas en PostgreSQL (sin JWT).
// Las credenciales y el secreto de sesion se leen desde backend/.env.
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import type { Request, Response, NextFunction } from 'express';
import connectPgSimple from 'connect-pg-simple';
import { UsuariosRepository } from './CORE/usuarios/usuarios.repository';
import { DbService } from './INFRASTRUCTURE/db.service';

declare module 'express-session' {
  interface SessionData {
    usuarioId?: string;
  }
}

const PgSession = connectPgSimple(session);

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('Falta SESSION_SECRET (32 caracteres o mas) en backend/.env');
  }

  // Recupera el singleton registrado en DatabaseModule.
  // No se crea otro DbService ni un segundo Pool.
  const db = app.get(DbService);

  app.use(
    session({
      store: new PgSession({
        pool: db.pool,
        schemaName: 'arreglalo',
        tableName: 'sesion_http',
        createTableIfMissing: true,
      }),
      name: 'arreglalo.sid',
      secret: secreto,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  const usuarios = app.get(UsuariosRepository);
  app.use(async (req: Request & { user?: { usuarioId: string } }, _res: Response, next: NextFunction) => {
    try {
      if (req.session.usuarioId) {
        const usuario = await usuarios.buscarUsuario(req.session.usuarioId);
        if (usuario && ['activo', 'suspendido_voluntario'].includes(usuario.estado)) {
          const soloPerfil = req.method === 'GET' && req.path === '/api/usuarios/perfil';
          if (usuario.estado === 'activo' || soloPerfil) req.user = { usuarioId: usuario.usuarioId };
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  // El proxy de Angular usa la API local.
  await app.listen(3000, '127.0.0.1');
  console.log('API local: http://127.0.0.1:3000/api');
}

iniciar().catch((error: unknown) => {
  console.error('No se pudo iniciar la API:', error);
  process.exitCode = 1;
});
