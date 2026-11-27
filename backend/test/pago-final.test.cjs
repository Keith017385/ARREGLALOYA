const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calcularSaldoDirecto,
  validarDeclaracionPagoFinal,
} = require('../dist/CORE/pago-final/pago-final');

const reserva = {
  clienteId: '10',
  estado: 'finalizada',
  precioFinal: 20000,
  anticipoRecibido: 5000,
  pagosDirectosConfirmados: 0,
  tieneModificacionPendiente: false,
  tienePagoPendiente: false,
};

test('calcula el saldo solo con importes efectivamente recibidos', () => {
  assert.equal(calcularSaldoDirecto(20000, 5000, 0), 15000);
  assert.equal(calcularSaldoDirecto(20000, 5000, 3000), 12000);
  assert.equal(calcularSaldoDirecto(20000, 5000, 16000), -1000);
});

test('permite al cliente declarar el saldo completo de una reserva finalizada', () => {
  assert.doesNotThrow(() => validarDeclaracionPagoFinal(reserva, '10', 15000));
});

test('permite declarar un importe menor o mayor que el saldo vigente', () => {
  for (const importe of [12000, 16000]) {
    assert.doesNotThrow(() => validarDeclaracionPagoFinal(reserva, '10', importe));
  }
});

test('rechaza importes que no son enteros positivos en centavos', () => {
  for (const importe of [0, -100, 15000.5]) {
    assert.throws(
      () => validarDeclaracionPagoFinal(reserva, '10', importe),
      /entero positivo en centavos/,
    );
  }
});

test('bloquea a usuarios ajenos y a reservas en ejecucion', () => {
  assert.throws(
    () => validarDeclaracionPagoFinal(reserva, '99', 15000),
    /Solo el cliente/,
  );

  assert.throws(
    () => validarDeclaracionPagoFinal(
      { ...reserva, estado: 'en_ejecucion' }, '10', 15000,
    ),
    /debe estar finalizada/,
  );
});

test('bloquea una declaracion si hay un cambio de precio o pago pendiente', () => {
  assert.throws(
    () => validarDeclaracionPagoFinal(
      { ...reserva, tieneModificacionPendiente: true }, '10', 15000,
    ),
    /modificacion de precio pendiente/,
  );

  assert.throws(
    () => validarDeclaracionPagoFinal(
      { ...reserva, tienePagoPendiente: true }, '10', 15000,
    ),
    /Ya hay un pago declarado/,
  );
});

require('node:test')('el controlador distingue un conflicto de pago de un usuario sin permiso', async () => {
  const assert = require('node:assert/strict');
  const { PagoFinalController } = require('../dist/API/pago-final/pago-final.controller');

  const casos = [
    ['Ya hay un pago declarado pendiente de confirmacion.', 409],
    ['Solo el cliente de la reserva puede declarar el pago.', 403],
  ];

  for (const [mensaje, estado] of casos) {
    const controller = new PagoFinalController({
      declarar: async () => { throw new Error(mensaje); },
    });

    await assert.rejects(
      controller.declarar({ user: { usuarioId: '1' } }, '7', { importeCentavos: 15000 }),
      (error) => error.getStatus() === estado && error.message === mensaje,
    );
  }
});
