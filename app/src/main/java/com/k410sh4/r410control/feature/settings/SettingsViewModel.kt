package com.k410sh4.r410control.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.k410sh4.r410control.data.settings.SettingsStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val store: SettingsStore
) : ViewModel() {
    val labMode = store.labMode.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)
    val demoMode = store.demoMode.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    fun setLab(enabled: Boolean) = viewModelScope.launch { store.setLabMode(enabled) }
    fun setDemo(enabled: Boolean) = viewModelScope.launch { store.setDemoMode(enabled) }
}
