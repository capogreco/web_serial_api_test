#!/usr/bin/env python3
"""
Monome Grid Serial Logger

A simple CLI tool to log serial data from Monome Grid devices.
"""

import sys
import time
import argparse
import signal
import serial
import serial.tools.list_ports
from datetime import datetime
import binascii

# ANSI color codes for prettier output
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
MAGENTA = "\033[35m"
CYAN = "\033[36m"
RESET = "\033[0m"
BOLD = "\033[1m"

def list_serial_ports():
    """List all available serial ports with details."""
    ports = serial.tools.list_ports.comports()
    
    if not ports:
        print(f"{YELLOW}No serial ports detected.{RESET}")
        return
        
    print(f"{BOLD}Available serial ports:{RESET}")
    for i, port in enumerate(ports):
        vid_pid = f"{port.vid:04X}:{port.pid:04X}" if port.vid else "None"
        print(f"{i+1}. {GREEN}{port.device}{RESET} - {port.description} [VID:PID={vid_pid}]")
        
def format_bytes(data):
    """Format bytes for display as hex and ASCII."""
    hex_data = binascii.hexlify(data).decode('ascii')
    hex_pairs = [hex_data[i:i+2] for i in range(0, len(hex_data), 2)]
    
    # Create a readable representation
    readable = ""
    for b in data:
        if 32 <= b <= 126:  # Printable ASCII
            readable += chr(b)
        else:
            readable += "."
            
    hex_formatted = " ".join(hex_pairs)
    return hex_formatted, readable

def decode_monome_message(data):
    """Try to decode a Monome protocol message."""
    if not data or len(data) < 1:
        return None
        
    message_type = data[0]
    result = {
        "raw_hex": " ".join(f"{b:02X}" for b in data),
        "type": f"0x{message_type:02X}",
        "decoded": "Unknown"
    }
    
    # Key grid messages (button presses)
    if message_type == 0x00 and len(data) >= 3:  # Key up (docs version)
        result["decoded"] = f"Key UP at ({data[1]}, {data[2]})"
        result["color"] = CYAN
    elif message_type == 0x01 and len(data) >= 3:  # Key down (docs version)
        result["decoded"] = f"Key DOWN at ({data[1]}, {data[2]})"
        result["color"] = MAGENTA
    elif message_type == 0x20 and len(data) >= 3:  # Key up (alt version)
        result["decoded"] = f"Key UP at ({data[1]}, {data[2]}) [Alt code]"
        result["color"] = CYAN
    elif message_type == 0x21 and len(data) >= 3:  # Key down (alt version)
        result["decoded"] = f"Key DOWN at ({data[1]}, {data[2]}) [Alt code]"
        result["color"] = MAGENTA
    
    # System messages
    elif message_type == 0x00 and len(data) >= 3 and data[1] <= 15:  # System query response
        result["decoded"] = f"System Query Response: Section {data[1]}, Count {data[2]}"
        result["color"] = BLUE
    elif message_type == 0x01 and len(data) > 1:  # Device ID response
        device_id = bytes(data[1:]).decode('ascii', errors='ignore').strip()
        result["decoded"] = f"Device ID: {device_id}"
        result["color"] = GREEN
    elif message_type == 0x03 and len(data) >= 3:  # Grid size response
        result["decoded"] = f"Grid Size: {data[1]}x{data[2]}"
        result["color"] = YELLOW
        
    return result

