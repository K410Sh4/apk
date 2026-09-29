# BudsLab — Galaxy Buds Core SM-R410

Aplicativo Android experimental para estudar o Galaxy Buds Core (SM-R410) usando Bluetooth clássico/RFCOMM.

## V1

- Lista dispositivos Bluetooth já pareados.
- Conecta ao serviço SPP usado pelo Galaxy Buds Core:
  `2e73a4ad-332d-41fc-90e2-16bef06523f2`.
- Registra pacotes recebidos sem enviar comandos de fábrica, reset ou atualização.
- Reconhece IDs comuns do protocolo e exibe payload bruto em hexadecimal.
- Toca tons estéreo de teste em volume baixo para experimentos acústicos.
- Exportação inicial feita copiando o log da tela.
- Não modifica firmware.
- Não é EEG e não mede sinapses.

## Como gerar o APK

O workflow **Android APK** roda automaticamente em pushes para `main` e também pode ser iniciado manualmente em **Actions → Android APK → Run workflow**.

Ao terminar, baixe o artifact **BudsLab-debug-apk**. Dentro dele estará:

`app-debug.apk`

## Uso

1. Pareie o SM-R410 normalmente nas configurações Bluetooth do Android.
2. Feche o Galaxy Wearable se ele estiver mantendo o canal de gerenciamento ocupado.
3. Abra BudsLab e conceda a permissão **Dispositivos próximos**.
4. Toque em **Atualizar pareados**.
5. Selecione o Galaxy Buds Core.
6. Toque em **Conectar SPP**.
7. O painel passa a mostrar pacotes recebidos pelo canal Samsung.

## Segurança da V1

Esta versão é deliberadamente passiva no protocolo proprietário. Ela não envia comandos de FOTA, reset, factory/debug mode ou alterações persistentes. O único sinal ativo gerado é áudio comum, em amplitude baixa, reproduzido pelo sistema Android.

## Build

- Android Gradle Plugin 9.4.0
- Gradle 9.6.0 no GitHub Actions
- JDK 17
- compileSdk/targetSdk 36
- minSdk 26

Projeto experimental, sem afiliação com a Samsung.
