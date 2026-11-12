#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <XtoolPushSpec/XtoolPushSpec.h>

// Swift 헤더(XtoolPushModule-Swift.h)가 알림 센터 타입을 쓰니 위에서 먼저 불러 둔다(ObjC++은 @import를 못 쓴다).

#if __has_include("XtoolPushModule-Swift.h")
#import "XtoolPushModule-Swift.h"
#else
#import <XtoolPushModule/XtoolPushModule-Swift.h>
#endif

// 신규 문의 알림 JS 모듈(TurboModule) — 받은 호출을 Swift(XtoolPushCenter)에 넘기기만 한다. 헤더를 따로 두지 않는다:
// 이 클래스는 C++ 명세 헤더를 쓰는데, 공개 헤더에 두면 AppDelegate(Swift)가 이 pod을 불러올 때 C++을 읽다 실패한다.

@interface XtoolPush : NativeXtoolPushSpecBase <NativeXtoolPushSpec>
@end

@implementation XtoolPush

RCT_EXPORT_MODULE(XtoolPush)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    __weak XtoolPush *weakSelf = self;
    XtoolPushCenter.shared.onOpened = ^(NSString *itemId) {
      [weakSelf emitOnOpened:itemId];
    };
  }
  return self;
}

RCT_EXPORT_METHOD(enable : (NSString *)actionUrl resolve : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  [XtoolPushCenter.shared enable:actionUrl
      resolve:^(id value) {
        resolve(value);
      }
      reject:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

RCT_EXPORT_METHOD(disable : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  [XtoolPushCenter.shared disable:^(id value) {
    resolve(value);
  }
      reject:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

RCT_EXPORT_METHOD(takeOpened : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  [XtoolPushCenter.shared takeOpened:^(id value) {
    resolve(value);
  }
      reject:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

RCT_EXPORT_METHOD(permission : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  [XtoolPushCenter.shared permission:^(id value) {
    resolve(value);
  }
      reject:^(NSString *code, NSString *message, NSError *error) {
        reject(code, message, error);
      }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeXtoolPushSpecJSI>(params);
}

@end
