/**
 * Gerador das cenas do Refúgio das Aves.
 *
 * As imagens do site não são fotos: são paisagens vetoriais geradas aqui, no
 * espírito de uma prancha de guia de campo — borda de mata cheia sobre campo
 * aberto, bruma entre as camadas, aves cruzando o céu. Nenhuma água à vista,
 * porque não há nenhuma na propriedade.
 *
 * Cada cena nasce de uma semente (seed): o resultado é determinístico e rodar
 * de novo produz exatamente os mesmos arquivos.
 *
 *   node tools/gerar-cenas.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = resolve(RAIZ, 'assets/img');

/* ---------------------------------------------------------------- ruído --- */

/** PRNG determinístico (mulberry32). */
function semear(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor 1D com interpolação suave. */
function ruido1d(rand) {
  const tabela = Array.from({ length: 512 }, rand);
  const suave = (t) => t * t * (3 - 2 * t);
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = tabela[((i % 512) + 512) % 512];
    const b = tabela[(((i + 1) % 512) + 512) % 512];
    return a + (b - a) * suave(f);
  };
}

/** Soma de oitavas — dá à copa um perfil irregular, não de onda. */
function fbm(ruido, x, oitavas = 4, persistencia = 0.5) {
  let soma = 0;
  let amp = 1;
  let freq = 1;
  let norma = 0;
  for (let o = 0; o < oitavas; o += 1) {
    soma += ruido(x * freq) * amp;
    norma += amp;
    amp *= persistencia;
    freq *= 2;
  }
  return soma / norma;
}

/* ------------------------------------------------------------- geometria --- */

const n = (v) => Math.round(v * 10) / 10;
const entre = (rand, a, b) => a + rand() * (b - a);

