import React from 'react';
import { ArrowRight, MapPin, PlayCircle, ExternalLink, Edit, Trash2 } from 'lucide-react';

/**
 * 当日の移動フローチャート
 * タイムライン形式で訪問先と距離を表示する
 * 
 * @param {{
 *   dayRecords: Array,
 *   baseLocation: Object,
 *   onEdit: (record: Object) => void,
 *   onDelete: (id: string) => void
 * }} props
 */
export default function FlowChart({ dayRecords, baseLocation, onEdit, onDelete }) {
  if (!dayRecords || dayRecords.length === 0) {
    return (
      <div className="flow__empty">
        今日の移動はまだ記録されていません
      </div>
    );
  }

  const sorted = [...dayRecords].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Google Map検索用URLを生成
  const getMapLink = (rec) => {
    if (rec.lat && rec.lng) {
      return `https://www.google.com/maps?q=${rec.lat},${rec.lng}`;
    }
    if (rec.address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rec.address)}`;
    }
    return null;
  };

  return (
    <div className="flow">
      <h3 className="flow__title">
        <ArrowRight size={16} />
        当日の移動フロー
      </h3>
      <div className="flow__container">
        {/* タイムライン縦線 */}
        <div className="flow__timeline" />

        {sorted.map((rec, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;
          const mapLink = getMapLink(rec);

          // 編集時に前回のレコード情報を付与
          const prevRec = idx > 0
            ? sorted[idx - 1]
            : {
                destination: baseLocation.name,
                address: '',
                lat: baseLocation.lat,
                lng: baseLocation.lng
              };
          const recordForEdit = { ...rec, prevRecord: prevRec };

          return (
            <div key={rec.id} className="flow__step">
              {/* === 出発地点 === */}
              {isFirst && (
                <div className="flow__node">
                  <div className="flow__node-icon flow__node-icon--start">
                    <PlayCircle size={20} />
                  </div>
                  <div className="flow__node-content">
                    <div className="flex-between">
                      <div>
                        <div className="flow__node-label">Start</div>
                        <div className="flow__node-name">{rec.destination}</div>
                        {rec.address && (
                          <div className="flow__node-address">{rec.address}</div>
                        )}
                        <div className="flow__node-meta">
                          <span>出発地点</span>
                        </div>
                      </div>
                      <div className="flow__node-actions">
                        <button
                          className="icon-btn"
                          onClick={() => onEdit(recordForEdit)}
                          title="編集"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="icon-btn icon-btn--danger"
                          onClick={() => onDelete(rec.id)}
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === 中間・終了地点 === */}
              {!isFirst && (
                <>
                  {/* 距離バッジ */}
                  <div className="flow__distance-badge">
                    <span>↓ {rec.distance} km</span>
                  </div>

                  <div className="flow__node">
                    <div
                      className={`flow__node-icon ${
                        isLast ? 'flow__node-icon--end' : 'flow__node-icon--mid'
                      }`}
                    >
                      <MapPin size={20} />
                    </div>
                    <div className="flow__node-content">
                      <div className="flex-between">
                        <div>
                          <div className="flow__node-name">{rec.destination}</div>
                          {rec.address && (
                            <div className="flow__node-address">{rec.address}</div>
                          )}
                          <div className="flow__node-meta">
                            <span>
                              {rec.timestamp.split('T')[1]?.substring(0, 5) || ''}
                            </span>
                            <span>• {rec.method}</span>
                            {mapLink && (
                              <a
                                href={mapLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink size={12} /> Map
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flow__node-actions">
                          <button
                            className="icon-btn"
                            onClick={() => onEdit(recordForEdit)}
                            title="編集"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="icon-btn icon-btn--danger"
                            onClick={() => onDelete(rec.id)}
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* 合計距離 */}
        {sorted.length > 1 && (
          <div className="flow__total">
            <span className="flow__total-label">本日の総移動距離:</span>
            <span className="flow__total-value">
              {sorted.reduce((sum, r) => sum + r.distance, 0).toFixed(2)}
            </span>
            <span className="flow__total-unit"> km</span>
          </div>
        )}
      </div>
    </div>
  );
}
