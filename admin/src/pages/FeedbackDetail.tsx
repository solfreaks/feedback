import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import Avatar from "../components/Avatar";

const QUICK_REPLY_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Thank you for your feedback": {
    es: "¡Gracias por tomarte el tiempo de compartir tu opinión! Lo tendremos en cuenta para mejorar la aplicación.",
    fr: "Merci de prendre le temps de partager votre avis ! Nous en tiendrons compte pour améliorer notre application.",
    de: "Vielen Dank für Ihr Feedback! Wir werden es nutzen, um unsere App weiter zu verbessern.",
    ar: "شكراً لك على مشاركة ملاحظاتك! نقدر ذلك كثيراً وسنستخدمه لتحسين تطبيقنا.",
    ur: "آپ کا فیڈ بیک شیئر کرنے کا بہت شکریہ! ہم اسے اپنی ایپ بہتر بنانے کے لیے استعمال کریں گے۔",
    zh: "感谢您花时间分享您的反馈！我们非常感激，将用它来改进我们的应用。",
    hi: "अपनी प्रतिक्रिया साझा करने के लिए धन्यवाद! हम इसकी बहुत सराहना करते हैं और अपने ऐप को बेहतर बनाने के लिए उपयोग करेंगे।",
    pt: "Obrigado por compartilhar seu feedback! Agradecemos muito e o usaremos para melhorar nosso aplicativo.",
    tr: "Geri bildiriminizi paylaştığınız için teşekkür ederiz! Uygulamamızı geliştirmek için kullanacağız.",
    ru: "Спасибо за ваш отзыв! Мы очень ценим это и используем для улучшения нашего приложения.",
    ja: "フィードバックをありがとうございます！大変感謝しております。アプリの改善に役立てます。",
    ko: "피드백을 공유해 주셔서 감사합니다! 앱 개선을 위해 소중히 활용하겠습니다.",
    it: "Grazie per aver condiviso il tuo feedback! Lo utilizzeremo per migliorare la nostra app.",
    nl: "Bedankt voor het delen van je feedback! We gebruiken het om onze app te verbeteren.",
    pl: "Dziękujemy za podzielenie się swoją opinią! Wykorzystamy ją do ulepszenia naszej aplikacji.",
    sv: "Tack för att du delade din feedback! Vi kommer att använda den för att förbättra vår app.",
    no: "Takk for at du delte tilbakemeldingen din! Vi vil bruke den til å forbedre appen vår.",
    da: "Tak for at du delte din feedback! Vi vil bruge den til at forbedre vores app.",
    fi: "Kiitos palautteestasi! Käytämme sitä sovelluksemme parantamiseen.",
    el: "Ευχαριστούμε για τα σχόλιά σας! Θα τα χρησιμοποιήσουμε για να βελτιώσουμε την εφαρμογή μας.",
    cs: "Děkujeme za vaši zpětnou vazbu! Použijeme ji ke zlepšení naší aplikace.",
    hu: "Köszönjük a visszajelzését! Felhasználjuk alkalmazásunk fejlesztéséhez.",
    ro: "Mulțumim pentru feedback! Îl vom folosi pentru a îmbunătăți aplicația noastră.",
    th: "ขอบคุณสำหรับคำติชมของคุณ! เราจะนำไปใช้เพื่อปรับปรุงแอปของเรา",
    vi: "Cảm ơn bạn đã chia sẻ phản hồi! Chúng tôi sẽ sử dụng để cải thiện ứng dụng.",
    id: "Terima kasih telah berbagi masukan Anda! Kami akan menggunakannya untuk meningkatkan aplikasi kami.",
    ms: "Terima kasih kerana berkongsi maklum balas anda! Kami akan menggunakannya untuk meningkatkan aplikasi kami.",
    bn: "আপনার মতামত শেয়ার করার জন্য ধন্যবাদ! আমরা এটি আমাদের অ্যাপ উন্নত করতে ব্যবহার করব।",
    fa: "ممنون از اشتراک‌گذاری بازخورد شما! از آن برای بهبود اپلیکیشن استفاده می‌کنیم.",
    uk: "Дякуємо за ваш відгук! Ми використаємо його для покращення нашого додатку.",
    he: "תודה על שיתוף המשוב שלך! נשתמש בו כדי לשפר את האפליקציה שלנו.",
    sr: "Hvala što ste podelili svoje mišljenje! Koristićemo ga za poboljšanje naše aplikacije.",
    hr: "Hvala što ste podijelili svoje mišljenje! Koristit ćemo ga za poboljšanje naše aplikacije.",
    sk: "Ďakujeme za vaše spätnú väzbu! Použijeme ju na zlepšenie našej aplikácie.",
    bg: "Благодарим за вашия отзив! Ще го използваме за подобряване на нашето приложение.",
    sw: "Asante kwa kushiriki maoni yako! Tutatumia kuboresha programu yetu.",
    af: "Dankie vir die deel van jou terugvoer! Ons sal dit gebruik om ons app te verbeter.",
    ta: "உங்கள் கருத்தை பகிர்ந்தமைக்கு நன்றி! எங்கள் செயலியை மேம்படுத்த இதைப் பயன்படுத்துவோம்.",
    ne: "तपाईंको प्रतिक्रिया साझा गर्नुभएकोमा धन्यवाद! हामी यसलाई हाम्रो एप सुधार गर्न प्रयोग गर्नेछौं।",
  },
  "We're working on it": {
    es: "¡Gracias por reportar esto! Nuestro equipo está investigando el problema y te informaremos pronto.",
    fr: "Merci pour votre signalement ! Notre équipe examine le problème et vous tiendra informé dès que possible.",
    de: "Danke für Ihre Meldung! Unser Team untersucht das Problem und informiert Sie so bald wie möglich.",
    ar: "شكراً على الإبلاغ! فريقنا يحقق في المشكلة حالياً وسنعلمك بالتحديثات قريباً.",
    ur: "رپورٹ کرنے کا شکریہ! ہماری ٹیم اس مسئلے کی تحقیق کر رہی ہے اور آپ کو جلد آگاہ کریں گے۔",
    zh: "感谢您的报告！我们的团队正在调查此问题，我们会尽快向您提供最新进展。",
    hi: "रिपोर्ट करने के लिए धन्यवाद! हमारी टीम इस समस्या की जांच कर रही है और हम जल्द ही आपको अपडेट देंगे।",
    pt: "Obrigado por relatar! Nossa equipe está investigando o problema e em breve teremos uma atualização.",
    tr: "Bildirdiğiniz için teşekkürler! Ekibimiz sorunu araştırıyor ve yakında size güncelleme sunacağız.",
    ru: "Спасибо за сообщение! Наша команда расследует проблему и скоро сообщит вам об обновлениях.",
    ja: "ご報告ありがとうございます！チームが問題を調査中です。近日中にアップデートをお知らせします。",
    ko: "신고해 주셔서 감사합니다! 팀에서 문제를 조사 중이며, 곧 업데이트를 알려드리겠습니다.",
    it: "Grazie per la segnalazione! Il nostro team sta investigando il problema e ti aggiorneremo presto.",
    nl: "Bedankt voor de melding! Ons team onderzoekt het probleem en we laten je snel weten.",
    pl: "Dziękujemy za zgłoszenie! Nasz zespół bada problem i wkrótce Cię poinformujemy.",
    sv: "Tack för rapporten! Vårt team undersöker problemet och vi återkommer snart.",
    no: "Takk for rapporten! Teamet vårt undersøker problemet og vi gir deg en oppdatering snart.",
    da: "Tak for rapporten! Vores team undersøger problemet og vender tilbage snart.",
    fi: "Kiitos ilmoituksesta! Tiimimme tutkii ongelmaa ja palaamme asiaan pian.",
    el: "Ευχαριστούμε για την αναφορά! Η ομάδα μας διερευνά το πρόβλημα και θα επικοινωνήσουμε σύντομα.",
    cs: "Děkujeme za nahlášení! Náš tým zkoumá problém a brzy vám poskytneme aktualizaci.",
    hu: "Köszönjük a bejelentést! Csapatunk vizsgálja a problémát és hamarosan tájékoztatjuk.",
    ro: "Mulțumim pentru raportare! Echipa noastră investighează problema și vă vom informa în curând.",
    th: "ขอบคุณที่รายงาน! ทีมของเรากำลังตรวจสอบปัญหาและจะแจ้งให้ทราบเร็วๆ นี้",
    vi: "Cảm ơn bạn đã báo cáo! Nhóm của chúng tôi đang điều tra vấn đề và sẽ sớm cập nhật.",
    id: "Terima kasih telah melaporkan! Tim kami sedang menyelidiki masalah ini dan akan segera memberikan pembaruan.",
    ms: "Terima kasih kerana melaporkan! Pasukan kami sedang menyiasat masalah ini dan akan memberikan kemas kini.",
    bn: "রিপোর্টের জন্য ধন্যবাদ! আমাদের টিম সমস্যাটি তদন্ত করছে এবং শীঘ্রই আপডেট জানাব।",
    fa: "ممنون از گزارش شما! تیم ما در حال بررسی مشکل است و به زودی به شما اطلاع می‌دهیم.",
    uk: "Дякуємо за повідомлення! Наша команда розслідує проблему і незабаром надасть оновлення.",
    he: "תודה על הדיווח! הצוות שלנו חוקר את הבעיה ויעדכן אותך בקרוב.",
    sw: "Asante kwa kuripoti! Timu yetu inachunguza tatizo na tutakuarifu hivi karibuni.",
    ta: "புகாரளித்தமைக்கு நன்றி! எங்கள் குழு சிக்கலை ஆராய்கிறது, விரைவில் தெரிவிப்போம்.",
    ne: "रिपोर्ट गर्नुभएकोमा धन्यवाद! हाम्रो टोली समस्या अनुसन्धान गर्दैछ र चाँडै अपडेट गर्नेछ।",
  },
  "Issue resolved – please update": {
    es: "¡Buenas noticias! Este problema ha sido resuelto en la última actualización. Por favor actualiza la aplicación.",
    fr: "Bonne nouvelle ! Ce problème a été corrigé dans notre dernière mise à jour. Veuillez mettre à jour l'application.",
    de: "Gute Neuigkeiten! Dieses Problem wurde im letzten Update behoben. Bitte aktualisieren Sie die App.",
    ar: "أخبار رائعة! تم حل هذه المشكلة في آخر تحديث. يرجى تحديث التطبيق وإخبارنا إذا استمرت المشكلة.",
    ur: "خوشخبری! یہ مسئلہ ہماری تازہ ترین اپڈیٹ میں حل کر دیا گیا ہے۔ براہ کرم ایپ اپڈیٹ کریں۔",
    zh: "好消息！此问题已在我们的最新更新中解决。请将应用更新到最新版本。",
    hi: "अच्छी खबर! यह समस्या हमारे नवीनतम अपडेट में हल हो गई है। कृपया ऐप को नवीनतम संस्करण में अपडेट करें।",
    pt: "Ótimas notícias! Este problema foi resolvido em nossa última atualização. Por favor, atualize o aplicativo.",
    tr: "Harika haberler! Bu sorun en son güncellememizde çözüldü. Lütfen uygulamayı güncelleyin.",
    ru: "Отличные новости! Эта проблема решена в нашем последнем обновлении. Пожалуйста, обновите приложение.",
    ja: "お知らせです！この問題は最新のアップデートで解決されました。アプリを更新してください。",
    ko: "좋은 소식입니다! 이 문제는 최신 업데이트에서 해결되었습니다. 앱을 최신 버전으로 업데이트해 주세요.",
    it: "Ottime notizie! Questo problema è stato risolto nell'ultimo aggiornamento. Aggiorna l'app.",
    nl: "Goed nieuws! Dit probleem is opgelost in onze laatste update. Werk de app bij naar de nieuwste versie.",
    pl: "Świetne wieści! Ten problem został rozwiązany w naszej najnowszej aktualizacji. Zaktualizuj aplikację.",
    sv: "Goda nyheter! Detta problem har lösts i vår senaste uppdatering. Uppdatera appen.",
    no: "Gode nyheter! Dette problemet er løst i vår siste oppdatering. Oppdater appen.",
    da: "Gode nyheder! Dette problem er løst i vores seneste opdatering. Opdater appen.",
    fi: "Hyviä uutisia! Tämä ongelma on ratkaistu viimeisimmässä päivityksessämme. Päivitä sovellus.",
    el: "Χαρούμενα νέα! Αυτό το πρόβλημα έχει επιλυθεί στην τελευταία ενημέρωση. Ενημερώστε την εφαρμογή.",
    cs: "Skvělé zprávy! Tento problém byl vyřešen v naší nejnovější aktualizaci. Aktualizujte aplikaci.",
    hu: "Nagyszerű hír! Ezt a problémát legújabb frissítésünkben megoldottuk. Frissítse az alkalmazást.",
    ro: "Vești bune! Această problemă a fost rezolvată în cea mai recentă actualizare. Actualizați aplicația.",
    th: "ข่าวดี! ปัญหานี้ได้รับการแก้ไขในการอัปเดตล่าสุด กรุณาอัปเดตแอปเป็นเวอร์ชันล่าสุด",
    vi: "Tin vui! Vấn đề này đã được giải quyết trong bản cập nhật mới nhất. Vui lòng cập nhật ứng dụng.",
    id: "Kabar baik! Masalah ini telah diselesaikan dalam pembaruan terbaru kami. Perbarui aplikasi.",
    ms: "Berita baik! Masalah ini telah diselesaikan dalam kemas kini terbaru kami. Kemas kini aplikasi.",
    bn: "সুখবর! এই সমস্যাটি সর্বশেষ আপডেটে সমাধান হয়েছে। অ্যাপটি আপডেট করুন।",
    fa: "خبر خوب! این مشکل در آخرین بروزرسانی ما برطرف شده. لطفاً اپلیکیشن را بروزرسانی کنید.",
    uk: "Чудові новини! Цю проблему вирішено в останньому оновленні. Оновіть додаток.",
    he: "חדשות טובות! בעיה זו נפתרה בעדכון האחרון. אנא עדכן את האפליקציה.",
    sw: "Habari njema! Tatizo hili limetatuliwa katika sasisho la hivi karibuni. Sasisha programu.",
    ta: "நற்செய்தி! இந்த சிக்கல் சமீபத்திய புதுப்பிப்பில் தீர்க்கப்பட்டது. செயலியை புதுப்பிக்கவும்.",
    ne: "राम्रो खबर! यो समस्या नवीनतम अपडेटमा समाधान भएको छ। एपलाई अपडेट गर्नुहोस्।",
  },
  "Need more details": {
    es: "Gracias por contactarnos. Para investigar mejor, ¿podrías compartir el modelo de tu dispositivo, la versión del SO y la versión de la app?",
    fr: "Merci de nous contacter. Pour mieux investiguer, pourriez-vous partager le modèle de votre appareil, la version OS et la version de l'app ?",
    de: "Danke für Ihre Nachricht. Um das Problem besser zu untersuchen, könnten Sie bitte Ihr Gerätemodell, die OS-Version und App-Version mitteilen?",
    ar: "شكراً للتواصل معنا. لمساعدتنا في التحقيق، هل يمكنك مشاركة موديل جهازك ونظام التشغيل وإصدار التطبيق؟",
    ur: "ہم سے رابطہ کرنے کا شکریہ۔ مزید تحقیق کے لیے، کیا آپ اپنا ڈیوائس ماڈل، OS ورژن اور ایپ ورژن شیئر کر سکتے ہیں؟",
    zh: "感谢您的联系。为了更好地调查，您能分享您的设备型号、系统版本和应用版本吗？",
    hi: "हमसे संपर्क करने के लिए धन्यवाद। जांच में मदद के लिए, क्या आप अपना डिवाइस मॉडल, OS वर्शन और ऐप वर्शन साझा कर सकते हैं?",
    pt: "Obrigado por entrar em contato. Para investigar melhor, você pode compartilhar o modelo do seu dispositivo, versão do SO e versão do app?",
    tr: "Bizimle iletişime geçtiğiniz için teşekkürler. Daha iyi araştırmak için cihaz modelinizi, işletim sistemi ve uygulama sürümünüzü paylaşabilir misiniz?",
    ru: "Спасибо за обращение. Чтобы лучше расследовать, не могли бы вы поделиться моделью устройства, версией ОС и версией приложения?",
    ja: "お問い合わせありがとうございます。詳しく調査するために、デバイスのモデル、OSバージョン、アプリバージョンを教えていただけますか？",
    ko: "문의해 주셔서 감사합니다. 더 잘 조사하기 위해 기기 모델, OS 버전, 앱 버전을 공유해 주시겠어요?",
    it: "Grazie per averci contattato. Per investigare meglio, potresti condividere il modello del tuo dispositivo, la versione OS e la versione dell'app?",
    nl: "Bedankt voor het contact. Om beter te onderzoeken, kun je je apparaatmodel, OS-versie en app-versie delen?",
    pl: "Dziękujemy za kontakt. Aby lepiej zbadać, czy możesz podać model urządzenia, wersję systemu i wersję aplikacji?",
    th: "ขอบคุณที่ติดต่อเรา เพื่อช่วยในการตรวจสอบ คุณสามารถแชร์รุ่นอุปกรณ์ เวอร์ชัน OS และเวอร์ชันแอปได้ไหม?",
    vi: "Cảm ơn đã liên hệ. Để điều tra tốt hơn, bạn có thể chia sẻ mẫu thiết bị, phiên bản OS và phiên bản ứng dụng không?",
    id: "Terima kasih telah menghubungi kami. Untuk penyelidikan lebih baik, bisakah Anda berbagi model perangkat, versi OS, dan versi aplikasi?",
    bn: "যোগাযোগের জন্য ধন্যবাদ। আরও তদন্তের জন্য, আপনি কি আপনার ডিভাইস মডেল, OS সংস্করণ এবং অ্যাপ সংস্করণ শেয়ার করতে পারবেন?",
    fa: "ممنون از تماس شما. برای بررسی بهتر، آیا می‌توانید مدل دستگاه، نسخه OS و نسخه اپلیکیشن را به اشتراک بگذارید؟",
    ta: "தொடர்பு கொண்டதற்கு நன்றி. சிறப்பாக ஆராய, உங்கள் சாதன மாதிரி, OS பதிப்பு மற்றும் செயலி பதிப்பை பகிர முடியுமா?",
  },
  "Feature noted for roadmap": {
    es: "¡Gracias por la sugerencia! La hemos añadido a nuestra hoja de ruta y la consideraremos en una próxima versión.",
    fr: "Merci pour la suggestion ! Nous l'avons ajoutée à notre feuille de route et la considérerons dans une prochaine version.",
    de: "Danke für den Vorschlag! Wir haben ihn zu unserer Roadmap hinzugefügt und werden ihn in einem zukünftigen Release berücksichtigen.",
    ar: "شكراً على الاقتراح! لقد أضفناه إلى خارطة الطريق وسنأخذه بعين الاعتبار في إصدار قادم.",
    ur: "تجویز کا شکریہ! ہم نے اسے اپنے روڈ میپ میں شامل کر لیا ہے اور آنے والی ریلیز میں اسے شامل کریں گے۔",
    zh: "感谢您的建议！我们已将其添加到我们的功能路线图，并将在即将发布的版本中考虑。",
    hi: "सुझाव के लिए धन्यवाद! हमने इसे अपने फीचर रोडमैप में जोड़ दिया है और आने वाले रिलीज में इस पर विचार करेंगे।",
    pt: "Obrigado pela sugestão! Adicionamos ao nosso roteiro e consideraremos em uma próxima versão.",
    tr: "Öneri için teşekkürler! Bunu özellik yol haritamıza ekledik ve yaklaşan bir sürümde değerlendireceğiz.",
    ru: "Спасибо за предложение! Мы добавили его в нашу дорожную карту и рассмотрим в следующем релизе.",
    ja: "ご提案ありがとうございます！機能ロードマップに追加しました。今後のリリースで検討します。",
    ko: "제안해 주셔서 감사합니다! 기능 로드맵에 추가했으며 향후 릴리스에서 고려하겠습니다.",
    it: "Grazie per il suggerimento! Lo abbiamo aggiunto alla nostra roadmap e lo considereremo in un prossimo rilascio.",
    nl: "Bedankt voor de suggestie! We hebben het toegevoegd aan onze roadmap en zullen het overwegen in een toekomstige release.",
    pl: "Dziękujemy za sugestię! Dodaliśmy ją do naszej mapy drogowej i rozważymy w nadchodzącym wydaniu.",
    th: "ขอบคุณสำหรับข้อเสนอแนะ! เราได้เพิ่มในแผนงานแล้วและจะพิจารณาในเวอร์ชันถัดไป",
    vi: "Cảm ơn góp ý! Chúng tôi đã thêm vào lộ trình và sẽ xem xét trong bản phát hành tới.",
    id: "Terima kasih atas sarannya! Kami telah menambahkannya ke peta jalan kami dan akan mempertimbangkannya.",
    bn: "পরামর্শের জন্য ধন্যবাদ! আমরা এটি আমাদের ফিচার রোডম্যাপে যোগ করেছি এবং পরবর্তী রিলিজে বিবেচনা করব।",
    fa: "ممنون از پیشنهادتان! آن را به نقشه راه ویژگی‌های خود اضافه کردیم و در نسخه‌های آینده بررسی می‌کنیم.",
    ta: "பரிந்துரைக்கு நன்றி! இதை எங்கள் அம்ச வரைப்படத்தில் சேர்த்துள்ளோம், வரும் வெளியீட்டில் பரிசீலிப்போம்.",
  },
  "Sorry for the inconvenience": {
    es: "Nos disculpamos sinceramente por los inconvenientes que has experimentado. Nuestro equipo trabaja para que esto no vuelva a ocurrir.",
    fr: "Nous nous excusons sincèrement pour les désagréments que vous avez rencontrés. Notre équipe travaille dur pour éviter que cela ne se reproduise.",
    de: "Wir entschuldigen uns aufrichtig für die Unannehmlichkeiten. Unser Team arbeitet hart daran, dass dies nicht wieder passiert.",
    ar: "نعتذر بصدق عن الإزعاج الذي تعرضت له. فريقنا يعمل جاهداً لضمان عدم تكرار ذلك.",
    ur: "ہم آپ کو پیش آنے والی تکلیف کے لیے دل سے معذرت خواہ ہیں۔ ہماری ٹیم یہ یقینی بنانے کے لیے کام کر رہی ہے کہ یہ دوبارہ نہ ہو۔",
    zh: "我们真诚地为您所经历的不便道歉。我们的团队正在努力确保这种情况不再发生。",
    hi: "हम आपको हुई असुविधा के लिए ईमानदारी से माफी मांगते हैं। हमारी टीम यह सुनिश्चित करने के लिए काम कर रही है कि यह दोबारा न हो।",
    pt: "Pedimos sinceras desculpas pelo inconveniente. Nossa equipe está trabalhando para garantir que isso não aconteça novamente.",
    tr: "Yaşadığınız rahatsızlık için içtenlikle özür dileriz. Ekibimiz bunun tekrar olmaması için çalışıyor.",
    ru: "Искренне приносим извинения за доставленные неудобства. Наша команда работает над тем, чтобы это не повторилось.",
    ja: "ご不便をおかけして、心よりお詫び申し上げます。チームはこのような事態が再発しないよう取り組んでいます。",
    ko: "불편을 드려 진심으로 사과드립니다. 팀에서 이런 일이 다시 발생하지 않도록 노력하고 있습니다.",
    it: "Ci scusiamo sinceramente per il disagio che hai riscontrato. Il nostro team sta lavorando per evitare che questo accada di nuovo.",
    nl: "We bieden onze oprechte excuses aan voor het ongemak. Ons team werkt hard om ervoor te zorgen dat dit niet opnieuw gebeurt.",
    pl: "Szczerze przepraszamy za niedogodności. Nasz zespół pracuje, aby upewnić się, że to się nie powtórzy.",
    th: "เราขอโทษอย่างจริงใจสำหรับความไม่สะดวกที่เกิดขึ้น ทีมของเราทำงานอย่างหนักเพื่อให้แน่ใจว่าจะไม่เกิดขึ้นอีก",
    vi: "Chúng tôi thành thật xin lỗi vì sự bất tiện. Nhóm đang nỗ lực đảm bảo điều này không xảy ra nữa.",
    id: "Kami dengan tulus memohon maaf atas ketidaknyamanan yang Anda alami. Tim kami bekerja keras untuk memastikan hal ini tidak terjadi lagi.",
    bn: "আপনার অসুবিধার জন্য আমরা আন্তরিকভাবে ক্ষমাপ্রার্থী। আমাদের দল এটি যাতে আর না হয় তা নিশ্চিত করতে কাজ করছে।",
    fa: "صمیمانه از ناراحتی شما عذرخواهی می‌کنیم. تیم ما تلاش می‌کند اطمینان حاصل کند که این اتفاق دوباره نیفتد.",
    ta: "ஏற்பட்ட சிரமத்திற்கு நாங்கள் மனதார மன்னிப்பு கோருகிறோம். இது மீண்டும் நிகழாதவாறு குழு கடுமையாக உழைக்கிறது.",
  },
  "Try clearing app cache": {
    es: "Por favor, intenta borrar la caché de la app (Ajustes → Apps → [Nombre app] → Borrar caché) y reiníciala. ¡Avísanos si funciona!",
    fr: "Essayez de vider le cache de l'app (Paramètres → Apps → [Nom app] → Vider le cache) et redémarrez. Dites-nous si ça aide !",
    de: "Bitte versuchen Sie, den App-Cache zu leeren (Einstellungen → Apps → [App-Name] → Cache leeren) und starten Sie die App neu.",
    ar: "يرجى محاولة مسح ذاكرة التخزين المؤقت (الإعدادات ← التطبيقات ← [اسم التطبيق] ← مسح ذاكرة التخزين المؤقت) وإعادة تشغيل التطبيق.",
    ur: "براہ کرم ایپ کیش صاف کریں (Settings → Apps → [ایپ نام] → Clear Cache) اور ایپ دوبارہ چلائیں۔ ہمیں بتائیں کہ آیا اس سے مدد ملی!",
    zh: "请尝试清除应用缓存（设置 → 应用 → [应用名称] → 清除缓存）并重新启动应用。告诉我们是否有帮助！",
    hi: "कृपया ऐप कैश साफ करें (Settings → Apps → [ऐप नाम] → Clear Cache) और ऐप को पुनः शुरू करें। हमें बताएं कि क्या इससे मदद मिली!",
    pt: "Por favor, tente limpar o cache do app (Configurações → Apps → [Nome do app] → Limpar cache) e reinicie o app.",
    tr: "Lütfen uygulama önbelleğini temizlemeyi deneyin (Ayarlar → Uygulamalar → [Uygulama adı] → Önbelleği temizle) ve uygulamayı yeniden başlatın.",
    ru: "Пожалуйста, попробуйте очистить кеш приложения (Настройки → Приложения → [Название] → Очистить кеш) и перезапустить приложение.",
    ja: "アプリのキャッシュをクリアしてみてください（設定 → アプリ → [アプリ名] → キャッシュをクリア）してアプリを再起動してください。",
    ko: "앱 캐시를 지워보세요 (설정 → 앱 → [앱 이름] → 캐시 지우기) 그리고 앱을 재시작하세요.",
    it: "Prova a svuotare la cache dell'app (Impostazioni → App → [Nome app] → Svuota cache) e riavvia l'app.",
    nl: "Probeer de app-cache te wissen (Instellingen → Apps → [App naam] → Cache wissen) en start de app opnieuw.",
    pl: "Spróbuj wyczyścić pamięć podręczną aplikacji (Ustawienia → Aplikacje → [Nazwa app] → Wyczyść pamięć) i uruchom ponownie.",
    th: "ลองล้างแคชของแอป (การตั้งค่า → แอป → [ชื่อแอป] → ล้างแคช) แล้วรีสตาร์ทแอป บอกเราว่าช่วยได้ไหม!",
    vi: "Hãy thử xóa bộ nhớ đệm ứng dụng (Cài đặt → Ứng dụng → [Tên app] → Xóa bộ nhớ đệm) và khởi động lại.",
    id: "Coba bersihkan cache aplikasi (Pengaturan → Aplikasi → [Nama app] → Hapus cache) dan mulai ulang aplikasi.",
    bn: "অ্যাপ ক্যাশ পরিষ্কার করুন (Settings → Apps → [App নাম] → Clear Cache) এবং অ্যাপ পুনরায় চালু করুন।",
    fa: "لطفاً کش اپلیکیشن را پاک کنید (تنظیمات ← برنامه‌ها ← [نام اپ] ← پاک کردن کش) و اپ را راه‌اندازی مجدد کنید.",
    ta: "செயலி கேச்சை அழிக்கவும் (Settings → Apps → [செயலி பெயர்] → Clear Cache) மற்றும் செயலியை மறுதொடக்கம் செய்யவும்.",
  },
  "Closing – issue resolved": {
    es: "Nos alegra saber que el problema se ha resuelto. Cerramos este ticket por ahora. No dudes en contactarnos si necesitas algo más.",
    fr: "Nous sommes ravis d'apprendre que le problème est résolu. Nous fermons ce ticket pour l'instant. N'hésitez pas à nous contacter si vous avez autre chose.",
    de: "Schön zu hören, dass das Problem gelöst wurde! Wir schließen dieses Ticket vorerst. Melden Sie sich gerne, wenn Sie weitere Hilfe benötigen.",
    ar: "يسعدنا سماع أن المشكلة قد حُلّت! نغلق هذه التذكرة الآن. لا تتردد في التواصل معنا إذا احتجت لأي شيء آخر.",
    ur: "یہ جان کر خوشی ہوئی کہ مسئلہ حل ہو گیا! ہم ابھی کے لیے یہ ٹکٹ بند کر رہے ہیں۔ اگر کوئی اور مسئلہ ہو تو بلا جھجھک رابطہ کریں۔",
    zh: "很高兴听到问题已经解决！我们现在关闭此工单。如果您遇到其他问题，请随时联系我们。",
    hi: "यह जानकर अच्छा लगा कि समस्या हल हो गई! हम अभी के लिए इस टिकट को बंद कर रहे हैं। अगर कोई और समस्या हो तो बेझिझक संपर्क करें।",
    pt: "Fico feliz em saber que o problema foi resolvido! Estamos encerrando este ticket por agora. Não hesite em entrar em contato se precisar de mais ajuda.",
    tr: "Sorunun çözüldüğünü duymak güzel! Bu bileti şimdilik kapatıyoruz. Başka bir şeye ihtiyacınız olursa bize ulaşmaktan çekinmeyin.",
    ru: "Рады слышать, что проблема решена! Закрываем этот тикет на данный момент. Не стесняйтесь обращаться, если что-то ещё понадобится.",
    ja: "問題が解決したとのこと、嬉しいです！このチケットは一旦クローズします。他に何かあればお気軽にご連絡ください。",
    ko: "문제가 해결되었다니 기쁩니다! 지금은 이 티켓을 닫겠습니다. 다른 문제가 생기면 언제든지 연락주세요.",
    it: "Siamo felici di sapere che il problema è stato risolto! Chiudiamo questo ticket per ora. Non esitare a contattarci se hai bisogno di altro.",
    nl: "Fijn te horen dat het probleem is opgelost! We sluiten dit ticket voor nu. Aarzel niet om contact op te nemen als je nog iets nodig hebt.",
    pl: "Miło słyszeć, że problem został rozwiązany! Zamykamy ten ticket na razie. Skontaktuj się z nami, jeśli potrzebujesz czegoś jeszcze.",
    th: "ดีใจที่ได้ยินว่าปัญหาได้รับการแก้ไขแล้ว! เราปิดตั๋วนี้ก่อน หากมีปัญหาอื่น อย่าลังเลที่จะติดต่อเรา",
    vi: "Vui khi biết vấn đề đã được giải quyết! Chúng tôi đóng ticket này. Đừng ngại liên hệ nếu có điều gì khác.",
    id: "Senang mendengar masalahnya sudah terselesaikan! Kami menutup tiket ini untuk saat ini. Jangan ragu menghubungi kami jika butuh bantuan lagi.",
    bn: "সমস্যা সমাধান হয়েছে জেনে ভালো লাগলো! আপাতত এই টিকিট বন্ধ করছি। অন্য কিছু প্রয়োজন হলে যোগাযোগ করুন।",
    fa: "خوشحالیم که مشکل حل شد! این تیکت را فعلاً می‌بندیم. اگر چیز دیگری نیاز داشتید، حتماً تماس بگیرید.",
    ta: "சிக்கல் தீர்ந்தது தெரிந்து மகிழ்ச்சி! இந்த டிக்கெட்டை இப்போதைக்கு மூடுகிறோம். வேறு உதவி தேவைப்பட்டால் தொடர்பு கொள்ளுங்கள்.",
  },
};

