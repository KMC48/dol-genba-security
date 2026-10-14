package jp.kmccreativelab.dolgenba;

import android.os.Bundle;
import android.os.SystemClock;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Missing/failed JS must not fall through to Activity finish or WebView history.
    private static final String BACK_SCRIPT = "(function(){try{return typeof window.handleAndroidBack === 'function' ? window.handleAndroidBack() : 'handled';}catch(e){return 'handled';}})()";
    private boolean backRequestInFlight;
    private long lastBackAt = -350;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                long now = SystemClock.elapsedRealtime();
                // A double tap must not immediately undo the pause or skip a screen.
                if (backRequestInFlight || now - lastBackAt < 350) return;
                if (bridge == null || bridge.getWebView() == null) return;
                lastBackAt = now;
                backRequestInFlight = true;
                bridge.getWebView().evaluateJavascript(BACK_SCRIPT, result -> {
                    backRequestInFlight = false;
                    if (!isFinishing() && !isDestroyed() && "\"background\"".equals(result)) {
                        // Match root-screen Back: keep the task and saved records intact.
                        moveTaskToBack(true);
                    }
                });
            }
        });
    }
}
