import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { AUTH_BASE_URL, LEGACY_API_BASE_URL } from '../settings.js';
import type { OlarmPlatform } from '../platform.js';
import type { OlarmDevice, TokenCache } from '../types.js';

/**
 * OlarmAuth
 * Handles the "Native App" authentication flow with token persistence.
 * Caches tokens to disk to avoid rate-limiting on restarts and handles token refreshes.
 */
export class OlarmAuth {
  private tokensFilePath: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiration: number | null = null;
  private userIndex: number | null = null;
  private userId: string | null = null;
  public devices: OlarmDevice[] = [];

  constructor(
    private readonly platform: OlarmPlatform,
  ) {
    this.tokensFilePath = path.join(this.platform.api.user.storagePath(), 'olarm_tokens.json');
    this.platform.log.debug(`Token cache path: ${this.tokensFilePath}`);
  }

  /**
   * Main entry point for authentication
   */
  async initialize(): Promise<boolean> {
    this.platform.log.info('Initializing authentication...');
    await this.loadTokensFromStorage();

    if (!this.accessToken) {
      this.platform.log.info('No cached access token found. Performing a full login.');
      try {
        await this.login();
      } catch (error) {
        this.platform.log.error(`Initial login failed: ${(error as Error).message}. Plugin may not function correctly.`);
        return false;
      }
    } else {
      this.platform.log.info('Cached tokens found. Verifying access token...');
      await this.ensureAccessTokenIsValid();
    }

    // Fetch latest device list
    try {
      await this.fetchDevices();
      this.platform.log.info('Authentication complete.');
      return true;
    } catch (error) {
      this.platform.log.error(`Failed to fetch devices after authentication: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Checks if the current access token is valid, refreshing it if necessary
   */
  async ensureAccessTokenIsValid(): Promise<void> {
    const buffer = 5 * 60 * 1000; // 5-minute buffer before expiry
    if (!this.tokenExpiration || Date.now() >= (this.tokenExpiration - buffer)) {
      this.platform.log.info('Access token is expired or nearing expiry. Attempting to refresh...');
      try {
        await this.refreshAccessToken();
      } catch (refreshError) {
        this.platform.log.error(`Token refresh failed: ${(refreshError as Error).message}. Attempting a full login as a fallback.`);
        try {
          await this.login();
        } catch (loginError) {
          this.platform.log.error(`Fallback login also failed: ${(loginError as Error).message}.`);
          throw loginError;
        }
      }
    } else {
      this.platform.log.info('Cached access token is still valid.');
    }
  }

  /**
   * Performs a full login with email and password
   */
  async login(): Promise<void> {
    this.platform.log.info('Auth: Attempting full login...');
    const loginUrl = `${AUTH_BASE_URL}/api/v4/oauth/login/mobile`;
    const loginBody = new URLSearchParams({
      userEmailPhone: this.platform.config.primaryAuth.email,
      userPass: this.platform.config.primaryAuth.password,
    }).toString();

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody,
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed with status ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json() as {
      oat: string;
      ort: string;
      oatExpire: number;
    };
    this.accessToken = loginData.oat;
    this.refreshToken = loginData.ort;
    this.tokenExpiration = loginData.oatExpire * 1000;
    this.platform.log.info('Auth: Login successful.');

    // Fetch user index after successful login
    await this.fetchUserIndex();
    await this.saveTokensToStorage();
  }

  /**
   * Uses the long-lived refresh token to get a new access token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available to refresh.');
    }

    this.platform.log.info('Auth: Refreshing access token...');
    const refreshUrl = `${AUTH_BASE_URL}/api/v4/oauth/refresh`;
    const refreshBody = new URLSearchParams({ ort: this.refreshToken }).toString();

    const refreshResponse = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: refreshBody,
    });

    if (!refreshResponse.ok) {
      throw new Error(`Token refresh failed with status ${refreshResponse.status}`);
    }

    const refreshData = await refreshResponse.json() as {
      oat: string;
      ort: string;
      oatExpire: number;
    };
    this.accessToken = refreshData.oat;
    this.refreshToken = refreshData.ort;
    this.tokenExpiration = refreshData.oatExpire * 1000;
    this.platform.log.info('Auth: Access token refreshed successfully.');

    // Re-fetch user index if missing from cached file
    if (!this.userId || !this.userIndex) {
      await this.fetchUserIndex();
    }
    await this.saveTokensToStorage();
  }

  /**
   * Fetches the user's internal ID and index
   */
  async fetchUserIndex(): Promise<void> {
    this.platform.log.debug('Auth: Fetching user index and ID...');
    const url = `${AUTH_BASE_URL}/api/v4/oauth/federated-link-existing?oat=${this.accessToken}`;
    const body = new URLSearchParams({
      userEmailPhone: this.platform.config.primaryAuth.email,
      userPass: this.platform.config.primaryAuth.password,
      captchaToken: 'olarmapp',
    }).toString();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new Error(`Fetch user index failed with status ${response.status}`);
    }

    const data = await response.json() as {
      userIndex: number;
      userId: string;
    };
    this.userIndex = data.userIndex;
    this.userId = data.userId;
    this.platform.log.info(`Auth: Fetched user index: ${this.userIndex}, userId: ${this.userId}`);
  }

  /**
   * Fetches the list of devices, including the crucial IMEI
   */
  async fetchDevices(): Promise<void> {
    this.platform.log.debug('Auth: Fetching device list...');
    const url = `${LEGACY_API_BASE_URL}/api/v2/users/${this.userIndex}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.platform.log.warn('Auth: Fetch devices returned 401. Attempting token refresh...');
        await this.refreshAccessToken();
        return this.fetchDevices(); // Retry after refresh
      }
      throw new Error(`Fetch devices failed with status ${response.status}`);
    }

    const data = await response.json() as {
      devices: OlarmDevice[];
    };
    this.devices = data.devices || [];
    this.platform.log.info(`Auth: Found ${this.devices.length} device(s).`);
  }

  /**
   * Loads saved tokens from the Homebridge persistent storage
   */
  async loadTokensFromStorage(): Promise<void> {
    try {
      if (await fs.pathExists(this.tokensFilePath)) {
        const cachedTokens = await fs.readJSON(this.tokensFilePath) as TokenCache;
        this.accessToken = cachedTokens.accessToken || null;
        this.refreshToken = cachedTokens.refreshToken || null;
        this.tokenExpiration = cachedTokens.tokenExpiration || null;
        this.userIndex = cachedTokens.userIndex || null;
        this.userId = cachedTokens.userId || null;
        this.platform.log.info('Auth: Tokens successfully loaded from storage.');
      }
    } catch (error) {
      this.platform.log.error('Auth: Failed to load tokens from storage:', (error as Error).message);
    }
  }

  /**
   * Saves the current tokens to the Homebridge persistent storage
   */
  async saveTokensToStorage(): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.tokensFilePath));
      await fs.writeJSON(this.tokensFilePath, {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiration: this.tokenExpiration,
        userIndex: this.userIndex,
        userId: this.userId,
      } as TokenCache);
      this.platform.log.debug('Auth: Tokens successfully saved to storage.');
    } catch (error) {
      this.platform.log.error('Auth: Failed to save tokens to storage:', (error as Error).message);
    }
  }

  /**
   * Get the device matching the configured deviceId
   */
  getDevice(): OlarmDevice | null {
    return this.devices.find(d => d.id === this.platform.config.deviceId) || null;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }
}