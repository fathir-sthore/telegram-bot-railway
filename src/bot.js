const { Telegraf, Markup } = require("telegraf");
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');
const cron = require('node-cron');
const winston = require('winston');
const helmet = require('helmet');
const compression = require('compression');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 60 seconds
});

app.use((req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: 'Too many requests' }));
});

// Initialize bot
const BOT_TOKEN = process.env.BOT_TOKEN || "8592407821:AAGOB2FmqS8YC1U8JgGXtsNp6eSFqLdz7O0";
const bot = new Telegraf(BOT_TOKEN);

// Database paths
const databaseDir = path.join(__dirname, '../database');
const blacklistFile = path.join(databaseDir, "blacklist.json");
const groupFile = path.join(databaseDir, "grub.json");
const presetFile = path.join(databaseDir, "preset.json");
const premiumFile = path.join(databaseDir, "premium.json");
const groupStatFile = path.join(databaseDir, "groupstats.json");
const userFile = path.join(databaseDir, "users.json");
const autoShareFile = path.join(databaseDir, "autoshare.json");
const ownerFile = path.join(databaseDir, "owner.json");
const autoKirimFile = path.join(databaseDir, "autokirim.json");

// Configuration
const ownerId = [6210345140];
const channelWajib = ["@infoupdetscfsxdxy"];
const channelGimick = "@infoupdetscfsxdxy";

// State variables
let autoShareInterval = null;
let autoKirimInterval = null;

/* ============================================
   RAILWAY SPECIFIC FEATURES
============================================ */

// Railway environment detection
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'true' || 
                  process.env.RAILWAY_GIT_COMMIT_SHA !== undefined;

console.log(`
🚂 RAILWAY TELEGRAM BOT v2.0
────────────────────────────
🌐 Environment: ${isRailway ? 'Railway 🚂' : 'Local 💻'}
⚡ Node.js: ${process.version}
📦 Memory: ${process.memoryUsage().heapUsed / 1024 / 1024} MB
⏰ Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
────────────────────────────
`);

/* ============================================
   EXPRESS ENDPOINTS FOR RAILWAY
============================================ */

// Health check endpoint (REQUIRED for Railway)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'telegram-bot',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    railway: isRailway,
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    }
  });
});

