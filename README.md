# Ecommerce

Next.js application backed by Supabase.

## Local baseline

Use only credentials from the local Supabase stack. Never copy hosted credentials into the local environment.

1. Install the locked dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Start Supabase locally:

   ```bash
   pnpm exec supabase start
   ```

3. Rebuild the local database from migrations and seed data:

   ```bash
   pnpm exec supabase db reset --local
   ```

4. Create the local environment file:

   ```bash
   cp local-env.sample .env.local
   pnpm exec supabase status -o env
   ```

   Complete `.env.local` with the local values reported by Supabase. Map `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` to the variable names already present in the sample.

5. Bootstrap the local smoke users:

   ```bash
   pnpm smoke:bootstrap
   ```

6. Run static validation:

   ```bash
   pnpm lint
   ```

7. Build the application:

   ```bash
   pnpm build
   ```

To run the development server afterward:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
