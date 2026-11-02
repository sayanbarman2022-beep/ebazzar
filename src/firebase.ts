import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { Product, UserProfile } from './types.ts';

// Initialize Firebase App and Services
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Startup connection verification per Firebase Integration Skill requirement
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

// Strictly typed Firestore Error Info
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Google Authentication
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await syncUserProfile(result.user);
    }
    return result.user;
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  try {
    const userDoc: UserProfile = {
      uid: user.uid,
      email: user.email || 'student@mckvie.edu.in',
      displayName: user.displayName || user.email?.split('@')[0] || 'MCKVIEian',
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email || user.uid}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'users', user.uid), userDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

// Real-time Firestore Listeners
export function subscribeToProducts(
  onData: (products: Product[]) => void,
  onError?: (error: Error) => void
): () => void {
  const productsPath = 'products';
  const q = collection(db, productsPath);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...(docSnap.data() as Omit<Product, 'id'>) });
      });
      // Sort newest first by default in memory
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(items);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, productsPath);
    }
  );

  return unsubscribe;
}

export function subscribeToWishlist(
  userId: string,
  onData: (productIds: string[]) => void,
  onError?: (error: Error) => void
): () => void {
  const wishlistPath = `users/${userId}/wishlist`;
  const q = collection(db, 'users', userId, 'wishlist');

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const ids: string[] = [];
      snapshot.forEach((docSnap) => {
        ids.push(docSnap.id);
      });
      onData(ids);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, wishlistPath);
    }
  );

  return unsubscribe;
}

// Product Management Operations
export async function createProduct(productData: Omit<Product, 'id'>): Promise<string> {
  const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const productPath = `products/${productId}`;

  try {
    await setDoc(doc(db, 'products', productId), {
      ...productData,
      createdAt: new Date().toISOString(),
    });
    return productId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, productPath);
  }
}

export async function deleteProductListing(productId: string): Promise<void> {
  const productPath = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, productPath);
  }
}

export async function toggleWishlistItem(
  userId: string,
  productId: string,
  isCurrentlySaved: boolean
): Promise<void> {
  const wishPath = `users/${userId}/wishlist/${productId}`;
  try {
    const wishRef = doc(db, 'users', userId, 'wishlist', productId);
    if (isCurrentlySaved) {
      await deleteDoc(wishRef);
    } else {
      await setDoc(wishRef, {
        productId,
        addedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCurrentlySaved ? OperationType.DELETE : OperationType.CREATE,
      wishPath
    );
  }
}

// Initial Data Seeding if database is completely empty
export async function seedInitialProductsIfEmpty(): Promise<void> {
  const productsPath = 'products';
  try {
    const q = query(collection(db, productsPath), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Seed with genuine MCKVIE engineering gear
      const initialSeed: Array<Omit<Product, 'id'>> = [
        {
          title: 'Chemistry Lab Coat (Size L) - Spotless',
          category: 'Lab Coat',
          price: 220,
          desc: 'Clean, properly washed, thick cotton fabric with no chemical stains. Preserved with college badge pocket, ready for B.Tech Chem lab.',
          location: 'College Canteen',
          contact: '9876543210',
          imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&auto=format&fit=crop&q=80',
          ownerId: 'system_seed_rahul',
          ownerEmail: 'rahul.tech@mckvie.edu.in',
          ownerName: 'Rahul Roy (ME 3rd Yr)',
          ownerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          title: 'Omega Engineering Mini Drafter + T-Scale Kit',
          category: 'Drawing Kit',
          price: 450,
          desc: 'Smooth rotatable arm with clamp and black canvas carrying bag. Perfectly zero-calibrated for Engineering Graphics & CAD labs.',
          location: 'Central Library (Ground Floor)',
          contact: '9830123456',
          imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
          ownerId: 'system_seed_priya',
          ownerEmail: 'priya.ece@mckvie.edu.in',
          ownerName: 'Priya Sharma (ECE 4th Yr)',
          ownerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
        {
          title: 'Casio fx-991EX ClassWiz Scientific Calculator',
          category: 'Electronics',
          price: 900,
          desc: '552 functions with high-resolution spreadsheet display. Solar and battery dual power. Permitted in MAKAUT semester exams.',
          location: 'Main Gate / Reception Area',
          contact: '9123456789',
          imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
          ownerId: 'system_seed_sourav',
          ownerEmail: 'sourav.cse@mckvie.edu.in',
          ownerName: 'Sourav Ghosh (CSE 3rd Yr)',
          ownerAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        },
        {
          title: 'MAKAUT 3rd Sem CSE Data Structures & Algorithms Spiral Notes',
          category: 'Notes',
          price: 150,
          desc: 'Handwritten chapter-wise clean notes with previous 5 years solved university question papers, tree diagrams, and complexity analysis.',
          location: '1st Year Common Room',
          contact: '9748112233',
          imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
          ownerId: 'system_seed_ankita',
          ownerEmail: 'ankita.it@mckvie.edu.in',
          ownerName: 'Ankita Das (IT 4th Yr)',
          ownerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      ];

      for (const item of initialSeed) {
        const id = `seed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, productsPath, id), item);
      }
    }
  } catch (error) {
    console.warn('Seeding note:', error);
  }
}
