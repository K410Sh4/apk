package com.k410sh4.r410control.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.*
import com.k410sh4.r410control.feature.control.ControlCenterViewModel
import com.k410sh4.r410control.feature.diagnostics.DiagnosticsViewModel
import com.k410sh4.r410control.feature.screens.*
import com.k410sh4.r410control.feature.settings.SettingsViewModel
import com.k410sh4.r410control.ui.components.PremiumBackground

object Routes {
    const val CONNECTION = "connection"
    const val HOME = "home"
    const val NOISE = "noise"
    const val EQ = "eq"
    const val TOUCH = "touch"
    const val AUDIO = "audio"
    const val MIC = "mic"
    const val BATTERY = "battery"
    const val SENSORS = "sensors"
    const val INFO = "info"
    const val DIAGNOSTICS = "diagnostics"
    const val LAB = "lab"
    const val SETTINGS = "settings"
    const val FIND = "find"
}

@Composable
fun AppNav(
    control: ControlCenterViewModel,
    diagnostics: DiagnosticsViewModel,
    settings: SettingsViewModel,
    requestBluetoothAndConnect: () -> Unit
) {
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }
    val snapshot by control.snapshot.collectAsState()
    val state by control.connectionState.collectAsState()

    LaunchedEffect(Unit) {
        control.message.collect { snackbar.showSnackbar(it) }
    }

    PremiumBackground {
        Scaffold(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                val entry by nav.currentBackStackEntryAsState()
                val route = entry?.destination?.route
                if (route != Routes.CONNECTION) {
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = .96f)) {
                        listOf(
                            Triple(Routes.HOME, "Home", Icons.Rounded.Home),
                            Triple(Routes.DIAGNOSTICS, "Diagnostics", Icons.Rounded.BugReport),
                            Triple(Routes.LAB, "Lab", Icons.Rounded.Science),
                            Triple(Routes.SETTINGS, "Settings", Icons.Rounded.Settings)
                        ).forEach { (r, label, icon) ->
                            NavigationBarItem(
                                selected = route == r,
                                onClick = { nav.navigate(r) { launchSingleTop = true } },
                                icon = { Icon(icon, null) },
                                label = { Text(label) }
                            )
                        }
                    }
                }
            }
        ) { padding ->
            NavHost(
                navController = nav,
                startDestination = Routes.CONNECTION,
                modifier = Modifier.padding(padding)
            ) {
                composable(Routes.CONNECTION) {
                    ConnectionScreen(snapshot, state, requestBluetoothAndConnect) {
                        nav.navigate(Routes.HOME) { popUpTo(Routes.CONNECTION) { inclusive = true } }
                    }
                }
                composable(Routes.HOME) {
                    DashboardScreen(snapshot, state, onNavigate = nav::navigate)
                }
                composable(Routes.NOISE) { NoiseControlScreen(snapshot, control) }
                composable(Routes.EQ) { EqualizerScreen(snapshot, control) }
                composable(Routes.TOUCH) { TouchScreen(snapshot, control) }
                composable(Routes.AUDIO) { AudioScreen(snapshot, diagnostics) { nav.navigate(Routes.MIC) } }
                composable(Routes.MIC) { MicrophoneScreen(diagnostics) }
                composable(Routes.BATTERY) { BatteryScreen(snapshot, control) }
                composable(Routes.SENSORS) { SensorScreen(snapshot, state) }
                composable(Routes.INFO) { DeviceInfoScreen(snapshot, diagnostics) }
                composable(Routes.DIAGNOSTICS) { DiagnosticsScreen(snapshot, diagnostics) }
                composable(Routes.LAB) { LabScreen(snapshot, diagnostics, settings) }
                composable(Routes.SETTINGS) { SettingsScreen(settings) }
                composable(Routes.FIND) { FindMyBudsScreen(snapshot, control) }
            }
        }
    }
}
