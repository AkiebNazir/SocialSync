// WhatsApp service logic (API integration with whatsapp-web.js)
import { Client, LocalAuth, MessageMedia, Location, WAState } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { normalizeIndianNumber, parseISTDate } from '../utils/utils';
import { saveSession, loadSession, invalidateSession, restoreLatestBackup, SESSION_FILE_PATH } from './sessionManager';
import { WhatsAppError } from '../utils/errors';
import { registerEventHandlers } from './webhook';
import { registerErrorHandlers } from './errorDetection';
import { createLogger } from '../utils/logger';

// Create context-specific loggers
const logger = createLogger('WHATSAPP-SERVICE');
const resolveLogger = createLogger('WHATSAPP-RESOLVE');
const clientLogger = createLogger('WHATSAPP-CLIENT');
const sessionLogger = createLogger('WHATSAPP-SESSION');

// --- Utility: validateStringInput ---
function validateStringInput(value: any, label: string) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${label} must be a non-empty string.`);
    }
}

// Add contact cache with proper mapping
let contactCache: {
    contacts: { [key: string]: string }; // name -> number mapping
    timestamp: number;
} | null = null;

const CONTACT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// --- Helper to resolve a contact name to WhatsApp JID (91XXXXXXXXXX@c.us) ---
async function resolveContactJid(nameOrNumber: string): Promise<string | null> {
    logger.info(`[RESOLVE] Attempting to resolve contact: ${nameOrNumber}`);
    
    if (!nameOrNumber || typeof nameOrNumber !== 'string' || !nameOrNumber.trim()) {
        logger.error('[RESOLVE][ERROR] Contact name or number is required');
        return null;
    }

    const lowerName = nameOrNumber.toLowerCase();

    // First check cache
    if (contactCache && (Date.now() - contactCache.timestamp) < CONTACT_CACHE_DURATION) {
        logger.debug('[RESOLVE] Checking cache for contact');
        const cachedNumber = contactCache.contacts[lowerName];
        if (cachedNumber) {
            const jid = `${cachedNumber}@c.us`;
            logger.info(`[RESOLVE][SUCCESS] Resolved from cache: ${nameOrNumber} -> ${jid}`);
            return jid;
        }
        logger.debug('[RESOLVE] Contact not found in cache');
    }

    // If not in cache, try as phone number
    let phone = normalizeIndianNumber(nameOrNumber);
    if (phone) {
        const jid = `${phone}@c.us`;
        logger.info(`[RESOLVE][SUCCESS] Resolved phone number to JID: ${jid}`);
        return jid;
    }

    // Only proceed with client initialization if we don't have a valid cache
    const client = await getClient();
    if (!isClientReady) {
        logger.error('[RESOLVE][ERROR] WhatsApp client is not ready');
        throw new WhatsAppError('CLIENT_NOT_READY', 'WhatsApp client is not ready. Please connect and scan the QR code.');
    }

    // Validate client before proceeding
    const isValid = await validateClient(client);
    if (!isValid) {
        logger.error('[RESOLVE][ERROR] Client validation failed');
        throw new WhatsAppError('CLIENT_INVALID', 'WhatsApp client is not valid. Attempting to reconnect...');
    }

    // Fetch fresh contacts with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
        try {
            logger.debug(`[RESOLVE] Fetching fresh contacts (attempt ${retryCount + 1}/${maxRetries})`);
            const contacts = await client.getContacts();
            
            // Create new cache with name -> number mapping
            const newCache: { [key: string]: string } = {};
            contacts.forEach(contact => {
                if (contact.name && contact.number) {
                    newCache[contact.name.toLowerCase()] = contact.number;
                }
            });
            
            contactCache = {
                contacts: newCache,
                timestamp: Date.now()
            };
            
            logger.debug(`[RESOLVE] Fetched ${contacts.length} contacts`);
            
            // Try to find the contact
            const matchedContact = contacts.find(c => 
                c.name && c.name.toLowerCase() === lowerName && c.number
            );
            
            if (matchedContact && matchedContact.number) {
                const jid = `${matchedContact.number}@c.us`;
                logger.info(`[RESOLVE][SUCCESS] Resolved contact to JID: ${jid}`);
                return jid;
            }
            
            // Log possible matches only when not using cache
            const possibleMatches = contacts.filter(c => 
                c.name && c.name.toLowerCase().includes(lowerName)
            );
            if (possibleMatches.length > 0) {
                logger.debug('[RESOLVE] Possible contact matches:', possibleMatches.map(c => ({
                    id: c.id?._serialized,
                    name: c.name,
                    pushname: c.pushname,
                    shortName: c.shortName,
                    number: c.number
                })));
            }
            
            break;
        } catch (err) {
            retryCount++;
            logger.error(`[RESOLVE][ERROR] Failed to fetch contacts (attempt ${retryCount}/${maxRetries}):`, err);
            
            if (retryCount === maxRetries) {
                return null;
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    }

    logger.error(`[RESOLVE][ERROR] No valid contact found for: ${nameOrNumber}`);
    return null;
}

// Add function to clear contact cache
function clearContactCache() {
    contactCache = null;
    logger.debug('[RESOLVE] Contact cache cleared');
}

// Export client getter and utility functions
export { 
    getClient, 
    isClientReady, 
    validateStringInput, 
    resolveContactJid 
};

// --- WhatsApp session persistence and improved logging ---
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let timer: NodeJS.Timeout | null = null;
    return ((...args: any[]) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    }) as T;
}

let client: Client | null = null;
let isClientReady = false;
let lastQrDataUrl: string | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 5000; // 5 seconds
const RECONNECT_MAX_DELAY = 30000; // 30 seconds
const RECONNECT_JITTER = 1000; // 1 second

let isReconnecting = false;

// Add type for pending requests
interface PendingRequest<T> {
    operation: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

// Initialize pendingRequests array with proper type
let pendingRequests: PendingRequest<any>[] = [];

const saveSessionDebounced = debounce((session: any) => {
    if (!session || typeof session !== 'object') return;
    try {
        saveSession(session);
    } catch (error) {
        console.error('❌ Failed to save session:', error);
    }
}, 500);

// Add session state tracking
let sessionRestoreAttempts = 0;
const MAX_SESSION_RESTORE_ATTEMPTS = 3;
const SESSION_RESTORE_DELAY = 2000; // 2 seconds

// Add session persistence tracking
let lastSessionState: {
    isAuthenticated: boolean;
    timestamp: number;
} | null = null;

// Add cleanup state tracking
let isCleaningUp = false;
let cleanupPromise: Promise<void> | null = null;

// Add initialization state tracking
let initializationPromise: Promise<void> | null = null;

class ClientInitializationError extends WhatsAppError {
    constructor(message: string, details?: any) {
        super(message, 'CLIENT_INIT_ERROR', details);
        this.name = 'ClientInitializationError';
    }
}

class SessionError extends WhatsAppError {
    constructor(message: string, details?: any) {
        super(message, 'SESSION_ERROR', details);
        this.name = 'SessionError';
    }
}

function createClient() {
    // Create session directory if it doesn't exist
    const sessionDir = path.join(__dirname, 'sessions');
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Create client with LocalAuth
    return new Client({
        authStrategy: new LocalAuth({
            clientId: "whatsapp-client",
            dataPath: sessionDir
        }),
        puppeteer: getPuppeteerConfig()
    });
}

function getPuppeteerConfig() {
    return {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--window-size=800,600',
            '--disable-features=site-per-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-extensions',
            '--disable-infobars',
            '--disable-blink-features=AutomationControlled',
            '--disable-translate',
            '--disable-sync',
            '--disable-background-networking',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-renderer-backgrounding',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--enable-features=NetworkService,NetworkServiceInProcess'
        ],
        slowMo: 0,
        timeout: 10000
    };
}

function setupClientEventHandlers(client: Client) {
    client.on('session', (session) => {
        saveSessionDebounced(session);
        console.log('✅ [WHATSAPP][SESSION] Session data received and saved.');
        lastSessionState = {
            isAuthenticated: true,
            timestamp: Date.now()
        };
        clearContactCache(); // Clear cache on new session
    });

    client.on('authenticated', () => {
        console.log('✅ [WHATSAPP][AUTH] Successfully authenticated. Session is now active.');
        lastSessionState = {
            isAuthenticated: true,
            timestamp: Date.now()
        };
        clearContactCache(); // Clear cache on authentication
    });

    client.on('auth_failure', (msg) => {
        isClientReady = false;
        reconnectAttempts = 0;
        console.error('⚠️ [WHATSAPP][ERROR] Authentication failed:', msg);
        clearContactCache(); // Clear cache on auth failure
        // Only invalidate session if it's a true auth failure
        if (msg === 'LOGOUT') {
            console.log('🔄 [WHATSAPP][SESSION] User logged out from mobile app. Session invalidated.');
            invalidateSession();
            lastSessionState = null;
        } else {
            console.log('⚠️ [WHATSAPP][SESSION] Temporary auth failure, attempting to restore session...');
            // Try to restore the session
            attemptSessionRestore().catch(err => {
                console.error('[WHATSAPP][SESSION][ERROR] Failed to restore session:', err);
            });
        }
    });

    client.on('disconnected', (reason: string) => {
        isClientReady = false;
        console.warn(`[WHATSAPP][WARN] Client disconnected. Reason: ${reason}`);
        clearContactCache(); // Clear cache on disconnect
        
        // Only invalidate session on explicit logout
        if (reason === 'LOGOUT') {
            console.log('🔄 [WHATSAPP][SESSION] User logged out from mobile app. Session invalidated.');
            invalidateSession();
            lastSessionState = null;
        } else {
            console.log('🔄 [WHATSAPP][CONNECTION] Connection lost, attempting to reconnect...');
            // Try to restore the session
            attemptSessionRestore().catch(err => {
                console.error('[WHATSAPP][SESSION][ERROR] Failed to restore session:', err);
            });
        }
    });

    client.on('ready', async () => {
        isClientReady = true;
        reconnectAttempts = 0;
        lastQrDataUrl = null;
        lastSessionState = {
            isAuthenticated: true,
            timestamp: Date.now()
        };
        
        try {
            const info = client ? client.info : null;
            if (info && info.wid && info.pushname) {
                console.log(`✅ [WHATSAPP][READY] Connected to WhatsApp account: ${info.pushname} (${info.wid.user})`);
                console.log('✅ [WHATSAPP][SESSION] Session is active and ready to use.');
            } else if (info && info.wid) {
                console.log(`✅ [WHATSAPP][READY] Connected to WhatsApp account: ${info.wid.user}`);
                console.log('✅ [WHATSAPP][SESSION] Session is active and ready to use.');
            } else {
                console.log('✅ [WHATSAPP][READY] Client is ready and connected (account info unavailable).');
            }
        } catch (e) {
            console.log('✅ [WHATSAPP][READY] Client is ready and connected (could not fetch account info).');
        }
    });

    client.on('qr', (qr) => {
        // Only show QR if we don't have a valid session
        if (!lastSessionState || !lastSessionState.isAuthenticated) {
            isClientReady = false;
            console.log('🔄 [WHATSAPP][SESSION] Session not found or expired. Generating new QR code...');
            invalidateSession();
            qrcode.toDataURL(qr, { errorCorrectionLevel: 'H', margin: 1, width: 300 }, (err, url) => {
                if (!err && url) {
                    lastQrDataUrl = url;
                    console.log('📱 [WHATSAPP][QR] QR code generated. Please scan with your WhatsApp mobile app.');
                    console.log('ℹ️ [WHATSAPP][QR] Instructions:');
                    console.log('   1. Open WhatsApp on your phone');
                    console.log('   2. Tap Menu or Settings and select WhatsApp Web');
                    console.log('   3. Point your phone to this screen to scan the QR code');
                } else if (err) {
                    console.error('[WHATSAPP][ERROR] Failed to generate QR code data URL:', err);
                }
            });
        } else {
            console.log('⚠️ [WHATSAPP][SESSION] QR code received but session is still valid, ignoring...');
        }
    });

    client.on('change_state', (state: WAState) => {
        console.log(`[WHATSAPP][STATE] Client state changed: ${state}`);
        switch (state) {
            case WAState.CONFLICT:
                console.log('⚠️ [WHATSAPP][STATE] Multiple instances detected. Session may be invalid.');
                break;
            case WAState.CONNECTED:
                console.log('✅ [WHATSAPP][STATE] Successfully connected to WhatsApp.');
                break;
            case WAState.UNLAUNCHED:
                console.log('⚠️ [WHATSAPP][STATE] WhatsApp Web not launched. Session may be invalid.');
                break;
        }
    });

    client.on('error', (err) => {
        isClientReady = false;
        console.error('[WHATSAPP][ERROR] Client error:', err);
        console.log('🔄 [WHATSAPP][CONNECTION] Attempting to recover from error...');
        attemptReconnect();
    });
}

// Modify restoreSession to be more persistent
async function restoreSession(): Promise<boolean> {
    try {
        const sessionDir = path.join(__dirname, '../sessions/whatsapp-client');
        if (!fs.existsSync(sessionDir)) {
            console.log('[WHATSAPP][SESSION] No existing session found');
            return false;
        }

        // Check if we have a recent valid session state
        if (lastSessionState && lastSessionState.isAuthenticated) {
            const sessionAge = Date.now() - lastSessionState.timestamp;
            if (sessionAge < 24 * 60 * 60 * 1000) { // 24 hours
                console.log('[WHATSAPP][SESSION] Using existing valid session state');
                return true;
            }
        }

        console.log('[WHATSAPP][SESSION] Attempting to restore existing session...');
        client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'whatsapp-client',
                dataPath: path.join(__dirname, '../sessions')
            }),
            puppeteer: getPuppeteerConfig()
        });

        setupClientEventHandlers(client);
        await client.initialize();

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[WHATSAPP][SESSION] Session restoration timeout');
                resolve(false);
            }, 30000);

            const readyHandler = () => {
                clearTimeout(timeout);
                client?.removeListener('qr', qrHandler);
                client?.removeListener('auth_failure', authFailureHandler);
                console.log('✅ [WHATSAPP][SESSION] Successfully restored session');
                sessionRestoreAttempts = 0;
                lastSessionState = {
                    isAuthenticated: true,
                    timestamp: Date.now()
                };
                resolve(true);
            };

            const qrHandler = () => {
                clearTimeout(timeout);
                client?.removeListener('ready', readyHandler);
                client?.removeListener('auth_failure', authFailureHandler);
                // Only consider session expired if we don't have a valid session state
                if (!lastSessionState || !lastSessionState.isAuthenticated) {
                    console.log('⚠️ [WHATSAPP][SESSION] Session expired, QR code required');
                    resolve(false);
                } else {
                    console.log('⚠️ [WHATSAPP][SESSION] QR code received but session is still valid, ignoring...');
                    resolve(true);
                }
            };

            const authFailureHandler = () => {
                clearTimeout(timeout);
                client?.removeListener('ready', readyHandler);
                client?.removeListener('qr', qrHandler);
                console.log('❌ [WHATSAPP][SESSION] Session authentication failed');
                resolve(false);
            };

            client?.on('ready', readyHandler);
            client?.on('qr', qrHandler);
            client?.on('auth_failure', authFailureHandler);
        });
    } catch (error) {
        console.error('[WHATSAPP][SESSION][ERROR] Failed to restore session:', error);
        return false;
    }
}

// Add automatic session restoration
async function attemptSessionRestore(): Promise<boolean> {
    if (sessionRestoreAttempts >= MAX_SESSION_RESTORE_ATTEMPTS) {
        console.log('[WHATSAPP][SESSION] Max session restore attempts reached');
        return false;
    }

    sessionRestoreAttempts++;
    console.log(`[WHATSAPP][SESSION] Attempting session restore (${sessionRestoreAttempts}/${MAX_SESSION_RESTORE_ATTEMPTS})...`);

    try {
        const restored = await restoreSession();
        if (restored) {
            return true;
        }

        // If restoration failed and we haven't reached max attempts, try again after delay
        if (sessionRestoreAttempts < MAX_SESSION_RESTORE_ATTEMPTS) {
            console.log(`[WHATSAPP][SESSION] Session restore failed, retrying in ${SESSION_RESTORE_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, SESSION_RESTORE_DELAY));
            return attemptSessionRestore();
        }

        return false;
    } catch (error) {
        console.error('[WHATSAPP][SESSION][ERROR] Session restore attempt failed:', error);
        return false;
    }
}

