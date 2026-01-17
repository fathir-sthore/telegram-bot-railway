# 🤖 Telegram Bot - Railway.app Deployment

Deploy Telegram bot dengan mudah di Railway.app dengan uptime 99.9% dan performa maksimal.

## 🚀 Fitur Railway

- ✅ **$5 credit gratis** setiap bulan
- ✅ **Auto-deploy** dari GitHub
- ✅ **Database PostgreSQL** gratis
- ✅ **Custom domain** gratis
- ✅ **No credit card** required
- ✅ **Uptime 99.9%**

## 📦 Quick Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/telegram-bot?referralCode=your-code)

### Cara 1: Deploy via Template
1. Klik tombol "Deploy on Railway" di atas
2. Login dengan GitHub
3. Isi environment variables:
   - `BOT_TOKEN`: Token dari @BotFather
4. Klik "Deploy"

### Cara 2: Manual Deploy
```bash
# Clone repository
git clone https://github.com/username/telegram-bot-railway.git
cd telegram-bot-railway
```
```bash
# Install Railway CLI
npm i -g @railway/cli
```
```bash
# Login ke Railway
railway login
```
```bash
# Deploy
railway up