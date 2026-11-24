require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { CancelacionTrabajadorService } =
  require('../dist/SERVICE/cancelacion-trabajador/cancelacion-trabajador.service');
const { CancelacionTrabajadorController } =
  require('../dist/API/cancelacion-trabajador/cancelacion-trabajador.controller');

const inicio = new Date('2026-12-02T15:00:00.000Z');
const contextoValido = {
  estado: 'reservada',
  inicioProgramado: inicio,
  clienteId: '20',
  trabajadorId: '21',
  rolTrabajadorActivo: true,
  requiereConciliacion: false,
  reembolsoCentavos: 12500,
  desembolsosPreviosCentavos: 4500,
};

function crearServicio(reemplazos = {}) {
  const repositorio = {
    consultarContexto: async () => ({ ...contextoValido }),
    confirmar: async (reservaId, trabajadorId, motivo, vistaPrevia) => ({
      reservaId,
      cancelacionId: '90',
      incidenteId: '31',
      solicitudFinancieraId: '77',
      estadoAnterior: 'reservada',
      estadoNuevo: 'cancelada',
      reembolsoCentavos: 12500,
      desembolsosPreviosCentavos: 4500,
      trabajadorId,
      motivo,
      vistaPrevia,
    }),
    ...reemplazos,
  };
  return new CancelacionTrabajadorService(repositorio);
}

function crearVista() {
  return {
    reservaId: '10',
    estado: 'reservada',
    inicioProgramado: inicio.toISOString(),
    reembolsoCentavos: 12500,
    desembolsosPreviosCentavos: 4500,
  };
}

test('la vista previa devuelve el 100 % recibido y los desembolsos previos', async () => {
  const servicio = crearServicio();
  assert.deepEqual(await servicio.consultarVistaPrevia('10', '21'), crearVista());
});

test('la vista previa rechaza una reserva inexistente', async () => {
  const servicio = crearServicio({ consultarContexto: async () => null });
  await assert.rejects(
    servicio.consultarVistaPrevia('999', '21'),
    /No se encontro la reserva/,
  );
});

test('la vista previa exige que el actor sea el trabajador asignado', async () => {
  const servicio = crearServicio();
  await assert.rejects(
    servicio.consultarVistaPrevia('10', '22'),
    /no corresponde al trabajador contratado/,
  );
});

test('la vista previa exige rol activo de trabajador', async () => {
  const servicio = crearServicio({
    consultarContexto: async () => ({ ...contextoValido, rolTrabajadorActivo: false }),
  });
  await assert.rejects(
    servicio.consultarVistaPrevia('10', '21'),
    /rol de trabajador activo/,
  );
});

test('la vista previa bloquea estados cerrados y conciliaciones pendientes', async () => {
  const cerrada = crearServicio({
    consultarContexto: async () => ({ ...contextoValido, estado: 'cancelada' }),
  });
  await assert.rejects(
    cerrada.consultarVistaPrevia('10', '21'),
    /no esta disponible para cancelacion/,
  );

  const conConciliacion = crearServicio({
    consultarContexto: async () => ({ ...contextoValido, requiereConciliacion: true }),
  });
  await assert.rejects(
    conConciliacion.consultarVistaPrevia('10', '21'),
    /deben conciliarse/,
  );
});

test('confirmar exige motivo y vista previa válida', async () => {
  const llamadas = [];
  const servicio = crearServicio({
    confirmar: async (...args) => { llamadas.push(args); return { cancelacionId: '90' }; },
  });
  const vista = crearVista();

  await assert.rejects(servicio.confirmar('10', '21', '  ', vista), /motivo.*obligatorio/);
  await assert.rejects(
    servicio.confirmar('10', '21', 'Motivo', { ...vista, reembolsoCentavos: -1 }),
    /vista previa valida/,
  );
  await assert.rejects(
    servicio.confirmar('10', '21', 'Motivo', { ...vista, reservaId: '11' }),
    /vista previa valida/,
  );
  assert.equal(llamadas.length, 0);

  const resultado = await servicio.confirmar('10', '21', '  No puedo asistir.  ', vista);
  assert.equal(resultado.cancelacionId, '90');
  assert.deepEqual(llamadas, [['10', '21', 'No puedo asistir.', vista]]);
});

