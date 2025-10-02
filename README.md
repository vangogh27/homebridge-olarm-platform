# Homebridge Olarm Platform

[![npm version](https://badge.fury.io/js/homebridge-olarm-platform.svg)](https://badge.fury.io/js/homebridge-olarm-platform)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

A comprehensive Homebridge plugin for Olarm security systems with real-time MQTT events and automatic zone discovery.

## Features

- **Real-time MQTT Updates** - Instant state changes via native app protocol
- **Automatic Zone Discovery** - Automatically creates sensors for all configured zones
- **Zone Bypass Support** - Optional switches to bypass individual zones
- **Automation Switches** - Create custom bypass-and-arm sequences
- **API Fallback** - Automatic polling when MQTT unavailable
- **Token Caching** - Persistent authentication to avoid rate limiting
- **Detailed Logging** - Emoji-enhanced logs for all state changes

## Installation

### Via Homebridge UI (Recommended)

1. Search for "Olarm" in the Homebridge UI plugin search
2. Click **Install**
3. Configure the plugin using the settings UI

### Via Command Line

```bash
npm install -g homebridge-olarm-platform
```

## Configuration

### Minimum Configuration

```json
{
  "platforms": [
    {
      "platform": "Olarm",
      "name": "Olarm",
      "deviceId": "YOUR_DEVICE_ID",
      "primaryAuth": {
        "email": "your-email@example.com",
        "password": "your-password"
      }
    }
  ]
}
```

### Full Configuration

```json
{
  "platforms": [
    {
      "platform": "Olarm",
      "name": "Olarm",
      "deviceId": "YOUR_DEVICE_ID",
      "deviceName": "Home Security",
      "primaryAuth": {
        "email": "your-email@example.com",
        "password": "your-password"
      },
      "fallbackAuth": {
        "apiKey": "YOUR_API_KEY"
      },
      "includedZones": [1, 2, 3, 4, 5],
      "addBypassSwitches": true,
      "pollingInterval": 300,
      "automations": [
        {
          "id": "sleep-mode",
          "name": "Sleep Mode",
          "zones": [3, 4],
          "armMode": "sleep"
        },
        {
          "id": "away-mode",
          "name": "Away with Garage Open",
          "zones": [5],
          "armMode": "arm"
        }
      ]
    }
  ]
}
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `platform` | string | ✅ | Must be `Olarm` |
| `name` | string | ✅ | Platform name for Homebridge |
| `deviceId` | string | ✅ | Your Olarm device ID |
| `deviceName` | string | ❌ | Display name for security system (default: "Olarm Security") |
| `primaryAuth.email` | string | ✅ | Your Olarm account email |
| `primaryAuth.password` | string | ✅ | Your Olarm account password |
| `fallbackAuth.apiKey` | string | ❌ | API key for fallback polling when MQTT unavailable |
| `includedZones` | array | ❌ | Zone numbers to include (empty = all zones) |
| `addBypassSwitches` | boolean | ❌ | Add bypass switches for each zone (default: false) |
| `pollingInterval` | number | ❌ | Seconds between API polls when MQTT down (default: 300) |
| `automations` | array | ❌ | Custom automation switches (see below) |

### Automation Configuration

Each automation creates a stateless switch that bypasses specific zones and then arms the system:

```json
{
  "id": "unique-identifier",
  "name": "Display Name",
  "zones": [1, 2, 3],
  "armMode": "arm"
}
```

- `id`: Unique identifier (optional, auto-generated if omitted)
- `name`: Name shown in HomeKit
- `zones`: Array of zone numbers to bypass before arming
- `armMode`: `arm` (Away), `stay` (Stay), or `sleep` (Night)

## Getting Your Device ID

1. Log into the [Olarm web portal](https://app.olarm.co/)
2. Select your device
3. The device ID is in the URL: `https://app.olarm.co/devices/{DEVICE_ID}`

## Getting Your API Key (Optional)

API key is only needed for fallback polling:

1. Log into [Olarm web portal](https://app.olarm.co/)
2. Go to Settings → API Keys
3. Generate a new API key
4. Add it to `fallbackAuth.apiKey` in config

## How It Works

### Authentication

The plugin uses Olarm's native app authentication protocol:
- Login with email/password
- Tokens cached to `~/.homebridge/olarm_tokens.json`
- Automatic token refresh
- No rate limiting issues on restart

### Real-time Updates

- Connects to Olarm MQTT broker via WebSocket
- Subscribes to device state updates
- Instant notification of all state changes
- Automatic reconnection on network issues

### Fallback Polling

If MQTT connection fails:
- Automatically switches to API polling
- Configurable polling interval
- Returns to MQTT when connection restored

## Accessories Created

### Security System

Main security panel with states:
- **Disarmed**
- **Armed Stay**
- **Armed Away**
- **Armed Night**
- **Alarm Triggered**

### Zone Sensors

Automatically created for each zone:
- **Contact Sensors** - For doors, windows, etc.
- **Motion Sensors** - For zones with "PIR" or "motion" in name
- Shows bypassed state via StatusActive

### Bypass Switches (Optional)

When `addBypassSwitches: true`:
- Individual switches for each zone
- Turn on to bypass zone
- Turn off to unbypass zone

### Automation Switches

Stateless switches that execute sequences:
1. Bypass specified zones (with delays)
2. Wait 1 second
3. Arm system in specified mode
4. Switch returns to off

## Logging

The plugin provides detailed, emoji-enhanced logging:

```
🔒 Area 1: Disarmed → Armed Away
🚪 Front Door: Ready (Closed) → Active (Open)
🚶 Lounge PIR: Ready (Closed) → Active (Open)
⏭️ Garage Door: Ready (Closed) → Bypassed
⚡ PGM 1: Activated
🟢 AC Power: OK
🔴 Battery Low: FAULT
```

## Troubleshooting

### Plugin won't start

- Check `primaryAuth` credentials are correct
- Verify `deviceId` matches your Olarm device
- Check Homebridge logs for error messages

### MQTT keeps disconnecting

- Check network stability
- Plugin logs reconnection attempts per hour
- Fallback polling activates automatically

### Zones not appearing

- Check zone has a name in Olarm app
- Verify zone number if using `includedZones`
- Check Homebridge logs for "Device profile exists" messages

### Bypass not working

- Bypass commands require API key in `fallbackAuth.apiKey`
- Check API key is valid in Olarm portal
- Verify zone number is correct

### Token errors on restart

- Delete `~/.homebridge/olarm_tokens.json`
- Restart Homebridge to force fresh login
- Check credentials haven't changed

## Development

### Setup

```bash
git clone https://github.com/vangogh27/homebridge-olarm-platform.git
cd homebridge-olarm-platform
npm install
npm run build
```

### Watch Mode

```bash
npm run watch
```

This will:
- Compile TypeScript on file changes
- Link plugin globally
- Restart Homebridge automatically

### Testing

```bash
npm run lint
npm run build
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run build`
5. Submit a pull request

## Support

- **Issues**: [GitHub Issues](https://github.com/vangogh27/homebridge-olarm-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vangogh27/homebridge-olarm-platform/discussions)

## License

Apache-2.0 License - see [LICENSE](LICENSE) file for details.

## Credits

- Created by Louis Germishuys
- Built with [Homebridge Plugin Template](https://github.com/homebridge/homebridge-plugin-template)
- Uses Olarm's native app protocol for real-time updates

## Disclaimer

This plugin is not affiliated with or endorsed by Olarm. Use at your own risk.