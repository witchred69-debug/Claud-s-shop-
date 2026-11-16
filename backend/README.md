# Claud's Shop backend

This API uses Node.js, Express and Supabase. The service-role key is read only from the hosting provider's environment variables; never put it in `index.html`, GitHub, or a message.

## Setup

1. Create a Supabase project and open **SQL Editor**.
2. Run the contents of `backend/schema.sql`.
3. In Supabase **Authentication → Users**, invite the admin email address. Disable public sign-up if customers should not create accounts.
4. Deploy this folder as a Node web service on a host such as Render. Set its root directory to `backend`, build command to `npm install`, and start command to `npm start`.
5. Set these server environment variables in the host dashboard:
   - `SUPABASE_URL`: the project's URL
   - `SUPABASE_SERVICE_ROLE_KEY`: the private service-role key (server only)
   - `ADMIN_EMAILS`: comma-separated email addresses allowed to administer products and view orders
   - `ALLOWED_ORIGINS`: the exact public website origin, e.g. `https://ACCOUNT.github.io`; include the project site origin if the site is published under a repository path
6. The API health check is `/api/health`; public products are at `/api/products`.

The API validates order product IDs and computes prices from the database, rather than trusting prices sent by a browser. Admin endpoints require a valid Supabase access token and an email listed in `ADMIN_EMAILS`. The current static page is not yet connected to this API; its checkout still opens WhatsApp and its local product list remains browser-local until frontend integration is added.
