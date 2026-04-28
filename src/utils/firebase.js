import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Firebaseの設定は環境変数から取得（Viteの場合は import.meta.env）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 環境変数が設定されていない場合のフェイルセーフ
let app;
let db;
let auth;
let googleProvider;

try {
  // 設定が空でない場合のみ初期化
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  } else {
    console.warn("Firebase configuration is missing or incomplete.");
  }
} catch (error) {
  console.error("Firebase initialization error", error);
}

// ログイン処理ラッパー
export const signInWithGoogle = async () => {
  if (!auth) throw new Error("Firebase is not initialized");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error", error);
    throw error;
  }
};

// ログアウト処理ラッパー
export const logOut = async () => {
  if (!auth) throw new Error("Firebase is not initialized");
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign-Out Error", error);
    throw error;
  }
};

export { db, auth };
