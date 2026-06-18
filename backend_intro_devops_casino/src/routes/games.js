// ============================================================
// /api/juegos - catalogo y endpoints de juego
// ============================================================
const express = require('express');
const { pool } = require('../db/pool');
const { requiereAuth } = require('../middleware/auth');
const slots = require('../games/slots');
const roulette = require('../games/roulette');
const blackjack = require('../games/blackjack');

const router = express.Router();

// ---------- Catalogo ----------
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, codigo, nombre, descripcion, apuesta_min, apuesta_max FROM juegos WHERE activo = TRUE ORDER BY id'
  );
  res.json(rows);
});

// ---------- helpers transaccionales ----------
async function obtenerJuego(codigo) {
  const { rows } = await pool.query('SELECT * FROM juegos WHERE codigo = $1 AND activo = TRUE', [codigo]);
  if (rows.length === 0) throw Object.assign(new Error('Juego no disponible'), { status: 404 });
  return rows[0];
}

async function debitarApuesta(client, usuarioId, juego, monto) {
  if (monto < Number(juego.apuesta_min) || monto > Number(juego.apuesta_max)) {
    throw Object.assign(
      new Error(`Apuesta fuera de rango (${juego.apuesta_min} - ${juego.apuesta_max})`),
      { status: 400 }
    );
  }
  const upd = await client.query(
    `UPDATE usuarios
        SET saldo = saldo - $1
      WHERE id = $2 AND saldo >= $1
      RETURNING saldo`,
    [monto, usuarioId]
  );
  if (upd.rows.length === 0) {
    throw Object.assign(new Error('Saldo insuficiente'), { status: 400 });
  }
  await client.query(
    `INSERT INTO transacciones (usuario_id, tipo, juego_id, monto, saldo_post, detalle)
     VALUES ($1, 'apuesta', $2, $3, $4, $5)`,
    [usuarioId, juego.id, monto, upd.rows[0].saldo, { codigo: juego.codigo }]
  );
  return upd.rows[0].saldo;
}

async function acreditarPremio(client, usuarioId, juego, premio, detalle) {
  if (premio <= 0) return null;
  const upd = await client.query(
    'UPDATE usuarios SET saldo = saldo + $1 WHERE id = $2 RETURNING saldo',
    [premio, usuarioId]
  );
  await client.query(
    `INSERT INTO transacciones (usuario_id, tipo, juego_id, monto, saldo_post, detalle)
     VALUES ($1, 'premio', $2, $3, $4, $5)`,
    [usuarioId, juego.id, premio, upd.rows[0].saldo, detalle]
  );
  return upd.rows[0].saldo;
}

async function saldoActual(client, usuarioId) {
  const { rows } = await client.query('SELECT saldo FROM usuarios WHERE id = $1', [usuarioId]);
  return rows[0].saldo;
}

