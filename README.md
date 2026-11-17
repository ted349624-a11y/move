# Neon Tunnel Runner

Sonsuz bir 3D tünel koşusu. Logodaki parlayan çekirdek, sonsuz bir neon tünelde uçar. Oyuncu onu yönlendirip engellerden kaçırır. Oyun Three.js ile çalışır: fizik tabanlı malzemeler, bloom, kromatik sapma ve film greni efektleri kullanılır. Global skor tablosu Vercel Functions + Upstash Redis üzerinde tutulur.

Canlı: https://move-cyan.vercel.app

## Oynanış

- **Sürükle:** Ekranın herhangi bir yerinde parmağını (bilgisayarda fareyi) kaydır, çekirdek o yöne gider.
- **Klavye:** `←` `↑` `↓` `→` ya da `W` `A` `S` `D`. `P` veya `Esc` duraklatır.
- **Engeller:** Yarım duvarlar, lazer ışınları, delikli duvarlar (açıklıktan geçmen gerekir), blok kümeleri ve dönen lazer pervaneleri. Hepsi mesafe arttıkça sırayla devreye girer.
- **Puan:** Gidilen her metre 1 puan. Bir engelin kıyısından sıyırırsan "near miss" +25, her enerji küresi +15. Küreler, bir sonraki engelin güvenli noktasına giden yolu gösterir.
- **Hız ve bölgeler:** Hız sürekli artar. Her 600 metrede yeni bir bölgeye geçilir ve tünelin renkleri değişir (Cyan Drift, Magma Core, Toxic Grid, Ultraviolet).

## Proje yapısı

```
index.html          Oyunun tamamı (grafik, ses, arayüz)
api/session.js      POST  - her oyun başında tek kullanımlık bir oturum anahtarı verir
api/score.js        POST  - skoru doğrular ve kaydeder (oyuncu başına en iyi skor)
api/leaderboard.js  GET   - ilk 25 oyuncuyu ve toplam oyuncu sayısını döndürür
lib/redis.js        Upstash bağlantısı ve anahtar adları
```

Skor tablosu `ntr:` ile başlayan anahtarlarda tutulur. Eski Chroma Ring skorları veritabanında ayrı durur, yeni tabloya karışmaz.

## Yayın

`main` dalına gelen her değişikliği Vercel otomatik olarak yayına alır. Upstash bağlantısı Vercel'in **Storage** sekmesinden yapılır, gerekli ortam değişkenleri (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) Vercel tarafından eklenir. Upstash'i elle kurduysan şu iki değişkeni de kullanabilirsin:

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

- Her oyun sunucudan tek kullanımlık bir oturum anahtarı alır. Skor bu anahtar olmadan kabul edilmez.
- Sunucu oyunun ne kadar sürdüğünü kendi saatiyle ölçer ve o sürede ulaşılamayacak skorları reddeder.
- Aynı IP'den 3 saniyede en fazla 1 gönderim yapılabilir.

Tarayıcıda çalışan hiçbir oyun tamamen hileye kapalı değildir, ama bu önlemler basit sahte istekleri engeller.
