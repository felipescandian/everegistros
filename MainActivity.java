package com.ovt.correcao;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final String APP_URL = "https://felipescandian.github.io/fsovtregistros/";
    private static final int FILE_CHOOSER_CODE = 7001;
    private static final int AUDIO_PERMISSION_CODE = 7002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    private String incomingName = "";
    private String incomingMime = "";
    private final List<String> incomingChunks = new ArrayList<>();

    private FileOutputStream saveStream;
    private File saveFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    AUDIO_PERMISSION_CODE
            );
        }

        webView = findViewById(R.id.webview);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.startsWith(APP_URL)) {
                    view.evaluateJavascript(
                            "if(window.ovtReceiveAndroidFile){window.ovtReceiveAndroidFile();}",
                            null
                    );
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (request.getOrigin() != null
                            && request.getOrigin().toString().startsWith("https://felipescandian.github.io")) {
                        request.grant(request.getResources());
                    } else {
                        request.deny();
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallbackNew,
                    FileChooserParams fileChooserParams) {

                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = filePathCallbackNew;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "application/pdf",
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                });
                startActivityForResult(intent, FILE_CHOOSER_CODE);
                return true;
            }
        });

        prepareIncomingFile(getIntent());
        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        prepareIncomingFile(intent);

        if (webView != null) {
            webView.evaluateJavascript(
                    "if(window.ovtReceiveAndroidFile){window.ovtReceiveAndroidFile();}",
                    null
            );
        }
    }

    private void prepareIncomingFile(Intent intent) {
        if (intent == null) return;

        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }

        if (uri == null) return;

        try {
            ContentResolver cr = getContentResolver();
            incomingMime = cr.getType(uri);
            if (incomingMime == null) incomingMime = "application/octet-stream";
            incomingName = getDisplayName(uri);
            if (incomingName == null || incomingName.isEmpty()) incomingName = "registro";

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (InputStream in = cr.openInputStream(uri)) {
                if (in == null) return;
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            }

            String b64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
            incomingChunks.clear();
            int chunkSize = 60000;
            for (int i = 0; i < b64.length(); i += chunkSize) {
                incomingChunks.add(b64.substring(i, Math.min(i + chunkSize, b64.length())));
            }
        } catch (Exception e) {
            incomingChunks.clear();
        }
    }

    private String getDisplayName(Uri uri) {
        String result = null;
        try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) result = cursor.getString(idx);
            }
        }
        if (result == null) result = uri.getLastPathSegment();
        return result;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_CODE) {
            Uri[] result = null;
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(result);
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public boolean hasIncomingFile() {
            return !incomingChunks.isEmpty();
        }

        @JavascriptInterface
        public String getIncomingFileName() {
            return incomingName == null ? "" : incomingName;
        }

        @JavascriptInterface
        public String getIncomingMimeType() {
            return incomingMime == null ? "" : incomingMime;
        }

        @JavascriptInterface
        public int getIncomingChunkCount() {
            return incomingChunks.size();
        }

        @JavascriptInterface
        public String getIncomingChunk(int index) {
            if (index < 0 || index >= incomingChunks.size()) return "";
            return incomingChunks.get(index);
        }

        @JavascriptInterface
        public void clearIncomingFile() {
            incomingChunks.clear();
            incomingName = "";
            incomingMime = "";
        }

        @JavascriptInterface
        public void startFileSave(String filename) {
            try {
                cancelFileSave();
                File dir = new File(getCacheDir(), "shared");
                if (!dir.exists()) dir.mkdirs();
                String safe = filename.replaceAll("[^A-Za-z0-9._-]", "_");
                saveFile = new File(dir, safe);
                saveStream = new FileOutputStream(saveFile, false);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void appendFileChunk(String chunkBase64) {
            try {
                if (saveStream == null) return;
                byte[] bytes = Base64.decode(chunkBase64, Base64.DEFAULT);
                saveStream.write(bytes);
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void finishFileSave() {
            try {
                if (saveStream != null) {
                    saveStream.flush();
                    saveStream.close();
                    saveStream = null;
                }
                if (saveFile == null || !saveFile.exists()) return;

                runOnUiThread(() -> {
                    Uri uri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".files",
                            saveFile
                    );
                    Intent share = new Intent(Intent.ACTION_SEND);
                    share.setType("text/html");
                    share.putExtra(Intent.EXTRA_STREAM, uri);
                    share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(share, "Enviar correção OVT"));
                });
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void cancelFileSave() {
            try {
                if (saveStream != null) {
                    saveStream.close();
                    saveStream = null;
                }
            } catch (Exception ignored) {}
            if (saveFile != null && saveFile.exists()) saveFile.delete();
            saveFile = null;
        }
    }
}
