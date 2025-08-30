# Flutter Build Optimizations for Sub-1 Second Launch

This document outlines the build-time optimizations for achieving sub-1 second app launch performance.

## Release Build Configuration

### Android Optimizations

1. **Enable R8 Code Shrinking** (already in android/app/build.gradle):
```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

2. **ABI Splitting for Smaller APKs**:
```gradle
android {
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a', 'armeabi-v7a', 'x86_64'
            universalApk false
        }
    }
}
```

3. **Bundle Optimization**:
```bash
# Generate optimized Android App Bundle
flutter build appbundle --release --optimize-dart --dart-obfuscation
```

### Asset Optimization

1. **Image Compression**:
```bash
# Use WebP format for images (better compression)
# Convert existing images:
cwebp input.png -q 80 -o output.webp
```

2. **Asset Variants**: Use density-specific assets:
```
assets/
  images/
    1.5x/
    2.0x/
    3.0x/
```

## Build Performance Commands

### Development Builds
```bash
# Profile mode for performance testing
flutter run --profile

# Track build performance
flutter build apk --analyze-size
```

### Release Builds
```bash
# Optimized release build
flutter build apk --release --split-per-abi --dart-obfuscation

# Android App Bundle (preferred)
flutter build appbundle --release --dart-obfuscation
```

## Performance Targets

- **APK Size**: < 50MB for main ABI
- **Cold Start**: < 1000ms (90th percentile)  
- **Memory Usage**: < 100MB initial allocation
- **Download Size**: < 30MB (with AAB)

## Monitoring Build Performance

```bash
# Analyze build output
flutter build apk --analyze-size --target-platform android-arm64

# Profile startup performance
flutter run --profile --trace-startup
```

## Tree Shaking Configuration

Add to `analysis_options.yaml`:
```yaml
analyzer:
  enable-experiment:
    - inline-class
    
linter:
  rules:
    # Performance-oriented linting
    - prefer_const_constructors
    - prefer_const_literals_to_create_immutables
    - avoid_function_literals_in_foreach_calls
```

## Runtime Optimizations

1. **Dart VM Optimization**:
   - Uses ahead-of-time (AOT) compilation in release builds
   - Tree shaking eliminates unused code
   - Optimized garbage collection

2. **Flutter Engine**:
   - Skia graphics engine optimizations
   - Platform-specific rendering optimizations
   - Reduced memory allocations

## Validation Steps

1. **Test on Low-End Devices**: Minimum Android 7.0 (API 24)
2. **Cold Start Testing**: Clear app data between tests
3. **Memory Profiling**: Monitor startup memory usage
4. **Network Simulation**: Test with poor connectivity

## Additional Tips

- Use `const` constructors wherever possible
- Avoid heavy computations in widget constructors  
- Implement proper image caching
- Use `AutomaticKeepAliveClientMixin` sparingly
- Profile regularly with Flutter DevTools