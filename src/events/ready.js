const { Events, ActivityType } = require('discord.js');

const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
};

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(colors.cyan('╔══════════════════════════════════════╗'));
        console.log(colors.cyan('║                                      ║'));
        console.log(colors.green(`║   ✅ Logged in as ${client.user.tag}`));
        console.log(colors.cyan('║                                      ║'));
        console.log(colors.cyan('╚══════════════════════════════════════╝'));

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
        console.log(colors.blue('📊 Bot Statistics:'));
        console.log(colors.blue(`   Servers: ${client.guilds.cache.size}`));
        console.log(colors.blue(`   Users: ${client.users.cache.size}`));
        console.log(colors.blue(`   Channels: ${client.channels.cache.size}`));

        // Register slash commands for each guild
        const { REST, Routes } = require('discord.js');
        const commands = [];
        
        client.commands.forEach(command => {
            if (command.data) {
                commands.push(command.data.toJSON());
            }
        });

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

        try {
            console.log(colors.blue('📝 Registering slash commands...'));
            
            // Register commands for each guild
            for (const [guildId, guild] of client.guilds.cache) {
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guildId),
                    { body: commands }
                );
            }
            
            console.log(colors.green('✅ Slash commands registered successfully!'));
        } catch (error) {
            console.error(colors.red('Error registering commands:'), error);
        }
    }
};
