package com.k410sh4.r410control.core.logging

import com.k410sh4.r410control.data.database.ProtocolLogDao
import com.k410sh4.r410control.data.database.ProtocolLogEntity
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppLogger @Inject constructor(
    private val dao: ProtocolLogDao
) {
    suspend fun log(
        category: String,
        event: String,
        result: String,
        latencyMs: Long? = null
    ) {
        dao.insert(
            ProtocolLogEntity(
                timestamp = System.currentTimeMillis(),
                category = category,
                event = event,
                result = result.take(800),
                latencyMs = latencyMs
            )
        )
    }
}
