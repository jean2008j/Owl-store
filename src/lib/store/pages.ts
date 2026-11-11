import type { Lang } from "@/lib/store/catalog";

export type PageBlock =
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: { title: string; text: string }[] }
  | { type: "closing"; text: string };

export type PageContent = { kicker: string; title: string; blocks: PageBlock[] };

export const PRIVACY: Record<Lang, PageContent> = {
  en: {
    kicker: "Policies",
    title: "ATHAR & OWL Privacy Policy",
    blocks: [
      {
        type: "p",
        text: "At ATHAR & OWL, we are committed to protecting your privacy and ensuring your personal data is handled safely.",
      },
      {
        type: "list",
        items: [
          {
            title: "Information Collection",
            text: "We collect personal details provided during account creation, purchases, or support (e.g., name, email, phone number, and shipping address).",
          },
          {
            title: "Data Usage",
            text: "Your data is used strictly to process orders, enhance user experience, and provide updates regarding your services.",
          },
          {
            title: "Data Security",
            text: "We implement robust encryption and security measures to guard your information against unauthorized access.",
          },
          {
            title: "Third-Party Sharing",
            text: "We do not sell or lease your personal data. Information is shared only with trusted shipping and payment partners to complete your orders.",
          },
        ],
      },
    ],
  },
  ar: {
    kicker: "السياسات",
    title: "سياسة الخصوصية في ATHAR & OWL",
    blocks: [
      {
        type: "p",
        text: "في ATHAR & OWL نلتزم بحماية خصوصيتك والتأكد من التعامل مع بياناتك الشخصية بأمان.",
      },
      {
        type: "list",
        items: [
          {
            title: "جمع المعلومات",
            text: "نجمع البيانات الشخصية التي تقدّمها عند إنشاء الحساب أو الشراء أو طلب الدعم (مثل الاسم والبريد الإلكتروني ورقم الهاتف وعنوان الشحن).",
          },
          {
            title: "استخدام البيانات",
            text: "تُستخدم بياناتك حصراً لمعالجة الطلبات، وتحسين تجربة الاستخدام، وإرسال تحديثات تخص خدماتك.",
          },
          {
            title: "أمان البيانات",
            text: "نطبّق تشفيراً قوياً وإجراءات أمان متينة لحماية معلوماتك من أي وصول غير مصرّح به.",
          },
          {
            title: "المشاركة مع أطراف ثالثة",
            text: "لا نبيع بياناتك الشخصية ولا نؤجرها. تُشارك المعلومات فقط مع شركاء الشحن والدفع الموثوقين لإتمام طلباتك.",
          },
        ],
      },
    ],
  },
};
