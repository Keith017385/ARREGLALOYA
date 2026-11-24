require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararFiltroDocumentacion, prepararRevisionDocumento } = require('../dist/CORE/documentacion-trabajador/documentacion-trabajador');
const { DocumentacionTrabajadorService } = require('../dist/SERVICE/documentacion-trabajador/documentacion-trabajador.service');
const { DocumentacionTrabajadorController } = require('../dist/API/documentacion-trabajador/documentacion-trabajador.controller');

function crearRepositorio() {
  const llamadas = [];
  return { llamadas, valor: {
    listarDocumentos: async (...args) => { llamadas.push(['listar', ...args]); return []; },
    revisarDocumento: async (...args) => { llamadas.push(['revisar', ...args]); return { revisionId: '1' }; },
  } };
}

test('CORE normaliza el filtro documental y aplica pendientes por defecto', () => {
  assert.equal(prepararFiltroDocumentacion(undefined), 'pendiente');
  assert.equal(prepararFiltroDocumentacion('todos'), 'todos');
  assert.throws(() => prepararFiltroDocumentacion('caducado'), /filtro de documentación/i);
});

test('CORE valida resultado y motivo de revisión', () => {
  assert.deepEqual(prepararRevisionDocumento('aprobado', '  Documento legible  '), { resultado: 'aprobado', motivo: 'Documento legible' });
  assert.throws(() => prepararRevisionDocumento('pendiente', 'motivo'), /resultado de revisión/i);
  assert.throws(() => prepararRevisionDocumento('rechazado', '  '), /motivo de revisión/i);
  assert.throws(() => prepararRevisionDocumento('rechazado', 'x'.repeat(2001)), /motivo de revisión/i);
});

test('SERVICE delega las validaciones y transmite datos normalizados', async () => {
  const repo = crearRepositorio(); const service = new DocumentacionTrabajadorService(repo.valor);
  await service.listarDocumentos('9', undefined);
  await service.revisarDocumento('9', '12', 'requiere_informacion', ' Adjuntar reverso ');
  assert.deepEqual(repo.llamadas, [['listar', '9', 'pendiente'], ['revisar', '9', '12', 'requiere_informacion', 'Adjuntar reverso']]);
});

test('API bloquea la consulta administrativa sin sesión', async () => {
  const controller = new DocumentacionTrabajadorController(new DocumentacionTrabajadorService(crearRepositorio().valor));
  await assert.rejects(controller.listarDocumentos({}, 'pendiente'), error => error.getStatus() === 401);
});
