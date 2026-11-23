'use strict';
// Cartões do painel: Agenda (blocos por hora, de qualquer dia) e Atalhos (links e pastas); e mais funções soltas abaixo.
// estado.agenda:  [{ id, dia: 'AAAA-MM-DD', hora: 'HH:MM', min (duração, 0 = sem), aviso (ms, 0 = sem), avisoFeito, texto, area, mod, apagada }]
// Aviso: na hora marcada toca o som do relógio (tempo.js) e aparece um aviso no meio da tela, com "Lembrar em 10 min" e "Fechar".
// estado.atalhos: [{ id, nome, url, area, mod, apagada }]
// Os dois mesclam por id ao importar (mesclar, em app.js) e mudam por mudar(), como as tarefas.
// ponytail: a agenda só mostra hoje e os blocos não têm duração; planejar outros dias entra se fizer falta.

const idNovo = p => p + agora().toString(36) + Math.random().toString(36).slice(2, 6);
const areaNova = () => (estado.area === 'tudo' ? estado.ultimaArea : estado.area);
const dois = n => String(n).padStart(2, '0');

// Endereço de atalho: só http, https e file. Caminho do Windows vira file://; sem esquema vira https. '' se não servir.
function urlSegura(texto) {
  texto = String(texto).trim();
  if (/^[a-z]:[\\/]/i.test(texto)) texto = 'file:///' + texto;
  else if (texto.startsWith('\\\\')) texto = 'file:' + texto;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(texto)) texto = 'https://' + texto;
  try {
    const u = new URL(texto.replace(/\\/g, '/'));
    return ['http:', 'https:', 'file:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}

let agendaDia = diaDe(agora()); // o dia que o cartão Agenda mostra
const emMin = hora => +hora.slice(0, 2) * 60 + +hora.slice(3, 5);
const deMin = m => dois(Math.floor(m / 60)) + ':' + dois(m % 60);
const quandoDe = (dia, hora) => new Date(dia + 'T' + hora).getTime();
const horaDe = ts => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
// O aviso pela escolha do formulário: '' sem, minutos antes do bloco, ou 'outro' com a hora escrita.
function avisoDe(escolha, dia, hora, horaAviso) {
  if (escolha === '') return 0;
  if (escolha === 'outro') return horaAviso ? quandoDe(dia, horaAviso) : 0;
  return quandoDe(dia, hora) - +escolha * 60000;
}

function desenharAlertas() {
  const hoje = diaDe(agora());
  const v = estado.agenda.filter(b => !b.apagada && b.aviso && !b.avisoFeito && b.aviso <= agora());
  $('#agendaAlerta').replaceChildren(...v.map(b => {
    const soneca = el('button', { className: 'botao', textContent: 'Lembrar em 10 min', onclick: () => mudar(b, { aviso: agora() + 10 * 60000 }) });
    const fechar = el('button', { className: 'botao cheio', textContent: 'Fechar', onclick: () => mudar(b, { avisoFeito: true }) });
    return el('div', { className: 'ag-alerta' }, ic('sino'),
      el('p', {}, el('b', { textContent: b.texto }), el('small', { textContent: `${b.dia === hoje ? 'Hoje' : br(b.dia)} às ${b.hora}` })), soneca, fechar);
  }));
  $('#agendaAlerta').hidden = !v.length;
  $('.c-agenda').toggleAttribute('data-alerta', v.length > 0);
}

// Ícone de cada atalho (símbolos i-k-* no index, ver icones/LEIA.md): pela extensão do arquivo e pelo endereço do site.
// A cor é a da marca (some nos temas Alto contraste e Terminal, que ficam em uma cor só).
const ICONE_EXT = {
  xlsx: 'microsoft-excel', xls: 'microsoft-excel', xlsm: 'microsoft-excel', csv: 'file-table-outline', ods: 'file-table-outline',
  docx: 'microsoft-word', doc: 'microsoft-word', odt: 'file-document-outline', txt: 'file-document-outline', rtf: 'file-document-outline',
  pptx: 'microsoft-powerpoint', ppt: 'microsoft-powerpoint', pdf: 'file-pdf-box',
  png: 'file-image-outline', jpg: 'file-image-outline', jpeg: 'file-image-outline', gif: 'file-image-outline', webp: 'file-image-outline',
};
const ICONE_SITE = [
  [/docs\.google\.com\/spreadsheets|sheets\.google/, 'google-spreadsheet'],
  [/docs\.google\.com\/document/, 'file-document-outline'],
  [/docs\.google\.com\/presentation|slides\.google/, 'presentation'],
  [/drive\.google\.com/, 'google-drive'],
  [/mail\.google\.com/, 'gmail'],
  [/calendar\.google\.com/, 'calendar-month-outline'],
  [/meet\.google\.com|zoom\.us|webex/, 'video-outline'],
  [/translate\.google/, 'google-translate'],
  [/maps\.google|google\.[a-z.]+\/maps/, 'map-marker-outline'],
  [/sharepoint\.com/, 'microsoft-sharepoint'],
  [/onedrive\.live\.com|1drv\.ms/, 'microsoft-onedrive'],
  [/teams\.(microsoft|live)\.com/, 'microsoft-teams'],
  [/outlook\.(office|office365|live)\.com/, 'microsoft-outlook'],
  [/(^|\.)(office|microsoft|live)\.com/, 'microsoft'],
  [/(^|\.)google\./, 'google'],
  [/youtube\.com|youtu\.be/, 'youtube'],
  [/whatsapp\.com/, 'whatsapp'],
  [/github\.com/, 'github'],
  [/spotify\.com/, 'spotify'],
  [/linkedin\.com/, 'linkedin'],
  [/instagram\.com/, 'instagram'],
  [/netflix\.com/, 'netflix'],
  [/\.(gov|leg|jus|mp|def)\.br/, 'bank-outline'],
  [/\.edu(\.|$)|escola|universidade|faculdade/, 'school-outline'],
  [/slack|discord|chat\./, 'chat-outline'],
  [/notion\.so|evernote|onenote/, 'notebook-outline'],
  [/g1\.globo|folha\.|estadao|uol\.com|noticias|news/, 'newspaper-variant-outline'],
  [/mercadolivre|amazon\.|shopee|magazineluiza|loja/, 'cart-outline'],
  [/mail|webmail/, 'email-outline'],
];
const COR_ICONE = {
  'microsoft-excel': '#1f7244', 'google-spreadsheet': '#188038', 'file-table-outline': '#1f7244', 'microsoft-word': '#2b579a',
  'file-document-outline': '#4285f4', 'microsoft-powerpoint': '#c43e1c', presentation: '#f4b400', 'file-pdf-box': '#d93025',
  'microsoft-outlook': '#0f6cbd', 'microsoft-teams': '#5b5fc7', 'microsoft-onedrive': '#0364b8', 'microsoft-sharepoint': '#038387',
  'google-drive': '#1e8e3e', gmail: '#d93025', youtube: '#ff0000', whatsapp: '#25d366', spotify: '#1db954', linkedin: '#0a66c2',
  instagram: '#e1306c', netflix: '#e50914', 'folder-outline': '#d99a1e', 'video-outline': '#1a73e8',
};
function iconeDe(url) {
  let u;
  try { u = new URL(url); } catch { return 'web'; }
  const caminho = decodeURIComponent(u.pathname);
  const ext = (caminho.match(/\.([a-z0-9]+)\/?$/i)?.[1] || '').toLowerCase();
  if (ICONE_EXT[ext]) return ICONE_EXT[ext];
  // arquivo aberto por um site (SharePoint, OneDrive…): o nome vem depois do "?", como em Doc.aspx?file=Planilha.xlsx
  const noLink = (u.search.match(/\.(xlsx?|xlsm|docx?|pptx?|pdf|csv)\b/i)?.[1] || '').toLowerCase();
  if (ICONE_EXT[noLink]) return ICONE_EXT[noLink];
  if (u.protocol === 'file:') return ext ? 'file-outline' : 'folder-outline'; // sem extensão: é uma pasta
  return ICONE_SITE.find(([re]) => re.test(u.hostname + caminho))?.[1] || 'web';
}
function iconeAtalho(url) {
  const nome = iconeDe(url), i = ic('k-' + nome);
  if (COR_ICONE[nome]) i.style.setProperty('--cor-marca', COR_ICONE[nome]);
  return i;
}

function desenharAgenda() {
  const hoje = diaDe(agora()), ehHoje = agendaDia === hoje, horaAgora = new Date().getHours();
  const naArea = x => !x.apagada && (estado.area === 'tudo' || x.area === estado.area);
  const itens = [
    // todas as áreas: um compromisso marcado não pode sumir da agenda só por causa do filtro (o aviso toca de qualquer jeito);
    // o que é da outra área aparece mais apagado, com o nome da área
    ...estado.agenda.filter(b => !b.apagada && b.dia === agendaDia).map(b => {
      const fimMin = b.min > 0 ? Math.min(emMin(b.hora) + b.min, 24 * 60) : 0;
      return { hora: b.hora, ate: fimMin ? deMin(fimMin) : '', fimMin, texto: b.texto, bloco: b };
    }),
    ...estado.lembretes.filter(l => !l.apagada && diaDe(l.quando) === agendaDia).map(l => {
      const d = new Date(l.quando);
      return { hora: dois(d.getHours()) + ':' + dois(d.getMinutes()), texto: l.texto };
    }),
  ].sort((a, b) => a.hora.localeCompare(b.hora));
  const hs = itens.flatMap(i => [+i.hora.slice(0, 2), i.fimMin ? Math.ceil(i.fimMin / 60) - 1 : 0]);
  // hoje começa na hora de agora (ou às 8h, se for mais cedo): hora vazia que já passou não ajuda a planejar
  const ini = Math.min(ehHoje ? Math.max(8, horaAgora) : 8, ...itens.map(i => +i.hora.slice(0, 2)));
  const fim = Math.min(23, Math.max(18, ehHoje ? horaAgora : 0, ...hs));

  const linhas = [];
  for (let h = ini; h <= fim; h++) {
    const rotulo = el('button', { className: 'ag-rot', textContent: dois(h) + 'h', title: `Planejar algo às ${h}h` });
    rotulo.onclick = () => { $('#agendaHora').value = dois(h) + ':00'; $('#agendaTexto').focus(); };
    // bloco que começou numa hora anterior e ainda não acabou: aparece apagado, como continuação
    const continuam = itens.filter(i => i.fimMin > h * 60 && +i.hora.slice(0, 2) < h)
      .map(i => el('p', { className: 'ag-item cont', title: `${i.hora}–${i.ate}` }, el('span', { textContent: i.texto })));
    const li = el('li', { className: 'ag-hora' }, rotulo, el('div', {}, ...continuam, ...itens.filter(i => +i.hora.slice(0, 2) === h).map(i => {
      const fora = i.bloco && !naArea(i.bloco);
      const item = el('p', { className: 'ag-item' + (fora ? ' fora' : '') }, el('time', { textContent: i.ate ? `${i.hora}–${i.ate}` : i.hora }), el('span', { textContent: i.texto }));
      if (!i.bloco) { item.append(el('small', { textContent: 'lembrete' })); return item; }
      if (fora) item.append(el('small', { textContent: i.bloco.area === 'pessoal' ? 'pessoal' : 'trabalho', title: 'Bloco da outra área' }));
      const b = i.bloco, comAviso = b.aviso && !b.avisoFeito;
      const sino = el('button', { className: 'selo', title: comAviso ? `Aviso às ${horaDe(b.aviso)}. Clique para tirar.` : 'Avisar com som na hora do bloco' }, ic('sino'), comAviso ? horaDe(b.aviso) : '');
      if (comAviso) sino.dataset.tem = '';
      sino.onclick = () => mudar(b, comAviso ? { aviso: 0 } : { aviso: quandoDe(b.dia, b.hora), avisoFeito: false });
      item.append(sino);
      const apagar = el('button', { className: 'apagar', title: 'Apagar da agenda' }, ic('x'));
      apagar.onclick = () => {
        mudar(i.bloco, { apagada: true });
        aviso('Bloco apagado da agenda.', 'Desfazer', () => mudar(i.bloco, { apagada: false }));
      };
      item.append(apagar);
      return item;
    })));
    if (ehHoje && h === horaAgora) li.dataset.agora = '';
    if (agendaDia < hoje || ehHoje && h < horaAgora) li.dataset.passou = '';
    linhas.push(li);
  }
  $('#agenda').replaceChildren(...linhas);
  $('#agRotulo').textContent = ehHoje ? 'Hoje' : meioDia(agendaDia).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'numeric' });
  $('#agRotulo').disabled = ehHoje;
  desenharAlertas();

  const links = estado.atalhos.filter(naArea).map(a => [a, urlSegura(a.url)]).filter(([, url]) => url);
  $('#links').replaceChildren(...links.map(([a, url]) => {
    const apagar = el('button', { className: 'apagar', title: 'Remover atalho' }, ic('x'));
    apagar.setAttribute('aria-label', 'Remover atalho: ' + a.nome);
    apagar.onclick = () => {
      mudar(a, { apagada: true });
      aviso('Atalho removido.', 'Desfazer', () => mudar(a, { apagada: false }));
    };
    return el('li', {}, el('a', { href: url, target: '_blank', rel: 'noopener', title: url }, iconeAtalho(url), el('span', { textContent: a.nome })), apagar);
  }));
  $('#vazioLinks').hidden = links.length > 0;
  desenharMes();
  desenharMetas();
  if (document.activeElement !== $('#notas')) $('#notas').value = estado.notas?.texto || ''; // não mexer enquanto a pessoa digita
  desenharBusca();
  desenharQuadro();
  desenharXP();
}

