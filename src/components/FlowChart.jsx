import React from 'react';
import {
  ArrowRight, MapPin, PlayCircle, ExternalLink,
  Edit, Trash2, GripVertical
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * ドラッグ可能な個別ノードコンポーネント
 */
function SortableFlowNode({ record, idx, sorted, baseLocation, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: record.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1
  };

  const isFirst = idx === 0;
  const isLast = idx === sorted.length - 1;

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

  const mapLink = getMapLink(record);

  // 編集時に前回のレコード情報を付与
  const prevRec = idx > 0
    ? sorted[idx - 1]
    : {
        destination: baseLocation.name,
        address: '',
        lat: baseLocation.lat,
        lng: baseLocation.lng
      };
  const recordForEdit = { ...record, prevRecord: prevRec };

  return (
    <div ref={setNodeRef} style={style} className="flow__step">
      {/* === 出発地点 === */}
      {isFirst && (
        <div className="flow__node">
          {/* ドラッグハンドル */}
          <div className="flow__drag-handle" {...attributes} {...listeners}>
            <GripVertical size={16} />
          </div>
          <div className="flow__node-icon flow__node-icon--start">
            <PlayCircle size={20} />
          </div>
          <div className="flow__node-content">
            <div className="flex-between">
              <div>
                <div className="flow__node-label">Start</div>
                <div className="flow__node-name">{record.destination}</div>
                {record.address && (
                  <div className="flow__node-address">{record.address}</div>
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
                  onClick={() => onDelete(record.id)}
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
            <span>↓ {record.distance} km</span>
          </div>

          <div className="flow__node">
            {/* ドラッグハンドル */}
            <div className="flow__drag-handle" {...attributes} {...listeners}>
              <GripVertical size={16} />
            </div>
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
                  <div className="flow__node-name">{record.destination}</div>
                  {record.address && (
                    <div className="flow__node-address">{record.address}</div>
                  )}
                  <div className="flow__node-meta">
                    <span>
                      {record.timestamp.split('T')[1]?.substring(0, 5) || ''}
                    </span>
                    <span>• {record.method}</span>
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
                    onClick={() => onDelete(record.id)}
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
}

/**
 * 当日の移動フローチャート（ドラッグ＆ドロップ並べ替え対応）
 * タイムライン形式で訪問先と距離を表示する
 * 
 * @param {{
 *   dayRecords: Array,
 *   baseLocation: Object,
 *   onEdit: (record: Object) => void,
 *   onDelete: (id: string) => void,
 *   onReorder: (activeId: string, overId: string) => void
 * }} props
 */
export default function FlowChart({ dayRecords, baseLocation, onEdit, onDelete, onReorder }) {
  // タッチ・マウス両対応のセンサー設定
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 } // 8px動かして初めてドラッグ開始
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 } // 200ms長押しでドラッグ開始
  });
  const sensors = useSensors(pointerSensor, touchSensor);

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

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      onReorder(active.id, over.id);
    }
  };

  return (
    <div className="flow">
      <h3 className="flow__title">
        <ArrowRight size={16} />
        当日の移動フロー
        <span className="flow__title-hint">⠿ ドラッグで並べ替え</span>
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sorted.map(r => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flow__container">
            {/* タイムライン縦線 */}
            <div className="flow__timeline" />

            {sorted.map((rec, idx) => (
              <SortableFlowNode
                key={rec.id}
                record={rec}
                idx={idx}
                sorted={sorted}
                baseLocation={baseLocation}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 合計距離 */}
      {sorted.length > 1 && (
        <div className="flow__total">
          <span className="flow__total-label">本日の総移動距離:</span>
          <span className="flow__total-value">
            {Math.round(sorted.reduce((sum, r) => sum + r.distance, 0))}
          </span>
          <span className="flow__total-unit"> km</span>
        </div>
      )}
    </div>
  );
}
