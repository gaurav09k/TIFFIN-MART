package com.tiffinmart.customer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import com.razorpay.Razorpay;

public class MainActivity extends Activity {
    private static final String URL = "https://tiffin-mart-production.up.railway.app/";

    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorBox;
    private Razorpay razorpay;
    private String razorpayKey;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.webview);
        progress = findViewById(R.id.progress);
        errorBox = findViewById(R.id.errorBox);
        Button retry = findViewById(R.id.retry);
        retry.setOnClickListener(v -> load());

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " TiffinMartAndroid/1.2");

        web.addJavascriptInterface(new RazorpayBridge(), "TiffinMartRazorpayBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
                errorBox.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                installRazorpayBridge();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    progress.setVisibility(View.GONE);
                    errorBox.setVisibility(View.VISIBLE);
                }
            }
        });

        load();
    }

    /**
     * The website uses the normal Razorpay Web Checkout. In Android WebView,
     * Razorpay's native SDK must be connected to that WebView to enable UPI
     * Intent. The SDK then handles the UPI app launch and onActivityResult.
     */
    private void installRazorpayBridge() {
        String js = "(function(){try{" +
                "var R=window.Razorpay;" +
                "if(!R||R.__tmNativeWrapped)return;" +
                "function T(options){" +
                "try{if(options&&options.key&&window.TiffinMartRazorpayBridge)" +
                "window.TiffinMartRazorpayBridge.setKey(String(options.key));}catch(e){}" +
                "return new R(options);" +
                "}" +
                "T.prototype=R.prototype;" +
                "try{Object.setPrototypeOf(T,R);}catch(e){}" +
                "T.__tmNativeWrapped=true;" +
                "window.Razorpay=T;" +
                "}catch(e){}})();";
        web.evaluateJavascript(js, null);
    }

    private final class RazorpayBridge {
        @JavascriptInterface
        public void setKey(String key) {
            if (key == null || key.trim().isEmpty()) return;
            final String cleanKey = key.trim();
            runOnUiThread(() -> {
                if (cleanKey.equals(razorpayKey) && razorpay != null) return;
                try {
                    razorpayKey = cleanKey;
                    // This exact constructor is the Razorpay-supported WebView
                    // integration for UPI Intent.
                    razorpay = new Razorpay(cleanKey, web, MainActivity.this);
                } catch (Exception e) {
                    razorpay = null;
                    Toast.makeText(MainActivity.this,
                            "Payment setup failed. Please try again.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (razorpay != null && requestCode == Razorpay.UPI_INTENT_REQUEST_CODE) {
            razorpay.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void load() {
        errorBox.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        web.loadUrl(URL);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.removeJavascriptInterface("TiffinMartRazorpayBridge");
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }
}