/* ---------- XP e nível (tema Pixel / RPG) ---------- */
// Nada é guardado: o XP sai do que já está registrado (todas as áreas). Tarefa concluída 10, hábito feito 5, foco 1 a cada 5 min.
// O nível N começa em 50·(N−1)·N de XP: 0, 100, 300, 600… Só estado.nivelVisto fica salvo, para avisar quando sobe.
const pisoNivel = n => 50 * (n - 1) * n;
const nivelDe = xp => Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2);

function desenharXP() {
  const xp = estado.tarefas.filter(t => !t.apagada && t.feitaEm).length * 10
    + estado.habitos.filter(h => !h.apagada).reduce((n, h) => n + Object.values(h.dias).filter(v => v > 0).length, 0) * 5
    + Math.floor(estado.sessoes.filter(s => !s.apagada).reduce((n, s) => n + s.min, 0) / 5);
  const nivel = nivelDe(xp), piso = pisoNivel(nivel), teto = pisoNivel(nivel + 1);
  $('#xpNivel').textContent = 'Nível ' + nivel;
  $('#xpLeg').textContent = `${xp - piso} de ${teto - piso} XP`;
  $('#xpBarra').style.width = (xp - piso) / (teto - piso) * 100 + '%';
  if (estado.nivelVisto === nivel) return;
  if (nivel > estado.nivelVisto && document.documentElement.dataset.tema === 'pixel') aviso(`Você subiu para o nível ${nivel}!`);
  estado.nivelVisto = nivel;
  salvar();
}

