import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function getApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig)
  }
  return getApps()[0]
}

export async function logThrowToFirebase(throwData) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return null
  try {
    const db = getFirestore(getApp())
    const ref = await addDoc(collection(db, 'throws'), {
      ...throwData,
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch (e) {
    console.error('Firebase log error:', e)
    return null
  }
}

export async function fetchSharedThrows(limitCount = 100) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return []
  try {
    const db = getFirestore(getApp())
    const q = query(collection(db, 'throws'), orderBy('createdAt', 'desc'), limit(limitCount))
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => {
      const data = doc.data() || {}
      const createdAt = data.createdAt?.toDate?.() || data.timestamp?.toDate?.() || null
      return {
        id: doc.id,
        ...data,
        timestamp: createdAt ? createdAt.toISOString() : data.timestamp || null,
        createdAt: createdAt ? createdAt.toISOString() : null,
      }
    })
  } catch (e) {
    console.error('Firebase fetch error:', e)
    return []
  }
}

export async function logGPSPoint(sessionId, lat, lon, holeNumber) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return null
  try {
    const db = getFirestore(getApp())
    await addDoc(collection(db, 'gps_tracks'), {
      sessionId,
      lat,
      lon,
      holeNumber,
      timestamp: serverTimestamp(),
    })
  } catch (e) {
    console.error('Firebase GPS log error:', e)
  }
}
