"use strict";
// Called after Capacitor creates/syncs the Android app. Idempotent.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const pkg="com.k410sh4.appspace";
const target=path.join(root,"mobile","android","app","src","main","java",...pkg.split("."));
const activityPath=path.join(target,"MainActivity.java");
if(!fs.existsSync(activityPath))throw Error("MainActivity não encontrado: execute cap add android antes.");
const pluginSrc=path.join(root,"native","label-documents","LabelDocumentsPlugin.java");
fs.copyFileSync(pluginSrc,path.join(target,"LabelDocumentsPlugin.java"));
let activity=fs.readFileSync(activityPath,"utf8");
if(!activity.includes("registerPlugin(LabelDocumentsPlugin.class)")){
  if(/\bvoid\s+onCreate\s*\(\s*Bundle\s+/.test(activity)){
    activity=activity.replace(/\bsuper\.onCreate\(([^)]*)\)\s*;/,
      'registerPlugin(LabelDocumentsPlugin.class);\n        super.onCreate($1);');
  }else{
    const end=activity.lastIndexOf("}");
    if(end<0||!activity.includes("extends BridgeActivity"))throw Error("MainActivity não reconhecida.");
    if(!activity.includes("import android.os.Bundle;"))
      activity=activity.replace(/(package\s+[^;]+;)/,'$1\nimport android.os.Bundle;');
    const insertion="\n    @Override\n    protected void onCreate(Bundle savedInstanceState) {\n"+
      "        registerPlugin(LabelDocumentsPlugin.class);\n"+
      "        super.onCreate(savedInstanceState);\n    }\n";
    activity=activity.slice(0,activity.lastIndexOf("}"))+insertion+"}\n";
  }
  if(!activity.includes("registerPlugin(LabelDocumentsPlugin.class)"))
    throw Error("Falha ao registrar LabelDocuments.");
  fs.writeFileSync(activityPath,activity);
}
console.log("[AppSpace] Integração Android SAF LabelDocuments instalada.");
