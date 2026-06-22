/**
 * Gemini API Client Service for BGI Content Studio
 */

const DEFAULT_MODEL = 'gemma-4-31b-it';

let requestTimestamps = []; // In-memory sliding window of request timestamps

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function enforceRateLimits() {
  const now = Date.now();
  // Filter timestamps in the last 60 seconds
  requestTimestamps = requestTimestamps.filter(t => now - t < 60000);

  // Enforce RPD (Requests Per Day) - Limit 1500
  const todayStr = new Date().toISOString().split('T')[0];
  let rpdData = { date: todayStr, count: 0 };
  const savedRpd = localStorage.getItem('bgi_rpd_tracker');
  if (savedRpd) {
    try {
      const parsed = JSON.parse(savedRpd);
      if (parsed.date === todayStr) {
        rpdData = parsed;
      }
    } catch (e) {}
  }

  if (rpdData.count >= 1500) {
    throw new Error('Limit harian tercapai! Anda telah mencapai batas kuota 1500 request hari ini.');
  }

  // Enforce RPM (Requests Per Minute) - Limit 15 RPM
  if (requestTimestamps.length >= 15) {
    const oldestTimestamp = requestTimestamps[0];
    const timeToWait = 60000 - (now - oldestTimestamp) + 200; // wait until the oldest falls out of the window
    if (timeToWait > 0) {
      console.warn(`Rate limit reached (15 RPM). Auto-waiting for ${Math.round(timeToWait / 1000)}s...`);
      await sleep(timeToWait);
      return enforceRateLimits(); // check recursively after wait
    }
  }

  // Update RPD count
  rpdData.count += 1;
  localStorage.setItem('bgi_rpd_tracker', JSON.stringify(rpdData));

  // Add current timestamp
  requestTimestamps.push(Date.now());
}

/**
 * Robustly parse JSON from AI response, ignoring intro/outro conversational text
 */
function parseJsonResponse(responseText) {
  let cleanText = responseText.trim();
  
  // Strip <thought>...</thought> blocks (Gemma 4 thinking output)
  cleanText = cleanText.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  // Also strip <think>...</think> blocks
  cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  
  // Try direct parsing
  try {
    return JSON.parse(cleanText);
  } catch (e) {}

  // Try removing markdown blocks if they exist
  let stripped = cleanText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    return JSON.parse(stripped);
  } catch (e) {}

  // Extract JSON array block [...]
  const arrayStart = cleanText.indexOf('[');
  const arrayEnd = cleanText.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    const candidate = cleanText.substring(arrayStart, arrayEnd + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {}
  }

  // Extract JSON object block {...} and wrap/extract list
  const objStart = cleanText.indexOf('{');
  const objEnd = cleanText.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    const candidate = cleanText.substring(objStart, objEnd + 1);
    try {
      const parsedObj = JSON.parse(candidate);
      if (Array.isArray(parsedObj)) {
        return parsedObj;
      }
      for (const key in parsedObj) {
        if (Array.isArray(parsedObj[key])) {
          return parsedObj[key];
        }
      }
      return [parsedObj];
    } catch (e) {}
  }

  throw new Error("Respon dari AI tidak mengandung format JSON yang dapat diproses.");
}

/**
 * Call the Gemini API directly via fetch
 */
export async function generateWithGemini(prompt, systemInstruction = '') {
  const apiKey = localStorage.getItem('bgi_gemini_api_key');
  const model = localStorage.getItem('bgi_gemini_model') || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('API Key Gemini belum diatur. Silakan pergi ke menu Pengaturan untuk mengisinya.');
  }

  // Enforce rate limit check before hitting the API
  await enforceRateLimits();

  const url = `https://generativelanguage.googleapis.com/v1beta/chat/completions`;

  const messages = [];
  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: systemInstruction
    });
  }
  messages.push({
    role: 'user',
    content: prompt
  });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 16384
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;
    
    if (!generatedText) {
      throw new Error('Tidak ada respon teks dari API chat completion.');
    }

    return generatedText;
  } catch (error) {
    console.error('Gemini API Chat Completion Error:', error);
    throw error;
  }
}

