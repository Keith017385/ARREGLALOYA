require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');

const { NestFactory } = require('@nestjs/core');
const { ModulesContainer } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DbService } = require('../dist/INFRASTRUCTURE/db.service');
const { CategoriasController } = require('../dist/API/categorias.controller');
const { ComplementoAnticipoController } = require('../dist/API/complemento-anticipo.controller');
const { CandidatosAsistenciaController } =
  require('../dist/API/casos-escalados/candidatos-asistencia.controller');

test('NestJS crea todos los providers con un unico DbService sin conectarse a PostgreSQL', async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const db = app.get(DbService);
    const contenedor = app.get(ModulesContainer);
    const registrosDb = Array.from(contenedor.values()).filter(
      modulo => modulo.providers.has(DbService),
    );

    assert.equal(registrosDb.length, 1);
    assert.ok(db.pool);
    assert.equal(db.pool.totalCount, 0, 'El pool no abre conexiones antes de recibir consultas');

    assert.ok(app.get(CategoriasController));
    assert.ok(app.get(ComplementoAnticipoController));
    assert.ok(app.get(CandidatosAsistenciaController));
  } finally {
    await app.close();
  }
});
