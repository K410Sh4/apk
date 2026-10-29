# AppSpace — versões desktop e Android

Esta pasta reserva o espaço para o projeto Android **independente** do portal AppSpace.
O projeto Kotlin/Jetpack Compose existente continua em `/app`.

**ATENÇÃO:** a subpasta `mobile/android/` é **gerada pelo Capacitor**, quando você executa `npm run mobile:add` na raiz do repositório. Ainda não é um projeto Android previamente compilado.

Para criar a estrutura nativa (apenas uma vez):

```powershell
npm install
npm run mobile:add
```

Para atualizar os HTML/CSS/JS depois de qualquer alteração:

```powershell
npm run mobile:sync
```

Para abrir no Android Studio:

```powershell
npm run mobile:open
```

Para instalar e testar no dispositivo conectado (Android SDK e dispositivo/emulador configurados):

```powershell
npm run mobile:run
```

É possível compilar `app-debug.apk` com o botão **Run workflow** do GitHub Actions após enviar as alterações para a branch principal.

Os recursos HTML são incorporados no pacote Android na etapa `cap sync`. Após a instalação, o portal inicial funciona sem conexão de rede, desde que os futuros apps também sejam locais.

O aplicativo Android usa o identificador `com.k410sh4.appspace`, diferente do projeto Samsung Buds.
