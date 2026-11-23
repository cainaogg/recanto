// Roda dentro da aba do Spotify (open.spotify.com). Responde ao fundo.js: o que está tocando, a anterior e a próxima e,
// se pedido, aperta um botão. Música e artista vêm do que o Spotify informa ao navegador (Media Session, o mesmo dos
// controles de mídia do Windows); tempo, botões e a próxima vêm da página dele. Se o Spotify mudar a página, é aqui que se
// ajusta (os data-testid e os títulos em lerProxima).

// Próxima, lida da página (não traz a duração). Serve para os dois lugares onde o Spotify mostra o que vem:
// o painel "A seguir" da visão "Tocando agora" e a tela "Fila" ("Próximas na fila" / "Próximas de: <playlist>").
// Pega o primeiro desses títulos e lê as duas linhas seguintes: música e artista.
function lerProxima(doc) {
  const TITULO = /^(pr[oó]xima?s? (de\b|na fila)|a seguir|next (from|in queue|up))/i;
  const candidatos = [...doc.querySelectorAll('h2, h3, h4, div, span, p')].filter(e => {
    const t = e.textContent.trim();
    return t.length < 80 && TITULO.test(t) && (e.checkVisibility?.() ?? true); // só o que está à vista
  });
  const titulo = candidatos.find(e => !candidatos.some(o => o !== e && e.contains(o))); // o mais interno, o primeiro da página
  if (!titulo) return null;
  const sobra = l => !l || l.length < 2 || TITULO.test(l) || /^(abrir fila|open queue|videoclipe|music video|•)$/i.test(l);
  for (let caixa = titulo.parentElement, i = 0; caixa && i < 6; caixa = caixa.parentElement, i++) {
    const linhas = caixa.innerText.split('\n').map(l => l.trim());
    const k = linhas.findIndex(l => TITULO.test(l));
    const resto = linhas.slice(k + 1).filter(l => !sobra(l));
    if (k >= 0 && resto.length >= 2) return { musica: resto[0], artista: resto[1].replace(/^(videoclipe|music video)\s*•\s*/i, '').replace(/^E\s+(?=\S)/, '') }; // tira o selo "E" (explícita)
  }
  return null;
}

// Pode ser injetado de novo (fundo.js faz isso numa aba aberta antes da extensão): o "if" evita registrar duas vezes.
if (globalThis.chrome?.runtime?.onMessage && !globalThis.dashboardSpotify) {
  globalThis.dashboardSpotify = true;
  const achar = s => document.querySelector(s);
  const texto = s => achar(s)?.textContent.trim() || '';
  const BOTOES = { anterior: 'control-button-skip-back', tocar: 'control-button-playpause', proxima: 'control-button-skip-forward' };
  let atual = null, antes = null; // a anterior é a última que tocou nesta aba (guardada quando a música muda)

  const estado = () => {
    const md = navigator.mediaSession?.metadata;
    const musica = md?.title || texto('[data-testid="context-item-info-title"]') || texto('[data-testid="context-item-link"]');
    if (!musica) return null;
    const artista = md?.artist || texto('[data-testid="context-item-info-subtitles"]') || texto('[data-testid="now-playing-widget-v2-byline"]');
    const duracao = texto('[data-testid="playback-duration"]');
    const chave = artista + '|' + musica;
    if (atual && atual.chave !== chave) antes = { musica: atual.musica, artista: atual.artista, duracao: atual.duracao };
    if (!atual || atual.chave !== chave || duracao) atual = { chave, musica, artista, duracao: duracao || atual?.duracao || '' };
    const botao = achar(`[data-testid="${BOTOES.tocar}"]`)?.getAttribute('aria-label') || '';
    return {
      musica, artista, duracao,
      posicao: texto('[data-testid="playback-position"]'),
      tocando: navigator.mediaSession?.playbackState === 'playing' || /pausar|pause/i.test(botao),
      antes, proxima: lerProxima(document),
    };
  };

  // de tempos em tempos, para a anterior ser lembrada mesmo com o dashboard fechado
  setInterval(estado, 3000);

  chrome.runtime.onMessage.addListener((msg, _, responder) => {
    if (msg.tipo === 'comando' && BOTOES[msg.comando]) achar(`[data-testid="${BOTOES[msg.comando]}"]`)?.click();
    if (msg.tipo === 'estado' || msg.tipo === 'comando') responder(estado());
  });
}
