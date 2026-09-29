package com.k410sh4.r410control.core.bluetooth

import android.Manifest
import android.bluetooth.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.k410sh4.r410control.domain.model.GattCharacteristicInfo
import com.k410sh4.r410control.domain.model.GattServiceInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BleExplorer @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val _services = MutableStateFlow<List<GattServiceInfo>>(emptyList())
    val services: StateFlow<List<GattServiceInfo>> = _services.asStateFlow()
    private val _status = MutableStateFlow("Idle")
    val status: StateFlow<String> = _status.asStateFlow()
    private var gatt: BluetoothGatt? = null

    fun inspect(device: BluetoothDevice) {
        if (!allowed()) {
            _status.value = "Bluetooth permission required"
            return
        }
        close()
        _status.value = "Connecting GATT…"
        gatt = device.connectGatt(context, false, object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    _status.value = "Discovering GATT services…"
                    if (allowed()) g.discoverServices()
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    _status.value = "GATT disconnected"
                }
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    _status.value = "GATT discovery error " + status
                    return
                }
                _services.value = g.services.map { service ->
                    GattServiceInfo(
                        uuid = service.uuid,
                        characteristics = service.characteristics.map {
                            GattCharacteristicInfo(service.uuid, it.uuid, it.properties)
                        }
                    )
                }
                _status.value = "GATT ready • " + _services.value.size + " services"
            }

            override fun onCharacteristicRead(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) updateValue(characteristic.service.uuid, characteristic.uuid, value)
            }

            @Deprecated("Deprecated in API 33")
            override fun onCharacteristicRead(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
                if (status == BluetoothGatt.GATT_SUCCESS) updateValue(characteristic.service.uuid, characteristic.uuid, characteristic.value ?: byteArrayOf())
            }
        }, BluetoothDevice.TRANSPORT_LE)
    }

    fun read(serviceUuid: UUID, characteristicUuid: UUID): Boolean {
        if (!allowed()) return false
        val g = gatt ?: return false
        val c = g.getService(serviceUuid)?.getCharacteristic(characteristicUuid) ?: return false
        if (c.properties and BluetoothGattCharacteristic.PROPERTY_READ == 0) return false
        return g.readCharacteristic(c)
    }

    fun write(serviceUuid: UUID, characteristicUuid: UUID, payload: ByteArray): Boolean {
        if (!allowed()) return false
        val g = gatt ?: return false
        val c = g.getService(serviceUuid)?.getCharacteristic(characteristicUuid) ?: return false
        val writable = c.properties and (BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
        if (!writable) return false
        return if (Build.VERSION.SDK_INT >= 33) {
            val type = if (c.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0)
                BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT else BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
            g.writeCharacteristic(c, payload, type) == BluetoothStatusCodes.SUCCESS
        } else {
            @Suppress("DEPRECATION")
            c.value = payload
            @Suppress("DEPRECATION")
            g.writeCharacteristic(c)
        }
    }

    fun close() {
        if (allowed()) runCatching { gatt?.close() }
        gatt = null
        _services.value = emptyList()
        _status.value = "Idle"
    }

    private fun updateValue(service: UUID, characteristic: UUID, value: ByteArray) {
        val hex = value.joinToString(" ") { "%02X".format(it.toInt() and 0xFF) }
        _services.update { list ->
            list.map { s ->
                if (s.uuid != service) s else s.copy(characteristics = s.characteristics.map {
                    if (it.uuid == characteristic) it.copy(valueHex = hex) else it
                })
            }
        }
    }

    private fun allowed(): Boolean =
        Build.VERSION.SDK_INT < 31 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
}
