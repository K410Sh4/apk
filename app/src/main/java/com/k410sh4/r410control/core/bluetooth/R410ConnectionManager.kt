package com.k410sh4.r410control.core.bluetooth

import android.Manifest
import android.bluetooth.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.k410sh4.r410control.core.logging.AppLogger
import com.k410sh4.r410control.data.database.BatteryDao
import com.k410sh4.r410control.data.database.BatterySampleEntity
import com.k410sh4.r410control.data.protocol.*
import com.k410sh4.r410control.domain.model.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.InputStream
import java.io.OutputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class R410ConnectionManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val batteryDao: BatteryDao,
    private val logger: AppLogger
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val adapter: BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private val _state = MutableStateFlow(R410ConnectionState.DISCONNECTED)
    val state: StateFlow<R410ConnectionState> = _state.asStateFlow()

    private val _snapshot = MutableStateFlow(R410Snapshot())
    val snapshot: StateFlow<R410Snapshot> = _snapshot.asStateFlow()

    private val _packets = MutableSharedFlow<ProtocolPacket>(extraBufferCapacity = 256)
    val packets: SharedFlow<ProtocolPacket> = _packets.asSharedFlow()

    private val _classicServices = MutableStateFlow<List<String>>(emptyList())
    val classicServices: StateFlow<List<String>> = _classicServices.asStateFlow()

    private val decoders: List<PacketDecoder> = listOf(DeviceStatusDecoder())
    private var socket: BluetoothSocket? = null
    private var output: OutputStream? = null
    private var connectJob: Job? = null
    private var reconnectJob: Job? = null
    @Volatile private var userDisconnect = false
    private var target: BluetoothDevice? = null

    fun pairedDevices(): List<BluetoothDevice> {
        if (!hasConnectPermission()) return emptyList()
        return try {
            adapter?.bondedDevices?.sortedByDescending {
                it.name.orEmpty().contains("Buds", ignoreCase = true)
            } ?: emptyList()
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    fun preferredDevice(): BluetoothDevice? = pairedDevices().firstOrNull { device ->
        val name = runCatching { device.name.orEmpty() }.getOrDefault("")
        val uuidMatch = runCatching {
            device.uuids?.any { it.uuid == R410Protocol.SPP_UUID } == true
        }.getOrDefault(false)
        name.contains("Buds Core", true) || name.contains("SM-R410", true) || uuidMatch
    }

    fun connect(device: BluetoothDevice? = preferredDevice()) {
        if (device == null) {
            _state.value = R410ConnectionState.ERROR
            scope.launch { logger.log("BLUETOOTH", "connect", "SM-R410 pareado não encontrado") }
            return
        }
        userDisconnect = false
        target = device
        connectJob?.cancel()
        connectJob = scope.launch { connectInternal(device) }
    }

    fun disconnect() {
        userDisconnect = true
        reconnectJob?.cancel()
        connectJob?.cancel()
        runCatching { socket?.close() }
        socket = null
        output = null
        _state.value = R410ConnectionState.DISCONNECTED
        scope.launch { logger.log("BLUETOOTH", "disconnect", "user") }
    }

    suspend fun send(command: R410Command): Result<Unit> = withContext(Dispatchers.IO) {
        val current = _snapshot.value
        command.validation(current)?.let { return@withContext Result.failure(IllegalStateException(it)) }
        val stream = output ?: return@withContext Result.failure(IllegalStateException("SPP não conectado"))
        val raw = command.encode()
        return@withContext runCatching {
            stream.write(raw)
            stream.flush()
            _packets.emit(ProtocolPacket(
                direction = PacketDirection.TX,
                transport = Transport.SPP,
                channel = R410Protocol.nameOf(command.id),
                payload = raw,
                decoded = command::class.simpleName
            ))
            logger.log("PROTOCOL", "TX " + R410Protocol.nameOf(command.id), R410Protocol.hex(raw))
        }
    }

    private suspend fun connectInternal(device: BluetoothDevice) {
        if (!hasConnectPermission()) {
            _state.value = R410ConnectionState.ERROR
            logger.log("BLUETOOTH", "permission", "BLUETOOTH_CONNECT ausente")
            return
        }

        _state.value = R410ConnectionState.FOUND
        _snapshot.update {
            it.copy(
                name = runCatching { device.name ?: "Galaxy Buds Core" }.getOrDefault("Galaxy Buds Core"),
                addressMasked = maskAddress(runCatching { device.address }.getOrDefault(""))
            )
        }
        updateClassicInfo(device)

        _state.value = R410ConnectionState.CONNECTING
        logger.log("BLUETOOTH", "connect", "Abrindo SPP " + R410Protocol.SPP_UUID)
        cancelDiscovery()

        var connected: BluetoothSocket? = null
        var secureError: Throwable? = null
        try {
            val secure = device.createRfcommSocketToServiceRecord(R410Protocol.SPP_UUID)
            secure.connect()
            connected = secure
            logger.log("BLUETOOTH", "RFCOMM", "secure connected")
        } catch (t: Throwable) {
            secureError = t
            runCatching { connected?.close() }
            connected = null
        }

        if (connected == null) {
            try {
                val insecure = device.createInsecureRfcommSocketToServiceRecord(R410Protocol.SPP_UUID)
                insecure.connect()
                connected = insecure
                logger.log("BLUETOOTH", "RFCOMM", "insecure connected after secure=" + secureError?.message)
            } catch (t: Throwable) {
                _state.value = R410ConnectionState.ERROR
                logger.log("ERROR", "RFCOMM", "secure=" + secureError?.message + "; insecure=" + t.message)
                scheduleReconnect()
                return
            }
        }

        socket = connected
        output = connected.outputStream
        _state.value = R410ConnectionState.DISCOVERING

        try {
            readLoop(connected.inputStream, connected.outputStream)
        } catch (t: Throwable) {
            if (!userDisconnect) logger.log("ERROR", "SPP closed", t.message.orEmpty())
        } finally {
            runCatching { connected.close() }
            socket = null
            output = null
            if (!userDisconnect) {
                _state.value = R410ConnectionState.DISCONNECTED
                scheduleReconnect()
            }
        }
    }

    private suspend fun readLoop(input: InputStream, out: OutputStream) {
        val buffer = ByteArray(1024)
        val decoder = R410Protocol.StreamDecoder()
        var bootstrapped = false

        while (currentCoroutineContext().isActive && !userDisconnect) {
            val count = input.read(buffer)
            if (count < 0) break
            if (count == 0) continue
            val exact = buffer.copyOf(count)

            decoder.feed(exact).forEach { frame ->
                val safePayload = if (frame.id == R410Protocol.Id.CRADLE_SERIAL_NUMBER) byteArrayOf() else frame.raw
                _packets.emit(ProtocolPacket(
                    direction = PacketDirection.RX,
                    transport = Transport.SPP,
                    channel = R410Protocol.nameOf(frame.id),
                    payload = safePayload,
                    decoded = if (frame.id == R410Protocol.Id.CRADLE_SERIAL_NUMBER) "identifier redacted" else null
                ))

                if (frame.id != R410Protocol.Id.CRADLE_SERIAL_NUMBER) {
                    logger.log("PROTOCOL", "RX " + R410Protocol.nameOf(frame.id), R410Protocol.hex(frame.raw))
                } else {
                    logger.log("PROTOCOL", "RX CRADLE_SERIAL_NUMBER", "[redacted]")
                }

                decodeFrame(frame)

                if (!bootstrapped && frame.id == R410Protocol.Id.EXTENDED_STATUS_UPDATED) {
                    val a = R410Command.ManagerInfo.encode()
                    val b = R410Command.DebugSku.encode()
                    out.write(a); out.flush()
                    out.write(b); out.flush()
                    _packets.emit(ProtocolPacket(
                        direction = PacketDirection.TX,
                        transport = Transport.SPP,
                        channel = "BOOTSTRAP",
                        payload = a + b,
                        decoded = "MANAGER_INFO Samsung/SDK34 + DEBUG_SKU"
                    ))
                    bootstrapped = true
                    logger.log("PROTOCOL", "bootstrap", "MANAGER_INFO + DEBUG_SKU")
                }

                if (_state.value == R410ConnectionState.DISCOVERING &&
                    frame.id == R410Protocol.Id.EXTENDED_STATUS_UPDATED) {
                    _state.value = R410ConnectionState.READY
                }
            }
        }
    }

    private suspend fun decodeFrame(frame: R410Protocol.Frame) {
        decoders.firstOrNull { frame.id in it.supportedIds }?.decode(frame)?.let { event ->
            when (event) {
                is DecodedProtocolEvent.Message ->
                    logger.log("DEVICE", event.label, event.detail)
                is DecodedProtocolEvent.SnapshotUpdate -> {
                    val updated = event.transform(_snapshot.value)
                    _snapshot.value = updated
                    if (updated.batteryLeft != null || updated.batteryRight != null || updated.batteryCase != null) {
                        batteryDao.insert(BatterySampleEntity(
                            timestamp = System.currentTimeMillis(),
                            left = updated.batteryLeft,
                            right = updated.batteryRight,
                            caseLevel = updated.batteryCase,
                            noiseMode = updated.noiseMode?.name
                        ))
                    }
                }
            }
        }
        updateClassicProfileStates()
    }

    private fun updateClassicInfo(device: BluetoothDevice) {
        if (!hasConnectPermission()) return
        _classicServices.value = runCatching {
            device.uuids?.map { it.uuid.toString() }.orEmpty()
        }.getOrDefault(emptyList())
        updateClassicProfileStates()
    }

    private fun updateClassicProfileStates() {
        if (!hasConnectPermission()) return
        val a = adapter ?: return
        val a2dp = runCatching { a.getProfileConnectionState(BluetoothProfile.A2DP) == BluetoothProfile.STATE_CONNECTED }.getOrDefault(false)
        val hfp = runCatching { a.getProfileConnectionState(BluetoothProfile.HEADSET) == BluetoothProfile.STATE_CONNECTED }.getOrDefault(false)
        _snapshot.update { old ->
            old.copy(
                a2dpConnected = a2dp,
                hfpConnected = hfp,
                capabilities = old.capabilities.copy(
                    a2dp = Capability(if (a2dp) CapabilityStatus.SUPPORTED else CapabilityStatus.UNKNOWN, EvidenceSource.ANDROID_EXPOSED),
                    hfp = Capability(if (hfp) CapabilityStatus.SUPPORTED else CapabilityStatus.UNKNOWN, EvidenceSource.ANDROID_EXPOSED)
                )
            )
        }
    }

    private fun scheduleReconnect() {
        if (userDisconnect || reconnectJob?.isActive == true) return
        val device = target ?: return
        reconnectJob = scope.launch {
            listOf(2_000L, 5_000L, 10_000L, 30_000L).forEachIndexed { index, delayMs ->
                if (userDisconnect) return@launch
                logger.log("BLUETOOTH", "reconnect", "retry " + (index + 1) + " in " + delayMs + "ms")
                delay(delayMs)
                if (userDisconnect) return@launch
                connectInternal(device)
                if (_state.value == R410ConnectionState.READY) return@launch
            }
        }
    }

    private fun cancelDiscovery() {
        val bluetoothAdapter = adapter ?: return
        if (Build.VERSION.SDK_INT >= 31 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED
        ) return
        runCatching {
            if (bluetoothAdapter.isDiscovering) bluetoothAdapter.cancelDiscovery()
        }
    }

    private fun hasConnectPermission(): Boolean =
        Build.VERSION.SDK_INT < 31 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun maskAddress(address: String): String {
        val parts = address.split(":")
        return if (parts.size == 6) "**:**:**:" + parts[3] + ":" + parts[4] + ":" + parts[5] else "--"
    }
}
