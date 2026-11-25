// CU-01: autenticación con sesión (sin JWT).
// En local se usa el almacén en memoria; producción usa arreglalo.sesion_http.
// Las credenciales y el secreto se leen desde backend/.env.
import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session, { type SessionOptions } from 'express-session';
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

  const opcionesSesion: SessionOptions = {
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
  };

  if (process.env.NODE_ENV === 'production') {
    // En producción, la migración de sesion_http y sus permisos se preparan
    // antes de arrancar; el usuario de la aplicación no necesita CREATE en el esquema.
    opcionesSesion.store = new PgSession({
      pool: db.pool,
      schemaName: 'arreglalo',
      tableName: 'sesion_http',
      createTableIfMissing: false,
    });
  } else {
    // El almacén en memoria permite ejecutar el demo local cuando el rol de
    // PostgreSQL no tiene permisos para crear tablas dentro de arreglalo.
    console.warn('Sesiones locales en memoria; configura el almacén PostgreSQL en producción.');
  }

  app.use(session(opcionesSesion));

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
  const puerto = Number(process.env.PORT) || 3000;
  await app.listen(puerto, '127.0.0.1');
  console.log(`API local: http://127.0.0.1:${puerto}/api`);
}

iniciar().catch((error: unknown) => {
  console.error('No se pudo iniciar la API:', error);
  process.exitCode = 1;
});
