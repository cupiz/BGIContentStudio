import React, { useState, useEffect } from 'react';
import { Zap, Sparkles, Copy, RefreshCw, HelpCircle, Trash2 } from 'lucide-react';
import { generateHooks } from '../services/gemini';

const HOOK_TYPES = [
  { name: 'Pain Trigger', formula: 'Masalah yang dirasakan sekarang + alasan tersembunyi di baliknya', desc: 'Menyentil masalah umum dan membongkar penyebab yang sebenarnya' },
  { name: 'Flip Belief', formula: 'Hal yang dianggap benar + fakta mengejutkan yang berlawanan', desc: 'Membantah asumsi umum yang banyak dipercayai orang' },
  { name: 'Emotional Question', formula: '“Pernah ngerasa…” / “Kenapa ya…”', desc: 'Menggugah rasa penasaran atau refleksi diri' },
  { name: 'Data Shcok', formula: 'Angka atau data mengejutkan + dampaknya', desc: 'Membuat audiens terkejut dan ingin tahu lebih lanjut' },
  { name: 'Bold Declaration', formula: 'Pernyataan berani + klaim hasil', desc: 'Menyampaikan hasil atau opini kuat tanpa ragu' },
  { name: 'Real Talk', formula: 'Kalimat to the point + fakta menyentil', desc: 'Menyampaikan realita yang sering dihindari tapi relate' },
  { name: 'Urgency Cue', formula: 'Batas waktu + konsekuensinya', desc: 'Membuat audiens merasa harus segera bertindak' },
  { name: 'Reversal Trigger', formula: 'Kalimat yang seolah salah + alasan logis di belakangnya', desc: 'Menyampaikan hal yang terdengar berlawanan dengan logika umum' },
  { name: 'Mirror Prompt', formula: '“Mungkin kamu…” + kesalahan umum', desc: 'Bikin audiens merasa relate dan merasa ‘terpanggil’' },
  { name: 'Disruption Hook', formula: 'Kalimat pemancing + contoh yang familiar', desc: 'Menghentikan aktivitas scroll dengan kalimat tak terduga' }
];

const EMOTIONS = [
  'Anger (Marah)', 
  'Disgust (Penolakan)', 
  'Sadness (Sedih)', 
  'Fear (Takut)', 
  'Joy (Bahagia)', 
  'Anticipation (Penantian)', 
  'Surprise (Keterkejutan)', 
  'Trust (Kepercayaan)'
];

