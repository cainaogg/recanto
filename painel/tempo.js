'use strict';
// Etapa 2: relógio (pomodoro, temporizador, cronômetro), som, modo foco e lembretes.
// Carrega depois de app.js e usa: estado, salvar, mudar, desenhar, aviso, el, ic, $, agora, diaDe.
//
// O relógio vive em estado.relogio (salvo), sempre calculado pela hora do sistema:
// abas em segundo plano atrasam o setInterval, mas não o Date.now(). Recarregar a página não perde nada.
//   { modo: 'pomo'|'timer'|'crono', rodando, fimEm, restante, inicioEm, fase, ciclo, tarefaId,
//     desde, decorrido (cronômetro), aviso: { texto, proximo } }

const CHAVE_SOM = CHAVE + '-som';
const MIN = 60000;
const NOME_FASE = { foco: 'Foco', curta: 'Pausa curta', longa: 'Pausa longa' };
const R = () => estado.relogio;
const duracao = fase => estado.pomo[fase] * MIN;
let emFoco = false;

function total() { const r = R(); return r.modo === 'timer' ? estado.timerMin * MIN : duracao(r.fase || 'foco'); }
function restante() { const r = R(); return r.rodando ? Math.max(0, r.fimEm - agora()) : r.restante ?? total(); }
function decorrido() { const r = R(); return (r.decorrido || 0) + (r.rodando ? agora() - r.desde : 0); }
const comecou = () => { const r = R(); return r.rodando || r.restante != null || !!r.decorrido || !!r.aviso; };

function fmt(ms, sobe) {
  const s = sobe ? Math.floor(ms / 1000) : Math.ceil(ms / 1000), p = n => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return (h ? h + ':' : '') + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60);
}

// Depois do foco vem pausa curta; depois do último foco, a longa; depois da longa, acabou.
function proximaFase(fase, ciclo, ciclos) {
  if (fase === 'foco') return { fase: ciclo < ciclos ? 'curta' : 'longa', ciclo };
  if (fase === 'curta') return { fase: 'foco', ciclo: ciclo + 1 };
  return null;
}

/* ---------- comandos ---------- */

function iniciar() {
  const r = R();
  if (r.modo === 'crono') r.desde = agora();
  else {
    if (r.modo === 'pomo' && !r.fase) { r.fase = 'foco'; r.ciclo = 1; }
    r.fimEm = agora() + restante();
    r.inicioEm ??= agora();
  }
  r.rodando = true;
  // o modo foco (tela cheia) só abre a pedido, clicando no relógio: iniciar não tira o resto da página da vista
  salvar();
  desenhar();
}

function pausar() {
  const r = R();
  if (r.modo === 'crono') r.decorrido = decorrido(); else r.restante = restante();
  r.rodando = false;
  salvar();
  desenhar();
}

// Guarda a sessão de foco no histórico (1 minuto ou mais). O id vem do início,
// então duas abas abertas não registram a mesma sessão duas vezes.
function registrarFoco() {
  const r = R();
  if (r.modo !== 'pomo' || r.fase !== 'foco' || !r.inicioEm) return;
  const min = Math.round((duracao('foco') - restante()) / MIN), id = 's' + r.inicioEm;
  if (min < 1 || estado.sessoes.some(s => s.id === id)) return;
  const t = estado.tarefas.find(t => t.id === r.tarefaId);
  estado.sessoes.push({
    id, inicio: r.inicioEm, fim: agora(), min, tarefaId: t?.id || '', texto: t?.texto || '',
    area: t?.area || (estado.area === 'tudo' ? estado.ultimaArea : estado.area), mod: agora(),
  });
}

const zerar = () => { estado.relogio = { modo: R().modo, tarefaId: R().tarefaId }; };

function parar() {
  registrarFoco();
  zerar();
  emFoco = false;
  salvar();
  desenhar();
}

function entrarFase(p) {
  if (!p) return parar();
  estado.relogio = { modo: 'pomo', tarefaId: R().tarefaId, fase: p.fase, ciclo: p.ciclo };
  iniciar();
}

function pular() {
  const r = R();
  if (r.modo !== 'pomo' || !r.fase) return;
  registrarFoco();
  entrarFase(proximaFase(r.fase, r.ciclo, estado.pomo.ciclos));
}

