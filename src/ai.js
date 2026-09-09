let geminiHistory = [];

export const initChat = () => {
    geminiHistory = [];
};

export const sendMessageToNova = async (message) => {
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                history: geminiHistory,
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return data.error || "Maaf, server AI sedang tidak tersedia. Coba lagi nanti.";
        }

        if (Array.isArray(data.history)) {
            geminiHistory = data.history;
        }

        return data.reply || "Maaf, Nova tidak dapat membuat balasan saat ini.";
    } catch (error) {
        console.error("Chat API Error:", error);
        return "Maaf, tidak bisa terhubung ke server. Pastikan aplikasi sudah di-deploy dengan API route `/api/chat`.";
    }
};
