document.addEventListener('DOMContentLoaded', () => {
    const listDevicesBtn = document.getElementById('listDevicesBtn');
    const wirelessModeBtn = document.getElementById('wirelessModeBtn');
    const usbModeBtn = document.getElementById('usbModeBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const toggleOffBtn = document.getElementById('toggleOffBtn');
    const toggleOnBtn = document.getElementById('toggleOnBtn');
    const deviceList = document.getElementById('deviceList');
    const outputLog = document.getElementById('outputLog');
    const errorMessageDiv = document.getElementById('errorMessage');
    const successMessageDiv = document.getElementById('successMessage');
    const adbStatusDiv = document.getElementById('adbStatus');

    // NEW DOM elements
    const wirelessIpInput = document.getElementById('wirelessIpInput');
    const connectWirelessBtn = document.getElementById('connectWirelessBtn');
    const disconnectWirelessBtn = document.getElementById('disconnectWirelessBtn');
    const enableTcpipBtn = document.getElementById('enableTcpipBtn');
    const wirelessConnectSection = document.getElementById('wirelessConnectSection');
    const wirelessConnectStatus = document.getElementById('wirelessConnectStatus');

    let currentMode = 'wireless'; // Default mode

    // Helper to clear messages
    const clearMessages = () => {
        errorMessageDiv.textContent = '';
        successMessageDiv.textContent = '';
    };

    // Helper to show error
    const showError = (message) => {
        clearMessages();
        errorMessageDiv.textContent = `Error: ${message}`;
        console.error(message);
    };

    // Helper to show success
    const showSuccess = (message) => {
        clearMessages();
        successMessageDiv.textContent = `Success: ${message}`;
        console.log(message);
    };

    // Helper to append to output log
    const appendToLog = (message, isError = false) => {
        const timestamp = new Date().toLocaleTimeString();
        outputLog.textContent += `[${timestamp}] ${message}\n`;
        outputLog.scrollTop = outputLog.scrollHeight; // Auto-scroll to bottom
        if (isError) {
            console.error(message);
        } else {
            console.log(message);
        }
    };

    // Function to update mode button active state and section visibility
    const updateModeButtons = () => {
        wirelessModeBtn.classList.toggle('active', currentMode === 'wireless');
        usbModeBtn.classList.toggle('active', currentMode === 'usb');

        if (currentMode === 'wireless') {
            wirelessConnectSection.classList.remove('hidden');
            enableTcpipBtn.classList.add('hidden'); // Hide enable TCP/IP button in wireless mode
        } else { // USB Mode
            wirelessConnectSection.classList.add('hidden'); // Hide IP input/connect button in USB mode
            enableTcpipBtn.classList.remove('hidden'); // Show enable TCP/IP button in USB mode
            // Always start disabled for USB mode until a device is selected
            enableTcpipBtn.classList.add('disabled');
        }
        wirelessConnectStatus.textContent = ''; // Clear status when mode changes
        wirelessIpInput.value = ''; // Clear input
        // Also clear device list and log
        deviceList.innerHTML = '';
        outputLog.textContent = '';
        clearMessages();
        adbStatusDiv.textContent = '';
    };

    // Event listeners for mode selection
    wirelessModeBtn.addEventListener('click', () => {
        currentMode = 'wireless';
        updateModeButtons();
    });

    usbModeBtn.addEventListener('click', () => {
        currentMode = 'usb';
        updateModeButtons();
        // usbModeBtn.click(); // Trigger list devices for USB mode automatically if desired
    });

    listDevicesBtn.addEventListener('click', async () => {
        clearMessages();
        deviceList.innerHTML = ''; // Clear previous devices
        outputLog.textContent = ''; // Clear previous log
        wirelessConnectStatus.textContent = ''; // Clear wireless status on re-list

        appendToLog(`Listing devices in ${currentMode} mode...`);

        try {
            const response = await fetch('/get_devices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mode: currentMode })
            });
            const data = await response.json();

            if (data.success) {
                if (data.adb_path) {
                    adbStatusDiv.textContent = `ADB executable found at: ${data.adb_path}`;
                    adbStatusDiv.classList.remove('error-message');
                    adbStatusDiv.classList.add('status-message');
                } else {
                    adbStatusDiv.textContent = "ADB executable not found. Please ensure it's in your system PATH or set the ADB_PATH environment variable.";
                    adbStatusDiv.classList.remove('status-message');
                    adbStatusDiv.classList.add('error-message');
                }

                if (data.devices.length === 0) {
                    appendToLog(`No ${currentMode} devices found.`, true);
                    showError(`No ${currentMode} devices found.`);
                } else {
                    showSuccess(`Found ${data.devices.length} ${currentMode} devices.`);
                    data.devices.forEach(device => {
                        const listItem = document.createElement('li');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = device.identifier;
                        checkbox.dataset.dexPushed = device.dex_pushed; // Store DEX push status

                        const textSpan = document.createElement('span');
                        textSpan.textContent = device.identifier;

                        const typeSpan = document.createElement('span');
                        typeSpan.classList.add('device-type');
                        typeSpan.textContent = device.type.toUpperCase();

                        listItem.appendChild(checkbox);
                        listItem.appendChild(textSpan);
                        listItem.appendChild(typeSpan);

                        deviceList.appendChild(listItem);
                    });
                }
            } else {
                showError(data.error || "Failed to list devices.");
                adbStatusDiv.textContent = data.error || "Failed to list devices. Check console for details.";
                adbStatusDiv.classList.remove('status-message');
                adbStatusDiv.classList.add('error-message');
            }
            updateEnableTcpipButtonState(); // Update TCP/IP button state after listing
        } catch (error) {
            showError(`Network or server error: ${error.message}`);
            appendToLog(`Network or server error: ${error.message}`, true);
        }
    });

    selectAllBtn.addEventListener('click', () => {
        deviceList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
            checkbox.closest('li').classList.add('selected');
        });
        updateEnableTcpipButtonState(); // Update TCP/IP button on select all
    });

    deselectAllBtn.addEventListener('click', () => {
        deviceList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.closest('li').classList.remove('selected');
        });
        updateEnableTcpipButtonState(); // Update TCP/IP button on deselect all
    });

    deviceList.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            event.target.closest('li').classList.toggle('selected', event.target.checked);
            updateEnableTcpipButtonState(); // Update TCP/IP button state
        }
    });

    // Function to update the state of the Enable TCP/IP button
    const updateEnableTcpipButtonState = () => {
        if (currentMode === 'usb') {
            const selectedUsbDevices = Array.from(deviceList.querySelectorAll('input[type="checkbox"]:checked'))
                                         .filter(cb => cb.closest('li').querySelector('.device-type').textContent === 'USB');
            if (selectedUsbDevices.length === 1) { // Only enable if exactly one USB device is selected
                enableTcpipBtn.classList.remove('disabled');
            } else {
                enableTcpipBtn.classList.add('disabled');
            }
        }
    };

    // Event listener for wireless connection
    connectWirelessBtn.addEventListener('click', async () => {
        clearMessages();
        wirelessConnectStatus.textContent = ''; // Clear previous status
        const ipAddress = wirelessIpInput.value.trim();

        if (!ipAddress) {
            wirelessConnectStatus.textContent = 'Please enter an IP address.';
            wirelessConnectStatus.classList.remove('status-message', 'success-message');
            wirelessConnectStatus.classList.add('error-message');
            return;
        }

        wirelessConnectStatus.textContent = `Attempting to connect to ${ipAddress}...`;
        wirelessConnectStatus.classList.remove('error-message', 'success-message');
        wirelessConnectStatus.classList.add('status-message');
        appendToLog(`Attempting adb connect ${ipAddress}...`);

        try {
            const response = await fetch('/connect_wireless', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip_address: ipAddress })
            });
            const data = await response.json();

            if (data.success) {
                wirelessConnectStatus.textContent = `Successfully connected to ${ipAddress}.`;
                wirelessConnectStatus.classList.remove('status-message', 'error-message');
                wirelessConnectStatus.classList.add('success-message');
                appendToLog(`adb connect ${ipAddress} successful: ${data.output}`);
                // Automatically list devices after a successful connection to see the new device
                listDevicesBtn.click();
            } else {
                wirelessConnectStatus.textContent = `Failed to connect: ${data.error}`;
                wirelessConnectStatus.classList.remove('status-message', 'success-message');
                wirelessConnectStatus.classList.add('error-message');
                appendToLog(`adb connect ${ipAddress} failed: ${data.error}`, true);
            }
        } catch (error) {
            wirelessConnectStatus.textContent = `Network or server error: ${error.message}`;
            wirelessConnectStatus.classList.remove('status-message', 'success-message');
            wirelessConnectStatus.classList.add('error-message');
            appendToLog(`Network or server error during adb connect: ${error.message}`, true);
        }
    });

    // Event listener for disconnect wireless
    disconnectWirelessBtn.addEventListener('click', async () => {
        clearMessages();
        wirelessConnectStatus.textContent = ''; // Clear previous status

        const selectedWirelessDevices = Array.from(deviceList.querySelectorAll('input[type="checkbox"]:checked'))
                                             .filter(cb => cb.closest('li').querySelector('.device-type').textContent === 'WIRELESS');

        if (selectedWirelessDevices.length === 0) {
            showError("No wireless devices selected for disconnection.");
            return;
        }

        const identifiersToDisconnect = selectedWirelessDevices.map(cb => cb.value);
        let successCount = 0;
        let failCount = 0;

        for (const identifier of identifiersToDisconnect) {
            appendToLog(`Attempting to disconnect ${identifier}...`);
            try {
                const response = await fetch('/disconnect_wireless', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip_address: identifier }) // The identifier is the IP:port
                });
                const data = await response.json();

                if (data.success) {
                    appendToLog(`Successfully disconnected ${identifier}: ${data.output}`);
                    successCount++;
                } else {
                    appendToLog(`Failed to disconnect ${identifier}: ${data.error}`, true);
                    failCount++;
                }
            } catch (error) {
                appendToLog(`Network or server error during disconnect ${identifier}: ${error.message}`, true);
                failCount++;
            }
        }

        if (successCount > 0) {
            showSuccess(`Disconnected ${successCount} device(s).`);
            listDevicesBtn.click(); // Re-list devices to update status
        }
        if (failCount > 0) {
            showError(`Failed to disconnect ${failCount} device(s). Check log for details.`);
        }
    });


    // Event listener for enabling TCP/IP
    enableTcpipBtn.addEventListener('click', async () => {
        clearMessages();
        wirelessConnectStatus.textContent = ''; // Clear previous status

        const selectedUsbDevices = Array.from(deviceList.querySelectorAll('input[type="checkbox"]:checked'))
                                     .filter(cb => cb.closest('li').querySelector('.device-type').textContent === 'USB');

        if (selectedUsbDevices.length !== 1) {
            showError("Please select exactly ONE USB device to enable TCP/IP.");
            return;
        }

        const identifier = selectedUsbDevices[0].value;
        appendToLog(`Attempting to enable TCP/IP mode on ${identifier}...`);

        try {
            const response = await fetch('/enable_tcpip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier: identifier })
            });
            const data = await response.json();

            if (data.success) {
                wirelessConnectStatus.textContent = `TCP/IP mode enabled on ${identifier}. You can now disconnect USB and connect wirelessly via its IP.`;
                wirelessConnectStatus.classList.remove('status-message', 'error-message');
                wirelessConnectStatus.classList.add('success-message');
                appendToLog(`TCP/IP enabled for ${identifier}: ${data.output}`);
                // After enabling TCP/IP, it's often good to 'adb disconnect' any existing wireless connection
                // if the device was previously connected wirelessly, then re-connect via IP.
                // For simplicity, we just inform the user here.
            } else {
                wirelessConnectStatus.textContent = `Failed to enable TCP/IP on ${identifier}: ${data.error}`;
                wirelessConnectStatus.classList.remove('status-message', 'success-message');
                wirelessConnectStatus.classList.add('error-message');
                appendToLog(`Failed to enable TCP/IP for ${identifier}: ${data.error}`, true);
            }
        } catch (error) {
            wirelessConnectStatus.textContent = `Network or server error: ${error.message}`;
            wirelessConnectStatus.classList.remove('status-message', 'success-message');
            wirelessConnectStatus.classList.add('error-message');
            appendToLog(`Network or server error during TCP/IP enable: ${error.message}`, true);
        }
    });


    const executeToggleCommand = async (state) => {
        clearMessages();
        outputLog.textContent = ''; // Clear previous log for new execution

        const selectedDevices = Array.from(deviceList.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(cb => cb.value);

        if (selectedDevices.length === 0) {
            showError("No devices selected. Please select at least one device.");
            return;
        }

        appendToLog(`Attempting to turn display ${state === '0' ? 'OFF' : 'ON'} for selected devices...`);

        try {
            const response = await fetch('/toggle_display', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifiers: selectedDevices, state: state })
            });
            const data = await response.json();

            if (data.success) {
                showSuccess("Display toggle commands sent successfully!");
                data.results.forEach(result => {
                    if (result.success) {
                        appendToLog(`[${result.identifier}] Display toggled. Output: ${result.output || 'No specific output.'}`);
                    } else {
                        appendToLog(`[${result.identifier}] Failed to toggle display. Error: ${result.error}`, true);
                    }
                });
            } else {
                showError(data.error || "Failed to send toggle commands.");
                appendToLog(`Global error: ${data.error || "Failed to send toggle commands."}`, true);
            }
        } catch (error) {
            showError(`Network or server error: ${error.message}`);
            appendToLog(`Network or server error: ${error.message}`, true);
        }
    };

    toggleOffBtn.addEventListener('click', () => executeToggleCommand('0'));
    toggleOnBtn.addEventListener('click', () => executeToggleCommand('2'));

    // Initial setup
    updateModeButtons(); // Call this once to set initial state
    // Prompt user to list devices on page load
    adbStatusDiv.textContent = "Click 'List Devices' to find connected devices. Ensure ADB is in your system PATH or ADB_PATH env variable is set.";
    adbStatusDiv.classList.add('status-message');
});