/* ---------- quadro de projetos ---------- */
// estado.projetos: [{ id, nome, fase: 'fazer' | 'andamento' | 'feito', nota, area, mod, apagada }]
// Muda de fase pelas setas ou arrastando pela pega (também reordena dentro da coluna: a ordem é a da lista).
const FASES = [['fazer', 'A fazer'], ['andamento', 'Em andamento'], ['feito', 'Concluído']];
const faseDe = p => Math.max(0, FASES.findIndex(f => f[0] === p.fase)); // fase desconhecida (arquivo importado) conta como a primeira
const moverFase = (p, n) => FASES[Math.max(0, Math.min(FASES.length - 1, faseDe(p) + n))][0];

function desenharQuadro() {
  const vis = estado.projetos.filter(p => !p.apagada && (estado.area === 'tudo' || p.area === estado.area));
  $('#quadro').replaceChildren(...FASES.map(([, titulo], i) => {
    const itens = vis.filter(p => faseDe(p) === i).map(p => {
      const campo = (tag, classe, chave, obrigatorio) => {
        const c = el(tag, { className: classe, textContent: p[chave] || '', contentEditable: 'true', spellcheck: false });
        c.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); c.blur(); } };
        c.onblur = () => {
          const v = c.textContent.trim();
          if (!v && obrigatorio) c.textContent = p[chave];
          else if (v !== (p[chave] || '')) mudar(p, { [chave]: v }, false); // sem redesenhar: não engolir o clique seguinte
          if (!v) c.textContent = obrigatorio ? p[chave] : ''; // :empty precisa do campo sem nada dentro
        };
        return c;
      };
      const nota = campo('span', 'q-nota', 'nota');
      nota.dataset.vazio = 'Anotar a situação…';
      nota.setAttribute('aria-label', 'Situação de ' + p.nome);
      const seta = (n, rotulo, desligado) => {
        const b = el('button', { className: 'redondo mini' + (n > 0 ? ' vira' : ''), title: rotulo, disabled: desligado }, ic('seta'));
        b.setAttribute('aria-label', `${rotulo}: ${p.nome}`);
        b.onclick = () => mudar(p, { fase: moverFase(p, n) });
        return b;
      };
      const area = el('button', {
        className: 'area', title: 'Trocar área', textContent: p.area === 'trabalho' ? 'Trabalho' : 'Pessoal',
        onclick: () => mudar(p, { area: p.area === 'trabalho' ? 'pessoal' : 'trabalho' }),
      });
      area.dataset.area = p.area;
      const apagar = el('button', { className: 'apagar', title: 'Apagar projeto' }, ic('x'));
      apagar.setAttribute('aria-label', 'Apagar projeto: ' + p.nome);
      apagar.onclick = () => {
        mudar(p, { apagada: true });
        aviso('Projeto apagado.', 'Desfazer', () => mudar(p, { apagada: false }));
      };
      const pega = el('span', { className: 'pega', draggable: true, title: 'Arrastar para outra fase' }, ic('pega'));
      const item = el('div', { className: 'q-item' }, campo('b', 'texto', 'nome', true), nota,
        el('div', { className: 'q-pe' }, pega, area, seta(-1, 'Voltar uma fase', i === 0), seta(1, 'Avançar uma fase', i === FASES.length - 1), apagar));
      item.dataset.id = p.id;
      return item;
    });
    const vazio = el('p', { className: 'vazio', textContent: i || vis.length ? 'Nada nesta fase.' : 'Ponha aqui o que leva mais de um dia: um processo, um evento, uma compra.' });
    const col = el('section', { className: 'q-col' }, el('p', { className: 'rot' }, titulo, el('span', { className: 'conta', textContent: itens.length || '' })),
      ...(itens.length ? itens : [vazio]));
    col.dataset.fase = FASES[i][0];
    return col;
  }));
}

