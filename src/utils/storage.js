// ============================================
// localStorage 永続化モジュール
// ============================================

const RECORDS_KEY = 'mileage-records';
const SETTINGS_KEY = 'mileage-settings';

// --- 記録データ ---

/**
 * 記録データを読み込む
 * @returns {Array} 記録の配列（タイムスタンプ順）
 */
export const loadRecords = () => {
  try {
    const data = localStorage.getItem(RECORDS_KEY);
    if (!data) return [];
    const records = JSON.parse(data);
    records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return records;
  } catch {
    return [];
  }
};

/**
 * 記録データを保存する
 * @param {Array} records - 記録の配列
 */
export const saveRecords = (records) => {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
};

// --- 設定データ ---

/**
 * 設定データを読み込む
 * @returns {Object|null} 設定オブジェクト
 */
export const loadSettings = () => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/**
 * 設定データを保存する
 * @param {Object} settings - 設定オブジェクト
 */
export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// --- ユニークID生成 ---

/**
 * ユニークIDを生成する（タイムスタンプ + ランダム文字列）
 * @returns {string} ユニークID
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
