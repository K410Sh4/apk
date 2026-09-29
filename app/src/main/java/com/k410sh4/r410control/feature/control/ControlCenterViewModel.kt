package com.k410sh4.r410control.feature.control

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.k410sh4.r410control.data.protocol.R410Command
import com.k410sh4.r410control.data.settings.SettingsStore
import com.k410sh4.r410control.domain.model.*
import com.k410sh4.r410control.domain.repository.R410Repository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ControlCenterViewModel @Inject constructor(
    private val repo: R410Repository,
    settings: SettingsStore
) : ViewModel() {
    val connectionState = repo.connectionState

    private val demoSnapshot = R410Snapshot(
        name = "Demo Device",
        addressMasked = "DE:MO:**:**:**:01",
        firmware = "DEMO",
        sku = "SM-R410-DEMO",
        batteryLeft = 83,
        batteryRight = 78,
        batteryCase = 61,
        placementLeft = Placement.WEARING,
        placementRight = Placement.WEARING,
        noiseMode = NoiseMode.ANC,
        a2dpConnected = true,
        codec = "AAC (demo)",
        rssi = -48,
        capabilities = DeviceCapabilities(
            spp = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            a2dp = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.ANDROID_EXPOSED),
            hfp = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.ANDROID_EXPOSED),
            anc = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            ambient = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            eq = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.PROTOCOL_DOCUMENTED),
            touchControls = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.PROTOCOL_DOCUMENTED),
            batteryLeft = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            batteryRight = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            batteryCase = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            proximity = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            firmwareInfo = Capability(CapabilityStatus.SUPPORTED, EvidenceSource.CONFIRMED_HARDWARE),
            findMyBuds = Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.PROTOCOL_DOCUMENTED)
        ),
        demo = true
    )

    val demoMode = settings.demoMode.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    val snapshot: StateFlow<R410Snapshot> = combine(repo.snapshot, demoMode) { real, demo ->
        if (demo) demoSnapshot else real
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), R410Snapshot())

    val batteryHistory = repo.batteryHistory

    private val _message = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val message = _message.asSharedFlow()

    fun connect() = repo.connect()
    fun disconnect() = repo.disconnect()

    fun setNoiseMode(mode: NoiseMode) = send(R410Command.SetNoiseMode(mode))
    fun setEqPreset(preset: EqPreset?, enabled: Boolean = true) = send(R410Command.SetEqPreset(preset, enabled))
    fun lockTouch(locked: Boolean) = send(R410Command.LockTouch(locked))
    fun setTouchHold(left: TouchHoldAction, right: TouchHoldAction) = send(R410Command.SetTouchHold(left, right))
    fun findStart() = send(R410Command.FindStart)
    fun findStop() = send(R410Command.FindStop)

    private fun send(command: R410Command) {
        if (demoMode.value) {
            _message.tryEmit("DEMO DEVICE: nenhum comando real foi enviado.")
            return
        }
        viewModelScope.launch {
            repo.send(command).onFailure {
                _message.emit(it.message ?: "Command failed")
            }
        }
    }
}
