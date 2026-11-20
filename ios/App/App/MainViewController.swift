import UIKit
import Capacitor

/// Registers the app's local Capacitor plugins (they are not npm packages, so cap sync does not list them).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(UnityAdsPlugin())
    }
}
