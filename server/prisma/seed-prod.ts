import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@feedback.app";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name: "Super Admin",
      role: "super_admin",
    },
  });

  console.log(`Super admin created: ${admin.email}`);
  console.log("Change the password after first login!");

  // Default shared canned replies (30 languages)
  const cannedReplies = [
    // General / all languages
    { title: "Thank you for your feedback", body: "Thank you for taking the time to share your feedback! We really appreciate it and will use it to improve our app.", tag: "feedback", locale: null },
    { title: "We're working on it", body: "Thanks for reporting this! Our team is currently investigating the issue and we'll have an update for you soon.", tag: "triage", locale: null },
    { title: "Issue resolved – please update", body: "Great news! This issue has been resolved in our latest update. Please update the app to the newest version and let us know if the problem persists.", tag: "support", locale: null },
    { title: "Need more details", body: "Thank you for reaching out. To help us investigate further, could you please share your device model, OS version, and app version? Any additional steps to reproduce the issue would also be helpful.", tag: "triage", locale: null },
    { title: "Feature noted for roadmap", body: "Thanks for the suggestion! We've added this to our feature roadmap and will consider it in an upcoming release. Stay tuned for updates!", tag: "feedback", locale: null },
    { title: "Sorry for the inconvenience", body: "We sincerely apologize for the trouble you've experienced. Our team is working hard to make sure this doesn't happen again. Thank you for your patience.", tag: "support", locale: null },
    { title: "Try clearing app cache", body: "Please try clearing the app cache (Settings → Apps → [App name] → Clear Cache) and restart the app. This resolves many common issues. Let us know if it helps!", tag: "support", locale: null },
    { title: "Closing – issue resolved", body: "We're glad to hear the issue has been resolved! We're closing this ticket for now. Please don't hesitate to reach out if you run into anything else.", tag: "support", locale: null },
    // English (en)
    { title: "Welcome! How can we help?", body: "Hi there! Welcome and thank you for contacting us. We're here to help — please describe your issue and we'll get back to you as soon as possible.", tag: "support", locale: "en" },
    { title: "5-star feedback – thank you!", body: "Wow, thank you so much for the 5-star review! We're thrilled you're enjoying the app. Your support means a lot to us!", tag: "feedback", locale: "en" },
    { title: "Low rating – we want to improve", body: "Thank you for your honest feedback. We're sorry the app hasn't met your expectations. Could you tell us more about what went wrong so we can improve?", tag: "feedback", locale: "en" },
    // Spanish (es)
    { title: "Gracias por tu feedback", body: "¡Gracias por tomarte el tiempo de compartir tu opinión! Lo tendremos muy en cuenta para mejorar la aplicación.", tag: "feedback", locale: "es" },
    { title: "Estamos investigando el problema", body: "Gracias por reportar esto. Nuestro equipo está investigando el problema y te informaremos en cuanto tengamos novedades.", tag: "triage", locale: "es" },
    { title: "Problema resuelto – actualiza la app", body: "¡Buenas noticias! Este problema ha sido resuelto en la última actualización. Por favor actualiza la aplicación y cuéntanos si el problema persiste.", tag: "support", locale: "es" },
    // French (fr)
    { title: "Merci pour votre retour", body: "Merci de prendre le temps de partager votre avis ! Nous en tiendrons compte pour améliorer notre application.", tag: "feedback", locale: "fr" },
    { title: "Nous travaillons sur le problème", body: "Merci pour votre signalement. Notre équipe est en train d'examiner le problème et vous tiendra informé dès que possible.", tag: "triage", locale: "fr" },
    { title: "Problème résolu – mettez à jour l'app", body: "Bonne nouvelle ! Ce problème a été corrigé dans notre dernière mise à jour. Veuillez mettre à jour l'application et n'hésitez pas à nous contacter si le problème persiste.", tag: "support", locale: "fr" },
    // German (de)
    { title: "Danke für Ihr Feedback", body: "Vielen Dank, dass Sie sich die Zeit genommen haben, uns Ihr Feedback mitzuteilen! Wir werden es nutzen, um unsere App weiter zu verbessern.", tag: "feedback", locale: "de" },
    { title: "Wir arbeiten daran", body: "Danke für Ihre Meldung! Unser Team untersucht das Problem und wird Sie so bald wie möglich informieren.", tag: "triage", locale: "de" },
    { title: "Problem behoben – bitte aktualisieren", body: "Gute Neuigkeiten! Dieses Problem wurde im letzten Update behoben. Bitte aktualisieren Sie die App und lassen Sie uns wissen, ob das Problem weiterhin besteht.", tag: "support", locale: "de" },
    // Arabic (ar)
    { title: "شكراً على ملاحظاتك", body: "شكراً لك على تخصيص وقتك لمشاركة ملاحظاتك! نقدر ذلك كثيراً وسنستخدمه لتحسين تطبيقنا.", tag: "feedback", locale: "ar" },
    { title: "نعمل على حل المشكلة", body: "شكراً على الإبلاغ! فريقنا يحقق في المشكلة حالياً وسنُعلمك بالتحديثات قريباً.", tag: "triage", locale: "ar" },
    { title: "تم حل المشكلة – يرجى التحديث", body: "أخبار رائعة! تم حل هذه المشكلة في آخر تحديث. يرجى تحديث التطبيق وإخبارنا إذا استمرت المشكلة.", tag: "support", locale: "ar" },
    // Urdu (ur)
    { title: "آپ کے فیڈ بیک کا شکریہ", body: "اپنا قیمتی فیڈ بیک شیئر کرنے کے لیے آپ کا بہت شکریہ! ہم اسے اپنی ایپ بہتر بنانے کے لیے استعمال کریں گے۔", tag: "feedback", locale: "ur" },
    { title: "ہم مسئلے پر کام کر رہے ہیں", body: "رپورٹ کرنے کا شکریہ! ہماری ٹیم اس مسئلے کی تحقیق کر رہی ہے اور آپ کو جلد آگاہ کریں گے۔", tag: "triage", locale: "ur" },
    { title: "مسئلہ حل ہو گیا – ایپ اپڈیٹ کریں", body: "خوشخبری! یہ مسئلہ ہماری تازہ ترین اپڈیٹ میں حل کر دیا گیا ہے۔ براہ کرم ایپ اپڈیٹ کریں اور ہمیں بتائیں کہ آیا مسئلہ برقرار ہے۔", tag: "support", locale: "ur" },
    // Chinese (zh)
    { title: "感谢您的反馈", body: "感谢您花时间分享您的反馈！我们非常感激，将用它来改进我们的应用。", tag: "feedback", locale: "zh" },
    { title: "我们正在处理", body: "感谢您的报告！我们的团队目前正在调查此问题，我们会尽快向您提供最新进展。", tag: "triage", locale: "zh" },
    { title: "问题已解决 – 请更新", body: "好消息！此问题已在我们的最新更新中解决。请将应用更新到最新版本，如问题仍然存在，请告诉我们。", tag: "support", locale: "zh" },
    // Hindi (hi)
    { title: "आपकी प्रतिक्रिया के लिए धन्यवाद", body: "अपनी प्रतिक्रिया साझा करने के लिए समय निकालने के लिए धन्यवाद! हम इसकी बहुत सराहना करते हैं और इसे अपने ऐप को बेहतर बनाने के लिए उपयोग करेंगे।", tag: "feedback", locale: "hi" },
    { title: "हम इस पर काम कर रहे हैं", body: "रिपोर्ट करने के लिए धन्यवाद! हमारी टीम वर्तमान में समस्या की जांच कर रही है और हम जल्द ही आपको अपडेट देंगे।", tag: "triage", locale: "hi" },
    { title: "समस्या हल हो गई – कृपया अपडेट करें", body: "अच्छी खबर! यह समस्या हमारे नवीनतम अपडेट में हल हो गई है। कृपया ऐप को नवीनतम संस्करण में अपडेट करें और हमें बताएं कि क्या समस्या बनी रहती है।", tag: "support", locale: "hi" },
    // Portuguese (pt)
    { title: "Obrigado pelo seu feedback", body: "Obrigado por dedicar um tempo para compartilhar seu feedback! Agradecemos muito e o usaremos para melhorar nosso aplicativo.", tag: "feedback", locale: "pt" },
    { title: "Estamos trabalhando nisso", body: "Obrigado por relatar isso! Nossa equipe está investigando o problema atualmente e em breve teremos uma atualização para você.", tag: "triage", locale: "pt" },
    { title: "Problema resolvido – por favor, atualize", body: "Ótimas notícias! Este problema foi resolvido em nossa última atualização. Por favor, atualize o aplicativo para a versão mais recente e nos informe se o problema persistir.", tag: "support", locale: "pt" },
    // Turkish (tr)
    { title: "Geri bildiriminiz için teşekkürler", body: "Geri bildiriminizi paylaşmak için zaman ayırdığınız için teşekkür ederiz! Bunu çok takdir ediyoruz ve uygulamamızı geliştirmek için kullanacağız.", tag: "feedback", locale: "tr" },
    { title: "Üzerinde çalışıyoruz", body: "Bildirdiğiniz için teşekkürler! Ekibimiz şu anda sorunu araştırıyor ve yakında size bir güncelleme sunacağız.", tag: "triage", locale: "tr" },
    { title: "Sorun çözüldü – lütfen güncelleyin", body: "Harika haberler! Bu sorun en son güncellememizde çözüldü. Lütfen uygulamayı en son sürüme güncelleyin ve sorun devam ederse bize bildirin.", tag: "support", locale: "tr" },
    // Russian (ru)
    { title: "Спасибо за отзыв", body: "Спасибо, что нашли время поделиться своим отзывом! Мы очень ценим это и используем для улучшения нашего приложения.", tag: "feedback", locale: "ru" },
    { title: "Мы работаем над этим", body: "Спасибо за сообщение! Наша команда в настоящее время расследует проблему и скоро сообщит вам об обновлениях.", tag: "triage", locale: "ru" },
    { title: "Проблема решена – обновите приложение", body: "Отличные новости! Эта проблема была решена в нашем последнем обновлении. Пожалуйста, обновите приложение до последней версии и сообщите нам, если проблема сохраняется.", tag: "support", locale: "ru" },
    // Japanese (ja)
    { title: "フィードバックありがとうございます", body: "フィードバックをお寄せいただきありがとうございます！大変感謝しております。アプリの改善に役立てさせていただきます。", tag: "feedback", locale: "ja" },
    { title: "対応中です", body: "ご報告ありがとうございます！現在チームが問題を調査中です。近日中にアップデートをお知らせします。", tag: "triage", locale: "ja" },
    { title: "問題が解決しました – アップデートしてください", body: "お知らせです！この問題は最新のアップデートで解決されました。アプリを最新バージョンに更新して、問題が解消されたかご確認ください。", tag: "support", locale: "ja" },
    // Korean (ko)
    { title: "피드백 감사합니다", body: "피드백을 공유해 주셔서 감사합니다! 앱 개선을 위해 소중히 활용하겠습니다.", tag: "feedback", locale: "ko" },
    { title: "처리 중입니다", body: "신고해 주셔서 감사합니다! 현재 팀에서 문제를 조사 중이며, 곧 업데이트를 알려드리겠습니다.", tag: "triage", locale: "ko" },
    { title: "문제 해결됨 – 업데이트 해주세요", body: "좋은 소식입니다! 이 문제는 최신 업데이트에서 해결되었습니다. 앱을 최신 버전으로 업데이트하시고 문제가 지속되면 알려주세요.", tag: "support", locale: "ko" },
    // Italian (it)
    { title: "Grazie per il tuo feedback", body: "Grazie per aver dedicato del tempo a condividere la tua opinione! Lo apprezziamo molto e lo useremo per migliorare la nostra app.", tag: "feedback", locale: "it" },
    { title: "Stiamo lavorando su questo", body: "Grazie per la segnalazione! Il nostro team sta attualmente investigando il problema e ti aggiorneremo al più presto.", tag: "triage", locale: "it" },
    { title: "Problema risolto – aggiorna l'app", body: "Ottime notizie! Questo problema è stato risolto nell'ultimo aggiornamento. Aggiorna l'app all'ultima versione e facci sapere se il problema persiste.", tag: "support", locale: "it" },
    // Dutch (nl)
    { title: "Bedankt voor je feedback", body: "Bedankt voor het nemen van de tijd om je feedback te delen! We waarderen het zeer en zullen het gebruiken om onze app te verbeteren.", tag: "feedback", locale: "nl" },
    { title: "We werken eraan", body: "Bedankt voor de melding! Ons team onderzoekt het probleem momenteel en we laten je zo snel mogelijk weten wat de stand van zaken is.", tag: "triage", locale: "nl" },
    { title: "Probleem opgelost – update de app", body: "Goed nieuws! Dit probleem is opgelost in onze laatste update. Update de app naar de nieuwste versie en laat ons weten als het probleem zich blijft voordoen.", tag: "support", locale: "nl" },
    // Polish (pl)
    { title: "Dziękujemy za opinię", body: "Dziękujemy za poświęcenie czasu na podzielenie się swoją opinią! Bardzo to doceniamy i wykorzystamy to do ulepszenia naszej aplikacji.", tag: "feedback", locale: "pl" },
    { title: "Pracujemy nad tym", body: "Dziękujemy za zgłoszenie! Nasz zespół aktualnie bada ten problem i wkrótce poinformujemy Cię o postępach.", tag: "triage", locale: "pl" },
    { title: "Problem rozwiązany – zaktualizuj aplikację", body: "Świetne wieści! Ten problem został rozwiązany w naszej najnowszej aktualizacji. Zaktualizuj aplikację do najnowszej wersji i daj nam znać, czy problem nadal występuje.", tag: "support", locale: "pl" },
    // Swedish (sv)
    { title: "Tack för din feedback", body: "Tack för att du tog dig tid att dela din feedback! Vi uppskattar det verkligen och kommer att använda det för att förbättra vår app.", tag: "feedback", locale: "sv" },
    { title: "Vi arbetar på det", body: "Tack för att du rapporterade detta! Vårt team undersöker problemet för närvarande och vi kommer att ha en uppdatering till dig snart.", tag: "triage", locale: "sv" },
    { title: "Problem löst – vänligen uppdatera", body: "Goda nyheter! Detta problem har lösts i vår senaste uppdatering. Uppdatera appen till den senaste versionen och meddela oss om problemet kvarstår.", tag: "support", locale: "sv" },
    // Norwegian (no)
    { title: "Takk for tilbakemeldingen din", body: "Takk for at du tok deg tid til å dele tilbakemeldingen din! Vi setter stor pris på det og vil bruke det til å forbedre appen vår.", tag: "feedback", locale: "no" },
    { title: "Vi jobber med det", body: "Takk for at du rapporterte dette! Teamet vårt undersøker problemet for øyeblikket, og vi vil gi deg en oppdatering snart.", tag: "triage", locale: "no" },
    { title: "Problem løst – vennligst oppdater", body: "Gode nyheter! Dette problemet er løst i vår siste oppdatering. Oppdater appen til den nyeste versjonen og gi oss beskjed om problemet vedvarer.", tag: "support", locale: "no" },
    // Danish (da)
    { title: "Tak for din feedback", body: "Tak fordi du tog dig tid til at dele din feedback! Vi sætter stor pris på det og vil bruge det til at forbedre vores app.", tag: "feedback", locale: "da" },
    { title: "Vi arbejder på det", body: "Tak for at du rapporterede dette! Vores team undersøger i øjeblikket problemet, og vi vil have en opdatering til dig snart.", tag: "triage", locale: "da" },
    { title: "Problem løst – opdater venligst", body: "Gode nyheder! Dette problem er løst i vores seneste opdatering. Opdater appen til den nyeste version og giv os besked, hvis problemet fortsætter.", tag: "support", locale: "da" },
    // Finnish (fi)
    { title: "Kiitos palautteestasi", body: "Kiitos, että käytit aikaa palautteesi jakamiseen! Arvostamme sitä suuresti ja käytämme sitä sovelluksemme parantamiseen.", tag: "feedback", locale: "fi" },
    { title: "Työskentelemme asian parissa", body: "Kiitos ilmoittamisesta! Tiimimme tutkii tällä hetkellä ongelmaa ja saat pian päivityksen.", tag: "triage", locale: "fi" },
    { title: "Ongelma ratkaistu – päivitä sovellus", body: "Hyviä uutisia! Tämä ongelma on ratkaistu viimeisimmässä päivityksessämme. Päivitä sovellus uusimpaan versioon ja ilmoita meille, jos ongelma jatkuu.", tag: "support", locale: "fi" },
    // Greek (el)
    { title: "Ευχαριστούμε για τα σχόλιά σας", body: "Ευχαριστούμε που αφιερώσατε χρόνο για να μοιραστείτε τα σχόλιά σας! Το εκτιμούμε πολύ και θα το χρησιμοποιήσουμε για να βελτιώσουμε την εφαρμογή μας.", tag: "feedback", locale: "el" },
    { title: "Εργαζόμαστε πάνω σε αυτό", body: "Ευχαριστούμε για την αναφορά! Η ομάδα μας διερευνά αυτήν τη στιγμή το πρόβλημα και σύντομα θα έχουμε μια ενημέρωση για εσάς.", tag: "triage", locale: "el" },
    { title: "Το πρόβλημα επιλύθηκε – παρακαλώ ενημερώστε", body: "Χαρούμενα νέα! Αυτό το πρόβλημα έχει επιλυθεί στην τελευταία μας ενημέρωση. Ενημερώστε την εφαρμογή στην πιο πρόσφατη έκδοση και ενημερώστε μας εάν το πρόβλημα παραμένει.", tag: "support", locale: "el" },
    // Czech (cs)
    { title: "Děkujeme za vaši zpětnou vazbu", body: "Děkujeme, že jste si vzali čas a podělili se o svou zpětnou vazbu! Velmi si toho vážíme a použijeme ji ke zlepšení naší aplikace.", tag: "feedback", locale: "cs" },
    { title: "Pracujeme na tom", body: "Děkujeme za nahlášení! Náš tým právě zkoumá problém a brzy vám poskytneme aktualizaci.", tag: "triage", locale: "cs" },
    { title: "Problém vyřešen – prosím aktualizujte", body: "Skvělé zprávy! Tento problém byl vyřešen v naší nejnovější aktualizaci. Aktualizujte prosím aplikaci na nejnovější verzi a dejte nám vědět, pokud problém přetrvává.", tag: "support", locale: "cs" },
    // Hungarian (hu)
    { title: "Köszönjük a visszajelzését", body: "Köszönjük, hogy időt szánt visszajelzése megosztására! Nagyra értékeljük, és felhasználjuk alkalmazásunk fejlesztéséhez.", tag: "feedback", locale: "hu" },
    { title: "Dolgozunk rajta", body: "Köszönjük a bejelentést! Csapatunk jelenleg vizsgálja a problémát, és hamarosan frissítést küldünk Önnek.", tag: "triage", locale: "hu" },
    { title: "Probléma megoldva – kérjük frissítse", body: "Nagyszerű hír! Ezt a problémát legújabb frissítésünkben megoldottuk. Frissítse az alkalmazást a legújabb verzióra, és értesítsen minket, ha a probléma továbbra is fennáll.", tag: "support", locale: "hu" },
    // Romanian (ro)
    { title: "Mulțumim pentru feedback", body: "Mulțumim că ați luat timp să împărtășiți feedback-ul dvs.! Apreciem foarte mult și îl vom folosi pentru a îmbunătăți aplicația noastră.", tag: "feedback", locale: "ro" },
    { title: "Lucrăm la asta", body: "Mulțumim pentru raportare! Echipa noastră investighează în prezent problema și în curând veți primi o actualizare.", tag: "triage", locale: "ro" },
    { title: "Problemă rezolvată – vă rugăm actualizați", body: "Vești bune! Această problemă a fost rezolvată în cea mai recentă actualizare. Vă rugăm actualizați aplicația la cea mai nouă versiune și anunțați-ne dacă problema persistă.", tag: "support", locale: "ro" },
    // Thai (th)
    { title: "ขอบคุณสำหรับคำติชมของคุณ", body: "ขอบคุณที่สละเวลาแบ่งปันคำติชมของคุณ! เราซาบซึ้งใจมากและจะนำไปใช้เพื่อปรับปรุงแอปของเรา", tag: "feedback", locale: "th" },
    { title: "เรากำลังดำเนินการอยู่", body: "ขอบคุณที่รายงาน! ทีมของเรากำลังตรวจสอบปัญหาอยู่และจะมีการอัปเดตให้คุณเร็วๆ นี้", tag: "triage", locale: "th" },
    { title: "แก้ไขปัญหาแล้ว – กรุณาอัปเดต", body: "ข่าวดี! ปัญหานี้ได้รับการแก้ไขในการอัปเดตล่าสุดของเรา กรุณาอัปเดตแอปเป็นเวอร์ชันล่าสุดและแจ้งให้เราทราบหากปัญหายังคงมีอยู่", tag: "support", locale: "th" },
    // Vietnamese (vi)
    { title: "Cảm ơn phản hồi của bạn", body: "Cảm ơn bạn đã dành thời gian chia sẻ phản hồi! Chúng tôi rất trân trọng điều này và sẽ sử dụng để cải thiện ứng dụng.", tag: "feedback", locale: "vi" },
    { title: "Chúng tôi đang xử lý", body: "Cảm ơn bạn đã báo cáo! Nhóm của chúng tôi hiện đang điều tra vấn đề và sẽ sớm có cập nhật cho bạn.", tag: "triage", locale: "vi" },
    { title: "Đã giải quyết – vui lòng cập nhật", body: "Tin vui! Vấn đề này đã được giải quyết trong bản cập nhật mới nhất. Vui lòng cập nhật ứng dụng lên phiên bản mới nhất và cho chúng tôi biết nếu vấn đề vẫn còn.", tag: "support", locale: "vi" },
    // Indonesian (id)
    { title: "Terima kasih atas masukan Anda", body: "Terima kasih telah meluangkan waktu untuk berbagi masukan Anda! Kami sangat menghargainya dan akan menggunakannya untuk meningkatkan aplikasi kami.", tag: "feedback", locale: "id" },
    { title: "Kami sedang mengerjakannya", body: "Terima kasih telah melaporkan! Tim kami sedang menyelidiki masalah ini dan akan segera memberikan pembaruan kepada Anda.", tag: "triage", locale: "id" },
    { title: "Masalah teratasi – mohon perbarui", body: "Kabar baik! Masalah ini telah diselesaikan dalam pembaruan terbaru kami. Perbarui aplikasi ke versi terbaru dan beri tahu kami jika masalah masih berlanjut.", tag: "support", locale: "id" },
    // Malay (ms)
    { title: "Terima kasih atas maklum balas anda", body: "Terima kasih kerana meluangkan masa untuk berkongsi maklum balas anda! Kami sangat menghargainya dan akan menggunakannya untuk meningkatkan aplikasi kami.", tag: "feedback", locale: "ms" },
    { title: "Kami sedang bekerja ke atasnya", body: "Terima kasih kerana melaporkan! Pasukan kami sedang menyiasat masalah ini dan akan segera memberikan kemas kini kepada anda.", tag: "triage", locale: "ms" },
    { title: "Masalah diselesaikan – sila kemas kini", body: "Berita baik! Masalah ini telah diselesaikan dalam kemas kini terbaru kami. Sila kemas kini aplikasi ke versi terbaru dan maklumkan kepada kami jika masalah berterusan.", tag: "support", locale: "ms" },
    // Bengali (bn)
    { title: "আপনার মতামতের জন্য ধন্যবাদ", body: "আপনার মতামত শেয়ার করতে সময় নেওয়ার জন্য ধন্যবাদ! আমরা এটি অত্যন্ত প্রশংসা করি এবং আমাদের অ্যাপ উন্নত করতে ব্যবহার করব।", tag: "feedback", locale: "bn" },
    { title: "আমরা এটি নিয়ে কাজ করছি", body: "রিপোর্ট করার জন্য ধন্যবাদ! আমাদের দল বর্তমানে সমস্যাটি তদন্ত করছে এবং শীঘ্রই আপনাকে আপডেট জানাব।", tag: "triage", locale: "bn" },
    { title: "সমস্যা সমাধান হয়েছে – আপডেট করুন", body: "সুখবর! এই সমস্যাটি আমাদের সর্বশেষ আপডেটে সমাধান করা হয়েছে। অনুগ্রহ করে অ্যাপটি সর্বশেষ সংস্করণে আপডেট করুন এবং সমস্যা অব্যাহত থাকলে আমাদের জানান।", tag: "support", locale: "bn" },
    // Persian/Farsi (fa)
    { title: "ممنون از بازخورد شما", body: "ممنون که وقت گذاشتید و بازخورد خود را با ما در میان گذاشتید! ما قدردان هستیم و از آن برای بهبود اپلیکیشن استفاده می‌کنیم.", tag: "feedback", locale: "fa" },
    { title: "در حال بررسی هستیم", body: "ممنون از گزارش شما! تیم ما در حال حاضر در حال بررسی مشکل است و به زودی به شما اطلاع می‌دهیم.", tag: "triage", locale: "fa" },
    { title: "مشکل حل شد – لطفاً بروزرسانی کنید", body: "خبر خوب! این مشکل در آخرین بروزرسانی ما برطرف شده است. لطفاً اپلیکیشن را به آخرین نسخه بروزرسانی کنید و در صورت ادامه مشکل به ما اطلاع دهید.", tag: "support", locale: "fa" },
  ];

  const existingCount = await prisma.cannedReply.count({ where: { ownerId: admin.id } });
  let cannedCount = 0;
  if (existingCount === 0) {
    for (const cr of cannedReplies) {
      await prisma.cannedReply.create({
        data: {
          ownerId: admin.id,
          title: cr.title,
          body: cr.body,
          shared: true,
          tag: cr.tag,
          locale: cr.locale,
        },
      });
      cannedCount++;
    }
  }
  console.log(`Created ${cannedCount} default canned replies`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
