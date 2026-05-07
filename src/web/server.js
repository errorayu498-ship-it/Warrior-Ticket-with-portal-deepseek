const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { Panel, Ticket, ServerConfig } = require('../database/mongodb');
const EmbedCreator = require('../utils/embeds');
const fs = require('fs');

const app = express();

// Create required directories
const viewsDir = path.join(__dirname, 'views');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(viewsDir)) fs.mkdirSync(viewsDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// Middleware
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(publicDir));
app.use(session({
    secret: 'warrior-ticket-premium-portal-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.set('view engine', 'ejs');
app.set('views', viewsDir);

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) next();
    else res.redirect('/login');
};

// ═══════════════════════════════════
// 🔐 LOGIN ROUTES
// ═══════════════════════════════════

app.get('/login', (req, res) => {
    res.render('login', { error: null, botName: 'WARRIOR TICKET' });
});

app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.PORTAL_PASSWORD) {
        req.session.authenticated = true;
        res.redirect('/');
    } else {
        res.render('login', { error: '⛔ INVALID PASSWORD! ACCESS DENIED!', botName: 'WARRIOR TICKET' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// ═══════════════════════════════════
// 📊 MAIN DASHBOARD
// ═══════════════════════════════════

app.get('/', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        if (!client) return res.status(500).send('Bot not initialized');

        const guilds = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            memberCount: g.memberCount,
            icon: g.iconURL({ dynamic: true }),
            ownerId: g.ownerId,
            channels: g.channels.cache.size,
            roles: g.roles.cache.size
        }));

        // Get all stats
        const [totalTickets, openTickets, closedTickets, panels] = await Promise.all([
            Ticket.countDocuments().catch(() => 0),
            Ticket.countDocuments({ status: 'open' }).catch(() => 0),
            Ticket.countDocuments({ status: 'closed' }).catch(() => 0),
            Panel.countDocuments().catch(() => 0)
        ]);

        const stats = {
            totalServers: client.guilds.cache.size,
            totalMembers: client.users.cache.size,
            totalChannels: client.channels.cache.size,
            totalTickets,
            openTickets,
            closedTickets,
            totalPanels: panels,
            uptime: formatUptime(client.uptime),
            ping: client.ws.ping
        };

        res.render('dashboard', { guilds, stats, botName: 'WARRIOR TICKET' });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

// ═══════════════════════════════════
// ⚙️ GUILD CONFIGURATION
// ═══════════════════════════════════

app.get('/guild/:guildId', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(req.params.guildId);
        if (!guild) return res.status(404).render('error', { error: 'Guild not found' });

        let panel = await Panel.findOne({ guildId: guild.id });
        if (!panel) {
            panel = new Panel({
                guildId: guild.id,
                embed: {
                    title: '🎫 WARRIOR TICKET SYSTEM',
                    description: '> **Select a category below to create a ticket**\n\n```diff\n+ Fast Support\n+ 24/7 Service\n+ Premium Quality\n```',
                    footer: '🔴 Warrior Ticket Bot • Premium',
                    color: '#FF0000',
                    thumbnail: 'https://cdn.discordapp.com/emojis/1308659741852508213.png',
                    image: '',
                    icon: ''
                },
                options: [
                    {
                        label: '🛒 Purchase',
                        description: 'Buy our premium services',
                        emoji: '🛒',
                        categoryId: '',
                        allowedRoles: []
                    },
                    {
                        label: '💬 Support',
                        description: 'Get technical support',
                        emoji: '💬',
                        categoryId: '',
                        allowedRoles: []
                    },
                    {
                        label: '🤝 Partnership',
                        description: 'Apply for partnership',
                        emoji: '🤝',
                        categoryId: '',
                        allowedRoles: []
                    }
                ],
                adminRoles: [],
                supportRoles: [],
                logChannelId: '',
                ticketCount: 0
            });
            await panel.save();
        }

        // Ensure minimum 1 option
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

        let config = await ServerConfig.findOne({ guildId: guild.id });
        if (!config) {
            config = new ServerConfig({ guildId: guild.id });
            await config.save();
        }

        const roles = guild.roles.cache
            .filter(r => !r.managed && r.name !== '@everyone')
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
            .sort((a, b) => b.position - a.position);

        const categories = guild.channels.cache
            .filter(ch => ch.type === 4)
            .map(c => ({ id: c.id, name: c.name }));

        const textChannels = guild.channels.cache
            .filter(ch => ch.type === 0)
            .map(c => ({ id: c.id, name: c.name }));

        // Get recent tickets
        const recentTickets = await Ticket.find({ guildId: guild.id })
            .sort({ createdAt: -1 })
            .limit(10);

        res.render('guild-config', {
            guild,
            panel,
            config,
            roles,
            categories,
            channels: textChannels,
            recentTickets,
            botName: 'WARRIOR TICKET'
        });
    } catch (error) {
        console.error('Guild config error:', error);
        res.status(500).render('error', { error: error.message });
    }
});

