export class WhatsAppError extends Error {
    constructor(message: string, public code: string, public details?: any) {
        super(message);
        this.name = 'WhatsAppError';
    }
}

export class ClientInitializationError extends WhatsAppError {
    constructor(message: string, details?: any) {
        super(message, 'CLIENT_INIT_ERROR', details);
        this.name = 'ClientInitializationError';
    }
}

export class SessionError extends WhatsAppError {
    constructor(message: string, details?: any) {
        super(message, 'SESSION_ERROR', details);
        this.name = 'SessionError';
    }
} 