import { AppLayout } from "@/components/AppLayout";
import { Translator } from "@/components/Translator";

const Translate = () => (
  <AppLayout title="Translate" subtitle="Speak freely in English" showBack backTo="/">
    <div className="mx-auto max-w-2xl">
      <Translator />
    </div>
  </AppLayout>
);

export default Translate;