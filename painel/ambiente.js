'use strict';
// Sons (janela presa ao botão "Sons" da barra lateral, por cima da página) e tela de descanso.
//
// Sons: grupos (chuva, café, bar…) de sons/lista.js, cada um com vários arquivos em "sons/Sons ambiente". Ligar um grupo
// sorteia um arquivo dele (diferente do último, quando há mais de um) e toca em laço, com volume próprio. "Silenciar" cala
// todos sem perder a escolha. Arquivo que não abrir: a janela avisa.
// Só UMA aba toca (a última em que se clicou), senão cada nova aba do navegador somaria mais uma chuva.
// estado.sonsFundo = { mudo, itens: { chuva: { on, vol } } } — vale para este computador (o importar não mexe).

// Sons gerados pela página (ruído filtrado) quando falta o arquivo: desligados, o usuário não gostou deles (18/11/2026) e vai
// mandar os próprios áudios. O código fica para quem quiser religar: true.
const GERAR_SONS = false;
const faltam = {}; // id → true quando o arquivo sorteado não abriu
const SONS = (typeof SONS_LISTA === 'undefined' ? [] : SONS_LISTA).map(([id, nome]) => [id, nome]);
const arquivosDe = id => (typeof SONS_LISTA === 'undefined' ? [] : SONS_LISTA.find(g => g[0] === id)?.[2] || []);
const ultimoSom = {}; // id → último arquivo tocado, para o próximo sorteio ser outro
function sortear(id) {
  const todos = arquivosDe(id), outros = todos.filter(f => f !== ultimoSom[id]);
  const f = (outros.length ? outros : todos)[Math.floor(Math.random() * (outros.length || todos.length))];
  return (ultimoSom[id] = f);
}
const DONO = CHAVE + '-som-dono', minhaAba = Math.random().toString(36).slice(2);
const tocando = {}; // id → { volume(v), parar(), el? , gerado? }
let ctxSons;
const cfgSons = () => (estado.sonsFundo ??= { mudo: false, itens: {} });
const volSom = id => (cfgSons().itens[id]?.vol ?? 0.5) ** 2; // o meio do controle soa como meio volume
const souDono = () => localStorage.getItem(DONO) === minhaAba;

// Ruído de 4 s em laço: branco (chiado) ou marrom (grave, como vento ou mar ao longe).
function ruido(c, tipo) {
  const n = c.sampleRate * 4, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0, ult = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    d[i] = tipo === 'marrom' ? (ult = (ult + 0.02 * w) / 1.02) * 3.5 : w;
  }
  return buf;
}

// Som gerado, para quando falta o arquivo.
function gerado(id) {
  const c = ctxSons ??= new AudioContext();
  c.resume();
  const fonte = c.createBufferSource(), ganho = c.createGain(), saida = c.createGain();
  fonte.buffer = ruido(c, id === 'chuva' ? 'branco' : 'marrom');
  fonte.loop = true;
  let no = fonte, estalos = 0;
  if (id === 'chuva') {
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.4;
    no.connect(f); no = f; ganho.gain.value = 0.35;
  }
  if (id === 'ondas') { // o mar vai e volta: o volume sobe e desce devagar
    const lfo = c.createOscillator(), prof = c.createGain();
    lfo.frequency.value = 0.08; prof.gain.value = 0.4; ganho.gain.value = 0.5;
    lfo.connect(prof).connect(ganho.gain); lfo.start();
  }
  if (id === 'lareira') { // brasa grave e estalos soltos
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    no.connect(f); no = f; ganho.gain.value = 0.6;
    const branco = ruido(c, 'branco');
    estalos = setInterval(() => {
      if (Math.random() > 0.35) return;
      const e = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
      e.buffer = branco;
      g.gain.setValueAtTime(0.25 + Math.random() * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + Math.random() * 0.05);
      e.connect(g).connect(saida);
      e.start(t, Math.random() * 3, 0.08);
    }, 90);
  }
  no.connect(ganho).connect(saida).connect(c.destination);
  fonte.start();
  return { gerado: true, volume: v => { saida.gain.value = v; }, parar: () => { fonte.stop(); clearInterval(estalos); saida.disconnect(); } };
}

function deArquivo(id) {
  const arquivo = sortear(id);
  // arquivo vem como "Subpasta/nome.mp3": cada parte do caminho é codificada (espaços, acentos)
  const a = new Audio(arquivo ? 'sons/Sons%20ambiente/' + arquivo.split('/').map(encodeURIComponent).join('/') : '');
  const t = { el: a, arquivo, volume: v => { a.volume = v; }, parar: () => { a.pause(); a.removeAttribute('src'); } };
  delete faltam[id];
  a.loop = true;
  a.onerror = () => { // sem o arquivo: avisa (ou, se ligado, troca pelo som gerado)
    if (tocando[id] !== t) return;
    if (!GERAR_SONS) { faltam[id] = true; desenharSons(); return; }
    tocando[id] = gerado(id);
    tocando[id].volume(volSom(id));
    desenharSons();
  };
  a.play().catch(() => {}); // sem clique na página o navegador bloqueia; tenta de novo no próximo clique
  return t;
}

