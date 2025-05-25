# ADB Display Controller (Python Flask)

A web-based tool to control Android device displays (ON/OFF) using ADB (Android Debug Bridge), featuring both USB and wireless connectivity management. This project provides a simple, intuitive interface to interact with multiple Android devices simultaneously.

## ✨ Features

* **Display Toggle:** Turn selected Android device displays OFF (`0`) or ON (`2`) using a custom DEX executable.
* **USB Mode:** Automatically list and control devices connected via USB.
* **Wireless Mode:**
    * **Connect Wireless:** Easily connect to Android devices over Wi-Fi by entering their IP address (e.g., `192.168.1.100` or `192.168.1.100:5555`).
    * **Disconnect Wireless:** Disconnect selected wireless ADB connections.
    * **Enable TCP/IP:** Switch a USB-connected device to TCP/IP mode (`adb tcpip 5555`) for wireless debugging.
* **Multi-Device Control:** Select and apply commands to multiple devices simultaneously.
* **Real-time Logging:** View command output and status messages directly in the web interface.
* **Automatic DEX Push:** The `DisplayToggle.dex` file is automatically pushed to devices when a toggle command is issued, if it hasn't been pushed already.
* **ADB Path Auto-detection:** Attempts to find your `adb` executable automatically.

## 🚀 Getting Started

Follow these steps to set up and run the ADB Display Controller.

### Prerequisites

* **Python 3.x:** Make sure you have Python installed.
* **Flask:** The web framework used by the application.
* **Android Debug Bridge (ADB):** Download and set up ADB on your system. It's recommended to add the `platform-tools` directory (where `adb.exe` or `adb` is located) to your system's PATH environment variable for easy access.
    * [Download ADB (Platform-tools)](https://developer.android.com/tools/releases/platform-tools)
    * [How to add ADB to PATH (Windows)](https://www.xda-developers.com/install-adb-windows-powershell/)
    * [How to add ADB to PATH (macOS/Linux)](https://www.xda-developers.com/install-adb-fastboot-linux-mac-os/)
* **`DisplayToggle.dex`:** A compiled Android DEX (Dalvik Executable) file designed to toggle the display. This project assumes you have this file. It should contain logic to turn the display on or off based on an argument (e.g., `0` for off, `2` for on).
    * **Place this file in the `adb_controller/static/` directory.**

### 📄 DEX File (DisplayToggle.dex) Credit

The `DisplayToggle.dex` file used in this project is based on the work from:

* **HunterXProgrammer/DisplayToggle:** [https://github.com/HunterXProgrammer/DisplayToggle](https://github.com/HunterXProgrammer/DisplayToggle)

This project relies on `DisplayToggle.dex` to perform the actual display on/off operations on the Android device. Ensure you have a compiled `DisplayToggle.dex` from this (or a compatible) source and place it in the `adb_controller/static/` directory.

### Installation

1.  **Clone the Repository (or download the files):**
    ```bash
    git clone [https://github.com/YOUR_USERNAME/adb-display-controller.git](https://github.com/YOUR_USERNAME/adb-display-controller.git)
    cd adb-display-controller
    ```
    *(Replace `YOUR_USERNAME` with your GitHub username or the actual repository URL)*

2.  **Navigate to the Project Directory:**
    Ensure your terminal is in the root directory of the project (e.g., `adb_controller`).

3.  **Install Dependencies:**
    It's recommended to use a virtual environment:
    ```bash
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate

    pip install Flask
    ```

4.  **Place `DisplayToggle.dex`:**
    Make sure your `DisplayToggle.dex` file is located at:
    `adb_controller/static/DisplayToggle.dex`

## 🏃 Running the Application

1.  **Activate your virtual environment (if not already active):**
    ```bash
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate
    ```

2.  **Run the Flask Application:**
    ```bash
    python app.py
    ```
    You will see output in your terminal indicating that the Flask server is running, typically on `http://127.0.0.1:5000/`.

3.  **Open in Browser:**
    Navigate to `http://127.0.0.1:5000/` in your web browser.

## 💻 Usage

### Initial Setup

* **Connect Devices:** Connect your Android devices via USB, or ensure they have ADB over Wi-Fi enabled and are discoverable on the same network.
* **Enable ADB Debugging:** On your Android device(s), go to `Developer options` and enable `USB debugging` and/or `Wireless debugging`.

### Using the Interface

1.  **Select Mode:** Choose between `Wireless Mode` or `USB Mode` depending on how your devices are connected.
2.  **List Devices:** Click `List Devices` to populate the list of connected devices. The application will auto-detect whether they are USB or wireless.
3.  **Wireless Management (if applicable):**
    * **Enable TCP/IP (from USB):** If you're in `USB Mode`, select exactly one USB device, then click `Enable TCP/IP (USB Device)`. This will switch the device's ADB daemon to listen on port 5555. You can then disconnect the USB cable.
    * **Connect Wireless:** In `Wireless Mode`, enter the IP address (e.g., `192.168.1.100`) or IP:Port (e.g., `192.168.1.100:5555`) of your Android device into the input field and click `Connect Wireless`.
    * **Disconnect Wireless:** In `Wireless Mode`, select one or more wireless devices from the list and click `Disconnect Wireless`.
4.  **Select Devices:** Check the boxes next to the devices you wish to control. You can use `Select All` or `Deselect All` buttons.
5.  **Toggle Display:**
    * Click `Display OFF` to turn the display of selected devices off (sends `0`).
    * Click `Display ON` to turn the display of selected devices on (sends `2`).
6.  **Monitor Output:** The `Command Output` area will display the results of your ADB commands and any errors.

## ⚠️ Troubleshooting

* **"ADB executable not found."**:
    * **Solution 1 (Recommended):** Add the `platform-tools` directory (containing `adb.exe` or `adb`) to your system's PATH environment variable.
    * **Solution 2 (Temporary):** Set an `ADB_PATH` environment variable in your terminal *before* running `python app.py`:
        * **Windows (Command Prompt):** `set ADB_PATH=C:\path\to\your\platform-tools\adb.exe`
        * **Windows (PowerShell):** `$env:ADB_PATH="C:\path\to\your\platform-tools\adb.exe"`
        * **Linux/macOS:** `export ADB_PATH=/path/to/your/platform-tools/adb`
* **`DisplayToggle.dex` not found:** Ensure `DisplayToggle.dex` is placed inside the `adb_controller/static/` directory.
* **Device not listed:**
    * Ensure ADB debugging is enabled on your device.
    * For USB, check your USB cable and device driver.
    * For wireless, ensure the device is on the same network, you've connected to its IP using `adb connect` (either manually or via the UI), and there are no firewall issues blocking port 5555.
* **`DisplayToggle.dex` runs but doesn't affect display:**
    * This indicates the `adb` command and DEX execution are working. The issue lies within your `DisplayToggle.dex` logic or Android device permissions/version compatibility.
    * Review the source code of your `DisplayToggle.dex` for necessary Android permissions or API calls for display control.
    * Test the command manually: `adb -s <device_id> shell CLASSPATH=/storage/emulated/0/DisplayToggle.dex app_process / DisplayToggle 0` (or `2`). If this works, but the UI doesn't, check the Flask app's debug logs for the exact command being run.
* **"List" dummy checkbox appears:** This issue has been addressed in the latest code. Ensure you have the most up-to-date `app.py` and `script.js` files. If it persists, it might be due to unexpected `adb devices -l` output specific to your setup.

## 🤝 Contributing

Feel free to open issues or submit pull requests for any improvements or bug fixes.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
