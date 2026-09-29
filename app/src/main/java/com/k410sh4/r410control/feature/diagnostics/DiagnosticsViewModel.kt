package com.k410sh4.r410control.feature.diagnostics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.k410sh4.r410control.core.audio.AudioInspector
import com.k410sh4.r410control.core.audio.MicrophoneAnalyzer
import com.k410sh4.r410control.core.bluetooth.BleExplorer
import com.k410sh4.r410control.data.protocol.R410Protocol
import com.k410sh4.r410control.data.settings.SettingsStore
import com.k410sh4.r410control.domain.model.*
import com.k410sh4.r410control.domain.repository.R410Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class DiagnosticsViewModel @Inject constructor(
    private val repo: R410Repository,
    private val ble: BleExplorer,
    private val audio: AudioInspector,
    private val microphone: MicrophoneAnalyzer,
    private val settings: SettingsStore
) : ViewModel() {
    private val _labSessionActive = MutableStateFlow(false)
    val labSessionActive: StateFlow<Boolean> = _labSessionActive.asStateFlow()
    private val labEnabled = settings.labMode.stateIn(
        viewModelScope,
        SharingStarted.Eagerly,
        false
    )
    val logs = repo.logs
    val classicServices = repo.classicServices
    val gattServices = ble.services
    val gattStatus = ble.status
    val audioDiagnostics = audio.diagnostics
    val micTelemetry = microphone.state

    private val _packets = MutableStateFlow<List<ProtocolPacket>>(emptyList())
    val packets: StateFlow<List<ProtocolPacket>> = _packets.asStateFlow()

    init {
        viewModelScope.launch {
            repo.packets.collect { packet ->
                _packets.update { (listOf(packet) + it).take(500) }
            }
        }
    }

    fun refreshAudio() = audio.refresh(repo.preferredDevice())
    fun inspectGatt() = repo.preferredDevice()?.let(ble::inspect)
    fun closeGatt() = ble.close()
    fun readGatt(service: UUID, characteristic: UUID) = ble.read(service, characteristic)
    fun startLabSession() {
        if (labEnabled.value) _labSessionActive.value = true
    }

    fun stopLabSession() {
        _labSessionActive.value = false
    }

    fun writeGatt(service: UUID, characteristic: UUID, payload: ByteArray): Boolean {
        if (!labEnabled.value || !_labSessionActive.value) return false
        return ble.write(service, characteristic, payload)
    }
    fun startMic() = microphone.start()
    fun stopMic() = microphone.stop()

    fun packetAsHex(packet: ProtocolPacket) = R410Protocol.hex(packet.payload)
    fun packetAsAscii(packet: ProtocolPacket) = R410Protocol.ascii(packet.payload)
    fun packetAsUInt8(packet: ProtocolPacket) = packet.payload.joinToString(" ") { (it.toInt() and 0xFF).toString() }

    fun capabilityReport(snapshot: R410Snapshot): String {
        val c = snapshot.capabilities
        fun row(name: String, cap: Capability) =
            "  \"" + name + "\": {\"status\": \"" + cap.status + "\", \"evidence\": \"" + cap.evidence + "\", \"detail\": \"" +
                cap.detail.replace("\"", "\\\"") + "\"}"
        return buildString {
            append("{\n")
            append("  \"model\": \"SM-R410\",\n")
            append("  \"firmware\": \"" + snapshot.firmware.replace("\"", "") + "\",\n")
            append("  \"capabilities\": {\n")
            append(listOf(
                row("bluetooth", c.bluetooth), row("spp", c.spp), row("a2dp", c.a2dp), row("hfp", c.hfp),
                row("bleGatt", c.bleGatt), row("anc", c.anc), row("ambient", c.ambient), row("eq", c.eq),
                row("touchControls", c.touchControls), row("batteryLeft", c.batteryLeft),
                row("batteryRight", c.batteryRight), row("batteryCase", c.batteryCase),
                row("proximity", c.proximity), row("firmwareInfo", c.firmwareInfo),
                row("findMyBuds", c.findMyBuds), row("microphone", c.microphone), row("spatialAudio", c.spatialAudio)
            ).joinToString(",\n"))
            append("\n  }\n}")
        }
    }

    fun exportPacketsTxt(): String = _packets.value.reversed().joinToString("\n\n") { p ->
        val payload = R410Protocol.hex(p.payload)
        p.timestamp.toString() + "\n" + p.direction + "\n" + p.transport + "\n" +
            p.channel + "\nHEX: " + payload
    }

    fun exportPacketsJson(): String = buildString {
        append("[\n")
        append(_packets.value.reversed().joinToString(",\n") { p ->
            val payload = R410Protocol.hex(p.payload).replace("\"", "")
            "  {\"timestamp\":" + p.timestamp + ",\"direction\":\"" + p.direction +
                "\",\"transport\":\"" + p.transport + "\",\"channel\":\"" +
                p.channel.replace("\"", "") + "\",\"payloadHex\":\"" + payload + "\"}"
        })
        append("\n]")
    }

    override fun onCleared() {
        microphone.stop()
        stopLabSession()
        ble.close()
        super.onCleared()
    }
}
