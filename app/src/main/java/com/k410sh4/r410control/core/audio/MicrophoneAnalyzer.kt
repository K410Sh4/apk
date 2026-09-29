package com.k410sh4.r410control.core.audio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.*
import android.os.Build
import androidx.core.content.ContextCompat
import com.k410sh4.r410control.domain.model.MicTelemetry
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MicrophoneAnalyzer @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val _state = MutableStateFlow(MicTelemetry())
    val state: StateFlow<MicTelemetry> = _state.asStateFlow()
    private var job: Job? = null

    fun start() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            _state.value = MicTelemetry(error = "Microphone permission required")
            return
        }
        if (job?.isActive == true) return
        job = scope.launch {
            val sampleRate = 16_000
            val min = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val record = AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
                .setAudioFormat(AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build())
                .setBufferSizeInBytes((min.coerceAtLeast(2048)) * 2)
                .build()

            if (Build.VERSION.SDK_INT >= 31) {
                audioManager.availableCommunicationDevices
                    .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
                    ?.let { audioManager.setCommunicationDevice(it) }
            } else {
                @Suppress("DEPRECATION")
                audioManager.startBluetoothSco()
            }

            try {
                record.startRecording()
                _state.value = MicTelemetry(running = true)
                val buffer = ShortArray(1024)
                while (isActive) {
                    val n = record.read(buffer, 0, buffer.size)
                    if (n <= 0) continue
                    val normalized = buffer.take(n).map { it / 32768f }
                    val rms = sqrt(normalized.sumOf { (it * it).toDouble() } / n).toFloat()
                    val peak = normalized.maxOfOrNull { abs(it) } ?: 0f
                    val wave = normalized.filterIndexed { index, _ -> index % 8 == 0 }.take(128)
                    val spec = dftBands(normalized, sampleRate)
                    _state.value = MicTelemetry(true, rms, peak, wave, spec, sampleRate, 1, null)
                }
            } catch (t: Throwable) {
                _state.value = MicTelemetry(error = t.message)
            } finally {
                runCatching { record.stop() }
                record.release()
                if (Build.VERSION.SDK_INT >= 31) audioManager.clearCommunicationDevice()
                else {
                    @Suppress("DEPRECATION")
                    audioManager.stopBluetoothSco()
                }
                _state.value = _state.value.copy(running = false)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    private fun dftBands(samples: List<Float>, sampleRate: Int): List<Float> {
        if (samples.isEmpty()) return emptyList()
        val frequencies = listOf(125, 250, 500, 1000, 2000, 4000, 7000)
        val n = samples.size
        return frequencies.map { f ->
            var re = 0.0
            var im = 0.0
            samples.forEachIndexed { i, x ->
                val a = 2.0 * Math.PI * f * i / sampleRate
                re += x * cos(a)
                im -= x * sin(a)
            }
            (sqrt(re * re + im * im) / n).toFloat().coerceIn(0f, 1f)
        }
    }
}
