const { EmbedBuilder } = require('discord.js');
const { ServerConfig } = require('../database/mongodb');

class Logger {
    static async logTicketAction(client, guildId, embed) {
        try {
            const config = await ServerConfig.findOne({ guildId });
            if (!config || !config.logChannelId) return;

            const channel = client.channels.cache.get(config.logChannelId);
            if (channel) {
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error('Error logging ticket action:', error);
        }
    }

    static async logError(client, error) {
        try {
            const guilds = client.guilds.cache;
            for (const [guildId, guild] of guilds) {
                const config = await ServerConfig.findOne({ guildId });
                if (!config || !config.logChannelId) continue;

                const channel = guild.channels.cache.get(config.logChannelId);
                if (channel) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('⚠️ Bot Error Detected')
                        .setDescription('```js\n' + (error.stack || error.message || error).substring(0, 4000) + '\n```')
                        .setColor('#FF0000')
                        .setFooter({ text: 'Warrior Ticket Bot • Error Log' })
                        .setTimestamp();

                    await channel.send({ embeds: [errorEmbed] });
                }
            }
        } catch (e) {
            console.error('Error logging to channels:', e);
        }
    }

    static async logToOwner(client, message) {
        try {
            const owner = await client.users.fetch(process.env.OWNER_ID);
            if (owner) {
                await owner.send({ content: message }).catch(() => {});
            }
        } catch (error) {
            console.error('Error sending DM to owner:', error);
        }
    }
}

module.exports = Logger;
