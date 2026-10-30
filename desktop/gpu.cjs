"use strict";
/* GPU telemetry for Windows WDDM. Never invents a reading if the OS counters fail.
 * Get-CimInstance uses class/property identifiers that are not localized.
 * Probe is async, cached and rate-limited: LAN requests never spawn processes.
 */
const {execFile}=require("node:child_process");
const POWERSHELL="$ErrorActionPreference='Stop'; $s=@(Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop | Select-Object -Property Name,UtilizationPercentage); if($s.Count -eq 0){'[]'}else{$s|ConvertTo-Json -Compress -Depth 3}";
const clamp=n=>Math.min(100,Math.max(0,n));
function parseGpuCounters(value){
 let rows=value;
 if(typeof value==="string"){
   try{rows=JSON.parse(value.trim().replace(/^\uFEFF/,""));}catch(_){return null;}
 }
 if(!Array.isArray(rows))rows=rows&&typeof rows==="object"?[rows]:[];
 const engines=new Map();
 for(const row of rows){
   if(!row||typeof row.Name!=="string"||row.UtilizationPercentage==null)continue;
   const n=Number(row.UtilizationPercentage);
   if(!Number.isFinite(n)||n<0)continue;
   // Perf counters are per-process per physical GPU engine, not per complete GPU.
   // Aggregate processes by physical engine, then choose the busiest engine.
   const id=row.Name.match(/luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\d+_eng_\d+_engtype_[a-z0-9]+/i);
   if(!id)continue;
   const key=id[0].toLowerCase();
   engines.set(key,(engines.get(key)||0)+n);
 }
 if(!engines.size)return null;
 return Math.round(clamp(Math.max(...engines.values())));
}
function createGpuSampler(options={}){
 const platform=options.platform??process.platform;
 const invoke=options.execFileFn??execFile;
 const clock=options.clock??Date.now;
 const intervalMs=options.intervalMs??3000;
 let timer=null,pending=false,lastAt=0;
 let result={percent:null,temperatureC:null,status:platform==="win32"?"warming":"unsupported",source:"Windows WDDM"};
 function sample(){
   if(result.status==="ready"&&clock()-lastAt>12000)
     return {...result,percent:null,status:"stale"};
   return {...result};
 }
 function refresh(){
   if(platform!=="win32"||pending)return;
   pending=true;
   invoke("powershell.exe",["-NoProfile","-NonInteractive","-Command",POWERSHELL],
     {windowsHide:true,timeout:5000,maxBuffer:262144},(err,stdout)=>{
       pending=false;lastAt=clock();
       const percent=err?null:parseGpuCounters(stdout);
       result={percent,temperatureC:null,
         status:percent===null?"unavailable":"ready",source:"Windows WDDM"};
     });
 }
 function start(){
   if(platform!=="win32"||timer)return;
   refresh();
   timer=setInterval(refresh,intervalMs);
   timer.unref?.();
 }
 function stop(){
   if(timer)clearInterval(timer);
   timer=null;
 }
 return Object.freeze({sample,refresh,start,stop});
}
module.exports={createGpuSampler,parseGpuCounters};
