package com.k410sh4.r410control.data.protocol

import com.k410sh4.r410control.domain.model.*
import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets
import java.util.UUID
import kotlin.math.min

object R410Protocol {
    val SPP_UUID: UUID = UUID.fromString("2e73a4ad-332d-41fc-90e2-16bef06523f2")
    val SPP_UUID_SECONDARY: UUID = UUID.fromString("2e73a4ad-332d-41fc-90e2-16bef06523f3")

    const val SOM = 0xFD
    const val EOM = 0xDD

    object Id {
        const val DEBUG_SKU = 34
        const val METERING_REPORT = 65
        const val USAGE_REPORT_V2 = 71
        const val STATUS_UPDATED = 96
        const val EXTENDED_STATUS_UPDATED = 97
        const val VERSION_INFO_LONG = 104
        const val SET_ANC_WITH_ONE_EARBUD = 111
        const val NOISE_CONTROLS_UPDATE = 119
        const val NOISE_CONTROLS = 120
        const val NOISE_REDUCTION_LEVEL = 131
        const val AMBIENT_VOLUME = 132
        const val EQUALIZER = 134
        const val MANAGER_INFO = 136
        const val LOCK_TOUCHPAD = 144
        const val TOUCH_UPDATED = 145
        const val SET_TOUCHPAD_OPTION = 146
        const val SET_TOUCHPAD_OTHER_OPTION = 147
        const val FIND_MY_EARBUDS_START = 160
        const val FIND_MY_EARBUDS_STOP = 161
        const val MUTE_EARBUD = 162
        const val FIND_MY_EARBUDS_ON_WEARING_START = 166
        const val CRADLE_SERIAL_NUMBER = 205
    }

    fun nameOf(id: Int): String = when (id) {
        Id.DEBUG_SKU -> "DEBUG_SKU"
        Id.METERING_REPORT -> "METERING_REPORT"
        Id.USAGE_REPORT_V2 -> "USAGE_REPORT_V2"
        Id.STATUS_UPDATED -> "STATUS_UPDATED"
        Id.EXTENDED_STATUS_UPDATED -> "EXTENDED_STATUS_UPDATED"
        Id.VERSION_INFO_LONG -> "VERSION_INFO_LONG"
        Id.SET_ANC_WITH_ONE_EARBUD -> "SET_ANC_WITH_ONE_EARBUD"
        Id.NOISE_CONTROLS_UPDATE -> "NOISE_CONTROLS_UPDATE"
        Id.NOISE_CONTROLS -> "NOISE_CONTROLS"
        Id.NOISE_REDUCTION_LEVEL -> "NOISE_REDUCTION_LEVEL"
        Id.AMBIENT_VOLUME -> "AMBIENT_VOLUME"
        Id.EQUALIZER -> "EQUALIZER"
        Id.MANAGER_INFO -> "MANAGER_INFO"
        Id.LOCK_TOUCHPAD -> "LOCK_TOUCHPAD"
        Id.TOUCH_UPDATED -> "TOUCH_UPDATED"
        Id.SET_TOUCHPAD_OPTION -> "SET_TOUCHPAD_OPTION"
        Id.SET_TOUCHPAD_OTHER_OPTION -> "SET_TOUCHPAD_OTHER_OPTION"
        Id.FIND_MY_EARBUDS_START -> "FIND_MY_EARBUDS_START"
        Id.FIND_MY_EARBUDS_STOP -> "FIND_MY_EARBUDS_STOP"
        Id.MUTE_EARBUD -> "MUTE_EARBUD"
        Id.FIND_MY_EARBUDS_ON_WEARING_START -> "FIND_MY_EARBUDS_ON_WEARING_START"
        Id.CRADLE_SERIAL_NUMBER -> "CRADLE_SERIAL_NUMBER"
        else -> "UNKNOWN_$id"
    }

    data class Frame(
        val header: Int,
        val id: Int,
        val payload: ByteArray,
        val raw: ByteArray
    ) {
        val isFragment: Boolean get() = header and 0x2000 != 0
        val responseBit: Boolean get() = header and 0x1000 != 0
    }

