# Supabase セットアップ

1. [Supabase](https://supabase.com) でプロジェクトを作成する
2. SQL Editor で [`schema.sql`](./schema.sql) を実行する
3. Authentication → Providers → Email を有効化
4. Authentication → Providers → Email → **Enable sign ups を OFF**（招待制）
5. Authentication → URL Configuration にサイト URL と `https://YOUR_DOMAIN/auth/callback` を追加
6. 最初のユーザーを Auth → Users から作成／招待し、SQL で管理者にする:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

7. Project Settings → API の URL / anon key / service_role key を `.env.local` と Vercel に設定（[`.env.example`](../.env.example) 参照）
