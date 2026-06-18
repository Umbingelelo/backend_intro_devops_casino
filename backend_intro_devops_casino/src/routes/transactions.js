// ============================================================
// /api/transacciones - historial del usuario autenticado
// ============================================================
const express = require('express');
const { pool } = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');

const router = express.Router();

// try/catch necesario en Express 4 con async handlers (ver nota en users.js)
router.get('/', requiereAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await pool.query(
      `SELECT t.id, t.tipo, t.monto, t.saldo_post, t.detalle, t.creada_en,
              j.codigo AS juego
         FROM transacciones t
         LEFT JOIN juegos j ON j.id = t.juego_id
        WHERE t.usuario_id = $1
        ORDER BY t.creada_en DESC
        LIMIT $2`,
      [req.usuario.sub, limit]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
