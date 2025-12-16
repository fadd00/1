// ==================== DOM ELEMENTS ====================
const urlInput = document.getElementById('urlInput');
const clearBtn = document.getElementById('clearBtn');
const platformDetected = document.getElementById('platformDetected');
const platformName = document.getElementById('platformName');
const downloadBtn = document.getElementById('downloadBtn');
const btnText = document.getElementById('btnText');
const btnIcon = downloadBtn.querySelector('.btn-icon');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const qualitySection = document.getElementById('qualitySection');

// Format and quality state
let selectedFormat = 'mp4';
let selectedQuality = '720';

// ==================== PLATFORM DETECTION ====================
const platforms = {
    youtube: {
        regex: /(?:youtube\.com|youtu\.be)/i,
        name: 'YouTube',
        icon: '📺'
    },
    tiktok: {
        regex: /tiktok\.com/i,
        name: 'TikTok',
        icon: '🎵'
    },
    instagram: {
        regex: /instagram\.com/i,
        name: 'Instagram',
        icon: '📷'
    },
    twitter: {
        regex: /(?:twitter\.com|x\.com)/i,
        name: 'Twitter/X',
        icon: '🐦'
    },
    facebook: {
        regex: /facebook\.com/i,
        name: 'Facebook',
        icon: '👥'
    },
    vimeo: {
        regex: /vimeo\.com/i,
        name: 'Vimeo',
        icon: '🎬'
    }
};

function detectPlatform(url) {
    for (const [key, platform] of Object.entries(platforms)) {
        if (platform.regex.test(url)) {
            return platform;
        }
    }
    return null;
}

// ==================== EVENT LISTENERS ====================

// URL Input handling
urlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();

    // Show/hide clear button
    clearBtn.style.display = url ? 'flex' : 'none';

    // Enable/disable download button
    downloadBtn.disabled = !url;

    // Detect platform
    if (url) {
        const platform = detectPlatform(url);
        if (platform) {
            platformDetected.style.display = 'flex';
            platformName.textContent = `${platform.icon} ${platform.name} detected`;
        } else {
            platformDetected.style.display = 'none';
        }
    } else {
        platformDetected.style.display = 'none';
    }

    // Hide error message
    errorMessage.style.display = 'none';
});

// Clear button
clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    urlInput.focus();
    clearBtn.style.display = 'none';
    platformDetected.style.display = 'none';
    downloadBtn.disabled = true;
    errorMessage.style.display = 'none';
});

// Format selection
document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));

        // Add active class to clicked
        btn.classList.add('active');

        // Update selected format
        selectedFormat = btn.dataset.format;

        // Show/hide quality section
        if (selectedFormat === 'mp4') {
            qualitySection.style.display = 'block';
        } else {
            qualitySection.style.display = 'none';
        }
    });
});

// Quality selection
document.querySelectorAll('.quality-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));

        // Add active class to clicked
        btn.classList.add('active');

        // Update selected quality
        selectedQuality = btn.dataset.quality;
    });
});

// Download button
downloadBtn.addEventListener('click', handleDownload);

// ==================== DOWNLOAD HANDLER ====================
async function handleDownload() {
    const url = urlInput.value.trim();

    if (!url) {
        showError('Please enter a valid URL');
        return;
    }

    // Hide error message
    errorMessage.style.display = 'none';

    // Update button state
    downloadBtn.disabled = true;
    downloadBtn.classList.add('loading');
    btnText.textContent = 'Processing...';
    btnIcon.classList.add('spinning');

    // Show progress section
    progressSection.style.display = 'block';
    progressFill.style.width = '30%';
    progressText.textContent = 'Fetching video information...';

    try {
        // Make API request to download
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                format: selectedFormat,
                quality: selectedFormat === 'mp4' ? selectedQuality : null
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Download failed');
        }

        // Update progress
        progressFill.style.width = '70%';
        progressText.textContent = 'Downloading...';

        // Wait a bit for visual feedback
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update progress to complete
        progressFill.style.width = '100%';
        progressText.textContent = 'Download complete! Starting file download...';

        // Update button state
        downloadBtn.classList.remove('loading');
        downloadBtn.classList.add('success');
        btnText.textContent = 'Success!';
        btnIcon.classList.remove('spinning');

        // Trigger file download
        const downloadLink = document.createElement('a');
        downloadLink.href = data.downloadUrl;
        downloadLink.download = data.filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Reset after success
        setTimeout(() => {
            resetUI();
        }, 3000);

    } catch (error) {
        console.error('Download error:', error);
        showError(error.message || 'Failed to download. Please check the URL and try again.');
        resetUI(false);
    }
}

// ==================== UI HELPERS ====================
function showError(message) {
    errorMessage.style.display = 'flex';
    errorText.textContent = message;
}

function resetUI(complete = true) {
    // Reset button state
    downloadBtn.disabled = !urlInput.value.trim();
    downloadBtn.classList.remove('loading', 'success');
    btnText.textContent = 'Download';
    btnIcon.classList.remove('spinning');

    if (complete) {
        // Hide progress
        progressSection.style.display = 'none';
        progressFill.style.width = '0%';

        // Clear input
        urlInput.value = '';
        clearBtn.style.display = 'none';
        platformDetected.style.display = 'none';
        downloadBtn.disabled = true;
    } else {
        // Just hide progress but keep input
        progressSection.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

// ==================== KEYBOARD SHORTCUTS ====================
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !downloadBtn.disabled) {
        handleDownload();
    }
});

// ==================== INITIALIZATION ====================
console.log('🚀 MediaGrab loaded successfully!');
console.log('Supported platforms:', Object.values(platforms).map(p => p.name).join(', '));
