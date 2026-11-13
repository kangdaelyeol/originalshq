require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# 앱 안 네이티브 모듈 — react-native.config.js가 자동 연결(pod install)한다. Xcode 프로젝트 파일은 건드리지 않는다.
Pod::Spec.new do |s|
  s.name         = "XtoolPushModule"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://originalshq.com"
  s.license      = { :type => "UNLICENSED" }
  s.authors      = "originalshq"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  # 아톡문의 알림음(sounds/make-sounds.py로 만든다) — 앱 번들 맨 위로 복사돼 서버가 보낸 이름(tech-new.caf 등)으로 울린다
  s.resources    = "sounds/*.caf"
  s.swift_version = "5.9"
  s.frameworks   = "UserNotifications", "Security"

  install_modules_dependencies(s)
end
