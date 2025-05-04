# Monome Grid Serial Logger

A command-line tool for logging and debugging serial data from Monome Grid devices.

## Installation

1. Make sure you have Python 3.6+ installed
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Make the script executable:

```bash
chmod +x monome_logger.py
```

## Usage

### Basic Usage

```bash
./monome_logger.py -p /dev/tty.usbserial-m1000065
```

Replace `/dev/tty.usbserial-m1000065` with your actual Monome Grid's serial port.

### List Available Serial Ports

```bash
./monome_logger.py -l
```

### Change Baud Rate

```bash
./monome_logger.py -p /dev/tty.usbserial-m1000065 -b 57600
```

Default is 115200.

### Save Output to a Log File

```bash
./monome_logger.py -p /dev/tty.usbserial-m1000065 -o monome_log.txt
```

### Display Raw Hex Data

```bash
./monome_logger.py -p /dev/tty.usbserial-m1000065 --hex
```

### Show Raw Data Without Interpretation

```bash
./monome_logger.py -p /dev/tty.usbserial-m1000065 --raw
```

## Fish Shell Integration

You can create fish shell aliases for common operations:

```fish
# Add to your ~/.config/fish/config.fish
alias monome-list='./path/to/monome_logger.py -l'
alias monome-debug='./path/to/monome_logger.py -p (your-device-port)'
```

## Protocol Interpretation

The tool automatically interprets common Monome protocol messages:

- Button press/release events (both 0x00/0x01 and 0x20/0x21 formats)
- System query responses
- Device ID responses
- Grid size responses

All data is also shown in its raw hexadecimal format for debugging.

## Troubleshooting

If you're not seeing any data:
1. Verify you're using the correct port with `-l`
2. Try different baud rates (common values: 115200, 57600, 38400)
3. Check if the device is connected and powered on
4. Press some buttons on the grid to generate events

## License

MIT