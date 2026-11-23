'use strict';
// Dashboard — etapa 1: tarefas, captura rápida, histórico do dia, exportar/importar.
// Sem rede, sem build. Dados em localStorage (chave CHAVE).

const CHAVE = 'recanto';
const $ = s => document.querySelector(s);
const agora = () => Date.now();
const diaDe = ts => { const d = new Date(ts); return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-'); };
const meioDia = iso => new Date(iso + 'T12:00');

let estado = carregar();
let diaVisto = diaDe(agora());
let novaId = null;

function padrao() {
  return {
    tarefas: [], sessoes: [], lembretes: [], habitos: [], diario: {}, agenda: [], atalhos: [], metas: [], projetos: [], area: 'tudo', ultimaArea: 'trabalho',
    pomo: { foco: 25, curta: 5, longa: 30, ciclos: 2 }, timerMin: 10, volume: 0.6, relogio: { modo: 'pomo' },
  };
}

function carregar() {
  const bruto = localStorage.getItem(CHAVE);
  try {
    return Object.assign(padrao(), JSON.parse(bruto));
  } catch {
    localStorage.setItem(CHAVE + '-corrompido', bruto); // não perder o que havia
    return padrao();
  }
}

// Várias abas do dashboard abertas (cada nova aba abre uma): se outra aba gravou depois que esta leu, junta o que ela
// gravou antes de gravar por cima (senão uma aba antiga apagaria o que a outra acabou de criar). `_rev` conta as gravações.
// As listas juntam por id (vence a versão mais recente, `mod`); as preferências (tema, painel, relógio) ficam as desta aba.
function salvar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (guardado && (guardado._rev || 0) > (estado._rev || 0)) juntarDeOutraAba(estado, guardado);
    estado._rev = Math.max(estado._rev || 0, guardado?._rev || 0) + 1;
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch { aviso('Não foi possível salvar. Exporte os dados agora.'); }
}
function juntarDeOutraAba(nosso, deles) {
  for (const k of ['tarefas', 'sessoes', 'lembretes', 'agenda', 'atalhos', 'metas', 'projetos']) {
    if (Array.isArray(deles[k])) nosso[k] = mesclar(nosso[k] || [], deles[k].filter(x => x && typeof x.id === 'string'));
  }
  if (Array.isArray(deles.habitos) && typeof mesclarHabitos === 'function') nosso.habitos = mesclarHabitos(nosso.habitos, deles.habitos);
  if (deles.diario && typeof mesclarDiario === 'function') nosso.diario = mesclarDiario(nosso.diario, deles.diario);
  if ((deles.notas?.mod || 0) > (nosso.notas?.mod || 0)) nosso.notas = deles.notas;
  return nosso;
}

// Toda mudança numa tarefa passa por aqui: `mod` decide quem ganha ao mesclar.
function mudar(t, campos, redesenhar = true) {
  Object.assign(t, campos, { mod: agora() });
  salvar();
  if (redesenhar) desenhar();
}

// Junta duas listas pelo id; a versão mais recente (mod) de cada tarefa ganha.
// Apagar é só marcar `apagada`, senão a tarefa voltaria ao importar.
// ponytail: a ordem manual não é mesclada (fica a deste computador).
function mesclar(nossas, delas) {
  const porId = new Map(nossas.map(t => [t.id, t]));
  for (const t of delas) {
    const n = porId.get(t.id);
    if (!n || t.mod > n.mod) porId.set(t.id, t);
  }
  return [...porId.values()];
}

const tarefaValida = t => t && typeof t.id === 'string' && typeof t.texto === 'string'
  && typeof t.mod === 'number' && ['trabalho', 'pessoal'].includes(t.area);

/* ---------- desenho ---------- */

function el(tag, props = {}, ...filhos) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...filhos);
  return e;
}
function ic(nome) {
  const s = el('span', { className: 'ic' });
  s.innerHTML = `<svg aria-hidden="true"><use href="#i-${nome}"/></svg>`;
  return s;
}

