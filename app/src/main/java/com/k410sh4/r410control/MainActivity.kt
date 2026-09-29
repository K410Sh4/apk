package com.k410sh4.r410control

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.k410sh4.r410control.feature.control.ControlCenterViewModel
import com.k410sh4.r410control.feature.diagnostics.DiagnosticsViewModel
import com.k410sh4.r410control.feature.settings.SettingsViewModel
import com.k410sh4.r410control.ui.AppNav
import com.k410sh4.r410control.ui.theme.R410Theme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private var connectAfterPermission: (() -> Unit)? = null

    private val bluetoothPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if (result.values.all { it }) connectAfterPermission?.invoke()
        connectAfterPermission = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            R410Theme {
                val control: ControlCenterViewModel = hiltViewModel()
                val diagnostics: DiagnosticsViewModel = hiltViewModel()
                val settings: SettingsViewModel = hiltViewModel()

                AppNav(
                    control = control,
                    diagnostics = diagnostics,
                    settings = settings,
                    requestBluetoothAndConnect = {
                        if (Build.VERSION.SDK_INT >= 31) {
                            connectAfterPermission = { control.connect() }
                            bluetoothPermissionLauncher.launch(
                                arrayOf(
                                    Manifest.permission.BLUETOOTH_CONNECT,
                                    Manifest.permission.BLUETOOTH_SCAN
                                )
                            )
                        } else {
                            control.connect()
                        }
                    }
                )
            }
        }
    }
}
