import type { Lang } from "@/lib/store/catalog";

export type PageBlock =
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: { title: string; text: string }[] }
  | { type: "closing"; text: string };

export type PageContent = { kicker: string; title: string; blocks: PageBlock[] };

export const STORY: Record<Lang, PageContent> = {
  en: {
    kicker: "Our story",
    title: "Beyond the Screen",
    blocks: [
      {
        type: "p",
        text: "In a fast-paced world driven by technology and constant noise, true wisdom lies in clarity, precision, and purpose. OWL was created with a simple yet powerful vision: to bridge the gap between complex digital solutions and effortless user experiences.",
      },
      { type: "h", text: "Inspired by Nature, Driven by Innovation" },
      {
        type: "p",
        text: "Just like the owl—a timeless symbol of intelligence, sharp focus, and vision in the dark—our brand is built on deep insights and forward-thinking craftsmanship. Whether crafting seamless code, building intuitive platforms, or curating modern products, we look at the bigger picture without missing a single detail.",
      },
      { type: "h", text: "Our Mission" },
      {
        type: "p",
        text: "At OWL, we don't just build or sell—we empower. We exist to deliver refined quality, smart functionality, and modern aesthetics to tech-savvy individuals and businesses who value excellence.",
      },
      { type: "h", text: "The OWL Promise" },
      {
        type: "list",
        items: [
          { title: "Wisdom in Design", text: "Simple, clean, and intuitive solutions." },
          { title: "Precision in Execution", text: "Built to last, engineered to perform." },
          { title: "Vision for the Future", text: "Always one step ahead, illuminating new possibilities." },
        ],
      },
      { type: "closing", text: "OWL: Wisdom in Every Detail. Vision in Every Innovation." },
    ],
  },
  ar: {
    kicker: "قصتنا",
    title: "ما وراء الشاشة",
    blocks: [
      {
        type: "p",
        text: "في عالم سريع تحرّكه التكنولوجيا والضجيج المستمر، تكمن الحكمة الحقيقية في الوضوح والدقة والهدف. وُلد OWL من رؤية بسيطة وقوية: سدّ الفجوة بين الحلول الرقمية المعقدة وتجربة استخدام سلسة بلا عناء.",
      },
      { type: "h", text: "مستوحاة من الطبيعة، مدفوعة بالابتكار" },
      {
        type: "p",
        text: "مثل البومة — الرمز الخالد للذكاء والتركيز الحاد والرؤية في الظلام — بُنيت علامتنا على رؤى عميقة وحرفية تنظر إلى المستقبل. سواء كنا نكتب شيفرة سلسة، أو نبني منصات بديهية، أو ننتقي منتجات عصرية، فنحن ننظر إلى الصورة الكبيرة دون أن تفوتنا أي تفصيلة.",
      },
      { type: "h", text: "مهمتنا" },
      {
        type: "p",
        text: "في OWL نحن لا نبني أو نبيع فقط — نحن نُمكّن. نوجد لنقدّم جودة راقية ووظائف ذكية وجماليات عصرية للأفراد والشركات المحبّين للتقنية ممن يقدّرون التميّز.",
      },
      { type: "h", text: "وعد OWL" },
      {
        type: "list",
        items: [
          { title: "الحكمة في التصميم", text: "حلول بسيطة ونظيفة وبديهية." },
          { title: "الدقة في التنفيذ", text: "مصنوعة لتدوم، ومهندسة لتؤدي." },
          { title: "رؤية للمستقبل", text: "دائماً بخطوة إلى الأمام، نضيء إمكانيات جديدة." },
        ],
      },
      { type: "closing", text: "OWL: الحكمة في كل تفصيلة. الرؤية في كل ابتكار." },
    ],
  },
};

export const PRIVACY: Record<Lang, PageContent> = {
  en: {
    kicker: "Policies",
    title: "OWL Privacy Policy",
    blocks: [
      {
        type: "p",
        text: "At OWL, we are committed to protecting your privacy and ensuring your personal data is handled safely.",
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
    title: "سياسة الخصوصية في OWL",
    blocks: [
      {
        type: "p",
        text: "في OWL نلتزم بحماية خصوصيتك والتأكد من التعامل مع بياناتك الشخصية بأمان.",
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
