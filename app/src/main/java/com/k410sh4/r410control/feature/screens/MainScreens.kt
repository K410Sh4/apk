package com.k410sh4.r410control.feature.screens

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import com.k410sh4.r410control.domain.model.*
import com.k410sh4.r410control.feature.control.ControlCenterViewModel
import com.k410sh4.r410control.feature.diagnostics.DiagnosticsViewModel
import com.k410sh4.r410control.ui.Routes
import com.k410sh4.r410control.ui.components.*
import com.k410sh4.r410control.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.math.max

@Composable
fun ConnectionScreen(
    snapshot: R410Snapshot,
    state: R410ConnectionState,
    onConnect: () -> Unit,
    onReady: () -> Unit
) {
    LaunchedEffect(state, snapshot.demo) {
        if (state == R410ConnectionState.READY || snapshot.demo) {
            delay(350)
            onReady()
        }
    }

    Column(
        Modifier.fillMaxSize().padding(horizontal = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            "R410 CONTROL CENTER",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Black
        )
        Text(
            "Galaxy Buds Core • Advanced Control & Diagnostics",
            color = TextMuted,
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(Modifier.height(8.dp))
        EarbudsHero(snapshot, state)
        Spacer(Modifier.height(10.dp))
        GlassCard(Modifier.fillMaxWidth()) {
            ValueRow("Bluetooth", if (state == R410ConnectionState.ERROR) "ERROR" else "READY", Icons.Rounded.Bluetooth)
            ValueRow("Model", "SM-R410")
            ValueRow("Device", snapshot.name)
            ValueRow("Address", snapshot.addressMasked)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { StatusDot(state) }
        }
        Spacer(Modifier.height(22.dp))
        Button(
            onClick = onConnect,
            enabled = state !in setOf(R410ConnectionState.CONNECTING, R410ConnectionState.DISCOVERING),
            modifier = Modifier.fillMaxWidth().height(58.dp),
            shape = RoundedCornerShape(20.dp)
        ) {
            Icon(Icons.Rounded.BluetoothSearching, null)
            Spacer(Modifier.width(10.dp))
            Text(
                when (state) {
                    R410ConnectionState.CONNECTING, R410ConnectionState.DISCOVERING -> "CONNECTING…"
                    R410ConnectionState.READY -> "CONNECTED"
                    else -> "CONECTAR"
                },
                fontWeight = FontWeight.Bold
            )
        }
        Text(
            "Somente dispositivos já pareados. O app não contorna autenticação.",
            color = TextMuted,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}

@Composable
fun DashboardScreen(
    snapshot: R410Snapshot,
    state: R410ConnectionState,
    onNavigate: (String) -> Unit
) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("R410 Control Center", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(snapshot.name, color = TextMuted)
                }
                if (snapshot.demo) {
                    Surface(color = Amber.copy(alpha = .15f), shape = RoundedCornerShape(999.dp)) {
                        Text("DEMO DEVICE", color = Amber, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp))
                    }
                } else StatusDot(state)
            }
        }
        item { EarbudsHero(snapshot, state) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) { BatteryPill("LEFT", snapshot.batteryLeft) }
                Box(Modifier.weight(1f)) { BatteryPill("RIGHT", snapshot.batteryRight) }
                Box(Modifier.weight(1f)) { BatteryPill("CASE", snapshot.batteryCase) }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("Noise", snapshot.noiseMode?.name ?: "UNKNOWN", Icons.Rounded.Hearing)
                ValueRow("A2DP", if (snapshot.a2dpConnected) "CONNECTED" else "UNKNOWN")
                ValueRow("HFP", if (snapshot.hfpConnected) "CONNECTED" else "UNKNOWN")
                ValueRow("Codec", snapshot.codec ?: "Not exposed")
                ValueRow("RSSI", snapshot.rssi?.let { "$it dBm" } ?: "Not exposed")
            }
        }
        item { SectionTitle("Controls", "Only capabilities supported or still investigable are shown.") }
        item {
            FeatureRow(
                left = {
                    FeatureTile("ANC / Ambient", snapshot.noiseMode?.name ?: "Noise control", Icons.Rounded.Hearing, snapshot.capabilities.anc) {
                        onNavigate(Routes.NOISE)
                    }
                },
                right = {
                    FeatureTile("Equalizer", "Device EQ presets", Icons.Rounded.GraphicEq, snapshot.capabilities.eq) {
                        onNavigate(Routes.EQ)
                    }
                }
            )
        }
        item {
            FeatureRow(
                left = {
                    FeatureTile("Touch", "Lock + hold action", Icons.Rounded.TouchApp, snapshot.capabilities.touchControls) {
                        onNavigate(Routes.TOUCH)
                    }
                },
                right = {
                    FeatureTile("Audio", "Profiles & routing", Icons.Rounded.Headphones, snapshot.capabilities.a2dp) {
                        onNavigate(Routes.AUDIO)
                    }
                }
            )
        }
        item {
            FeatureRow(
                left = {
                    FeatureTile("Battery", "History & estimates", Icons.Rounded.BatteryFull, snapshot.capabilities.batteryLeft) {
                        onNavigate(Routes.BATTERY)
                    }
                },
                right = {
                    FeatureTile("Sensors", "In-ear & case states", Icons.Rounded.Sensors, snapshot.capabilities.proximity) {
                        onNavigate(Routes.SENSORS)
                    }
                }
            )
        }
        item {
            FeatureRow(
                left = {
                    FeatureTile("Device Info", "Firmware & services", Icons.Rounded.Info, snapshot.capabilities.firmwareInfo) {
                        onNavigate(Routes.INFO)
                    }
                },
                right = {
                    FeatureTile(
                        "Find My Buds",
                        "Experimental protocol control",
                        Icons.Rounded.Search,
                        snapshot.capabilities.findMyBuds
                    ) { onNavigate(Routes.FIND) }
                }
            )
        }
        item {
            FeatureRow(
                left = {
                    FeatureTile("Diagnostics", "Logs & protocol monitor", Icons.Rounded.BugReport, snapshot.capabilities.bluetooth) {
                        onNavigate(Routes.DIAGNOSTICS)
                    }
                },
                right = {
                    FeatureTile(
                        "Lab",
                        "GATT / raw tools",
                        Icons.Rounded.Science,
                        Capability(CapabilityStatus.EXPERIMENTAL, EvidenceSource.DISCOVERED_EXPERIMENTALLY)
                    ) { onNavigate(Routes.LAB) }
                }
            )
        }
    }
}

