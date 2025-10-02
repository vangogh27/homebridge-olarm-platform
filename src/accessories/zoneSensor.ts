import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { OlarmPlatform } from '../platform.js';
import type { OlarmAccessoryContext } from '../types.js';

/**
 * OlarmZoneSensor
 * Handles individual zone sensor accessories
 * Can be either a ContactSensor or MotionSensor based on zone name
 * Optionally manages a Bypass switch
 */
export class OlarmZoneSensor {
  private primaryService: Service;
  private primaryCharacteristic: typeof this.platform.api.hap.Characteristic.ContactSensorState | 
                                 typeof this.platform.api.hap.Characteristic.MotionDetected;
  private bypassService?: Service;

  constructor(
    private readonly platform: OlarmPlatform,
    public readonly accessory: PlatformAccessory<OlarmAccessoryContext>,
  ) {
    const isMotionSensor = this.accessory.displayName.toLowerCase().includes('pir') ||
      this.accessory.displayName.toLowerCase().includes('motion');

    // Set accessory information
    this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Olarm')
      .setCharacteristic(
        this.platform.api.hap.Characteristic.Model,
        isMotionSensor ? 'Motion Sensor' : 'Contact Sensor',
      )
      .setCharacteristic(
        this.platform.api.hap.Characteristic.SerialNumber,
        `${this.accessory.context.deviceId}-${this.accessory.context.zoneNum}`,
      )
      .setCharacteristic(this.platform.api.hap.Characteristic.FirmwareRevision, this.accessory.context.firmware);

    // Create appropriate sensor service
    if (isMotionSensor) {
      this.primaryService = this.accessory.getService(this.platform.api.hap.Service.MotionSensor) ||
        this.accessory.addService(this.platform.api.hap.Service.MotionSensor, this.accessory.displayName);
      this.primaryCharacteristic = this.platform.api.hap.Characteristic.MotionDetected;
    } else {
      this.primaryService = this.accessory.getService(this.platform.api.hap.Service.ContactSensor) ||
        this.accessory.addService(this.platform.api.hap.Service.ContactSensor, this.accessory.displayName);
      this.primaryCharacteristic = this.platform.api.hap.Characteristic.ContactSensorState;
    }

    // Add StatusActive to ensure the sensor is always visible in the Home app
    if (!this.primaryService.testCharacteristic(this.platform.api.hap.Characteristic.StatusActive)) {
      this.primaryService.addCharacteristic(this.platform.api.hap.Characteristic.StatusActive);
    }

    // Add the required 'get' handler for the primary characteristic
    this.primaryService.getCharacteristic(this.primaryCharacteristic)
      .onGet(() => {
        return this.primaryService.getCharacteristic(this.primaryCharacteristic).value as CharacteristicValue;
      });

    // Conditionally add or remove the Bypass switch service based on config
    if (this.platform.config.addBypassSwitches) {
      this.setupBypassSwitch();
    } else {
      const oldBypassService = this.accessory.getService('Bypass');
      if (oldBypassService) {
        this.accessory.removeService(oldBypassService);
      }
    }
  }

  /**
   * Set up the Bypass switch service and its event handlers
   */
  private setupBypassSwitch(): void {
    this.bypassService = this.accessory.getService('Bypass') ||
      this.accessory.addService(
        this.platform.api.hap.Service.Switch,
        'Bypass',
        `bypass-${this.accessory.context.zoneNum}`,
      );

    this.bypassService.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .onSet(async (value: CharacteristicValue) => {
        const command = value ? 'zone-bypass' : 'zone-unbypass';
        await this.platform.controller.sendCommand(command, this.accessory.context.zoneNum!);
      });
  }

  /**
   * Update the state of this accessory in HomeKit based on fresh data
   */
  updateState(zoneState: string): void {
    const isBypassed = zoneState === 'b';
    const isActive = zoneState === 'a';

    // Get current state before updating
    const oldValue = this.primaryService.getCharacteristic(this.primaryCharacteristic).value;
    const newValue = this.primaryCharacteristic === this.platform.api.hap.Characteristic.MotionDetected
      ? isActive
      : (isActive ? 1 : 0);

    // Only log if state actually changed
    if (oldValue !== newValue) {
      this.platform.log.info(`${this.accessory.displayName}: ${isActive ? 'OPENED' : 'CLOSED'}`);
    }

    // Update characteristics
    if (this.primaryCharacteristic === this.platform.api.hap.Characteristic.MotionDetected) {
      this.primaryService.updateCharacteristic(this.primaryCharacteristic, isActive);
    } else {
      this.primaryService.updateCharacteristic(this.primaryCharacteristic, isActive ? 1 : 0);
    }

    this.primaryService.updateCharacteristic(this.platform.api.hap.Characteristic.StatusActive, !isBypassed);

    if (this.bypassService) {
      this.bypassService.updateCharacteristic(this.platform.api.hap.Characteristic.On, isBypassed);
    }
  }
}