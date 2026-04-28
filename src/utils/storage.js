// ============================================
// Firebase & localStorage 永続化モジュール
// ============================================
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const RECORDS_KEY = 'mileage-records';
const SETTINGS_KEY = 'mileage-settings';

// --- 記録データ ---

/**
 * 記録データを読み込む（非同期対応）
 * @param {string|null} uid - FirebaseユーザーID。無い場合はローカルから読み込む
 * @returns {Promise<Array>} 記録の配列（タイムスタンプ順）
 */
export const loadRecords = async (uid = null) => {
  try {
    let records = [];
    if (uid && db) {
      // クラウドから読み込み
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().records) {
        records = docSnap.data().records;
      }
    } else {
      // ローカルから読み込み
      const data = localStorage.getItem(RECORDS_KEY);
      if (data) {
        records = JSON.parse(data);
      }
    }
    
    records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return records;
  } catch (error) {
    console.error("loadRecords error:", error);
    return [];
  }
};

/**
 * 記録データを保存する（非同期対応）
 * @param {Array} records - 記録の配列
 * @param {string|null} uid - FirebaseユーザーID。無い場合はローカルに保存
 */
export const saveRecords = async (records, uid = null) => {
  try {
    if (uid && db) {
      // クラウドへ保存 (マージで既存設定を消さないように)
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, { records }, { merge: true });
    } else {
      // ローカルへ保存
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    }
  } catch (error) {
    console.error("saveRecords error:", error);
  }
};

// --- 設定データ ---

/**
 * 設定データを読み込む（非同期対応）
 * @param {string|null} uid - FirebaseユーザーID
 * @returns {Promise<Object|null>} 設定オブジェクト
 */
export const loadSettings = async (uid = null) => {
  try {
    if (uid && db) {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().settings) {
        return docSnap.data().settings;
      }
      return null;
    } else {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return null;
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("loadSettings error:", error);
    return null;
  }
};

/**
 * 設定データを保存する（非同期対応）
 * @param {Object} settings - 設定オブジェクト
 * @param {string|null} uid - FirebaseユーザーID
 */
export const saveSettings = async (settings, uid = null) => {
  try {
    if (uid && db) {
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, { settings }, { merge: true });
    } else {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch (error) {
    console.error("saveSettings error:", error);
  }
};

// --- ユニークID生成 ---

/**
 * ユニークIDを生成する（タイムスタンプ + ランダム文字列）
 * @returns {string} ユニークID
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
