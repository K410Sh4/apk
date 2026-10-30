"use strict";
/* Inject stable Android release signing into the generated Capacitor Gradle project.
 * Secret material remains in GitHub Actions env and runner temp; never commit keys.
 */
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),gradlePath=path.join(root,"mobile","android","app","build.gradle");
const keys=["APPSPACE_RELEASE_KEYSTORE_PATH","APPSPACE_RELEASE_STORE_PASSWORD",
  "APPSPACE_RELEASE_KEY_ALIAS","APPSPACE_RELEASE_KEY_PASSWORD"];
for(const key of keys)if(!process.env[key])throw Error("Assinatura de release não configurada: "+key);
if(!fs.statSync(process.env.APPSPACE_RELEASE_KEYSTORE_PATH).isFile())
  throw Error("Keystore Android não encontrado no caminho configurado.");
let gradle=fs.readFileSync(gradlePath,"utf8");
if(!/android\s*\{/.test(gradle))throw Error("Gradle Android desconhecido: assinatura não aplicada.");
const marker="// APPSPACE_STABLE_RELEASE_SIGNING";
if(!gradle.includes(marker)){
  gradle+=[
    "",marker,"android {",
    "    signingConfigs {",
    "        appspaceRelease {",
    "            storeFile file(System.getenv('APPSPACE_RELEASE_KEYSTORE_PATH'))",
    "            storePassword System.getenv('APPSPACE_RELEASE_STORE_PASSWORD')",
    "            keyAlias System.getenv('APPSPACE_RELEASE_KEY_ALIAS')",
    "            keyPassword System.getenv('APPSPACE_RELEASE_KEY_PASSWORD')",
    "        }",
    "    }",
    "    buildTypes {",
    "        release {",
    "            signingConfig signingConfigs.appspaceRelease",
    "        }",
    "    }",
    "}",
    ""
  ].join("\n");
  fs.writeFileSync(gradlePath,gradle);
}
console.log("[AppSpace] Assinatura estável de release registrada (sem registrar credenciais).");