    class StreamDecoder {
        private val pending = ByteArrayOutputStream()

        @Synchronized
        fun feed(data: ByteArray): List<Frame> {
            if (data.isEmpty()) return emptyList()
            pending.write(data)
            val bytes = pending.toByteArray()
            val out = mutableListOf<Frame>()
            var cursor = 0
            var consumed = 0

            while (cursor < bytes.size) {
                val start = (cursor until bytes.size).firstOrNull {
                    bytes[it].toInt() and 0xFF == SOM
                }
                if (start == null) {
                    consumed = bytes.size
                    break
                }
                if (bytes.size - start < 4) {
                    consumed = start
                    break
                }
                val header = (bytes[start + 1].toInt() and 0xFF) or
                    ((bytes[start + 2].toInt() and 0xFF) shl 8)
                val size = header and 0x03FF
                if (size !in 3..1023) {
                    cursor = start + 1
                    consumed = cursor
                    continue
                }
                val total = size + 4
                if (bytes.size - start < total) {
                    consumed = start
                    break
                }
                val end = start + total - 1
                if (bytes[end].toInt() and 0xFF != EOM) {
                    cursor = start + 1
                    consumed = cursor
                    continue
                }
                val id = bytes[start + 3].toInt() and 0xFF
                val payloadLen = size - 3
                val payloadStart = start + 4
                val payload = if (payloadLen == 0) byteArrayOf()
                else bytes.copyOfRange(payloadStart, payloadStart + payloadLen)
                out += Frame(header, id, payload, bytes.copyOfRange(start, start + total))
                cursor = start + total
                consumed = cursor
            }

            pending.reset()
            if (consumed < bytes.size) pending.write(bytes, consumed, bytes.size - consumed)
            if (pending.size() > 16 * 1024) pending.reset()
            return out
        }
    }

    fun encodeRequest(id: Int, payload: ByteArray = byteArrayOf()): ByteArray {
        val size = 1 + payload.size + 2
        val crcInput = byteArrayOf(id.toByte()) + payload
        val crc = crc16Ccitt(crcInput)
        return ByteArrayOutputStream(size + 4).apply {
            write(SOM)
            write(size and 0xFF)
            write((size shr 8) and 0xFF)
            write(id and 0xFF)
            write(payload)
            write(crc and 0xFF)
            write((crc shr 8) and 0xFF)
            write(EOM)
        }.toByteArray()
    }

    fun crc16Ccitt(data: ByteArray): Int {
        var crc = 0
        data.forEach { raw ->
            crc = crc xor ((raw.toInt() and 0xFF) shl 8)
            repeat(8) {
                crc = if (crc and 0x8000 != 0) ((crc shl 1) xor 0x1021) and 0xFFFF
                else (crc shl 1) and 0xFFFF
            }
        }
        return crc and 0xFFFF
    }

    fun hex(data: ByteArray, max: Int = 512): String =
        data.take(min(max, data.size)).joinToString(" ") { "%02X".format(it.toInt() and 0xFF) } +
            if (data.size > max) " …" else ""

    fun ascii(data: ByteArray): String = buildString {
        data.forEach {
            val c = it.toInt() and 0xFF
            append(if (c in 32..126) c.toChar() else '.')
        }
    }
}