// Add null check helper
function assertClient(client: Client | null): asserts client is Client {
    if (!client) {
        throw new Error('WhatsApp client is not initialized');
    }
}

// Modify validateClient to be more robust
async function validateClient(client: Client): Promise<boolean> {
    try {
        // Check if client is ready
        if (!isClientReady) {
            logger.debug('[VALIDATE] Client not ready');
            return false;
        }

        // Check if puppeteer page exists and is connected
        if (!client.pupPage) {
            logger.debug('[VALIDATE] Puppeteer page not found');
            return false;
        }

        // Try to evaluate a simple function to check if page is responsive
        try {
            await client.pupPage.evaluate(() => true);
            
            // Additional check: try to get client info
            const info = await client.getState();
            if (!info) {
                logger.debug('[VALIDATE] Could not get client state');
                return false;
            }
            
            return true;
        } catch (err) {
            logger.debug('[VALIDATE] Puppeteer page not responsive:', err);
            return false;
        }
    } catch (err) {
        logger.debug('[VALIDATE] Client validation failed:', err);
        return false;
    }
}

// Modify getClient to handle Puppeteer session issues
async function getClient(): Promise<Client> {
    clientLogger.debug('Getting WhatsApp client');
    
    if (!client) {
        clientLogger.info('Client not initialized, creating new instance');
        client = new Client({
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });
        
        // Register event handlers
        const eventHandlers = registerEventHandlers()!;
        if (eventHandlers) {
            eventHandlers.onMessage(client);
            eventHandlers.onMessageAck(client);
            eventHandlers.onGroupMessage(client);
            eventHandlers.onGroupParticipants(client);
            eventHandlers.onContactStatus(client);
        }

        // Register error handlers
        const errorHandlers = registerErrorHandlers()!;
        if (errorHandlers) {
            errorHandlers.onConnectionError(client);
            errorHandlers.onAuthenticationError(client);
            errorHandlers.onMessageError(client);
            errorHandlers.onMediaError(client);
            errorHandlers.onGroupError(client);
        }
    }

    if (!isClientReady) {
        clientLogger.warn('Client not ready, waiting for initialization');
    }

    return client;
}

