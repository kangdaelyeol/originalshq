import Foundation
import Security
import UIKit
import UserNotifications

// 신규 문의 알림(APNs 직접) — 서버(functions-xtool tech-boards/push.ts)가 Apple로 바로 보낸 알림을 띄우고, 알림의
// "내가 맡기" 단추를 앱을 열지 않고 처리한다.
// - 시작할 때(AppDelegate) install — 알림 센터를 맡고 단추 묶음(TECH_INQUIRY)을 등록한다. 단추를 누르면 iOS가 앱을
//   뒤에서 잠깐 깨우는데, 그때도 이 객체가 응답을 받으려면 시작하자마자 맡아야 한다.
// - 단추 처리는 JS 없이 여기서 — 등록 때 받은 주소(techPushAction)에 기기 id·비밀 값·문의 id를 보내고, 서버가 준
//   결과(제목·문구)를 알림으로 띄운다. 비밀 값은 키체인, 기기 id·주소는 UserDefaults.
// - 알림 본문을 누르면 그 문의 id를 들고 있다가 JS가 takeOpened로 가져간다(켜진 채면 onOpened로 알린다).

@objc(XtoolPushCenter)
public final class XtoolPushCenter: NSObject, UNUserNotificationCenterDelegate {
  @objc public static let shared = XtoolPushCenter()

  /** 서버 알림의 aps.category와 같게 */
  static let category = "TECH_INQUIRY"
  static let claimAction = "CLAIM"

  private let lock = NSLock()
  private var waiters: [(Result<String, Error>) -> Void] = []
  private var opened: String?

  /** 앱이 켜진 채로 알림을 눌렀을 때 — JS 모듈(XtoolPush.mm)이 붙인다 */
  @objc public var onOpened: ((String) -> Void)?

  // MARK: 시작·APNs 등록 결과(AppDelegate가 넘긴다)

  @objc public func install() {
    let center = UNUserNotificationCenter.current()
    center.delegate = self
    let claim = UNNotificationAction(
      identifier: Self.claimAction,
      title: "내가 맡기 · 1차 안내",
      options: [.authenticationRequired]
    )
    let category = UNNotificationCategory(
      identifier: Self.category,
      actions: [claim],
      intentIdentifiers: [],
      options: []
    )
    center.setNotificationCategories([category])
  }

  @objc public func didRegister(_ deviceToken: Data) {
    finish(.success(deviceToken.map { String(format: "%02x", $0) }.joined()))
  }

  @objc public func didFail(_ error: Error) {
    finish(.failure(error))
  }

  private func finish(_ result: Result<String, Error>) {
    lock.lock()
    let list = waiters
    waiters = []
    lock.unlock()
    list.forEach { $0(result) }
  }

  // MARK: JS(XtoolPush.mm)

