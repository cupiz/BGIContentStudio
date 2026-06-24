import React, { useState, useEffect } from 'react';
import { Users, Key, Check, AlertCircle, ExternalLink, Download, RefreshCw, X, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';

function extractGDriveFolderId(url) {
  if (!url) return '';
  url = url.trim();
  const foldersMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (foldersMatch && foldersMatch[1]) {
    return foldersMatch[1];
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  if (/^[a-zA-Z0-9-_]+$/.test(url)) {
    return url;
  }
  return '';
}

export default function TeamWorkflow() {
  // Authentication states
  const [token, setToken] = useState(localStorage.getItem('bgi_team_token') || '');
  const [userRole, setUserRole] = useState(localStorage.getItem('bgi_team_role') || '');
  const [fullName, setFullName] = useState(localStorage.getItem('bgi_team_fullname') || '');
  const [vpsUrl, setVpsUrl] = useState(localStorage.getItem('bgi_team_vps_url') || 'http://localhost:5000');
  
  // Login form states
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Workflow states
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'UPLOADED', 'DONE'

  // CS inputs
  const [selectedFile, setSelectedFile] = useState(null);
  const [proofLink, setProofLink] = useState('');
  const [submittingCS, setSubmittingCS] = useState(false);

  // Action states for Project Leader
  const [actionStates, setActionStates] = useState({}); // { [fileId]: { loading: boolean } }

  // Admin inputs for adding new members
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('cs');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [userSuccessMessage, setUserSuccessMessage] = useState('');

  // Sync GDrive files not yet in VPS database
  const syncGDriveFilesToVPS = async (dbFiles, activeToken = token, url = vpsUrl) => {
    const folderUrl = localStorage.getItem('bgi_gdrive_folder_url') || '';
    if (!folderUrl) return dbFiles;

    const folderId = extractGDriveFolderId(folderUrl);
    if (!folderId) return dbFiles;

    const mode = localStorage.getItem('bgi_gdrive_mode') || 'apps-script';
    let gdriveFiles = [];

    try {
      if (mode === 'apps-script') {
        const appsScriptUrl = localStorage.getItem('bgi_gdrive_apps_script_url') || '';
        if (!appsScriptUrl) return dbFiles;

        const gdriveUrl = `${appsScriptUrl}?folderId=${folderId}`;
        const response = await fetch(gdriveUrl, { method: 'GET' });
        if (!response.ok) return dbFiles;
        const resJson = await response.json();
        if (resJson.success) {
          gdriveFiles = resJson.files || [];
        }
      } else {
        // Direct GDrive API
        const accessToken = localStorage.getItem('bgi_gdrive_access_token') || '';
        if (!accessToken) return dbFiles;

        const subfoldersUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        const subfoldersRes = await fetch(subfoldersUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!subfoldersRes.ok) return dbFiles;
        const subfoldersJson = await subfoldersRes.json();

        const parentIds = [folderId];
        if (subfoldersJson.files) {
          subfoldersJson.files.forEach(f => parentIds.push(f.id));
        }

        const parentOrQuery = parentIds.map(id => `'${id}' in parents`).join(' or ');
        const filesQuery = `mimeType contains 'image/' and (${parentOrQuery}) and trashed = false`;
        const filesUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,name,webViewLink,createdTime,parents)&orderBy=createdTime%20desc&supportsAllDrives=true&includeItemsFromAllDrives=true`;
        
        const filesRes = await fetch(filesUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!filesRes.ok) return dbFiles;
        const filesJson = await filesRes.json();
        gdriveFiles = (filesJson.files || []).map(f => ({
          id: f.id,
          name: f.name,
          url: f.webViewLink
        }));
      }

      // Filter files
      const dbFileIds = new Set(dbFiles.map(f => f.gdrive_file_id));
      const filesToRegister = gdriveFiles.filter(file => {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        if (nameWithoutExt.endsWith('_UPLOADED') || nameWithoutExt.endsWith('_DONE')) {
          return false;
        }
        return !dbFileIds.has(file.id);
      });

      if (filesToRegister.length === 0) {
        return dbFiles;
      }

      console.log(`[Sync] Mendaftarkan ${filesToRegister.length} file GDrive baru yang belum terdata di VPS...`);
      let registeredCount = 0;
      for (const file of filesToRegister) {
        try {
          const regRes = await fetch(`${url}/api/content/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gdrive_file_id: file.id,
              file_name: file.name,
              gdrive_url: file.url || `https://drive.google.com/open?id=${file.id}`
            })
          });
          if (regRes.ok) {
            registeredCount++;
          }
        } catch (regErr) {
          console.error('[Sync] Gagal meregistrasi file:', file.name, regErr.message);
        }
      }

      if (registeredCount > 0) {
        // Fetch ulang antrean terbaru dari VPS database
        const endpoint = '/api/content/all';
        const response = await fetch(`${url}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        if (response.ok) {
          const resJson = await response.json();
          if (resJson.success) {
            return resJson.files || [];
          }
        }
      }
    } catch (syncErr) {
      console.error('[Sync GDrive to VPS] Terjadi kesalahan:', syncErr.message);
    }

    return dbFiles;
  };

  // Load files based on role
  const loadFiles = async (activeToken = token, role = userRole, url = vpsUrl) => {
    if (!activeToken || !role) return;
    setLoading(true);
    setError('');
    
    try {
      const endpoint = '/api/content/all';
      const response = await fetch(`${url}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Gagal memuat data dari server VPS (${response.status})`);
      }

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || 'Terjadi kesalahan pada VPS.');
      }

      let currentFiles = resJson.files || [];
      currentFiles = await syncGDriveFilesToVPS(currentFiles, activeToken, url);

      setFiles(currentFiles);
    } catch (err) {
      console.error(err);
      setError(`Gagal memuat antrean file: ${err.message}. Pastikan alamat VPS Anda benar.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFiles();
    }
  }, [token]);

  // Handle Add New Member (Admin only)
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim() || !newRole) {
      setError('Harap lengkapi semua field pendaftaran.');
      return;
    }

    setSubmittingUser(true);
    setError('');
    setUserSuccessMessage('');

    try {
      const response = await fetch(`${vpsUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          full_name: newFullName.trim(),
          role: newRole
        })
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.error || 'Gagal menambahkan anggota tim.');
      }

      setUserSuccessMessage(`✅ Akun ${resJson.user.username} (${resJson.user.role}) berhasil ditambahkan!`);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('cs');
    } catch (err) {
      console.error(err);
      setError(`Gagal menambahkan anggota baru: ${err.message}`);
    } finally {
      setSubmittingUser(false);
      setTimeout(() => setUserSuccessMessage(''), 5000);
    }
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!vpsUrl.trim() || !usernameInput.trim() || !passwordInput.trim()) {
      setLoginError('Harap isi semua kolom login.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${vpsUrl.trim()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput
        })
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Username atau password salah.');
      }

      // Save credentials
      const cleanVpsUrl = vpsUrl.trim().replace(/\/$/, ''); // Remove trailing slash
      localStorage.setItem('bgi_team_token', resJson.token);
      localStorage.setItem('bgi_team_role', resJson.user.role);
      localStorage.setItem('bgi_team_fullname', resJson.user.full_name);
      localStorage.setItem('bgi_team_vps_url', cleanVpsUrl);

      setToken(resJson.token);
      setUserRole(resJson.user.role);
      setFullName(resJson.user.full_name);
      setVpsUrl(cleanVpsUrl);
      
      // Auto trigger load
      loadFiles(resJson.token, resJson.user.role, cleanVpsUrl);
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('bgi_team_token');
    localStorage.removeItem('bgi_team_role');
    localStorage.removeItem('bgi_team_fullname');
    
    setToken('');
    setUserRole('');
    setFullName('');
    setFiles([]);
    setSelectedFile(null);
    setProofLink('');
    window.dispatchEvent(new Event('storage'));
  };

  // CS: Submit Proof link (Status -> UPLOADED)
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    if (!proofLink.trim()) {
      setError('Masukkan tautan link bukti postingan sosial media.');
      return;
    }

    setSubmittingCS(true);
    setError('');
    setStatus('Mengirim laporan bukti postingan ke VPS...');

    try {
      const response = await fetch(`${vpsUrl}/api/content/mark-uploaded`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedFile.id,
          proof_link: proofLink.trim()
        })
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Gagal mengubah status di server.');
      }

      setStatus('✅ Gambar berhasil ditandai UPLOADED!');
      setProofLink('');
      setSelectedFile(null);
      loadFiles();
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      console.error(err);
      setError(`Gagal memperbarui status: ${err.message}`);
    } finally {
      setSubmittingCS(false);
    }
  };

  // Leader: Mark as DONE
  const handleMarkDone = async (fileId) => {
    setActionStates(prev => ({ ...prev, [fileId]: { loading: true } }));
    setError('');
    try {
      const response = await fetch(`${vpsUrl}/api/content/mark-done`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: fileId })
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Gagal menyetujui di server.');
      }

      setStatus('✅ Konten berhasil disetujui (DONE)!');
      loadFiles();
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      console.error(err);
      setError(`Gagal menyetujui konten: ${err.message}`);
    } finally {
      setActionStates(prev => ({ ...prev, [fileId]: { loading: false } }));
    }
  };

  // Leader: Reject / Reset to PENDING
  const handleRejectFile = async (fileId) => {
    if (!window.confirm('Apakah Anda yakin ingin menolak postingan ini dan mengembalikan status file ke PENDING?')) return;
    
    setActionStates(prev => ({ ...prev, [fileId]: { loading: true } }));
    setError('');
    try {
      const response = await fetch(`${vpsUrl}/api/content/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: fileId })
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Gagal menolak file di server.');
      }

      setStatus('⚠️ Postingan ditolak. Status dikembalikan ke PENDING.');
      loadFiles();
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      console.error(err);
      setError(`Gagal menolak postingan: ${err.message}`);
    } finally {
      setActionStates(prev => ({ ...prev, [fileId]: { loading: false } }));
    }
  };

  // Helper: Download image to local PC
  const downloadImage = async (file) => {
    try {
      setStatus(`Mendownload ${file.file_name}...`);
      const response = await fetch(`https://lh3.googleusercontent.com/d/${file.gdrive_file_id}=s0`); // Get raw image link
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setStatus('✅ Download selesai!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(`Gagal mendownload gambar secara langsung: ${err.message}. Silakan buka link Google Drive file untuk mendownload.`);
    }
  };

  // Render Login Screen if no token
  if (!token) {
    return (
      <div className="settings-container">
        <div className="header-area">
          <div className="header-title-group">
            <h1>Kolaborasi Tim & VPS</h1>
            <p>Sambungkan studio Anda ke server VPS untuk mengelola alur kerja CS dan Project Leader.</p>
          </div>
        </div>

        <div className="glass-card" style={{ maxWidth: '500px', margin: '2rem auto' }}>
          <h2 className="card-title" style={{ gap: '0.5rem' }}>
            <Users size={20} /> Login Akun Tim
          </h2>
          
          <form onSubmit={handleLogin} style={{ marginTop: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">URL Server VPS</label>
              <input
                type="text"
                className="input-text"
                value={vpsUrl}
                onChange={(e) => setVpsUrl(e.target.value)}
                placeholder="http://123.45.67.89:5000"
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Alamat IP server API Node.js yang berjalan di VPS Anda.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="input-text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="cs_rudi atau leader_budi"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input-text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div style={{
                padding: '0.75rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.8rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', justifyContent: 'center', height: '38px', alignItems: 'center' }}
              disabled={loginLoading}
            >
              {loginLoading ? <div className="loading-spinner"></div> : <><Key size={16} style={{ marginRight: '0.35rem' }} /> Masuk ke Server</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const counts = {
    ALL: files.length,
    PENDING: files.filter(f => f.status === 'PENDING').length,
    UPLOADED: files.filter(f => f.status === 'UPLOADED').length,
    DONE: files.filter(f => f.status === 'DONE').length
  };

  const filteredFiles = files.filter(file => {
    if (statusFilter === 'ALL') return true;
    return file.status === statusFilter;
  });

  return (
    <div className="settings-container">
      {/* Tab Header / Profile */}
      <div className="header-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="header-title-group">
          <h1>Kolaborasi Tim & VPS</h1>
          <p>Kelola dan sinkronkan alur kerja konten tim Anda secara real-time.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-main)' }}>{fullName}</span>
            <span style={{ fontSize: '0.72rem', color: '#2dd4bf', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>
              🛡️ {userRole === 'cs' ? 'Customer Service' : userRole === 'leader' ? 'Project Leader' : 'Administrator'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{ padding: '0.35rem', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171', borderRadius: '8px' }}
            title="Keluar Akun"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Global Status / Errors */}
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertCircle size={14} /> {error}
        </p>
      )}
      {status && (
        <p style={{ color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '1rem', background: 'rgba(99,102,241,0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
          {status}
        </p>
      )}

      {/* Main Board Layout */}
      <div className="grid-2" style={{ gridTemplateColumns: (userRole === 'cs' || userRole === 'admin') ? '1fr 380px' : '1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        
        {/* Left Column: Media queue List */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              Daftar Konten Tim
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                ({filteredFiles.length} file)
              </span>
            </h2>
            <button
              onClick={() => loadFiles()}
              className="btn btn-outline"
              disabled={loading}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <RefreshCw size={12} className={loading ? 'spin-animation' : ''} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>

          {/* Status Filter Tab Buttons */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'PENDING', label: 'Pending' },
              { id: 'UPLOADED', label: 'Uploaded' },
              { id: 'DONE', label: 'Done' }
            ].map((f) => {
              const isActive = statusFilter === f.id;
              let badgeColor = 'rgba(255, 255, 255, 0.15)';
              let activeBg = 'rgba(255, 255, 255, 0.08)';
              let activeText = 'var(--text-main)';

              if (f.id === 'PENDING') {
                badgeColor = '#f59e0b';
                activeBg = 'rgba(245, 158, 11, 0.15)';
                activeText = '#fbbf24';
              } else if (f.id === 'UPLOADED') {
                badgeColor = '#3b82f6';
                activeBg = 'rgba(59, 130, 246, 0.15)';
                activeText = '#60a5fa';
              } else if (f.id === 'DONE') {
                badgeColor = '#10b981';
                activeBg = 'rgba(16, 185, 129, 0.15)';
                activeText = '#34d399';
              }

              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className="btn"
                  style={{
                    height: '28px',
                    fontSize: '0.72rem',
                    padding: '0 0.6rem',
                    borderRadius: '6px',
                    borderColor: isActive ? badgeColor : 'rgba(255, 255, 255, 0.05)',
                    background: isActive ? activeBg : 'rgba(255, 255, 255, 0.02)',
                    color: isActive ? activeText : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: isActive ? '600' : 'normal'
                  }}
                >
                  {f.label}
                  <span style={{
                    fontSize: '0.65rem',
                    background: isActive ? badgeColor : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? '#000' : 'var(--text-muted)',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '10px',
                    fontWeight: '700'
                  }}>
                    {counts[f.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '300px', gap: '1rem' }}>
              <div className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Membaca antrean dari VPS...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '300px', color: 'var(--text-muted)', gap: '0.5rem' }}>
              <CheckCircle2 size={40} style={{ color: '#34d399', opacity: 0.7 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>Kosong</span>
              <span style={{ fontSize: '0.8rem' }}>
                Tidak ada konten dengan status {statusFilter === 'ALL' ? 'apapun' : statusFilter} saat ini.
              </span>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1.25rem',
              maxHeight: '75vh',
              overflowY: 'auto',
              paddingRight: '0.25rem',
              paddingBottom: '1rem'
            }}>
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => userRole === 'cs' && file.status === 'PENDING' && setSelectedFile(file)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid',
                    borderColor: selectedFile?.id === file.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                    cursor: (userRole === 'cs' && file.status === 'PENDING') ? 'pointer' : 'default',
                    boxShadow: selectedFile?.id === file.id ? '0 0 12px rgba(20, 184, 166, 0.15)' : 'none'
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{ width: '100%', height: '140px', position: 'relative', overflow: 'hidden', background: 'rgba(0, 0, 0, 0.2)' }}>
                    <img
                      src={`https://lh3.googleusercontent.com/d/${file.gdrive_file_id}=w400`}
                      alt={file.file_name}
                      onError={(e) => {
                        e.target.src = 'https://placehold.co/400x300?text=Drive+Image';
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span style={{
                      position: 'absolute',
                      bottom: '0.4rem',
                      left: '0.4rem',
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: file.status === 'DONE' ? '#34d399' : file.status === 'UPLOADED' ? '#60a5fa' : '#fbbf24',
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontWeight: '700',
                      border: '1px solid',
                      borderColor: file.status === 'DONE' ? 'rgba(16, 185, 129, 0.3)' : file.status === 'UPLOADED' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                    }}>
                      {file.status === 'DONE' ? '✅ DONE' : file.status === 'UPLOADED' ? '📤 UPLOADED' : '📁 PENDING'}
                    </span>
                  </div>

                  {/* Info Card */}
                  <div style={{ padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, justifyContent: 'space-between' }}>
                    <div>
                      <span
                        title={file.file_name}
                        style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3', fontWeight: '600' }}
                      >
                        {file.file_name}
                      </span>
                      {file.cs_name && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Oleh CS: <strong style={{ color: 'var(--text-main)' }}>{file.cs_name}</strong>
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons based on Role and Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.35rem' }}>
                      {/* CS Actions */}
                      {userRole === 'cs' && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(file);
                            }}
                            className="btn btn-outline"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.7rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              height: '26px'
                            }}
                          >
                            <Download size={12} /> Unduh Gambar
                          </button>
                          {file.status === 'UPLOADED' && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                              Menunggu persetujuan leader
                            </span>
                          )}
                          {file.status === 'DONE' && (
                            <span style={{ fontSize: '0.68rem', color: '#34d399', textAlign: 'center', fontWeight: '600' }}>
                              Selesai disetujui
                            </span>
                          )}
                        </>
                      )}

                      {/* Project Leader / Admin Actions */}
                      {(userRole === 'leader' || userRole === 'admin') && (
                        <>
                          {file.status === 'PENDING' && (
                            <div style={{ fontSize: '0.68rem', color: '#fbbf24', textAlign: 'center', padding: '0.25rem 0', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '4px', border: '1px dashed rgba(245, 158, 11, 0.2)' }}>
                              ⏳ Menunggu CS Upload
                            </div>
                          )}

                          {file.status === 'DONE' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ fontSize: '0.68rem', color: '#34d399', textAlign: 'center', padding: '0.25rem 0', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '4px', border: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                                ✅ Selesai disetujui
                              </div>
                              {file.leader_name && (
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                  Oleh: {file.leader_name}
                                </span>
                              )}
                            </div>
                          )}

                          {file.status === 'UPLOADED' && (
                            <>
                              <a
                                href={file.proof_link}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-outline"
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.25rem',
                                  borderColor: 'rgba(20, 184, 166, 0.25)',
                                  color: '#2dd4bf',
                                  height: '26px'
                                }}
                              >
                                <ExternalLink size={12} /> Cek Bukti Link
                              </a>
                              
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleMarkDone(file.id)}
                                  className="btn btn-primary"
                                  disabled={actionStates[file.id]?.loading}
                                  style={{
                                    flex: 1,
                                    padding: '0.25rem 0.4rem',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.15rem',
                                    height: '26px'
                                  }}
                                >
                                  {actionStates[file.id]?.loading ? (
                                    <div className="loading-spinner" style={{ width: '8px', height: '8px', borderWidth: '1px' }}></div>
                                  ) : (
                                    'Setuju'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectFile(file.id)}
                                  className="btn btn-outline"
                                  disabled={actionStates[file.id]?.loading}
                                  style={{
                                    flex: 1,
                                    padding: '0.25rem 0.4rem',
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.15rem',
                                    borderColor: 'rgba(239, 68, 68, 0.3)',
                                    color: '#f87171',
                                    height: '26px'
                                  }}
                                >
                                  Tolak
                                </button>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: CS Action Submission panel */}
        {userRole === 'cs' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <h2 className="card-title">✍️ Submit Laporan Postingan</h2>
            
            {selectedFile ? (
              <form onSubmit={handleSubmitProof} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <img
                    src={`https://lh3.googleusercontent.com/d/${selectedFile.gdrive_file_id}=w100`}
                    alt={selectedFile.file_name}
                    style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }}
                  />
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedFile.file_name}
                    </div>
                    <a
                      href={selectedFile.gdrive_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.68rem', color: '#2dd4bf', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.15rem', marginTop: '0.15rem' }}
                    >
                      <ExternalLink size={10} /> Lihat di GDrive
                    </a>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Link Bukti Upload Sosial Media</label>
                  <input
                    type="url"
                    className="input-text"
                    value={proofLink}
                    onChange={(e) => setProofLink(e.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block', lineHeight: '1.3' }}>
                    Tempelkan URL postingan TikTok, Instagram, atau Reels tempat Anda menerbitkan konten ini.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingCS}
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', height: '36px', alignItems: 'center' }}
                  >
                    {submittingCS ? (
                      <div className="loading-spinner"></div>
                    ) : (
                      <><CheckCircle2 size={15} style={{ marginRight: '0.25rem' }} /> Tandai Sudah Upload</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setProofLink('');
                    }}
                    className="btn btn-outline"
                    style={{ padding: '0 0.75rem', height: '36px' }}
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)', textAlign: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={32} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: '0.85rem' }}>
                  Silakan pilih salah satu kartu gambar di antrean kiri terlebih dahulu untuk menyerahkan laporan bukti upload.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Right Column: Admin User Management panel */}
        {userRole === 'admin' && (
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <h2 className="card-title" style={{ margin: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              ➕ Tambah Anggota Tim
            </h2>
            
            {userSuccessMessage && (
              <p style={{ color: '#34d399', fontSize: '0.85rem', marginBottom: '1.25rem', background: 'rgba(52,211,153,0.08)', padding: '0.6rem 0.8rem', borderRadius: '8px' }}>
                {userSuccessMessage}
              </p>
            )}

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Username</label>
                <input
                  type="text"
                  className="input-text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: budi_cs"
                  style={{ height: '36px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nama Lengkap</label>
                <input
                  type="text"
                  className="input-text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Contoh: Budi Cahyono"
                  style={{ height: '36px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Password</label>
                <input
                  type="password"
                  className="input-text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  style={{ height: '36px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Peran (Role)</label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setNewRole('cs')}
                    className="btn"
                    style={{
                      flex: 1,
                      height: '32px',
                      fontSize: '0.75rem',
                      padding: 0,
                      borderColor: newRole === 'cs' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                      background: newRole === 'cs' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: newRole === 'cs' ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: newRole === 'cs' ? '600' : 'normal'
                    }}
                  >
                    CS
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('leader')}
                    className="btn"
                    style={{
                      flex: 1,
                      height: '32px',
                      fontSize: '0.75rem',
                      padding: 0,
                      borderColor: newRole === 'leader' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                      background: newRole === 'leader' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: newRole === 'leader' ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: newRole === 'leader' ? '600' : 'normal'
                    }}
                  >
                    Leader
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className="btn"
                    style={{
                      flex: 1,
                      height: '32px',
                      fontSize: '0.75rem',
                      padding: 0,
                      borderColor: newRole === 'admin' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                      background: newRole === 'admin' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      color: newRole === 'admin' ? 'var(--primary)' : 'var(--text-main)',
                      fontWeight: newRole === 'admin' ? '600' : 'normal'
                    }}
                  >
                    Admin
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingUser}
                style={{ display: 'flex', justifyContent: 'center', height: '36px', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}
              >
                {submittingUser ? (
                  <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                ) : (
                  'Buat Akun Anggota'
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
