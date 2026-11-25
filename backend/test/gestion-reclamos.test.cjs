require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararFiltroReclamos, prepararResolucionReclamo } = require('../dist/CORE/gestion-reclamos/gestion-reclamos');
const { GestionReclamosService } = require('../dist/SERVICE/gestion-reclamos/gestion-reclamos.service');
const { GestionReclamosController } = require('../dist/API/gestion-reclamos/gestion-reclamos.controller');

function crearRepositorio() {
  const llamadas = [];
  return { llamadas, valor: {
    listarReclamos: async (...args) => { llamadas.push(['listar', ...args]); return []; },
    consultarReclamo: async () => null,
    iniciarRevisionReclamo: async () => ({ estado: 'en_revision' }),
    vincularOperacionReclamo: async (...args) => { llamadas.push(['vincular', ...args]); return { vinculada: true }; },
    resolverReclamo: async (...args) => { llamadas.push(['resolver', ...args]); return { decisionId: '2' }; },
  } };
}

test('CORE valida el filtro de reclamos y usa abiertos por defecto', () => {
  assert.equal(prepararFiltroReclamos(undefined), 'abierto');
  assert.equal(prepararFiltroReclamos('todos'), 'todos');
  assert.throws(() => prepararFiltroReclamos('cerrado'), /filtro de reclamos/i);
});

test('CORE exige una causal admitida y una resolución fundamentada', () => {
  assert.deepEqual(prepararResolucionReclamo('fuerza_mayor', '  Evidencia revisada  '), { causal: 'fuerza_mayor', resolucion: 'Evidencia revisada' });
  assert.throws(() => prepararResolucionReclamo('inexistente', 'Motivo'), /causal determinada/i);
  assert.throws(() => prepararResolucionReclamo('otro', '  '), /resolución/i);
  assert.throws(() => prepararResolucionReclamo('otro', 'x'.repeat(2001)), /resolución/i);
});

test('SERVICE utiliza el dominio al resolver y normaliza la resolución', async () => {
  const repo = crearRepositorio(); const service = new GestionReclamosService(repo.valor);
  await service.listarReclamos('9', undefined);
  await service.resolverReclamo('9', '20', 'fuerza_mayor', ' Resolución documentada ');
  assert.deepEqual(repo.llamadas, [['listar', '9', 'abierto'], ['resolver', '9', '20', 'fuerza_mayor', 'Resolución documentada']]);
});

test('API valida identificadores de operaciones vinculadas', async () => {
  const controller = new GestionReclamosController(new GestionReclamosService(crearRepositorio().valor));
  await assert.rejects(controller.vincularOperacion({ user: { usuarioId: '9' } }, '20', { solicitudFinancieraId: '0' }), error => error.getStatus() === 400);
});
