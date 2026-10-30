# Auditoria e correções do AppSpace

Base analisada: `c63ea29eca58904525253dbb1528a0dcf81e9627` (`main`).
Escopo: portal HTML, Etiqueta Studio, PC Monitor, servidor LAN, atualização web Android/Windows e empacotamento AppSpace. O projeto legado R410 em `app/` não foi alterado nem recebeu validação de hardware nesta auditoria.

## Problemas confirmados e correções

| Prioridade | Problema antes | Comportamento depois |
| --- | --- | --- |
| Alta | `POST /pair` com JSON `null` acessava `input.code` e lançava erro fora de tratamento no processo Electron. | Objetos inválidos retornam HTTP 400; o servidor continua disponível. |
| Alta | Requisições simultâneas de pareamento escapavam do limite porque a tentativa só era contabilizada após ler o corpo. | A tentativa é reservada antes da leitura; a nona solicitação é bloqueada. Entradas expiradas são limpas e o mapa tem limite. |
| Alta | O JavaScript OTA declarava uma versão nativa fixa, que podia ser diferente do APK instalado. | A compatibilidade usa `getBuiltinVersion()` do plugin. Se a versão não puder ser confirmada, a instalação é bloqueada. |
| Alta | O APK gerado mantinha `versionName "1.0"` e `versionCode 1` do template Capacitor, embora os releases fossem chamados 0.7.0 etc. | A preparação grava a versão de `package.json` no Gradle e calcula `versionCode = major × 1.000.000 + minor × 1.000 + patch`, com limites e validação. |
| Alta | Um EXE novo continuava carregando uma atualização web antiga salva em `userData`. | Um bundle em cache só é ativado se sua versão superar a versão embutida no EXE. |
| Média | “Restaurar original” solicitava o último bundle bem-sucedido e a atualização automática podia reinstalar o pacote. | Solicita `builtin` e desativa a preferência de atualização automática antes da restauração. |
| Média | Ao mudar de página, o estado da atualização já baixada se perdia e o botão Aplicar desaparecia. | Consulta `getNextBundle()` e recupera o estado pendente; evita baixar novamente o pacote já agendado. |
| Média | Restaurar no desktop podia concorrer com uma instalação e ser desfeito ao final do download. | Instalar e restaurar compartilham exclusão; o estado só muda depois da remoção do ponteiro persistido. |
| Média | A alça de tamanho ignorava o retorno à coordenada inicial durante um arraste. | Compara largura/altura durante resize; mantém dimensões dentro dos limites do modelo e finaliza também ao perder a captura do ponteiro. |
| Média | A prévia A4 mantinha a arte anterior quando a etiqueta deixava de caber. | Limpa a prévia e informa o erro. A prévia gera apenas a primeira folha; a impressão continua gerando todas. Cópias são inteiras. |
| Média | Resposta atrasada de métricas fazia o monitor voltar a mostrar “Conectado” após Desconectar. | Respostas de sessões encerradas são ignoradas. Novas sessões reiniciam o contador de falhas. |
| Média | Ao voltar pelo histórico com a página em cache, o monitor não retomava as consultas. | Retoma em `pageshow` quando a sessão estava ativa antes de `pagehide`. |

A enumeração de interfaces de rede também passou a tolerar falha do sistema operacional. Uma falha desse tipo foi observada no ambiente de teste. O campo IP salvo agora é restaurado em `input.value`, e uma alteração rejeitada no editor restaura também a seleção.

## Evidências e verificação

- Os 11 testes iniciais de regressão falharam na revisão original, reproduzindo as falhas correspondentes; todos passaram após os patches.
- `npm run check`: aprovado. Inclui cópia do bundle web, verificações estruturais, servidor HTTP real em loopback com pareamento/autorização/métricas, os cinco modelos de etiqueta e 15 testes adicionais.
- Os testes adicionais executam os controladores reais em `node:vm`, com DOM e plugins simulados. Também cobrem instalação OTA compatível, movimento/desfazer/refazer, pareamento válido após entrada inválida e preparação Android idempotente.
- `git diff --check`: aprovado.
- O workflow de build passa a executar em pull requests; alterações em `configuracoes.html` também passam a disparar builds de `main`.
- O campo `request.initiatorOrigin` foi conferido na documentação atual do Electron e não foi alterado como suposto bug.

Fontes primárias conferidas: [Electron protocol](https://www.electronjs.org/docs/latest/api/protocol), [API do updater fixada em 8.51.15](https://github.com/Cap-go/capacitor-updater/blob/8.51.15/src/definitions.ts), [template Android Capacitor 8.6.0](https://github.com/ionic-team/capacitor/blob/8.6.0/android-template/app/build.gradle).

## Aplicação e reversão

As alterações estão organizadas em um único commit de correção, acompanhado desta auditoria e dos testes. Para validar uma cópia: `npm run check`. Depois da revisão e integração, gere um novo EXE e um novo APK para incorporar as correções nativas. Atualizar apenas HTML/JS não corrige `desktop/*.cjs` nem os metadados de versão do APK.

APKs antigos com a versão genérica `1.0` não permitem identificar com confiança a base nativa. O novo código bloqueia OTA nessa situação e orienta instalar a base corrigida. Não se deve deduzir suporte de plugins apenas pela versão do JavaScript.

Para reverter código, use `git revert <commit-da-correcao>`; isso não apaga projetos locais. A restauração de conteúdo dentro do app é uma operação separada. Este patch não modifica `ota/latest.json`, não substitui releases existentes e não publica automaticamente uma nova versão OTA.

## Limites da validação

Não houve execução de Electron/Android físicos, navegador gráfico, impressão real, descoberta de impressora Wi-Fi ou teste Bluetooth. A compilação nativa deve ser confirmada pelo workflow do PR. A validação automatizada não demonstra fidelidade visual ou dimensões impressas.

Pontos para uma próxima etapa: assinatura Android permanente (o fluxo atual usa debug), distribuição de binários atualizados, comportamento de exportação/download no WebView Android e recuperação automática após falha de boot do bundle desktop. Nenhum desses itens foi declarado resolvido por estes testes.
