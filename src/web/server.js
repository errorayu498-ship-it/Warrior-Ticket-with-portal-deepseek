const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Panel, Ticket, ServerConfig } = require('../database/mongodb');
const EmbedCreator = require('../utils/embeds');

const app = express();

// Create views directory if it doesn't exist
const fs = require('fs');
const viewsDir = path.join(__dirname, 'views');
if (!fs.existsSync(viewsDir)) {
    fs.mkdirSync(viewsDir, { recursive: true });
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'warrior-ticket-bot-secret-key-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.set('view engine', 'ejs');
app.set('views', viewsDir);

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
        
        if (!client) {
            return res.status(500).send('Bot client not initialized');
        }

        // Get all guilds
        const guilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount,
            icon: guild.iconURL()
        }));

        // Get statistics
        const totalTickets = await Ticket.countDocuments().catch(() => 0);
        const openTickets = await Ticket.countDocuments({ status: 'open' }).catch(() => 0);
        const closedTickets = await Ticket.countDocuments({ status: 'closed' }).catch(() => 0);
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
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
});

// Guild configuration page
app.get('/guild/:guildId', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(req.params.guildId);
        
        if (!guild) {
            return res.status(404).send('Guild not found. Bot must be in the server.');
        }

        let panel = await Panel.findOne({ guildId: guild.id });
        
        // Create default panel if not exists
        if (!panel) {
            panel = new Panel({
                guildId: guild.id,
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
                    { label: 'Support', description: 'Get support', emoji: '💬', categoryId: '', allowedRoles: [] },
                    { label: 'Purchase', description: 'Buy items', emoji: '🛒', categoryId: '', allowedRoles: [] }
                ],
                adminRoles: [],
                supportRoles: [],
                logChannelId: ''
            });
            await panel.save();
        }

        // Ensure options array exists
        if (!panel.options || panel.options.length === 0) {
            panel.options = [{ label: 'General', description: 'General ticket', emoji: '🎫', categoryId: '', allowedRoles: [] }];
            await panel.save();
        }

        let config = await ServerConfig.findOne({ guildId: guild.id });
        if (!config) {
            config = new ServerConfig({ guildId: guild.id, adminRoles: [], supportRoles: [], logChannelId: '' });
            await config.save();
        }
        
        const roles = guild.roles.cache.map(role => ({
            id: role.id,
            name: role.name,
            color: role.hexColor
        }));

        const categories = guild.channels.cache
            .filter(ch => ch.type === 4)
            .map(cat => ({
                id: cat.id,
                name: cat.name
            }));

        const textChannels = guild.channels.cache
            .filter(ch => ch.type === 0)
            .map(ch => ({
                id: ch.id,
                name: ch.name
            }));

        res.render('guild-config', {
            guild,
            panel,
            config,
            roles,
            categories,
            channels: textChannels
        });
    } catch (error) {
        console.error('Guild config error:', error);
        res.status(500).send(`Internal Server Error: ${error.message}`);
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
        const optionCount = parseInt(req.body.optionCount) || 0;
        
        // Check for at least one option
        for (let i = 0; i < Math.max(optionCount, 1); i++) {
            const label = req.body[`option_${i}_label`];
            if (label && label.trim()) {
                options.push({
                    label: label.trim(),
                    description: (req.body[`option_${i}_description`] || '').trim(),
                    emoji: (req.body[`option_${i}_emoji`] || '🎫').trim(),
                    categoryId: (req.body[`option_${i}_categoryId`] || '').trim(),
                    allowedRoles: Array.isArray(req.body[`option_${i}_allowedRoles`]) 
                        ? req.body[`option_${i}_allowedRoles`] 
                        : (req.body[`option_${i}_allowedRoles`] ? [req.body[`option_${i}_allowedRoles`]] : [])
                });
            }
        }

        // Ensure at least one option
        if (options.length === 0) {
            options.push({
                label: 'General Ticket',
                description: 'Open a general ticket',
                emoji: '🎫',
                categoryId: '',
                allowedRoles: []
            });
        }

        const adminRolesArray = Array.isArray(adminRoles) ? adminRoles : (adminRoles ? [adminRoles] : []);
        const supportRolesArray = Array.isArray(supportRoles) ? supportRoles : (supportRoles ? [supportRoles] : []);

        const panel = await Panel.findOneAndUpdate(
            { guildId },
            {
                embed: { 
                    title: title || '🎫 Ticket System',
                    description: description || 'Select a category',
                    footer: footer || 'Ticket Bot',
                    color: color || '#5865F2',
                    thumbnail: thumbnail || '',
                    image: image || '',
                    icon: icon || ''
                },
                options,
                adminRoles: adminRolesArray.filter(r => r),
                supportRoles: supportRolesArray.filter(r => r),
                logChannelId: logChannelId || ''
            },
            { upsert: true, new: true }
        );

        // Update server config
        await ServerConfig.findOneAndUpdate(
            { guildId },
            {
                logChannelId: logChannelId || '',
                adminRoles: adminRolesArray.filter(r => r),
                supportRoles: supportRolesArray.filter(r => r)
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
                    const message = await channel.messages.fetch(panel.messageId).catch(() => null);
                    if (message) {
                        const embed = await EmbedCreator.createTicketPanel(panel);
                        const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
                        
                        const selectMenuOptions = panel.options.map(option => ({
                            label: option.label.substring(0, 100),
                            description: (option.description || `Open ${option.label}`).substring(0, 100),
                            emoji: option.emoji || '🎫',
                            value: option.label.toLowerCase().replace(/\s+/g, '_').substring(0, 100)
                        }));

                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('ticket_create')
                            .setPlaceholder('🎫 Select ticket category...')
                            .addOptions(selectMenuOptions);

                        await message.edit({
                            embeds: [embed],
                            components: [new ActionRowBuilder().addComponents(selectMenu)]
                        }).catch(err => console.error('Failed to edit message:', err.message));
                    }
                }
            } catch (error) {
                console.error('Error updating panel message:', error.message);
            }
        }

        res.json({ success: true, message: 'Panel updated successfully!' });
    } catch (error) {
        console.error('Save panel error:', error);
        res.status(500).json({ success: false, message: `Error saving panel: ${error.message}` });
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

        if (!guild) {
            return res.status(404).send('Guild not found');
        }

        res.render('tickets', {
            guild,
            tickets,
            status
        });
    } catch (error) {
        console.error('Tickets page error:', error);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
});

// API endpoints
app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        const stats = {
            totalServers: client.guilds.cache.size,
            totalMembers: client.users.cache.size,
            totalTickets: await Ticket.countDocuments().catch(() => 0),
            openTickets: await Ticket.countDocuments({ status: 'open' }).catch(() => 0),
            closedTickets: await Ticket.countDocuments({ status: 'closed' }).catch(() => 0)
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

function startWebServer(client) {
    app.set('client', client);
    
    const PORT = process.env.PORT || process.env.PORTAL_PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🌐 Web portal running on port ${PORT}`);
    }).on('error', (err) => {
        console.error('Failed to start web server:', err.message);
    });
}

module.exports = { startWebServer };
