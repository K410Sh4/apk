package com.k410sh4.r410control.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Ink = Color(0xFF050608)
val Panel = Color(0xFF111319)
val Panel2 = Color(0xFF181B23)
val Cyan = Color(0xFF6BE7FF)
val Violet = Color(0xFF987BFF)
val Green = Color(0xFF72F0B0)
val Amber = Color(0xFFFFC857)
val Red = Color(0xFFFF6B7A)
val TextPrimary = Color(0xFFF4F7FB)
val TextMuted = Color(0xFFA9B0BD)

private val scheme = darkColorScheme(
    primary = Cyan,
    secondary = Violet,
    tertiary = Green,
    background = Ink,
    surface = Panel,
    surfaceVariant = Panel2,
    onPrimary = Ink,
    onSecondary = TextPrimary,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextMuted,
    error = Red
)

@Composable
fun R410Theme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = scheme,
        typography = Typography(),
        content = content
    )
}
