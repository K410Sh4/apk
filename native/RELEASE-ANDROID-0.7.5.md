# AppSpace Android 0.7.5 — checklist de publicação segura

**Alvo:** versão nativa `0.7.5` com plugin `LabelDocuments`; web OTA `0.7.27`.

## O que foi preparado

- `package.json` versão nativa `0.7.5` (Capacitor e EXE).
- `npm run mobile:add` e `npm run mobile:sync` registram `LabelDocuments`.
- GitHub CI compila e testa o APK de depuração para diagnóstico, **não** o distribui como APK de atualização de produção.
- `.github/workflows/appspace-native-release.yml` usa `assembleRelease`, exige chave persistente e verifica o certificado do APK.
- `ota/publish-request.json` disponibiliza conteúdo web `0.7.27`. O conteúdo web funciona em APKs a partir de `0.7.4`, com fallback para arquivos quando o plugin SAF não existe.

## Bloqueador de publicação do APK de produção

É obrigatório configurar no repositório GitHub (Settings → Secrets and variables → Actions) os segredos:

- `APPSPACE_ANDROID_KEYSTORE_BASE64`: keystore **privado** em base64, sem quebra de linhas.
- `APPSPACE_ANDROID_STORE_PASSWORD`: senha do keystore.
- `APPSPACE_ANDROID_KEY_ALIAS`: nome do alias da chave.
- `APPSPACE_ANDROID_KEY_PASSWORD`: senha da chave.

Exemplo para gerar **uma vez**, no PC Windows com JDK instalado:

```powershell
keytool -genkeypair -v -keystore appspace-release.jks -storetype PKCS12 -alias appspace -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=AppSpace Release"
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\appspace-release.jks)))
```

A saída base64 vai apenas ao GitHub Secret; **não a coloque em chat, issue, PR ou commit**. Guarde uma cópia offline do `.jks` e das senhas; perder a chave impede atualizar futuras instalações assinadas por ela.

### Publicar somente depois dos quatro segredos e CI

Atualize `native/android-release-request.json` para:

```json
{
  "version": "0.7.5",
  "notes": "Etiqueta Studio visual separado do gerador, campos de produto estáveis, impressão A4 e integração de documentos Android."
}
```

O push desse arquivo na `main` ativa o release, e o workflow só publica se a compilação estiver assinada e for verificada com `apksigner`. A versão `0.7.5` deve ser única e superior às já publicadas.

## MIGRAÇÃO IMPORTANTE DOS APKs ATUAIS

Os releases antigos `0.7.4` foram construídos como **debug APK** em runners do GitHub. A chave dessa versão pode ser diferente da nova chave de produção; Android pode recusar instalação por cima, independentemente do número de versão.

**Antes de desinstalar:** exportar projeto JSON do Etiqueta Studio e lista JSON/CSV do gerador, salvar de fato em Arquivos/Drive, verificar os documentos e então instalar o novo APK. Desinstalar pode apagar `localStorage` e outros dados do app.

Não afirmar compatibilidade de assinatura sem comparar certificados SHA-256 dos APKs com `apksigner verify --print-certs`; sem certificado igual, não há atualização no lugar.

## Testes de aceitação física (pendentes)

1. Abra o APK `0.7.5` e confirme o novo seletor de documentos do Android ao salvar e importar JSON/CSV.
2. Selecione *Cancelar* e confirme que a tabela/modelo não são apagados.
3. Edite um preço longo: verifique que o sistema acusa transbordamento antes de imprimir.
4. Crie `product.sku` com texto e barras e confirme que os dois correspondem.
5. Gere folhas A4 com posição inicial 3, salve PDF pelo sistema e confira com impressão física a 100%.
6. Teste a impressora Wi‑Fi e uma impressora indisponível, sem prometer sucesso antes do spooler.

## Limites

A OTA não instala código nativo; o plugin SAF só existe no novo APK. O recurso *Salvar como PDF* encaminha para o diálogo nativo de impressão, onde o usuário escolhe essa opção — não há gerador PDF autônomo nem integração dedicada para impressoras térmicas nesta versão.
