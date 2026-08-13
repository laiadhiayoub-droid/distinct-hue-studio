
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text,
  email text,
  xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_study_date date,
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR leaderboard_opt_in = true);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  qtype text NOT NULL CHECK (qtype IN ('mcq','short','essay')),
  prompt text NOT NULL,
  choices jsonb,
  correct_answer text,
  explanation text,
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions readable by students" ON public.questions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject text NOT NULL,
  score numeric(4,2),
  total_questions integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  is_daily_challenge boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON public.quiz_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions ON DELETE SET NULL,
  answer text,
  is_correct boolean,
  ai_grade numeric(4,2),
  ai_feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own answers" ON public.quiz_answers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  storage_path text NOT NULL,
  subject text,
  mode text NOT NULL DEFAULT 'explain',
  extracted_text text,
  analysis text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own uploads" ON public.uploads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  code text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badges" ON public.user_badges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_messages TO authenticated;
GRANT ALL ON public.tutor_messages TO service_role;
ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tutor messages" ON public.tutor_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  challenge_date date NOT NULL DEFAULT current_date,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  xp_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_challenges TO authenticated;
GRANT ALL ON public.daily_challenges TO service_role;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own challenges" ON public.daily_challenges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own folder read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own folder delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO public.questions (subject, qtype, prompt, choices, correct_answer, explanation, difficulty) VALUES
('Arabic','mcq','ما هو الأسلوب البلاغي في قول الشاعر: "وإذا المنية أنشبت أظفارها"؟','["استعارة مكنية","تشبيه تمثيلي","كناية عن صفة","مجاز مرسل"]','استعارة مكنية','شبّه المنية بحيوان مفترس وحذف المشبه به وأبقى لازمة من لوازمه (الأظفار).','medium'),
('Arabic','mcq','النص الحجاجي يقوم أساسا على:','["السرد والوصف","الأطروحة والحجج","الحوار الداخلي","الصور الشعرية"]','الأطروحة والحجج','النمط الحجاجي يعرض أطروحة ويدعمها بحجج لإقناع المتلقي.','easy'),
('Arabic','essay','حلّل قضية الالتزام في الشعر الجزائري الحديث، مبرزا خصائصه الفنية وأمثلة من المقرر.',NULL,NULL,'يُنتظر مقدمة، عرض بحجج وشواهد، وخاتمة مع لغة سليمة.','hard'),
('Arabic','short','عرّف النمط التفسيري واذكر مؤشرين لغويين له.',NULL,'نمط يشرح ظاهرة أو فكرة؛ مؤشراته: أدوات التعليل، ضمير الغائب، الحاضر المطلق.',NULL,'easy'),
('Tamazight','mcq','Amyag "ečč" yebḍa ɣef:','["Tigawt n učči","Tigawt n tirra","Tigawt n uruḥ","Tigawt n usiwel"]','Tigawt n učči','Amyag ečč (manger) yezmer ad d-yefk tigawt n učči.','easy'),
('Tamazight','mcq','Deg tmaziɣt, "tamurt" tesɛa anamek n:','["Aman","Akal / tamurt","Adfel","Aḍu"]','Akal / tamurt','Tamurt = pays / terre.','easy'),
('Tamazight','essay','Aru aḍris wezzilen (10 n izirigen) ɣef azal n tutlayt tamaziɣt di tmetti tazzayrit.',NULL,NULL,'Ttwaseqdac tira tuɣdimt, tanfalit tacegrant, akked yisallen usdiden.','medium'),
('French','mcq','Dans "L''Étranger" de Camus, le personnage principal se nomme :','["Jean Tarrou","Meursault","Rieux","Grand"]','Meursault','Meursault est le narrateur de L''Étranger.','easy'),
('French','mcq','Quel connecteur exprime la concession ?','["donc","bien que","parce que","ainsi"]','bien que','"Bien que" introduit une subordonnée concessive (+ subjonctif).','medium'),
('French','short','Transformez au discours indirect : Il m''a dit : « Je viendrai demain. »',NULL,'Il m''a dit qu''il viendrait le lendemain.','Concordance des temps et changement des marqueurs temporels.','medium'),
('French','essay','Rédigez un texte argumentatif (20 lignes) : les réseaux sociaux aident-ils vraiment les lycéens à apprendre ?',NULL,NULL,'Thèse, arguments illustrés, connecteurs logiques, conclusion nuancée.','hard'),
('English','mcq','Choose the correct form: "By the time the exam started, she ___ for six hours."','["studied","has studied","had been studying","is studying"]','had been studying','Past perfect continuous for an action ongoing before a past moment.','medium'),
('English','mcq','Which word is closest in meaning to "mitigate"?','["worsen","reduce","ignore","expand"]','reduce','To mitigate is to make less severe.','easy'),
('English','short','Rewrite in the passive voice: "Scientists have discovered a new vaccine."',NULL,'A new vaccine has been discovered (by scientists).','Present perfect passive: has/have been + past participle.','easy'),
('English','essay','Write an argumentative essay (250 words): Should artificial intelligence be used in schools?',NULL,NULL,'Expect a clear thesis, two developed body paragraphs with examples, linking words, and a conclusion.','hard'),
('Philosophy','mcq','من القائل: "أنا أفكر، إذن أنا موجود"؟','["كانط","ديكارت","هيوم","برغسون"]','ديكارت','الكوجيتو الديكارتي أساس اليقين عند ديكارت.','easy'),
('Philosophy','mcq','الإشكالية الفلسفية تُطرح عادة في:','["الخاتمة","المقدمة","العرض","النقد"]','المقدمة','تُطرح الإشكالية في نهاية المقدمة على شكل سؤال.','easy'),
('Philosophy','essay','هل الحرية مطلقة أم مقيدة؟ عالج المشكلة بطريقة جدلية.',NULL,NULL,'مقدمة بطرح المشكلة، أطروحة، نقيض الأطروحة، تركيب، خاتمة برأي شخصي مدعّم.','hard'),
('History','mcq','في أي سنة اندلعت الثورة التحريرية الجزائرية؟','["1945","1954","1958","1962"]','1954','اندلعت الثورة في أول نوفمبر 1954.','easy'),
('History','mcq','مؤتمر الصومام انعقد سنة:','["1955","1956","1957","1960"]','1956','انعقد في 20 أوت 1956 ونظّم الثورة سياسيا وعسكريا.','medium'),
('History','essay','بيّن الأبعاد السياسية والعسكرية لمؤتمر الصومام وأثره في تنظيم الثورة الجزائرية.',NULL,NULL,'يُنتظر مقدمة، عناصر منظمة بالتواريخ والمصطلحات، وخلاصة.','hard'),
('Geography','mcq','يُقاس التطور الاقتصادي بمؤشر:','["السكان الحضريين","الناتج الداخلي الخام","المساحة الزراعية","عدد المدن"]','الناتج الداخلي الخام','PIB مؤشر أساسي لقياس النشاط الاقتصادي.','easy'),
('Geography','mcq','منظمة الأوبك تهتم أساسا بـ:','["القمح","البترول","الفوسفات","الغابات"]','البترول','الأوبك منظمة الدول المصدرة للبترول.','easy'),
('Geography','essay','حلّل مقومات القوة الاقتصادية للولايات المتحدة الأمريكية وانعكاساتها العالمية.',NULL,NULL,'مقومات طبيعية وبشرية وتقنية مع أمثلة رقمية وخاتمة.','hard'),
('Islamic Studies','mcq','عدد أركان الإسلام:','["أربعة","خمسة","ستة","سبعة"]','خمسة','الشهادتان، الصلاة، الزكاة، الصوم، الحج.','easy'),
('Islamic Studies','mcq','مقاصد الشريعة الضرورية الخمسة تشمل حفظ:','["المال فقط","الدين والنفس والعقل والنسل والمال","اللغة والتاريخ","العادات"]','الدين والنفس والعقل والنسل والمال','هذه هي الكليات الخمس.','medium'),
('Islamic Studies','essay','اشرح مفهوم الوسطية في الإسلام مع الاستدلال بالقرآن والسنة وأثرها على سلوك الشباب.',NULL,NULL,'استدلال صحيح، تنظيم، ربط بالواقع.','hard'),
('Natural Sciences','mcq','مقر تركيب البروتين في الخلية هو:','["الميتوكوندري","الريبوزوم","النواة","جهاز غولجي"]','الريبوزوم','الترجمة تتم على مستوى الريبوزومات في الهيولى.','easy'),
('Natural Sciences','mcq','الأجسام المضادة تُفرز من طرف:','["اللمفاويات B الناسجة (البلازموسيت)","اللمفاويات T القاتلة","البلعميات","الكريات الحمراء"]','اللمفاويات B الناسجة (البلازموسيت)','البلازموسيت خلية متمايزة عن LB تفرز الأجسام المضادة.','medium'),
('Natural Sciences','short','اذكر مرحلتي التنفس الخلوي مع مقر كل مرحلة.',NULL,'التحلل السكري في الهيولى، وحلقة كريبس والفسفرة التأكسدية في الميتوكوندري.','فهم مراحل تحرير الطاقة.','medium'),
('Natural Sciences','essay','فسّر آلية الاستجابة المناعية النوعية ذات الوساطة الخلطية انطلاقا من دخول مستضد إلى العضوية.',NULL,NULL,'يُنتظر ذكر التعرف، الانتقاء اللمي، التكاثر، التمايز، إفراز الأجسام المضادة وتشكيل معقد مناعي.','hard'),
('Physics','mcq','وحدة شدة التيار الكهربائي في النظام الدولي:','["الفولط","الأمبير","الأوم","الواط"]','الأمبير','شدة التيار تُقاس بالأمبير (A).','easy'),
('Physics','mcq','في التحول النووي، طاقة الربط لكل نوية تعبر عن:','["كتلة النواة","استقرار النواة","شحنة النواة","حجم النواة"]','استقرار النواة','كلما زادت طاقة الربط لكل نوية زاد استقرار النواة.','medium'),
('Physics','short','اكتب العلاقة بين طاقة الفوتون وتردده، محددا الثابت المستعمل.',NULL,'E = h·ν حيث h ثابت بلانك (6.63×10⁻³⁴ J.s).','علاقة بلانك-أينشتاين.','easy'),
('Physics','essay','ادرس تطور التوتر بين طرفي مكثفة أثناء شحنها عبر ناقل أومي، مبرزا المعادلة التفاضلية وثابت الزمن.',NULL,NULL,'المعادلة التفاضلية، الحل، τ = RC، التفسير الفيزيائي.','hard'),
('Mathematics','mcq','نهاية الدالة f(x) = (2x² + 3x)/(x² - 1) عندما x → +∞ هي:','["0","1","2","+∞"]','2','نأخذ الحدود ذات الدرجة الأعلى: 2x²/x² = 2.','medium'),
('Mathematics','mcq','مشتق الدالة f(x) = ln(x²+1) هو:','["1/(x²+1)","2x/(x²+1)","2x ln(x²+1)","x/(x²+1)"]','2x/(x²+1)','مشتق ln(u) هو u''/u.','medium'),
('Mathematics','short','احسب تكامل الدالة f(x) = e^{2x} على المجال [0 ; 1].',NULL,'(e² - 1)/2','∫e^{2x}dx = e^{2x}/2.','medium'),
('Mathematics','essay','لتكن المتتالية (Un) معرفة بـ U0 = 1 و Un+1 = 0.5Un + 3. ادرس اتجاه تغيرها، بيّن أنها متقاربة واحسب نهايتها مع التبرير.',NULL,NULL,'استعمال متتالية مساعدة هندسية Vn = Un - 6، إثبات التقارب، النهاية 6.','hard');
