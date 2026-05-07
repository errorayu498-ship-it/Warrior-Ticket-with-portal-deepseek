// Add this to src/commands/admin/resetpanel.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Panel } = require('../../database/mongodb');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-panel')
        .setDescription('Reset and fix the ticket panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Delete old panel
            const panel = await Panel.findOne({ guildId: interaction.guild.id });
            if (panel && panel.channelId && panel.messageId) {
                const channel = interaction.guild.channels.cache.get(panel.channelId);
                if (channel) {
                    const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
                    if (msg) await msg.delete().catch(() => {});
                }
            }
            
            // Reset panel in database
            await Panel.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    embed: {
                        title: '🎫 Warrior Ticket System',
                        description: 'Select a category to create a ticket',
                        footer: 'Warrior Ticket Bot',
                        color: '#5865F2',
                        thumbnail: '',
                        image: '',
                        icon: ''
                    },
                    options: [
                        { label: 'Support', description: 'Get support help', emoji: '💬', categoryId: '', allowedRoles: [] },
                        { label: 'Purchase', description: 'Buy products', emoji: '🛒', categoryId: '', allowedRoles: [] }
                    ],
                    channelId: null,
                    messageId: null
                },
                { upsert: true }
            );
            
            await interaction.editReply('✅ Panel reset! Use `/ticket-setup` to create a new panel.');
        } catch (error) {
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }
};
