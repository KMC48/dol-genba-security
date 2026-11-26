import UIKit
import Capacitor
import UnityAds
import AppTrackingTransparency

/// Minimal bridge for one Unity Ads interstitial placement (iOS twin of android/.../UnityAdsPlugin.java).
/// The game must keep working when ads are not configured, not loaded, or fail:
/// every call resolves (never rejects) with {shown, reason}.
@objc(UnityAdsPlugin)
public class UnityAdsPlugin: CAPPlugin, CAPBridgedPlugin, UnityAdsInitializationDelegate, UnityAdsLoadDelegate {
    public let identifier = "UnityAdsPlugin"
    public let jsName = "UnityAdsBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "showInterstitial", returnType: CAPPluginReturnPromise)
    ]

    private var gameId = ""
    private var placementId = ""
    private var initialized = false
    private var loading = false
    private var ready = false
    private var showing = false
    private var showHandler: ShowHandler?

    override public func load() {
        gameId = (Bundle.main.object(forInfoDictionaryKey: "UnityAdsGameId") as? String ?? "").trimmingCharacters(in: .whitespaces)
        placementId = (Bundle.main.object(forInfoDictionaryKey: "UnityAdsInterstitialPlacement") as? String ?? "").trimmingCharacters(in: .whitespaces)
        // Not configured: no tracking prompt, no SDK start; showInterstitial answers not_initialized.
        if gameId.isEmpty || placementId.isEmpty { return }
        DispatchQueue.main.async { self.startWhenTitleIsShown() }
    }

    // The tracking prompt must not appear at launch: wait until the app is active and the web page
    // (whose first screen is the title) has finished loading, then ask once. Unity Ads starts
    // afterwards whatever the answer; without permission it serves non-personalized ads.
    private func startWhenTitleIsShown() {
        let titleShown = UIApplication.shared.applicationState == .active && bridge?.webView?.isLoading == false
        if !titleShown {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.startWhenTitleIsShown() }
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            if ATTrackingManager.trackingAuthorizationStatus == .notDetermined {
                ATTrackingManager.requestTrackingAuthorization { _ in
                    DispatchQueue.main.async { self.initializeAds() }
                }
            } else {
                self.initializeAds()
            }
        }
    }

    private func initializeAds() {
        #if DEBUG
        let testMode = true  // Debug builds request Unity test ads so development never earns from real impressions.
        #else
        let testMode = false
        #endif
        UnityAds.initialize(gameId, testMode: testMode, initializationDelegate: self)
    }

    public func initializationComplete() {
        DispatchQueue.main.async {
            self.initialized = true
            self.loadInterstitial()
        }
    }

    public func initializationFailed(_ error: UnityAdsInitializationError, withMessage message: String) {
        DispatchQueue.main.async { self.initialized = false }
    }

    private func loadInterstitial() {
        if !initialized || loading || ready { return }
        loading = true
        UnityAds.load(placementId, loadDelegate: self)
    }

    public func unityAdsAdLoaded(_ placementId: String) {
        DispatchQueue.main.async {
            self.loading = false
            self.ready = true
        }
    }

    public func unityAdsAdFailed(toLoad placementId: String, withError error: UnityAdsLoadError, withMessage message: String) {
        DispatchQueue.main.async {
            self.loading = false
            self.ready = false
        }
    }

    @objc func showInterstitial(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.initialized else {
                Self.resolve(call, shown: false, reason: "not_initialized")
                return
            }
            guard self.ready, !self.showing, let viewController = self.bridge?.viewController else {
                let reason = self.showing ? "busy" : "not_ready"
                self.loadInterstitial()
                Self.resolve(call, shown: false, reason: reason)
                return
            }
            self.ready = false
            self.showing = true
            let handler = ShowHandler { [weak self] shown, reason in
                guard let self = self else {
                    Self.resolve(call, shown: shown, reason: reason)
                    return
                }
                self.showing = false
                self.showHandler = nil
                self.loadInterstitial()
                self.answerWhenVisible(viewController) { Self.resolve(call, shown: shown, reason: reason) }
            }
            self.showHandler = handler
            UnityAds.show(viewController, placementId: self.placementId, showDelegate: handler)
        }
    }

    // Unity reports completion while its end card can still cover the app. The JS side starts timed play
    // as soon as it gets the answer, so hold the answer until the ad screen is fully dismissed and the
    // app is active again (it may have left for the App Store after an ad tap).
    private func answerWhenVisible(_ viewController: UIViewController, _ answer: @escaping () -> Void) {
        let visible = viewController.presentedViewController == nil && UIApplication.shared.applicationState == .active
        if visible {
            answer()
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.answerWhenVisible(viewController, answer) }
        }
    }

    private static func resolve(_ call: CAPPluginCall, shown: Bool, reason: String) {
        call.resolve(["shown": shown, "reason": reason])
    }
}

/// One show request. Settles exactly once on completion or failure.
private final class ShowHandler: NSObject, UnityAdsShowDelegate {
    private let done: (Bool, String) -> Void
    private var settled = false

    init(done: @escaping (Bool, String) -> Void) {
        self.done = done
    }

    private func finish(_ shown: Bool, _ reason: String) {
        DispatchQueue.main.async {
            if self.settled { return }
            self.settled = true
            self.done(shown, reason)
        }
    }

    func unityAdsShowComplete(_ placementId: String, withFinish state: UnityAdsShowCompletionState) {
        finish(true, state == .showCompletionStateSkipped ? "skipped" : "completed")
    }

    func unityAdsShowFailed(_ placementId: String, withError error: UnityAdsShowError, withMessage message: String) {
        finish(false, "show_failed")
    }

    func unityAdsShowStart(_ placementId: String) {}

    func unityAdsShowClick(_ placementId: String) {}
}
