package com.k410sh4.budslab;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.ParcelUuid;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.Locale;

public final class BudsConnection {
    public interface Callback {
        void onStatus(String text);
        void onDiagnostic(String text);
        void onPacket(BudsProtocol.Frame frame);
        void onRawChunk(byte[] bytes);
    }

    private final BluetoothAdapter adapter;
    private final BluetoothDevice device;
    private final Callback callback;

    private volatile boolean running;
    private volatile boolean disconnectRequested;
    private volatile BluetoothSocket socket;
    private Thread worker;

    public BudsConnection(
            BluetoothAdapter adapter,
            BluetoothDevice device,
            Callback callback
    ) {
        this.adapter = adapter;
        this.device = device;
        this.callback = callback;
    }

    public synchronized void connect() {
        if (worker != null && worker.isAlive()) {
            callback.onStatus("Já existe uma tentativa/conexão em andamento.");
            return;
        }

        disconnectRequested = false;
        worker = new Thread(this::runConnection, "BudsLab-RFCOMM");
        worker.start();
    }

    private void runConnection() {
        callback.onStatus("Preparando RFCOMM Samsung...");

        try {
            dumpCachedUuids();
            cancelDiscoveryIfPossible();

            IOException secureFailure = null;

            callback.onDiagnostic(
                    "Tentativa 1/2: RFCOMM seguro → " + BudsProtocol.SPP_NEW_UUID
            );

            try {
                BluetoothSocket secure =
                        device.createRfcommSocketToServiceRecord(BudsProtocol.SPP_NEW_UUID);
                openAndRun(secure, "secure");
                return;
            } catch (IOException e) {
                secureFailure = e;
                closeSocket();
                callback.onDiagnostic("RFCOMM seguro falhou antes da sessão: " + safeMessage(e));
            }

            if (disconnectRequested) return;

            callback.onDiagnostic(
                    "Tentativa 2/2: RFCOMM inseguro → " + BudsProtocol.SPP_NEW_UUID
            );

            try {
                BluetoothSocket insecure =
                        device.createInsecureRfcommSocketToServiceRecord(
                                BudsProtocol.SPP_NEW_UUID
                        );
                openAndRun(insecure, "insecure");
            } catch (IOException e) {
                closeSocket();
                callback.onStatus(
                        "Falha ao abrir o SPP. "
                                + "Secure: " + safeMessage(secureFailure)
                                + " | Insecure: " + safeMessage(e)
                );
            }

        } catch (SecurityException e) {
            callback.onStatus("Permissão Bluetooth negada: " + safeMessage(e));
        } finally {
            running = false;
            closeSocket();
        }
    }

    private void openAndRun(BluetoothSocket candidate, String mode) throws IOException {
        socket = candidate;
        callback.onStatus("Abrindo RFCOMM Samsung (" + mode + ")...");

        candidate.connect();

        running = true;
        callback.onStatus(
                "SPP conectado via " + mode + ". Escutando pacotes do Buds Core..."
        );

        try {
            sessionLoop(candidate.getInputStream(), candidate.getOutputStream());
            if (!disconnectRequested) {
                callback.onStatus(
                        "Sessão SPP encerrada pelo dispositivo. A conexão chegou a funcionar."
                );
            }
        } catch (IOException e) {
            if (!disconnectRequested) {
                callback.onStatus(
                        "Sessão SPP encerrada após conectar: " + safeMessage(e)
                );
            }
        } finally {
            running = false;
        }
    }

    private void sessionLoop(InputStream input, OutputStream output) throws IOException {
        byte[] chunk = new byte[1024];
        BudsProtocol.StreamDecoder decoder = new BudsProtocol.StreamDecoder();
        boolean managerInfoSent = false;

        while (running && !disconnectRequested) {
            int count = input.read(chunk);
            if (count < 0) {
                callback.onDiagnostic("InputStream retornou EOF.");
                break;
            }
            if (count == 0) continue;

            byte[] exact = new byte[count];
            System.arraycopy(chunk, 0, exact, 0, count);
            callback.onRawChunk(exact);

            List<BudsProtocol.Frame> frames = decoder.feed(exact, exact.length);
            for (BudsProtocol.Frame frame : frames) {
                callback.onPacket(frame);

                if (!managerInfoSent
                        && frame.id == BudsProtocol.ID_EXTENDED_STATUS_UPDATED) {
                    byte[] managerInfo = BudsProtocol.managerInfoRequest();
                    output.write(managerInfo);
                    output.flush();
                    managerInfoSent = true;
                    callback.onDiagnostic(
                            "TX MANAGER_INFO enviado para manter a sessão ativa."
                    );
                }
            }
        }
    }

    private void cancelDiscoveryIfPossible() {
        if (adapter == null) return;

        try {
            if (adapter.isDiscovering()) {
                callback.onDiagnostic(
                        "Bluetooth discovery estava ativo; cancelando antes do RFCOMM."
                );
                adapter.cancelDiscovery();
            }
        } catch (SecurityException e) {
            callback.onDiagnostic(
                    "Sem permissão para consultar/cancelar discovery: " + safeMessage(e)
            );
        }
    }

    private void dumpCachedUuids() {
        try {
            ParcelUuid[] uuids = device.getUuids();

            if (uuids == null || uuids.length == 0) {
                callback.onDiagnostic(
                        "UUIDs SDP em cache: nenhum. O Android pode resolver os serviços durante connect()."
                );
                return;
            }

            boolean expected = false;
            StringBuilder text = new StringBuilder("UUIDs SDP em cache:");

            for (ParcelUuid uuid : uuids) {
                if (uuid == null || uuid.getUuid() == null) continue;

                String value = uuid.getUuid().toString().toLowerCase(Locale.ROOT);
                text.append("\n• ").append(value);

                if (BudsProtocol.SPP_NEW_UUID.toString().equalsIgnoreCase(value)) {
                    expected = true;
                }
            }

            text.append(
                    expected
                            ? "\n✓ Serviço Samsung SPP_NEW está anunciado no cache."
                            : "\n! SPP_NEW não apareceu no cache SDP atual."
            );

            callback.onDiagnostic(text.toString());

        } catch (SecurityException e) {
            callback.onDiagnostic(
                    "Não foi possível ler UUIDs SDP: " + safeMessage(e)
            );
        }
    }

    public synchronized void disconnect() {
        boolean wasRunning = running;
        disconnectRequested = true;
        running = false;
        closeSocket();

        if (wasRunning) {
            callback.onStatus("Desconectado.");
        }
    }

    private void closeSocket() {
        BluetoothSocket current = socket;
        socket = null;

        if (current != null) {
            try {
                current.close();
            } catch (IOException ignored) {
            }
        }
    }

    private static String safeMessage(Throwable t) {
        if (t == null) return "erro desconhecido";

        String m = t.getMessage();
        return m == null || m.trim().isEmpty()
                ? t.getClass().getSimpleName()
                : m;
    }
}
