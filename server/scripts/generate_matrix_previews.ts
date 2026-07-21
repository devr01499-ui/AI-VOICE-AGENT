import 'dotenv/config';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ── Resolve output directory ──────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(projectRoot, 'Frontend', 'public', 'previews');

// ── API config ────────────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODEL = 'models/gemini-2.5-flash-native-audio-latest';
const API_VERSION = 'v1alpha';
const MIN_REAL_SIZE = 120000; // ~120KB minimum real speech size

// ── Voice & Language matrix ─────────────────────────────────────────────────
const MATRIX = [
  // US English (8 voices)
  { voiceId: 'Aoede', apiVoice: 'Aoede', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Charon', apiVoice: 'Charon', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Fenrir', apiVoice: 'Fenrir', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Leda', apiVoice: 'Leda', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Orus', apiVoice: 'Orus', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },
  { voiceId: 'Zephyr', apiVoice: 'Zephyr', langCode: 'en', text: 'Hello, how are you, glad to see you here. I hope I will be useful for you.' },

  // India Hindi (4 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'hi', text: 'नमस्ते, आप कैसे हैं? आपसे यहाँ मिलकर बहुत खुशी हुई। मुझे आशा है कि मैं आपके लिए उपयोगी रहूँगा।' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'hi', text: 'नमस्ते, आप कैसे हैं? आपसे यहाँ मिलकर बहुत खुशी हुई। मुझे आशा है कि मैं आपके लिए उपयोगी रहूँगा।' },
  { voiceId: 'Aoede', apiVoice: 'Aoede', langCode: 'hi', text: 'नमस्ते, आप कैसे हैं? आपसे यहाँ मिलकर बहुत खुशी हुई। मुझे आशा है कि मैं आपके लिए उपयोगी रहूँगा।' },
  { voiceId: 'Charon', apiVoice: 'Charon', langCode: 'hi', text: 'नमस्ते, आप कैसे हैं? आपसे यहाँ मिलकर बहुत खुशी हुई। मुझे आशा है कि मैं आपके लिए उपयोगी रहूँगा।' },

  // India Bengali (3 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'bn', text: 'হ্যালো, আপনি কেমন আছেন? এখানে আপনাকে দেখে খুব ভালো লাগলো। আশা করি আমি আপনার কাজে আসব।' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'bn', text: 'হ্যালো, আপনি কেমন আছেন? এখানে আপনাকে দেখে খুব ভালো লাগলো। আশা করি আমি আপনার কাজে আসব।' },
  { voiceId: 'Aoede', apiVoice: 'Aoede', langCode: 'bn', text: 'হ্যালো, আপনি কেমন আছেন? এখানে আপনাকে দেখে খুব ভালো লাগলো। আশা করি আমি আপনার কাজে আসব।' },

  // India Kannada (2 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'kn', text: 'ನಮಸ್ಕಾರ, ಹೇಗಿದ್ದೀರಾ? ನಿಮ್ಮನ್ನು ಇಲ್ಲಿ ನೋಡಿ ಸಂತೋಷವಾಯಿತು. ನಾನು ನಿಮಗೆ ಉಪಯುಕ್ತವಾಗಬಲ್ಲೆ ಎಂದು ಭಾವಿಸುತ್ತೇನೆ.' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'kn', text: 'ನಮಸ್ಕಾರ, ಹೇಗಿದ್ದೀರಾ? ನಿಮ್ಮನ್ನು ಇಲ್ಲಿ ನೋಡಿ ಸಂತೋಷವಾಯಿತು. ನಾನು ನಿಮಗೆ ಉಪಯುಕ್ತವಾಗಬಲ್ಲೆ ಎಂದು ಭಾವಿಸುತ್ತೇನೆ.' },

  // India Malayalam (2 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'ml', text: 'ഹലോ, സുഖമാണോ? നിങ്ങളെ ഇവിടെ കണ്ടതിൽ സന്തോഷം. ഞാൻ നിങ്ങൾക്ക് ഉപകാരപ്പെടുമെന്ന് പ്രതീക്ഷിക്കുന്നു.' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'ml', text: 'ഹലോ, സുഖമാണോ? നിങ്ങളെ ഇവിടെ കണ്ടതിൽ സന്തോഷം. ഞാൻ നിങ്ങൾക്ക് ഉപകാരപ്പെടുമെന്ന് പ്രതീക്ഷിക്കുന്നു.' },

  // India Gujarati (2 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'gu', text: 'નમસ્તે, તમે કેમ છો? તમને અહીં મળીને આનંદ થયો. મને આશા છે કે હું તમારા માટે ઉપયોગી થઈશ.' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'gu', text: 'નમસ્તે, તમે કેમ છો? તમને અહીં મળીને આનંદ થયો. મને આશા છે કે હું તમારા માટે ઉપયોગી થઈશ.' },

  // China Mandarin (4 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'zh', text: '您好，您怎么样？很高兴在这里见到您。希望我能对您有所帮助。' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'zh', text: '您好，您怎么样？很高兴在这里见到您。希望我能对您有所帮助。' },
  { voiceId: 'Aoede', apiVoice: 'Aoede', langCode: 'zh', text: '您好，您怎么样？很高兴在这里见到您。希望我能对您有所帮助。' },
  { voiceId: 'Charon', apiVoice: 'Charon', langCode: 'zh', text: '您好，您怎么样？很高兴在这里见到您。希望我能对您有所帮助。' },

  // UAE Arabic (4 voices)
  { voiceId: 'Kore', apiVoice: 'Kore', langCode: 'ar', text: 'مرحباً، كيف حالك؟ يسعدني رؤيتك هنا. أتمنى أن أكون مفيداً لك.' },
  { voiceId: 'Puck', apiVoice: 'Puck', langCode: 'ar', text: 'مرحباً، كيف حالك؟ يسعدني رؤيتك هنا. أتمنى أن أكون مفيداً لك.' },
  { voiceId: 'Aoede', apiVoice: 'Aoede', langCode: 'ar', text: 'مرحباً، كيف حالك؟ يسعدني رؤيتك هنا. أتمنى أن أكون مفيداً لك.' },
  { voiceId: 'Charon', apiVoice: 'Charon', langCode: 'ar', text: 'مرحباً، كيف حالك؟ يسعدني رؤيتك هنا. أتمنى أن أكون مفيداً لك.' },
];

