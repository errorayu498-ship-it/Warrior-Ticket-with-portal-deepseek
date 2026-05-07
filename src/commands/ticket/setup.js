const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const { Panel } = require('../../database/mongodb');
const EmbedCreator = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('📨 Setup ticket panel using latest portal configuration')
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

            // 🔴 Get LATEST config from database (updated via portal)
            let panel = await Panel.findOne({ guildId });
            
            if (!panel) {
                panel = new Panel({
                    guildId,
                    embed: {
                        title: '🎫 WARRIOR TICKET SYSTEM',
                        description: '> **Select a category below to create a ticket**\n\n```diff\n+ Fast Support\n+ 24/7 Service\n+ Premium Quality\n```',
                        footer: '🔴 Warrior Ticket Bot • Premium',
                        color: '#FF0000',
                        thumbnail: '',
                        image: '',
                        icon: ''
                    },
                    options: [
                        { label: '🛒 Purchase', description: 'Buy premium services', emoji: '🛒', categoryId: '', allowedRoles: [] },
                        { label: '💬 Support', description: 'Get technical support', emoji: '💬', categoryId: '', allowedRoles: [] },
                        { label: '🤝 Partnership', description: 'Apply for partnership', emoji: '🤝', categoryId: '', allowedRoles: [] }
                    ]
                });
                await panel.save();
            }

            // Ensure options exist
            if (!panel.options || panel.options.length === 0) {
                panel.options = [{
                    label: 'General Ticket',
                    description: 'Open a support ticket',
                    emoji: '🎫',
                    categoryId: '',
                    allowedRoles: []
                }];
                await panel.save();
            }

            // Delete old panel if exists
            if (panel.messageId && panel.channelId) {
                try {
                    const oldChannel = interaction.guild.channels.cache.get(panel.channelId);
                    if (oldChannel) {
                        const oldMsg = await oldChannel.messages.fetch(panel.messageId).catch(() => null);
                        if (oldMsg) await oldMsg.delete().catch(() => {});
                    }
                } catch (e) {
                    console.log('Could not delete old panel:', e.message);
                }
            }

            // 🔴 Use latest config from database
            const embed = await EmbedCreator.createTicketPanel(panel);
            
            const selectOptions = panel.options.map(opt => ({
                label: opt.label.substring(0, 100),
                description: (opt.description || `Open ${opt.label} ticket`).substring(0, 100),
                emoji: opt.emoji || '🎫',
                value: opt.label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100)
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_create')
                .setPlaceholder('🔴 SELECT TICKET CATEGORY')
                .addOptions(selectOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const message = await channel.send({
                embeds: [embed],
                components: [row]
            });

            // Save the new panel location
            panel.channelId = channel.id;
            panel.messageId = message.id;
            await panel.save();

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Panel Setup Complete!')
                .setDescription(`Ticket panel has been set up with **latest portal configuration**\n\n📨 **Channel:** ${channel}\n🎫 **Categories:** ${panel.options.length}\n\n💡 **Tip:** Use \`/refresh\` to update the panel after changes.`)
                .setColor('#FF0000')
                .setFooter({ text: 'Warrior Ticket • Panel Setup' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Setup error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Setup Failed')
                        .setDescription(`\`\`\`js\n${error.message}\n\`\`\``)
                        .setColor('#FF0000')
                ],
                ephemeral: true
            });
        }
    }
};
