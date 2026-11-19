# Meydan

Türkçe topluluklar için sade, gerçek zamanlı sohbet uygulaması (Discord benzeri).

## Çalıştırma

```bash
pnpm install
pnpm dev        # Next (3000) + API/WS (4300)
pnpm seed       # demo sunucu: RavenMUN, kullanıcı: elif / demo1234
```

## Demo verisi

`pnpm seed` boş veritabanına RavenMUN sunucusunu, altı kullanıcıyı, üç kanalı ve 30 mesajı ekler. Tüm demo hesaplarının parolası `demo1234`:

- Kullanıcılar: `elif` (sunucu sahibi), `mert`, `zeynep`, `can`, `selin`, `burak`
- Giriş: http://localhost:3000/giris
- Davet: http://localhost:3000/davet/RAVENMUN

`pnpm seed:reset` veritabanını temizleyip yeniden tohumlar (üretimde reddedilir); `pnpm dev` başlamadan önce `--if-empty` ile boş veritabanı otomatik tohumlanır.

## Komutlar

- `pnpm dev` — web + api birlikte
- `pnpm dev:web` / `pnpm dev:api` — tek tek
- `pnpm smoke:rest` — REST uçtan uca test
- `pnpm smoke:ws` — WebSocket testi (U2)
- `pnpm typecheck`, `pnpm typecheck:server`, `pnpm lint`, `pnpm build`

## Yapı

- `src/app` — Next App Router arayüzü (U3/U4)
- `server/` — Express + ws + SQLite (better-sqlite3), WAL, oturumlar scrypt + opak token
- `shared/` — protokol ve doğrulama tipleri
- `data/` — `meydan.db` (git dışı)

## Sınırlar

- Tek süreç: SQLite tek yazıcı, bellek içi rate limit / presence. Ölçek için Postgres + Redis gerekir.
- Sesli/görüntülü, DM, rol/yetki, dosya yükleme ve moderasyon v2'de.

## Docker ile dağıtım

Depoda `Dockerfile`, `.dockerignore`, `docker-compose.yml` ve `scripts/start.sh` var. İmaj Next.js'i derler; aynı konteynerde `tsx` ile API/WebSocket (4300) ve `next start` (3000) çalışır. Süreçler root olmayan `node` kullanıcısı (UID 1000) ile çalışır, `NODE_ENV=production` sabittir ve imaja secret gömülmez.

```bash
cat > .env <<'EOF'
APP_ORIGINS=https://chat.example.com
NEXT_PUBLIC_REALTIME_PORT=443
TRUST_PROXY=1
EOF

docker compose up -d --build
docker compose logs -f app
```

- Yayınlanan port: yalnızca `3000`. API/WebSocket `4300` yalnızca Compose ağına `expose` edilir.
- Zorunlu: `APP_ORIGINS` (public web origin). `NEXT_PUBLIC_REALTIME_PORT` derleme zamanındadır; varsayılan `4300`, TLS proxy arkasında `/ws` yönlendirilecekse `443` kullanın. Değiştirdikten sonra yeniden derleyin.
- Next.js `/api/*` isteklerini proxy'ler ama WebSocket upgrade'lerini proxy'lemez. Ters proxy `/ws` yolunu doğrudan `app:4300`'e yönlendirmeli; proxy host'ta çalışıyorsa `4300:4300` portunu yayınlayın ve varsayılan derleme portunu kullanın. `docker-compose.yml` içinde Caddy örneği yorum olarak duruyor.
- Kalıcılık: `./data` host dizini `/app/data`'ya bağlanır (`meydan.db`, `-wal`, `-shm`). Linux'ta önce `mkdir -p data && sudo chown -R 1000:1000 data`.
- Health check: `GET /api/health` (3000 üzerinden Next rewrite ile 4300'e gider).
- `scripts/start.sh` her açılışta `tsx server/seed.ts --if-empty` çalıştırır. Boş veritabanında `demo1234` parolalı demo hesaplar oluşur; public dağıtımda ilk açılıştan sonra seed adımını kaldırın veya parolaları değiştirin.
- Tek instance: SQLite ve bellek içi presence/rate limit yatay ölçeklenmez. `docker compose down` veriyi silmez.