// ═══════════════════════════════════
// 💾 SAVE PANEL CONFIGURATION
// ═══════════════════════════════════

app.post('/guild/:guildId/save-panel', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const {
            title, description, footer, color, thumbnail, image, icon,
            logChannelId, adminRoles, supportRoles
        } = req.body;

        // Parse options
        const options = [];
        let optionIndex = 0;
        
        while (req.body[`option_${optionIndex}_label`]) {
            const label = req.body[`option_${optionIndex}_label`];
            if (label && label.trim()) {
                options.push({
                    label: label.trim(),
                    description: (req.body[`option_${optionIndex}_description`] || '').trim(),
                    emoji: (req.body[`option_${optionIndex}_emoji`] || '🎫').trim(),
                    categoryId: (req.body[`option_${optionIndex}_categoryId`] || '').trim(),
                    allowedRoles: Array.isArray(req.body[`option_${optionIndex}_allowedRoles`])
                        ? req.body[`option_${optionIndex}_allowedRoles`].filter(Boolean)
                        : (req.body[`option_${optionIndex}_allowedRoles`] ? [req.body[`option_${optionIndex}_allowedRoles`]] : [])
                });
            }
            optionIndex++;
        }

        // Ensure at least 1 option
        if (options.length === 0) {
            options.push({
                label: 'General Ticket',
                description: 'Open a support ticket',
                emoji: '🎫',
                categoryId: '',
                allowedRoles: []
            });
        }

        // Parse roles
        const parseRoles = (input) => {
            if (!input) return [];
            if (Array.isArray(input)) return input.filter(Boolean);
            return [input].filter(Boolean);
        };

        const adminRolesList = parseRoles(adminRoles);
        const supportRolesList = parseRoles(supportRoles);

        // Update panel
        const panel = await Panel.findOneAndUpdate(
            { guildId },
            {
                embed: {
                    title: title || '🎫 Ticket System',
                    description: description || 'Select a category',
                    footer: footer || 'Ticket Bot',
                    color: color || '#FF0000',
                    thumbnail: thumbnail || '',
                    image: image || '',
                    icon: icon || ''
                },
                options,
                adminRoles: adminRolesList,
                supportRoles: supportRolesList,
                logChannelId: logChannelId || ''
            },
            { upsert: true, new: true }
        );

        // Update server config
        await ServerConfig.findOneAndUpdate(
            { guildId },
            {
                logChannelId: logChannelId || '',
                adminRoles: adminRolesList,
                supportRoles: supportRolesList,
                ownerId: req.app.get('client').guilds.cache.get(guildId)?.ownerId
            },
            { upsert: true }
        );

        res.json({ 
            success: true, 
            message: '✅ Panel configuration saved successfully!',
            optionCount: options.length
        });
    } catch (error) {
        console.error('Save panel error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ═══════════════════════════════════
// 📨 SEND PANEL TO CHANNEL
// ═══════════════════════════════════

app.post('/guild/:guildId/send-panel', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const { channelId } = req.body;
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(guildId);

        if (!guild) return res.status(404).json({ success: false, message: 'Guild not found' });
        if (!channelId) return res.status(400).json({ success: false, message: 'Channel ID required' });

        const channel = guild.channels.cache.get(channelId);
        if (!channel || channel.type !== 0) {
            return res.status(400).json({ success: false, message: 'Invalid text channel' });
        }

        let panel = await Panel.findOne({ guildId });
        if (!panel) {
            return res.status(400).json({ success: false, message: 'No panel configuration found. Save configuration first!' });
        }

        // Delete old panel if exists
        if (panel.messageId && panel.channelId) {
            try {
                const oldChannel = guild.channels.cache.get(panel.channelId);
                if (oldChannel) {
                    const oldMsg = await oldChannel.messages.fetch(panel.messageId).catch(() => null);
                    if (oldMsg) await oldMsg.delete().catch(() => {});
                }
            } catch (e) {}
        }

        // Create new panel
        const embed = await EmbedCreator.createTicketPanel(panel);
        
        const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
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

        // Update panel record
        panel.channelId = channel.id;
        panel.messageId = message.id;
        await panel.save();

        res.json({ 
            success: true, 
            message: '✅ Panel sent successfully!',
            channelName: channel.name,
            channelId: channel.id
        });
    } catch (error) {
        console.error('Send panel error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ═══════════════════════════════════
// 🔄 REFRESH PANEL
// ═══════════════════════════════════

app.post('/guild/:guildId/refresh-panel', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const client = req.app.get('client');
        const guild = client.guilds.cache.get(guildId);

        if (!guild) return res.status(404).json({ success: false, message: 'Guild not found' });

        const panel = await Panel.findOne({ guildId });
        if (!panel || !panel.channelId || !panel.messageId) {
            return res.status(400).json({ success: false, message: 'No panel found. Send panel first!' });
        }

        const channel = guild.channels.cache.get(panel.channelId);
        if (!channel) return res.status(400).json({ success: false, message: 'Panel channel not found' });

        const message = await channel.messages.fetch(panel.messageId).catch(() => null);
        if (!message) return res.status(400).json({ success: false, message: 'Panel message not found' });

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

        await message.edit({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(selectMenu)]
        });

        res.json({ success: true, message: '✅ Panel refreshed successfully!' });
    } catch (error) {
        console.error('Refresh panel error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ═══════════════════════════════════
// 🎫 TICKETS VIEW
// ═══════════════════════════════════

app.get('/guild/:guildId/tickets', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.params;
        const status = req.query.status || 'open';
        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        const client = req.app.get('client');
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).render('error', { error: 'Guild not found' });

        const totalTickets = await Ticket.countDocuments({ guildId, status });
        const tickets = await Ticket.find({ guildId, status })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalPages = Math.ceil(totalTickets / limit);

        res.render('tickets', {
            guild,
            tickets,
            status,
            page,
            totalPages,
            totalTickets,
            botName: 'WARRIOR TICKET'
        });
    } catch (error) {
        res.status(500).render('error', { error: error.message });
    }
});

// ═══════════════════════════════════
// 📊 API ENDPOINTS
// ═══════════════════════════════════

app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('client');
        const [totalTickets, openTickets, closedTickets] = await Promise.all([
            Ticket.countDocuments(),
            Ticket.countDocuments({ status: 'open' }),
            Ticket.countDocuments({ status: 'closed' })
        ]);

        res.json({
            success: true,
            data: {
                servers: client.guilds.cache.size,
                members: client.users.cache.size,
                channels: client.channels.cache.size,
                totalTickets,
                openTickets,
                closedTickets,
                ping: client.ws.ping,
                uptime: formatUptime(client.uptime)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/guild/:guildId/panel', requireAuth, async (req, res) => {
    try {
        const panel = await Panel.findOne({ guildId: req.params.guildId });
        res.json({ success: true, data: panel });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════
// 🚀 START SERVER
// ═══════════════════════════════════

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

function startWebServer(client) {
    app.set('client', client);
    const PORT = process.env.PORT || process.env.PORTAL_PORT || 3000;
    
    app.listen(PORT, () => {
        console.log(`\x1b[31m🔴 WARRIOR TICKET PORTAL\x1b[0m running on \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    }).on('error', (err) => {
        console.error('Web server error:', err.message);
    });
}

module.exports = { startWebServer };
