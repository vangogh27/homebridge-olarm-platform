# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Security
- Tokens stored securely in Homebridge storage directory
- Passwords never logged
- Automatic token refresh to prevent expiration

## Release Notes

### What's New in 1.0.2

This is the initial public release of the Olarm Platform plugin for Homebridge. It provides comprehensive integration with Olarm security systems using their native app protocol for real-time updates.

**Key Features:**
- **Real-time Updates**: MQTT connection provides instant state changes with sub-second latency
- **Smart Zone Detection**: Automatically creates contact/motion sensors based on zone names
- **Automation Support**: Create custom switches for complex arming scenarios (e.g., "Away with garage bypassed")
- **Reliable**: Token caching and automatic fallback ensure continuous operation
- **Modern Architecture**: Built with TypeScript and ESM for maintainability

### Known Limitations

- Zone bypass commands require API key configuration in `fallbackAuth.apiKey`
- Maximum 150 accessories per bridge (Homebridge limitation - use child bridges if needed)
- MQTT connection requires stable network connectivity

### Installation

```bash
npm install -g homebridge-olarm-platform
```

Or install via Homebridge UI by searching for "Olarm".

### Minimum Configuration

```json
{
  "platform": "Olarm",
  "name": "Olarm",
  "deviceId": "YOUR_DEVICE_ID",
  "primaryAuth": {
    "email": "your-email@example.com",
    "password": "your-password"
  }
}
```

See [README](https://github.com/vangogh27/homebridge-olarm-platform#readme) for full configuration options.

---

[1.0.2]: https://github.com/vangogh27/homebridge-olarm-platform/releases/tag/v1.0.2