export async function generateContentPillars({ niche, specificNiche, superSpecificNiche, positioning, archetype, toneOfVoice, communicationDesc, targetAudience, segmentations }) {
  const systemInstruction = `Anda adalah konsultan strategi brand dan konten top. Tugas Anda adalah membantu pembuat konten mendefinisikan "Content Pillars" (pilar konten) yang strategis berdasarkan identitas brand mereka.

PENTING: Respon HARUS berupa JSON array murni tanpa teks penjelasan apapun sebelum atau sesudah JSON. Jangan gunakan markdown code block. Langsung keluarkan JSON array.

Contoh format output yang WAJIB diikuti:
[{"name": "Educational & Career Insight", "description": "Topik: Wawasan kampus, karier, CV, interview, LinkedIn, dan realita dunia kerja.\\nSub-topik: kesalahan umum mahasiswa, cara bikin profil lebih standout, career prep.\\nKenapa penting: Audiens butuh insight yang praktis dan relevan buat masa depan.\\nManfaat audiens: Lebih paham langkah strategis untuk bangun portofolio dan karier.\\nInteraksi: Saveable tips, Q&A, dan diskusi pengalaman.\\nFormat: Carousel checklist, reels edukasi, post insight."}]

Perhatikan format description di atas: setiap description WAJIB memiliki 6 baris terstruktur dengan label "Topik:", "Sub-topik:", "Kenapa penting:", "Manfaat audiens:", "Interaksi:", dan "Format:". Pisahkan setiap baris dengan \\n (newline).`;

  const prompt = `
Saya adalah seorang dengan niche utama '${niche}', spesifik kategori '${specificNiche}', dan super spesifik '${superSpecificNiche}', yang ingin dikenal sebagai '${positioning}'.

Saya memiliki Tone of Voice: '${toneOfVoice}', Brand Archetype: '${archetype}', dan Deskripsi Gaya Komunikasi: '${communicationDesc}'.

Target audiens saya adalah: '${targetAudience}', dengan segmentasi audiens: '${segmentations}'.

Berdasarkan informasi di atas dan dengan menerapkan framework STP (Segmenting, Targeting, Positioning), buatkan **7 sampai 10** Content Pilar yang lengkap, relevan, dan strategis untuk akun media sosial saya.

Syarat pilar:
1. Wajib mencakup 5 pilar inti: Educational (Edukasi), Entertain (Hiburan), Social Proof (Bukti Sosial), Personal Story (Cerita Pribadi), dan Promotional (Promosi) â€” disesuaikan dengan niche saya.
2. Tambahkan 2-5 pilar tambahan yang unik dan membedakan saya dari kreator lain.
3. Setiap pilar harus punya sub-topik turunan yang spesifik dan bisa langsung jadi ide konten.

Untuk setiap pilar, kolom "description" WAJIB mengikuti format terstruktur ini (6 baris, pisahkan dengan newline \\n):
- Topik: [topik utama pilar ini]
- Sub-topik: [sub-topik spesifik turunan]
- Kenapa penting: [alasan pilar ini penting untuk membangun otoritas]
- Manfaat audiens: [bagaimana ini membantu audiens]
- Interaksi: [cara pilar ini mendorong engagement dan komunitas]
- Format: [format konten yang cocok, misal: carousel, reels, thread, dll]

âœ” Relevan dengan tren industri di bidang '${niche}'.
âœ” Membantu membangun personal branding yang kuat.
âœ” Mendukung tujuan monetisasi (kelas/webinar) dan membangun komunitas.

PENTING: Keluarkan HANYA JSON array valid, tanpa teks apapun sebelum atau sesudah JSON. Kolom: 'name' (nama pilar) dan 'description' (deskripsi terstruktur 6 baris seperti contoh di atas).
`;

  const responseText = await generateWithGemini(prompt, systemInstruction);
  
  try {
    return parseJsonResponse(responseText);
  } catch (e) {
    console.warn("Failed to parse JSON, falling back to custom parsing:", responseText, e);
    return [
      { name: "Opportunity Content (Informasi)", description: "Topik: Update peluang beasiswa, lomba, event, exchange, volunteer, internship, bootcamp, dan program pengembangan diri.\nSub-topik: beasiswa dalam negeri & luar negeri, lomba nasional/internasional, volunteer & exchange program.\nKenapa penting: Audiens butuh sumber peluang yang terkurasi dan terpercaya.\nManfaat audiens: Hemat waktu cari info, langsung dapat peluang yang relevan.\nInteraksi: Save, share ke teman, tag teman di kolom komentar.\nFormat: Carousel info, reels pengumuman, single post deadline." },
      { name: "Self Development (Leadership & Growth)", description: "Topik: Leadership, mindset, public speaking, networking, discipline, productivity, dan soft skills.\nSub-topik: tips produktivitas, cara membangun kebiasaan baik, networking efektif.\nKenapa penting: Audiens ingin berkembang dan jadi versi terbaik dirinya.\nManfaat audiens: Punya framework jelas untuk self-improvement.\nInteraksi: Diskusi di kolom komentar, polling, challenge mingguan.\nFormat: Carousel tips, reels motivasi, thread storytelling." },
      { name: "Educational & Career Insight", description: "Topik: Wawasan kampus, karier, CV, interview, LinkedIn, dan realita dunia kerja.\nSub-topik: kesalahan umum mahasiswa, cara bikin profil lebih standout, career prep.\nKenapa penting: Audiens butuh insight yang praktis dan relevan buat masa depan.\nManfaat audiens: Lebih paham langkah strategis untuk bangun portofolio dan karier.\nInteraksi: Saveable tips, Q&A, dan diskusi pengalaman.\nFormat: Carousel checklist, reels edukasi, post insight." },
      { name: "Achievement & Ambition Lifestyle", description: "Topik: Gaya hidup anak muda ambis, aktif, berkembang, dan punya value.\nSub-topik: rutinitas produktif, behind the scene kompetisi, day in my life.\nKenapa penting: Membangun koneksi emosional dan aspirasi audiens.\nManfaat audiens: Terinspirasi untuk take action dan upgrade diri.\nInteraksi: Relate di komentar, share ke story, tag teman.\nFormat: Reels vlog, carousel before-after, single post refleksi." },
      { name: "Success Stories & Community Proof", description: "Topik: Kisah sukses, testimoni, dan perjalanan anak muda yang berkembang lewat peluang.\nSub-topik: alumni yang lolos beasiswa, pemenang lomba, transformasi karier.\nKenapa penting: Bukti sosial membangun kepercayaan dan otoritas.\nManfaat audiens: Yakin bahwa mereka juga bisa mencapai hal serupa.\nInteraksi: Tag orang yang diceritakan, diskusi tips di komentar.\nFormat: Carousel storytelling, reels interview singkat, thread perjalanan." }
    ];
  }
}

