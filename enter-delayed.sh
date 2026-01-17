#!/bin/bash

# Check if xdotool is installed
if ! command -v xdotool &> /dev/null; then
    echo "Error: xdotool is required but not installed. Please install it with 'sudo apt install xdotool' or equivalent."
    exit 1
fi

read -p "Enter time to press Enter (e.g., 13:39): " user_time

# Calculate execution time
# We use 'date' to handle smart parsing
target_ts=$(date -d "$user_time" +%s 2>/dev/null)

if [ -z "$target_ts" ]; then
    echo "Invalid time format."
    exit 1
fi

current_ts=$(date +%s)

# If target time is in the past, assume it's for tomorrow
if [ "$target_ts" -lt "$current_ts" ]; then
    echo "Time has passed for today, scheduling for tomorrow..."
    target_ts=$(date -d "$user_time tomorrow" +%s)
fi

seconds=$((target_ts - current_ts))

echo "Scheduling Enter key press in $seconds seconds."

# Run in background
(
    sleep "$seconds"
    export DISPLAY="${DISPLAY:-:0}"
    xdotool key Return
) &

echo "Background task started (PID: $!)."
