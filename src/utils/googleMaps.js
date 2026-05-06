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
 * 安全対策:
 * - 15秒タイムアウトで無応答を防止
 * - settled フラグで resolve/reject の二重呼び出しを防止
 * - 全ての例外を catch して必ず reject する
 * 
 * @param {string} originQuery - 出発地（住所 or 地名）
 * @param {string} destinationQuery - 目的地（住所 or 地名）
 * @returns {Promise<{ distanceKm: number, distanceText: string, durationText: string, startAddress: string, endAddress: string }>}
 */
export const calculateDrivingDistance = (originQuery, destinationQuery) => {
  console.log('[距離計算] 開始:', { origin: originQuery, destination: destinationQuery });

  return new Promise((rawResolve, rawReject) => {
    // 二重 settle 防止ガード
    let settled = false;
    const safeResolve = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      console.log('[距離計算] 成功:', value);
      rawResolve(value);
    };
    const safeReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      console.error('[距離計算] エラー:', error?.message || error);
      rawReject(error);
    };

    // タイムアウト設定（15秒）
    const timeoutId = setTimeout(() => {
      console.warn('[距離計算] 15秒タイムアウト発生');
      safeReject(new Error('経路検索がタイムアウトしました（15秒）。通信環境を確認するか、再度お試しください。'));
    }, 15000);

    // API が読み込まれているか確認
    if (!window.google || !window.google.maps) {
      safeReject(new Error('Google Maps APIが読み込まれていません'));
      return;
    }

    // DirectionsService のインスタンス生成
    let directionsService;
    try {
      if (typeof window.google.maps.DirectionsService !== 'function') {
        safeReject(new Error('Directions APIが利用できません。Google Cloud ConsoleでDirections APIを有効化してください。'));
        return;
      }
      directionsService = new window.google.maps.DirectionsService();
    } catch (e) {
      safeReject(new Error('Google Maps サービスの初期化に失敗しました: ' + (e?.message || e)));
      return;
    }

    // 経路検索実行
    try {
      console.log('[距離計算] DirectionsService.route() 呼び出し中...');
      directionsService.route(
        {
          origin: originQuery,
          destination: destinationQuery,
          travelMode: window.google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          console.log('[距離計算] コールバック受信: status =', status);

          if (status === 'OK' && result && result.routes && result.routes.length > 0) {
            try {
              const leg = result.routes[0].legs[0];
              safeResolve({
                distanceKm: Math.round(leg.distance.value / 1000),
                distanceText: leg.distance.text,
                durationText: leg.duration.text,
                startAddress: leg.start_address,
                endAddress: leg.end_address
              });
            } catch (err) {
              safeReject(new Error('経路データの解析に失敗しました。'));
            }
          } else {
            const errorMessages = {
              'NOT_FOUND': '指定された住所が見つかりません。住所をより詳しく入力してください。',
              'ZERO_RESULTS': '経路が見つかりません。住所を確認してください。',
              'REQUEST_DENIED': 'APIキーが無効、またはDirections APIが有効化されていません。',
              'OVER_QUERY_LIMIT': 'APIの利用制限を超えました。しばらく待ってから再試行してください。',
              'INVALID_REQUEST': 'リクエストが不正です。住所を確認してください。',
              'UNKNOWN_ERROR': 'サーバーエラーが発生しました。再試行してください。'
            };
            const msg = errorMessages[status] || `経路検索に失敗しました (${status})`;
            safeReject(new Error(msg));
          }
        }
      );
    } catch (err) {
      safeReject(new Error('経路検索のリクエスト中にエラーが発生しました: ' + (err?.message || err)));
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
