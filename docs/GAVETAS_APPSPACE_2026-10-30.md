# Gavetas de aplicativos e revisão de fluidez

Base: `245a840302d91f5cf214e3d8618d36304c9906f5` (conteúdo OTA 0.7.14).

## Mudança visível

As pastas Estoque, Edição de vídeo e Meu PC usam uma gaveta com ícones, nomes, pesquisa e ordenação A–Z/Z–A. Em vez de grandes cartões, a grade mostra quatro colunas em celulares comuns, três abaixo de 360 px e seis em telas maiores. As preferências de tema e navegação são preservadas.

- Estoque: Etiqueta Studio e acesso direto à ferramenta existente Etiquetas em lote.
- Meu PC: PC Monitor na grade; conexão Wi-Fi/USB num painel expansível. Tocar no monitor sem conexão abre o painel e posiciona o foco no IP.
- Edição de vídeo: estado vazio, sem aplicativos fictícios.
- Busca ignora maiúsculas/acentos e inclui nomes e palavras-chave; consulta e ordem sobrevivem à navegação na mesma sessão.
- Os links continuam sendo HTML local, utilizáveis offline; não há dependências visuais externas.

## Fluidez e bugs

| Antes | Depois |
| --- | --- |
| Launcher recriava seus ícones ao cruzar o breakpoint. | Preserva os mesmos nós; reconstrói apenas a ordem quando necessário. |
| Pesquisa normalizava texto dos ícones repetidamente. | As chaves dos ícones e apps são preparadas uma vez. O filtro da pasta agrupa entradas com requestAnimationFrame. |
| Atalhos Apps/Pastas podiam apontar para uma seção oculta. | Resolve o destino conforme o layout visível, inclusive links antigos #apps e volta de pastas. |
| Busca clássica incluía apps ocultos, podendo ocultar o aviso de nenhum resultado. | A Home filtra as pastas realmente exibidas. |
| Tecla / focava busca oculta no mobile minimalista. | Foca a busca visível. |
| Pareamento/troca de IP podiam terminar depois de Desconectar e salvar novamente o token. | A geração da operação invalida respostas após cancelamento. |
| Teste de conexão podia exibir Online após desconectar. | A interface descarta resultados da sessão encerrada. |
| Brilhos com blur e hover de desktop no toque. | Remove pintura de brilho no mobile e mantém feedback curto; respeita efeitos reduzidos e preferência do sistema. |

Não há alegação de ganho percentual de FPS: desempenho em aparelho físico ainda precisa de medição. A mudança reduz trabalho de DOM e pintura identificado no código.

## Verificação e aplicação

`npm run check` e `git diff --check` passam localmente. A suíte existente continua ativa, com casos adicionais de desconexão durante pareamento/troca de rede.

`scripts/test-drawer-browser.cjs` é executado no job Chromium do workflow. Cobre cinco tamanhos (320, 360, 412, 844 e 1280 px), dois temas, os dois modos de navegação, pesquisa/limpeza/ordenação, retorno pelo histórico, estabilidade dos ícones, conexão do PC e abertura offline do editor. Capturas e resultado ficam no artifact `AppSpace-Drawer-UI`; consulte o resultado do PR para o estado final do CI.

Teste manual recomendado no Android: abrir cada pasta, pesquisar e limpar, abrir o lote e voltar, tocar no monitor sem conexão, parear, desconectar durante uma tentativa e conferir que não retorna a Online. Verificar teclado, rolagem e gesto Voltar do aparelho. Wi-Fi/USB e impressão física continuam exigindo os dispositivos correspondentes.

Este patch altera conteúdo web e testes. Não modifica o ponteiro `ota/latest.json` nem cria release automaticamente. Após integração, pode ser entregue por uma nova versão OTA para a base nativa compatível ou por novo APK/EXE. Reversão de código: `git revert` do commit/merge deste PR; não é necessário limpar dados ou preferências dos usuários.
