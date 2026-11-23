require('reflect-metadata');

const assert = require('node:assert/strict');
const test = require('node:test');

const { calcularAjustePrecio } =
  require('../dist/CORE/calculo-modificacion-precio');
const { crearPropuestaPrecio } =
  require('../dist/CORE/propuesta-modificacion-precio');
const { decidirModificacionPrecio } =
  require('../dist/CORE/decision-modificacion-precio');
const { ModificacionPrecioController } =
  require('../dist/API/modificacion-precio.controller');

const reserva = {
  id: '5',
  clienteId: '10',
  trabajadorId: '20',
  servicioEnPrestacion: true,
  precioVigente: 20000,
  anticipoRecibido: 5000,
  pagosDirectosConfirmados: 0,
};

function crearPropuesta(variacion) {
  return crearPropuestaPrecio(reserva, reserva.trabajadorId, {
    variacion,
    motivo: 'Materiales adicionales',
    propuestaEn: new Date('2026-01-01T12:00:00Z'),
  });
}

test('calcula solo el complemento pendiente al aceptar un aumento', () => {
  const ajuste = calcularAjustePrecio(30000, 5000);

  assert.equal(ajuste.anticipoObjetivo, 7500);
  assert.equal(ajuste.comisionObjetivo, 375);
  assert.equal(ajuste.complementoAnticipo, 2500);
  assert.equal(ajuste.saldoPendiente, 25000);
});

test('conserva el anticipo recibido al reducir el precio', () => {
  const ajuste = calcularAjustePrecio(16000, 5000);

  assert.equal(ajuste.anticipoObjetivo, 4000);
  assert.equal(ajuste.comisionObjetivo, 200);
  assert.equal(ajuste.complementoAnticipo, 0);
  assert.equal(ajuste.saldoPendiente, 11000);
});

test('rechaza un precio propuesto igual o menor que cero', () => {
  assert.throws(() => crearPropuesta(-20000), /fuera del rango/);
  assert.throws(() => crearPropuesta(-20001), /fuera del rango/);
  assert.equal(crearPropuesta(-19999).variacion, -19999);
});

test('aceptar modifica el precio y rechazar conserva el vigente', () => {
  const propuesta = { ...crearPropuesta(1000), id: '1' };

  const aceptada = decidirModificacionPrecio(
    reserva, propuesta, reserva.clienteId, 'ACEPTADA',
  );
  assert.equal(aceptada.precioVigente, 21000);
  assert.equal(aceptada.ajuste.complementoAnticipo, 250);

  const rechazada = decidirModificacionPrecio(
    reserva, propuesta, reserva.clienteId, 'RECHAZADA',
  );
  assert.equal(rechazada.precioVigente, 20000);
  assert.equal(rechazada.ajuste, null);
});

test('bloquea a un cliente ajeno y una segunda decisión', () => {
  const propuesta = { ...crearPropuesta(1000), id: '1' };

  assert.throws(
    () => decidirModificacionPrecio(reserva, propuesta, '99', 'ACEPTADA'),
    /Solo el cliente/,
  );

  assert.throws(
    () => decidirModificacionPrecio(
      reserva,
      { ...propuesta, decisionRegistrada: 'ACEPTADA' },
      reserva.clienteId,
      'ACEPTADA',
    ),
    /La propuesta ya tiene una/,
  );
});

test('el controlador responde 401 si falta el usuario autenticado', () => {
  const controlador = new ModificacionPrecioController({
    decidir() {
      assert.fail('No se debe llamar al servicio sin usuario autenticado.');
    },
  });

  assert.throws(
    () => controlador.decidir({}, '5', '1', { decision: 'ACEPTADA' }),
    (error) => error.getStatus() === 401,
  );
});

test('el controlador traduce una decisión duplicada de PostgreSQL a 409', async () => {
  const controlador = new ModificacionPrecioController({
    async decidir() {
      throw Object.assign(new Error('unique violation'), {
        code: '23505',
        constraint: 'decision_modificacion_modificacion_id_key',
      });
    },
  });

  await assert.rejects(
    () => controlador.decidir(
      { user: { usuarioId: reserva.clienteId } },
      '5',
      '1',
      { decision: 'ACEPTADA' },
    ),
    (error) => error.getStatus() === 409,
  );
});