// Arrastar um projeto: solto em cima de outro, entra antes ou depois dele (pela metade); no vazio da coluna, vai para o fim.
function soltarProjeto(lista, id, fase, antesDe) {
  const p = lista.find(x => x.id === id);
  if (!p || id === antesDe) return false;
  lista.splice(lista.indexOf(p), 1);
  const k = lista.findIndex(x => x.id === antesDe);
  lista.splice(k < 0 ? lista.length : k, 0, p);
  return p;
}
let qArrastado = null;
$('#quadro').addEventListener('dragstart', e => {
  const it = e.target.closest?.('.q-item');
  if (!e.target.classList?.contains('pega') || !it) return;
  qArrastado = it.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
  e.dataTransfer.setDragImage(it, 16, 16);
  requestAnimationFrame(() => it.classList.add('arrastando'));
});
$('#quadro').addEventListener('dragover', e => { if (qArrastado && e.target.closest('.q-col')) e.preventDefault(); });
$('#quadro').addEventListener('drop', e => {
  const col = e.target.closest('.q-col');
  if (!qArrastado || !col) return;
  e.preventDefault();
  let alvo = e.target.closest('.q-item');
  if (alvo && e.clientY > alvo.getBoundingClientRect().top + alvo.offsetHeight / 2) alvo = alvo.nextElementSibling;
  const p = soltarProjeto(estado.projetos, qArrastado, col.dataset.fase, alvo?.dataset.id);
  if (p) mudar(p, { fase: col.dataset.fase });
});
$('#quadro').addEventListener('dragend', () => { qArrastado = null; desenharQuadro(); });

