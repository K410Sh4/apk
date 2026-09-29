package com.k410sh4.r410control

import android.bluetooth.BluetoothDevice
import com.k410sh4.r410control.data.database.BatterySampleEntity
import com.k410sh4.r410control.data.database.ProtocolLogEntity
import com.k410sh4.r410control.data.protocol.R410Command
import com.k410sh4.r410control.domain.model.*
import com.k410sh4.r410control.domain.repository.R410Repository
import kotlinx.coroutines.flow.*

class FakeR410Device : R410Repository {
    private val _state = MutableStateFlow(R410ConnectionState.DISCONNECTED)
    private val _snapshot = MutableStateFlow(R410Snapshot(
        name = "Demo Device",
        batteryLeft = 83,
        batteryRight = 78,
        batteryCase = 61,
        noiseMode = NoiseMode.ANC,
        demo = true
    ))
    private val _packets = MutableSharedFlow<ProtocolPacket>()
    val sentCommands = mutableListOf<R410Command>()

    override val connectionState: StateFlow<R410ConnectionState> = _state
    override val snapshot: StateFlow<R410Snapshot> = _snapshot
    override val packets: Flow<ProtocolPacket> = _packets
    override val classicServices = MutableStateFlow<List<String>>(emptyList())
    override val logs = flowOf<List<ProtocolLogEntity>>(emptyList())
    override val batteryHistory = flowOf<List<BatterySampleEntity>>(emptyList())

    override fun pairedDevices(): List<BluetoothDevice> = emptyList()
    override fun preferredDevice(): BluetoothDevice? = null
    override fun connect(device: BluetoothDevice?) { _state.value = R410ConnectionState.READY }
    override fun disconnect() { _state.value = R410ConnectionState.DISCONNECTED }
    override suspend fun send(command: R410Command): Result<Unit> {
        sentCommands += command
        if (command is R410Command.SetNoiseMode) {
            _snapshot.update { it.copy(noiseMode = command.mode) }
        }
        return Result.success(Unit)
    }
}
