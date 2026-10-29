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