  @objc public func enable(
    _ actionUrl: String,
    resolve: @escaping (Any?) -> Void,
    reject: @escaping (String, String, Error?) -> Void
  ) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
      if let error = error {
        reject("permission", error.localizedDescription, error)
        return
      }
      guard granted else {
        resolve(nil)
        return
      }
      self.lock.lock()
      self.waiters.append { result in
        switch result {
        case .success(let token):
          Store.actionUrl = actionUrl
          resolve([
            "deviceId": Store.deviceId,
            "secret": Store.secret,
            "token": token,
            "env": Self.environment,
          ])
        case .failure(let error):
          reject("register", error.localizedDescription, error)
        }
      }
      self.lock.unlock()
      DispatchQueue.main.async {
        UIApplication.shared.registerForRemoteNotifications()
      }
    }
  }

  @objc public func disable(_ resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
    Store.actionUrl = nil
    Store.resetSecret()
    resolve(nil)
  }

  @objc public func takeOpened(_ resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
    lock.lock()
    let itemId = opened
    opened = nil
    lock.unlock()
    resolve(itemId)
  }

  @objc public func permission(_ resolve: @escaping (Any?) -> Void, reject: @escaping (String, String, Error?) -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .authorized, .provisional, .ephemeral:
        resolve("granted")
      case .denied:
        resolve("denied")
      default:
        resolve("notDetermined")
      }
    }
  }

  /** 개발판(Xcode로 설치 — sandbox)인지 배포판(TestFlight·App Store — production)인지. 개발판 프로필에만
   * aps-environment development가 들어 있다. 배포판은 프로필이 없거나 production */
  static var environment: String {
    #if targetEnvironment(simulator)
      return "sandbox"
    #else
      guard
        let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
        let data = try? Data(contentsOf: url),
        let text = String(data: data, encoding: .isoLatin1)
      else { return "production" }
      let development = text.range(
        of: "<key>aps-environment</key>\\s*<string>development</string>",
        options: .regularExpression
      )
      return development != nil ? "sandbox" : "production"
    #endif
  }

  // MARK: 알림 센터

  /** 앱이 켜져 있어도 배너·소리 */
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound])
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let itemId = response.notification.request.content.userInfo["itemId"] as? String
    switch response.actionIdentifier {
    case Self.claimAction:
      guard let itemId = itemId else {
        completionHandler()
        return
      }
      claim(itemId, done: completionHandler)
    case UNNotificationDefaultActionIdentifier:
      if let itemId = itemId, itemId != "test" {
        lock.lock()
        opened = itemId
        let listener = onOpened
        lock.unlock()
        listener?(itemId)
      }
      completionHandler()
    default:
      completionHandler()
    }
  }

  // MARK: 내가 맡기

  private func claim(_ itemId: String, done: @escaping () -> Void) {
    let app = UIApplication.shared
    var task = UIBackgroundTaskIdentifier.invalid
    var finished = false
    // 끝내기는 한 번만(응답·시간 초과 중 먼저 온 쪽)
    let end: () -> Void = {
      DispatchQueue.main.async {
        guard !finished else { return }
        finished = true
        done()
        if task != .invalid {
          app.endBackgroundTask(task)
          task = .invalid
        }
      }
    }
    task = app.beginBackgroundTask(withName: "xtool-claim") { end() }

    guard let address = Store.actionUrl, let url = URL(string: address), let secret = Store.existingSecret else {
      notify(title: "맡지 못했어요", body: "앱 설정에서 알림을 다시 켜 주세요", itemId: itemId, then: end)
      return
    }
    var request = URLRequest(url: url, timeoutInterval: 20)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
      "deviceId": Store.deviceId,
      "secret": secret,
      "itemId": itemId,
      "action": "claim",
    ])
    URLSession.shared.dataTask(with: request) { data, _, error in
      let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
      let title = json?["title"] as? String ?? "맡지 못했어요"
      let body =
        json?["message"] as? String
        ?? (error != nil ? "인터넷 연결을 확인하고 앱에서 다시 해 주세요" : "잠시 뒤 앱에서 다시 해 주세요")
      self.notify(title: title, body: body, itemId: itemId, then: end)
    }.resume()
  }

  /** 결과 알림 — 누르면 그 문의가 열린다 */
  private func notify(title: String, body: String, itemId: String, then: @escaping () -> Void) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.userInfo = ["itemId": itemId, "boardKey": "techInquiry"]
    content.threadIdentifier = "techInquiry"
    let request = UNNotificationRequest(identifier: "claim-\(itemId)-\(UUID().uuidString)", content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request) { _ in then() }
  }
}

// MARK: - 기기 저장소

/** 기기 id·단추 주소(UserDefaults)와 기기 비밀 값(키체인 — 잠금을 한 번 푼 뒤에는 뒤에서도 읽힌다) */
private enum Store {
  private static let defaults = UserDefaults.standard
  private static let idKey = "xtool-push.deviceId"
  private static let urlKey = "xtool-push.actionUrl"
  private static let service = "com.originalshq.xtooltech.push"
  private static let account = "device-secret"

  static var deviceId: String {
    if let id = defaults.string(forKey: idKey) { return id }
    let id = UUID().uuidString
    defaults.set(id, forKey: idKey)
    return id
  }

  static var actionUrl: String? {
    get { defaults.string(forKey: urlKey) }
    set { defaults.set(newValue, forKey: urlKey) }
  }

  /** 있으면 그것, 없으면 새로 만들어 적는다 */
  static var secret: String {
    if let value = existingSecret { return value }
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    let value = bytes.map { String(format: "%02x", $0) }.joined()
    let attributes: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      kSecValueData as String: Data(value.utf8),
    ]
    SecItemDelete(query as CFDictionary)
    SecItemAdd(attributes as CFDictionary, nil)
    return value
  }

  static var existingSecret: String? {
    var lookup = query
    lookup[kSecReturnData as String] = true
    lookup[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    guard SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess, let data = item as? Data else {
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  static func resetSecret() {
    SecItemDelete(query as CFDictionary)
  }

  private static var query: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
  }
}
