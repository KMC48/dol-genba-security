package jp.kmccreativelab.idoldefense;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Minimal bridge for one Unity Ads interstitial placement.
 * The game must keep working when ads are not configured, not loaded, or fail:
 * every call resolves (never rejects) with {shown, reason}.
 */
@CapacitorPlugin(name = "UnityAdsBridge")
public class UnityAdsPlugin extends Plugin {
    private String placementId;
    private volatile boolean initialized;
    private volatile boolean loading;
    private volatile boolean ready;
    private volatile boolean showing;

    @Override
    public void load() {
        String gameId = getContext().getString(R.string.unity_ads_game_id).trim();
        placementId = getContext().getString(R.string.unity_ads_interstitial_placement).trim();
        if (gameId.isEmpty() || placementId.isEmpty()) return;
        // Debuggable builds request Unity test ads so development never earns from real impressions.
        boolean testMode = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        UnityAds.initialize(getContext().getApplicationContext(), gameId, testMode, new IUnityAdsInitializationListener() {
            @Override
            public void onInitializationComplete() {
                initialized = true;
                loadInterstitial();
            }

            @Override
            public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                initialized = false;
            }
        });
    }

    private void loadInterstitial() {
        if (!initialized || loading || ready) return;
        loading = true;
        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String id) {
                loading = false;
                ready = true;
            }

            @Override
            public void onUnityAdsFailedToLoad(String id, UnityAds.UnityAdsLoadError error, String message) {
                loading = false;
                ready = false;
            }
        });
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        Activity activity = getActivity();
        if (!initialized) {
            resolve(call, false, "not_initialized");
            return;
        }
        if (!ready || showing || activity == null || activity.isFinishing()) {
            loadInterstitial();
            resolve(call, false, showing ? "busy" : "not_ready");
            return;
        }
        ready = false;
        showing = true;
        AtomicBoolean settled = new AtomicBoolean(false);
        activity.runOnUiThread(() -> UnityAds.show(activity, placementId, new UnityAdsShowOptions(), new IUnityAdsShowListener() {
            @Override
            public void onUnityAdsShowFailure(String id, UnityAds.UnityAdsShowError error, String message) {
                finish(false, "show_failed");
            }

            @Override
            public void onUnityAdsShowStart(String id) {}

            @Override
            public void onUnityAdsShowClick(String id) {}

            @Override
            public void onUnityAdsShowComplete(String id, UnityAds.UnityAdsShowCompletionState state) {
                finish(true, state == UnityAds.UnityAdsShowCompletionState.SKIPPED ? "skipped" : "completed");
            }

            private void finish(boolean shown, String reason) {
                if (!settled.compareAndSet(false, true)) return;
                showing = false;
                resolve(call, shown, reason);
                loadInterstitial();
            }
        }));
    }

    private static void resolve(PluginCall call, boolean shown, String reason) {
        JSObject result = new JSObject();
        result.put("shown", shown);
        result.put("reason", reason);
        call.resolve(result);
    }
}
