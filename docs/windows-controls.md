# AppSpace — Controles reais do Windows (primeiro núcleo)

## Escopo confirmado pelo software

O aplicativo só controla recursos globais do Windows, não firmware USB ou RGB.

| Ação | Interface Windows | Alcance | Faixa |
|---|---|---|---|
| Microfone: mute e volume | Core Audio `IAudioEndpointVolume` | Dispositivo de gravação **padrão** do Windows (multimídia) | 0–100%, ligado/desligado |
| Áudio de saída: mute e volume | Core Audio `IAudioEndpointVolume` | Dispositivo de reprodução **padrão** | 0–100%, ligado/desligado |
| Velocidade do ponteiro | Win32 `SystemParametersInfo(SPI_SETMOUSESPEED)` | Todos os dispositivos que usam o cursor comum | 1–20 |
| Repetição do teclado | Win32 `SystemParametersInfo(SPI_SETKEYBOARDSPEED)` | Preferência global do usuário | 0–31 |

A controladora SATA/ARGB, os LEDs do FIFINE, teclado e mouse **permanecem sem controle físico**. O microfone padrão do Windows pode não ser o FIFINE. Ajustar o ponteiro **não altera DPI do mouse**, e a repetição **não configura firmware do teclado**.

## Uso

1. Atualize o **EXE Windows**, pois os controles exigem o adaptador nativo `desktop/pc-controls.ps1` e as rotas `/__api/pc/controls` e `/pc/controls`. Um ZIP OTA apenas da interface não instala esse adaptador.
2. Em **Meu PC → Controle do PC**, visualize o estado atual.
3. Ajuste os sliders e clique em **Aplicar**. Mute tem botão próprio.
4. No celular, pareie o PC usando o código do AppSpace, na mesma rede privada. O servidor LAN exige o token para GET/POST. A API envia controles somente ao PC, nunca a drivers USB diretamente.

## Proteções

- Lista fechada de seis operações; validação de tipos e faixas no host.
- Sem interpretação de comandos fornecidos pelo cliente; PowerShell é invocado com `execFile` e argumentos fixos.
- Nenhum comando para HID, USB, OpenRGB, RGB/ARGB ou controle das ventoinhas.
- Não altera o driver, não toca o registro diretamente e não muda configuração ao consultar.
- Preferências de mouse e teclado são persistidas pelas APIs padrão do Windows. As alterações de volume e mute afetam o sistema imediatamente.
- Comunicação celular-PC é HTTP privado com token de pareamento, **não é criptografada**; não use redes Wi-Fi não confiáveis.
- Os testes automatizados simulam o adaptador. A CI compila e lê o script no runner Windows, mas o comportamento nos periféricos específicos precisa ser testado no computador do usuário.

## Validação sugerida no Windows

```powershell
npm run check
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File desktop/pc-controls.ps1 -Operation read
npm run desktop:exe
```

Os controles de volume variam conforme o driver. Se o endpoint não oferecer Core Audio, o AppSpace deve exibir indisponibilidade ou erro, sem tentar comandos desconhecidos.
