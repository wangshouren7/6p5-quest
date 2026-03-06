"use client";

import { Leva } from "leva";
import { Settings as SettingsIcon } from "lucide-react";
import { levaDarkTheme, levaLightTheme } from "./leva-themes";
import { useResolvedTheme } from "./use-resolved-theme";

export function Settings() {
  const { theme } = useResolvedTheme();
  const levaTheme =
    (theme ?? "light") === "light" ? levaLightTheme : levaDarkTheme;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-square text-base-content"
        aria-label="设置"
        onClick={() =>
          (
            document.getElementById("settings_modal") as HTMLDialogElement
          )?.showModal()
        }
      >
        <SettingsIcon className="size-6" />
      </button>

      <dialog id="settings_modal" className="modal">
        <div className="modal-box fixed max-h-[90vh] flex flex-col">
          <h3 className="font-bold text-lg mb-4">Settings</h3>
          <div className="flex-1 min-h-0 overflow-auto">
            <Leva fill titleBar={false} theme={levaTheme} />
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button type="submit" className="btn">
                Close
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