// Liga e desliga o que deve tocar nesta aba. Chamado por desenhar() (app.js) e quando outra aba vira a dona do som.
function aplicarSons() {
  const c = cfgSons(), dono = souDono();
  for (const [id] of SONS) {
    const deve = dono && !c.mudo && c.itens[id]?.on;
    if (deve && !tocando[id]) tocando[id] = deArquivo(id);
    if (!deve && tocando[id]) { tocando[id].parar(); delete tocando[id]; }
    tocando[id]?.volume(volSom(id));
  }
  desenharSons();
}

function desenharSons() {
  const c = cfgSons();
  $('#sons').replaceChildren(...SONS.map(([id, nome]) => {
    const it = c.itens[id] || {};
    const b = el('button', { className: 'som-nome', textContent: nome }, it.on ? ic('check') : '');
    b.setAttribute('aria-pressed', !!it.on);
    b.title = it.on ? 'Desligar este som' : 'Ligar este som';
    b.onclick = () => mudarSom(id, { on: !it.on });
    const li = el('li', { className: 'som' }, b);
    if (it.on) {
      const r = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: it.vol ?? 0.5 });
      r.setAttribute('aria-label', 'Volume: ' + nome);
      r.oninput = () => { c.itens[id].vol = +r.value; tocando[id]?.volume(volSom(id)); };
      r.onchange = salvar;
      li.append(r);
      if (faltam[id]) li.append(el('small', { textContent: 'não abriu', title: `O arquivo "${ultimoSom[id]}" não abriu. Confira se ele está em sons/Sons ambiente.` }));
      else if (arquivosDe(id).length > 1) li.append(el('small', { textContent: `${arquivosDe(id).indexOf(ultimoSom[id]) + 1} de ${arquivosDe(id).length}`, title: 'Cada vez que liga, toca um diferente' }));
      else if (tocando[id]?.gerado) li.append(el('small', { textContent: 'gerado aqui', title: `Falta o arquivo sons/${id}.ogg; o som está sendo gerado pela página.` }));
    }
    return li;
  }));
  const algum = SONS.some(([id]) => c.itens[id]?.on), outraAba = algum && !c.mudo && !souDono() && localStorage.getItem(DONO);
  const rotulo = c.mudo ? 'Tocar sons' : 'Silenciar sons';
  $('#sonsMudo').textContent = rotulo;
  $('#sonsMudo').setAttribute('aria-pressed', !!c.mudo);
  $('#sonsBotao').replaceChildren(ic(c.mudo || !algum ? 'mudo' : 'som'), el('span', { textContent: 'Sons' }));
  $('#sonsBotao').title = c.mudo ? 'Sons (silenciados)' : algum ? 'Sons (tocando)' : 'Sons';
  $('#sonsLeg').textContent = !SONS.length ? 'Nenhum som ainda. Ponha áudios em sons/Sons ambiente (veja sons/LEIA.md).'
    : !algum ? 'Clique num som para ligar; cada um tem o seu volume.'
    : c.mudo ? 'Silenciado. A escolha fica guardada.' : outraAba ? 'Tocando em outra aba. Clique aqui para trazer para esta.' : '';
}

function mudarSom(id, campos) {
  const c = cfgSons();
  c.itens[id] = { vol: 0.5, ...c.itens[id], ...campos };
  if (campos.on) c.mudo = false; // ligou um som: quer ouvir
  localStorage.setItem(DONO, minhaAba);
  salvar();
  aplicarSons();
}
const alternarMudo = () => {
  const c = cfgSons();
  c.mudo = !c.mudo;
  if (!c.mudo) localStorage.setItem(DONO, minhaAba);
  salvar();
  aplicarSons();
};
$('#sonsMudo').onclick = alternarMudo;
// a janela abre colada ao botão: à direita da barra lateral, ou embaixo dele em tela estreita
$('#sonsJanela').addEventListener('toggle', e => {
  if (e.newState !== 'open') return;
  desenharSons();
  const j = $('#sonsJanela'), b = $('#sonsBotao').getBoundingClientRect(), estreita = matchMedia('(max-width: 900px)').matches;
  const dentro = (v, tam, max) => Math.max(8, Math.min(v, max - tam - 8));
  j.style.left = dentro(estreita ? b.left : b.right + 8, j.offsetWidth, innerWidth) + 'px';
  j.style.top = dentro(estreita ? b.bottom + 8 : b.top, j.offsetHeight, innerHeight) + 'px';
});

