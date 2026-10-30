# AppSpace — portal local de aplicativos (v0.6)

Portal em **HTML, CSS e JavaScript puro**. Foi adicionado ao repositório `apk` sem remover ou alterar o projeto Android R410 Control Center que já existia.

## O que já está disponível

- Tela inicial responsiva (desktop, celular em retrato e paisagem).
- Um card de demonstração: **Primeiro app**, com status **Em breve**.
- Página independente do primeiro app em `apps/primeiro-app/index.html`, com botão de retorno.
- Barra lateral no PC e navegação inferior no celular.
- Tema claro/escuro, quatro cores de destaque, modo compacto e nível de efeitos visuais.
- Sons opcionais de interface com volume ajustável, sintetizados por Web Audio sem recursos externos.
- Campo de busca (atalho `/`; `Esc` limpa a busca).
- Layout acessível com links nativos, teclado e preferência por movimento reduzido.
- Nenhuma biblioteca, CDN, fonte externa, API ou login obrigatório.

## Como executar

### Computador

1. Baixe o repositório (Code → Download ZIP) e **extraia a pasta inteira**.
2. Abra o arquivo `index.html` no Chrome, Edge, Firefox ou outro navegador moderno.
3. Navegue pelo card até a página do primeiro aplicativo.

Não precisa instalar Node, npm, servidor, Gradle ou Android Studio para usar o **portal web**.

### Celular Android

1. Baixe e extraia o ZIP mantendo a estrutura de pastas.
2. Abra `index.html` em um navegador que permita abrir arquivos HTML locais e navegar para arquivos relativos.
3. Se o gerenciador abrir o HTML em um visualizador restrito (`content://`) e bloquear os arquivos CSS/JS, use um navegador/visualizador de HTML local com suporte a arquivos relativos. Essa é uma limitação de alguns navegadores/gerenciadores Android, não uma dependência de internet do site.

O portal também pode ser publicado como site estático, caso no futuro seja desejado acesso por URL. Publicação online não está configurada nesta etapa.

## Arquitetura

```text
apk/
├── index.html                    # Home / lista de apps
├── assets/
│   ├── portal.css                # Layout base
│   ├── personalization.css       # Cores, densidade e animações
│   ├── settings.css              # Tela de ajustes
│   └── portal.js                 # Busca, preferências e sons
├── apps/
│   └── primeiro-app/
│       └── index.html            # Página provisória do app 001
├── configuracoes.html           # Personalização visual e áudio
├── PORTAL.md                     # Este documento
└── app/                          # Projeto Android preexistente (preservado)
```

## Como adicionar um novo aplicativo

1. Crie `apps/nome-do-app/index.html` (ou uma subpasta com a estrutura específica desse app).
2. Crie um segundo card `<a class="app-card" href="./apps/nome-do-app/index.html" data-search="...">...</a>` dentro do `<div id="app-grid">` em `index.html`.
3. Inclua `../../assets/portal.css` e `../../assets/portal.js` na página, se quiser reutilizar o estilo e o tema; cada app também pode usar estilos próprios.
4. O script atual atualiza automaticamente os contadores da biblioteca com base na quantidade de cards.
5. Teste no PC e no celular, inclusive sem conexão.

**Importante:** esta versão é um ponto de partida. Não há funcionalidade real implementada no `Primeiro app`, pois o primeiro aplicativo ainda não foi definido. O card leva a uma página de apresentação claramente marcada como planejada.

## Compatibilidade e privacidade

- Não usa rede, analytics, tracking nem servidores para renderizar/navegar.
- Pode funcionar como `file://` quando o navegador permite ler arquivos relativos.
- `localStorage` guarda somente preferências de aparência e áudio; acessos usam `try/catch` caso o navegador bloqueie a API. No Electron, o protocolo interno `appspace://portal` mantém a mesma origem entre páginas.
- Recomenda-se manter a estrutura de diretórios intacta ao distribuir a pasta.
- Não altera o build, permissões, fonte nem fluxos de CI do app Android preexistente.

## Próximos passos sugeridos

Definir o nome e a finalidade do primeiro aplicativo e substituir `apps/primeiro-app/index.html` pela interface real, mantendo o card da home como acesso permanente.

## Empacotamento desktop e mobile (v0.2)

O portal agora compartilha o **mesmo HTML/CSS/JS** entre três opções:

| Destino | Tecnologia | Resultado |
| --- | --- | --- |
| Abrir localmente em navegador | HTML estático | `index.html` |
| Windows 11 | Electron | janela desktop / executável portátil `.exe` |
| Android | Capacitor + WebView | aplicativo `.apk` depois de compilar |

> Electron **não** roda diretamente em Android. Capacitor é o invólucro mobile; nenhum servidor web é exigido depois da instalação.

### Requisitos

- Node.js **22+** e npm, para gerar/empacotar.
- Windows para compilar `.exe` localmente (ou uma máquina de build Windows).
- Android Studio, Android SDK e Java apropriado para compilar Android localmente. O Capacitor gera um projeto Android separado em `mobile/android/`, sem substituir `app/` (R410).
- Internet durante a instalação das ferramentas e dependências; o **app instalado** executa as páginas embarcadas offline.

### Primeira execução Electron

No terminal, na raiz:

```powershell
npm install
npm run desktop
```

Para tentar gerar o executável Windows portátil:

```powershell
npm run desktop:exe
```

