import React, { useState, useMemo } from 'react';
import {
  List, Plus, MapPin, Car, History, ExternalLink,
  AlertTriangle, Map as MapIcon
} from 'lucide-react';
import { DEFAULT_PRESETS, getTodayString } from '../utils/constants';
import { calculateGeoDistance, getGoogleMapsRouteUrl, getMatrixDistance } from '../utils/distance';
import {
  loadGoogleMapsAPI,
  calculateDrivingDistance,
  buildSearchQuery
} from '../utils/googleMaps';
import FlowChart from './FlowChart';

/**
 * 記録タブ
 * リスト選択 or 手入力で移動記録を追加する
 * Google Maps距離自動算出機能付き
 * 
 * @param {{
 *   records: Array,
 *   addRecord: (record: Object) => void,
 *   settings: Object,
 *   updateSettings: (updates: Object) => void,
 *   onEdit: (record: Object) => void,
 *   onDelete: (id: string) => void
 * }} props
 */
export default function RecordTab({
  records,
  addRecord,
  settings,
  updateSettings,
  onEdit,
  onDelete,
  onReorder
}) {
  const {
    locationList,
    distanceMatrix,
    addressMap,
    useMatrix,
    historyLocations,
    baseLocation,
    googleMapsApiKey
  } = settings;

  // --- ローカルState ---
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [inputMode, setInputMode] = useState('list');
  const [targetLocation, setTargetLocation] = useState('');

  // 手入力モード用
  const [customLocationName, setCustomLocationName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [manualDistance, setManualDistance] = useState('');

  // Google Maps 自動算出用
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [calcResult, setCalcResult] = useState(null);

  // --- 計算値 ---
  const todayRecords = useMemo(() => {
    return records
      .filter(r => r.date === selectedDate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [records, selectedDate]);

  const lastRecord = todayRecords.length > 0
    ? todayRecords[todayRecords.length - 1]
    : null;

  // リストモード選択時の距離（自動計算）
  const listModeDistance = useMemo(() => {
    if (inputMode !== 'list' || !targetLocation || !lastRecord) return 0;
    if (useMatrix) {
      return getMatrixDistance(distanceMatrix, lastRecord.destination, targetLocation);
    } else {
      const preset = DEFAULT_PRESETS.find(p => p.name === targetLocation);
      if (preset && lastRecord.lat && lastRecord.lng) {
        return calculateGeoDistance(lastRecord.lat, lastRecord.lng, preset.lat, preset.lng);
      } else if (preset) {
        return calculateGeoDistance(
          baseLocation.lat, baseLocation.lng, preset.lat, preset.lng
        );
      }
      return 0;
    }
  }, [inputMode, targetLocation, lastRecord, useMatrix, distanceMatrix, baseLocation]);

  // リストモードでルートが不明か
  const isListModeRouteUnknown = useMemo(() => {
    if (inputMode !== 'list' || !targetLocation || !lastRecord) return false;
    if (useMatrix) {
      return !distanceMatrix[lastRecord.destination] ||
        !distanceMatrix[lastRecord.destination][targetLocation];
    } else {
      return !lastRecord.lat && !lastRecord.lng;
    }
  }, [inputMode, targetLocation, lastRecord, useMatrix, distanceMatrix]);

  // ルート検索URL
  const listModeRouteUrl = (lastRecord && targetLocation)
    ? getGoogleMapsRouteUrl(
        lastRecord.address, lastRecord.destination,
        addressMap[targetLocation], targetLocation
      )
    : '';

  const manualRouteUrl = lastRecord
    ? getGoogleMapsRouteUrl(
        lastRecord.address, lastRecord.destination,
        customAddress, customLocationName
      )
    : '';

  const locationOptions = useMatrix ? locationList : DEFAULT_PRESETS.map(p => p.name);

  // --- Google Maps 距離自動算出 ---
  const handleAutoCalculate = async () => {
    if (!googleMapsApiKey) return;

    let originQuery = '';
    let destQuery = '';

    if (lastRecord) {
      originQuery = buildSearchQuery(lastRecord.address, lastRecord.destination);
    } else {
      originQuery = buildSearchQuery('', baseLocation.name);
    }

    if (inputMode === 'list') {
      destQuery = buildSearchQuery(addressMap[targetLocation], targetLocation);
    } else {
      destQuery = buildSearchQuery(customAddress, customLocationName);
    }

    if (!originQuery || !destQuery) {
      setCalcError('出発地または目的地の情報が不足しています');
      return;
    }

    setIsCalculating(true);
    setCalcError('');
    setCalcResult(null);

    try {
      await loadGoogleMapsAPI(googleMapsApiKey);
      const result = await calculateDrivingDistance(originQuery, destQuery);
      setCalcResult(result);
      setManualDistance(result.distanceKm.toString());
    } catch (err) {
      setCalcError(err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  // --- 履歴選択 ---
  const handleHistorySelect = (e) => {
    const selectedName = e.target.value;
    if (!selectedName) return;
    const target = historyLocations.find(h => h.name === selectedName);
    if (target) {
      setCustomLocationName(target.name);
      setCustomAddress(target.address);
    }
  };

  // --- 記録追加 ---
  const handleAddRecord = () => {
    let locName = '';
    let locAddress = '';
    let locCoords = null;
    let method = '';
    let dist = 0;
    const fromLocName = lastRecord ? lastRecord.destination : 'Start';

    if (inputMode === 'list') {
      if (!targetLocation) return alert("場所を選択してください");
      locName = targetLocation;
      method = useMatrix ? '距離表' : 'GPS概算';

      if (useMatrix && addressMap[targetLocation]) {
        locAddress = addressMap[targetLocation];
      }

      if (!useMatrix) {
        const p = DEFAULT_PRESETS.find(pr => pr.name === targetLocation);
        if (p) locCoords = { lat: p.lat, lng: p.lng };
      }

      if (lastRecord) {
        // manualDistanceが入力されていればそちらを優先（自動算出結果も含む）
        if (manualDistance && !isNaN(parseFloat(manualDistance))) {
          dist = parseFloat(manualDistance);
          if (calcResult) {
            method = 'Google Maps';
          } else {
            method = useMatrix ? '距離表(手動補完)' : 'GPS概算(手動補完)';
          }
        } else {
          dist = listModeDistance;
        }
      } else {
        dist = 0;
        method = '開始地点';
      }

    } else {
      // 手入力モード
      if (!customLocationName) return alert("場所名を入力してください");
      locName = customLocationName;
      locAddress = customAddress;
      method = '手入力';

      if (lastRecord) {
        if (!manualDistance && manualDistance !== '0') return alert("移動距離を入力してください");
        dist = parseFloat(manualDistance);
        if (isNaN(dist)) return alert("距離は数値で入力してください");
        if (calcResult) method = 'Google Maps';
      } else {
        dist = 0;
        method = '開始地点';
      }

      // 履歴を更新
      const newHistory = [...historyLocations];
      const existingIdx = newHistory.findIndex(h => h.name === locName);
      if (existingIdx !== -1) {
        newHistory[existingIdx] = { name: locName, address: locAddress };
      } else {
        newHistory.push({ name: locName, address: locAddress });
      }
      updateSettings({ historyLocations: newHistory });
    }

    addRecord({
      date: selectedDate,
      timestamp: new Date().toISOString(),
      from: fromLocName,
      destination: locName,
      address: locAddress,
      method: method,
      distance: dist,
      lat: locCoords?.lat || null,
      lng: locCoords?.lng || null
    });

    // フォームリセット
    setTargetLocation('');
    setManualDistance('');
    setCalcResult(null);
    setCalcError('');
    if (inputMode === 'manual') {
      setCustomLocationName('');
      setCustomAddress('');
    }
  };

  // --- Google Maps 自動算出ボタンの表示条件 ---
  const canAutoCalcList = googleMapsApiKey && inputMode === 'list' && targetLocation && lastRecord;
  const canAutoCalcManual = googleMapsApiKey && inputMode === 'manual' && lastRecord && (customAddress || customLocationName);

  return (
    <div className="animate-in">
      <div className="card">
        <div className="space-y">
          {/* 記録日 */}
          <div className="form-group">
            <label className="form-label">記録日</label>
            <input
              type="date"
              className="input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* 入力モード切替 */}
          <div className="radio-group">
            <label className={`radio-label ${inputMode === 'list' ? 'radio-label--active' : ''}`}>
              <input
                type="radio"
                name="inputMode"
                value="list"
                checked={inputMode === 'list'}
                onChange={() => { setInputMode('list'); setCalcResult(null); setCalcError(''); }}
              />
              リスト選択
            </label>
            <label className={`radio-label ${inputMode === 'manual' ? 'radio-label--active' : ''}`}>
              <input
                type="radio"
                name="inputMode"
                value="manual"
                checked={inputMode === 'manual'}
                onChange={() => { setInputMode('manual'); setCalcResult(null); setCalcError(''); }}
              />
              手入力
            </label>
          </div>

          {/* ========== リスト選択モード ========== */}
          {inputMode === 'list' && (
            <div className="space-y">
              <div className="form-group">
                <label className="form-label">
                  {todayRecords.length === 0 ? "出発地を選択 (Start)" : "次の訪問先を選択"}
                </label>
                <div className="select-wrapper">
                  <select
                    className="select"
                    value={targetLocation}
                    onChange={(e) => { setTargetLocation(e.target.value); setCalcResult(null); setCalcError(''); setManualDistance(''); }}
                  >
                    <option value="">場所を選択...</option>
                    {locationOptions.map(name => (
                      <option key={`loc-${name}`} value={name}>{name}</option>
                    ))}
                  </select>
                  <List size={20} className="select-icon" />
                </div>
              </div>

              {/* 住所表示 */}
              {targetLocation && addressMap[targetLocation] && (
                <div className="info-box info-box--muted">
                  <MapIcon size={12} />
                  {addressMap[targetLocation]}
                </div>
              )}

              {/* 距離プレビュー */}
              {todayRecords.length > 0 && targetLocation && (
                <>
                  <div className="distance-display">
                    <span className="distance-display__from">
                      {lastRecord.destination} から
                    </span>
                    <div>
                      <span className="distance-display__value">
                        {calcResult ? calcResult.distanceKm : listModeDistance}
                      </span>
                      <span className="distance-display__unit">km</span>
                    </div>
                  </div>

                  {/* 自動算出結果の所要時間 */}
                  {calcResult && (
                    <div className="auto-calc__result">
                      <span style={{ fontSize: '0.75rem', color: 'var(--success-700)' }}>
                        ✅ Google Maps算出済み
                      </span>
                      <span className="auto-calc__result-duration">
                        🕐 {calcResult.durationText}
                      </span>
                    </div>
                  )}

                  {/* ルート不明時の警告 + Google Maps自動算出 */}
                  {(isListModeRouteUnknown || canAutoCalcList) && !calcResult && (
                    <div className={isListModeRouteUnknown ? 'unknown-route' : 'auto-calc'}>
                      {isListModeRouteUnknown && (
                        <p className="unknown-route__title">
                          ⚠️ 距離データがありません
                        </p>
                      )}

                      {/* Google Maps 自動算出ボタン */}
                      {googleMapsApiKey && (
                        <button
                          className={`auto-calc__btn ${isCalculating ? 'auto-calc__btn--loading' : ''}`}
                          onClick={handleAutoCalculate}
                          disabled={isCalculating}
                          style={isListModeRouteUnknown ? { marginBottom: '0.5rem' } : {}}
                        >
                          {isCalculating ? (
                            <><span className="spinner" /> 計算中...</>
                          ) : (
                            <>🚗 距離を自動算出</>
                          )}
                        </button>
                      )}

                      {calcError && (
                        <div className="auto-calc__error">
                          <AlertTriangle size={14} /> {calcError}
                        </div>
                      )}

                      {/* ルート検索リンク */}
                      <a
                        href={listModeRouteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="route-link route-link--active"
                        style={{ marginTop: '0.35rem' }}
                      >
                        <Car size={16} />
                        Google Mapで確認
                      </a>

                      {/* 手動入力フォールバック */}
                      {isListModeRouteUnknown && (
                        <div className="form-group" style={{ marginTop: '0.5rem' }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.65rem' }}>
                            距離を手入力 (km)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              className="input input--distance"
                              value={manualDistance}
                              onChange={(e) => setManualDistance(e.target.value)}
                              placeholder="0.0"
                            />
                            <span className="input-suffix">km</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ========== 手入力モード ========== */}
          {inputMode === 'manual' && (
            <div className="space-y">
              <div className="guide-box">
                訪問先の名称・住所・距離を入力します。
                Google Mapsのリンクまたは自動算出を活用してください。
              </div>

              {/* 履歴から選択 */}
              {historyLocations.length > 0 && (
                <div className="history-select">
                  <label className="history-select__label">
                    <History size={12} /> 過去の履歴から自動入力
                  </label>
                  <select
                    className="input"
                    onChange={handleHistorySelect}
                    defaultValue=""
                  >
                    <option value="" disabled>履歴から選択...</option>
                    {historyLocations.map((h, i) => (
                      <option key={i} value={h.name}>{h.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 訪問先名 */}
              <div className="form-group">
                <label className="form-label">訪問先名（必須）</label>
                <input
                  type="text"
                  className="input"
                  value={customLocationName}
                  onChange={(e) => setCustomLocationName(e.target.value)}
                  placeholder="例: 株式会社〇〇、Aビル"
                />
              </div>

              {/* 住所 */}
              <div className="form-group">
                <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                  <label className="form-label">住所（任意）</label>
                  <a
                    href="https://www.google.com/maps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline btn--sm"
                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                  >
                    <ExternalLink size={12} /> Google Mapを開く
                  </a>
                </div>
                <input
                  type="text"
                  className="input"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="東京都〇〇区..."
                />
              </div>

              {/* 距離入力（前回の記録がある場合のみ） */}
              {todayRecords.length > 0 && (
                <div style={{ paddingTop: '0.5rem', borderTop: '1px dashed var(--gray-200)' }}>
                  <label className="form-label">
                    移動距離 (km) - 前回: <strong>{lastRecord.destination}</strong>
                    {lastRecord.address && (
                      <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>
                        {' '}({lastRecord.address})
                      </span>
                    )} から
                  </label>

                  {/* Google Maps 自動算出 */}
                  {canAutoCalcManual && (
                    <div className="auto-calc" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      <button
                        className={`auto-calc__btn ${isCalculating ? 'auto-calc__btn--loading' : ''}`}
                        onClick={handleAutoCalculate}
                        disabled={isCalculating}
                      >
                        {isCalculating ? (
                          <><span className="spinner" /> 計算中...</>
                        ) : (
                          <>🚗 距離を自動算出</>
                        )}
                      </button>
                      {calcResult && (
                        <div className="auto-calc__result">
                          <span className="auto-calc__result-value">
                            {calcResult.distanceKm} km
                          </span>
                          <span className="auto-calc__result-duration">
                            🕐 {calcResult.durationText}
                          </span>
                        </div>
                      )}
                      {calcError && (
                        <div className="auto-calc__error">
                          <AlertTriangle size={14} /> {calcError}
                        </div>
                      )}
                    </div>
                  )}

                  {!googleMapsApiKey && (
                    <div className="auto-calc__no-key" style={{ marginTop: '0.35rem', marginBottom: '0.35rem' }}>
                      💡 設定タブでGoogle Maps APIキーを登録すると距離を自動算出できます
                    </div>
                  )}

                  {/* ルート検索リンク */}
                  <a
                    href={manualRouteUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`route-link ${
                      (customAddress || customLocationName) ? 'route-link--active' : 'route-link--disabled'
                    }`}
                    onClick={(e) => !(customAddress || customLocationName) && e.preventDefault()}
                    style={{ marginBottom: '0.5rem' }}
                  >
                    <Car size={16} />
                    Google Mapでルート検索 (距離確認)
                  </a>

                  {/* 距離入力フィールド */}
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      className="input input--distance"
                      value={manualDistance}
                      onChange={(e) => setManualDistance(e.target.value)}
                      placeholder="0.0"
                    />
                    <span className="input-suffix">km</span>
                  </div>
                  <p className="form-helper">
                    ※Googleマップで表示された距離を入力、または自動算出をご利用ください
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 記録ボタン */}
          <button
            className="btn btn--primary btn--block"
            onClick={handleAddRecord}
          >
            <Plus size={20} />
            {todayRecords.length === 0 ? "出発地点を記録" : "この場所を記録"}
          </button>
        </div>
      </div>

      {/* フローチャート */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <FlowChart
          dayRecords={todayRecords}
          baseLocation={baseLocation}
          onEdit={onEdit}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      </div>
    </div>
  );
}