/** Interpola dois hexadecimais. Usada para variar o tom de copa a copa. */
function misturar(a, b, t) {
  const canais = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = canais(a);
  const [r2, g2, b2] = canais(b);
  const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/**
 * Catmull-Rom convertida em Bézier cúbica. Serve tanto à borda da mata quanto
 * ao contorno de uma copa — em ambos os casos o que se quer é uma curva que
 * passe pelos pontos sem facetar.
 */
function suavizar(pontos, fechado = false) {
  const p = pontos;
  const pegar = fechado
    ? (i) => p[((i % p.length) + p.length) % p.length]
    : (i) => p[Math.min(p.length - 1, Math.max(0, i))];

  let d = `M${n(p[0][0])},${n(p[0][1])}`;
  const fim = fechado ? p.length : p.length - 1;
  for (let i = 0; i < fim; i += 1) {
    const p0 = pegar(i - 1);
    const p1 = pegar(i);
    const p2 = pegar(i + 1);
    const p3 = pegar(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])},${n(c1[1])} ${n(c2[0])},${n(c2[1])} ${n(p2[0])},${n(p2[1])}`;
  }
  return fechado ? `${d}Z` : d;
}

/** Altura de um perfil num x qualquer, por interpolação linear. */
function interpolar(pontos, x) {
  for (let i = 0; i < pontos.length - 1; i += 1) {
    const [x1, y1] = pontos[i];
    const [x2, y2] = pontos[i + 1];
    if (x >= x1 && x <= x2) {
      const t = (x - x1) / (x2 - x1 || 1);
      return y1 + (y2 - y1) * t;
    }
  }
  return pontos.at(-1)[1];
}

/* ------------------------------------------------------------- vegetação --- */

/** Copa arredondada: um contorno de elipse deformado por ruído angular. */
function copa({ ruido, cx, cy, rx, ry, rugosidade, fase, lados = 20 }) {
  const pontos = [];
  for (let i = 0; i < lados; i += 1) {
    const a = (i / lados) * Math.PI * 2;
    const r = 1 + (fbm(ruido, Math.cos(a) * 1.9 + Math.sin(a) * 1.3 + fase, 3) - 0.5) * rugosidade * 2;
    pontos.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return suavizar(pontos, true);
}

/** Emergente em cone — a araucária que sobra acima do dossel. */
function conifera({ x, base, h, cor }) {
  const w = h * 0.3;
  let d = '';
  for (let c = 0; c < 3; c += 1) {
    const topo = base - h + (h / 3) * c * 0.5;
    const meia = w * (0.5 + c * 0.3);
    const fundo = base - h + (h / 3) * (c + 1) * 0.98;
    d += `M${n(x)},${n(topo)}L${n(x + meia)},${n(fundo)}L${n(x - meia)},${n(fundo)}Z`;
  }
  d += `M${n(x - h * 0.02)},${n(base)}L${n(x + h * 0.02)},${n(base)}L${n(x + h * 0.015)},${n(base - h * 0.4)}L${n(x - h * 0.015)},${n(base - h * 0.4)}Z`;
  return `<path d="${d}" fill="${cor}"/>`;
}

/** Palmeira — a silhueta que diz "mata quente" numa linha só. */
function palmeira({ rand, x, base, h, cor }) {
  const topo = base - h;
  const curva = entre(rand, -h * 0.07, h * 0.07);
  let d = `M${n(x - h * 0.022)},${n(base)}Q${n(x + curva * 0.5 - h * 0.018)},${n(base - h * 0.5)} ${n(x + curva)},${n(topo)}`;
  d += `L${n(x + curva + h * 0.028)},${n(topo)}Q${n(x + curva * 0.5 + h * 0.026)},${n(base - h * 0.5)} ${n(x + h * 0.022)},${n(base)}Z`;
  let folhas = '';
  const quantidade = 7;
  for (let i = 0; i < quantidade; i += 1) {
    const a = Math.PI * (0.06 + (i / (quantidade - 1)) * 0.88);
    const comp = h * entre(rand, 0.3, 0.44);
    const px = x + curva - Math.cos(a) * comp;
    const py = topo - Math.sin(a) * comp * 0.62 + comp * 0.3;
    const mx = x + curva - Math.cos(a) * comp * 0.55;
    const my = topo - Math.sin(a) * comp * 0.72;
    folhas += `M${n(x + curva)},${n(topo)}Q${n(mx)},${n(my)} ${n(px)},${n(py)}`;
  }
  return `<path d="${d}" fill="${cor}"/><path d="${folhas}" fill="none" stroke="${cor}" stroke-width="${n(h * 0.045)}" stroke-linecap="round"/>`;
}

/**
 * Uma faixa de mata: a massa fechada até a base da imagem mais as copas que
 * sobram acima da linha. Devolve também o perfil, para apoiar cabanas nele.
 */
function faixaDeMata({
  rand, largura, altura, base, ondulacao, densidade,
  altMin, altMax, cor, corLuz, emergentes = 0, variacao = 0,
}) {
  const ruido = ruido1d(rand);
  const fase = rand() * 90;

  const perfil = [];
  for (let x = -80; x <= largura + 80; x += largura / 16) {
    perfil.push([x, base + (fbm(ruido, (x / largura) * 2.6 + fase, 3) - 0.5) * ondulacao]);
  }

  const massa = `<path d="${suavizar(perfil)}L${largura + 80},${altura + 80}L${-80},${altura + 80}Z" fill="${cor}"/>`;

  const copas = [];
  const passo = largura / densidade;
  for (let x = -passo; x <= largura + passo; x += passo) {
    const px = x + entre(rand, -passo * 0.45, passo * 0.45);
    const pBase = interpolar(perfil, px) + altMax * 0.12;
    const h = entre(rand, altMin, altMax);
    const sorte = rand();

    if (sorte < emergentes * 0.5) {
      copas.push(conifera({ x: px, base: pBase, h: h * 1.7, cor }));
    } else if (sorte < emergentes) {
      copas.push(palmeira({ rand, x: px, base: pBase, h: h * 1.9, cor }));
    } else {
      const rx = h * entre(rand, 0.42, 0.66);
      const ry = h * 0.5;
      const cy = pBase - h * 0.52;
      // A copa nunca é exatamente do tom da massa: a variação é o que dá volume
      // ao dossel sem precisar de sombra nem de contorno.
      const tom = variacao > 0
        ? misturar(cor, corLuz, entre(rand, -0.04, 0.2) * variacao)
        : cor;
      copas.push(`<path d="${copa({ ruido, cx: px, cy, rx, ry, rugosidade: 0.26, fase: fase + px })}" fill="${tom}"/>`);
    }
  }

  return { svg: massa + copas.join(''), perfil };
}

/* ----------------------------------------------------------------- campo --- */

/**
 * O campo aberto em primeiro plano. Devolve duas camadas: `fundo`, que vai
 * atrás da cabana, e `frente`, o capim alto que passa na frente dela — é essa
 * separação que impede a construção de parecer colada sobre a grama.
 */
function campoAberto({ id, rand, largura, altura, topo, cores, trilha, tufos }) {
  const ruido = ruido1d(rand);
  const fundo = [];
  const frente = [];

  const defs = `<linearGradient id="${id}-campo" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${cores[0]}"/>
    <stop offset=".45" stop-color="${cores[1]}"/>
    <stop offset="1" stop-color="${cores.at(-1)}"/>
  </linearGradient>`;

  const borda = (y, amplitude, fase) => {
    const pontos = [];
    for (let x = -80; x <= largura + 80; x += largura / 12) {
      pontos.push([x, y + (fbm(ruido, (x / largura) * 2.2 + fase, 3) - 0.5) * amplitude]);
    }
    return `${suavizar(pontos)}L${largura + 80},${altura + 80}L${-80},${altura + 80}Z`;
  };

  const profundidade = altura - topo;
  fundo.push(`<path d="${borda(topo, profundidade * 0.05, 17)}" fill="url(#${id}-campo)"/>`);

  /* Duas ondulações de relevo, translúcidas: sugerem que o campo desce sem
     cortá-lo em faixas. */
  fundo.push(`<path d="${borda(topo + profundidade * 0.34, profundidade * 0.12, 48)}" fill="${cores.at(-2)}" opacity=".45"/>`);
  fundo.push(`<path d="${borda(topo + profundidade * 0.68, profundidade * 0.1, 91)}" fill="${cores.at(-1)}" opacity=".5"/>`);

  /* Trilha ceifada subindo do primeiro plano até a borda da mata. */
  if (trilha) {
    const eixo = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const y = altura + 40 - t * (altura + 40 - topo * 1.01);
      const x = largura * (0.52 - t * 0.14) + (fbm(ruido, t * 3 + 61, 3) - 0.5) * largura * 0.1;
      eixo.push([x, y, largura * (0.07 * (1 - t) ** 1.7 + 0.004)]);
    }
    const esquerda = eixo.map(([x, y, m]) => [x - m, y]);
    const direita = [...eixo].reverse().map(([x, y, m]) => [x + m, y]);
    fundo.push(`<path d="${suavizar([...esquerda, ...direita], true)}" fill="${cores[0]}" opacity=".4"/>`);
  }

  /* Alguns arbustos soltos, onde o campo encontra a mata. */
  for (let i = 0; i < 11; i += 1) {
    const x = entre(rand, -20, largura + 20);
    const y = topo + profundidade * entre(rand, 0.05, 0.34);
    const r = profundidade * entre(rand, 0.018, 0.045);
    fundo.push(`<path d="${copa({ ruido, cx: x, cy: y, rx: r * 1.6, ry: r, rugosidade: 0.34, fase: i * 13 })}" fill="${misturar(cores.at(-1), '#000000', 0.16)}" opacity=".7"/>`);
  }

  /* Capim: mais alto, mais denso e mais escuro perto de quem olha. */
  for (let i = 0; i < tufos; i += 1) {
    const t = rand() ** 0.5;                        // viés para a base da imagem
    const y = topo + profundidade * (0.1 + t * 0.96);
    if (y > altura + 40) continue;
    const x = entre(rand, -40, largura + 40);
    const h = profundidade * (0.015 + t ** 2.2 * 0.16);
    const cor = misturar(
      cores[Math.min(cores.length - 1, Math.floor(t * cores.length))],
      '#000000',
      t * 0.22,
    );
    let d = '';
    for (let l = 0; l < 3; l += 1) {
      const inclina = entre(rand, -h * 0.5, h * 0.5);
      d += `M${n(x + (l - 1) * h * 0.18)},${n(y)}q${n(inclina * 0.35)},${n(-h * 0.55)} ${n(inclina)},${n(-h)}`;
    }
    const tufo = `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${n(0.9 + t * 2.6)}" stroke-linecap="round" opacity="${n(entre(rand, 0.4, 0.9))}"/>`;
    (t > 0.62 ? frente : fundo).push(tufo);
  }

  return { defs, fundo: fundo.join(''), frente: frente.join('') };
}