/**
 * Generate a list of Content Ideas based on a Content Pillar
 */
export async function generateContentIdeas({ pillarName, pillarDesc, brandProfile, count = 10 }) {
  const systemInstruction = `Anda adalah Creative Director dan Content Creator top. Tugas Anda adalah menghasilkan daftar ide konten sosial media yang segar, viral, dan strategis. Respon harus dalam format JSON murni, berupa list array objek yang valid tanpa markdown code block.

Format JSON yang wajib Anda hasilkan adalah array of objects dengan struktur kunci (keys) berikut:
[
  {
    "title": "Ide (Topik Konten)",
    "pillar": "Nama Pilar",
    "format": "Format Ideal",
    "platform": "Platform Ideal",
    "valueAdd": "Nilai Tambah",
    "storytelling": "Storytelling",
    "brief": "Gambaran Singkat Ide"
  }
]`;

  const prompt = `
Sebagai seorang dengan niche utama '${brandProfile.niche}', spesifik kategori '${brandProfile.specificNiche}', dan super spesifik '${brandProfile.superSpecificNiche}', yang ingin dikenal sebagai '${brandProfile.positioning}'.

Saya memiliki Tone of Voice: '${brandProfile.toneOfVoice}', Brand Archetype: '${brandProfile.archetype}', dan Deskripsi Gaya Komunikasi: '${brandProfile.communicationDesc}'.

Target audiens saya adalah: '${brandProfile.targetAudience}', dengan segmentasi audiens: '${brandProfile.segmentations}'.

Mohon buatkan daftar ide konten yang lengkap, kreatif, dan strategis untuk akun media sosial saya. Fokus utama dari ide konten ini adalah pilar '${pillarName}' (${pillarDesc}).

Aku ingin daftar ide konten ini mencakup:
- Ide-ide spesifik yang bisa langsung dieksekusi, yang relevan dengan tren terkini dan membedakan saya dari kompetitor.
- Sudut pandang yang fresh dan unik.
- Gambaran singkat tentang kontennya, potensi viral, dan insight mengapa ide ini kuat.

Pastikan outputnya:
âœ” Berikan sebanyak ${count} pilihan ide, agar bisa dipilih sesuai kebutuhan.
âœ” Kreatif, menarik, inovatif, dan punya potensi viral sesuai tren terkini.
âœ” Bisa dikembangkan menjadi strategi konten jangka panjang.
âœ” Sangat relevan dengan target audiens saya (${brandProfile.targetAudience}, khusus ${brandProfile.segmentations}) dan membantu mereka menyelesaikan masalah atau mencapai tujuan mereka.
âœ” Membantuku membangun personal branding yang kuat dan sustainable, sesuai dengan Positioning saya sebagai '${brandProfile.positioning}'.

Kembalikan hasilnya HANYA berupa JSON array valid (tanpa penjelasan pembuka/penutup, dan tanpa code block markdown). Setiap item objek di dalam array harus memiliki kunci berikut:
1. "title": Ide (Topik Konten) yang sangat memikat (Clickable & Relatable).
2. "pillar": '${pillarName}'
3. "format": Format Ideal (pilih salah satu dari: Reels, Carousel, Single Image, Text Threads/X, Video Panjang, Video Pendek, Video Voice Over, Video Reaction, Video Multitasking, Faceless, Video Talking Head, Carousel QnA, Carousel Reaction, Carousel Step by Step, Carousel Study Case, Visual Proof/Demo).
4. "platform": Platform Ideal (pilih salah satu dari: Instagram, TikTok, Threads/X, YouTube, LinkedIn).
5. "valueAdd": Nilai Tambah (pilih salah satu dari: Edukasi/Wawasan, Solusi, Inspirasi/Motivasi, Hiburan, Validasi/Bukti, Perspektif Baru, Informasi, Komunitas, Conversion/Jualan).
6. "storytelling": Storytelling (pilih salah satu dari: Karakter + Tujuan + Halangan, Karakter + Tujuan + Halangan + Brand as A Hero, Karakter + Tujuan + Halangan + Produk as A Hero, Karakter + Tujuan + Halangan + Kamu as A Hero, Karakter (audienceku) + Tujuan + Halangan, Karakter (Orang lain) + Tujuan + Halangan + Produk as A Hero, Zero to Hero, The Hero's Journey, Problem-Solution, Before-After, Case Study/Testimonial, The Why Story, In Media Res, False Star, The 'Aha' Moment, The Underdog).
7. "brief": Gambaran Singkat Ide (Penjelasan singkat 1-2 kalimat tentang apa isi konten ini dan mengapa audiens akan peduli).
`;

  const responseText = await generateWithGemini(prompt, systemInstruction);
  try {
    return parseJsonResponse(responseText);
  } catch (e) {
    console.warn("Failed to parse JSON for ideas, falling back:", responseText, e);
    return [];
  }
}

/**
 * Parse Markdown script output from AI into structured fields
 */