// Initialize WhatsApp on startup
export const initializeWhatsAppOnStartup = async () => {
    try {
        console.log('[INIT] Starting WhatsApp initialization...');
        const client = await getClient();
        if (!client) {
            throw new Error('Failed to initialize WhatsApp client');
        }
        console.log('[INIT] WhatsApp client initialized successfully');
        return client;
    } catch (error) {
        console.error('[INIT][ERROR] Failed to initialize WhatsApp:', error);
        throw error;
    }
};

// Register event and error handlers
export const registerHandlersOnStartup = async () => {
    try {
        console.log('[INIT] Registering event and error handlers...');
        const client = await getClient();
        if (!client) {
            throw new Error('Client not initialized');
        }
        
        // Register event handlers
        try {
            registerEventHandlers();
            console.log('[INIT] Event handlers registered successfully');
        } catch (error) {
            console.error('[INIT][ERROR] Failed to register event handlers:', error);
            // Don't throw here, continue with error handlers
        }

        // Register error handlers
        try {
            registerErrorHandlers();
            console.log('[INIT] Error handlers registered successfully');
        } catch (error) {
            console.error('[INIT][ERROR] Failed to register error handlers:', error);
            // Don't throw here, let the function complete
        }

        console.log('[INIT] All handlers registered successfully');
    } catch (error) {
        console.error('[INIT][ERROR] Failed to register handlers:', error);
        throw new WhatsAppError('Failed to register event/error handlers', 'HANDLER_REGISTRATION_ERROR');
    }
};

