# Layer Run

Sonsuz bir 3D tünel koşusu. Logodaki parlayan çekirdek, sonsuz bir neon tünelde uçar. Oyuncu onu yönlendirip engellerden kaçırır. Oyun Three.js ile çalışır: fizik tabanlı malzemeler, bloom, kromatik sapma ve film greni efektleri kullanılır. Global skor tablosu Vercel Functions + Upstash Redis üzerinde tutulur.

Canlı: https://move-cyan.vercel.app

## Oynanış

- **Sürükle:** Ekranın herhangi bir yerinde parmağını (bilgisayarda fareyi) kaydır, çekirdek o yöne gider.
- **Klavye:** `←` `↑` `↓` `→` ya da `W` `A` `S` `D`. `P` veya `Esc` duraklatır.
- **Engeller:** Yarım duvarlar, lazer ışınları, delikli duvarlar (açıklıktan geçmen gerekir), blok kümeleri ve dönen lazer pervaneleri. Hepsi mesafe arttıkça sırayla devreye girer.
- **Puan:** Gidilen her metre 1 puan. Bir engelin kıyısından sıyırırsan "near miss" +25, her enerji küresi +15. Küreler, bir sonraki engelin güvenli noktasına giden yolu gösterir.
- **Hız ve bölgeler:** Hız sürekli artar. Her 600 metrede yeni bir bölgeye geçilir ve tünelin renkleri değişir (Cyan Drift, Magma Core, Toxic Grid, Ultraviolet).

## Oyuna giriş

İlk kez PLAY'e basan oyuncu bir kullanıcı adı seçer (2-15 harf, rakam veya _) ve oyun hemen başlar. Bu ad o cihazda hatırlanır ve skor tablosundaki isim alanına gelir. X görevleri sadece whitelist sayfasındadır.

## Whitelist sayfası

Admin sayfasındaki **Reset whitelist** (iki dokunuş) listeyi boşaltır; eski liste silinmez, `ntr:wl:backup:<tarih>` anahtarına taşınır.

Herkes adımlara sıfırdan başlar (oyundan adım aktarılmaz). Herkesi yeniden başlatmak için `whitelist.html` içindeki `KEY` değerini değiştirin; kapatmak için `api/wl.js` içinde `CLOSED = true` yapıp `/whitelist` yönlendirmesini kaldırın.


`/whitelist` (ör. layerrun.fun/whitelist): arka planda logodaki çekirdeğin enerji toplayıp patladığı canlı 3D efekt, önünde oyundakiyle aynı görev destesi. Adımlar: X kullanıcı adı, takip, beğeni, repost, yorum (oyuncu kendi yazar), bildirim, EVM cüzdan adresi (`0x…`).

- Kayıtlar Upstash'te `ntr:wl` (X kullanıcı adı → cüzdan) ve `ntr:wl:wallets` (cüzdan → kullanıcı adı) anahtarlarında. Bir X hesabı ve bir cüzdan yalnızca bir kez kaydolabilir.
- Oyunda kullanıcı adı, takip ve bildirim adımlarını yapmış olanlar bunları tekrar görmez.
- Gönderi `whitelist.html` içindeki `X_POST_ID` değeridir (şu an `2124494750153646133`). Telefonda gönderinin kendisi, bilgisayarda X'in tek tıklık sayfaları açılır. Değiştiğinde beğeni, repost ve yorum adımları herkes için sıfırlanır.

### $RUN airdrop sayfası

`/airdrop` (ör. layerrun.fun/airdrop): ortada görev destesi, arkada oyunun kendisi (`/?bg=1`: butonlar gizli, çekirdek tünelde kendi kendine oynar, renk bölgeleri değişir). Görev bitince "200,000 $RUN CLAIMED" kartı çıkar. Adımlar: X kullanıcı adı, takip, beğeni, repost, yorum, bildirim, EVM cüzdan adresi. Kayıtlar Redis'te `ntr:airdrop` (X hesabı başına bir kayıt) ve `ntr:airdrop:wallets` (cüzdan başına bir hesap) altında tutulur; liste admin sayfasından CSV olarak indirilir.

- Gönderi `airdrop.html` içindeki `X_POST_ID` değeridir (şu an `2124161154968613060`).
- Herkes adımlara sıfırdan başlar; oyundan veya whitelist'ten hiçbir adım aktarılmaz. Herkesi yeniden başlatmak için `airdrop.html` içindeki `KEY` değerini değiştirin.
- Kayıt sayısı sayfada "N JOINED" olarak görünür. Liste admin sayfasından **Download whitelist (CSV)** ile indirilir.

## Cüzdan gönderme / GTD (ilk 2.000)

Menüdeki **SUBMIT WALLET** butonu sadece ilk 2.000'deki oyunculara görünür: oyun, cihazdaki oyuncu isminin sırasını `GET /api/gtd?name=` ile en fazla 10 dakikada bir sorar ve her skor gönderiminde günceller. Bu buton (ve skor gönderdikten sonra ilk 2.000'deyse oyun sonu ekranındaki **SUBMIT YOUR WALLET**) bir ekran açar: oyuncu ismini ve EVM cüzdanını (`0x…`) girer. `/api/gtd` ismin sıralamada ilk 2.000'de olduğunu kontrol eder ve `ntr:gtd` (isim → cüzdan) ile `ntr:gtd:wallets` (cüzdan başına tek isim) içine kaydeder. Liste admin sayfasından **Download GTD (CSV)** ile indirilir: sıra, isim, skor, cüzdan, doğrulandı mı, tarih.