sealed class R410Command(
    val id: Int,
    val timeoutMs: Long,
    val expectedResponse: Set<Int>
) {
    abstract fun payload(): ByteArray
    open fun validation(snapshot: R410Snapshot): String? = null
    fun encode(): ByteArray = R410Protocol.encodeRequest(id, payload())

    data object ManagerInfo : R410Command(
        R410Protocol.Id.MANAGER_INFO, 2_000, setOf(R410Protocol.Id.MANAGER_INFO)
    ) {
        override fun payload() = byteArrayOf(1, 1, 34)
    }

    data object DebugSku : R410Command(
        R410Protocol.Id.DEBUG_SKU, 2_000, setOf(R410Protocol.Id.DEBUG_SKU)
    ) {
        override fun payload() = byteArrayOf()
    }

    data class SetNoiseMode(val mode: NoiseMode) : R410Command(
        R410Protocol.Id.NOISE_CONTROLS, 2_000,
        setOf(R410Protocol.Id.NOISE_CONTROLS_UPDATE, R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        override fun payload() = byteArrayOf(mode.wire.toByte())
        override fun validation(snapshot: R410Snapshot): String? =
            if (snapshot.capabilities.anc.status == CapabilityStatus.SUPPORTED ||
                snapshot.capabilities.ambient.status == CapabilityStatus.SUPPORTED) null
            else "Controle de ruído ainda não confirmado"
    }

    data class SetAncLevelHigh(val enabled: Boolean) : R410Command(
        R410Protocol.Id.NOISE_REDUCTION_LEVEL, 2_000,
        setOf(R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        override fun payload() = byteArrayOf(enabled.toByte01())
        override fun validation(snapshot: R410Snapshot): String? =
            if (snapshot.capabilities.ancIntensity.status == CapabilityStatus.SUPPORTED) null
            else "Nível de ANC ainda não confirmado neste firmware"
    }

    data class SetAmbientLevel(val level: Int) : R410Command(
        R410Protocol.Id.AMBIENT_VOLUME, 2_000,
        setOf(R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        override fun payload() = byteArrayOf(level.coerceIn(0, 2).toByte())
        override fun validation(snapshot: R410Snapshot): String? =
            if (snapshot.capabilities.ambientLevel.status == CapabilityStatus.SUPPORTED) null
            else "Nível de ambiente ainda não confirmado neste firmware"
    }

    data class SetAncOneEarbud(val enabled: Boolean) : R410Command(
        R410Protocol.Id.SET_ANC_WITH_ONE_EARBUD, 2_000,
        setOf(R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        override fun payload() = byteArrayOf(enabled.toByte01())
        override fun validation(snapshot: R410Snapshot): String? =
            if (snapshot.capabilities.ancOneEarbud.status == CapabilityStatus.SUPPORTED) null
            else "ANC com um fone ainda não confirmado neste firmware"
    }

    data class SetEqPreset(val preset: EqPreset?, val enabled: Boolean = true) : R410Command(
        R410Protocol.Id.EQUALIZER, 2_000, setOf(R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        override fun payload(): ByteArray =
            if (!enabled || preset == null) byteArrayOf(0)
            else byteArrayOf((preset.wireIndex + 1).toByte())
    }

    data class LockTouch(val locked: Boolean) : R410Command(
        R410Protocol.Id.LOCK_TOUCHPAD, 2_000, setOf(R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        // Buds Core announces AdvancedTouchLock. Keep all gestures enabled when unlocked.
        override fun payload() = byteArrayOf(
            (!locked).toByte01(), 1, 1, 1, 1, 1, 1
        )
    }

    data class SetTouchHold(
        val left: TouchHoldAction,
        val right: TouchHoldAction
    ) : R410Command(
        R410Protocol.Id.SET_TOUCHPAD_OPTION, 2_000, setOf(R410Protocol.Id.EXTENDED_STATUS_UPDATED)
    ) {
        override fun payload() = byteArrayOf(left.wire.toByte(), right.wire.toByte())
    }

    data object FindStart : R410Command(
        R410Protocol.Id.FIND_MY_EARBUDS_START, 2_000, emptySet()
    ) {
        override fun payload() = byteArrayOf()
        override fun validation(snapshot: R410Snapshot): String? {
            val unknown = snapshot.placementLeft in setOf(Placement.UNKNOWN, Placement.DISCONNECTED) ||
                snapshot.placementRight in setOf(Placement.UNKNOWN, Placement.DISCONNECTED)
            if (unknown) return "Estado de uso desconhecido; o localizador foi bloqueado por segurança."
            if (snapshot.placementLeft == Placement.WEARING ||
                snapshot.placementRight == Placement.WEARING
            ) return "Retire os dois fones dos ouvidos antes do toque de localização."
            return null
        }
    }

    data class MuteEarbuds(val leftMuted: Boolean, val rightMuted: Boolean) : R410Command(
        R410Protocol.Id.MUTE_EARBUD, 2_000, emptySet()
    ) {
        override fun payload() = byteArrayOf(leftMuted.toByte01(), rightMuted.toByte01())
    }

    data object FindStop : R410Command(
        R410Protocol.Id.FIND_MY_EARBUDS_STOP, 2_000, emptySet()
    ) {
        override fun payload() = byteArrayOf()
    }
}

private fun Boolean.toByte01(): Byte = if (this) 1 else 0

interface PacketDecoder {
    val supportedIds: Set<Int>
    fun decode(frame: R410Protocol.Frame): DecodedProtocolEvent?
}

sealed interface DecodedProtocolEvent {
    data class SnapshotUpdate(val transform: (R410Snapshot) -> R410Snapshot) : DecodedProtocolEvent
    data class Message(val label: String, val detail: String) : DecodedProtocolEvent
}

class DeviceStatusDecoder : PacketDecoder {
    override val supportedIds = setOf(
        R410Protocol.Id.STATUS_UPDATED,
        R410Protocol.Id.EXTENDED_STATUS_UPDATED,
        R410Protocol.Id.NOISE_CONTROLS_UPDATE,
        R410Protocol.Id.VERSION_INFO_LONG,
        R410Protocol.Id.DEBUG_SKU
    )

    override fun decode(frame: R410Protocol.Frame): DecodedProtocolEvent? {
        val p = frame.payload
        return when (frame.id) {
            R410Protocol.Id.STATUS_UPDATED -> if (p.size >= 7) {
                DecodedProtocolEvent.SnapshotUpdate { old ->
                    val placement = p[5].toInt() and 0xFF
                    val charging = if (p.size >= 8) p[7].toInt() and 0xFF else null
                    old.copy(
                        batteryLeft = p[1].u8OrNull(),
                        batteryRight = p[2].u8OrNull(),
                        placementLeft = Placement.from((placement shr 4) and 0x0F),
                        placementRight = Placement.from(placement and 0x0F),
                        batteryCase = p[6].u8OrNull(),
                        chargingLeft = charging?.let { (it and 0x10) != 0 },
                        chargingRight = charging?.let { (it and 0x04) != 0 },
                        chargingCase = charging?.let { (it and 0x01) != 0 },
                        mainConnection = if ((p[4].toInt() and 0xFF) == 1) "Left" else "Right",
                        capabilities = if (charging != null) old.capabilities.copy(
                            chargingState = confirmed("Bits de carregamento presentes em STATUS_UPDATED")
                        ) else old.capabilities
                    )
                }
            } else null

            R410Protocol.Id.EXTENDED_STATUS_UPDATED -> if (p.size >= 13) {
                DecodedProtocolEvent.SnapshotUpdate { old ->
                    val placement = p[6].toInt() and 0xFF
                    val mode = NoiseMode.from(p[12].toInt() and 0xFF)
                    val touchByte = p[11].toInt() and 0xFF
                    val touchFlags = p[10].toInt() and 0xFF
                    val l = touchActionFromWire((touchByte shr 4) and 0x0F)
                    val r = touchActionFromWire(touchByte and 0x0F)
                    val ambientLevel = p.getOrNull(23)?.toInt()?.and(0xFF)
                    val ancLevelHigh = p.getOrNull(24)?.let { (it.toInt() and 0xFF) == 1 }
                    val oneEarbud = p.getOrNull(28)?.let { (it.toInt() and 0xFF) == 1 }
                    val charging = p.getOrNull(43)?.toInt()?.and(0xFF)
                    old.copy(
                        revision = p[0].toInt() and 0xFF,
                        batteryLeft = p[2].u8OrNull(),
                        batteryRight = p[3].u8OrNull(),
                        placementLeft = Placement.from((placement shr 4) and 0x0F),
                        placementRight = Placement.from(placement and 0x0F),
                        batteryCase = p[7].u8OrNull(),
                        eqModeRaw = p[9].toInt() and 0xFF,
                        touchLocked = (touchFlags and 0x80) != 0x80,
                        touchLeft = l,
                        touchRight = r,
                        noiseMode = mode,
                        ambientLevel = ambientLevel,
                        ancLevelHigh = ancLevelHigh,
                        noiseControlsOneEarbud = oneEarbud,
                        chargingLeft = charging?.let { (it and 0x10) != 0 },
                        chargingRight = charging?.let { (it and 0x04) != 0 },
                        chargingCase = charging?.let { (it and 0x01) != 0 },
                        mainConnection = if ((p[5].toInt() and 0xFF) == 1) "Left" else "Right",
                        capabilities = old.capabilities.copy(
                            spp = confirmed("Samsung SPP_NEW conectado"),
                            anc = confirmed("ANC observado no SM-R410"),
                            ambient = confirmed("Ambient observado no SM-R410"),
                            batteryLeft = confirmed("Percentual L recebido"),
                            batteryRight = confirmed("Percentual R recebido"),
                            batteryCase = if (p[7].u8OrNull() != null) confirmed("Bateria do case recebida") else old.capabilities.batteryCase,
                            proximity = confirmed("Estados in-ear recebidos"),
                            firmwareInfo = confirmed("Status/version protocol ativo"),
                            chargingState = if (charging != null) confirmed("Campo de carregamento recebido do SM-R410") else old.capabilities.chargingState,
                            ambientLevel = if (ambientLevel != null) confirmed("AmbientSoundVolume recebido do SM-R410") else old.capabilities.ambientLevel,
                            ancIntensity = if (ancLevelHigh != null) confirmed("NoiseReductionLevel recebido do SM-R410") else old.capabilities.ancIntensity,
                            ancOneEarbud = if (oneEarbud != null) confirmed("NoiseControlsWithOneEarbud recebido do SM-R410") else old.capabilities.ancOneEarbud,
                            eq = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.PROTOCOL_DOCUMENTED, "EQ preset protocolado"),
                            touchControls = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.PROTOCOL_DOCUMENTED, "Touch map/lock protocolados"),
                            findMyBuds = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED, "Comando existe; requer confirmação antes de tocar")
                        )
                    )
                }
            } else null

            R410Protocol.Id.NOISE_CONTROLS_UPDATE -> if (p.isNotEmpty()) {
                DecodedProtocolEvent.SnapshotUpdate { it.copy(noiseMode = NoiseMode.from(p[0].toInt() and 0xFF)) }
            } else null

            R410Protocol.Id.VERSION_INFO_LONG -> {
                val fw = parseFirmware(p)
                DecodedProtocolEvent.SnapshotUpdate {
                    it.copy(firmware = fw.ifBlank { it.firmware })
                }
            }

            R410Protocol.Id.DEBUG_SKU -> {
                val raw = p.toString(StandardCharsets.US_ASCII).trim('\u0000')
                val half = if (raw.length >= 14) raw.take(raw.length / 2) else raw
                DecodedProtocolEvent.SnapshotUpdate {
                    it.copy(sku = half.ifBlank { it.sku })
                }
            }

            else -> null
        }
    }

    private fun confirmed(detail: String) =
        Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE, detail)

    private fun parseFirmware(p: ByteArray): String {
        if (p.size < 3) return ""
        val length = p[0].toInt() and 0xFF
        if (length <= 0 || 2 + length > p.size) return ""
        return p.copyOfRange(2, 2 + length)
            .toString(StandardCharsets.US_ASCII)
            .trim('\u0000', ' ')
    }

    private fun touchActionFromWire(v: Int): TouchHoldAction? =
        TouchHoldAction.entries.firstOrNull { it.wire == v }
}

private fun Byte.u8OrNull(): Int? {
    val value = toInt() and 0xFF
    return if (value == 0xFF) null else value
}
