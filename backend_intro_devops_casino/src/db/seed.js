// ============================================================
// seed.js - Usuarios demo con hash bcrypt real.
// Se ejecuta al arrancar el backend; es idempotente gracias a
// ON CONFLICT DO NOTHING: si los usuarios ya existen (reinicios
// del contenedor, redeploys) la operación no falla ni duplica datos.
// ============================================================
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const DEMOS = [
  { username: 'demo',     email: 'demo@casino.test',     password: 'demo1234', saldo: 5000.00, rol: 'jugador' },
  { username: 'jugador1', email: 'jugador1@casino.test', password: 'demo1234', saldo: 1000.00, rol: 'jugador' },
  { username: 'admin',    email: 'admin@casino.test',    password: 'admin1234', saldo: 99999.00, rol: 'admin' }
];

async function sembrarUsuariosDemo() {
  for (const u of DEMOS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO usuarios (username, email, password_hash, saldo, rol)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO NOTHING`,
      [u.username, u.email, hash, u.saldo, u.rol]
    );
  }
  console.log('[SEED] Usuarios demo verificados');
}

module.exports = { sembrarUsuariosDemo };
