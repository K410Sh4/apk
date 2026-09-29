package com.k410sh4.budslab;

import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public final class BudsProtocol {
    public static final UUID SPP_NEW_UUID =
            UUID.fromString("2e73a4ad-332d-41fc-90e2-16bef06523f2");

    public static final int SOM = 0xFD;
    public static final int EOM = 0xDD;

    public static final int ID_STATUS_UPDATED = 96;
    public static final int ID_EXTENDED_STATUS_UPDATED = 97;
    public static final int ID_VERSION_INFO_LONG = 104;
    public static final int ID_MANAGER_INFO = 136;
    public static final int ID_DEBUG_SKU = 34;

    private static final Map<Integer, String> MESSAGE_NAMES = new HashMap<>();

    static {
        MESSAGE_NAMES.put(15, "HOT_COMMAND_MANAGE");
        MESSAGE_NAMES.put(32, "SET_DEBUG_MODE");
        MESSAGE_NAMES.put(34, "DEBUG_SKU");
        MESSAGE_NAMES.put(36, "DEBUG_GET_VERSION");
        MESSAGE_NAMES.put(38, "DEBUG_GET_ALL_DATA");
        MESSAGE_NAMES.put(45, "TOUCH_ON_BUDS");
        MESSAGE_NAMES.put(64, "USAGE_REPORT");
        MESSAGE_NAMES.put(65, "METERING_REPORT");
        MESSAGE_NAMES.put(71, "USAGE_REPORT_V2");
        MESSAGE_NAMES.put(87, "STATUS_ALERT");
        MESSAGE_NAMES.put(96, "STATUS_UPDATED");
        MESSAGE_NAMES.put(97, "EXTENDED_STATUS_UPDATED");
        MESSAGE_NAMES.put(98, "CONNECTION_UPDATED");
        MESSAGE_NAMES.put(99, "VERSION_INFO");
        MESSAGE_NAMES.put(104, "VERSION_INFO_LONG");
        MESSAGE_NAMES.put(119, "NOISE_CONTROLS_UPDATE");
        MESSAGE_NAMES.put(120, "NOISE_CONTROLS");
        MESSAGE_NAMES.put(129, "AMBIENT_MODE_UPDATED");
        MESSAGE_NAMES.put(134, "EQUALIZER");
        MESSAGE_NAMES.put(135, "GAME_MODE");
        MESSAGE_NAMES.put(136, "MANAGER_INFO");
        MESSAGE_NAMES.put(145, "TOUCH_UPDATED");
        MESSAGE_NAMES.put(158, "CHECK_FIT_RESULT");
        MESSAGE_NAMES.put(163, "MUTE_STATUS_UPDATED");
        MESSAGE_NAMES.put(202, "OVERHEAT");
        MESSAGE_NAMES.put(204, "HEARING_TEST_DATA");
        MESSAGE_NAMES.put(205, "CRADLE_SERIAL_NUMBER");
        MESSAGE_NAMES.put(206, "SOC_BATTERY_CYCLE");
        MESSAGE_NAMES.put(241, "DEBUG_ERROR_CODE");
        MESSAGE_NAMES.put(242, "DEBUG_EVENT");
    }

    private BudsProtocol() {
    }

    public static String messageName(int id) {
        String name = MESSAGE_NAMES.get(id);
        return name != null ? name : "ID_" + id;
    }

    public static String hex(byte[] data) {
        StringBuilder out = new StringBuilder(data.length * 3);
        for (int i = 0; i < data.length; i++) {
            if (i > 0) out.append(' ');
            out.append(String.format(Locale.US, "%02X", data[i] & 0xFF));
        }
        return out.toString();
    }

    public static byte[] managerInfoRequest() {
        // Match GalaxyBudsClient's ManagerInfoEncoder exactly:
        // [protocol revision=1, client type=Samsung(1), Android SDK=34]
        return encodeRequest(ID_MANAGER_INFO, new byte[]{1, 1, 34});
    }

    public static byte[] debugSkuRequest() {
        return encodeRequest(ID_DEBUG_SKU, new byte[0]);
    }

    public static byte[] encodeRequest(int id, byte[] payload) {
        int size = 1 + payload.length + 2; // id + payload + CRC16
        ByteArrayOutputStream out = new ByteArrayOutputStream(size + 4);

        out.write(SOM);
        out.write(size & 0xFF);
        out.write((size >> 8) & 0xFF);
        out.write(id & 0xFF);
        out.write(payload, 0, payload.length);

        byte[] crcInput = new byte[1 + payload.length];
        crcInput[0] = (byte) id;
        System.arraycopy(payload, 0, crcInput, 1, payload.length);

        int crc = crc16Ccitt(crcInput);
        out.write(crc & 0xFF);
        out.write((crc >> 8) & 0xFF);
        out.write(EOM);

        return out.toByteArray();
    }

    private static int crc16Ccitt(byte[] bytes) {
        int crc = 0;

        for (byte value : bytes) {
            crc ^= (value & 0xFF) << 8;

            for (int bit = 0; bit < 8; bit++) {
                if ((crc & 0x8000) != 0) {
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
                } else {
                    crc = (crc << 1) & 0xFFFF;
                }
            }
        }

        return crc & 0xFFFF;
    }

    public static Telemetry parseTelemetry(Frame frame) {
        if (frame == null) return null;

        if (frame.id == ID_STATUS_UPDATED && frame.payload.length >= 7) {
            byte[] p = frame.payload;
            return new Telemetry(
                    p[1] & 0xFF,
                    p[2] & 0xFF,
                    batteryCase(p[6] & 0xFF),
                    placementName((p[5] >> 4) & 0x0F),
                    placementName(p[5] & 0x0F),
                    null,
                    null
            );
        }

        if (frame.id == ID_EXTENDED_STATUS_UPDATED && frame.payload.length >= 13) {
            byte[] p = frame.payload;
            return new Telemetry(
                    p[2] & 0xFF,
                    p[3] & 0xFF,
                    batteryCase(p[7] & 0xFF),
                    placementName((p[6] >> 4) & 0x0F),
                    placementName(p[6] & 0x0F),
                    noiseModeName(p[12] & 0xFF),
                    null
            );
        }

        if (frame.id == ID_VERSION_INFO_LONG && frame.payload.length >= 3) {
            String firmware = parseFirmware(frame.payload);
            return new Telemetry(-1, -1, null, null, null, null, firmware);
        }

        return null;
    }

    private static String batteryCase(int value) {
        return value == 0xFF ? "--" : value + "%";
    }

    private static String placementName(int value) {
        switch (value) {
            case 0:
                return "desconectado";
            case 1:
                return "no ouvido";
            case 2:
                return "fora do ouvido";
            case 3:
                return "no estojo";
            case 4:
                return "estojo fechado";
            default:
                return "estado " + value;
        }
    }

    private static String noiseModeName(int value) {
        switch (value) {
            case 0:
                return "Desligado";
            case 1:
                return "ANC";
            case 2:
                return "Ambiente";
            case 3:
                return "Adaptativo";
            default:
                return "Modo " + value;
        }
    }

    private static String parseFirmware(byte[] p) {
        int firstLength = p[0] & 0xFF;
        int secondLength = p[1] & 0xFF;

        if (firstLength > 0 && 2 + firstLength <= p.length) {
            String first = trimNulls(new String(
                    p, 2, firstLength, StandardCharsets.US_ASCII
            ));
            if (!first.isEmpty()) return first;
        }

        int secondStart = 2 + firstLength;
        if (secondLength > 0 && secondStart + secondLength <= p.length) {
            return trimNulls(new String(
                    p, secondStart, secondLength, StandardCharsets.US_ASCII
            ));
        }

        return "";
    }

    private static String trimNulls(String value) {
        int zero = value.indexOf('\0');
        String out = zero >= 0 ? value.substring(0, zero) : value;
        return out.trim();
    }

    public static final class Telemetry {
        public final int batteryL;
        public final int batteryR;
        public final String batteryCase;
        public final String placementL;
        public final String placementR;
        public final String noiseMode;
        public final String firmware;

        Telemetry(
                int batteryL,
                int batteryR,
                String batteryCase,
                String placementL,
                String placementR,
                String noiseMode,
                String firmware
        ) {
            this.batteryL = batteryL;
            this.batteryR = batteryR;
            this.batteryCase = batteryCase;
            this.placementL = placementL;
            this.placementR = placementR;
            this.noiseMode = noiseMode;
            this.firmware = firmware;
        }
    }

    public static final class Frame {
        public final int header;
        public final int id;
        public final byte[] payload;
        public final byte[] raw;

        Frame(int header, int id, byte[] payload, byte[] raw) {
            this.header = header;
            this.id = id;
            this.payload = payload;
            this.raw = raw;
        }

        public String summary() {
            if (id == 205) {
                return messageName(id)
                        + " | id=" + id
                        + " | payload=" + payload.length + " B"
                        + " | dado identificador ocultado";
            }

            return messageName(id)
                    + " | id=" + id
                    + " | payload=" + payload.length + " B"
                    + " | hdr=0x" + String.format(Locale.US, "%04X", header)
                    + "\n" + hex(payload);
        }
    }

    public static final class StreamDecoder {
        private static final int MAX_BUFFER = 16 * 1024;
        private final ByteArrayOutputStream pending = new ByteArrayOutputStream();

        public synchronized List<Frame> feed(byte[] data, int length) {
            if (data == null || length <= 0) return new ArrayList<>();

            pending.write(data, 0, Math.min(length, data.length));
            byte[] bytes = pending.toByteArray();
            List<Frame> frames = new ArrayList<>();

            int cursor = 0;
            int consumed = 0;

            while (cursor < bytes.length) {
                int start = find(bytes, cursor, SOM);

                if (start < 0) {
                    consumed = bytes.length;
                    break;
                }

                if (bytes.length - start < 4) {
                    consumed = start;
                    break;
                }

                int header = (bytes[start + 1] & 0xFF)
                        | ((bytes[start + 2] & 0xFF) << 8);
                int size = header & 0x03FF;

                if (size < 3 || size > 1023) {
                    cursor = start + 1;
                    consumed = cursor;
                    continue;
                }

                int total = size + 4;
                if (bytes.length - start < total) {
                    consumed = start;
                    break;
                }

                int end = start + total - 1;
                if ((bytes[end] & 0xFF) != EOM) {
                    cursor = start + 1;
                    consumed = cursor;
                    continue;
                }

                int id = bytes[start + 3] & 0xFF;
                int payloadLength = size - 3;

                byte[] payload = payloadLength == 0
                        ? new byte[0]
                        : Arrays.copyOfRange(
                                bytes,
                                start + 4,
                                start + 4 + payloadLength
                        );

                byte[] raw = Arrays.copyOfRange(bytes, start, start + total);
                frames.add(new Frame(header, id, payload, raw));

                cursor = start + total;
                consumed = cursor;
            }

            pending.reset();
            if (consumed < bytes.length) {
                pending.write(bytes, consumed, bytes.length - consumed);
            }

            if (pending.size() > MAX_BUFFER) {
                pending.reset();
            }

            return frames;
        }

        private int find(byte[] data, int from, int value) {
            for (int i = Math.max(0, from); i < data.length; i++) {
                if ((data[i] & 0xFF) == value) return i;
            }
            return -1;
        }
    }
}