function rotuloPrazo(data, hoje) {
  if (!data) return ['', ''];
  const br = data.slice(8) + '/' + data.slice(5, 7);
  if (data < hoje) return ['atrasada', 'atrasada · ' + br];
  if (data === hoje) return ['hoje', 'hoje'];
  return ['', br];
}

const PRIS = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const REPS = { dia: 'Todo dia', semana: 'Toda semana', mes: 'Todo mês' };
const proxima = (mapa, v) => [...Object.keys(mapa), ''][Object.keys(mapa).indexOf(v) + 1]; // anda em roda; depois da última, nenhuma
const proximaPri = p => proxima(PRIS, p);

// Próxima data de uma tarefa que se repete: anda de `rep` em `rep` a partir do prazo até passar de hoje.
// ponytail: "todo mês" num dia 31 escorrega para o começo do mês seguinte quando o mês é curto (regra do Date).
function proximaData(data, rep, hoje) {
  const d = meioDia(data);
  do {
    if (rep === 'mes') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (rep === 'semana' ? 7 : 1));
  } while (diaDe(d) <= hoje);
  return diaDe(d);
}

// Concluir: a tarefa que se repete deixa uma cópia pendente com a próxima data. A concluída perde a repetição,
// então desmarcar e marcar de novo não cria outra cópia.
function concluir(t) {
  const hoje = diaDe(agora());
  if (REPS[t.rep]) {
    estado.tarefas.splice(estado.tarefas.indexOf(t), 0, {
      ...t, id: agora().toString(36) + Math.random().toString(36).slice(2, 8), data: proximaData(t.data || hoje, t.rep, hoje),
      criadaEm: agora(), feitaEm: 0, dia3: '', espera: false, mod: agora(),
    });
  }
  mudar(t, { feitaEm: agora(), rep: '' });
}
const rotuloPomos = (focos, est) => (est ? `${focos}/${est}` : focos ? String(focos) : '');

