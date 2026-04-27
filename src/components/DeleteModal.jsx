import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * 削除確認モーダル
 * 
 * @param {{ onConfirm: () => void, onClose: () => void }} props
 */
export default function DeleteModal({ onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--delete" onClick={(e) => e.stopPropagation()}>
        <div className="modal__delete-icon">
          <Trash2 size={24} />
        </div>
        <h3 className="modal__title" style={{ justifyContent: 'center' }}>
          記録を削除しますか？
        </h3>
        <p className="modal__delete-text">この操作は取り消せません。</p>
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn--danger" onClick={onConfirm}>
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