/* ------------------------------------------------------------------ aves --- */

/** Uma ave em voo: duas asas numa curva só, legível a 6 px de largura. */
function ave({ rand, x, y, escala: e, cor, opacidade }) {
  const bate = entre(rand, 0.6, 1.25);     // asas mais ou menos abertas
  const d = `M${n(x - 9 * e)},${n(y + 2.4 * e * bate)}`
    + `C${n(x - 5.2 * e)},${n(y - 4 * e * bate)} ${n(x - 2 * e)},${n(y - 3 * e * bate)} ${n(x)},${n(y)}`
    + `C${n(x + 2 * e)},${n(y - 3.2 * e * bate)} ${n(x + 5 * e)},${n(y - 4.2 * e * bate)} ${n(x + 9 * e)},${n(y + 2.2 * e * bate)}`;
  return `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${n(1.5 * e)}" stroke-linecap="round" opacity="${n(opacidade)}"/>`;
}

/** Um bando frouxo, em diagonal — nunca alinhado, nunca do mesmo tamanho. */
function bando({ rand, largura, altura, quantidade, cor, x0 = 0.12, y0 = 0.12 }) {
  const partes = [];
  for (let i = 0; i < quantidade; i += 1) {
    const t = i / Math.max(1, quantidade - 1);
    const e = entre(rand, 0.55, 1.5) * (1 - t * 0.35) * (largura / 1400);
    partes.push(ave({
      rand,
      x: largura * (x0 + t * 0.6) + entre(rand, -largura * 0.07, largura * 0.07),
      y: altura * (y0 + t * 0.2) + entre(rand, -altura * 0.06, altura * 0.06),
      escala: e * 1.6,
      cor,
      opacidade: entre(rand, 0.35, 0.8),
    }));
  }
  return partes.join('');
}

