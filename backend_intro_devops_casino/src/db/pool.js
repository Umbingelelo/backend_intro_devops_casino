// ============================================================
// pool.js - Pool de conexiones a Postgres
// ============================================================
const { Pool, types } = require('pg');

// Postgres devuelve NUMERIC como string por defecto (precision-safe).
// Para nuestro caso (saldo, montos en dos decimales) es seguro
// convertir a Number para que la API responda numeros JSON.
types.setTypeParser(1700, (v) => v === null ? null : parseFloat(v));

// Toda la configuración viene de variables de entorno (patrón 12-factor).
// En docker-compose.yml se inyectan con la sección 'environment:'.
// El nombre del host ('db' es el nombre del servicio en docker-compose,
// 'localhost' sirve para desarrollo local sin Docker).
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT || 5432),
  user:     process.env.DB_USER     || 'casino',
  password: process.env.DB_PASSWORD || 'casino',
  database: process.env.DB_NAME     || 'casino_db',
  // max controla cuántas conexiones simultáneas puede abrir este proceso.
  // Ajustarlo según los recursos del contenedor y los límites de la BD.
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[PG] error en cliente inactivo:', err));

// esperarBD — reintenta la conexión hasta que Postgres acepte consultas.
// Necesario porque en docker-compose el backend puede arrancar antes
// que el contenedor de Postgres esté listo, incluso con depends_on.
// La solución robusta es usar depends_on con condition: service_healthy
// y un healthcheck en la BD (pg_isready), pero esta función cubre el
// caso en que ese mecanismo no esté configurado aún.
async function esperarBD(maxIntentos = 30, esperaMs = 2000) {
  for (let i = 1; i <= maxIntentos; i++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[PG] Conexion establecida (intento ${i})`);
      return;
    } catch (err) {
      console.log(`[PG] BD no disponible (intento ${i}/${maxIntentos}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
  throw new Error('No se pudo conectar a Postgres');
}

module.exports = { pool, esperarBD };
