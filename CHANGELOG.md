# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### Added
- Initial release
- Real-time MQTT connectivity with Olarm native app protocol
- Automatic zone discovery from device profile
- Token caching with automatic refresh
- API fallback polling when MQTT unavailable
- Security system accessory with all arm modes
- Contact and motion sensor support for zones
- Optional bypass switches for individual zones
- Custom automation switches for bypass-and-arm sequences
- Detailed emoji-enhanced logging for all state changes
- Graceful shutdown handling
- Reconnection tracking and monitoring
- Full TypeScript implementation with ESM modules
- Config schema for Homebridge UI

### Security
- Tokens stored in Homebridge storage directory
- Passwords never logged
- Automatic token refresh to prevent expiration

## Release Notes

### What's New in 1.0.0

This is the first official release of the Olarm Platform plugin for Homebridge. It provides comprehensive integration with Olarm security systems using their native app protocol for real-time updates.

**Key Features:**
- **Real-time Updates**: MQTT connection provides instant state changes
- **Smart Zone Detection**: Automatically creates contact/motion sensors
- **Automation Support**: Create custom switches for complex arming scenarios
- **Reliable**: Token caching and automatic fallback ensure continuous operation

### Known Limitations

- Zone bypass requires API key configuration
- Maximum 150 accessories per bridge (Homebridge limitation)
- MQTT connection requires network stability

### Upgrade Notes

This is the initial release - no upgrade notes applicable.

---

[1.0.0]: https://github.com/vangogh27/homebridge-olarm-platform/releases/tag/v1.0.0