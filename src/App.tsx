import { useState, useEffect, useMemo, ChangeEvent, FormEvent } from 'react';
import {
  GraduationCap,
  Search,
  PlusCircle,
  Heart,
  Trash2,
  MapPin,
  MessageCircle,
  LogIn,
  LogOut,
  X,
  Upload,
  CheckCircle,
  AlertCircle,
  Info,
  Clock,
  Sparkles,
  Bookmark,
  Package,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  testConnection,
  signInWithGoogle,
  logoutUser,
  subscribeToProducts,
  subscribeToWishlist,
  createProduct,
  deleteProductListing,
  toggleWishlistItem,
} from './firebase.ts';
import type { Product, CategoryFilter, SortOption, ToastMessage } from './types.ts';
import { compressImage, formatINR, timeAgo } from './utils.ts';

const CAMPUS_LOCATIONS = [
  'Central Library (Ground Floor)',
  'College Canteen',
  'Main Gate / Reception Area',
  'Mechanical Workshop',
  '1st Year Common Room',
  'Computer Center (2nd Floor)',
  'Electrical Machines Lab',
];

const CATEGORIES: Array<Exclude<CategoryFilter, 'all'>> = [
  'Drawing Kit',
  'Lab Coat',
  'Notes',
  'Electronics',
  'Other',
];

