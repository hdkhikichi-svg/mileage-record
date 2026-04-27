import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_BASE_LOCATION, DEFAULT_PRESETS, getTodayString } from './utils/constants';
import { loadRecords, saveRecords, loadSettings, saveSettings, generateId } from './utils/storage';
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

  // === UI状態 ===
  const [activeTab, setActiveTab] = useState('record');
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // === 初期読み込み ===
  useEffect(() => {
    const loadedRecords = loadRecords();
    setRecords(loadedRecords);

    const loadedSettings = loadSettings();
    if (loadedSettings) {
      setSettings(prev => ({ ...prev, ...loadedSettings }));
    }
  }, []);

  // === データ永続化: 記録 ===
  useEffect(() => {
    // 初回レンダリング時の空配列保存を防止
    if (records.length > 0 || loadRecords().length > 0) {
      saveRecords(records);
    }
  }, [records]);

  // === データ永続化: 設定 ===
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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
    setRecords(prev => [...prev, newRecord]);
  };

  /** 記録を削除 */
  const deleteRecord = () => {
    if (!deleteTargetId) return;
    setRecords(prev => prev.filter(r => r.id !== deleteTargetId));
    setDeleteTargetId(null);
  };

  /** 記録を更新 */
  const updateRecord = (id, data) => {
    setRecords(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              destination: data.destination,
              address: data.address,
              distance: parseFloat(data.distance) || 0,
              method: data.method || r.method
            }
          : r
      )
    );
    setEditingRecord(null);
  };

  /** 記録の並べ替え（ドラッグ&ドロップ） */
  const reorderRecords = (activeId, overId) => {
    setRecords(prev => {
      const today = getTodayString();
      const todayRecs = prev
        .filter(r => r.date === today)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const otherRecs = prev.filter(r => r.date !== today);

      const oldIndex = todayRecs.findIndex(r => r.id === activeId);
      const newIndex = todayRecs.findIndex(r => r.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;

      // 配列内で要素を移動
      const reordered = [...todayRecs];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      // タイムスタンプを振り直して順序を維持
      const baseTime = new Date(reordered[0].timestamp).getTime();
      const updated = reordered.map((rec, idx) => ({
        ...rec,
        timestamp: new Date(baseTime + idx * 1000).toISOString()
      }));

      return [...otherRecs, ...updated];
    });
  };

  /** 設定を更新 */
  const updateSettings = (updates) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="app">
      {/* ヘッダー */}
      <Header todayTotalDistance={todayTotalDistance} />

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
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            records={records}
            onEdit={setEditingRecord}
            onDelete={setDeleteTargetId}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            updateSettings={updateSettings}
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
