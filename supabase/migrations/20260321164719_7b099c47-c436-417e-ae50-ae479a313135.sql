
-- Table for QA test cases
CREATE TABLE public.bot_qa_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'basic',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'ai_generated',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_qa_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage QA tests"
  ON public.bot_qa_tests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for QA test run results
CREATE TABLE public.bot_qa_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.bot_qa_tests(id) ON DELETE CASCADE,
  run_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  steps_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text
);

ALTER TABLE public.bot_qa_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage QA results"
  ON public.bot_qa_results FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
