# Gadgetbroo - Full-Stack E-Commerce Platform

## 1. Project Overview

Gadgetbroo is a complete, production-ready full-stack e-commerce web application. It represents an online retail business selling electronics and gadgets.

The main users of this system are **customers** (who browse, add items to their cart, and place orders) and **administrators** (who manage inventory, process orders, and control website content).

The main problem this application solves is providing a unified, fast, and secure platform to handle the entire lifecycle of an online sale—from product discovery to inventory management to final checkout—without relying on external monolithic platforms like Shopify.

---

## 2. What I Built

From a developer's perspective, I built a complete end-to-end web system. I did not use a CMS or a website builder. Instead, I architected the database, built the backend API, designed the frontend user interface, implemented role-based access control, and configured the deployment pipeline.

I focused heavily on creating an application where business logic is strictly separated, data is validated securely on the server, and the user interface feels incredibly fast using modern React paradigms.

---

## 3. Key Features

### Customer Features

* **Authentication:** Secure login and registration.
* **Product Catalog:** Browsing products with support for multiple variants (e.g., color, storage).
* **Hybrid Cart System:** Instant client-side cart that syncs with the server.
* **Checkout Flow:** Dynamic shipping zones and payment method selection.
* **Order History:** Customers can view past orders and track status.
* **Reviews & Comments:** Users can leave ratings and ask questions on products.
* **Address Book:** Saving and managing delivery addresses.

### Admin Features

* **Role-Based Access Control (RBAC):** Restrict access based on specific permissions (View/Create/Update/Delete).
* **Product Management:** Full CRUD operations for products and their variants.
* **Order Processing:** Updating order statuses and adding admin notes.
* **Inventory Control:** Tracking stock levels per variant.
* **Media Library:** Uploading and managing S3-compatible images and videos.
* **Audit Logs:** Tracking which admin performed what action for accountability.
* **Site Management:** Managing hero banners, promotional media, and custom pages.
* **Analytics:** Custom page view and event tracking system.

---

## 4. Technology Stack

| Technology | Purpose | Why I chose it |
| ---------- | ------- | -------------- |
| **Next.js (App Router)** | Full-Stack Framework | Allowed me to build both the frontend and the backend API in a single repository while utilizing Server Components for better performance and SEO. |
| **TypeScript** | Language | Provided end-to-end type safety, catching errors before runtime and ensuring the frontend expects the exact data the backend sends. |
| **PostgreSQL** | Database | A highly reliable relational database perfect for complex relationships like products, variants, and orders. |
| **Prisma** | ORM | Made interacting with the database safer and faster by generating TypeScript types directly from my database schema. |
| **BetterAuth** | Authentication | A modern, secure authentication library that handles session management and password hashing without vendor lock-in. |
| **Tailwind CSS** | Styling | Allowed for rapid, highly-customizable UI development directly in the markup. |
| **Shadcn UI** | Component Library | Provided unstyled, accessible components (like Modals and Dropdowns) that I could fully control and customize. |
| **Zustand** | State Management | A lightweight, boilerplate-free state manager used for handling the shopping cart across the application. |
| **Zod** | Validation | Used to enforce strict data schemas on both the frontend forms and backend API requests. |
| **AWS S3 SDK** | File Storage | Used to communicate with a custom Garage S3 CDN for scalable image and video hosting. |

---

## 5. System Architecture

The application follows a modern server-rendered architecture:

**User → Next.js Frontend (React) → Next.js Server (API/Server Components) → Prisma ORM → PostgreSQL Database**

1. When a user requests a page, the Next.js server talks to the database via Prisma.
2. The server renders the HTML and sends it to the user (improving SEO and initial load speed).
3. Client-side components take over for interactive features (like clicking "Add to Cart" or opening a modal).
4. When data needs to be modified (e.g., placing an order), the frontend sends a request to the backend API. The API validates the request, checks permissions, executes the business logic, and updates the database.

---

## 6. Project Structure

The codebase is organized to separate concerns clearly:

```text
app/
 ├─ (main)/         # Public storefront pages (Cart, Checkout, Products)
 ├─ (admin)/admin/  # Protected admin dashboard pages
 ├─ (auth)/         # Login and registration pages
 ├─ api/            # Backend API route handlers
components/         # Reusable React components (UI, Forms, Layouts)
lib/                # Core utilities (Prisma client, Auth config, RBAC logic)
 ├─ services/       # External integrations (e.g., MediaService for S3)
prisma/             # Database schema and seed scripts
store/              # Zustand global state (e.g., useCart.ts)
scripts/            # Deployment and CI/CD bash scripts
```

---

