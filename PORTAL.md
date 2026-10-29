# AppSpace — portal local de aplicativos (v0.3)

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
