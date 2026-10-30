param(
 [ValidateSet("scan","set")][string]$Operation="scan",
 [ValidatePattern('^#[0-9a-fA-F]{6}$')][string]$Color="#8D6AFF",
 [ValidateSet("static","breathing","rainbow","wave","flashing")][string]$Effect="static",
 [ValidateRange(1,5)][int]$Profile=1
)
$ErrorActionPreference="Stop"
# AppSpace RGB Direct. Windows built-in HID/SetupAPI only. No external app/driver.
# Write gate: exact 04D9:FC30, MI_02, HID usage page FFA0, 16-byte feature report.
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
 }
 public static class Driver {
  [DllImport("hid.dll")] private static extern void HidD_GetHidGuid(out Guid hidGuid);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_GetAttributes(SafeFileHandle handle,ref HID_ATTRIBUTES attributes);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_GetPreparsedData(SafeFileHandle handle,out IntPtr data);
  [DllImport("hid.dll",SetLastError=true)] private static extern bool HidD_FreePreparsedData(IntPtr data);
  [DllImport("hid.dll")] private static extern int HidP_GetCaps(IntPtr data,ref HIDP_CAPS caps);
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
  private static bool Compatible(string path,SafeFileHandle handle){
   // Ignore keyboard and generic mouse HID collections even with identical VID/PID.
   if(path.IndexOf("mi_02",StringComparison.OrdinalIgnoreCase)<0)return false;
   var attr=new HID_ATTRIBUTES();attr.Size=Marshal.SizeOf(typeof(HID_ATTRIBUTES));
   if(!HidD_GetAttributes(handle,ref attr)||attr.VendorID!=0x04D9||attr.ProductID!=0xFC30)return false;
   IntPtr raw;
   if(!HidD_GetPreparsedData(handle,out raw))return false;
   try {
    var caps=new HIDP_CAPS();caps.Reserved=new ushort[17];
    int code=HidP_GetCaps(raw,ref caps);
    return code>=0 && caps.UsagePage==0xFFA0 && caps.FeatureReportByteLength==16;
   } finally{HidD_FreePreparsedData(raw);}
  }
  private static string[] Find(){
   var matches=new List<string>();Guid guid;HidD_GetHidGuid(out guid);
   var info=SetupDiGetClassDevs(ref guid,IntPtr.Zero,IntPtr.Zero,0x12); // PRESENT|DEVICEINTERFACE
   if(info==new IntPtr(-1))throw new Win32Exception(Marshal.GetLastWin32Error());
   try{
    for(uint i=0;i<512;i++){
     var entry=new SP_DEVICE_INTERFACE_DATA();
     entry.cbSize=Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));
     if(!SetupDiEnumDeviceInterfaces(info,IntPtr.Zero,ref guid,i,ref entry)){
      if(Marshal.GetLastWin32Error()==259)break; // ERROR_NO_MORE_ITEMS
      continue;
     }
     uint need;
     SetupDiGetDeviceInterfaceDetail(info,ref entry,IntPtr.Zero,0,out need,IntPtr.Zero);
     if(need<8||need>8192)continue;
     IntPtr memory=Marshal.AllocHGlobal((int)need);
     try{
      Marshal.WriteInt32(memory,IntPtr.Size==8?8:6);
      uint actual;
      if(!SetupDiGetDeviceInterfaceDetail(info,ref entry,memory,need,out actual,IntPtr.Zero))continue;
      var path=Marshal.PtrToStringUni(new IntPtr(memory.ToInt64()+4));
      if(String.IsNullOrEmpty(path)||path.IndexOf("vid_04d9",StringComparison.OrdinalIgnoreCase)<0||
       path.IndexOf("pid_fc30",StringComparison.OrdinalIgnoreCase)<0||
       path.IndexOf("mi_02",StringComparison.OrdinalIgnoreCase)<0)continue;
      using(var h=CreateFile(path,0,3,IntPtr.Zero,3,0,IntPtr.Zero)){
       if(!h.IsInvalid&&Compatible(path,h))matches.Add(path);
      }
     }finally{Marshal.FreeHGlobal(memory);}
    }
   }finally{SetupDiDestroyDeviceInfoList(info);}
   return matches.ToArray();
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
   var paths=Find();
   var state=new Status{
    available=true,device="Redragon M711 Cobra (04D9:FC30)",
    status=paths.Length==1?"detected":paths.Length==0?"not_found":"ambiguous",
    writable=paths.Length==1,reason=paths.Length==1?"Interface HID validada (MI_02 / FFA0).":
      paths.Length==0?"Interface RGB compativel nao encontrada.":"Multiplas interfaces RGB; comando bloqueado.",
    transport="Windows HID nativo",effects=new[]{"static","breathing","rainbow","wave","flashing"},
    profiles=5,lastAction="none"
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
    if(!Compatible(paths[0],handle))throw new InvalidOperationException("Interface HID mudou; escrita bloqueada");
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
 [AppSpaceRgb.Driver]::Execute($Operation,$Color,$Effect,$Profile) | ConvertTo-Json -Compress -Depth 4
}catch{
 [Console]::Error.WriteLine("RGB nativo: "+$_.Exception.Message)
 exit 1
}
