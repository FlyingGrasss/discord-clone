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
