
-- Enums
DO $$ BEGIN
  CREATE TYPE public.concierge_task_status AS ENUM ('pending','assigned','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.concierge_task_category AS ENUM (
    'restaurant_reservation',
    'scenic_tickets',
    'virtual_queue',
    'trip_planning',
    'hospital_booking',
    'chinese_number_required',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.concierge_message_sender AS ENUM ('user','assistant','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new app_role value
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'concierge_assistant'
  ) THEN
    -- create the type if missing
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
      CREATE TYPE public.app_role AS ENUM ('admin','moderator','user','concierge_assistant');
    ELSE
      ALTER TYPE public.app_role ADD VALUE 'concierge_assistant';
    END IF;
  END IF;
END $$;

-- user_roles table (idempotent)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Assistant profiles
CREATE TABLE public.assistant_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  languages text[] NOT NULL DEFAULT ARRAY['zh','en']::text[],
  city text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assistant_profiles TO authenticated;
GRANT ALL ON public.assistant_profiles TO service_role;
ALTER TABLE public.assistant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assistant profiles are readable by authenticated"
  ON public.assistant_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Assistants can update their own profile"
  ON public.assistant_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Concierge tasks
CREATE TABLE public.concierge_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category public.concierge_task_category NOT NULL DEFAULT 'other',
  summary text NOT NULL,
  details text,
  status public.concierge_task_status NOT NULL DEFAULT 'pending',
  price_cents integer NOT NULL DEFAULT 3000,
  currency text NOT NULL DEFAULT 'CNY',
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.concierge_tasks TO authenticated;
GRANT ALL ON public.concierge_tasks TO service_role;
ALTER TABLE public.concierge_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tasks"
  ON public.concierge_tasks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own tasks"
  ON public.concierge_tasks FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR assistant_id = auth.uid()
    OR (status = 'pending' AND assistant_id IS NULL AND public.has_role(auth.uid(), 'concierge_assistant'))
  );

CREATE POLICY "Users cancel own tasks"
  ON public.concierge_tasks FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Assistants update tasks they can see"
  ON public.concierge_tasks FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'concierge_assistant')
    AND (assistant_id = auth.uid() OR (status = 'pending' AND assistant_id IS NULL))
  )
  WITH CHECK (public.has_role(auth.uid(), 'concierge_assistant'));

CREATE INDEX idx_concierge_tasks_user ON public.concierge_tasks(user_id, created_at DESC);
CREATE INDEX idx_concierge_tasks_status ON public.concierge_tasks(status, created_at DESC);

-- Concierge messages
CREATE TABLE public.concierge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.concierge_tasks(id) ON DELETE CASCADE,
  sender public.concierge_message_sender NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.concierge_messages TO authenticated;
GRANT ALL ON public.concierge_messages TO service_role;
ALTER TABLE public.concierge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages"
  ON public.concierge_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.concierge_tasks t
      WHERE t.id = task_id
        AND (t.user_id = auth.uid() OR t.assistant_id = auth.uid())
    )
  );

CREATE POLICY "Participants send messages"
  ON public.concierge_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.concierge_tasks t
      WHERE t.id = task_id
        AND (t.user_id = auth.uid() OR t.assistant_id = auth.uid())
    )
  );

CREATE INDEX idx_concierge_messages_task ON public.concierge_messages(task_id, created_at);

-- updated_at triggers
CREATE TRIGGER trg_concierge_tasks_updated
BEFORE UPDATE ON public.concierge_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_assistant_profiles_updated
BEFORE UPDATE ON public.assistant_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.concierge_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.concierge_messages;
