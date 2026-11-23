require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararRespuestaAsistencia } =
  require('../dist/CORE/declaracion-asistencia/declaracion-asistencia');
const { DeclaracionAsistenciaService } =
  require('../dist/SERVICE/declaracion-asistencia/declaracion-asistencia.service');
const {
  DeclaracionAsistenciaController,
  RevisionAsistenciaController,
} = require('../dist/API/declaracion-asistencia/declaracion-asistencia.controller');

test('solo admite confirmada o rechazada como respuesta', () => {
  const declaracion = { clienteId: '11', respuesta: null };
  assert.equal(prepararRespuestaAsistencia(declaracion, '11', 'confirmada'), 'confirmada');
  assert.equal(prepararRespuestaAsistencia(declaracion, '11', 'rechazada'), 'rechazada');
  assert.throws(
    () => prepararRespuestaAsistencia(declaracion, '11', 'pendiente'),
    /debe ser confirmada o rechazada/,
  );
});

test('solo el cliente puede responder y se guarda una sola respuesta', async () => {
  let guardada = null;
  const servicio = new DeclaracionAsistenciaService({
    enReserva: async (reservaId, ejecutar) => ejecutar({
      buscarDeclaracion: async (asistenciaId) =>
        reservaId === '8' && asistenciaId === '2'
          ? { clienteId: '11', respuesta: guardada?.respuesta ?? null }
          : null,
      guardarRespuesta: async (asistenciaId, respuesta) => {
        guardada = { id: '2', asistenciaId, respuesta };
        return guardada;
      },
    }),
  });

  await assert.rejects(servicio.responder('9', '2', '11', 'rechazada'), /No se encontro la declaracion/);
  await assert.rejects(servicio.responder('8', '2', '12', 'rechazada'), /Solo el cliente/);
  assert.equal(guardada, null);

  assert.equal((await servicio.responder('8', '2', '11', 'rechazada')).respuesta, 'rechazada');
  await assert.rejects(
    servicio.responder('8', '2', '11', 'confirmada'),
    /ya tiene una respuesta registrada/,
  );
});

test('la consulta de declaraciones se limita al cliente de la reserva', async () => {
  const servicio = new DeclaracionAsistenciaService({
    consultarDelCliente: async (reservaId, clienteId) =>
      reservaId === '8' && clienteId === '11' ? [] : null,
  });

  assert.deepEqual(await servicio.consultar('8', '11'), []);
  await assert.rejects(servicio.consultar('8', '12'), /No se encontro la reserva/);
});

test('consultar o responder una declaracion requiere sesion', async () => {
  const controller = new DeclaracionAsistenciaController({});
  const es401 = (error) => error.getStatus() === 401;

  await assert.rejects(controller.consultar({}, '8'), es401);
  await assert.rejects(controller.responder({}, '8', '2', { respuesta: 'rechazada' }), es401);
});

test('la bandeja administrativa distingue 401, 403 y acceso autorizado', async () => {
  const rechazo = { reservaId: '8', asistenciaId: '2', respuestaId: '2' };
  const actoresConsultados = [];
  const controller = new RevisionAsistenciaController({
    consultarRechazadas: async (actorId) => {
      actoresConsultados.push(actorId);
      return actorId === '21' ? [rechazo] : null;
    },
  });

  await assert.rejects(controller.consultarRechazadas({}), (error) => error.getStatus() === 401);
  assert.deepEqual(actoresConsultados, []);

  await assert.rejects(
    controller.consultarRechazadas({ user: { usuarioId: '11' } }),
    (error) => error.getStatus() === 403,
  );
  assert.deepEqual(
    await controller.consultarRechazadas({ user: { usuarioId: '21' } }),
    [rechazo],
  );
});
