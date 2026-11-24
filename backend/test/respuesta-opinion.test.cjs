require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararRespuestaOpinion } =
  require('../dist/CORE/respuesta-opinion/respuesta-opinion');
const { RespuestaOpinionService } =
  require('../dist/SERVICE/respuesta-opinion/respuesta-opinion.service');
const { RespuestaOpinionController } =
  require('../dist/API/respuesta-opinion/respuesta-opinion.controller');

test('exige una opinion escrita y una respuesta valida del trabajador contratado', () => {
  const calificacion = { trabajadorId: '12', opinion: 'Buen servicio.' };
  assert.equal(
    prepararRespuestaOpinion(calificacion, '12', ' Muchas gracias. '),
    'Muchas gracias.',
  );

  assert.throws(() => prepararRespuestaOpinion(calificacion, '11', 'Gracias.'), /Solo el trabajador/);
  assert.throws(
    () => prepararRespuestaOpinion({ ...calificacion, opinion: '   ' }, '12', 'Gracias.'),
    /opinion escrita/,
  );
  for (const texto of [' ', null, 'Texto\0invalido']) {
    assert.throws(() => prepararRespuestaOpinion(calificacion, '12', texto), /texto valido/);
  }
});

test('la consulta entrega la misma conversacion a ambos participantes y excluye a un tercero', async () => {
  const detalle = {
    calificacionId: '3',
    reservaId: '8',
    opinion: 'Buen servicio.',
    respuestas: [{
      id: '1', autorId: '12', texto: 'Gracias.', registradaEn: '2026-11-23T14:00:00Z',
    }],
  };

  const servicio = new RespuestaOpinionService({
    consultarOpinion: async (id, actorId) =>
      id === '3' && ['11', '12'].includes(actorId)
        ? { ...detalle, puedeResponder: actorId === '12' }
        : null,
  });

  assert.deepEqual(await servicio.consultarOpinion('3', '11'), { ...detalle, puedeResponder: false });
  assert.deepEqual(await servicio.consultarOpinion('3', '12'), { ...detalle, puedeResponder: true });
  await assert.rejects(servicio.consultarOpinion('3', '13'), /No se encontro la calificacion/);
});

test('solo publica como trabajador activo y detecta cambios antes de la escritura', async () => {
  let activo = false;
  let permiteGuardar = true;
  const fecha = new Date('2026-11-23T14:00:00Z');
  const solicitudes = [];
  const servicio = new RespuestaOpinionService({
    consultarContexto: async () => ({
      trabajadorId: '12', trabajadorActivo: activo, opinion: 'Buen servicio.',
    }),
    registrar: async (calificacionId, autorId, texto) => {
      solicitudes.push([calificacionId, autorId, texto]);
      return permiteGuardar
        ? { id: '1', calificacionId, autorId, texto, registradaEn: fecha }
        : null;
    },
  });

  await assert.rejects(servicio.responder('3', '12', 'Gracias.'), /trabajador contratado y activo/);
  activo = true;
  await assert.rejects(servicio.responder('3', '11', 'Gracias.'), /trabajador contratado y activo/);
  assert.equal(solicitudes.length, 0);

  const respuesta = await servicio.responder('3', '12', ' Gracias. ');
  assert.deepEqual(solicitudes[0], ['3', '12', 'Gracias.']);
  assert.equal(respuesta.autorId, '12');
  assert.equal(respuesta.registradaEn, fecha);

  permiteGuardar = false;
  await assert.rejects(servicio.responder('3', '12', 'Otra respuesta.'), /cambio antes de guardar/);
});

test('el controlador exige sesion y traduce los errores de acceso y conflicto', async () => {
  const controller = new RespuestaOpinionController({
    consultarOpinion: async () => { throw new Error('No se encontro la calificacion.'); },
    responder: async (_id, actorId) => {
      if (actorId === '11') {
        throw new Error('Solo el trabajador contratado y activo puede responder la opinion.');
      }
      throw new Error('La opinion o el permiso cambio antes de guardar la respuesta.');
    },
  });

  const cliente = { user: { usuarioId: '11' } };
  const trabajador = { user: { usuarioId: '12' } };
  const cuerpo = { texto: 'Gracias.' };

  await assert.rejects(controller.consultar({}, '3'), (e) => e.getStatus() === 401);
  await assert.rejects(controller.responder({}, '3', cuerpo), (e) => e.getStatus() === 401);
  await assert.rejects(controller.consultar(cliente, '3'), (e) => e.getStatus() === 404);
  await assert.rejects(controller.responder(cliente, '3', cuerpo), (e) => e.getStatus() === 403);
  await assert.rejects(controller.responder(trabajador, '3', cuerpo), (e) => e.getStatus() === 409);
});