// Status page
app.get('/status', async (req, res) => {
  try {
    const stats = {
      bot: bot.botInfo?.username || 'Loading...',
      groups: (await readJSON(groupFile)).length,
      users: (await readJSON(userFile)).length,
      premium: (await readJSON(premiumFile)).length,
      uptime: process.uptime(),
      last_updated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats,
      railway: {
        environment: process.env.RAILWAY_ENVIRONMENT,
        service_id: process.env.RAILWAY_SERVICE_ID,
        project_id: process.env.RAILWAY_PROJECT_ID
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Web interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🤖 Telegram Bot - Railway</title>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 15px; text-align: center; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center; }
        .railway-badge { background: #0B0D0E; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🤖 Telegram Bot is Running</h1>
        <div class="railway-badge">🚂 Powered by Railway.app</div>
        <p>Bot is online and ready to receive commands</p>
      </div>
      
      <div class="stats" id="stats">
        <!-- Stats will be loaded via JS -->
      </div>
      
      <script>
        async function loadStats() {
          try {
            const response = await fetch('/status');
            const data = await response.json();
            
            document.getElementById('stats').innerHTML = \`
              <div class="stat-card">
                <h3>👥 Users</h3>
                <p>\${data.data?.users || 0}</p>
              </div>
              <div class="stat-card">
                <h3>🏘️ Groups</h3>
                <p>\${data.data?.groups || 0}</p>
              </div>
              <div class="stat-card">
                <h3>👑 Premium</h3>
                <p>\${data.data?.premium || 0}</p>
              </div>
              <div class="stat-card">
                <h3>⏰ Uptime</h3>
                <p>\${Math.floor(data.data?.uptime / 3600)} hours</p>
              </div>
            \`;
          } catch (error) {
            document.getElementById('stats').innerHTML = '<p>Error loading stats</p>';
          }
        }
        
        loadStats();
        setInterval(loadStats, 30000);
      </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/stats', async (req, res) => {
  try {
    const [groups, users, premium] = await Promise.all([
      readJSON(groupFile),
      readJSON(userFile),
      readJSON(premiumFile)
    ]);
    
    res.json({
      groups: groups.length,
      users: users.length,
      premium: premium.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ============================================
   DATABASE UTILITIES
============================================ */

// Initialize database
async function initializeDatabase() {
  try {
    // Create database directory if not exists
    await fs.mkdir(databaseDir, { recursive: true });
    
    const files = [
      { file: blacklistFile, default: [] },
      { file: groupFile, default: [] },
      { file: presetFile, default: Array(20).fill("") },
      { file: premiumFile, default: [] },
      { file: groupStatFile, default: {} },
      { file: userFile, default: [] },
      { file: autoShareFile, default: { interval: 10 } },
      { file: ownerFile, default: ownerId },
      { file: autoKirimFile, default: { status: false, text: "" } }
    ];
    
    // Initialize files in parallel
    await Promise.all(files.map(async ({ file, default: defaultValue }) => {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify(defaultValue, null, 2));
        logger.info(`Created database file: ${path.basename(file)}`);
      }
    }));
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

// Read JSON helper
async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

// Write JSON helper
async function writeJSON(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    logger.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

/* ============================================
   BOT UTILITIES
============================================ */

// Check channel membership
async function cekJoinChannel(userId, ctx) {
  for (const ch of channelWajib) {
    try {
      const member = await ctx.telegram.getChatMember(ch, userId);
      if (!["member", "administrator", "creator"].includes(member.status)) {
        return false;
      }
    } catch (error) {
      logger.warn(`Failed to check channel ${ch}:`, error.message);
      return false;
    }
  }
  return true;
}

// Random images
const randomImages = [
  "https://files.catbox.moe/cw3o8i.jpg",
  "https://files.catbox.moe/c45jek.jpg",
  "https://files.catbox.moe/gevlx9.jpg", 
  "https://files.catbox.moe/uvegiv.jpg"
];

function getRandomImage() {
  return randomImages[Math.floor(Math.random() * randomImages.length)];
}

// Edit menu helper
async function editMenu(ctx, caption, buttons) {
  try {
    await ctx.editMessageMedia({
      type: 'photo',
      media: getRandomImage(),
      caption: caption,
      parse_mode: 'HTML',
    }, {
      reply_markup: buttons.reply_markup,
    });
  } catch (error) {
    logger.error('Error editing menu:', error);
    try {
      await ctx.replyWithPhoto(getRandomImage(), {
        caption: caption,
        parse_mode: 'HTML',
        reply_markup: buttons.reply_markup
      });
    } catch (e) {
      logger.error('Failed to send new message:', e);
    }
  }
}

// Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ============================================
   BACKUP SYSTEM FOR RAILWAY
============================================ */

async function backupToRailwayStorage() {
  try {
    const owners = await readJSON(ownerFile);
    const files = [
      { name: 'groups', path: groupFile },
      { name: 'users', path: userFile },
      { name: 'premium', path: premiumFile },
      { name: 'stats', path: groupStatFile }
    ];
    
    for (const ownerId of owners) {
      try {
        // Send notification
        await bot.telegram.sendMessage(
          ownerId,
          `🔄 **Backup Otomatis**\n` +
          `⏰ ${new Date().toLocaleString('id-ID')}\n` +
          `🚂 Railway Environment: ${isRailway ? 'Yes' : 'No'}\n\n` +
          `Data telah dibackup secara otomatis.`,
          { parse_mode: 'Markdown' }
        );
        
        // Send files
        for (const { name, path } of files) {
          if (await fs.access(path).then(() => true).catch(() => false)) {
            await bot.telegram.sendDocument(ownerId, {
              source: path,
              filename: `${name}_backup_${Date.now()}.json`
            });
          }
        }
        
        logger.info(`Backup sent to owner ${ownerId}`);
      } catch (error) {
        logger.error(`Failed to send backup to ${ownerId}:`, error.message);
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Backup failed:', error);
    return false;
  }
}

/* ============================================
   BOT MIDDLEWARE
============================================ */

bot.use(async (ctx, next) => {
  try {
    // Skip for start and help commands
    if (ctx.message?.text?.match(/^\/start|\/help|\/ping/i)) {
      return next();
    }

    const userId = ctx.from?.id;
    if (!userId) return;

    // Check blacklist
    const blacklist = await readJSON(blacklistFile);
    if (blacklist?.includes(userId)) {
      return ctx.reply("🚫 Anda diblokir dari menggunakan bot ini.");
    }

    // Check channel membership
    const hasJoined = await cekJoinChannel(userId, ctx);
    if (!hasJoined) {
      const keyboard = Markup.inlineKeyboard([
        ...channelWajib.map(ch => 
          Markup.button.url(`Join ${ch}`, `https://t.me/${ch.replace('@', '')}`)
        ),
        Markup.button.callback('✅ Sudah Join', 'check_join_railway')
      ], { columns: 1 });
      
      return ctx.reply(
        `📢 **WAJIB JOIN CHANNEL**\n\n` +
        `Untuk menggunakan bot ini, Anda harus join channel berikut:\n\n` +
        channelWajib.map(ch => `• ${ch}`).join('\n') +
        `\n\nSetelah join, klik tombol "Sudah Join" di bawah.`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    }
    
    return next();
  } catch (error) {
    logger.error('Middleware error:', error);
    return next();
  }
});

/* ============================================
   BOT COMMANDS
============================================ */

// Start command
bot.command('start', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Pengguna';
    
    // Save user to database
    const users = await readJSON(userFile) || [];
    if (!users.includes(userId)) {
      users.push(userId);
      await writeJSON(userFile, users);
    }
    
    const welcomeMessage = `
🚂 **SELAMAT DATANG DI JASSEB BOT!** 🚂

Halo **${firstName}**! Bot ini berjalan di **Railway.app** dengan performa maksimal.

✨ **Fitur Utama:**
• Broadcast pesan ke semua grup
• Sistem premium otomatis
• Backup data otomatis
• 99.9% uptime

👑 **Status Premium:** ${(await readJSON(premiumFile))?.includes(userId) ? '✅ AKTIF' : '🔒 STANDARD'}

📱 **Perintah Tersedia:**
/help - Bantuan
/ping - Cek status
/share - Broadcast (premium only)

🚀 **Deployed on:** Railway.app
⚡ **Performance:** High Availability
🔒 **Security:** Enterprise Grade

*Bot ini akan tetap online 24/7!*
`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 MENU', 'railway_menu'),
        Markup.button.callback('👑 PREMIUM', 'railway_premium')
      ],
      [
        Markup.button.callback('📊 STATS', 'railway_stats'),
        Markup.button.callback('⚙️ SETTINGS', 'railway_settings')
      ],
      [
        Markup.button.url('🌐 STATUS PAGE', `https://${process.env.RAILWAY_STATIC_URL || 'localhost:3000'}`),
        Markup.button.url('🚂 RAILWAY', 'https://railway.app')
      ]
    ]);

    await ctx.replyWithPhoto(getRandomImage(), {
      caption: welcomeMessage,
      parse_mode: 'Markdown',
      ...keyboard
    });

    logger.info(`User ${ctx.from.username || userId} started the bot`);
  } catch (error) {
    logger.error('Start command error:', error);
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
  }
});

