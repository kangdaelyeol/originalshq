import UIKit
import XtoolPushModule

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 신규 문의 알림 — 알림 단추로 뒤에서 깨어날 때도 응답을 받도록 시작하자마자 알림 센터를 맡는다
    XtoolPushCenter.shared.install()
    return true
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    XtoolPushCenter.shared.didRegister(deviceToken)
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    XtoolPushCenter.shared.didFail(error)
  }
}
