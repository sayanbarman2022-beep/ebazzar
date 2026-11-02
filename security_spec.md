# Security Specification: MCKVIE Campus Bazaar

## 1. Data Invariants
1. **Product Ownership**: A product's `ownerId` must strictly equal `request.auth.uid`. A student cannot post or modify a product under someone else's identity.
2. **Product Immutability**: `ownerId`, `ownerEmail`, and `createdAt` are immutable after creation.
3. **Data Bounds & Sanitization**:
   - `title`: string between 2 and 100 characters.
   - `category`: one of `["Drawing Kit", "Lab Coat", "Notes", "Electronics", "Other"]`.
   - `price`: non-negative number `<= 1000000`.
   - `desc`: string between 2 and 1000 characters.
   - `location`: non-empty string `<= 100` characters.
   - `contact`: 10-digit mobile number matching `^[0-9]{10}$`.
   - `imageUrl`: string `<= 500000` characters.
4. **Product Deletion & Modification**: Only the listing's verified owner (`resource.data.ownerId == request.auth.uid`) or admin can edit or delete their product listing.
5. **User Profile Privacy**: A student can only create and update their own user profile document at `/users/{userId}` where `userId == request.auth.uid`.
6. **Subcollection Isolation (Wishlist)**: A student's wishlist at `/users/{userId}/wishlist/{productId}` is strictly isolated; only the authenticated user matching `userId` can read or write their own wishlist items.
7. **Default Deny**: Any path not explicitly matched is denied access (`match /{document=**} { allow read, write: if false; }`).

---

## 2. The "Dirty Dozen" Malicious Payloads
1. **Identity Spoofing on Product Creation**: Setting `ownerId: "victim_student_uid"` while authenticated as `attacker_uid`.
2. **Missing Required Fields**: Creating a product without `contact` or `price`.
3. **Price Injection (Negative Price)**: Setting `price: -500` or non-number string `price: "free"`.
4. **Denial-of-Wallet Payload**: Injecting a 2MB string into `title` or `desc` beyond 1,000 characters.
5. **Path Variable ID Poisoning**: Specifying an invalid document ID with traversal characters like `../../admin`.
6. **Immutable Field Modification**: Attempting to change `ownerId` or `createdAt` on an existing product listing.
7. **Cross-Tenant Product Deletion**: Authenticated user B attempting to delete user A's active product.
8. **Contact Regex Tampering**: Submitting a contact number with alphanumeric characters or malicious script tags (`<script>alert(1)</script>`).
9. **Unauthenticated Read/Write to User Profile**: Unauthenticated user attempting to write or read `/users/victim_user`.
10. **Cross-User Wishlist Theft**: Authenticated user B attempting to read or write `/users/userA/wishlist/item1`.
11. **Invalid Category Enumeration**: Attempting to save a product with category `"Weapons"` or arbitrary spoofed category.
12. **Ghost Field Injection (Shadow Update)**: Attempting an update that includes unintended shadow keys like `isVerified: true` or `role: "admin"`.
