// ============================================
// 定数・デフォルトデータ
// ============================================

// デフォルトの基準点（会社）
export const DEFAULT_BASE_LOCATION = {
  name: "東京本社",
  lat: 35.681236,
  lng: 139.767125
};

// デフォルトのサンプル地点リスト（CSV未読み込み時に使用）
export const DEFAULT_PRESETS = [
  { name: "新宿支店", lat: 35.690921, lng: 139.700258 },
  { name: "渋谷営業所", lat: 35.658034, lng: 139.701636 },
  { name: "池袋倉庫", lat: 35.729503, lng: 139.710900 },
  { name: "横浜工場", lat: 35.443708, lng: 139.638026 },
  { name: "大宮オフィス", lat: 35.906509, lng: 139.622178 },
];

// 今日の日付文字列を返す (YYYY-MM-DD)
export const getTodayString = () => new Date().toISOString().split('T')[0];
