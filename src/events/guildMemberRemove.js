const { Events, EmbedBuilder } = require('discord.js');
const { Ticket, Panel } = require('../database/mongodb');
const Logger = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        try {
            const guildId = member.guild.id;
            
            // Find all open tickets created by this member
            const openTickets = await Ticket.find({
                guildId,
                creatorId: member.id,
                status: 'open'
            });

            for (const ticket of openTickets) {
                const channel = member.guild.channels.cache.get(ticket.channelId);
                if (!channel) continue;

                // Close the ticket
                ticket.status = 'closed';
                ticket.closedAt = new Date();
                ticket.closedBy = client.user.id;
                ticket.closeReason = 'User left the server';
                await ticket.save();

                // Send close message
                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 Ticket Auto-Closed')
                    .setDescription(`This ticket has been automatically closed because the creator (${member.user.tag}) left the server.`)
                    .setColor('#FF0000')
                    .setFooter({ text: 'Warrior Ticket Bot • Auto-Closed' })
                    .setTimestamp();

                await channel.send({ embeds: [closeEmbed] });

                // Log the auto-close
                const logEmbed = new EmbedBuilder()
                    .setTitle('🤖 Ticket Auto-Closed')
                    .setDescription(`**Ticket #${ticket.ticketNumber}** was auto-closed`)
                    .addFields(
                        { name: 'User Left', value: `${member.user.tag} (${member.id})`, inline: true },
                        { name: 'Category', value: ticket.category, inline: true }
                    )
                    .setColor('#FFA500')
                    .setTimestamp();

                await Logger.logTicketAction(client, guildId, logEmbed);

                // Delete channel after delay
                setTimeout(async () => {
                    try {
                        await channel.delete();
                    } catch (error) {
                        console.error('Error deleting ticket channel:', error);
                    }
                }, 5000);
            }
        } catch (error) {
            console.error('Error handling member leave:', error);
            Logger.logError(client, error);
        }
    }
};
