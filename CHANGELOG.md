# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2025-10-03

### Fixed
- Added missing `platform` property to config schema
- Fixed config schema validation for `includedZones` array (changed from `integer` to `number`)
- Fixed config schema validation for automation `zones` array (changed from `integer` to `number`)
- Improved array input UI in Homebridge config interface
- Made all automation fields optional (validation handled in code instead)

### Changed
- Updated config schema to use `number` type instead of `integer` for better UI compatibility
- Added `uniqueItems: true` to zone arrays to prevent duplicates
- Improved layout structure for zone configuration in UI

## [1.0.2] - 2025-10-03

### Added
- Initial public release
- Real-time MQTT connectivity with Olarm native app protocol
- Automatic zone discovery from device profile
- Token caching with automatic refresh
- API fallback polling when MQTT unavailable
- Security system accessory with all arm modes (Stay, Away, Night, Disarm)
- Contact and motion sensor support for zones
- Optional bypass switches for individual zones
- Custom automation switches for bypass-and-arm sequences
- Detailed emoji-enhanced logging for all state changes
- Graceful shutdown handling
- Reconnection tracking and monitoring
- Full TypeScript implementation with ESM modules
- Config schema for Homebridge UI
- Comprehensive documentation
- Python script to retrieve device IDs

### Security
- Tokens stored securely in Homebridge storage directory
- Passwords never logged
- Automatic token refresh to prevent expiration

---

[1.0.4]: https://github.com/vangogh27/homebridge-olarm-platform/releases/tag/v1.0.4
[1.0.2]: https://github.com/vangogh27/homebridge-olarm-platform/releases/tag/v1.0.2