## 7. How the Application Works (Flow)

**Example: Viewing a Product**

1. The user navigates to `/product/iphone-15`.
2. Next.js receives the request on the server.
3. The server uses Prisma to query the `Product` table, including its related `ProductVariant`, `ProductImage`, and `Review` records.
4. The server compiles this data into HTML and sends it to the browser.
5. The user sees the page instantly. The client-side JavaScript loads seamlessly in the background to handle interactions (like changing the image gallery or selecting a color variant).

---

## 8. Authentication & Authorization

* **Authentication (Who are you?):** Handled by **BetterAuth**. When a user logs in, their password is verified against a securely hashed version in the database. A secure, HTTP-only session cookie is issued to the browser.
* **Authorization (What are you allowed to do?):** Handled by a custom **Role-Based Access Control (RBAC)** system. Users are assigned a `Role` (e.g., Customer, Admin). Roles have specific `Permissions` (e.g., `canCreateProduct`, `canDeleteOrder`).
* Before a protected backend action occurs, the server explicitly checks if the user's active session possesses the required permission.

---

## 9. Database Design

The database is highly relational to ensure data integrity.

* **User** has one **Role** and many **Addresses** and **Orders**.
* **Product** has many **ProductVariants** (SKU, price, stock) and **ProductImages**.
* **Cart** belongs to a User and has many **CartItems** (which link to Variants).
* **Order** belongs to a User/Address and has many **OrderItems**.

*Crucial Design Detail:* An `OrderItem` connects to a `ProductVariant`, not just a `Product`. This ensures the system knows exactly which size/color was purchased.

---

## 10. Product & Variant System

Products are not flat. The application models products with a parent-child relationship:

* **Product (Parent):** Contains shared data like the Name, Description, and Brand.
* **Variant (Child):** Contains specific data like the SKU, Price, Stock level, and specific attributes (e.g., "Storage: 256GB, Color: Blue").

**Why this is useful:** In a real e-commerce store, a Red iPhone and a Blue iPhone are the same product but have different inventory levels and sometimes different prices. This schema allows the business to track stock accurately per variation.

---

## 11. Cart System

The cart is a **hybrid system**:

* **Client-side:** Managed by `Zustand` and persisted in `localStorage`. This makes adding items feel instantaneous and allows guest users to have a cart.
* **Server-side:** A background sync sends the cart data to the `/api/cart/sync` endpoint. If the user is logged in, the cart is saved to the PostgreSQL database. If they log in from another device, their cart follows them.

---

## 12. Checkout & Order Flow

1. **Validation:** When the user checks out, the server re-calculates the total by checking the *actual* database prices (preventing malicious users from altering prices in the browser).
2. **Stock Check:** The system verifies there is enough inventory for the selected variants.
3. **Snapshotting:** When an `OrderItem` is created, it saves the `priceAtOrder`, `productName`, and `variantName` as text fields.
4. **Order Creation:** The order is marked as `PENDING`.
5. **Inventory Update:** Stock is decreased to prevent overselling.

*Why snapshotting matters:* If an admin changes the price of an iPhone tomorrow, a customer's receipt from yesterday should not change. The order records exactly what was true at the moment of purchase.

---

## 13. Admin Dashboard

The admin dashboard (`/admin`) is completely isolated from the public store. It allows authorized staff to:

* Manage the product catalog and adjust variant stock.
* Process incoming orders (update status to Shipped/Delivered).
* Upload and manage assets in the Media Library (S3 CDN).
* Manage dynamic Shipping Zones (which dictate delivery fees).
* View Audit Logs to see which staff member made specific changes.

---

## 14. Security

### Implemented Practices

* **Server-Side Validation:** All API requests are validated with **Zod** before touching the database. This prevents bad data and NoSQL/SQL injection attacks.
* **HTTP-Only Cookies:** Session tokens cannot be accessed by malicious JavaScript (preventing XSS session theft).
* **Strict RBAC:** Every admin endpoint verifies permissions, preventing privilege escalation.
* **Price Recalculation:** The server never trusts the cart total sent by the client; it recalculates it using database truths.
* **Environment Variables:** Secrets (DB passwords, API keys) are never exposed to the browser.

---

## 15. Validation & Error Handling

* **Client-Side:** Forms use `react-hook-form` + `zod` to provide instant feedback to the user (e.g., "Email is required").
* **Server-Side:** The backend uses `zod` again. *Why?* Because a malicious user can bypass the frontend using tools like Postman or burpsuite. The server must act as the final wall of defense.
* **Error Handling:** If validation fails, the API returns a `400 Bad Request` with specific field errors. The frontend catches this and displays a user-friendly Toast notification.