$('#formProjeto').onsubmit = e => {
  e.preventDefault();
  const nome = $('#projetoNome').value.trim();
  if (!nome) return;
  estado.projetos.push({ id: idNovo('p'), nome, fase: 'fazer', nota: '', area: areaNova(), mod: agora() });
  e.target.reset();
  salvar();
  desenhar();
};

/* ---------- busca geral ---------- */
// Procura em tarefas, diário, lembretes, atalhos, agenda, metas, projetos e notas, sem olhar a área nem acento ou maiúscula.
// ponytail: no máximo 20 achados por grupo e a página do diário mostra o começo, não o trecho achado.
const semAcento = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function desenharBusca() {
  const q = semAcento($('#buscaGeral').value.trim()), tem = s => semAcento(s).includes(q);
  const vivos = (lista, campo) => (q ? lista.filter(x => !x.apagada && tem(x[campo])).slice(0, 20) : []);
  const grupo = (titulo, classe, itens) => (itens.length ? [el('h3', { className: 'sub', textContent: `${titulo} · ${itens.length}` }), el('ul', { className: classe }, ...itens)] : []);
  const paginas = !q ? [] : Object.entries(estado.diario).filter(([, p]) => tem(p.texto)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 20);
  const achados = [
    ...grupo('Tarefas', 'tarefas', vivos(estado.tarefas, 'texto').map(linha)),
    ...grupo('Diário', 'paginas', paginas.map(([dia, p]) => el('li', {}, el('button', {
      onclick: () => { diaVisto = dia; mostrarVista('dia'); desenhar(); },
    }, el('time', { textContent: meioDia(dia).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) }), el('span', { textContent: p.texto }))))),
    ...grupo('Lembretes', 'tarefas', vivos(estado.lembretes, 'texto').map(l => el('li', { className: 'tarefa lembrete' },
      el('time', { textContent: rotuloQuando(l.quando) }), el('span', { className: 'texto', textContent: l.texto })))),
    ...grupo('Atalhos', 'links', vivos(estado.atalhos, 'nome').map(a => [a, urlSegura(a.url)]).filter(([, url]) => url)
      .map(([a, url]) => el('li', {}, el('a', { href: url, target: '_blank', rel: 'noopener', title: url, style: 'padding-right: 12px' }, iconeAtalho(url), el('span', { textContent: a.nome }))))),
    ...grupo('Agenda', 'paginas', vivos(estado.agenda, 'texto').sort((a, b) => (b.dia + b.hora).localeCompare(a.dia + a.hora))
      .map(b => achado(`${br(b.dia)} · ${b.hora}`, b.texto, () => { agendaDia = b.dia; irPara('.c-agenda'); }))),
    ...grupo('Metas', 'paginas', vivos(estado.metas, 'texto').map(m => achado(`${m.feito} de ${m.alvo}`, m.texto, () => irPara('.c-metas')))),
    ...grupo('Projetos', 'paginas', (q ? estado.projetos.filter(p => !p.apagada && tem(p.nome + ' ' + (p.nota || ''))).slice(0, 20) : [])
      .map(p => achado(FASES[faseDe(p)][1], p.nome + (p.nota ? ' · ' + p.nota : ''), () => mostrarVista('quadro')))),
    ...grupo('Notas rápidas', 'paginas', q && tem(estado.notas?.texto || '') ? [achado('Notas', estado.notas.texto, () => irPara('.c-notas'))] : []),
  ];
  if (!achados.length) achados.push(el('p', { className: 'vazio', textContent: q ? 'Nada encontrado com esse texto.' : 'Escreva para procurar em tarefas, diário, lembretes, atalhos, agenda, metas, projetos e notas.' }));
  $('#achados').replaceChildren(...achados);
}
// um achado que leva ao lugar dele
const achado = (quando, texto, ir) => el('li', {}, el('button', { onclick: ir }, el('time', { textContent: quando }), el('span', { textContent: texto })));
const irPara = cartao => { mostrarVista('painel'); desenhar(); $(cartao).scrollIntoView({ block: 'center' }); };
const abrirBusca = () => { mostrarVista('busca'); $('#buscaGeral').focus(); $('#buscaGeral').select(); };
$('#buscaGeral').oninput = desenharBusca;
$('#vistas').addEventListener('click', e => { if (e.target.dataset.ir === 'busca') abrirBusca(); });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBusca(); } });

