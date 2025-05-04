// Monome Grid Web Serial API interface
let port;
let reader;
let writer;
let serialActive = false;
const gridWidth = 16;
const gridHeight = 8;
const gridState = Array(gridHeight).fill().map(() => Array(gridWidth).fill(0));

// Monome Serial Protocol constants
const PROTOCOL = {
    // System commands
    SYS_QUERY: 0x00,
    SYS_ID: 0x01,
    SYS_SIZE: 0x05,
    SYS_SIZE_RESPONSE: 0x03, // Response has a different value
    
    // LED Grid commands
    LED_OFF: 0x10,
    LED_ON: 0x11,
    LED_ALL_OFF: 0x12,
    LED_ALL_ON: 0x13,
    LED_MAP: 0x14,
    LED_ROW: 0x15,
    LED_COL: 0x16,
    LED_INTENSITY: 0x17,
    LED_LEVEL_SET: 0x18,
    LED_LEVEL_ALL: 0x19,
    LED_LEVEL_MAP: 0x1A,
    
    // Key Grid responses
    KEY_UP: 0x20, // Key up message according to serial.txt
    KEY_DOWN: 0x21 // Key down message according to serial.txt
};

document.addEventListener('DOMContentLoaded', () => {
    // Check if browser supports Serial API
    if (!('serial' in navigator)) {
        alert('Web Serial API is not supported in your browser. Try Chrome or Edge.');
        return;
    }

    // UI Elements
    const connectButton = document.getElementById('connect');
    const disconnectButton = document.getElementById('disconnect');
    const clearGridButton = document.getElementById('clear-grid');
    const fillGridButton = document.getElementById('fill-grid');
    const randomPatternButton = document.getElementById('random-pattern');
    const chasePatternButton = document.getElementById('chase-pattern');
    const checkerboardButton = document.getElementById('checkerboard');
    const intensitySlider = document.getElementById('intensity-slider');
    const intensityValue = document.getElementById('intensity-value');
    const statusDisplay = document.getElementById('status');
    const gridContainer = document.getElementById('grid-container');

    // Create the grid UI
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.addEventListener('click', () => toggleGridCell(x, y));
            gridContainer.appendChild(cell);
        }
    }

    // Connect Button Event Listener
    connectButton.addEventListener('click', async () => {
        try {
            // Request a serial port
            console.log('Requesting serial port...');
            
            // Try without a filter to see all available ports
            port = await navigator.serial.requestPort({
                // Commented out the filter to show all devices
                // filters: [
                //     // Most monome devices use this vendor ID (FTDI)
                //     { usbVendorId: 0x0403 }
                // ]
            });
            
            console.log('Port selected:', port.getInfo ? await port.getInfo() : 'Info not available');

            // Open the port with the correct settings for monome grid
            // According to README.md line 65, we should use baudRate: 115200
            console.log('Opening port with baudRate: 115200...');
            await port.open({ 
                baudRate: 115200, // Using the baudRate specified in the README.md
                dataBits: 8,
                stopBits: 1,
                parity: "none",
                bufferSize: 64*1024
            });

            // Get a writer and reader from the port
            writer = port.writable.getWriter();
            
            // Setup reader for incoming messages
            setupReader();

            // Update UI
            connectButton.disabled = true;
            disconnectButton.disabled = false;
            clearGridButton.disabled = false;
            fillGridButton.disabled = false;
            randomPatternButton.disabled = false;
            chasePatternButton.disabled = false;
            checkerboardButton.disabled = false;
            intensitySlider.disabled = false;
            statusDisplay.textContent = 'Status: Connected';
            serialActive = true;

            // Log success
            console.log('Serial port opened successfully.');
            statusDisplay.textContent = 'Status: Port opened, initializing...';
            
            // Initialize the grid
            await initializeGrid();
            
            // Add test pattern after connection
            statusDisplay.textContent = 'Status: Connected and initialized. Try pressing buttons!';
            
        } catch (error) {
            console.error('Error connecting to serial port:', error);
            statusDisplay.textContent = `Status: Connection Error - ${error.message}`;
        }
    });

    // Disconnect Button Event Listener
    disconnectButton.addEventListener('click', async () => {
        await disconnectFromGrid();
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        clearGridButton.disabled = true;
        fillGridButton.disabled = true;
        randomPatternButton.disabled = true;
        chasePatternButton.disabled = true;
        checkerboardButton.disabled = true;
        intensitySlider.disabled = true;
        statusDisplay.textContent = 'Status: Disconnected';
    });
    
    // Pattern Control Buttons
    clearGridButton.addEventListener('click', async () => {
        await clearGrid();
    });
    
    fillGridButton.addEventListener('click', async () => {
        await fillGrid();
    });
    
    randomPatternButton.addEventListener('click', async () => {
        await randomPattern();
    });
    
    chasePatternButton.addEventListener('click', async () => {
        await testPattern();
    });
    
    checkerboardButton.addEventListener('click', async () => {
        await checkerboardPattern();
    });
    
    // Intensity Slider
    intensitySlider.addEventListener('input', async () => {
        const level = parseInt(intensitySlider.value);
        intensityValue.textContent = level;
        await setGridIntensity(level);
    });

    // Initialize the grid by sending queries and clearing it
    async function initializeGrid() {
        if (!writer) return;
        
        // First query device information
        await querySystem();
        
        // Small delay to allow response processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Query device ID
        await queryDeviceID();
        
        // Small delay to allow response processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Query grid size
        await queryGridSize();
        
        // Small delay to allow response processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to enable press events (experimental)
        await enablePressEvents();
        
        // Small delay to allow response processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Clear the grid
        await clearGrid();
        
        // Add a test pattern - this should be the one that worked before
        console.log('Adding test pattern (chase effect)');
        await testPattern();
        
        // Log completion
        console.log('Grid initialization complete - LED commands should work, watch for press events in the console');
        
        // Update status message
        statusDisplay.textContent = 'Status: Connected and initialized. Try using the pattern buttons!';
    }
    
    // Query system information
    async function querySystem() {
        if (!writer) return;
        
        try {
            console.log('Sending system query command...');
            // Send system query command [0x00]
            const message = new Uint8Array([PROTOCOL.SYS_QUERY]);
            await writer.write(message);
            console.log('System query sent:', Array.from(message).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
            statusDisplay.textContent = 'Status: Querying device...';
        } catch (error) {
            console.error('Error querying system:', error);
        }
    }
    
    // Enable key press events while keeping existing LED functionality
    async function enablePressEvents() {
        if (!writer) return;
        
        try {
            console.log('Attempting to enable key press events...');
            
            // Only add the essential commands for enabling key press events
            // without modifying the working LED functionality
            
            // Clear the grid first - we know this works
            console.log('Clearing grid as part of initialization');
            await clearGrid();
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try to set prefix for key events
            console.log('Setting device prefix to "monome"');
            const prefixBytes = new TextEncoder().encode("monome");
            // Command for setting prefix - being careful not to disrupt working LED commands
            await writer.write(new Uint8Array([0x0F, ...prefixBytes, 0x00]));
            console.log('Prefix command sent');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try two potential approaches to enable key events
            
            // Approach 1: Send key-grid enable commands
            console.log('Sending key-grid enable commands (0x20/0x21)');
            // These match the protocol docs for key events
            await writer.write(new Uint8Array([0x20, 0x01])); // key up subsystem
            await new Promise(resolve => setTimeout(resolve, 50));
            await writer.write(new Uint8Array([0x21, 0x01])); // key down subsystem
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Approach 2: Send legacy key event enable (0x00/0x01)
            console.log('Sending legacy key-grid enable commands (0x00/0x01)');
            await writer.write(new Uint8Array([0x00, 0x01])); // legacy key up
            await new Promise(resolve => setTimeout(resolve, 50));
            await writer.write(new Uint8Array([0x01, 0x01])); // legacy key down
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // A brief flash to confirm the grid is responding
            console.log('Sending quick flash confirmation');
            await fillGrid();
            await new Promise(resolve => setTimeout(resolve, 300));
            await clearGrid();
            
            console.log('Key event enable attempts completed');
            console.log('Try pressing buttons on the grid now...');
            statusDisplay.textContent = 'Status: Connected - Press buttons on the grid';
        } catch (error) {
            console.error('Error enabling press events:', error);
        }
    }
    
    // Query device ID
    async function queryDeviceID() {
        if (!writer) return;
        
        try {
            // Send device ID query command [0x01]
            const message = new Uint8Array([PROTOCOL.SYS_ID]);
            await writer.write(message);
        } catch (error) {
            console.error('Error querying device ID:', error);
        }
    }
    
    // Query grid size
    async function queryGridSize() {
        if (!writer) return;
        
        try {
            // Send grid size query command [0x05]
            const message = new Uint8Array([PROTOCOL.SYS_SIZE]);
            await writer.write(message);
        } catch (error) {
            console.error('Error querying grid size:', error);
        }
    }

    // Setup the serial port reader
    async function setupReader() {
        if (!port) return;
        
        // Get a reader from the port
        console.log('Setting up reader from port.readable');
        
        // Read binary data directly without TextDecoderStream
        // This is more appropriate for a binary protocol like the Monome Serial Protocol
        try {
            while (port.readable && serialActive) {
                reader = port.readable.getReader();
                console.log('Binary reader setup complete, starting read loop');
                
                try {
                    while (serialActive) {
                        const { value, done } = await reader.read();
                        
                        if (done) {
                            // Reader has been canceled
                            console.log('Reader done - port closed or canceled');
                            break;
                        }
                        
                        // Log raw data for debugging
                        if (value && value.length > 0) {
                            console.log('Raw data received (binary):', value);
                            console.log('As hex:', Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' '));
                            
                            // Process the binary data directly
                            processIncomingData(value);
                        }
                    }
                } catch (error) {
                    console.error('Error reading from serial port:', error);
                } finally {
                    console.log('Reader releasing lock');
                    reader.releaseLock();
                }
                
                // If we're still active, prepare for the next reader
                if (serialActive) {
                    console.log('Reader reset - preparing for new data');
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error('Fatal error setting up reader:', error);
        }
    }

    // Process data received from the grid
    function processIncomingData(data) {
        if (!data || data.length < 1) return;
        
        // First byte is the message type
        const messageType = data[0];
        
        // Log incoming data for debugging
        console.log('RECEIVED:', Array.from(data).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
        
        // Key event detection
        // Check for both protocol versions (0x20/0x21 and 0x00/0x01)
        
        if (data.length >= 3) {
            const x = data[1];
            const y = data[2];
            
            // Handle key events if they match known patterns
            // Your device is using 0x20/0x21 format (alternative protocol)
            if (messageType === PROTOCOL.KEY_UP) { // 0x20
                console.log(`KEY UP detected at (${x},${y}) [0x20]`);
                handleKeyEvent(x, y, 0);
                return;
            }
            
            if (messageType === PROTOCOL.KEY_DOWN) { // 0x21
                console.log(`KEY DOWN detected at (${x},${y}) [0x21]`);
                handleKeyEvent(x, y, 1);
                return;
            }
            
            // Also handle standard protocol format (0x00/0x01) just in case
            if (messageType === 0x00) {
                console.log(`KEY UP detected at (${x},${y}) [0x00]`);
                handleKeyEvent(x, y, 0);
                return;
            }
            
            if (messageType === 0x01) {
                console.log(`KEY DOWN detected at (${x},${y}) [0x01]`);
                handleKeyEvent(x, y, 1);
                return;
            }
        }
        
        // Handle system messages - these should maintain the LED functionality
        switch (messageType) {
            case PROTOCOL.SYS_QUERY:
                // System query response [0x00, section, number]
                if (data.length >= 3) {
                    const section = data[1];
                    const number = data[2];
                    console.log(`Device section ${section} has ${number} components`);
                    if (section === 1) { // 1 is led-grid
                        statusDisplay.textContent = `Status: Connected - Grid with ${number} components`;
                    }
                }
                break;
                
            case PROTOCOL.SYS_ID:
                // Device ID response [0x01, ...ID string]
                if (data.length > 1) {
                    // Convert the ID bytes to a string, ignoring initial command byte
                    const idBytes = data.slice(1);
                    const decoder = new TextDecoder();
                    const deviceId = decoder.decode(idBytes).trim();
                    console.log(`Device ID: ${deviceId}`);
                    statusDisplay.textContent = `Status: Connected - ${deviceId}`;
                }
                break;
                
            case PROTOCOL.SYS_SIZE_RESPONSE:
                // Grid size response [0x03, x, y]
                if (data.length >= 3) {
                    const gridX = data[1];
                    const gridY = data[2];
                    console.log(`Grid size: ${gridX}x${gridY}`);
                }
                break;
                
            default:
                // If it's a 3-byte message that we didn't recognize, log it as a potential key event
                if (data.length === 3) {
                    console.log(`Potential key event: type=0x${messageType.toString(16)}, x=${data[1]}, y=${data[2]}`);
                }
                break;
        }
    }
    
    // Centralized handler for key events to ensure consistent behavior
    function handleKeyEvent(x, y, state) {
        if (x >= gridWidth || y >= gridHeight) {
            console.log(`Key event out of range: (${x},${y})`);
            return;
        }
        
        // Update internal state
        gridState[y][x] = state;
        
        // Update UI
        updateCellUI(x, y, state);
        
        // Log event to status display
        const eventType = state ? "pressed" : "released";
        statusDisplay.textContent = `Status: Connected - Button ${eventType} at (${x},${y})`;
        
        // Play tone if key was pressed
        if (state) {
            playTone(x, y);
        }
    }

    // Toggle a grid cell when clicked
    async function toggleGridCell(x, y) {
        if (!serialActive) return;
        
        // Toggle the state
        gridState[y][x] = gridState[y][x] ? 0 : 1;
        
        // Update the UI
        updateCellUI(x, y, gridState[y][x]);
        
        // Send the new state to the grid
        await setLED(x, y, gridState[y][x]);
        
        // Generate tone if turned on
        if (gridState[y][x]) {
            playTone(x, y);
        }
    }

    // Update the visual state of a cell in the UI
    function updateCellUI(x, y, state) {
        const cell = gridContainer.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
            if (state) {
                cell.classList.add('active');
            } else {
                cell.classList.remove('active');
            }
        }
    }

    // Send LED command to the grid
    async function setLED(x, y, state) {
        if (!writer) return;
        
        try {
            // Monome protocol uses LED_ON (0x11) for on and LED_OFF (0x10) for off
            // Format: [message type, x, y]
            const messageType = state ? PROTOCOL.LED_ON : PROTOCOL.LED_OFF;
            const message = new Uint8Array([messageType, x, y]);
            await writer.write(message);
        } catch (error) {
            console.error('Error sending LED command:', error);
        }
    }

    // Set LED intensity level (for varibright grids)
    async function setLEDLevel(x, y, level) {
        if (!writer) return;
        
        try {
            // Level should be between 0-15
            level = Math.max(0, Math.min(15, level));
            const message = new Uint8Array([PROTOCOL.LED_LEVEL_SET, x, y, level]);
            await writer.write(message);
        } catch (error) {
            console.error('Error setting LED level:', error);
        }
    }

    // Set a row of LEDs (more efficient than setting individual LEDs)
    async function setLEDRow(x, y, data) {
        if (!writer) return;
        
        try {
            // data should be a byte representing 8 LEDs
            const message = new Uint8Array([PROTOCOL.LED_ROW, x, y, data]);
            await writer.write(message);
        } catch (error) {
            console.error('Error setting LED row:', error);
        }
    }

    // Set a column of LEDs (more efficient than setting individual LEDs)
    async function setLEDColumn(x, y, data) {
        if (!writer) return;
        
        try {
            // data should be a byte representing 8 LEDs
            const message = new Uint8Array([PROTOCOL.LED_COL, x, y, data]);
            await writer.write(message);
        } catch (error) {
            console.error('Error setting LED column:', error);
        }
    }

    // Set an 8x8 block of LEDs (most efficient for updating large areas)
    async function setLEDMap(x, y, data) {
        if (!writer) return;
        
        try {
            // data should be an array of 8 bytes, each representing a row of 8 LEDs
            const message = new Uint8Array([PROTOCOL.LED_MAP, x, y, ...data]);
            await writer.write(message);
        } catch (error) {
            console.error('Error setting LED map:', error);
        }
    }

    // Clear the entire grid
    async function clearGrid() {
        if (!writer) return;
        
        try {
            // Send the all LEDs off command
            const message = new Uint8Array([PROTOCOL.LED_ALL_OFF]);
            await writer.write(message);
            
            // Reset our internal state
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    gridState[y][x] = 0;
                    updateCellUI(x, y, 0);
                }
            }
        } catch (error) {
            console.error('Error clearing grid:', error);
        }
    }

    // Turn on all LEDs
    async function fillGrid() {
        if (!writer) return;
        
        try {
            // Send the all LEDs on command
            const message = new Uint8Array([PROTOCOL.LED_ALL_ON]);
            await writer.write(message);
            
            // Update our internal state
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    gridState[y][x] = 1;
                    updateCellUI(x, y, 1);
                }
            }
        } catch (error) {
            console.error('Error filling grid:', error);
        }
    }

    // Set the grid intensity
    async function setGridIntensity(level) {
        if (!writer) return;
        
        try {
            // Level should be between 0-15
            level = Math.max(0, Math.min(15, level));
            const message = new Uint8Array([PROTOCOL.LED_INTENSITY, level]);
            await writer.write(message);
        } catch (error) {
            console.error('Error setting grid intensity:', error);
        }
    }

    // Disconnect from the grid
    async function disconnectFromGrid() {
        serialActive = false;
        
        // Release the writer
        if (writer) {
            try {
                // Clear the grid before disconnecting
                await clearGrid();
                writer.releaseLock();
            } catch (error) {
                console.error('Error releasing writer:', error);
            }
            writer = null;
        }
        
        // Release the reader
        if (reader) {
            try {
                reader.cancel();
                // reader.releaseLock() will be called in the finally block of setupReader
            } catch (error) {
                console.error('Error releasing reader:', error);
            }
            reader = null;
        }
        
        // Close the port
        if (port) {
            try {
                await port.close();
            } catch (error) {
                console.error('Error closing port:', error);
            }
            port = null;
        }
    }

    // Chase pattern around the border
    async function testPattern() {
        if (!writer) return;
        
        // First clear the grid
        await clearGrid();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Show a simple chase pattern around the border
        const borderPositions = [];
        
        // Top row
        for (let x = 0; x < gridWidth; x++) {
            borderPositions.push({x, y: 0});
        }
        
        // Right column (excluding corner already added)
        for (let y = 1; y < gridHeight; y++) {
            borderPositions.push({x: gridWidth - 1, y});
        }
        
        // Bottom row (excluding corner already added, in reverse)
        for (let x = gridWidth - 2; x >= 0; x--) {
            borderPositions.push({x, y: gridHeight - 1});
        }
        
        // Left column (excluding corners already added, in reverse)
        for (let y = gridHeight - 2; y > 0; y--) {
            borderPositions.push({x: 0, y});
        }
        
        // Light each position in sequence, with a trail effect
        const trailLength = 4;
        
        for (let i = 0; i < borderPositions.length + trailLength; i++) {
            // Clear previous cells
            for (let t = trailLength; t < i; t++) {
                const pos = borderPositions[(i - t) % borderPositions.length];
                if (pos) {
                    await setLED(pos.x, pos.y, 0);
                    gridState[pos.y][pos.x] = 0;
                    updateCellUI(pos.x, pos.y, 0);
                }
            }
            
            // Light trail cells with diminishing brightness
            for (let t = 0; t < trailLength; t++) {
                if (i - t >= 0 && i - t < borderPositions.length) {
                    const pos = borderPositions[i - t];
                    if (pos) {
                        await setLED(pos.x, pos.y, 1);
                        gridState[pos.y][pos.x] = 1;
                        updateCellUI(pos.x, pos.y, 1);
                    }
                }
            }
            
            // Small delay between steps
            await new Promise(resolve => setTimeout(resolve, 40));
        }
    }
    
    // Random pattern generator
    async function randomPattern() {
        if (!writer) return;
        
        // First clear the grid
        await clearGrid();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create 50 random LEDs
        for (let i = 0; i < 50; i++) {
            const x = Math.floor(Math.random() * gridWidth);
            const y = Math.floor(Math.random() * gridHeight);
            
            await setLED(x, y, 1);
            gridState[y][x] = 1;
            updateCellUI(x, y, 1);
            
            // Small delay between LEDs
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
    
    // Checkerboard pattern
    async function checkerboardPattern() {
        if (!writer) return;
        
        // First clear the grid
        await clearGrid();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create a checkerboard pattern
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const state = (x + y) % 2 === 0 ? 1 : 0;
                
                await setLED(x, y, state);
                gridState[y][x] = state;
                updateCellUI(x, y, state);
                
                // Small delay for visual effect
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }

    // Web Audio API setup
    let audioContext;
    
    // Create audio context on first interaction (to comply with autoplay policies)
    function setupAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    // Play a tone based on grid position
    function playTone(x, y) {
        const context = setupAudioContext();
        
        // Create an oscillator
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        
        // Map x position to frequency (pentatonic scale)
        const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00]; // C, D, E, G, A
        const octave = Math.floor(x / pentatonic.length);
        const note = x % pentatonic.length;
        const frequency = pentatonic[note] * Math.pow(2, octave - 2);
        
        // Map y position to duration
        const duration = 0.1 + (y * 0.1); // 0.1 to 0.8 seconds
        
        // Configure the oscillator
        oscillator.type = 'sine'; // 'sine', 'square', 'sawtooth', 'triangle'
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        
        // Configure the gain node for an envelope
        gainNode.gain.setValueAtTime(0, context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + duration);
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        
        // Start and stop the oscillator
        oscillator.start();
        oscillator.stop(context.currentTime + duration);
    }
});