'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { hash } = require('bcryptjs');

const dotenvPath = process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '..', '.env');
dotenv.config({ path: dotenvPath, override: process.env.DOTENV_CONFIG_OVERRIDE === 'true' });

const cuentasDemo = [
  { correo: 'cliente.demo@example.invalid', nombre: 'Cliente de demostración', rol: 'cliente', contrasena: 'DemoCliente2026!' },
  { correo: 'trabajador.demo@example.invalid', nombre: 'Trabajador de demostración', rol: 'trabajador', contrasena: 'DemoTrabajador2026!' },
  { correo: 'admin.demo@example.invalid', nombre: 'Administrador de demostración', rol: 'administrador', contrasena: 'DemoAdmin2026!' },
  { correo: 'superadmin.demo@example.invalid', nombre: 'Superadministrador de demostración', rol: 'superadministrador', contrasena: 'DemoSuper2026!' },
];

function validarDestinoLocal() {
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Para crear cuentas ficticias, define ALLOW_DEMO_SEED=true explícitamente.');
  }
  const host = (process.env.PGHOST || 'localhost').trim().toLowerCase();
  const base = (process.env.PGDATABASE || '').trim();
  const loopback = new Set(['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1']);
  if (!loopback.has(host)) {
    throw new Error('Seed cancelado: las cuentas demo solo se crean en PostgreSQL local.');
  }
  if (!/^(postgres|.*(?:local|demo|test).*)$/i.test(base)) {
    throw new Error('Seed cancelado: usa una base local llamada postgres, local, demo o test.');
  }
}

async function asegurarCuenta(cliente, cuenta, contrasenaHash, zonaCentro) {
  const rol = await cliente.query(
    'SELECT rol_id FROM arreglalo.rol WHERE codigo = $1', [cuenta.rol],
  );
  if (!rol.rows[0]) throw new Error(`No existe el rol requerido: ${cuenta.rol}`);

  const existente = await cliente.query(
    'SELECT usuario_id FROM arreglalo.cuenta_acceso WHERE identificador_acceso = $1 FOR UPDATE',
    [cuenta.correo],
  );
  let usuarioId;
  if (existente.rows[0]) {
    usuarioId = existente.rows[0].usuario_id;
    await cliente.query("UPDATE arreglalo.usuario SET estado = 'activo' WHERE usuario_id = $1", [usuarioId]);
    await cliente.query(
      'UPDATE arreglalo.cuenta_acceso SET hash_credencial = $2 WHERE usuario_id = $1',
      [usuarioId, contrasenaHash],
    );
    await cliente.query(
      'UPDATE arreglalo.perfil_usuario SET nombre = $2 WHERE usuario_id = $1',
      [usuarioId, cuenta.nombre],
    );
    await cliente.query('DELETE FROM arreglalo.usuario_rol WHERE usuario_id = $1', [usuarioId]);
  } else {
    const nuevo = await cliente.query(
      "INSERT INTO arreglalo.usuario (creado_en, estado) VALUES (NOW(), 'activo') RETURNING usuario_id",
    );
    usuarioId = nuevo.rows[0].usuario_id;
    await cliente.query(
      'INSERT INTO arreglalo.cuenta_acceso (usuario_id, identificador_acceso, hash_credencial) VALUES ($1, $2, $3)',
      [usuarioId, cuenta.correo, contrasenaHash],
    );
    await cliente.query(
      'INSERT INTO arreglalo.perfil_usuario (usuario_id, nombre) VALUES ($1, $2)',
      [usuarioId, cuenta.nombre],
    );
  }

  await cliente.query(
    'INSERT INTO arreglalo.usuario_rol (usuario_id, rol_id) VALUES ($1, $2)',
    [usuarioId, rol.rows[0].rol_id],
  );
  if (cuenta.rol === 'trabajador') {
    await cliente.query(
      `INSERT INTO arreglalo.trabajador (usuario_id, zona_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id) DO UPDATE SET zona_id = EXCLUDED.zona_id`,
      [usuarioId, zonaCentro],
    );
    await cliente.query(
      `INSERT INTO arreglalo.trabajador_categoria (trabajador_id, categoria_id)
       SELECT $1, categoria_id FROM arreglalo.categoria
       ON CONFLICT DO NOTHING`,
      [usuarioId],
    );
  }
}

async function main() {
  validarDestinoLocal();
  const pool = new Pool();
  const cliente = await pool.connect();
  try {
    const baseActual = await cliente.query('SELECT current_database() AS base');
    if (baseActual.rows[0].base !== process.env.PGDATABASE) {
      throw new Error('La base conectada no coincide con PGDATABASE; seed cancelado.');
    }
    const zona = await cliente.query(
      "SELECT zona_id FROM arreglalo.zona WHERE nombre = 'Centro' ORDER BY zona_id LIMIT 1",
    );
    if (!zona.rows[0]) throw new Error('No existe la zona Centro; aplica primero el esquema base.');

    await cliente.query('BEGIN');
    for (const cuenta of cuentasDemo) {
      await asegurarCuenta(cliente, cuenta, await hash(cuenta.contrasena, 12), zona.rows[0].zona_id);
    }
    await cliente.query('COMMIT');
    console.log('Cuentas de demostración creadas o actualizadas en PostgreSQL local:');
    for (const cuenta of cuentasDemo) console.log(`${cuenta.rol}: ${cuenta.correo} / ${cuenta.contrasena}`);
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
