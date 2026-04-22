import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const allLocaleReplies: { title: string; body: string; tag: string; locale: string }[] = [
  // Chinese (zh)
  { title: "感谢您的反馈", body: "感谢您花时间分享您的反馈！我们非常感激，将用它来改进我们的应用。", tag: "feedback", locale: "zh" },
  { title: "我们正在处理", body: "感谢您的报告！我们的团队目前正在调查此问题，我们会尽快向您提供最新进展。", tag: "triage", locale: "zh" },
  { title: "问题已解决 – 请更新", body: "好消息！此问题已在我们的最新更新中解决。请将应用更新到最新版本，如问题仍然存在，请告诉我们。", tag: "support", locale: "zh" },
  // Hindi (hi)
  { title: "आपकी प्रतिक्रिया के लिए धन्यवाद", body: "अपनी प्रतिक्रिया साझा करने के लिए समय निकालने के लिए धन्यवाद! हम इसकी बहुत सराहना करते हैं और इसे अपने ऐप को बेहतर बनाने के लिए उपयोग करेंगे।", tag: "feedback", locale: "hi" },
  { title: "हम इस पर काम कर रहे हैं", body: "रिपोर्ट करने के लिए धन्यवाद! हमारी टीम वर्तमान में समस्या की जांच कर रही है और हम जल्द ही आपको अपडेट देंगे।", tag: "triage", locale: "hi" },
  { title: "समस्या हल हो गई – कृपया अपडेट करें", body: "अच्छी खबर! यह समस्या हमारे नवीनतम अपडेट में हल हो गई है। कृपया ऐप को नवीनतम संस्करण में अपडेट करें।", tag: "support", locale: "hi" },
  // Portuguese (pt)
  { title: "Obrigado pelo seu feedback", body: "Obrigado por dedicar um tempo para compartilhar seu feedback! Agradecemos muito e o usaremos para melhorar nosso aplicativo.", tag: "feedback", locale: "pt" },
  { title: "Estamos trabalhando nisso", body: "Obrigado por relatar isso! Nossa equipe está investigando o problema atualmente e em breve teremos uma atualização para você.", tag: "triage", locale: "pt" },
  { title: "Problema resolvido – por favor, atualize", body: "Ótimas notícias! Este problema foi resolvido em nossa última atualização. Por favor, atualize o aplicativo para a versão mais recente.", tag: "support", locale: "pt" },
  // Turkish (tr)
  { title: "Geri bildiriminiz için teşekkürler", body: "Geri bildiriminizi paylaşmak için zaman ayırdığınız için teşekkür ederiz! Bunu çok takdir ediyoruz ve uygulamamızı geliştirmek için kullanacağız.", tag: "feedback", locale: "tr" },
  { title: "Üzerinde çalışıyoruz", body: "Bildirdiğiniz için teşekkürler! Ekibimiz şu anda sorunu araştırıyor ve yakında size bir güncelleme sunacağız.", tag: "triage", locale: "tr" },
  { title: "Sorun çözüldü – lütfen güncelleyin", body: "Harika haberler! Bu sorun en son güncellememizde çözüldü. Lütfen uygulamayı en son sürüme güncelleyin.", tag: "support", locale: "tr" },
  // Russian (ru)
  { title: "Спасибо за отзыв", body: "Спасибо, что нашли время поделиться своим отзывом! Мы очень ценим это и используем для улучшения нашего приложения.", tag: "feedback", locale: "ru" },
  { title: "Мы работаем над этим", body: "Спасибо за сообщение! Наша команда в настоящее время расследует проблему и скоро сообщит вам об обновлениях.", tag: "triage", locale: "ru" },
  { title: "Проблема решена – обновите приложение", body: "Отличные новости! Эта проблема была решена в нашем последнем обновлении. Пожалуйста, обновите приложение до последней версии.", tag: "support", locale: "ru" },
  // Japanese (ja)
  { title: "フィードバックありがとうございます", body: "フィードバックをお寄せいただきありがとうございます！大変感謝しております。アプリの改善に役立てさせていただきます。", tag: "feedback", locale: "ja" },
  { title: "対応中です", body: "ご報告ありがとうございます！現在チームが問題を調査中です。近日中にアップデートをお知らせします。", tag: "triage", locale: "ja" },
  { title: "問題が解決しました – アップデートしてください", body: "お知らせです！この問題は最新のアップデートで解決されました。アプリを最新バージョンに更新してください。", tag: "support", locale: "ja" },
  // Korean (ko)
  { title: "피드백 감사합니다", body: "피드백을 공유해 주셔서 감사합니다! 앱 개선을 위해 소중히 활용하겠습니다.", tag: "feedback", locale: "ko" },
  { title: "처리 중입니다", body: "신고해 주셔서 감사합니다! 현재 팀에서 문제를 조사 중이며, 곧 업데이트를 알려드리겠습니다.", tag: "triage", locale: "ko" },
  { title: "문제 해결됨 – 업데이트 해주세요", body: "좋은 소식입니다! 이 문제는 최신 업데이트에서 해결되었습니다. 앱을 최신 버전으로 업데이트해 주세요.", tag: "support", locale: "ko" },
  // Italian (it)
  { title: "Grazie per il tuo feedback", body: "Grazie per aver dedicato del tempo a condividere la tua opinione! Lo apprezziamo molto e lo useremo per migliorare la nostra app.", tag: "feedback", locale: "it" },
  { title: "Stiamo lavorando su questo", body: "Grazie per la segnalazione! Il nostro team sta attualmente investigando il problema e ti aggiorneremo al più presto.", tag: "triage", locale: "it" },
  { title: "Problema risolto – aggiorna l'app", body: "Ottime notizie! Questo problema è stato risolto nell'ultimo aggiornamento. Aggiorna l'app all'ultima versione.", tag: "support", locale: "it" },
  // Dutch (nl)
  { title: "Bedankt voor je feedback", body: "Bedankt voor het nemen van de tijd om je feedback te delen! We waarderen het zeer en zullen het gebruiken om onze app te verbeteren.", tag: "feedback", locale: "nl" },
  { title: "We werken eraan", body: "Bedankt voor de melding! Ons team onderzoekt het probleem momenteel en we laten je zo snel mogelijk weten wat de stand van zaken is.", tag: "triage", locale: "nl" },
  { title: "Probleem opgelost – update de app", body: "Goed nieuws! Dit probleem is opgelost in onze laatste update. Update de app naar de nieuwste versie.", tag: "support", locale: "nl" },
  // Polish (pl)
  { title: "Dziękujemy za opinię", body: "Dziękujemy za poświęcenie czasu na podzielenie się swoją opinią! Bardzo to doceniamy i wykorzystamy to do ulepszenia naszej aplikacji.", tag: "feedback", locale: "pl" },
  { title: "Pracujemy nad tym", body: "Dziękujemy za zgłoszenie! Nasz zespół aktualnie bada ten problem i wkrótce poinformujemy Cię o postępach.", tag: "triage", locale: "pl" },
  { title: "Problem rozwiązany – zaktualizuj aplikację", body: "Świetne wieści! Ten problem został rozwiązany w naszej najnowszej aktualizacji. Zaktualizuj aplikację do najnowszej wersji.", tag: "support", locale: "pl" },
  // Swedish (sv)
  { title: "Tack för din feedback", body: "Tack för att du tog dig tid att dela din feedback! Vi uppskattar det verkligen och kommer att använda det för att förbättra vår app.", tag: "feedback", locale: "sv" },
  { title: "Vi arbetar på det", body: "Tack för att du rapporterade detta! Vårt team undersöker problemet för närvarande och vi kommer att ha en uppdatering till dig snart.", tag: "triage", locale: "sv" },
  { title: "Problem löst – vänligen uppdatera", body: "Goda nyheter! Detta problem har lösts i vår senaste uppdatering. Uppdatera appen till den senaste versionen.", tag: "support", locale: "sv" },
  // Norwegian (no)
  { title: "Takk for tilbakemeldingen din", body: "Takk for at du tok deg tid til å dele tilbakemeldingen din! Vi setter stor pris på det og vil bruke det til å forbedre appen vår.", tag: "feedback", locale: "no" },
  { title: "Vi jobber med det", body: "Takk for at du rapporterte dette! Teamet vårt undersøker problemet for øyeblikket, og vi vil gi deg en oppdatering snart.", tag: "triage", locale: "no" },
  { title: "Problem løst – vennligst oppdater", body: "Gode nyheter! Dette problemet er løst i vår siste oppdatering. Oppdater appen til den nyeste versjonen.", tag: "support", locale: "no" },
  // Danish (da)
  { title: "Tak for din feedback", body: "Tak fordi du tog dig tid til at dele din feedback! Vi sætter stor pris på det og vil bruge det til at forbedre vores app.", tag: "feedback", locale: "da" },
  { title: "Vi arbejder på det", body: "Tak for at du rapporterede dette! Vores team undersøger i øjeblikket problemet, og vi vil have en opdatering til dig snart.", tag: "triage", locale: "da" },
  { title: "Problem løst – opdater venligst", body: "Gode nyheder! Dette problem er løst i vores seneste opdatering. Opdater appen til den nyeste version.", tag: "support", locale: "da" },
  // Finnish (fi)
  { title: "Kiitos palautteestasi", body: "Kiitos, että käytit aikaa palautteesi jakamiseen! Arvostamme sitä suuresti ja käytämme sitä sovelluksemme parantamiseen.", tag: "feedback", locale: "fi" },
  { title: "Työskentelemme asian parissa", body: "Kiitos ilmoittamisesta! Tiimimme tutkii tällä hetkellä ongelmaa ja saat pian päivityksen.", tag: "triage", locale: "fi" },
  { title: "Ongelma ratkaistu – päivitä sovellus", body: "Hyviä uutisia! Tämä ongelma on ratkaistu viimeisimmässä päivityksessämme. Päivitä sovellus uusimpaan versioon.", tag: "support", locale: "fi" },
  // Greek (el)
  { title: "Ευχαριστούμε για τα σχόλιά σας", body: "Ευχαριστούμε που αφιερώσατε χρόνο για να μοιραστείτε τα σχόλιά σας! Το εκτιμούμε πολύ και θα το χρησιμοποιήσουμε για να βελτιώσουμε την εφαρμογή μας.", tag: "feedback", locale: "el" },
  { title: "Εργαζόμαστε πάνω σε αυτό", body: "Ευχαριστούμε για την αναφορά! Η ομάδα μας διερευνά αυτήν τη στιγμή το πρόβλημα και σύντομα θα έχουμε μια ενημέρωση για εσάς.", tag: "triage", locale: "el" },
  { title: "Το πρόβλημα επιλύθηκε – παρακαλώ ενημερώστε", body: "Χαρούμενα νέα! Αυτό το πρόβλημα έχει επιλυθεί στην τελευταία μας ενημέρωση. Ενημερώστε την εφαρμογή στην πιο πρόσφατη έκδοση.", tag: "support", locale: "el" },
  // Czech (cs)
  { title: "Děkujeme za vaši zpětnou vazbu", body: "Děkujeme, že jste si vzali čas a podělili se o svou zpětnou vazbu! Velmi si toho vážíme a použijeme ji ke zlepšení naší aplikace.", tag: "feedback", locale: "cs" },
  { title: "Pracujeme na tom", body: "Děkujeme za nahlášení! Náš tým právě zkoumá problém a brzy vám poskytneme aktualizaci.", tag: "triage", locale: "cs" },
  { title: "Problém vyřešen – prosím aktualizujte", body: "Skvělé zprávy! Tento problém byl vyřešen v naší nejnovější aktualizaci. Aktualizujte prosím aplikaci na nejnovější verzi.", tag: "support", locale: "cs" },
  // Hungarian (hu)
  { title: "Köszönjük a visszajelzését", body: "Köszönjük, hogy időt szánt visszajelzése megosztására! Nagyra értékeljük, és felhasználjuk alkalmazásunk fejlesztéséhez.", tag: "feedback", locale: "hu" },
  { title: "Dolgozunk rajta", body: "Köszönjük a bejelentést! Csapatunk jelenleg vizsgálja a problémát, és hamarosan frissítést küldünk Önnek.", tag: "triage", locale: "hu" },
  { title: "Probléma megoldva – kérjük frissítse", body: "Nagyszerű hír! Ezt a problémát legújabb frissítésünkben megoldottuk. Frissítse az alkalmazást a legújabb verzióra.", tag: "support", locale: "hu" },
  // Romanian (ro)
  { title: "Mulțumim pentru feedback", body: "Mulțumim că ați luat timp să împărtășiți feedback-ul dvs.! Apreciem foarte mult și îl vom folosi pentru a îmbunătăți aplicația noastră.", tag: "feedback", locale: "ro" },
  { title: "Lucrăm la asta", body: "Mulțumim pentru raportare! Echipa noastră investighează în prezent problema și în curând veți primi o actualizare.", tag: "triage", locale: "ro" },
  { title: "Problemă rezolvată – vă rugăm actualizați", body: "Vești bune! Această problemă a fost rezolvată în cea mai recentă actualizare. Vă rugăm actualizați aplicația la cea mai nouă versiune.", tag: "support", locale: "ro" },
  // Thai (th)
  { title: "ขอบคุณสำหรับคำติชมของคุณ", body: "ขอบคุณที่สละเวลาแบ่งปันคำติชมของคุณ! เราซาบซึ้งใจมากและจะนำไปใช้เพื่อปรับปรุงแอปของเรา", tag: "feedback", locale: "th" },
  { title: "เรากำลังดำเนินการอยู่", body: "ขอบคุณที่รายงาน! ทีมของเรากำลังตรวจสอบปัญหาอยู่และจะมีการอัปเดตให้คุณเร็วๆ นี้", tag: "triage", locale: "th" },
  { title: "แก้ไขปัญหาแล้ว – กรุณาอัปเดต", body: "ข่าวดี! ปัญหานี้ได้รับการแก้ไขในการอัปเดตล่าสุดของเรา กรุณาอัปเดตแอปเป็นเวอร์ชันล่าสุด", tag: "support", locale: "th" },
  // Vietnamese (vi)
  { title: "Cảm ơn phản hồi của bạn", body: "Cảm ơn bạn đã dành thời gian chia sẻ phản hồi! Chúng tôi rất trân trọng điều này và sẽ sử dụng để cải thiện ứng dụng.", tag: "feedback", locale: "vi" },
  { title: "Chúng tôi đang xử lý", body: "Cảm ơn bạn đã báo cáo! Nhóm của chúng tôi hiện đang điều tra vấn đề và sẽ sớm có cập nhật cho bạn.", tag: "triage", locale: "vi" },
  { title: "Đã giải quyết – vui lòng cập nhật", body: "Tin vui! Vấn đề này đã được giải quyết trong bản cập nhật mới nhất. Vui lòng cập nhật ứng dụng lên phiên bản mới nhất.", tag: "support", locale: "vi" },
  // Indonesian (id)
  { title: "Terima kasih atas masukan Anda", body: "Terima kasih telah meluangkan waktu untuk berbagi masukan Anda! Kami sangat menghargainya dan akan menggunakannya untuk meningkatkan aplikasi kami.", tag: "feedback", locale: "id" },
  { title: "Kami sedang mengerjakannya", body: "Terima kasih telah melaporkan! Tim kami sedang menyelidiki masalah ini dan akan segera memberikan pembaruan kepada Anda.", tag: "triage", locale: "id" },
  { title: "Masalah teratasi – mohon perbarui", body: "Kabar baik! Masalah ini telah diselesaikan dalam pembaruan terbaru kami. Perbarui aplikasi ke versi terbaru.", tag: "support", locale: "id" },
  // Malay (ms)
  { title: "Terima kasih atas maklum balas anda", body: "Terima kasih kerana meluangkan masa untuk berkongsi maklum balas anda! Kami sangat menghargainya dan akan menggunakannya untuk meningkatkan aplikasi kami.", tag: "feedback", locale: "ms" },
  { title: "Kami sedang bekerja ke atasnya", body: "Terima kasih kerana melaporkan! Pasukan kami sedang menyiasat masalah ini dan akan segera memberikan kemas kini kepada anda.", tag: "triage", locale: "ms" },
  { title: "Masalah diselesaikan – sila kemas kini", body: "Berita baik! Masalah ini telah diselesaikan dalam kemas kini terbaru kami. Sila kemas kini aplikasi ke versi terbaru.", tag: "support", locale: "ms" },
  // Bengali (bn)
  { title: "আপনার মতামতের জন্য ধন্যবাদ", body: "আপনার মতামত শেয়ার করতে সময় নেওয়ার জন্য ধন্যবাদ! আমরা এটি অত্যন্ত প্রশংসা করি এবং আমাদের অ্যাপ উন্নত করতে ব্যবহার করব।", tag: "feedback", locale: "bn" },
  { title: "আমরা এটি নিয়ে কাজ করছি", body: "রিপোর্ট করার জন্য ধন্যবাদ! আমাদের দল বর্তমানে সমস্যাটি তদন্ত করছে এবং শীঘ্রই আপনাকে আপডেট জানাব।", tag: "triage", locale: "bn" },
  { title: "সমস্যা সমাধান হয়েছে – আপডেট করুন", body: "সুখবর! এই সমস্যাটি আমাদের সর্বশেষ আপডেটে সমাধান করা হয়েছে। অনুগ্রহ করে অ্যাপটি সর্বশেষ সংস্করণে আপডেট করুন।", tag: "support", locale: "bn" },
  // Persian (fa)
  { title: "ممنون از بازخورد شما", body: "ممنون که وقت گذاشتید و بازخورد خود را با ما در میان گذاشتید! ما قدردان هستیم و از آن برای بهبود اپلیکیشن استفاده می‌کنیم.", tag: "feedback", locale: "fa" },
  { title: "در حال بررسی هستیم", body: "ممنون از گزارش شما! تیم ما در حال حاضر در حال بررسی مشکل است و به زودی به شما اطلاع می‌دهیم.", tag: "triage", locale: "fa" },
  { title: "مشکل حل شد – لطفاً بروزرسانی کنید", body: "خبر خوب! این مشکل در آخرین بروزرسانی ما برطرف شده است. لطفاً اپلیکیشن را به آخرین نسخه بروزرسانی کنید.", tag: "support", locale: "fa" },
  // Ukrainian (uk)
  { title: "Дякуємо за відгук", body: "Дякуємо, що знайшли час поділитися своїм відгуком! Ми дуже цінуємо це і використаємо для покращення нашого додатку.", tag: "feedback", locale: "uk" },
  { title: "Ми працюємо над цим", body: "Дякуємо за повідомлення! Наша команда наразі розслідує проблему і незабаром надасть вам оновлення.", tag: "triage", locale: "uk" },
  { title: "Проблему вирішено – оновіть додаток", body: "Чудові новини! Цю проблему було вирішено в нашому останньому оновленні. Будь ласка, оновіть додаток до останньої версії.", tag: "support", locale: "uk" },
  // Hebrew (he)
  { title: "תודה על המשוב שלך", body: "תודה שלקחת את הזמן לשתף את המשוב שלך! אנו מעריכים זאת מאוד ונשתמש בו כדי לשפר את האפליקציה שלנו.", tag: "feedback", locale: "he" },
  { title: "אנו עובדים על כך", body: "תודה על הדיווח! הצוות שלנו חוקר כרגע את הבעיה ונעדכן אותך בקרוב.", tag: "triage", locale: "he" },
  { title: "הבעיה נפתרה – אנא עדכן", body: "חדשות טובות! בעיה זו נפתרה בעדכון האחרון שלנו. אנא עדכן את האפליקציה לגרסה האחרונה.", tag: "support", locale: "he" },
  // Serbian (sr)
  { title: "Hvala na povratnim informacijama", body: "Hvala što ste odvojili vreme da podelite svoje mišljenje! Veoma to cenimo i koristićemo to za poboljšanje naše aplikacije.", tag: "feedback", locale: "sr" },
  { title: "Radimo na tome", body: "Hvala na prijavi! Naš tim trenutno istražuje problem i uskoro ćemo vas obavestiti o ažuriranjima.", tag: "triage", locale: "sr" },
  { title: "Problem rešen – molimo ažurirajte", body: "Sjajne vesti! Ovaj problem je rešen u našem poslednjem ažuriranju. Molimo ažurirajte aplikaciju na najnoviju verziju.", tag: "support", locale: "sr" },
  // Croatian (hr)
  { title: "Hvala na povratnoj informaciji", body: "Hvala što ste odvojili vrijeme za dijeljenje povratne informacije! Vrlo to cijenimo i koristit ćemo to za poboljšanje naše aplikacije.", tag: "feedback", locale: "hr" },
  { title: "Radimo na tome", body: "Hvala na prijavi! Naš tim trenutno istražuje problem i uskoro ćemo vas obavijestiti o ažuriranjima.", tag: "triage", locale: "hr" },
  { title: "Problem riješen – molimo ažurirajte", body: "Sjajne vijesti! Ovaj problem je riješen u našem posljednjem ažuriranju. Molimo ažurirajte aplikaciju na najnoviju verziju.", tag: "support", locale: "hr" },
  // Slovak (sk)
  { title: "Ďakujeme za vašu spätnú väzbu", body: "Ďakujeme, že ste si vzali čas a podelili sa o svoju spätnú väzbu! Veľmi si to vážime a použijeme to na zlepšenie našej aplikácie.", tag: "feedback", locale: "sk" },
  { title: "Pracujeme na tom", body: "Ďakujeme za nahlásenie! Náš tým práve skúma problém a čoskoro vám poskytneme aktualizáciu.", tag: "triage", locale: "sk" },
  { title: "Problém vyriešený – prosím aktualizujte", body: "Skvelé správy! Tento problém bol vyriešený v našej najnovšej aktualizácii. Aktualizujte prosím aplikáciu na najnovšiu verziu.", tag: "support", locale: "sk" },
  // Bulgarian (bg)
  { title: "Благодарим за отзива ви", body: "Благодарим, че отделихте време да споделите своя отзив! Много го ценим и ще го използваме за подобряване на нашето приложение.", tag: "feedback", locale: "bg" },
  { title: "Работим по това", body: "Благодарим за докладването! Нашият екип в момента разследва проблема и скоро ще ви информираме за актуализации.", tag: "triage", locale: "bg" },
  { title: "Проблемът е решен – моля актуализирайте", body: "Страхотни новини! Този проблем беше решен в последната ни актуализация. Моля, актуализирайте приложението до последната версия.", tag: "support", locale: "bg" },
  // Lithuanian (lt)
  { title: "Ačiū už jūsų atsiliepimą", body: "Ačiū, kad skyrėte laiko pasidalyti savo atsiliepimu! Labai tai vertiname ir naudosime savo programėlei tobulinti.", tag: "feedback", locale: "lt" },
  { title: "Dirbame prie to", body: "Ačiū už pranešimą! Mūsų komanda šiuo metu tiria problemą ir netrukus informuosime apie atnaujinimus.", tag: "triage", locale: "lt" },
  { title: "Problema išspręsta – prašome atnaujinti", body: "Puikios naujienos! Ši problema buvo išspręsta mūsų naujausiniame atnaujinime. Prašome atnaujinti programėlę iki naujausios versijos.", tag: "support", locale: "lt" },
  // Latvian (lv)
  { title: "Paldies par jūsu atsauksmi", body: "Paldies, ka veltījāt laiku, lai dalītos ar savu atsauksmi! Mēs to ļoti novērtējam un izmantosim, lai uzlabotu mūsu lietotni.", tag: "feedback", locale: "lv" },
  { title: "Mēs strādājam pie tā", body: "Paldies par ziņojumu! Mūsu komanda šobrīd izmeklē problēmu un drīz jūs informēsim par atjauninājumiem.", tag: "triage", locale: "lv" },
  { title: "Problēma atrisināta – lūdzu atjauniniet", body: "Lieliskas ziņas! Šī problēma tika atrisināta mūsu jaunākajā atjauninājumā. Lūdzu atjauniniet lietotni uz jaunāko versiju.", tag: "support", locale: "lv" },
  // Slovenian (sl)
  { title: "Hvala za vaše povratne informacije", body: "Hvala, da ste si vzeli čas in delili svoje povratne informacije! To zelo cenimo in bomo uporabili za izboljšanje naše aplikacije.", tag: "feedback", locale: "sl" },
  { title: "Delamo na tem", body: "Hvala za prijavo! Naša ekipa trenutno preiskuje težavo in vas bomo kmalu obvestili o posodobitvah.", tag: "triage", locale: "sl" },
  { title: "Težava rešena – prosimo posodobite", body: "Odlične novice! Ta težava je bila rešena v naši zadnji posodobitvi. Posodobite aplikacijo na najnovejšo različico.", tag: "support", locale: "sl" },
  // Azerbaijani (az)
  { title: "Rəyiniz üçün təşəkkür edirik", body: "Rəyinizi bölüşmək üçün vaxt ayırdığınız üçün təşəkkür edirik! Bunu çox qiymətləndiririk və tətbiqimizi yaxşılaşdırmaq üçün istifadə edəcəyik.", tag: "feedback", locale: "az" },
  { title: "Biz bu işlə məşğuluq", body: "Bildirdiyiniz üçün təşəkkür edirik! Komandamız hazırda problemi araşdırır və tezliklə yeniləmə haqqında məlumat verəcəyik.", tag: "triage", locale: "az" },
  { title: "Problem həll edildi – zəhmət olmasa yeniləyin", body: "Əla xəbər! Bu problem son yeniləməmizdə həll edilib. Zəhmət olmasa tətbiqi son versiyaya yeniləyin.", tag: "support", locale: "az" },
  // Kazakh (kk)
  { title: "Пікіріңіз үшін рахмет", body: "Пікіріңізді бөлісуге уақыт бөлгеніңіз үшін рахмет! Біз мұны өте бағалаймыз және қолданбамызды жақсарту үшін пайдаланамыз.", tag: "feedback", locale: "kk" },
  { title: "Біз бұл мәселемен айналысудамыз", body: "Хабарлағаныңыз үшін рахмет! Біздің команда қазір мәселені зерттеуде және жақын арада жаңартулар туралы хабарлаймыз.", tag: "triage", locale: "kk" },
  { title: "Мәселе шешілді – жаңартыңыз", body: "Тамаша жаңалық! Бұл мәселе біздің соңғы жаңартуымызда шешілді. Қолданбаны соңғы нұсқаға жаңартыңыз.", tag: "support", locale: "kk" },
  // Uzbek (uz)
  { title: "Fikr-mulohazangiz uchun rahmat", body: "Fikr-mulohazangizni ulashish uchun vaqt ajratganingiz uchun rahmat! Buni juda qadrlaymiz va ilovamizni yaxshilash uchun foydalanamiz.", tag: "feedback", locale: "uz" },
  { title: "Biz bu ustida ishlamoqdamiz", body: "Xabar berganing uchun rahmat! Jamoamiz hozirda muammoni tekshirmoqda va tez orada yangilanishlar haqida xabar beramiz.", tag: "triage", locale: "uz" },
  { title: "Muammo hal qilindi – yangilang", body: "Ajoyib yangilik! Bu muammo bizning so'nggi yangilashimizda hal qilindi. Iltimos, ilovani so'nggi versiyaga yangilang.", tag: "support", locale: "uz" },
  // Swahili (sw)
  { title: "Asante kwa maoni yako", body: "Asante kwa kuchukua muda kushiriki maoni yako! Tunashukuru sana na tutatumia kuboresha programu yetu.", tag: "feedback", locale: "sw" },
  { title: "Tunafanya kazi juu ya hilo", body: "Asante kwa kuripoti! Timu yetu inachunguza tatizo kwa sasa na tutakuarifu hivi karibuni.", tag: "triage", locale: "sw" },
  { title: "Tatizo limetatuliwa – tafadhali sasisha", body: "Habari njema! Tatizo hili limetatuliwa katika sasisho letu la hivi karibuni. Tafadhali sasisha programu hadi toleo la hivi karibuni.", tag: "support", locale: "sw" },
  // Amharic (am)
  { title: "ለአስተያየትዎ እናመሰግናለን", body: "አስተያየትዎን ለማጋራት ጊዜ ስለወሰዱ እናመሰግናለን! ይህን በጣም እናደንቃለን እና መተግበሪያችንን ለማሻሻል እንጠቀምበታለን።", tag: "feedback", locale: "am" },
  { title: "በዚህ ላይ እየሰራን ነው", body: "ስለሪፖርት ማድረግዎ እናመሰግናለን! ቡድናችን በአሁኑ ጊዜ ችግሩን እየመረመረ ሲሆን በቅርቡ ዝማኔዎችን እናሳውቅዎታለን።", tag: "triage", locale: "am" },
  { title: "ችግሩ ተፈቷል – እባክዎ ያዘምኑ", body: "ምሥራች! ይህ ችግር በቅርቡ ባወጣነው ዝማኔ ተፈቷል። እባክዎ መተግበሪያውን ወደ የቅርብ ጊዜ ስሪት ያዘምኑ።", tag: "support", locale: "am" },
  // Afrikaans (af)
  { title: "Dankie vir jou terugvoer", body: "Dankie dat jy tyd geneem het om jou terugvoer te deel! Ons waardeer dit baie en sal dit gebruik om ons app te verbeter.", tag: "feedback", locale: "af" },
  { title: "Ons werk daaraan", body: "Dankie vir die rapportering! Ons span ondersoek tans die probleem en sal jou binnekort van opdaterings verwittig.", tag: "triage", locale: "af" },
  { title: "Probleem opgelos – dateer asseblief op", body: "Goeie nuus! Hierdie probleem is in ons nuutste opdatering opgelos. Dateer asseblief die app na die nuutste weergawe op.", tag: "support", locale: "af" },
  // Albanian (sq)
  { title: "Faleminderit për reagimin tuaj", body: "Faleminderit që morët kohë të ndani reagimin tuaj! E vlerësojmë shumë dhe do ta përdorim për të përmirësuar aplikacionin tonë.", tag: "feedback", locale: "sq" },
  { title: "Jemi duke punuar për këtë", body: "Faleminderit për raportimin! Ekipi ynë po heton aktualisht problemin dhe do t'ju njoftojmë së shpejti.", tag: "triage", locale: "sq" },
  { title: "Problemi u zgjidh – ju lutemi përditësoni", body: "Lajme të mira! Ky problem u zgjidh në përditësimin tonë të fundit. Ju lutemi përditësoni aplikacionin në versionin më të fundit.", tag: "support", locale: "sq" },
  // Macedonian (mk)
  { title: "Благодариме за вашиот фидбек", body: "Благодариме што одвоивте време да го споделите вашиот фидбек! Многу го цениме и ќе го користиме за подобрување на нашата апликација.", tag: "feedback", locale: "mk" },
  { title: "Работиме на тоа", body: "Благодариме за пријавувањето! Нашиот тим моментално го истражува проблемот и наскоро ќе ве информираме.", tag: "triage", locale: "mk" },
  { title: "Проблемот е решен – ажурирајте", body: "Одлични вести! Овој проблем беше решен во нашето последно ажурирање. Ажурирајте ја апликацијата на најновата верзија.", tag: "support", locale: "mk" },
  // Mongolian (mn)
  { title: "Санал хүсэлтийнхээ төлөө баярлалаа", body: "Санал хүсэлтээ хуваалцахад цаг зарцуулсанд баярлалаа! Бид үүнийг маш их үнэлж, апп-аа сайжруулахад ашиглана.", tag: "feedback", locale: "mn" },
  { title: "Бид үүн дээр ажиллаж байна", body: "Мэдэгдсэнд баярлалаа! Манай баг одоогоор асуудлыг шалгаж байгаа бөгөөд удахгүй шинэчлэлийн талаар мэдэгдэнэ.", tag: "triage", locale: "mn" },
  { title: "Асуудал шийдэгдсэн – шинэчилнэ үү", body: "Сайхан мэдээ! Энэ асуудал манай сүүлийн шинэчлэлтэд шийдэгдсэн. Апп-аа хамгийн сүүлийн хувилбарт шинэчилнэ үү.", tag: "support", locale: "mn" },
  // Burmese (my)
  { title: "သင်၏အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါသည်", body: "သင်၏အကြံပြုချက်ကို မျှဝေရန် အချိန်ပေးသည့်အတွက် ကျေးဇူးတင်ပါသည်။ ကျွန်ုပ်တို့ ၎င်းကို အလွန်တန်ဖိုးထားပြီး ကျွန်ုပ်တို့၏ App ကို မြှင့်တင်ရန် အသုံးပြုမည်။", tag: "feedback", locale: "my" },
  { title: "ကျွန်ုပ်တို့ ဆောင်ရွက်နေပါသည်", body: "အစီရင်ခံသည့်အတွက် ကျေးဇူးတင်ပါသည်။ ကျွန်ုပ်တို့အဖွဲ့သည် ယခု ပြဿနာကို စုံစမ်းနေပြီး မကြာမီ အပ်ဒိတ်များ အကြောင်း အသိပေးမည်။", tag: "triage", locale: "my" },
  { title: "ပြဿနာ ဖြေရှင်းပြီး – ကျေးဇူးပြု၍ အပ်ဒိတ်လုပ်ပါ", body: "သတင်းကောင်း! ဤပြဿနာကို ကျွန်ုပ်တို့၏ နောက်ဆုံးအပ်ဒိတ်တွင် ဖြေရှင်းပြီးဖြစ်သည်။ App ကို နောက်ဆုံးဗားရှင်းသို့ အပ်ဒိတ်လုပ်ပါ။", tag: "support", locale: "my" },
  // Khmer (km)
  { title: "សូមអរគុណចំពោះមតិប្រតិកម្មរបស់អ្នក", body: "សូមអរគុណដែលបានចំណាយពេលចែករំលែកមតិប្រតិកម្មរបស់អ្នក! យើងវាយតម្លៃវាខ្លាំងណាស់ ហើយនឹងប្រើវាដើម្បីកែលម្អកម្មវិធីរបស់យើង។", tag: "feedback", locale: "km" },
  { title: "យើងកំពុងធ្វើការលើវា", body: "សូមអរគុណដែលបានរាយការណ៍! ក្រុមរបស់យើងកំពុងស្វែងរកបញ្ហានៅពេលនេះ ហើយនឹងជូនដំណឹងអ្នកអំពីការអាប់ដេតដោយឆាប់រហ័ស។", tag: "triage", locale: "km" },
  { title: "បញ្ហាត្រូវបានដោះស្រាយ – សូមអាប់ដេត", body: "ព័ត៌មានល្អ! បញ្ហានេះត្រូវបានដោះស្រាយនៅក្នុងការអាប់ដេតចុងក្រោយរបស់យើង។ សូមអាប់ដេតកម្មវិធីទៅកាន់កំណែចុងក្រោយបំផុត។", tag: "support", locale: "km" },
  // Nepali (ne)
  { title: "तपाईंको प्रतिक्रियाको लागि धन्यवाद", body: "तपाईंको प्रतिक्रिया साझा गर्न समय निकाल्नुभएकोमा धन्यवाद! हामी यसलाई धेरै महत्त्व दिन्छौं र हाम्रो एप सुधार गर्न प्रयोग गर्नेछौं।", tag: "feedback", locale: "ne" },
  { title: "हामी यसमा काम गर्दैछौं", body: "रिपोर्ट गर्नुभएकोमा धन्यवाद! हाम्रो टोली हाल समस्या अनुसन्धान गर्दैछ र चाँडै अपडेटहरूको बारेमा जानकारी दिनेछ।", tag: "triage", locale: "ne" },
  { title: "समस्या समाधान भयो – कृपया अपडेट गर्नुहोस्", body: "राम्रो खबर! यो समस्या हाम्रो नवीनतम अपडेटमा समाधान भएको छ। कृपया एपलाई नवीनतम संस्करणमा अपडेट गर्नुहोस्।", tag: "support", locale: "ne" },
  // Sinhala (si)
  { title: "ඔබේ ප්‍රතිපෝෂණය සඳහා ස්තූතියි", body: "ඔබේ ප්‍රතිපෝෂණය බෙදාගැනීමට කාලය ගත් බව ස්තූතියි! අපි ඒ ගැන ඉතා කෘතඥ වෙමු, සහ අපේ යෙදුම වැඩිදියුණු කිරීමට එය භාවිතා කරන්නෙමු.", tag: "feedback", locale: "si" },
  { title: "අපි ඒ ගැන වැඩ කරනවා", body: "වාර්තා කිරීම ගැන ස්තූතියි! අපේ කණ්ඩායම දැනට ගැටලුව විමර්ශනය කරමින් සිටින අතර ඉක්මනින් යාවත්කාලීන කිරීම් ගැන දන්වන්නෙමු.", tag: "triage", locale: "si" },
  { title: "ගැටලුව විසඳිණ – කරුණාකර යාවත්කාලීන කරන්න", body: "සුභ ආරංචිය! මෙම ගැටලුව අපේ නවතම යාවත්කාලීනයේදී විසඳා ඇත. කරුණාකර යෙදුම නවතම අනුවාදයට යාවත්කාලීන කරන්න.", tag: "support", locale: "si" },
  // Tamil (ta)
  { title: "உங்கள் கருத்துக்கு நன்றி", body: "உங்கள் கருத்தை பகிர்ந்துகொள்ள நேரம் எடுத்தமைக்கு நன்றி! நாங்கள் இதை மிகவும் மதிக்கிறோம் மற்றும் எங்கள் செயலியை மேம்படுத்த இதைப் பயன்படுத்துவோம்.", tag: "feedback", locale: "ta" },
  { title: "நாங்கள் இதில் பணிபுரிகிறோம்", body: "புகாரளித்தமைக்கு நன்றி! எங்கள் குழு தற்போது சிக்கலை ஆராய்கிறது மற்றும் விரைவில் புதுப்பிப்புகள் பற்றி தெரிவிப்போம்.", tag: "triage", locale: "ta" },
  { title: "சிக்கல் தீர்க்கப்பட்டது – புதுப்பிக்கவும்", body: "நற்செய்தி! இந்த சிக்கல் எங்கள் சமீபத்திய புதுப்பிப்பில் தீர்க்கப்பட்டது. செயலியை சமீபத்திய பதிப்பிற்கு புதுப்பிக்கவும்.", tag: "support", locale: "ta" },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@feedback.app";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`Admin user not found: ${adminEmail}`);
    process.exit(1);
  }

  const existingLocales = await prisma.cannedReply.findMany({
    where: { ownerId: admin.id, locale: { not: null } },
    select: { locale: true },
    distinct: ["locale"],
  });
  const existing = new Set(existingLocales.map(r => r.locale));
  console.log(`Already have locales: ${[...existing].join(", ") || "none"}`);

  let added = 0;
  for (const cr of allLocaleReplies) {
    if (!existing.has(cr.locale)) {
      await prisma.cannedReply.create({
        data: { ownerId: admin.id, title: cr.title, body: cr.body, shared: true, tag: cr.tag, locale: cr.locale },
      });
      added++;
    }
  }
  console.log(`Added ${added} new canned replies for missing locales`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
