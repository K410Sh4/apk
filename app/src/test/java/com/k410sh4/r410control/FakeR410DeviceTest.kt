package com.k410sh4.r410control

import com.k410sh4.r410control.data.protocol.R410Command
import com.k410sh4.r410control.domain.model.NoiseMode
import com.k410sh4.r410control.domain.model.R410ConnectionState
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class FakeR410DeviceTest {
    @Test
    fun stateMachineAndRepositoryContractWorkWithoutHardware() = runTest {
        val fake = FakeR410Device()
        fake.connect()
        assertEquals(R410ConnectionState.READY, fake.connectionState.value)

        fake.send(R410Command.SetNoiseMode(NoiseMode.AMBIENT))
        assertEquals(NoiseMode.AMBIENT, fake.snapshot.value.noiseMode)
        assertEquals(1, fake.sentCommands.size)

        fake.disconnect()
        assertEquals(R410ConnectionState.DISCONNECTED, fake.connectionState.value)
    }
}
