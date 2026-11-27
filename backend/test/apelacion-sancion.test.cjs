require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { ApelacionSancionService } = require('../dist/SERVICE/apelacion-sancion/apelacion-sancion.service');
const { ApelacionSancionController } = require('../dist/API/apelacion-sancion/apelacion-sancion.controller');

const apelacion = {
  apelacionId: '71', sancionId: '14', solicitadaPorId: '9',
  justificacion: 'Solicito revisar la sanción aplicada.', estado: 'pendiente',
  solicitadaEn: new Date('2026-11-26T15:00:00Z'), evidencias: [], historial: [],
};
const sancion = {
  sancionId: '14', motivo: 'Incumplimiento confirmado',
  inicio: new Date('2026-11-20T00:00:00Z'), fin: new Date('2026-12-01T00:00:00Z'),
  estadoApelacion: null,
};

function crearRepositorio() {
  const llamadas = [];
  return { llamadas, valor: {
    crear: async (...args) => { llamadas.push(['crear', ...args]); return { estado: 'creada', apelacion }; },
    listarPropias: async (actorId) => { llamadas.push(['listarPropias', actorId]); return { estado: 'listadas', apelaciones: [apelacion] }; },
    listarPendientes: async (actorId) => { llamadas.push(['listarPendientes', actorId]); return { estado: 'listadas', apelaciones: [apelacion] }; },
    listarSancionesPropias: async (actorId) => { llamadas.push(['listarSancionesPropias', actorId]); return { estado: 'listadas', sanciones: [sancion] }; },
    consultar: async () => ({ estado: 'encontrada', apelacion }),
    resolver: async (...args) => { llamadas.push(['resolver', ...args]); return { estado: 'resuelta', apelacion: { ...apelacion, estado: args[2] } }; },
    descargarEvidencia: async () => ({ estado: 'encontrada', evidencia: { evidenciaId: '3', nombreArchivo: 'prueba.pdf', contenido: Buffer.from('%PDF-') } }),
  } };
}

test('SERVICE normaliza la justificación y guarda las evidencias asociadas', async () => {
  const repo = crearRepositorio();
  const service = new ApelacionSancionService(repo.valor);
  const evidencia = { nombreArchivo: 'respaldo.pdf', contenido: new Uint8Array([1, 2, 3, 4, 5]) };

  const resultado = await service.crear('9', '14', '  Solicito revisar esta sanción por los antecedentes adjuntos.  ', [evidencia]);

  assert.equal(resultado.apelacionId, '71');
  assert.deepEqual(repo.llamadas[0], ['crear', '9', '14', 'Solicito revisar esta sanción por los antecedentes adjuntos.', [evidencia]]);
});

test('SERVICE rechaza una justificación demasiado corta antes de consultar PostgreSQL', async () => {
  const repo = crearRepositorio();
  const service = new ApelacionSancionService(repo.valor);

  await assert.rejects(service.crear('9', '14', 'Muy corta', []), /20 y 3000 caracteres/);
  assert.equal(repo.llamadas.length, 0);
});

test('SERVICE devuelve las sanciones reales obtenidas por el trabajador autenticado', async () => {
  const repo = crearRepositorio();
  const service = new ApelacionSancionService(repo.valor);

  assert.deepEqual(await service.listarSancionesPropias('9'), [sancion]);
  assert.deepEqual(repo.llamadas[0], ['listarSancionesPropias', '9']);
});

test('SERVICE rechaza decisiones fuera de aprobada o rechazada', async () => {
  const repo = crearRepositorio();
  const service = new ApelacionSancionService(repo.valor);

  await assert.rejects(service.resolver('5', '71', 'pendiente', 'Fundamento válido para resolver.'), /aprobada o rechazada/);
  assert.equal(repo.llamadas.length, 0);
});

test('SERVICE registra decisión y fundamento ya validados', async () => {
  const repo = crearRepositorio();
  const service = new ApelacionSancionService(repo.valor);

  const resultado = await service.resolver('5', '71', 'rechazada', 'Los documentos no respaldan el reclamo.');

  assert.equal(resultado.estado, 'rechazada');
  assert.deepEqual(repo.llamadas[0], ['resolver', '5', '71', 'rechazada', 'Los documentos no respaldan el reclamo.']);
});

test('API exige sesión para listar sanciones propias', async () => {
  const service = new ApelacionSancionService(crearRepositorio().valor);
  const controller = new ApelacionSancionController(service);

  await assert.rejects(controller.listarSancionesPropias({}), error => error.getStatus() === 401);
});

test('API pasa el trabajador autenticado al listado de sanciones', async () => {
  const repo = crearRepositorio();
  const controller = new ApelacionSancionController(new ApelacionSancionService(repo.valor));

  assert.deepEqual(await controller.listarSancionesPropias({ user: { usuarioId: '9' } }), [sancion]);
  assert.deepEqual(repo.llamadas[0], ['listarSancionesPropias', '9']);
});

test('API rechaza archivos que no son PDF, PNG ni JPG', async () => {
  const repo = crearRepositorio();
  const controller = new ApelacionSancionController(new ApelacionSancionService(repo.valor));

  await assert.rejects(
    controller.crear({ user: { usuarioId: '9' } }, '14', 'Solicito revisar esta sanción aplicada.', [
      { originalname: 'script.exe', buffer: Buffer.from('MZ executable') },
    ]),
    error => error.getStatus() === 400,
  );
  assert.equal(repo.llamadas.length, 0);
});