function fimDaFase() {
  const r = R();
  registrarFoco();
  const p = r.modo === 'pomo' ? proximaFase(r.fase, r.ciclo, estado.pomo.ciclos) : null;
  r.aviso = {
    proximo: p,
    texto: r.modo === 'timer' ? 'Temporizador terminou.'
      : r.fase === 'foco' ? `Foco terminado. Hora da ${NOME_FASE[p.fase].toLowerCase()}.`
      : r.fase === 'curta' ? 'Pausa terminada. Hora de voltar ao foco.'
      : 'Sessão de pomodoro completa.',
  };
  r.rodando = false;
  r.restante = 0;
  salvar();
  desenhar();
}

function dispensarRelogio() {
  const p = R().aviso?.proximo;
  if (p) entrarFase(p); else parar();
}

// Tudo o que está tocando agora. Vem do estado salvo, então vale igual em qualquer aba.
function alarmes() {
  const a = [], av = R().aviso;
  if (av) a.push({ texto: av.texto, encerrar: !!av.proximo, rotulo: !av.proximo ? 'Dispensar' : av.proximo.fase === 'foco' ? 'Começar foco' : 'Começar pausa', fn: dispensarRelogio, relogio: true });
  for (const l of estado.lembretes) {
    if (!l.apagada && !l.feito && l.quando <= agora()) a.push({ texto: 'Lembrete: ' + l.texto, rotulo: 'Dispensar', fn: () => mudar(l, { feito: true }) });
  }
  // aviso da agenda: o pop-up fica no próprio cartão (agenda.js); a faixa de baixo só o mostra se o cartão não estiver na tela
  for (const b of estado.agenda) {
    if (!b.apagada && b.aviso && !b.avisoFeito && b.aviso <= agora()) a.push({ texto: 'Agenda: ' + b.texto, rotulo: 'Fechar', fn: () => mudar(b, { avisoFeito: true }), agenda: true });
  }
  return a;
}
const naFaixa = al => al.filter(x => !x.agenda); // o aviso da agenda aparece no meio da tela (agenda.js), em qualquer tela ou área
const avisadosWin = new Set();
let chaveAgenda = '';

/* ---------- som ---------- */

let ctx, saida, audio, laco = null, toques = 0;

// Apito de trem sintetizado: acorde de buzina, dois sopros longos. Sem arquivo, sem rede.
function apito() {
  ctx ??= new AudioContext();
  ctx.resume();
  const t = ctx.currentTime + 0.05;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 1500;
  saida = ctx.createGain();
  saida.gain.value = estado.volume;
  filtro.connect(saida).connect(ctx.destination);
  for (const [ini, dur] of [[0, 1.0], [1.25, 2.3]]) {
    for (const f of [311, 370, 466, 554]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.97, t + ini); // sobe de leve no começo, como um apito a vapor
      o.frequency.linearRampToValueAtTime(f, t + ini + 0.3);
      g.gain.setValueAtTime(0, t + ini);
      g.gain.linearRampToValueAtTime(0.2, t + ini + 0.12);
      g.gain.setValueAtTime(0.2, t + ini + dur - 0.4);
      g.gain.linearRampToValueAtTime(0, t + ini + dur);
      o.connect(g).connect(filtro);
      o.start(t + ini);
      o.stop(t + ini + dur + 0.05);
    }
  }
}

function pararSom() {
  saida?.disconnect();
  audio?.pause();
}

// Som padrão do alarme (escolhido pelo usuário em 18/11/2026): buzina de trem em "sons/Alarme Pomodoro". Vale quando não há
// som próprio ("Usar meu som"). Se o arquivo faltar, toca o apito sintetizado de antes.
const ALARME_PADRAO = 'sons/Alarme%20Pomodoro/alarme.mp3'; // ponha um alarme.mp3 lá (sem ele, toca o apito)
function tocarSom() {
  pararSom();
  const meu = localStorage.getItem(CHAVE_SOM);
  if (!meu) {
    audio = new Audio(ALARME_PADRAO);
    audio.volume = estado.volume;
    audio.play().catch(e => { if (e.name !== 'NotAllowedError') apito(); });
    return;
  }
  audio = new Audio(meu);
  audio.volume = estado.volume;
  audio.play().catch(() => {}); // sem clique na página ainda: o navegador bloqueia; o aviso na tela continua
}

