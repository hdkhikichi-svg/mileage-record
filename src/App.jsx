import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_BASE_LOCATION, DEFAULT_PRESETS, getTodayString } from './utils/constants';
import { loadRecords, saveRecords, loadSettings, saveSettings, generateId } from './utils/storage';
import { calculateGeoDistance, getMatrixDistance } from './utils/distance';
import { loadGoogleMapsAPI, calculateDrivingDistance, buildSearchQuery } from './utils/googleMaps';
import { auth } from './utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Header from './components/Header';
import RecordTab from './components/RecordTab';
import HistoryTab from './components/HistoryTab';
import SettingsTab from './components/SettingsTab';
import EditModal from './components/EditModal';
import DeleteModal from './components/DeleteModal';

/**
 * Mileage Record - メインアプリケーション
 * 
 * 社用車の走行距離記録・交通費精算アプリ
 * - リスト選択 / 手入力で移動記録
 * - CSV距離データ取込対応
 * - Google Maps Directions API による距離自動算出
 * - Excel精算書エクスポート (ExcelJS)
 * - localStorage によるデータ永続化
 */
export default function App() {
  // === 記録データ ===
  const [records, setRecords] = useState([]);

  // === 設定データ ===
  const [settings, setSettings] = useState({
    locationList: DEFAULT_PRESETS.map(p => p.name),
    distanceMatrix: {},
    addressMap: {},
    historyLocations: [],
    useMatrix: false,
    baseLocation: DEFAULT_BASE_LOCATION,
    googleMapsApiKey: ''
  });

  // === 認証・UI状態 ===
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState('record');
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayString()); // 全体で共有する選択日付

  // === 初期読み込み（Firebase Auth 監視） ===
  useEffect(() => {
    if (!auth) {
      // Firebaseが未設定の場合はローカルモードで動作
      loadData(null);
      setIsInitializing(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      loadData(user ? user.uid : null);
      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const loadData = async (uid) => {
    setIsDataLoaded(false);
    
    const loadedRecords = await loadRecords(uid);
    setRecords(loadedRecords);

    const loadedSettings = await loadSettings(uid);
    if (loadedSettings) {
      setSettings(prev => ({ ...prev, ...loadedSettings }));
    }
    
    setIsDataLoaded(true);
  };

  // 自動保存のuseEffectは廃止し、各アクション内で明示的に保存します

  // === 計算値 ===
  const todayTotalDistance = useMemo(() => {
    const today = getTodayString();
    return records
      .filter(r => r.date === today)
      .reduce((sum, r) => sum + r.distance, 0)
      .toFixed(2);
  }, [records]);

  // === アクション ===

  /** 記録を追加 */
  const addRecord = (record) => {
    const newRecord = { ...record, id: generateId() };
    const newRecords = [...records, newRecord];
    setRecords(newRecords);
    saveRecords(newRecords, currentUser?.uid);
  };

  /** 記録を削除 */
  const deleteRecord = () => {
    if (!deleteTargetId) return;
    const newRecords = records.filter(r => r.id !== deleteTargetId);
    setRecords(newRecords);
    saveRecords(newRecords, currentUser?.uid);
    setDeleteTargetId(null);
  };

  /** 記録を更新 */
  const updateRecord = (id, data) => {
    const newRecords = records.map(r =>
      r.id === id
        ? {
            ...r,
            destination: data.destination,
            address: data.address,
            distance: parseFloat(data.distance) || 0,
            method: data.method || r.method
          }
        : r
    );
    setRecords(newRecords);
    saveRecords(newRecords, currentUser?.uid);
    setEditingRecord(null);
  };

  /** 記録の並べ替え（ドラッグ&ドロップ）+ 距離再計算 */
  const reorderRecords = async (activeId, overId) => {
    // ステップ1: 並べ替え + 即座にGPS/マトリクスで距離再計算
    const today = getTodayString();
    const todayRecs = records
      .filter(r => r.date === today)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const otherRecs = records.filter(r => r.date !== today);

    const oldIndex = todayRecs.findIndex(r => r.id === activeId);
    const newIndex = todayRecs.findIndex(r => r.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    // 配列内で要素を移動
    const reordered = [...todayRecs];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // タイムスタンプを振り直して順序を維持
    const baseTime = new Date(reordered[0].timestamp).getTime();

    // 距離を即座に再計算（GPS/マトリクス）
    const updated = reordered.map((rec, idx) => {
      const newTimestamp = new Date(baseTime + idx * 1000).toISOString();
      if (idx === 0) {
        // 最初の記録（出発地点）は距離0
        return { ...rec, timestamp: newTimestamp, distance: 0, method: '開始地点' };
      }
      const prevRec = reordered[idx - 1];
      let newDist = 0;
      let newMethod = rec.method;

      // マトリクスから計算
      if (settings.useMatrix) {
        newDist = getMatrixDistance(settings.distanceMatrix, prevRec.destination, rec.destination);
        if (newDist > 0) newMethod = '距離表';
      }
      // GPS座標から概算
      if (newDist === 0 && prevRec.lat && prevRec.lng && rec.lat && rec.lng) {
        newDist = calculateGeoDistance(prevRec.lat, prevRec.lng, rec.lat, rec.lng);
        if (newDist > 0) newMethod = 'GPS概算';
      }
      // どちらもダメなら距離0（後でGoogle Maps再計算）
      if (newDist === 0) newMethod = '再計算待ち';

      return { ...rec, timestamp: newTimestamp, distance: newDist, method: newMethod };
    });

    const newRecords = [...otherRecs, ...updated];
    setRecords(newRecords);
    saveRecords(newRecords, currentUser?.uid);

    // ステップ2: Google Maps APIで非同期に再計算（APIキーがある場合のみ）
    if (settings.googleMapsApiKey && updated.length > 1) {
      try {
        await loadGoogleMapsAPI(settings.googleMapsApiKey);
        const gmUpdates = [];

        for (let i = 1; i < updated.length; i++) {
          const prev = updated[i - 1];
          const curr = updated[i];
          const originQuery = buildSearchQuery(prev.address, prev.destination);
          const destQuery = buildSearchQuery(curr.address, curr.destination);

          if (originQuery && destQuery) {
            try {
              const result = await calculateDrivingDistance(originQuery, destQuery);
              gmUpdates.push({ id: curr.id, distance: result.distanceKm, method: 'Google Maps' });
            } catch {
              // 個別の失敗はスキップ
            }
          }
        }

        // Google Maps結果で上書き
        if (gmUpdates.length > 0) {
          const finalRecords = newRecords.map(r => {
            const gm = gmUpdates.find(u => u.id === r.id);
            return gm ? { ...r, distance: gm.distance, method: gm.method } : r;
          });
          setRecords(finalRecords);
          saveRecords(finalRecords, currentUser?.uid);
        }
      } catch {
        // API読み込み失敗時はGPS/マトリクスの値をそのまま使用
      }
    }
  };

  /** 設定を更新 */
  const updateSettings = (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings, currentUser?.uid);
  };

  /** 履歴カレンダーから日付を選択して記録タブへ移動 */
  const handleDateSelectFromHistory = (dateStr) => {
    setSelectedDate(dateStr);
    setActiveTab('record');
  };

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--gray-500)' }}>読み込み中...</div>;
  }

  return (
    <div className="app">
      {/* ヘッダー */}
      <Header todayTotalDistance={todayTotalDistance} currentUser={currentUser} />

      {/* メインコンテンツ */}
      <main className="main">
        {/* タブバー */}
        <div className="tab-bar">
          <button
            className={`tab-bar__btn ${activeTab === 'record' ? 'tab-bar__btn--active' : ''}`}
            onClick={() => setActiveTab('record')}
          >
            記録
          </button>
          <button
            className={`tab-bar__btn ${activeTab === 'history' ? 'tab-bar__btn--active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            履歴
          </button>
          <button
            className={`tab-bar__btn ${activeTab === 'settings' ? 'tab-bar__btn--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            設定
          </button>
        </div>

        {/* タブコンテンツ */}
        {activeTab === 'record' && (
          <RecordTab
            records={records}
            addRecord={addRecord}
            settings={settings}
            updateSettings={updateSettings}
            onEdit={setEditingRecord}
            onDelete={setDeleteTargetId}
            onReorder={reorderRecords}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            records={records}
            onEdit={setEditingRecord}
            onDelete={setDeleteTargetId}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelectFromHistory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            updateSettings={updateSettings}
            currentUser={currentUser}
          />
        )}
      </main>

      {/* === モーダル === */}
      {editingRecord && (
        <EditModal
          record={editingRecord}
          settings={settings}
          onSave={updateRecord}
          onClose={() => setEditingRecord(null)}
        />
      )}

      {deleteTargetId && (
        <DeleteModal
          onConfirm={deleteRecord}
          onClose={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
