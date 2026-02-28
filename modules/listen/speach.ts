interface ISpeakEnglishOptions {
    text: string;

}
export function speakEnglish(options: ISpeakEnglishOptions) {
    const { text } = options;

    if (!("speechSynthesis" in window)) {
        throw new Error("当前环境不支持 Web Speech API TTS");
    }

    // 避免叠音
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";      // 或 en-GB
    u.rate = 1.0;          // 0.1 ~ 10
    u.pitch = 1.0;         // 0 ~ 2
    u.volume = 1.0;        // 0 ~ 1

    // 可选：挑一个英文 voice（有些浏览器需要等 voiceschanged）
    const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const v =
            voices.find(v => v.lang?.startsWith("en") && /Google|Microsoft|Apple/i.test(v.name)) ||
            voices.find(v => v.lang?.startsWith("en")) ||
            null;
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
    };

    if (window.speechSynthesis.getVoices().length) pickVoice();
    else window.speechSynthesis.onvoiceschanged = pickVoice;
}