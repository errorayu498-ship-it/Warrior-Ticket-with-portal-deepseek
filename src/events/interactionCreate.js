const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Panel, Ticket, ServerConfig } = require('../database/mongodb');
const EmbedCreator = require('../utils/embeds');
const Logger = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction, client);
                } catch (error) {
                    console.error('Error executing command:', error);
                    await interaction.reply({
                        embeds: [EmbedCreator.errorEmbed('An error occurred while executing this command.')],
                        ephemeral: true
                    }).catch(() => {});
                }
                return;
            }

            // Handle select menu interactions
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'ticket_create') {
                    await handleTicketCreate(interaction, client);
                }
                return;
            }

            // Handle button interactions
            if (interaction.isButton()) {
                const buttonId = interaction.customId;
                
                if (buttonId === 'ticket_close') {
                    await handleTicketClose(interaction, client);
                } else if (buttonId === 'ticket_claim') {
                    await handleTicketClaim(interaction, client);
                } else if (buttonId === 'ticket_transcript') {
                    await handleTicketTranscript(interaction, client);
                }
                return;
            }

        } catch (error) {
            console.error('Interaction error:', error);
            Logger.logError(client, error);
        }
    }
};

async function handleTicketCreate(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const selectedOption = interaction.values[0];

        // Get panel config
        const panel = await Panel.findOne({ guildId });
        if (!panel) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed('Ticket panel not configured.')]
            });
            return;
        }

        const option = panel.options.find(opt => opt.label.toLowerCase() === selectedOption);
        if (!option) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed('Invalid ticket option.')]
            });
            return;
        }

        // Check if user already has an open ticket in this category
        const existingTicket = await Ticket.findOne({
            guildId,
            creatorId: userId,
            category: selectedOption,
            status: 'open'
        });

        if (existingTicket) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed(`You already have an open ticket in this category: <#${existingTicket.channelId}>`)]
            });
            return;
        }

        // Create ticket channel
        const categoryId = option.categoryId;
        const ticketNumber = panel.ticketCount + 1;

        // Create permissions for the channel
        const permissionOverwrites = [
            {
                id: guildId,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: userId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            },
            {
                id: client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
            }
        ];

        // Add admin roles
        for (const roleId of panel.adminRoles) {
            permissionOverwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
        }

        // Add support roles allowed for this category
        for (const roleId of option.allowedRoles) {
            permissionOverwrites.push({
                id: roleId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
            });
        }

        const channelName = `ticket-${ticketNumber}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId || null,
            permissionOverwrites,
        });

        // Save ticket to database
        const ticket = new Ticket({
            guildId,
            channelId: ticketChannel.id,
            category: selectedOption,
            creatorId: userId,
            ticketNumber,
        });
        await ticket.save();

        // Update ticket count
        panel.ticketCount = ticketNumber;
        await panel.save();

        // Create ticket welcome embed
        const welcomeEmbed = EmbedCreator.createTicketOpened(ticket, interaction.user, option);

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_close')
                    .setLabel('Close Ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('ticket_claim')
                    .setLabel('Claim Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✋'),
                new ButtonBuilder()
                    .setCustomId('ticket_transcript')
                    .setLabel('Save Transcript')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📝')
            );

        const mentionMessage = await ticketChannel.send({
            content: `||${interaction.user}|| Welcome to your ticket!`,
            embeds: [welcomeEmbed],
            components: [actionRow]
        });

        // Pin the welcome message
        await mentionMessage.pin();

        // Log ticket creation
        const logEmbed = new EmbedBuilder()
            .setTitle('🎫 Ticket Created')
            .setDescription(`**Ticket #${ticketNumber}** has been created`)
            .addFields(
                { name: 'Created By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                { name: 'Category', value: option.label, inline: true },
                { name: 'Channel', value: `${ticketChannel}`, inline: true }
            )
            .setColor('#00FF00')
            .setTimestamp();

        await Logger.logTicketAction(client, guildId, logEmbed);

        await interaction.editReply({
            embeds: [EmbedCreator.successEmbed(`Ticket created! Please check ${ticketChannel}`)]
        });

    } catch (error) {
        console.error('Error creating ticket:', error);
        await interaction.editReply({
            embeds: [EmbedCreator.errorEmbed('An error occurred while creating your ticket.')]
        });
        Logger.logError(client, error);
    }
}

