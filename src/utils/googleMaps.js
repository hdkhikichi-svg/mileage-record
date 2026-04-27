// ============================================
// Google Maps API 統合モジュール
// 距離の自動算出機能を提供する
// ============================================

let isLoaded = false;
let loadPromise = null;

/**
 * Google Maps JavaScript API を動的に読み込む
 * @param {string} apiKey - Google Maps APIキー
 * @returns {Promise<void>}
 */
export const loadGoogleMapsAPI = (apiKey) => {
  if (!apiKey) return Promise.reject(new Error('APIキーが設定されていません'));
  if (isLoaded && window.google && window.google.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // 既存のスクリプトタグがあれば削除（APIキー変更時対応）
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isLoaded = true;
      resolve();
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Google Maps APIの読み込みに失敗しました。APIキーを確認してください。'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
};

/**
 * Google Maps API が読み込み済みかチェック
 * @returns {boolean}
 */
export const isGoogleMapsLoaded = () => {
  return isLoaded && window.google && window.google.maps;
};

/**
 * APIキー変更時にリセット（再読み込みを可能にする）
 */
export const resetGoogleMapsAPI = () => {
  isLoaded = false;
  loadPromise = null;
  const existing = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existing) existing.remove();
};

/**
 * Google Maps Directions API を使って実際の走行距離を計算する
 * 住所テキストから自動でルート検索し、道なりの走行距離を返す
 * 
 * @param {string} originQuery - 出発地（住所 or 地名）
 * @param {string} destinationQuery - 目的地（住所 or 地名）
 * @returns {Promise<{ distanceKm: number, distanceText: string, durationText: string, startAddress: string, endAddress: string }>}
 */
export const calculateDrivingDistance = (originQuery, destinationQuery) => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps) {
      reject(new Error('Google Maps APIが読み込まれていません'));
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: originQuery,
        destination: destinationQuery,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK' && result.routes.length > 0) {
          const leg = result.routes[0].legs[0];
          resolve({
            distanceKm: Math.round(leg.distance.value / 10) / 100,  // メートル → km（小数第2位）
            distanceText: leg.distance.text,                          // "12.3 km" 形式
            durationText: leg.duration.text,                          // "約15分" 形式
            startAddress: leg.start_address,                          // 正規化された出発地住所
            endAddress: leg.end_address                               // 正規化された目的地住所
          });
        } else {
          // エラーメッセージを日本語で返す
          const errorMessages = {
            'NOT_FOUND': '指定された住所が見つかりません。住所をより詳しく入力してください。',
            'ZERO_RESULTS': '経路が見つかりません。住所を確認してください。',
            'REQUEST_DENIED': 'APIキーが無効、またはDirections APIが有効化されていません。',
            'OVER_QUERY_LIMIT': 'APIの利用制限を超えました。しばらく待ってから再試行してください。',
            'INVALID_REQUEST': 'リクエストが不正です。住所を確認してください。',
            'UNKNOWN_ERROR': 'サーバーエラーが発生しました。再試行してください。'
          };
          const msg = errorMessages[status] || `経路検索に失敗しました (${status})`;
          reject(new Error(msg));
        }
      }
    );
  });
};

/**
 * 距離計算用の検索クエリを構築する
 * 住所がある場合は住所を優先、なければ名称を使用
 * 
 * @param {string} address - 住所
 * @param {string} name - 場所の名称
 * @returns {string} 検索クエリ文字列
 */
export const buildSearchQuery = (address, name) => {
  if (address) return address;
  if (name) return name;
  return '';
};
