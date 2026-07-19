import 'dotenv/config';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as wave from 'wave'; // Note: Node wave modules can be tricky, let's write raw WAV headers manually!
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
const TEXT_TO_SPEAK = "Hello, how are you, glad to see you here. I hope I will be useful for you.";
const MIN_REAL_SIZE = 180000;

// ── Voice map: (SEED_NAME, API_NAME) ─────────────────────────────────────────
const VOICE_MAP: [string, string][] = [
  ["Aoede",       "Aoede"],
  ["Charon",      "Charon"],
  ["Fenrir",      "Fenrir"],
  ["Kore",        "Kore"],
  ["Leda",        "Leda"],
  ["Orus",        "Orus"],
  ["Puck",        "Puck"],
  ["Zephyr",      "Zephyr"],
  ["Callirhoe",   "Callirrhoe"],
  ["Autonoe",     "Autonoe"],
  ["Enceladus",   "Enceladus"],
  ["Iapetus",     "Iapetus"],
  ["Umbriel",     "Umbriel"],
  ["Algieba",     "Algieba"],
  ["Despina",     "Despina"],
  ["Erinome",     "Erinome"],
  ["Algenib",     "Algenib"],
  ["Rasalgethi",  "Rasalgethi"],
  ["Laomedeia",   "Laomedeia"],
  ["Achernar",    "Achernar"],
  ["Alnilam",     "Alnilam"],
  ["Schedar",     "Schedar"],
  ["Gacrux",      "Gacrux"],
  ["Pulcherrima", "Pulcherrima"],
  ["Achird",      "Achird"],
  ["Adara",       "Sadachbia"],
  ["Castor",      "Sadaltager"],
  ["Deneb",       "Vindemiatrix"],
  ["Eltanin",     "Sulafat"],
  ["Mizar",       "Zubenelgenubi"],
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

function generateVoiceWS(seedName: string, apiVoice: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const filename = `${seedName.lowerCase || seedName.toLowerCase()}.wav`;
    const filepath = path.join(outputDir, filename);

    if (fs.existsSync(filepath) && fs.statSync(filepath).size >= MIN_REAL_SIZE) {
      console.log(`  [SKIP] ${seedName} is already real TTS.`);
      return resolve();
    }

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${API_VERSION}.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(API_KEY)}`;
    const ws = new WebSocket(wsUrl);

    let setupCompleted = false;
    let audioChunks: Buffer[] = [];

    ws.on('open', () => {
      // Send handshake frame
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
            parts: [{ text: "You are a text-to-speech assistant. You MUST read the user's text exactly as written, with no extra commentary, preambles, or added words." }]
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
          // Send prompt to speak
          const clientContent = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: `Please speak this exact sentence: "${TEXT_TO_SPEAK}"` }]
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
        return reject(new Error("No audio returned by model"));
      }

      try {
        const pcmData = Buffer.concat(audioChunks);
        // Gemini Live WebSocket audio output is raw 24kHz 16-bit Little-Endian Mono PCM
        const header = createWavHeader(pcmData.length, 24000);
        const finalBuffer = Buffer.concat([header, pcmData]);
        
        fs.writeFileSync(filepath, finalBuffer);
        
        // Verify header
        const verifyHeader = fs.readFileSync(filepath, { encoding: null }).subarray(0, 12);
        const riff = verifyHeader.subarray(0, 4).toString();
        const waveSig = verifyHeader.subarray(8, 12).toString();
        
        if (riff !== 'RIFF' || waveSig !== 'WAVE') {
          return reject(new Error(`WAV verification failed: RIFF=${riff}, WAVE=${waveSig}`));
        }
        
        console.log(`  [PASS] ${seedName} generated: 24000Hz, ${pcmData.length} PCM bytes, size=${finalBuffer.length} bytes`);
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
  console.log("  Gemini Live WebSocket Batch TTS Preview Generator");
  console.log(`  Model  : ${MODEL}`);
  console.log(`  Text   : "${TEXT_TO_SPEAK}"`);
  console.log(`  Voices : ${VOICE_MAP.length}`);
  console.log("==============================================================\n");

  if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY is not defined in the environment.");
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const failures: string[] = [];

  for (let i = 0; i < VOICE_MAP.length; i++) {
    const [seedName, apiVoice] = VOICE_MAP[i];
    console.log(`[${i + 1}/${VOICE_MAP.length}] Generating ${seedName}...`);
    try {
      await generateVoiceWS(seedName, apiVoice);
      // Wait 1.5s to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (err: any) {
      console.error(`  [FAIL] ${seedName}: ${err.message}`);
      failures.push(seedName);
    }
  }

  console.log("\n==============================================================");
  if (failures.length > 0) {
    console.log(`  Finished with failures: ${failures.join(', ')}`);
    process.exit(1);
  } else {
    console.log("  All voice previews generated successfully and verified!");
    process.exit(0);
  }
}

main().catch(console.error);
