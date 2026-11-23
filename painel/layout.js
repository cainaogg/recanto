'use strict';
// Painel como janelas (pedido do usuário, 17/11/2026): arrastar pelo título, esticar pela borda direita, pela de baixo
// ou pelo canto. Nunca há sobreposição: quem é atingido desce; o vizinho colado ao lado encolhe ou cresce junto com a
// borda; quando não dá mais para encolher, desce; no fim tudo sobe para tapar buracos (gravidade).
// Grade de 12 colunas; altura em passos de 8 px. estado.layout = { itens: { id: {x, y, w, h} }, ocultos, semResumo }.
// Vale para este computador, como o tema (o importar não mexe). Em tela estreita (≤ 900 px) vira uma coluna, na ordem.
// Cartão novo no painel: uma linha em CARTOES (a chave é a classe c-… do cartão) e um lugar em PADRAO.
// Teclado: com o foco dentro de um cartão, Alt+setas move e Alt+Shift+setas estica.

const COLS = 12, PASSO = 8, VAO = 24, MINW = 3, MINH = 12;
const CARTOES = {
  fazer: 'A fazer', feito: 'Feito hoje', habitos: 'Hábitos', pomo: 'Relógio', lembretes: 'Lembretes', diario: 'Diário de hoje',
  agenda: 'Agenda', atalhos: 'Atalhos', mes: 'Calendário', metas: 'Metas', notas: 'Notas rápidas',
};
const RESUMO ={ tarefas: 'Tarefas', foco: 'Foco', habitos: 'Hábitos', lembrete: 'Lembrete' }; // blocos [data-resumo]
const PADRAO = {
  fazer: { x: 0, y: 0, w: 7, h: 64 }, pomo: { x: 7, y: 0, w: 5, h: 64 },
  agenda: { x: 0, y: 64, w: 4, h: 56 }, feito: { x: 4, y: 64, w: 4, h: 28 }, lembretes: { x: 8, y: 64, w: 4, h: 28 },
  metas: { x: 4, y: 92, w: 4, h: 28 }, atalhos: { x: 8, y: 92, w: 4, h: 28 },
  habitos: { x: 0, y: 120, w: 6, h: 40 }, mes: { x: 6, y: 120, w: 6, h: 56 }, diario: { x: 0, y: 160, w: 6, h: 36 }, notas: { x: 6, y: 176, w: 6, h: 24 },
};
let organizando = false, gesto = null;

const limite = (v, a, b) => Math.min(b, Math.max(a, v));
const inteiro = v => (Number.isFinite(+v) ? Math.round(+v) : 0);
const copia = L => Object.fromEntries(Object.entries(L).map(([id, r]) => [id, { ...r }]));
const bate = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const fundo = L => Math.max(0, ...Object.values(L).map(r => r.y + r.h));

// Gravidade: em ordem de cima para baixo, cada cartão sobe e vai para a esquerda até encostar (pedido do usuário: tapar
// buracos também de lado), e desce se estiver em cima de outro.
// `fixo` (o que está sendo arrastado) fica onde está e os outros se arrumam em volta.
function compactar(L, fixo) {
  const postos = fixo ? [L[fixo]] : [];
  const choca = r => postos.find(p => bate(r, p));
  for (const [id, r] of Object.entries(L).sort((p, q) => p[1].y - q[1].y || p[1].x - q[1].x)) {
    if (id === fixo) continue;
    for (let mexeu = true; mexeu;) {
      mexeu = false;
      while (r.y > 0 && !choca({ ...r, y: r.y - 1 })) { r.y--; mexeu = true; }
      while (r.x > 0 && !choca({ ...r, x: r.x - 1 })) { r.x--; mexeu = true; }
    }
    for (let c; (c = choca(r));) r.y = c.y + c.h;
    postos.push(r);
  }
  return L;
}

// Quem bate em `id` desce para baixo dele, em cascata.
function empurrar(L, id) {
  const a = L[id];
  for (const [o, b] of Object.entries(L).sort((p, q) => p[1].y - q[1].y)) {
    if (o !== id && bate(a, b)) { b.y = a.y + a.h; empurrar(L, o); }
  }
}

