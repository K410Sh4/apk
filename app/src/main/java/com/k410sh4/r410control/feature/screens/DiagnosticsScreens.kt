package com.k410sh4.r410control.feature.screens

import android.Manifest
import android.bluetooth.BluetoothGattCharacteristic
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.k410sh4.r410control.domain.model.*
import com.k410sh4.r410control.feature.diagnostics.DiagnosticsViewModel
import com.k410sh4.r410control.feature.settings.SettingsViewModel
import com.k410sh4.r410control.ui.components.*
import com.k410sh4.r410control.ui.theme.*
import java.util.UUID

@Composable
fun DiagnosticsScreen(snapshot: R410Snapshot, vm: DiagnosticsViewModel) {
    val packets by vm.packets.collectAsState()
    val logs by vm.logs.collectAsState(initial = emptyList())
    val context = LocalContext.current
    var viewMode by remember { mutableStateOf("HEX") }
    var tab by remember { mutableIntStateOf(0) }

    val exportJson = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) context.contentResolver.openOutputStream(uri)?.use {
            it.write(vm.exportPacketsJson().toByteArray())
        }
    }
    val exportTxt = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri ->
        if (uri != null) context.contentResolver.openOutputStream(uri)?.use {
            it.write(vm.exportPacketsTxt().toByteArray())
        }
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { SectionTitle("Bluetooth Diagnostics", "Protocol, Android state and structured logs") }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    label = { Text("Protocol") },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    label = { Text("Logs") },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (tab == 0) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("HEX", "ASCII", "UINT8").forEach { mode ->
                        FilterChip(
                            selected = viewMode == mode,
                            onClick = { viewMode = mode },
                            label = { Text(mode) }
                        )
                    }
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { exportJson.launch("r410-session.json") }, Modifier.weight(1f)) {
                        Text("Export JSON")
                    }
                    OutlinedButton(onClick = { exportTxt.launch("r410-session.txt") }, Modifier.weight(1f)) {
                        Text("Export TXT")
                    }
                }
            }
            items(packets.take(80).size) { index ->
                val p = packets[index]
                GlassCard(Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(p.direction.name, color = if (p.direction == PacketDirection.RX) Green else Cyan, fontWeight = FontWeight.Bold)
                        Text(p.transport.name, color = TextMuted, style = MaterialTheme.typography.labelSmall)
                    }
                    Text(p.channel, fontWeight = FontWeight.SemiBold)
                    Text(
                        when (viewMode) {
                            "ASCII" -> vm.packetAsAscii(p)
                            "UINT8" -> vm.packetAsUInt8(p)
                            else -> vm.packetAsHex(p)
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted
                    )
                }
            }
        } else {
            items(logs.take(100).size) { index ->
                val log = logs[index]
                GlassCard(Modifier.fillMaxWidth()) {
                    Text(log.category + " • " + log.event, fontWeight = FontWeight.SemiBold)
                    Text(log.result, color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    log.latencyMs?.let { Text(it.toString() + " ms", color = TextMuted, style = MaterialTheme.typography.labelSmall) }
                }
            }
        }
    }
}

