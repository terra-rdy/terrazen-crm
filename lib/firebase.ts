import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCL22g_Oa85dCsSY9P1Ie1vlHQtoSRHnxk",
  authDomain: "terrazen-1e8be.firebaseapp.com",
  projectId: "terrazen-1e8be",
  storageBucket: "terrazen-1e8be.firebasestorage.app",
  messagingSenderId: "100982611909",
  appId: "1:100982611909:web:46d254e8576ce23bcaf5ac",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);