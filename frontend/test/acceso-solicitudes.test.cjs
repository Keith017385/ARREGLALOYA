const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const appDir = path.resolve(__dirname, '../src/app') + path.sep;
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(appDir)) throw new Error(`Archivo inesperado: ${filename}`);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
  });
  module._compile(outputText, filename);
};
let AppComponent;
try {
  ({ AppComponent } = require('../src/app/app.component.ts'));
} finally {
  if (previousLoader) require.extensions['.ts'] = previousLoader;
  else delete require.extensions['.ts'];
}

test('solicitar desde el listado pide sesión y conserva la vista', () => {
  const componente = new AppComponent({});
  componente.vista = 'trabajadores';
  componente.solicitar();
  assert.equal(componente.modal, 'sesion-requerida');
  assert.equal(componente.vista, 'trabajadores');
});

test('solicitar desde un perfil sustituye el diálogo por el aviso de sesión', () => {
  const componente = new AppComponent({});
  componente.vista = 'trabajadores';
  componente.perfil(componente.trabajadores[1]);
  componente.solicitar();
  assert.equal(componente.modal, 'sesion-requerida');
  assert.equal(componente.vista, 'trabajadores');
});

test('el catálogo permite buscar como visitante y presenta la categoría recibida', () => {
  const categoria = { id: '1', codigo: 'plomeria', nombre: 'Plomería' };
  const componente = new AppComponent({ buscar(consulta) {
    assert.equal(consulta, 'plomer');
    return { subscribe(next) { next([categoria]); return { unsubscribe() {} }; } };
  } });
  const previousWindow = global.window;
  global.window = { scrollTo() {} };
  try {
    componente.q = ' plomer ';
    componente.buscar();
    assert.equal(componente.vista, 'servicios');
    assert.deepEqual(componente.categorias, [categoria]);
    assert.equal(componente.cargando, false);
  } finally {
    if (previousWindow) global.window = previousWindow;
    else delete global.window;
  }
});
