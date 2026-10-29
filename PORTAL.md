# AppSpace — portal local de aplicativos (v0.1)

Portal em **HTML, CSS e JavaScript puro**. Foi adicionado ao repositório `apk` sem remover ou alterar o projeto Android R410 Control Center que já existia.

## O que já está disponível

- Tela inicial responsiva (desktop, celular em retrato e paisagem).
- Um card de demonstração: **Primeiro app**, com status **Em breve**.
- Página independente do primeiro app em `apps/primeiro-app/index.html`, com botão de retorno.
- Barra lateral no PC e navegação inferior no celular.
- Tema claro/escuro, com tentativa de guardar a preferência local.
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
│   ├── portal.css                # Temas, layout e responsividade
│   └── portal.js                 # Busca e alternância de tema
├── apps/
│   └── primeiro-app/
│       └── index.html            # Página provisória do app 001
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
- `localStorage` é usado somente para o tema e envolvido em `try/catch` caso o navegador bloqueie a API.
- Recomenda-se manter a estrutura de diretórios intacta ao distribuir a pasta.
- Não altera o build, permissões, fonte nem fluxos de CI do app Android preexistente.

## Próximos passos sugeridos

Definir o nome e a finalidade do primeiro aplicativo e substituir `apps/primeiro-app/index.html` pela interface real, mantendo o card da home como acesso permanente.
