const fs = require('fs');
const path = require('path');

const VIDEO_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v']);
const SPONSOR_EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif']);

function getValidFiles(dirPath, allowedExts) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter(file => {
      if (file.startsWith('.')) return false;
      if (file.toLowerCase() === 'readme.md') return false;
      const ext = path.extname(file).toLowerCase();
      return allowedExts.has(ext);
    })
    .sort((a, b) => a.localeCompare(undefined, { numeric: true, sensitivity: 'base' }));
}

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');

const videos = getValidFiles(path.join(rootDir, 'videos'), VIDEO_EXTS);
const sponsors = getValidFiles(path.join(rootDir, 'sponsors'), SPONSOR_EXTS);

let videoDurationMinutes = 30;
try {
  const rootMediaList = path.join(rootDir, 'media-list.json');
  if (fs.existsSync(rootMediaList)) {
    const prev = JSON.parse(fs.readFileSync(rootMediaList, 'utf8'));
    if (typeof prev.videoDurationMinutes === 'number' && prev.videoDurationMinutes > 0) {
      videoDurationMinutes = prev.videoDurationMinutes;
    }
  }
} catch (e) {}

const payload = {
  videos,
  sponsors,
  videoDurationMinutes,
  totalVideos: videos.length,
  totalSponsors: sponsors.length,
  updatedAt: new Date().toISOString()
};

const jsonStr = JSON.stringify(payload, null, 2) + '\n';

// Write to public/ and root
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'media-list.json'), jsonStr, 'utf8');
fs.writeFileSync(path.join(rootDir, 'media-list.json'), jsonStr, 'utf8');

// Mirror sync: copies new/updated files and deletes stale files in destination
function mirrorDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const srcFiles = new Set(fs.readdirSync(src).filter(f => !f.startsWith('.')));
  const destFiles = fs.readdirSync(dest).filter(f => !f.startsWith('.'));

  // Remove deleted files from dest
  for (const f of destFiles) {
    if (!srcFiles.has(f)) {
      console.log(`[sync] Removing stale file: ${path.join(dest, f)}`);
      fs.unlinkSync(path.join(dest, f));
    }
  }

  // Copy new or modified files
  for (const f of srcFiles) {
    const srcFile = path.join(src, f);
    const destFile = path.join(dest, f);
    const srcStat = fs.statSync(srcFile);
    if (!fs.existsSync(destFile) || fs.statSync(destFile).size !== srcStat.size) {
      console.log(`[sync] Copying: ${f} -> ${dest}`);
      fs.copyFileSync(srcFile, destFile);
    }
  }
}

mirrorDir(path.join(rootDir, 'videos'), path.join(publicDir, 'videos'));
mirrorDir(path.join(rootDir, 'sponsors'), path.join(publicDir, 'sponsors'));
mirrorDir(path.join(rootDir, 'logos'), path.join(publicDir, 'logos'));

console.log('Successfully updated media-list.json and mirrored public assets:');
console.log(jsonStr);
