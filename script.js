// Ambil elemen-elemen dari HTML
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const switchButton = document.getElementById('switchButton');
const loading = document.getElementById('loading');

let model = null;
let stream = null;
let isDetecting = false;
let currentFacingMode = 'environment'; // 'environment' = kamera belakang, 'user' = kamera depan

// Kamus untuk menerjemahkan kelas objek ke Bahasa Indonesia
const classTranslations = {
    'person': 'orang',
    'bicycle': 'sepeda',
    'car': 'mobil',
    'motorcycle': 'sepeda motor',
    'airplane': 'pesawat',
    'bus': 'bis',
    'train': 'kereta',
    'truck': 'truk',
    'boat': 'kapal',
    'traffic light': 'lampu lalu lintas',
    'fire hydrant': 'hidran',
    'stop sign': 'rambu berhenti',
    'bench': 'bangku',
    'bird': 'burung',
    'cat': 'kucing',
    'dog': 'anjing',
    'backpack': 'ransel',
    'umbrella': 'payung',
    'handbag': 'tas tangan',
    'tie': 'dasi',
    'suitcase': 'koper',
    'sports ball': 'bola',
    'kite': 'layangan',
    'bottle': 'botol',
    'cup': 'cangkir',
    'fork': 'garpu',
    'knife': 'pisau',
    'spoon': 'sendok',
    'bowl': 'mangkuk',
    'banana': 'pisang',
    'apple': 'apel',
    'sandwich': 'roti lapis',
    'orange': 'jeruk',
    'chair': 'kursi',
    'couch': 'sofa',
    'potted plant': 'tanaman pot',
    'bed': 'tempat tidur',
    'dining table': 'meja makan',
    'toilet': 'toilet',
    'tv': 'tv',
    'laptop': 'laptop',
    'mouse': 'mouse',
    'remote': 'remote',
    'keyboard': 'keyboard',
    'cell phone': 'ponsel',
    'microwave': 'microwave',
    'book': 'buku',
    'clock': 'jam',
    'vase': 'vas',
    'scissors': 'gunting',
    'toothbrush': 'sikat gigi'
};

// --- Fungsi untuk Suara (Text-to-Speech) ---

// Variabel untuk mencegah "spam" suara
let lastSpokenTime = 0;
let lastSpokenClass = '';
const SPEAK_THROTTLE = 3000; // Jeda 3 detik antar suara

function speak(text) {
    const now = Date.now();
    // Cek apakah suara masih di-throttle
    if (now - lastSpokenTime < SPEAK_THROTTLE) {
        return;
    }
    // Cek apakah objeknya sama dengan yg baru saja disebut
    if (text === lastSpokenClass && (now - lastSpokenTime < 5000)) {
        return;
    }

    lastSpokenTime = now;
    lastSpokenClass = text;

    // Terjemahkan ke Bahasa Indonesia
    const translatedText = classTranslations[text] || text;

    // Buat objek ucapan
    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.lang = 'id-ID'; // Set bahasa ke Indonesia
    utterance.rate = 1.1; // Kecepatan bicara
    
    // Hentikan suara sebelumnya (jika ada) dan mulai yg baru
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// --- Fungsi Utama Aplikasi ---

// 1. Memuat Model AI
async function loadModel() {
    console.log("Memuat model...");
    try {
        model = await cocoSsd.load();
        console.log("Model berhasil dimuat.");
        loading.style.display = 'none'; // Sembunyikan loading
        startButton.disabled = false; // Aktifkan tombol
        switchButton.disabled = false;
    } catch (err) {
        console.error("Gagal memuat model: ", err);
        loading.getElementsByTagName('p')[0].innerText = "Gagal memuat model. Coba refresh.";
    }
}

// 2. Memulai Kamera
async function startCamera(facingMode) {
    console.log("Memulai kamera...");
    // Hentikan stream lama jika ada
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    const constraints = {
        video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        // Tunggu video siap
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                // Sesuaikan ukuran canvas dengan video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                resolve();
            };
        });
        
        console.log("Kamera siap.");
        isDetecting = true;
        detectFrame(); // Mulai deteksi
        
    } catch (err) {
        console.error("Error mengakses kamera: ", err);
        alert("Gagal mengakses kamera. Pastikan Anda memberi izin.");
        isDetecting = false;
        startButton.innerText = "▶️ Mulai Deteksi";
    }
}

// 3. Loop Deteksi (Inti aplikasi)
async function detectFrame() {
    if (!isDetecting || model === null) {
        return;
    }

    // Dapatkan prediksi dari model
    const predictions = await model.detect(video);

    // Gambar frame video saat ini ke canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Gambar kotak dan label untuk setiap objek yang terdeteksi
    predictions.forEach(prediction => {
        // Objek 'prediction' berisi: [x, y, width, height]
        const [x, y, width, height] = prediction.bbox;
        const text = prediction.class;
        const score = prediction.score;

        // Tampilkan hanya jika kepercayaan > 50%
        if (score > 0.5) {
            // Gaya untuk kotak
            ctx.strokeStyle = 'rgba(0, 255, 136, 1)'; // Warna kotak (var --box-color)
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Gaya untuk label teks
            ctx.fillStyle = 'rgba(0, 255, 136, 1)';
            ctx.font = '18px Poppins';
            
            // Terjemahkan label
            const translatedLabel = classTranslations[text] || text;
            const labelText = `${translatedLabel} (${Math.round(score * 100)}%)`;
            
            // Background untuk label
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, y, ctx.measureText(labelText).width + 8, 24);
            
            // Tulis label
            ctx.fillStyle = 'rgba(0, 255, 136, 1)';
            ctx.fillText(labelText, x + 4, y + 18);
        }
    });

    // Ucapkan objek yang paling percaya diri
    if (predictions.length > 0) {
        // Urutkan berdasarkan kepercayaan
        predictions.sort((a, b) => b.score - a.score);
        // Ucapkan yang pertama (paling tinggi score-nya)
        speak(predictions[0].class);
    }

    // Ulangi untuk frame berikutnya
    requestAnimationFrame(detectFrame);
}

// --- Event Listeners untuk Tombol ---

// Tombol Start/Stop
startButton.addEventListener('click', () => {
    if (isDetecting) {
        // Hentikan deteksi
        isDetecting = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Bersihkan canvas
        startButton.innerHTML = '<span class="icon">▶️</span> Mulai Deteksi';
        console.log("Deteksi dihentikan.");
    } else {
        // Mulai deteksi
        startCamera(currentFacingMode);
        startButton.innerHTML = '<span class="icon">⏹️</span> Hentikan';
    }
});

// Tombol Ganti Kamera
switchButton.addEventListener('click', () => {
    if (currentFacingMode === 'environment') {
        currentFacingMode = 'user'; // Ganti ke kamera depan
    } else {
        currentFacingMode = 'environment'; // Ganti ke kamera belakang
    }
    
    // Jika sedang berjalan, restart kamera dengan mode baru
    if (isDetecting) {
        startCamera(currentFacingMode);
    }
    console.log("Kamera diganti ke: ", currentFacingMode);
});

// Mulai muat model saat halaman dibuka
loadModel();
