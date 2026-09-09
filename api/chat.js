import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const sysPrompt = `You are Nova, an exclusive, persuasive, and highly knowledgeable Virtual Assistant specializing in both Fashion Styling & Beauty Expertise.
Your tone is sophisticated, elegant, warm, and highly professional like a high-end celebrity stylist and dermatologist.

Area Pengetahuan Utama Kamu Meliputi:
1. **Fashion & Styling:** Outfit sehari-hari, outfit kondangan (formal/tradisional), smart-casual, busana kerja, teori warna baju (color season analysis), mix-and-match, styling hijab, hingga pemilihan aksesoris.
2. **Beauty & Makeup:** Tutorial makeup (flawless, bold, natural, kondangan), teknik contour/highlight yang tepat untuk berbagai bentuk wajah, review & rekomendasi kosmetik.
3. **Skincare & Men's Grooming:** Skincare routine pagi/malam, anti-aging, penanganan jerawat (acne-prone), pemilihan bahan aktif (retinol, niacinamide, vit C), urutan pemakaian skincare, hingga perawatan kulit pria.
4. **Fragrance/Parfum:** Rekomendasi wewangian (floral, woody, musky, dll) untuk berbagai acara.

Jika user menanyakan hal-hal terkait teori, panduan, atau ide (contoh: "warna yang cocok buat kulit sawo matang", "urutan skincare pagi", "ide outfit kondangan hijab"), JAWAB DENGAN SANGAT DETAIL, CERDAS, DAN TERSTRUKTUR berdasarkan pengetahuan AI-mu. Berikan step-by-step atau opsi visualisasi gaya.
JIKA DAN HANYA JIKA user terlihat butuh belanja baju/perhiasan spesifik dari toko kita, kamu WAJIB menggunakan tool 'get_fashion_products'.

ATURAN KRITIS UNTUK MENJAWAB:
1. KAMU WAJIB SELALU MENJAWAB MENGGUNAKAN BAHASA INDONESIA YANG ELEGAN & MENYAPA DENGAN HANGAT.
2. Gunakan pemformatan Markdown yang rapi (bullet points, bold untuk kata kunci, numbering untuk tahapan skincare/makeup, dll) agar panjang tapi nyaman dibaca.
3. Berikan saran yang aplikatif (contoh: "Untuk kulit kering, hindari facial wash dengan scrub kasar dan gunakan hyaluronic acid...").
4. Jadilah persuasif, bangun rasa percaya diri user! (Contoh: "Pilihan yang sangat tepat! Warna emerald green akan membuat kulitmu tampak makin bercahaya...").
5. Jangan pernah mengarang URL gambar produk.`;

const fetchProductsDeclaration = {
    name: "get_fashion_products",
    description: "Fetches real clothing or jewelry products from the external catalog.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            category: {
                type: SchemaType.STRING,
                description: "Must be one of: 'women\\'s clothing', 'men\\'s clothing', 'jewelery'. Defaults to 'women\\'s clothing'",
            },
            limit: {
                type: SchemaType.INTEGER,
                description: "Number of products to return (default 3, max 5)",
            },
        },
        required: ["category"],
    },
};

function getFriendlyGeminiError(error) {
    const message = String(error?.message || "");
    const lowerMessage = message.toLowerCase();

    if (message.includes("403") && lowerMessage.includes("reported as leaked")) {
        return "Kunci API Gemini terdeteksi bocor dan diblokir (403). Buat API key baru di Google AI Studio, set variabel `GEMINI_API_KEY` di Vercel, lalu redeploy.";
    }

    if (message.includes("403")) {
        return "Akses ke Gemini ditolak (403). Periksa apakah API key valid, belum direvoke, dan memiliki izin model yang digunakan.";
    }

    if (message.includes("429")) {
        return "Permintaan ke Gemini terlalu banyak (429). Mohon tunggu sebentar lalu coba lagi.";
    }

    return `Maaf, terjadi kendala saat menghubungkan ke layanan AI. (Error: ${message || "Unknown error"})`;
}

async function getFashionProducts(category, limit = 3) {
    try {
        const res = await fetch(`https://fakestoreapi.com/products/category/${encodeURIComponent(category)}?limit=${limit}`);
        const data = await res.json();
        return { products: data };
    } catch {
        return { error: "Failed to fetch products" };
    }
}

function createModel(apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: sysPrompt,
        tools: [{ functionDeclarations: [fetchProductsDeclaration] }],
    });
}

async function runChat(model, message, history) {
    const chat = model.startChat({ history: history || [] });
    let result = await chat.sendMessage(message);
    let call = result.response.functionCalls()?.[0];

    while (call) {
        const apiResult = await getFashionProducts(call.args.category, call.args.limit);
        result = await chat.sendMessage([{
            functionResponse: {
                name: call.name,
                response: apiResult,
            },
        }]);
        call = result.response.functionCalls()?.[0];
    }

    return {
        reply: result.response.text(),
        history: await chat.getHistory(),
    };
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: "GEMINI_API_KEY belum dikonfigurasi. Tambahkan variabel ini di Vercel Project Settings > Environment Variables.",
        });
    }

    const { message, history } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Pesan tidak boleh kosong." });
    }

    try {
        const model = createModel(apiKey);
        const result = await runChat(model, message.trim(), Array.isArray(history) ? history : []);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Gemini Error:", error);
        return res.status(500).json({ error: getFriendlyGeminiError(error) });
    }
}
