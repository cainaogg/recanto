'use strict';
// Etapa 5: gráficos por semana, mês e ano. Carrega depois de habitos.js (usa somaDias e DIAS_SEMANA).
// Três medidas, três gráficos separados (cada uma tem a sua escala; nunca dois eixos no mesmo gráfico).
// Uma série por gráfico, então uma cor só (--barra, validada para claro e escuro) e sem legenda: o título diz o que é.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
let gTipo = 'semana', gDesloc = 0; // gDesloc: 0 = período atual, -1 = o anterior…

const br = iso => iso.slice(8) + '/' + iso.slice(5, 7);
const fmtMin = v => v < 60 ? `${v} min` : `${Math.floor(v / 60)} h` + (v % 60 ? ` ${v % 60} min` : '');
// Teto da escala: o menor valor "redondo" que cabe o máximo, com metade também redonda.
const tetoConta = v => { for (let p = 1; ; p *= 10) for (const m of [2, 4, 6, 8, 10]) if (m * p >= v) return m * p; };
const tetoMin = v => v <= 120 ? Math.ceil(v / 30) * 30 : Math.ceil(v / 120) * 120;

// Os baldes de um período. `chave` é o começo da data: o dia inteiro (semana, mês) ou 'AAAA-MM' (ano).
function periodo(tipo, desloc, hoje) {
  const d = meioDia(hoje);
  if (tipo === 'semana') {
    const seg = somaDias(hoje, -((d.getDay() + 6) % 7) + desloc * 7);
    const dias = DIAS_SEMANA.map((_, i) => somaDias(seg, i));
    return { rotulo: `${br(dias[0])} a ${br(dias[6])}`, baldes: dias.map((c, i) => ({ rotulo: DIAS_SEMANA[i], nome: `${DIAS_SEMANA[i]} ${br(c)}`, chave: c, atual: c === hoje })) };
  }
  if (tipo === 'mes') {
    const m = new Date(d.getFullYear(), d.getMonth() + desloc, 1, 12);
    const n = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), pre = diaDe(m).slice(0, 8);
    return {
      rotulo: m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      baldes: Array.from({ length: n }, (_, i) => {
        const c = pre + String(i + 1).padStart(2, '0');
        return { rotulo: i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '', nome: br(c), chave: c, atual: c === hoje };
      }),
    };
  }
  const ano = d.getFullYear() + desloc;
  return {
    rotulo: String(ano),
    baldes: MESES.map((nm, i) => {
      const c = `${ano}-${String(i + 1).padStart(2, '0')}`;
      return { rotulo: nm, nome: `${nm} de ${ano}`, chave: c, atual: hoje.startsWith(c) };
    }),
  };
}

const somaDe = (porDia, chave) => Object.entries(porDia).reduce((n, [d, v]) => d.startsWith(chave) ? n + v : n, 0);

function grafico(titulo, baldes, valores, fmt, teto) {
  const max = teto(Math.max(...valores, 1)), total = valores.reduce((a, b) => a + b, 0);
  const colunas = baldes.map((b, i) => {
    const barra = el('i');
    barra.style.height = valores[i] / max * 100 + '%';
    const col = el('div', { className: 'g-col' + (b.atual ? ' atual' : ''), tabIndex: 0 }, el('div', { className: 'g-pista' }, barra), el('span', { textContent: b.rotulo }));
    col.dataset.dica = `${b.nome} · ${fmt(valores[i])}`;
    col.setAttribute('aria-label', `${b.nome}: ${fmt(valores[i])}`);
    return col;
  });
  return el('section', { className: 'grafico' },
    el('header', {}, el('h3', { textContent: titulo }), el('b', { textContent: fmt(total) })),
    el('div', { className: 'g-area' },
      el('div', { className: 'g-eixo', ariaHidden: 'true' }, el('span', { textContent: fmt(max) }), el('span', { textContent: fmt(max / 2) }), el('span', { textContent: '0' })),
      el('div', { className: 'g-barras' + (baldes.length > 12 ? ' fino' : '') }, ...colunas)));
}