@Composable
fun MicrophoneScreen(vm: DiagnosticsViewModel) {
    val state by vm.micTelemetry.collectAsState()
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) vm.startMic()
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { SectionTitle("Microphone Diagnostics", "Visible, user-initiated capture only") }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("HFP input", if (state.running) "ACTIVE / REQUESTED" else "Idle")
                ValueRow("Sample rate", state.sampleRate.toString() + " Hz")
                ValueRow("Channels", state.channelCount.toString())
                ValueRow("RMS", "%.4f".format(state.rms))
                ValueRow("Peak", "%.4f".format(state.peak))
                state.error?.let { Text(it, color = Red) }
            }
        }
        item {
            if (!state.running) {
                Button(
                    onClick = {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            vm.startMic()
                        } else {
                            launcher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.Mic, null)
                    Spacer(Modifier.width(8.dp))
                    Text("START MICROPHONE TEST")
                }
            } else {
                Button(
                    onClick = vm::stopMic,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Red)
                ) {
                    Icon(Icons.Rounded.Stop, null)
                    Spacer(Modifier.width(8.dp))
                    Text("STOP")
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Waveform", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Canvas(Modifier.fillMaxWidth().height(130.dp)) {
                    if (state.waveform.size < 2) return@Canvas
                    val mid = size.height / 2f
                    var prev = Offset(0f, mid)
                    state.waveform.forEachIndexed { index, v ->
                        val x = index / (state.waveform.size - 1f) * size.width
                        val y = mid - v * mid * .9f
                        val cur = Offset(x, y)
                        drawLine(Cyan, prev, cur, 1.5.dp.toPx())
                        prev = cur
                    }
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Spectrum", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Row(
                    Modifier.fillMaxWidth().height(120.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    val labels = listOf("125","250","500","1k","2k","4k","7k")
                    labels.forEachIndexed { i, label ->
                        val value = state.spectrum.getOrNull(i) ?: 0f
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                            Box(
                                Modifier
                                    .fillMaxWidth(.65f)
                                    .height((10 + value * 90).dp)
                                    .background(Cyan.copy(alpha=.75f), RoundedCornerShape(8.dp))
                            )
                            Text(label, color = TextMuted, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
        item {
            Text(
                "The app does not claim access to individual internal ANC microphones. It only records the input route Android makes available.",
                color = TextMuted,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
fun LabScreen(
    snapshot: R410Snapshot,
    vm: DiagnosticsViewModel,
    settings: SettingsViewModel
) {
    val enabled by settings.labMode.collectAsState()
    val services by vm.gattServices.collectAsState()
    val status by vm.gattStatus.collectAsState()
    val context = LocalContext.current
    val reportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) context.contentResolver.openOutputStream(uri)?.use {
            it.write(vm.capabilityReport(snapshot).toByteArray())
        }
    }

    if (!enabled) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(Icons.Rounded.Lock, null, tint = Amber, modifier = Modifier.size(52.dp))
            Spacer(Modifier.height(18.dp))
            Text("LAB MODE LOCKED", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "Settings → Advanced → Enable Lab Mode",
                color = TextMuted,
                modifier = Modifier.padding(top = 8.dp)
            )
            Text(
                "Experimental controls may not be supported by every firmware version.",
                color = TextMuted,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 18.dp)
            )
        }
        return
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            SectionTitle("Lab Mode", "Explicit experimental session • no brute-force or random writes")
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Capability Scanner", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                CapabilitySummary(snapshot.capabilities)
                Spacer(Modifier.height(10.dp))
                OutlinedButton(
                    onClick = { reportLauncher.launch("r410-capability-report.json") },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Export R410 Capability Report") }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("BLE / GATT Service Explorer", fontWeight = FontWeight.Bold)
                Text(status, color = TextMuted)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = vm::inspectGatt, Modifier.weight(1f)) { Text("Inspect GATT") }
                    OutlinedButton(onClick = vm::closeGatt, Modifier.weight(1f)) { Text("Close") }
                }
            }
        }

        services.forEach { service ->
            item {
                var expanded by remember(service.uuid) { mutableStateOf(false) }
                GlassCard(Modifier.fillMaxWidth()) {
                    Row(
                        Modifier.fillMaxWidth().clickable { expanded = !expanded },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("SERVICE", color = Cyan, style = MaterialTheme.typography.labelSmall)
                            Text(service.uuid.toString(), style = MaterialTheme.typography.bodySmall)
                        }
                        Icon(if (expanded) Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore, null)
                    }
                    if (expanded) {
                        Spacer(Modifier.height(10.dp))
                        service.characteristics.forEach { c ->
                            CharacteristicCard(c, vm)
                            Spacer(Modifier.height(8.dp))
                        }
                    }
                }
            }
        }

        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Command Console", fontWeight = FontWeight.Bold)
                CapabilityBadge(Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.DISCOVERED_EXPERIMENTALLY))
                Spacer(Modifier.height(8.dp))
                Text(
                    "Raw SPP command injection is intentionally not enabled. Confirmed commands live in R410Command; manual GATT writes are offered only on writable characteristics with an explicit confirmation dialog.",
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
private fun CharacteristicCard(c: GattCharacteristicInfo, vm: DiagnosticsViewModel) {
    val readable = c.properties and BluetoothGattCharacteristic.PROPERTY_READ != 0
    val writable = c.properties and (BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
    var showWrite by remember { mutableStateOf(false) }

    Surface(
        color = Color.White.copy(alpha=.035f),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha=.06f))
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(c.uuid.toString(), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
            Text(
                buildList {
                    if (readable) add("READ")
                    if (writable) add("WRITE")
                    if (c.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) add("NOTIFY")
                    if (c.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) add("INDICATE")
                }.joinToString(" • ").ifBlank { "No exposed access flags" },
                color = TextMuted,
                style = MaterialTheme.typography.labelSmall
            )
            c.valueHex?.let { Text("HEX: " + it, color = Cyan, style = MaterialTheme.typography.bodySmall) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (readable) TextButton(onClick = { vm.readGatt(c.serviceUuid, c.uuid) }) { Text("READ") }
                if (writable) TextButton(onClick = { showWrite = true }) { Text("WRITE") }
            }
        }
    }

    if (showWrite) {
        var hex by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showWrite = false },
            title = { Text("Experimental GATT write") },
            text = {
                Column {
                    Text("The characteristic advertises WRITE. Enter explicit hexadecimal bytes. No random/brute-force sequence will be generated.")
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(hex, { hex = it }, label = { Text("HEX, e.g. 01 FF 20") })
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    parseHex(hex)?.let { vm.writeGatt(c.serviceUuid, c.uuid, it) }
                    showWrite = false
                }) { Text("CONFIRM WRITE") }
            },
            dismissButton = { TextButton(onClick = { showWrite = false }) { Text("Cancel") } }
        )
    }
}