/* ---------- notas rápidas ---------- */
// estado.notas: { texto, mod }. Um rascunho só, sem área; ao importar vence o mais recente (app.js).
$('#notas').oninput = e => { estado.notas = { texto: e.target.value, mod: agora() }; salvar(); };

/* ---------- metas ---------- */
// estado.metas: [{ id, texto, alvo, feito, ate: 'AAAA-MM-DD' | '', rep: '' | 'semana' | 'mes', periodo, area, mod, apagada }]
// Meta que se repete volta a zero quando muda a semana (começa na segunda) ou o mês; `periodo` guarda de qual período é o
// "feito". ponytail: o que foi feito nas semanas anteriores não fica guardado (seria um histórico por meta).
const andarMeta = (m, n) => Math.max(0, Math.min(m.alvo, m.feito + n));
const chavePeriodo = (rep, hoje) => (rep === 'semana' ? somaDias(hoje, -((meioDia(hoje).getDay() + 6) % 7)) : rep === 'mes' ? hoje.slice(0, 7) : '');
const NOME_REP = { semana: 'esta semana', mes: 'este mês' };

function desenharMetas() {
  const hoje = diaDe(agora());
  let zerou = false;
  for (const m of estado.metas) {
    const k = chavePeriodo(m.rep, hoje);
    if (k && m.periodo !== k) { Object.assign(m, { feito: 0, periodo: k, mod: agora() }); zerou = true; }
  }
  if (zerou) salvar();
  const metas = estado.metas.filter(m => !m.apagada && (estado.area === 'tudo' || m.area === estado.area));
  $('#metas').replaceChildren(...metas.map(m => {
    const feita = m.feito >= m.alvo;
    const passo = (n, icone, rotulo, desligado) => {
      const b = el('button', { className: 'redondo mini', title: rotulo, disabled: desligado }, ic(icone));
      b.setAttribute('aria-label', `${rotulo}: ${m.texto}`);
      b.onclick = () => mudar(m, { feito: andarMeta(m, n) });
      return b;
    };
    const apagar = el('button', { className: 'apagar', title: 'Apagar meta' }, ic('x'));
    apagar.setAttribute('aria-label', 'Apagar meta: ' + m.texto);
    apagar.onclick = () => {
      mudar(m, { apagada: true });
      aviso('Meta apagada.', 'Desfazer', () => mudar(m, { apagada: false }));
    };
    const prazo = !m.ate ? '' : ` · ${m.ate < hoje && !feita ? 'venceu em' : 'até'} ${m.ate.slice(8)}/${m.ate.slice(5, 7)}`;
    const barra = el('i');
    barra.style.width = Math.min(100, m.feito / m.alvo * 100) + '%';
    const li = el('li', { className: 'meta' },
      el('div', { className: 'meta-topo' }, el('span', { className: 'texto', textContent: m.texto }),
        el('small', { textContent: (feita ? 'Alcançada · ' : '') + `${m.feito} de ${m.alvo}` + (NOME_REP[m.rep] ? ' ' + NOME_REP[m.rep] : '') + prazo }),
        passo(-1, 'menos', 'Tirar um', m.feito <= 0), passo(1, 'mais', 'Somar um', feita), apagar),
      el('div', { className: 'barra' }, barra));
    if (feita) li.dataset.feita = '';
    return li;
  }));
  $('#vazioMetas').hidden = metas.length > 0;
}

$('#formMeta').onsubmit = e => {
  e.preventDefault();
  const texto = $('#metaTexto').value.trim(), alvo = Math.round(+$('#metaAlvo').value);
  if (!texto || !(alvo >= 1)) return;
  const rep = $('#metaRep').value;
  estado.metas.push({ id: idNovo('m'), texto, alvo, feito: 0, ate: $('#metaAte').value, rep, periodo: chavePeriodo(rep, diaDe(agora())), area: areaNova(), mod: agora() });
  e.target.reset();
  salvar();
  desenhar();
};

/* ---------- calendário do mês ---------- */
let mesVisto = diaDe(agora()).slice(0, 7), diaMes = diaDe(agora()); // 'AAAA-MM' na tela e o dia escolhido
const folga = (ano, mes) => (new Date(ano, mes - 1, 1).getDay() + 6) % 7; // casas vazias antes do dia 1 (semana começa na segunda)

