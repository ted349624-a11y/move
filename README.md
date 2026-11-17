# Chroma Ring

Sonsuz döngülü 3D ritim oyunu. Three.js (fizik tabanlı malzemeler, bloom, kromatik sapma, film grenli) ile çalışır. Global skor tablosu Vercel Functions + Upstash Redis üzerinde tutulur.

## Proje yapısı

```
index.html          Oyunun tamamı (grafik, ses, arayüz)
api/session.js      POST  - her oyun başında tek kullanımlık bir oturum anahtarı verir
api/score.js        POST  - skoru doğrular ve kaydeder (oyuncu başına en iyi skor)
api/leaderboard.js  GET   - ilk 25 oyuncuyu ve toplam oyuncu sayısını döndürür
lib/redis.js        Upstash bağlantısı
```

## Vercel'e deploy

1. Bu klasörü bir GitHub reposuna yükle.
2. vercel.com → **Add New → Project** → repoyu seç. Framework Preset: **Other**. Build ayarlarını boş bırak.
3. Proje açıldıktan sonra **Storage** sekmesi → **Create Database** → **Upstash for Redis** (Marketplace) → oluştur ve bu projeye bağla.
   Vercel ortam değişkenlerini (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) otomatik ekler.
4. **Deployments** → son deploy'un yanındaki menüden **Redeploy** de (değişkenlerin aktif olması için).

Upstash'i kendin oluşturduysan (console.upstash.com), proje ayarlarında şu iki değişkeni elle ekle:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Yerelde çalıştırma

```bash
npm i -g vercel
npm install
vercel link
vercel env pull .env.local
vercel dev
```

## Hile koruması

- Her oyun sunucudan tek kullanımlık bir oturum anahtarı alır; skor bu anahtar olmadan kabul edilmez.
- Sunucu, oyunun ne kadar sürdüğünü kendi saatiyle ölçer ve o sürede ulaşılamayacak skorları reddeder.
- Aynı IP'den 3 saniyede en fazla 1 gönderim yapılabilir.

Tarayıcıda çalışan hiçbir oyun tamamen hileye kapalı değildir, ama bu önlemler basit sahte istekleri engeller.

## Notlar

- Skor tablosu isim bazlıdır: aynı ismi kullanan iki kişi tek satırı paylaşır ve sadece en yüksek skor tutulur.
- Kontroller: ekranın sol/sağ yarısına dokun ya da `A`/`D`, `←`/`→`. `P` veya `Esc` duraklatır.
- Zorluk: her isabetle toplar hızlanır, her 10'lu komboda çarpan artar (en fazla x5).
