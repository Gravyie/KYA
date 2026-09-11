#!/usr/bin/env python3
"""
Extracts authenticated X (Twitter) cookies from local Google Chrome profile on Linux.
Uses GNOME Keyring (via D-Bus) to retrieve the Chrome Safe Storage key and decrypts
the Cookies SQLite database directly, saving a Playwright-compatible storageState file.
"""

import sys
import os
import sqlite3
import json
import dbus
from pathlib import Path
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

def get_chrome_safe_storage_key():
    """Retrieve the encryption key from GNOME Keyring via D-Bus."""
    try:
        bus = dbus.SessionBus()
        service = bus.get_object('org.freedesktop.secrets', '/org/freedesktop/secrets')
        secrets_iface = dbus.Interface(service, 'org.freedesktop.Secret.Service')
        _, session = secrets_iface.OpenSession('plain', '')

        # Try schema query first
        unlocked, _ = secrets_iface.SearchItems({
            'application': 'chrome',
            'xdg:schema': 'chrome_libsecret_os_crypt_password_v2'
        })
        
        # Fallback: search all items if specific schema not found
        if not unlocked:
            all_items, _ = secrets_iface.SearchItems({})
            for item_path in all_items:
                obj = bus.get_object('org.freedesktop.secrets', item_path)
                props = dbus.Interface(obj, 'org.freedesktop.DBus.Properties')
                try:
                    label = str(props.Get('org.freedesktop.Secret.Item', 'Label'))
                    if 'Chrome Safe Storage' in label:
                        unlocked = [item_path]
                        break
                except Exception:
                    continue

        if unlocked:
            item = bus.get_object('org.freedesktop.secrets', unlocked[0])
            item_iface = dbus.Interface(item, 'org.freedesktop.Secret.Item')
            secret = item_iface.GetSecret(session)
            return bytes(secret[2])
    except Exception:
        pass
    
    # Fallback to Chromium hardcoded default password
    return b'peanuts'

def decrypt_v10_v11(encrypted_val, key):
    """Decrypt v10/v11 Chrome Linux cookie."""
    if not (encrypted_val.startswith(b'v10') or encrypted_val.startswith(b'v11')):
        return encrypted_val.decode('utf-8', errors='ignore')

    cipher = Cipher(algorithms.AES(key), modes.CBC(b' ' * 16))
    dec = cipher.decryptor().update(encrypted_val[3:])
    # Strip 32-byte HMAC-SHA256 signature
    val = dec[32:]
    # Strip PKCS#7 padding
    pad = val[-1]
    if 1 <= pad <= 16:
        val = val[:-pad]
    return val.decode('utf-8', errors='ignore')

def extract_cookies(target_path=None):
    if not target_path:
        target_path = os.path.join(os.path.dirname(__file__), '.storage', 'x-session.json')

    home = os.path.expanduser('~')
    possible_cookie_paths = [
        os.path.join(home, '.config', 'google-chrome', 'Default', 'Cookies'),
        os.path.join(home, '.config', 'google-chrome', 'Profile 1', 'Cookies'),
        os.path.join(home, '.config', 'chromium', 'Default', 'Cookies'),
    ]

    cookie_db = None
    for p in possible_cookie_paths:
        if os.path.exists(p):
            cookie_db = p
            break

    if not cookie_db:
        return {'success': False, 'error': 'Google Chrome cookie database not found'}

    raw_secret = get_chrome_safe_storage_key()
    kdf = PBKDF2HMAC(algorithm=hashes.SHA1(), length=16, salt=b'saltysalt', iterations=1)
    key = kdf.derive(raw_secret)

    # Use immutable URI mode to read without locking conflict with running Chrome
    uri = f"file:{cookie_db}?immutable=1"
    try:
        con = sqlite3.connect(uri, uri=True)
    except Exception:
        con = sqlite3.connect(cookie_db)

    cur = con.cursor()
    cur.execute('''
        SELECT host_key, name, path, is_secure, is_httponly, expires_utc, samesite, encrypted_value 
        FROM cookies 
        WHERE host_key LIKE "%x.com%" OR host_key LIKE "%twitter.com%"
    ''')

    samesite_map = {0: 'None', 1: 'Lax', 2: 'Strict'}
    playwright_cookies = []
    has_auth_token = False

    for host, name, path, is_sec, is_http, exp_utc, samesite, enc in cur.fetchall():
        val = decrypt_v10_v11(enc, key)
        if name == 'auth_token' and val:
            has_auth_token = True

        expires = -1
        if exp_utc and exp_utc > 0:
            expires = (exp_utc / 1000000.0) - 11644473600.0

        playwright_cookies.append({
            'name': name,
            'value': val,
            'domain': host,
            'path': path,
            'expires': expires,
            'httpOnly': bool(is_http),
            'secure': bool(is_sec),
            'sameSite': samesite_map.get(samesite, 'None')
        })

    con.close()

    if not playwright_cookies or not has_auth_token:
        return {
            'success': False,
            'error': 'No authenticated X session (auth_token) found in Chrome cookies',
            'cookies_count': len(playwright_cookies)
        }

    storage = {
        'cookies': playwright_cookies,
        'origins': []
    }

    os.makedirs(os.path.dirname(os.path.abspath(target_path)), exist_ok=True)
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(storage, f, indent=2)

    return {
        'success': True,
        'cookies_count': len(playwright_cookies),
        'has_auth_token': has_auth_token,
        'target_path': target_path,
        'cookie_names': [c['name'] for c in playwright_cookies]
    }

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    res = extract_cookies(target)
    print(json.dumps(res))
    if not res.get('success'):
        sys.exit(1)
