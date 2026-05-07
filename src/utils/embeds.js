const { EmbedBuilder } = require('discord.js');

class EmbedCreator {
    static async createTicketPanel(panelData) {
        if (!panelData || !panelData.embed) {
            panelData = {
                embed: {
                    title: '🎫 Ticket System',
                    description: 'Select a category',
                    footer: 'Ticket Bot',
                    color: '#5865F2',
                    thumbnail: '',
                    image: '',
                    icon: ''
                },
                options: [{ label: 'General', description: 'General ticket', emoji: '🎫' }]
            };
        }

        const embed = new EmbedBuilder()
            .setTitle(panelData.embed.title || '🎫 Warrior Ticket System')
            .setDescription(panelData.embed.description || 'Please select a ticket category to get started!')
            .setColor(panelData.embed.color || '#5865F2')
            .setFooter({ text: panelData.embed.footer || 'Warrior Ticket Bot • Premium Support' })
            .setTimestamp();

        if (panelData.embed.thumbnail) {
            embed.setThumbnail(panelData.embed.thumbnail);
        }
        if (panelData.embed.image) {
            embed.setImage(panelData.embed.image);
        }
        if (panelData.embed.icon) {
            embed.setAuthor({ name: 'Ticket System', iconURL: panelData.embed.icon });
        }

        // Add fields for each ticket option safely
        const options = panelData.options || [];
        for (let i = 0; i < Math.min(options.length, 25); i++) {
            const option = options[i];
            if (option && option.label) {
                embed.addFields({
                    name: `${option.emoji || '🎫'} ${option.label}`,
                    value: option.description || `Create a ${option.label} ticket`,
                    inline: true
                });
            }
        }

        return embed;
    }

    static createTicketOpened(ticket, user, category) {
        return new EmbedBuilder()
            .setTitle('🎫 Ticket Created Successfully')
            .setDescription(`Welcome ${user}! Support staff will be with you shortly.\n\n` +
                `**Ticket ID:** #${ticket.ticketNumber || 'N/A'}\n` +
                `**Category:** ${category?.label || ticket.category || 'N/A'}\n` +
                `**Created By:** ${user.tag || user.username}\n\n` +
                `Please describe your issue in detail while you wait.`)
            .setColor('#00FF00')
            .setFooter({ text: 'Warrior Ticket Bot • Open Ticket' })
            .setTimestamp();
    }

    static createTicketClosed(closedBy, reason) {
        return new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(`This ticket has been closed by ${closedBy}\n\n**Reason:** ${reason || 'No reason provided'}\n\n` +
                `This channel will be deleted in 5 seconds.`)
            .setColor('#FF0000')
            .setFooter({ text: 'Warrior Ticket Bot • Ticket Closed' })
            .setTimestamp();
    }

    static createTranscript(ticket, messages) {
        return new EmbedBuilder()
            .setTitle('📝 Ticket Transcript')
            .setDescription(`**Ticket #${ticket.ticketNumber || 'N/A'}**\n` +
                `**Opened by:** <@${ticket.creatorId}>\n` +
                `**Closed by:** ${ticket.closedBy ? `<@${ticket.closedBy}>` : 'Unknown'}\n` +
                `**Category:** ${ticket.category || 'N/A'}\n` +
                `**Messages:** ${messages?.length || 0}`)
            .setColor('#5865F2')
            .setFooter({ text: 'Warrior Ticket Bot • Transcript' })
            .setTimestamp();
    }

    static errorEmbed(message) {
        return new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message || 'An error occurred')
            .setColor('#FF0000')
            .setFooter({ text: 'Warrior Ticket Bot • Error' })
            .setTimestamp();
    }

    static successEmbed(message) {
        return new EmbedBuilder()
            .setTitle('✅ Success')
            .setDescription(message || 'Operation completed')
            .setColor('#00FF00')
            .setFooter({ text: 'Warrior Ticket Bot • Success' })
            .setTimestamp();
    }
}

module.exports = EmbedCreator;
