/**
 * Type definitions for Olarm plugin
 */

import { PlatformAccessory } from 'homebridge';

/**
 * Plugin configuration from config.json
 */
export interface OlarmPlatformConfig {
  name: string;
  deviceId: string;
  deviceName?: string;
  primaryAuth: {
    email: string;
    password: string;
  };
  fallbackAuth?: {
    apiKey?: string;
  };
  includedZones?: number[];
  addBypassSwitches?: boolean;
  pollingInterval?: number;
  automations?: AutomationConfig[];
}

/**
 * Automation configuration
 */
export interface AutomationConfig {
  id?: string;
  name: string;
  zones: number[];
  armMode: 'arm' | 'stay' | 'sleep';
}

/**
 * Olarm device information from API
 */
export interface OlarmDevice {
  id: string;
  IMEI: string;
  name?: string;
  deviceFirmware?: string;
}

/**
 * User information from auth API
 */
export interface OlarmUser {
  userIndex: number;
  userId: string;
  devices: OlarmDevice[];
}

/**
 * Device profile with zone labels
 */
export interface DeviceProfile {
  zonesLabels?: string[];
  pgmLabels?: string[];
  areaLabels?: string[];
}

/**
 * Device state from MQTT/API
 */
export interface DeviceState {
  areas: string[];
  zones: string[];
  pgms?: string[];
  utility?: string[];
}

/**
 * Complete device data structure
 */
export interface DeviceData {
  deviceState: DeviceState;
  deviceStatus: 'online' | 'offline';
  deviceProfile?: DeviceProfile;
  deviceFirmware?: string;
}

/**
 * MQTT payload structure
 */
export interface MqttPayload {
  type: string;
  data?: DeviceState;
}

/**
 * Cached token data
 */
export interface TokenCache {
  accessToken: string;
  refreshToken: string;
  tokenExpiration: number;
  userIndex: number;
  userId: string;
}

/**
 * Extended PlatformAccessory context
 */
export interface OlarmAccessoryContext {
  deviceId: string;
  firmware: string;
  zoneNum?: number;
}

/**
 * Typed PlatformAccessory for Olarm
 */
export type OlarmPlatformAccessory = PlatformAccessory<OlarmAccessoryContext>;