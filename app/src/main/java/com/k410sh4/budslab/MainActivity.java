package com.k410sh4.budslab;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Bundle;
import android.text.method.ScrollingMovementMethod;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity implements BudsConnection.Callback {
    private static final int REQUEST_BLUETOOTH_PERMISSIONS = 410;
    private static final int MAX_LOG_CHARS = 60_000;

    private BluetoothAdapter bluetoothAdapter;
    private final List<BluetoothDevice> pairedDevices = new ArrayList<>();

    private Spinner deviceSpinner;
    private TextView statusView;
    private TextView telemetryView;
    private TextView logView;
    private Button connectButton;

    private BudsConnection connection;
    private volatile boolean sppConnected;

    private String batteryL = "--";
    private String batteryR = "--";
    private String batteryCase = "--";
    private String placementL = "--";
    private String placementR = "--";
    private String noiseMode = "--";
    private String firmware = "--";

    private final SimpleDateFormat clock =
            new SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        setContentView(buildUi());

        BluetoothManager manager =
                (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        bluetoothAdapter = manager != null ? manager.getAdapter() : null;

        if (bluetoothAdapter == null) {
            setStatus("Este celular não possui Bluetooth compatível.");
            connectButton.setEnabled(false);
            return;
        }

        ensureBluetoothPermissions();
    }

    private View buildUi() {
        int pad = dp(16);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText("BudsLab — SM-R410");
        title.setTextSize(24f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText(
                "V0.3: telemetria do Galaxy Buds Core via Samsung SPP, "
                        + "com handshake de sessão e sem comandos destrutivos."
        );
        subtitle.setTextSize(14f);
        subtitle.setPadding(0, dp(6), 0, dp(14));
        root.addView(subtitle);

        deviceSpinner = new Spinner(this);
        root.addView(deviceSpinner, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        LinearLayout row1 = horizontalRow();

        Button refreshButton = new Button(this);
        refreshButton.setText("Atualizar pareados");
        refreshButton.setOnClickListener(v -> refreshPairedDevices());
        row1.addView(refreshButton, weighted());

        connectButton = new Button(this);
        connectButton.setText("Conectar SPP");
        connectButton.setOnClickListener(v -> toggleConnection());
        row1.addView(connectButton, weighted());

        root.addView(row1);

        statusView = new TextView(this);
        statusView.setText("Status: inicializando...");
        statusView.setTypeface(Typeface.DEFAULT_BOLD);
        statusView.setPadding(0, dp(10), 0, dp(6));
        root.addView(statusView);

        telemetryView = new TextView(this);
        telemetryView.setTypeface(Typeface.MONOSPACE);
        telemetryView.setTextSize(14f);
        telemetryView.setPadding(dp(8), dp(8), dp(8), dp(8));
        renderTelemetry();
        root.addView(telemetryView);

        LinearLayout row2 = horizontalRow();

        Button tone500 = new Button(this);
        tone500.setText("Tom 500 Hz");
        tone500.setOnClickListener(v -> playTone(500.0));
        row2.addView(tone500, weighted());

        Button tone1000 = new Button(this);
        tone1000.setText("Tom 1 kHz");
        tone1000.setOnClickListener(v -> playTone(1000.0));
        row2.addView(tone1000, weighted());

        root.addView(row2);

        LinearLayout row3 = horizontalRow();

        Button copyButton = new Button(this);
        copyButton.setText("Copiar log");
        copyButton.setOnClickListener(v -> copyLog());
        row3.addView(copyButton, weighted());

        Button clearButton = new Button(this);
        clearButton.setText("Limpar log");
        clearButton.setOnClickListener(v -> logView.setText(""));
        row3.addView(clearButton, weighted());

        root.addView(row3);

        TextView hint = new TextView(this);
        hint.setText(
                "Se o SPP não abrir, force a parada do Galaxy Wearable antes do teste. "
                        + "O app não envia reset, FOTA ou comandos de fábrica."
        );
        hint.setTextSize(13f);
        hint.setPadding(0, dp(8), 0, dp(8));
        root.addView(hint);

        TextView logTitle = new TextView(this);
        logTitle.setText("Log de protocolo");
        logTitle.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(logTitle);

        logView = new TextView(this);
        logView.setTextSize(12f);
        logView.setTypeface(Typeface.MONOSPACE);
        logView.setTextIsSelectable(true);
        logView.setMovementMethod(new ScrollingMovementMethod());
        logView.setPadding(dp(8), dp(8), dp(8), dp(8));

        ScrollView logScroll = new ScrollView(this);
        logScroll.addView(logView);
        LinearLayout.LayoutParams logParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
        );
        logParams.topMargin = dp(4);
        root.addView(logScroll, logParams);

        return root;
    }

    private LinearLayout horizontalRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        return row;
    }

    private LinearLayout.LayoutParams weighted() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(52), 1f);
        p.setMargins(dp(2), dp(4), dp(2), dp(4));
        return p;
    }

    private void ensureBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            List<String> missing = new ArrayList<>();

            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.BLUETOOTH_CONNECT);
            }

            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(Manifest.permission.BLUETOOTH_SCAN);
            }

            if (!missing.isEmpty()) {
                requestPermissions(
                        missing.toArray(new String[0]),
                        REQUEST_BLUETOOTH_PERMISSIONS
                );
                return;
            }
        }

        refreshPairedDevices();
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == REQUEST_BLUETOOTH_PERMISSIONS) {
            boolean granted = true;
            for (int result : grantResults) {
                granted &= result == PackageManager.PERMISSION_GRANTED;
            }

            if (granted) {
                refreshPairedDevices();
            } else {
                setStatus("Permissões de Bluetooth/Dispositivos próximos são necessárias.");
            }
        }
    }

    private boolean hasBluetoothPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;

        return checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void refreshPairedDevices() {
        if (!hasBluetoothPermissions()) {
            ensureBluetoothPermissions();
            return;
        }

        try {
            if (!bluetoothAdapter.isEnabled()) {
                setStatus("Bluetooth desligado. Ligue-o nas configurações do Android.");
                return;
            }

            Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
            pairedDevices.clear();
            pairedDevices.addAll(bonded);

            Collections.sort(pairedDevices, new Comparator<BluetoothDevice>() {
                @Override
                public int compare(BluetoothDevice a, BluetoothDevice b) {
                    String an = safeName(a);
                    String bn = safeName(b);

                    boolean aBuds = an.toLowerCase(Locale.ROOT).contains("buds");
                    boolean bBuds = bn.toLowerCase(Locale.ROOT).contains("buds");

                    if (aBuds != bBuds) return aBuds ? -1 : 1;
                    return an.compareToIgnoreCase(bn);
                }
            });

            List<String> labels = new ArrayList<>();
            for (BluetoothDevice device : pairedDevices) {
                labels.add(safeName(device));
            }

            if (labels.isEmpty()) {
                labels.add("Nenhum dispositivo pareado");
            }

            ArrayAdapter<String> adapter = new ArrayAdapter<>(
                    this,
                    android.R.layout.simple_spinner_dropdown_item,
                    labels
            );
            deviceSpinner.setAdapter(adapter);

            int likely = findLikelyBuds();
            if (likely >= 0) deviceSpinner.setSelection(likely);

            setStatus(
                    pairedDevices.isEmpty()
                            ? "Nenhum Bluetooth pareado."
                            : pairedDevices.size() + " dispositivo(s) pareado(s)."
            );

        } catch (SecurityException e) {
            setStatus("Sem permissão Bluetooth: " + safeMessage(e));
        }
    }

    private int findLikelyBuds() {
        for (int i = 0; i < pairedDevices.size(); i++) {
            String name = safeName(pairedDevices.get(i)).toLowerCase(Locale.ROOT);
            if (name.contains("buds core")
                    || name.contains("sm-r410")
                    || name.contains("galaxy buds")) {
                return i;
            }
        }
        return -1;
    }

    private void toggleConnection() {
        if (sppConnected) {
            disconnect();
            return;
        }

        if (!hasBluetoothPermissions()) {
            ensureBluetoothPermissions();
            return;
        }

        int position = deviceSpinner.getSelectedItemPosition();
        if (position < 0 || position >= pairedDevices.size()) {
            Toast.makeText(this, "Selecione um dispositivo pareado.", Toast.LENGTH_SHORT).show();
            return;
        }

        BluetoothDevice selected = pairedDevices.get(position);

        if (connection != null) {
            connection.disconnect();
        }

        appendLog(
                "CONNECT → " + safeName(selected)
                        + "\nUUID → " + BudsProtocol.SPP_NEW_UUID
        );

        connection = new BudsConnection(bluetoothAdapter, selected, this);
        connectButton.setEnabled(false);
        connection.connect();
    }

    private void disconnect() {
        sppConnected = false;
        connectButton.setText("Conectar SPP");
        connectButton.setEnabled(true);

        if (connection != null) {
            connection.disconnect();
            connection = null;
        }
    }

    @Override
    public void onStatus(String text) {
        runOnUiThread(() -> {
            String lower = text.toLowerCase(Locale.ROOT);

            if (lower.startsWith("spp conectado")) {
                sppConnected = true;
            } else if (lower.startsWith("sessão spp encerrada")
                    || lower.startsWith("falha")
                    || lower.startsWith("desconectado")) {
                sppConnected = false;
            }

            setStatus(text);
            connectButton.setEnabled(true);
            connectButton.setText(sppConnected ? "Desconectar" : "Conectar SPP");
            appendLog(text);
        });
    }

    @Override
    public void onDiagnostic(String text) {
        runOnUiThread(() -> appendLog("DIAG → " + text));
    }

    @Override
    public void onPacket(BudsProtocol.Frame frame) {
        runOnUiThread(() -> {
            applyTelemetry(frame);

            String text = "FRAME → " + frame.summary();

            if (frame.id != 205) {
                text += "\nRAW → " + BudsProtocol.hex(frame.raw);
            } else {
                text += "\nRAW → [ocultado: identificador do dispositivo]";
            }

            appendLog(text);
        });
    }

    @Override
    public void onRawChunk(byte[] bytes) {
        runOnUiThread(() -> appendLog("RX → " + bytes.length + " byte(s)"));
    }

    private void applyTelemetry(BudsProtocol.Frame frame) {
        BudsProtocol.Telemetry t = BudsProtocol.parseTelemetry(frame);
        if (t == null) return;

        if (t.batteryL >= 0) batteryL = t.batteryL + "%";
        if (t.batteryR >= 0) batteryR = t.batteryR + "%";
        if (t.batteryCase != null) batteryCase = t.batteryCase;
        if (t.placementL != null) placementL = t.placementL;
        if (t.placementR != null) placementR = t.placementR;
        if (t.noiseMode != null) noiseMode = t.noiseMode;
        if (t.firmware != null && !t.firmware.isEmpty()) firmware = t.firmware;

        renderTelemetry();
    }

    private void renderTelemetry() {
        if (telemetryView == null) return;

        telemetryView.setText(
                "L: " + batteryL + "  [" + placementL + "]\n"
                        + "R: " + batteryR + "  [" + placementR + "]\n"
                        + "Estojo: " + batteryCase + "\n"
                        + "Ruído: " + noiseMode + "\n"
                        + "Firmware: " + firmware
        );
    }

    private void playTone(double frequency) {
        Toast.makeText(
                this,
                "Reproduzindo " + (int) frequency + " Hz por 1,5 s",
                Toast.LENGTH_SHORT
        ).show();

        TonePlayer.play(frequency, 1500, 0.08f);
        appendLog("AUDIO → " + (int) frequency + " Hz / 1,5 s / amplitude 0,08");
    }

    private void copyLog() {
        ClipboardManager clipboard =
                (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) return;

        clipboard.setPrimaryClip(
                ClipData.newPlainText("BudsLab log", logView.getText())
        );
        Toast.makeText(this, "Log copiado.", Toast.LENGTH_SHORT).show();
    }

    private void setStatus(String text) {
        statusView.setText("Status: " + text);
    }

    private void appendLog(String text) {
        String entry = "[" + clock.format(new Date()) + "] " + text + "\n\n";
        CharSequence old = logView.getText();
        String combined = old + entry;

        if (combined.length() > MAX_LOG_CHARS) {
            combined = combined.substring(combined.length() - MAX_LOG_CHARS);
        }

        logView.setText(combined);

        View parent = (View) logView.getParent();
        if (parent instanceof ScrollView) {
            parent.post(() -> ((ScrollView) parent).fullScroll(View.FOCUS_DOWN));
        }
    }

    private String safeName(BluetoothDevice device) {
        try {
            String name = device.getName();
            return name == null || name.trim().isEmpty()
                    ? "Bluetooth sem nome"
                    : name;
        } catch (SecurityException e) {
            return "Bluetooth";
        }
    }

    private static String safeMessage(Throwable t) {
        String m = t.getMessage();
        return m == null || m.trim().isEmpty()
                ? t.getClass().getSimpleName()
                : m;
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    @Override
    protected void onDestroy() {
        disconnect();
        super.onDestroy();
    }

    private static final class TonePlayer {
        private static void play(
                double frequencyHz,
                int durationMs,
                float amplitude
        ) {
            new Thread(() -> {
                final int sampleRate = 48_000;
                int frames = Math.max(1, sampleRate * durationMs / 1000);
                short[] pcm = new short[frames * 2];

                double phaseStep = 2.0 * Math.PI * frequencyHz / sampleRate;
                double phase = 0.0;
                double amp = Math.max(0.0, Math.min(0.2, amplitude));

                for (int frame = 0; frame < frames; frame++) {
                    short sample = (short) (
                            Math.sin(phase) * amp * Short.MAX_VALUE
                    );
                    phase += phaseStep;

                    pcm[frame * 2] = sample;
                    pcm[frame * 2 + 1] = sample;
                }

                AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();

                AudioFormat format = new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                        .build();

                AudioTrack track = null;
                try {
                    track = new AudioTrack(
                            attributes,
                            format,
                            pcm.length * 2,
                            AudioTrack.MODE_STATIC,
                            AudioManager.AUDIO_SESSION_ID_GENERATE
                    );
                    track.write(pcm, 0, pcm.length);
                    track.play();
                    Thread.sleep(durationMs + 120L);
                } catch (Exception ignored) {
                } finally {
                    if (track != null) {
                        try {
                            track.stop();
                        } catch (Exception ignored) {
                        }
                        track.release();
                    }
                }
            }, "BudsLab-Tone").start();
        }
    }
}
