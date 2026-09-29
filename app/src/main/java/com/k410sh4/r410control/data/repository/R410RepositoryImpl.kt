package com.k410sh4.r410control.data.repository

import android.bluetooth.BluetoothDevice
import com.k410sh4.r410control.core.bluetooth.R410ConnectionManager
import com.k410sh4.r410control.data.database.BatteryDao
import com.k410sh4.r410control.data.database.ProtocolLogDao
import com.k410sh4.r410control.data.protocol.R410Command
import com.k410sh4.r410control.domain.repository.R410Repository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class R410RepositoryImpl @Inject constructor(
    private val manager: R410ConnectionManager,
    logDao: ProtocolLogDao,
    batteryDao: BatteryDao
) : R410Repository {
    override val connectionState = manager.state
    override val snapshot = manager.snapshot
    override val packets = manager.packets
    override val classicServices = manager.classicServices
    override val logs = logDao.observe()
    override val batteryHistory = batteryDao.observe()

    override fun pairedDevices() = manager.pairedDevices()
    override fun preferredDevice() = manager.preferredDevice()
    override fun connect(device: BluetoothDevice?) = manager.connect(device ?: manager.preferredDevice())
    override fun disconnect() = manager.disconnect()
    override suspend fun send(command: R410Command) = manager.send(command)
}
