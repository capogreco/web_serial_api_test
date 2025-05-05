// Web worker for processing Monome grid serial data
// This worker handles the processing of serial data to offload from the main thread

// Protocol constants duplicated from main script
const PROTOCOL = {
    // System commands
    SYS_QUERY: 0x00,
    SYS_ID: 0x01,
    SYS_SIZE: 0x05,
    SYS_SIZE_RESPONSE: 0x03,
    
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
    KEY_UP: 0x20,
    KEY_DOWN: 0x21
};

// Handle messages from the main thread
self.onmessage = function(e) {
    const message = e.data;
    
    switch (message.type) {
        case 'init':
            // Store grid dimensions
            self.gridWidth = message.gridWidth || 16;
            self.gridHeight = message.gridHeight || 8;
            self.postMessage({ type: 'initialized' });
            break;
            
        case 'process':
            // Process incoming serial data
            const result = processIncomingData(message.data);
            if (result) {
                self.postMessage(result);
            }
            break;
            
        case 'terminate':
            // Cleanup before termination
            self.close();
            break;
    }
};

// Process data received from the grid (same logic as in main script but isolated)
function processIncomingData(data) {
    if (!data || data.length < 1) return null;
    
    // First byte is the message type
    const messageType = data[0];
    
    // Log hex format for debugging (sent back to main thread)
    const hexData = Array.from(data).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
    
    // Key event detection
    if (data.length >= 3) {
        const x = data[1];
        const y = data[2];
        
        // Handle key events if they match known patterns
        if (messageType === PROTOCOL.KEY_UP) { // 0x20
            return {
                type: 'keyEvent',
                event: 'up',
                x,
                y,
                state: 0,
                hexData
            };
        }
        
        if (messageType === PROTOCOL.KEY_DOWN) { // 0x21
            return {
                type: 'keyEvent',
                event: 'down',
                x,
                y,
                state: 1,
                hexData
            };
        }
        
        // Legacy protocol format (0x00/0x01)
        if (messageType === 0x00) {
            return {
                type: 'keyEvent',
                event: 'up',
                x,
                y,
                state: 0,
                protocol: 'legacy',
                hexData
            };
        }
        
        if (messageType === 0x01) {
            return {
                type: 'keyEvent',
                event: 'down',
                x,
                y,
                state: 1,
                protocol: 'legacy',
                hexData
            };
        }
    }
    
    // Handle system messages
    let result = null;
    
    switch (messageType) {
        case PROTOCOL.SYS_QUERY:
            // System query response [0x00, section, number]
            if (data.length >= 3) {
                const section = data[1];
                const number = data[2];
                result = {
                    type: 'systemInfo',
                    subtype: 'query',
                    section,
                    number,
                    hexData
                };
            }
            break;
            
        case PROTOCOL.SYS_ID:
            // Device ID response [0x01, ...ID string]
            if (data.length > 1) {
                // Convert the ID bytes to a string, ignoring initial command byte
                const idBytes = data.slice(1);
                const decoder = new TextDecoder();
                const deviceId = decoder.decode(idBytes).trim();
                result = {
                    type: 'systemInfo',
                    subtype: 'deviceId',
                    deviceId,
                    hexData
                };
            }
            break;
            
        case PROTOCOL.SYS_SIZE_RESPONSE:
            // Grid size response [0x03, x, y]
            if (data.length >= 3) {
                const gridX = data[1];
                const gridY = data[2];
                result = {
                    type: 'systemInfo',
                    subtype: 'gridSize',
                    width: gridX,
                    height: gridY,
                    hexData
                };
            }
            break;
            
        default:
            // If it's a 3-byte message that we didn't recognize, log it as a potential key event
            if (data.length === 3) {
                result = {
                    type: 'unknownEvent',
                    messageType: `0x${messageType.toString(16)}`,
                    data: [data[1], data[2]],
                    hexData
                };
            } else {
                result = {
                    type: 'rawData',
                    hexData
                };
            }
            break;
    }
    
    return result;
}