function desenharMes() {
  const hoje = diaDe(agora());
  const pend = estado.tarefas.filter(t => !t.apagada && !t.feitaEm && t.data && (estado.area === 'tudo' || t.area === estado.area));
  const [ano, mes] = mesVisto.split('-').map(Number);
  const celulas = [...'STQQSSD'].map(l => el('span', { className: 'mes-sem', textContent: l, ariaHidden: 'true' }));
  for (let i = folga(ano, mes); i > 0; i--) celulas.push(el('span'));
  for (let d = 1, fim = new Date(ano, mes, 0).getDate(); d <= fim; d++) {
    const iso = mesVisto + '-' + dois(d), n = pend.filter(t => t.data === iso).length;
    const atrasada = n && iso < hoje;
    const b = el('button', { className: 'mes-dia', onclick: () => { diaMes = iso; desenharMes(); } }, String(d), n ? el('small', { textContent: n }) : '');
    b.setAttribute('aria-pressed', iso === diaMes);
    b.setAttribute('aria-label', d + (n ? `, ${n} ${n > 1 ? 'prazos' : 'prazo'}${atrasada ? ', atrasado' : ''}` : ''));
    if (n) b.title = `${n} ${n > 1 ? 'prazos' : 'prazo'}${atrasada ? ' · atrasado' : ''}`;
    if (iso === hoje) b.dataset.hoje = '';
    if (atrasada) b.dataset.atrasada = '';
    celulas.push(b);
  }
  $('#mes').replaceChildren(...celulas);
  $('#mesRotulo').textContent = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const doDia = pend.filter(t => t.data === diaMes);
  $('#mesDia').textContent = meioDia(diaMes).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#mesTarefas').replaceChildren(...doDia.map(linha));
  $('#mesVazio').hidden = doDia.length > 0;
}
const andarMes = n => {
  const [ano, mes] = mesVisto.split('-').map(Number);
  mesVisto = diaDe(new Date(ano, mes - 1 + n, 1)).slice(0, 7);
  desenharMes();
};
$('#mesAntes').onclick = () => andarMes(-1);
$('#mesDepois').onclick = () => andarMes(1);

$('#agendaHora').value = dois(Math.min(new Date().getHours() + 1, 23)) + ':00';
$('#formAgenda').onsubmit = e => {
  e.preventDefault();
  const texto = $('#agendaTexto').value.trim(), hora = $('#agendaHora').value;
  if (!texto || !hora) return;
  const aviso = avisoDe($('#agendaAviso').value, agendaDia, hora, $('#agendaAvisoHora').value);
  estado.agenda.push({ id: idNovo('g'), dia: agendaDia, hora, min: +$('#agendaMin').value || 0, aviso, avisoFeito: false, texto, area: areaNova(), mod: agora() });
  $('#agendaTexto').value = '';
  salvar();
  desenhar();
};

$('#agendaAviso').onchange = e => { $('#agendaAvisoHora').hidden = e.target.value !== 'outro'; };
const andarAgenda = n => { agendaDia = n ? somaDias(agendaDia, n) : diaDe(agora()); desenharAgenda(); };
$('#agAntes').onclick = () => andarAgenda(-1);
$('#agDepois').onclick = () => andarAgenda(1);
$('#agRotulo').onclick = () => andarAgenda(0);

$('#formAtalho').onsubmit = e => {
  e.preventDefault();
  const nome = $('#atalhoNome').value.trim(), url = urlSegura($('#atalhoUrl').value);
  if (!nome) return;
  if (!url) return aviso('Esse endereço não serve. Use um link (https://…) ou o caminho de uma pasta ou arquivo.');
  estado.atalhos.push({ id: idNovo('k'), nome, url, area: areaNova(), mod: agora() });
  e.target.reset();
  salvar();
  desenhar();
};

/* ---------- fechamento do dia ---------- */
// Escreve o resumo de hoje no fim da página do diário e passa para amanhã as tarefas pendentes com prazo até hoje.
// Vale para todas as áreas (o dia é um só). Tem Desfazer.
function textoFechamento(feitas, min, habitos, adiadas) {
  const linhas = [`Fechamento do dia: ${feitas.length} ${feitas.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'}, ${min} min de foco, ${habitos} ${habitos === 1 ? 'hábito feito' : 'hábitos feitos'}.`];
  if (feitas.length) linhas.push('Feito: ' + feitas.join('; ') + '.');
  if (adiadas.length) linhas.push('Ficou para amanhã: ' + adiadas.join('; ') + '.');
  return linhas.join('\n');
}
$('#fecharDia').onclick = () => {
  const hoje = diaDe(agora()), amanha = somaDias(hoje, 1), vivas = estado.tarefas.filter(t => !t.apagada);
  const feitas = vivas.filter(t => t.feitaEm && diaDe(t.feitaEm) === hoje);
  const adiar = vivas.filter(t => !t.feitaEm && t.data && t.data <= hoje);
  const min = estado.sessoes.filter(s => !s.apagada && diaDe(s.inicio) === hoje).reduce((n, s) => n + s.min, 0);
  const habitos = estado.habitos.filter(h => !h.apagada && h.dias[hoje] > 0).length;
  const antes = { texto: estado.diario[hoje]?.texto || '', datas: adiar.map(t => t.data) };
  for (const t of adiar) Object.assign(t, { data: amanha, mod: agora() });
  escrever(hoje, (antes.texto.trim() ? antes.texto.trimEnd() + '\n\n' : '') + textoFechamento(feitas.map(t => t.texto), min, habitos, adiar.map(t => t.texto)));
  salvar();
  desenhar();
  aviso(`Dia fechado.${adiar.length ? ` ${adiar.length} ${adiar.length === 1 ? 'tarefa foi' : 'tarefas foram'} para amanhã.` : ''}`, 'Desfazer', () => {
    adiar.forEach((t, i) => Object.assign(t, { data: antes.datas[i], mod: agora() }));
    escrever(hoje, antes.texto);
    salvar();
    desenhar();
  });
};