// Arrastar `id` para (x, y), a partir da foto S tirada no começo do gesto (não acumula erro).
// Passou da metade de um cartão: fica embaixo dele (descendo, conta a borda de baixo; subindo, a de cima). Caiu em cima
// de um cartão largo: ele encolhe para o lado que sobrar (assim se põe uma janela ao lado da outra). Sem lado: ele desce.
function moverPara(S, id, x, y) {
  const L = copia(S), a = L[id], outros = Object.entries(L).filter(([o]) => o !== id);
  a.x = limite(x, 0, COLS - a.w);
  a.y = Math.max(0, y);
  const passou = (o, b) => (S[id].y < S[o].y ? a.y + a.h : a.y) > b.y + b.h / 2;
  for (let i = 0, b; i < 20 && (b = outros.find(([o, b]) => bate(a, b) && passou(o, b))); i++) a.y = b[1].y + b[1].h;
  for (const [o, b] of outros.sort((p, q) => p[1].y - q[1].y)) {
    if (!bate(a, b)) continue;
    const esq = a.x - b.x, dir = b.x + b.w - (a.x + a.w);
    if (Math.max(esq, dir) >= MINW) {
      if (dir >= esq) { b.x = a.x + a.w; b.w = dir; } else b.w = esq;
    } else { b.y = a.y + a.h; empurrar(L, o); }
  }
  return compactar(L, id);
}

// Esticar `id` para largura w e altura h. O vizinho colado à direita, na mesma faixa de altura, anda junto com a borda
// (encolhe quando o cartão cresce, cresce quando ele diminui); se não couber, desce.
function esticar(S, id, w, h) {
  const L = copia(S), a = L[id], antes = S[id], borda = antes.x + antes.w;
  a.w = limite(w, MINW, COLS - a.x);
  a.h = Math.max(MINH, h);
  const nova = a.x + a.w;
  if (nova !== borda) {
    for (const [o, b] of Object.entries(L)) {
      if (o === id || b.x !== borda || b.y >= antes.y + antes.h || antes.y >= b.y + b.h) continue;
      const fim = b.x + b.w;
      if (fim - nova >= MINW) { b.x = nova; b.w = fim - nova; }
    }
  }
  empurrar(L, id);
  return compactar(L, id);
}

// Painel antigo (colunas de cartões) vira posições na grade, para ninguém perder o arranjo.
function deColunas(cols) {
  const w = Math.floor(COLS / cols.length), L = {};
  cols.forEach((c, i) => {
    let y = 0;
    for (const id of Array.isArray(c) ? c : []) {
      if (!CARTOES[id] || L[id]) continue;
      L[id] = { x: i * w, y, w: i === cols.length - 1 ? COLS - i * w : w, h: PADRAO[id].h };
      y += PADRAO[id].h;
    }
  });
  return L;
}

// Devolve um layout coerente: todo cartão visível tem lugar válido; o que faltar (novo ou que voltou de oculto) vai para o fim.
function normalizar(l) {
  const lista = (v, validos) => [...new Set((Array.isArray(v) ? v : []).filter(id => validos[id]))];
  const ocultos = lista(l?.ocultos, CARTOES);
  const dados = l?.itens && typeof l.itens === 'object' ? l.itens : Array.isArray(l?.cols) ? deColunas(l.cols) : copia(PADRAO);
  const itens = {};
  for (const id in CARTOES) {
    const p = dados[id];
    if (ocultos.includes(id) || !p) continue;
    const w = limite(inteiro(p.w), MINW, COLS);
    itens[id] = { x: limite(inteiro(p.x), 0, COLS - w), y: Math.max(0, inteiro(p.y)), w, h: Math.max(MINH, inteiro(p.h)) };
  }
  for (const id in CARTOES) if (!ocultos.includes(id) && !itens[id]) itens[id] = { ...PADRAO[id], x: 0, y: fundo(itens) };
  return { itens: compactar(itens), ocultos, semResumo: lista(l?.semResumo, RESUMO) };
}

function mudarLayout(fn) {
  fn(estado.layout);
  estado.layout = normalizar(estado.layout);
  salvar();
  aplicarLayout();
}

