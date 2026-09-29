package com.k410sh4.budslab;

import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

public final class BudsConnection {
    public interface Callback {
        void onStatus(String text);
        void onPacket(BudsProtocol.Frame frame);
        void onRawChunk(byte[] bytes);
    }

    private final BluetoothDevice device;
    private final Callback callback;

    private volatile boolean running;
    private volatile BluetoothSocket socket;
    private Thread worker;

    public BudsConnection(BluetoothDevice device, Callback callback) {
        this.device = device;
        this.callback = callback;
    }

    public synchronized void connect() {
        if (worker != null && worker.isAlive()) {
            callback.onStatus("Já existe uma tentativa/conexão em andamento.");
            return;
        }

        worker = new Thread(this::runConnection, "BudsLab-RFCOMM");
        worker.start();
    }

    private void runConnection() {
        callback.onStatus("Abrindo RFCOMM Samsung...");

        try {
            BluetoothSocket newSocket =
                    device.createRfcommSocketToServiceRecord(BudsProtocol.SPP_NEW_UUID);
            socket = newSocket;
            newSocket.connect();

            running = true;
            callback.onStatus("SPP conectado. Escutando pacotes do Buds Core...");
            readLoop(newSocket.getInputStream());

        } catch (SecurityException e) {
            callback.onStatus("Permissão Bluetooth negada: " + safeMessage(e));
        } catch (IOException e) {
            if (running) {
                callback.onStatus("Conexão encerrada: " + safeMessage(e));
            } else {
                callback.onStatus("Falha ao conectar ao SPP: " + safeMessage(e));
            }
        } finally {
            running = false;
            closeSocket();
        }
    }

    private void readLoop(InputStream input) throws IOException {
        byte[] chunk = new byte[1024];
        BudsProtocol.StreamDecoder decoder = new BudsProtocol.StreamDecoder();

        while (running) {
            int count = input.read(chunk);
            if (count < 0) break;
            if (count == 0) continue;

            byte[] exact = new byte[count];
            System.arraycopy(chunk, 0, exact, 0, count);
            callback.onRawChunk(exact);

            List<BudsProtocol.Frame> frames = decoder.feed(exact, exact.length);
            for (BudsProtocol.Frame frame : frames) {
                callback.onPacket(frame);
            }
        }
    }

    public synchronized void disconnect() {
        boolean wasRunning = running;
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
        String m = t.getMessage();
        return m == null || m.trim().isEmpty()
                ? t.getClass().getSimpleName()
                : m;
    }
}
