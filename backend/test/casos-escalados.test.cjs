require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { vencioPlazoRevisionAsistencia } =
  require('../dist/CORE/casos-escalados/plazo-revision-asistencia');
const { GestionRevisionAsistenciaService } =
  require('../dist/SERVICE/casos-escalados/gestion-revision-asistencia.service');
const { GestionRevisionAsistenciaController } =
  require('../dist/API/casos-escalados/gestion-revision-asistencia.controller');

const rechazo = new Date('2026-11-23T10:16:48-04:00');
const ultimoDia = new Date('2026-11-25T23:59:59.999-04:00');
const vencida = new Date('2026-11-26T00:00:00-04:00');

test('el plazo vence al terminar el segundo dia habil en Bolivia', () => {
  assert.equal(vencioPlazoRevisionAsistencia(rechazo, ultimoDia), false);
  assert.equal(vencioPlazoRevisionAsistencia(rechazo, vencida), true);

  const viernes = new Date('2026-11-27T17:00:00-04:00');
  assert.equal(
    vencioPlazoRevisionAsistencia(viernes, new Date('2026-12-01T23:59:59.999-04:00')),
    false,
  );
  assert.equal(
    vencioPlazoRevisionAsistencia(viernes, new Date('2026-12-02T00:00:00-04:00')),
    true,
  );
});

test('escala solo una revision vencida y conserva al responsable de su resolucion', async () => {
  let ahora = ultimoDia;
  const revision = {
    respuesta: 'rechazada',
    respondidaEn: rechazo,
    escaladaEn: null,
    resueltaEn: null,
  };

  const servicio = new GestionRevisionAsistenciaService({
    actualizar: async (respuestaId, actorId, decidir) => {
      const cambio = decidir(revision, ahora);
      if (cambio.tipo === 'escalar') {
        revision.escaladaEn = ahora;
        return { respuestaId, escaladaEn: ahora };
      }
      revision.resueltaEn = ahora;
      return { respuestaId, responsableId: actorId, resolucion: cambio.resolucion };
    },
  });

  await assert.rejects(servicio.escalar('2', '21'), /aun no vencio/);
  await assert.rejects(servicio.resolver('2', '21', 'Decision'), /aun no fue escalada/);

  ahora = vencida;
  assert.equal((await servicio.escalar('2', '21')).escaladaEn, vencida);
  await assert.rejects(servicio.escalar('2', '21'), /ya fue escalada/);
  await assert.rejects(servicio.resolver('2', '21', '   '), /2000 caracteres/);

  assert.deepEqual(await servicio.resolver('2', '21', ' Se revisaron los antecedentes. '), {
    respuestaId: '2',
    responsableId: '21',
    resolucion: 'Se revisaron los antecedentes.',
  });
  await assert.rejects(servicio.resolver('2', '21', 'Otra decision'), /ya fue resuelta/);
});

test('la bandeja distingue revisiones vigentes, vencidas y escaladas', async () => {
  const base = { reservaId: '8', declaradaEn: rechazo, rechazadaEn: rechazo };
  const servicio = new GestionRevisionAsistenciaService({
    listarAbiertas: async (actorId) => actorId !== '21' ? null : {
      ahora: vencida,
      revisiones: [
        { ...base, respuestaId: '2', asistenciaId: '2', escaladaEn: vencida },
        { ...base, respuestaId: '3', asistenciaId: '3', escaladaEn: null },
        { ...base, respuestaId: '4', asistenciaId: '4', escaladaEn: null, rechazadaEn: ultimoDia },
      ],
    },
  });

  await assert.rejects(servicio.listarAbiertas('12'), /superadministrador activo/);
  const casos = await servicio.listarAbiertas('21');
  assert.deepEqual(casos.map((caso) => caso.estado), ['escalada', 'vencida', 'en_revision']);
});

test('la gestion requiere sesion y devuelve 403 si falta el rol', async () => {
  const controller = new GestionRevisionAsistenciaController({
    escalar: async () => { throw new Error('Se requiere un superadministrador activo.'); },
  });
  const es401 = (error) => error.getStatus() === 401;

  await assert.rejects(controller.listar({}), es401);
  await assert.rejects(controller.escalar({}, '2'), es401);
  await assert.rejects(controller.resolver({}, '2', { resolucion: 'Decision' }), es401);
  await assert.rejects(
    controller.escalar({ user: { usuarioId: '12' } }, '2'),
    (error) => error.getStatus() === 403,
  );
});