const areaDe = r => `${r.y + 1} / ${r.x + 1} / span ${r.h} / span ${r.w}`;
function posicionar(L) {
  for (const e of $('#colunas').querySelectorAll('.cartao[data-cartao], .moldura')) if (L[e.dataset.cartao]) e.style.gridArea = areaDe(L[e.dataset.cartao]);
}

function aplicarLayout() {
  const l = estado.layout = normalizar(estado.layout);
  for (const b of document.querySelectorAll('.org')) b.remove();
  // ordem no HTML = de cima para baixo: é a ordem do celular e a do Tab
  const ids = Object.keys(l.itens).sort((p, q) => l.itens[p].y - l.itens[q].y || l.itens[p].x - l.itens[q].x);
  const cartoes = ids.map(id => {
    const c = $('.c-' + id);
    c.hidden = false;
    c.dataset.cartao = id;
    const ocultar = el('button', { className: 'texto-btn mini', textContent: 'Ocultar' });
    ocultar.setAttribute('aria-label', 'Ocultar ' + CARTOES[id]);
    ocultar.onclick = () => mudarLayout(x => { x.ocultos.push(id); });
    c.prepend(el('div', { className: 'org' }, ocultar));
    return c;
  });
  // as alças de esticar ficam numa moldura por cima do cartão (dentro dele rolariam junto com o conteúdo)
  const molduras = ids.map(id => {
    const m = el('div', { className: 'moldura', ariaHidden: 'true' }, ...['d', 'b', 'c'].map(p => {
      const a = el('i', { title: p === 'd' ? 'Esticar para o lado' : p === 'b' ? 'Esticar para baixo' : 'Esticar' });
      a.dataset.puxa = p;
      return a;
    }));
    m.dataset.cartao = id;
    return m;
  });
  $('#colunas').replaceChildren(...cartoes, ...molduras, el('div', { hidden: true }, ...l.ocultos.map(id => $('.c-' + id))));
  // recolocar um cartão no HTML reinicia a animação de entrada; ela só vale ao abrir a página
  if (aplicarLayout.feito) for (const c of cartoes) for (const a of c.getAnimations()) if (a.animationName) a.finish();
  aplicarLayout.feito = true;
  posicionar(l.itens);

  // barra do modo organizar
  document.documentElement.toggleAttribute('data-org', organizando);
  $('#orgBarra').hidden = !organizando;
  $('#organizar').setAttribute('aria-pressed', organizando);
  $('#orgOcultos').replaceChildren(...l.ocultos.map(id => {
    const b = el('button', { className: 'texto-btn mini', textContent: 'Mostrar ' + CARTOES[id] });
    b.onclick = () => mudarLayout(x => { x.ocultos = x.ocultos.filter(o => o !== id); });
    return b;
  }));
  // números do resumo: cada um pode sair
  $('#orgResumo').replaceChildren(...Object.entries(RESUMO).map(([id, nome]) => {
    const fora = l.semResumo.includes(id);
    $(`[data-resumo="${id}"]`).hidden = fora;
    const b = el('button', { textContent: nome }, fora ? '' : ic('check'));
    b.setAttribute('aria-pressed', !fora);
    b.onclick = () => mudarLayout(x => { x.semResumo = fora ? x.semResumo.filter(o => o !== id) : [...x.semResumo, id]; });
    return b;
  }));
  $('.resumo').hidden = l.semResumo.length === Object.keys(RESUMO).length;
  desenharPaineis();
}

/* ---------- arrastar e esticar com o mouse ---------- */
const caixa = $('#colunas');
const passoX = () => (caixa.getBoundingClientRect().width + VAO) / COLS;
// O cartão se arrasta por qualquer parte que não seja um controle (pedido do usuário). Tarefas ficam de fora: têm o seu
// próprio arrastar (a pega) e o clique nelas edita o texto.
const CONTROLES = 'button, input, select, textarea, a, label, summary, [contenteditable="true"], .seg, .tarefa, .q-item, .mes, .habitos, .agenda';
let talvez = null; // apertou num cartão; só vira arrastar depois de andar uns pixels (senão é um clique comum)

