/**
 * Tabela de elementos com massas atômicas.
 *
 * Fonte: IUPAC/CIAAW — Standard Atomic Weights (revisão 2021), valores
 * "convencionais" para elementos com intervalo de massa atômica
 * (ex.: H, C, N, O, Cl). Para elementos sem nuclídeos estáveis, usa-se o
 * número de massa do isótopo mais estável (marcado com `radioactive: true`),
 * que NÃO é uma massa atômica padrão.
 * https://www.ciaaw.org/atomic-weights.htm
 */
export interface ElementInfo {
  z: number;
  symbol: string;
  namePt: string;
  mass: number;
  radioactive?: boolean;
}

// [símbolo, nome em português, massa, radioativo sem massa padrão?]
const RAW: Array<[string, string, number, 1?]> = [
  ['H', 'Hidrogênio', 1.008], ['He', 'Hélio', 4.002602], ['Li', 'Lítio', 6.94],
  ['Be', 'Berílio', 9.0121831], ['B', 'Boro', 10.81], ['C', 'Carbono', 12.011],
  ['N', 'Nitrogênio', 14.007], ['O', 'Oxigênio', 15.999], ['F', 'Flúor', 18.998403162],
  ['Ne', 'Neônio', 20.1797], ['Na', 'Sódio', 22.98976928], ['Mg', 'Magnésio', 24.305],
  ['Al', 'Alumínio', 26.9815384], ['Si', 'Silício', 28.085], ['P', 'Fósforo', 30.973761998],
  ['S', 'Enxofre', 32.06], ['Cl', 'Cloro', 35.45], ['Ar', 'Argônio', 39.95],
  ['K', 'Potássio', 39.0983], ['Ca', 'Cálcio', 40.078], ['Sc', 'Escândio', 44.955907],
  ['Ti', 'Titânio', 47.867], ['V', 'Vanádio', 50.9415], ['Cr', 'Cromo', 51.9961],
  ['Mn', 'Manganês', 54.938043], ['Fe', 'Ferro', 55.845], ['Co', 'Cobalto', 58.933194],
  ['Ni', 'Níquel', 58.6934], ['Cu', 'Cobre', 63.546], ['Zn', 'Zinco', 65.38],
  ['Ga', 'Gálio', 69.723], ['Ge', 'Germânio', 72.63], ['As', 'Arsênio', 74.921595],
  ['Se', 'Selênio', 78.971], ['Br', 'Bromo', 79.904], ['Kr', 'Criptônio', 83.798],
  ['Rb', 'Rubídio', 85.4678], ['Sr', 'Estrôncio', 87.62], ['Y', 'Ítrio', 88.905838],
  ['Zr', 'Zircônio', 91.222], ['Nb', 'Nióbio', 92.90637], ['Mo', 'Molibdênio', 95.95],
  ['Tc', 'Tecnécio', 97, 1], ['Ru', 'Rutênio', 101.07], ['Rh', 'Ródio', 102.90549],
  ['Pd', 'Paládio', 106.42], ['Ag', 'Prata', 107.8682], ['Cd', 'Cádmio', 112.414],
  ['In', 'Índio', 114.818], ['Sn', 'Estanho', 118.71], ['Sb', 'Antimônio', 121.76],
  ['Te', 'Telúrio', 127.6], ['I', 'Iodo', 126.90447], ['Xe', 'Xenônio', 131.293],
  ['Cs', 'Césio', 132.90545196], ['Ba', 'Bário', 137.327], ['La', 'Lantânio', 138.90547],
  ['Ce', 'Cério', 140.116], ['Pr', 'Praseodímio', 140.90766], ['Nd', 'Neodímio', 144.242],
  ['Pm', 'Promécio', 145, 1], ['Sm', 'Samário', 150.36], ['Eu', 'Európio', 151.964],
  ['Gd', 'Gadolínio', 157.249], ['Tb', 'Térbio', 158.925354], ['Dy', 'Disprósio', 162.5],
  ['Ho', 'Hólmio', 164.930329], ['Er', 'Érbio', 167.259], ['Tm', 'Túlio', 168.934219],
  ['Yb', 'Itérbio', 173.045], ['Lu', 'Lutécio', 174.96669], ['Hf', 'Háfnio', 178.486],
  ['Ta', 'Tântalo', 180.94788], ['W', 'Tungstênio', 183.84], ['Re', 'Rênio', 186.207],
  ['Os', 'Ósmio', 190.23], ['Ir', 'Irídio', 192.217], ['Pt', 'Platina', 195.084],
  ['Au', 'Ouro', 196.96657], ['Hg', 'Mercúrio', 200.592], ['Tl', 'Tálio', 204.38],
  ['Pb', 'Chumbo', 207.2], ['Bi', 'Bismuto', 208.9804], ['Po', 'Polônio', 209, 1],
  ['At', 'Astato', 210, 1], ['Rn', 'Radônio', 222, 1], ['Fr', 'Frâncio', 223, 1],
  ['Ra', 'Rádio', 226, 1], ['Ac', 'Actínio', 227, 1], ['Th', 'Tório', 232.0377],
  ['Pa', 'Protactínio', 231.03588], ['U', 'Urânio', 238.02891], ['Np', 'Netúnio', 237, 1],
  ['Pu', 'Plutônio', 244, 1], ['Am', 'Amerício', 243, 1], ['Cm', 'Cúrio', 247, 1],
  ['Bk', 'Berquélio', 247, 1], ['Cf', 'Califórnio', 251, 1], ['Es', 'Einstênio', 252, 1],
  ['Fm', 'Férmio', 257, 1], ['Md', 'Mendelévio', 258, 1], ['No', 'Nobélio', 259, 1],
  ['Lr', 'Laurêncio', 262, 1], ['Rf', 'Rutherfórdio', 267, 1], ['Db', 'Dúbnio', 268, 1],
  ['Sg', 'Seabórgio', 269, 1], ['Bh', 'Bóhrio', 270, 1], ['Hs', 'Hássio', 269, 1],
  ['Mt', 'Meitnério', 278, 1], ['Ds', 'Darmstádtio', 281, 1], ['Rg', 'Roentgênio', 282, 1],
  ['Cn', 'Copernício', 285, 1], ['Nh', 'Nihônio', 286, 1], ['Fl', 'Fleróvio', 289, 1],
  ['Mc', 'Moscóvio', 290, 1], ['Lv', 'Livermório', 293, 1], ['Ts', 'Tenesso', 294, 1],
  ['Og', 'Oganessônio', 294, 1],
];

export const ELEMENTS: ElementInfo[] = RAW.map(([symbol, namePt, mass, rad], i) => ({
  z: i + 1,
  symbol,
  namePt,
  mass,
  ...(rad ? { radioactive: true } : {}),
}));

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

/** Busca por símbolo, sensível a maiúsculas (Co ≠ CO). Aceita também D/T como isótopos do H. */
export function getElement(symbol: string): ElementInfo | undefined {
  if (symbol === 'D') return { z: 1, symbol: 'D', namePt: 'Deutério', mass: 2.01410177812 };
  if (symbol === 'T') return { z: 1, symbol: 'T', namePt: 'Trítio', mass: 3.0160492779, radioactive: true };
  return BY_SYMBOL.get(symbol);
}

/** 3Dmol e arquivos SDF às vezes trazem símbolos em maiúsculas ("CL"). */
export function getElementLoose(symbol: string): ElementInfo | undefined {
  if (!symbol) return undefined;
  const norm = symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase();
  return getElement(norm);
}

export const ATOMIC_WEIGHTS_SOURCE =
  'IUPAC/CIAAW, Standard Atomic Weights 2021 (valores convencionais)';
