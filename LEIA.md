# Recanto

Painel pessoal que abre em toda nova aba do Chrome (ou do Edge): tarefas com prioridade e "três do dia", pomodoro e
temporizador, agenda com aviso, lembretes, hábitos, metas, diário, quadro de projetos, gráficos, busca, 17 temas,
sons de fundo e o que está tocando no Spotify aberto no navegador. Funciona sem internet; os dados ficam só neste navegador.

## Instalar
1. Descompacte o .zip numa pasta que não vá ser apagada (por exemplo, Documentos).
2. Abra `chrome://extensions` (no Edge, `edge://extensions`) e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta **Recanto** (a que tem o `manifest.json`).
4. Abra uma nova aba (Ctrl+T). Na primeira vez o Chrome pode perguntar se você quer manter a página de nova aba da extensão:
   escolha manter.

## Atalhos
- **Ctrl+Shift+1**: captura rápida (anota uma tarefa de qualquer programa, com o Chrome aberto).
- **Ctrl+Shift+2**: notas rápidas.
- Para valerem fora do Chrome, em `chrome://extensions/shortcuts` marque cada um como **Global**.
- Dentro do painel: **/** vai para a captura, **1 a 5** trocam de painel, **Ctrl+K** abre a busca.

## Spotify
Com o Spotify aberto numa aba (open.spotify.com), aparece no topo a música atual, a que tocou e a próxima, com controles
ao passar o mouse. A próxima aparece quando o painel "Tocando agora" ou a "Fila" do Spotify estão abertos.

## Sons
O pacote não traz áudios: veja `painel/sons/LEIA.md` para pôr os seus.

## Seus dados
Ficam guardados no próprio navegador. Para levar a outro computador ou guardar uma cópia, use **Aparência → Dados →
Exportar dados** e, no outro, **Importar dados**. Remover a extensão apaga os dados: exporte antes.

## Avisos
- Atalhos para pastas e arquivos do computador (C:\...) só abrem se você ligar **Permitir acesso a URLs de arquivo**
  nos detalhes da extensão.
- O Chrome pode mostrar, ao abrir, um aviso sobre extensões em modo de desenvolvedor: é só fechar.
- Ícones: Material Design Icons (Apache 2.0). Fonte do tema Pixel: Pixelify Sans (OFL), em `painel/fontes`.
