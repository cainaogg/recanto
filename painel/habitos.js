'use strict';
// Etapa 3: hábitos (grade semanal). Carrega depois de app.js.
// Hábito: { id, nome, area, dias: { 'AAAA-MM-DD': carimbo }, mod, apagada }
// O carimbo é a hora da marcação: positivo = feito, negativo = desmarcado. Assim, ao mesclar
// dois computadores, cada DIA é decidido por quem mexeu por último (e desmarcar também viaja).

const DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
let semana = 0; // 0 = esta semana, -1 = a anterior…

const somaDias = (iso, n) => { const d = meioDia(iso); d.setDate(d.getDate() + n); return diaDe(d); };
const feitoEm = (h, d) => h.dias[d] > 0;

// Dias seguidos até hoje. Se hoje ainda não foi marcado, a sequência de ontem continua valendo.
function sequencia(h, hoje) {
  let d = feitoEm(h, hoje) ? hoje : somaDias(hoje, -1), n = 0;
  while (feitoEm(h, d)) { n++; d = somaDias(d, -1); }
  return n;
}

function mesclarHabitos(nossos, deles) {
  const porId = new Map(nossos.map(h => [h.id, h]));
  for (const h of deles) {
    const n = porId.get(h.id);
    if (!n) { porId.set(h.id, h); continue; }
    const dias = { ...n.dias };
    for (const [d, v] of Object.entries(h.dias)) if (!(d in dias) || Math.abs(v) > Math.abs(dias[d])) dias[d] = v;
    porId.set(h.id, { ...(h.mod > n.mod ? h : n), dias });
  }
  return [...porId.values()];
}

// Chamado por desenhar() (app.js).
function desenharHabitos() {
  const hoje = diaDe(agora());
  const habitos = estado.habitos.filter(h => !h.apagada && (estado.area === 'tudo' || h.area === estado.area));
  const segunda = somaDias(hoje, -((meioDia(hoje).getDay() + 6) % 7) + semana * 7);
  const dias = DIAS_SEMANA.map((_, i) => somaDias(segunda, i));

  const cabeca = el('div', { className: 'hab-linha hab-cabeca' }, el('span'),
    ...dias.map((d, i) => el('span', { className: 'hab-dia' + (d === hoje ? ' hoje' : '') }, el('b', { textContent: d.slice(8) }), DIAS_SEMANA[i])),
    el('span'), el('span'));

  const linhas = habitos.map(h => {
    const nome = el('span', { className: 'texto', textContent: h.nome, contentEditable: 'true', spellcheck: false });
    nome.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); nome.blur(); } };
    nome.onblur = () => {
      const v = nome.textContent.trim();
      nome.textContent = v || h.nome;
      if (v && v !== h.nome) mudar(h, { nome: v }, false);
    };
    const caixas = dias.map(d => {
      const b = el('button', { className: 'caixa', disabled: d > hoje, title: d > hoje ? 'Ainda não chegou' : feitoEm(h, d) ? 'Desmarcar' : 'Marcar' }, ic('check'));
      b.setAttribute('aria-pressed', feitoEm(h, d));
      if (h.dias[d] > 0 && agora() - h.dias[d] < 1000) b.classList.add('recem'); // acabou de marcar: o visto se desenha
      b.setAttribute('aria-label', `${h.nome}, ${d.slice(8)}/${d.slice(5, 7)}`);
      b.onclick = () => {
        h.dias[d] = feitoEm(h, d) ? -agora() : agora();
        salvar();
        desenhar();
      };
      return b;
    });
    const seq = sequencia(h, hoje);
    const apagar = el('button', { className: 'apagar', title: 'Apagar hábito' }, ic('x'));
    apagar.onclick = () => {
      mudar(h, { apagada: true });
      aviso('Hábito apagado.', 'Desfazer', () => mudar(h, { apagada: false }));
    };
    return el('div', { className: 'hab-linha' }, nome, ...caixas,
      el('span', { className: 'hab-seq' + (seq >= 3 ? ' forte' : ''), textContent: seq ? `${seq} ${seq > 1 ? 'dias' : 'dia'}` : '', title: 'Dias seguidos' }), apagar);
  });

  $('#habitosGrade').replaceChildren(...(habitos.length ? [cabeca, ...linhas] : []));
  $('#vazioHabitos').hidden = habitos.length > 0;
  $('#semRotulo').textContent = semana === 0 ? 'Esta semana' : `${dias[0].slice(8)}/${dias[0].slice(5, 7)} a ${dias[6].slice(8)}/${dias[6].slice(5, 7)}`;
  $('#semDepois').disabled = semana >= 0;

  const feitosHoje = habitos.filter(h => feitoEm(h, hoje)).length;
  $('#habitosAnel').hidden = !habitos.length;
  $('#habitosAnel').style.setProperty('--p', habitos.length ? feitosHoje / habitos.length : 0);
  $('#habitosHoje').textContent = `${feitosHoje}/${habitos.length}`;
  $('#kHabitos').textContent = habitos.length ? `${feitosHoje} de ${habitos.length}` : 'Nenhum';
  $('#kHabitosBarra').style.width = (habitos.length ? feitosHoje / habitos.length * 100 : 0) + '%';

  // tela Dia: hábitos feitos no dia visto
  const noDia = habitos.filter(h => feitoEm(h, diaVisto));
  $('#habitosDia').replaceChildren(...noDia.map(h => el('span', { textContent: h.nome })));
  $('#habitosDia').hidden = !noDia.length;
  if (noDia.length) {
    const r = $('#resumoDia'), antes = r.textContent.startsWith('Nada') ? '' : r.textContent + ' · ';
    r.textContent = antes + `${noDia.length} ${noDia.length > 1 ? 'hábitos' : 'hábito'}`;
  }
}

$('#formHabito').onsubmit = e => {
  e.preventDefault();
  const nome = $('#habitoNome').value.trim();
  if (!nome) return;
  estado.habitos.push({
    id: 'h' + agora().toString(36) + Math.random().toString(36).slice(2, 6), nome,
    area: estado.area === 'tudo' ? estado.ultimaArea : estado.area, dias: {}, mod: agora(),
  });
  $('#habitoNome').value = '';
  salvar();
  desenhar();
};
$('#semAntes').onclick = () => { semana--; desenhar(); };
$('#semDepois').onclick = () => { semana++; desenhar(); };

desenhar();

if (location.hash === '#teste') {
  const h = { dias: { '2026-01-03': 5, '2026-01-04': 5, '2026-01-05': -9, '2026-01-01': 5 } };
  console.assert(sequencia(h, '2026-01-05') === 2, 'sequencia: hoje desmarcado, vale a de ontem');
  console.assert(sequencia(h, '2026-01-04') === 2 && sequencia(h, '2026-01-07') === 0, 'sequencia: conta seguidos e zera após um buraco');
  const m = mesclarHabitos([{ id: 'a', nome: 'velho', mod: 1, dias: { d1: 10, d2: 10 } }], [{ id: 'a', nome: 'novo', mod: 2, dias: { d1: -20, d3: 5 } }])[0];
  console.assert(m.nome === 'novo' && m.dias.d1 === -20 && m.dias.d2 === 10 && m.dias.d3 === 5, 'mesclarHabitos: cada dia pelo carimbo mais recente');
  console.log('autoteste dos hábitos concluído');
}
