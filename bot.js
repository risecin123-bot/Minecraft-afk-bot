const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');

// Configuration - Updated for AesirMC
const config = {
  server: {
    host: process.env.MC_HOST || 'play.aesirmc.com',
    port: parseInt(process.env.MC_PORT) || 25565,
    version: process.env.MC_VERSION || '1.21.11'
  },
  bot: {
    username: process.env.MC_USERNAME || 'Evilcorpclanbot',
    auth: 'offline', // 'offline' or 'microsoft'
    password: '', 
    authmePassword: process.env.MC_PASSWORD || 'selam12345'
  },
  serverCommands: {
    enabled: true,
    joinServer: '/survival', // Joined survival mode on AesirMC
    delay: 3000
  },
  features: {
    autoReconnect: {
      enabled: true,
      delay: 5000
    },
    movement: {
      enabled: false, // Disabled coordinates to avoid wall bumps
      coordinates: {
        x: 0,
        y: 64,
        z: 0
      }
    },
    antiAFK: {
      enabled: true,
      jump: true,
      sneak: false,
      look: true,
      interval: 30000 // Anti-AFK every 30s
    },
    chatMessages: {
      enabled: false,
      interval: 300000,
      messages: [
        'Still here!',
        'AFK farming...',
        'Bot is active'
      ]
    },
    chatLog: {
      enabled: true
    }
  }
};

let bot;
let isAuthenticated = false;
let loginAttempts = 0;
let serverJoined = false;
let authmeCompleted = false;
const maxLoginAttempts = 3;

function createBot() {
  console.log('🤖 AesirMC Botu başlatılıyor...');
  
  const botOptions = {
    host: config.server.host,
    port: config.server.port,
    username: config.bot.username,
    version: config.server.version,
    hideErrors: false
  };

  if (config.bot.auth === 'microsoft') {
    botOptions.auth = 'microsoft';
  } else if (config.bot.auth === 'mojang' && config.bot.password) {
    botOptions.password = config.bot.password;
    botOptions.auth = 'mojang';
  } else {
    botOptions.auth = 'offline';
  }

  bot = mineflayer.createBot(botOptions);

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log(`✅ [${bot.username}] sunucuya giriş yaptı!`);
    
    isAuthenticated = false;
    loginAttempts = 0;
    serverJoined = false;
    authmeCompleted = false;
    
    try {
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);
    } catch (e) {
      console.log('⚠️ Pathfinder verileri yüklenirken varsayılan ayar kullanıldı.');
    }

    console.log('📋 Adım 1: AuthMe kimlik doğrulaması başlatılıyor...');
    setTimeout(() => {
      attemptAuthMeLogin();
    }, 3000);
  });

  bot.on('chat', (username, message) => {
    if (config.features.chatLog.enabled && username !== bot.username) {
      console.log(`💬 [${username}] ${message}`);
    }

    if (username === bot.username) return;

    const lowerMessage = message.toLowerCase();
    
    if (serverJoined && lowerMessage.includes('survival') && 
        (lowerMessage.includes('joined') || lowerMessage.includes('connected') || lowerMessage.includes('welcome') || lowerMessage.includes('hoşgeldin'))) {
      console.log('🌍 Survival sunucusuna başarıyla geçiş yapıldı!');
      console.log('📋 Adım 3: Bot AFK moduna geçiyor...');
      setTimeout(startBotActivities, 2000);
    }
    
    if ((lowerMessage.includes('register') || lowerMessage.includes('kayit') || lowerMessage.includes('kayıt')) && 
        (lowerMessage.includes('password') || lowerMessage.includes('/register') || lowerMessage.includes('sifre'))) {
      console.log('🔐 Kayıt yapılması gerekiyor...');
      setTimeout(() => {
        const password = config.bot.authmePassword;
        bot.chat(`/register ${password} ${password}`);
        console.log('📝 Kayıt komutu gönderildi.');
      }, 1500);
    }
    
    else if ((lowerMessage.includes('login') || lowerMessage.includes('giris') || lowerMessage.includes('giriş')) && 
             (lowerMessage.includes('password') || lowerMessage.includes('/login') || lowerMessage.includes('sifre'))) {
      console.log('🔑 Giriş yapılması gerekiyor...');
      setTimeout(() => {
        bot.chat(`/login ${config.bot.authmePassword}`);
        console.log('🔓 Giriş komutu gönderildi.');
        loginAttempts++;
      }, 1500);
    }
    
    else if ((lowerMessage.includes('successfully') || lowerMessage.includes('welcome') || lowerMessage.includes('logged') || lowerMessage.includes('basariyla') || lowerMessage.includes('başarıyla')) && 
             (lowerMessage.includes('logged') || lowerMessage.includes('registered') || lowerMessage.includes('authenticated') || lowerMessage.includes('giris') || lowerMessage.includes('giriş'))) {
      console.log('✅ AuthMe doğrulaması başarılı!');
      isAuthenticated = true;
      authmeCompleted = true;
      
      if (config.serverCommands.enabled && config.serverCommands.joinServer) {
        console.log('📋 Adım 2: Survival sunucusuna aktarılıyor...');
        setTimeout(() => {
          joinSpecificServer();
        }, config.serverCommands.delay);
      } else {
        setTimeout(startBotActivities, 2000);
      }
    }
    
    else if (lowerMessage.includes('wrong password') || lowerMessage.includes('incorrect password') || lowerMessage.includes('yanlis sifre') || lowerMessage.includes('yanlış şifre')) {
      console.log('❌ Giriş başarısız - Hatalı şifre!');
      if (loginAttempts < maxLoginAttempts) {
        console.log(`🔄 Tekrar deneniyor (${loginAttempts}/${maxLoginAttempts})...`);
        setTimeout(() => {
          bot.chat(`/login ${config.bot.authmePassword}`);
          loginAttempts++;
        }, 3000);
      }
    }
    
    else if (lowerMessage.includes('already') && lowerMessage.includes('registered')) {
      console.log('ℹ️ Zaten kayıtlı olunmuş, giriş yapılıyor...');
      setTimeout(() => {
        bot.chat(`/login ${config.bot.authmePassword}`);
      }, 1500);
    }
  });

  bot.on('error', (err) => {
    console.error('❌ Bot hatası:', err.message);
  });

  bot.on('kicked', (reason) => {
    console.log('⚠️ Bot sunucudan atıldı:', reason);
    if (config.features.autoReconnect.enabled) {
      console.log(`🔄 ${config.features.autoReconnect.delay / 1000} saniye içinde tekrar bağlanılıyor...`);
      setTimeout(createBot, config.features.autoReconnect.delay);
    }
  });

  bot.on('end', () => {
    console.log('🔌 Bağlantı koptu, yeniden bağlanılıyor...');
    if (config.features.autoReconnect.enabled) {
      setTimeout(createBot, config.features.autoReconnect.delay);
    }
  });

  bot.on('death', () => {
    console.log('💀 Bot öldü ve doğdu.');
    setTimeout(() => {
      if (authmeCompleted) {
        startBotActivities();
      } else {
        attemptAuthMeLogin();
      }
    }, 3000);
  });

  return bot;
}

