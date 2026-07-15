import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvLtproHRMNDgiZbKL1YNLy_Rwp6Ju42s",
  authDomain: "learn-hub-44caa.firebaseapp.com",
  projectId: "learn-hub-44caa",
  storageBucket: "learn-hub-44caa.firebasestorage.app",
  messagingSenderId: "132161789017",
  appId: "1:132161789017:web:d4a27bd0ef02828cb0a548",
  measurementId: "G-66T7W369JN"
};

const app = initializeApp(firebaseConfig);

window.db = getFirestore(app);
window.auth = getAuth(app);
window.googleProvider = new GoogleAuthProvider();

// ===== تسجيل الدخول / الخروج =====
window.loginWithGoogle = function () {
  signInWithPopup(window.auth, window.googleProvider)
    .then((result) => {
      console.log("✅ تسجيل دخول ناجح:", result.user.displayName);
    })
    .catch((error) => {
      console.error("❌ فشل تسجيل الدخول:", error.message);
      alert("حصل خطأ أثناء تسجيل الدخول، حاول تاني.");
    });
};

window.logout = function () {
  signOut(window.auth).then(() => {
    console.log("تم تسجيل الخروج");
  });
};

// ===== مراقبة حالة الدخول باستمرار =====
onAuthStateChanged(window.auth, (user) => {
  if (typeof window.onUserStateChanged === "function") {
    window.onUserStateChanged(user);
  }
});

// ===== قراءة بيانات المستخدم من Firestore =====
window.loadUserTopics = async function (uid) {
  const ref = doc(window.db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data().topics || [];
  }
  return null;
};

// ===== حفظ بيانات المستخدم في Firestore =====
window.saveUserTopics = async function (uid, topics) {
  const ref = doc(window.db, "users", uid);
  await setDoc(ref, {
    topics,
    updatedAt: new Date().toISOString(),
  });
};

console.log("✅ Firebase متصل بنجاح");