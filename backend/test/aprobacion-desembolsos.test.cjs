require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  prepararDecisionDesembolso,
  obtenerMotivosBloqueoTransferencia,
  validarCondicionesTransferencia,
  calcularMaximoAutorizableCentavos,
} = require('../dist/CORE/aprobacion-desembolsos/aprobacion-desembolsos');
const { AprobacionDesembolsosService } = require('../dist/SERVICE/aprobacion-desembolsos/aprobacion-desembolsos.service');
const { AprobacionDesembolsosController } = require('../dist/API/aprobacion-desembolsos/aprobacion-desembolsos.controller');

function condiciones(overrides = {}) {
  return {
    tipoSolicitud: 'desembolso',
    estadoReserva: 'reservada',
    importeSolicitadoCentavos: 50000,
    disponibleCentavos: 42000,
    documentoDisponible: true,
    reclamoEnRevision: false,
    movimientoExistente: false,
    ...overrides,
  };
}

function crearRepositorio() {
  const llamadas = [];
  return {
    llamadas,
    valor: {
      listarDesembolsos: async () => [],
      decidirDesembolso: async (...args) => {
        llamadas.push(args);
        return { decisionFinancieraId: '7', decision: args[2] };
      },
    },
  };
}

test('CORE acepta aprobación con importe positivo en centavos enteros', () => {
  assert.deepEqual(
    prepararDecisionDesembolso('aprobada', 12500, 'Monto verificado'),
    { decision: 'aprobada', importeAutorizadoCentavos: 12500, motivo: 'Monto verificado' },
  );
  assert.throws(() => prepararDecisionDesembolso('aprobada', 0, 'Monto'), /entero positivo/i);
  assert.throws(() => prepararDecisionDesembolso('aprobada', 12.5, 'Monto'), /entero positivo/i);
});

test('CORE exige motivo y no admite importe al rechazar', () => {
  assert.deepEqual(
    prepararDecisionDesembolso('rechazada', null, 'Sin respaldo'),
    { decision: 'rechazada', importeAutorizadoCentavos: null, motivo: 'Sin respaldo' },
  );
  assert.throws(() => prepararDecisionDesembolso('rechazada', 100, 'Rechazo'), /no debe tener un importe/i);
  assert.throws(() => prepararDecisionDesembolso('rechazada', null, '  '), /motivo de la decisión/i);
});

test('CORE calcula el máximo como el menor entre solicitud y disponibilidad', () => {
  assert.equal(calcularMaximoAutorizableCentavos(condiciones()), 42000);
  assert.equal(calcularMaximoAutorizableCentavos(condiciones({ disponibleCentavos: 90000 })), 50000);
});

test('CORE permite aprobar cuando todas las condiciones se cumplen', () => {
  assert.doesNotThrow(() => validarCondicionesTransferencia(condiciones(), 40000));
});

test('CORE rechaza un importe superior al solicitado o al fondo', () => {
  assert.throws(() => validarCondicionesTransferencia(condiciones(), 50001), /supera el importe solicitado/i);
  assert.throws(() => validarCondicionesTransferencia(condiciones(), 42001), /supera el fondo disponible/i);
});

test('CORE bloquea reservas que no admiten desembolsos', () => {
  assert.match(obtenerMotivosBloqueoTransferencia(condiciones({ estadoReserva: 'cancelada' })).join(' '), /estado actual/i);
});

test('CORE bloquea solicitudes sin documento de respaldo', () => {
  assert.match(obtenerMotivosBloqueoTransferencia(condiciones({ documentoDisponible: false })).join(' '), /documento PDF/i);
});

test('CORE bloquea solicitudes vinculadas a reclamos en revisión', () => {
  assert.match(obtenerMotivosBloqueoTransferencia(condiciones({ reclamoEnRevision: true })).join(' '), /reclamo vinculado/i);
});

test('CORE bloquea solicitudes que ya tienen un movimiento financiero', () => {
  assert.match(obtenerMotivosBloqueoTransferencia(condiciones({ movimientoExistente: true })).join(' '), /movimiento financiero/i);
});

test('SERVICE entrega al repositorio una decisión y motivo previamente normalizados', async () => {
  const repo = crearRepositorio();
  const service = new AprobacionDesembolsosService(repo.valor);
  await service.decidirDesembolso('9', '30', 'aprobada', 12500, ' Saldo verificado ');
  assert.deepEqual(repo.llamadas[0], ['9', '30', 'aprobada', 12500, 'Saldo verificado']);
});

test('API impide listar desembolsos sin sesión', async () => {
  const controller = new AprobacionDesembolsosController(
    new AprobacionDesembolsosService(crearRepositorio().valor),
  );
  await assert.rejects(controller.listarDesembolsos({}), error => error.getStatus() === 401);
});
