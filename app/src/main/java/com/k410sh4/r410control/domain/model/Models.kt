package com.k410sh4.r410control.domain.model

import java.util.UUID

enum class CapabilityStatus {
    SUPPORTED,
    UNSUPPORTED,
    EXPERIMENTAL,
    UNKNOWN,
    REQUIRES_SAMSUNG,
    REQUIRES_PERMISSION
}

enum class EvidenceSource {
    CONFIRMED_HARDWARE,
    ANDROID_EXPOSED,
    PROTOCOL_DOCUMENTED,
    DISCOVERED_EXPERIMENTALLY,
    NOT_SUPPORTED,
    UNANALYZED
}

data class Capability(
    val status: CapabilityStatus,
    val evidence: EvidenceSource,
    val detail: String = ""
)

data class DeviceCapabilities(
    val bluetooth: Capability = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.ANDROID_EXPOSED),
    val spp: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val a2dp: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val hfp: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val bleGatt: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val anc: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val ambient: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val eq: Capability = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED),
    val touchControls: Capability = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED),
    val batteryLeft: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val batteryRight: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val batteryCase: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val proximity: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val chargingState: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val ambientLevel: Capability = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED),
    val ancIntensity: Capability = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED),
    val ancOneEarbud: Capability = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED),
    val firmwareInfo: Capability = Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED),
    val findMyBuds: Capability = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED),
    val microphone: Capability = Capability(CapabilityStatus.REQUIRES_PERMISSION, EvidenceSource.ANDROID_EXPOSED),
    val spatialAudio: Capability = Capability(CapabilityStatus.UNSUPPORTED, EvidenceSource.NOT_SUPPORTED, "Não anunciado para SM-R410")
)

enum class R410ConnectionState {
    DISCONNECTED, SCANNING, FOUND, PAIRING, CONNECTING, DISCOVERING, READY, ERROR
}

enum class Placement(val code: Int) {
    DISCONNECTED(0), WEARING(1), IDLE(2), CASE(3), CLOSED_CASE(4), UNKNOWN(255);

    companion object {
        fun from(code: Int) = entries.firstOrNull { it.code == code } ?: UNKNOWN
    }
}

enum class NoiseMode(val wire: Int) {
    OFF(0), ANC(1), AMBIENT(2), ADAPTIVE(3);

    companion object {
        fun from(code: Int) = entries.firstOrNull { it.wire == code } ?: OFF
    }
}

enum class EqPreset(val wireIndex: Int, val label: String) {
    BASS_BOOST(0, "Bass Boost"),
    SOFT(1, "Soft"),
    DYNAMIC(2, "Dynamic"),
    CLEAR(3, "Clear"),
    TREBLE_BOOST(4, "Treble Boost")
}

enum class TouchHoldAction(val wire: Int, val label: String) {
    VOICE_ASSISTANT(1, "Voice assistant"),
    NOISE_CONTROL(2, "Noise control"),
    VOLUME(3, "Volume"),
    SPOTIFY(4, "Spotify")
}

data class R410Snapshot(
    val name: String = "Galaxy Buds Core",
    val addressMasked: String = "--",
    val firmware: String = "--",
    val sku: String = "--",
    val batteryLeft: Int? = null,
    val batteryRight: Int? = null,
    val batteryCase: Int? = null,
    val placementLeft: Placement = Placement.UNKNOWN,
    val placementRight: Placement = Placement.UNKNOWN,
    val noiseMode: NoiseMode? = null,
    val ambientLevel: Int? = null,
    val ancLevelHigh: Boolean? = null,
    val noiseControlsOneEarbud: Boolean? = null,
    val chargingLeft: Boolean? = null,
    val chargingRight: Boolean? = null,
    val chargingCase: Boolean? = null,
    val eqModeRaw: Int? = null,
    val touchLocked: Boolean? = null,
    val touchLeft: TouchHoldAction? = null,
    val touchRight: TouchHoldAction? = null,
    val mainConnection: String? = null,
    val revision: Int? = null,
    val a2dpConnected: Boolean = false,
    val hfpConnected: Boolean = false,
    val codec: String? = null,
    val rssi: Int? = null,
    val sampleRate: Int? = null,
    val capabilities: DeviceCapabilities = DeviceCapabilities(),
    val demo: Boolean = false
)

enum class PacketDirection { RX, TX }
enum class Transport { SPP, BLE, ANDROID_AUDIO }

data class ProtocolPacket(
    val timestamp: Long = System.currentTimeMillis(),
    val direction: PacketDirection,
    val transport: Transport,
    val channel: String,
    val payload: ByteArray,
    val decoded: String? = null
)

data class GattCharacteristicInfo(
    val serviceUuid: UUID,
    val uuid: UUID,
    val properties: Int,
    val valueHex: String? = null
)

data class GattServiceInfo(
    val uuid: UUID,
    val characteristics: List<GattCharacteristicInfo>
)

data class AudioDiagnostics(
    val outputDevice: String? = null,
    val inputDevice: String? = null,
    val sampleRates: List<Int> = emptyList(),
    val channelCounts: List<Int> = emptyList(),
    val codec: String? = null,
    val a2dp: Boolean = false,
    val hfp: Boolean = false,
    val estimatedLatencyMs: Int? = null
)

data class MicTelemetry(
    val running: Boolean = false,
    val rms: Float = 0f,
    val peak: Float = 0f,
    val waveform: List<Float> = emptyList(),
    val spectrum: List<Float> = emptyList(),
    val sampleRate: Int = 16_000,
    val channelCount: Int = 1,
    val error: String? = null
)