/**
 * Writes a standard 44-byte WAV header for 24kHz 16-bit Mono PCM audio.
 */
function createWavHeader(dataLength: number, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(dataLength + 36, 4); // File size - 8
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(1, 22); // NumChannels (1 for Mono)
  header.writeUInt32LE(sampleRate, 24); // SampleRate (24000)
  header.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  header.writeUInt16LE(2, 32); // BlockAlign (NumChannels * BitsPerSample/8)
  header.writeUInt16LE(16, 34); // BitsPerSample (16)
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2Size (data length)
  return header;
}

function generateVoiceWS(voiceId: string, apiVoice: string, langCode: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const filename = `${voiceId.toLowerCase()}_${langCode}.wav`;
    const filepath = path.join(outputDir, filename);

    if (fs.existsSync(filepath) && fs.statSync(filepath).size >= MIN_REAL_SIZE) {
      console.log(`  [SKIP] ${voiceId}_${langCode} is already generated.`);
      return resolve();
    }

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${API_VERSION}.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(API_KEY)}`;
    const ws = new WebSocket(wsUrl);

    let setupCompleted = false;
    let audioChunks: Buffer[] = [];

    ws.on('open', () => {
      const setupMessage = {
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: apiVoice
                }
              }
            },
            temperature: 0.3
          },
          systemInstruction: {
            parts: [{ text: "You are a text-to-speech engine. Speak the user's text exactly as written, with no extra conversation, introductions, or commentary. Use the correct language for the response." }]
          }
        }
      };
      ws.send(JSON.stringify(setupMessage));
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());

        if (event.error) {
          ws.close();
          return reject(new Error(`Gemini API Error: ${event.error.message}`));
        }

        if (event.setupComplete) {
          setupCompleted = true;
          // Prompt model to speak
          const clientContent = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: `Speak this exact sentence in its native script and pronunciation: "${text}"` }]
                }
              ],
              turnComplete: true
            }
          };
          ws.send(JSON.stringify(clientContent));
          return;
        }

        if (event.serverContent?.modelTurn?.parts) {
          for (const part of event.serverContent.modelTurn.parts) {
            if (part.inlineData && part.inlineData.data) {
              const chunk = Buffer.from(part.inlineData.data, 'base64');
              audioChunks.push(chunk);
            }
          }
        }

        if (event.serverContent?.turnComplete) {
          ws.close();
        }
      } catch (err) {
        ws.close();
        reject(err);
      }
    });

    ws.on('close', () => {
      if (audioChunks.length === 0) {
        return reject(new Error("No audio data returned by Gemini."));
      }

      try {
        const pcmData = Buffer.concat(audioChunks);
        const header = createWavHeader(pcmData.length, 24000);
        const finalBuffer = Buffer.concat([header, pcmData]);

        fs.writeFileSync(filepath, finalBuffer);

        // Verify file integrity
        const verifyHeader = fs.readFileSync(filepath).subarray(0, 12);
        const riff = verifyHeader.subarray(0, 4).toString();
        const waveSig = verifyHeader.subarray(8, 12).toString();

        if (riff !== 'RIFF' || waveSig !== 'WAVE') {
          return reject(new Error(`WAV verification failed: RIFF=${riff}, WAVE=${waveSig}`));
        }

        console.log(`  [SUCCESS] Generated: ${filename} (${finalBuffer.length} bytes)`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log("\n==============================================================");
  console.log("  Gemini Live WebSocket Localized Matrix Preview Generator");
  console.log(`  Model  : ${MODEL}`);
  console.log(`  Output : ${outputDir}`);
  console.log(`  Total  : ${MATRIX.length} previews`);
  console.log("==============================================================\n");

  if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is not defined in the environment.");
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const failures: string[] = [];

  for (let i = 0; i < MATRIX.length; i++) {
    const item = MATRIX[i];
    console.log(`[${i + 1}/${MATRIX.length}] Generating ${item.voiceId}_${item.langCode}...`);
    try {
      await generateVoiceWS(item.voiceId, item.apiVoice, item.langCode, item.text);
      // Wait 1.5s to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err: any) {
      console.error(`  [FAIL] ${item.voiceId}_${item.langCode}: ${err.message}`);
      failures.push(`${item.voiceId}_${item.langCode}`);
    }
  }

  console.log("\n==============================================================");
  if (failures.length > 0) {
    console.log(`  Finished with failures: ${failures.join(', ')}`);
    process.exit(1);
  } else {
    console.log("  All localized preview matrices generated successfully and verified!");
    process.exit(0);
  }
}

main().catch(console.error);
