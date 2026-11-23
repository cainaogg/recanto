# Sons

O Recanto vem sem áudios (cada pessoa usa os seus). Sem eles, o alarme do relógio toca um apito gerado pela própria página.

## Sons de fundo (botão "Sons" na barra lateral)
1. Ponha os arquivos (.mp3, .ogg) em subpastas de `Sons ambiente/`, uma por tipo: `Sons ambiente/Chuva/`, `Sons ambiente/Café/`…
2. Liste-os em `lista.js`, assim:

```js
const SONS_LISTA = [
  ["chuva", "Chuva", ["Chuva/chuva-1.mp3", "Chuva/chuva-2.mp3"]],
  ["cafe", "Café", ["Café/cafe-1.mp3"]],
];
```

3. Recarregue a extensão em `chrome://extensions`. Ao ligar um tipo, toca um dos arquivos dele, sorteado, em laço.

## Som do alarme
Ponha o arquivo em `Alarme Pomodoro/` e escreva o caminho em `ALARME_PADRAO`, no começo de `tempo.js`
(ou use "Usar meu som" nos Ajustes do relógio, que não exige mexer em arquivo).

Sites como a Pixabay (pixabay.com/sound-effects) têm sons gratuitos de chuva, café, lareira, trem etc.
