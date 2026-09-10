package com.tiffinmart.customer;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.util.Log;
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

import com.razorpay.Checkout;
import com.razorpay.PaymentResultListener;

import org.json.JSONObject;

public class MainActivity extends Activity implements PaymentResultListener {
    private static final String URL = "https://tiffin-mart-production.up.railway.app/";
    private static final String TAG = "TiffinMartPayment";

    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorBox;
    private Checkout checkout;
    private String activeOrderId;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        web = findViewById(R.id.webview);
        progress = findViewById(R.id.progress);
        errorBox = findViewById(R.id.errorBox);
        ((Button) findViewById(R.id.retry)).setOnClickListener(v -> load());

        Checkout.preload(getApplicationContext());

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
        s.setUserAgentString(s.getUserAgentString() + " TiffinMartAndroid/1.3");

        web.addJavascriptInterface(new NativePaymentBridge(), "TiffinMartNativePayment");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progress.setVisibility(View.VISIBLE); errorBox.setVisibility(View.GONE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE); installNativePaymentHook();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { progress.setVisibility(View.GONE); errorBox.setVisibility(View.VISIBLE); }
            }
        });
        load();
    }

    private void installNativePaymentHook() {
        web.evaluateJavascript("(function(){window.__tmNativePaymentAvailable=true;})();", null);
    }

    private final class NativePaymentBridge {
        @JavascriptInterface
        public void startPayment(final String optionsJson) {
            runOnUiThread(() -> {
                try {
                    JSONObject options = new JSONObject(optionsJson);
                    String key = options.optString("key", "");
                    activeOrderId = options.optString("order_id", "");
                    if (key.isEmpty() || activeOrderId.isEmpty()) throw new IllegalArgumentException("Missing Razorpay key/order id");
                    checkout = new Checkout();
                    checkout.setKeyID(key);
                    checkout.open(MainActivity.this, options);
                } catch (Exception e) {
                    Log.e(TAG, "Native checkout failed to start", e);
                    callJs("window.__tmNativePaymentFailed && window.__tmNativePaymentFailed(" + JSONObject.quote(e.getMessage() == null ? "Payment could not be started." : e.getMessage()) + ");");
                    Toast.makeText(MainActivity.this, "Payment could not be started. Please try again.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override public void onPaymentSuccess(String razorpayPaymentID) {
        callJs("window.__tmNativePaymentSuccess && window.__tmNativePaymentSuccess(" + JSONObject.quote(razorpayPaymentID == null ? "" : razorpayPaymentID) + "," + JSONObject.quote(activeOrderId == null ? "" : activeOrderId) + ");");
    }

    @Override public void onPaymentError(int code, String response) {
        callJs("window.__tmNativePaymentFailed && window.__tmNativePaymentFailed(" + JSONObject.quote(response == null || response.trim().isEmpty() ? "Payment failed or was cancelled." : response) + ");");
    }

    private void callJs(String script) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript("javascript:" + script, null); });
    }

    private void load() { errorBox.setVisibility(View.GONE); progress.setVisibility(View.VISIBLE); web.loadUrl(URL); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (web != null) { web.removeJavascriptInterface("TiffinMartNativePayment"); web.stopLoading(); web.destroy(); } super.onDestroy(); }
}
