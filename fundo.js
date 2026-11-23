// Atalhos globais (funcionam com o Chrome minimizado, desde que ele esteja aberto): trazem o dashboard para a frente já no
// lugar certo. A página lê o fim do endereço (#captura ou #notas) e põe o cursor lá (app.js: acaoDoEndereco).
// Se já houver uma aba do dashboard, usa ela; senão abre uma.
importScripts('caminho.js');

// Tocando agora: a ponte (ponte.js, na página do dashboard) pergunta; aqui se acha a aba do Spotify e se repassa.
// Aba do Spotify aberta antes de a extensão ser carregada ainda não tem o spotify.js: injeta e tenta de novo.
chrome.runtime.onMessage.addListener((msg, _, responder) => {
  if (msg.tipo !== 'musica') return;
  (async () => {
    const [aba] = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
    if (!aba) return responder(null);
    if (msg.comando === 'abrir') { // clique no nome da música: traz a aba do Spotify para a frente
      await chrome.tabs.update(aba.id, { active: true });
      await chrome.windows.update(aba.windowId, { focused: true });
      msg.comando = undefined; // e responde com o estado, como num pedido comum
    }
    const pedido = msg.comando ? { tipo: 'comando', comando: msg.comando } : { tipo: 'estado' };
    try { responder(await chrome.tabs.sendMessage(aba.id, pedido)); } catch {
      try {
        await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ['spotify.js'] });
        responder(await chrome.tabs.sendMessage(aba.id, pedido));
      } catch { responder(null); }
    }
  })();
  return true; // a resposta vem depois (assíncrona)
});

chrome.commands.onCommand.addListener(async comando => {
  const alvo = DASHBOARD + '#' + comando;
  const aba = (await chrome.tabs.query({})).find(t => t.url?.startsWith(DASHBOARD));
  if (aba) {
    await chrome.tabs.update(aba.id, { active: true, url: alvo });
    await chrome.windows.update(aba.windowId, { focused: true });
    return;
  }
  const janela = await chrome.windows.getLastFocused().catch(() => null);
  if (!janela) return chrome.windows.create({ url: alvo, focused: true });
  await chrome.tabs.create({ url: alvo, windowId: janela.id });
  await chrome.windows.update(janela.id, { focused: true });
});