private fun parseHex(raw: String): ByteArray? {
    val clean = raw.replace("0x", "", ignoreCase = true).replace(Regex("[^0-9A-Fa-f]"), "")
    if (clean.isEmpty() || clean.length % 2 != 0) return null
    return runCatching {
        ByteArray(clean.length / 2) { i -> clean.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }.getOrNull()
}

@Composable
private fun CapabilitySummary(c: DeviceCapabilities) {
    val list = listOf(
        "Bluetooth" to c.bluetooth,
        "SPP" to c.spp,
        "A2DP" to c.a2dp,
        "HFP" to c.hfp,
        "BLE/GATT" to c.bleGatt,
        "ANC" to c.anc,
        "Ambient" to c.ambient,
        "EQ" to c.eq,
        "Touch" to c.touchControls,
        "Battery L" to c.batteryLeft,
        "Battery R" to c.batteryRight,
        "Battery Case" to c.batteryCase,
        "Proximity" to c.proximity,
        "Firmware" to c.firmwareInfo
    )
    list.forEach { (name, cap) ->
        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(name)
            CapabilityBadge(cap, compact = true)
        }
    }
}

@Composable
fun SettingsScreen(vm: SettingsViewModel) {
    val lab by vm.labMode.collectAsState()
    val demo by vm.demoMode.collectAsState()

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { SectionTitle("Settings", "Advanced and development behavior") }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Advanced", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                SettingSwitch(
                    "Enable Lab Mode",
                    "Experimental controls may not be supported by every firmware version.",
                    lab,
                    vm::setLab
                )
                HorizontalDivider(color = Color.White.copy(alpha=.07f))
                SettingSwitch(
                    "Demo Device",
                    "Simulates L 83%, R 78%, Case 61%, ANC ON and AAC. Always labeled DEMO DEVICE.",
                    demo,
                    vm::setDemo
                )
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Privacy & safety", fontWeight = FontWeight.Bold)
                Text(
                    "Microphone permission is requested only when starting Microphone Diagnostics. Raw logs never store call contents, microphone audio, secrets or the cradle serial number.",
                    color = TextMuted,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
    }
}

@Composable
private fun SettingSwitch(title: String, subtitle: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = TextMuted, style = MaterialTheme.typography.bodySmall)
        }
        Switch(value, onChange)
    }
}