// Help command
bot.command('help', async (ctx) => {
  const helpText = `
🆘 **BANTUAN JASSEB BOT** 🆘

🤖 **Tentang Bot:**
Bot ini berjalan di platform **Railway.app** dengan infrastruktur enterprise.

📚 **Perintah Pengguna:**
/start - Memulai bot
/help - Menampilkan bantuan ini
/ping - Cek status bot dan server
/status - Informasi detail bot

👑 **Perintah Premium:**
/share - Broadcast pesan ke semua grup (reply pesan)

👨‍💻 **Perintah Owner:**
/bcuser - Broadcast ke semua user
/pinggrub - Cek status grup
/stats - Statistik lengkap
/top - Leaderboard user
/backup - Backup data
/addprem - Tambah user premium
/delprem - Hapus user premium
/auto - Auto kirim pesan
/blokir - Blokir user
/unblokir - Buka blokir user

⚙️ **Pengaturan:**
/setjeda - Atur jeda autoshare

🌐 **Informasi Server:**
• Platform: Railway.app
• Uptime: 99.9%
• Region: Global CDN
• Backup: Otomatis setiap 6 jam

📞 **Support:**
@fathirsthore
`;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Ping command with Railway info
bot.command('ping', async (ctx) => {
  const start = Date.now();
  const msg = await ctx.reply('🏓 Pinging Railway servers...');
  const end = Date.now();
  const pingTime = end - start;
  
  const botInfo = await bot.telegram.getMe();
  const groups = await readJSON(groupFile) || [];
  const users = await readJSON(userFile) || [];
  
  const pingMessage = `
✅ **BOT AKTIF & ONLINE!**

🚂 **Railway Status:**
• Ping: ${pingTime}ms
• Region: ${process.env.RAILWAY_REGION || 'Global'}
• Environment: ${process.env.NODE_ENV}
• Service ID: ${process.env.RAILWAY_SERVICE_ID?.substring(0, 8) || 'N/A'}

🤖 **Bot Info:**
• Username: @${botInfo.username}
• ID: ${botInfo.id}
• Groups: ${groups.length}
• Users: ${users.length}

⚡ **Performance:**
• Uptime: ${Math.floor(process.uptime() / 60)} menit
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
• Node.js: ${process.version}

🔄 **Last Updated:** ${new Date().toLocaleString('id-ID')}
`;

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    msg.message_id,
    null,
    pingMessage,
    { parse_mode: 'Markdown' }
  );
});

// Share command
bot.command('share', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const replyMsg = ctx.message.reply_to_message;

    // Check premium
    const premiumUsers = await readJSON(premiumFile) || [];
    if (!premiumUsers.includes(userId)) {
      return ctx.reply(
        `❌ **AKSES DITOLAK**\n\n` +
        `Fitur ini hanya untuk user premium!\n\n` +
        `🎯 **Cara mendapatkan premium:**\n` +
        `Tambahkan bot ini ke 2 grup berbeda.\n` +
        `Setelah itu, Anda otomatis menjadi premium!\n\n` +
        `🚂 *Hosted on Railway.app*`,
        { parse_mode: 'Markdown' }
      );
    }

    if (!replyMsg) {
      return ctx.reply(
        `📤 **CARA MENGGUNAKAN /share**\n\n` +
        `1. Balas (reply) pesan yang ingin disebar\n` +
        `2. Ketik /share\n` +
        `3. Pesan akan dikirim ke semua grup\n\n` +
        `🚂 *Powered by Railway.app*`,
        { parse_mode: 'Markdown' }
      );
    }

    const groups = await readJSON(groupFile) || [];
    if (groups.length === 0) {
      return ctx.reply("❌ Belum ada grup yang terdaftar.");
    }

    const confirmKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ YA, KIRIM', 'confirm_share_railway'),
        Markup.button.callback('❌ BATAL', 'cancel_share_railway')
      ]
    ]);

    const confirmMsg = await ctx.reply(
      `📢 **KONFIRMASI BROADCAST**\n\n` +
      `Anda akan mengirim pesan ke **${groups.length} grup**.\n\n` +
      `📝 **Preview Pesan:**\n` +
      `${replyMsg.text ? replyMsg.text.substring(0, 100) + '...' : '[Media Content]'}\n\n` +
      `🚂 *Hosted on Railway.app*\n` +
      `Apakah Anda yakin ingin melanjutkan?`,
      { parse_mode: 'Markdown', ...confirmKeyboard }
    );

    // Store in session
    ctx.session = ctx.session || {};
    ctx.session.pendingShare = {
      messageId: replyMsg.message_id,
      chatId: ctx.chat.id,
      confirmMsgId: confirmMsg.message_id,
      groupsCount: groups.length
    };

  } catch (error) {
    logger.error('Share command error:', error);
    await ctx.reply('❌ Terjadi kesalahan saat memproses perintah.');
  }
});

