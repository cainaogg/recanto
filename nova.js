// Leva a nova aba para o dashboard (o caminho fica em caminho.js).
chrome.tabs.getCurrent(aba => chrome.tabs.update(aba.id, { url: DASHBOARD }));