test('el controlador exige autenticación y valida el ID de reserva', async () => {
  const controlador = new CancelacionTrabajadorController(crearServicio());

  await assert.rejects(
    controlador.consultarVistaPrevia({}, '10'),
    (error) => error.getStatus() === 401,
  );
  await assert.rejects(
    controlador.consultarVistaPrevia({ user: { usuarioId: '21' } }, '0'),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(
    controlador.confirmar({ user: { usuarioId: '21' } }, '10', {}),
    (error) => error.getStatus() === 400,
  );
});

test('el controlador transforma falta de autorización en 403', async () => {
  const servicio = {
    consultarVistaPrevia: async () => {
      throw new Error('El usuario no corresponde al trabajador contratado.');
    },
  };
  const controlador = new CancelacionTrabajadorController(servicio);
  await assert.rejects(
    controlador.consultarVistaPrevia({ user: { usuarioId: '22' } }, '10'),
    (error) => error.getStatus() === 403,
  );
});

test('el controlador transforma cambios de la vista previa en 409', async () => {
  const servicio = {
    confirmar: async () => {
      throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
    },
  };
  const controlador = new CancelacionTrabajadorController(servicio);
  await assert.rejects(
    controlador.confirmar(
      { user: { usuarioId: '21' } },
      '10',
      { motivo: 'Motivo válido', vistaPrevia: crearVista() },
    ),
    (error) => error.getStatus() === 409,
  );
});

const { PostgresCancelacionTrabajadorRepository } =
  require('../dist/INFRASTRUCTURE/cancelacion-trabajador/postgres-cancelacion-trabajador.repository');

function crearClientePostgres({ reembolsoReal = '12500', deudaReal = '4500' } = {}) {
  const consultas = [];
  const cliente = {
    async query(sql, parametros = []) {
      const texto = String(sql).trim();
      consultas.push({ sql: texto, parametros });

      if (texto.startsWith('BEGIN') || texto === 'COMMIT' || texto === 'ROLLBACK') {
        return { rows: [] };
      }
      if (texto.includes('FOR UPDATE OF r')) {
        return {
          rows: [{
            estado: 'reservada',
            inicioProgramado: inicio,
            clienteId: '20',
            trabajadorId: '21',
            rolTrabajadorActivo: true,
            requiereConciliacion: false,
            reembolsoCentavos: '12500',
            desembolsosPreviosCentavos: '4500',
          }],
        };
      }
      if (texto.startsWith('INSERT INTO arreglalo.cancelacion')) {
        return { rows: [{ id: '90' }] };
      }
      if (texto.includes('FROM arreglalo.v_liquidacion_cancelacion')) {
        return { rows: [{ causal: 'trabajador_cancela', reembolsoCentavos: reembolsoReal }] };
      }
      if (texto.startsWith('INSERT INTO arreglalo.solicitud_financiera')) {
        return { rows: [{ id: '77' }] };
      }
      if (texto.startsWith('INSERT INTO arreglalo.incidente')) {
        return { rows: [{ id: '31' }] };
      }
      if (texto.includes('FROM arreglalo.deuda_trabajador')) {
        return { rows: [{ centavos: deudaReal }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return { cliente, consultas };
}

test('el repositorio registra todos los efectos del CU-15 dentro de una transacción', async () => {
  const { cliente, consultas } = crearClientePostgres();
  const repositorio = new PostgresCancelacionTrabajadorRepository({
    connect: async () => cliente,
  });

  const resultado = await repositorio.confirmar('10', '21', 'No podré asistir.', crearVista());
  assert.equal(resultado.cancelacionId, '90');
  assert.equal(resultado.incidenteId, '31');
  assert.equal(resultado.solicitudFinancieraId, '77');
  assert.equal(resultado.reembolsoCentavos, 12500);
  assert.equal(resultado.desembolsosPreviosCentavos, 4500);
  assert.equal(consultas[0].sql, 'BEGIN ISOLATION LEVEL READ COMMITTED');
  assert.equal(consultas[consultas.length - 1].sql, 'COMMIT');

  const sqlEjecutado = consultas.map((consulta) => consulta.sql).join('\n');
  assert.match(sqlEjecutado, /INSERT INTO arreglalo\.cancelacion/);
  assert.match(sqlEjecutado, /INSERT INTO arreglalo\.solicitud_financiera/);
  assert.match(sqlEjecutado, /INSERT INTO arreglalo\.reembolso_cancelacion/);
  assert.match(sqlEjecutado, /INSERT INTO arreglalo\.incidente/);
  assert.match(sqlEjecutado, /INSERT INTO arreglalo\.incidente_usuario/);
  assert.match(sqlEjecutado, /INSERT INTO arreglalo\.evento_reserva/);
  assert.doesNotMatch(sqlEjecutado, /INSERT INTO arreglalo\.deuda_trabajador/);
  assert.doesNotMatch(sqlEjecutado, /UPDATE arreglalo\.reserva/);
});

test('el repositorio revierte si el importe de la liquidación cambió', async () => {
  const { cliente, consultas } = crearClientePostgres({ reembolsoReal: '12501' });
  const repositorio = new PostgresCancelacionTrabajadorRepository({
    connect: async () => cliente,
  });

  await assert.rejects(
    repositorio.confirmar('10', '21', 'No podré asistir.', crearVista()),
    /vista previa cambio/,
  );
  assert.equal(consultas[consultas.length - 1].sql, 'ROLLBACK');
  assert.equal(
    consultas.some((consulta) => consulta.sql.startsWith('INSERT INTO arreglalo.solicitud_financiera')),
    false,
  );
});

test('el repositorio no crea una solicitud financiera por importe cero', async () => {
  const { cliente, consultas } = crearClientePostgres({ reembolsoReal: '0', deudaReal: '0' });
  // La vista previa y la consulta bloqueada deben reflejar cero en este escenario.
  const queryOriginal = cliente.query.bind(cliente);
  cliente.query = async (sql, parametros = []) => {
    if (String(sql).includes('FOR UPDATE OF r')) {
      return {
        rows: [{
          estado: 'pendiente_anticipo',
          inicioProgramado: inicio,
          clienteId: '20',
          trabajadorId: '21',
          rolTrabajadorActivo: true,
          requiereConciliacion: false,
          reembolsoCentavos: '0',
          desembolsosPreviosCentavos: '0',
        }],
      };
    }
    return queryOriginal(sql, parametros);
  };
  const repositorio = new PostgresCancelacionTrabajadorRepository({
    connect: async () => cliente,
  });
  const vista = {
    reservaId: '10',
    estado: 'pendiente_anticipo',
    inicioProgramado: inicio.toISOString(),
    reembolsoCentavos: 0,
    desembolsosPreviosCentavos: 0,
  };
  const resultado = await repositorio.confirmar('10', '21', 'No podré realizarlo.', vista);
  assert.equal(resultado.solicitudFinancieraId, null);
  assert.equal(resultado.reembolsoCentavos, 0);
  assert.equal(
    consultas.some((consulta) => consulta.sql.startsWith('INSERT INTO arreglalo.solicitud_financiera')),
    false,
  );
});
