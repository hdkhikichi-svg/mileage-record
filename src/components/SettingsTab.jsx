import React, { useState } from 'react';
import {
  FileText, Upload, Settings, MapPin, Key,
  CheckCircle, XCircle, RefreshCw, Cloud, LogOut, LogIn
} from 'lucide-react';
import { parseCSV } from '../utils/csv';
import {
  loadGoogleMapsAPI,
  resetGoogleMapsAPI,
  isGoogleMapsLoaded
} from '../utils/googleMaps';
import { signInWithGoogle, logOut } from '../utils/firebase';

/**
 * 設定タブ
 * CSV距離データ取込、Google Maps APIキー設定、基本設定、クラウド同期
 * 
 * @param {{
 *   settings: Object,
 *   updateSettings: (updates: Object) => void,
 *   currentUser: Object|null
 * }} props
 */
export default function SettingsTab({ settings, updateSettings, currentUser }) {
  const { useMatrix, locationList, baseLocation, googleMapsApiKey } = settings;

  const [apiKeyInput, setApiKeyInput] = useState(googleMapsApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(
    googleMapsApiKey ? (isGoogleMapsLoaded() ? 'connected' : 'idle') : 'idle'
  );
  const [isTesting, setIsTesting] = useState(false);

  // --- クラウド同期 ---
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      alert("ログインに失敗しました。Firebaseの設定やネットワークを確認してください。");
    }
  };

  const handleLogout = async () => {
    if (confirm("ログアウトしますか？未保存のローカルデータはクラウドと同期されません。")) {
      try {
        await logOut();
      } catch (error) {
        alert("ログアウトに失敗しました。");
      }
    }
  };

  // --- CSV読み込み ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseCSV(e.target.result);
        updateSettings({
          locationList: result.locationList,
          distanceMatrix: result.distanceMatrix,
          addressMap: result.addressMap,
          useMatrix: true
        });
        alert(`${result.locationList.length}件の地点データ（住所含む）を読み込みました。`);
      } catch (err) {
        alert(err.message || "CSVの読み込みに失敗しました。");
      }
    };
    reader.readAsText(file);
  };

  // --- APIキー保存 ---
  const handleSaveApiKey = () => {
    resetGoogleMapsAPI();
    updateSettings({ googleMapsApiKey: apiKeyInput.trim() });
    setConnectionStatus('idle');
    if (apiKeyInput.trim()) {
      handleTestConnection(apiKeyInput.trim());
    }
  };

  // --- 接続テスト ---
  const handleTestConnection = async (key) => {
    const testKey = key || googleMapsApiKey;
    if (!testKey) return;

    setIsTesting(true);
    setConnectionStatus('testing');
    try {
      resetGoogleMapsAPI();
      await loadGoogleMapsAPI(testKey);
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('error');
    } finally {
      setIsTesting(false);
    }
  };

  // --- 基準点名の変更 ---
  const handleBaseNameChange = (e) => {
    const newBase = { ...baseLocation, name: e.target.value };
    updateSettings({ baseLocation: newBase });
  };

  return (
    <div className="animate-in space-y">
      {/* === クラウド同期 === */}
      <div className="card">
        <h3 className="card__title">
          <Cloud size={16} className="card__title-icon" />
          クラウド同期
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
          Googleアカウントでログインすると、スマホとパソコンでデータを同期できます。
        </p>
        
        {currentUser ? (
          <div className="info-box info-box--green" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <img src={currentUser.photoURL} alt="User" style={{ width: 24, height: 24, borderRadius: '50%' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{currentUser.displayName}</span>
            </div>
            <button className="btn btn--outline btn--sm" onClick={handleLogout} style={{ padding: '0.25rem 0.5rem' }}>
              <LogOut size={14} />
              ログアウト
            </button>
          </div>
        ) : (
          <button className="btn btn--primary" onClick={handleLogin} style={{ width: '100%', justifyContent: 'center' }}>
            <LogIn size={16} />
            Googleでログインして同期
          </button>
        )}
      </div>
      {/* === 距離データ取り込み === */}
      <div className="card">
        <h3 className="card__title">
          <FileText size={16} className="card__title-icon" />
          距離データ取り込み
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
          店舗間距離表（CSV）をアップロードすると、リスト選択時に自動で距離が入力されます。
        </p>

        <label className="upload-area">
          <Upload size={32} />
          <span className="upload-area__text">CSVファイルを選択</span>
          <input
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </label>

        {useMatrix && (
          <div className="info-box info-box--green" style={{ marginTop: '1rem' }}>
            <CheckCircle size={14} />
            距離データ読込済み ({locationList.length}地点)
          </div>
        )}
      </div>

      {/* === Google Maps API 設定 === */}
      <div className="card">
        <h3 className="card__title">
          <MapPin size={16} className="card__title-icon" />
          Google Maps 距離自動算出
        </h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
          APIキーを設定すると、住所から走行距離を自動計算できます。
        </p>
        <p style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginBottom: '1rem', lineHeight: 1.6 }}>
          Google Cloud Console → APIs & Services → Credentials でキーを取得し、
          <strong>Maps JavaScript API</strong> と <strong>Directions API</strong> を有効化してください。
        </p>

        <div className="api-key-section">
          {/* APIキー入力 */}
          <div className="form-group">
            <label className="form-label">
              <Key size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Google Maps APIキー
            </label>
            <div className="api-key-input-wrapper">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="input"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIza..."
              />
              <button
                className="btn btn--outline btn--sm"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {showApiKey ? '隠す' : '表示'}
              </button>
            </div>
          </div>

          {/* 保存 & テストボタン */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim()}
              style={{ flex: 1 }}
            >
              <CheckCircle size={14} />
              保存
            </button>
            <button
              className="btn btn--outline btn--sm"
              onClick={() => handleTestConnection()}
              disabled={!googleMapsApiKey || isTesting}
              style={{ flex: 1 }}
            >
              <RefreshCw size={14} className={isTesting ? 'spinner--inline' : ''} />
              接続テスト
            </button>
          </div>

          {/* 接続ステータス */}
          <div className="connection-status">
            <span
              className={`connection-status__dot ${
                connectionStatus === 'connected'
                  ? 'connection-status__dot--success'
                  : connectionStatus === 'error'
                  ? 'connection-status__dot--error'
                  : 'connection-status__dot--idle'
              }`}
            />
            <span style={{
              color: connectionStatus === 'connected'
                ? 'var(--success-600)'
                : connectionStatus === 'error'
                ? 'var(--danger-600)'
                : 'var(--gray-400)'
            }}>
              {connectionStatus === 'connected' && '接続OK - 距離自動算出が利用可能'}
              {connectionStatus === 'error' && '接続失敗 - APIキーを確認してください'}
              {connectionStatus === 'idle' && (googleMapsApiKey ? '未テスト' : 'APIキー未設定')}
              {connectionStatus === 'testing' && 'テスト中...'}
            </span>
          </div>
        </div>
      </div>

      {/* === 基本設定 === */}
      <div className="card">
        <h3 className="card__title">
          <Settings size={16} className="card__title-icon" />
          基本設定
        </h3>
        <div className="form-group">
          <label className="form-label">基準点名称</label>
          <input
            type="text"
            className="input"
            value={baseLocation.name}
            onChange={handleBaseNameChange}
          />
        </div>
      </div>
    </div>
  );
}
