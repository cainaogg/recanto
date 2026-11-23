// Roda dentro da página do dashboard (file://). A página sozinha não fala com a extensão, então esta ponte leva e traz:
// a cada segundo pede ao fundo.js o que toca no Spotify e entrega à página; os cliques nos controles vão no sentido contrário.
// Só age na página do dashboard (a que tem a faixa #musica); em outros arquivos locais não faz nada.
// Também roda como script comum dentro da página, quando o painel vem dentro da extensão (pacote em releases/): por isso o
// teste do chrome.runtime (aberta fora da extensão, a página não tem como falar com ela e a ponte não faz nada).
if (globalThis.chrome?.runtime?.sendMessage && document.getElementById('musica')) {
  const pedir = comando => chrome.runtime.sendMessage({ tipo: 'musica', comando })
    .then(m => window.postMessage({ de: 'extensao-dashboard', musica: m ?? null }, '*'))
    .catch(() => {}); // extensão recarregada: esta ponte antiga para de funcionar até a página recarregar
  pedir();
  setInterval(() => { if (!document.hidden) pedir(); }, 1000);
  window.addEventListener('message', e => {
    if (e.source === window && e.data?.de === 'dashboard-pagina' && ['anterior', 'tocar', 'proxima', 'abrir'].includes(e.data.comando)) pedir(e.data.comando);
  });
}
