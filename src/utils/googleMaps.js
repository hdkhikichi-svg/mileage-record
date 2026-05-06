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
  // 既にAPIが読み込まれていれば即座に解決（isLoadedの状態に依存しない）
  if (window.google && window.google.maps) {
    isLoaded = true;
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // 既存のスクリプトタグがあれば削除（APIキー変更時対応）
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja`;
    script.async = true;
    script.defer = true;
    
    // タイムアウト設定を追加（15秒）
    const timeoutId = setTimeout(() => {
      loadPromise = null;
      reject(new Error('Google Maps APIの読み込みがタイムアウトしました。通信環境を確認してください。'));
    }, 15000);

    script.onload = () => {
      clearTimeout(timeoutId);
      isLoaded = true;
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
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
    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
      reject(new Error('Google Maps APIが正しく読み込まれていません'));
      return;
    }

    let directionsService;
    try {
      directionsService = new window.google.maps.DirectionsService();
    } catch (e) {
      reject(new Error('Google Maps サービスの初期化に失敗しました。'));
      return;
    }

    // タイムアウト設定を追加（15秒）
    const timeoutId = setTimeout(() => {
      reject(new Error('経路検索がタイムアウトしました。通信環境を確認するか、再度お試しください。'));
    }, 15000);

    try {
      directionsService.route(
        {
          origin: originQuery,
          destination: destinationQuery,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          clearTimeout(timeoutId); // タイムアウト解除

          if (status === 'OK' && result && result.routes && result.routes.length > 0) {
            try {
              const leg = result.routes[0].legs[0];
              resolve({
                distanceKm: Math.round(leg.distance.value / 1000),  // メートル → km（四捨五入で整数）
                distanceText: leg.distance.text,                          // "12.3 km" 形式
                durationText: leg.duration.text,                          // "約15分" 形式
                startAddress: leg.start_address,                          // 正規化された出発地住所
                endAddress: leg.end_address                               // 正規化された目的地住所
              });
            } catch (err) {
              reject(new Error('経路データの解析に失敗しました。'));
            }
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
    } catch (err) {
      clearTimeout(timeoutId);
      reject(new Error('経路検索のリクエスト中に想定外のエラーが発生しました。'));
    }
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
