import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Ensure the API key exists
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY is not defined in the environment.");
}

const genAI = new GoogleGenerativeAI(apiKey || "DUMMY_KEY");

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

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: sysPrompt,
    tools: [{ functionDeclarations: [fetchProductsDeclaration] }],
});

// External API implementation
async function getFashionProducts(category, limit = 3) {
    try {
        const res = await fetch(`https://fakestoreapi.com/products/category/${encodeURIComponent(category)}?limit=${limit}`);
        const data = await res.json();
        return { products: data };
    } catch (error) {
        return { error: "Failed to fetch products" };
    }
}

const functionsMap = {
    get_fashion_products: getFashionProducts,
};

let chatSession = null;

export const initChat = () => {
    chatSession = model.startChat({
        history: [],
    });
    return chatSession;
};

export const sendMessageToNova = async (message) => {
    if (!chatSession) initChat();
    if (!apiKey) {
        return "Please set your `VITE_GEMINI_API_KEY` in the `.env` file and restart the server.";
    }

    try {
        let result = await chatSession.sendMessage(message);
        const functionCalls = result.response.functionCalls();
        const call = functionCalls && functionCalls.length > 0 ? functionCalls[0] : null;

        // Check if the model decided to call the function
        if (call) {
            const apiFunction = functionsMap[call.name];
            const apiResult = await apiFunction(call.args.category, call.args.limit);

            // Return the result of the function back to the model
            result = await chatSession.sendMessage([{
                functionResponse: {
                    name: call.name,
                    response: apiResult
                }
            }]);
        }

        return result.response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Maaf, aku sedang mengalami kendala jaringan ke database saat ini. Mohon coba lagi nanti. (Error: " + error.message + ")";
    }
};
