param(
 [ValidateSet("scan","set")][string]$Operation="scan",
 [ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color="#8D6AFF",
 [ValidateSet("static","breathing","rainbow","wave","flashing")][string]$Effect="static",
 [ValidateRange(1,5)][int]$Profile=1
)
$ErrorActionPreference="Stop"
# AppSpace RGB Direct. Windows built-in HID/SetupAPI only. No external app/driver.
# Write gate: exact 04D9:FC30, HID vendor usage page FFA0, 16-byte feature report.
# Device interface paths are opaque: do NOT parse MI_02 from strings as a prerequisite.
# No firmware, DPI, fan PWM, arbitrary device paths, or unknown VID/PID writes.
$source=@'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace AppSpaceRgb {
 [StructLayout(LayoutKind.Sequential)]
 internal struct HID_ATTRIBUTES {
  public int Size;
  public ushort VendorID, ProductID, VersionNumber;
 }
 [StructLayout(LayoutKind.Sequential)]
 internal struct SP_DEVICE_INTERFACE_DATA {
  public int cbSize;
  public Guid InterfaceClassGuid;
  public int Flags;
  public IntPtr Reserved;
 }
 [StructLayout(LayoutKind.Sequential)]
 internal struct HIDP_CAPS {
  public ushort Usage, UsagePage, InputReportByteLength, OutputReportByteLength, FeatureReportByteLength;
  [MarshalAs(UnmanagedType.ByValArray,SizeConst=17)] public ushort[] Reserved;
  public ushort NumberLinkCollectionNodes,NumberInputButtonCaps,NumberInputValueCaps,NumberInputDataIndices;
  public ushort NumberOutputButtonCaps,NumberOutputValueCaps,NumberOutputDataIndices;
  public ushort NumberFeatureButtonCaps,NumberFeatureValueCaps,NumberFeatureDataIndices;
 }
 public class Status {
  public bool available {get;set;}
  public string device {get;set;}
  public string status {get;set;}
  public bool writable {get;set;}
  public string reason {get;set;}
  public string transport {get;set;}
  public string[] effects {get;set;}
  public int profiles {get;set;}
  public string lastAction {get;set;}
  public int hidCollectionsSeen {get;set;}
  public int targetCollectionsSeen {get;set;}
  public InterfaceProbe[] diagnostics {get;set;}
 }
 public class InterfaceProbe {
  public int number {get;set;}
  public string usagePage {get;set;}
  public string usage {get;set;}
  public int featureReportBytes {get;set;}
  public int inputReportBytes {get;set;}
  public int outputReportBytes {get;set;}
  public int outputButtonCaps {get;set;}
  public int outputValueCaps {get;set;}
  public int featureButtonCaps {get;set;}
  public int featureValueCaps {get;set;}
  public string[] featureValueReportIds {get;set;}
  public string featureCapsStatus {get;set;}
  public string result {get;set;}
  public int errorCode {get;set;}
 }
 internal class ScanResult {
  public List<string> paths=new List<string>();
  public List<InterfaceProbe> probes=new List<InterfaceProbe>();
  public int hidCollections=0;
  public int targetCollections=0;
 }
 public static class Driver {
  [DllImport("hid.dll")] private static extern void HidD_GetHidGuid(out Guid hidGuid);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_GetAttributes(SafeFileHandle handle,ref HID_ATTRIBUTES attributes);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_GetPreparsedData(SafeFileHandle handle,out IntPtr data);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_FreePreparsedData(IntPtr data);
  [DllImport("hid.dll")] private static extern int HidP_GetCaps(IntPtr data,ref HIDP_CAPS caps);
  [DllImport("hid.dll")] private static extern int HidP_GetValueCaps(int reportType,IntPtr valueCaps,ref ushort valueCapsLength,IntPtr preparsedData);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_SetFeature(SafeFileHandle handle,byte[] bytes,int length);
  [DllImport("setupapi.dll",SetLastError=true,CharSet=CharSet.Unicode)]
  private static extern IntPtr SetupDiGetClassDevs(ref Guid classGuid,IntPtr enumerator,IntPtr hwnd,uint flags);
  [DllImport("setupapi.dll",SetLastError=true)]
  private static extern bool SetupDiEnumDeviceInterfaces(IntPtr info,IntPtr devInfo,ref Guid guid,uint index,ref SP_DEVICE_INTERFACE_DATA iface);
  [DllImport("setupapi.dll",SetLastError=true,EntryPoint="SetupDiGetDeviceInterfaceDetailW",CharSet=CharSet.Unicode)]
  private static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr info,ref SP_DEVICE_INTERFACE_DATA iface,IntPtr detail,uint size,out uint required,IntPtr devInfo);
  [DllImport("setupapi.dll",SetLastError=true)] private static extern bool SetupDiDestroyDeviceInfoList(IntPtr info);
  [DllImport("kernel32.dll",EntryPoint="CreateFileW",SetLastError=true,CharSet=CharSet.Unicode)]
  private static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
  private static bool GetCapsForTarget(SafeFileHandle handle,out HIDP_CAPS caps,out int error){
   caps=new HIDP_CAPS();caps.Reserved=new ushort[17];error=0;
   IntPtr raw=IntPtr.Zero;
   if(!HidD_GetPreparsedData(handle,out raw)){
    error=Marshal.GetLastWin32Error();return false;
   }
   try{
    int code=HidP_GetCaps(raw,ref caps);
    if(code<0){error=code;return false;}
    return true;
   }finally{HidD_FreePreparsedData(raw);}
  }
  // Reads only the Windows HID report parser's metadata. Never sends or retrieves USB reports.
  // HIDP_VALUE_CAPS is 72 bytes on Windows; ReportID occupies byte offset 2 (WinSDK hidpi.h).
  private static string[] FeatureReportIds(SafeFileHandle handle,ushort declaredCount,out string status){
   status="none";
   if(declaredCount==0)return new string[0];
   if(declaredCount>64){status="too_many_caps";return new string[0];}
   IntPtr raw=IntPtr.Zero;
   if(!HidD_GetPreparsedData(handle,out raw)){status="no_descriptor";return new string[0];}
   try{
    ushort count=declaredCount;
    int capSize=72;
    IntPtr mem=Marshal.AllocHGlobal(capSize*count);
    try{
     for(int k=0;k<capSize*count;k++)Marshal.WriteByte(mem,k,0);
     int code=HidP_GetValueCaps(2,mem,ref count,raw); // 2 == HidP_Feature
     if(code<0){status="parse_failed";return new string[0];}
     var ids=new SortedSet<string>(StringComparer.Ordinal);
     for(int i=0;i<count&&i<64;i++)
      ids.Add("0x"+Marshal.ReadByte(mem,i*capSize+2).ToString("X2"));
     status="parsed";
     return new List<string>(ids).ToArray();
    }finally{Marshal.FreeHGlobal(mem);}
   }finally{HidD_FreePreparsedData(raw);}
  }
  private static bool Compatible(SafeFileHandle handle){
   var attributes=new HID_ATTRIBUTES();
   attributes.Size=Marshal.SizeOf(typeof(HID_ATTRIBUTES));
   if(!HidD_GetAttributes(handle,ref attributes)||
     attributes.VendorID!=0x04D9||attributes.ProductID!=0xFC30)return false;
   HIDP_CAPS caps;int error;
   return GetCapsForTarget(handle,out caps,out error)&&
          caps.UsagePage==0xFFA0&&caps.FeatureReportByteLength==16;
  }
  private static ScanResult Find(){
   var found=new ScanResult();
   Guid guid;HidD_GetHidGuid(out guid);
   var info=SetupDiGetClassDevs(ref guid,IntPtr.Zero,IntPtr.Zero,0x12); // PRESENT|DEVICEINTERFACE
   if(info==new IntPtr(-1))throw new Win32Exception(Marshal.GetLastWin32Error());
   try{
    for(uint i=0;i<1024;i++){
     var entry=new SP_DEVICE_INTERFACE_DATA();
     entry.cbSize=Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));
     if(!SetupDiEnumDeviceInterfaces(info,IntPtr.Zero,ref guid,i,ref entry)){
      if(Marshal.GetLastWin32Error()==259)break;
      continue;
     }
     found.hidCollections++;
     uint need;
     SetupDiGetDeviceInterfaceDetail(info,ref entry,IntPtr.Zero,0,out need,IntPtr.Zero);
     if(need<8||need>8192)continue;
     IntPtr memory=Marshal.AllocHGlobal((int)need);
     try{
      Marshal.WriteInt32(memory,IntPtr.Size==8?8:6);
      uint actual;
      if(!SetupDiGetDeviceInterfaceDetail(info,ref entry,memory,need,out actual,IntPtr.Zero))continue;
      // The symbolic path is *only* passed to CreateFile; never used to identify VID/PID/MI.
      string path=Marshal.PtrToStringUni(new IntPtr(memory.ToInt64()+4));
      if(String.IsNullOrEmpty(path))continue;
      using(var h=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)){
       if(h.IsInvalid)continue;
       var a=new HID_ATTRIBUTES();a.Size=Marshal.SizeOf(typeof(HID_ATTRIBUTES));
       if(!HidD_GetAttributes(h,ref a)||a.VendorID!=0x04D9||a.ProductID!=0xFC30)continue;
       found.targetCollections++;
       var probe=new InterfaceProbe();
       probe.number=found.targetCollections;
       probe.usagePage="unknown";probe.usage="unknown";
       probe.featureReportBytes=0;
       probe.result="caps_unavailable";
       HIDP_CAPS caps;int error;
       if(GetCapsForTarget(h,out caps,out error)){
        probe.usagePage="0x"+caps.UsagePage.ToString("X4");
        probe.usage="0x"+caps.Usage.ToString("X4");
        probe.featureReportBytes=caps.FeatureReportByteLength;
       probe.inputReportBytes=caps.InputReportByteLength;
       probe.outputReportBytes=caps.OutputReportByteLength;
       probe.outputButtonCaps=caps.NumberOutputButtonCaps;
       probe.outputValueCaps=caps.NumberOutputValueCaps;
       probe.featureButtonCaps=caps.NumberFeatureButtonCaps;
       probe.featureValueCaps=caps.NumberFeatureValueCaps;
       probe.featureValueReportIds=new string[0];
       probe.featureCapsStatus="not_checked";
       if(caps.UsagePage==0xFFA0&&caps.NumberFeatureValueCaps>0){
        string capsStatus;
        probe.featureValueReportIds=FeatureReportIds(h,caps.NumberFeatureValueCaps,out capsStatus);
        probe.featureCapsStatus=capsStatus;
       }
        if(caps.UsagePage==0xFFA0&&caps.FeatureReportByteLength==16){
         probe.result="rgb_candidate";found.paths.Add(path);
        }else if(caps.UsagePage!=0xFFA0)probe.result="different_usage_page";
        else probe.result=caps.FeatureReportByteLength==0?"no_feature_report":"different_report_length";
       }else{
        probe.errorCode=error;
       }
       if(found.probes.Count<24)found.probes.Add(probe);
      }
     }finally{Marshal.FreeHGlobal(memory);}
    }
   }finally{SetupDiDestroyDeviceInfoList(info);}
   return found;
  }
  private static byte[] Packet(int address,byte[] values){
   var buf=new byte[16];
   buf[0]=0x02;buf[1]=0xF3;
   buf[2]=(byte)(address&255);buf[3]=(byte)((address>>8)&255);
   buf[4]=(byte)values.Length;Array.Copy(values,0,buf,8,values.Length);
   return buf;
  }
  private static void Send(SafeFileHandle h,byte[] packet){
   if(!HidD_SetFeature(h,packet,packet.Length))
    throw new Win32Exception(Marshal.GetLastWin32Error(),"Dispositivo recusou o comando HID");
  }
  private static byte Mode(string effect){
   switch(effect){
    case "static":return 0x02;
    case "breathing":return 0x04;
    case "rainbow":return 0x08;
    case "wave":return 0x00;
    case "flashing":return 0x10;
    default:throw new ArgumentException("Efeito nao permitido");
   }
  }
  public static Status Execute(string operation,string hex,string effect,int profile){
   var scan=Find();
   var paths=scan.paths;
   var state=new Status{
    available=true,device="Redragon M711 Cobra (04D9:FC30)",
    status=paths.Count==1?"detected":paths.Count==0?"not_found":"ambiguous",
    writable=paths.Count==1,reason=paths.Count==1?"Interface RGB validada por VID/PID, uso FFA0 e Feature Report de 16 bytes.":
      paths.Count>1?"Multiplas colecoes RGB compativeis; escrita bloqueada.":
      scan.probes.Exists(p=>p.usagePage=="0xFFA0"&&p.featureReportBytes==0)?
        "Colecao FFA0 presente, mas declara Feature=0 e Output=0. Driver HID RGB bloqueado. A investigacao agora e dos descritores Feature; sem escrita USB.":
      scan.targetCollections>0?"Mouse 04D9:FC30 detectado, mas nenhuma colecao corresponde ao protocolo RGB FFA0 / 16 bytes.":
      "Nenhuma colecao HID com VID 04D9 e PID FC30 foi encontrada. O Windows pode identificar o mouse por outra interface.",
    transport="Windows HID nativo",effects=new[]{"static","breathing","rainbow","wave","flashing"},
    profiles=5,lastAction="none",
    hidCollectionsSeen=scan.hidCollections,
    targetCollectionsSeen=scan.targetCollections,
    diagnostics=scan.probes.ToArray()
   };
   if(operation=="scan")return state;
   if(operation!="set")throw new ArgumentException("Operacao nao permitida");
   if(!state.writable)throw new InvalidOperationException(state.reason);
   if(profile<1||profile>5)throw new ArgumentOutOfRangeException("profile");
   if(hex==null||hex.Length!=7||hex[0]!='#')throw new ArgumentException("Cor invalida");
   int r=Convert.ToInt32(hex.Substring(1,2),16);
   int g=Convert.ToInt32(hex.Substring(3,2),16);
   int b=Convert.ToInt32(hex.Substring(5,2),16);
   byte mode=Mode(effect);
   // 5 preset banks. Writes only LED configuration, not profile or button assignments.
   int addr=0x0449+(profile-1)*8;
   using(var handle=CreateFile(paths[0],0x40000000,3,IntPtr.Zero,3,0,IntPtr.Zero)){
    if(handle.IsInvalid)throw new Win32Exception(Marshal.GetLastWin32Error(),"Sem acesso a interface HID");
    if(!Compatible(handle))throw new InvalidOperationException("Interface HID mudou; escrita bloqueada");
    Send(handle,Packet(addr,new byte[]{(byte)r,(byte)g,(byte)b,0x01,0x00,mode}));
    var apply=new byte[16];apply[0]=0x02;apply[1]=0xF1;apply[2]=0x02;apply[3]=0x04;
    Send(handle,apply);
   }
   state.lastAction="sent";
   state.reason="Comandos enviados ao dispositivo; confirme a mudanca visual nos LEDs.";
   return state;
  }
 }
}
'@
try{
 Add-Type -TypeDefinition $source -ErrorAction Stop
 [AppSpaceRgb.Driver]::Execute($Operation,$Color,$Effect,$Profile) | ConvertTo-Json -Compress -Depth 6
}catch{
 [Console]::Error.WriteLine("RGB nativo: "+$_.Exception.Message)
 exit 1
}
