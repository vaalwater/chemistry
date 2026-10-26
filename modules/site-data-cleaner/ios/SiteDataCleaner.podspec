require 'json'

package = JSON.parse(File.read(File.join(__dir__, '../expo-module.config.json')))

Pod::Spec.new do |s|
  s.name         = "SiteDataCleaner"
  s.version      = "1.0.0"
  s.summary      = package['description'] || "按域名清除指定站点的 WebKit 网站数据"
  s.homepage     = "https://github.com/vaalwater/chemistry"
  s.license      = "Unlicense"
  s.author       = ""
  s.platforms    = { :ios => '13.4' }
  s.source       = { :path => '.' }
  s.source_files = "**/*.{h,m,mm,swift}"
  s.dependency   'ExpoModulesCore'
end
