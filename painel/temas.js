'use strict';
// Temas e modo claro/escuro. Carrega no <head>, ANTES de a página aparecer, para não piscar no tema errado.
// A escolha fica em estado.tema e estado.modo (vale para este computador; o importar não mexe nela).
// Cores e formas de cada tema: estilo.css (Aurora) e temas.css.
// Autoteste: em index.html#teste confere que todo tema da lista tem tokens próprios nos dois modos.

const TEMAS = [
  ['aurora', 'Aurora', 'O padrão: cartões de vidro e brilho suave.'],
  ['brutal', 'Neo-brutalista', 'Traço grosso, sombra dura, cor chapada.'],
  ['retro', 'Janelas retrô', 'Rosa e creme, cartões com barra de título.'],
  ['pixel', 'Pixel / RPG', 'Pergaminho, placas e tarefas como missões.'],
  ['calma', 'Calma', 'Creme e sálvia, relevo macio.'],
  ['editorial', 'Editorial', 'Marfim, serifa e marrom, como página de revista.'],
  ['neon', 'Néon', 'Lilás de dia, azul-marinho com brilho à noite.'],
  ['terminal', 'Terminal', 'Verde de monitor, tudo monoespaçado.'],
  ['sol', 'Sol', 'Marfim quente, pílulas pretas e amarelo.'],
  ['floresta', 'Floresta', 'Branco e verde-escuro, o que falta fica hachurado.'],
  ['planner', 'Planner', 'Branco e azul-marinho, linhas finas de agenda.'],
  ['lofi', 'Lofi ao entardecer', 'Laranja e roxo de fim de tarde, quarto aconchegante.'],
  ['caderno', 'Caderno pautado', 'Papel com pauta, margem vermelha e letra de caderno.'],
  ['contraste', 'Alto contraste', 'Preto e branco puros, traço grosso. Para ler cansado.'],
  ['noturno', 'Noturno profundo', 'Preto puro e pouco brilho, para a noite.'],
  ['sakura', 'Sakura', 'Rosa-claro e verde-folha, delicado.'],
  ['oceano', 'Oceano', 'Azuis e areia, calmo.'],
];
// Tema pela hora do dia (pedido do usuário): estado.temaHora = { ligado, manha, tarde, entardecer, noite }, cada um 'id' ou
// 'id:modo'. Vence o revezamento e o tema escolhido; ligar um desliga o outro.
const PERIODOS = [['manha', 'Manhã', 6], ['tarde', 'Tarde', 12], ['entardecer', 'Entardecer', 17], ['noite', 'Noite', 20]];
const HORA_PADRAO = { manha: 'aurora:claro', tarde: 'oceano:claro', entardecer: 'lofi:escuro', noite: 'noturno:escuro' };
const periodoDe = h => [...PERIODOS].reverse().find(p => h >= p[2])?.[0] || 'noite'; // antes das 6h ainda é noite
function temaDaHora(t, h = new Date().getHours()) {
  if (!t?.ligado) return '';
  const e = String(t[periodoDe(h)] || HORA_PADRAO[periodoDe(h)]);
  return TEMAS.some(x => x[0] === e.split(':')[0]) ? e : '';
}
const escuroNoSistema = matchMedia('(prefers-color-scheme: dark)');

// Revezamento: estado.rodizio = { min, temas: ['terminal:escuro', 'pixel:claro', 'aurora', …] }. Depois dos dois-pontos,
// o modo fixo daquele tema (pedido do usuário); sem eles, vale o claro/escuro geral. O tema da vez sai da hora do sistema
// (não de um contador), então todas as abas mostram o mesmo e recarregar não muda nada. min = 0 ou menos de dois = desligado.
const VEZES = [[0, 'Desligado'], [15, '15 min'], [60, '1 hora'], [240, '4 horas'], [1440, '1 dia']];
function temaDaVez(r, ms = Date.now() - new Date().getTimezoneOffset() * 60000) { // hora local: "1 dia" vira à meia-noite
  const temas = (Array.isArray(r?.temas) ? r.temas : []).filter(e => TEMAS.some(t => t[0] === String(e).split(':')[0]));
  return r?.min > 0 && temas.length > 1 ? temas[Math.floor(ms / (r.min * 60000)) % temas.length] : '';
}

// cfg = { tema, modo } — o estado do app, ou o que estiver salvo quando o app ainda não carregou.
function aplicarTema(cfg) {
  const raiz = document.documentElement;
  const [tema, modoFixo] = (temaDaHora(cfg.temaHora) || temaDaVez(cfg.rodizio) || cfg.tema || '').split(':');
  const modo = modoFixo || cfg.modo;
  raiz.dataset.tema = TEMAS.some(t => t[0] === tema) ? tema : 'aurora';
  raiz.dataset.modo = modo === 'claro' || modo === 'escuro' ? modo : escuroNoSistema.matches ? 'escuro' : 'claro';
  raiz.toggleAttribute('data-mini', !!cfg.ladoMini); // barra lateral recolhida (layout.js)
  // no tema RPG alguns títulos mudam de nome (data-rpg no HTML)
  for (const e of document.querySelectorAll('[data-rpg]')) {
    e.dataset.normal ??= e.textContent;
    e.textContent = raiz.dataset.tema === 'pixel' ? e.dataset.rpg : e.dataset.normal;
  }
}

