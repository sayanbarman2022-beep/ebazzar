const STORAGE_KEY = 'mckvie_bazaar_products';
const USER_KEY = 'mckvie_bazaar_user';

let products = [];
let wishlist = JSON.parse(localStorage.getItem('mckvie_wishlist')) || [];
let currentUser = JSON.parse(localStorage.getItem(USER_KEY)) || null;

// 1. Initialize App & Data Persistence
async function initApp() {
    renderAuthUI();
    const savedData = localStorage.getItem(STORAGE_KEY);
    
    if (savedData && savedData !== "[]") {
        products = JSON.parse(savedData);
    } else {
        try {
            const response = await fetch('products.json');
            products = await response.json();
        } catch (e) {
            products = [];
        }
        saveToStorage();
    }
    renderProducts();
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
        localStorage.setItem('mckvie_wishlist', JSON.stringify(wishlist));
        if (currentUser) {
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        } else {
            localStorage.removeItem(USER_KEY);
        }
    } catch (e) {
        showToast("Browser storage full! Could not save data.", "error");
    }
}

// 2. Render Auth Bar Interface
function renderAuthUI() {
    const authContainer = document.getElementById('authContainer');
    if (currentUser) {
        const avatarSrc = currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.email}`;
        
        authContainer.innerHTML = `
            <div class="flex items-center gap-2 bg-blue-800 text-xs px-3 py-1.5 rounded-full border border-blue-700 shadow-sm">
                <img src="${avatarSrc}" class="w-7 h-7 rounded-full object-cover border border-yellow-400">
                <span class="font-semibold text-white max-w-[100px] truncate">${currentUser.email.split('@')[0]}</span>
                <button onclick="handleLogout()" class="ml-1 text-gray-300 hover:text-red-300 transition" title="Logout">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        `;
    } else {
        authContainer.innerHTML = `
            <button onclick="toggleAuthModal(true)" class="bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-4 py-2 rounded-md transition shadow-sm flex items-center gap-1.5">
                <i class="fa-solid fa-right-to-bracket"></i> Login
            </button>
        `;
    }
}

// 3. Render Product Cards (with Owner Deletion Logic & Seller Badges)
function renderProducts() {
    const grid = document.getElementById('productGrid');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    const catVal = document.getElementById('categoryFilter').value;
    const sortVal = document.getElementById('sortFilter').value;

    let filtered = products.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchVal) || p.desc.toLowerCase().includes(searchVal);
        const matchesCat = catVal === 'all' || p.category === catVal;
        return matchesSearch && matchesCat;
    });

    if (sortVal === 'priceLow') filtered.sort((a, b) => a.price - b.price);
    else if (sortVal === 'priceHigh') filtered.sort((a, b) => b.price - a.price);
    else filtered.sort((a, b) => b.timestamp - a.timestamp); 

    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100"><i class="fa-solid fa-ghost text-4xl mb-3 text-blue-500 block"></i> No items found.</div>`;
        return;
    }

    filtered.forEach(p => {
        const isWished = wishlist.includes(p.id);
        const isOwner = currentUser && currentUser.email === p.ownerId;
        const sellerAvatar = p.ownerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.ownerId}`;

        grid.innerHTML += `
            <div class="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 group flex flex-col relative">
                <!-- Wishlist Heart Button -->
                <button onclick="toggleWishlist(${p.id})" class="absolute top-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-md z-10 heart-icon ${isWished ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}">
                    <i class="fa-solid fa-heart text-lg"></i>
                </button>
                
                <!-- Trash Button ONLY shown to the owner -->
                ${isOwner ? `
                <button onclick="deleteProduct(${p.id})" title="Delete your item" class="absolute top-3 left-3 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-md z-10 text-gray-500 hover:text-red-600 transition">
                    <i class="fa-solid fa-trash text-sm"></i>
                </button>
                ` : ''}

                <div class="h-48 overflow-hidden bg-gray-100 relative">
                    <img src="${p.image}" alt="${p.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>

                <div class="p-4 flex-grow">
                    <!-- Category Badge + Seller Profile Badge -->
                    <div class="flex items-center justify-between mb-2 gap-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">${p.category}</span>
                        
                        <div class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-200 max-w-[130px]" title="Seller: ${p.ownerId}">
                            <img src="${sellerAvatar}" class="w-4 h-4 rounded-full object-cover border border-gray-300 flex-shrink-0">
                            <span class="text-[10px] font-semibold text-gray-700 truncate">${p.ownerId.split('@')[0]}</span>
                        </div>
                    </div>

                    <h4 class="text-base font-bold text-gray-900 mt-2 line-clamp-1">${p.title}</h4>
                    <p class="text-xs text-gray-600 mt-1 line-clamp-2">${p.desc}</p>
                    
                    <div class="mt-4 bg-amber-50/70 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-md flex items-center gap-2">
                        <i class="fa-solid fa-location-dot text-amber-600"></i>
                        <span class="truncate">${p.location}</span>
                    </div>
                </div>
                
                <div class="p-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
                    <span class="text-xl font-black text-gray-900">₹${p.price}</span>
                    <a href="https://wa.me/91${p.contact}?text=Hi! I saw your ad for '${p.title}' on MCKVIE Bazaar." target="_blank" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3.5 py-2 rounded-md transition shadow flex items-center gap-1.5">
                        <i class="fa-brands fa-whatsapp text-sm"></i> Contact
                    </a>
                </div>
            </div>
        `;
    });
}

// 4. Image Compression Utility
function compressImage(file, maxWidth = 500, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = height * (maxWidth / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// 5. Auth Modal Controls & Submission Handler
function toggleAuthModal(show) {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.classList.add('overflow-hidden');
    } else {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.classList.remove('overflow-hidden');
    }
    modal.setAttribute('aria-hidden', String(!show));
}

let selectedAvatarBase64 = null;
document.getElementById('authAvatarFile').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (file) {
        try {
            selectedAvatarBase64 = await compressImage(file, 200, 0.7);
            document.getElementById('avatarPreview').src = selectedAvatarBase64;
            document.getElementById('avatarPreviewContainer').classList.remove('hidden');
        } catch (err) {
            showToast("Could not process avatar image", "error");
        }
    }
});

document.getElementById('authForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value.trim();
    if (!email) {
        showToast("Please enter a valid email", "error");
        return;
    }

    currentUser = { 
        email: email, 
        avatar: selectedAvatarBase64 || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
    };

    saveToStorage();
    renderAuthUI();
    renderProducts();
    
    toggleAuthModal(false);
    
    document.getElementById('authForm').reset();
    document.getElementById('avatarPreviewContainer').classList.add('hidden');
    selectedAvatarBase64 = null;

    showToast(`Welcome back, ${email.split('@')[0]}!`, "success");
});

function handleLogout() {
    currentUser = null;
    saveToStorage();
    renderAuthUI();
    renderProducts();
    showToast("Logged out successfully", "info");
}

// 6. Product Form Submission Handler
async function handleFormSubmit(event) {
    event.preventDefault();

    if (!currentUser) {
        toggleAuthModal(true);
        showToast("Please login first to post an ad!", "info");
        return;
    }
    
    const btn = document.getElementById('submitBtn');
    const fileInput = document.getElementById('itemImage');
    const file = fileInput.files[0];

    if (!file) {
        showToast("Please select a product photo.", "error");
        return;
    }

    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Processing...`;
    btn.disabled = true;

    try {
        const base64Image = await compressImage(file);

        const newProduct = {
            id: Date.now(),
            timestamp: Date.now(),
            ownerId: currentUser.email,
            ownerAvatar: currentUser.avatar,
            title: document.getElementById('itemTitle').value.trim(),
            category: document.getElementById('itemCategory').value,
            price: parseFloat(document.getElementById('itemPrice').value),
            desc: document.getElementById('itemDesc').value.trim(),
            location: document.getElementById('itemLocation').value,
            contact: document.getElementById('itemContact').value.trim(),
            image: base64Image
        };

        products.unshift(newProduct);
        saveToStorage();
        renderProducts();
        
        document.getElementById('sellForm').reset();
        toggleModal(false);
        showToast("Ad posted successfully!", "success");

    } catch (error) {
        showToast("Failed to process item image.", "error");
    } finally {
        btn.innerHTML = `Post to Bazaar`;
        btn.disabled = false;
    }
}