// Call initialization functions
(async () => {
    try {
        await initializeWhatsAppOnStartup();
        await registerHandlersOnStartup();
        console.log('[INIT] WhatsApp initialization completed successfully');
    } catch (error) {
        console.error('[INIT][ERROR] WhatsApp initialization failed:', error);
        // Don't throw here, let the application continue
    }
})();

// --- Request Queue Management ---
async function handleRequest<T>(operation: () => Promise<T>): Promise<T> {
    logger.debug('Handling request');
    
    if (isCleaningUp) {
        logger.warn('Client is being cleaned up, request rejected');
        throw new WhatsAppError('CLIENT_CLEANUP', 'WhatsApp client is being cleaned up. Please try again later.');
    }

    if (isReconnecting) {
        logger.info('Client is reconnecting, queueing request');
        return new Promise<T>((resolve, reject) => {
            const request: PendingRequest<T> = {
                operation,
                resolve,
                reject
            };
            pendingRequests.push(request);
        });
    }

    try {
        return await operation();
    } catch (error) {
        logger.error('Request failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}

// Update the reconnection logic to handle pending requests correctly
async function attemptReconnect(): Promise<void> {
    sessionLogger.info('Attempting to reconnect');
    
    if (isReconnecting) {
        sessionLogger.debug('Reconnection already in progress');
        return;
    }

    isReconnecting = true;
    reconnectAttempts = 0;
    let lastValidationError: Error | null = null;

    try {
        while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(
                RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts - 1),
                RECONNECT_MAX_DELAY
            ) + Math.random() * RECONNECT_JITTER;

            sessionLogger.info('Reconnection attempt', {
                attempt: reconnectAttempts,
                maxAttempts: MAX_RECONNECT_ATTEMPTS,
                delay: Math.round(delay / 1000) + 's'
            });

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                await cleanup();
                const newClient = await getClient();
                
                // Validate the new client
                let isValid = false;
                let validationRetries = 0;
                
                while (!isValid && validationRetries < 3) {
                    try {
                        isValid = await validateClient(newClient);
                        if (isValid) {
                            sessionLogger.info('Client validation successful');
                            break;
                        }
                    } catch (err) {
                        lastValidationError = err instanceof Error ? err : new Error('Unknown validation error');
                        sessionLogger.error('Client validation failed', {
                            attempt: validationRetries + 1,
                            error: lastValidationError.message
                        });
                    }
                    validationRetries++;
                    if (validationRetries < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                if (!isValid) {
                    throw new Error('New client validation failed after reconnection');
                }

                // Process any pending requests
                const requestsToProcess = [...pendingRequests];
                pendingRequests = [];
                
                sessionLogger.info('Processing pending requests', {
                    count: requestsToProcess.length
                });

                for (const request of requestsToProcess) {
                    try {
                        const result = await request.operation();
                        request.resolve(result);
                    } catch (error) {
                        request.reject(error);
                    }
                }

                sessionLogger.info('Reconnection successful');
                return;
            } catch (error) {
                sessionLogger.error('Reconnection attempt failed', {
                    attempt: reconnectAttempts,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                if (reconnectAttempts === MAX_RECONNECT_ATTEMPTS) {
                    throw new Error(`Reconnection failed after ${MAX_RECONNECT_ATTEMPTS} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
    } finally {
        isReconnecting = false;
    }
}

// Modify sendMessage to handle async client
export const sendMessage = async (to: string, message: string) => {
    return handleRequest(async () => {
        const client = await getClient();
        assertClient(client);
        
        if (!isClientReady) throw new Error('WhatsApp client is not ready. Please connect and scan the QR code.');
        validateStringInput(to, 'Recipient contact');
        validateStringInput(message, 'Message content');
        
        try {
            console.log(`[SEND][INFO] Sending message to contact: ${to}`);
            const jid = await resolveContactJid(to);
            console.log(`[SEND][INFO] Resolved JID: ${jid}`);
            if (!jid) throw new Error('Invalid phone number or contact name');
            if (!client.info || !client.info.wid) {
                throw new Error('WhatsApp client is not ready. Please connect and scan the QR code.');
            }
            await client.sendMessage(jid, message);
            console.log(`[SEND][SUCCESS] Message sent to ${jid}`);
        } catch (err) {
            console.error('[SEND][ERROR]', err);
            throw err;
        }
    });
};

// --- Schedule a message to a phone number or contact name (IST support, with logging and error handling) ---
export const scheduleMessage = async (to: string, message: string, date: Date | string) => {
    validateStringInput(to, 'Recipient contact');
    validateStringInput(message, 'Message content');
    try {
        let scheduled: Date;
        if (typeof date === 'string') {
            try {
                scheduled = parseISTDate(date);
            } catch (err: any) {
                throw new Error('Invalid date format. Please use YYYY-MM-DDTHH:mm:ss or DD/MM/YYYY, HH:mm:ss');
            }
        } else if (date instanceof Date && !isNaN(date.getTime())) {
            scheduled = date;
        } else {
            throw new Error('Invalid date value. Please provide a valid date string or Date object.');
        }
        const now = new Date();
        const delay = scheduled.getTime() - now.getTime();
        if (delay > 0) {
            setTimeout(async () => {
                try {
                    await sendMessage(to, message);
                    console.log(`[SCHEDULE][SUCCESS] Message sent to '${to}' at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                } catch (err) {
                    console.error(`[SCHEDULE][ERROR] Failed to send scheduled message to '${to}':`, err);
                }
            }, delay);
            console.log(`[SCHEDULE][INFO] Scheduling message to '${to}' at ${scheduled.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (delay: ${delay}ms)`);
        } else {
            throw new Error('Scheduled time must be in the future. Please provide a future date/time.');
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SCHEDULE][ERROR] Failed to schedule message to '${to}':`, msg);
        throw new Error(msg);
    }
};

// --- Persistent Scheduled Messages ---
const SCHEDULED_DB_PATH = path.join(process.cwd(), 'scheduled-messages.json');

interface ScheduledMessage {
    to: string;
    message: string;
    date: string; // ISO string
    id: string;
}

async function loadScheduledMessages(): Promise<ScheduledMessage[]> {
    try {
        const data = await fs.promises.readFile(SCHEDULED_DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if ((err as any).code === 'ENOENT') return [];
        console.error('[SCHEDULE][DB][ERROR] Failed to load scheduled messages:', err);
        return [];
    }
}

async function saveScheduledMessages(messages: ScheduledMessage[]) {
    try {
        await fs.promises.writeFile(SCHEDULED_DB_PATH, JSON.stringify(messages, null, 2), 'utf-8');
    } catch (err) {
        console.error('[SCHEDULE][DB][ERROR] Failed to save scheduled messages:', err);
    }
}

function scheduleSendJob(msg: ScheduledMessage) {
    const now = Date.now();
    const sendAt = new Date(msg.date).getTime();
    const delay = sendAt - now;
    if (delay <= 0) return;
    setTimeout(async () => {
        try {
            await sendMessage(msg.to, msg.message);
            console.log(`[SCHEDULE][PERSIST][SUCCESS] Sent scheduled message to '${msg.to}' at ${new Date().toISOString()}`);
        } catch (err) {
            console.error(`[SCHEDULE][PERSIST][ERROR] Failed to send scheduled message to '${msg.to}':`, err);
        } finally {
            // Remove from DB after sending
            const all = await loadScheduledMessages();
            await saveScheduledMessages(all.filter(m => m.id !== msg.id));
        }
    }, delay);
    console.log(`[SCHEDULE][PERSIST][INFO] Scheduled message to '${msg.to}' at ${msg.date} (delay: ${delay}ms)`);
}

// On startup, restore and schedule all pending messages
(async function restoreScheduledMessagesOnStartup() {
    const messages = await loadScheduledMessages();
    for (const msg of messages) {
        scheduleSendJob(msg);
    }
})();

// --- Schedule a persistent message (DB-backed) ---
export const schedulePersistentMessage = async (to: string, message: string, date: Date | string) => {
    validateStringInput(to, 'Recipient contact');
    validateStringInput(message, 'Message content');
    let scheduled: Date;
    if (typeof date === 'string') {
        try {
            scheduled = parseISTDate(date);
        } catch (err: any) {
            throw new Error('Invalid date format. Please use YYYY-MM-DDTHH:mm:ss or DD/MM/YYYY, HH:mm:ss');
        }
    } else if (date instanceof Date && !isNaN(date.getTime())) {
        scheduled = date;
    } else {
        throw new Error('Invalid date value. Please provide a valid date string or Date object.');
    }
    if (scheduled.getTime() <= Date.now()) {
        throw new Error('Scheduled time must be in the future. Please provide a future date/time.');
    }
    const id = `${to}_${scheduled.getTime()}_${Math.random().toString(36).slice(2, 10)}`;
    const msg: ScheduledMessage = { to, message, date: scheduled.toISOString(), id };
    const all = await loadScheduledMessages();
    all.push(msg);
    await saveScheduledMessages(all);
    scheduleSendJob(msg);
    console.log(`[SCHEDULE][PERSIST][INFO] Persistently scheduled message to '${to}' at ${scheduled.toISOString()}`);
    return { success: true, id };
};

// --- Get unread messages (optionally for a specific contact) ---
export const getUnreadMessages = async (contact?: string) => {
    const client = await getClient();
    assertClient(client);
    
    if (!isClientReady) throw new Error('WhatsApp client is not ready. Please connect and scan the QR code.');
    
    try {
        let unreadMessages: any[] = [];
        
        if (contact) {
            validateStringInput(contact, 'Contact');
            const jid = await resolveContactJid(contact);
            if (!jid) throw new Error('Invalid contact');
            
            const chat = await client.getChatById(jid);
            if (!chat) throw new Error('Chat not found');
            
            const unreadCount = chat.unreadCount || 0;
            if (unreadCount > 0) {
                const messages = await chat.fetchMessages({ limit: unreadCount });
                unreadMessages = messages.filter((msg: any) => {
                    return !msg.fromMe && (!msg.ack || msg.ack === 0);
                });
            }
        } else {
            const chats = await client.getChats();
            
            for (const chat of chats) {
                try {
                    const unreadCount = chat.unreadCount || 0;
                    if (unreadCount > 0) {
                        const messages = await chat.fetchMessages({ limit: unreadCount });
                        const chatUnread = messages.filter((msg: any) => {
                            return !msg.fromMe && (!msg.ack || msg.ack === 0);
                        });
                        if (chatUnread.length > 0) {
                            unreadMessages = unreadMessages.concat(chatUnread);
                        }
                    }
                } catch (err) {
                    console.error(`[UNREAD][ERROR] Failed to fetch messages for chat ${chat.id._serialized}:`, err);
                    continue;
                }
            }
        }
        
        unreadMessages.sort((a: any, b: any) => b.timestamp - a.timestamp);
        
        console.log(`[UNREAD][INFO] Found ${unreadMessages.length} unread messages${contact ? ` for ${contact}` : ' across all chats'}`);
        return unreadMessages;
    } catch (err) {
        console.error('[UNREAD][ERROR]', err);
        throw err;
    }
};

// --- Get messages for a contact (optionally after a date) ---
export const getMessages = async (contact: string, afterDate?: Date) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready. Please connect and scan the QR code.');
    validateStringInput(contact, 'Contact');
    const jid = await resolveContactJid(contact);
    if (!jid) throw new Error('Invalid contact');
    try {
        const chat = await client.getChatById(jid);
        if (!chat) throw new Error('Chat not found');
        let messages = await chat.fetchMessages({ limit: 100 });
        if (afterDate) {
            messages = messages.filter((msg: any) => msg.timestamp * 1000 >= afterDate.getTime());
        }
        return messages;
    } catch (err) {
        console.error('[MESSAGES][ERROR]', err);
        throw err;
    }
};

// --- Search messages by query (optionally for a contact) ---
export const searchMessages = async (query: string, contact?: string) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready. Please connect and scan the QR code.');
    validateStringInput(query, 'Query');
    let chat;
    if (contact) {
        const jid = await resolveContactJid(contact);
        if (!jid) throw new Error('Invalid contact');
        chat = await client.getChatById(jid);
        if (!chat) throw new Error('Chat not found');
    }
    try {
        // whatsapp-web.js does not have a direct search API, so filter messages manually
        let messages = chat ? await chat.fetchMessages({ limit: 100 }) : [];
        if (!chat) {
            // Search all chats
            const chats = await client.getChats();
            for (const c of chats) {
                const msgs = await c.fetchMessages({ limit: 50 });
                messages = messages.concat(msgs);
            }
        }
        return messages.filter((msg: any) => msg.body && msg.body.toLowerCase().includes(query.toLowerCase()));
    } catch (err) {
        console.error('[SEARCH][ERROR]', err);
        throw err;
    }
};

// --- Send media to multiple recipients with multiple files ---
export const sendBulkMedia = async (to: string | string[], filePaths: string[], options: { caption?: string } = {}) => {
    try {
        // Normalize recipients array
        const recipients = Array.isArray(to) 
            ? to 
            : typeof to === 'string' 
                ? to.split(',').map(r => r.trim()).filter(r => r) // Split by comma and clean up
                : [];

        logger.info(`[SEND_BULK_MEDIA] Attempting to send ${filePaths.length} files to ${recipients.length} recipients`);
        logger.debug(`[SEND_BULK_MEDIA] Files: ${filePaths.join(', ')}`);
        logger.debug(`[SEND_BULK_MEDIA] Recipients: ${recipients.join(', ')}`);

        const client = await getClient();
        if (!isClientReady) {
            throw new WhatsAppError('CLIENT_NOT_READY', 'WhatsApp client is not ready. Please connect and scan the QR code.');
        }

        // Validate inputs
        if (recipients.length === 0) {
            throw new WhatsAppError('INVALID_RECIPIENTS', 'At least one recipient is required');
        }
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            throw new WhatsAppError('INVALID_FILES', 'At least one file is required');
        }

        // Validate and resolve all recipients first
        const resolvedRecipients = await Promise.all(
            recipients.map(async (recipient) => {
                const jid = await resolveContactJid(recipient);
                if (!jid) {
                    throw new WhatsAppError('CONTACT_NOT_FOUND', `Could not resolve contact: ${recipient}`);
                }
                return { original: recipient, jid };
            })
        );

        // Remove duplicates based on JID
        const uniqueRecipients = resolvedRecipients.filter((recipient, index, self) =>
            index === self.findIndex((r) => r.jid === recipient.jid)
        );

        logger.debug(`[SEND_BULK_MEDIA] Resolved ${uniqueRecipients.length} unique recipients`);

        // Validate all files exist
        for (const filePath of filePaths) {
            if (!fs.existsSync(filePath)) {
                throw new WhatsAppError('FILE_NOT_FOUND', `File not found: ${filePath}`);
            }
        }

        // Create MessageMedia objects for all files
        const mediaObjects = await Promise.all(
            filePaths.map(async (filePath) => {
                try {
                    return await MessageMedia.fromFilePath(filePath);
                } catch (err) {
                    throw new WhatsAppError('MEDIA_CREATION_FAILED', `Failed to create media from file: ${filePath}`, { originalError: err });
                }
            })
        );

        // Send all files to all recipients
        const results = {
            success: [] as Array<{ recipient: string; jid: string; files: string[] }>,
            failed: [] as Array<{ recipient: string; error: string }>
        };

        for (const { original: recipient, jid } of uniqueRecipients) {
            try {
                const sentFiles: string[] = [];
                
                for (const [index, media] of mediaObjects.entries()) {
                    const message = await client.sendMessage(jid, media, options.caption ? { caption: options.caption } : {});
                    sentFiles.push(filePaths[index]);
                    logger.debug(`[SEND_BULK_MEDIA] Sent file ${filePaths[index]} to ${jid}`);
                }

                results.success.push({
                    recipient,
                    jid,
                    files: sentFiles
                });
                
                logger.info(`[SEND_BULK_MEDIA][SUCCESS] All files sent to ${recipient}`);
            } catch (error) {
                results.failed.push({
                    recipient,
                    error: error instanceof Error ? error.message : String(error)
                });
                logger.error(`[SEND_BULK_MEDIA][ERROR] Failed to send files to ${recipient}:`, error);
            }
        }

        return {
            success: results.success.length > 0,
            results
        };
    } catch (error) {
        logger.error('[SEND_BULK_MEDIA][ERROR]', error);
        if (error instanceof WhatsAppError) {
            throw error;
        }
        throw new WhatsAppError(
            'BULK_MEDIA_SEND_FAILED',
            'Failed to send bulk media',
            { originalError: error }
        );
    }
};

// Keep the original sendMedia function for backward compatibility
export const sendMedia = async (to: string, filePath: string, caption?: string) => {
    return sendBulkMedia(to, [filePath], { caption });
};

// --- Download media for a contact (optionally by date and count) ---
export const downloadMediaByContact = async (contact: string, date?: Date, count: number = 1) => {
    const client = await getClient();
    if (!isClientReady) throw new Error('WhatsApp client is not ready. Please connect and scan the QR code.');
    validateStringInput(contact, 'Contact');
    const jid = await resolveContactJid(contact);
    if (!jid) throw new Error('Invalid contact');
    try {
        const chat = await client.getChatById(jid);
        if (!chat) throw new Error('Chat not found');
        let messages = await chat.fetchMessages({ limit: 100 });
        if (date) {
            messages = messages.filter((msg: any) => msg.timestamp * 1000 >= date.getTime());
        }
        // Only media messages
        const mediaMsgs = messages.filter((msg: any) => msg.hasMedia).slice(0, count);
        const files: string[] = [];
        for (const msg of mediaMsgs) {
            const media = await msg.downloadMedia();
            if (!media) continue;
            const ext = media.mimetype.split('/')[1] || 'bin';
            const filename = `media_${msg.id.id}_${Date.now()}.${ext}`;
            const filePath = require('path').join(process.cwd(), filename);
            require('fs').writeFileSync(filePath, media.data, 'base64');
            files.push(filePath);
        }
        return { files };
    } catch (err) {
        console.error('[DOWNLOAD_MEDIA][ERROR]', err);
        throw err;
    }
};

// --- Download media (alias for backward compatibility) ---
export const downloadMedia = downloadMediaByContact;

// --- Multi-account/multi-device support (stub) ---
// In a real system, you would manage multiple client instances keyed by user/device.
// For now, this is a placeholder for future expansion.
export function getClientForAccount(accountId: string) {
    // TODO: Implement multi-account logic
    return getClient();
}

// Enhance cleanup function
async function cleanup(): Promise<void> {
    sessionLogger.info('Cleaning up WhatsApp session');
    
    if (isCleaningUp) {
        sessionLogger.debug('Cleanup already in progress');
        return;
    }

    isCleaningUp = true;
    try {
        if (client) {
            sessionLogger.debug('Closing client connection');
            await client.destroy();
            client = null;
        }
        isClientReady = false;
        sessionLogger.info('Session cleaned up successfully');
    } catch (error) {
        sessionLogger.error('Error during cleanup', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    } finally {
        isCleaningUp = false;
    }
}

// Modify startWhatsAppSession to handle null checks
export const startWhatsAppSession = async (onQRCode: (qr: string) => void) => {
    try {
        const client = await getClient();
        assertClient(client);
        
        if (isClientReady) {
            const info = client.info;
            if (info && info.wid && info.pushname) {
                console.log(`[WHATSAPP] Already connected to WhatsApp account: ${info.pushname} (${info.wid.user})`);
            } else if (info && info.wid) {
                console.log(`[WHATSAPP] Already connected to WhatsApp account: ${info.wid.user}`);
            } else {
                console.log('[WHATSAPP] Already connected to WhatsApp (account info unavailable).');
            }
            onQRCode(''); // No QR needed
            return;
        }

        if (lastQrDataUrl) {
            onQRCode(lastQrDataUrl);
            return;
        }

        let sent = false;
        const qrHandler = (qr: string) => {
            if (sent) return;
            sent = true;
            qrcode.toDataURL(qr, (err, url) => {
                if (!err && url) onQRCode(url);
                else if (err) console.error('[WHATSAPP][ERROR] Failed to generate QR code data URL:', err);
            });
            client.off('qr', qrHandler);
        };
        client.on('qr', qrHandler);
    } catch (err) {
        console.error('[WHATSAPP][ERROR] Failed to start WhatsApp session:', err);
        throw err;
    }
};