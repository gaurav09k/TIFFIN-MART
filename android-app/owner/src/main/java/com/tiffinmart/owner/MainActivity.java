package com.tiffinmart.owner;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    private static final String URL = "https://tiffin-mart-production.up.railway.app/owner.html";
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorBox;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.webview);
        progress = findViewById(R.id.progress);
        errorBox = findViewById(R.id.errorBox);
        ((Button)findViewById(R.id.retry)).setOnClickListener(v -> load());

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " TiffinMartOwnerAndroid/1.1");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView v, String u, Bitmap f) { progress.setVisibility(View.VISIBLE); errorBox.setVisibility(View.GONE); }
            @Override public void onPageFinished(WebView v, String u) { progress.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) { if (r.isForMainFrame()) { progress.setVisibility(View.GONE); errorBox.setVisibility(View.VISIBLE); } }
        });
        load();
    }

    private void load() {
        errorBox.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        web.loadUrl(URL);
    }

    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