// 7. Owner Item Deletion Guard
function deleteProduct(id) {
    const targetProduct = products.find(p => p.id === id);
    if (!targetProduct) return;

    if (!currentUser || currentUser.email !== targetProduct.ownerId) {
        showToast("Only the item owner can delete this post!", "error");
        return;
    }

    const isConfirmed = confirm("Are you sure you want to remove this item? This action cannot be undone.");
    if (isConfirmed) {
        products = products.filter(product => product.id !== id);
        saveToStorage();
        renderProducts();
        showToast("Item deleted successfully", "info");
    }
}

// 8. Wishlist and Modal Helpers
function toggleWishlist(id) {
    if(wishlist.includes(id)) {
        wishlist = wishlist.filter(itemId => itemId !== id);
        showToast("Removed from wishlist", "info");
    } else {
        wishlist.push(id);
        showToast("Added to wishlist ❤️", "success");
    }
    saveToStorage();
    renderProducts();
}

function toggleModal(show) {
    if (show && !currentUser) {
        toggleAuthModal(true);
        showToast("Please login first to post an ad!", "info");
        return;
    }

    const modal = document.getElementById('sellModal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.classList.add('overflow-hidden');
    } else {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.classList.remove('overflow-hidden');
    }
    modal.setAttribute('aria-hidden', String(!show));
}
function showToast(msg, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-gray-800');
    
    toast.className = `toast ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-semibold mb-2`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-circle-xmark' : 'fa-info-circle')}"></i> ${msg}`;
    
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event Listeners
document.getElementById('sellForm').addEventListener('submit', handleFormSubmit);
document.getElementById('searchInput').addEventListener('input', renderProducts);
document.getElementById('categoryFilter').addEventListener('change', renderProducts);
document.getElementById('sortFilter').addEventListener('change', renderProducts);

// Start Application
window.onload = initApp;