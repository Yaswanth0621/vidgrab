const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const dest = path.join(__dirname, 'bin', 'yt-dlp');

if (!fs.existsSync(path.join(__dirname, 'bin'))) {
    fs.mkdirSync(path.join(__dirname, 'bin'));
}

console.log(`Downloading yt-dlp from ${url}...`);

const file = fs.createWriteStream(dest);
https.get(url, (response) => {
    if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('Download complete.');
                console.log(`File size: ${fs.statSync(dest).size} bytes`);
            });
        });
    } else {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log('Download complete.');
            console.log(`File size: ${fs.statSync(dest).size} bytes`);
        });
    }
}).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error(`Error: ${err.message}`);
});