/* --------------------------------------------------------------- cabanas --- */

/**
 * As duas cabanas têm silhuetas diferentes de propósito: quem olha a página
 * inteira precisa distinguir uma da outra antes de ler o nome.
 */

/** Maritaca — duas águas, varanda avançada sobre o campo. */
function cabanaDuasAguas({ x, y, escala: s, corParede, corTelhado, corLuz }) {
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">
    <path d="M-38,0 L-38,-30 L0,-50 L38,-30 L38,0 Z" fill="${corParede}"/>
    <path d="M0,-50 L38,-30 L38,0 L14,0 L14,-38 Z" fill="#000" opacity=".2"/>
    <path d="M-46,-28 L0,-56 L46,-28 L40,-23 L0,-49 L-40,-23 Z" fill="${corTelhado}"/>
    <rect x="-28" y="-27" width="21" height="17" rx="1" fill="${corLuz}" opacity=".95"/>
    <rect x="6" y="-27" width="17" height="17" rx="1" fill="${corLuz}" opacity=".78"/>
    <path d="M-17.5,-27 L-17.5,-10 M-28,-18.5 L-7,-18.5" stroke="${corTelhado}" stroke-width="1.6" opacity=".5"/>
    <rect x="-6" y="-15" width="11" height="15" rx="1" fill="${corTelhado}" opacity=".8"/>
    <path d="M-56,0 L56,0 L56,4 L-56,4 Z" fill="${corTelhado}"/>
    <path d="M-56,4 L56,4 L56,7 L-56,7 Z" fill="#000" opacity=".3"/>
    <path d="M-52,4 L-52,13 M52,4 L52,13 M-20,4 L-20,11 M20,4 L20,11" stroke="${corTelhado}" stroke-width="2.4"/>
    <path d="M-56,-2 L-56,-13 M56,-2 L56,-13 M-56,-13 L56,-13" stroke="${corTelhado}" stroke-width="1.8" opacity=".55" fill="none"/>
  </g>`;
}

/** Tucano — água única, faixa de vidro voltada para a mata. */
function cabanaAguaUnica({ x, y, escala: s, corParede, corTelhado, corLuz }) {
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">
    <path d="M-48,0 L-48,-24 L48,-38 L48,0 Z" fill="${corParede}"/>
    <path d="M10,-32.5 L48,-38 L48,0 L10,0 Z" fill="#000" opacity=".18"/>
    <path d="M-55,-22 L55,-37 L55,-31 L-55,-16 Z" fill="${corTelhado}"/>
    <rect x="-42" y="-20.5" width="40" height="14" rx="1" fill="${corLuz}" opacity=".95" transform="rotate(-4.2 -22 -13.5)"/>
    <path d="M-28.5,-21 L-28.5,-6" stroke="${corTelhado}" stroke-width="1.5" opacity=".5"/>
    <rect x="16" y="-18" width="12" height="18" rx="1" fill="${corTelhado}" opacity=".82"/>
    <path d="M-62,0 L62,0 L62,4 L-62,4 Z" fill="${corTelhado}"/>
    <path d="M-62,4 L62,4 L62,7 L-62,7 Z" fill="#000" opacity=".3"/>
    <path d="M-58,4 L-58,12 M58,4 L58,12 M0,4 L0,10" stroke="${corTelhado}" stroke-width="2.4"/>
  </g>`;
}

