// ============================================================
// auth.js - Middleware de autenticacion JWT
// ============================================================
const jwt = require('jsonwebtoken');

// JWT_SECRET llega de la variable de entorno para no hardcodear secretos
// en la imagen Docker. En producción se inyecta vía docker-compose.yml,
// AWS Secrets Manager o un archivo .env excluido del repositorio.
const JWT_SECRET = process.env.JWT_SECRET || 'cambiame';

function firmar(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

function requiereAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta token' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = { firmar, requiereAuth };