O arquivo final fica em `dist/electron/` após uma compilação bem-sucedida. Ele ainda não está anexado ao repositório.

### Primeira execução Android

Na raiz:

```powershell
npm install
npm run check
npm run mobile:add
npm run mobile:open
```

`mobile:add` deve ser executado **uma vez**. Após alterar HTML, CSS ou JS, atualize o aplicativo nativo:

```powershell
npm run mobile:sync
```

Abra e compile o projeto gerado em `mobile/android/` no Android Studio. Para testar no celular conectado:

```powershell
npm run mobile:run
```

Com o Gradle wrapper do projeto nativo gerado, o APK de depuração costuma ficar em `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

### GitHub Actions

O workflow **AppSpace — Android APK + Windows EXE** permite compilar remotamente Android e Windows pela aba Actions. Ao final de uma execução bem-sucedida, baixe os artefatos dos jobs. APK de depuração **não é APK de produção assinado para loja**.

### Arquivos de empacotamento

```text
package.json                # Scripts e dependências Electron / Capacitor
capacitor.config.json       # webDir=web; Android em mobile/android
desktop/main.cjs            # Janela Electron isolada e navegação local
scripts/build-web.cjs       # Copia index.html/assets/apps → web/
scripts/verify.cjs          # Verificação de estrutura e cópia
mobile/README.md            # Instruções do Android
.github/workflows/appspace-build.yml  # Pipeline de compilação
```

A pasta `web/` é **gerada** e ignorada no Git. Não edite nela: edite `index.html`, `assets/` ou `apps/` na raiz e rode novamente `npm run mobile:sync`.

**Nota sobre compilação:** as distribuições são geradas pelo GitHub Actions. Consulte a execução mais recente para saber se o APK ou EXE está disponível. O APK gerado é de debug; a instalação e o áudio em dispositivos físicos devem ser testados.

## Configurações e efeitos sonoros (v0.3)

Abra **Configurações** pelo ícone de engrenagem no topo, pelo menu lateral do PC ou pela guia **Ajustes** no rodapé do celular. A tela fica em `configuracoes.html`, compartilha a mesma navegação e funciona offline.

| Preferência | Opções |
|---|---|
| Tema | Escuro (padrão), Claro |
| Destaque | Violeta (padrão), Azul, Menta, Rosa |
| Cards | Confortável (padrão), Compacto |
| Efeitos visuais | Normal (padrão), Reduzido, Desligado |
| Sons de interface | Desligados (padrão), Ligados |
| Volume | 0–100%, passos de 5, padrão 30% |

- O Web Audio sintetiza cliques e confirmações **localmente**, sem músicas, MP3, permissões extras ou internet.
- O áudio inicia apenas após interação do usuário e apenas se a opção estiver ligada. O botão **Ouvir exemplo** serve para testar.
- O controle de sons desligado também desativa o controle de volume e a prévia.
- As escolhas são salvas em `localStorage` pela chave `appspace.preferences.v1` e aplicadas na abertura das páginas.
- **Restaurar padrões** volta ao tema escuro, violeta, cards confortáveis, efeitos normais e sons desligados.
- Caso o armazenamento seja bloqueado, as preferências funcionam na página atual, mas podem não persistir entre sessões.
- O som depende da disponibilidade do Web Audio API e do volume/mudo do aparelho. Em navegadores que não permitem áudio, o portal continua operacional.
- Os controles são nativos de HTML e utilizáveis por teclado, toque ou mouse. A preferência de movimento reduzido do sistema continua respeitada.
- No Electron, os arquivos são servidos exclusivamente pelo protocolo local `appspace://portal/`; nenhuma página externa é permitida. Isso possibilita a persistência de preferências entre a Home e os Ajustes.
- Para uma futura biblioteca com mais aplicativos, basta continuar adicionando cards: as configurações não alteram a lógica da busca.

### Empacotar a nova versão

Em `main`, a pipeline `AppSpace - Android APK + Windows EXE` compila os novos arquivos. Para compilar Android localmente após atualização de arquivos, rode `npm run mobile:sync` no projeto nativo já criado; para uma instalação limpa, `npm run mobile:add` gera a plataforma. Verifique se `configuracoes.html` foi incluído em `web/`.

**Não alteramos** a aplicação de diagnóstico Samsung/R410 que já existia na pasta `app/`.

## Pastas de aplicativos (v0.4)

A tela inicial agora exibe **Pastas de aplicativos**, antes da biblioteca de apps:

1. **Estoque**: `apps/estoque/index.html` — destinada a inventário, produtos e organização de materiais.
2. **Edição de vídeo**: `apps/edicao-de-video/index.html` — destinada a ferramentas de edição, atalhos e recursos audiovisuais.

Cada pasta é uma página independente e acessível por toque ou clique, com uma mensagem de pasta vazia (`0 aplicativos`) até que os primeiros projetos sejam criados. **Não há ainda ferramentas de controle de estoque ou edição de vídeo implementadas.** O card provisório **Primeiro app**, criado na versão anterior, permanece na seção de aplicativos da Home.

### Organização do projeto

```text
index.html
configuracoes.html
assets/
  portal.css               # Estilos principais (existente)
  personalization.css      # Preferências visuais (existente)
  settings.css             # Configurações (existente)
  folders.css              # Pastas e seus cards (novo)
  portal.js                # Busca por pastas e aplicativos (atualizado)
apps/
  estoque/
    index.html             # Página da pasta Estoque
  edicao-de-video/
    index.html             # Página da pasta Edição de vídeo
  primeiro-app/
    index.html             # Card provisório anterior, preservado
```

