require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararDescripcionIncidente, prepararSancion } =
  require('../dist/CORE/incidentes-sanciones/incidentes-sanciones');
const { IncidentesSancionesService } =
  require('../dist/SERVICE/incidentes-sanciones/incidentes-sanciones.service');
const { IncidentesSancionesController } =
  require('../dist/API/incidentes-sanciones/incidentes-sanciones.controller');

const inicio = new Date('2026-11-23T14:00:00.000Z');
const fin = new Date('2026-11-24T14:00:00.000Z');

test('exige descripcion y motivo, y valida el orden de las fechas', () => {
  assert.equal(prepararDescripcionIncidente(' Trabajo incompleto. '), 'Trabajo incompleto.');
  assert.throws(() => prepararDescripcionIncidente(' '), /descripcion.*obligatoria/);
  assert.throws(() => prepararSancion(' ', inicio, fin), /motivo.*obligatorio/);
  assert.throws(() => prepararSancion('Motivo', inicio, inicio), /posterior al inicio/);
  assert.throws(() => prepararSancion('Motivo', new Date(NaN), fin), /fechas.*validas/);
});

test('registra un incidente pendiente y conserva el autor', async () => {
  const servicio = new IncidentesSancionesService({
    registrarIncidente: async (reservaId, actorId, descripcion) => {
      if (actorId !== '21') return { estado: 'sin_permiso' };
      return {
        estado: 'registrado',
        incidente: {
          id: '1', reservaId, descripcion, registradoEn: inicio,
          registradoPorId: actorId, confirmadoEn: null, confirmadoPorId: null,
        },
      };
    },
  });

  await assert.rejects(servicio.registrarIncidente('8', '12', 'Motivo'), /administrador activo/);
  const incidente = await servicio.registrarIncidente('8', '21', ' Trabajo incompleto. ');
  assert.equal(incidente.descripcion, 'Trabajo incompleto.');
  assert.equal(incidente.registradoPorId, '21');
  assert.equal(incidente.confirmadoEn, null);
});

test('rechaza al usuario sin permiso y conserva una sola confirmacion', async () => {
  let confirmacion = null;
  const servicio = new IncidentesSancionesService({
    confirmarIncidente: async (incidenteId, actorId) => {
      if (actorId !== '21') return { estado: 'sin_permiso' };
      if (confirmacion) return { estado: 'ya_confirmado' };
      confirmacion = {
        estado: 'confirmado', incidenteId,
        confirmadoEn: inicio, confirmadoPorId: actorId,
      };
      return confirmacion;
    },
  });

  await assert.rejects(servicio.confirmarIncidente('1', '12'), /administrador activo/);
  assert.equal(confirmacion, null);
  assert.equal((await servicio.confirmarIncidente('1', '21')).confirmadoPorId, '21');
  await assert.rejects(servicio.confirmarIncidente('1', '21'), /ya esta confirmado/);
});

test('exige incidente confirmado y participante vinculado antes de sancionar', async () => {
  let confirmado = false;
  const servicio = new IncidentesSancionesService({
    registrarSancion: async (incidenteId, usuarioId, actorId, datos) => {
      if (actorId !== '21') return { estado: 'sin_permiso' };
      if (!confirmado) return { estado: 'incidente_no_confirmado' };
      if (usuarioId !== '12') return { estado: 'usuario_no_vinculado' };
      return {
        estado: 'registrada',
        sancion: { id: '1', incidenteId, usuarioId, aplicadaPorId: actorId, ...datos },
      };
    },
  });

  const sancionar = (usuarioId, actorId = '21') =>
    servicio.registrarSancion('1', usuarioId, actorId, ' Medida de prueba. ', inicio, fin);

  await assert.rejects(sancionar('12', '11'), /administrador activo/);
  await assert.rejects(sancionar('12'), /Confirma el incidente/);
  confirmado = true;
  await assert.rejects(sancionar('13'), /no esta vinculado/);

  const sancion = await sancionar('12');
  assert.equal(sancion.usuarioId, '12');
  assert.equal(sancion.aplicadaPorId, '21');
  assert.equal(sancion.motivo, 'Medida de prueba.');
});

test('las cuatro operaciones requieren sesion', async () => {
  const controller = new IncidentesSancionesController({});
  const es401 = (error) => error.getStatus() === 401;

  await assert.rejects(controller.registrar({}, {}), es401);
  await assert.rejects(controller.consultar({}, '1'), es401);
  await assert.rejects(controller.confirmar({}, '1'), es401);
  await assert.rejects(controller.sancionar({}, '1', {}), es401);
});