function linha(t) {
  const feita = !!t.feitaEm;
  const li = el('li', { className: 'tarefa' + (feita ? ' feita' : '') + (t.id === novaId ? ' nova' : '') });
  li.dataset.id = t.id;

  const caixa = el('button', { className: 'caixa', title: feita ? 'Desmarcar' : 'Concluir' }, ic('check'));
  caixa.setAttribute('aria-pressed', feita);
  caixa.onclick = () => {
    if (feita) return mudar(t, { feitaEm: 0 });
    li.classList.add('concluindo');
    setTimeout(() => concluir(t), 420);
  };

  const texto = el('span', { className: 'texto', textContent: t.texto });
  if (!feita) {
    texto.contentEditable = 'true';
    texto.spellcheck = false;
    texto.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); texto.blur(); } };
    texto.onblur = () => {
      const v = texto.textContent.trim();
      texto.textContent = v || t.texto;
      if (v && v !== t.texto) mudar(t, { texto: v }, false); // sem redesenhar: não engolir o clique seguinte
    };
  }

  const area = el('button', {
    className: 'area', title: 'Trocar área', textContent: t.area === 'trabalho' ? 'Trabalho' : 'Pessoal',
    onclick: () => mudar(t, { area: t.area === 'trabalho' ? 'pessoal' : 'trabalho' }),
  });
  area.dataset.area = t.area;

  if (feita) {
    const hora = new Date(t.feitaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const focos = estado.sessoes.filter(s => !s.apagada && s.tarefaId === t.id).length;
    li.append(caixa, el('time', { textContent: hora }), texto);
    if (focos) li.append(el('span', { className: 'pomos', title: 'Focos feitos nesta tarefa' }, ic('relogio'), rotuloPomos(focos, t.est)));
    li.append(area);
    return li;
  }

  const pega = el('span', { className: 'pega', draggable: true, title: 'Arrastar' }, ic('pega'));
  const hoje = diaDe(agora());
  // "Três do dia": t.dia3 guarda o dia em que a estrela foi posta, então ela vence sozinha na virada do dia.
  const noDia = t.dia3 === hoje;
  const estrela = el('button', { className: 'estrela', title: noDia ? 'Tirar das três do dia' : 'Pôr nas três do dia' }, ic('estrela'));
  estrela.setAttribute('aria-pressed', noDia);
  estrela.onclick = () => {
    if (noDia) return mudar(t, { dia3: '' });
    if (estado.tarefas.filter(x => !x.apagada && x.dia3 === hoje).length >= 3) return aviso('Já há três tarefas do dia. Tire a estrela de uma para trocar.');
    mudar(t, { dia3: hoje });
  };
  // Prioridade: cada clique anda uma casa (sem → alta → média → baixa → sem). É só um marcador; a ordem continua manual.
  const pri = el('button', { className: 'pri', title: 'Prioridade' }, ic('bandeira'), PRIS[t.pri] || '');
  if (PRIS[t.pri]) pri.dataset.pri = t.pri;
  pri.onclick = () => mudar(t, { pri: proximaPri(t.pri) });
  // Pomodoros: feitos = sessões de foco com esta tarefa (tempo.js grava tarefaId); t.est = estimativa, de 0 a 8.
  const focos = estado.sessoes.filter(s => !s.apagada && s.tarefaId === t.id).length;
  const pomos = el('button', { className: 'pomos' }, ic('relogio'), rotuloPomos(focos, t.est));
  pomos.title = `${focos} ${focos === 1 ? 'foco feito' : 'focos feitos'}${t.est ? ` de ${t.est} estimados` : ''}. Clique para mudar a estimativa.`;
  if (focos || t.est) pomos.dataset.tem = '';
  if (t.est && focos > t.est) pomos.dataset.passou = '';
  pomos.onclick = () => mudar(t, { est: ((t.est || 0) + 1) % 9 });
  // Aguardando alguém: a tarefa desce para o bloco "Aguardando alguém" no fim do cartão.
  const espera = el('button', { className: 'selo', title: t.espera ? 'Não estou mais aguardando' : 'Marcar como aguardando alguém' }, ic('ampulheta'), t.espera ? 'Aguardando' : '');
  espera.setAttribute('aria-pressed', !!t.espera);
  if (t.espera) espera.dataset.tem = '';
  espera.onclick = () => mudar(t, { espera: !t.espera });
  // Repetição: sem → todo dia → toda semana → todo mês → sem. Vale ao concluir (concluir()).
  const rep = el('button', { className: 'selo', title: 'Repetir' }, ic('repetir'), REPS[t.rep] || '');
  if (REPS[t.rep]) rep.dataset.tem = '';
  rep.onclick = () => mudar(t, { rep: proxima(REPS, t.rep) });
  const [classe, rotulo] = rotuloPrazo(t.data, hoje);
  const data = el('input', { type: 'date', className: 'data-oculta', value: t.data || '', tabIndex: -1 });
  data.onchange = () => mudar(t, { data: data.value });
  const prazo = el('button', { className: 'prazo ' + classe, title: 'Prazo', onclick: () => data.showPicker() }, ic('cal'), rotulo);
  const apagar = el('button', { className: 'apagar', title: 'Apagar' }, ic('x'));
  apagar.onclick = () => {
    mudar(t, { apagada: true });
    aviso('Tarefa apagada.', 'Desfazer', () => mudar(t, { apagada: false }));
  };
  li.append(pega, caixa, texto, estrela, pri, pomos, espera, rep, area, prazo, data, apagar);
  return li;
}

