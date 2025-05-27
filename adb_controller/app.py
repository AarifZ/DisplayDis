import subprocess
import os
import platform
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static')

# Path to DisplayToggle.dex (relative to app.py)
DEX_FILE_PATH = os.path.join(app.root_path, 'static', 'DisplayToggle.dex')
# Reverted to original as per your manual test success
DEX_REMOTE_PATH = '/storage/emulated/0/DisplayToggle.dex'

# Store connected devices and their pushed DEX status
# Format: { 'serial_or_ip': {'type': 'usb'|'wireless', 'dex_pushed': True|False} }
CONNECTED_DEVICES = {}

def run_command(command, check_adb=True):
    """Executes a shell command and returns output and error."""
    try:
        # Check for adb availability if not explicitly told not to
        if check_adb and not os.path.exists(os.environ.get('ADB_PATH', 'adb')):
            return None, "ADB Not Found. Please set ADB_PATH environment variable or ensure adb is in your system PATH."

        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8'
        )
        stdout, stderr = process.communicate()
        # Return both, let the calling function decide if stderr is an error
        return stdout.strip(), stderr.strip()
    except Exception as e:
        return None, str(e)

def find_adb_path():
    """Attempts to find adb executable in common locations or environment variables."""
    if os.environ.get('ADB_PATH'):
        return os.environ['ADB_PATH']

    # Common installation paths
    if platform.system() == "Windows":
        paths = [
            os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'sdk', 'platform-tools', 'adb.exe'),
            os.path.join(os.environ.get('PROGRAMFILES', ''), 'Android', 'sdk', 'platform-tools', 'adb.exe')
        ]
    else:  # Linux/macOS
        paths = [
            '/usr/bin/adb',
            '/usr/local/bin/adb',
            os.path.expanduser('~/Android/Sdk/platform-tools/adb')
        ]

    for path in paths:
        if os.path.exists(path):
            os.environ['ADB_PATH'] = path  # Set it for future use
            return path

    # Fallback to system PATH
    return 'adb' # This will rely on adb being in the user's PATH

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_devices', methods=['POST'])
def get_devices():
    mode = request.json.get('mode')
    devices = []
    error = ""
    global CONNECTED_DEVICES
    CONNECTED_DEVICES = {} # Clear previous list

    adb_path = find_adb_path()
    if not adb_path:
        return jsonify({"success": False, "error": "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable."})

    command = f'"{adb_path}" devices -l' # Use quotes for path in case of spaces
    stdout, stderr = run_command(command, check_adb=False) # We already checked adb_path

    if stderr:
        # Check for specific stderr output for 'adb devices' if it's just informational
        if "daemon not running; starting now at" in stderr:
            # ADB daemon starting is not an error, it's just verbose output
            pass
        else:
            error = f"Error executing adb: {stderr}"
            return jsonify({"success": False, "error": error})

    lines = stdout.splitlines()
    for line in lines:
        line = line.strip() # Strip whitespace from the line
        # Filter out empty lines, header, and daemon messages
        if not line or line.startswith("List of devices attached") or line.startswith("* daemon"):
            continue

        if "device" in line and "offline" not in line and "unauthorized" not in line:
            parts = line.split()
            if len(parts) > 1: # Ensure there's at least an identifier and status
                identifier = parts[0]
                if not identifier: # Ensure identifier is not empty after stripping
                    continue

                device_type = "usb"
                if ':' in identifier: # Likely an IP address
                    device_type = "wireless"

                if (mode == 'wireless' and device_type == 'wireless') or \
                   (mode == 'usb' and device_type == 'usb'):
                    devices.append({
                        'identifier': identifier,
                        'type': device_type,
                        'properties': ' '.join(parts[2:]), # Add device properties
                        'dex_pushed': False # Initialize status
                    })
                    CONNECTED_DEVICES[identifier] = {'type': device_type, 'dex_pushed': False}

    return jsonify({"success": True, "devices": devices, "adb_path": adb_path})

@app.route('/push_dex', methods=['POST'])
def push_dex():
    identifier = request.json.get('identifier')
    adb_path = find_adb_path()
    if not adb_path:
        return jsonify({"success": False, "error": "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable."})

    if not os.path.exists(DEX_FILE_PATH):
        return jsonify({"success": False, "error": f"DisplayToggle.dex not found at {DEX_FILE_PATH}. Please ensure it's in the 'static' folder."})

    command = f'"{adb_path}" -s {identifier} push "{DEX_FILE_PATH}" "{DEX_REMOTE_PATH}"'
    stdout, stderr = run_command(command, check_adb=False)

    # Check for actual push errors on stderr, ignoring successful push messages
    if stderr and "file pushed" not in stderr and "transferred" not in stderr and "skipped" not in stderr:
        return jsonify({"success": False, "error": f"Error pushing DEX file: {stderr}"})

    chmod_command = f'"{adb_path}" -s {identifier} shell chmod 755 "{DEX_REMOTE_PATH}"'
    chmod_stdout, chmod_stderr = run_command(chmod_command, check_adb=False)
    if chmod_stderr: # Any stderr from chmod is likely an error
        return jsonify({"success": False, "error": f"Error setting permissions for DEX on {identifier}: {chmod_stderr}"})

    if identifier in CONNECTED_DEVICES:
        CONNECTED_DEVICES[identifier]['dex_pushed'] = True

    return jsonify({"success": True, "message": f"DisplayToggle.dex pushed and permissions set for {identifier}"})

