// WhatsApp utility functions

// Normalize Indian phone numbers for WhatsApp (must be 91XXXXXXXXXX, no +, no spaces)
export function normalizeIndianNumber(input: string): string | null {
    let num = input.trim();
    if (num.length === 10) return `91${num}`;
    if (num.length === 12 && num.startsWith('91')) return num;
    if (num.length === 13 && num.startsWith('+91')) return num.slice(1);
    return null;
}

// Parse IST date string to Date (no conversion, treat as IST)
export function parseISTDate(date: string): Date {
    let istDateStr = String(date).replace(/\s*IST$/i, '').replace(/Z\s*$/i, '');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(istDateStr)) {
        const [datePart, timePart] = istDateStr.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second || 0);
    } else if (/^\d{2}\/\d{2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}(\s*[ap]m)?$/i.test(istDateStr)) {
        const match = istDateStr.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})(?:\s*([ap]m))?/i);
        if (match) {
            let [, day, month, year, hour, minute, second, ampm] = match;
            let h = parseInt(hour, 10);
            if (ampm) {
                if (ampm.toLowerCase() === 'pm' && h !== 12) h += 12;
                if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
            }
            return new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                h,
                parseInt(minute, 10),
                parseInt(second, 10)
            );
        }
    }
    throw new Error('Invalid date format. Use YYYY-MM-DDTHH:mm:ss or DD/MM/YYYY, HH:mm:ss');
}
