package com.k410sh4.r410control.di

import com.k410sh4.r410control.data.repository.R410RepositoryImpl
import com.k410sh4.r410control.domain.repository.R410Repository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindR410Repository(impl: R410RepositoryImpl): R410Repository
}
