
const test = require('node:test');
const assert = require('node:assert/strict');
const { ModeracionOpinionesService, validarTextoModeracion } = require('../dist/SERVICE/moderacion-opiniones.service');
const { ModeracionOpinionesController } = require('../dist/API/moderacion-opiniones.controller');

function escenario({ permitido = true, estado = 'en_revision', fallar = false } = {}) {
  const consultas = [];
  let liberado = false;
  const cliente = {
    async query(sql, parametros) {
      consultas.push({ sql, parametros });
      if (sql.includes('es_administrador')) return { rows: [{ permitido }] };
      if (sql.includes('SELECT *')) return { rows: [{ estado, calificacion_id: '9' }] };
      if (fallar && sql.includes('UPDATE')) throw new Error('Fallo de escritura');
      return { rows: [] };
    },
    release() { liberado = true; }
  };
  const servicio = new ModeracionOpinionesService({ pool: { connect: async () => cliente } });
  return { servicio, consultas, liberado: () => liberado };
}

test('moderación valida motivos y exige sesión e identificadores seguros', () => {
  for (const valor of [null, '', '  ', 42, 'x'.repeat(2001), 'a\0b']) {
    assert.throws(() => validarTextoModeracion(valor), { status: 400 });
  }
  assert.equal(validarTextoModeracion('  ofensiva  '), 'ofensiva');
  const api = new ModeracionOpinionesController({});
  assert.throws(() => api.reportar({}, '1', {}), { status: 401 });
  assert.throws(() => api.reputacion('9223372036854775808'), { status: 400 });
});

test('invalidar registra la exclusión y la resolución en una transacción', async () => {
  const e = escenario();
  await e.servicio.revisar('1','2','invalidar','Contenido ofensivo');
  assert.equal(e.consultas[0].sql, 'BEGIN');
  assert(e.consultas.some(q => q.sql.includes('FOR UPDATE')));
  assert(e.consultas.some(q => q.sql.includes('INSERT INTO arreglalo.opinion_invalidada')));
  assert.equal(e.consultas.at(-1).sql, 'COMMIT');
  assert(e.liberado());
});

test('conservar resuelve sin excluir la calificación', async () => {
  const e = escenario();
  await e.servicio.revisar('1','2','conservar','Opinión válida');
  assert(!e.consultas.some(q => q.sql.includes('INSERT INTO arreglalo.opinion_invalidada')));
  assert.equal(e.consultas.at(-1).sql, 'COMMIT');
});

test('rechaza usuarios sin rol, resoluciones repetidas y omitir la revisión', async () => {
  for (const opciones of [{permitido:false}, {estado:'resuelto'}, {estado:'pendiente'}]) {
    const e = escenario(opciones);
    await assert.rejects(e.servicio.revisar('1','2','invalidar','Motivo'));
    assert.equal(e.consultas.at(-1).sql, 'ROLLBACK');
    assert(!e.consultas.some(q => q.sql.includes('INSERT')));
    assert(e.liberado());
  }
});

test('una falla al resolver revierte también la invalidación', async () => {
  const e = escenario({fallar:true});
  await assert.rejects(e.servicio.revisar('1','2','invalidar','Motivo'), /Fallo/);
  assert.equal(e.consultas.at(-1).sql, 'ROLLBACK');
  assert(e.liberado());
});

test('trabajador sin calificaciones válidas tiene promedio nulo', async () => {
  const servicio = new ModeracionOpinionesService({pool: {query: async () => ({rows:[]})}});
  assert.deepEqual(await servicio.reputacion('1'), {trabajadorId:'1', cantidad:0, promedio:null});
});
