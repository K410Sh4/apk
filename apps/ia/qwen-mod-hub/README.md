# Qwen Mod Hub v0.1 — contrato de integração REA

## Estado atual
O aplicativo AppSpace em `apps/ia/qwen-mod-hub/` funciona **offline**, apresenta quatro módulos, persiste configurações no armazenamento do dispositivo, importa/exporta um perfil JSON validado e permite testar um endpoint REA.

Não está instalado um servidor REA neste repositório. Os interruptores **não** modificam o modelo GGUF, não executam LoRA e não alteram parâmetros do llama.cpp sem confirmação do agente Windows. As versões dos mods são identificadores de especificação, não pacotes baixáveis. O OTA atual do AppSpace distribui arquivos web do aplicativo; um mecanismo OTA de módulos executáveis Windows requer projeto próprio, verificação criptográfica, isolamento e rollback.

## Módulos do perfil v1
- `think`: proposta de raciocínio adaptativo, com modos `economy`, `balanced`, `deep`.
- `memory`: futura recuperação de memória e contexto seletivos.
- `vulkan`: futura gestão de perfil AMD Vulkan, sem prometer desempenho.
- `verify`: futura orquestração de validações determinísticas.

O JSON exportado contém `schema:1`, `target:"qwen2.5-coder-7b-instruct"`, `mods` (quatro booleanos), `thinkMode` e `contextSize` (4096 ou 8192). O agente deve validar novamente todos os campos.

## API planejada para o executável REA
Implementar e proteger **no Windows**, não no WebView Android:
- `GET /api/v1/status` — requer `Authorization: Bearer <token>`, devolve `{"agent":"rea-qwen-mod-host","apiVersion":1,"capabilities":{"mods":true}}`.
- `POST /api/v1/mods/apply` — requer token e `Content-Type: application/json`; corpo `{"schema":1,"profile":{...}}`. Só responder com `{"agent":"rea-qwen-mod-host","apiVersion":1,"applied":true}` quando o perfil **de fato** tiver sido aplicado. Adicionar detalhes de validação por módulo na próxima versão.

## Segurança
- O frontend aceita apenas loopback e endereços IPv4 privados. Ele não lista nem instala scripts remotos.
- Armazena localmente apenas a URL base; **não salva o token**.
- Exigir autenticação, CORS limitado às origens AppSpace autorizadas e proteção contra DNS rebinding / CSRF no agente.
- O agente deve usar um identificador de pareamento exclusivo, HTTPS para rede local quando disponível, limites de requisição, permissões mínimas, logs, validação de esquema e nenhum shell arbitrário.
- Em Android, acesso HTTP local depende das regras de rede do aplicativo. Se a conexão falhar, a exportação de perfil continua funcional.
- Não declarar operação aplicada com base em uma resposta HTTP genérica.

## Próximos testes
1. Interface e persistência: importar, mudar modos, recarregar e exportar.
2. Validar que não é possível contatar domínios públicos nem aplicar perfil sem token/handshake.
3. Adicionar serviço REA Windows versionado e testes de contrato; medir diferenças reais Qwen puro vs. mods.
4. OTA via bundle web AppSpace; OTA do agente Windows separadamente após assinatura/verificação.