// Mapa de calor do ano: um quadradinho por dia, semanas em colunas (segunda em cima). Uma cor só, do claro ao cheio.
// Pontos do dia = tarefas concluídas + hábitos feitos + blocos de 25 min de foco; o nível (0 a 4) é relativo ao melhor dia do ano.
// ponytail: o valor exato de cada dia sai na dica do quadradinho (title); a tabela continua por mês.
const nivel = (v, max) => (v ? Math.ceil(v / max * 4) : 0);

function calor(ano, tarefas, foco, habitos, hoje) {
  const dias = [];
  for (const d = new Date(ano, 0, 1, 12); d.getFullYear() === ano; d.setDate(d.getDate() + 1)) {
    const iso = diaDe(d), t = tarefas[iso] || 0, f = foco[iso] || 0, h = habitos[iso] || 0;
    dias.push({ iso, t, f, h, pontos: t + h + Math.round(f / 25), semana: (d.getDay() + 6) % 7 });
  }
  const max = Math.max(...dias.map(d => d.pontos), 1), folga = dias[0].semana;
  const celulas = dias.map((d, i) => {
    const c = el('i', { title: `${br(d.iso)} · ${d.t} ${d.t === 1 ? 'tarefa' : 'tarefas'} · ${fmtMin(d.f)} de foco · ${d.h} ${d.h === 1 ? 'hábito' : 'hábitos'}` });
    c.style.gridArea = `${d.semana + 2} / ${Math.floor((i + folga) / 7) + 1}`;
    c.dataset.n = nivel(d.pontos, max);
    if (d.iso === hoje) c.dataset.hoje = '';
    if (d.iso > hoje) c.dataset.futuro = '';
    if (d.iso.endsWith('-01')) { // nome do mês em cima da coluna do dia 1
      const m = el('span', { textContent: MESES[+d.iso.slice(5, 7) - 1] });
      m.style.gridArea = `1 / ${Math.floor((i + folga) / 7) + 1} / auto / span 4`;
      return [m, c];
    }
    return [c];
  }).flat();
  const legenda = el('p', { className: 'calor-leg', ariaHidden: 'true' }, 'menos', ...[0, 1, 2, 3, 4].map(n => { const i = el('i'); i.dataset.n = n; return i; }), 'mais');
  const ativos = dias.filter(d => d.pontos).length;
  const mapa = el('div', { className: 'calor', role: 'img' }, ...celulas);
  mapa.setAttribute('aria-label', `Mapa de ${ano}: ${ativos} dias com registro. Os valores por mês estão na tabela.`);
  return el('section', { className: 'grafico' },
    el('header', {}, el('h3', { textContent: 'Dia a dia' }), el('b', { textContent: `${ativos} ${ativos === 1 ? 'dia' : 'dias'} com registro` })),
    el('div', { className: 'calor-rola' }, mapa), legenda);
}