// O som repete enquanto houver alarme na tela; um toque nunca corta o anterior (a buzina padrão tem uns 20 s).
// ponytail: para de repetir depois de 5 min para não tocar o dia todo numa sala vazia; o aviso fica.
// Relógio (pomodoro, temporizador) avisado pelo Windows, com a página fora de vista: toca 2 vezes e para (pedido do usuário).
const peloWindows = al => document.hidden && window.Notification?.permission === 'granted' && al.length > 0 && al.every(x => x.relogio);
let inicioSom = 0;
function outroToque(limite, agoraMs = Date.now()) {
  if (audio && !audio.paused && !audio.ended) return false; // a gravação ainda está tocando
  return ++toques < limite && agoraMs - inicioSom < 5 * 60000;
}
function cuidarDoSom(ativo, limite = 40) {
  if (ativo && !laco) {
    toques = 0;
    inicioSom = Date.now();
    tocarSom();
    laco = setInterval(() => { if (outroToque(limite)) tocarSom(); }, 7000);
  }
  if (!ativo && laco) {
    clearInterval(laco);
    laco = null;
    pararSom();
  }
}

// O navegador só libera som depois do primeiro clique; o apito agendado toca assim que liberar.
document.addEventListener('pointerdown', () => { if (ctx?.state === 'suspended') ctx.resume(); });

/* ---------- aviso do Windows ---------- */
// Só quando a página não está à vista (a faixa do alarme já basta quando está). A `tag` faz várias abas abertas
// mostrarem um aviso só. A permissão é pedida pelo botão em Ajustes (o navegador exige um clique).
function avisarWindows(texto) {
  if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification('Recanto', { body: texto, tag: 'dashboard-alarme', requireInteraction: true });
  n.onclick = () => { window.focus(); n.close(); };
}
async function pedirAvisoWindows() {
  if (!('Notification' in window)) return aviso('Este navegador não tem avisos do sistema.');
  const p = await Notification.requestPermission().catch(() => 'denied');
  desenhar();
  aviso(p === 'granted' ? 'Pronto: com a página fora de vista, os alarmes também aparecem no Windows.'
    : 'O navegador não deixou. Libere as notificações deste endereço no cadeado da barra de endereço.');
}

/* ---------- desenho ---------- */

function nomeDaFase() {
  const r = R();
  if (r.modo === 'timer') return 'Temporizador';
  if (r.modo === 'crono') return 'Cronômetro';
  if (!r.fase) return 'Pomodoro';
  return NOME_FASE[r.fase] + (r.fase === 'foco' ? ` ${r.ciclo} de ${estado.pomo.ciclos}` : '');
}

// Roda duas vezes por segundo: só o que muda com o tempo.
function desenharRelogio() {
  const r = R(), crono = r.modo === 'crono';
  const txt = crono ? fmt(decorrido(), true) : fmt(restante()), fase = nomeDaFase();
  for (const e of document.querySelectorAll('.js-relogio')) e.textContent = txt;
  for (const e of document.querySelectorAll('.js-fase')) e.textContent = fase;
  const p = crono ? 0 : (1 - restante() / total()).toFixed(4);
  $('#foco').style.setProperty('--p', p);
  $('#tempoCartao').style.setProperty('--p', p);

  const tudo = alarmes(), al = naFaixa(tudo), a = al[0], cx = $('#alarme');
  $('#tempoCartao').toggleAttribute('data-aviso', !!R().aviso); // fim do foco ou da pausa: as bolinhas piscam
  for (const x of tudo) if (!avisadosWin.has(x.texto)) { avisadosWin.add(x.texto); avisarWindows(x.texto); }
  for (const t of avisadosWin) if (!tudo.some(x => x.texto === t)) avisadosWin.delete(t);
  const ch = tudo.filter(x => x.agenda).map(x => x.texto).join('|');
  if (ch !== chaveAgenda && typeof desenharAlertas === 'function') { chaveAgenda = ch; desenharAlertas(); } // agenda.js
  cx.hidden = !a;
  if (a && cx.dataset.texto !== a.texto) {
    cx.dataset.texto = a.texto;
    $('#alarmeTexto').textContent = a.texto + (al.length > 1 ? ` (+${al.length - 1})` : '');
    $('#alarmeBotao').textContent = a.rotulo;
    $('#alarmeEncerrar').hidden = !a.encerrar;
  }
  if (!a) delete cx.dataset.texto;
  cuidarDoSom(tudo.length > 0, peloWindows(tudo) ? 2 : 40);
  document.title = tudo[0] ? (Math.floor(agora() / 1000) % 2 ? '>> ' + tudo[0].texto : 'Recanto')
    : r.rodando ? `${txt} · ${fase}` : 'Recanto';
}

