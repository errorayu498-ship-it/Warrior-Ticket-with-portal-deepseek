const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Panel } = require('../../database/mongodb');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('🔄 Refresh the ticket panel with latest configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guild.id;
            const panel = await Panel.findOne({ guildId });

            if (!panel || !panel.channelId || !panel.messageId) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ No Panel Found')
                            .setDescription('Use `/ticket-setup` to create a panel first!')
                            .setColor('#FF0000')
                    ]
                });
            }

            const channel = interaction.guild.channels.cache.get(panel.channelId);
            if (!channel) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Channel Not Found')
                            .setDescription('The panel channel was deleted. Use `/ticket-setup` to create a new one.')
                            .setColor('#FF0000')
                    ]
                });
            }

            const message = await channel.messages.fetch(panel.messageId).catch(() => null);
            if (!message) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('❌ Message Not Found')
                            .setDescription('The panel message was deleted. Use `/ticket-setup` to create a new one.')
                            .setColor('#FF0000')
                    ]
                });
            }

            // Create updated embed and select menu
            const embed = await EmbedCreator.createTicketPanel(panel);
            
            const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
            const selectOptions = panel.options.map(opt => ({
                label: opt.label.substring(0, 100),
                description: (opt.description || `Open ${opt.label}`).substring(0, 100),
                emoji: opt.emoji || '🎫',
                value: opt.label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100)
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_create')
                .setPlaceholder('🔴 SELECT TICKET CATEGORY')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.edit({
                embeds: [embed],
                components: [row]
            });

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Panel Refreshed!')
                .setDescription(`Ticket panel has been updated with latest configuration!\n\n📨 **Channel:** ${channel}\n🎫 **Options:** ${panel.options.length}`)
                .setColor('#FF0000')
                .setFooter({ text: 'Warrior Ticket • Panel Refresh' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('Refresh error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Error')
                        .setDescription(`\`\`\`js\n${error.message}\n\`\`\``)
                        .setColor('#FF0000')
                ],
                ephemeral: true
            });
        }
    }
};