// ============================================================
// SLOTS - POST /api/juegos/slots/jugar  { apuesta }
// ============================================================
router.post('/slots/jugar', requiereAuth, async (req, res) => {
  const apuesta = Number(req.body?.apuesta);
  if (!apuesta || apuesta <= 0) return res.status(400).json({ error: 'apuesta invalida' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const juego = await obtenerJuego('slots');
    await debitarApuesta(client, req.usuario.sub, juego, apuesta);
    const resultado = slots.jugar(apuesta);
    if (resultado.premio > 0) {
      await acreditarPremio(client, req.usuario.sub, juego, resultado.premio, resultado);
    }
    const saldo = await saldoActual(client, req.usuario.sub);
    await client.query('COMMIT');
    res.json({ resultado, saldo });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// RULETA - POST /api/juegos/roulette/jugar  { apuestas: [{tipo,valor,monto}] }
// ============================================================
router.post('/roulette/jugar', requiereAuth, async (req, res) => {
  const apuestas = Array.isArray(req.body?.apuestas) ? req.body.apuestas : [];
  if (apuestas.length === 0) return res.status(400).json({ error: 'sin apuestas' });
  const total = apuestas.reduce((s, a) => s + Number(a.monto || 0), 0);
  if (!total || total <= 0) return res.status(400).json({ error: 'monto total invalido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const juego = await obtenerJuego('roulette');
    await debitarApuesta(client, req.usuario.sub, juego, total);
    const resultado = roulette.jugar(apuestas);
    if (resultado.totalRetornado > 0) {
      await acreditarPremio(client, req.usuario.sub, juego, resultado.totalRetornado, resultado);
    }
    const saldo = await saldoActual(client, req.usuario.sub);
    await client.query('COMMIT');
    res.json({ resultado, saldo });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// BLACKJACK - manejo por sesion en BD (estado en JSONB)
//   POST /api/juegos/blackjack/iniciar   { apuesta }
//   POST /api/juegos/blackjack/accion    { sesionId, accion: 'pedir'|'plantarse'|'doblar' }
// ============================================================
async function cerrarSesionYPagar(client, usuarioId, sesion, juego) {
  const estado = sesion.estado;
  if (!estado.terminada) return;
  if (estado.retorno > 0) {
    await acreditarPremio(client, usuarioId, juego, estado.retorno, {
      codigo: 'blackjack',
      resultado: estado.resultado,
      totales: estado.totales
    });
  }
  await client.query(
    'UPDATE sesiones_juego SET estado = $1, abierta = FALSE, cerrada_en = NOW() WHERE id = $2',
    [estado, sesion.id]
  );
}

router.post('/blackjack/iniciar', requiereAuth, async (req, res) => {
  const apuesta = Number(req.body?.apuesta);
  if (!apuesta || apuesta <= 0) return res.status(400).json({ error: 'apuesta invalida' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const juego = await obtenerJuego('blackjack');
    await debitarApuesta(client, req.usuario.sub, juego, apuesta);

    let estado = blackjack.nuevaMano(apuesta);
    // Si el jugador parte con blackjack, resolver inmediatamente
    if (blackjack.valorMano(estado.jugador) === 21) {
      estado = blackjack.plantarse(estado);
    }

    const ses = await client.query(
      `INSERT INTO sesiones_juego (usuario_id, juego_id, estado, abierta)
       VALUES ($1, $2, $3, $4) RETURNING id, estado, abierta`,
      [req.usuario.sub, juego.id, estado, !estado.terminada]
    );
    const sesion = { id: ses.rows[0].id, estado: ses.rows[0].estado };
    if (estado.terminada) await cerrarSesionYPagar(client, req.usuario.sub, sesion, juego);
    const saldo = await saldoActual(client, req.usuario.sub);
    await client.query('COMMIT');

    res.status(201).json({
      sesionId: sesion.id,
      jugador: estado.jugador,
      banca: estado.terminada ? estado.banca : [estado.banca[0], { oculta: true }],
      apuesta: estado.apuesta,
      terminada: estado.terminada,
      resultado: estado.resultado || null,
      retorno: estado.retorno || 0,
      totales: estado.terminada ? estado.totales : null,
      saldo
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/blackjack/accion', requiereAuth, async (req, res) => {
  const { sesionId, accion } = req.body || {};
  if (!sesionId || !['pedir','plantarse','doblar'].includes(accion)) {
    return res.status(400).json({ error: 'sesionId y accion validos requeridos' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ses = await client.query(
      `SELECT s.id, s.estado, s.abierta, j.id AS juego_pk, j.codigo
         FROM sesiones_juego s
         JOIN juegos j ON j.id = s.juego_id
        WHERE s.id = $1 AND s.usuario_id = $2`,
      [sesionId, req.usuario.sub]
    );
    if (ses.rows.length === 0) throw Object.assign(new Error('Sesion no encontrada'), { status: 404 });
    if (!ses.rows[0].abierta) throw Object.assign(new Error('Sesion ya cerrada'), { status: 400 });

    let estado = ses.rows[0].estado;
    const juego = { id: ses.rows[0].juego_pk, codigo: ses.rows[0].codigo };

    if (accion === 'doblar') {
      // Cobrar la diferencia (apuesta extra) antes de aplicar la accion
      const apuestaActual = Number(estado.apuesta);
      await debitarApuesta(client, req.usuario.sub, await obtenerJuego('blackjack'), apuestaActual);
      estado = blackjack.doblar(estado);
    } else if (accion === 'pedir') {
      estado = blackjack.pedir(estado);
    } else {
      estado = blackjack.plantarse(estado);
    }

    await client.query(
      'UPDATE sesiones_juego SET estado = $1 WHERE id = $2',
      [estado, sesionId]
    );

    if (estado.terminada) {
      await cerrarSesionYPagar(client, req.usuario.sub, { id: sesionId, estado }, juego);
    }
    const saldo = await saldoActual(client, req.usuario.sub);
    await client.query('COMMIT');

    res.json({
      sesionId,
      jugador: estado.jugador,
      banca: estado.terminada ? estado.banca : [estado.banca[0], { oculta: true }],
      apuesta: estado.apuesta,
      terminada: estado.terminada,
      resultado: estado.resultado || null,
      retorno: estado.retorno || 0,
      totales: estado.terminada ? estado.totales : null,
      saldo
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
