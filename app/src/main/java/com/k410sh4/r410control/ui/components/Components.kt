package com.k410sh4.r410control.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import com.k410sh4.r410control.domain.model.*
import com.k410sh4.r410control.ui.theme.*

@Composable
fun PremiumBackground(content: @Composable BoxScope.() -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF030407), Color(0xFF080B11), Color(0xFF050608))
                )
            ),
        content = content
    )
}

@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier,
        color = Color.White.copy(alpha = 0.055f),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.09f)),
        shape = RoundedCornerShape(26.dp)
    ) {
        Column(Modifier.padding(18.dp), content = content)
    }
}

@Composable
fun CapabilityBadge(capability: Capability, compact: Boolean = false) {
    val (label, color) = when (capability.status) {
        CapabilityStatus.SUPPORTED -> "SUPPORTED" to Green
        CapabilityStatus.UNSUPPORTED -> "UNSUPPORTED" to Red
        CapabilityStatus.EXPERIMENTAL -> "EXPERIMENTAL" to Amber
        CapabilityStatus.UNKNOWN -> "UNKNOWN" to TextMuted
        CapabilityStatus.REQUIRES_SAMSUNG -> "SAMSUNG" to Violet
        CapabilityStatus.REQUIRES_PERMISSION -> "PERMISSION" to Cyan
    }
    Surface(
        color = color.copy(alpha = 0.14f),
        contentColor = color,
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.dp, color.copy(alpha = 0.25f))
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = if (compact) 8.dp else 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun StatusDot(state: R410ConnectionState) {
    val color = when (state) {
        R410ConnectionState.READY -> Green
        R410ConnectionState.ERROR -> Red
        R410ConnectionState.CONNECTING, R410ConnectionState.DISCOVERING, R410ConnectionState.SCANNING -> Amber
        else -> TextMuted
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(50)).background(color))
        Spacer(Modifier.width(7.dp))
        Text(state.name, style = MaterialTheme.typography.labelMedium, color = color)
    }
}

@Composable
fun BatteryPill(label: String, value: Int?) {
    GlassCard(Modifier.widthIn(min = 96.dp)) {
        Text(label, color = TextMuted, style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            value?.let { "$it%" } ?: "--",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun FeatureTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    capability: Capability,
    onClick: () -> Unit
) {
    val clickable = capability.status != CapabilityStatus.UNSUPPORTED
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 132.dp)
            .clickable(enabled = clickable, onClick = onClick),
        color = Color.White.copy(alpha = if (clickable) 0.055f else 0.025f),
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
    ) {
        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Icon(icon, null, tint = if (clickable) Cyan else TextMuted)
                CapabilityBadge(capability, compact = true)
            }
            Column {
                Text(title, fontWeight = FontWeight.SemiBold)
                Text(
                    subtitle,
                    color = TextMuted,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun EarbudsHero(
    snapshot: R410Snapshot,
    state: R410ConnectionState,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "hero")
    val phase by transition.animateFloat(
        0f, 1f,
        infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Restart),
        label = "phase"
    )
    val active = state == R410ConnectionState.READY || snapshot.demo
    val waveColor = when (snapshot.noiseMode) {
        NoiseMode.ANC -> Cyan
        NoiseMode.AMBIENT -> Green
        else -> Violet
    }

    Canvas(modifier.height(230.dp).fillMaxWidth()) {
        val center = Offset(size.width / 2f, size.height / 2f)
        if (active) {
            repeat(3) { index ->
                val r = 55.dp.toPx() + ((phase + index / 3f) % 1f) * 85.dp.toPx()
                drawCircle(
                    color = waveColor.copy(alpha = (1f - ((phase + index / 3f) % 1f)) * 0.18f),
                    radius = r,
                    center = center,
                    style = Stroke(width = 1.4.dp.toPx())
                )
            }
        }

        fun bud(x: Float, flip: Boolean) {
            val body = if (active) Color(0xFFE8ECF3) else Color(0xFF545A65)
            drawCircle(body, 34.dp.toPx(), Offset(x, center.y - 18.dp.toPx()))
            val stemX = x + if (flip) 20.dp.toPx() else -20.dp.toPx()
            drawRoundRect(
                body,
                topLeft = Offset(stemX - 8.dp.toPx(), center.y + 3.dp.toPx()),
                size = androidx.compose.ui.geometry.Size(16.dp.toPx(), 73.dp.toPx()),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(9.dp.toPx())
            )
            drawCircle(Color(0xFF191C22), 7.dp.toPx(), Offset(x + if (flip) 9.dp.toPx() else -9.dp.toPx(), center.y - 24.dp.toPx()))
        }

        bud(center.x - 62.dp.toPx(), false)
        bud(center.x + 62.dp.toPx(), true)

        drawRoundRect(
            color = Color(0xFF1B1F27),
            topLeft = Offset(center.x - 62.dp.toPx(), center.y + 68.dp.toPx()),
            size = androidx.compose.ui.geometry.Size(124.dp.toPx(), 54.dp.toPx()),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(24.dp.toPx())
        )
        drawLine(
            Color.White.copy(alpha = .18f),
            Offset(center.x - 38.dp.toPx(), center.y + 83.dp.toPx()),
            Offset(center.x + 38.dp.toPx(), center.y + 83.dp.toPx()),
            1.dp.toPx()
        )
    }
}

@Composable
fun SectionTitle(title: String, subtitle: String? = null) {
    Column(Modifier.fillMaxWidth()) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (subtitle != null) {
            Text(subtitle, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun ValueRow(label: String, value: String, icon: ImageVector? = null) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(icon, null, tint = TextMuted, modifier = Modifier.size(19.dp))
            Spacer(Modifier.width(10.dp))
        }
        Text(label, color = TextMuted, modifier = Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.Medium)
    }
}
