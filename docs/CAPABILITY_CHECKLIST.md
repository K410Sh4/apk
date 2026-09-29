# SM-R410 Capability Checklist

Status in this file distinguishes **observed on the user's physical SM-R410** from protocol-only evidence.

| Capability | State | Evidence | Notes |
|---|---|---|---|
| Bluetooth Classic | CONFIRMED | Hardware + Android | Paired device works |
| Samsung SPP_NEW | CONFIRMED | Hardware | UUID ...23f2 |
| Secure RFCOMM | CONFIRMED | Hardware | Worked in later test |
| Insecure RFCOMM fallback | CONFIRMED | Hardware | Worked in earlier tests |
| A2DP | ANDROID-EXPOSED | Android | Profile state inspected |
| HFP | ANDROID-EXPOSED | Android | Profile state inspected |
| Battery Left | CONFIRMED | Hardware | 100% observed |
| Battery Right | CONFIRMED | Hardware | 100% observed |
| Battery Case | CONFIRMED CONDITIONAL | Hardware | 0xFF observed when case telemetry is unavailable |
| In-ear Left/Right | CONFIRMED | Hardware | 0x11 / 0x21 transitions observed |
| Firmware version | CONFIRMED | Hardware | R410XXU0AYI2 observed |
| SKU | CONFIRMED | Hardware | DEBUG_SKU response observed |
| ANC state | CONFIRMED | Hardware | NOISE_CONTROLS_UPDATE=01 |
| Ambient state | CONFIRMED | Hardware | NOISE_CONTROLS_UPDATE=02 |
| ANC/Ambient command | PROTOCOL-DOCUMENTED | Open protocol implementation | Main UI command enabled after device capability confirmation |
| Ambient level | CONFIRMED FIELD / CONTROL DOCUMENTED | Hardware + protocol | SM-R410 profile maximum = 2 |
| ANC sensitivity | CONFIRMED FIELD / CONTROL DOCUMENTED | Hardware + protocol | NoiseReductionLevel |
| ANC with one earbud | CONFIRMED FIELD / CONTROL DOCUMENTED | Hardware + protocol | Enabled flag observed in real payload |
| Device EQ presets | PROTOCOL-DOCUMENTED | EQUALIZER message | Requires hardware command validation |
| Custom parametric EQ | NOT YET ANALYZED | — | Not presented as supported |
| Touch global lock | PROTOCOL-DOCUMENTED | LOCK_TOUCHPAD | Requires hardware command validation |
| Touch-and-hold mapping | PROTOCOL-DOCUMENTED | StandardTouchMap | Voice/Noise/Volume/Spotify |
| Single/double/triple remap | NOT CONFIRMED | — | No arbitrary mapping UI |
| Find My Buds Left/Right/Both | EXPERIMENTAL | Protocol | Safety gated when worn; per-side mute supported |
| BLE/GATT services | UNKNOWN | Lab scan required | Never assumed |
| Individual ANC microphones | NOT EXPOSED | Android path | Not claimed |
| HFP microphone input | REQUIRES_PERMISSION | Android | User-initiated diagnostic |
| RSSI | UNKNOWN | Android restrictions | No invented value |
| Codec | UNKNOWN until exposed | Android | No invented codec |
| 360 Audio | UNSUPPORTED/NOT ADVERTISED | Model capability | No button |
| Hall state | NOT YET DECODED | — | Case placement may still be visible through SPP |
| Charging state L/R/Case | CONFIRMED FIELD | Hardware + protocol | Bitfield decoded; all three were false in captured frame |
