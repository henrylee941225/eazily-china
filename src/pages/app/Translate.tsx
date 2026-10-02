import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Translator } from "@/components/Translator";

const Translate = () => {
  const [cameraActive, setCameraActive] = useState(false);

  return (
    <AppLayout title="Translate" subtitle="Speak freely in English" showBack backTo="/" hideTabBar={cameraActive}>
      <div className="mx-auto max-w-2xl">
        <Translator onCameraModeChange={setCameraActive} />
      </div>
    </AppLayout>
  );
};

export default Translate;