def log_serial_data(port, baud_rate, log_file=None, hex_mode=False, interpret=True):
    """Log serial data from the specified port."""
    try:
        # Open the serial port
        ser = serial.Serial(port, baudrate=baud_rate, timeout=1,
                          bytesize=serial.EIGHTBITS,
                          parity=serial.PARITY_NONE,
                          stopbits=serial.STOPBITS_ONE)
        
        print(f"{GREEN}Connected to {port} at {baud_rate} baud{RESET}")
        print(f"Press Ctrl+C to exit\n")
        
        # Open log file if specified
        log_f = None
        if log_file:
            log_f = open(log_file, 'w')
            log_f.write(f"Monome Grid Serial Log - Started at {datetime.now()}\n")
            log_f.write(f"Port: {port}, Baud Rate: {baud_rate}\n\n")
            log_f.flush()
            
        # Send a few initialization commands that might help
        # Query the device
        print(f"{YELLOW}Sending system query command (0x00)...{RESET}")
        ser.write(bytes([0x00]))
        time.sleep(0.1)
        
        # Query device ID
        print(f"{YELLOW}Sending device ID query (0x01)...{RESET}")
        ser.write(bytes([0x01]))
        time.sleep(0.1)
        
        # Query grid size
        print(f"{YELLOW}Sending grid size query (0x05)...{RESET}")
        ser.write(bytes([0x05]))
        time.sleep(0.1)
        
        # Try to enable key events
        print(f"{YELLOW}Sending key grid enable commands...{RESET}")
        # Both protocol versions
        ser.write(bytes([0x20, 0x01]))  # Key up enable
        time.sleep(0.05)
        ser.write(bytes([0x21, 0x01]))  # Key down enable
        time.sleep(0.05)
        ser.write(bytes([0x00, 0x01]))  # Legacy key up enable
        time.sleep(0.05)
        ser.write(bytes([0x01, 0x01]))  # Legacy key down enable
        time.sleep(0.1)
        
        print(f"{GREEN}Ready to receive data. Press buttons on your grid...{RESET}\n")
        
        while True:
            # Check if data is available to read
            if ser.in_waiting > 0:
                # Read a chunk of data
                data = ser.read(ser.in_waiting)
                if data:
                    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                    
                    # Format output based on the mode
                    if hex_mode:
                        hex_data, ascii_data = format_bytes(data)
                        output = f"[{timestamp}] HEX: {hex_data} | ASCII: {ascii_data}"
                    elif interpret:
                        # Try to decode as Monome protocol message
                        message = decode_monome_message(data)
                        if message:
                            color = message.get("color", RESET)
                            output = f"[{timestamp}] {color}{message['decoded']}{RESET} [{message['raw_hex']}]"
                        else:
                            # Fallback to hex display
                            hex_data, _ = format_bytes(data)
                            output = f"[{timestamp}] Raw data: {hex_data}"
                    else:
                        # Just show raw bytes
                        output = f"[{timestamp}] {data}"
                    
                    # Print to console
                    print(output)
                    
                    # Write to log file if open
                    if log_f:
                        log_f.write(output + "\n")
                        log_f.flush()
            
            # Short delay to prevent CPU hogging
            time.sleep(0.01)
            
    except serial.SerialException as e:
        print(f"{YELLOW}Error opening serial port: {e}{RESET}")
        return
    except KeyboardInterrupt:
        print(f"\n{GREEN}Logging stopped by user{RESET}")
    finally:
        # Clean up
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print(f"{GREEN}Serial port closed{RESET}")
        if 'log_f' in locals() and log_f:
            log_f.close()
            print(f"{GREEN}Log file closed{RESET}")

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Log serial data from Monome Grid devices')
    
    parser.add_argument('-p', '--port', help='Serial port to use (e.g., /dev/tty.usbserial-m1000065)')
    parser.add_argument('-b', '--baud', type=int, default=115200, 
                      help='Baud rate (default: 115200)')
    parser.add_argument('-l', '--list', action='store_true',
                      help='List available serial ports and exit')
    parser.add_argument('-o', '--output', help='Save output to specified log file')
    parser.add_argument('--hex', action='store_true',
                      help='Display data in hexadecimal format')
    parser.add_argument('--raw', action='store_true',
                      help='Display raw data without interpretation')
    
    args = parser.parse_args()
    
    # List ports if requested
    if args.list:
        list_serial_ports()
        return
        
    # Check if port is specified
    if not args.port:
        list_serial_ports()
        print(f"\n{YELLOW}Error: No serial port specified. Use -p/--port to specify a port.{RESET}")
        return
        
    # Start logging
    log_serial_data(args.port, args.baud, args.output, args.hex, not args.raw)

if __name__ == "__main__":
    main()