/* -------------------------------------------------------------- paletas --- */

const PALETAS = {
  alvorada: {
    ceu: ['#FBE9CE', '#F2C9A0', '#D79F8A', '#95829C', '#4E5570'],
    astro: '#FFF0D6', brilho: '#F4BC8C',
    matas: ['#8B98A0', '#6F8189', '#53686D', '#3A5150', '#273F39', '#192D26'],
    campo: ['#B49E6B', '#98895C', '#7C7450', '#605D42'],
    luz: '#FFCD85', ave: '#2B2B36',
  },
  bruma: {
    ceu: ['#E6ECE8', '#CCD9D3', '#A9BDB6', '#86A197'],
    astro: '#FFFFFF', brilho: '#EEF4EF',
    matas: ['#AFC0B7', '#95AAA0', '#788F80', '#5C7664', '#435C4B', '#2E4435'],
    campo: ['#B8BB86', '#A2A872', '#899260', '#6E7B4D'],
    luz: '#FFD79A', ave: '#3A4A42',
  },
  dourada: {
    ceu: ['#FDE6B6', '#F5C382', '#E09758', '#AC6E50', '#5E4448'],
    astro: '#FFF3D4', brilho: '#F6BC6F',
    matas: ['#A0905F', '#7F7B4C', '#5F6541', '#454F32', '#2F3824', '#1E2518'],
    campo: ['#E2C076', '#C9A45F', '#AA874C', '#886A3C'],
    luz: '#FFD590', ave: '#332C22',
  },
  mata: {
    ceu: ['#D2E2DC', '#ABC8C0', '#81AAA0', '#59877A'],
    astro: '#F8FFF4', brilho: '#DDF0DA',
    matas: ['#7EA28F', '#648B7B', '#4C7464', '#385D4E', '#27463B', '#19322B'],
    campo: ['#A8BA72', '#92A760', '#7A8F4F', '#62753F'],
    luz: '#FFD08A', ave: '#22382F',
  },
  noite: {
    ceu: ['#1F2D40', '#182535', '#111C28', '#0A131B'],
    astro: '#EDF3F8', brilho: '#9FB6C9',
    matas: ['#2E4453', '#253846', '#1F2F3A', '#18252E', '#121C23', '#0C1419'],
    campo: ['#1D2B25', '#182520', '#141F1B', '#101916'],
    luz: '#FFC178', ave: '#0C1319',
  },
};

