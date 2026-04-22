import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@feedback.app";

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`Admin user not found: ${adminEmail}`);
    process.exit(1);
  }

  const existing = await prisma.cannedReply.count({ where: { ownerId: admin.id } });
  if (existing > 0) {
    console.log(`Skipping — ${existing} canned replies already exist for ${adminEmail}`);
    return;
  }

  const cannedReplies = [
    { title: "Thank you for your feedback", body: "Thank you for taking the time to share your feedback! We really appreciate it and will use it to improve our app.", tag: "feedback", locale: null },
    { title: "We're working on it", body: "Thanks for reporting this! Our team is currently investigating the issue and we'll have an update for you soon.", tag: "triage", locale: null },
    { title: "Issue resolved – please update", body: "Great news! This issue has been resolved in our latest update. Please update the app to the newest version and let us know if the problem persists.", tag: "support", locale: null },
    { title: "Need more details", body: "Thank you for reaching out. To help us investigate further, could you please share your device model, OS version, and app version? Any additional steps to reproduce the issue would also be helpful.", tag: "triage", locale: null },
    { title: "Feature noted for roadmap", body: "Thanks for the suggestion! We've added this to our feature roadmap and will consider it in an upcoming release. Stay tuned for updates!", tag: "feedback", locale: null },
    { title: "Sorry for the inconvenience", body: "We sincerely apologize for the trouble you've experienced. Our team is working hard to make sure this doesn't happen again. Thank you for your patience.", tag: "support", locale: null },
    { title: "Try clearing app cache", body: "Please try clearing the app cache (Settings → Apps → [App name] → Clear Cache) and restart the app. This resolves many common issues. Let us know if it helps!", tag: "support", locale: null },
    { title: "Closing – issue resolved", body: "We're glad to hear the issue has been resolved! We're closing this ticket for now. Please don't hesitate to reach out if you run into anything else.", tag: "support", locale: null },
    { title: "Welcome! How can we help?", body: "Hi there! Welcome and thank you for contacting us. We're here to help — please describe your issue and we'll get back to you as soon as possible.", tag: "support", locale: "en" },
    { title: "5-star feedback – thank you!", body: "Wow, thank you so much for the 5-star review! We're thrilled you're enjoying the app. Your support means a lot to us!", tag: "feedback", locale: "en" },
    { title: "Low rating – we want to improve", body: "Thank you for your honest feedback. We're sorry the app hasn't met your expectations. Could you tell us more about what went wrong so we can improve?", tag: "feedback", locale: "en" },
    { title: "Gracias por tu feedback", body: "¡Gracias por tomarte el tiempo de compartir tu opinión! Lo tendremos muy en cuenta para mejorar la aplicación.", tag: "feedback", locale: "es" },
    { title: "Estamos investigando el problema", body: "Gracias por reportar esto. Nuestro equipo está investigando el problema y te informaremos en cuanto tengamos novedades.", tag: "triage", locale: "es" },
    { title: "Problema resuelto – actualiza la app", body: "¡Buenas noticias! Este problema ha sido resuelto en la última actualización. Por favor actualiza la aplicación y cuéntanos si el problema persiste.", tag: "support", locale: "es" },
    { title: "Merci pour votre retour", body: "Merci de prendre le temps de partager votre avis ! Nous en tiendrons compte pour améliorer notre application.", tag: "feedback", locale: "fr" },
    { title: "Nous travaillons sur le problème", body: "Merci pour votre signalement. Notre équipe est en train d'examiner le problème et vous tiendra informé dès que possible.", tag: "triage", locale: "fr" },
    { title: "Problème résolu – mettez à jour l'app", body: "Bonne nouvelle ! Ce problème a été corrigé dans notre dernière mise à jour. Veuillez mettre à jour l'application et n'hésitez pas à nous contacter si le problème persiste.", tag: "support", locale: "fr" },
    { title: "Danke für Ihr Feedback", body: "Vielen Dank, dass Sie sich die Zeit genommen haben, uns Ihr Feedback mitzuteilen! Wir werden es nutzen, um unsere App weiter zu verbessern.", tag: "feedback", locale: "de" },
    { title: "Wir arbeiten daran", body: "Danke für Ihre Meldung! Unser Team untersucht das Problem und wird Sie so bald wie möglich informieren.", tag: "triage", locale: "de" },
    { title: "Problem behoben – bitte aktualisieren", body: "Gute Neuigkeiten! Dieses Problem wurde im letzten Update behoben. Bitte aktualisieren Sie die App und lassen Sie uns wissen, ob das Problem weiterhin besteht.", tag: "support", locale: "de" },
    { title: "شكراً على ملاحظاتك", body: "شكراً لك على تخصيص وقتك لمشاركة ملاحظاتك! نقدر ذلك كثيراً وسنستخدمه لتحسين تطبيقنا.", tag: "feedback", locale: "ar" },
    { title: "نعمل على حل المشكلة", body: "شكراً على الإبلاغ! فريقنا يحقق في المشكلة حالياً وسنُعلمك بالتحديثات قريباً.", tag: "triage", locale: "ar" },
    { title: "تم حل المشكلة – يرجى التحديث", body: "أخبار رائعة! تم حل هذه المشكلة في آخر تحديث. يرجى تحديث التطبيق وإخبارنا إذا استمرت المشكلة.", tag: "support", locale: "ar" },
    { title: "آپ کے فیڈ بیک کا شکریہ", body: "اپنا قیمتی فیڈ بیک شیئر کرنے کے لیے آپ کا بہت شکریہ! ہم اسے اپنی ایپ بہتر بنانے کے لیے استعمال کریں گے۔", tag: "feedback", locale: "ur" },
    { title: "ہم مسئلے پر کام کر رہے ہیں", body: "رپورٹ کرنے کا شکریہ! ہماری ٹیم اس مسئلے کی تحقیق کر رہی ہے اور آپ کو جلد آگاہ کریں گے۔", tag: "triage", locale: "ur" },
    { title: "مسئلہ حل ہو گیا – ایپ اپڈیٹ کریں", body: "خوشخبری! یہ مسئلہ ہماری تازہ ترین اپڈیٹ میں حل کر دیا گیا ہے۔ براہ کرم ایپ اپڈیٹ کریں اور ہمیں بتائیں کہ آیا مسئلہ برقرار ہے۔", tag: "support", locale: "ur" },
  ];

  for (const cr of cannedReplies) {
    await prisma.cannedReply.create({
      data: { ownerId: admin.id, title: cr.title, body: cr.body, shared: true, tag: cr.tag, locale: cr.locale },
    });
  }

  console.log(`Created ${cannedReplies.length} default canned replies for ${adminEmail}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
