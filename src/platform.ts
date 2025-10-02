import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { OlarmAuth } from './services/auth.js';
import { OlarmController } from './services/controller.js';
import { OlarmSecuritySystem } from './accessories/securitySystem.js';
import { OlarmZoneSensor } from './accessories/zoneSensor.js';
import { OlarmAutomationSwitch } from './accessories/automationSwitch.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import type { OlarmPlatformConfig, OlarmPlatformAccessory, DeviceData } from './types.js';

export class OlarmPlatform implements DynamicPlatformPlugin {
  public readonly accessories: Map<string, OlarmPlatformAccessory> = new Map();
  public readonly accessoryHandlers: Map<string, OlarmSecuritySystem | OlarmZoneSensor | OlarmAutomationSwitch> = new Map();
  public controller!: OlarmController;
  public reconnectCount = 0;
  public reconnectTimestamps: number[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig & OlarmPlatformConfig,
    public readonly api: API,
  ) {
    this.log.info('Olarm Platform is starting...');

    const hasPrimaryAuth = this.config.primaryAuth?.email && this.config.primaryAuth?.password;
    if (!hasPrimaryAuth) {
      this.log.error('FATAL: "primaryAuth" with "email" and "password" is required.');
      return;
    }

    // Graceful shutdown
    this.api.on('shutdown', () => {
      this.log.info('Olarm: Shutting down gracefully...');
      if (this.controller) {
        if (this.controller.mqttClient) {
          this.controller.mqttClient.end();
        }
        if (this.controller.stateRequestInterval) {
          clearInterval(this.controller.stateRequestInterval);
        }
        if (this.controller.pollingTimer) {
          clearInterval(this.controller.pollingTimer);
        }
      }
      this.log.info('Olarm: Shutdown complete');
    });

    this.api.on('didFinishLaunching', async () => {
      this.log.info('Homebridge has finished launching. Initializing Olarm controller...');
      await this.initializeController();
    });
  }

  /**
   * Restore cached accessories from disk
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info(`Restoring accessory from cache: ${accessory.displayName}`);
    this.accessories.set(accessory.UUID, accessory as OlarmPlatformAccessory);
  }

  /**
   * Initialize the controller and authentication
   */
  async initializeController(): Promise<void> {
    this.controller = new OlarmController(this);

    this.controller.on('stateUpdate', (deviceData) => {
      this.updateAllAccessoryStates(deviceData);
    });

    this.log.info('Primary authentication (email/password) provided. Attempting Native App connection...');
    const auth = new OlarmAuth(this);
    const success = await auth.initialize();
    
    if (success) {
      this.controller.connect(auth);
    } else {
      this.log.error('Native App authentication failed. Falling back to API polling if configured.');
      this.controller.activatePollingFallback();
    }

    await this.discoverDevices();
  }

  /**
   * Discover and register all accessories
   */
  async discoverDevices(): Promise<void> {
    await this.controller.refreshState();
    const deviceDetails = this.controller.deviceData;
    
    if (!deviceDetails) {
      this.log.error('Could not fetch initial device data. Aborting accessory setup.');
      return;
    }

    const currentAccessoryUuids = new Set<string>();

    // Register main security system
    const securityUuid = this.api.hap.uuid.generate(this.config.deviceId);
    this.getAccessoryHandler(
      OlarmSecuritySystem,
      deviceDetails,
      securityUuid,
      this.config.deviceName || 'Olarm Security',
    );
    currentAccessoryUuids.add(securityUuid);

    // Register zone sensors
    const includedZones = this.config.includedZones;
    this.log.info(`Device profile exists: ${!!deviceDetails.deviceProfile}`);
    this.log.info(`Zone labels exist: ${!!deviceDetails.deviceProfile?.zonesLabels}`);
    this.log.info(`Zone labels count: ${deviceDetails.deviceProfile?.zonesLabels?.length || 0}`);

    if (deviceDetails.deviceProfile && deviceDetails.deviceProfile.zonesLabels) {
      deviceDetails.deviceProfile.zonesLabels.forEach((zoneName, index) => {
        const zoneNum = index + 1;
        if (includedZones && !includedZones.includes(zoneNum)) {
          return;
        }
        if (!zoneName || zoneName.trim() === '') {
          return;
        }

        const zoneUuid = this.api.hap.uuid.generate(`${this.config.deviceId}-zone-${zoneNum}`);
        const handler = this.getAccessoryHandler(OlarmZoneSensor, deviceDetails, zoneUuid, zoneName);
        handler.accessory.context.zoneNum = zoneNum;
        currentAccessoryUuids.add(zoneUuid);
      });
    }

    // Register automation switches
    if (this.config.automations && Array.isArray(this.config.automations)) {
      this.log.info(`Found ${this.config.automations.length} automation(s) to set up`);
      this.config.automations.forEach((automation, index) => {
        this.log.info(`Setting up automation: ${automation.name}`);
        const autoUuid = this.api.hap.uuid.generate(`${this.config.deviceId}-automation-${automation.id || index}`);
        const handler = this.getAccessoryHandler(OlarmAutomationSwitch, deviceDetails, autoUuid, automation.name);
        
        if (handler instanceof OlarmAutomationSwitch) {
          handler.config = automation;
          this.log.info(`Config set for ${automation.name}`);
        }
        currentAccessoryUuids.add(autoUuid);
      });
      this.log.info('All automations set up');
    }

    // Remove stale accessories
    for (const [uuid, accessory] of this.accessories.entries()) {
      if (!currentAccessoryUuids.has(uuid)) {
        this.log.info(`Removing stale accessory: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
        this.accessoryHandlers.delete(uuid);
      }
    }
  }

  /**
   * Get or create an accessory handler
   */
  getAccessoryHandler(
    HandlerClass: typeof OlarmSecuritySystem | typeof OlarmZoneSensor | typeof OlarmAutomationSwitch,
    deviceDetails: DeviceData,
    uuid: string,
    displayName: string,
  ): OlarmSecuritySystem | OlarmZoneSensor | OlarmAutomationSwitch {
    let accessory = this.accessories.get(uuid);
    
    if (!accessory) {
      accessory = new this.api.platformAccessory(displayName, uuid);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.set(uuid, accessory);
    }

    accessory.context.deviceId = this.config.deviceId;
    accessory.context.firmware = deviceDetails.deviceFirmware || '0.0.0';

    let handler = this.accessoryHandlers.get(uuid);
    if (!handler) {
      handler = new HandlerClass(this, accessory);
      this.accessoryHandlers.set(uuid, handler);
    }
    
    return handler;
  }

  /**
   * Update all accessories with fresh state data
   */
  updateAllAccessoryStates(deviceData: DeviceData): void {
    if (!deviceData) {
      return;
    }

    for (const handler of this.accessoryHandlers.values()) {
      if (handler instanceof OlarmSecuritySystem) {
        handler.updateState(deviceData.deviceState, deviceData.deviceStatus);
      }
      if (handler instanceof OlarmZoneSensor) {
        const zoneNum = handler.accessory.context.zoneNum;
        if (zoneNum) {
          const zoneState = deviceData.deviceState.zones[zoneNum - 1];
          handler.updateState(zoneState);
        }
      }
    }
  }
}