// Um clique nesta aba com som ligado: ela vira a dona do som (e destrava o áudio que o navegador segurou).
document.addEventListener('pointerdown', () => {
  const c = cfgSons(), algum = SONS.some(([id]) => c.itens[id]?.on);
  if (algum && !c.mudo && !souDono()) { localStorage.setItem(DONO, minhaAba); aplicarSons(); }
  ctxSons?.resume();
  for (const t of Object.values(tocando)) if (t.el?.paused) t.el.play().catch(() => {});
});
window.addEventListener('storage', e => { if (e.key === DONO) aplicarSons(); });
window.addEventListener('pagehide', () => { if (souDono()) localStorage.removeItem(DONO); });

/* ---------- tocando agora (Spotify no navegador) ---------- */
// Quem traz os dados é a extensão (nova-aba/ponte.js), por postMessage: { de: 'extensao-dashboard', musica: {musica, artista,
// posicao, duracao, tocando} | null }. Sem a extensão, ou sem o Spotify aberto, a faixa fica escondida.
function desenharMusica(m) {
  $('#musica').hidden = !m;
  if (!m) return;
  const nome = (m.artista ? m.artista + ' - ' : '') + m.musica;
  if ($('#musicaNome').textContent !== nome) {
    $('#musicaNome').textContent = nome;
    $('.musica-texto').style.setProperty('--dur', Math.max(14, nome.length * 0.45) + 's'); // texto longo corre mais tempo, na mesma velocidade
  }
  $('#musicaTempo').textContent = m.posicao && m.duracao ? `${m.posicao} / ${m.duracao}` : '';
  $('#musicaTocar').replaceChildren(ic(m.tocando ? 'pausar' : 'tocar'));
  $('#musica').toggleAttribute('data-tocando', !!m.tocando); // o equalizador mexe só tocando
  // dos lados: o que tocou (com a duração) e o que vem a seguir (sem tempo: o Spotify não mostra a duração da próxima)
  const lado = (id, x, tempo) => {
    $('#' + id).hidden = !x?.musica;
    if (x?.musica) $('#' + id + 'Txt').textContent = (x.artista ? x.artista + ' - ' : '') + x.musica + (tempo && x.duracao ? '  ' + x.duracao : '');
  };
  lado('musicaAntes', m.antes, true);
  lado('musicaSeguir', m.proxima, false);
  $('#musicaTocar').title = m.tocando ? 'Pausar' : 'Tocar';
}
window.addEventListener('message', e => {
  if (e.source !== window || e.data?.de !== 'extensao-dashboard') return;
  const m = e.data.musica;
  desenharMusica(m && typeof m.musica === 'string' ? m : null);
});
// Ao entrar com o mouse, os controles vão para baixo desse ponto da faixa (centralizados nele, sem sair das bordas) e ficam ali.
$('#musica').addEventListener('mouseenter', e => {
  const faixa = $('#musica').getBoundingClientRect(), c = $('.musica-controles'), w = c.offsetWidth;
  c.style.left = Math.max(0, Math.min(e.clientX - faixa.left - w / 2, faixa.width - w)) + 'px';
});
$('#musica').addEventListener('click', e => {
  const c = e.target.closest('[data-musica]')?.dataset.musica;
  if (c) window.postMessage({ de: 'dashboard-pagina', comando: c }, '*');
});

/* ---------- tela de descanso ---------- */
// Relógio grande e calmo para deixar aberto. Sai com um clique ou uma tecla; um alarme também tira daqui.
let tDescanso = 0;
function proximoCompromisso() {
  const hoje = diaDe(agora()), agoraHM = new Date().toTimeString().slice(0, 5);
  const blocos = estado.agenda.filter(b => !b.apagada && b.dia === hoje && b.hora > agoraHM).map(b => [b.hora, b.texto]);
  const lemb = estado.lembretes.filter(l => !l.apagada && !l.feito && l.quando > agora() && diaDe(l.quando) === hoje)
    .map(l => [new Date(l.quando).toTimeString().slice(0, 5), l.texto]);
  return [...blocos, ...lemb].sort((a, b) => a[0].localeCompare(b[0]))[0];
}
function desenharDescanso() {
  if (alarmes().length) return sairDescanso(); // tempo.js: um alarme tocando precisa ser visto
  const d = new Date(), p = proximoCompromisso();
  $('#descHora').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  $('#descData').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#descProx').textContent = p ? `Próximo: ${p[0]} · ${p[1]}` : '';
}
function entrarDescanso() {
  $('#descanso').hidden = false;
  desenharDescanso();
  tDescanso = setInterval(desenharDescanso, 1000);
}
function sairDescanso() {
  $('#descanso').hidden = true;
  clearInterval(tDescanso);
}
$('#descansar').onclick = entrarDescanso;
$('#descanso').addEventListener('pointerdown', sairDescanso);
document.addEventListener('keydown', e => { if (!$('#descanso').hidden) { e.preventDefault(); sairDescanso(); } }, true);

aplicarSons();
