const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Panel } = require('../../database/mongodb');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('🔗 Get the web dashboard link for bot management')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guild.id;
            const member = await interaction.guild.members.fetch(interaction.user.id);
            
            // Check permissions
            const panel = await Panel.findOne({ guildId });
            const hasPermission = 
                member.permissions.has(PermissionFlagsBits.Administrator) ||
                member.id === interaction.guild.ownerId ||
                member.id === process.env.OWNER_ID ||
                (panel?.adminRoles?.some(roleId => member.roles.cache.has(roleId)));

            if (!hasPermission) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('🔒 Access Denied')
                            .setDescription('Only server admins, ticket admins, and server owner can access the dashboard!')
                            .setColor('#FF0000')
                    ]
                });
            }

            const portalUrl = process.env.PORTAL_URL || `http://localhost:${process.env.PORTAL_PORT || 3000}`;
            const guildUrl = `${portalUrl}/guild/${guildId}`;

            const embed = new EmbedBuilder()
                .setTitle('🔴 WARRIOR TICKET DASHBOARD')
                .setDescription('Click the button below to access the web dashboard for this server.')
                .addFields(
                    { 
                        name: '⚙️ Server Configuration',
                        value: `Configure ticket panels, roles, and more for **${interaction.guild.name}**`,
                        inline: false
                    },
                    {
                        name: '🔗 Guild Dashboard',
                        value: `\`${guildUrl}\``,
                        inline: false
                    },
                    {
                        name: '🔐 Main Portal',
                        value: `\`${portalUrl}\``,
                        inline: false
                    }
                )
                .setColor('#FF0000')
                .setFooter({ text: 'Warrior Ticket • Premium Dashboard' })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('🔧 Configure Server')
                        .setURL(guildUrl)
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setLabel('🏠 Main Portal')
                        .setURL(portalUrl)
                        .setStyle(ButtonStyle.Link)
                );

            await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });

        } catch (error) {
            console.error('Dashboard error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ Error')
                        .setDescription(error.message)
                        .setColor('#FF0000')
                ],
                ephemeral: true
            });
        }
    }
};