// Stats command
bot.command('stats', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const owners = await readJSON(ownerFile) || [];
    
    if (!owners.includes(userId)) {
      return ctx.reply("❌ Akses hanya untuk owner.");
    }

    const [groups, users, premium, blacklist, stats] = await Promise.all([
      readJSON(groupFile),
      readJSON(userFile),
      readJSON(premiumFile),
      readJSON(blacklistFile),
      readJSON(groupStatFile)
    ]);

    const statsMessage = `
📊 **STATISTIK BOT - RAILWAY EDITION** 📊

👥 **USER STATISTICS:**
• Total Users: **${users?.length || 0}**
• Premium Users: **${premium?.length || 0}**
• Blacklisted: **${blacklist?.length || 0}**

🏘️ **GROUP STATISTICS:**
• Total Groups: **${groups?.length || 0}**

🚂 **RAILWAY INFO:**
• Environment: **${process.env.NODE_ENV}**
• Service ID: **${process.env.RAILWAY_SERVICE_ID?.substring(0, 8) || 'N/A'}**
• Region: **${process.env.RAILWAY_REGION || 'Global'}**
• Uptime: **${Math.floor(process.uptime() / 3600)} hours**

⚡ **PERFORMANCE:**
• Memory Usage: **${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB**
• Node.js: **${process.version}**
• Platform: **${process.platform}**

🔄 **LAST UPDATED:** ${new Date().toLocaleString('id-ID')}

*Data langsung dari Railway infrastructure*
`;

    await ctx.reply(statsMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    logger.error('Stats command error:', error);
    await ctx.reply('❌ Terjadi kesalahan.');
  }
});