setInterval(desenharAgenda, 60000); // a hora de agora anda mesmo com a página parada
desenharAgenda();

/* ---------- autoteste ---------- */
if (location.hash === '#teste') {
  console.assert(urlSegura('javascript:alert(1)') === '' && urlSegura('data:text/html,x') === '', 'atalho só aceita http, https e file');
  console.assert(urlSegura(' exemplo.com/a ') === 'https://exemplo.com/a', 'sem esquema vira https');
  console.assert(urlSegura('C:\\pasta\\a b.txt') === 'file:///C:/pasta/a%20b.txt', 'caminho do Windows', urlSegura('C:\\pasta\\a b.txt'));
  console.assert(urlSegura('\\\\servidor\\pasta') === 'file://servidor/pasta', 'caminho de rede', urlSegura('\\\\servidor\\pasta'));
  console.assert(folga(2026, 11) === 6 && folga(2026, 6) === 0, 'calendário: casas vazias antes do dia 1');
  console.assert(andarMeta({ alvo: 3, feito: 3 }, 1) === 3 && andarMeta({ alvo: 3, feito: 0 }, -1) === 0 && andarMeta({ alvo: 3, feito: 1 }, 1) === 2, 'meta fica entre 0 e o alvo');
  console.assert(semAcento('Relatório ÚNICO').includes(semAcento('relatorio unico')), 'busca ignora acento e maiúscula');
  console.assert(moverFase({ fase: 'fazer' }, 1) === 'andamento' && moverFase({ fase: 'feito' }, 1) === 'feito' && moverFase({ fase: 'fazer' }, -1) === 'fazer' && faseDe({ fase: 'xx' }) === 0, 'quadro: fases não passam das pontas');
  console.assert([0, 99, 100, 299, 300, 600].map(nivelDe).join() === '1,1,2,2,3,4' && pisoNivel(3) === 300, 'níveis de XP');
  console.assert(textoFechamento(['a', 'b'], 50, 1, ['c']) === 'Fechamento do dia: 2 tarefas concluídas, 50 min de foco, 1 hábito feito.\nFeito: a; b.\nFicou para amanhã: c.'
    && !textoFechamento([], 0, 0, []).includes('\n'), 'texto do fechamento do dia');
  console.assert(chavePeriodo('semana', '2026-11-19') === '2026-11-16' && chavePeriodo('semana', '2026-11-16') === '2026-11-16'
    && chavePeriodo('mes', '2026-11-19') === '2026-11' && chavePeriodo('', '2026-11-19') === '', 'metas: período da semana (segunda) e do mês');
  console.assert(deMin(emMin('09:30') + 90) === '11:00', 'agenda: hora de fim pela duração');
  const lp = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  console.assert(soltarProjeto(lp, 'c', 'fazer', 'a') && lp.map(x => x.id).join() === 'c,a,b' && soltarProjeto(lp, 'c', 'fazer') && lp.map(x => x.id).join() === 'a,b,c'
    && !soltarProjeto(lp, 'a', 'fazer', 'a'), 'quadro: soltar antes de outro ou no fim');
  console.assert(avisoDe('', '2026-11-18', '09:30') === 0 && avisoDe('10', '2026-11-18', '09:30') === quandoDe('2026-11-18', '09:20')
    && avisoDe('outro', '2026-11-18', '09:30', '08:05') === quandoDe('2026-11-18', '08:05') && avisoDe('outro', '2026-11-18', '09:30', '') === 0, 'aviso da agenda: antes do bloco ou na hora escrita');
  const casos = {
    'file:///C:/Processos/Planilha%20de%20exemplo.xlsx': 'microsoft-excel', 'file:///C:/Processos/Pasta%20de%20exemplo': 'folder-outline',
    'file://servidor/compartilhado/': 'folder-outline', 'file:///C:/a/b.zip': 'file-outline', 'https://exemplo.com/relatorio.pdf': 'file-pdf-box',
    'https://docs.google.com/spreadsheets/d/abc/edit': 'google-spreadsheet', 'https://drive.google.com/drive/folders/abc': 'google-drive',
    'https://empresa.sharepoint.com/:x:/r/Doc.aspx?file=Exemplo.xlsx': 'microsoft-excel', 'https://www.youtube.com/watch?v=x': 'youtube',
    'https://sei.exemplo.gov.br/': 'bank-outline', 'https://exemplo.com/': 'web', 'lixo': 'web',
  };
  for (const [url, esperado] of Object.entries(casos)) console.assert(iconeDe(url) === esperado, 'ícone do atalho', url, iconeDe(url));
  console.assert(Object.values(casos).concat(Object.values(ICONE_EXT), ICONE_SITE.map(r => r[1])).every(n => document.getElementById('i-k-' + n)), 'todo ícone usado existe no index');
  console.log('autoteste da agenda concluído');
}
