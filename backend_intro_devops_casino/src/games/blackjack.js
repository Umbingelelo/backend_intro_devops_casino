// ============================================================
// Blackjack contra la banca. Una mano por sesion.
// La banca pide hasta 17 (soft 17 -> se planta).
// ============================================================
const PALOS = ['♠','♥','♦','♣'];
const VALORES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function nuevoMazo() {
  const mazo = [];
  for (const p of PALOS) for (const v of VALORES) mazo.push({ valor: v, palo: p });
  // mezcla Fisher-Yates
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  return mazo;
}

function valorMano(cartas) {
  let total = 0, ases = 0;
  for (const c of cartas) {
    if (c.valor === 'A') { total += 11; ases++; }
    else if (['J','Q','K'].includes(c.valor)) total += 10;
    else total += Number(c.valor);
  }
  while (total > 21 && ases > 0) { total -= 10; ases--; }
  return total;
}

function esBlackjack(cartas) {
  return cartas.length === 2 && valorMano(cartas) === 21;
}

function nuevaMano(apuesta) {
  const mazo = nuevoMazo();
  const jugador = [mazo.pop(), mazo.pop()];
  const banca   = [mazo.pop(), mazo.pop()];
  return { mazo, jugador, banca, apuesta, terminada: false, accion: null };
}

function pedir(estado) {
  if (estado.terminada) return estado;
  estado.jugador.push(estado.mazo.pop());
  if (valorMano(estado.jugador) > 21) {
    return resolver(estado, 'pasarse');
  }
  return estado;
}

function plantarse(estado) {
  if (estado.terminada) return estado;
  // banca juega
  while (valorMano(estado.banca) < 17) {
    estado.banca.push(estado.mazo.pop());
  }
  return resolver(estado, 'plantar');
}

function doblar(estado) {
  if (estado.terminada || estado.jugador.length !== 2) return estado;
  estado.apuesta = Number((estado.apuesta * 2).toFixed(2));
  estado.jugador.push(estado.mazo.pop());
  if (valorMano(estado.jugador) > 21) return resolver(estado, 'pasarse');
  return plantarse(estado);
}

function resolver(estado, accion) {
  estado.terminada = true;
  estado.accion = accion;
  const j = valorMano(estado.jugador);
  const b = valorMano(estado.banca);
  let resultado, multiplicador;

  if (esBlackjack(estado.jugador) && !esBlackjack(estado.banca)) {
    resultado = 'blackjack'; multiplicador = 2.5;
  } else if (j > 21) {
    resultado = 'pierde'; multiplicador = 0;
  } else if (b > 21) {
    resultado = 'gana'; multiplicador = 2;
  } else if (j > b) {
    resultado = 'gana'; multiplicador = 2;
  } else if (j < b) {
    resultado = 'pierde'; multiplicador = 0;
  } else {
    resultado = 'empate'; multiplicador = 1;   // empate devuelve la apuesta
  }

  estado.resultado = resultado;
  estado.retorno = Number((estado.apuesta * multiplicador).toFixed(2));
  estado.totales = { jugador: j, banca: b };
  return estado;
}

module.exports = { nuevaMano, pedir, plantarse, doblar, valorMano };
