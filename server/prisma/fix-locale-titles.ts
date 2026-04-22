import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// English title → locale body mapping
const titleBodyMap: Record<string, Record<string, string>> = {
  "Thank you for your feedback": {
    es: "¡Gracias por tomarte el tiempo de compartir tu opinión! Lo tendremos muy en cuenta para mejorar la aplicación.",
    fr: "Merci de prendre le temps de partager votre avis ! Nous en tiendrons compte pour améliorer notre application.",
    de: "Vielen Dank, dass Sie sich die Zeit genommen haben, uns Ihr Feedback mitzuteilen! Wir werden es nutzen, um unsere App weiter zu verbessern.",
    ar: "شكراً لك على تخصيص وقتك لمشاركة ملاحظاتك! نقدر ذلك كثيراً وسنستخدمه لتحسين تطبيقنا.",
    ur: "اپنا قیمتی فیڈ بیک شیئر کرنے کے لیے آپ کا بہت شکریہ! ہم اسے اپنی ایپ بہتر بنانے کے لیے استعمال کریں گے۔",
    zh: "感谢您花时间分享您的反馈！我们非常感激，将用它来改进我们的应用。",
    hi: "अपनी प्रतिक्रिया साझा करने के लिए समय निकालने के लिए धन्यवाद! हम इसकी बहुत सराहना करते हैं।",
    pt: "Obrigado por dedicar um tempo para compartilhar seu feedback! Agradecemos muito e o usaremos para melhorar nosso aplicativo.",
    tr: "Geri bildiriminizi paylaşmak için zaman ayırdığınız için teşekkür ederiz! Bunu çok takdir ediyoruz.",
    ru: "Спасибо, что нашли время поделиться своим отзывом! Мы очень ценим это и используем для улучшения нашего приложения.",
    ja: "フィードバックをお寄せいただきありがとうございます！大変感謝しております。アプリの改善に役立てさせていただきます。",
    ko: "피드백을 공유해 주셔서 감사합니다! 앱 개선을 위해 소중히 활용하겠습니다.",
    it: "Grazie per aver dedicato del tempo a condividere la tua opinione! Lo apprezziamo molto.",
    nl: "Bedankt voor het nemen van de tijd om je feedback te delen! We waarderen het zeer.",
    pl: "Dziękujemy za poświęcenie czasu na podzielenie się swoją opinią! Bardzo to doceniamy.",
    sv: "Tack för att du tog dig tid att dela din feedback! Vi uppskattar det verkligen.",
    no: "Takk for at du tok deg tid til å dele tilbakemeldingen din! Vi setter stor pris på det.",
    da: "Tak fordi du tog dig tid til at dele din feedback! Vi sætter stor pris på det.",
    fi: "Kiitos, että käytit aikaa palautteesi jakamiseen! Arvostamme sitä suuresti.",
    el: "Ευχαριστούμε που αφιερώσατε χρόνο για να μοιραστείτε τα σχόλιά σας! Το εκτιμούμε πολύ.",
    cs: "Děkujeme, že jste si vzali čas a podělili se o svou zpětnou vazbu! Velmi si toho vážíme.",
    hu: "Köszönjük, hogy időt szánt visszajelzése megosztására! Nagyra értékeljük.",
    ro: "Mulțumim că ați luat timp să împărtășiți feedback-ul dvs.! Apreciem foarte mult.",
    th: "ขอบคุณที่สละเวลาแบ่งปันคำติชมของคุณ! เราซาบซึ้งใจมากและจะนำไปใช้เพื่อปรับปรุงแอปของเรา",
    vi: "Cảm ơn bạn đã dành thời gian chia sẻ phản hồi! Chúng tôi rất trân trọng điều này.",
    id: "Terima kasih telah meluangkan waktu untuk berbagi masukan Anda! Kami sangat menghargainya.",
    ms: "Terima kasih kerana meluangkan masa untuk berkongsi maklum balas anda! Kami sangat menghargainya.",
    bn: "আপনার মতামত শেয়ার করতে সময় নেওয়ার জন্য ধন্যবাদ! আমরা এটি অত্যন্ত প্রশংসা করি।",
    fa: "ممنون که وقت گذاشتید و بازخورد خود را با ما در میان گذاشتید! ما قدردان هستیم.",
    uk: "Дякуємо, що знайшли час поділитися своїм відгуком! Ми дуже цінуємо це.",
    he: "תודה שלקחת את הזמן לשתף את המשוב שלך! אנו מעריכים זאת מאוד.",
    sr: "Hvala što ste odvojili vreme da podelite svoje mišljenje! Veoma to cenimo.",
    hr: "Hvala što ste odvojili vrijeme za dijeljenje povratne informacije! Vrlo to cijenimo.",
    sk: "Ďakujeme, že ste si vzali čas a podelili sa o svoju spätnú väzbu! Veľmi si to vážime.",
    bg: "Благодарим, че отделихте време да споделите своя отзив! Много го ценим.",
    lt: "Ačiū, kad skyrėte laiko pasidalyti savo atsiliepimu! Labai tai vertiname.",
    lv: "Paldies, ka veltījāt laiku, lai dalītos ar savu atsauksmi! Mēs to ļoti novērtējam.",
    sl: "Hvala, da ste si vzeli čas in delili svoje povratne informacije! To zelo cenimo.",
    az: "Rəyinizi bölüşmək üçün vaxt ayırdığınız üçün təşəkkür edirik! Bunu çox qiymətləndiririk.",
    kk: "Пікіріңізді бөлісуге уақыт бөлгеніңіз үшін рахмет! Біз мұны өте бағалаймыз.",
    uz: "Fikr-mulohazangizni ulashish uchun vaqt ajratganingiz uchun rahmat! Buni juda qadrlaymiz.",
    sw: "Asante kwa kuchukua muda kushiriki maoni yako! Tunashukuru sana.",
    am: "አስተያየትዎን ለማጋራት ጊዜ ስለወሰዱ እናመሰግናለን! ይህን በጣም እናደንቃለን።",
    af: "Dankie dat jy tyd geneem het om jou terugvoer te deel! Ons waardeer dit baie.",
    sq: "Faleminderit që morët kohë të ndani reagimin tuaj! E vlerësojmë shumë.",
    mk: "Благодариме што одвоивте време да го споделите вашиот фидбек! Многу го цениме.",
    mn: "Санал хүсэлтээ хуваалцахад цаг зарцуулсанд баярлалаа! Бид үүнийг маш их үнэлж байна.",
    my: "သင်၏အကြံပြုချက်ကို မျှဝေရန် အချိန်ပေးသည့်အတွက် ကျေးဇူးတင်ပါသည်။",
    km: "សូមអរគុណដែលបានចំណាយពេលចែករំលែកមតិប្រតិកម្មរបស់អ្នក!",
    ne: "तपाईंको प्रतिक्रिया साझा गर्न समय निकाल्नुभएकोमा धन्यवाद! हामी यसलाई धेरै महत्त्व दिन्छौं।",
    si: "ඔබේ ප්‍රතිපෝෂණය බෙදාගැනීමට කාලය ගත් බව ස්තූතියි! අපි ඒ ගැන ඉතා කෘතඥ වෙමු.",
    ta: "உங்கள் கருத்தை பகிர்ந்துகொள்ள நேரம் எடுத்தமைக்கு நன்றி! நாங்கள் இதை மிகவும் மதிக்கிறோம்.",
  },
  "We're working on it": {
    es: "Gracias por reportar esto. Nuestro equipo está investigando el problema y te informaremos en cuanto tengamos novedades.",
    fr: "Merci pour votre signalement. Notre équipe est en train d'examiner le problème et vous tiendra informé dès que possible.",
    de: "Danke für Ihre Meldung! Unser Team untersucht das Problem und wird Sie so bald wie möglich informieren.",
    ar: "شكراً على الإبلاغ! فريقنا يحقق في المشكلة حالياً وسنُعلمك بالتحديثات قريباً.",
    ur: "رپورٹ کرنے کا شکریہ! ہماری ٹیم اس مسئلے کی تحقیق کر رہی ہے اور آپ کو جلد آگاہ کریں گے۔",
    zh: "感谢您的报告！我们的团队目前正在调查此问题，我们会尽快向您提供最新进展。",
    hi: "रिपोर्ट करने के लिए धन्यवाद! हमारी टीम वर्तमान में समस्या की जांच कर रही है।",
    pt: "Obrigado por relatar isso! Nossa equipe está investigando o problema atualmente e em breve teremos uma atualização.",
    tr: "Bildirdiğiniz için teşekkürler! Ekibimiz şu anda sorunu araştırıyor ve yakında size bir güncelleme sunacağız.",
    ru: "Спасибо за сообщение! Наша команда в настоящее время расследует проблему и скоро сообщит вам об обновлениях.",
    ja: "ご報告ありがとうございます！現在チームが問題を調査中です。近日中にアップデートをお知らせします。",
    ko: "신고해 주셔서 감사합니다! 현재 팀에서 문제를 조사 중이며, 곧 업데이트를 알려드리겠습니다.",
    it: "Grazie per la segnalazione! Il nostro team sta attualmente investigando il problema e ti aggiorneremo al più presto.",
    nl: "Bedankt voor de melding! Ons team onderzoekt het probleem momenteel en we laten je zo snel mogelijk weten.",
    pl: "Dziękujemy za zgłoszenie! Nasz zespół aktualnie bada ten problem i wkrótce poinformujemy Cię o postępach.",
    sv: "Tack för att du rapporterade detta! Vårt team undersöker problemet för närvarande.",
    no: "Takk for at du rapporterte dette! Teamet vårt undersøker problemet for øyeblikket.",
    da: "Tak for at du rapporterede dette! Vores team undersøger i øjeblikket problemet.",
    fi: "Kiitos ilmoittamisesta! Tiimimme tutkii tällä hetkellä ongelmaa ja saat pian päivityksen.",
    el: "Ευχαριστούμε για την αναφορά! Η ομάδα μας διερευνά αυτήν τη στιγμή το πρόβλημα.",
    cs: "Děkujeme za nahlášení! Náš tým právě zkoumá problém a brzy vám poskytneme aktualizaci.",
    hu: "Köszönjük a bejelentést! Csapatunk jelenleg vizsgálja a problémát, és hamarosan frissítést küldünk.",
    ro: "Mulțumim pentru raportare! Echipa noastră investighează în prezent problema și în curând veți primi o actualizare.",
    th: "ขอบคุณที่รายงาน! ทีมของเรากำลังตรวจสอบปัญหาอยู่และจะมีการอัปเดตให้คุณเร็วๆ นี้",
    vi: "Cảm ơn bạn đã báo cáo! Nhóm của chúng tôi hiện đang điều tra vấn đề.",
    id: "Terima kasih telah melaporkan! Tim kami sedang menyelidiki masalah ini.",
    ms: "Terima kasih kerana melaporkan! Pasukan kami sedang menyiasat masalah ini.",
    bn: "রিপোর্ট করার জন্য ধন্যবাদ! আমাদের দল বর্তমানে সমস্যাটি তদন্ত করছে।",
    fa: "ممنون از گزارش شما! تیم ما در حال حاضر در حال بررسی مشکل است.",
    uk: "Дякуємо за повідомлення! Наша команда наразі розслідує проблему.",
    he: "תודה על הדיווח! הצוות שלנו חוקר כרגע את הבעיה ונעדכן אותך בקרוב.",
    sr: "Hvala na prijavi! Naš tim trenutno istražuje problem i uskoro ćemo vas obavestiti.",
    hr: "Hvala na prijavi! Naš tim trenutno istražuje problem i uskoro ćemo vas obavijestiti.",
    sk: "Ďakujeme za nahlásenie! Náš tým práve skúma problém a čoskoro vám poskytneme aktualizáciu.",
    bg: "Благодарим за докладването! Нашият екип в момента разследва проблема.",
    lt: "Ačiū už pranešimą! Mūsų komanda šiuo metu tiria problemą.",
    lv: "Paldies par ziņojumu! Mūsų komanda šobrīd izmeklē problēmu.",
    sl: "Hvala za prijavo! Naša ekipa trenutno preiskuje težavo.",
    az: "Bildirdiyiniz üçün təşəkkür edirik! Komandamız hazırda problemi araşdırır.",
    kk: "Хабарлағаныңыз үшін рахмет! Біздің команда қазір мәселені зерттеуде.",
    uz: "Xabar berganing uchun rahmat! Jamoamiz hozirda muammoni tekshirmoqda.",
    sw: "Asante kwa kuripoti! Timu yetu inachunguza tatizo kwa sasa.",
    am: "ስለሪፖርት ማድረግዎ እናመሰግናለን! ቡድናችን በአሁኑ ጊዜ ችግሩን እየመረመረ ሲሆን በቅርቡ እናሳውቅዎታለን።",
    af: "Dankie vir die rapportering! Ons span ondersoek tans die probleem.",
    sq: "Faleminderit për raportimin! Ekipi ynë po heton aktualisht problemin.",
    mk: "Благодариме за пријавувањето! Нашиот тим моментално го истражува проблемот.",
    mn: "Мэдэгдсэнд баярлалаа! Манай баг одоогоор асуудлыг шалгаж байна.",
    my: "အစီရင်ခံသည့်အတွက် ကျေးဇူးတင်ပါသည်။ ကျွန်ုပ်တို့အဖွဲ့သည် ယခု ပြဿနာကို စုံစမ်းနေပါသည်။",
    km: "សូមអរគុណដែលបានរាយការណ៍! ក្រុមរបស់យើងកំពុងស្វែងរកបញ្ហា។",
    ne: "रिपोर्ट गर्नुभएकोमा धन्यवाद! हाम्रो टोली हाल समस्या अनुसन्धान गर्दैछ।",
    si: "වාර්තා කිරීම ගැන ස්තූතියි! අපේ කණ්ඩායම දැනට ගැටලුව විමර්ශනය කරමින් සිටී.",
    ta: "புகாரளித்தமைக்கு நன்றி! எங்கள் குழு தற்போது சிக்கலை ஆராய்கிறது.",
  },
  "Issue resolved – please update": {
    es: "¡Buenas noticias! Este problema ha sido resuelto en la última actualización. Por favor actualiza la aplicación.",
    fr: "Bonne nouvelle ! Ce problème a été corrigé dans notre dernière mise à jour. Veuillez mettre à jour l'application.",
    de: "Gute Neuigkeiten! Dieses Problem wurde im letzten Update behoben. Bitte aktualisieren Sie die App.",
    ar: "أخبار رائعة! تم حل هذه المشكلة في آخر تحديث. يرجى تحديث التطبيق.",
    ur: "خوشخبری! یہ مسئلہ ہماری تازہ ترین اپڈیٹ میں حل کر دیا گیا ہے۔ براہ کرم ایپ اپڈیٹ کریں۔",
    zh: "好消息！此问题已在我们的最新更新中解决。请将应用更新到最新版本。",
    hi: "अच्छी खबर! यह समस्या हमारे नवीनतम अपडेट में हल हो गई है। कृपया ऐप को अपडेट करें।",
    pt: "Ótimas notícias! Este problema foi resolvido em nossa última atualização. Por favor, atualize o aplicativo.",
    tr: "Harika haberler! Bu sorun en son güncellememizde çözüldü. Lütfen uygulamayı güncelleyin.",
    ru: "Отличные новости! Эта проблема была решена в нашем последнем обновлении. Пожалуйста, обновите приложение.",
    ja: "お知らせです！この問題は最新のアップデートで解決されました。アプリを最新バージョンに更新してください。",
    ko: "좋은 소식입니다! 이 문제는 최신 업데이트에서 해결되었습니다. 앱을 최신 버전으로 업데이트해 주세요.",
    it: "Ottime notizie! Questo problema è stato risolto nell'ultimo aggiornamento. Aggiorna l'app.",
    nl: "Goed nieuws! Dit probleem is opgelost in onze laatste update. Update de app naar de nieuwste versie.",
    pl: "Świetne wieści! Ten problem został rozwiązany w naszej najnowszej aktualizacji. Zaktualizuj aplikację.",
    sv: "Goda nyheter! Detta problem har lösts i vår senaste uppdatering. Uppdatera appen.",
    no: "Gode nyheter! Dette problemet er løst i vår siste oppdatering. Oppdater appen.",
    da: "Gode nyheder! Dette problem er løst i vores seneste opdatering. Opdater appen.",
    fi: "Hyviä uutisia! Tämä ongelma on ratkaistu viimeisimmässä päivityksessämme. Päivitä sovellus.",
    el: "Χαρούμενα νέα! Αυτό το πρόβλημα έχει επιλυθεί στην τελευταία μας ενημέρωση. Ενημερώστε την εφαρμογή.",
    cs: "Skvělé zprávy! Tento problém byl vyřešen v naší nejnovější aktualizaci. Aktualizujte aplikaci.",
    hu: "Nagyszerű hír! Ezt a problémát legújabb frissítésünkben megoldottuk. Frissítse az alkalmazást.",
    ro: "Vești bune! Această problemă a fost rezolvată în cea mai recentă actualizare. Actualizați aplicația.",
    th: "ข่าวดี! ปัญหานี้ได้รับการแก้ไขในการอัปเดตล่าสุดของเรา กรุณาอัปเดตแอป",
    vi: "Tin vui! Vấn đề này đã được giải quyết trong bản cập nhật mới nhất. Vui lòng cập nhật ứng dụng.",
    id: "Kabar baik! Masalah ini telah diselesaikan dalam pembaruan terbaru kami. Perbarui aplikasi.",
    ms: "Berita baik! Masalah ini telah diselesaikan dalam kemas kini terbaru kami. Kemas kini aplikasi.",
    bn: "সুখবর! এই সমস্যাটি আমাদের সর্বশেষ আপডেটে সমাধান করা হয়েছে। অ্যাপটি আপডেট করুন।",
    fa: "خبر خوب! این مشکل در آخرین بروزرسانی ما برطرف شده است. لطفاً اپلیکیشن را بروزرسانی کنید.",
    uk: "Чудові новини! Цю проблему було вирішено в нашому останньому оновленні. Оновіть додаток.",
    he: "חדשות טובות! בעיה זו נפתרה בעדכון האחרון שלנו. אנא עדכן את האפליקציה.",
    sr: "Sjajne vesti! Ovaj problem je rešen u našem poslednjem ažuriranju. Ažurirajte aplikaciju.",
    hr: "Sjajne vijesti! Ovaj problem je riješen u našem posljednjem ažuriranju. Ažurirajte aplikaciju.",
    sk: "Skvelé správy! Tento problém bol vyriešený v našej najnovšej aktualizácii. Aktualizujte aplikáciu.",
    bg: "Страхотни новини! Този проблем беше решен в последната ни актуализация. Актуализирайте приложението.",
    lt: "Puikios naujienos! Ši problema buvo išspręsta mūsų naujausiniame atnaujinime. Atnaujinkite programėlę.",
    lv: "Lieliskas ziņas! Šī problēma tika atrisināta mūsų jaunākajā atjauninājumā. Atjauniniet lietotni.",
    sl: "Odlične novice! Ta težava je bila rešena v naši zadnji posodobitvi. Posodobite aplikacijo.",
    az: "Əla xəbər! Bu problem son yeniləməmizdə həll edilib. Tətbiqi son versiyaya yeniləyin.",
    kk: "Тамаша жаңалық! Бұл мәселе біздің соңғы жаңартуымызда шешілді. Қолданбаны жаңартыңыз.",
    uz: "Ajoyib yangilik! Bu muammo bizning so'nggi yangilashimizda hal qilindi. Ilovani yangilang.",
    sw: "Habari njema! Tatizo hili limetatuliwa katika sasisho letu la hivi karibuni. Sasisha programu.",
    am: "ምሥራች! ይህ ችግር በቅርቡ ባወጣነው ዝማኔ ተፈቷል። እባክዎ መተግበሪያውን ያዘምኑ።",
    af: "Goeie nuus! Hierdie probleem is in ons nuutste opdatering opgelos. Dateer die app op.",
    sq: "Lajme të mira! Ky problem u zgjidh në përditësimin tonë të fundit. Përditësoni aplikacionin.",
    mk: "Одлични вести! Овој проблем беше решен во нашето последно ажурирање. Ажурирајте ја апликацијата.",
    mn: "Тамаша мэдээ! Энэ асуудал манай сүүлийн шинэчлэлтэд шийдэгдсэн. Апп-аа шинэчилнэ үү.",
    my: "သတင်းကောင်း! ဤပြဿနာကို ကျွန်ုပ်တို့၏ နောက်ဆုံးအပ်ဒိတ်တွင် ဖြေရှင်းပြီးဖြစ်သည်။ App ကို အပ်ဒိတ်လုပ်ပါ။",
    km: "ព័ត៌មានល្អ! បញ្ហានេះត្រូវបានដោះស្រាយ។ សូមអាប់ដេតកម្មវិធី។",
    ne: "राम्रो खबर! यो समस्या हाम्रो नवीनतम अपडेटमा समाधान भएको छ। एपलाई अपडेट गर्नुहोस्।",
    si: "සුභ ආරංචිය! ගැටලුව නවතම යාවත්කාලීනයේදී විසඳා ඇත. යෙදුම යාවත්කාලීන කරන්න.",
    ta: "நற்செய்தி! இந்த சிக்கல் எங்கள் சமீபத்திய புதுப்பிப்பில் தீர்க்கப்பட்டது. செயலியை புதுப்பிக்கவும்.",
  },
};

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@feedback.app";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) { console.error(`Admin not found: ${adminEmail}`); process.exit(1); }

  let updated = 0;
  // Fix existing locale replies: set title to English, update body to locale body
  const localeReplies = await prisma.cannedReply.findMany({
    where: { ownerId: admin.id, locale: { not: null } },
  });

  for (const reply of localeReplies) {
    const locale = reply.locale!;
    // Find matching English title by checking all title mappings
    for (const [engTitle, localeMap] of Object.entries(titleBodyMap)) {
      const localeBody = localeMap[locale];
      if (localeBody && (reply.title !== engTitle || reply.body !== localeBody)) {
        // Check if this reply's body roughly matches this locale's body (first 20 chars)
        if (reply.body.slice(0, 15) === localeBody.slice(0, 15) || reply.title === Object.keys(titleBodyMap).find(t => titleBodyMap[t][locale]?.slice(0,15) === reply.body.slice(0,15))) {
          await prisma.cannedReply.update({
            where: { id: reply.id },
            data: { title: engTitle, body: localeBody },
          });
          updated++;
          break;
        }
      }
    }
  }

  console.log(`Updated ${updated} existing locale replies to use English titles`);

  // Add missing locale replies with English titles
  const existingLocales = await prisma.cannedReply.findMany({
    where: { ownerId: admin.id, locale: { not: null } },
    select: { locale: true },
    distinct: ["locale"],
  });
  const existing = new Set(existingLocales.map(r => r.locale));

  const allLocales = Object.keys(Object.values(titleBodyMap)[0]);
  let added = 0;
  for (const locale of allLocales) {
    if (!existing.has(locale)) {
      for (const [engTitle, localeMap] of Object.entries(titleBodyMap)) {
        if (localeMap[locale]) {
          const tag = engTitle.includes("working") ? "triage" : engTitle.includes("resolved") ? "support" : "feedback";
          await prisma.cannedReply.create({
            data: { ownerId: admin.id, title: engTitle, body: localeMap[locale], shared: true, tag, locale },
          });
          added++;
        }
      }
    }
  }
  console.log(`Added ${added} new locale replies`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