// Anima um número até o novo valor.
function contar(e, alvo) {
  if (e._alvo === alvo) return;
  e._alvo = alvo;
  const de = +e.textContent || 0, t0 = performance.now();
  (function passo(t) {
    if (e._alvo !== alvo) return;
    const k = Math.min((t - t0) / 500, 1);
    e.textContent = Math.round(de + (alvo - de) * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(passo);
  })(t0);
}

// Distribui pílulas (posição x em %, largura L) em faixas para não se sobreporem.
function faixas(xs, L) {
  const fim = [];
  return xs.map(x => {
    let f = fim.findIndex(e => e <= x);
    if (f < 0) f = fim.length;
    fim[f] = x + L;
    return f;
  });
}

function linhaSessao(s) {
  const hora = new Date(s.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const area = el('span', { className: 'area', textContent: s.area === 'trabalho' ? 'Trabalho' : 'Pessoal' });
  area.dataset.area = s.area;
  return el('li', { className: 'tarefa feita sessao' }, el('time', { textContent: hora }),
    el('span', { className: 'texto', textContent: `Foco · ${s.min} min${s.texto ? ' · ' + s.texto : ''}` }), area);
}

const LARG = 22; // largura de cada pílula, em % da trilha
// itens: { feitaEm, texto, area, foco? } — tarefas concluídas e sessões de foco do dia.
function linhaDoTempo(feitas) {
  $('#tempo').hidden = !feitas.length;
  if (!feitas.length) return;
  const hora = t => { const d = new Date(t.feitaEm); return d.getHours() + d.getMinutes() / 60; };
  const ini = Math.min(8, ...feitas.map(t => Math.floor(hora(t))));
  const fim = Math.max(20, ...feitas.map(t => Math.floor(hora(t)) + 1));
  // O ponto da pílula marca a hora. Perto do fim da trilha ela vira: o ponto vai para a direita.
  const pontos = feitas.map(t => (hora(t) - ini) / (fim - ini) * 100);
  const xs = pontos.map(x => x > 100 - LARG ? x - LARG : x);
  const fs = faixas(xs, LARG + 1);
  $('#trilha').replaceChildren(...feitas.map((t, i) => {
    const hhmm = new Date(t.feitaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const p = el('li', { className: 'pilula' + (xs[i] < pontos[i] ? ' vira' : '') + (t.foco ? ' foco' : ''), title: `${hhmm} · ${t.texto}` }, el('span', { textContent: t.texto }));
    p.dataset.area = t.area;
    p.style.cssText = `left:${xs[i]}%;top:${fs[i] * 40}px;animation-delay:${i * 50}ms`;
    return p;
  }));
  $('#trilha').style.height = (Math.max(...fs) + 1) * 40 + 'px';
  $('#trilha').style.setProperty('--colunas', fim - ini);
  const horas = [];
  for (let h = ini; h <= fim; h++) {
    const s = el('span', { textContent: h + 'h' });
    s.style.left = (h - ini) / (fim - ini) * 100 + '%';
    horas.push(s);
  }
  $('#horas').replaceChildren(...horas);
}

function desenhar() {
  const hoje = diaDe(agora());
  const naArea = x => !x.apagada && (estado.area === 'tudo' || x.area === estado.area);
  const vis = estado.tarefas.filter(naArea);
  const pend = vis.filter(t => !t.feitaEm);
  const feitas = d => vis.filter(t => t.feitaEm && diaDe(t.feitaEm) === d).sort((a, b) => a.feitaEm - b.feitaEm);
  const sessoes = d => estado.sessoes.filter(s => naArea(s) && diaDe(s.inicio) === d);
  const minFoco = d => sessoes(d).reduce((n, s) => n + s.min, 0);
  const fh = feitas(hoje), fd = feitas(diaVisto);
  // Tudo o que aconteceu no dia visto, em ordem: tarefas concluídas e sessões de foco.
  const doDia = [
    ...fd.map(t => ({ quando: t.feitaEm, tarefa: t })),
    ...sessoes(diaVisto).map(s => ({ quando: s.inicio, sessao: s })),
  ].sort((a, b) => a.quando - b.quando);

  const tres = vis.filter(t => t.dia3 === hoje);
  $('#tresBloco').hidden = !tres.length;
  $('#tresConta').textContent = `${tres.filter(t => t.feitaEm).length} de ${tres.length} ${tres.length > 1 ? 'concluídas' : 'concluída'}`;
  $('#tres').replaceChildren(...pend.filter(t => t.dia3 === hoje).map(linha));
  const livres = pend.filter(t => t.dia3 !== hoje);
  $('#lista').replaceChildren(...livres.filter(t => !t.espera).map(linha));
  $('#espera').replaceChildren(...livres.filter(t => t.espera).map(linha));
  $('#esperaBloco').hidden = !livres.some(t => t.espera);
  $('#contagem').textContent = pend.length || '';
  $('#vazioLista').hidden = pend.length > 0;
  $('#feitoHoje').replaceChildren(...fh.map(linha));
  $('#contagemFeito').textContent = fh.length || '';
  $('#vazioFeito').hidden = fh.length > 0;

  const total = fh.length + pend.length;
  contar($('#heroiFeitas'), fh.length);
  $('#heroiTotal').textContent = total ? ' de ' + total : '';
  $('#heroiLeg').textContent = !total ? 'Nada na lista ainda.'
    : !pend.length ? 'Tudo concluído por hoje.'
    : `${fh.length === 1 ? 'concluída' : 'concluídas'} hoje · ${pend.length} a fazer`;
  const mf = minFoco(hoje), ns = sessoes(hoje).length;
  $('#kFoco').textContent = mf < 60 ? mf + ' min' : `${Math.floor(mf / 60)} h ${String(mf % 60).padStart(2, '0')}`;
  $('#kFocoLeg').textContent = ns ? `${ns} ${ns > 1 ? 'sessões' : 'sessão'}` : 'Nenhuma sessão ainda';
  $('#heroiBarra').style.width = (total ? fh.length / total * 100 : 0) + '%';
  const meta = estado.metaFoco ?? 4; // meta de focos do dia (Ajustes do relógio); 0 desliga
  $('#kFocoAnel').hidden = !meta;
  $('#kFocoAnel').style.setProperty('--p', meta ? Math.min(ns / meta, 1) : 0);
  $('#kFocoAnel').toggleAttribute('data-cheia', ns >= meta);
  $('#kFocoMeta').textContent = `${ns}/${meta}`;
  $('#kFocoAnel').title = `Meta de hoje: ${ns} de ${meta} focos`;

  linhaDoTempo(doDia.map(i => i.tarefa || { feitaEm: i.quando, texto: `Foco ${i.sessao.min} min`, area: i.sessao.area, foco: true }));
  $('#feitoDia').replaceChildren(...doDia.map(i => i.tarefa ? linha(i.tarefa) : linhaSessao(i.sessao)));
  $('#tituloDia').textContent = meioDia(diaVisto).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const resumo = [];
  if (fd.length) resumo.push(`${fd.length} ${fd.length > 1 ? 'tarefas concluídas' : 'tarefa concluída'}`);
  if (minFoco(diaVisto)) resumo.push(`${minFoco(diaVisto)} min de foco`);
  $('#resumoDia').textContent = resumo.join(' · ') || 'Nada registrado neste dia.';
  $('#dataDia').value = diaVisto;
  $('#diaHoje').hidden = diaVisto === hoje;

  for (const b of document.querySelectorAll('#areas button')) b.setAttribute('aria-pressed', b.dataset.area === estado.area);
  novaId = null;
  if (typeof desenharTempo === 'function') desenharTempo(pend); // tempo.js
  if (typeof desenharHabitos === 'function') desenharHabitos(); // habitos.js
  if (typeof desenharDiario === 'function') desenharDiario(); // diario.js
  if (typeof desenharGraficos === 'function') desenharGraficos(); // graficos.js
  if (typeof desenharAgenda === 'function') desenharAgenda(); // agenda.js
  if (typeof aplicarSons === 'function') aplicarSons(); // ambiente.js
}

function cabecalho() {
  const h = new Date().getHours();
  $('#saudacao').textContent = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('#hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function mostrarVista(v) {
  for (const s of document.querySelectorAll('[data-vista]')) s.hidden = s.dataset.vista !== v;
  for (const b of document.querySelectorAll('#vistas button')) b.setAttribute('aria-pressed', b.dataset.ir === v);
}

let tAviso;
function aviso(texto, rotulo, acao) {
  const a = $('#aviso');
  a.replaceChildren(texto);
  if (rotulo) a.append(el('button', { textContent: rotulo, onclick: () => { acao(); a.classList.remove('visivel'); } }));
  a.classList.add('visivel');
  clearTimeout(tAviso);
  tAviso = setTimeout(() => a.classList.remove('visivel'), 6000);
}

/* ---------- ações ---------- */

$('#captura').onsubmit = e => {
  e.preventDefault();
  const campo = $('#capturaTexto');
  const texto = campo.value.trim();
  if (!texto) return;
  const t = {
    id: agora().toString(36) + Math.random().toString(36).slice(2, 8),
    texto, area: estado.area === 'tudo' ? estado.ultimaArea : estado.area,
    data: '', criadaEm: agora(), feitaEm: 0, mod: agora(),
  };
  estado.tarefas.unshift(t);
  novaId = t.id;
  campo.value = '';
  salvar();
  desenhar();
};

$('#areas').onclick = e => {
  const a = e.target.dataset.area;
  if (!a) return;
  estado.area = a;
  if (a !== 'tudo') estado.ultimaArea = a;
  salvar();
  desenhar();
};

$('#vistas').onclick = e => { if (e.target.dataset.ir) mostrarVista(e.target.dataset.ir); };

function andarDia(n) {
  const d = meioDia(diaVisto);
  d.setDate(d.getDate() + n);
  diaVisto = diaDe(d);
  desenhar();
}
$('#diaAntes').onclick = () => andarDia(-1);
$('#diaDepois').onclick = () => andarDia(1);
$('#diaHoje').onclick = () => { diaVisto = diaDe(agora()); desenhar(); };
$('#dataDia').onchange = e => { if (e.target.value) { diaVisto = e.target.value; desenhar(); } };

// "/" (fora de um campo) leva à captura rápida.
document.addEventListener('keydown', e => {
  const emCampo = e.target.matches('input, textarea, [contenteditable="true"]');
  if (e.key === '/' && !emCampo) { e.preventDefault(); $('#capturaTexto').focus(); }
  if (e.key === 'Escape' && emCampo) e.target.blur();
});

/* arrastar para ordenar */
let arrastada = null;
const lista = $('#lista');
lista.addEventListener('dragstart', e => {
  if (!e.target.classList?.contains('pega')) return;
  arrastada = e.target.closest('.tarefa');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
  e.dataTransfer.setDragImage(arrastada, 12, 12);
  requestAnimationFrame(() => arrastada?.classList.add('arrastando'));
});
lista.addEventListener('dragover', e => {
  if (!arrastada) return;
  e.preventDefault();
  const alvo = e.target.closest('.tarefa');
  if (!alvo || alvo === arrastada) return;
  const r = alvo.getBoundingClientRect();
  alvo[e.clientY < r.top + r.height / 2 ? 'before' : 'after'](arrastada);
});
lista.addEventListener('dragend', () => {
  if (!arrastada) return;
  arrastada = null;
  // As tarefas visíveis trocam de lugar entre si, nas mesmas posições da lista completa.
  const ids = [...lista.children].map(li => li.dataset.id);
  const novas = ids.map(id => estado.tarefas.find(t => t.id === id));
  const pos = novas.map(t => estado.tarefas.indexOf(t)).sort((a, b) => a - b);
  pos.forEach((p, i) => { estado.tarefas[p] = novas[i]; });
  salvar();
  desenhar();
});

/* exportar / importar */
$('#exportar').onclick = () => {
  const a = el('a', {
    href: URL.createObjectURL(new Blob([JSON.stringify(estado, null, 1)], { type: 'application/json' })),
    download: `dashboard-${diaDe(agora())}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};
$('#importar').onclick = () => $('#arquivo').click();
$('#arquivo').onchange = async e => {
  const arq = e.target.files[0];
  e.target.value = '';
  if (!arq) return;
  let dados;
  try { dados = JSON.parse(await arq.text()); } catch { dados = null; }
  const registro = x => x && typeof x.id === 'string' && typeof x.mod === 'number';
  const sessoes = dados?.sessoes || [], lembretes = dados?.lembretes || [], habitos = dados?.habitos || [];
  const habitoValido = h => registro(h) && typeof h.nome === 'string' && h.dias && typeof h.dias === 'object'
    && Object.values(h.dias).every(v => typeof v === 'number');
  const diario = dados?.diario || {};
  const diarioValido = typeof diario === 'object' && !Array.isArray(diario)
    && Object.values(diario).every(p => p && typeof p.texto === 'string' && typeof p.mod === 'number');
  const agenda = dados?.agenda || [], atalhos = dados?.atalhos || [], metas = dados?.metas || [], projetos = dados?.projetos || [];
  const textos = (x, ...campos) => registro(x) && campos.every(c => typeof x[c] === 'string');
  if (!Array.isArray(agenda) || !agenda.every(b => textos(b, 'dia', 'hora', 'texto') && [b.min, b.aviso].every(v => v === undefined || typeof v === 'number'))
    || !Array.isArray(atalhos) || !atalhos.every(a => textos(a, 'nome', 'url')) // o endereço é conferido de novo ao desenhar (urlSegura)
    || !Array.isArray(metas) || !metas.every(m => textos(m, 'texto') && typeof m.alvo === 'number' && typeof m.feito === 'number')
    || !Array.isArray(projetos) || !projetos.every(p => textos(p, 'nome', 'fase'))
    || !diarioValido || !Array.isArray(habitos) || !habitos.every(habitoValido) ||!dados || !Array.isArray(dados.tarefas) || !dados.tarefas.every(tarefaValida)
    || !Array.isArray(sessoes) || !sessoes.every(s => registro(s) && typeof s.inicio === 'number' && typeof s.min === 'number')
    || !Array.isArray(lembretes) || !lembretes.every(l => registro(l) && typeof l.texto === 'string' && typeof l.quando === 'number')) {
    return aviso('Esse arquivo não é um backup do dashboard. Nada foi alterado.');
  }
  const antes = estado.tarefas.length;
  estado.tarefas = mesclar(estado.tarefas, dados.tarefas);
  estado.sessoes = mesclar(estado.sessoes, sessoes);
  estado.lembretes = mesclar(estado.lembretes, lembretes);
  estado.habitos = mesclarHabitos(estado.habitos, habitos); // habitos.js
  estado.diario = mesclarDiario(estado.diario, diario); // diario.js
  estado.agenda = mesclar(estado.agenda, agenda);
  estado.atalhos = mesclar(estado.atalhos, atalhos);
  estado.metas = mesclar(estado.metas, metas);
  estado.projetos = mesclar(estado.projetos, projetos);
  const n = dados.notas; // um rascunho só: vence o mais recente
  if (n && typeof n.texto === 'string' && typeof n.mod === 'number' && n.mod > (estado.notas?.mod || 0)) estado.notas = { texto: n.texto, mod: n.mod };
  salvar();
  desenhar();
  aviso(`Dados mesclados: ${estado.tarefas.length - antes} tarefas novas.`);
};

/* manter em dia: virada do dia e outra aba aberta */
// Ao voltar para a aba: se outra aba gravou enquanto esta estava parada (o navegador congela abas no fundo), relê.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  try { if ((JSON.parse(localStorage.getItem(CHAVE))?._rev || 0) > (estado._rev || 0)) estado = carregar(); } catch { /* fica o que há */ }
  cabecalho();
  desenhar();
});
window.addEventListener('storage', e => { if (e.key === CHAVE) { estado = carregar(); desenhar(); } });

cabecalho();
mostrarVista('painel');
desenhar();

// Atalhos globais da extensão (nova-aba/fundo.js): index.html#captura ou #notas põe o cursor no lugar certo.
// O fim do endereço é apagado em seguida, para o mesmo atalho funcionar de novo.
function acaoDoEndereco() {
  const acao = location.hash.slice(1);
  if (acao !== 'captura' && acao !== 'notas') return;
  history.replaceState(null, '', location.pathname + location.search);
  mostrarVista('painel');
  if (acao === 'captura') return $('#capturaTexto').focus();
  if (typeof mostrarCartao === 'function') mostrarCartao('notas'); // layout.js: se estiver oculto neste painel, volta
  const n = $('#notas');
  n.focus();
  n.setSelectionRange(n.value.length, n.value.length);
  $('.c-notas').scrollIntoView({ block: 'center' });
}
window.addEventListener('hashchange', acaoDoEndereco);
document.addEventListener('DOMContentLoaded', acaoDoEndereco); // depois de todos os scripts (o cartão de notas depende do layout)

// Autoteste: abra index.html#teste e veja o console.
if (location.hash === '#teste') {
  const a = { id: 'a', mod: 1, texto: 'velha' }, a2 = { id: 'a', mod: 2, texto: 'nova' }, b = { id: 'b', mod: 1 };
  const m = mesclar([a, b], [a2, { id: 'c', mod: 1 }]);
  console.assert(m.length === 3 && m[0].texto === 'nova' && m[1] === b, 'mesclar: mais recente ganha, ordem mantida');
  console.assert(mesclar([a2], [a])[0].texto === 'nova', 'mesclar: mais antiga não sobrescreve');
  console.assert(diaDe(new Date(2026, 0, 5, 23, 59)) === '2026-01-05', 'diaDe usa a data local');
  console.assert(rotuloPrazo('2026-01-04', '2026-01-05')[0] === 'atrasada' && rotuloPrazo('2026-01-05', '2026-01-05')[0] === 'hoje', 'rotuloPrazo');
  console.assert(faixas([0, 10, 30, 40], 23).join() === '0,1,0,1', 'faixas: pílulas próximas vão para faixas diferentes');
  console.assert(['', 'alta', 'media', 'baixa'].map(proximaPri).join() === 'alta,media,baixa,', 'prioridade anda em roda');
  console.assert(rotuloPomos(2, 4) === '2/4' && rotuloPomos(2) === '2' && rotuloPomos(0, 0) === '', 'rótulo dos pomodoros');
  console.assert(proximaData('2026-01-05', 'semana', '2026-01-20') === '2026-01-26' && proximaData('2026-01-05', 'dia', '2026-01-05') === '2026-01-06'
    && proximaData('2026-01-15', 'mes', '2026-01-15') === '2026-02-15' && proxima(REPS, 'mes') === '' && proxima(REPS) === 'dia', 'repetição: próxima data depois de hoje');
  { // duas abas: a antiga não apaga o bloco que a outra criou, e uma exclusão mais nova vale
    const velha = { agenda: [{ id: 'g1', mod: 1, texto: 'a' }], notas: { texto: 'velha', mod: 1 } };
    const outra = { agenda: [{ id: 'g1', mod: 1, texto: 'a' }, { id: 'g2', mod: 5, texto: 'novo' }], notas: { texto: 'nova', mod: 9 }, tarefas: [{ id: 't', mod: 7, apagada: true }] };
    const j = juntarDeOutraAba(velha, outra);
    console.assert(j.agenda.map(b => b.id).join() === 'g1,g2' && j.notas.texto === 'nova' && j.tarefas[0].apagada, 'salvar junta o que outra aba gravou', j);
  }
  console.log('autoteste concluído');
}