interface FeedbackAttachment {
  id: string;
  feedbackReplyId?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface FeedbackFull {
  id: string;
  rating: number;
  category: string;
  status: string;
  comment?: string;
  deviceType?: string;
  osVersion?: string;
  appVersion?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string };
  app: { id: string; name: string };
  replies: { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl?: string }; attachments?: FeedbackAttachment[] }[];
  attachments?: FeedbackAttachment[];
}

const categoryLabels: Record<string, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  suggestion: "Suggestion",
  complaint: "Complaint",
  general: "General",
};
const categoryColors: Record<string, string> = {
  bug_report: "bg-red-100 text-red-700 ring-1 ring-red-200",
  feature_request: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  suggestion: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
  complaint: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  general: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

const statusLabels: Record<string, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const statusColors: Record<string, string> = {
  new: "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300",
  acknowledged: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  in_progress: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
  resolved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
};
const statusIcons: Record<string, string> = {
  new: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z",
  acknowledged: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  in_progress: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182",
  resolved: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};


function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-5 h-5 ${s <= rating ? "text-yellow-400" : "text-gray-200"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function getSentiment(rating: number, category: string) {
  if (rating >= 4) return { label: "Positive", color: "text-emerald-600 bg-emerald-50", emoji: "Satisfied user", icon: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" };
  if (rating === 3) return { label: "Neutral", color: "text-amber-600 bg-amber-50", emoji: "Mixed feelings", icon: "M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zM9 15h6" };
  if (category === "complaint" || category === "bug_report") return { label: "Negative", color: "text-red-600 bg-red-50", emoji: "Needs attention", icon: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" };
  return { label: "Negative", color: "text-red-600 bg-red-50", emoji: "Unsatisfied user", icon: "M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" };
}

function detectLanguage(text: string): string {
  if (!text || text.trim().length < 5) return "";
  let ar = 0, hi = 0, zh = 0, ja = 0, ko = 0, ru = 0, el = 0, th = 0, he = 0, bn = 0, ta = 0, fa = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06FF) ar++;        // Arabic/Urdu/Persian script
    else if (cp >= 0xFB50 && cp <= 0xFDFF) fa++;   // Arabic Presentation Forms (Persian-heavy)
    else if (cp >= 0x0900 && cp <= 0x097F) hi++;   // Devanagari (Hindi/Nepali)
    else if ((cp >= 0x3040 && cp <= 0x309F) || (cp >= 0x30A0 && cp <= 0x30FF)) ja++;  // Hiragana/Katakana → Japanese
    else if (cp >= 0x4E00 && cp <= 0x9FFF) zh++;   // CJK (Chinese or Japanese Kanji)
    else if (cp >= 0xAC00 && cp <= 0xD7AF) ko++;   // Hangul (Korean)
    else if (cp >= 0x0400 && cp <= 0x04FF) ru++;   // Cyrillic (Russian/Ukrainian/Bulgarian)
    else if (cp >= 0x0370 && cp <= 0x03FF) el++;   // Greek
    else if (cp >= 0x0E00 && cp <= 0x0E7F) th++;   // Thai
    else if (cp >= 0x0590 && cp <= 0x05FF) he++;   // Hebrew
    else if (cp >= 0x0980 && cp <= 0x09FF) bn++;   // Bengali
    else if (cp >= 0x0B80 && cp <= 0x0BFF) ta++;   // Tamil
  }
  // Japanese uses both Hiragana/Katakana + CJK; prioritize ja if Hiragana/Katakana present
  const scores: [string, number][] = [
    ["ar", ar], ["hi", hi], ["ja", ja > 0 ? zh + ja : 0],
    ["zh", ja === 0 ? zh : 0], ["ko", ko], ["ru", ru],
    ["el", el], ["th", th], ["he", he], ["bn", bn], ["ta", ta], ["fa", fa],
  ];
  const best = scores.reduce((a, b) => b[1] > a[1] ? b : a, ["", 0] as [string, number]);
  return (best[1] as number) >= 3 ? best[0] : "";
}

function getResponseTime(createdAt: string, replies: { createdAt: string }[]) {
  if (replies.length === 0) return null;
  const created = new Date(createdAt).getTime();
  const firstReply = new Date(replies[0].createdAt).getTime();
  const diff = firstReply - created;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}


export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const [feedback, setFeedback] = useState<FeedbackFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteFeedbackConfirm, setDeleteFeedbackConfirm] = useState(false);
  const [deletingFeedback, setDeletingFeedback] = useState(false);
  const [deleteReplyId, setDeleteReplyId] = useState<string | null>(null);
  const [deletingReply, setDeletingReply] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [cannedReplies, setCannedReplies] = useState<{ id: string; title: string; body: string; locale: string | null }[]>([]);
  const [cannedLocale, setCannedLocale] = useState("");
  const [admins, setAdmins] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/admin/canned-replies").then(r => setCannedReplies(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/admin/admins").then(r => setAdmins(r.data)).catch(() => {});
  }, []);

  const detectMention = (value: string, caret: number) => {
    const match = /@([a-zA-Z0-9._-]*)$/.exec(value.slice(0, caret));
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionActiveIdx(0); }
    else setMentionQuery(null);
  };

  const insertMention = (admin: { id: string; name: string }) => {
    const el = replyRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? reply.length;
    const replaced = reply.slice(0, caret).replace(/@([a-zA-Z0-9._-]*)$/, `@${admin.name.split(" ")[0]} `);
    const next = replaced + reply.slice(caret);
    setReply(next);
    setMentionQuery(null);
    setTimeout(() => { el.focus(); el.setSelectionRange(replaced.length, replaced.length); }, 0);
  };

  const mentionCandidates = mentionQuery !== null
    ? [
        // feedback submitter first
        ...(feedback?.user ? [{ id: feedback.user.id, name: feedback.user.name, avatarUrl: feedback.user.avatarUrl, isUser: true }] : []),
        ...admins.map(a => ({ ...a, isUser: false })),
      ].filter(a =>
        mentionQuery === "" ||
        a.name.toLowerCase().includes(mentionQuery) ||
        a.name.split(" ")[0].toLowerCase().startsWith(mentionQuery)
      ).slice(0, 7)
    : [];

  const fetchFeedback = () => {
    api.get(`/admin/feedbacks/${id}`).then((r) => { setFeedback(r.data); setLoading(false); });
  };

  useEffect(() => { fetchFeedback(); }, [id]);

  useEffect(() => {
    if (!feedback) return;
    // Auto-detect language from user's text so the right quick-reply language is pre-selected
    const userTexts = [
      feedback.comment ?? "",
      ...(feedback.replies ?? [])
        .filter(r => r.user.id === feedback.user.id)
        .map(r => r.body),
    ].join(" ");
    const detected = detectLanguage(userTexts);
    if (detected) setCannedLocale(detected);
  }, [feedback?.id]);

  const sendReply = async () => {
    if (!reply.trim() && pendingFiles.length === 0) return;
    setSending(true);
    const res = await api.post(`/admin/feedbacks/${id}/reply`, { body: reply || " " });
    const replyId = res.data?.id;
    if (replyId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("replyId", replyId);
        await api.post(`/admin/feedbacks/${id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
    }
    setReply("");
    setPendingFiles([]);
    setSending(false);
    fetchFeedback();
  };

  const updateStatus = async (status: string) => {
    setUpdatingStatus(true);
    try {
      const { data } = await api.patch(`/admin/feedbacks/${id}/status`, { status });
      setFeedback((prev) => prev ? { ...prev, status: data.status } : prev);
    } catch { /* ignore */ }
    setUpdatingStatus(false);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await api.post(`/admin/feedbacks/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setUploading(false);
    fetchFeedback();
  };

  const handleDeleteFeedback = async () => {
    setDeletingFeedback(true);
    try {
      await api.delete(`/admin/feedbacks/${id}`);
      navigate("/feedbacks");
    } catch {
      setDeletingFeedback(false);
      setDeleteFeedbackConfirm(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    setDeletingReply(true);
    try {
      await api.delete(`/admin/feedbacks/${id}/replies/${replyId}`);
      setDeleteReplyId(null);
      fetchFeedback();
    } catch {
      /* ignore */
    } finally {
      setDeletingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!feedback) return <div className="p-8 text-center text-red-500">Feedback not found</div>;

  const isImage = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  };

  const sentiment = getSentiment(feedback.rating, feedback.category);
  const responseTime = getResponseTime(feedback.createdAt, feedback.replies);

  return (
    <div className="max-w-7xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/feedbacks" className="hover:text-gray-600 transition-colors flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Feedbacks
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Feedback from {feedback.user.name}</span>
      </div>

      {/* Status + Sentiment Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap items-center gap-4">
        {/* Status selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</span>
          <div className="flex gap-1">
            {Object.entries(statusLabels).map(([key, label]) => (
              <button key={key} onClick={() => updateStatus(key)} disabled={updatingStatus}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  feedback.status === key
                    ? statusColors[key] + " border-transparent"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={statusIcons[key]} />
                </svg>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden sm:block w-px h-8 bg-gray-200" />

        {/* Sentiment */}
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sentiment.color}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={sentiment.icon} />
            </svg>
            {sentiment.label}
          </div>
          <span className="text-xs text-gray-400">{sentiment.emoji}</span>
        </div>

        {responseTime && (
          <>
            <div className="hidden sm:block w-px h-8 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>First response: <strong className="text-gray-700">{responseTime}</strong></span>
            </div>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Main content */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Feedback Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Header badges */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${categoryColors[feedback.category] || "bg-gray-100 text-gray-600"}`}>
                {categoryLabels[feedback.category] || feedback.category}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-gray-200">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {feedback.app.name}
              </span>
              <span className="text-xs text-gray-400">{timeAgo(feedback.createdAt)}</span>
            </div>

            {/* Rating with sentiment bar */}
            <div className="flex items-center gap-3 mb-4">
              <Stars rating={feedback.rating} />
              <span className="text-lg font-bold text-gray-900">{feedback.rating}/5</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden ml-2">
                <div className={`h-full rounded-full transition-all ${
                  feedback.rating >= 4 ? "bg-emerald-400" : feedback.rating === 3 ? "bg-amber-400" : "bg-red-400"
                }`} style={{ width: `${(feedback.rating / 5) * 100}%` }} />
              </div>
            </div>

            {/* Comment */}
            {feedback.comment ? (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{feedback.comment}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-center">
                <p className="text-sm text-gray-400 italic">No comment provided</p>
              </div>
            )}

            {/* Attachments */}
            <div className="mt-4">
              {feedback.attachments && feedback.attachments.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Attachments ({feedback.attachments.length})
                  </p>
                  {feedback.attachments.filter(a => isImage(a.fileName)).length > 0 && (
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 mb-2">
                      {feedback.attachments.filter(a => isImage(a.fileName)).map((a) => (
                        <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors">
                          <img src={`/api${a.fileUrl}`} alt={a.fileName}
                            className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {feedback.attachments.filter(a => !isImage(a.fileName)).map((a) => (
                      <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors group">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-sm font-medium text-blue-700">{a.fileName}</span>
                        <span className="text-xs text-blue-400">{(a.fileSize / 1024).toFixed(0)} KB</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors ${
                uploading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
              }`}>
                <input type="file" className="hidden" disabled={uploading}
                  onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                    <span className="text-sm text-blue-600 font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm text-gray-500">Attach file</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Replies */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Replies
                {feedback.replies.length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">{feedback.replies.length}</span>
                )}
              </h2>
            </div>

            <div className="p-6">
              {feedback.replies.length > 0 ? (
                <div className="space-y-1">
                  {feedback.replies.map((r, i) => (
                    <div key={r.id} className="group/reply flex gap-3 pb-4">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <Avatar name={r.user.name} avatarUrl={r.user.avatarUrl} size={32} />
                        {i < feedback.replies.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 mt-2" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-gray-900">{r.user.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Admin</span>
                          <span className="text-xs text-gray-400">{timeAgo(r.createdAt)}</span>
                          {deleteReplyId === r.id ? (
                            <span className="flex items-center gap-1 ml-auto">
                              <button onClick={() => handleDeleteReply(r.id)} disabled={deletingReply}
                                className="text-xs text-red-600 hover:text-red-700 font-medium">
                                {deletingReply ? "..." : "Confirm"}
                              </button>
                              <button onClick={() => setDeleteReplyId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 font-medium">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteReplyId(r.id)}
                              className="ml-auto opacity-0 group-hover/reply:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                              title="Delete reply">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>
                        </div>
                        {/* Per-reply attachments */}
                        {(() => {
                          const replyAtts = feedback.attachments?.filter(a => a.feedbackReplyId === r.id) || [];
                          if (replyAtts.length === 0) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {replyAtts.map(a => (
                                <a key={a.id} href={`/api${a.fileUrl}`} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 hover:bg-blue-100 text-xs text-blue-700 font-medium transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  {a.fileName}
                                  <span className="text-blue-400">{(a.fileSize / 1024).toFixed(0)} KB</span>
                                </a>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  <p className="text-sm text-gray-400">No replies yet</p>
                  <p className="text-xs text-gray-300 mt-1">Use a quick reply or write a custom response</p>
                </div>
              )}

              {/* Reply form */}
              <div className="mt-5 pt-5 border-t border-gray-200">
                {/* Quick replies toggle */}
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                      <svg className={`w-4 h-4 transition-transform ${showQuickReplies ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                      Quick Replies
                    </button>
                  </div>
                  {showQuickReplies && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button onClick={() => setCannedLocale("")}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${cannedLocale === "" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"}`}>
                        🌐 All Languages
                      </button>
                      <select value={cannedLocale} onChange={e => setCannedLocale(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer">
                        <option value="">— Select Language —</option>
                        <option value="en">🇬🇧 English</option>
                        <option value="es">🇪🇸 Spanish</option>
                        <option value="fr">🇫🇷 French</option>
                        <option value="de">🇩🇪 German</option>
                        <option value="ar">🇸🇦 Arabic</option>
                        <option value="ur">🇵🇰 Urdu</option>
                        <option value="zh">🇨🇳 Chinese</option>
                        <option value="hi">🇮🇳 Hindi</option>
                        <option value="pt">🇧🇷 Portuguese</option>
                        <option value="tr">🇹🇷 Turkish</option>
                        <option value="ru">🇷🇺 Russian</option>
                        <option value="ja">🇯🇵 Japanese</option>
                        <option value="ko">🇰🇷 Korean</option>
                        <option value="it">🇮🇹 Italian</option>
                        <option value="nl">🇳🇱 Dutch</option>
                        <option value="pl">🇵🇱 Polish</option>
                        <option value="sv">🇸🇪 Swedish</option>
                        <option value="no">🇳🇴 Norwegian</option>
                        <option value="da">🇩🇰 Danish</option>
                        <option value="fi">🇫🇮 Finnish</option>
                        <option value="el">🇬🇷 Greek</option>
                        <option value="cs">🇨🇿 Czech</option>
                        <option value="hu">🇭🇺 Hungarian</option>
                        <option value="ro">🇷🇴 Romanian</option>
                        <option value="th">🇹🇭 Thai</option>
                        <option value="vi">🇻🇳 Vietnamese</option>
                        <option value="id">🇮🇩 Indonesian</option>
                        <option value="ms">🇲🇾 Malay</option>
                        <option value="bn">🇧🇩 Bengali</option>
                        <option value="fa">🇮🇷 Persian</option>
                        <option value="uk">🇺🇦 Ukrainian</option>
                        <option value="he">🇮🇱 Hebrew</option>
                        <option value="sr">🇷🇸 Serbian</option>
                        <option value="hr">🇭🇷 Croatian</option>
                        <option value="sk">🇸🇰 Slovak</option>
                        <option value="bg">🇧🇬 Bulgarian</option>
                        <option value="lt">🇱🇹 Lithuanian</option>
                        <option value="lv">🇱🇻 Latvian</option>
                        <option value="sl">🇸🇮 Slovenian</option>
                        <option value="az">🇦🇿 Azerbaijani</option>
                        <option value="kk">🇰🇿 Kazakh</option>
                        <option value="uz">🇺🇿 Uzbek</option>
                        <option value="sw">🇰🇪 Swahili</option>
                        <option value="am">🇪🇹 Amharic</option>
                        <option value="af">🇿🇦 Afrikaans</option>
                        <option value="sq">🇦🇱 Albanian</option>
                        <option value="mk">🇲🇰 Macedonian</option>
                        <option value="mn">🇲🇳 Mongolian</option>
                        <option value="my">🇲🇲 Burmese</option>
                        <option value="km">🇰🇭 Khmer</option>
                        <option value="ne">🇳🇵 Nepali</option>
                        <option value="si">🇱🇰 Sinhala</option>
                        <option value="ta">🇮🇳 Tamil</option>
                      </select>
                      {cannedLocale && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {cannedLocale.toUpperCase()}
                          <button onClick={() => setCannedLocale("")} className="ml-0.5 hover:text-blue-900">✕</button>
                        </span>
                      )}
                    </div>
                  )}

                  {showQuickReplies && (
                    <div className="mt-2">
                      {cannedReplies.filter(qr => !qr.locale).length === 0 ? (
                        <div className="text-xs text-gray-400 py-2">
                          No quick replies saved. <a href="/settings" className="text-blue-500 hover:underline" onClick={e => { e.preventDefault(); navigate("/settings"); }}>Add some in Settings → Quick Replies</a>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                          {cannedReplies.filter(qr => !qr.locale).map((qr) => (
                            <button key={qr.id} onClick={() => { const body = (cannedLocale && QUICK_REPLY_TRANSLATIONS[qr.title]?.[cannedLocale]) || qr.body; setReply(body.replace(/\{\{user\}\}/gi, feedback?.user?.name || "there")); setShowQuickReplies(false); }}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-all group">
                              <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                              </span>
                              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">{qr.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white relative">
                  <textarea
                    ref={replyRef}
                    value={reply}
                    onChange={(e) => { setReply(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
                    onKeyDown={(e) => {
                      if (mentionQuery === null || mentionCandidates.length === 0) return;
                      if (e.key === "ArrowDown") { e.preventDefault(); setMentionActiveIdx(i => Math.min(i + 1, mentionCandidates.length - 1)); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setMentionActiveIdx(i => Math.max(i - 1, 0)); }
                      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionActiveIdx]); }
                      else if (e.key === "Escape") setMentionQuery(null);
                    }}
                    placeholder="Write a reply to this feedback... (type @ to mention an admin)"
                    className="w-full p-4 text-sm rounded-t-xl resize-none outline-none placeholder-gray-400"
                    rows={3} />
                  {mentionQuery !== null && mentionCandidates.length > 0 && (
                    <div className="absolute left-4 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[220px] overflow-hidden">
                      {mentionCandidates.map((a, i) => (
                        <button key={a.id} onClick={() => insertMention(a)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${i === mentionActiveIdx ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`}>
                          <Avatar name={a.name} avatarUrl={a.avatarUrl} size={20} />
                          <span className="flex-1">{a.name}</span>
                          {a.isUser && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full font-medium">User</span>}
                          {!a.isUser && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">Admin</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Pending file chips */}
                  {pendingFiles.length > 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                      {pendingFiles.map((f, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {f.name}
                          <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="hover:text-red-500 transition-colors ml-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      {/* File picker */}
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 cursor-pointer transition-colors" title="Attach file">
                        <input ref={replyFileRef} type="file" className="hidden" multiple
                          onChange={(e) => {
                            if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                            e.target.value = "";
                          }} />
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}` : "Attach"}
                      </label>
                      {reply.length > 0 && <span className="text-xs text-gray-400">{reply.length} chars</span>}
                      {reply.trim() && (
                        <button onClick={() => setReply("")}
                          className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors">
                          Clear
                        </button>
                      )}
                    </div>
                    <button onClick={sendReply} disabled={sending || (!reply.trim() && pendingFiles.length === 0)}
                      className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      {sending ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Reply
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-5">
          {/* Submitted by */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={feedback.user.name} avatarUrl={feedback.user.avatarUrl} size={44} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{feedback.user.name}</p>
                  <p className="text-xs text-gray-500">{feedback.user.email}</p>
                </div>
              </div>
              <Link to={`/users?id=${feedback.user.id}`}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </Link>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</h3>
            </div>
            <div className="p-5 space-y-3">
              {/* Only keep fields NOT already visible on the top banner or
                  the feedback card. Rating / sentiment / status / category /
                  app / response time are all above — don't duplicate them. */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Submitted</span>
                <span className="font-medium text-gray-700">{new Date(feedback.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Replies</span>
                <span className="font-medium text-gray-700">{feedback.replies.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Attachments</span>
                <span className="font-medium text-gray-700">{feedback.attachments?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Device Info */}
          {(feedback.deviceType || feedback.osVersion || feedback.appVersion) && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Device Info</h3>
              </div>
              <div className="p-5 space-y-3">
                {feedback.deviceType && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Device
                    </span>
                    <span className="font-medium text-gray-700 capitalize">{feedback.deviceType}</span>
                  </div>
                )}
                {feedback.osVersion && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                      </svg>
                      OS Version
                    </span>
                    <span className="font-medium text-gray-700">{feedback.osVersion}</span>
                  </div>
                )}
                {feedback.appVersion && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                      </svg>
                      App Version
                    </span>
                    <span className="font-medium text-gray-700">v{feedback.appVersion}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</h3>
            </div>
            <div className="p-3 space-y-1">
              {feedback.status !== "acknowledged" && (
                <button onClick={() => updateStatus("acknowledged")} disabled={updatingStatus}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Mark as Acknowledged
                </button>
              )}
              {feedback.status !== "in_progress" && (
                <button onClick={() => updateStatus("in_progress")} disabled={updatingStatus}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Mark as In Progress
                </button>
              )}
              {feedback.status !== "resolved" && (
                <button onClick={() => updateStatus("resolved")} disabled={updatingStatus}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mark as Resolved
                </button>
              )}
              {cannedReplies.filter(qr => !qr.locale).length > 0 && (
                <button onClick={() => { const first = cannedReplies.filter(qr => !qr.locale)[0]; setReply(first.body.replace(/\{\{user\}\}/gi, feedback?.user?.name || "there")); setShowQuickReplies(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                  {cannedReplies.filter(qr => !qr.locale)[0].title}
                </button>
              )}
            </div>
          </div>

          {/* Delete Feedback */}
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-red-50 border-b border-red-200">
              <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider">Danger Zone</h3>
            </div>
            <div className="p-5">
              {!deleteFeedbackConfirm ? (
                <button onClick={() => setDeleteFeedbackConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Feedback
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-red-600">This will permanently delete this feedback, all replies, and attachments.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDeleteFeedback} disabled={deletingFeedback}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {deletingFeedback ? "Deleting..." : "Confirm"}
                    </button>
                    <button onClick={() => setDeleteFeedbackConfirm(false)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
