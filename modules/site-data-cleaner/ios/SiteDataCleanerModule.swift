import ExpoModulesCore
import WebKit

/**
 * 按**域名**清除某个站点的所有网站数据（cookie / localStorage / IndexedDB / 缓存）。
 *
 * 为什么不用 `react-native-webview` 自带的 `clearCache`：
 *   ① 它清的是 `WKWebsiteDataStore.default()` —— 整个 App 内**所有** WKWebView 共享的存储，
 *      会把教学用的 3D 引擎那个 WebView 一起清掉；
 *   ② 它拼的类型里没有 `WKWebsiteDataTypeCookies`，所以登录态根本清不掉。
 *
 * 这里只删 `displayName` / `domain` 命中目标域名的记录，问答助手以外的站点一律不动。
 */
final class SiteDataCleaner {
  static func clear(host: String, completion: @escaping (Int) -> Void) {
    let target = host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !target.isEmpty else {
      completion(0)
      return
    }

    let store = WKWebsiteDataStore.default()
    let types = WKWebsiteDataStore.allWebsiteDataTypes() // 含 cookies

    store.fetchDataRecords(ofTypes: types) { records in
      let matched = records.filter { isMatch($0.displayName, target) }

      store.removeData(ofTypes: types, for: matched) {
        // 上面那一步已经覆盖了 cookie，但 httpOnly / 不同子域的老 cookie 可能还留着，
        // 再按 domain 精确删一遍，确保登录态一定没了
        let jars = store.httpCookieStore
        jars.getAllCookies { cookies in
          let stale = cookies.filter { isMatch($0.domain, target) }
          guard !stale.isEmpty else {
            completion(matched.count)
            return
          }
          let group = DispatchGroup()
          for c in stale {
            group.enter()
            jars.delete(c) {
              group.leave()
            }
          }
          group.notify(queue: .main) {
            completion(matched.count + stale.count)
          }
        }
      }
    }
  }

  /// `chat.deepseek.com` 这类 <code>displayName</code> 与传入的 `deepseek.com` 比对时，
  /// 只要两者有一方包含另一方即视为命中 —— 这样主域和子域都能覆盖到。
  private static func isMatch(_ value: String, _ target: String) -> Bool {
    let v = value.lowercased()
    return v.contains(target) || target.contains(v)
  }
}

public class SiteDataCleanerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SiteDataCleaner")

    /**
     * 清除某个域名下的网站数据。返回被清掉的记录条数（0 表示本来就没数据）。
     * 用 Promise 而不是同步返回，避免在回调线程上等待。
     */
    AsyncFunction("clearForHost") { (host: String, promise: Promise) in
      SiteDataCleaner.clear(host: host) { count in
        promise.resolve(count)
      }
    }
  }
}