caixa.addEventListener('pointerdown', e => {
  if (e.button !== 0 || matchMedia('(max-width: 900px)').matches) return;
  const puxa = e.target.closest('[data-puxa]'), c = e.target.closest('#colunas > .cartao');
  if (puxa) return comecar(e, puxa.parentElement.dataset.cartao, puxa.dataset.puxa);
  if (!c || e.target.closest(CONTROLES) || e.offsetX >= e.target.clientWidth && e.target === c) return; // a última: a barra de rolagem
  talvez = { e, id: c.dataset.cartao };
});
function comecar(e, id, tipo) {
  talvez = null;
  e.preventDefault?.();
  getSelection().removeAllRanges();
  try { caixa.setPointerCapture(e.pointerId); } catch { /* evento sintético (autoteste) */ }
  gesto = { id, tipo, x0: e.clientX, y0: e.clientY, sy0: scrollY, S: copia(estado.layout.itens), L: null, c: $('.c-' + id), ultimo: e };
  requestAnimationFrame(rolar);
  gesto.c.classList.add('no-ar');
  document.documentElement.dataset.gesto = tipo;
  if (tipo === 'mover') caixa.append(gesto.alvo = el('div', { className: 'alvo' }));
}
caixa.addEventListener('pointermove', e => {
  if (talvez && Math.hypot(e.clientX - talvez.e.clientX, e.clientY - talvez.e.clientY) > 6) comecar(talvez.e, talvez.id, 'mover');
  if (!gesto) return;
  gesto.ultimo = e;
  acompanhar(e);
});
// Perto da borda de cima ou de baixo da janela, a página rola sozinha enquanto se arrasta (mais rápido quanto mais perto).
function rolar() {
  const g = gesto, m = 70;
  if (!g) return;
  const y = g.ultimo.clientY, v = y < m ? y - m : y > innerHeight - m ? y - (innerHeight - m) : 0;
  if (v) { scrollBy(0, v / 3); acompanhar(g.ultimo); }
  requestAnimationFrame(rolar);
}
function acompanhar(e) {
  const g = gesto;
  // dy conta também o quanto a página rolou desde o começo: o cartão anda junto com a rolagem
  const px = passoX(), dx = e.clientX - g.x0, dy = e.clientY - g.y0 + scrollY - g.sy0, s = g.S[g.id];
  const cx = Math.round(dx / px), cy = Math.round(dy / PASSO);
  if (g.tipo === 'mover') {
    g.L = moverPara(g.S, g.id, s.x + cx, s.y + cy);
    const a = g.L[g.id];
    g.alvo.style.gridArea = areaDe(a);
    g.c.style.translate = `${dx - (a.x - s.x) * px}px ${dy - (a.y - s.y) * PASSO}px`; // o cartão segue o mouse; a moldura tracejada mostra onde cai
  } else {
    g.L = esticar(g.S, g.id, s.w + (g.tipo === 'b' ? 0 : cx), s.h + (g.tipo === 'd' ? 0 : cy));
  }
  posicionar(g.L);
}
function soltar() {
  talvez = null;
  const g = gesto;
  if (!g) return;
  gesto = null;
  g.c.classList.remove('no-ar');
  g.c.style.translate = '';
  g.alvo?.remove();
  delete document.documentElement.dataset.gesto;
  if (g.L) { estado.layout.itens = compactar(g.L); salvar(); }
  aplicarLayout();
}
caixa.addEventListener('pointerup', soltar);
caixa.addEventListener('pointercancel', soltar);

