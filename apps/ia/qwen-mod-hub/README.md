# Qwen Mod Hub + REA Mod Host v0.2 (protótipo funcional)

## O que funciona

- Pasta **IA** e Qwen Mod Hub no AppSpace (Windows, navegador e Android).
- Preferências offline, importação/exportação JSON e estado de ativação explícito.
- **REA Mod Host** independente, sem dependências externas, executado via Node.js 22+ no Windows.
- API local autenticada, validação estrita e mensagens de estado por módulo.
- Quando o llama-server está aberto: endpoint de chat realmente envia perguntas ao Qwen.
- **Adaptive Think**: economy (1 inferência), balanced (3 inferências), deep (4 inferências); Code Verify acrescenta uma revisão textual por IA.
- **Long-Term Memory**: grava até 32 interações resumidas no PC **somente enquanto Memory está ativado**. Recuperação lexical básica. Há opção para limpar.
- **Vulkan Optimizer**: **somente sinalização de perfil**. O backend Vulkan deve ser configurado ao iniciar o llama-server. Não altera driver, BIOS, clocks, pesos GGUF ou código REA.
- Testes de protocolo e segurança em scripts/test-ai-agent.cjs.

> O agente deste repositório é um **adaptador experimental**. Não substitui nem altera o executável REA do projeto paralelo. Sem integração explicitamente implementada no REA.exe, o REA continuará executando seu fluxo original.

## Teste no Windows (sem nuvem)

Você precisa do Node.js 22+, dos arquivos Qwen2.5-Coder-7B-Instruct GGUF e de uma compilação llama.cpp com Vulkan compatível com RX 5700 XT.

**Terminal 1 — iniciar Qwen:** substitua o caminho do modelo.

~~~powershell
.\llama-server.exe -m "C:\IA\models\qwen2.5-coder-7b-instruct-q4_k_m.gguf" -ngl 99 -c 4096 --host 127.0.0.1 --port 8080
~~~

Se VRAM ficar insuficiente, diminua contexto e camadas de offload; não suponha que Q5 ou 8K caibam sem medir. llama.cpp oferece API OpenAI-compatible POST /v1/chat/completions.

**Terminal 2 — na pasta do repositório apk:**

~~~powershell
npm run ai:agent
~~~

O serviço exibe a URL **http://127.0.0.1:8765** e um token aleatório **de cada execução**. Não compartilhe o token.

Abra AppSpace → IA → Qwen Mod Hub. Cole endereço e token, clique **Testar conexão**, salve e **Aplique o perfil no REA**, e use **Laboratório Qwen**. O painel sinaliza quando o backend estiver offline.

**Android experimental por USB:** com depuração USB e adb, execute no PC:

~~~powershell
adb reverse tcp:8765 tcp:8765
~~~

O telefone utiliza http://127.0.0.1:8765. Android pode bloquear HTTP dependendo da segurança do APK; não exponha servidor em rede pública como alternativa. A interface e o JSON funcionam offline sem o agente.

## Contrato HTTP local

Autenticação: Authorization: Bearer TOKEN. Token em memória, nunca salvo pelo painel.

| Método | Caminho | Retorno |
|---|---|---|
| GET | /api/v1/status | agent, apiVersion, model.ready, model.id, capabilities, moduleStatus |
| GET | /api/v1/mods/profile | Perfil ativo e revisão |
| POST | /api/v1/mods/apply | Confirma aplicação **no controlador** (não nos pesos) e informa pendências |
| POST | /api/v1/chat | Recebe prompt; retorna answer, passes, elapsedMs e revisão |
| POST | /api/v1/memory/clear | Recebe confirm:true e apaga histórico do agente |

Perfil: schema 1, target qwen2.5-coder-7b-instruct, mods (think, memory, vulkan, verify), thinkMode e contextSize.

A API só escuta loopback nesta versão, exige um Host adequado, restringe origens de navegador e usa token resistente a adivinhação. Não oferece execução shell, instalação remota nem comandos de sistema. Backend Qwen limitado a loopback.

## Limitações e ensaios

1. Think faz mais inferências e pode ser **mais lento** e até piorar algumas respostas. Não muda os pesos.
2. Code Verify faz revisão textual, **não compila Luau** e não prova que o código está correto.
3. A memória está em ~/.appspace/rea-qwen-memory.json no perfil Windows, fora do repositório. Pode ser limpa pelo app.
4. Alterar contextSize no perfil não muda o contexto reservado no llama-server. Configure -c no processo.
5. Ainda não há instalador de mods executáveis, assinatura OTA de plugins Windows, LoRA ou medição comparativa automática de qualidade.
6. applied:true significa que o **controlador aceitou** o perfil; não prova ganhos de GPU.
7. O serviço não controla o REA.exe. Para integrá-lo será necessário um adaptador futuro, mantendo o REA independente.

## Testes

~~~powershell
npm run ai:test
npm run check
~~~

Compare Qwen original e Think com um conjunto fixo de tarefas Luau, respostas cegas e testes reproduzíveis. Só medições demonstram ganhos.