---

## 16. State Management

* **Server State:** Managed by Next.js Server Components. The server fetches products and renders them directly.
* **Global Client State:** Managed by `Zustand` (exclusively for the Shopping Cart and UI toggles) to prevent unnecessary prop-drilling.
* **Local State:** Managed by React `useState` for simple things like opening/closing a specific dropdown.

---

## 17. API / Server Architecture

The backend follows a standard request lifecycle via Next.js Route Handlers:

`Request → Auth Check (RBAC) → Payload Validation (Zod) → Database Query (Prisma) → JSON Response`

For example, the Media Upload API:

1. Verifies the user has the `canCreate` Media permission.
2. Contacts the S3 Bucket service to generate a secure "Presigned URL".
3. Returns the URL to the frontend, allowing the frontend to upload the file directly to the CDN without clogging the application server bandwidth.

---

## 18. Important Engineering Decisions

### Decision: Using Presigned URLs for S3 Uploads

* **Why:** Instead of sending large image files to my Next.js server and then forwarding them to the CDN, the server gives the frontend a secure, temporary ticket (Presigned URL) to upload directly to the CDN.
* **Problem Solved:** Prevents memory spikes and bandwidth bottlenecks on the application server.
* **Trade-off:** slightly more complex frontend logic to handle the two-step upload process.

### Decision: Order Item Snapshotting

* **Why:** Saving the string name and price directly on the `OrderItem` row instead of purely relying on relational joins to the `Product` table.
* **Problem Solved:** Ensures historical accuracy of receipts if product details change or if a product is completely deleted from the database later.

### Decision: Separating Variants from Products

* **Why:** Creating a dedicated `ProductVariant` table.
* **Problem Solved:** A product might have 5 colors. If we only had a `Product` table, we couldn't accurately track which specific color sold out. This design solves inventory accuracy.

---

## 19. Industry Practices Used

* **Code Organization:** The codebase uses the "Colocation" pattern. API routes, UI components, and business logic are logically separated but kept close to where they are used.
* **Database:** Used database-level constraints (e.g., `@unique`, Foreign Keys with `Cascade` deletes) to ensure orphaned data doesn't accumulate.
* **Authentication:** Avoided rolling custom JWT/crypto implementations and relied on a maintained library (BetterAuth) to prevent security oversights.
* **DevOps:** Wrote a bash deployment script (`deploy.sh`) that automates PM2 restarts, database migrations, and health checks on a Linux VPS.

---

## 20. Performance Considerations

* **Currently Implemented:** Used Next.js Server Components to shift the heavy lifting (fetching data) to the server, resulting in zero client-side JavaScript required just to view a product page.
* **Currently Implemented:** Image optimization via CDN query parameters (e.g., appending `?tr=w-400` to load smaller thumbnails).
* **Future Improvement:** Implement a robust caching layer (like Redis) for the product catalog, as product data is read frequently but updated rarely.

---

## 21. Scalability

If the application grew from 100 users to 1,000,000 users, the current architecture would face bottlenecks.

**Current limitations:** The PostgreSQL database handles everything (auth, products, analytics, rate limiting). Under massive load, the database connections would max out.

**How I would scale it:**

1. Move the Cart and Rate Limiting to **Redis** (an in-memory datastore).
2. Implement **Database Connection Pooling** (like PgBouncer).
3. Use a **Message Queue** (like RabbitMQ) for background tasks (e.g., sending order confirmation emails) so the main thread isn't blocked.

---

## 22. Deployment

The application is deployed using a custom CI/CD pipeline.

* The Next.js application is built in `standalone` mode, which heavily optimizes the output size.
* It is hosted on a Linux VPS.
* **PM2** is used as the process manager to keep the Node server running and automatically restart it if it crashes.
* Environment variables (`.env`) are securely stored on the server to handle database strings and secrets.
* A custom bash script (`deploy.sh`) pulls the latest code, installs dependencies, runs Prisma migrations, builds the app, restarts PM2, and runs an automated health check on port `2323`.

---

## 23. Challenges & Solutions

### Problem: EADDRINUSE (Port Conflict) During Deployment

During deployment, the health check script kept failing because PM2 was attempting to start the server on a port that was already busy.

### Solution

I identified that Next.js standalone mode was overriding the environment variables via a hardcoded `server.js` file. I rewrote the entry point to dynamically accept ports (`process.env.PORT || '2323'`) and updated the server's bash script to ping the correct port.

### Why this solution?

Hardcoding ports is a bad practice. By making it dynamic, the application can now be safely spun up on any available port in the future without changing the core codebase.

---