@app.route('/toggle_display', methods=['POST'])
def toggle_display():
    identifiers = request.json.get('identifiers')
    state = request.json.get('state') # '0' for off, '1' for on, '2' for on (reliable)
    results = []

    adb_path = find_adb_path()
    if not adb_path:
        return jsonify({"success": False, "error": "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable."})


    for identifier in identifiers:
        # Check if DEX needs to be pushed
        if identifier in CONNECTED_DEVICES and not CONNECTED_DEVICES[identifier]['dex_pushed']:
            push_res = push_dex_sync(identifier) # Synchronous push
            if not push_res['success']:
                results.append({"identifier": identifier, "success": False, "error": f"Failed to push DEX: {push_res['error']}"})
                continue

        # Removed quotes around DEX_REMOTE_PATH as per debugging
        command = f'"{adb_path}" -s {identifier} shell CLASSPATH={DEX_REMOTE_PATH} app_process / DisplayToggle {state}'
        print(f"DEBUG: Executing command: {command}") # Keep this for debugging
        stdout, stderr = run_command(command, check_adb=False)

        if stderr:
            results.append({"identifier": identifier, "success": False, "error": stderr})
        else:
            results.append({"identifier": identifier, "success": True, "output": stdout})

    return jsonify({"success": True, "results": results})

def push_dex_sync(identifier):
    """Synchronous helper for pushing DEX, used internally."""
    adb_path = find_adb_path()
    if not adb_path:
        return {"success": False, "error": "ADB executable not found."}

    if not os.path.exists(DEX_FILE_PATH):
        return {"success": False, "error": f"DisplayToggle.dex not found at {DEX_FILE_PATH}."}

    command = f'"{adb_path}" -s {identifier} push "{DEX_FILE_PATH}" "{DEX_REMOTE_PATH}"'
    stdout, stderr = run_command(command, check_adb=False)

    # Check for actual push errors on stderr, ignoring successful push messages
    if stderr and "file pushed" not in stderr and "transferred" not in stderr and "skipped" not in stderr:
        return {"success": False, "error": f"Error pushing DEX file: {stderr}"}

    chmod_command = f'"{adb_path}" -s {identifier} shell chmod 755 "{DEX_REMOTE_PATH}"'
    chmod_stdout, chmod_stderr = run_command(chmod_command, check_adb=False)
    if chmod_stderr:
        return {"success": False, "error": f"Error setting permissions for DEX on {identifier}: {chmod_stderr}"}

    if identifier in CONNECTED_DEVICES:
        CONNECTED_DEVICES[identifier]['dex_pushed'] = True
    return {"success": True, "message": f"DisplayToggle.dex pushed and permissions set for {identifier}"}

@app.route('/connect_wireless', methods=['POST'])
def connect_wireless():
    ip_address = request.json.get('ip_address')
    adb_path = find_adb_path()
    if not adb_path:
        return jsonify({"success": False, "error": "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable."})

    # Add default ADB port if not specified
    if ':' not in ip_address:
        ip_address_with_port = f"{ip_address}:5555"
    else:
        ip_address_with_port = ip_address

    command = f'"{adb_path}" connect {ip_address_with_port}'
    stdout, stderr = run_command(command, check_adb=False)

    if "connected to" in stdout:
        return jsonify({"success": True, "output": stdout})
    elif "already connected" in stdout:
        return jsonify({"success": True, "output": stdout}) # Consider "already connected" as a success state
    elif "unable to connect" in stdout or "unable to connect" in stderr:
        return jsonify({"success": False, "error": "Unable to connect to device. Ensure IP is correct, ADB debugging is enabled, and device is reachable."})
    else:
        if stderr:
             return jsonify({"success": False, "error": stderr})
        return jsonify({"success": False, "error": "Unknown error during connection."})


@app.route('/disconnect_wireless', methods=['POST'])
def disconnect_wireless():
    ip_address_or_identifier = request.json.get('ip_address')
    adb_path = find_adb_path()
    if not adb_path:
        return jsonify({"success": False, "error": "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable."})

    command = f'"{adb_path}" disconnect {ip_address_or_identifier}'
    stdout, stderr = run_command(command, check_adb=False)

    if "disconnected" in stdout:
        return jsonify({"success": True, "output": stdout})
    elif stderr:
        return jsonify({"success": False, "error": stderr})
    else:
        return jsonify({"success": False, "error": "Unknown error during disconnection."})


@app.route('/enable_tcpip', methods=['POST'])
def enable_tcpip():
    identifier = request.json.get('identifier') # This will be the USB device's serial
    adb_path = find_adb_path()
    if not adb_path:
        return jsonify({"success": False, "error": "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable."})

    port = 5555
    command = f'"{adb_path}" -s {identifier} tcpip {port}'
    stdout, stderr = run_command(command, check_adb=False)

    if "restarting in TCP mode" in stdout:
        return jsonify({"success": True, "output": stdout})
    elif stderr:
        return jsonify({"success": False, "error": stderr})
    else:
        return jsonify({"success": False, "error": "Unknown error when enabling TCP/IP mode."})


# Route to serve DisplayToggle.dex
@app.route('/static/DisplayToggle.dex')
def serve_dex_file():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'DisplayToggle.dex')

if __name__ == '__main__':
    print(f"DEX file expected at: {DEX_FILE_PATH}")
    if not os.path.exists(DEX_FILE_PATH):
        print("WARNING: DisplayToggle.dex not found in 'static' folder. Please place it there.")

    adb_path = find_adb_path()
    if adb_path:
        print(f"ADB executable found at: {adb_path}")
    else:
        print("ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable.")

    app.run(debug=True, port=5000)