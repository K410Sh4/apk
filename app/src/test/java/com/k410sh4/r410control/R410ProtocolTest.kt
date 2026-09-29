package com.k410sh4.r410control

import com.k410sh4.r410control.data.protocol.*
import com.k410sh4.r410control.domain.model.*
import org.junit.Assert.*
import org.junit.Test

class R410ProtocolTest {
    @Test
    fun decodesRealStatusFrameFromSmR410() {
        val raw = hex("FD 0B 00 60 01 64 64 01 01 11 FF 00 DA 3F DD")
        val frame = R410Protocol.StreamDecoder().feed(raw).single()

        assertEquals(R410Protocol.Id.STATUS_UPDATED, frame.id)
        assertEquals(8, frame.payload.size)

        val event = DeviceStatusDecoder().decode(frame) as DecodedProtocolEvent.SnapshotUpdate
        val snapshot = event.transform(R410Snapshot())

        assertEquals(100, snapshot.batteryLeft)
        assertEquals(100, snapshot.batteryRight)
        assertEquals(Placement.WEARING, snapshot.placementLeft)
        assertEquals(Placement.WEARING, snapshot.placementRight)
        assertNull(snapshot.batteryCase)
    }

    @Test
    fun decodesRealExtendedStatusAndCapabilities() {
        val raw = hex(
            "FD 3B C0 61 00 0A 64 64 01 00 11 FF 01 03 BF 22 01 00 43 01 43 01 00 00 04 66 00 00 00 10 00 01 01 01 11 02 01 00 00 01 01 01 00 00 9D 0E 01 00 01 00 00 00 00 00 00 00 00 00 00 00 57 47 DD"
        )
        val frame = R410Protocol.StreamDecoder().feed(raw).single()
        val event = DeviceStatusDecoder().decode(frame) as DecodedProtocolEvent.SnapshotUpdate
        val snapshot = event.transform(R410Snapshot())

        assertEquals(100, snapshot.batteryLeft)
        assertEquals(100, snapshot.batteryRight)
        assertEquals(NoiseMode.ANC, snapshot.noiseMode)
        assertEquals(0, snapshot.ambientLevel)
        assertEquals(false, snapshot.ancLevelHigh)
        assertEquals(true, snapshot.noiseControlsOneEarbud)
        assertEquals(false, snapshot.chargingLeft)
        assertEquals(false, snapshot.chargingRight)
        assertEquals(false, snapshot.chargingCase)
        assertEquals(CapabilityStatus.SUPPORTED, snapshot.capabilities.anc.status)
        assertEquals(CapabilityStatus.SUPPORTED, snapshot.capabilities.proximity.status)
        assertEquals(CapabilityStatus.SUPPORTED, snapshot.capabilities.ambientLevel.status)
        assertEquals(CapabilityStatus.SUPPORTED, snapshot.capabilities.ancIntensity.status)
        assertEquals(CapabilityStatus.SUPPORTED, snapshot.capabilities.ancOneEarbud.status)
        assertEquals(CapabilityStatus.SUPPORTED, snapshot.capabilities.chargingState.status)
    }

    @Test
    fun unknownNoiseModeRemainsUnknown() {
        assertEquals(NoiseMode.UNKNOWN, NoiseMode.from(99))
    }

    @Test
    fun locatorRejectsUnknownWearState() {
        val result = R410Command.FindStart.validation(R410Snapshot())
        assertNotNull(result)
    }

    @Test
    fun advancedCommandsEncodeExpectedPayloads() {
        val ambient = R410Command.SetAmbientLevel(2).encode()
        assertEquals(R410Protocol.Id.AMBIENT_VOLUME, ambient[3].toInt() and 0xFF)
        assertEquals(2, ambient[4].toInt() and 0xFF)

        val anc = R410Command.SetAncLevelHigh(true).encode()
        assertEquals(R410Protocol.Id.NOISE_REDUCTION_LEVEL, anc[3].toInt() and 0xFF)
        assertEquals(1, anc[4].toInt() and 0xFF)

        val mute = R410Command.MuteEarbuds(leftMuted = false, rightMuted = true).encode()
        assertEquals(R410Protocol.Id.MUTE_EARBUD, mute[3].toInt() and 0xFF)
        assertEquals(0, mute[4].toInt() and 0xFF)
        assertEquals(1, mute[5].toInt() and 0xFF)
    }

    @Test
    fun managerInfoEncodingHasValidCrc() {
        val raw = R410Command.ManagerInfo.encode()
        assertEquals(R410Protocol.SOM, raw.first().toInt() and 0xFF)
        assertEquals(R410Protocol.EOM, raw.last().toInt() and 0xFF)
        assertEquals(R410Protocol.Id.MANAGER_INFO, raw[3].toInt() and 0xFF)

        val payloadLength = (raw[1].toInt() and 0xFF) - 3
        val idAndPayload = raw.copyOfRange(3, 4 + payloadLength)
        val crc = R410Protocol.crc16Ccitt(idAndPayload)
        assertEquals(crc and 0xFF, raw[4 + payloadLength].toInt() and 0xFF)
        assertEquals((crc shr 8) and 0xFF, raw[5 + payloadLength].toInt() and 0xFF)
    }

    private fun hex(text: String): ByteArray =
        text.trim().split(Regex("\\s+")).map { it.toInt(16).toByte() }.toByteArray()
}
