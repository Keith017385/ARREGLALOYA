const assert = require('node:assert/strict');
const test = require('node:test');

const { validarConfirmacionFinalizacion } =
  require('../dist/CORE/finalizacion-servicio/confirmacion-finalizacion');

const reserva = {
  id: '5',
  clienteId: '10',
  estado: 'en_ejecucion',
};

const codigo = {
  reservaId: reserva.id,
  consumidoEn: null,
};

test('permite confirmar con un codigo valido de la reserva', () => {
  assert.doesNotThrow(() =>
    validarConfirmacionFinalizacion(reserva, reserva.clienteId, codigo),
  );
});

test('rechaza la confirmacion de un usuario ajeno', () => {
  assert.throws(
    () => validarConfirmacionFinalizacion(reserva, '99', codigo),
    /Solo el cliente/,
  );
});

test('rechaza un codigo inexistente o de otra reserva', () => {
  assert.throws(
    () => validarConfirmacionFinalizacion(reserva, reserva.clienteId, null),
    /El codigo no es valido/,
  );
  assert.throws(
    () => validarConfirmacionFinalizacion(
      reserva, reserva.clienteId, { ...codigo, reservaId: '8' },
    ),
    /El codigo no es valido/,
  );
});

test('rechaza un codigo ya utilizado', () => {
  assert.throws(
    () => validarConfirmacionFinalizacion(
      reserva, reserva.clienteId, { ...codigo, consumidoEn: new Date() },
    ),
    /El codigo ya fue utilizado/,
  );
});

test('rechaza confirmar un servicio que no esta en ejecucion', () => {
  for (const estado of ['pendiente_anticipo', 'reservada', 'finalizada', 'cancelada']) {
    assert.throws(
      () => validarConfirmacionFinalizacion(
        { ...reserva, estado }, reserva.clienteId, codigo,
      ),
      /La reserva debe estar en ejecucion/,
    );
  }
});