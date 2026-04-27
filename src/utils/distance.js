// ============================================
// 距離計算ユーティリティ
// ============================================

/**
 * 2点間の直線距離を計算する (Haversine formula)
 * @param {number} lat1 - 出発地の緯度
 * @param {number} lng1 - 出発地の経度
 * @param {number} lat2 - 到着地の緯度
 * @param {number} lng2 - 到着地の経度
 * @returns {number} 距離 (km, 小数点第2位まで)
 */
export const calculateGeoDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  const R = 6371; // 地球の半径 (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

/**
 * Google Maps のルート検索URLを生成する
 * @param {string} fromAddress - 出発地の住所
 * @param {string} fromName - 出発地の名称
 * @param {string} toAddress - 到着地の住所
 * @param {string} toName - 到着地の名称
 * @returns {string} Google Maps URL
 */
export const getGoogleMapsRouteUrl = (fromAddress, fromName, toAddress, toName) => {
  // 検索精度向上のため「名称 住所」の形式でクエリを構築
  const buildQuery = (addr, name) => {
    const parts = [];
    if (name) parts.push(name);
    if (addr) parts.push(addr);
    return parts.join(' ');
  };

  const origin = buildQuery(fromAddress, fromName);
  const destination = buildQuery(toAddress, toName);

  if (!origin || !destination) return '';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
};

/**
 * 距離マトリクスから2地点間の距離を取得する
 * @param {Object} distanceMatrix - 距離マトリクスオブジェクト
 * @param {string} from - 出発地名
 * @param {string} to - 到着地名
 * @returns {number} 距離 (km)
 */
export const getMatrixDistance = (distanceMatrix, from, to) => {
  if (distanceMatrix && distanceMatrix[from] && distanceMatrix[from][to] !== undefined) {
    return distanceMatrix[from][to];
  }
  return 0;
};
