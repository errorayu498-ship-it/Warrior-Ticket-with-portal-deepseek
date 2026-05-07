const { EmbedBuilder } = require('discord.js');

class EmbedCreator {
    static async createTicketPanel(panelData) {
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

        // Add fields for each ticket option
        panelData.options.forEach((option, index) => {
            embed.addFields({
                name: `${option.emoji || '🎫'} ${option.label}`,
                value: option.description || `Create a ${option.label} ticket`,
                inline: true
            });
        });

        return embed;
    }

    static createTicketOpened(ticket, user, category) {
        return new EmbedBuilder()
            .setTitle('🎫 Ticket Created Successfully')
            .setDescription(`Welcome ${user}! Support staff will be with you shortly.\n\n` +
                `**Ticket ID:** #${ticket.ticketNumber}\n` +
                `**Category:** ${category.label}\n` +
                `**Created By:** ${user.tag}\n\n` +
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
            .setDescription(`**Ticket #${ticket.ticketNumber}**\n` +
                `**Opened by:** <@${ticket.creatorId}>\n` +
                `**Closed by:** ${ticket.closedBy ? `<@${ticket.closedBy}>` : 'Unknown'}\n` +
                `**Category:** ${ticket.category}\n` +
                `**Messages:** ${messages.length}`)
            .setColor('#5865F2')
            .setFooter({ text: 'Warrior Ticket Bot • Transcript' })
            .setTimestamp();
    }

    static errorEmbed(message) {
        return new EmbedBuilder()
            .setTitle('❌ Error')
            .setDescription(message)
            .setColor('#FF0000')
            .setFooter({ text: 'Warrior Ticket Bot • Error' })
            .setTimestamp();
    }

    static successEmbed(message) {
        return new EmbedBuilder()
            .setTitle('✅ Success')
            .setDescription(message)
            .setColor('#00FF00')
            .setFooter({ text: 'Warrior Ticket Bot • Success' })
            .setTimestamp();
    }
}

module.exports = EmbedCreator;
