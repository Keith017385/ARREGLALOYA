require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { prepararDecisionDesembolso } = require('../dist/CORE/aprobacion-desembolsos/aprobacion-desembolsos');
const { AprobacionDesembolsosService } = require('../dist/SERVICE/aprobacion-desembolsos/aprobacion-desembolsos.service');
const { AprobacionDesembolsosController } = require('../dist/API/aprobacion-desembolsos/aprobacion-desembolsos.controller');

function crearRepositorio() {
  const llamadas = [];
  return { llamadas, valor: {
    listarDesembolsos: async () => [],
    decidirDesembolso: async (...args) => { llamadas.push(args); return { decisionFinancieraId: '7' }; },
  } };
}

test('CORE admite importes aprobados como centavos enteros positivos', () => {
  assert.deepEqual(prepararDecisionDesembolso('aprobada', 12500, 'Monto verificado'), { decision: 'aprobada', importeAutorizadoCentavos: 12500, motivo: 'Monto verificado' });
  assert.throws(() => prepararDecisionDesembolso('aprobada', 0, 'Monto'), /entero positivo/i);
  assert.throws(() => prepararDecisionDesembolso('aprobada', 12.5, 'Monto'), /entero positivo/i);
});

test('CORE exige que una solicitud rechazada no incluya importe', () => {
  assert.deepEqual(prepararDecisionDesembolso('rechazada', null, 'Sin respaldo suficiente'), { decision: 'rechazada', importeAutorizadoCentavos: null, motivo: 'Sin respaldo suficiente' });
  assert.throws(() => prepararDecisionDesembolso('rechazada', 100, 'Rechazo'), /no debe tener un importe/i);
  assert.throws(() => prepararDecisionDesembolso('rechazada', null, '  '), /motivo de la decisión/i);
});

test('SERVICE entrega al repositorio una decisión ya validada', async () => {
  const repo = crearRepositorio(); const service = new AprobacionDesembolsosService(repo.valor);
  await service.decidirDesembolso('9', '30', 'aprobada', 12500, ' Saldo verificado ');
  assert.deepEqual(repo.llamadas[0], ['9', '30', 'aprobada', 12500, 'Saldo verificado']);
});

test('API protege listado de desembolsos sin sesión', async () => {
  const controller = new AprobacionDesembolsosController(new AprobacionDesembolsosService(crearRepositorio().valor));
  await assert.rejects(controller.listarDesembolsos({}), error => error.getStatus() === 401);
});
