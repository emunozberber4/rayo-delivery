# Security Specification - Rayo Delivery

## 1. Data Invariants
- A user profile must have a valid name, email (verified), and address.
- Roles are restricted to: client, restaurant, rider, admin, super_admin.
- Users cannot change their own roles (except during initial signup as client or if super admin).
- Orders must belong to an existing user and restaurant.
- Orders must have a status from the allowed list: recibido, preparacion, camino, entregado.
- Only the order participants (user, restaurant owner/admin, assigned rider, or super admin) can read order details.
- Only super admins can list all users.
- Restaurant owners can only manage their own menu.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: User A trying to update User B's profile.
2. **Role Escalation**: Client trying to set their role to 'admin' or 'super_admin'.
3. **Ghost Field Injection**: Adding `isVerified: true` to a profile update.
4. **Orphaned Order**: Creating an order for a restaurant that doesn't exist.
5. **State Shortcut**: Changing order status from 'recibido' directly to 'entregado' bypassing 'preparacion'.
6. **Price Tampering**: User creating an order with $0.01 total for expensive items.
7. **Identity Poisoning**: Using a 1MB string as a userId or orderId.
8. **PII Leak**: Anonymous user trying to list all users.
9. **Rider Spoofing**: User A trying to accept an order already assigned to Rider B.
10. **Menu Hijack**: User A trying to add a product to User B's restaurant menu.
11. **Super Admin Spoof**: User with email 'rayodelivery502@gmail.com' but unverified email trying to act as super admin.
12. **Denial of Wallet**: Sending thousands of invalid writes to exhaust quota.

## 3. Test Runner (Mock Logic)
All "Dirty Dozen" payloads must return `PERMISSION_DENIED`.
