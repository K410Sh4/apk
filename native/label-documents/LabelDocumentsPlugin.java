package com.k410sh4.appspace;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** User-controlled SAF access; no storage permission and no silent writes. */
@CapacitorPlugin(name = "LabelDocuments")
public class LabelDocumentsPlugin extends Plugin {
  private static final int MAX_OPEN = 3 * 1024 * 1024;
  private static final int MAX_SAVE = 16 * 1024 * 1024;

  @PluginMethod
  public void saveDocument(PluginCall call) {
    String filename = call.getString("filename");
    String mime = call.getString("mimeType");
    String encoded = call.getString("base64");
    if (filename == null || filename.length() < 1 || filename.length() > 100 ||
        !filename.matches("[A-Za-z0-9_.-]+") || mime == null ||
        !mime.matches("[a-zA-Z0-9.+_-]+/[a-zA-Z0-9.+_-]+") ||
        encoded == null || encoded.length() > MAX_SAVE * 4 / 3 + 32) {
      call.reject("Arquivo ou tipo inválido para salvar.");
      return;
    }
    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mime);
    intent.putExtra(Intent.EXTRA_TITLE, filename);
    startActivityForResult(call, intent, "saveDocumentResult");
  }

  @ActivityCallback
  private void saveDocumentResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    Uri uri = result.getData() == null ? null : result.getData().getData();
    if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
      JSObject response = new JSObject();
      response.put("saved", false);
      call.resolve(response);
      return;
    }
    try {
      byte[] content = Base64.decode(call.getString("base64"), Base64.DEFAULT);
      if (content.length > MAX_SAVE) throw new IllegalArgumentException("Arquivo grande demais.");
      try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
        if (output == null) throw new IllegalStateException("Destino indisponível.");
        output.write(content);
        output.flush();
      }
      JSObject response = new JSObject();
      response.put("saved", true);
      response.put("uri", uri.toString());
      call.resolve(response);
    } catch (Exception error) {
      call.reject("Não foi possível gravar o documento: " + error.getMessage());
    }
  }

  @PluginMethod
  public void openDocument(PluginCall call) {
    String mime = call.getString("mimeType", "*/*");
    if (!mime.matches("[a-zA-Z0-9.+_*-]+/[a-zA-Z0-9.+_*-]+")) {
      call.reject("Tipo de documento inválido.");
      return;
    }
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mime);
    if (mime.equals("*/*"))intent.putExtra(Intent.EXTRA_MIME_TYPES,
      new String[] {"application/json","text/csv","text/plain"});
    startActivityForResult(call, intent, "openDocumentResult");
  }

  @ActivityCallback
  private void openDocumentResult(PluginCall call, ActivityResult result) {
    if (call == null) return;
    Uri uri = result.getData() == null ? null : result.getData().getData();
    if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
      JSObject response = new JSObject();
      response.put("selected", false);
      call.resolve(response);
      return;
    }
    try (InputStream input = getContext().getContentResolver().openInputStream(uri);
         ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      if (input == null) throw new IllegalStateException("Arquivo indisponível.");
      byte[] buffer = new byte[8192];
      int n;
      while ((n = input.read(buffer)) != -1) {
        if (output.size() + n > MAX_OPEN) throw new IllegalArgumentException("Documento maior que 3 MB.");
        output.write(buffer, 0, n);
      }
      String name = "documento";
      try (Cursor cursor = getContext().getContentResolver().query(uri,
          new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
        if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
      }
      JSObject response = new JSObject();
      response.put("selected", true);
      response.put("name", name);
      response.put("mimeType", getContext().getContentResolver().getType(uri));
      response.put("base64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
      call.resolve(response);
    } catch (Exception error) {
      call.reject("Não foi possível abrir o documento: " + error.getMessage());
    }
  }
}
