## Warrior-Ticket-with-portal-deepseek
```
ticket-bot/
├── .env
├── package.json
├── src/
│   ├── index.js
│   ├── database/
│   │   └── mongodb.js
│   ├── events/
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   └── guildMemberRemove.js
│   ├── commands/
│   │   ├── ticket/
│   │   │   ├── setup.js
│   │   │   ├── close.js
│   │   │   └── panel.js
│   │   └── admin/
│   │       └── reload.js
│   ├── utils/
│   │   ├── embeds.js
│   │   ├── logger.js
│   │   └── emojis.js
│   └── web/
│       ├── server.js
│       └── public/
│           └── index.html
```