// Chamado por desenhar() (app.js).
function desenharGraficos() {
  const naArea = x => !x.apagada && (estado.area === 'tudo' || x.area === estado.area);
  const tarefas = {}, foco = {}, habitos = {}, mais = (m, d, v) => { m[d] = (m[d] || 0) + v; };
  for (const t of estado.tarefas) if (naArea(t) && t.feitaEm) mais(tarefas, diaDe(t.feitaEm), 1);
  for (const s of estado.sessoes) if (naArea(s)) mais(foco, diaDe(s.inicio), s.min);
  for (const h of estado.habitos) if (naArea(h)) for (const [d, v] of Object.entries(h.dias)) if (v > 0) mais(habitos, d, 1);

  const p = periodo(gTipo, gDesloc, diaDe(agora()));
  const medidas = [
    ['Tarefas concluídas', p.baldes.map(b => somaDe(tarefas, b.chave)), String, tetoConta],
    ['Tempo de foco', p.baldes.map(b => somaDe(foco, b.chave)), fmtMin, tetoMin],
    ['Hábitos feitos', p.baldes.map(b => somaDe(habitos, b.chave)), String, tetoConta],
  ];
  const vazio = medidas.every(([, v]) => v.every(x => !x));
  const secoes = vazio ? [el('p', { className: 'vazio', textContent: 'Nada registrado neste período.' })]
    : medidas.map(m => grafico(m[0], p.baldes, m[1], m[2], m[3]));
  if (!vazio && gTipo === 'ano') secoes.push(calor(+p.rotulo, tarefas, foco, habitos, diaDe(agora())));
  if (!vazio) secoes.push(...melhorHorario(p, naArea));
  $('#graficos').replaceChildren(...secoes);
  $('#gRotulo').textContent = p.rotulo;
  $('#gDepois').disabled = gDesloc >= 0;
  for (const b of document.querySelectorAll('#gTipos button')) b.setAttribute('aria-pressed', b.dataset.tipo === gTipo);

  // os mesmos números em tabela (para ler valores exatos e para leitores de tela)
  const linha = (tag, celulas) => el('tr', {}, ...celulas.map(c => el(tag, { textContent: c })));
  $('#gTabela').replaceChildren(el('table', {},
    el('thead', {}, linha('th', ['Período', ...medidas.map(m => m[0])])),
    el('tbody', {}, ...p.baldes.map((b, i) => linha('td', [b.nome, ...medidas.map(m => m[2](m[1][i]))])))));
  $('#gDetalhe').hidden = vazio;

  $('#gTexto').value = textoPeriodo(p, naArea);
  $('#gTextoDet').hidden = vazio;
  // revisão da semana: o botão aparece no diário de sexta a domingo, até a revisão ser escrita
  const hoje = diaDe(agora());
  $('#revisaoSemana').hidden = ![5, 6, 0].includes(new Date().getDay()) || (estado.diario[hoje]?.texto || '').includes('Revisão da semana');
}

// O período em texto, para colar num e-mail ou relatório (e para a revisão da semana).
function textoPeriodo(p, naArea) {
  const noPeriodo = ts => p.baldes.some(b => diaDe(ts).startsWith(b.chave));
  const feitas = estado.tarefas.filter(t => naArea(t) && t.feitaEm && noPeriodo(t.feitaEm)).sort((a, b) => a.feitaEm - b.feitaEm);
  const sessoes = estado.sessoes.filter(s => naArea(s) && noPeriodo(s.inicio));
  const habitos = estado.habitos.filter(naArea).reduce((n, h) => n + Object.entries(h.dias).filter(([d, v]) => v > 0 && p.baldes.some(b => d.startsWith(b.chave))).length, 0);
  return [
    `Resumo de ${p.rotulo}`,
    `Tarefas concluídas: ${feitas.length}`,
    ...feitas.map(t => `- ${t.texto} (${br(diaDe(t.feitaEm))})`),
    `Foco: ${fmtMin(sessoes.reduce((n, s) => n + s.min, 0))} em ${sessoes.length} ${sessoes.length === 1 ? 'sessão' : 'sessões'}`,
    `Hábitos: ${habitos} marcações`,
  ].join('\n');
}

// Em que hora do dia mais se conclui tarefa e mais se foca, no período escolhido. Dois gráficos (um eixo cada).
function melhorHorario(p, naArea) {
  const noPeriodo = ts => p.baldes.some(b => diaDe(ts).startsWith(b.chave));
  const porHora = Array.from({ length: 24 }, () => [0, 0]);
  for (const t of estado.tarefas) if (naArea(t) && t.feitaEm && noPeriodo(t.feitaEm)) porHora[new Date(t.feitaEm).getHours()][0]++;
  for (const s of estado.sessoes) if (naArea(s) && noPeriodo(s.inicio)) porHora[new Date(s.inicio).getHours()][1] += s.min;
  const usadas = porHora.flatMap((v, h) => (v[0] || v[1] ? [h] : []));
  const de = Math.min(7, ...usadas), ate = Math.max(20, ...usadas);
  const horas = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const baldes = horas.map(h => ({ rotulo: h % 2 ? '' : h + 'h', nome: `${h}h às ${h + 1}h`, chave: '', atual: false }));
  const pico = i => { const m = Math.max(...horas.map(h => porHora[h][i])); return m ? horas.find(h => porHora[h][i] === m) + 'h' : ''; };
  const frase = [pico(0) && `conclui mais tarefas às ${pico(0)}`, pico(1) && `foca mais às ${pico(1)}`].filter(Boolean).join(' e ');
  return [el('h3', { className: 'sub', textContent: 'Seu melhor horário' }),
    el('p', { className: 'g-melhor', textContent: frase ? `Neste período você ${frase}.` : 'Ainda sem dados neste período.' }),
    grafico('Tarefas concluídas por hora', baldes, horas.map(h => porHora[h][0]), String, tetoConta),
    grafico('Foco por hora', baldes, horas.map(h => porHora[h][1]), fmtMin, tetoMin)];
}

