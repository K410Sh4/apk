package com.k410sh4.r410control.data.settings

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore("r410_settings")

@Singleton
class SettingsStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val labKey = booleanPreferencesKey("lab_mode")
    private val demoKey = booleanPreferencesKey("demo_mode")

    val labMode: Flow<Boolean> = context.dataStore.data.map { it[labKey] ?: false }
    val demoMode: Flow<Boolean> = context.dataStore.data.map { it[demoKey] ?: false }

    suspend fun setLabMode(enabled: Boolean) {
        context.dataStore.edit { it[labKey] = enabled }
    }

    suspend fun setDemoMode(enabled: Boolean) {
        context.dataStore.edit { it[demoKey] = enabled }
    }
}