### Como adicionar aplicativos a uma pasta

Para criar um app na categoria Estoque, por exemplo:

1. Crie `apps/estoque/controle-de-produtos/index.html`.
2. Adicione um card com o link `./controle-de-produtos/index.html` à página `apps/estoque/index.html`, substituindo o aviso de pasta vazia.
3. Atualize o contador de aplicativos da pasta para a quantidade real.
4. Conserve os caminhos relativos para os recursos compartilhados (`../../../assets/...`) e teste as rotas sem internet.

Para Edição de vídeo, siga o mesmo procedimento sob `apps/edicao-de-video/`. O nome da pasta usa hífens por compatibilidade entre sistemas de arquivos, mas o título visível mantém o acento: **Edição de vídeo**.

A pesquisa da Home agora considera pastas e apps e ignora diferenças de maiúsculas e acentos; o contador de pastas (`02`) é independente do contador de cards de aplicativos (`01`). Configurações de cores e efeitos visuais continuam aplicadas também às páginas das pastas.

`scripts/build-web.cjs` copia recursivamente `apps/` para o Capacitor. O Electron já inclui `apps/**/*` na configuração do pacote. `scripts/verify.cjs` confirma os links das duas pastas e sua presença no pacote web.

## Atualização OTA pelo GitHub (v0.5)