async function handleTicketClose(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;

        const ticket = await Ticket.findOne({ guildId, channelId, status: 'open' });
        if (!ticket) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed('This is not an open ticket channel.')]
            });
            return;
        }

        // Check permissions
        const panel = await Panel.findOne({ guildId });
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        const hasPermission = 
            member.id === ticket.creatorId ||
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            member.id === process.env.OWNER_ID ||
            panel.adminRoles.some(roleId => member.roles.cache.has(roleId)) ||
            (panel.supportRoles && panel.supportRoles.some(roleId => member.roles.cache.has(roleId)));

        if (!hasPermission) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed('You do not have permission to close this ticket.')]
            });
            return;
        }

        // Collect messages for transcript
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const transcript = messages.reverse().map(m => 
            `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || 'Embed/Attachment'}`
        ).join('\n');

        // Update ticket
        ticket.status = 'closed';
        ticket.closedAt = new Date();
        ticket.closedBy = interaction.user.id;
        ticket.transcriptUrl = transcript;
        await ticket.save();

        // Send DM to ticket creator
        try {
            const creator = await client.users.fetch(ticket.creatorId);
            const dmEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription(`Your ticket **#${ticket.ticketNumber}** in **${interaction.guild.name}** has been closed.`)
                .addFields(
                    { name: 'Closed By', value: interaction.user.tag, inline: true },
                    { name: 'Category', value: ticket.category, inline: true }
                )
                .setColor('#FF0000')
                .setFooter({ text: 'Warrior Ticket Bot' })
                .setTimestamp();

            await creator.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch (error) {
            // User has DMs closed
        }

        // Send close message
        const closeEmbed = EmbedCreator.createTicketClosed(interaction.user, 'Ticket resolved');
        await interaction.channel.send({ embeds: [closeEmbed] });

        // Log ticket closure
        const logEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(`**Ticket #${ticket.ticketNumber}** has been closed`)
            .addFields(
                { name: 'Closed By', value: `${interaction.user.tag}`, inline: true },
                { name: 'Category', value: ticket.category, inline: true },
                { name: 'Messages', value: `${messages.size}`, inline: true }
            )
            .setColor('#FF0000')
            .setTimestamp();

        await Logger.logTicketAction(client, guildId, logEmbed);

        // Delete channel after delay
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);

        await interaction.editReply({
            embeds: [EmbedCreator.successEmbed('Ticket closed successfully.')]
        });

    } catch (error) {
        console.error('Error closing ticket:', error);
        await interaction.editReply({
            embeds: [EmbedCreator.errorEmbed('An error occurred while closing the ticket.')]
        });
    }
}

async function handleTicketClaim(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;

        const ticket = await Ticket.findOne({ guildId, channelId, status: 'open' });
        if (!ticket) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed('This is not an open ticket channel.')]
            });
            return;
        }

        if (ticket.claimedBy) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed(`This ticket is already claimed by <@${ticket.claimedBy}>`)]
            });
            return;
        }

        const panel = await Panel.findOne({ guildId });
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        const hasPermission = 
            member.permissions.has(PermissionFlagsBits.Administrator) ||
            panel.adminRoles.some(roleId => member.roles.cache.has(roleId)) ||
            (panel.supportRoles && panel.supportRoles.some(roleId => member.roles.cache.has(roleId)));

        if (!hasPermission) {
            await interaction.editReply({
                embeds: [EmbedCreator.errorEmbed('You do not have permission to claim tickets.')]
            });
            return;
        }

        ticket.claimedBy = interaction.user.id;
        await ticket.save();

        const claimEmbed = new EmbedBuilder()
            .setTitle('✋ Ticket Claimed')
            .setDescription(`This ticket has been claimed by ${interaction.user}`)
            .setColor('#FFA500')
            .setTimestamp();

        await interaction.channel.send({ embeds: [claimEmbed] });

        await interaction.editReply({
            embeds: [EmbedCreator.successEmbed('Ticket claimed successfully!')]
        });

    } catch (error) {
        console.error('Error claiming ticket:', error);
        await interaction.editReply({
            embeds: [EmbedCreator.errorEmbed('An error occurred while claiming the ticket.')]
        });
    }
}

async function handleTicketTranscript(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const channel = interaction.channel;
        const messages = await channel.messages.fetch({ limit: 100 });
        
        let transcript = `═══ Ticket Transcript ═══\n`;
        transcript += `Channel: ${channel.name}\n`;
        transcript += `Generated: ${new Date().toISOString()}\n`;
        transcript += `Messages: ${messages.size}\n`;
        transcript += `═══ Messages ═══\n\n`;

        const sortedMessages = messages.reverse();
        sortedMessages.forEach(msg => {
            transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}:\n${msg.content || '[No text content]'}\n`;
            if (msg.attachments.size > 0) {
                transcript += `Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
            }
            transcript += '-'.repeat(50) + '\n';
        });

        // Create transcript file
        const buffer = Buffer.from(transcript, 'utf-8');
        
        await interaction.editReply({
            content: '📝 Here is your transcript:',
            files: [{
                attachment: buffer,
                name: `transcript-${channel.name}.txt`
            }],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error saving transcript:', error);
        await interaction.editReply({
            embeds: [EmbedCreator.errorEmbed('An error occurred while saving the transcript.')]
        });
    }
}
