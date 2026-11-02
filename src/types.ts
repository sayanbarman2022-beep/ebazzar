export interface Product {
  id: string;
  title: string;
  category: 'Drawing Kit' | 'Lab Coat' | 'Notes' | 'Electronics' | 'Other';
  price: number;
  desc: string;
  location: string;
  contact: string;
  imageUrl: string;
  ownerId: string;
  ownerEmail: string;
  ownerName?: string;
  ownerAvatar?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  updatedAt?: string;
}

export type CategoryFilter = 'all' | 'Drawing Kit' | 'Lab Coat' | 'Notes' | 'Electronics' | 'Other';
export type SortOption = 'newest' | 'priceLow' | 'priceHigh';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
