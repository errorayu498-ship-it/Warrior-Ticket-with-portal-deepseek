module.exports = {
    // Ticket Emojis
    ticket_open: '<:ticket_open:1234567890123456789>',
    ticket_close: '<:ticket_close:1234567890123456789>',
    ticket_claim: '<:ticket_claim:1234567890123456789>',
    ticket_transcript: '<:ticket_transcript:1234567890123456789>',
    
    // Status Emojis
    success: '<:success:1234567890123456789>',
    error: '<:error:1234567890123456789>',
    warning: '<:warning:1234567890123456789>',
    info: '<:info:1234567890123456789>',
    
    // Category Emojis
    buy: '<:buy:1234567890123456789>',
    support: '<:support:1234567890123456789>',
    partnership: '<:partnership:1234567890123456789>',
    report: '<:report:1234567890123456789>',
    
    // Action Emojis
    lock: '<:lock:1234567890123456789>',
    unlock: '<:unlock:1234567890123456789>',
    delete: '<:delete:1234567890123456789>',
    save: '<:save:1234567890123456789>',
    
    // Additional Emojis
    loading: '<a:loading:1234567890123456789>',
    ping: '<:ping:1234567890123456789>',
    users: '<:users:1234567890123456789>',
    server: '<:server:1234567890123456789>',
    crown: '<:crown:1234567890123456789>',
    shield: '<:shield:1234567890123456789>',
    star: '<:star:1234567890123456789>',
    
    // Default method if custom emoji not available
    get: function(emojiName) {
        return this[emojiName] || '❓';
    }
};
