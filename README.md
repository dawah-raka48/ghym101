# نظام إيرادات مركز غيم

واجهة عربية RTL متوافقة مع الجوال والكمبيوتر، تعمل عبر GitHub Pages مع Google Sheets وGoogle Apps Script.

## الملفات
- index.html وstyle.css وapp.js: تسجيل الدخول ولوحات المدير والموظف.
- display.html: شاشة إجماليات للعرض فقط.
- Code.gs: كود الخادم والصلاحيات.

## إعداد قاعدة البيانات
1. أنشئ Google Sheet جديدًا.
2. من Extensions ثم Apps Script، انسخ محتوى Code.gs إلى محرر Apps Script.
3. شغّل setup() مرة واحدة ووافق على الصلاحيات.
4. شغّل setupAdmin() لإنشاء حساب المدير بكلمة مرور قوية لا تقل عن 12 حرفًا.
5. اضبط المنطقة الزمنية إلى Asia/Riyadh.

## نشر API
1. اختر Deploy ثم New deployment ثم Web app.
2. اختر Execute as: Me، واضبط الوصول حسب سياسة حساب Google/Workspace. لا تجعل جدول البيانات عامًا.
3. انسخ رابط النشر المنتهي بـ /exec.
4. ضع الرابط في متغير API_URL داخل app.js وdisplay.html، ثم احفظ التغييرات في GitHub.

## رابط شاشة العرض الخاصة
1. افتح ورقة Settings في Google Sheet وانسخ قيمة DISPLAY_KEY.
2. رابط الشاشة هو https://dawah-raka48.github.io/ghym101/display.html?key=DISPLAY_KEY_VALUE، مع استبدال القيمة بالمفتاح الفعلي.
3. لا تضع المفتاح في ملفات GitHub. الرابط الخاص يعرض الإجماليات فقط؛ شاركه مع شاشة المركز فقط. يمكن تغيير المفتاح من ورقة Settings.

## نشر GitHub Pages
من Settings ثم Pages، اختر Deploy from a branch، الفرع main والمجلد /(root). بعد النشر يكون الرابط عادةً https://dawah-raka48.github.io/ghym101/.

## ملاحظات
- هذا إصدار أولي؛ لم يتم اختباره بعد على حساب Google الخاص بك، ويلزم إعداد Apps Script وGoogle Sheet قبل الاستخدام الحقيقي.
- حقل PDF يقبل رابط Google Drive؛ رفع الملف من داخل التطبيق غير مفعّل بعد.
- لكل موظف تقرير واحد يوميًا. لتصحيح خطأ، يحذف المدير التقرير ثم يعاد إدخاله. الحذف مسجل في سجل التدقيق.
- الإيراد يظهر في الإجماليات فور الحفظ ولا توجد خطوة اعتماد مسبق.
- لا تضع كلمات مرور أو مفاتيح خاصة في GitHub.
