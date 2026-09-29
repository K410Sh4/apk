package com.k410sh4.r410control.data.database

import androidx.room.Database
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "protocol_log")
data class ProtocolLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val category: String,
    val event: String,
    val result: String,
    val latencyMs: Long? = null
)

@Entity(tableName = "battery_sample")
data class BatterySampleEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    val left: Int?,
    val right: Int?,
    val caseLevel: Int?,
    val noiseMode: String?
)

@Dao
interface ProtocolLogDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: ProtocolLogEntity)

    @Query("SELECT * FROM protocol_log ORDER BY timestamp DESC LIMIT :limit")
    fun observe(limit: Int = 500): Flow<List<ProtocolLogEntity>>

    @Query("DELETE FROM protocol_log")
    suspend fun clear()
}

@Dao
interface BatteryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: BatterySampleEntity)

    @Query("SELECT * FROM battery_sample ORDER BY timestamp ASC LIMIT :limit")
    fun observe(limit: Int = 2000): Flow<List<BatterySampleEntity>>

    @Query("DELETE FROM battery_sample")
    suspend fun clear()
}

@Database(
    entities = [ProtocolLogEntity::class, BatterySampleEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun protocolLogDao(): ProtocolLogDao
    abstract fun batteryDao(): BatteryDao
}
