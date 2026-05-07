require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const { connectDB } = require('./database/mongodb');
const { startWebServer } = require('./web/server');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

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
        client.commands.set(command.data.name, command);
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
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled promise rejection:'), error);
    const logger = require('./utils/logger');
    logger.logError(client, error);
});

process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught exception:'), error);
    const logger = require('./utils/logger');
    logger.logError(client, error);
});
