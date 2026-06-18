// ============================================================
// Tragamonedas (slots) - 3 rodillos, 8 simbolos.
// Pago segun cantidad de simbolos iguales y simbolo.
// ============================================================
const SIMBOLOS = ['🍒','🍋','🔔','⭐','💎','7️⃣','🍀','🍇'];
//                 0    1    2    3    4    5    6    7

const PESOS = [22, 20, 18, 14, 10, 6, 6, 4]; // total 100

const PAGO_TRES_IGUALES = {
  '7️⃣': 50, '💎': 25, '⭐': 15, '🍀': 12,
  '🔔': 10, '🍇': 8, '🍋': 6, '🍒': 5
};
const PAGO_DOS_IGUALES = 1.5; // 1.5x la apuesta si hay dos iguales en cualquier posicion

function elegirSimbolo() {
  const total = PESOS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SIMBOLOS.length; i++) {
    r -= PESOS[i];
    if (r <= 0) return SIMBOLOS[i];
  }
  return SIMBOLOS[0];
}

function jugar(apuesta) {
  const rodillos = [elegirSimbolo(), elegirSimbolo(), elegirSimbolo()];
  let multiplicador = 0;
  let tipo = 'perdida';

  if (rodillos[0] === rodillos[1] && rodillos[1] === rodillos[2]) {
    multiplicador = PAGO_TRES_IGUALES[rodillos[0]] || 5;
    tipo = 'tres-iguales';
  } else if (
    rodillos[0] === rodillos[1] ||
    rodillos[1] === rodillos[2] ||
    rodillos[0] === rodillos[2]
  ) {
    multiplicador = PAGO_DOS_IGUALES;
    tipo = 'dos-iguales';
  }

  const premio = Number((apuesta * multiplicador).toFixed(2));
  return {
    rodillos,
    apuesta,
    premio,
    multiplicador,
    tipo,
    neto: Number((premio - apuesta).toFixed(2))
  };
}

module.exports = { jugar, SIMBOLOS };
