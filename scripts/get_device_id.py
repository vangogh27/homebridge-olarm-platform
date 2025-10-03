#!/usr/bin/env python3
"""
Olarm Device ID Retriever

This script authenticates with the Olarm API and retrieves all devices
associated with your account, displaying their Device IDs and IMEIs.

Usage:
    python3 get_device_id.py

Requirements:
    pip install requests
"""

import requests
import json
import getpass
import sys

# Define the API endpoints
AUTH_BASE_URL = 'https://auth.olarm.com'
LEGACY_API_BASE_URL = 'https://api-legacy.olarm.com'


def main():
    """
    Retrieves all Olarm devices and their IDs for the authenticated user.
    """
    print("=" * 60)
    print(" Olarm Device ID Retriever")
    print(" For homebridge-olarm-platform configuration")
    print("=" * 60)
    
    # Get credentials
    email = input("\nEnter your Olarm account email: ").strip()
    password = getpass.getpass("Enter your Olarm account password: ")
    
    if not email or not password:
        print("\n❌ Email and password are required.")
        sys.exit(1)
    
    session = requests.Session()
    
    try:
        # Step 1: Login
        print("\n[1/3] Authenticating...", end=" ")
        login_url = f'{AUTH_BASE_URL}/api/v4/oauth/login/mobile'
        login_response = session.post(login_url, data={
            'userEmailPhone': email,
            'userPass': password,
        })
        login_response.raise_for_status()
        login_data = login_response.json()
        access_token = login_data.get('oat')
        
        if not access_token:
            raise ValueError("Login failed - no access token received.")
        print("✓ Success")
        
        # Step 2: Get user index
        print("[2/3] Fetching user details...", end=" ")
        user_index_url = f'{AUTH_BASE_URL}/api/v4/oauth/federated-link-existing?oat={access_token}'
        user_index_response = session.post(user_index_url, data={
            'userEmailPhone': email,
            'userPass': password,
            'captchaToken': 'olarmapp',
        })
        user_index_response.raise_for_status()
        user_index_data = user_index_response.json()
        user_index = user_index_data.get('userIndex')
        
        if not user_index:
            raise ValueError("User index not found.")
        print(f"✓ Success (User Index: {user_index})")
        
        # Step 3: Get devices
        print("[3/3] Retrieving device list...", end=" ")
        devices_url = f'{LEGACY_API_BASE_URL}/api/v2/users/{user_index}'
        devices_response = session.get(
            devices_url,
            headers={'Authorization': f'Bearer {access_token}'}
        )
        devices_response.raise_for_status()
        devices_data = devices_response.json()
        devices = devices_data.get('devices', [])
        print(f"✓ Success ({len(devices)} device(s) found)")
        
        if not devices:
            print("\n⚠️  No devices found for this account.")
            print("Please ensure you have devices registered in the Olarm app.")
            return
        
        # Display results
        print("\n" + "=" * 60)
        print(" YOUR OLARM DEVICES")
        print("=" * 60)
        
        for i, device in enumerate(devices, 1):
            device_name = device.get('deviceName', 'Unnamed Device')
            device_id = device.get('id', 'N/A')
            device_imei = device.get('IMEI', 'N/A')
            
            print(f"\n📱 DEVICE #{i}: {device_name}")
            print(f"   Device ID:   {device_id}")
            print(f"   IMEI:        {device_imei}")
        
        print("\n" + "=" * 60)
        print("\n✅ Configuration Instructions:")
        print("\n1. Copy the 'Device ID' value from above")
        print("2. Add it to your Homebridge config.json:")
        print('\n   "platforms": [')
        print('     {')
        print('       "platform": "Olarm",')
        print('       "name": "Olarm",')
        print(f'       "deviceId": "{devices[0].get("id", "YOUR_DEVICE_ID")}",')
        print('       "primaryAuth": {')
        print(f'         "email": "{email}",')
        print('         "password": "YOUR_PASSWORD"')
        print('       }')
        print('     }')
        print('   ]')
        print("\n3. Restart Homebridge")
        print("\n" + "=" * 60)
    
    except requests.exceptions.HTTPError as e:
        print("\n")
        print("=" * 60)
        print(" ❌ ERROR")
        print("=" * 60)
        print(f"\nHTTP Error: {e.response.status_code} {e.response.reason}")
        try:
            error_body = e.response.json()
            message = error_body.get('message', e.response.text)
            print(f"Message: {message}")
        except json.JSONDecodeError:
            print(f"Response: {e.response.text}")
        
        if e.response.status_code == 401:
            print("\n💡 Tip: Check your email and password are correct.")
        print("=" * 60)
        sys.exit(1)
    
    except requests.exceptions.RequestException as e:
        print("\n")
        print("=" * 60)
        print(" ❌ NETWORK ERROR")
        print("=" * 60)
        print(f"\nFailed to connect to Olarm API: {e}")
        print("\n💡 Tip: Check your internet connection.")
        print("=" * 60)
        sys.exit(1)
    
    except Exception as e:
        print("\n")
        print("=" * 60)
        print(" ❌ UNEXPECTED ERROR")
        print("=" * 60)
        print(f"\n{type(e).__name__}: {e}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled by user")
        sys.exit(0)