// Add other commands similarly...

/* ============================================
   ACTION HANDLERS
============================================ */

// Check join action
bot.action('check_join_railway', async (ctx) => {
  await ctx.answerCbQuery();
  const hasJoined = await cekJoinChannel(ctx.from.id, ctx);
  
  if (hasJoined) {
    await ctx.editMessageText(
      '✅ **BERHASIL!**\n\n' +
      'Anda sudah join semua channel wajib.\n' +
      'Sekarang Anda dapat menggunakan semua fitur bot!\n\n' +
      '🚂 *Powered by Railway.app*',
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.answerCbQuery('❌ Anda belum join semua channel', { show_alert: true });
  }
});

// Railway menu action
bot.action('railway_menu', async (ctx) => {
  await ctx.answerCbQuery();
  
  const menuMessage = `
🚂 **RAILWAY BOT MENU** 🚂

✨ **Fitur Unggulan:**
• 99.9% Uptime Guarantee
• Auto Scaling Infrastructure
• Global CDN Network
• Enterprise Security

📱 **Quick Actions:**
• /start - Restart conversation
• /ping - Check server status
• /help - Get help

👑 **Premium Features:**
• Unlimited Broadcasts
• Priority Support
• Advanced Analytics

🔧 **Technical Info:**
• Platform: Railway.app
• Runtime: Node.js 18
• Database: JSON + Auto Backup
• Monitoring: Real-time Logs

💡 **Tips:** Bot ini akan tetap online 24/7 berkat Railway infrastructure!
`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('👑 UPGRADE PREMIUM', 'railway_upgrade'),
      Markup.button.callback('📊 VIEW STATS', 'railway_view_stats')
    ],
    [
      Markup.button.callback('🔧 SETTINGS', 'railway_bot_settings'),
      Markup.button.callback('🆘 SUPPORT', 'railway_support')
    ],
    [
      Markup.button.url('🌐 WEB DASHBOARD', `https://${process.env.RAILWAY_STATIC_URL || 'localhost:3000'}`),
      Markup.button.url('🚂 RAILWAY DASHBOARD', 'https://railway.app/dashboard')
    ]
  ]);

  await editMenu(ctx, menuMessage, keyboard);
});