const DEFAULT_CAMPUS_PRODUCTS: Product[] = [
  {
    id: 'sample_lab_coat_1',
    title: 'Chemistry Lab Coat (Size L) - Fresh & Clean',
    category: 'Lab Coat',
    price: 200,
    desc: 'Clean, washed, thick cotton fabric with no chemical stains. Ready for B.Tech Chemistry labs.',
    location: 'College Canteen',
    contact: '9876543210',
    imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&auto=format&fit=crop&q=80',
    ownerId: 'sample_seller_rahul',
    ownerEmail: 'rahul.tech@mckvie.edu.in',
    ownerName: 'Rahul Roy (ME 3rd Yr)',
    ownerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'sample_drafter_2',
    title: 'Omega Engineering Mini Drafter + T-Scale Kit',
    category: 'Drawing Kit',
    price: 450,
    desc: 'Smooth rotatable arm with clamp and black canvas carrying bag. Perfectly zero-calibrated for Engineering Graphics & CAD labs.',
    location: 'Central Library (Ground Floor)',
    contact: '9830123456',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
    ownerId: 'sample_seller_priya',
    ownerEmail: 'priya.ece@mckvie.edu.in',
    ownerName: 'Priya Sharma (ECE 4th Yr)',
    ownerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'sample_casio_3',
    title: 'Casio fx-991EX ClassWiz Scientific Calculator',
    category: 'Electronics',
    price: 850,
    desc: '552 functions with high-resolution spreadsheet display. Solar and battery dual power. Permitted in MAKAUT semester exams.',
    location: 'Main Gate / Reception Area',
    contact: '9123456789',
    imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80',
    ownerId: 'sample_seller_sourav',
    ownerEmail: 'sourav.cse@mckvie.edu.in',
    ownerName: 'Sourav Ghosh (CSE 3rd Yr)',
    ownerAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 'sample_notes_4',
    title: 'MAKAUT 3rd Sem Data Structures & Algorithms Spiral Notes',
    category: 'Notes',
    price: 150,
    desc: 'Handwritten chapter-wise clean notes with previous 5 years solved university question papers, tree diagrams, and complexity analysis.',
    location: '1st Year Common Room',
    contact: '9748112233',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
    ownerId: 'sample_seller_ankita',
    ownerEmail: 'ankita.it@mckvie.edu.in',
    ownerName: 'Ankita Das (IT 4th Yr)',
    ownerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Products and wishlist state
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // UI Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [activeTab, setActiveTab] = useState<'all' | 'wishlist' | 'mine'>('all');

  // Modals & Popups
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Post Ad Form state
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<Exclude<CategoryFilter, 'all'>>('Lab Coat');
  const [formPrice, setFormPrice] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState(CAMPUS_LOCATIONS[0]);
  const [formContact, setFormContact] = useState('');
  const [formImageBase64, setFormImageBase64] = useState<string | null>(null);
  const [isSubmittingAd, setIsSubmittingAd] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // 1. Initial boot: verify Firestore connection
  useEffect(() => {
    testConnection();
  }, []);

  // 2. Auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Products real-time listener from Firestore
  useEffect(() => {
    setLoadingProducts(true);
    const unsubscribe = subscribeToProducts(
      (items) => {
        setFirestoreProducts(items);
        setLoadingProducts(false);
      },
      (err) => {
        console.warn('Products listener note:', err.message);
        setLoadingProducts(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 4. Wishlist real-time listener (when user is logged in)
  useEffect(() => {
    if (!currentUser) {
      setWishlistIds([]);
      return;
    }
    const unsubscribe = subscribeToWishlist(
      currentUser.uid,
      (ids) => {
        setWishlistIds(ids);
      },
      (err) => {
        console.warn('Wishlist listener note:', err.message);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Combined products (Firestore products take priority, supplemented by initial campus catalog)
  const allProducts = useMemo(() => {
    const firestoreIds = new Set(firestoreProducts.map((p) => p.id));
    const supplemental = DEFAULT_CAMPUS_PRODUCTS.filter((p) => !firestoreIds.has(p.id));
    return [...firestoreProducts, ...supplemental];
  }, [firestoreProducts]);

  // Auth actions
  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      setIsAuthModalOpen(false);
      addToast(`Welcome to MCKVIE Bazaar, ${user.displayName || 'Student'}!`, 'success');
    } catch (err) {
      console.error(err);
      addToast('Sign-in cancelled or window closed.', 'info');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      addToast('Signed out successfully.', 'info');
      if (activeTab === 'mine' || activeTab === 'wishlist') {
        setActiveTab('all');
      }
    } catch (err) {
      console.error(err);
      addToast('Error signing out', 'error');
    }
  };

  // Image upload handler
  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file (PNG, JPG, etc.)', 'error');
      return;
    }

    try {
      const compressed = await compressImage(file, 800, 800, 0.7);
      setFormImageBase64(compressed);
    } catch (err) {
      console.error(err);
      addToast('Failed to process image. Try another photo.', 'error');
    }
  };

  // Post Ad submit handler
  const handlePostAd = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      setIsSellModalOpen(false);
      setIsAuthModalOpen(true);
      addToast('Please sign in with Google to post your gear!', 'info');
      return;
    }

    if (!formImageBase64) {
      addToast('Please upload a product photo.', 'error');
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      addToast('Please enter a valid price.', 'error');
      return;
    }

    const cleanContact = formContact.replace(/\D/g, '');
    if (cleanContact.length !== 10) {
      addToast('Contact number must be exactly 10 digits.', 'error');
      return;
    }

    setIsSubmittingAd(true);
    try {
      await createProduct({
        title: formTitle.trim(),
        category: formCategory,
        price: priceNum,
        desc: formDesc.trim(),
        location: formLocation,
        contact: cleanContact,
        imageUrl: formImageBase64,
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email || 'student@mckvie.edu.in',
        ownerName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Student',
        ownerAvatar:
          currentUser.photoURL ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
        createdAt: new Date().toISOString(),
      });

      // Reset form
      setFormTitle('');
      setFormCategory('Lab Coat');
      setFormPrice('');
      setFormDesc('');
      setFormContact('');
      setFormImageBase64(null);
      setIsSellModalOpen(false);

      addToast('Your ad has been posted to MCKVIE Bazaar!', 'success');
    } catch (err) {
      console.error(err);
      addToast('Could not post ad. Please try again.', 'error');
    } finally {
      setIsSubmittingAd(false);
    }
  };

  // Delete product handler
  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProductListing(productId);
      setDeleteConfirmId(null);
      addToast('Item removed from the marketplace.', 'info');
    } catch (err) {
      console.error(err);
      addToast('Failed to remove item. Only the seller can delete it.', 'error');
    }
  };

  // Wishlist handler
  const handleToggleWishlist = async (productId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      addToast('Sign in to save items to your campus wishlist!', 'info');
      return;
    }

    const isCurrentlySaved = wishlistIds.includes(productId);
    try {
      await toggleWishlistItem(currentUser.uid, productId, isCurrentlySaved);
      addToast(
        isCurrentlySaved ? 'Removed from your wishlist' : 'Saved to wishlist ❤️',
        isCurrentlySaved ? 'info' : 'success'
      );
    } catch (err) {
      console.error(err);
      addToast('Could not update wishlist', 'error');
    }
  };

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = allProducts.filter((p) => {
      // Tab filter
      if (activeTab === 'wishlist' && !wishlistIds.includes(p.id)) return false;
      if (activeTab === 'mine' && (!currentUser || p.ownerId !== currentUser.uid)) return false;

      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesDesc = p.desc.toLowerCase().includes(query);
        const matchesLoc = p.location.toLowerCase().includes(query);
        const matchesCat = p.category.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesCat) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortOption === 'priceLow') return a.price - b.price;
      if (sortOption === 'priceHigh') return b.price - a.price;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [allProducts, activeTab, wishlistIds, currentUser, selectedCategory, searchQuery, sortOption]);

  const myAdsCount = useMemo(() => {
    if (!currentUser) return 0;
    return allProducts.filter((p) => p.ownerId === currentUser.uid).length;
  }, [allProducts, currentUser]);

  return (
    <div className="font-sans text-gray-800 min-h-screen relative flex flex-col">
      {/* Background Engineering Blueprint Grid */}
      <div className="engineering-grid" />

      {/* Navigation Header */}
      <header className="bg-blue-900 text-white shadow-md sticky top-0 z-40 border-b border-blue-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div
            onClick={() => {
              setActiveTab('all');
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="flex items-center space-x-2.5 cursor-pointer hover:opacity-95 transition"
          >
            <div className="bg-yellow-400 p-2 rounded-lg text-blue-950 shadow-sm flex items-center justify-center">
              <GraduationCap className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-wider leading-none">
                MCKVIE<span className="text-yellow-400">Bazaar</span>
              </div>
              <p className="text-[10px] text-blue-200 tracking-wide font-medium mt-0.5">
                Campus Student Marketplace & Gear Exchange
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="w-full md:w-2/5 flex shadow-sm rounded-lg overflow-hidden border border-blue-700 bg-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lab coats, notes, drafters, casio..."
              className="w-full px-4 py-2 text-gray-900 focus:outline-none text-sm placeholder-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-2 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="bg-yellow-400 text-blue-950 px-4 font-bold flex items-center justify-center">
              <Search className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          {/* Action and Auth Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {authLoading ? (
              <div className="w-24 h-9 bg-blue-800/60 animate-pulse rounded-md" />
            ) : currentUser ? (
              <div className="flex items-center gap-2 bg-blue-800/90 border border-blue-700 py-1.5 px-3 rounded-full shadow-inner">
                <img
                  src={
                    currentUser.photoURL ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`
                  }
                  alt={currentUser.displayName || 'Student'}
                  className="w-7 h-7 rounded-full object-cover border border-yellow-400"
                />
                <span className="font-semibold text-xs text-white max-w-[120px] truncate">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="ml-1 text-blue-300 hover:text-red-300 transition p-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition border border-blue-600 shadow-sm flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5 text-yellow-400" />
                <span>Student Login</span>
              </button>
            )}

            {/* Post Ad Button */}
            <button
              onClick={() => {
                if (!currentUser) {
                  setIsAuthModalOpen(true);
                  addToast('Please login with your student Google account to post an ad.', 'info');
                } else {
                  setIsSellModalOpen(true);
                }
              }}
              className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-black px-4 py-2 rounded-lg transition shadow-md flex items-center gap-2 text-sm active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              <span>Post Ad</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full">
        {/* Banner with college notice */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-5 rounded-2xl shadow-sm mb-6 border border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-400 text-blue-950 rounded-xl shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">
                MCKVIE Engineering Essentials Exchange
              </h1>
              <p className="text-xs text-blue-200 mt-0.5">
                Real-time marketplace for students: Lab coats, drafters, calculators & semester notes
                handed over on campus.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-yellow-400 text-blue-950 shadow'
                  : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              All Gear ({allProducts.length})
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  setIsAuthModalOpen(true);
                  addToast('Sign in to view your wishlist', 'info');
                  return;
                }
                setActiveTab('wishlist');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'wishlist'
                  ? 'bg-yellow-400 text-blue-950 shadow'
                  : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
              Wishlist ({wishlistIds.length})
            </button>
            <button
              onClick={() => {
                if (!currentUser) {
                  setIsAuthModalOpen(true);
                  addToast('Sign in to view your listed ads', 'info');
                  return;
                }
                setActiveTab('mine');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mine'
                  ? 'bg-yellow-400 text-blue-950 shadow'
                  : 'bg-blue-800/80 text-blue-100 hover:bg-blue-800'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              My Ads ({myAdsCount})
            </button>
          </div>
        </div>

        {/* Filter and Sort Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">
              Category:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
              Sort by:
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="border border-gray-300 p-2 rounded-lg bg-gray-50 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {loadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-white rounded-xl h-80 animate-pulse border border-gray-200 p-4 flex flex-col justify-between"
              >
                <div className="w-full h-44 bg-gray-200 rounded-lg" />
                <div className="space-y-2 mt-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm max-w-lg mx-auto my-12">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No items found</h3>
            <p className="text-xs text-gray-500 mb-6">
              {searchQuery
                ? `No products matched "${searchQuery}". Try a different keyword.`
                : activeTab === 'wishlist'
                ? 'Your wishlist is currently empty. Tap the heart on any item to save it!'
                : activeTab === 'mine'
                ? "You haven't posted any ads yet. Got a lab coat or drafter to pass down?"
                : 'No items in this category yet. Be the first to post!'}
            </p>
            {activeTab === 'mine' ? (
              <button
                onClick={() => setIsSellModalOpen(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-bold px-5 py-2.5 rounded-lg text-sm transition cursor-pointer"
              >
                Post Your Gear
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setActiveTab('all');
                }}
                className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const isWished = wishlistIds.includes(p.id);
              const isOwner = currentUser && currentUser.uid === p.ownerId;
              const sellerAvatar =
                p.ownerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.ownerEmail}`;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 group flex flex-col relative"
                >
                  {/* Wishlist Heart Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleWishlist(p.id);
                    }}
                    title={isWished ? 'Remove from wishlist' : 'Save to wishlist'}
                    className={`absolute top-3 right-3 bg-white/95 backdrop-blur-md p-2 rounded-full shadow-md z-10 heart-icon transition cursor-pointer ${
                      isWished ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWished ? 'fill-red-500' : ''}`} />
                  </button>

                  {/* Owner Delete Button */}
                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(p.id);
                      }}
                      title="Delete your listing"
                      className="absolute top-3 left-3 bg-white/95 backdrop-blur-md p-2 rounded-full shadow-md z-10 text-gray-500 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Product Image */}
                  <div
                    onClick={() => setSelectedProduct(p)}
                    className="h-48 overflow-hidden bg-gray-100 relative cursor-pointer"
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-yellow-400" />
                      <span>{timeAgo(p.createdAt)}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div
                    onClick={() => setSelectedProduct(p)}
                    className="p-4 flex-grow cursor-pointer"
                  >
                    {/* Category + Seller Badge */}
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                        {p.category}
                      </span>

                      <div
                        className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-200 max-w-[130px]"
                        title={`Seller: ${p.ownerName || p.ownerEmail}`}
                      >
                        <img
                          src={sellerAvatar}
                          alt="Seller"
                          className="w-4 h-4 rounded-full object-cover border border-gray-300 shrink-0"
                        />
                        <span className="text-[10px] font-semibold text-gray-700 truncate">
                          {p.ownerName || p.ownerEmail.split('@')[0]}
                        </span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 mt-1 line-clamp-1 group-hover:text-blue-700 transition">
                      {p.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {p.desc}
                    </p>

                    {/* Handover location pill */}
                    <div className="mt-3.5 bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] p-2 rounded-md flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate font-medium">{p.location}</span>
                    </div>
                  </div>

                  {/* Card Footer: Price & WhatsApp Action */}
                  <div className="p-3.5 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
                    <span className="text-lg font-black text-blue-950">{formatINR(p.price)}</span>
                    <a
                      href={`https://wa.me/91${p.contact}?text=${encodeURIComponent(
                        `Hi! I saw your ad for "${p.title}" (₹${p.price}) on MCKVIE Bazaar. Is it still available to collect on campus?`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5 shrink-0 active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-blue-950 text-blue-300 text-xs py-6 mt-12 border-t border-blue-900">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center">
            <GraduationCap className="w-4 h-4 text-yellow-400" />
            <span className="font-bold text-white">MCKVIE Campus Bazaar</span>
            <span className="text-blue-400">| Engineering Gear Exchange</span>
          </div>
          <p className="text-blue-400 text-[11px]">
            Designed for MCKVIE students & staff. Trade responsibly in public campus handover points.
          </p>
        </div>
      </footer>

      {/* Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Student Sign In</h3>
              <p className="text-xs text-gray-500 mt-1">
                Authenticate with Google to list gear, manage your ads, and save wishlist items
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleSignIn}
                className="w-full bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3 px-4 rounded-xl border border-gray-300 shadow-sm transition flex items-center justify-center gap-3 active:scale-98 cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.9c2.28-2.1 3.645-5.2 3.645-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.72-2.09-6.66-4.9H1.31v3.13C3.33 21.37 7.39 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.34 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3V6.57H1.31C.48 8.23 0 10.06 0 12s.48 3.77 1.31 5.43l4.03-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.39 0 3.33 2.63 1.31 6.57l4.03 3.13c.94-2.81 3.56-4.9 6.66-4.9z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="mt-5 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <span>
                Verified MCKVIE identity ensures a trusted campus exchange between seniors and juniors.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Post Ad (Sell) Modal */}
      {isSellModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto my-8 border border-gray-100">
            <button
              onClick={() => setIsSellModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-1 border-b pb-3">Sell Your Gear</h3>
            <p className="text-xs text-gray-500 mb-5">
              List drawing instruments, books, or lab coats for fellow campus students.
            </p>

            <form onSubmit={handlePostAd} className="space-y-4">
              {/* Photo Upload with live preview */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-dashed border-gray-300">
                <label className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  Product Photo (Required)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-900 file:text-white hover:file:bg-blue-800 cursor-pointer"
                  required={!formImageBase64}
                />
                {formImageBase64 && (
                  <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300 shadow-xs">
                    <img
                      src={formImageBase64}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ad Title</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Omega Mini Drafter with Board Clips"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Category and Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as Exclude<CategoryFilter, 'all'>)
                    }
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Price (₹ INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="250"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Condition & Details */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Condition & Details
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={1000}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Mention size, subject, semester, brand, and exact condition..."
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Handover location point */}
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-700" />
                  MCKVIE Handover Point
                </label>
                <select
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full border border-blue-200 rounded-lg p-2 text-xs outline-none bg-white font-medium text-gray-800"
                >
                  {CAMPUS_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact number for WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  WhatsApp Contact Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value.replace(/\D/g, ''))}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Buyers will reach out via WhatsApp to finalize the pickup.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmittingAd}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 rounded-xl transition shadow-md mt-2 flex justify-center items-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAd ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Publishing to Campus...</span>
                  </>
                ) : (
                  <span>Post to Bazaar</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col max-h-[90vh]">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-gray-600 hover:text-gray-900 p-1.5 rounded-full z-10 transition shadow-sm cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="h-64 bg-gray-100 relative">
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-3 left-3 bg-blue-900/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {selectedProduct.category}
              </span>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-black text-gray-900 leading-snug">
                  {selectedProduct.title}
                </h3>
                <span className="text-2xl font-black text-blue-950 shrink-0">
                  {formatINR(selectedProduct.price)}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <img
                  src={
                    selectedProduct.ownerAvatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProduct.ownerEmail}`
                  }
                  alt="Seller"
                  className="w-8 h-8 rounded-full object-cover border border-gray-300"
                />
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {selectedProduct.ownerName || selectedProduct.ownerEmail.split('@')[0]}
                  </div>
                  <div className="text-[11px] text-gray-500">{selectedProduct.ownerEmail}</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Item Description
                </h4>
                <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                  {selectedProduct.desc}
                </p>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Campus Meeting Point:</span>
                  <p className="mt-0.5">{selectedProduct.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <a
                  href={`https://wa.me/91${selectedProduct.contact}?text=${encodeURIComponent(
                    `Hi! I saw your ad for "${selectedProduct.title}" (₹${selectedProduct.price}) on MCKVIE Bazaar. Is it still available to collect on campus?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-center shadow-md flex items-center justify-center gap-2 text-xs"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>Contact on WhatsApp</span>
                </a>

                <button
                  onClick={() => handleToggleWishlist(selectedProduct.id)}
                  className={`p-3 rounded-xl border transition flex items-center justify-center cursor-pointer ${
                    wishlistIds.includes(selectedProduct.id)
                      ? 'bg-red-50 border-red-200 text-red-500'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-red-500'
                  }`}
                  title="Toggle wishlist"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      wishlistIds.includes(selectedProduct.id) ? 'fill-current' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center border border-gray-100">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-gray-900">Delete Product Listing?</h4>
            <p className="text-xs text-gray-500 mt-1 mb-5">
              This will permanently remove the item from MCKVIE Bazaar. This action cannot be
              undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2.5 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProduct(deleteConfirmId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2.5 rounded-lg transition cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div id="toast-container" className="fixed bottom-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast show px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-bold text-white ${
              t.type === 'success'
                ? 'bg-emerald-600'
                : t.type === 'error'
                ? 'bg-red-600'
                : 'bg-blue-950'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
