import React from 'react';
import { Navigation } from 'lucide-react';

/**
 * ヘッダーコンポーネント
 * アプリタイトルと今日の走行距離を表示する
 * 
 * @param {{ todayTotalDistance: string }} props
 */
export default function Header({ todayTotalDistance }) {
  return (
    <header className="header">
      <div className="header__content">
        <h1 className="header__title">
          <Navigation size={24} />
          Mileage Record
        </h1>
        <div className="header__stat">
          <p className="header__stat-label">今日の移動</p>
          <p className="header__stat-value">
            {todayTotalDistance}
            <span className="header__stat-unit"> km</span>
          </p>
        </div>
      </div>
    </header>
  );
}
