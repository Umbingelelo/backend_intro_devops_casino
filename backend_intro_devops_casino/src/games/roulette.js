// ============================================================
// Ruleta europea (0-36). Tipos de apuesta y pagos clasicos.
// ============================================================
const ROJOS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function colorDe(numero) {
  if (numero === 0) return 'verde';
  return ROJOS.has(numero) ? 'rojo' : 'negro';
}

function jugar(apuestas) {
  // apuestas = [{ tipo, valor, monto }]
  // tipos: 'numero','color','paridad','docena'
  const numero = Math.floor(Math.random() * 37); // 0..36
  const color = colorDe(numero);

  const resultados = apuestas.map((a) => {
    let gana = false;
    let multiplicador = 0;
    switch (a.tipo) {
      case 'numero':
        gana = (Number(a.valor) === numero);
        multiplicador = gana ? 36 : 0;     // pago 35:1 -> devuelve 36 (incluye apuesta)
        break;
      case 'color':
        gana = (a.valor === color && color !== 'verde');
        multiplicador = gana ? 2 : 0;      // 1:1
        break;
      case 'paridad':
        if (numero === 0) { gana = false; }
        else if (a.valor === 'par')   gana = (numero % 2 === 0);
        else if (a.valor === 'impar') gana = (numero % 2 === 1);
        multiplicador = gana ? 2 : 0;      // 1:1
        break;
      case 'docena':
        if (numero === 0) { gana = false; }
        else {
          const d = Math.ceil(numero / 12); // 1,2,3
          gana = (Number(a.valor) === d);
        }
        multiplicador = gana ? 3 : 0;      // 2:1
        break;
      default:
        gana = false;
    }
    const retorno = Number((Number(a.monto) * multiplicador).toFixed(2));
    return { ...a, gana, retorno };
  });

  const totalApostado = apuestas.reduce((s, a) => s + Number(a.monto), 0);
  const totalRetornado = resultados.reduce((s, r) => s + r.retorno, 0);

  return {
    numero,
    color,
    apuestas: resultados,
    totalApostado: Number(totalApostado.toFixed(2)),
    totalRetornado: Number(totalRetornado.toFixed(2)),
    neto: Number((totalRetornado - totalApostado).toFixed(2))
  };
}

module.exports = { jugar, colorDe };