const PERGUNTAS_SEMANA = ['O que deu certo esta semana?', 'O que travou, e por quê?', 'O que levo para a próxima semana?'];
const textoRevisao = hoje => ['Revisão da semana', ...PERGUNTAS_SEMANA.map(q => q + '\n'), textoPeriodo(periodo('semana', 0, hoje), x => !x.apagada)].join('\n');
$('#revisaoSemana').onclick = () => {
  const hoje = diaDe(agora()), antes = estado.diario[hoje]?.texto || '';
  escrever(hoje, (antes.trim() ? antes.trimEnd() + '\n\n' : '') + textoRevisao(hoje));
  salvar();
  desenhar();
  aviso('A revisão da semana está no diário de hoje.', 'Desfazer', () => { escrever(hoje, antes); salvar(); desenhar(); });
};

$('#gTipos').onclick = e => {
  if (!e.target.dataset.tipo) return;
  gTipo = e.target.dataset.tipo;
  gDesloc = 0;
  desenharGraficos();
};
$('#gCopiar').onclick = async () => {
  const c = $('#gTexto');
  try { await navigator.clipboard.writeText(c.value); } catch { c.select(); document.execCommand('copy'); } // sem permissão: o jeito antigo
  aviso('Resumo copiado.');
};
$('#gAntes').onclick = () => { gDesloc--; desenharGraficos(); };
$('#gDepois').onclick = () => { gDesloc++; desenharGraficos(); };

desenhar();

if (location.hash === '#teste') {
  const s = periodo('semana', -1, '2026-01-07'), m = periodo('mes', 1, '2026-01-31'), a = periodo('ano', 0, '2026-03-10');
  console.assert(s.baldes[0].chave === '2025-12-29' && s.baldes[6].chave === '2026-01-04' && !s.baldes.some(b => b.atual), 'periodo: semana anterior começa na segunda');
  console.assert(m.baldes.length === 28 && m.baldes[27].chave === '2026-02-28', 'periodo: mês seguinte a 31/01 é fevereiro, com 28 dias');
  console.assert(a.baldes.length === 12 && a.baldes[2].atual && a.baldes[2].chave === '2026-03', 'periodo: ano em meses');
  console.assert(somaDe({ '2026-03-01': 2, '2026-03-09': 3, '2026-04-01': 7 }, '2026-03') === 5, 'somaDe: soma o mês pelo começo da data');
  console.assert(tetoConta(1) === 2 && tetoConta(5) === 6 && tetoConta(23) === 40 && tetoMin(95) === 120 && tetoMin(130) === 240 && fmtMin(90) === '1 h 30 min', 'tetos e formato');
  console.assert(nivel(0, 8) === 0 && nivel(1, 8) === 1 && nivel(5, 8) === 3 && nivel(8, 8) === 4, 'nível do mapa de calor');
  const mapa = calor(2026, { '2026-01-01': 2 }, {}, {}, '2026-06-01').querySelectorAll('.calor i');
  console.assert(mapa.length === 365 && mapa[0].dataset.n === '4' && mapa[0].style.gridRowStart === '5', 'mapa: 365 dias, 01/01/2026 é quinta');
  const rev = textoRevisao('2026-11-20');
  console.assert(rev.startsWith('Revisão da semana\nO que deu certo') && rev.includes('Resumo de 16/11 a 22/11'), 'revisão da semana', rev);
  console.log('autoteste dos gráficos concluído');
}
