const { Events, ActivityType } = require('discord.js');
const chalk = require('chalk');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(chalk.cyan('╔══════════════════════════════════════╗'));
        console.log(chalk.cyan('║                                      ║'));
        console.log(chalk.green(`║   ✅ Logged in as ${client.user.tag}`));
        console.log(chalk.cyan('║                                      ║'));
        console.log(chalk.cyan('╚══════════════════════════════════════╝'));

        // Set bot status
        client.user.setPresence({
            activities: [
                {
                    name: 'Warrior Ticket',
                    type: ActivityType.Watching,
                }
            ],
            status: 'dnd',
        });

        // Log bot stats
        console.log(chalk.blue(`📊 Bot Statistics:`));
        console.log(chalk.blue(`   Servers: ${client.guilds.cache.size}`));
        console.log(chalk.blue(`   Users: ${client.users.cache.size}`));
        console.log(chalk.blue(`   Channels: ${client.channels.cache.size}`));
    }
};
