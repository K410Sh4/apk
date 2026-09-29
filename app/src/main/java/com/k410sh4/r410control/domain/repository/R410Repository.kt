package com.k410sh4.r410control.domain.repository

import android.bluetooth.BluetoothDevice
import com.k410sh4.r410control.data.database.BatterySampleEntity
import com.k410sh4.r410control.data.database.ProtocolLogEntity
import com.k410sh4.r410control.data.protocol.R410Command
import com.k410sh4.r410control.domain.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

interface R410Repository {
    val connectionState: StateFlow<R410ConnectionState>
    val snapshot: StateFlow<R410Snapshot>
    val packets: Flow<ProtocolPacket>
    val classicServices: StateFlow<List<String>>
    val logs: Flow<List<ProtocolLogEntity>>
    val batteryHistory: Flow<List<BatterySampleEntity>>

    fun pairedDevices(): List<BluetoothDevice>
    fun preferredDevice(): BluetoothDevice?
    fun connect(device: BluetoothDevice? = null)
    fun disconnect()
    suspend fun send(command: R410Command): Result<Unit>
}