function joinSpecificServer() {
  console.log(`🌍 Aktarma komutu gönderiliyor: ${config.serverCommands.joinServer}`);
  bot.chat(config.serverCommands.joinServer);
  serverJoined = true;

  setTimeout(() => {
    if (authmeCompleted && !serverJoined) {
      startBotActivities();
    }
  }, 10000);
}

function attemptAuthMeLogin() {
  if (authmeCompleted) return;

  console.log('🔐 AuthMe denemesi yapılıyor...');
  const password = config.bot.authmePassword;
  
  setTimeout(() => {
    bot.chat(`/register ${password} ${password}`);
  }, 2000);
  
  setTimeout(() => {
    bot.chat(`/login ${password}`);
    loginAttempts++;
  }, 4000);
  
  setTimeout(() => {
    if (!authmeCompleted) {
      isAuthenticated = true;
      authmeCompleted = true;
      if (config.serverCommands.enabled && config.serverCommands.joinServer) {
        setTimeout(joinSpecificServer, config.serverCommands.delay);
      } else {
        startBotActivities();
      }
    }
  }, 15000);
}

function startBotActivities() {
  if (!authmeCompleted) return;
  
  console.log('🎮 AFK modları ve etkinlikleri aktif edildi.');

  if (config.features.antiAFK.enabled) {
    startAntiAFK();
  }
}

function startAntiAFK() {
  const antiAfkConfig = config.features.antiAFK;
  
  setInterval(() => {
    if (!bot || !bot._client || bot._client.state !== 'play') return;
    
    try {
      if (antiAfkConfig.jump) {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot && bot.setControlState) {
            bot.setControlState('jump', false);
          }
        }, 100);
      }
      
      if (antiAfkConfig.look) {
        const yaw = (Math.random() - 0.5) * Math.PI;
        const pitch = (Math.random() - 0.5) * Math.PI / 2;
        bot.look(yaw, pitch);
      }
    } catch (error) {
      console.log('⚠️ Anti-AFK hatası:', error.message);
    }
  }, antiAfkConfig.interval);
}

createBot();

process.on('uncaughtException', (error) => {
  console.error('💥 Beklenmeyen Hata:', error.message);
  setTimeout(createBot, 5000);
});