// Alt+setas move; Alt+Shift+setas estica (para quem usa teclado)
function pelaTecla(S, id, tecla, esticando) {
  const a = S[id], d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[tecla];
  if (esticando) return esticar(S, id, a.w + d[0], a.h + d[1] * 4);
  if (d[0]) return moverPara(S, id, a.x + d[0], a.y);
  // para cima ou para baixo: passa pelo vizinho mais próximo nas mesmas colunas
  const viz = Object.entries(S).filter(([o, b]) => o !== id && b.x < a.x + a.w && a.x < b.x + b.w && (d[1] < 0 ? b.y < a.y : b.y > a.y))
    .sort((p, q) => d[1] * (p[1].y - q[1].y))[0]?.[1];
  return viz ? moverPara(S, id, a.x, d[1] < 0 ? viz.y : viz.y + Math.floor(viz.h / 2) + 1) : null;
}
caixa.addEventListener('keydown', e => {
  const id = e.target.closest('#colunas > .cartao')?.dataset.cartao;
  if (!e.altKey || !id || !e.key.startsWith('Arrow') || matchMedia('(max-width: 900px)').matches) return;
  e.preventDefault();
  const L = pelaTecla(estado.layout.itens, id, e.key, e.shiftKey);
  if (!L) return;
  const foco = document.activeElement;
  estado.layout.itens = compactar(L);
  salvar();
  aplicarLayout();
  foco?.focus();
});

// Garante que um cartão apareça no painel aberto (usado pelo atalho global das notas, app.js).
function mostrarCartao(id) {
  if (estado.layout.ocultos.includes(id)) mudarLayout(x => { x.ocultos = x.ocultos.filter(o => o !== id); });
}

/* ---------- cinco painéis ---------- */
// estado.layout é o painel em uso; os outros ficam em estado.layouts[0..4] e estado.painel diz qual está aberto.
// Painel nunca usado começa no arranjo padrão. Ocultos e números do resumo também são de cada painel.
function trocarPainel(n) {
  const atualN = estado.painel ?? 0;
  if (n === atualN || n < 0 || n > 4) return;
  estado.layouts = Array.isArray(estado.layouts) ? estado.layouts : [];
  estado.layouts[atualN] = estado.layout;
  estado.painel = n;
  estado.layout = estado.layouts[n] ?? null;
  salvar();
  mostrarVista('painel');
  aplicarLayout();
}
function desenharPaineis() {
  for (const b of document.querySelectorAll('#paineis button')) {
    b.setAttribute('aria-pressed', +b.dataset.painel === (estado.painel ?? 0));
    b.setAttribute('aria-label', 'Painel ' + (+b.dataset.painel + 1));
  }
}
$('#paineis').onclick = e => { if (e.target.dataset.painel) trocarPainel(+e.target.dataset.painel); };
// 1 a 5 sozinhos também trocam (pedido do usuário), mas só fora de campos de texto, para não atrapalhar quem digita.
// Alt+1 a Alt+5 vale em qualquer lugar.
document.addEventListener('keydown', e => {
  if (!/^[1-5]$/.test(e.key) || e.ctrlKey || e.metaKey) return;
  const emCampo = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if (!e.altKey && (emCampo || e.shiftKey)) return;
  e.preventDefault();
  trocarPainel(+e.key - 1);
});

$('#organizar').onclick = () => {
  organizando = !organizando;
  if (organizando) mostrarVista('painel');
  aplicarLayout();
};
$('#orgConcluir').onclick = () => { organizando = false; aplicarLayout(); };
$('#orgPadrao').onclick = () => {
  const antes = estado.layout;
  mudarLayout(x => { delete x.itens; delete x.cols; });
  aviso('Painel de volta ao padrão.', 'Desfazer', () => { estado.layout = antes; salvar(); aplicarLayout(); });
};
// sair do painel encerra o modo organizar
$('#vistas').addEventListener('click', e => {
  if (organizando && e.target.dataset.ir && e.target.dataset.ir !== 'painel') { organizando = false; aplicarLayout(); }
});

$('#recolher').onclick = () => {
  estado.ladoMini = !estado.ladoMini;
  salvar();
  aplicarTema(estado); // temas.js: põe data-mini no <html>
};
window.addEventListener('storage', () => setTimeout(() => { if (!gesto) aplicarLayout(); })); // outra aba reorganizou

aplicarLayout();

