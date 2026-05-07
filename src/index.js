require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const { connectDB } = require('./database/mongodb');
const { startWebServer } = require('./web/server');
const fs = require('fs');
const path = require('path');

// Custom color function to replace chalk
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

client.commands = new Collection();
client.tickets = new Collection();
client.emojis = require('./utils/emojis');

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const commandsFiles = fs.readdirSync(path.join(commandsPath, folder)).filter(file => file.endsWith('.js'));
    for (const file of commandsFiles) {
        const command = require(path.join(commandsPath, folder, file));
        if (command.data && command.data.name) {
            client.commands.set(command.data.name, command);
        }
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Connect to MongoDB and start bot
connectDB().then(() => {
    client.login(process.env.TOKEN);
    startWebServer(client);
}).catch(error => {
    console.error(colors.red('❌ Failed to start bot:'), error);
    process.exit(1);
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(colors.red('Unhandled promise rejection:'), error);
    try {
        const logger = require('./utils/logger');
        logger.logError(client, error);
    } catch (e) {
        console.error(colors.red('Logger error:'), e);
    }
});

process.on('uncaughtException', (error) => {
    console.error(colors.red('Uncaught exception:'), error);
    try {
        const logger = require('./utils/logger');
        logger.logError(client, error);
    } catch (e) {
        console.error(colors.red('Logger error:'), e);
    }
    // Don't exit, let the process continue
});
