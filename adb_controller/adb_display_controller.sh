#!/bin/bash

# IMPORTANT: Update this path to your DisplayToggle.dex file
# Make sure DisplayToggle.dex is in the same directory as this script, or specify the full path.
DEX_FILE="$(dirname "$0")/DisplayToggle.dex"
REMOTE_DEX_PATH="/storage/emulated/0/DisplayToggle.dex"

# Function to find adb
find_adb() {
    if command -v adb &> /dev/null; then
        echo "adb"
        return
    fi

    # Common Linux paths
    if [ -f "/usr/bin/adb" ]; then
        echo "/usr/bin/adb"
        return
    fi
    if [ -f "/usr/local/bin/adb" ]; then
        echo "/usr/local/bin/adb"
        return
    fi
    if [ -d "$HOME/Android/Sdk/platform-tools" ]; then
        if [ -f "$HOME/Android/Sdk/platform-tools/adb" ]; then
            echo "$HOME/Android/Sdk/platform-tools/adb"
            return
        fi
    fi

    # Fallback to prompt user
    zenity --error --title="ADB Not Found" --text="ADB executable not found in PATH or common locations.\nPlease specify the full path to your adb executable."
    ADB_PATH=$(zenity --file-selection --title="Select ADB Executable")
    if [ -f "$ADB_PATH" ]; then
        echo "$ADB_PATH"
    else
        zenity --error --title="Error" --text="Invalid ADB path selected. Exiting."
        exit 1
    fi
}

ADB=$(find_adb)
if [ -z "$ADB" ]; then
    exit 1
fi

zenity --info --title="ADB Path" --text="Using ADB from: $ADB"

# Track pushed DEX for devices
declare -A DEX_PUSHED_STATUS

# Function to push DEX file
push_dex() {
    local identifier="$1"
    if [ ! -f "$DEX_FILE" ]; then
        zenity --error --title="Error" --text="DisplayToggle.dex not found at: $DEX_FILE. Please update the script's DEX_FILE path or place it in the same directory."
        return 1
    fi

    if [ "${DEX_PUSHED_STATUS[$identifier]}" == "true" ]; then
        echo "DEX already pushed to $identifier. Skipping push."
        return 0
    fi

    echo "Pushing $DEX_FILE to $identifier..."
    "$ADB" -s "$identifier" push "$DEX_FILE" "$REMOTE_DEX_PATH" 2>&1
    if [ $? -eq 0 ]; then
        echo "DEX pushed successfully to $identifier."
        DEX_PUSHED_STATUS[$identifier]="true"
        return 0
    else
        echo "Error pushing DEX to $identifier."
        return 1
    fi
}

# Function to toggle display
toggle_display() {
    local identifier="$1"
    local state="$2" # 0 for off, 1 for on

    if ! push_dex "$identifier"; then
        # Error message already shown by push_dex
        return 1
    fi

    echo "Toggling display for $identifier to state $state..."
    "$ADB" -s "$identifier" shell CLASSPATH="$REMOTE_DEX_PATH" app_process / DisplayToggle "$state" 2>&1
    if [ $? -eq 0 ]; then
        zenity --info --title="Success" --text="Display toggled for $identifier to state $state."
    else
        zenity --error --title="Error" --text="Failed to toggle display for $identifier."
    fi
}

while true; do
    CHOICE=$(zenity --list --title="ADB Display Controller" --column="Option" \
        "List Wireless Devices" \
        "List USB Devices" \
        "Display OFF (Selected Devices)" \
        "Display ON (Selected Devices)" \
        "Exit" \
        --width=400 --height=300)

    case "$CHOICE" in
        "List Wireless Devices")
            DEVICES_RAW=$("$ADB" devices -l | grep "device" | grep -v "offline" | grep -v "unauthorized" | grep ":") # Filter for IP addresses
            DEVICES=()
            while IFS= read -r line; do
                ID=$(echo "$line" | awk '{print $1}')
                DEVICES+=("$ID" "$line")
            done <<< "$DEVICES_RAW"

            if [ ${#DEVICES[@]} -eq 0 ]; then
                zenity --info --title="No Wireless Devices" --text="No wireless devices found."
            else
                SELECTED_DEVICES=$(zenity --list --title="Select Wireless Devices" --checklist --column="Select" --column="Device ID" "${DEVICES[@]}")
            fi
            ;;
        "List USB Devices")
            DEVICES_RAW=$("$ADB" devices -l | grep "device" | grep -v "offline" | grep -v "unauthorized" | grep -v ":") # Filter out IP addresses
            DEVICES=()
            while IFS= read -r line; do
                ID=$(echo "$line" | awk '{print $1}')
                DEVICES+=("$ID" "$line")
            done <<< "$DEVICES_RAW"

            if [ ${#DEVICES[@]} -eq 0 ]; then
                zenity --info --title="No USB Devices" --text="No USB devices found."
            else
                SELECTED_DEVICES=$(zenity --list --title="Select USB Devices" --checklist --column="Select" --column="Device ID" "${DEVICES[@]}")
            fi
            ;;
        "Display OFF (Selected Devices)")
            if [ -z "$SELECTED_DEVICES" ]; then
                zenity --warning --title="No Selection" --text="Please list and select devices first."
            else
                IFS='|' read -ra ADDR <<< "$SELECTED_DEVICES"
                for i in "${ADDR[@]}"; do
                    toggle_display "$i" 0 & # Run in background for concurrent execution
                done
                wait # Wait for all background jobs to finish
                zenity --info --title="Command Sent" --text="Display OFF command sent to selected devices. Check terminal for individual device status."
            fi
            ;;
        "Display ON (Selected Devices)")
            if [ -z "$SELECTED_DEVICES" ]; then
                zenity --warning --title="No Selection" --text="Please list and select devices first."
            else
                IFS='|' read -ra ADDR <<< "$SELECTED_DEVICES"
                for i in "${ADDR[@]}"; do
                    toggle_display "$i" 1 & # Run in background
                done
                wait # Wait for all background jobs to finish
                zenity --info --title="Command Sent" --text="Display ON command sent to selected devices. Check terminal for individual device status."
            fi
            ;;
        "Exit")
            zenity --question --title="Exit" --text="Are you sure you want to exit?"
            if [ $? -eq 0 ]; then
                break
            fi
            ;;
        *)
            # Handle closing dialog or unexpected input
            break
            ;;
    esac
done

zenity --info --title="ADB Display Controller" --text="Exiting. Goodbye!"