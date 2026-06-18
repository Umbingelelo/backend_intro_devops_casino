// ============================================================
// /api/auth - registro y login con JWT
// ============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { firmar } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email y password son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password debe tener >= 6 caracteres' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, saldo, rol`,
      [username, email, hash]
    );
    const usuario = rows[0];
    const token = firmar({ sub: usuario.id, username: usuario.username, rol: usuario.rol });
    res.status(201).json({ usuario, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'username o email ya registrados' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username y password son obligatorios' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash, saldo, rol FROM usuarios WHERE username = $1',
      [username]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales invalidas' });
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales invalidas' });
    const token = firmar({ sub: u.id, username: u.username, rol: u.rol });
    res.json({
      usuario: { id: u.id, username: u.username, email: u.email, saldo: u.saldo, rol: u.rol },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
