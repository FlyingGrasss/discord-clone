# AGENTS.md

- Yeşil alan demo uygulaması: "Meydan", Türkçe Discord benzeri sohbet.
- Yetkilendirme Express servislerinde ve WS handler'larında yapılır; Next layout kontrolleri yalnızca UX içindir.
- Her sorgu üyelikle kapsanır; üye olmayan okumalar 404 döner.
- Kimlik: opak oturum tokenı (DB'de sha256), scrypt şifre hash'i; cookie HttpOnly + SameSite=Lax.
- Mutasyonlarda `X-Meydan-Client: web` başlığı + Origin allowlist + JSON gövde zorunlu.
- SQLite tek süreç; WAL açık, yabancı anahtarlar açık.
- Sırlar, oturum tokenları ve mesaj içerikleri loglanmaz.
- Türkçe metinler UTF-8; mojibake yasak.
- Demo verisi `pnpm seed` ile yüklenir; `--reset` üretim ortamında reddedilir.
