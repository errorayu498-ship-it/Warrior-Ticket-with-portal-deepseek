const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const { Panel } = require('../../database/mongodb');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Setup the ticket panel in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the ticket panel')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('channel');
            const guildId = interaction.guild.id;

            // Get panel configuration
            let panel = await Panel.findOne({ guildId });
            if (!panel) {
                // Create default panel config
                panel = new Panel({
                    guildId,
                    embed: {
                        title: '🎫 Warrior Ticket System',
                        description: 'Please select a ticket category from the dropdown menu below.\n\nOur team will assist you shortly!',
                        footer: 'Warrior Ticket Bot • Premium',
                        color: '#5865F2'
                    },
                    options: [
                        {
                            label: 'Purchase',
                            description: 'Buy our premium services',
                            emoji: '🛒',
                            categoryId: '',
                            allowedRoles: []
                        },
                        {
                            label: 'Support',
                            description: 'Get help with issues',
                            emoji: '💬',
                            categoryId: '',
                            allowedRoles: []
                        }
                    ]
                });
                await panel.save();
            }

            // Delete old panel if exists
            if (panel.messageId && panel.channelId) {
                try {
                    const oldChannel = interaction.guild.channels.cache.get(panel.channelId);
                    if (oldChannel) {
                        const oldMessage = await oldChannel.messages.fetch(panel.messageId);
                        if (oldMessage) await oldMessage.delete();
                    }
                } catch (error) {
                    // Old message not found, continue
                }
            }

            // Create new panel
            const embed = await EmbedCreator.createTicketPanel(panel);
            
            // Create dropdown
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_create')
                .setPlaceholder('Select ticket option...')
                .addOptions(
                    panel.options.map(option => ({
                        label: option.label,
                        description: option.description || `Open a ${option.label} ticket`,
                        emoji: option.emoji || '🎫',
                        value: option.label.toLowerCase()
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const message = await channel.send({
                embeds: [embed],
                components: [row]
            });

            // Save panel message info
            panel.channelId = channel.id;
            panel.messageId = message.id;
            await panel.save();

            await interaction.editReply({
                content: '✅ Ticket panel has been set up successfully!',
                ephemeral: true
            });

        } catch (error) {
            console.error('Error setting up ticket panel:', error);
            await interaction.editReply({
                content: '❌ An error occurred while setting up the ticket panel.',
                ephemeral: true
            });
        }
    }
};
