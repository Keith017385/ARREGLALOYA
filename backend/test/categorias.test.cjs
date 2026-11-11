const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresCategoriasRepository: CategoriasService } = require('../dist/INFRASTRUCTURE/postgres-categorias.repository');
const { CategoriasController } = require('../dist/API/categorias.controller');
test('el texto se envía como parámetro y no se mezcla con SQL', async () => {
  const texto = "x'; DROP TABLE categoria; --";
  let observado;
  const db = { pool: { query: async (sql, params) => {
    observado = { sql, params }; return { rows: [] };
  } } };
  assert.deepEqual(await new CategoriasService(db).listar(texto), []);
  assert.equal(observado.sql.includes(texto), false);
  assert.match(observado.sql, /\$1/);
  assert.deepEqual(observado.params, [texto]);
});
test('rechaza búsquedas demasiado largas y valores que no son texto', () => {
  const c = new CategoriasController({ listar: () => [] });
  assert.throws(() => c.listar('a'.repeat(81)));
  assert.throws(() => c.listar(['a', 'b']));
});
test('normaliza espacios y permite el catálogo vacío', async () => {
  let recibido;
  const c = new CategoriasController({ listar: async q => { recibido=q; return []; } });
  assert.deepEqual(await c.listar('  plomer  '), []);
  assert.equal(recibido, 'plomer');
  assert.deepEqual(await c.listar(), []);
  assert.equal(recibido, '');
});
test('una falla de conexión devuelve 503 sin revelar el error interno', async () => {
  const s = new CategoriasService({pool:{query:async()=>{throw Error('secreto');}}});
  await assert.rejects(s.listar(''), e => e.getStatus()===503 && !e.message.includes('secreto'));
});
