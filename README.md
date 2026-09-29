# R410 CONTROL CENTER

Android control and diagnostics laboratory for **Samsung Galaxy Buds Core SM-R410**.

> This project only operates on a Buds device that is already paired with the phone. It does not bypass pairing, firmware authentication, or Android permissions.

## Status

The original Java proof-of-concept successfully connected to a real SM-R410 and captured Samsung SPP frames. The project has now been rebuilt as:

- Kotlin
- Jetpack Compose + Material 3
- Clean Architecture / MVVM
- Coroutines + Flow / StateFlow
- Hilt
- Room
- DataStore
- Bluetooth Classic + RFCOMM/SPP
- optional BLE/GATT Lab explorer
- Android audio / HFP microphone diagnostics

Target runtime: **Android 16 / API 36**  
Compile SDK: **API 37** because current stable AndroidX/Compose libraries require it.

## Real SM-R410 protocol observations

Confirmed with a physical SM-R410:

- Samsung proprietary SPP service: `2e73a4ad-332d-41fc-90e2-16bef06523f2`
- secure RFCOMM can work; insecure fallback is implemented
- `MANAGER_INFO [Samsung/SDK34]` + `DEBUG_SKU` bootstrap keeps the management session alive
- left/right battery percentage
- left/right wearing / idle / case placement states
- firmware information
- SKU information
- ANC state
- Ambient state
- live status changes
- Samsung status / usage / metering frames

The app redacts cradle serial-number payloads from shareable protocol logs.

## Capability philosophy

Every capability has one of:

- `SUPPORTED`
- `UNSUPPORTED`
- `EXPERIMENTAL`
- `UNKNOWN`
- `REQUIRES_SAMSUNG`
- `REQUIRES_PERMISSION`

Evidence is tracked separately as:

- `CONFIRMED_HARDWARE`
- `ANDROID_EXPOSED`
- `PROTOCOL_DOCUMENTED`
- `DISCOVERED_EXPERIMENTALLY`
- `NOT_SUPPORTED`
- `UNANALYZED`

The UI never intentionally presents an unsupported feature as working.

## Main application areas

### Connection
Finds the already-paired Galaxy Buds Core and opens the Samsung management SPP channel.

Connection state machine:

`DISCONNECTED → FOUND → CONNECTING → DISCOVERING → READY`

On loss, reconnect uses progressive backoff instead of tight polling.

### Dashboard
Shows the real device snapshot:

- battery L / R / case when available
- in-ear state
- ANC/Ambient
- A2DP/HFP status
- firmware
- capability-aware feature cards

### Noise Control
Uses the documented SM-R410-compatible `NOISE_CONTROLS` message for:

- ANC
- Off
- Ambient

The app waits for device state feedback rather than pretending a request succeeded.

### Device EQ
Implements Samsung device EQ presets:

- Bass Boost
- Soft
- Dynamic
- Clear
- Treble Boost

A custom parametric EQ is **not** exposed unless confirmed for the connected firmware.

### Touch
Exposes only the mappings currently backed by the StandardTouchMap:

- Voice assistant
- Noise control
- Volume
- Spotify
- global touch lock

Arbitrary remapping of single/double/triple tap is not claimed.

### Battery Intelligence
Stores battery samples in Room and calculates local discharge/runtime estimates. Estimates are clearly labeled as app-calculated estimates.

### Audio Engine
Inspects Android audio routes and A2DP/HFP state. Codec or latency fields stay unknown if the public Android path does not expose a reliable value.

### Microphone Diagnostics
User-initiated only.

- requests microphone permission contextually
- attempts the Bluetooth communication input route
- waveform
- RMS
- peak
- compact spectrum
- persistent STOP control while active

No microphone audio is stored.

### Diagnostics
Structured logs and protocol monitor:

- RX / TX
- SPP / BLE / Android audio
- HEX
- ASCII
- UINT8
- JSON export
- TXT export

### Lab Mode
Disabled by default.

Enable through:

**Settings → Advanced → Enable Lab Mode**

Includes:

- Capability Scanner
- BLE/GATT Service Explorer
- characteristic READ only when READ is advertised
- characteristic WRITE only when WRITE is advertised
- explicit confirmation dialog
- no brute-force
- no automatically generated random commands
- raw protocol monitor

## Privacy

Structured logs never intentionally store:

- phone-call content
- microphone audio
- account secrets
- passwords
- cradle serial number

## Demo Device

Settings can enable a permanent **DEMO DEVICE**:

- L 83%
- R 78%
- Case 61%
- ANC ON
- AAC label
- RSSI -48 dBm

No command is sent to real hardware while Demo Device is active.

## Build

Requirements:

- JDK 17
- Gradle 9.6
- Android SDK platform 37
- Android build-tools 36.0.0

From the repository:

```bash
gradle :app:testDebugUnitTest
gradle :app:assembleDebug
```

APK:

`app/build/outputs/apk/debug/app-debug.apk`

GitHub Actions runs tests before producing the APK.

## Project structure

```text
app/src/main/java/com/k410sh4/r410control/
├── core/
│   ├── audio/
│   ├── bluetooth/
│   └── logging/
├── data/
│   ├── database/
│   ├── protocol/
│   ├── repository/
│   └── settings/
├── di/
├── domain/
│   ├── model/
│   └── repository/
├── feature/
│   ├── control/
│   ├── diagnostics/
│   ├── screens/
│   └── settings/
└── ui/
    ├── components/
    └── theme/
```

## Tests

Current unit coverage includes:

- decoding a real SM-R410 STATUS_UPDATED frame
- decoding a real SM-R410 EXTENDED_STATUS_UPDATED frame
- capability updates
- packet CRC / encoding
- fake repository/device state machine
- command recording without physical earbuds

See `FakeR410Device` under unit tests for UI/domain development without hardware.

## Safety

Find My Buds is gated when either earbud is reported as being worn.

Lab writes require:

1. Lab Mode enabled;
2. discovered writable characteristic;
3. connected device;
4. explicit user confirmation;
5. manually supplied payload.

The project does not include unknown destructive firmware commands, FOTA modification, pairing bypass, or automatic command fuzzing.

## Attribution

The Samsung SPP protocol layer is informed by publicly available reverse-engineering work in the open-source **GalaxyBudsClient** project. R410 Control Center keeps its own protocol abstraction and only enables commands that are documented or experimentally observed.