export default function HookGenerator() {
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState('');
  const [hookType, setHookType] = useState('Pain Trigger');
  const [hookDescription, setHookDescription] = useState('Menyentil masalah umum dan membongkar penyebab yang sebenarnya');
  const [hookFormula, setHookFormula] = useState('Masalah yang dirasakan sekarang + alasan tersembunyi di baliknya');
  const [emotionWord, setEmotionWord] = useState('Surprise (Keterkejutan)');
  
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fallback brand profile helper
  const getBrandProfile = () => {
    return {
      niche: localStorage.getItem('bgi_brand_niche') || '',
      specificNiche: localStorage.getItem('bgi_brand_spec_niche') || '',
      superSpecificNiche: localStorage.getItem('bgi_brand_super_spec_niche') || '',
      positioning: localStorage.getItem('bgi_brand_positioning') || '',
      archetype: localStorage.getItem('bgi_brand_archetype') || '',
      toneOfVoice: localStorage.getItem('bgi_brand_tone') || '',
      communicationDesc: localStorage.getItem('bgi_brand_comm_desc') || '',
      targetAudience: localStorage.getItem('bgi_brand_target') || '',
      segmentations: localStorage.getItem('bgi_brand_segments') || '',
    };
  };

  useEffect(() => {
    // Attempt to pre-fill from script builder active state
    const savedIdeas = localStorage.getItem('bgi_generated_ideas');
    const savedActiveIndex = localStorage.getItem('bgi_active_idea_idx');
    const savedScript = localStorage.getItem('bgi_active_script');

    if (savedIdeas && savedActiveIndex !== null) {
      try {
        const ideas = JSON.parse(savedIdeas);
        const activeIdx = parseInt(savedActiveIndex);
        if (ideas[activeIdx]) {
          setTopic(ideas[activeIdx].title);
        }
      } catch (e) {}
    }

    if (savedScript) {
      setScript(savedScript);
    }

    const savedHooksResult = localStorage.getItem('bgi_hooks_result');
    if (savedHooksResult) {
      setResult(savedHooksResult);
    }
  }, []);

  const handleHookTypeChange = (val) => {
    setHookType(val);
    const selectedObject = HOOK_TYPES.find(h => h.name === val);
    if (selectedObject) {
      setHookDescription(selectedObject.desc);
      setHookFormula(selectedObject.formula);
    }
  };

  const handleGenerateHooks = async (e) => {
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
      const hooks = await generateHooks({
        topic: topic.trim(),
        script: script.trim(),
        hookType,
        hookDescription,
        hookFormula,
        emotionWord,
        brandProfile
      });
      setResult(hooks);
      localStorage.setItem('bgi_hooks_result', hooks);
    } catch (err) {
      setError(err.message || 'Gagal generate Hook.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTopic('');
    setScript('');
    setHookDescription('');
    setHookFormula('');
    setResult('');
    localStorage.removeItem('bgi_hooks_result');
    setError('');
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(result);
    alert('Hook berhasil disalin ke papan klip!');
  };

  return (
    <div className="hook-generator-container">
      <div className="header-area">
        <div className="header-title-group">
          <h1>Hook Studio</h1>
          <p>Formulasikan pembuka konten yang menghentikan scroll jari audiens dalam 2 detik pertama (Lisan, Visual, & Audio).</p>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '0.9fr 1.1fr' }}>
        
        {/* Form Panel */}
        <div className="glass-card">
          <h2 className="card-title"><Zap size={18} /> Konfigurasi Hook</h2>
          <form onSubmit={handleGenerateHooks}>
            
            <div className="form-group">
              <label className="form-label">Topik Konten / Judul</label>
              <input 
                type="text" 
                className="input-text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Masukkan topik konten Anda..."
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Draf Naskah (Opsional)</label>
              <textarea 
                className="textarea-input" 
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Tempel draf naskah lengkap Anda di sini untuk membantu AI membuat Hook yang lebih relevan dengan isi..."
                style={{ minHeight: '120px' }}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Jenis HOOK</label>
                <select 
                  className="select-input"
                  value={hookType}
                  onChange={(e) => handleHookTypeChange(e.target.value)}
                >
                  {HOOK_TYPES.map((type) => (
                    <option key={type.name} value={type.name}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Emotion Word</label>
                <select 
                  className="select-input"
                  value={emotionWord}
                  onChange={(e) => setEmotionWord(e.target.value)}
                >
                  {EMOTIONS.map((emo) => (
                    <option key={emo} value={emo}>{emo}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi HOOK</label>
              <input 
                type="text" 
                className="input-text" 
                value={hookDescription}
                onChange={(e) => setHookDescription(e.target.value)}
                placeholder="Masukkan deskripsi hook..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rumus HOOK</label>
              <input 
                type="text" 
                className="input-text" 
                value={hookFormula}
                onChange={(e) => setHookFormula(e.target.value)}
                placeholder="Masukkan rumus hook..."
              />
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
                  <><div className="loading-spinner"></div> Merumuskan...</>
                ) : (
                  <><Sparkles size={16} /> Generate Hook</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Output Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
            <span>Hasil Formulasi Hook</span>
            {result && (
              <button onClick={handleCopyToClipboard} className="btn btn-outline" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>
                <Copy size={12} /> Salin Hasil
              </button>
            )}
          </h2>

          {loading ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3.5px', marginBottom: '1rem' }}></div>
              <h3>Meracik Hook Viral...</h3>
              <p>Menganalisis draf naskah, memicu emosi {emotionWord}, dan menyusun transisi visual pendukung.</p>
            </div>
          ) : result ? (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '1rem' }}>
              <div className="generation-result-box" style={{ flex: 1, minHeight: '350px' }}>
                {result}
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <HelpCircle size={16} style={{ flexShrink: 0 }} />
                <span>Rekomendasi: Teks Hook (Lisan/Tulisan) sangat bagus jika dipasang pada Slide 1 jika Carousel, atau diletakkan sebagai teks tebal di video Reels/TikTok Anda.</span>
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <Zap size={40} style={{ color: 'var(--text-muted)' }} />
              <h3>Belum Ada Hook Dihasilkan</h3>
              <p>Isi topik konten dan pilih formula di sebelah kiri, lalu klik tombol generate.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
