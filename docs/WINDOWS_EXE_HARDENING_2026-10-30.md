# AppSpace Windows: atualização de confiabilidade e segurança

Base: main @ `363aa31a668d0c0c3528f652c8df167f88e630ea`.
Branch: `fix/windows-exe-hardening-20261030`.

## Patches aplicados
- **WIN-001:** uma única instância do Electron. Segunda abertura foca a janela em execução.
- **WIN-002:** CSP de scripts externos e bloqueio de objetos, aplicada no protocolo `appspace://portal` a páginas HTML. Estilos inline continuam permitidos para prévias/editor.
- **WIN-003:** servidor LAN aceita somente pares IPv4 privados (RFC1918) ou loopback, mantendo operação Wi-Fi e tethering USB. A API continua usando PIN + token.
- **WIN-004:** atualizações de interface criam marcador `pending.json`; encerramento antes da carga confirma o rollback na próxima inicialização. Falha de navegação ou crash do renderer após OTA tenta restaurar a interface embutida.
- **WIN-005:** build Windows gera `SHA256SUMS.txt`, com verificações unitárias adicionadas a `npm run check`.
- **WIN-006:** stop do servidor LAN não solicita close se não estiver ouvindo.

## Limites
- Não adiciona assinatura Authenticode: exige certificado e gestão de segredo pelo proprietário.
- Não publica EXE automaticamente nos Releases; os artefatos de PR permanecem temporários.
- Não altera dependências transitivas; o lockfile e `npm ci` exigem uma etapa separada de resolução controlada.
- A confirmação de boot marca a navegação HTML como carregada, não garante ausência de erro lógico em todos os scripts.

## Verificação
No PR, confira validação do portal, gavetas Chromium, compilação Windows e geração de SHA-256. Em Windows real:
1. Abra o EXE duas vezes: deve existir uma única janela e uma única instância do servidor.
2. No Android, conecte em Meu PC via Wi-Fi/USB, valide CPU/RAM e desconecte.
3. Aplique OTA web 0.7.15 e reabra; confirme que a interface persiste.
4. Simule falha de carregamento OTA em ambiente de teste e confirme restauração ao reiniciar.
5. Confira fluxos de etiquetas/impressão e arquivos, inclusive páginas com conteúdo dinâmico.
6. Compare a inicialização a frio e memória antes/depois; ganhos numéricos não são presumidos.

## Reversão
Reverta o commit deste PR caso haja regressão. O rollback automático OTA opera somente no conteúdo web do EXE e não altera projetos do usuário.