function rotuloQuando(ts) {
  const hora = new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const d = diaDe(ts);
  return (d === diaDe(agora()) ? 'hoje' : d.slice(8) + '/' + d.slice(5, 7)) + ' ' + hora;
}

// Chamado por desenhar() (app.js) a cada mudança de dados.
function desenharTempo(pendentes = []) {
  const r = R();
  $('#tempoCartao').dataset.modo = $('#foco').dataset.modo = r.modo;
  $('#foco').dataset.fase = r.fase || '';
  $('#tempoCartao').toggleAttribute('data-ativo', comecou());
  $('#foco').hidden = !emFoco;
  for (const b of document.querySelectorAll('#modos button')) b.setAttribute('aria-pressed', b.dataset.modo === r.modo);
  const rotulo = r.aviso ? 'Seguir' : r.rodando ? 'Pausar' : comecou() ? 'Continuar' : 'Iniciar';
  for (const b of document.querySelectorAll('.js-alternar')) b.textContent = rotulo;

  // bolinhas da sessão: foco · pausa · foco · pausa longa
  const n = estado.pomo.ciclos, atual = r.fase ? (r.ciclo - 1) * 2 + (r.fase === 'foco' ? 0 : 1) : -1;
  $('#ciclos').replaceChildren(...Array.from({ length: n * 2 }, (_, i) => el('i', {
    className: (i % 2 === 0 ? 'foco' : i === n * 2 - 1 ? 'longa' : 'curta') + (i < atual ? ' feito' : i === atual ? ' atual' : ''),
  })));

  const sel = $('#pomoTarefa');
  sel.replaceChildren(el('option', { value: '', textContent: 'Sem tarefa' }),
    ...pendentes.map(t => el('option', { value: t.id, textContent: t.texto })));
  sel.value = pendentes.some(t => t.id === r.tarefaId) ? r.tarefaId : '';
  $('#focoTarefa').textContent = pendentes.find(t => t.id === r.tarefaId)?.texto || '';

  const campo = (e, v) => { if (document.activeElement !== e) e.value = v; };
  for (const e of document.querySelectorAll('[data-pomo]')) campo(e, estado.pomo[e.dataset.pomo]);
  campo($('#timerMin'), estado.timerMin);
  campo($('#cfgMeta'), estado.metaFoco ?? 4);
  campo($('#cfgVolume'), estado.volume);
  $('#apitoPadrao').hidden = !localStorage.getItem(CHAVE_SOM);
  const perm = window.Notification?.permission;
  $('#avisoWindows').textContent = perm === 'granted' ? 'Aviso do Windows: ligado' : 'Avisar pelo Windows';
  $('#avisoWindows').disabled = perm === 'granted';

  const futuros = estado.lembretes.filter(l => !l.apagada && !l.feito).sort((a, b) => a.quando - b.quando);
  $('#contagemLembretes').textContent = futuros.length || '';
  $('#kLembrete').textContent = futuros[0] ? rotuloQuando(futuros[0].quando) : 'Nenhum';
  $('#kLembreteLeg').textContent = futuros[0]?.texto || 'Crie um no cartão Lembretes';
  $('#lembretes').replaceChildren(...futuros.map(l => {
    const apagar = el('button', { className: 'apagar', title: 'Apagar' }, ic('x'));
    apagar.onclick = () => {
      mudar(l, { apagada: true });
      aviso('Lembrete apagado.', 'Desfazer', () => mudar(l, { apagada: false }));
    };
    return el('li', { className: 'tarefa lembrete' }, el('time', { textContent: rotuloQuando(l.quando) }),
      el('span', { className: 'texto', textContent: l.texto }), apagar);
  }));

  desenharRelogio();
}

