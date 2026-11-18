# Layer Run

Sonsuz bir 3D tünel koşusu. Logodaki parlayan çekirdek, sonsuz bir neon tünelde uçar. Oyuncu onu yönlendirip engellerden kaçırır. Oyun Three.js ile çalışır: fizik tabanlı malzemeler, bloom, kromatik sapma ve film greni efektleri kullanılır. Global skor tablosu Vercel Functions + Upstash Redis üzerinde tutulur.

Canlı: https://move-cyan.vercel.app

## Oynanış

- **Sürükle:** Ekranın herhangi bir yerinde parmağını (bilgisayarda fareyi) kaydır, çekirdek o yöne gider.
- **Klavye:** `←` `↑` `↓` `→` ya da `W` `A` `S` `D`. `P` veya `Esc` duraklatır.
- **Engeller:** Yarım duvarlar, lazer ışınları, delikli duvarlar (açıklıktan geçmen gerekir), blok kümeleri ve dönen lazer pervaneleri. Hepsi mesafe arttıkça sırayla devreye girer.
- **Puan:** Gidilen her metre 1 puan. Bir engelin kıyısından sıyırırsan "near miss" +25, her enerji küresi +15. Küreler, bir sonraki engelin güvenli noktasına giden yolu gösterir.
- **Hız ve bölgeler:** Hız sürekli artar. Her 600 metrede yeni bir bölgeye geçilir ve tünelin renkleri değişir (Cyan Drift, Magma Core, Toxic Grid, Ultraviolet).

## Oyuna giriş: tek seferlik X görevleri

İlk kez PLAY'e basan oyuncu, oyuna girmeden önce sırayla şu adımları tamamlar. Her biten görevin üstüne bir sonraki kart gelir:

1. X kullanıcı adını yazar.
2. @LayerRun'ı takip eder.
3. Gönderiyi beğenir.
4. Gönderiyi repostlar.
5. Gönderiye yorum yazar. Yorumu oyuncu kendisi yazar, site hazır metin koymaz.
6. @LayerRun profilinde bildirimleri açar.

Görevler o cihazda bir kez yapılır. Sayfa kapanırsa kaldığı adımdan devam edilir. Bittiğinde kullanıcı adı Upstash'te `ntr:xusers` anahtarına kaydedilir (Upstash konsolu > Data Browser), skor tablosundaki isim alanı da bu adla dolu gelir.

Görevlerdeki gönderi `index.html` içindeki `X_POST_ID` değeridir (şu an `2122979606886281243`, linkin sonundaki sayı). Telefonda beğeni, repost ve yorum adımları gönderinin kendisini açar (X uygulamasında açılır). Bilgisayarda X'in tek dokunuşluk beğeni, repost ve boş yanıt kutusu sayfaları açılır.

Not: X, beğeni, repost ve yorumların bir web sitesi tarafından kontrol edilmesine ancak ücretli API'siyle izin verir. Bu yüzden adımlar güvene dayalıdır. Site doğru X sayfasını açar ve oyuncu "I'VE DONE IT" der. Kaydedilen kullanıcı adlarıyla elle kontrol yapılabilir.

## Yönetici sayfası

`/admin` adresi (ör. layerrun.fun/admin) şifreyle açılan bir yönetici sayfasıdır. Oyunda hiçbir yerden link verilmez, arama motorlarına kapalıdır.

- Skor tablosunu listeler, isimle arama yapılır.
- Şüpheli skorları işaretler: **ROUND** (20,000 gibi tam yuvarlak skorlar) ve **TOO HIGH** (30,000 üstü, en yüksek hızda 8 dakikadan uzun kusursuz oyun ister). İşaretler ipucudur, kanıt değildir.
- Tek tek veya toplu silme yapılır. Silme iki dokunuşla onaylanır, hemen ardından 10 saniye boyunca **UNDO** ile geri alınabilir. Silinen her kayıt (isim, skor, zaman) ayrıca `ntr:admin:deleted` listesinde saklanır.
- İlk 1.500'ü CSV olarak indirir (WL listesi için).

Şifre sunucuda kontrol edilir. Aynı IP'den 15 dakikada 10 yanlış denemeden sonra giriş 15 dakika kilitlenir. Kendi şifreni kullanmak için Vercel'de **Settings > Environment Variables** altına `ADMIN_PASSWORD` ekleyip yeniden yayınla. Bu değişken varsa koddaki yerleşik şifre devre dışı kalır.

## Proje yapısı

```
index.html          Oyunun tamamı (grafik, ses, arayüz)
api/session.js      POST  - her oyun başında tek kullanımlık bir oturum anahtarı verir
api/score.js        POST  - skoru doğrular ve kaydeder (oyuncu başına en iyi skor)
api/leaderboard.js  GET   - ilk 25 oyuncuyu ve toplam oyuncu sayısını döndürür
api/xtasks.js       POST  - X adımlarını bitiren oyuncunun kullanıcı adını kaydeder
api/admin.js        POST  - yönetici işlemleri (listele, sil, geri al), şifre ister
admin.html          Yönetici sayfası (/admin)
lib/redis.js        Upstash bağlantısı ve anahtar adları
vendor/             Three.js (sitenin kendisinden sunulur, dış CDN'e bağlı değildir)
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
