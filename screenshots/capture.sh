#!/bin/bash
# Screenshot capture script for the VR Collector app
# Run this, then click on the Electron app window within 3 seconds

echo "Click on the Electron app window NOW! (3 seconds...)"
sleep 3
screencapture -x screenshots/app-capture-$(date +%Y%m%d-%H%M%S).png
echo "Screenshot saved to screenshots/"
open screenshots/