**OTA = Over-the-Air**: esta versão do APK passa a trazer um mecanismo nativo que troca os arquivos web (HTML/CSS/JS) sem substituir o aplicativo Android instalado. O núcleo nativo é o plugin open-source [Capgo Capacitor Updater](https://github.com/Cap-go/capacitor-updater), fixado na versão `8.51.15` compatível com Capacitor 8.

### Como funciona

1. O APK novo inclui um conteúdo local `0.5.0` que sempre pode ser executado **offline**, sem login.
2. Ao abrir o aplicativo com internet, `assets/ota.js` consulta o manifesto público `https://raw.githubusercontent.com/K410Sh4/apk/main/ota/latest.json`, se a verificação automática estiver habilitada.
3. Quando existir um pacote com versão superior e compatível, o aplicativo baixa um arquivo ZIP da seção **GitHub Releases** do repositório. O ZIP contém os recursos da pasta `web/`, com `index.html` na raiz.
4. O plugin recebe também o checksum **SHA-256** do arquivo, para validar a integridade. Não são aceitas URLs de download externas ao domínio e ao caminho de releases permitidos.
5. A atualização automática é agendada para a próxima abertura/retorno do aplicativo; pela tela **Configurações → Atualizações OTA**, também é possível verificar, instalar imediatamente e restaurar o conteúdo do APK.
6. Em falha de carregamento, o plugin possui mecanismo de retorno à versão anterior; o app original permanece disponível para uso sem internet.

**Privacidade:** não há serviço Capgo Cloud nem análise de uso neste fluxo. `autoUpdate:false` e `statsUrl:""` desabilitam os endpoints de atualização/estatísticas do serviço. O único contato de atualização é com GitHub via HTTPS, pelo manifesto e o ZIP do release. A preferência de verificação automática fica em `localStorage` na chave `appspace.ota.auto`.

### Publicar uma nova versão OTA sem gerar APK

Acesse a aba **Actions** do repositório e execute o workflow **AppSpace - Publicar pacote OTA**, informando, por exemplo, `0.5.2` e a descrição das mudanças. A execução faz:

- verifica arquivos e links com `npm run check`;
- gera a pasta `web/` com o código HTML, CSS e JavaScript mais recente da branch `main`;
- cria um ZIP com `index.html` diretamente na raiz;
- publica esse ZIP como GitHub Release `appspace-web-v0.5.2`;
- calcula SHA-256 e **só depois** atualiza `ota/latest.json` para apontar à versão publicada.

Um pacote `0.5.1` poderá ser publicado como teste da primeira atualização sem reinstalação. Use sempre um número de versão **novo e crescente** para cada publicação. O workflow falhará se tentar republicar a mesma tag.

**Limites:** OTA não atualiza código Android/Kotlin, plugins nativos, permissões, `capacitor.config.json`, o runtime Electron ou o APK em si. Mudanças desse tipo exigem um APK novo **assinado com a mesma chave** e com `versionCode` crescente. O workflow de compilação nativa ainda usa assinatura *debug temporária*. Portanto, pode ser necessária **uma última desinstalação** para instalar a versão `0.5.0` habilitada para OTA; builds nativos de distribuição com assinatura definitiva exigem configurar uma chave privada persistente via GitHub Actions Secrets (não colocar chaves no repositório). Uma vez instalada a `0.5.0`, mudanças apenas web são recebidas pelo mecanismo OTA, sem desinstalar.

**Segurança:** não dê acesso de escrita ao repositório a pessoas sem confiança; quem publica bundles OTA publica código executável no WebView. O checksum protege contra corrupção e alterações em trânsito, mas não substitui uma cadeia de assinaturas digitais contra comprometimento da conta GitHub. Teste o processo num dispositivo antes de distribuir para outros usuários.

### Comprovação e testes

- `npm run check` valida estrutura HTML, presença do atualizador e configuração Capacitor.
- Os jobs do GitHub Actions validam a compilação Android com o plugin instalado.
- É necessário instalar o APK no Android, abrir **Configurações → Atualizações OTA** e verificar a leitura do manifesto, o download e a ativação de um bundle novo; não confunda sucesso da compilação com teste de instalação OTA real.

## Grade de aplicativos e ordenação (OTA 0.5.2)

Em **Configurações → Aparência → Layout da biblioteca**, o usuário pode escolher entre:

- **Cards** (padrão anterior): a Home preserva seções separadas de pastas e aplicativos, com descrições e prévias.
- **Grade de apps**: uma gaveta única de aplicativos, inspirada no Android, com ícones grandes, nome, tipo (Pasta / Aplicativo), busca própria e quatro colunas em celulares comuns.

**Ordenação:** Original (pastas primeiro, depois apps, pela ordem cadastral), Nome A–Z ou Nome Z–A. A grade ordena todas as pastas e aplicativos juntos; em modo cards, a ordenação acontece dentro de cada seção. As escolhas são salvas na mesma chave de preferências da versão anterior (`appspace.preferences.v1`) e continuam válidas nas demais páginas.

A gaveta `#launcher` é montada via `assets/portal.js` a partir dos próprios links `.folder-card` e `.app-card` da Home, evitando duplicação manual e reaproveitando ícones e links existentes. O CSS fica em `assets/launcher.css`, com suporte a tema, densidade, redução de animações e dispositivos pequenos.

Para testar pelo OTA sem reinstalar APK: instale a base Android 0.5.0, execute o workflow **AppSpace - Publicar pacote OTA** com versão `0.5.2` e, no celular, abra **Configurações → Atualizações OTA → Verificar agora**. Baixe/ative a atualização, reabra o aplicativo se necessário, configure **Grade de apps**, escolha **Nome A–Z** e confirme a persistência após reiniciar. Teste a busca por `estoque`, o retorno ao modo Cards e a operação offline.

**Atenção:** o pacote OTA não altera o binário Android ou a assinatura. A execução bem-sucedida do workflow garante publicação de arquivos, não comprova sozinho a aplicação OTA num aparelho.

## PC Monitor LAN + atualização OTA no Windows (v0.6)

O AppSpace agora também funciona como **servidor local de telemetria**, iniciando com o `AppSpace.exe` no PC. O Android pode mostrar os dados na nova pasta **Sistema → PC Monitor**. O próprio EXE permite verificar, baixar e ativar atualizações **HTML/CSS/JS** do GitHub Releases, sem baixar outro executável para cada ajuste de interface.

### Arquitetura

- `desktop/lan.cjs` — servidor HTTP local em `0.0.0.0:38473`; expõe **somente leitura** `GET /metrics`, `GET /health` e `POST /pair`.
- `desktop/main.cjs` — integra serviço LAN ao Electron isolado; APIs internas de informações, OTA e métricas usam `appspace://portal/__api/...` e checagem de origem.
- `desktop/updates.cjs` — baixa ZIP de release aprovado, compara SHA-256 com o manifesto, valida nomes/extensões/tamanhos e ativa arquivos na pasta de dados do usuário, com possibilidade de restaurar o conteúdo original. Não altera o `.exe`.
- `assets/desktop-updates.js` — em **Configurações → AppSpace para Windows**, mostra a versão instalada, o botão de atualização web, o endereço IP LAN, um código temporário de seis dígitos e o botão de restauração.
- `apps/sistema/index.html` — terceira pasta do AppSpace, com o card **PC Monitor**.
- `apps/sistema/pc-monitor/index.html`, `assets/pc-monitor.js` e `assets/pc-monitor.css` — interface horizontal/móvel responsiva com CPU, RAM, tempo de atividade, estado de conexão e gráfico simples de histórico.
- `scripts/prepare-mobile-lan.cjs` — após o Capacitor gerar o projeto Android, configura o acesso HTTP para IPs LAN usando o plugin `CapacitorHttp` (nativo).
- `scripts/test-lan.cjs` — teste de autenticação, pareamento e métricas locais.

### Passos para conectar PC e celular

1. No **Windows 11**, execute **AppSpace 0.6.0 (EXE)** e deixe a janela aberta.
2. Em Configurações, veja **Endereço do PC** (ex.: `192.168.1.100:38473`) e **Código temporário**.
3. Libere a conexão do Windows Firewall **somente em redes privadas de confiança**, quando solicitado, ou autorize a porta TCP 38473 somente para a rede privada.
4. No celular, instale o **AppSpace Android 0.6.0** e abra **Sistema → PC Monitor**.
5. Digite apenas o endereço IPv4 (sem porta) e o código de seis dígitos, e toque em **Conectar**.
6. Os dados são consultados localmente a cada 1 segundo. O token de autorização é armazenado apenas no dispositivo. Após reiniciar o EXE, será necessário refazer o pareamento.

O PC e o celular precisam estar na mesma rede privada (ou rede com roteamento direto entre eles), sem isolamento de clientes. O app não precisa de servidores externos para mostrar métricas. Se o Windows Firewall ou o roteador bloquear a porta, a conexão não funcionará.

**Métricas V1:** uso e modelo de CPU, frequência reportada pelo sistema, total/uso de memória RAM e tempo ligado. GPU e temperatura são **indisponíveis** até integrar coletores de hardware com suporte a esses sensores; valores não são inventados. O monitor **não** estende o desktop e **não** permite executar comandos no computador.

### Segurança e limites

- A conexão local usa **HTTP sem TLS**, por isso use apenas Wi-Fi privado e confiável. O PIN de seis dígitos tem limite de tentativas; após o pareamento, o monitor usa token aleatório, mas tráfego LAN pode ser interceptado numa rede não confiável.
- A API aceita origens conhecidas e o campo Host precisa indicar um IP local do próprio PC.
- Não ative redirecionamento de portas do roteador para a TCP 38473 nem compartilhe o PIN publicamente.
- As atualizações web do EXE são carregadas via GitHub Releases e verificadas com SHA-256, mas **alterações de código nativo Electron ou Android ainda exigem novos executáveis assinados**.
- A build Android 0.6.0 inclui novo suporte nativo a HTTP LAN. A versão 0.5.x **não** consegue adquirir essa permissão por OTA: será necessário instalar o novo APK nativo.
- O build atual ainda usa certificado **debug** para Android e não usa assinatura fixa no Windows. Para atualizar o binário sem reinstalar/desinstalar, uma etapa futura precisa configurar assinatura permanente e mecanismo específico para executáveis.
- OTA no EXE exige que o programa esteja aberto; usa a mesma fonte de versões `ota/latest.json` que o Android. Pode-se publicar `0.6.1` ou superior no workflow **AppSpace - Publicar pacote OTA**.
- O sistema permanece offline para navegação; somente **consulta/publicação OTA** usa internet.

**Validação:** GitHub Actions compila Android/Windows e executa verificações estruturais. A instalação em PC e Android reais, abertura do firewall, pareamento via Wi-Fi e atualização OTA no Windows/Android precisam ser testados em dispositivos físicos para confirmação.

## Alternar navegação Clássica ↔ Minimalista no celular (OTA 0.6.2)

Em **Configurações → Navegação mobile → Modelo de navegação** aparecem duas opções com prévia:

- **Clássico** — padrão de todas as instalações existentes: mantém hero, indicadores, seções separadas, cards descritivos, rodapé e navegação original do AppSpace.
- **Minimalista** — somente em telas com largura de até **850px**: a Home apresenta um catálogo em grade com busca; a barra inferior fica com apenas três destinos (**Início, Apps e Ajustes**); páginas de pastas têm cabeçalho e cards compactos; configurações permanecem completas, porém sem a coluna de prévia.

A opção é persistida em `localStorage["appspace.preferences.v1"].mobileNavStyle`, com valores `classic` (padrão) e `minimal`. A configuração independe de `libraryView` (Cards/Grade): no **desktop**, Cards ou Grade continua respeitando a preferência do usuário; em **mobile minimalista**, o catálogo em grade é usado automaticamente, sem modificar a preferência de biblioteca.

O código da navegação centralizada fica em `assets/portal.js` (`syncMobileNavigation`); as regras de layout ficam em `assets/mobile-navigation.css`. O CSS é carregado por todas as sete páginas públicas, incluindo PC Monitor e os aplicativos vazios. O menu original permanece intacto e volta ao selecionar **Clássico**. Em telas grandes a opção não interfere na experiência desktop.

Teste: instalar a base **0.6.0**, atualizar o conteúdo via OTA **0.6.2**, selecionar Minimalista, conferir 3 abas e a grade na Home, navegar até **Sistema → PC Monitor**, voltar, mudar para Clássico, alternar modo Cards/Grade do PC e reabrir o aplicativo para confirmar persistência. O reset de preferências retorna ao Clássico.

## Etiqueta Studio — Estoque (OTA 0.6.3)

**Escopo:** adicionar o aplicativo visual `Estoque → Etiqueta Studio` ao AppSpace Windows/Android, somente com HTML, CSS e JavaScript locais, **sem instalar novos plugins nativos**. A base nativa 0.6.0 é suficiente para receber o editor por OTA.

### Método REA / engenharia limpa e verificável

Seguindo a abordagem de análise incremental e evidências do REA, a implementação parte de **requisitos funcionais observáveis** de editores visuais (não foi executada engenharia reversa do software proprietário Canva):

- **INV-001 (OBSERVADO NO REPOSITÓRIO):** fonte das páginas em `apps/estoque/`, preferências globais em `assets/portal.js`, webview Android + Electron PC; `scripts/build-web.cjs` copia a árvore de aplicativos para OTA. Base 0.6.0 permite novo app sem alterar AndroidManifest.
- **DES-001 (PROPOSTA/IMPLEMENTADO):** geometria de elementos modelada em **milímetros** e serialização JSON com esquema e lista explícita de tipos; código-fonte independente em `apps/estoque/etiquetas/model.js`.
- **DES-002 (IMPLEMENTADO):** área editável e ferramentas SVG em `apps/estoque/etiquetas/editor.js`, sem biblioteca externa ou acesso a serviços remotos.
- **VAL-001 (TESTADO EM CI):** `scripts/test-labels.cjs` verifica modelos, reversibilidade JSON, geometria A4, início/fim do Code39, rejeição de imagens remotas, tipos não permitidos e presença dos controles do editor. `scripts/verify.cjs` inclui arquivos gerados no bundle offline.
- **VAL-002 (AINDA NÃO TESTADO EM HARDWARE):** impressão física em impressoras térmicas/jato/laser, comportamento de downloads do Android WebView e leitura óptica de etiquetas reais. Não presumir que uma impressão em 100% terá tamanho exato sem testar as configurações do driver.

### Recursos do editor

1. **Cinco modelos:** preço (60 × 40 mm), produto (80 × 50 mm), localização (100 × 50 mm), código de barras (70 × 35 mm) e etiqueta vazia.
2. **Personalização:** tamanho da etiqueta de 20–210 mm × 15–297 mm, fundo, textos editáveis com quatro fontes, alinhamento, cores, negrito, formas, linhas, fotos PNG/JPEG/WebP de até 1,5 MB, código de barras Code 39 alfanumérico, arrastar/redimensionar por mouse/toque, duplicação e camadas frente/trás.
3. **Proteção contra erros:** validação dos projetos importados, sanitização das cores e URLs de imagens, limite de 100 elementos por projeto, histórico de até 50 passos para desfazer/refazer e armazenamento automático na chave local `appspace.estoque.etiqueta.v1`.
4. **Exportação:** arquivo do projeto `.json` (reimportável), etiqueta `.svg` em dimensões físicas, PNG rasterizado com quantidade de pixels equivalente a 300 DPI, folha A4 repetida (SVG da primeira folha), impressão pelo diálogo do sistema (quando suportado pelo WebView/browser). A impressão repetida organiza automaticamente as cópias conforme largura, altura, margem e espaçamento em milímetros.
5. **Offline:** editor, fontes disponíveis e desenhos armazenados no aparelho. Não há requisições a servidores para editar etiquetas.

### Limites técnicos

- PNG tem **resolução equivalente a 300 pixels por polegada**, mas o arquivo exportado não garante metadados `pHYs` de 300 DPI; para dimensões físicas exatas, prefira SVG ou folha A4 com escala 100% e verifique o driver.
- **Code 39** suporta `A–Z`, `0–9` e caracteres específicos; não implementa Code 128, GS1/EAN-13, QR ou validação de cadastro GS1. Recomenda-se código curto e bom contraste para leitura óptica.
- A exportação SVG da folha é da **primeira página A4**; `Imprimir A4` gera todas as páginas até 200 cópias. A impressão direta no WebView Android pode exigir exportar e abrir o SVG num aplicativo de impressão compatível.
- Projeto salvo em `localStorage` é mantido ao reiniciar e ao atualizar via OTA, **não é backup garantido após desinstalação ou limpeza de dados**. Use `Salvar arquivo` (JSON) para cópia externa.
- A grade de aplicativos da Home mostra a pasta Estoque; o editor fica **dentro da pasta**, acessível em dois toques.

## Etiqueta Studio — proporção A4, correção de cores e impressão Android por Wi-Fi (v0.7.0)

**Problemas reproduzidos por inspeção REA (entrada: captura do Android)**

- `REA-VIS-001` **causa identificada no CSS**: `assets/portal.css` definia `svg { fill:none; stroke:currentColor; stroke-width:1.7; width:20px; height:20px }` para ícones. A regra abrangia inadvertidamente o SVG do editor, gerando contornos grossos nos textos e interferindo no preenchimento. Solução: regras com ID restritas aos SVGs de arte, e `stroke="none"` no renderizador/na exportação.
- `REA-DIM-002` **proporção da folha**: a versão inicial ampliava a etiqueta para preencher a área da tela, sem comparação com A4. Solução: alternar entre **Editar etiqueta** (zoom para trabalhar) e **Folha A4** (SVG de 210 × 297 mm, cópias e margens nas posições relativas exatas); renderização A4 com grupos diretos, para não herdar largura global de ícones.
- `REA-PRINT-003` **lacuna nativa**: o AppSpace 0.6.0 não possuía plugin para abrir o PrintManager do Android a partir do WebView. Solução: instalar `@capgo/capacitor-printer@8.1.8` na base Android **0.7.0**; o botão **Impressoras Wi-Fi** abre o seletor nativo com a folha A4 renderizada em HTML/SVG. A descoberta/disponibilidade de impressoras é responsabilidade dos serviços de impressão do Android (Mopria ou serviço da fabricante); o aplicativo **não escaneia indiscriminadamente impressoras pela internet** e não gerencia protocolos IPP diretamente.

**Verificação:** os testes de código conferem a existência dos estilos de isolamento, seletor de modo A4 e plugin nativo. A **precisão de dimensões em impressão física**, a fidelidade de cor da impressora e a descoberta no Wi-Fi de um dispositivo específico ainda precisam de validação prática. O papel final depende de escolher A4, escala 100%, margens 0 e driver compatível no seletor. Uma tela de celular não pode garantir visualização física 1:1 em milímetros sem calibração do DPI; a vista A4 garante **proporção geométrica correta**, não o tamanho absoluto na tela.

**Instalação:** o novo plugin Android exige instalar APK **0.7.0**; OTA 0.6.x não pode acrescentar código nativo. As próximas alterações somente web podem chegar via OTA 0.7.x. O build atual é debug e pode ser necessário desinstalar a versão anterior se a assinatura mudar. **Antes de desinstalar, use "Salvar arquivo" para exportar os projetos de etiquetas em JSON**, pois `localStorage` será apagado na desinstalação.

**Uso:** entre em `Estoque → Etiqueta Studio`, escolha **Folha A4** para conferir proporção e posicionamento, depois **Impressoras Wi-Fi** (no APK 0.7.0). No Android, ative um serviço de impressão compatível em Configurações do sistema. A impressora Wi-Fi normalmente precisa estar na mesma rede e acessível ao serviço; serviços com impressão remota podem ter requisitos próprios.

## AppSpace 0.7.3 — correções pós-auditoria e exportação de etiquetas

**Base:** PR #1 integrado à main (pareamento robusto, verificação de versão nativa OTA, restauração real do conteúdo original, correção do ciclo de redimensionamento, status do PC Monitor e versão Android do Gradle). Os 15 testes adicionais no PR passaram em CI.

**Estoque / Etiqueta Studio:**
- `model.js`: Code 39 rejeita caracteres não suportados (`_`, emojis, símbolos fora do padrão) e códigos com mais de 24 caracteres. Nunca remove caracteres de um SKU silenciosamente; o editor mostra o erro e preserva o valor anterior. Letras minúsculas são normalizadas explicitamente para maiúsculas, como exige o padrão Code 39.
- `files.js`: exportações JSON (backup), SVG e PNG usam `@capacitor/filesystem` em pasta temporária e `@capacitor/share` para abrir o menu **Compartilhar → Arquivos/Drive** no Android. Em Windows/navegadores mantém download padrão. **A geração do arquivo temporário ou abertura do compartilhamento não equivale a ter criado um backup:** o usuário deve selecionar um destino externo e confirmar o salvamento.
- `editor.js`: o botão **Folha A4 (SVG)** agora exporta todas as páginas: uma folha gera SVG único, várias folhas geram ZIP com um arquivo SVG para cada página. Para imprimir em rede pelo Android, continua usando o seletor nativo PrintManager.
- `scripts/test-labels.cjs`: inclui regressões para SKU `ABC_123`, truncamento e importação de barcode inválido, validação de cabeçalho ZIP/duas páginas e simulação de gravação/compartilhamento nativos.
- Build nativo Android: `package.json` 0.7.3, dependências `@capacitor/filesystem@8.1.4` e `@capacitor/share@8.0.1`, compatíveis com Capacitor 8.

**Distribuição:** a compilação de Android 0.7.3 é necessária para instalar os novos plugins nativos; OTA sozinho **não** altera um APK 0.7.0. O pacote web OTA posterior deve anunciar `minNative=0.7.3`. O build ainda é **debug** e não há assinatura de atualização estável; instalar a nova versão sobre a anterior pode falhar por assinatura diferente. **Não desinstale sem backup externo comprovado**. Se os arquivos não estiverem sendo exportados no APK antigo, evite desinstalar até termos um processo de migração seguro ou comprovadamente não precisar dos dados.

**Critérios de aceite pendentes em dispositivos reais:** exportar arquivo JSON e confirmar sua presença em Arquivos/Drive, importar o mesmo JSON depois, imprimir folha A4 a 100% numa impressora física, parear PC Monitor e aplicar OTA no Android 0.7.3. Os testes simulados e compilação não comprovam essas operações.

## Etiqueta Studio — interface minimalista (OTA 0.7.6)

A partir da base Android 0.7.3, o editor visual de etiquetas ganha um redesign de **interface** sem alteração do modelo de projeto, medidas físicas em milímetros, código de barras, geometria SVG nem sistema de salvamento/impressão.

**Referências e decisões:** acessibilidade Android recomenda controles touch de pelo menos 48dp; guias de toolbars recomendam agrupar poucas ações principais e ocultar ferramentas secundárias quando não usadas; softwares de etiqueta especializados separam edição da prévia de impressão. Base visual reproduzida de forma independente, sem reutilizar código de produtos de terceiros.

- **Mobile até 850px:** cabeçalho com voltar, nome editável, desfazer/refazer e único botão principal **Exportar**; canvas ocupa o fluxo principal com switch Editar etiqueta / Folha A4 e zoom compacto.
- **Dock inferior:** 7 comandos de criação com rolagem horizontal (Texto, Retângulo, Círculo, Linha, Código, Imagem e Modelos), alvo de toque >=48px, sem sobrepor o documento — margem inferior reserva espaço para a dock e a área segura do Android.
- **Painel contextual:** ao selecionar um elemento surge **Editar elemento**. O botão **Tamanho e papel** abre a mesma janela inferior com abas Elemento, Etiqueta e Folha A4. Texto/código de barras novos abrem a guia de edição automaticamente.
- **Exportação:** botão principal abre uma janela inferior com Salvar JSON, Importar JSON, SVG, PNG, Folha A4, Imprimir e Impressoras Wi-Fi. Aciona as funções originais sem alterar formato nem compatibilidade.
- **Modelos:** paleta acessível a partir do dock. Mantém confirmação antes de substituir a etiqueta existente.
- **Desktop:** permanece com três colunas, porém barras, espaçamento e cartões mais discretos, sem remover ferramentas.
- **Acessibilidade:** botões reais, estado `aria-expanded` e `aria-selected`, `role="dialog"` no painel aberto, `Escape` para fechar, fundo bloqueado ao abrir, devolução de foco e contenção de foco pelo teclado.

**Arquivos:** `apps/estoque/etiquetas/modern.css`, `modern.js`, adaptações semânticas no `index.html`, testes em `scripts/test-labels-modern.cjs` (simulação de painéis, navegação, modelos, Escape) e verificações de assets no `scripts/verify.cjs`.

**Testes de aceite em aparelho:** abrir Etiqueta Studio no Android, selecionar/arrastar elemento, abrir Editar elemento, alterar texto/cor, fechar e conferir persistência; criar código de barras; alternar A4/Editar; abrir Modelos, aplicar com confirmação; salvar projeto pelo menu Exportar; verificar operação offline. A publicação CI não substitui validação em uma tela real.

## Etiqueta Studio — gestos de edição (OTA 0.7.7)

Escopo: alterações web apenas em `apps/estoque/etiquetas/`, compatíveis com **APK nativo >=0.7.3**. Sem alterações de código Java/Kotlin, permissões Android, protocolos de impressão, modelo JSON (`schema=1`) nem dimensões físicas.

**Controles adicionados:**

- **Pinça com dois dedos:** um dedo move; com dois, a distância entre os dedos ajusta proporcionalmente largura/altura do objeto selecionado. Para texto, o tamanho de fonte acompanha a escala; divisórias horizontais permanecem horizontais. O centro acompanha o deslocamento dos dedos. Medidas são preservadas em milímetros e o gesto gera um único estado de Desfazer.
- **Toque duplo em texto/código de barras:** abre o painel contextual `Elemento` no Android, já com o campo Conteúdo focado e selecionado, pronto para substituir o texto. No desktop, duplo clique também foca o campo de edição. Seleção e arraste comum continuam funcionando.
- **Apagar elemento:** botão vermelho `Apagar` aparece ao selecionar um objeto no canvas mobile. Usa a mesma operação de exclusão do inspetor e é reversível por `Desfazer`.
- **Limpar todo o conteúdo:** ação separada na paleta `Modelos` (e menu lateral no desktop); exige confirmação explícita, elimina apenas objetos, preserva dimensões/nome/fundo e permite Desfazer.

**Implementação:** módulo puro `gestures.js` para cálculo de escala e detecção de toque duplo; `editor.js` recebe eventos PointerEvents e grava o histórico uma vez por gesto; `modern.js` abre o painel textual ao receber `etiqueta:edit-content`. `modern.css` estiliza os botões. `scripts/test-labels-gestures.cjs` valida pinça, tradução do centro, escala da fonte, preservação das linhas, toque duplo e existência dos comandos. O simulador de regressões foi atualizado para carregar o novo módulo.

**Validação em aparelho:** selecionar um texto na etiqueta, fazer pinça para aumentar/diminuir e conferir fonte + tamanho; arrastar com um dedo; toque duplo para editar conteúdo e salvar com teclado; usar Apagar e Desfazer; abrir Modelos → Limpar todo o conteúdo, cancelar e confirmar, depois Desfazer. A execução automatizada não substitui testes multitoque reais no Android.

## Estoque / Etiqueta Studio — produção em lote guiada (OTA 0.7.8)

A experiência está dividida em três etapas, acessíveis pelo botão **Criar lista e imprimir** na página do editor de modelos (`apps/estoque/etiquetas/index.html`):

1. **Modelo** — o desenho da etiqueta continua no editor visual. A página `apps/estoque/etiquetas/lote/index.html` carrega o último projeto salvo e apresenta uma prévia e os campos que podem variar. Para cada texto ou código de barras, o operador decide se será preenchido na tabela ou mantido fixo.
2. **Lista e quantidades** — uma linha por produto/etiqueta; colunas automáticas para os campos variáveis; quantidade inteira de 1 a 200 por item. É possível adicionar/remover até 100 linhas, salvar/importar a lista JSON e consultar o total de cópias. Os valores da tabela **não modificam o desenho original**.
3. **Prévia/Impressão A4** — grade automática ou escolha manual de colunas e linhas, margens, espaços horizontal e vertical e alinhamento horizontal/vertical. A tela mostra os dados reais da lista em um SVG proporcional de 210 × 297 mm, permite navegar pelas páginas e exibe a quantidade total. O mesmo algoritmo de layout gera as folhas para impressão ou SVG/ZIP. Limite global de 500 etiquetas por lote. Grades que excedem o papel são rejeitadas, nunca reduzidas silenciosamente.

**Componentes:** `batch-model.js` valida e gera as cópias com dimensões em mm; `batch-render.js` renderiza desenho próprio em SVG sem herdar estilos de ícones do portal; `batch.js` cuida da tabela, seleção de campos, prévia, exportação, impressão e persistência em `localStorage["appspace.estoque.lote.v1"]`. A lista é independente do projeto desenhado (`appspace.estoque.etiqueta.v1`), portanto a aplicação OTA não precisa alterar o formato de documentos existentes.

**Backup:** lista JSON pode ser exportada e importada somente quando corresponde aos campos do modelo atual. Em Android, `EtiquetaFiles.save` solicita Compartilhar → Arquivos/Drive. O backup não está concluído até o usuário escolher um destino externo e confirmar.

**Impressão:** a folha A4 usa coordenadas físicas em milímetros. Android nativo 0.7.3 ou superior abre o seletor de impressão através do plugin `Printer`; no Windows/navegador usa `window.print`. Para um lote multipágina a exportação gera ZIP com um SVG por página; para uma página gera SVG único. É necessário conferir escala 100%, margens zero e compatibilidade do driver. As cores e dimensões ainda exigem teste em impressora real.

**Testes:** `scripts/test-labels-batch.cjs` cobre campos variáveis, cópias de cada valor, 3×6 para 60×40mm, grade custom 2×4, alinhamento, rejeição de grade fora da folha, distribuição multipágina, limites de quantidade e invalidação de Code39; `scripts/verify.cjs` verifica a inclusão dos cinco novos arquivos no bundle offline. Falta confirmar visualmente no Android e imprimir em hardware real.
