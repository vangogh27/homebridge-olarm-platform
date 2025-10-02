import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import type { OlarmPlatform } from '../platform.js';
import type { OlarmAccessoryContext, AutomationConfig } from '../types.js';

/**
 * OlarmAutomationSwitch
 * A stateless switch that bypasses specified zones and then arms the system
 * Used for automations that need to bypass certain zones before arming
 */
export class OlarmAutomationSwitch {
  private service: Service;
  public config: AutomationConfig | null = null;

  constructor(
    private readonly platform: OlarmPlatform,
    public readonly accessory: PlatformAccessory<OlarmAccessoryContext>,
  ) {
    // Set accessory information
    this.accessory.getService(this.platform.api.hap.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.api.hap.Characteristic.Manufacturer, 'Olarm')
      .setCharacteristic(this.platform.api.hap.Characteristic.Model, 'Bypass & Arm')
      .setCharacteristic(
        this.platform.api.hap.Characteristic.SerialNumber,
        `${this.accessory.context.deviceId}-auto`,
      )
      .setCharacteristic(this.platform.api.hap.Characteristic.FirmwareRevision, this.accessory.context.firmware);

    // Get or create the Switch service
    this.service = this.accessory.getService(this.platform.api.hap.Service.Switch) ||
      this.accessory.addService(this.platform.api.hap.Service.Switch, this.accessory.displayName);

    // Set up handlers - switch always returns to off after execution
    this.service.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .onSet(this.handleSet.bind(this))
      .onGet(() => false);
  }

  /**
   * Handle the switch being turned on
   * Executes the bypass and arm sequence
   */
  async handleSet(value: CharacteristicValue): Promise<void> {
    if (!value || !this.config) {
      return;
    }

    const zoneList = this.config.zones.join(', ');
    this.platform.log.info(`Automation: "${this.config.name}" - bypassing zones ${zoneList} and arming`);

    // Bypass each zone in sequence
    for (const zoneNum of this.config.zones) {
      this.platform.log.info(`Sending zone-bypass for zone ${zoneNum}`);
      await this.platform.controller.sendCommand('zone-bypass', zoneNum);
      await this.delay(200);
    }

    // Wait before arming
    this.platform.log.info('All bypass commands sent, waiting before arming...');
    await this.delay(1000);

    // Send arm command
    this.platform.log.info(`Sending arm command: ${this.config.armMode}`);
    await this.platform.controller.sendCommand(this.config.armMode);

    // Reset switch to off state
    setTimeout(() => {
      this.service.updateCharacteristic(this.platform.api.hap.Characteristic.On, false);
    }, 500);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update state - not used for stateless switches
   */
  updateState(): void {
    // Stateless switch - no state to update
  }
}