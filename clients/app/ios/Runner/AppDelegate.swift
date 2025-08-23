import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // Auth0 URL handling
  override func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    if let urlComponents = URLComponents(url: url, resolvingAgainstBaseURL: false),
       let scheme = urlComponents.scheme,
       scheme.hasSuffix(".auth0") {
      // This is an Auth0 callback, let Auth0 handle it
      return super.application(app, open: url, options: options)
    }
    return super.application(app, open: url, options: options)
  }
}
