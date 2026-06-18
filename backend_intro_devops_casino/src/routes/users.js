// ============================================================
// /api/usuarios - perfil y saldo
// ============================================================
const express = require('express');
const { pool } = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios/me — requiereAuth extrae req.usuario del JWT
// En Express 4 los async handlers necesitan try/catch para que los
// errores lleguen al manejador global en lugar de ser unhandled rejections.
router.get('/me', requiereAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, saldo, rol, creado_en FROM usuarios WHERE id = $1',
      [req.usuario.sub]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/me/depositar', requiereAuth, async (req, res) => {
  const monto = Number(req.body?.monto);
  if (!monto || monto <= 0 || monto > 100000) {
    return res.status(400).json({ error: 'monto debe ser > 0 y <= 100000' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      'UPDATE usuarios SET saldo = saldo + $1 WHERE id = $2 RETURNING saldo',
      [monto, req.usuario.sub]
    );
    const saldo = upd.rows[0].saldo;
    await client.query(
      `INSERT INTO transacciones (usuario_id, tipo, monto, saldo_post, detalle)
       VALUES ($1, 'deposito', $2, $3, $4)`,
      [req.usuario.sub, monto, saldo, { origen: 'demo' }]
    );
    await client.query('COMMIT');
    res.json({ saldo });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