/* ------------------------------------------------------------------ cena --- */

function gerarCena({
  seed,
  largura = 1600,
  altura = 900,
  paleta = 'alvorada',
  camadas = 5,
  horizonte = 0.6,
  cabana = null,          // 'duas-aguas' | 'agua-unica' | null
  cabanaEm = { x: 0.32, y: 0.2, escala: 1 },  // posição dentro do campo, não da imagem
  aves = 7,
  estrelas = false,
  neblina = 0.6,
  trilha = false,
  astro = { x: 0.74, y: 0.24, r: 46 },
}) {
  const rand = semear(seed);
  const p = PALETAS[paleta];
  const id = `c${seed}`;
  const linhaCampo = altura * horizonte;

  const defs = [];
  const corpo = [];

  defs.push(`<linearGradient id="${id}-ceu" x1="0" y1="0" x2="0" y2="1">${
    p.ceu.map((c, i) => `<stop offset="${n(i / (p.ceu.length - 1))}" stop-color="${c}"/>`).join('')
  }</linearGradient>`);
  defs.push(`<radialGradient id="${id}-brilho" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="${p.brilho}" stop-opacity=".72"/>
    <stop offset=".45" stop-color="${p.brilho}" stop-opacity=".22"/>
    <stop offset="1" stop-color="${p.brilho}" stop-opacity="0"/>
  </radialGradient>`);
  defs.push(`<filter id="${id}-borrao" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="24"/></filter>`);
  defs.push(`<filter id="${id}-grao" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${seed}"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>`);

  corpo.push(`<rect width="${largura}" height="${altura}" fill="url(#${id}-ceu)"/>`);

  if (estrelas) {
    const pontos = [];
    for (let i = 0; i < 200; i += 1) {
      pontos.push(`<circle cx="${n(rand() * largura)}" cy="${n(rand() * linhaCampo * 0.92)}" r="${n(entre(rand, 0.5, 2))}" fill="#fff" opacity="${n(entre(rand, 0.15, 0.85))}"/>`);
    }
    corpo.push(pontos.join(''));
  }

  const ax = largura * astro.x;
  const ay = altura * astro.y;
  corpo.push(`<circle cx="${n(ax)}" cy="${n(ay)}" r="${n(astro.r * 4.4)}" fill="url(#${id}-brilho)"/>`);
  corpo.push(`<circle cx="${n(ax)}" cy="${n(ay)}" r="${n(astro.r)}" fill="${p.astro}" opacity=".9"/>`);

  /* Aves altas, atrás das camadas de mata — entram antes delas. */
  if (aves > 0) {
    corpo.push(bando({
      rand, largura, altura: linhaCampo,
      quantidade: Math.ceil(aves * 0.55),
      cor: p.ave,
      x0: 0.08, y0: 0.1,
    }));
  }

  /* Faixas de mata, da mais distante para a mais próxima. */
  const faixas = [];
  for (let i = 0; i < camadas; i += 1) {
    const t = i / Math.max(1, camadas - 1);
    const base = linhaCampo * (0.5 + t * 0.52);
    const faixa = faixaDeMata({
      rand,
      largura,
      altura,
      base,
      ondulacao: linhaCampo * (0.09 - t * 0.04),
      densidade: 26 - i * 3,
      altMin: linhaCampo * (0.05 + t * 0.06),
      altMax: linhaCampo * (0.1 + t * 0.14),
      cor: p.matas[i] ?? p.matas.at(-1),
      corLuz: p.matas[Math.max(0, i - 2)] ?? p.matas[0],
      emergentes: i >= camadas - 3 ? 0.13 : 0.04,
      variacao: i >= camadas - 3 ? 1 : 0.45,
    });
    faixas.push(faixa);
    corpo.push(faixa.svg);

    if (neblina > 0 && i < camadas - 1) {
      for (let f = 0; f < 2; f += 1) {
        const y = base + linhaCampo * (0.01 + f * 0.035);
        corpo.push(`<ellipse cx="${n(entre(rand, largura * 0.15, largura * 0.85))}" cy="${n(y)}" rx="${n(largura * entre(rand, 0.3, 0.62))}" ry="${n(linhaCampo * 0.035)}" fill="${p.ceu[Math.min(1 + i, p.ceu.length - 1)]}" opacity="${n(entre(rand, 0.16, 0.3) * neblina)}" filter="url(#${id}-borrao)"/>`);
      }
    }
  }

  /* Campo em primeiro plano, em duas camadas. */
  const campo = campoAberto({
    id, rand, largura, altura,
    topo: linhaCampo * 0.99,
    cores: p.campo,
    trilha,
    tufos: Math.round((largura / 1400) * 560),
  });
  defs.push(campo.defs);
  corpo.push(campo.fundo);

  /* A cabana fica no campo, a alguns passos da borda da mata — e o capim alto
     passa na frente dela. */
  if (cabana) {
    const profundidade = altura - linhaCampo;
    const comuns = {
      x: largura * cabanaEm.x,
      y: linhaCampo + profundidade * cabanaEm.y,
      escala: (profundidade / 300) * 1.15 * (cabanaEm.escala ?? 1),
      corParede: misturar(p.matas.at(-1), '#000000', 0.15),
      corTelhado: misturar(p.matas.at(-1), '#000000', 0.4),
      corLuz: p.luz,
    };
    corpo.push(cabana === 'agua-unica' ? cabanaAguaUnica(comuns) : cabanaDuasAguas(comuns));
  }

  corpo.push(campo.frente);

  /* Aves baixas, à frente de tudo. */
  if (aves > 0) {
    corpo.push(bando({
      rand, largura, altura: linhaCampo,
      quantidade: Math.floor(aves * 0.45),
      cor: p.ave,
      x0: 0.42, y0: 0.4,
    }));
  }

  corpo.push(`<rect width="${largura}" height="${altura}" filter="url(#${id}-grao)" opacity=".15" style="mix-blend-mode:overlay"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img">
<defs>${defs.join('')}</defs>
${corpo.join('\n')}
</svg>`;
}

/* ----------------------------------------------------------------- cenas --- */

/* Com as fotos da propriedade no ar, a única cena que a página ainda usa é a
   das aves — as demais continuam possíveis: basta acrescentar uma linha aqui
   com um nome, uma semente e uma paleta. */
const CENAS = [
  ['aves', { seed: 7720, largura: 1000, altura: 1250, paleta: 'bruma', camadas: 4, horizonte: 0.92, aves: 30, neblina: 0.8, astro: { x: 0.68, y: 0.2, r: 34 } }],
];

mkdirSync(SAIDA, { recursive: true });
for (const [nome, opcoes] of CENAS) {
  const svg = gerarCena(opcoes);
  writeFileSync(resolve(SAIDA, `${nome}.svg`), svg);
  console.log(`${nome}.svg  ${(svg.length / 1024).toFixed(1)} kB`);
}

/* ------------------------------------------------------------------ mapa --- */

/**
 * Mapa de trilhas, não cartografia: a clareira do refúgio cercada de mata,
 * as duas cabanas e os caminhos entre elas. Serve para situar, não para navegar.
 */
function gerarMapa({ seed = 4404, largura = 1000, altura = 1000, cor = '#4B5A46', corCampo = '#8E9A5E' } = {}) {
  const rand = semear(seed);
  const ruido = ruido1d(rand);
  const partes = [];

  /* A clareira: uma mancha fechada no centro, com a mata do lado de fora. */
  const clareira = [];
  const lados = 26;
  for (let i = 0; i < lados; i += 1) {
    const a = (i / lados) * Math.PI * 2;
    const r = largura * 0.26 * (1 + (fbm(ruido, Math.cos(a) * 2.1 + Math.sin(a) * 1.6 + 5, 4) - 0.5) * 0.55);
    clareira.push([largura * 0.48 + Math.cos(a) * r * 1.2, altura * 0.52 + Math.sin(a) * r * 0.95]);
  }
  const contorno = suavizar(clareira, true);
  partes.push(`<path d="${contorno}" fill="${corCampo}" opacity=".16"/>`);
  partes.push(`<path d="${contorno}" fill="none" stroke="${corCampo}" stroke-width="2" opacity=".65"/>`);

  /* Mata em volta: copas soltas, mais densas longe da clareira. */
  for (let i = 0; i < 620; i += 1) {
    const x = entre(rand, -10, largura + 10);
    const y = entre(rand, -10, altura + 10);
    const dx = (x - largura * 0.48) / (largura * 0.33);
    const dy = (y - altura * 0.52) / (altura * 0.27);
    // Fora da clareira a mata é cheia; na borda, rareia.
    if (Math.hypot(dx, dy) < entre(rand, 1.02, 1.22)) continue;
    const r = entre(rand, 8, 19);
    partes.push(`<path d="${copa({ ruido, cx: x, cy: y, rx: r, ry: r * 0.86, rugosidade: 0.3, fase: i * 7, lados: 10 })}" fill="none" stroke="${cor}" stroke-width="1.6" opacity="${n(entre(rand, 0.28, 0.7))}"/>`);
  }

  /* Estrada de acesso e trilhas internas. */
  const caminho = (pontos, largo, tracejado) =>
    `<path d="${suavizar(pontos)}" fill="none" stroke="${cor}" stroke-width="${largo}" stroke-linecap="round" stroke-linejoin="round"${tracejado ? ` stroke-dasharray="${tracejado}"` : ''} opacity=".8"/>`;

  partes.push(caminho([[-20, 900], [150, 848], [300, 776], [402, 672], [446, 578]], 5.5));
  partes.push(caminho([[446, 578], [530, 528], [608, 508]], 3, '9 9'));
  partes.push(caminho([[446, 578], [412, 492], [390, 414]], 3, '9 9'));
  partes.push(caminho([[608, 508], [700, 458], [772, 396], [838, 292]], 2.4, '5 10'));
  partes.push(caminho([[390, 414], [304, 356], [214, 330]], 2.4, '5 10'));

  /* Marcos: as duas cabanas e o estacionamento. */
  const marco = (x, y, tipo) => (tipo === 'carro'
    ? `<g transform="translate(${x},${y})"><circle r="11" fill="none" stroke="${cor}" stroke-width="2" opacity=".8"/><path d="M-4.5,1.5 L-3.2,-2.4 L3.2,-2.4 L4.5,1.5 Z M-4.5,1.5 L4.5,1.5 M-3.4,1.5 L-3.4,3.4 M3.4,1.5 L3.4,3.4" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linecap="round"/></g>`
    : `<g transform="translate(${x},${y})"><circle r="15" fill="none" stroke="${cor}" stroke-width="2.4"/><path d="M-7,5 L-7,-2 L0,-8 L7,-2 L7,5 Z" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-9.5,-1 L0,-10.5 L9.5,-1" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`);

  partes.push(marco(446, 578, 'carro'));
  partes.push(marco(608, 508, 'cabana'));
  partes.push(marco(390, 414, 'cabana'));

  /* Rosa dos ventos reduzida ao essencial. */
  partes.push(`<g transform="translate(878,878)" opacity=".7">
    <circle r="26" fill="none" stroke="${cor}" stroke-width="1.4"/>
    <path d="M0,-20 L5,0 L0,20 L-5,0 Z" fill="${cor}"/>
    <path d="M0,-20 L5,0 L-5,0 Z" fill="${cor}" opacity=".45"/>
    <text x="0" y="-31" fill="${cor}" font-family="system-ui, sans-serif" font-size="13" font-weight="600" text-anchor="middle">N</text>
  </g>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" aria-hidden="true">
${partes.join('\n')}
</svg>`;
}

writeFileSync(resolve(SAIDA, 'mapa.svg'), gerarMapa());
console.log('mapa.svg');
