require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararResolucionPago } =
  require('../dist/CORE/revision-discrepancias-pago/resolucion-discrepancia-pago');
const { PostgresRevisionDiscrepanciasPagoRepository } =
  require('../dist/INFRASTRUCTURE/revision-discrepancias-pago/postgres-revision-discrepancias-pago.repository');
const { RevisionDiscrepanciasPagoController } =
  require('../dist/API/revision-discrepancias-pago/revision-discrepancias-pago.controller');

const fechaResolucion = new Date('2026-11-23T16:00:00Z');

function simularTransaccion({ autorizado = true, confirmar = true } = {}) {
  const consultas = [];
  let liberada = false;

  const cliente = {
    async query(sql, parametros) {
      const consulta = sql.trim();
      consultas.push(consulta);

      if (consulta.startsWith('SELECT arreglalo.es_administrador')) {
        assert.deepEqual(parametros, ['21']);
        return { rows: [{ autorizado }] };
      }
      if (consulta.includes('FOR UPDATE OF r')) {
        assert.deepEqual(parametros, ['3']);
        return { rowCount: 1 };
      }
      if (consulta.includes('FOR UPDATE OF p')) {
        return { rows: [{
          confirmadoEn: null,
          tieneDiscrepancia: true,
          yaResuelto: false,
          puedeAcreditarse: true,
        }] };
      }
      if (consulta.startsWith('INSERT INTO arreglalo.resolucion_discrepancia_pago')) {
        assert.deepEqual(parametros.slice(0, 2), ['3', '21']);
        return { rows: [{
          id: '1',
          pagoId: parametros[0],
          responsableId: parametros[1],
          resultado: parametros[2],
          motivo: parametros[3],
          resueltaEn: fechaResolucion,
        }] };
      }
      if (consulta.startsWith('UPDATE arreglalo.pago_directo')) {
        assert.deepEqual(parametros, ['3', '1']);
        return { rows: confirmar ? [{ confirmadoEn: fechaResolucion }] : [] };
      }
      if (consulta.startsWith('BEGIN ') || consulta === 'COMMIT' || consulta === 'ROLLBACK') {
        return { rows: [] };
      }

      assert.fail(`Consulta inesperada: ${consulta}`);
    },
    release() { liberada = true; },
  };

  return {
    repo: new PostgresRevisionDiscrepanciasPagoRepository({ connect: async () => cliente }),
    consultas,
    fueLiberada: () => liberada,
  };
}

test('valida el resultado y exige un motivo de hasta 2000 caracteres', () => {
  assert.deepEqual(prepararResolucionPago('pago_acreditado', ' Consta la recepcion. '), {
    resultado: 'pago_acreditado',
    motivo: 'Consta la recepcion.',
  });
  assert.throws(() => prepararResolucionPago('pendiente', 'Motivo'), /resultado valido/);
  assert.throws(() => prepararResolucionPago('pago_no_acreditado', '   '), /motivo debe tener/);
  assert.throws(() => prepararResolucionPago('pago_acreditado', 'a'.repeat(2001)), /motivo debe tener/);
});

test('rechaza al usuario sin permiso antes de bloquear o escribir el pago', async () => {
  const prueba = simularTransaccion({ autorizado: false });
  await assert.rejects(
    prueba.repo.resolver('3', '21', { resultado: 'pago_acreditado', motivo: 'Prueba' }),
    /administrador activo/,
  );
  assert.equal(prueba.consultas.length, 3);
  assert.equal(prueba.consultas.at(-1), 'ROLLBACK');
  assert.equal(prueba.fueLiberada(), true);
});

test('una resolucion no acreditada conserva la fecha de confirmacion vacia', async () => {
  const prueba = simularTransaccion();
  const resolucion = await prueba.repo.resolver(
    '3', '21', { resultado: 'pago_no_acreditado', motivo: 'Prueba' },
  );

  assert.equal(resolucion.confirmadoEn, null);
  assert.equal(resolucion.responsableId, '21');
  assert.equal(prueba.consultas.some((sql) => sql.startsWith('UPDATE ')), false);
  assert.equal(prueba.consultas.at(-1), 'COMMIT');
});

test('confirma el pago acreditado junto con su resolucion', async () => {
  const prueba = simularTransaccion();
  const resolucion = await prueba.repo.resolver(
    '3', '21', { resultado: 'pago_acreditado', motivo: 'Prueba' },
  );

  assert.equal(resolucion.confirmadoEn, fechaResolucion);
  assert.match(prueba.consultas.at(-2), /^UPDATE arreglalo.pago_directo/);
  assert.equal(prueba.consultas.at(-1), 'COMMIT');
  assert.equal(prueba.fueLiberada(), true);
});

test('revierte la resolucion cuando falla la confirmacion del pago', async () => {
  const prueba = simularTransaccion({ confirmar: false });
  await assert.rejects(
    prueba.repo.resolver('3', '21', { resultado: 'pago_acreditado', motivo: 'Prueba' }),
    /ya no esta disponible para confirmacion/,
  );

  assert.match(prueba.consultas.at(-2), /^UPDATE arreglalo.pago_directo/);
  assert.equal(prueba.consultas.at(-1), 'ROLLBACK');
  assert.equal(prueba.consultas.includes('COMMIT'), false);
  assert.equal(prueba.fueLiberada(), true);
});

test('el controlador exige sesion y devuelve 409 ante una resolucion duplicada', async () => {
  const cuerpo = { resultado: 'pago_no_acreditado', motivo: 'Prueba' };
  const controller = new RevisionDiscrepanciasPagoController({
    resolver: async () => { throw new Error('El pago ya tiene una resolucion.'); },
  });

  await assert.rejects(controller.resolver({}, '3', cuerpo), (e) => e.getStatus() === 401);
  await assert.rejects(
    controller.resolver({ user: { usuarioId: '21' } }, '3', cuerpo),
    (e) => e.getStatus() === 409,
  );
});
