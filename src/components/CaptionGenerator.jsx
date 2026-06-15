import React, { useState, useEffect } from 'react';
import { MessageSquare, Sparkles, Copy, Trash2 } from 'lucide-react';
import { generateCaption } from '../services/gemini';

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn'];
const TONES = ['Friendly', 'Professional', 'Confident', 'Playful', 'Calm', 'Fun & Energetic', 'Elegant', 'Warm', 'Bold', 'Empathetic', 'Inspirational', 'Witty', 'Serious'];
const CTAS = [
  'Untuk Engagement',
  'Untuk Aksi Lanjutan',
  'Untuk Repeat Visit & Reminder',
  'Untuk Edukasi & Refleksi',
  'Komentar Kata Tertentu'
];
const FORMULAS = [
  'Hook - Value - CTA',
  'Problem - Solution - CTA',
  'Cerita - Insight - Interaksi',
  'Data Shock - Penyebab - Tips Ringan',
  'Pertanyaan - Jawaban - CTA',
  'Relate - Solusi - Reminder',
  'Listicle - Insight - CTA',
  'Gagal - Belajar - Repeat',
  'Fakta - Twist - Insight Baru',
  'Kutipan - Relevansi - CTA'
];

export default function CaptionGenerator() {
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [tone, setTone] = useState('Friendly');
  const [ctaType, setCtaType] = useState('Untuk Engagement');
  const [captionFormula, setCaptionFormula] = useState('Hook - Value - CTA');
  const [lengthFormat, setLengthFormat] = useState('Caption Singkat'); // Short or Long
  
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fallback brand profile
  const getBrandProfile = () => {
    return {
      toneOfVoice: localStorage.getItem('bgi_brand_tone') || '',
      targetAudience: localStorage.getItem('bgi_brand_target') || '',
    };
  };

  useEffect(() => {
    // Fill from script builder if active
    const savedIdeas = localStorage.getItem('bgi_generated_ideas');
    const savedActiveIndex = localStorage.getItem('bgi_active_idea_idx');
    const savedScript = localStorage.getItem('bgi_active_script');

    if (savedIdeas && savedActiveIndex !== null) {
      try {
        const ideas = JSON.parse(savedIdeas);
        const activeIdx = parseInt(savedActiveIndex);
        if (ideas[activeIdx]) {
          setTopic(ideas[activeIdx].title);
          setPlatform(ideas[activeIdx].platform || 'Instagram');
        }
      } catch (e) {}
    }

    if (savedScript) {
      setScript(savedScript);
    }

    const savedCaption = localStorage.getItem('bgi_caption_result');
    if (savedCaption) {
      setResult(savedCaption);
    }
  }, []);

  const handleGenerateCaption = async (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Harap masukkan Topik Konten terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    const brandProfile = getBrandProfile();

    try {
      const caption = await generateCaption({
        topic: topic.trim(),
        script: script.trim(),
        platform,
        tone,
        ctaType,
        captionFormula,
        format: lengthFormat,
        brandProfile
      });
      setResult(caption);
      localStorage.setItem('bgi_caption_result', caption);
    } catch (err) {
      setError(err.message || 'Gagal generate Caption.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTopic('');
    setScript('');
    setResult('');
    localStorage.removeItem('bgi_caption_result');
    setError('');
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(result);
    alert('Caption berhasil disalin ke papan klip!');
  };

  return (
    <div className="caption-generator-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Caption Craft</h1>
          <p>Tulis caption postingan yang rapi, lengkap dengan spasi, emoji, hashtag tertarget, dan call to action (CTA) yang natural.</p>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        
        {/* Left Side: Form config */}
        <div className="glass-card">
          <h2 className="card-title"><MessageSquare size={18} /> Konfigurasi Caption</h2>
          <form onSubmit={handleGenerateCaption}>
            
            <div className="form-group">
              <label className="form-label">Topik Konten / Judul</label>
              <input 
                type="text" 
                className="input-text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Masukkan judul konten..."
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Draf Naskah Lengkap</label>
              <textarea 
                className="textarea-input" 
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Masukkan naskah atau ringkasan materi di sini agar AI dapat mengekstrak poin penting ke dalam caption..."
                style={{ minHeight: '120px' }}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Platform Sosial Media</label>
                <select 
                  className="select-input"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {PLATFORMS.map((plat) => (
                    <option key={plat} value={plat}>{plat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Gaya Bahasa (Tone)</label>
                <select 
                  className="select-input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Tindakan (CTA)</label>
              <select 
                className="select-input"
                value={ctaType}
                onChange={(e) => setCtaType(e.target.value)}
              >
                {CTAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Formula Caption</label>
                <select 
                  className="select-input"
                  value={captionFormula}
                  onChange={(e) => setCaptionFormula(e.target.value)}
                >
                  {FORMULAS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Format Caption</label>
                <select 
                  className="select-input"
                  value={lengthFormat}
                  onChange={(e) => setLengthFormat(e.target.value)}
                >
                  <option value="Caption Singkat">Caption Singkat</option>
                  <option value="Caption Panjang">Caption Panjang</option>
                </select>
              </div>
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                type="button" 
                onClick={handleClear} 
                className="btn btn-outline" 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <Trash2 size={16} /> Hapus Teks
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }} 
                disabled={loading}
              >
                {loading ? (
                  <><div className="loading-spinner"></div> Mengarang...</>
                ) : (
                  <><Sparkles size={16} /> Generate Caption</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Generated Output */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
            <span>Hasil Penulisan Caption</span>
            {result && (
              <button onClick={handleCopyToClipboard} className="btn btn-outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                <Copy size={12} /> Salin Caption
              </button>
            )}
          </h2>

          {loading ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3.5px', marginBottom: '1rem' }}></div>
              <h3>Merakit Salinan Postingan...</h3>
              <p>Membagi baris spasi paragraf, menyisipkan emoji, menyusun hashtags, dan memperkuat CTA.</p>
            </div>
          ) : result ? (
            <div className="generation-result-box" style={{ flex: 1, minHeight: '380px' }}>
              {result}
            </div>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <MessageSquare size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>Belum Ada Caption Dihasilkan</h3>
              <p>Isi data postingan dan atur konfigurasi di sebelah kiri, kemudian generate.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
