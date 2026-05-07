const mongoose = require('mongoose');
const chalk = require('chalk');

// Ticket Schema
const ticketSchema = new mongoose.Schema({
    guildId: String,
    channelId: String,
    category: String,
    creatorId: String,
    claimedBy: String,
    status: {
        type: String,
        enum: ['open', 'closed', 'deleted'],
        default: 'open'
    },
    ticketNumber: Number,
    createdAt: { type: Date, default: Date.now },
    closedAt: Date,
    closedBy: String,
    transcriptUrl: String
});

// Panel Schema
const panelSchema = new mongoose.Schema({
    guildId: { type: String, unique: true },
    channelId: String,
    messageId: String,
    embed: {
        title: { type: String, default: '🎫 Warrior Ticket System' },
        description: { type: String, default: 'Please select a ticket category from the dropdown menu below to create a ticket.\n\nOur support team will assist you shortly!' },
        footer: { type: String, default: 'Warrior Ticket Bot • Premium Support' },
        icon: { type: String, default: '' },
        thumbnail: { type: String, default: '' },
        image: { type: String, default: '' },
        color: { type: String, default: '#5865F2' }
    },
    options: [{
        label: String,
        description: String,
        emoji: String,
        categoryId: String,
        allowedRoles: [String]
    }],
    adminRoles: [String],
    supportRoles: [String],
    logChannelId: String,
    ticketCount: { type: Number, default: 0 }
});

// Server Config Schema
const serverConfigSchema = new mongoose.Schema({
    guildId: { type: String, unique: true },
    logChannelId: String,
    adminRoles: [String],
    supportRoles: [String],
    ownerId: String
});

const Ticket = mongoose.model('Ticket', ticketSchema);
const Panel = mongoose.model('Panel', panelSchema);
const ServerConfig = mongoose.model('ServerConfig', serverConfigSchema);

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(chalk.green('✅ Connected to MongoDB successfully!'));
    } catch (error) {
        console.error(chalk.red('❌ MongoDB connection error:'), error);
        process.exit(1);
    }
}

module.exports = { connectDB, Ticket, Panel, ServerConfig };
