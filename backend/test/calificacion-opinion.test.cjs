require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararCalificacion } =
  require('../dist/CORE/calificacion-opinion/calificacion-opinion');
const { CalificacionOpinionService } =
  require('../dist/SERVICE/calificacion-opinion/calificacion-opinion.service');
const { CalificacionOpinionController } =
  require('../dist/API/calificacion-opinion/calificacion-opinion.controller');

const reserva = { clienteId: '11', estado: 'finalizada' };

test('acepta una puntuacion decimal y normaliza la opinion opcional', () => {
  assert.deepEqual(prepararCalificacion(reserva, '11', 4.5, ' Buen servicio. '), {
    puntuacion: 4.5,
    opinion: 'Buen servicio.',
  });
  assert.deepEqual(prepararCalificacion(reserva, '11', 0, '   '), {
    puntuacion: 0,
    opinion: null,
  });
});

test('rechaza puntuaciones invalidas y opiniones que no son texto', () => {
  for (const puntuacion of [-1, NaN, Infinity, '4', null, undefined]) {
    assert.throws(
      () => prepararCalificacion(reserva, '11', puntuacion),
      /numero finito/,
    );
  }
  assert.throws(() => prepararCalificacion(reserva, '11', 4, 123), /debe ser un texto/);
});

test('solo registra la calificacion del cliente de una reserva finalizada', async () => {
  let reservaActual = { ...reserva, estado: 'en_ejecucion' };
  const registros = [];
  const servicio = new CalificacionOpinionService({
    enReserva: async (reservaId, ejecutar) => ejecutar({
      obtenerReserva: async () => reservaActual,
      registrar: async (datos) => {
        registros.push(datos);
        return { id: '3', reservaId, version: 1, ...datos };
      },
    }),
  });

  await assert.rejects(servicio.registrar('8', '11', 4.5), /servicio finalizado/);
  reservaActual = reserva;
  await assert.rejects(servicio.registrar('8', '12', 4.5), /Solo el cliente/);
  assert.equal(registros.length, 0);

  assert.deepEqual(await servicio.registrar('8', '11', 4.5), {
    id: '3',
    reservaId: '8',
    version: 1,
    puntuacion: 4.5,
    opinion: null,
  });
  assert.equal(registros.length, 1);
});

test('el controlador devuelve 401 sin sesion antes de llamar al servicio', async () => {
  let llamadas = 0;
  const controller = new CalificacionOpinionController({
    registrar: async () => { llamadas += 1; },
  });

  await assert.rejects(
    controller.registrar({}, '8', { puntuacion: 4.5 }),
    (error) => error.getStatus() === 401,
  );
  assert.equal(llamadas, 0);
});
