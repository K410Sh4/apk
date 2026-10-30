param(
 [ValidateSet("read","write")][string]$Operation="read",
 [string]$Setting="",
 [int]$Value=0
)
$ErrorActionPreference = "Stop"
# Controle somente de endpoints PADRAO do Windows e preferencias globais.
# Nao acessa HID, USB, firmware, ARGB, ventoinhas ou drivers de terceiros.
$code = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

namespace AppSpaceControls {
 [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
 internal class MMDeviceEnumeratorClass {}

 [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),
  InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 internal interface IMMDeviceEnumerator {
  void EnumAudioEndpoints(int flow, uint stateMask, out IntPtr devices);
  void GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
  void GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
  void RegisterEndpointNotificationCallback(IntPtr client);
  void UnregisterEndpointNotificationCallback(IntPtr client);
 }

 [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"),
  InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 internal interface IMMDevice {
  void Activate(ref Guid iid, uint clsctx, IntPtr activationParams,
   [MarshalAs(UnmanagedType.Interface)] out object instance);
  void OpenPropertyStore(uint access, out IntPtr store);
  void GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
  void GetState(out uint state);
 }

 [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),
  InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 internal interface IAudioEndpointVolume {
  void RegisterControlChangeNotify(IntPtr callback);
  void UnregisterControlChangeNotify(IntPtr callback);
  void GetChannelCount(out uint count);
  void SetMasterVolumeLevel(float db, IntPtr context);
  void SetMasterVolumeLevelScalar(float level, IntPtr context);
  void GetMasterVolumeLevel(out float db);
  void GetMasterVolumeLevelScalar(out float level);
  void SetChannelVolumeLevel(uint channel, float db, IntPtr context);
  void SetChannelVolumeLevelScalar(uint channel, float level, IntPtr context);
  void GetChannelVolumeLevel(uint channel, out float db);
  void GetChannelVolumeLevelScalar(uint channel, out float level);
  void SetMute([MarshalAs(UnmanagedType.Bool)] bool muted, IntPtr context);
  void GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
  void GetVolumeStepInfo(out uint step, out uint stepCount);
  void VolumeStepUp(IntPtr context);
  void VolumeStepDown(IntPtr context);
  void QueryHardwareSupport(out uint mask);
  void GetVolumeRange(out float min, out float max, out float increment);
 }
 public class AudioState {
  public bool available {get;set;}
  public int volume {get;set;}
  public bool muted {get;set;}
 }
 public class ControlState {
  public bool available {get;set;}
  public AudioState microphone {get;set;}
  public AudioState speakers {get;set;}
  public int mouseSpeed {get;set;}
  public int keyboardRepeat {get;set;}
  public bool mouseAvailable {get;set;}
  public bool keyboardAvailable {get;set;}
  public string scope {get;set;}
 }
 public static class WindowsControls {
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool SystemParametersInfo(uint action, uint param, ref int data, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool SystemParametersInfo(uint action, uint param, IntPtr data, uint flags);
  private static IAudioEndpointVolume Endpoint(int flow) {
   var enumerator=(IMMDeviceEnumerator)new MMDeviceEnumeratorClass();
   IMMDevice device;
   enumerator.GetDefaultAudioEndpoint(flow, 1, out device); // multimedia default
   object obj; Guid iid=typeof(IAudioEndpointVolume).GUID;
   device.Activate(ref iid, 23, IntPtr.Zero, out obj); // CLSCTX_ALL
   return (IAudioEndpointVolume)obj;
  }
  private static AudioState ReadAudio(int flow) {
   var result=new AudioState();
   try {
    var endpoint=Endpoint(flow);
    float level; bool muted;
    endpoint.GetMasterVolumeLevelScalar(out level);
    endpoint.GetMute(out muted);
    result.available=true;
    result.volume=Math.Max(0,Math.Min(100,(int)Math.Round(level*100)));
    result.muted=muted;
   } catch (COMException) { /* no default audio endpoint */ }
     catch (InvalidCastException) { /* endpoint does not support volume */ }
   return result;
  }
  private static int ReadPreference(uint action) {
   int value=0;
   if(!SystemParametersInfo(action,0,ref value,0))
    throw new Win32Exception(Marshal.GetLastWin32Error());
   return value;
  }
  private static void SetPreference(uint action,uint param,IntPtr data) {
   // Persist as normal Windows per-user preference, notify running apps.
   if(!SystemParametersInfo(action,param,data,3))
    throw new Win32Exception(Marshal.GetLastWin32Error());
  }
  public static ControlState Read() {
   var state=new ControlState {
    available=true, scope="windows-defaults",
    microphone=ReadAudio(1), speakers=ReadAudio(0)
   };
   try {state.mouseSpeed=ReadPreference(0x70);state.mouseAvailable=true;}
   catch(Win32Exception){}
   try {state.keyboardRepeat=ReadPreference(0x0A);state.keyboardAvailable=true;}
   catch(Win32Exception){}
   return state;
  }
  public static void Write(string setting,int value) {
   switch(setting) {
    case "micMute":
    case "speakerMute":
     if(value!=0 && value!=1)throw new ArgumentOutOfRangeException("value");
     Endpoint(setting=="micMute"?1:0).SetMute(value==1,IntPtr.Zero);
     return;
    case "micVolume":
    case "speakerVolume":
     if(value<0||value>100)throw new ArgumentOutOfRangeException("value");
     Endpoint(setting=="micVolume"?1:0).SetMasterVolumeLevelScalar(value/100f,IntPtr.Zero);
     return;
    case "mouseSpeed":
     if(value<1||value>20)throw new ArgumentOutOfRangeException("value");
     SetPreference(0x71,0,new IntPtr(value));
     return;
    case "keyboardRepeat":
     if(value<0||value>31)throw new ArgumentOutOfRangeException("value");
     SetPreference(0x0B,(uint)value,IntPtr.Zero);
     return;
    default:throw new ArgumentException("Controle nao permitido");
   }
  }
 }
}
'@
try {
 Add-Type -TypeDefinition $code -ErrorAction Stop
 if($Operation -eq "write") {
  [AppSpaceControls.WindowsControls]::Write($Setting,$Value)
 }
 [AppSpaceControls.WindowsControls]::Read() | ConvertTo-Json -Depth 5 -Compress
} catch {
 [Console]::Error.WriteLine("Controle Windows indisponivel: " + $_.Exception.Message)
 exit 1
}