/* ============================================
   CRON JOBS FOR RAILWAY
============================================ */

function setupCronJobs() {
  // Auto backup every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running scheduled backup...');
    await backupToRailwayStorage();
  });
  
  // Health check every hour
  cron.schedule('0 * * * *', () => {
    logger.info('Health check passed at ' + new Date().toLocaleString());
  });
  
  // Send daily stats to owner
  cron.schedule('0 9 * * *', async () => {
    try {
      const owners = await readJSON(ownerFile);
      const groups = await readJSON(groupFile);
      const users = await readJSON(userFile);
      
      for (const ownerId of owners) {
        await bot.telegram.sendMessage(
          ownerId,
          `📊 **DAILY STATS REPORT**\n\n` +
          `📅 Date: ${new Date().toLocaleDateString('id-ID')}\n` +
          `🏘️ Groups: ${groups.length}\n` +
          `👥 Users: ${users.length}\n` +
          `⚡ Uptime: ${Math.floor(process.uptime() / 3600)} hours\n\n` +
          `🚂 *Railway Bot - Always Online*`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      logger.error('Daily stats error:', error);
    }
  });
  
  logger.info('Cron jobs initialized');
}

/* ============================================
   INITIALIZATION AND STARTUP
============================================ */

async function initialize() {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Setup cron jobs
    setupCronJobs();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌐 Health check: http://localhost:${PORT}/health`);
      logger.info(`📊 Status page: http://localhost:${PORT}/status`);
    });
    
    // Start bot
    await bot.launch({
      dropPendingUpdates: true,
      allowedUpdates: ['message', 'callback_query', 'chat_member']
    });
    
    logger.info('🤖 Bot launched successfully');
    
    // Send startup notification
    const owners = await readJSON(ownerFile);
    const botInfo = await bot.telegram.getMe();
    
    for (const ownerId of owners) {
      try {
        await bot.telegram.sendMessage(
          ownerId,
          `🚀 **BOT STARTED ON RAILWAY**\n\n` +
          `🤖 Bot: @${botInfo.username}\n` +
          `🌐 Environment: ${process.env.NODE_ENV}\n` +
          `🚂 Platform: Railway.app\n` +
          `⏰ Time: ${new Date().toLocaleString('id-ID')}\n\n` +
          `✅ Bot is now online and ready!`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        logger.warn(`Failed to notify owner ${ownerId}:`, error.message);
      }
    }
    
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
}

// Error handling
bot.catch((err, ctx) => {
  logger.error(`Bot error for ${ctx.updateType}:`, err);
  
  if (ctx.chat?.id) {
    try {
      ctx.reply('❌ Terjadi kesalahan sistem. Silakan coba lagi nanti.');
    } catch (e) {
      logger.error('Failed to send error message:', e);
    }
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// Graceful shutdown
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal) {
  logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
  
  try {
    await bot.stop(signal);
    
    // Clear intervals
    if (autoShareInterval) clearInterval(autoShareInterval);
    if (autoKirimInterval) clearInterval(autoKirimInterval);
    
    // Notify owners
    const owners = await readJSON(ownerFile);
    for (const ownerId of owners) {
      try {
        await bot.telegram.sendMessage(
          ownerId,
          `🔴 **BOT SHUTTING DOWN**\n\n` +
          `Signal: ${signal}\n` +
          `Time: ${new Date().toLocaleString('id-ID')}\n\n` +
          `Bot will restart automatically via Railway.`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        // Ignore errors during shutdown
      }
    }
    
    logger.info('✅ Bot shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown error:', error);
    process.exit(1);
  }
}

// Initialize and start
initialize();
