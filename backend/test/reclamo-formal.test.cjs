require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  estaEnPlazoDeReclamo,
  prepararReclamo,
} = require('../dist/CORE/reclamo-formal/reclamo-formal');
const { ReclamoFormalService } =
  require('../dist/SERVICE/reclamo-formal/reclamo-formal.service');
const { ReclamoFormalController } =
  require('../dist/API/reclamo-formal/reclamo-formal.controller');

const reserva = {
  clienteId: '11',
  finalizadaEn: new Date('2026-11-27T18:00:00-04:00'),
};
const sextoDia = new Date('2026-12-03T23:59:59.999-04:00');
const septimoDia = new Date('2026-12-04T00:00:00-04:00');

test('admite hasta el final del sexto dia calendario en Bolivia', () => {
  assert.equal(estaEnPlazoDeReclamo(reserva.finalizadaEn, sextoDia), true);
  assert.equal(estaEnPlazoDeReclamo(reserva.finalizadaEn, septimoDia), false);
  assert.equal(
    estaEnPlazoDeReclamo(reserva.finalizadaEn, new Date(reserva.finalizadaEn.getTime() - 1)),
    false,
  );
});

test('exige que el cliente presente una descripcion para un servicio finalizado', () => {
  assert.equal(prepararReclamo(reserva, '11', ' Trabajo incompleto. ', sextoDia),
    'Trabajo incompleto.');
  assert.throws(() => prepararReclamo(reserva, '12', 'Reclamo', sextoDia), /Solo el cliente/);
  assert.throws(() => prepararReclamo(reserva, '11', '  ', sextoDia), /descripcion.*obligatoria/);
  assert.throws(
    () => prepararReclamo({ ...reserva, finalizadaEn: null }, '11', 'Reclamo', sextoDia),
    /finalizacion registrada/,
  );
});

test('guarda un reclamo valido, limita la consulta y rechaza un reclamo tardio', async () => {
  const guardados = [];
  let ahora = sextoDia;
  const servicio = new ReclamoFormalService({
    enReserva: async (reservaId, ejecutar) => ejecutar({
      obtenerContexto: async () => ({ reserva, ahora }),
      registrar: async (reportanteId, descripcion, presentadoEn) => {
        assert.equal(reportanteId, '11');
        const reclamo = { id: '1', reservaId, descripcion, presentadoEn, estado: 'abierto' };
        guardados.push(reclamo);
        return reclamo;
      },
    }),
    consultarDelCliente: async (reservaId, clienteId) =>
      reservaId === '8' && clienteId === '11' ? [...guardados] : null,
  });

  const reclamo = await servicio.presentar('8', '11', ' Trabajo incompleto. ');
  assert.equal(reclamo.estado, 'abierto');
  assert.equal(reclamo.descripcion, 'Trabajo incompleto.');
  assert.deepEqual(await servicio.consultar('8', '11'), [reclamo]);
  await assert.rejects(servicio.consultar('8', '12'), /No se encontro la reserva/);

  ahora = septimoDia;
  await assert.rejects(servicio.presentar('8', '11', 'Otro reclamo'), /plazo de seis dias/);
  assert.equal(guardados.length, 1);
});

test('el controlador rechaza tanto consulta como presentacion sin sesion', async () => {
  let llamadas = 0;
  const controller = new ReclamoFormalController({
    consultar: async () => { llamadas += 1; },
    presentar: async () => { llamadas += 1; },
  });

  await assert.rejects(controller.consultar({}, '8'), (error) => error.getStatus() === 401);
  await assert.rejects(
    controller.presentar({}, '8', { descripcion: 'Reclamo de prueba' }),
    (error) => error.getStatus() === 401,
  );
  assert.equal(llamadas, 0);
});