Başkasının ismiyle cüzdan girilmesine karşı: bir isim için en iyi skoru gönderen cihaza gizli bir anahtar verilir (`ntr:owner`) ve o isim için cüzdanı sadece o cihaz kaydedebilir ("verified: yes"). Bu özellikten önce gelmiş skorların anahtarı yoktur; onlarda ilk cüzdanı kaydeden cihaz ismi sahiplenir ("verified: no"). Kaydedilen cüzdanı sadece kaydeden cihaz değiştirebilir. Bir anlaşmazlıkta admin API'deki `gtdDelete` işlemi kaydı siler.

## Yönetici sayfası

`/admin` adresi (ör. layerrun.fun/admin) şifreyle açılan bir yönetici sayfasıdır. Oyunda hiçbir yerden link verilmez, arama motorlarına kapalıdır.

- Skor tablosunu listeler, isimle arama yapılır.
- Şüpheli skorları işaretler: **ROUND** (20,000 gibi tam yuvarlak skorlar) ve **TOO HIGH** (30,000 üstü, en yüksek hızda 8 dakikadan uzun kusursuz oyun ister). İşaretler ipucudur, kanıt değildir.
- Tek tek veya toplu silme yapılır. Silme iki dokunuşla onaylanır, hemen ardından 10 saniye boyunca **UNDO** ile geri alınabilir. Silinen her kayıt (isim, skor, zaman) ayrıca `ntr:admin:deleted` listesinde saklanır.
- İlk 1.500'ü CSV olarak indirir (WL listesi için).
- **Live now** paneli: şu an oyun içinde olan oyuncuları (X kullanıcı adı, anlık skor, mesafe, ne kadar süredir oynadığı) gösterir, 10 saniyede bir yenilenir. Oyun, oynanan her 60 saniyede bir `/api/live`'a sinyal gönderir (duraklatılmışken göndermez, 1 dakikadan kısa oyunlarda hiç göndermez). Bir oyun bitince kayıt 150 saniyede kendiliğinden silinir.

Şifre sunucuda kontrol edilir. Aynı IP'den 15 dakikada 10 yanlış denemeden sonra giriş 15 dakika kilitlenir. Kendi şifreni kullanmak için Vercel'de **Settings > Environment Variables** altına `ADMIN_PASSWORD` ekleyip yeniden yayınla. Bu değişken varsa koddaki yerleşik şifre devre dışı kalır.

## Proje yapısı

```
index.html          Oyunun tamamı (grafik, ses, arayüz)
api/session.js      POST  - her oyun başında tek kullanımlık bir oturum anahtarı verir
api/score.js        POST  - skoru doğrular ve kaydeder (oyuncu başına en iyi skor)
api/leaderboard.js  GET   - ilk 25 oyuncuyu ve toplam oyuncu sayısını döndürür
api/xtasks.js       POST  - (artık kullanılmıyor) eski X adımlarını bitirenleri kaydederdi
api/admin.js        POST  - yönetici işlemleri (listele, canlı oyuncular, sil, geri al), şifre ister
api/live.js         POST  - oyun sürerken gelen 30 saniyelik canlılık sinyali
api/wl.js           GET/POST - whitelist kayıt sayısı / kayıt (X kullanıcı adı + cüzdan)
whitelist.html      Whitelist sayfası (/whitelist)
admin.html          Yönetici sayfası (/admin)
lib/redis.js        Upstash bağlantısı ve anahtar adları
vendor/             Three.js (sitenin kendisinden sunulur, dış CDN'e bağlı değildir)
```

Skor tablosu `ntr:` ile başlayan anahtarlarda tutulur. Eski Chroma Ring skorları veritabanında ayrı durur, yeni tabloya karışmaz.

## İstek sayısı (Vercel limiti)

Vercel Hobby planda aylık 1 milyon CDN isteği vardır; aşılınca proje durdurulur. İsteği düşük tutmak için: 3D motor (`/vendor`) ve ikonlar tarayıcıda uzun süre saklanır, oyun sırasında sadece oyun başına 1 oturum isteği ve oynanan her 60 saniyede 1 sinyal gider, skor ve sıralama sadece oyuncu isteyince çağrılır.

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
- Sunucu oyunun ne kadar sürdüğünü kendi saatiyle ölçer. Üst sınır oyunun kendi kurallarından hesaplanır (`lib/runcheck.js`): hız eğrisi (24 → 62 m/s), engel aralığı ve engel başına en fazla 85 bonus (yakın geçiş 25 + 4 ışık × 15). Bu sürede hiç mümkün olmayan skor reddedilir.
- Oyun, oynanan her 60 saniyede bir `/api/live`'a anahtarla birlikte o anki skoru gönderir; bunlar `ntr:cp:<anahtar>` listesinde tutulur. Skor gönderilince sunucu baştan sona bu zaman çizelgesine bakar: skor iki kontrol arasında mümkün olandan hızlı artmışsa ya da 200 saniyeden uzun sessizlik içinde, o sürede oynanarak alınamayacak kadar büyük bir artış varsa reddeder.
- Kabul edilen her en iyi skorun süresi, kontrol sayısı ve işaretleri `ntr:runs` içinde saklanır. Admin sayfası bunları gösterir ve şunları işaretler: FAST (koşunun süresine göre güçlü bir oyuncudan hızlı), NO CHECKS (2,5 dakikadan uzun koşuda hiç kontrol yok), GAP (200 saniyeden uzun kontrolsüz aralıkta büyük artış).
- Aynı IP'den 3 saniyede en fazla 1 gönderim yapılabilir.

Tarayıcıda çalışan hiçbir oyun tamamen hileye kapalı değildir: sinyalleri de taklit eden ve gerçek zamanda bekleyen bir bot hâlâ teorik sınıra kadar skor gönderebilir. Bunu tamamen kapatmanın yolu oyunu sunucuda tekrar oynatmaktır.
