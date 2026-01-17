const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Telegraf } = require('telegraf');

// Load environment
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const databaseDir = path.join(__dirname, '../database');
const backupDir = path.join(__dirname, '../backups');

async function createBackup() {
  try {
    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(backupDir, `backup-${timestamp}`);
    
    await fs.mkdir(backupFolder, { recursive: true });
    
    // List of files to backup
    const files = [
      'blacklist.json',
      'grub.json', 
      'preset.json',
      'premium.json',
      'groupstats.json',
      'users.json',
      'autoshare.json',
      'owner.json',
      'autokirim.json'
    ];
    
    // Copy files
    for (const file of files) {
      const source = path.join(databaseDir, file);
      const destination = path.join(backupFolder, file);
      
      try {
        await fs.copyFile(source, destination);
        console.log(`✓ Backed up ${file}`);
      } catch (error) {
        console.log(`✗ Failed to backup ${file}:`, error.message);
      }
    }
    
    // Create compressed archive
    const archiver = require('archiver');
    const output = fs.createWriteStream(`${backupFolder}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`Archive created: ${archive.pointer()} total bytes`);
    });
    
    archive.pipe(output);
    archive.directory(backupFolder, false);
    await archive.finalize();
    
    // Send to owner
    const owners = JSON.parse(await fs.readFile(
      path.join(databaseDir, 'owner.json'), 
      'utf8'
    ));
    
    for (const ownerId of owners) {
      try {
        await bot.telegram.sendDocument(ownerId, {
          source: `${backupFolder}.zip`,
          filename: `backup-${timestamp}.zip`
        });
        
        console.log(`✓ Backup sent to owner ${ownerId}`);
      } catch (error) {
        console.log(`✗ Failed to send to ${ownerId}:`, error.message);
      }
    }
    
    // Cleanup old backups (keep last 7 days)
    const backups = await fs.readdir(backupDir);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    for (const backup of backups) {
      const backupPath = path.join(backupDir, backup);
      const stat = await fs.stat(backupPath);
      
      if (now - stat.mtime.getTime() > sevenDays) {
        await fs.rm(backupPath, { recursive: true });
        console.log(`🗑️ Deleted old backup: ${backup}`);
      }
    }
    
    console.log('✅ Backup completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    return false;
  }
}

// Run backup if called directly
if (require.main === module) {
  createBackup().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { createBackup };
