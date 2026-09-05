import { LiveAvatarDemo } from "../src/components/LiveAvatarDemo";
import { PhonePortraitGuard } from "../src/components/PhonePortraitGuard";

export default function Home() {
  return (
    <>
      <main data-aiasap-portrait-shell="1" className="contents">
        <LiveAvatarDemo />
      </main>
      <PhonePortraitGuard />
    </>
  );
}
