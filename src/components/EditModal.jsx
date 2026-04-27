import React, { useState, useEffect } from 'react';
import { Edit, X, Check, Car, AlertTriangle, List } from 'lucide-react';
import { DEFAULT_PRESETS } from '../utils/constants';
import { calculateGeoDistance, getGoogleMapsRouteUrl, getMatrixDistance } from '../utils/distance';
import {
  loadGoogleMapsAPI,
  calculateDrivingDistance,
  buildSearchQuery
} from '../utils/googleMaps';

/**
 * 記録編集モーダル
 * リスト選択 or 手入力で記録内容を編集できる
 * Google Maps距離自動算出にも対応
 * 
 * @param {{
 *   record: Object,
 *   settings: Object,
 *   onSave: (id: string, data: Object) => void,
 *   onClose: () => void
 * }} props
 */
export default function EditModal({ record, settings, onSave, onClose }) {
  const { locationList, distanceMatrix, addressMap, useMatrix, googleMapsApiKey } = settings;

  const [editMode, setEditMode] = useState('list');
  const [formData, setFormData] = useState({
    destination: '',
    address: '',
    distance: 0,
    method: ''
  });
  const [listSelection, setListSelection] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');

  // 初期化
  useEffect(() => {
    if (record) {
      setFormData({
        destination: record.destination || '',
        address: record.address || '',
        distance: record.distance || 0,
        method: record.method || ''
      });

      // 既知の場所かどうかで初期モードを決定
      const knownInList = locationList.includes(record.destination) ||
        DEFAULT_PRESETS.some(p => p.name === record.destination);
      setEditMode(knownInList ? 'list' : 'manual');
      if (knownInList) setListSelection(record.destination);
    }
  }, [record, locationList]);

  // リスト選択時の距離自動計算
  useEffect(() => {
    if (editMode === 'list' && listSelection && record) {
      const newDest = listSelection;
      let newAddr = '';
      let newDist = 0;
      let newMethod = '編集(リスト)';

      if (useMatrix && addressMap[newDest]) {
        newAddr = addressMap[newDest];
      }

      const prevRec = record.prevRecord;
      if (prevRec) {
        if (useMatrix) {
          newDist = getMatrixDistance(distanceMatrix, prevRec.destination, newDest);
          newMethod = '編集(距離表)';
        } else {
          const p = DEFAULT_PRESETS.find(pr => pr.name === newDest);
          const prevLat = prevRec.lat || null;
          const prevLng = prevRec.lng || null;

          if (p && prevLat && prevLng) {
            newDist = calculateGeoDistance(prevLat, prevLng, p.lat, p.lng);
            newMethod = '編集(GPS)';
          }
        }
      }

      setFormData(prev => ({
        ...prev,
        destination: newDest,
        address: newAddr,
        distance: newDist,
        method: newMethod
      }));
    }
  }, [listSelection, editMode]);

  // Google Maps で距離を自動算出
  const handleAutoCalculate = async () => {
    if (!googleMapsApiKey) return;

    const prevRec = record.prevRecord;
    if (!prevRec) return;

    const origin = buildSearchQuery(prevRec.address, prevRec.destination);
    const destination = buildSearchQuery(formData.address, formData.destination);

    if (!origin || !destination) {
      setCalcError('出発地または目的地の情報が不足しています');
      return;
    }

    setIsCalculating(true);
    setCalcError('');

    try {
      await loadGoogleMapsAPI(googleMapsApiKey);
      const result = await calculateDrivingDistance(origin, destination);
      setFormData(prev => ({
        ...prev,
        distance: result.distanceKm,
        method: '編集(Google Maps)'
      }));
    } catch (err) {
      setCalcError(err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const prevName = record.prevRecord ? record.prevRecord.destination : 'Start';
  const prevAddr = record.prevRecord ? record.prevRecord.address : '';
  const mapUrl = getGoogleMapsRouteUrl(prevAddr, prevName, formData.address, formData.destination);

  const locationOptions = useMatrix ? locationList : DEFAULT_PRESETS.map(p => p.name);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="modal__header">
          <h3 className="modal__title">
            <Edit size={20} style={{ color: 'var(--primary-600)' }} />
            記録を編集
          </h3>
          <button className="modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* モード切替 */}
        <div className="mode-switch">
          <button
            className={`mode-switch__btn ${editMode === 'list' ? 'mode-switch__btn--active' : ''}`}
            onClick={() => setEditMode('list')}
          >
            リスト選択
          </button>
          <button
            className={`mode-switch__btn ${editMode === 'manual' ? 'mode-switch__btn--active' : ''}`}
            onClick={() => setEditMode('manual')}
          >
            手入力
          </button>
        </div>

        {/* フォーム */}
        <div className="modal__body">
          {editMode === 'list' ? (
            <div className="form-group">
              <label className="form-label">場所を選択</label>
              <div className="select-wrapper">
                <select
                  className="select"
                  value={listSelection}
                  onChange={(e) => setListSelection(e.target.value)}
                >
                  <option value="">場所を選択...</option>
                  {locationOptions.map(name => (
                    <option key={`edit-${name}`} value={name}>{name}</option>
                  ))}
                </select>
                <List size={16} className="select-icon" />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">訪問先名</label>
              <input
                type="text"
                className="input"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">住所</label>
            <input
              type="text"
              className="input"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              readOnly={editMode === 'list'}
              style={editMode === 'list' ? { background: 'var(--gray-50)', color: 'var(--gray-600)' } : {}}
            />
          </div>

          <hr className="divider" />

          <div className="form-group">
            <label className="form-label">
              移動距離 (km) - <strong>{prevName}</strong> から
            </label>

            {/* Google Map ルート確認リンク */}
            <a
              href={mapUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`route-link ${formData.destination ? 'route-link--active' : 'route-link--disabled'}`}
              onClick={(e) => !formData.destination && e.preventDefault()}
            >
              <Car size={16} />
              Google Mapでルート確認
            </a>

            {/* Google Maps 自動算出 */}
            {googleMapsApiKey && (
              <div className="auto-calc" style={{ marginTop: '0.5rem' }}>
                <button
                  className={`auto-calc__btn ${
                    isCalculating ? 'auto-calc__btn--loading' : ''
                  } ${
                    !formData.destination ? 'auto-calc__btn--disabled' : ''
                  }`}
                  onClick={handleAutoCalculate}
                  disabled={isCalculating || !formData.destination}
                >
                  {isCalculating ? (
                    <>
                      <span className="spinner" />
                      計算中...
                    </>
                  ) : (
                    <>🚗 距離を自動算出</>
                  )}
                </button>
                {calcError && (
                  <div className="auto-calc__error">
                    <AlertTriangle size={14} />
                    {calcError}
                  </div>
                )}
              </div>
            )}

            {/* 距離入力フィールド */}
            <div className="relative" style={{ marginTop: '0.5rem' }}>
              <input
                type="number"
                step="0.1"
                className="input input--distance"
                value={formData.distance}
                onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
              />
              <span className="input-suffix">km</span>
            </div>

            {editMode === 'list' && formData.distance === 0 && (
              <p className="form-helper" style={{ color: 'var(--warning-600)' }}>
                <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                自動計算できませんでした。手動で入力してください。
              </p>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn btn--primary"
            onClick={() => onSave(record.id, formData)}
          >
            <Check size={16} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
