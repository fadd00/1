import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files (CSS, JS, images) from current directory
app.use(express.static(__dirname));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// API endpoint to get video information
app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Use yt-dlp to get video info
        const { stdout } = await execAsync(`yt-dlp --dump-json "${url}"`);
        const info = JSON.parse(stdout);

        res.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            platform: info.extractor_key,
            formats: info.formats?.filter(f => f.vcodec !== 'none').slice(0, 5) || []
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({
            error: 'Failed to fetch video information',
            details: error.message
        });
    }
});

// API endpoint to download video
app.post('/api/download', async (req, res) => {
    try {
        const { url, format, quality } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`📥 Download request - URL: ${url}, Format: ${format}, Quality: ${quality}`);

        // Generate unique filename
        const timestamp = Date.now();
        const outputTemplate = path.join(downloadsDir, `${timestamp}_%(title)s.%(ext)s`);

        let command;
        if (format === 'mp3') {
            // Download and convert to MP3
            command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${url}"`;
        } else {
            // Download video (MP4)
            const qualityFlag = quality ? `-f "bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]"` : '-f "bestvideo+bestaudio/best"';
            command = `yt-dlp ${qualityFlag} --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
        }

        console.log('🔧 Executing command:', command);

        // Execute download with increased timeout for MP3 conversion
        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024 * 50, // 50MB buffer for larger files
            timeout: 300000 // 5 minutes timeout
        });

        console.log('✅ Download completed');
        if (stdout) console.log('stdout:', stdout);
        if (stderr) console.log('stderr:', stderr);

        // Wait a moment for file system to sync
        await new Promise(resolve => setTimeout(resolve, 500));

        // Find the downloaded file
        const files = fs.readdirSync(downloadsDir)
            .filter(f => f.startsWith(timestamp.toString()))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(downloadsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (files.length === 0) {
            console.error('❌ Downloaded file not found in directory');
            throw new Error('Downloaded file not found. The download may have failed.');
        }

        const filename = files[0].name;
        const filePath = path.join(downloadsDir, filename);

        console.log('📁 File ready:', filename);

        res.json({
            success: true,
            filename: filename,
            downloadUrl: `/api/download/${filename}`
        });

    } catch (error) {
        console.error('❌ Error downloading video:', error);

        // Make sure we always return a valid JSON response
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to download video',
                details: error.message,
                suggestion: 'Please check if the URL is valid and the video is publicly accessible.'
            });
        }
    }
});

// API endpoint to serve downloaded files
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(downloadsDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, (err) => {
        if (err) {
            console.error('Error sending file:', err);
        }

        // Clean up file after download
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Cleaned up file:', filename);
            }
        }, 5000); // Delete after 5 seconds
    });
});

// Clean up old files on startup
const cleanOldFiles = () => {
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    files.forEach(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            console.log('Cleaned up old file:', file);
        }
    });
};

// Clean old files on startup and every hour
cleanOldFiles();
setInterval(cleanOldFiles, 60 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`🚀 Multi-Platform Downloader server running at http://localhost:${PORT}`);
    console.log(`📁 Downloads directory: ${downloadsDir}`);
    console.log(`✨ Ready to download from YouTube, TikTok, Instagram, and more!`);
});
