const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Panel, Ticket, ServerConfig } = require('../database/mongodb');
const { EmbedBuilder } = require('discord.js');
const EmbedCreator = require('../utils/embeds');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'warrior-ticket-bot-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.PORTAL_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/');
    } else {
        res.render('login', { error: 'Invalid password' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Main dashboard
app.get('/', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        
        // Get all guilds
        const guilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
            icon: guild.iconURL()
        }));

        // Get statistics
        const totalTickets = await Ticket.countDocuments();
        const openTickets = await Ticket.countDocuments({ status: 'open' });
        const closedTickets = await Ticket.countDocuments({ status: 'closed' });
        const totalServers = client.guilds.cache.size;
        const totalMembers = client.users.cache.size;

        res.render('dashboard', {
            guilds,
            stats: {
                totalTickets,
                openTickets,
                closedTickets,
                totalServers,
                totalMembers
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Guild configuration page
app.get('/guild/:guildId', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(req.params.guildId);
        
        if (!guild) {
            return res.status(404).send('Guild not found');
        }

        const panel = await Panel.findOne({ guildId: guild.id });
        const config = await ServerConfig.findOne({ guildId: guild.id });
        
        const roles = guild.roles.cache.map(role => ({
            id: role.id,
            name: role.name,
            color: role.hexColor
        }));

        const categories = guild.channels.cache
            .filter(ch => ch.type === 4) // Category channels
            .map(cat => ({
                id: cat.id,
                name: cat.name
            }));

        res.render('guild-config', {
            guild,
            panel: panel || {
                embed: {
                    title: '🎫 Ticket System',
                    description: 'Select a category to create a ticket',
                    footer: 'Ticket Bot',
                    color: '#5865F2',
                    thumbnail: '',
                    image: '',
                    icon: ''
                },
                options: [
                    { label: 'Support', description: 'Get support', emoji: '💬', categoryId: '', allowedRoles: [] }
                ],
                adminRoles: [],
                supportRoles: [],
                logChannelId: ''
            },
            config: config || { adminRoles: [], supportRoles: [], logChannelId: '' },
            roles,
            categories
        });
    } catch (error) {
        console.error('Guild config error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Save panel configuration
app.post('/guild/:guildId/save-panel', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            title, description, footer, color, thumbnail, image, icon,
            logChannelId, adminRoles, supportRoles
        } = req.body;

        // Parse options from form data
        const options = [];
        const optionCount = parseInt(req.body.optionCount) || 1;
        
        for (let i = 0; i < optionCount; i++) {
            if (req.body[`option_${i}_label`]) {
                options.push({
                    label: req.body[`option_${i}_label`],
                    description: req.body[`option_${i}_description`] || '',
                    emoji: req.body[`option_${i}_emoji`] || '🎫',
                    categoryId: req.body[`option_${i}_categoryId`] || '',
                    allowedRoles: Array.isArray(req.body[`option_${i}_allowedRoles`]) 
                        ? req.body[`option_${i}_allowedRoles`] 
                        : []
                });
            }
        }

        const panel = await Panel.findOneAndUpdate(
            { guildId },
            {
                embed: { title, description, footer, color, thumbnail, image, icon },
                options,
                adminRoles: Array.isArray(adminRoles) ? adminRoles : [adminRoles],
                supportRoles: Array.isArray(supportRoles) ? supportRoles : [supportRoles],
                logChannelId
            },
            { upsert: true, new: true }
        );

        // Update server config
        await ServerConfig.findOneAndUpdate(
            { guildId },
            {
                logChannelId,
                adminRoles: Array.isArray(adminRoles) ? adminRoles : [adminRoles],
                supportRoles: Array.isArray(supportRoles) ? supportRoles : [supportRoles]
            },
            { upsert: true }
        );

        // Reload panel in Discord
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(guildId);
        if (guild && panel.channelId && panel.messageId) {
            try {
                const channel = guild.channels.cache.get(panel.channelId);
                if (channel) {
                    const message = await channel.messages.fetch(panel.messageId);
                    if (message) {
                        const embed = await EmbedCreator.createTicketPanel(panel);
                        const StringSelectMenuBuilder = require('discord.js').StringSelectMenuBuilder;
                        const ActionRowBuilder = require('discord.js').ActionRowBuilder;
                        
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('ticket_create')
                            .setPlaceholder('🎫 Select ticket category...')
                            .addOptions(
                                options.map(option => ({
                                    label: option.label,
                                    description: option.description,
                                    emoji: option.emoji,
                                    value: option.label.toLowerCase()
                                }))
                            );

                        await message.edit({
                            embeds: [embed],
                            components: [new ActionRowBuilder().addComponents(selectMenu)]
                        });
                    }
                }
            } catch (error) {
                console.error('Error updating panel message:', error);
            }
        }

        res.json({ success: true, message: 'Panel updated successfully!' });
    } catch (error) {
        console.error('Save panel error:', error);
        res.status(500).json({ success: false, message: 'Error saving panel' });
    }
});

// Tickets list page
app.get('/guild/:guildId/tickets', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const status = req.query.status || 'open';
        
        const tickets = await Ticket.find({ guildId, status }).sort({ createdAt: -1 }).limit(100);
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(guildId);

        res.render('tickets', {
            guild,
            tickets,
            status
        });
    } catch (error) {
        console.error('Tickets page error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// API endpoints
app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        const stats = {
            totalServers: client.guilds.cache.size,
            totalMembers: client.users.cache.size,
            totalTickets: await Ticket.countDocuments(),
            openTickets: await Ticket.countDocuments({ status: 'open' }),
            closedTickets: await Ticket.countDocuments({ status: 'closed' })
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

function startWebServer(client) {
    app.set('client', client);
    
    const PORT = process.env.PORTAL_PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🌐 Web portal running on http://localhost:${PORT}`);
    });
}

module.exports = { startWebServer };