@Composable
private fun FeatureRow(
    left: @Composable () -> Unit,
    right: @Composable () -> Unit
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.weight(1f)) { left() }
        Box(Modifier.weight(1f)) { right() }
    }
}

@Composable
fun NoiseControlScreen(snapshot: R410Snapshot, vm: ControlCenterViewModel) {
    var applying by remember { mutableStateOf<NoiseMode?>(null) }
    var ambientLevel by remember(snapshot.ambientLevel) {
        mutableFloatStateOf((snapshot.ambientLevel ?: 0).coerceIn(0, 2).toFloat())
    }

    LaunchedEffect(snapshot.noiseMode) {
        if (applying == snapshot.noiseMode) applying = null
    }

    val supported = snapshot.capabilities.anc.status == CapabilityStatus.SUPPORTED
    val ambientLevelSupported = snapshot.capabilities.ambientLevel.status == CapabilityStatus.SUPPORTED
    val ancLevelSupported = snapshot.capabilities.ancIntensity.status == CapabilityStatus.SUPPORTED
    val oneEarbudSupported = snapshot.capabilities.ancOneEarbud.status == CapabilityStatus.SUPPORTED

    ToolPage("Noise Control", "Device-side control over Samsung SPP") {
        item {
            CapabilityBadge(snapshot.capabilities.anc)
            Spacer(Modifier.height(16.dp))
            NoiseVisualizer(snapshot.noiseMode ?: NoiseMode.OFF)
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(NoiseMode.ANC, NoiseMode.OFF, NoiseMode.AMBIENT).forEach { mode ->
                    val selected = snapshot.noiseMode == mode
                    Button(
                        onClick = {
                            applying = mode
                            vm.setNoiseMode(mode)
                        },
                        enabled = supported && applying == null,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (selected) Cyan else Panel2,
                            contentColor = if (selected) Ink else TextPrimary
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (applying == mode) "APPLYING…" else mode.name)
                    }
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Ambient Level", fontWeight = FontWeight.Bold)
                        Text(
                            if (ambientLevelSupported) "SM-R410 range: 0–2" else "Not exposed by current firmware",
                            color = TextMuted,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    CapabilityBadge(snapshot.capabilities.ambientLevel, compact = true)
                }
                if (ambientLevelSupported) {
                    Spacer(Modifier.height(8.dp))
                    Text(ambientLevel.toInt().toString(), style = MaterialTheme.typography.headlineSmall)
                    Slider(
                        value = ambientLevel,
                        onValueChange = { ambientLevel = it },
                        onValueChangeFinished = { vm.setAmbientLevel(ambientLevel.toInt()) },
                        valueRange = 0f..2f,
                        steps = 1
                    )
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("ANC high sensitivity", fontWeight = FontWeight.Bold)
                        Text("NoiseReductionLevel from the device protocol", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    }
                    if (ancLevelSupported) {
                        Switch(
                            checked = snapshot.ancLevelHigh == true,
                            onCheckedChange = vm::setAncLevelHigh
                        )
                    } else CapabilityBadge(snapshot.capabilities.ancIntensity, compact = true)
                }
                HorizontalDivider(Modifier.padding(vertical = 10.dp), color = Color.White.copy(alpha = .07f))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Noise control with one earbud", fontWeight = FontWeight.Bold)
                        Text("Firmware-reported capability", color = TextMuted, style = MaterialTheme.typography.bodySmall)
                    }
                    if (oneEarbudSupported) {
                        Switch(
                            checked = snapshot.noiseControlsOneEarbud == true,
                            onCheckedChange = vm::setAncOneEarbud
                        )
                    } else CapabilityBadge(snapshot.capabilities.ancOneEarbud, compact = true)
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("Current", snapshot.noiseMode?.name ?: "UNKNOWN")
                ValueRow("Ambient level", snapshot.ambientLevel?.toString() ?: "UNKNOWN")
                ValueRow("ANC sensitivity", snapshot.ancLevelHigh?.let { if (it) "HIGH" else "NORMAL" } ?: "UNKNOWN")
                ValueRow("One-earbud control", snapshot.noiseControlsOneEarbud?.let { if (it) "ALLOWED" else "DISABLED" } ?: "UNKNOWN")
            }
        }
    }
}

