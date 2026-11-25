const test = require('node:test');
const assert = require('node:assert/strict');
const { CuentaTrabajadorService } = require('../dist/SERVICE/cuenta-trabajador.service');

// Repositorio falso: no usa PostgreSQL ni escribe nada.
function repoFalso({ estado = 'activo', resultadoSuspender = 'ok', resultadoReactivar = 'ok' } = {}) {
  let actual = estado;
  return {
    obtener: async id => (id === '404' ? null : { usuarioId: id, estado: actual, suspendidaDesde: null }),
    suspender: async () => {
      if (resultadoSuspender === 'ok') actual = 'suspendido_voluntario';
      return resultadoSuspender;
    },
    reactivar: async () => {
      if (resultadoReactivar === 'ok') actual = 'activo';
      return resultadoReactivar;
    },
  };
}

test('suspender con reservas vigentes responde 409 y explica el motivo', async () => {
  const s = new CuentaTrabajadorService(repoFalso({ resultadoSuspender: 'con_reservas_vigentes' }));
  await assert.rejects(
    s.suspender('10'),
    e => e.getStatus() === 409 && e.message === 'No puedes suspender tu cuenta mientras tengas reservas vigentes.',
  );
});

test('suspender una cuenta activa sin reservas devuelve la cuenta suspendida', async () => {
  const s = new CuentaTrabajadorService(repoFalso());
  const cuenta = await s.suspender('10');
  assert.equal(cuenta.estado, 'suspendido_voluntario');
});

test('una suspensión por sanción no se puede reactivar', async () => {
  const s = new CuentaTrabajadorService(
    repoFalso({ estado: 'suspendido_sancion', resultadoReactivar: 'estado_no_permitido' }),
  );
  await assert.rejects(s.reactivar('10'), e => e.getStatus() === 409);
});

test('un trabajador que no existe responde 404', async () => {
  const s = new CuentaTrabajadorService(repoFalso({ resultadoSuspender: 'no_encontrado' }));
  await assert.rejects(s.suspender('404'), e => e.getStatus() === 404);
});