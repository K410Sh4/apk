package com.k410sh4.r410control.core.audio

import android.bluetooth.*
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import com.k410sh4.r410control.domain.model.AudioDiagnostics
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioInspector @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

    private val _diagnostics = MutableStateFlow(AudioDiagnostics())
    val diagnostics: StateFlow<AudioDiagnostics> = _diagnostics.asStateFlow()

    fun refresh(device: BluetoothDevice?) {
        val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        val inputs = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
        val btOut = outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
        val btIn = inputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }

        val adapter = bluetoothManager.adapter
        val a2dp = runCatching { adapter?.getProfileConnectionState(BluetoothProfile.A2DP) == BluetoothProfile.STATE_CONNECTED }.getOrDefault(false)
        val hfp = runCatching { adapter?.getProfileConnectionState(BluetoothProfile.HEADSET) == BluetoothProfile.STATE_CONNECTED }.getOrDefault(false)

        _diagnostics.value = AudioDiagnostics(
            outputDevice = btOut?.productName?.toString(),
            inputDevice = btIn?.productName?.toString(),
            sampleRates = btOut?.sampleRates?.toList().orEmpty(),
            channelCounts = btOut?.channelCounts?.toList().orEmpty(),
            codec = null,
            a2dp = a2dp,
            hfp = hfp,
            estimatedLatencyMs = null
        )
    }
}
