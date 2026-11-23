require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { calcularVistaPreviaCancelacion } =
  require('../dist/CORE/cancelacion-cliente/cancelacion-cliente');
const { CancelacionClienteService } =
  require('../dist/SERVICE/cancelacion-cliente/cancelacion-cliente.service');
const { CancelacionClienteController } =
  require('../dist/API/cancelacion-cliente/cancelacion-cliente.controller');

const inicio = new Date('2026-11-23T14:00:00-04:00');
const dosHorasAntes = new Date('2026-11-23T12:00:00-04:00');
const unaHoraAntes = new Date('2026-11-23T13:00:00-04:00');

test('exactamente dos horas da derecho al reembolso del fondo', () => {
  assert.deepEqual(calcularVistaPreviaCancelacion(inicio, dosHorasAntes, 4750), {
    causal: 'cliente_anticipada',
    reembolsoCentavos: 4750,
    compensacionTrabajadorCentavos: 0,
    repartoPlataformaCentavos: 0,
  });

  const justoDespues = new Date(dosHorasAntes.getTime() + 1);
  assert.equal(
    calcularVistaPreviaCancelacion(inicio, justoDespues, 4750).causal,
    'cliente_tardia',
  );
});

test('la cancelacion tardia conserva todos los centavos y no reembolsa', () => {
  assert.deepEqual(calcularVistaPreviaCancelacion(inicio, unaHoraAntes, 4751), {
    causal: 'cliente_tardia',
    reembolsoCentavos: 0,
    compensacionTrabajadorCentavos: 2376,
    repartoPlataformaCentavos: 2375,
  });

  assert.throws(() => calcularVistaPreviaCancelacion(inicio, inicio, 4751), /antes del inicio/);
  assert.throws(() => calcularVistaPreviaCancelacion(inicio, unaHoraAntes, -1), /centavos/);
});

test('la vista previa protege el acceso y bloquea fondos por conciliar', async () => {
  const servicio = new CancelacionClienteService({
    consultarContexto: async (_reservaId, clienteId) =>
      clienteId === '11' ? {
        estado: 'reservada',
        inicioProgramado: inicio,
        consultadaEn: unaHoraAntes,
        fondoCentavos: 4750,
        comisionCentavos: 250,
        requiereConciliacion: true,
      } : null,
  });

  await assert.rejects(servicio.consultarVistaPrevia('10', '12'), /No se encontro la reserva/);
  await assert.rejects(servicio.consultarVistaPrevia('10', '11'), /deben conciliarse/);
});

test('confirmar exige un motivo y los importes validos de la vista previa', async () => {
  const llamadas = [];
  const servicio = new CancelacionClienteService({
    confirmar: async (...argumentos) => {
      llamadas.push(argumentos);
      return { cancelacionId: '4' };
    },
  });
  const vista = {
    ...calcularVistaPreviaCancelacion(inicio, unaHoraAntes, 4750),
    fondoCentavos: 4750,
    comisionCentavos: 250,
  };

  await assert.rejects(servicio.confirmar('10', '11', ' ', vista), /motivo.*obligatorio/);
  await assert.rejects(
    servicio.confirmar('10', '11', 'Motivo', { ...vista, fondoCentavos: -1 }),
    /vista previa valida/,
  );
  assert.equal(llamadas.length, 0);

  const resultado = await servicio.confirmar('10', '11', ' Cambio de planes. ', vista);
  assert.equal(resultado.cancelacionId, '4');
  assert.deepEqual(llamadas, [['10', '11', 'Cambio de planes.', vista]]);
});

test('el controlador exige sesion y devuelve 409 si cambio la vista previa', async () => {
  const controller = new CancelacionClienteController({
    confirmar: async () => {
      throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
    },
  });

  await assert.rejects(
    controller.consultarVistaPrevia({}, '10'),
    (error) => error.getStatus() === 401,
  );
  await assert.rejects(
    controller.confirmar({}, '10', {}),
    (error) => error.getStatus() === 401,
  );
  await assert.rejects(
    controller.confirmar(
      { user: { usuarioId: '11' } },
      '10',
      { motivo: 'Cambio de planes.', vistaPrevia: { causal: 'cliente_tardia' } },
    ),
    (error) => error.getStatus() === 409,
  );
});
