package com.k410sh4.r410control.di

import android.content.Context
import androidx.room.Room
import com.k410sh4.r410control.data.database.AppDatabase
import com.k410sh4.r410control.data.database.BatteryDao
import com.k410sh4.r410control.data.database.ProtocolLogDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Singleton
    fun database(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "r410_lab.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun logDao(db: AppDatabase): ProtocolLogDao = db.protocolLogDao()
    @Provides fun batteryDao(db: AppDatabase): BatteryDao = db.batteryDao()
}