@Composable
private fun NoiseVisualizer(mode: NoiseMode) {
    val color = when (mode) {
        NoiseMode.ANC -> Cyan
        NoiseMode.AMBIENT -> Green
        else -> TextMuted
    }
    Canvas(Modifier.fillMaxWidth().height(180.dp)) {
        val c = Offset(size.width / 2, size.height / 2)
        drawCircle(Color(0xFF20242E), 42.dp.toPx(), c)
        repeat(4) { i ->
            val r = (58 + i * 22).dp.toPx()
            drawArc(
                color.copy(alpha = .55f - i * .09f),
                startAngle = 210f,
                sweepAngle = if (mode == NoiseMode.ANC) 120f - i * 12 else 120f,
                useCenter = false,
                topLeft = Offset(c.x - r, c.y - r),
                size = androidx.compose.ui.geometry.Size(r * 2, r * 2),
                style = Stroke(2.dp.toPx())
            )
        }
    }
}

@Composable
fun EqualizerScreen(snapshot: R410Snapshot, vm: ControlCenterViewModel) {
    ToolPage("Equalizer", "Samsung device EQ • not a simulated parametric EQ") {
        item { CapabilityBadge(snapshot.capabilities.eq) }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Device EQ", fontWeight = FontWeight.Bold)
                Text("Current raw mode: " + (snapshot.eqModeRaw?.toString() ?: "unknown"), color = TextMuted)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.setEqPreset(null, false) }, Modifier.fillMaxWidth()) {
                    Text("Normal / Off")
                }
                EqPreset.entries.forEach { preset ->
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { vm.setEqPreset(preset, true) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = snapshot.capabilities.eq.status == CapabilityStatus.SUPPORTED
                    ) { Text(preset.label) }
                }
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Custom 7-band EQ", fontWeight = FontWeight.Bold)
                CapabilityBadge(Capability(CapabilityStatus.UNKNOWN, EvidenceSource.UNANALYZED))
                Spacer(Modifier.height(8.dp))
                Text(
                    "The SM-R410 protocol profile advertises preset EQ. A custom parametric table is not exposed here until confirmed on this firmware.",
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
fun TouchScreen(snapshot: R410Snapshot, vm: ControlCenterViewModel) {
    var left by remember(snapshot.touchLeft) { mutableStateOf(snapshot.touchLeft ?: TouchHoldAction.NOISE_CONTROL) }
    var right by remember(snapshot.touchRight) { mutableStateOf(snapshot.touchRight ?: TouchHoldAction.VOLUME) }

    ToolPage("Touch Controls", "Only mappings exposed by the confirmed StandardTouchMap") {
        item {
            CapabilityBadge(snapshot.capabilities.touchControls)
            Spacer(Modifier.height(12.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("LOCK TOUCH CONTROLS", fontWeight = FontWeight.Bold)
                        Text("Global touch lock", color = TextMuted)
                    }
                    Switch(
                        checked = snapshot.touchLocked == true,
                        onCheckedChange = vm::lockTouch
                    )
                }
            }
        }
        item { TouchActionSelector("LEFT BUD • touch and hold", left) {
            left = it; vm.setTouchHold(left, right)
        } }
        item { TouchActionSelector("RIGHT BUD • touch and hold", right) {
            right = it; vm.setTouchHold(left, right)
        } }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Single / double / triple tap", fontWeight = FontWeight.Bold)
                Text(
                    "Those gestures can be enabled/disabled by firmware, but arbitrary per-gesture remapping has not been confirmed for SM-R410. No fake controls are shown.",
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
private fun TouchActionSelector(title: String, selected: TouchHoldAction, onSelected: (TouchHoldAction) -> Unit) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text(title, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        TouchHoldAction.entries.forEach { action ->
            FilterChip(
                selected = selected == action,
                onClick = { onSelected(action) },
                label = { Text(action.label) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun AudioScreen(snapshot: R410Snapshot, vm: DiagnosticsViewModel, openMic: () -> Unit) {
    val audio by vm.audioDiagnostics.collectAsState()
    LaunchedEffect(Unit) { vm.refreshAudio() }

    ToolPage("Audio Engine", "Public Android audio route and profile inspection") {
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("A2DP", if (audio.a2dp || snapshot.a2dpConnected) "CONNECTED" else "NOT DETECTED")
                ValueRow("HFP", if (audio.hfp || snapshot.hfpConnected) "CONNECTED" else "NOT DETECTED")
                ValueRow("Output", audio.outputDevice ?: "Not exposed")
                ValueRow("Codec", audio.codec ?: "UNKNOWN — not exposed by this API path")
                ValueRow("Sample rates", audio.sampleRates.takeIf { it.isNotEmpty() }?.joinToString() ?: "Not exposed")
                ValueRow("Latency", audio.estimatedLatencyMs?.let { "~$it ms" } ?: "Not measured")
            }
        }
        item {
            Button(onClick = vm::refreshAudio, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Rounded.Refresh, null); Spacer(Modifier.width(8.dp)); Text("Refresh Android audio state")
            }
        }
        item {
            OutlinedButton(onClick = openMic, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Rounded.Mic, null); Spacer(Modifier.width(8.dp)); Text("Microphone Diagnostics")
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Latency estimator", fontWeight = FontWeight.Bold)
                Text(
                    "A one-way Bluetooth latency value is not invented. It will only be shown after a measurable test path exists.",
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
fun BatteryScreen(snapshot: R410Snapshot, vm: ControlCenterViewModel) {
    val history by vm.batteryHistory.collectAsState(initial = emptyList())
    val usable = history.filter { it.left != null }
    val estimate = remember(history, snapshot.batteryLeft) {
        if (usable.size >= 2) {
            val first = usable.first()
            val last = usable.last()
            val hours = (last.timestamp - first.timestamp) / 3_600_000.0
            val drop = (first.left ?: 0) - (last.left ?: 0)
            if (hours > .15 && drop > 0) {
                val perHour = drop / hours
                val remaining = (snapshot.batteryLeft ?: 0) / perHour
                Pair(perHour, remaining)
            } else null
        } else null
    }

    ToolPage("Battery Intelligence", "Local estimates are explicitly marked as estimates") {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) { BatteryPill("LEFT", snapshot.batteryLeft) }
                Box(Modifier.weight(1f)) { BatteryPill("RIGHT", snapshot.batteryRight) }
                Box(Modifier.weight(1f)) { BatteryPill("CASE", snapshot.batteryCase) }
            }
        }
        item {
            BatteryChart(history.mapNotNull { sample -> sample.left?.let { sample.timestamp to it } })
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("Samples", history.size.toString())
                ValueRow("Average drain", estimate?.let { "%.2f %%/h (estimate)".format(it.first) } ?: "Need more data")
                ValueRow("Runtime left", estimate?.let { "%.1f h (estimate)".format(it.second) } ?: "Need more data")
                Text("Estimates are calculated locally from observed battery samples; they are not Samsung battery-health telemetry.", color = TextMuted, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun BatteryChart(points: List<Pair<Long, Int>>) {
    GlassCard(Modifier.fillMaxWidth()) {
        Text("Discharge history", fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Canvas(Modifier.fillMaxWidth().height(170.dp)) {
            if (points.size < 2) {
                drawLine(TextMuted.copy(alpha=.4f), Offset(0f,size.height/2), Offset(size.width,size.height/2), 1.dp.toPx())
                return@Canvas
            }
            val t0 = points.first().first
            val span = max(1L, points.last().first - t0)
            var prev: Offset? = null
            points.forEach { (t, level) ->
                val x = ((t - t0).toFloat() / span) * size.width
                val y = size.height - (level.coerceIn(0,100) / 100f) * size.height
                val cur = Offset(x,y)
                prev?.let { drawLine(Cyan, it, cur, 2.dp.toPx()) }
                prev = cur
            }
        }
    }
}

@Composable
fun SensorScreen(snapshot: R410Snapshot, state: R410ConnectionState) {
    ToolPage("Sensor Monitor", "Only states actually exposed by the protocol are interpreted") {
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("LEFT", placementLabel(snapshot.placementLeft), Icons.Rounded.Headphones)
                ValueRow("RIGHT", placementLabel(snapshot.placementRight), Icons.Rounded.Headphones)
                ValueRow("Connection", state.name, Icons.Rounded.Bluetooth)
                ValueRow("Case / Hall", if (snapshot.placementLeft == Placement.CASE || snapshot.placementRight == Placement.CASE) "Case placement observed" else "UNKNOWN")
                ValueRow("Left charging", snapshot.chargingLeft?.let { if (it) "YES" else "NO" } ?: "UNKNOWN")
                ValueRow("Right charging", snapshot.chargingRight?.let { if (it) "YES" else "NO" } ?: "UNKNOWN")
                ValueRow("Case charging", snapshot.chargingCase?.let { if (it) "YES" else "NO" } ?: "UNKNOWN")
            }
        }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Evidence", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                CapabilityBadge(snapshot.capabilities.proximity)
                Spacer(Modifier.height(8.dp))
                Text("In-ear states were observed directly in STATUS_UPDATED / EXTENDED_STATUS_UPDATED on your SM-R410.", color = TextMuted)
            }
        }
    }
}

private fun placementLabel(p: Placement) = when (p) {
    Placement.WEARING -> "IN EAR"
    Placement.IDLE -> "OUT OF EAR"
    Placement.CASE -> "IN CASE"
    Placement.CLOSED_CASE -> "CLOSED CASE"
    Placement.DISCONNECTED -> "DISCONNECTED"
    Placement.UNKNOWN -> "UNKNOWN"
}

@Composable
fun DeviceInfoScreen(snapshot: R410Snapshot, vm: DiagnosticsViewModel) {
    val services by vm.classicServices.collectAsState()
    ToolPage("Device Information", "Hardware and Android-exposed metadata") {
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                ValueRow("Model", "SM-R410")
                ValueRow("Product", snapshot.name)
                ValueRow("Address", snapshot.addressMasked)
                ValueRow("Firmware", snapshot.firmware)
                ValueRow("SKU", snapshot.sku)
                ValueRow("Bluetooth", "5.4 (hardware specification)")
                ValueRow("A2DP", if (snapshot.a2dpConnected) "Connected" else "Unknown")
                ValueRow("HFP", if (snapshot.hfpConnected) "Connected" else "Unknown")
            }
        }
        item {
            SectionTitle("SDP services", services.size.toString() + " cached UUIDs")
            Spacer(Modifier.height(8.dp))
            GlassCard(Modifier.fillMaxWidth()) {
                if (services.isEmpty()) Text("No SDP UUIDs available yet", color = TextMuted)
                services.forEach { Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 4.dp)) }
            }
        }
    }
}

@Composable
fun FindMyBudsScreen(snapshot: R410Snapshot, vm: ControlCenterViewModel) {
    var pendingTarget by remember { mutableStateOf<String?>(null) }
    var activeTarget by remember { mutableStateOf<String?>(null) }
    val wearing = snapshot.placementLeft == Placement.WEARING || snapshot.placementRight == Placement.WEARING
    val wearStateKnown = snapshot.placementLeft !in setOf(Placement.UNKNOWN, Placement.DISCONNECTED) &&
        snapshot.placementRight !in setOf(Placement.UNKNOWN, Placement.DISCONNECTED)
    val safeToRing = wearStateKnown && !wearing

    ToolPage("Find My Buds", "Experimental • audible locator command") {
        item { CapabilityBadge(snapshot.capabilities.findMyBuds) }
        item {
            GlassCard(Modifier.fillMaxWidth()) {
                Text("Safety gate", fontWeight = FontWeight.Bold)
                Text(
                    when {
                        !wearStateKnown -> "Wear-state is unknown. Locator is blocked until both earbuds report a safe state."
                        wearing -> "Remove both earbuds from your ears before starting the locator."
                        else -> "Earbuds are not reported as being worn. A confirmation is required before sound is emitted."
                    },
                    color = if (safeToRing) TextMuted else Red
                )
            }
        }
        item {
            if (activeTarget == null) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { pendingTarget = "LEFT" },
                        enabled = safeToRing,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Find Left") }
                    Button(
                        onClick = { pendingTarget = "RIGHT" },
                        enabled = safeToRing,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Find Right") }
                    Button(
                        onClick = { pendingTarget = "BOTH" },
                        enabled = safeToRing,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Find Both") }
                }
            } else {
                GlassCard(Modifier.fillMaxWidth()) {
                    Text("Locator active: " + activeTarget, color = Amber, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(10.dp))
                    Button(
                        onClick = { vm.findStop(); activeTarget = null },
                        colors = ButtonDefaults.buttonColors(containerColor = Red),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("STOP") }
                }
            }
        }
    }

    pendingTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingTarget = null },
            title = { Text("Emit locator sound on $target?") },
            text = { Text("The selected Buds may emit an audible locator tone. Confirm no selected earbud is being worn.") },
            confirmButton = {
                TextButton(onClick = {
                    pendingTarget = null
                    when (target) {
                        "LEFT" -> vm.findLeft()
                        "RIGHT" -> vm.findRight()
                        else -> vm.findBoth()
                    }
                    activeTarget = target
                }) { Text("CONFIRM") }
            },
            dismissButton = { TextButton(onClick = { pendingTarget = null }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun ToolPage(
    title: String,
    subtitle: String,
    content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit
) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { SectionTitle(title, subtitle) }
        content()
        item { Spacer(Modifier.height(12.dp)) }
    }
}