/* ---------- autoteste ---------- */
if (location.hash === '#teste') {
  const txt = L => Object.entries(L).map(([id, r]) => `${id}:${r.x},${r.y},${r.w},${r.h}`).sort().join(' ');
  const semChoque = L => Object.values(L).every((a, i, t) => t.every((b, j) => i === j || !bate(a, b)));
  const p = normalizar(null);
  console.assert(Object.keys(p.itens).length === Object.keys(CARTOES).length && semChoque(p.itens), 'padrão completo e sem sobreposição');
  const sujo = normalizar({ itens: { fazer: { x: 20, y: -5, w: 1, h: 2 }, pomo: { x: 0, y: 0, w: 12, h: 20 }, xx: {} }, ocultos: ['feito', 'yy'], semResumo: ['foco', 'zz'] });
  console.assert(semChoque(sujo.itens) && !sujo.itens.feito && sujo.itens.fazer.w === MINW && sujo.semResumo.join() === 'foco', 'normalizar limpa', sujo);
  const velho = normalizar({ n: 2, cols: [['fazer', 'feito'], ['pomo']] });
  console.assert(velho.itens.pomo.x === 6 && velho.itens.feito.y === PADRAO.fazer.h && semChoque(velho.itens), 'painel de colunas antigo é convertido', velho);
  const S = { a: { x: 0, y: 0, w: 6, h: 20 }, b: { x: 6, y: 0, w: 6, h: 20 } };
  console.assert(txt(esticar(S, 'a', 8, 20)) === 'a:0,0,8,20 b:8,0,4,20', 'esticar: o vizinho encolhe');
  console.assert(txt(esticar(S, 'a', 4, 20)) === 'a:0,0,4,20 b:4,0,8,20', 'diminuir: o vizinho cresce');
  console.assert(txt(esticar(S, 'a', 12, 20)) === 'a:0,0,12,20 b:0,20,6,20', 'largura toda: o vizinho desce (e encosta à esquerda)');
  const T = { a: { x: 0, y: 0, w: 12, h: 20 }, b: { x: 0, y: 20, w: 12, h: 20 } };
  console.assert(txt(compactar(moverPara(T, 'b', 0, 0))) === 'a:0,20,12,20 b:0,0,12,20', 'arrastar para cima troca de lugar');
  console.assert(txt(compactar(moverPara(T, 'a', 0, 8))) === 'a:0,0,12,20 b:0,20,12,20', 'antes da metade não troca');
  console.assert(txt(compactar(moverPara(T, 'a', 0, 11))) === 'a:0,20,12,20 b:0,0,12,20', 'passou da metade: vai para baixo');
  const U = { a: { x: 0, y: 0, w: 12, h: 20 }, b: { x: 0, y: 20, w: 6, h: 20 } };
  console.assert(txt(compactar(moverPara(U, 'b', 6, 0))) === 'a:0,0,6,20 b:6,0,6,20', 'soltar em cima de um cartão largo: ficam lado a lado');
  console.assert(txt(compactar(pelaTecla(T, 'b', 'ArrowUp'))) === 'a:0,20,12,20 b:0,0,12,20' && txt(compactar(pelaTecla(T, 'a', 'ArrowDown'))) === 'a:0,20,12,20 b:0,0,12,20', 'teclado sobe e desce');
  console.assert(txt(compactar({ a: { x: 3, y: 5, w: 3, h: 10 }, b: { x: 9, y: 0, w: 3, h: 10 } })) === 'a:3,0,3,10 b:0,0,3,10' || txt(compactar({ a: { x: 3, y: 5, w: 3, h: 10 }, b: { x: 9, y: 0, w: 3, h: 10 } })) === 'a:0,0,3,10 b:3,0,3,10', 'buraco à esquerda é tapado');
  { // trocar de painel guarda o arranjo de cada um
    const guardado = { layout: estado.layout, layouts: estado.layouts, painel: estado.painel };
    const salvarReal = salvar; salvar = () => {};
    estado.layout = { itens: { fazer: { x: 0, y: 0, w: 12, h: 20 } }, ocultos: Object.keys(CARTOES).filter(id => id !== 'fazer') };
    estado.painel = 0; estado.layouts = [];
    trocarPainel(2);
    const novo = Object.keys(estado.layout.itens).length;
    trocarPainel(0);
    console.assert(novo === Object.keys(CARTOES).length && estado.layout.itens.fazer.w === 12 && estado.layouts[2], 'painéis: cada um com o seu arranjo');
    Object.assign(estado, guardado); salvar = salvarReal; aplicarLayout();
  }
  console.log('autoteste do layout concluído');
}
