package com.k410sh4.budslab;

import java.io.ByteArrayOutputStream;
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

    private static final Map<Integer, String> MESSAGE_NAMES = new HashMap<>();

    static {
        MESSAGE_NAMES.put(15, "HOT_COMMAND_MANAGE");
        MESSAGE_NAMES.put(32, "SET_DEBUG_MODE");
        MESSAGE_NAMES.put(34, "DEBUG_SKU");
        MESSAGE_NAMES.put(36, "DEBUG_GET_VERSION");
        MESSAGE_NAMES.put(38, "DEBUG_GET_ALL_DATA");
        MESSAGE_NAMES.put(45, "TOUCH_ON_BUDS");
        MESSAGE_NAMES.put(64, "USAGE_REPORT");
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
        MESSAGE_NAMES.put(145, "TOUCH_UPDATED");
        MESSAGE_NAMES.put(158, "CHECK_FIT_RESULT");
        MESSAGE_NAMES.put(163, "MUTE_STATUS_UPDATED");
        MESSAGE_NAMES.put(202, "OVERHEAT");
        MESSAGE_NAMES.put(204, "HEARING_TEST_DATA");
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
