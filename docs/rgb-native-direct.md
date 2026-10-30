# AppSpace RGB Direct — driver nativo M711

Este módulo utiliza exclusivamente APIs do Windows (SetupAPI, HIDClass e PowerShell/.NET que acompanham o sistema). **Não exige OpenRGB, hidapi, libusb, plugins, drivers ou aplicativos de terceiros instalados.** Não é um driver de kernel.

## Implementado

- Inventário HID do mouse por interface, com verificação em tempo real de VID `04D9`, PID `FC30`, coleção `MI_02`, usage page `FFA0` e report size de 16 bytes.
- Comandos de iluminação do Redragon M711 (cor fixa, respiração, arco-íris, onda, piscando), com cor hexadecimal e seleção explícita entre os cinco perfis de LED.
- Envio somente após comando do usuário e checkbox de autorização. Nada é escrito durante o inventário.
- Adapter Node.js com lista fechada de parâmetros, sem interpolação de comandos PowerShell. Endpoint Electron local e endpoint LAN autenticado para celular pareado.
- Isolamento do driver nativo na pasta `desktop/` e empacotamento do script fora de `app.asar`.
- Testes automatizados de validação e um teste de compilação e inventário **somente leitura** no runner Windows do GitHub Actions.

## Limitações técnicas e de segurança

- O código ainda **não foi testado com o mouse físico do usuário**. O Windows pode permitir o comando HID sem confirmar que o LED mudou; o teste visual continua obrigatório.
- O protocolo altera a iluminação do **perfil escolhido**; se outro perfil estiver ativo, o efeito poderá não aparecer imediatamente.
- Brilho e velocidade em efeitos não estão habilitados como comandos físicos nesta etapa; os sliders antigos pertencem exclusivamente ao motor de simulação.
- Mouse, teclado e microfone usam protocolos diferentes: o driver M711 **não** envia comandos ao teclado `0C45:8006` ou ao FIFINE `3142:A010`.
- A controladora de ventoinhas alimentada apenas por SATA não tem transporte de dados identificado. Sem USB/ARGB compatível não há caminho para controlar cores pelo software.
- Alterações físicas podem sobrescrever as cores/efeitos do perfil selecionado. Faça os primeiros testes com cor fixa e acompanhe o resultado visual.
- Não modifica DPI, teclas, firmware, drivers ou ventoinhas. Sem instalação ou troca de driver USB.

## Protocolo estudado (apenas dados técnicos)

A estrutura de HID Feature Reports (report ID 02, 16 bytes) e as regiões de configuração RGB foram levantadas de informações públicas sobre o M711. O driver foi escrito no AppSpace a partir dos fatos sobre o protocolo; não exige ou integra nenhum outro programa.

Fontes:
- https://github.com/CalcProgrammer1/OpenRGB/tree/master/Controllers/RedragonController
- https://github.com/ernesto-elsaesser/usb-mouse-config
- https://github.com/Chocapikk/hidproto

## Como validar no Windows

1. Instalar o EXE AppSpace gerado pela pipeline da PR (versão experimental `0.7.38`).
2. Em **Meu PC → RGB Controller**, clicar em **Verificar conexão**.
3. Se a interface RGB aparecer como identificada, selecionar **Perfil 1**, **Cor fixa**, definir uma cor, autorizar no checkbox e clicar **Aplicar RGB no mouse**.
4. Verificar se os LEDs mudaram. Se não, conferir o perfil ativo no mouse antes de testar outro perfil.
5. Não tratar `Comando enviado` como prova de alteração física: conferir visualmente.

### Comandos de diagnóstico (somente leitura)

```powershell
npm run check
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File desktop/rgb-direct.ps1 -Operation scan
```

A versão atual faz alterações físicas **somente mediante confirmação explícita no aplicativo**.
