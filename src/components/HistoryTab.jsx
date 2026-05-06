import React, { useState, useMemo } from 'react';
import { Calendar, Download, ArrowRight, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayString } from '../utils/constants';
import { exportToXLSX } from '../utils/excel';
import { 
  format, 
  parseISO, 
  addMonths, 
  subMonths, 
  startOfDay,
  eachDayOfInterval,
  isSameDay,
  isSameMonth
} from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * 履歴タブ
 * 16日～15日の期間カレンダー、記録表示、Excelエクスポート
 * 
 * @param {{
 *   records: Array,
 *   onEdit: (record: Object) => void,
 *   onDelete: (id: string) => void
 * }} props
 */
export default function HistoryTab({ records, onEdit, onDelete, selectedDate, onDateSelect, onMoveToRecord }) {
  // 現在の「対象月（締め月）」の基準日（何月の15日締めかを示すために15日を基準にする）
  const [currentPeriod, setCurrentPeriod] = useState(() => {
    const today = new Date();
    // 16日以降なら来月の15日締め、15日までなら今月の15日締めとする。
    if (today.getDate() >= 16) {
      return addMonths(new Date(today.getFullYear(), today.getMonth(), 15), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 15);
  });

  const [isExporting, setIsExporting] = useState(false);

  // 16日〜15日の期間を計算
  const periodStart = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth() - 1, 16);
  const periodEnd = new Date(currentPeriod.getFullYear(), currentPeriod.getMonth(), 15);

  const filterStartDateStr = format(periodStart, 'yyyy-MM-dd');
  const filterEndDateStr = format(periodEnd, 'yyyy-MM-dd');

  // 表示するカレンダーの日付リスト
  const calendarDays = useMemo(() => {
    return eachDayOfInterval({ start: periodStart, end: periodEnd });
  }, [periodStart, periodEnd]);

  // 期間内の全記録（日毎にグループ化して距離を計算するため）
  const periodRecords = useMemo(() => {
    return records
      .filter(r => r.date >= filterStartDateStr && r.date <= filterEndDateStr)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [records, filterStartDateStr, filterEndDateStr]);

  // 日付ごとの合計距離マップ { '2023-10-01': 15.5, ... }
  const dailyDistanceMap = useMemo(() => {
    const map = {};
    periodRecords.forEach(r => {
      if (!map[r.date]) map[r.date] = 0;
      map[r.date] += r.distance;
    });
    return map;
  }, [periodRecords]);

  // 選択された日付の記録
  const selectedDateRecords = useMemo(() => {
    return records
      .filter(r => r.date === selectedDate)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [records, selectedDate]);

  // 期間合計距離
  const periodTotalDistance = useMemo(() => {
    const total = periodRecords
      .reduce((sum, r) => sum + r.distance, 0);
    return Math.round(total);
  }, [periodRecords]);

  // 前月/次月への移動
  const handlePrevPeriod = () => setCurrentPeriod(prev => subMonths(prev, 1));
  const handleNextPeriod = () => setCurrentPeriod(prev => addMonths(prev, 1));

  // Excelエクスポート
  const handleExport = async () => {
    if (periodRecords.length === 0) return;
    setIsExporting(true);
    try {
      await exportToXLSX(periodRecords, filterStartDateStr, filterEndDateStr);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Excelファイルの生成に失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const periodTitle = `${format(currentPeriod, 'yyyy年M月', { locale: ja })}度 (16日～15日)`;

  return (
    <div className="animate-in space-y">
      {/* 期間集計カード */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="flex-between mb-sm">
          <h3 className="card__title" style={{ marginBottom: 0 }}>
            <Calendar size={16} className="card__title-icon" />
            {periodTitle}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="icon-btn" onClick={handlePrevPeriod}><ChevronLeft size={16} /></button>
            <button className="icon-btn" onClick={handleNextPeriod}><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* カレンダーグリッド */}
        <div className="calendar-container">
          <div className="calendar-grid">
            {['日', '月', '火', '水', '木', '金', '土'].map(day => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
            
            {/* 月の最初の日の曜日まで空白を埋める */}
            {Array.from({ length: periodStart.getDay() }).map((_, i) => (
              <div key={`empty-start-${i}`} className="calendar-day empty-cell"></div>
            ))}

            {calendarDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasRecords = dailyDistanceMap[dateStr] !== undefined;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === getTodayString();
              
              let classes = "calendar-day";
              if (isSelected) classes += " calendar-day--selected";
              else if (hasRecords) classes += " calendar-day--active";
              else classes += " calendar-day--empty";
              
              if (isToday) classes += " calendar-day--today";

              return (
                <div 
                  key={dateStr} 
                  className={classes}
                  onClick={() => onDateSelect(dateStr)}
                >
                  <span className="calendar-day__num">{format(day, 'd')}</span>
                  {hasRecords && (
                    <span className="calendar-day__dist">{Math.round(dailyDistanceMap[dateStr])}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="period-summary" style={{ marginTop: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
          <span className="period-summary__label">期間合計距離</span>
          <span className="period-summary__value">
            {periodTotalDistance}
            <span className="period-summary__unit"> km</span>
          </span>
        </div>

        <button
          className={`btn btn--block ${periodRecords.length === 0 ? 'btn--disabled btn--ghost' : 'btn--success'}`}
          onClick={handleExport}
          disabled={periodRecords.length === 0 || isExporting}
        >
          <Download size={16} />
          {isExporting ? 'エクスポート中...' : 'Excelエクスポート'}
        </button>
      </div>

      {/* 選択された日の記録一覧 */}
      <div className="space-y-sm">
        <h4 style={{ fontSize: '0.9rem', color: 'var(--gray-700)', padding: '0 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{format(parseISO(selectedDate), 'M月d日 (E)', { locale: ja })} の記録</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {dailyDistanceMap[selectedDate] > 0 && (
              <span style={{ color: 'var(--primary-600)', fontWeight: 700 }}>{Math.round(dailyDistanceMap[selectedDate])} km</span>
            )}
            <button 
              className="btn btn--primary" 
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', minHeight: 'auto' }}
              onClick={onMoveToRecord}
            >
              変更
            </button>
          </div>
        </h4>

        {selectedDateRecords.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: 'var(--gray-400)',
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--gray-300)'
          }}>
            <p>この日の記録はありません</p>
          </div>
        ) : (
          selectedDateRecords.map((record) => (
            <div key={record.id} className="record-item">
              <div>
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