function parseMarkdownScript(markdown) {
  const result = {
    draftScript: '',
    cta: '',
    visualSuggestions: '',
    fullCaption: ''
  };

  if (!markdown) return result;

  // Clean the text by removing think/thought tags
  let cleanText = markdown;
  cleanText = cleanText.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Define section keywords to look for in the markdown headers
  const sections = [
    { keys: ['hasil draft script', 'draft script', 'naskah'], target: 'draftScript' },
    { keys: ['call to action', 'cta', 'pilihan cta'], target: 'cta' },
    { keys: ['saran visual', 'visual suggestions', 'visual'], target: 'visualSuggestions' },
    { keys: ['full caption', 'caption'], target: 'fullCaption' }
  ];

  const lines = cleanText.split('\n');
  let currentSection = 'draftScript'; // start with draftScript by default
  const buffers = {
    draftScript: [],
    cta: [],
    visualSuggestions: [],
    fullCaption: []
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a markdown header
    if (trimmed.startsWith('#')) {
      const headerText = trimmed.replace(/^#+\s*/, '').toLowerCase();
      
      let matched = false;
      for (const sec of sections) {
        if (sec.keys.some(k => headerText.includes(k))) {
          currentSection = sec.target;
          matched = true;
          break;
        }
      }
      // If a header doesn't match any of our main sections, we append it to the current active section buffer
      if (!matched) {
        buffers[currentSection].push(line);
      }
    } else {
      buffers[currentSection].push(line);
    }
  }

  // Join the buffers
  result.draftScript = buffers.draftScript.join('\n').trim();
  result.cta = buffers.cta.join('\n').trim();
  result.visualSuggestions = buffers.visualSuggestions.join('\n').trim();
  result.fullCaption = buffers.fullCaption.join('\n').trim();

  // Fallback to returning the whole response as draftScript if nothing was parsed
  if (!result.draftScript && !result.cta && !result.visualSuggestions && !result.fullCaption) {
    result.draftScript = cleanText.trim();
  }

  return result;
}

/**
 * Generate a detailed script from a content idea brief
 */
export async function generateScript({ title, pillar, platform, format, valueAdd, storytelling, brief, brandProfile }) {
  const systemInstruction = `Anda adalah Naskah Writer dan Content Strategist professional. Tugas Anda adalah menulis draf naskah konten media sosial yang sangat powerful, kreatif, dan siap pakai sesuai identitas brand.`;

  const prompt = `
Sebagai seorang top konten kreator dengan niche utama '${brandProfile.niche}', spesifik kategori '${brandProfile.specificNiche}', dan super spesifik '${brandProfile.superSpecificNiche}', yang dikenal sebagai '${brandProfile.positioning}'.
Saya memiliki Tone of Voice: '${brandProfile.toneOfVoice}', Brand Archetype: '${brandProfile.archetype}', dan Deskripsi Gaya Komunikasi: '${brandProfile.communicationDesc}'.
Target audiens saya adalah: '${brandProfile.targetAudience}', dengan segmentasi audiens: '${brandProfile.segmentations}'.

Mohon buatkan script konten yang **sangat powerful, menarik, inovatif, dan siap pakai** dengan judul ide '${title}'.
Konten ini memiliki pilar '${pillar}', nilai tambah utama '${valueAdd}', dan akan menggunakan storytelling framework '${storytelling}'.
Gambaran singkat ide kontennya adalah: '${brief}'.
Konten ini akan diunggah di platform '${platform}' dengan format '${format}'.

Script harus mencakup:
1. Ide visual konten yang kreatif dan sangat detail, termasuk saran untuk setiap panel (jika carousel) atau scene (jika video), dan elemen visual penunjang untuk format yang dipilih.
2. Script hook yang sangat kuat, memancing rasa penasaran, relevan dengan audiens, dan selaras dengan storytelling framework.
3. Isi konten utama yang informatif, engaging, memecahkan masalah audiens secara langsung, dan secara subtil menonjolkan keunikan saya sebagai '${brandProfile.positioning}'. Sesuaikan dengan gaya komunikasi saya, dengan fokus pada nilai tambah '${valueAdd}'.
4. Call-to-Action (CTA) yang bervariatif, jelas, dan mendorong interaksi atau langkah selanjutnya (misalnya: follow, komen, share, save, kunjungi link di bio, daftar webinar, beli produk).
5. Caption lengkap yang meliputi framework copywriting (Headline yang menarik, Bodycopy yang persuasif, dan CTA lagi di dalamnya), serta hashtag yang relevan dan trending.

**Penting:** Kembangkan naskah menjadi draf yang paling detail dan komprehensif, seolah-olah siap digunakan untuk produksi, dengan semua elemen visual dan naratif yang sangat jelas.

Sajikan hasilnya dalam format Markdown yang rapi dengan struktur berikut:

# HASIL DRAFT SCRIPT & VISUAL
[Tulis di sini draf naskah lengkapnya, detail per panel/scene, dialog/lisan, visual cues, sound cues, dan hook-nya]

# CALL TO ACTION (CTA)
[Tulis daftar pilihan CTA utama dan alternatifnya]

# SARAN VISUAL
[Detail ide visual pendukung, tema warna, asset, dll.]

# FULL CAPTION
[Headline, Body Copy, CTA, Hashtags]
`;

  const responseText = await generateWithGemini(prompt, systemInstruction);
  console.log("Raw script response from Gemini:", responseText);
  const parsed = parseMarkdownScript(responseText);
  console.log("Parsed script components:", parsed);
  return parsed;
}

/**
 * Generate hooks based on script or topic
 */
export async function generateHooks({ topic, script, hookType, hookDescription, hookFormula, emotionWord, brandProfile }) {
  const systemInstruction = `Anda adalah pakar Hook Konten Media Sosial yang legendaris. Anda tahu cara menghentikan jempol audiens dari scrolling dalam 2 detik pertama.`;

  const prompt = `Sebagai seorang pembuat konten, saya ingin membuat text hook yang sangat menarik untuk konten saya.

Berikut detail kontennya:
- Topik Konten: ${topic}
- Script Konten Saat Ini: ${script}
- Jenis Hook: ${hookType} (${hookDescription})
- Rumus Hook: ${hookFormula}
- Kata Emosi yang ingin dibangkitkan: ${emotionWord}

Mohon buatkan 5 pilihan text hook yang sangat powerful, menarik, inovatif, dan siap pakai, yang sesuai dengan detail di atas.
Pastikan hook tersebut relevan dengan topik, selaras dengan script yang ada, mengikuti jenis dan rumus hook yang ditentukan, serta mampu membangkitkan emosi ${emotionWord}.
Berikan pilihan yang bervariasi dan siap digunakan.`;

  return await generateWithGemini(prompt, systemInstruction);
}

/**
 * Generate captions based on script, platform, tone, and CTA
 */
export async function generateCaption({ topic, script, platform, tone, ctaType, captionFormula, format, brandProfile }) {
  const systemInstruction = `Anda adalah Social Media Copywriter and Strategist senior. Anda menulis caption media sosial yang mengundang interaksi tinggi, rapi, dan memiliki struktur CTA yang jelas.`;

  const prompt = `
Buatlah caption postingan yang dioptimasi untuk platform berikut:
- Platform: ${platform}
- Topik Konten: "${topic}"
- Draf Naskah:
"""
${script}
"""

Detail Konfigurasi:
- Gaya Bahasa (Tone): ${tone}
- Jenis Call to Action (CTA): ${ctaType}
- Rumus Struktur Caption: ${captionFormula} (misal: Hook - Value - CTA, atau Storytelling - Solution - CTA)
- Format Panjang Caption: ${format} (Short/Long)
- Profil Brand Tone: ${brandProfile.toneOfVoice}

Panduan Penulisan:
1. Sisipkan baris kosong (spacing) agar caption mudah dibaca dan tidak menumpuk.
2. Gunakan emoji secara proporsional dan relevan untuk estetika visual.
3. Sesuaikan gaya bahasa: gunakan istilah yang ramah dan tren di kalangan target audiens (${brandProfile.targetAudience}).
4. Sertakan 5-8 hashtag populer dan tertarget di bagian akhir yang relevan dengan topik ini.
5. Jalankan formula CTA dengan alami agar audiens terdorong bertindak (misal: isi kolom komentar, save postingan, share ke story, atau klik link di bio).
`;

  return await generateWithGemini(prompt, systemInstruction);
}

/**
 * Generate complete brand strategy profile from a single primary niche
 */
export async function generateBrandProfile({ niche }) {
  const systemInstruction = `Anda adalah konsultan strategi brand & pemasaran senior. Tugas Anda adalah membantu pembuat konten melengkapi profil strategis brand secara otomatis berdasarkan Niche Utama yang mereka masukkan.
Respon HARUS berupa JSON objek murni tanpa teks penjelasan apapun sebelum atau sesudah JSON, dan tanpa code block markdown. Langsung keluarkan JSON objek.

Contoh format output:
{
  "specificNiche": "Spesifik kategori...",
  "superSpecificNiche": "Super spesifik kategori...",
  "positioning": "Sumber inspirasi...",
  "archetype": "The Everyman",
  "toneOfVoice": "Friendly",
  "communicationDesc": "Informatif, suportif...",
  "targetAudience": "Pelajar SMA...",
  "segmentations": "Scholarship hunter..."
}`;

  const prompt = `
Berdasarkan Niche Utama berikut:
"${niche}"

Lengkapi seluruh profil strategis brand dengan kriteria sebagai berikut:
1. "specificNiche": Kategori spesifik dari niche tersebut.
2. "superSpecificNiche": Sub-kategori yang sangat spesifik (niche terkecil yang bisa dikuasai).
3. "positioning": Bagaimana brand ingin dikenal oleh audiens.
4. "archetype": Brand archetype yang paling cocok. PILIH SALAH SATU DARI: 'The Creator', 'The Ruler', 'The Hero', 'The Caregiver', 'The Explorer', 'The Innocent', 'The Rebel', 'The Lover', 'The Magician', 'The Everyman', 'The Sage', 'The Jester'.
5. "toneOfVoice": Gaya bicara. PILIH SALAH SATU DARI: 'Friendly', 'Professional', 'Confident', 'Playful', 'Calm', 'Fun & Energetic', 'Elegant', 'Warm', 'Bold', 'Empathetic', 'Inspirational', 'Witty', 'Serious'.
6. "communicationDesc": Deskripsi lengkap gaya komunikasi brand (informatif, to the point, bersahabat, langkah demi langkah, dll.).
7. "targetAudience": Target audiens utama (demografis dan psikografis secara singkat).
8. "segmentations": Segmentasi audiens spesifik (misal: opportunity seeker, fresh graduate, dll.).
`;

  const responseText = await generateWithGemini(prompt, systemInstruction);
  return parseJsonResponse(responseText);
}

/**
 * Generate image prompts from full content context (hooks, script, caption, idea)
 * One prompt per carousel slide / visual scene
 */
export async function generateImagePrompts({ 
  hookText, 
  scriptText = '', 
  captionText = '', 
  ideaTitle = '', 
  platform = 'Instagram', 
  format = 'Carousel',
  slideCount = 5, 
  brandProfile 
}) {
  const systemInstruction = `Anda adalah AI Image Prompt Engineer dan Content Visual Director ahli untuk konten media sosial. 

Tugas Anda adalah menganalisis SELURUH konteks konten (hook, script naskah, caption, judul ide, platform, format) dan menghasilkan ${slideCount} prompt gambar yang SANGAT DETAIL, SPESIFIK, dan SALING TERKAIT satu sama lain untuk membentuk satu rangkaian visual carousel yang utuh.

PEDOMAN PROMPT ENGINEERING:
1. Setiap prompt harus menggambarkan SATU SLIDE/SCENE yang spesifik — seolah-olah Anda adalah sutradara yang memberi arahan ke ilustrator/desainer.
2. Sertakan detail: komposisi layout, palet warna dominan, tipografi/teks yang muncul, props/objek, ekspresi karakter, angle/perspektif, pencahayaan, dan mood.
3. Pastikan ada ALUR VISUAL yang jelas dari Slide 1 hingga Slide ${slideCount}: pembuka (hook visual) → isi (edukasi/value) → penutup (CTA).
4. Prompt harus dalam bahasa INGGRIS (Gemini image generator bekerja optimal dengan English prompts).
5. JANGAN gunakan teks Indonesia dalam prompt — hanya bahasa Inggris.
6. Gaya visual harus KONSISTEN di semua slide (pilih SALAH SATU gaya yang paling cocok dengan konten).

PENTING: Respon HARUS berupa JSON array murni tanpa teks penjelasan. Langsung keluarkan JSON array.

Contoh format output:
[{"slide": 1, "hook": "ringkasan hook", "visualStyle": "flat illustration", "prompt": "[deskripsi scene sangat detail dalam bahasa Inggris]"}, {"slide": 2, "hook": "...", "visualStyle": "flat illustration", "prompt": "..."}]

GAYA VISUAL yang bisa dipilih (pilih 1 yang paling KONSISTEN untuk semua slide):
- Flat Illustration: Ilustrasi 2D datar dengan warna-warna solid, modern, cocok untuk edukasi
- Modern Minimalist: Desain minimalis dengan ruang negatif luas, tipografi besar, warna monokrom
- Photographic/Realistic: Gaya foto realistis dengan pencahayaan natural, depth of field
- Infographic Style: Diagram, ikon, grafik, data visual dengan layout terstruktur
- 3D Isometric: Ilustrasi 3D isometrik dengan perspektif miring, modern dan playful
- Watercolor/Artistic: Gaya cat air atau sketsa tangan artistik, warm dan emosional
- Neon/Dark Mode: Latar gelap dengan aksen neon, cocok untuk konten modern/tech
- Pastel Soft: Palet pastel lembut, cocok untuk konten lifestyle/wellness`;

  const prompt = `
Saya akan membuat KONTEN MEDIA SOSIAL dengan detail berikut:

---
📌 JUDUL IDE KONTEN:
${ideaTitle || '(Tidak ada judul)'}

📱 PLATFORM & FORMAT:
- Platform: ${platform}
- Format: ${format}
- Jumlah Slide/Gambar yang Dibutuhkan: ${slideCount}

---
🎯 TEKS HOOK (Pembuka Konten):
"""
${hookText || '(Tidak ada hook)'}
"""

---
📝 DRAF NASKAH SCRIPT:
"""
${scriptText || '(Tidak ada script)'}
"""

---
💬 CAPTION POSTINGAN:
"""
${captionText || '(Tidak ada caption)'}
"""

---
🏷️ BRAND CONTEXT:
- Niche: ${brandProfile?.niche || 'Umum'}
- Positioning: ${brandProfile?.positioning || ''}
- Target Audiens: ${brandProfile?.targetAudience || 'Umum'}
- Tone of Voice: ${brandProfile?.toneOfVoice || 'Friendly'}
- Segmentasi: ${brandProfile?.segmentations || ''}

---

TUGAS ANDA:

Analisis SELURUH konteks di atas secara mendalam. Pahami:
- Apa pesan utama konten ini?
- Siapa target audiensnya?
- Bagaimana alur storytellling dari hook → isi → CTA?
- Poin-poin edukasi/value apa yang harus divisualisasikan?

Kemudian buatkan **${slideCount} prompt gambar** yang membentuk SATU KESATUAN RANGKAIAN CAROUSEL/VISUAL yang utuh dengan alur:

📐 STRUKTUR SLIDE YANG DIREKOMENDASIKAN:
1. **Slide 1 (Hook Visual)**: Tangkap perhatian — visual yang kuat, provokatif, atau emosional sesuai hook. Sertakan teks hook sebagai overlay.
2. **Slide 2 hingga ${slideCount-1} (Isi/Edukasi)**: Visualisasikan poin-poin utama dari script/naskah. Buat setiap slide informatif dengan teks pendukung.
3. **Slide ${slideCount} (CTA/Penutup)**: Call to action visual — ajak audiens untuk like, komen, share, atau klik link di bio.

UNTUK SETIAP PROMPT, sertakan detail berikut:
- 🎨 **Gaya visual** (konsisten untuk semua slide)
- 👤 **Karakter** (deskripsi fisik, ekspresi wajah, usia, pakaian, pose)
- 🎬 **Aksi** (apa yang dilakukan karakter atau elemen utama)
- 📍 **Latar/Lokasi** (setting, background, lingkungan)
- 💡 **Pencahayaan & Mood** (warna dominan, atmosfer, pencahayaan)
- 📝 **Teks Overlay** (teks yang muncul di gambar — TULISKAN SECARA LENGKAP dalam bahasa Indonesia sesuai konteks)
- 🖼️ **Komposisi** (layout, angle, perspektif, rule of thirds)
- 🎯 **Fokus Emosi** (emosi apa yang ingin dibangkitkan: surprise, trust, curiosity, dll)

Kembalikan HANYA JSON array valid dengan format:
[
  {
    "slide": 1,
    "hook": "Ringkasan hook yang menjadi inspirasi slide ini",
    "visualStyle": "[pilih 1 gaya yang sama untuk semua slide]",
    "prompt": "[PROMPT BAHASA INGGRIS sangat detail — minimal 50 kata — mencakup semua elemen visual, karakter, latar, pencahayaan, teks overlay, komposisi, dan mood]"
  },
  ...
]

PASTIKAN:
✓ Prompt dalam bahasa INGGRIS
✓ Minimal 50 kata per prompt
✓ Sangat detail dan spesifik (bukan generik)
✓ Gaya visual konsisten di semua slide
✓ Ada alur naratif visual yang jelas dari slide 1 ke slide ${slideCount}
✓ Teks overlay ditulis LENGKAP dalam bahasa Indonesia
✓ Sesuai dengan tone of voice brand (${brandProfile?.toneOfVoice || 'Friendly'})`;

  const responseText = await generateWithGemini(prompt, systemInstruction);
  try {
    return parseJsonResponse(responseText);
  } catch (e) {
    console.warn('Failed to parse image prompts JSON:', responseText, e);
    return [];
  }
}

/**
 * Scrape Instagram account info & determine primary niche.
 * 
 * Strategi (berurutan):
 * 1. Gunakan backend Playwright scraper (/api/scrape-instagram) - REAL DATA
 * 2. Jika user tempel HTML, gunakan Gemini untuk parse HTML -> ekstrak caption
 * 3. Last resort: Simulasi AI berdasarkan username (isSimulated: true)
 */
export async function scrapeInstagramAndDetermineNiche({ username, htmlContent = '' }) {
  const normalizedUsername = username.trim().toLowerCase().replace('@', '');

  // =====================================================
  // STRATEGI 1: Backend Playwright Scraper (Real Data!)
  // =====================================================
  if (!htmlContent || htmlContent.trim().length < 100) {
    try {
      console.log(`[Gemini] Mencoba backend scraper untuk @${normalizedUsername}...`);
      const response = await fetch(`/api/scrape-instagram?username=${encodeURIComponent(normalizedUsername)}`);
      
      if (response.ok) {
        const scraperData = await response.json();
        
        if (scraperData.success && scraperData.captions && scraperData.captions.length > 0) {
          console.log(`[Gemini] Backend scraper berhasil! ${scraperData.captions.length} caption ditemukan.`);
          
          // Gunakan Gemini untuk menganalisis caption yang sudah di-scrape dan tentukan niche
          const systemInstruction = `Anda adalah AI Brand Analyst. Analisis caption-caption Instagram berikut dan tentukan Niche Utama dari akun ini.
Respon HARUS berupa JSON objek murni tanpa teks penjelasan, tanpa code block markdown.`;
          
          const captionsText = scraperData.captions.map((c, i) => `Post ${i+1}: ${c.substring(0, 200)}`).join('\n\n');
          const prompt = `Analisis caption-caption Instagram dari akun @${normalizedUsername} berikut:

${captionsText}

Tentukan "niche utama" yang ringkas dan strategis (maksimal 20 kata) berdasarkan caption-caption tersebut.

Kembalikan JSON dengan format:
{
  "determinedNiche": "...",
  "nicheSummary": "Penjelasan singkat 1-2 kalimat mengapa niche ini dipilih"
}`;

          try {
            const nicheResponse = await generateWithGemini(prompt, systemInstruction);
            const nicheData = parseJsonResponse(nicheResponse);
            
            return {
              determinedNiche: nicheData.determinedNiche || `Konten Instagram @${normalizedUsername}`,
              accountInfo: {
                fullName: scraperData.fullName || `@${normalizedUsername}`,
                bio: scraperData.bio || '',
              },
              scrapedPosts: scraperData.captions,
              isSimulated: false,
              isRealData: true
            };
          } catch (nicheErr) {
            // Jika AI analisis gagal, tetap return data real dengan niche sederhana
            return {
              determinedNiche: `Konten Instagram dari akun @${normalizedUsername}`,
              accountInfo: {
                fullName: scraperData.fullName || `@${normalizedUsername}`,
                bio: scraperData.bio || '',
              },
              scrapedPosts: scraperData.captions,
              isSimulated: false,
              isRealData: true
            };
          }
        }
        
        // Backend sukses tapi tidak ada caption
        console.log(`[Gemini] Backend scraper: tidak ada caption (${scraperData.error || 'profil private/kosong'})`);
      } else {
        console.log(`[Gemini] Backend scraper error HTTP ${response.status}`);
      }
    } catch (backendErr) {
      // Backend tidak berjalan atau error network - lanjut ke fallback
      console.log(`[Gemini] Backend scraper tidak tersedia: ${backendErr.message}`);
    }
  }

  // =====================================================
  // STRATEGI 2: Parse HTML yang di-paste oleh user
  // =====================================================
  if (htmlContent && htmlContent.trim().length > 100) {
    const slicedHtml = htmlContent.slice(0, 300000); // Prevent hitting token limits
    
    const systemInstruction = `Anda adalah AI Instagram Data Extractor. Tugas Anda adalah menganalisis kode HTML halaman profil Instagram yang ditempelkan oleh pengguna.
Ekstrak nama lengkap akun (fullName), deskripsi bio (bio), dan teks caption dari 10 postingan terbaru secara akurat.
Lalu rumuskan "Niche Utama" yang ringkas, strategis, dan padat (maksimal 20 kata) berdasarkan caption postingan tersebut.

PENTING: Respon HARUS berupa JSON objek murni tanpa teks penjelasan apapun sebelum atau sesudah JSON, dan tanpa code block markdown. Langsung keluarkan JSON objek.

Jika kode HTML yang ditempelkan tidak valid atau tidak memiliki data postingan/caption Instagram, kembalikan objek JSON dengan kunci "error" berisi pesan penjelasan kegagalan.

Contoh format output sukses:
{
  "determinedNiche": "Pendidikan, karier, dan pengembangan diri untuk mahasiswa...",
  "accountInfo": {
    "fullName": "Leaders.id | Beasiswa Pemimpin Indonesia",
    "bio": "Platform Pemuda & Kepemimpinan Nasional..."
  },
  "scrapedPosts": [
    "Caption postingan 1...",
    "Caption postingan 2..."
  ]
}

Contoh format output gagal:
{
  "error": "HTML tidak valid atau tidak berisi postingan Instagram yang dapat diekstrak."
}`;

    const prompt = `Berikut adalah potongan kode HTML dari halaman profil Instagram @${normalizedUsername}:
"""
${slicedHtml}
"""

Tolong analisis kode HTML tersebut dan ekstrak informasi berikut:
1. Nama Lengkap profil (fullName)
2. Bio deskripsi profil (bio)
3. Ambil sampai dengan 10 caption postingan terbaru yang tercantum dalam HTML (scrapedPosts). Cari teks di dalam tag alt gambar post, atau dalam script JSON initial data, atau di dalam elemen penampung caption.
4. Tentukan niche utama (determinedNiche) yang ringkas.

Kembalikan hasilnya HANYA berupa objek JSON yang valid seperti format contoh di atas.`;

    const responseText = await generateWithGemini(prompt, systemInstruction);
    const parsedResult = parseJsonResponse(responseText);
    return {
      ...parsedResult,
      isSimulated: false,
      isRealData: false
    };
  }

  // =====================================================
  // STRATEGI 3: Simulasi AI (Last Resort)
  // =====================================================
  console.log(`[Gemini] Fallback ke simulasi AI untuk @${normalizedUsername}`);
  
  const systemInstruction = `Anda adalah AI Instagram Scraper & Brand Analyst. Tugas Anda adalah mensimulasikan penarikan data dari akun Instagram yang diberikan, mengekstrak 10 draf caption postingan terakhir, dan menentukan Niche Utama dari akun tersebut.
Respon HARUS berupa JSON objek murni tanpa teks penjelasan apapun sebelum atau sesudah JSON, dan tanpa code block markdown. Langsung keluarkan JSON objek.`;

  const prompt = `
Silakan lakukan analisis/simulasi scraping terhadap akun Instagram berikut:
Username/URL: "${normalizedUsername}"

Tugas Anda:
1. Karena ini adalah simulasi (server scraper tidak tersedia), lakukan prediksi cerdas berdasarkan nama username tentang apa kemungkinan isi konten mereka.
2. Hasilkan 10 draf caption postingan terakhir (dalam bahasa Indonesia yang santai/relatable seperti gaya penulisan caption Instagram asli di Indonesia).
3. Analisis ke-10 postingan tersebut untuk merumuskan "Niche Utama" yang ringkas (maksimal 20 kata).

Kembalikan respon berupa objek JSON valid dengan kunci:
- "determinedNiche": (Niche Utama yang dirumuskan)
- "accountInfo": { "fullName", "bio" }
- "scrapedPosts": (Array berisi 10 string caption postingan terakhir)
- "isSimulated": true
`;

  const responseText = await generateWithGemini(prompt, systemInstruction);
  return parseJsonResponse(responseText);
}
