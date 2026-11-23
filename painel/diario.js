'use strict';
// Etapa 4: diário — uma página por dia. Carrega depois de app.js.
// estado.diario = { 'AAAA-MM-DD': { texto, mod } }
// A página de hoje fica no painel; a de qualquer dia, na tela Dia; a tela Diário lista e busca todas.

const ROTEIRO = 'O que foi bem:\n\n\nO que pode melhorar:\n\n\nAmanhã eu vou:\n';
let tSalvar;

// Salva enquanto digita (com um respiro de 400 ms) e ao sair da página.
function escrever(dia, texto) {
  estado.diario[dia] = { texto, mod: agora() };
  clearTimeout(tSalvar);
  tSalvar = setTimeout(salvar, 400);
}
window.addEventListener('pagehide', salvar);

// ponytail: se o MESMO dia for escrito nos dois computadores sem importar no meio, vence a versão mais recente
// (a outra se perde). Para juntar os dois textos seria preciso guardar a versão-base de cada página.
function mesclarDiario(nosso, deles) {
  const r = { ...nosso };
  for (const [d, p] of Object.entries(deles)) if (!r[d] || p.mod > r[d].mod) r[d] = p;
  return r;
}

// Chamado por desenhar() (app.js) e a cada tecla.
function desenharDiario() {
  for (const [id, dia] of [['diarioHoje', diaDe(agora())], ['diarioDia', diaVisto]]) {
    const e = $('#' + id), texto = estado.diario[dia]?.texto || '';
    e.dataset.dia = dia;
    if (document.activeElement !== e) e.value = texto;
    document.querySelector(`[data-roteiro="${id}"]`).hidden = !!texto.trim();
  }

  const busca = $('#buscaDiario').value.trim().toLowerCase();
  const paginas = Object.entries(estado.diario)
    .filter(([, p]) => p.texto.trim() && p.texto.toLowerCase().includes(busca))
    .sort(([a], [b]) => b.localeCompare(a));
  $('#paginas').replaceChildren(...paginas.map(([d, p]) => {
    const data = meioDia(d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const b = el('button', {}, el('time', { textContent: data }), el('span', { textContent: p.texto.trim().slice(0, 220) }));
    b.onclick = () => { diaVisto = d; mostrarVista('dia'); desenhar(); };
    return el('li', {}, b);
  }));
  $('#vazioPaginas').textContent = paginas.length ? '' : busca ? 'Nenhuma página com esse texto.' : 'Nenhuma página escrita ainda.';
}

document.addEventListener('input', e => {
  if (e.target.classList.contains('pagina')) { escrever(e.target.dataset.dia, e.target.value); desenharDiario(); }
  if (e.target.id === 'buscaDiario') desenharDiario();
});
document.addEventListener('click', e => {
  const id = e.target.closest('[data-roteiro]')?.dataset.roteiro;
  if (!id) return;
  const campo = $('#' + id);
  campo.value = ROTEIRO;
  escrever(campo.dataset.dia, ROTEIRO);
  desenharDiario();
  campo.focus();
  campo.setSelectionRange(16, 16); // logo abaixo de "O que foi bem:"
});

desenhar();

if (location.hash === '#teste') {
  const m = mesclarDiario({ a: { texto: 'velho', mod: 1 }, b: { texto: 'meu', mod: 5 } }, { a: { texto: 'novo', mod: 2 }, b: { texto: 'antigo', mod: 3 }, c: { texto: 'outro', mod: 1 } });
  console.assert(m.a.texto === 'novo' && m.b.texto === 'meu' && m.c.texto === 'outro', 'mesclarDiario: por dia, o mais recente');
  console.log('autoteste do diário concluído');
}