let salvo = {};
try { salvo = JSON.parse(localStorage.getItem('recanto')) || {}; } catch { /* app.js cuida do dado corrompido */ }
aplicarTema(salvo);

// Daqui para baixo roda com a página e o app.js já carregados.
document.addEventListener('DOMContentLoaded', () => {
  const desenharTemas = () => {
    aplicarTema(estado);
    const tema = document.documentElement.dataset.tema;
    for (const b of document.querySelectorAll('.tema-cartao')) b.setAttribute('aria-pressed', b.dataset.tema === tema);
    for (const b of document.querySelectorAll('#modosCor button')) b.setAttribute('aria-pressed', b.dataset.cor === (estado.modo || 'sistema'));
    const r = estado.rodizio || { min: 0, temas: [] };
    for (const b of document.querySelectorAll('#rodizioTempo button')) b.setAttribute('aria-pressed', +b.dataset.min === (r.min || 0));
    // O nome põe ou tira o tema do revezamento; ao lado, separado (pedido do usuário), o modo daquele tema:
    // geral (segue o botão claro/escuro), sempre claro ou sempre escuro.
    $('#rodizioTemas').replaceChildren(...TEMAS.map(([id, nome]) => {
      const i = r.temas.findIndex(e => e.split(':')[0] === id), modo = i < 0 ? '' : r.temas[i].split(':')[1] || '';
      const b = el('button', { className: 'ficha-nome', textContent: nome }, i < 0 ? '' : ic('check'));
      b.setAttribute('aria-pressed', i >= 0);
      b.title = i < 0 ? 'Pôr no revezamento' : 'Tirar do revezamento';
      b.onclick = () => {
        const temas = [...r.temas];
        if (i < 0) temas.push(id); else temas.splice(i, 1);
        mudarRodizio({ temas });
      };
      if (i < 0) return el('span', { className: 'ficha' }, b);
      const modos = [['', 'Seguir o claro/escuro geral', null], ['claro', 'Sempre claro', 'sol'], ['escuro', 'Sempre escuro', 'lua']].map(([m, rotulo, icone]) => {
        const x = el('button', { className: 'ficha-modo', title: rotulo }, icone ? ic(icone) : 'geral');
        x.setAttribute('aria-pressed', modo === m);
        x.setAttribute('aria-label', `${nome}: ${rotulo}`);
        x.onclick = () => { const temas = [...r.temas]; temas[i] = m ? `${id}:${m}` : id; mudarRodizio({ temas }); };
        return x;
      });
      return el('span', { className: 'ficha dentro' }, b, ...modos);
    }));
    const ajuda = 'Clique no nome para pôr ou tirar um tema; ao lado escolha se ele segue o modo geral, fica sempre claro ou sempre escuro.';
    $('#rodizioLeg').textContent = r.min > 0 && r.temas.length < 2 ? 'Escolha pelo menos dois temas para revezar.'
      : temaDaVez(r) ? `Agora: ${TEMAS.find(t => t[0] === tema)[1]} (${document.documentElement.dataset.modo}). ${ajuda} Escolher um tema acima desliga o revezamento.` : ajuda;
    const th = { ...HORA_PADRAO, ...estado.temaHora };
    $('#horaLigar').setAttribute('aria-pressed', !!th.ligado);
    $('#horaLigar').textContent = th.ligado ? 'Ligado: o tema muda sozinho ao longo do dia' : 'Desligado';
    $('#horaTemas').hidden = !th.ligado;
    for (const s of document.querySelectorAll('#horaTemas select')) s.value = th[s.dataset.periodo];
    $('#horaLeg').textContent = th.ligado ? `Agora é ${PERIODOS.find(p => p[0] === periodoDe(new Date().getHours()))[1].toLowerCase()}: ${TEMAS.find(t => t[0] === tema)[1]}.` : '';
    // botão da barra lateral: mostra para onde vai
    const escuro = document.documentElement.dataset.modo === 'escuro', rotulo = escuro ? 'Modo claro' : 'Modo escuro';
    $('#alternarModo').replaceChildren(ic(escuro ? 'sol' : 'lua'), el('span', { textContent: rotulo }));
    $('#alternarModo').title = rotulo;
  };

  $('#temas').replaceChildren(...TEMAS.map(([id, nome, descricao]) => {
    const amostra = el('span', { className: 'amostra', ariaHidden: 'true' });
    amostra.innerHTML = '<i>Aa<u></u><u></u><s></s></i>';
    const b = el('button', { className: 'tema-cartao' }, amostra, el('b', { textContent: nome }), el('small', { textContent: descricao }));
    b.dataset.tema = id; // também faz a amostra usar as cores do próprio tema
    b.onclick = () => { // escolher à mão desliga o revezamento e o tema pela hora
      estado.tema = id;
      if (estado.rodizio) estado.rodizio.min = 0;
      if (estado.temaHora) estado.temaHora.ligado = false;
      salvar();
      desenharTemas();
    };
    return b;
  }));
  const mudarRodizio = campos => {
    estado.rodizio = { min: 0, temas: [], ...estado.rodizio, ...campos };
    if (estado.rodizio.min > 0 && estado.temaHora) estado.temaHora.ligado = false;
    salvar();
    desenharTemas();
  };
  const mudarHora = campos => {
    estado.temaHora = { ...HORA_PADRAO, ...estado.temaHora, ...campos };
    if (estado.temaHora.ligado && estado.rodizio) estado.rodizio.min = 0;
    salvar();
    desenharTemas();
  };
  $('#horaLigar').onclick = () => mudarHora({ ligado: !estado.temaHora?.ligado });
  const opcoes = () => TEMAS.flatMap(([id, nome]) => [[id, nome], [id + ':claro', nome + ' · claro'], [id + ':escuro', nome + ' · escuro']])
    .map(([v, t]) => el('option', { value: v, textContent: t }));
  const ate = i => PERIODOS[i + 1]?.[2] ?? PERIODOS[0][2];
  $('#horaTemas').replaceChildren(...PERIODOS.map(([id, nome, ini], i) => {
    const s = el('select', { onchange: () => mudarHora({ [id]: s.value }) }, ...opcoes());
    s.dataset.periodo = id;
    return el('label', { className: 'campo' }, `${nome} (${ini}h às ${ate(i)}h)`, s);
  }));
  $('#rodizioTempo').replaceChildren(...VEZES.map(([min, nome]) => {
    const b = el('button', { textContent: nome, onclick: () => mudarRodizio({ min }) });
    b.dataset.min = min;
    return b;
  }));
  const daVez = () => temaDaHora(estado.temaHora) || temaDaVez(estado.rodizio);
  let vez = daVez();
  setInterval(() => { if (daVez() !== vez) { vez = daVez(); desenharTemas(); } }, 20000);
  $('#modosCor').onclick = e => {
    if (!e.target.dataset.cor) return;
    estado.modo = e.target.dataset.cor;
    salvar();
    desenharTemas();
  };
  $('#alternarModo').onclick = () => {
    estado.modo = document.documentElement.dataset.modo === 'escuro' ? 'claro' : 'escuro';
    salvar();
    desenharTemas();
  };
  escuroNoSistema.addEventListener('change', desenharTemas);
  window.addEventListener('storage', () => setTimeout(desenharTemas)); // outra aba trocou o tema
  desenharTemas();

  if (location.hash === '#teste') {
    const raiz = document.documentElement, vistos = new Set();
    for (const [id] of TEMAS) for (const modo of ['claro', 'escuro']) {
      raiz.dataset.tema = id; raiz.dataset.modo = modo;
      const fundo = getComputedStyle(raiz).getPropertyValue('--fundo').trim();
      console.assert(fundo && !vistos.has(fundo), 'tema sem tokens próprios:', id, modo);
      vistos.add(fundo);
    }
    const rod = { min: 15, temas: ['aurora', 'xx', 'pixel', 'sol'] }, m15 = 15 * 60000;
    console.assert([0, 1, 2, 3].map(i => temaDaVez(rod, i * m15)).join() === 'aurora,pixel,sol,aurora', 'revezamento anda em roda e ignora tema desconhecido');
    console.assert(temaDaVez({ min: 0, temas: ['aurora', 'pixel'] }, 0) === '' && temaDaVez({ min: 15, temas: ['aurora'] }, 0) === '' && temaDaVez(undefined) === '', 'revezamento desligado');
    const rodModo = { min: 15, temas: ['terminal:escuro', 'xx:claro', 'pixel:claro'] };
    console.assert(temaDaVez(rodModo, 0) === 'terminal:escuro' && temaDaVez(rodModo, m15) === 'pixel:claro', 'revezamento leva o modo de cada tema');
    aplicarTema({ rodizio: { min: 1440, temas: ['terminal:escuro', 'terminal:escuro'] }, modo: 'claro' });
    console.assert(raiz.dataset.tema === 'terminal' && raiz.dataset.modo === 'escuro', 'modo fixo do tema vence o modo geral');
    console.assert(periodoDe(5) === 'noite' && periodoDe(6) === 'manha' && periodoDe(13) === 'tarde' && periodoDe(18) === 'entardecer' && periodoDe(23) === 'noite', 'períodos do dia');
    console.assert(temaDaHora({ ligado: true }, 22) === 'noturno:escuro' && temaDaHora({ ligado: true, tarde: 'sakura' }, 14) === 'sakura'
      && temaDaHora({ ligado: false }, 14) === '' && temaDaHora({ ligado: true, manha: 'xx' }, 8) === '', 'tema pela hora');
    desenharTemas();
    console.log('autoteste dos temas concluído');
  }
});
