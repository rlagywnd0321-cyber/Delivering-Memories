const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = 8000;

// CORS 설정: 모든 도메인에서의 통신 허용
app.use(cors());

// JSON 및 URL-encoded 바디 파싱 설정 (용량 한계도 크게 설정하여 base64 수용)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 업로드된 이미지를 보관할 폴더와 데이터베이스 JSON 파일 경로 설정
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(UPLOADS_DIR, 'postcards_db.json');
const GALLERY_FILE = path.join(UPLOADS_DIR, 'chatbot_gallery_db.json');

// 폴더 및 DB 파일 자동 생성
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(GALLERY_FILE)) {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify([], null, 2), 'utf8');
}

// 업로드된 이미지 파일들과 웹 리소스 정적 서빙 설정
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(__dirname));

// ==========================================
// DB 파일 읽기/쓰기 헬퍼 함수
// ==========================================
function readJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error(`Read Error on ${filePath}:`, err);
        return [];
    }
}

function writeJSON(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Write Error on ${filePath}:`, err);
        return false;
    }
}

// 외부 URL로부터 이미지 다운로드 후 로컬 저장하는 헬퍼 함수 (비동기)
function downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download image. Status: ${response.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(destPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => { });
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// 공통 이미지 데이터 처리 헬퍼 (Base64 또는 HTTP 원격 URL)
async function saveImageInput(photoData, filenamePrefix) {
    if (!photoData) return '';

    const filename = `${filenamePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    if (photoData.startsWith('data:image/')) {
        const matches = photoData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const fullFilename = `${filename}.${ext}`;
            const savePath = path.join(UPLOADS_DIR, fullFilename);
            fs.writeFileSync(savePath, buffer);
            return `/uploads/${fullFilename}`;
        }
    } else if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
        const isLocal = photoData.includes('localhost:8000') || photoData.includes('127.0.0.1:8000');
        if (isLocal) {
            try {
                const parsedUrl = new URL(photoData);
                return parsedUrl.pathname;
            } catch (e) {
                return photoData;
            }
        } else {
            const ext = photoData.includes('.png') ? '.png' : '.jpg';
            const fullFilename = `${filename}${ext}`;
            const savePath = path.join(UPLOADS_DIR, fullFilename);
            await downloadImage(photoData, savePath);
            return `/uploads/${fullFilename}`;
        }
    }
    return '';
}

// ==========================================
// REST API 엔드포인트 구현
// ==========================================

// 1. 접수된 엽서 목록 조회 API (GET /api/postcards)
app.get('/api/postcards', (req, res) => {
    try {
        const dbContent = readJSON(DB_FILE);
        return res.status(200).json({
            success: true,
            data: dbContent
        });
    } catch (err) {
        console.error('GET /api/postcards Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 2. 엽서 주문 신청 API (POST /api/postcard) - 일반 시뮬레이터 전송용
app.post('/api/postcard', async (req, res) => {
    try {
        const { recipient_name, recipient_postcode, recipient_address, recipient_address_detail, letter_content, photo_data } = req.body;

        let photoUrl = '';
        if (photo_data) {
            photoUrl = await saveImageInput(photo_data, 'postcard');
        }

        const newOrder = {
            id: 'ord-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            photo_url: photoUrl,
            recipient_name: recipient_name ? recipient_name.trim() : '',
            recipient_postcode: recipient_postcode ? recipient_postcode.trim() : '',
            recipient_address: recipient_address ? recipient_address.trim() : '',
            recipient_address_detail: recipient_address_detail ? recipient_address_detail.trim() : '',
            letter_content: letter_content ? letter_content.trim() : '',
            created_at: new Date().toISOString(),
            source: 'Web Simulator'
        };

        const dbContent = readJSON(DB_FILE);
        dbContent.push(newOrder);
        writeJSON(DB_FILE, dbContent);

        console.log(`[주문 접수 완료] ID: ${newOrder.id}, 수신인: ${newOrder.recipient_name}`);
        return res.status(200).json({
            success: true,
            message: 'Success',
            data: newOrder
        });
    } catch (err) {
        console.error('POST /api/postcard Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// 3. 챗봇 사진/메시지 임시 접수 API (POST /api/chatbot)
app.post('/api/chatbot', async (req, res) => {
    try {
        console.log('[챗봇 요청 수신] Body:', JSON.stringify(req.body, null, 2));
        const userId = req.body.userRequest?.user?.id || 'unknown-user';
        const params = req.body.action?.params || {};

        // 일반 파라미터 매핑 외에, 폴백 블록이나 미디어 다이렉트 전송 시의 카카오 API 경로도 상호 폴백 지원
        const photoData = params.photo || req.body.userRequest?.params?.media?.url || '';
        const letterContent = params.letter || req.body.userRequest?.utterance || '';

        let photoUrl = '';
        if (photoData) {
            photoUrl = await saveImageInput(photoData, 'chatbot');
        }

        // 임시 갤러리 DB에 누적 저장
        const newGalleryItem = {
            id: 'gal-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            user_id: userId,
            photo_url: photoUrl,
            letter_content: letterContent,
            created_at: new Date().toISOString()
        };

        const galleryContent = readJSON(GALLERY_FILE);
        galleryContent.push(newGalleryItem);
        writeJSON(GALLERY_FILE, galleryContent);

        console.log(`[챗봇 임시 보관 접수 완료] ID: ${newGalleryItem.id}, User: ${userId}`);

        // 요청 헤더로부터 동적 프로토콜 및 도메인 호스트 파싱 (터널링 외부 접속 호환성 극대화)
        const host = req.headers.host || 'localhost:8000';
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const baseUrl = `${protocol}://${host}`;

        // 카카오톡 SimpleCard 반환
        const absolutePhotoUrl = photoUrl ? `${baseUrl}${photoUrl}` : '';
        const escapedLetter = letterContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');

        const responseJson = {
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleCard: {
                            title: "Photo Saved to Gallery!",
                            description: `Your photo and message have been temporarily saved to your gallery.\n\n[Message]\n${escapedLetter}`,
                            thumbnail: {
                                imageUrl: absolutePhotoUrl
                            },
                            buttons: [
                                {
                                    action: "webLink",
                                    label: "Select & Send Postcard",
                                    webLinkUrl: `${baseUrl}/chatbot_select.html?user_id=${userId}`
                                }
                            ]
                        }
                    }
                ]
            }
        };

        return res.status(200).json(responseJson);

    } catch (err) {
        console.error('Chatbot API Error:', err);
        return res.status(200).json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: `⚠️ An error occurred while processing your request: ${err.message}`
                        }
                    }
                ]
            }
        });
    }
});

// 서버 기동
app.listen(PORT, () => {
    console.log('==========================================');
    console.log(` 📮 추억배달 백엔드 API 서버 작동 시작`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log('==========================================');
});
