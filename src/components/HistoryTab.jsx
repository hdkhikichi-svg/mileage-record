import React, { useState, useMemo } from 'react';
import { Calendar, Download, ArrowRight, Edit, Trash2 } from 'lucide-react';
import { getTodayString } from '../utils/constants';
import { exportToXLSX } from '../utils/excel';

/**
 * 履歴タブ
 * 期間集計、記録一覧表示、Excelエクスポート
 * 
 * @param {{
 *   records: Array,
 *   onEdit: (record: Object) => void,
 *   onDelete: (id: string) => void
 * }} props
 */
export default function HistoryTab({ records, onEdit, onDelete }) {
  const [filterStartDate, setFilterStartDate] = useState(getTodayString());
  const [filterEndDate, setFilterEndDate] = useState(getTodayString());
  const [isExporting, setIsExporting] = useState(false);

  // フィルタリング済み記録
  const filteredRecords = useMemo(() => {
    return records
      .filter(r => r.date >= filterStartDate && r.date <= filterEndDate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [records, filterStartDate, filterEndDate]);

  // 期間合計距離
  const periodTotalDistance = useMemo(() => {
    return filteredRecords
      .reduce((sum, r) => sum + r.distance, 0)
      .toFixed(2);
  }, [filteredRecords]);

  // Excelエクスポート
  const handleExport = async () => {
    if (filteredRecords.length === 0) return;
    setIsExporting(true);
    try {
      await exportToXLSX(filteredRecords, filterStartDate, filterEndDate);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Excelファイルの生成に失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-in space-y">
      {/* 期間集計カード */}
      <div className="card">
        <h3 className="card__title">
          <Calendar size={16} className="card__title-icon" />
          期間集計
        </h3>

        <div className="date-filter">
          <div className="form-group">
            <label className="form-label">開始日</label>
            <input
              type="date"
              className="input"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">終了日</label>
            <input
              type="date"
              className="input"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="period-summary" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <span className="period-summary__label">合計距離</span>
          <span className="period-summary__value">
            {periodTotalDistance}
            <span className="period-summary__unit"> km</span>
          </span>
        </div>

        <button
          className={`btn btn--block ${filteredRecords.length === 0 ? 'btn--disabled btn--ghost' : 'btn--success'}`}
          onClick={handleExport}
          disabled={filteredRecords.length === 0 || isExporting}
        >
          <Download size={16} />
          {isExporting ? 'エクスポート中...' : 'Excelエクスポート'}
        </button>
      </div>

      {/* 記録一覧 */}
      <div className="space-y-sm">
        {filteredRecords.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: 'var(--gray-400)'
          }}>
            <p>記録はありません</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div key={record.id} className="record-item">
              <div>
                <div className="record-item__date">{record.date}</div>
                <div className="record-item__route">
                  {record.distance === 0 ? (
                    <span className="record-item__route--start">
                      Start: {record.destination}
                    </span>
                  ) : (
                    <>
                      {record.from}
                      <ArrowRight size={12} style={{ color: 'var(--gray-400)' }} />
                      {record.destination}
                    </>
                  )}
                </div>
                {record.address && (
                  <div className="record-item__address">{record.address}</div>
                )}
              </div>
              <div className="record-item__right">
                <span className="record-item__distance">
                  {record.distance} km
                </span>
                <div className="record-item__actions">
                  <button
                    className="icon-btn"
                    onClick={() => onEdit({ ...record, prevRecord: { destination: record.from } })}
                    title="編集"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="icon-btn icon-btn--danger"
                    onClick={() => onDelete(record.id)}
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
