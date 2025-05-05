# Monome Grid Web Serial API Test

This project demonstrates how to connect to a Monome Grid using the Web Serial API and Web Audio API. It implements the Monome Serial Protocol for full control of the grid.

## Features

- Connect to a Monome Grid device via the Web Serial API
- Visual grid representation in the browser
- Bi-directional communication with the device:
  - Send LED on/off commands
  - Send row, column, and map (8x8 block) commands
  - Control LED intensity levels
  - Receive button press/release events
- Play tones using Web Audio API when buttons are pressed
- Interactive test pattern to visualize the connection
- Deno application for testing grid connections via serialosc
- CLI tool for debugging and monitoring Monome Grid serial communication

## Requirements

- A Chromium-based browser that supports the Web Serial API (Chrome, Edge, Opera)
- A Monome Grid device (monome grid 64/128/256)
- Local web server (optional, but recommended)

## Setup Instructions

1. Connect your Monome Grid to your computer via USB
2. Host these files on a local web server with
   - `deno task start`
3. Open the webpage in a Chrome-based browser
4. Click the "Connect to Monome Grid" button
5. Select your Monome Grid from the serial port list (typically shows as a USB Serial device)
6. Start interacting with the grid!

## Note

Web Serial API will not work if serialosc is running in the background.

On macOS, use:

- `brew services stop serialosc`
- `brew services start serialosc`

... to stop and start serialosc, respectively.

## Technical Details

### Monome Serial Protocol

This implementation uses the complete Monome Serial Protocol:

#### System Commands
- Query Device: `[0x00]`
- Get Device ID: `[0x01]`
- Get Grid Size: `[0x05]`

#### LED Commands
- Set LED Off: `[0x10, x, y]`
- Set LED On: `[0x11, x, y]`
- Set All LEDs Off: `[0x12]`
- Set All LEDs On: `[0x13]`
- Set LED Map (8x8 block): `[0x14, x, y, data[8]]`
- Set LED Row: `[0x15, x, y, data]`
- Set LED Column: `[0x16, x, y, data]`
- Set LED Intensity: `[0x17, level]`
- Set LED Level: `[0x18, x, y, level]`

#### Key Grid Responses
- Key Up: `[0x20, x, y]`
- Key Down: `[0x21, x, y]`

### Web Serial API

The Web Serial API is used to communicate with the Monome Grid over USB. Configuration:

- Baud rate: 115200
- Data bits: 8
- Stop bits: 1
- Parity: None
- Buffer size: 64KB

### Web Audio API

The project uses the Web Audio API to generate tones when buttons are pressed:

- X-axis position maps to frequency using a pentatonic scale
- Y-axis position maps to note duration
- Simple envelope with attack and release for pleasant tones

## Usage Examples

### Controlling LEDs

```javascript
// Set a single LED on
await setLED(x, y, 1);

// Set a single LED off
await setLED(x, y, 0);

// Clear the entire grid
await clearGrid();

// Fill the entire grid
await fillGrid();

// Set a row of LEDs (more efficient)
await setLEDRow(x, y, bitmask);

// Set an 8x8 block of LEDs (most efficient)
await setLEDMap(x, y, [byte1, byte2, byte3, byte4, byte5, byte6, byte7, byte8]);
```

### Creating Patterns

The test pattern shows how to create animations:

```javascript
// Create a chasing light effect around the border
for (let i = 0; i < borderPositions.length; i++) {
    // Turn on an LED
    await setLED(pos.x, pos.y, 1);
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Turn off the LED
    await setLED(pos.x, pos.y, 0);
}
```

## Troubleshooting

- **Port not found**: Make sure your Monome Grid is connected and powered on
- **Permission denied**: Try reconnecting your grid or restarting your browser
- **No response from device**: Check the serial configuration (baud rate, etc.)
- **No sound**: Click elsewhere on the page first to allow audio context creation

## Browser Compatibility

- Chrome 89 or later
- Edge 89 or later
- Opera 75 or later
- Not supported in Firefox or Safari (as of 2023)

## Deno Application for Grid Testing

This project includes a Deno application (`grid_test.ts`) that connects to a Monome Grid using the serialosc protocol.

### Features

- Uses the `@capogreco/monome-deno` JSR module for serialosc communication
- Listens for grid button presses and logs them to the console
- Lights up grid buttons to match their pressed state
- Simple API for grid interaction

### Requirements

- Deno installed on your system
- serialosc running in the background (`brew service start serialosc`)
- Monome Grid connected via USB

### Running the Application

```bash
# Start the web server for the browser application
deno task start

# Run the grid test with serialosc
deno task test
```

## CLI Serial Logger Tool

The project also includes a Python-based CLI tool (`cli/monome_logger.py`) for debugging and monitoring serial communication with Monome Grid devices.

### Features

- Monitor and log all serial communication with Monome devices
- Display decoded Monome protocol messages
- List available serial ports
- Save log files for debugging
- Display raw or formatted hexadecimal data

### Usage

See `cli/README.md` for full usage instructions and examples.

```bash
# List available serial ports
./cli/monome_logger.py -l

# Connect to a Monome Grid
./cli/monome_logger.py -p /dev/tty.usbserial-m1000065

# Display raw hex data
./cli/monome_logger.py -p /dev/tty.usbserial-m1000065 --hex
```

## Resources

- [Web Serial API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Serial)
- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Monome Grid Documentation](https://monome.org/docs/grid/)
- [Monome Serial Protocol Documentation](https://monome.org/docs/serialosc/protocol/)
- [Deno Documentation](https://deno.land/manual)
- [serialosc Documentation](https://monome.org/docs/serialosc/)
- [Python Serial Library](https://pyserial.readthedocs.io/)