/* ---------- ações ---------- */

const ACOES = {
  alternar: () => R().aviso ? dispensarRelogio() : R().rodando ? pausar() : iniciar(),
  parar,
  pular,
  dispensar: () => naFaixa(alarmes())[0]?.fn(),
  foco: () => { emFoco = true; desenhar(); },
  sairFoco: () => { emFoco = false; desenhar(); },
  testarSom: tocarSom,
  avisoWindows: pedirAvisoWindows,
  escolherSom: () => $('#arquivoSom').click(),
  apitoPadrao: () => { localStorage.removeItem(CHAVE_SOM); desenhar(); aviso('Som de volta à buzina de trem.'); },
};
document.addEventListener('click', e => {
  const acao = e.target.closest('[data-acao]')?.dataset.acao;
  if (acao) ACOES[acao]();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && emFoco && !e.target.matches('input, select, [contenteditable="true"]')) ACOES.sairFoco();
});

$('#modos').onclick = e => {
  const m = e.target.dataset.modo;
  if (!m || m === R().modo) return;
  if (comecou()) return aviso('Pare o relógio atual antes de trocar.');
  estado.relogio = { modo: m, tarefaId: R().tarefaId };
  salvar();
  desenhar();
};

const limitar = e => Math.min(+e.max, Math.max(+e.min, Math.round(+e.value) || +e.min));
$('#tempoCartao').addEventListener('change', e => {
  const c = e.target;
  if (c.dataset.pomo) estado.pomo[c.dataset.pomo] = limitar(c);
  else if (c.id === 'timerMin') estado.timerMin = limitar(c);
  else if (c.id === 'cfgMeta') estado.metaFoco = limitar(c);
  else if (c.id === 'cfgVolume') estado.volume = +c.value;
  else if (c.id === 'pomoTarefa') R().tarefaId = c.value;
  else return;
  salvar();
  desenhar();
});

$('#arquivoSom').onchange = e => {
  const arq = e.target.files[0];
  e.target.value = '';
  if (!arq) return;
  if (arq.size > 1.5e6) return aviso('Som muito grande. Use um arquivo de até 1,5 MB.');
  const leitor = new FileReader();
  leitor.onload = () => {
    try { localStorage.setItem(CHAVE_SOM, leitor.result); } catch { return aviso('Não coube. Tente um som menor.'); }
    desenhar();
    tocarSom();
  };
  leitor.readAsDataURL(arq);
};

/* lembretes */
const paraCampo = ts => { const d = new Date(ts); return diaDe(ts) + 'T' + [d.getHours(), d.getMinutes()].map(n => String(n).padStart(2, '0')).join(':'); };
$('#lembreteQuando').value = paraCampo(agora() + 30 * MIN);
$('#atalhosLembrete').onclick = e => {
  if (e.target.dataset.min) $('#lembreteQuando').value = paraCampo(agora() + e.target.dataset.min * MIN);
};
$('#formLembrete').onsubmit = e => {
  e.preventDefault();
  const texto = $('#lembreteTexto').value.trim(), quando = new Date($('#lembreteQuando').value).getTime();
  if (!texto || !quando) return;
  estado.lembretes.push({ id: 'l' + agora().toString(36) + Math.random().toString(36).slice(2, 6), texto, quando, feito: false, mod: agora() });
  $('#lembreteTexto').value = '';
  salvar();
  desenhar();
};

setInterval(() => {
  const r = R();
  if (r.rodando && r.modo !== 'crono' && agora() >= r.fimEm) fimDaFase();
  else desenharRelogio();
}, 500);
desenhar();

if (location.hash === '#teste') {
  console.assert(fmt(1500000) === '25:00' && fmt(59001) === '01:00' && fmt(3661000, true) === '1:01:01', 'fmt');
  const seq = []; let p = { fase: 'foco', ciclo: 1 };
  while (p) { seq.push(p.fase); p = proximaFase(p.fase, p.ciclo, 2); }
  console.assert(seq.join() === 'foco,curta,foco,longa', 'proximaFase: foco, curta, foco, longa');
  console.log('autoteste do tempo concluído');
}
