#!/bin/bash
# Build script to package the application

# Ensure dependencies are installed
npm install

# Use `pkg` to create a binary executable
pkg server.js --output dist/webapp --targets node18-linux-x64

# Ensure the binary has execute permissions
chmod +x dist/webapp

echo "Build complete! Binary located at dist/webapp"